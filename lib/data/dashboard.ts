import 'server-only';
import { createAdminClient } from '../supabase/admin';
import { createClient } from '../supabase/server';

export interface DashboardIntern {
  id: string;
  email: string;
  full_name: string | null;
  internship_start: string | null;
  internship_end: string | null;
  school: string | null;
  batch: string | null;
}

export interface DashboardRequirement {
  id: string;
  name: string;
}

export interface DashboardSubmission {
  id: string;
  intern_id: string;
  requirement_id: string;
  state: string;
  current_holder_id: string | null;
  current_holder_email?: string | null;
  current_holder_name?: string | null;
  due_date: string | null;
  isOverdue: boolean;
  /** FR-21: submitted date is when the submission record was first created. */
  submitted_at: string | null;
  /** FR-21: approved date, from the latest (final) approval, when the state is APPROVED. */
  approved_at: string | null;
  approver_email?: string | null;
  approver_name?: string | null;
}

export interface AdminDashboardData {
  interns: DashboardIntern[];
  requirements: DashboardRequirement[];
  submissions: DashboardSubmission[];
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!dbUser || !['admin', 'system_admin'].includes(dbUser.role)) {
    throw new Error('Unauthorized');
  }

  const adminClient = createAdminClient();

  // Fetch interns
  const { data: interns, error: internsError } = await adminClient
    .from('users')
    .select('id, email, full_name, internship_start, internship_end, school, batch')
    .eq('role', 'intern')
    .order('email');

  if (internsError) throw new Error(`Failed to load interns: ${internsError.message}`);

  // Fetch requirements
  const { data: requirements, error: reqError } = await adminClient
    .from('requirements')
    .select('id, name')
    .order('created_at');

  if (reqError) throw new Error(`Failed to load requirements: ${reqError.message}`);

  // Fetch submissions (optimized for matrix + FR-21 export)
  const { data: submissions, error: subError } = await adminClient
    .from('submissions')
    .select(`
      id,
      intern_id,
      requirement_id,
      state,
      current_holder_id,
      due_date,
      created_at,
      users!submissions_current_holder_id_fkey(email, full_name),
      approvals(step, created_at, users(email, full_name))
    `);

  if (subError) throw new Error(`Failed to load submissions: ${subError.message}`);

  interface RawSubmissionRow {
    id: string;
    intern_id: string;
    requirement_id: string;
    state: string;
    current_holder_id: string | null;
    due_date: string | null;
    created_at: string;
    users?: { email?: string; full_name?: string | null } | null;
    approvals?: Array<{ step: number; created_at: string; users?: { email?: string; full_name?: string | null } | null }>;
  }

  const now = new Date();
  const typedSubmissions = (submissions || []) as unknown as RawSubmissionRow[];
  const formattedSubmissions = typedSubmissions.map(sub => {
    const holder = sub.users;
    const approvals = sub.approvals || [];
    const latestApproval = [...approvals].sort((a, b) => b.step - a.step)[0] || null;

    return {
      id: sub.id,
      intern_id: sub.intern_id,
      requirement_id: sub.requirement_id,
      state: sub.state,
      current_holder_id: sub.current_holder_id,
      current_holder_email: holder?.email || null,
      current_holder_name: holder?.full_name || null,
      due_date: sub.due_date,
      isOverdue: sub.due_date
        ? new Date(sub.due_date).getTime() < now.getTime() && sub.state !== 'APPROVED' && sub.state !== 'PURGED'
        : false,
      submitted_at: sub.created_at,
      approved_at: sub.state === 'APPROVED' && latestApproval ? latestApproval.created_at : null,
      approver_email: sub.state === 'APPROVED' ? latestApproval?.users?.email || null : null,
      approver_name: sub.state === 'APPROVED' ? latestApproval?.users?.full_name || null : null,
    };
  });

  const result = {
    interns: interns as DashboardIntern[],
    requirements: requirements as DashboardRequirement[],
    submissions: formattedSubmissions,
  };

  return JSON.parse(JSON.stringify(result));
}
