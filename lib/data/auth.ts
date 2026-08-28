import 'server-only';
import { createAdminClient } from '../supabase/admin';
import { createClient } from '../supabase/server';
import { z } from 'zod';
import { headers } from 'next/headers';

import { sendEmailWithRetry } from '../email/resend';

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
  
  return { success: true };
}
