import 'server-only';
import { createAdminClient } from '../supabase/admin';
import { createClient } from '../supabase/server';
import { z } from 'zod';
import { headers } from 'next/headers';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['intern', 'approver', 'admin', 'system_admin']),
});

export async function inviteUser(email: string, role: string) {
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

  if (roleError || !['admin', 'system_admin'].includes(currentDbUser?.role)) {
    throw new Error('Unauthorized');
  }

  const parsed = inviteSchema.parse({ email, role });
  const adminClient = createAdminClient();

  // Call Supabase invite
  const { data: invitedUser, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(parsed.email);
  if (inviteError || !invitedUser.user) {
    throw new Error(`Failed to invite user: ${inviteError?.message}`);
  }

  // Insert into public.users
  const { error: insertError } = await adminClient.from('users').insert({
    id: invitedUser.user.id,
    email: parsed.email,
    role: parsed.role,
  });

  if (insertError) {
    throw new Error(`Failed to create user record: ${insertError.message}`);
  }

  // Audit log write
  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';

  await adminClient.from('audit_log').insert({
    actor_id: currentUser.id,
    action: 'INVITE_USER',
    target_id: invitedUser.user.id,
    target_type: 'users',
    source_ip: ip,
  });

  return { success: true, userId: invitedUser.user.id };
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
      details: { attempted_email: email }
      // email is stored in details, but never password
    });

    // Return a generic message — Supabase already returns generic errors,
    // but we re-wrap to ensure we never confirm email existence
    return { success: false, error: 'Invalid email or password' };
  }
  
  return { success: true };
}
