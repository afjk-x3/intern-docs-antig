import 'server-only';
import { createAdminClient } from '../supabase/admin';
import { createClient } from '../supabase/server';
import { z } from 'zod';
import { headers } from 'next/headers';

import { sendEmailWithRetry } from '../email/resend';
import { logPermissionDenied } from './audit';
import { setFullName, updateInternshipDates } from './users';
import { acknowledgePrivacyNotice } from './privacy';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['intern', 'approver', 'admin', 'system_admin']),
  school: z.string().trim().max(200).optional(),
  batch: z.string().trim().max(100).optional(),
});

// Derived from the incoming request rather than NEXT_PUBLIC_SITE_URL: that env var
// is inlined at build time, so it silently falls back to localhost in any deploy
// where it wasn't set before the build ran (see the sign-out fix in
// src/app/auth/signout/route.ts for the same reasoning).
async function getAcceptInviteUrl(): Promise<string> {
  const reqHeaders = await headers();
  const host = reqHeaders.get('x-forwarded-host') || reqHeaders.get('host') || 'localhost:3000';
  const proto = reqHeaders.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  // Points directly at /accept-invite rather than /auth/callback: Supabase's invite-email
  // confirmation link (both inviteUserByEmail and the generateLink fallbacks below) delivers
  // the session as a #access_token=... hash fragment, which servers can't read. Routing it
  // through /auth/callback first meant that route's code/token_hash-only logic always fell
  // through to its "invalid or expired" branch before the client-side hash parsing in
  // AcceptInvitePage ever ran. That page already handles hash tokens, token_hash, and code.
  return `${proto}://${host}/accept-invite`;
}

export async function inviteUser(email: string, role: string, school?: string, batch?: string) {
  const supabase = await createClient();
  const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

  if (authError || !currentUser) {
    throw new Error('Not authenticated');
  }

  // Validate current user is admin or system_admin
  const { data: currentDbUser, error: roleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', currentUser.id)
    .single();
  if (roleError || !currentDbUser || !['admin', 'system_admin'].includes(currentDbUser.role)) {
    await logPermissionDenied({ actorId: currentUser.id, attempted: 'INVITE_USER', targetType: 'users' });
    throw new Error('Unauthorized');
  }

  // Enforce PRD boundary: Admin can ONLY invite interns. Approver & Admin invites require system_admin.
  if (currentDbUser.role === 'admin' && role !== 'intern') {
    await logPermissionDenied({
      actorId: currentUser.id,
      attempted: 'INVITE_USER',
      targetType: 'users',
      reason: `admin attempted to invite role '${role}'; only system_admin may invite staff roles`,
    });
    throw new Error('Forbidden: Administrators can only invite interns. Inviting staff roles requires System Administrator privileges.');
  }

  const parsed = inviteSchema.parse({ email, role, school, batch });
  const adminClient = createAdminClient();
  const acceptInviteUrl = await getAcceptInviteUrl();

  let userId: string;
  let inviteLink: string | null = null;

  // 1. Try standard inviteUserByEmail
  const { data: invitedUser, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(parsed.email, {
    redirectTo: acceptInviteUrl,
  });

  if (invitedUser?.user) {
    userId = invitedUser.user.id;
  } else {
    // 2. Fallback: If user is already registered or rate limited, generate action link
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email: parsed.email,
      options: {
        redirectTo: acceptInviteUrl,
      },
    });

    if (linkData?.user) {
      userId = linkData.user.id;
      inviteLink = linkData.properties?.action_link || null;
    } else {
      // 3. Fallback: Lookup existing user
      const { data: listData } = await adminClient.auth.admin.listUsers();
      const existingUser = listData?.users?.find(
        (u) => u.email?.toLowerCase() === parsed.email.toLowerCase()
      );

      if (existingUser) {
        userId = existingUser.id;
        const { data: magicLinkData } = await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email: parsed.email,
          options: {
            redirectTo: acceptInviteUrl,
          },
        });
        inviteLink = magicLinkData?.properties?.action_link || null;
      } else {
        throw new Error(`Failed to invite user: ${inviteError?.message || linkError?.message}`);
      }
    }
  }

  // 4. Upsert user record in public.users
  const { error: insertError } = await adminClient.from('users').upsert({
    id: userId,
    email: parsed.email,
    role: parsed.role,
    ...(parsed.role === 'intern' ? { school: parsed.school || null, batch: parsed.batch || null } : {}),
  });

  if (insertError) {
    throw new Error(`Failed to create/update user record: ${insertError.message}`);
  }

  // 5. Send notification email via Resend (non-blocking)
  if (inviteLink) {
    try {
      await sendEmailWithRetry(
        parsed.email,
        'Welcome to InternDocs — Invitation Link',
        `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2>Welcome to InternDocs</h2>
          <p>You have been invited to the Makerspace document tracking portal as an <strong>${parsed.role}</strong>.</p>
          <p><a href="${inviteLink}" style="display: inline-block; background: #1e3a8a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px;">Accept Invitation & Set Password</a></p>
          <p style="font-size: 12px; color: #64748b;">This link expires in 7 days.</p>
        </div>
        `
      );
    } catch (emailErr) {
      console.warn('[Invite] Email dispatch non-fatal failure:', emailErr);
    }
  }

  // 6. Audit log write
  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';

  await adminClient.from('audit_log').insert({
    actor_id: currentUser.id,
    action: 'INVITE_USER',
    target_id: userId,
    target_type: 'users',
    source_ip: ip,
  });

  return { success: true, userId, inviteLink };
}

const passwordSchema = z.object({
  password: z.string().min(12, "Password must be at least 12 characters"),
});

export async function updatePassword(password: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const parsed = passwordSchema.parse({ password });
  
  const { error: updateError } = await supabase.auth.updateUser({ password: parsed.password });
  if (updateError) {
    throw new Error(`Failed to update password: ${updateError.message}`);
  }

  const adminClient = createAdminClient();
  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';

  await adminClient.from('audit_log').insert({
    actor_id: user.id,
    action: 'UPDATE_PASSWORD',
    target_id: user.id,
    target_type: 'users',
    source_ip: ip,
  });

  return { success: true };
}

/**
 * Which extra fields the Accept Invitation form needs to show -- interns additionally
 * collect internship dates and the privacy notice acknowledgement (FR-25) as part of
 * onboarding, instead of the separate first-login /privacy-notice interstitial every
 * other role still goes through.
 */
export async function getOnboardingContext(): Promise<{ role: string }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const { data: dbUser, error } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (error || !dbUser) throw new Error('User record not found');

  return { role: dbUser.role };
}

const privacyAckSchema = z.literal(true, 'You must acknowledge the privacy notice to continue');

export async function completeOnboarding(input: {
  fullName: string;
  password: string;
  internshipStart?: string;
  internshipEnd?: string;
  privacyAcknowledged?: boolean;
}) {
  const { role } = await getOnboardingContext();

  await updatePassword(input.password);
  await setFullName(input.fullName);

  if (role === 'intern') {
    if (!input.internshipStart || !input.internshipEnd) {
      throw new Error('Internship start and end dates are required.');
    }
    privacyAckSchema.parse(input.privacyAcknowledged === true);
    await updateInternshipDates(input.internshipStart, input.internshipEnd);
    await acknowledgePrivacyNotice();
  }

  return { success: true, role };
}

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Log the failed attempt — never log the password in any field
    const adminClient = createAdminClient();
    const reqHeaders = await headers();
    const ip = reqHeaders.get('x-forwarded-for') || 'unknown';

    await adminClient.from('audit_log').insert({
      actor_id: null, // user may not exist; do not leak existence info
      action: 'LOGIN_FAILED',
      target_type: 'auth',
      source_ip: ip,
      payload: { attempted_email: email }
      // email is stored in payload, but never password
    });

    // Return a generic message — Supabase already returns generic errors,
    // but we re-wrap to ensure we never confirm email existence
    return { success: false, error: 'Invalid email or password' };
  }

  // FR-24 lists "login" as a required event, not just "failed login". Without this the log
  // could show who failed to get in but never who actually did -- which is the half that
  // matters when reconstructing what a given account did during an incident.
  const adminClient = createAdminClient();
  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';
  const { data: { user: signedInUser } } = await supabase.auth.getUser();

  await adminClient.from('audit_log').insert({
    actor_id: signedInUser?.id ?? null,
    action: 'LOGIN_SUCCEEDED',
    target_id: signedInUser?.id ?? null,
    target_type: 'auth',
    source_ip: ip,
  });

  return { success: true };
}

export const internRegisterEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address.')
    .max(255),
});

export type InternRegisterEmailInput = z.infer<typeof internRegisterEmailSchema>;

export async function registerIntern(emailOrFormData: string | FormData) {
  const rawEmail =
    typeof emailOrFormData === 'string'
      ? emailOrFormData
      : ((emailOrFormData.get('email') as string) || '');

  const parsed = internRegisterEmailSchema.safeParse({ email: rawEmail });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid email address.' };
  }

  const email = parsed.data.email.toLowerCase();
  const adminClient = createAdminClient();

  // 1. Check if user already exists in public.users
  const { data: existingDbUser } = await adminClient
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingDbUser) {
    return { success: false, error: 'An account with this email already exists. Please sign in.' };
  }

  const acceptInviteUrl = await getAcceptInviteUrl();
  let userId: string;
  let inviteLink: string | null = null;

  // 2. Try standard inviteUserByEmail
  const { data: invitedUser, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: acceptInviteUrl,
  });

  if (invitedUser?.user) {
    userId = invitedUser.user.id;
  } else {
    // 3. Fallback: generate invite link directly
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: acceptInviteUrl,
      },
    });

    if (linkData?.user) {
      userId = linkData.user.id;
      inviteLink = linkData.properties?.action_link || null;
    } else {
      // 4. Fallback: Lookup existing auth user
      const { data: listData } = await adminClient.auth.admin.listUsers();
      const existingAuth = listData?.users?.find((u) => u.email?.toLowerCase() === email);
      if (existingAuth) {
        userId = existingAuth.id;
        const { data: magicLinkData } = await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: { redirectTo: acceptInviteUrl },
        });
        inviteLink = magicLinkData?.properties?.action_link || null;
      } else {
        throw new Error(`Failed to generate activation link: ${inviteError?.message || linkError?.message}`);
      }
    }
  }

  // 4. Upsert user profile into public.users with strict role: 'intern'
  const { error: profileError } = await adminClient.from('users').upsert({
    id: userId,
    email,
    role: 'intern',
  });

  if (profileError) {
    console.error('[registerIntern] profile creation error:', profileError.message);
  }

  // 5. Send email with setup link via Resend (if inviteLink available)
  if (inviteLink) {
    try {
      await sendEmailWithRetry(
        email,
        'Welcome to InternDocs — Complete Your Registration',
        `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2>Welcome to InternDocs!</h2>
          <p>You requested to register as an intern. Click the button below to set up your password and begin your onboarding:</p>
          <p style="margin: 25px 0;">
            <a href="${inviteLink}" style="background-color: #1B3251; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Set Up Password</a>
          </p>
          <p style="font-size: 12px; color: #64748b;">If you did not request this registration, you can safely ignore this email.</p>
        </div>
        `
      );
    } catch (mailErr) {
      console.warn('[registerIntern] notification email warning:', mailErr);
    }
  }

  // 6. Record append-only audit log
  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';

  await adminClient.from('audit_log').insert({
    actor_id: userId,
    action: 'INTERN_REGISTRATION_REQUESTED',
    target_id: userId,
    target_type: 'users',
    source_ip: ip,
    payload: { email },
  });

  return { success: true, email };
}

