import 'server-only';
import { createAdminClient } from '../supabase/admin';
import { createClient } from '../supabase/server';
import { z } from 'zod';
import { headers } from 'next/headers';

import { sendEmailWithRetry } from '../email/resend';
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
    throw new Error('Unauthorized');
  }

  // Enforce PRD boundary: Admin can ONLY invite interns. Approver & Admin invites require system_admin.
  if (currentDbUser.role === 'admin' && role !== 'intern') {
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
  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

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

  // Block login if intern self-registration is still pending administrator approval
  if (signInData?.user?.user_metadata?.approved === false) {
    await supabase.auth.signOut();
    return {
      success: false,
      error: 'Your registration is pending administrator approval. You will receive an email once admitted to the cohort.',
      isPendingApproval: true,
    };
  }
  
  return { success: true };
}

export const internSelfRegistrationSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Please enter your full name.')
      .max(100, 'Name cannot exceed 100 characters.'),
    email: z
      .string()
      .trim()
      .email('Please enter a valid email address.')
      .max(255),
    password: z
      .string()
      .min(12, 'Password must be at least 12 characters long.')
      .max(128),
    confirmPassword: z.string(),
    school: z
      .string()
      .trim()
      .min(2, 'Please enter your school or university.')
      .max(200, 'School name cannot exceed 200 characters.'),
    batch: z
      .string()
      .trim()
      .regex(/^\d+$/, 'Batch year must contain numbers only.')
      .min(1, 'Please enter a batch year.')
      .max(20, 'Batch year cannot exceed 20 digits.'),
    start: z.string().date('Please select a valid start date.'),
    end: z.string().date('Please select a valid end date.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })
  .refine((data) => new Date(data.end) > new Date(data.start), {
    message: 'OJT End date must be after start date.',
    path: ['end'],
  })
  .refine(
    (data) => {
      const start = new Date(data.start);
      const end = new Date(data.end);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 365;
    },
    {
      message: 'OJT duration cannot exceed 12 months.',
      path: ['end'],
    }
  );

export type InternSelfRegistrationInput = z.infer<typeof internSelfRegistrationSchema>;

export async function registerInternWithPassword(formData: FormData) {
  const fullName =
    (formData.get('fullName') as string) || (formData.get('name') as string) || '';
  const email = (formData.get('email') as string) || '';
  const password = (formData.get('password') as string) || '';
  const confirmPassword = (formData.get('confirmPassword') as string) || '';
  const school = (formData.get('school') as string) || '';
  const batch = (formData.get('batch') as string) || '';
  const start = (formData.get('start') as string) || '';
  const end = (formData.get('end') as string) || '';

  const parsed = internSelfRegistrationSchema.safeParse({
    fullName,
    email,
    password,
    confirmPassword,
    school,
    batch,
    start,
    end,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid registration details.',
    };
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  const adminClient = createAdminClient();

  // 1. Check if user already exists
  const { data: existingUser } = await adminClient
    .from('users')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingUser) {
    return {
      success: false,
      error: 'An account with this email already exists or is pending approval.',
    };
  }

  // 2. Create user identity in auth.users with password, set approved: false
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.fullName,
      school: parsed.data.school,
      batch: parsed.data.batch,
      internship_start: parsed.data.start,
      internship_end: parsed.data.end,
      approved: false,
    },
  });

  if (authError || !authData.user) {
    return {
      success: false,
      error: authError?.message || 'Failed to submit registration request.',
    };
  }

  const userId = authData.user.id;

  // 3. Upsert user in public.users with role: 'intern'
  const { error: profileError } = await adminClient.from('users').upsert({
    id: userId,
    email: normalizedEmail,
    role: 'intern',
    full_name: parsed.data.fullName,
    school: parsed.data.school,
    batch: parsed.data.batch,
    internship_start: parsed.data.start,
    internship_end: parsed.data.end,
  });

  if (profileError) {
    console.error('[registerInternWithPassword] profile creation error:', profileError.message);
  }

  // 4. Record append-only audit event
  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';

  await adminClient.from('audit_log').insert({
    actor_id: userId,
    action: 'INTERN_REGISTRATION_REQUESTED',
    target_id: userId,
    target_type: 'users',
    source_ip: ip,
    payload: {
      full_name: parsed.data.fullName,
      email: normalizedEmail,
      school: parsed.data.school,
      batch: parsed.data.batch,
      internship_start: parsed.data.start,
      internship_end: parsed.data.end,
      approved: false,
    },
  });

  return {
    success: true,
    name: parsed.data.fullName,
    email: normalizedEmail,
  };
}

