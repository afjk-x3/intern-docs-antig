import 'server-only';
import { createAdminClient } from '../supabase/admin';
import { createClient } from '../supabase/server';

export interface DashboardIntern {
  id: string;
  email: string;
  internship_start: string | null;
  internship_end: string | null;
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
  due_date: string | null;
  isOverdue: boolean;
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
    .select('id, email, internship_start, internship_end')
    .eq('role', 'intern')
    .order('email');

  if (internsError) throw new Error(`Failed to load interns: ${internsError.message}`);

  // Fetch requirements
  const { data: requirements, error: reqError } = await adminClient
    .from('requirements')
    .select('id, name')
    .order('created_at');

  if (reqError) throw new Error(`Failed to load requirements: ${reqError.message}`);

  // Fetch submissions (optimized for matrix)
  const { data: submissions, error: subError } = await adminClient
    .from('submissions')
    .select(`
      id,
      intern_id,
      requirement_id,
      state,
      current_holder_id,
      due_date,
      users!submissions_current_holder_id_fkey(email)
    `);

  if (subError) throw new Error(`Failed to load submissions: ${subError.message}`);

  const now = new Date();
  const formattedSubmissions = submissions.map(sub => ({
    id: sub.id,
    intern_id: sub.intern_id,
    requirement_id: sub.requirement_id,
    state: sub.state,
    current_holder_id: sub.current_holder_id,
    // @ts-expect-error nested field mapping
    current_holder_email: sub.users?.email || null,
    due_date: sub.due_date,
    isOverdue: sub.due_date
      ? new Date(sub.due_date).getTime() < now.getTime() && sub.state !== 'APPROVED' && sub.state !== 'PURGED'
      : false,
  }));

  const result = {
    interns: interns as DashboardIntern[],
    requirements: requirements as DashboardRequirement[],
    submissions: formattedSubmissions,
  };

  return JSON.parse(JSON.stringify(result));
}
