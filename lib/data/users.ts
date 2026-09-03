import 'server-only';
import { createClient } from '../supabase/server';
import { createAdminClient } from '../supabase/admin';
import { z } from 'zod';
import { headers } from 'next/headers';

const datesSchema = z.object({
  start: z.string().date(),
  end: z.string().date(),
}).refine(data => new Date(data.end) > new Date(data.start), {
  message: "End date must be after start date",
}).refine(data => {
  const start = new Date(data.start);
  const end = new Date(data.end);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 365;
}, {
  message: "Internship cannot exceed 12 months",
});

export const onboardingSchema = z.object({
  school: z.string().trim().min(2, 'Please enter your school or university.').max(200, 'School name must not exceed 200 characters.'),
  batch: z.string().trim().min(2, 'Please enter your batch or academic year.').max(100, 'Batch name must not exceed 100 characters.'),
  start: z.string().date(),
  end: z.string().date(),
}).refine(data => new Date(data.end) > new Date(data.start), {
  message: "End date must be after start date",
}).refine(data => {
  const start = new Date(data.start);
  const end = new Date(data.end);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 365;
}, {
  message: "Internship cannot exceed 12 months",
});

export async function completeInternOnboarding(school: string, batch: string, start: string, end: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const parsed = onboardingSchema.parse({ school, batch, start, end });

  // Update user profile via adminClient to ensure fields are persisted reliably
  const adminClient = createAdminClient();
  const { error: updateError } = await adminClient
    .from('users')
    .update({
      school: parsed.school,
      batch: parsed.batch,
      internship_start: parsed.start,
      internship_end: parsed.end,
    })
    .eq('id', user.id);

  if (updateError) throw new Error(updateError.message);

  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';

  await adminClient.from('audit_log').insert({
    actor_id: user.id,
    action: 'INTERN_ONBOARDING_COMPLETED',
    target_id: user.id,
    target_type: 'users',
    source_ip: ip,
    payload: { school: parsed.school, batch: parsed.batch },
  });

  return { success: true };
}

export async function updateInternshipDates(start: string, end: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const parsed = datesSchema.parse({ start, end });

  // First approval check: editable until first approval
  const { data: myApprovals } = await supabase
    .from('submissions')
    .select('id, approvals(id)')
    .eq('intern_id', user.id);
    
  const hasApprovals = myApprovals?.some(sub => sub.approvals && sub.approvals.length > 0);
  if (hasApprovals) {
    throw new Error('Dates locked after first approval');
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({ internship_start: parsed.start, internship_end: parsed.end })
    .eq('id', user.id);

  if (updateError) throw new Error(updateError.message);

  const adminClient = createAdminClient();
  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';

  await adminClient.from('audit_log').insert({
    actor_id: user.id,
    action: 'UPDATE_INTERNSHIP_DATES',
    target_id: user.id,
    target_type: 'users',
    source_ip: ip,
  });

  return { success: true };
}

const fullNameSchema = z.object({
  full_name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(150),
});

/**
 * The printed name composited onto signed PDFs in place of email (FR-11). Set once
 * at onboarding (see lib/data/auth.ts, completeOnboarding) and editable afterward from
 * the Approver's Signature Settings page -- there is no separate profile page.
 */
export async function setFullName(fullName: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const parsed = fullNameSchema.parse({ full_name: fullName });

  const { error: updateError } = await supabase
    .from('users')
    .update({ full_name: parsed.full_name })
    .eq('id', user.id);

  if (updateError) throw new Error(updateError.message);

  const adminClient = createAdminClient();
  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';

  await adminClient.from('audit_log').insert({
    actor_id: user.id,
    action: 'UPDATE_FULL_NAME',
    target_id: user.id,
    target_type: 'users',
    source_ip: ip,
  });

  return { success: true };
}

export async function getOwnFullName(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const { data } = await supabase.from('users').select('full_name').eq('id', user.id).single();
  return data?.full_name ?? null;
}

/**
 * FR-3: "editable until the first submission is approved, after which a change requires
 * admin action." `updateInternshipDates()` above is the intern's own self-service path
 * and enforces that lock; this is the admin-action escape hatch the acceptance criteria
 * requires -- same validation (end after start, <=365 days), but admin/system_admin only,
 * for any target user, and does not check the lock (that's the whole point of it).
 */
export async function updateInternshipDatesAsAdmin(targetUserId: string, start: string, end: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!dbUser || !['admin', 'system_admin'].includes(dbUser.role)) {
    throw new Error('Unauthorized: Only administrators can change another user\'s internship dates.');
  }

  const parsed = datesSchema.parse({ start, end });
  const adminClient = createAdminClient();

  const { error: updateError } = await adminClient
    .from('users')
    .update({ internship_start: parsed.start, internship_end: parsed.end })
    .eq('id', targetUserId);

  if (updateError) throw new Error(updateError.message);

  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';

  await adminClient.from('audit_log').insert({
    actor_id: user.id,
    action: 'ADMIN_UPDATE_INTERNSHIP_DATES',
    target_id: targetUserId,
    target_type: 'users',
    source_ip: ip,
  });

  return { success: true };
}

/**
 * Distinct school/batch values already in use, for the invite form's autocomplete --
 * keeps group naming consistent (e.g. avoids "DLSU" vs "De La Salle University" splitting filters).
 */
export async function getInternGroupOptions(): Promise<{ schools: string[]; batches: string[] }> {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from('users')
    .select('school, batch')
    .eq('role', 'intern');

  const schools = new Set<string>();
  const batches = new Set<string>();
  for (const row of data || []) {
    if (row.school) schools.add(row.school);
    if (row.batch) batches.add(row.batch);
  }

  return { schools: Array.from(schools).sort(), batches: Array.from(batches).sort() };
}

const groupSchema = z.object({
  school: z.string().trim().max(200).optional(),
  batch: z.string().trim().max(100).optional(),
});

export async function updateUserGroup(userId: string, school: string, batch: string) {
  const supabase = await createClient();
  const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
  if (authError || !currentUser) throw new Error('Not authenticated');

  const { data: currentDbUser, error: roleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', currentUser.id)
    .single();

  if (roleError || !['admin', 'system_admin'].includes(currentDbUser?.role)) {
    throw new Error('Unauthorized');
  }

  const parsed = groupSchema.parse({ school, batch });
  const adminClient = createAdminClient();
  const { error: updateError } = await adminClient
    .from('users')
    .update({ school: parsed.school || null, batch: parsed.batch || null })
    .eq('id', userId);

  if (updateError) throw new Error(updateError.message);

  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';

  await adminClient.from('audit_log').insert({
    actor_id: currentUser.id,
    action: 'UPDATE_GROUP',
    target_id: userId,
    target_type: 'users',
    source_ip: ip,
  });

  return { success: true };
}

export async function updateUserRole(userId: string, newRole: string) {
  const supabase = await createClient();
  const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
  if (authError || !currentUser) throw new Error('Not authenticated');

  const { data: currentDbUser, error: roleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', currentUser.id)
    .single();

  if (roleError || !['admin', 'system_admin'].includes(currentDbUser?.role)) {
    throw new Error('Unauthorized');
  }

  const adminClient = createAdminClient();
  const { error: updateError } = await adminClient
    .from('users')
    .update({ role: newRole })
    .eq('id', userId);

  if (updateError) throw new Error(updateError.message);

  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';

  await adminClient.from('audit_log').insert({
    actor_id: currentUser.id,
    action: 'UPDATE_ROLE',
    target_id: userId,
    target_type: 'users',
    source_ip: ip,
  });

  return { success: true };
}
