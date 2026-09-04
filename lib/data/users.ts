import 'server-only';
import { createClient } from '../supabase/server';
import { createAdminClient } from '../supabase/admin';
import { z } from 'zod';
import { headers } from 'next/headers';
import { sendEmailWithRetry } from '../email/resend';
import { logPermissionDenied } from './audit';

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
    await logPermissionDenied({
      actorId: user.id,
      attempted: 'ADMIN_UPDATE_INTERNSHIP_DATES',
      targetType: 'users',
      targetId: targetUserId,
    });
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
    await logPermissionDenied({
      actorId: currentUser.id,
      attempted: 'UPDATE_GROUP',
      targetType: 'users',
      targetId: userId,
    });
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
    await logPermissionDenied({
      actorId: currentUser.id,
      attempted: 'UPDATE_ROLE',
      targetType: 'users',
      targetId: userId,
      reason: `attempted to set role '${newRole}'`,
    });
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

export async function approveInternRegistration(targetUserId: string) {
  const supabase = await createClient();
  const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
  if (authError || !currentUser) throw new Error('Not authenticated');

  const { data: currentDbUser, error: roleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', currentUser.id)
    .single();

  if (roleError || !['admin', 'system_admin'].includes(currentDbUser?.role)) {
    throw new Error('Unauthorized: Only administrators can approve registrations.');
  }

  const adminClient = createAdminClient();
  const { data: targetAuthUser, error: targetError } = await adminClient.auth.admin.getUserById(targetUserId);
  if (targetError || !targetAuthUser.user) {
    throw new Error('User not found');
  }

  // Update auth user metadata to approved: true
  const existingMeta = targetAuthUser.user.user_metadata || {};
  const { error: updateMetaError } = await adminClient.auth.admin.updateUserById(targetUserId, {
    user_metadata: {
      ...existingMeta,
      approved: true,
    },
  });

  if (updateMetaError) {
    throw new Error(`Failed to update approval status: ${updateMetaError.message}`);
  }

  // Fetch user profile from public.users
  const { data: profile } = await adminClient
    .from('users')
    .select('email, full_name, school, batch')
    .eq('id', targetUserId)
    .single();

  const internEmail = profile?.email || targetAuthUser.user.email || '';
  const internName = profile?.full_name || existingMeta.full_name || 'Intern';
  const school = profile?.school || existingMeta.school || 'Makerspace';
  const batch = profile?.batch || existingMeta.batch || '';

  // Get base URL for login
  const reqHeaders = await headers();
  const host = reqHeaders.get('x-forwarded-host') || reqHeaders.get('host') || 'localhost:3000';
  const proto = reqHeaders.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  const loginUrl = `${proto}://${host}/login`;

  // Send approval email via Resend
  if (internEmail) {
    await sendEmailWithRetry(
      internEmail,
      'Welcome to Makerspace — Your Intern Registration is Approved!',
      `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1e293b; max-width: 560px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px;">
        <h2 style="color: #1B3251; margin-top: 0; font-size: 20px;">Welcome to Makerspace InnovHub!</h2>
        <p>Hello <strong>${internName}</strong>,</p>
        <p>Great news! Your registration request for <strong>${school}</strong> (Batch ${batch}) has been approved by the administration. You have officially been admitted to the cohort.</p>
        <p>You can now sign in to your cohort dashboard using the email address and password you specified when you registered.</p>
        <div style="margin: 28px 0;">
          <a href="${loginUrl}" style="background-color: #1B3251; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">Sign In to InternDocs</a>
        </div>
        <p style="font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
          Makerspace InnovHub Cohort Administration
        </p>
      </div>
      `
    );
  }

  // Record audit log
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';
  await adminClient.from('audit_log').insert({
    actor_id: currentUser.id,
    action: 'INTERN_REGISTRATION_APPROVED',
    target_id: targetUserId,
    target_type: 'users',
    source_ip: ip,
    payload: {
      intern_email: internEmail,
      intern_name: internName,
      school,
      batch,
    },
  });

  return { success: true };
}

export interface CohortUser {
  id: string;
  email: string;
  fullName: string | null;
  school: string | null;
  batch: string | null;
  internshipStart: string | null;
  internshipEnd: string | null;
  status: 'active' | 'pending';
  createdAt: string;
}

/**
 * Every intern account -- both admitted cohort members and self-registered accounts still
 * awaiting admin approval -- in one list, for the /admin/users table.
 *
 * "Pending" isn't a public.users column: registerInternWithPassword (lib/data/auth.ts)
 * creates the auth.users identity immediately with user_metadata.approved = false, and
 * approveInternRegistration flips it to true. An admin-invited intern (inviteUser) never
 * gets that key set at all, so its absence here is treated the same as approved -- an
 * invited intern was never meant to sit in a pending state.
 *
 * perPage is set high enough for realistic cohort sizes (FR-20 sizes the dashboard for
 * ~100 interns) since every id from the public.users query below needs a metadata lookup
 * and Supabase's listUsers() defaults to a 50-row page.
 */
export async function getAllInternUsers(): Promise<CohortUser[]> {
  const adminClient = createAdminClient();

  const { data: dbUsers, error } = await adminClient
    .from('users')
    .select('id, email, full_name, school, batch, internship_start, internship_end, created_at')
    .eq('role', 'intern')
    .order('created_at', { ascending: false });

  if (error || !dbUsers) return [];

  const { data: listData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const approvedMap = new Map(
    (listData?.users || []).map((u) => [u.id, u.user_metadata?.approved])
  );

  const users: CohortUser[] = dbUsers.map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    school: u.school,
    batch: u.batch,
    internshipStart: u.internship_start,
    internshipEnd: u.internship_end,
    status: approvedMap.get(u.id) === false ? 'pending' : 'active',
    createdAt: u.created_at,
  }));

  // Pending admissions surface first -- they're the ones needing action.
  return users.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
