import 'server-only';
import { createClient } from '../supabase/server';
import { createAdminClient } from '../supabase/admin';

export interface AuditLogSubmissionDetails {
  id: string;
  requirement_name: string;
  intern_email: string | null;
  state: string;
  version_number: number;
  has_file: boolean;
  file_url: string | null;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  source_ip: string | null;
  created_at: string;
  users: {
    id: string;
    email: string;
  } | null;
  target_user?: {
    id: string;
    email: string;
    role?: string;
  } | null;
  target_requirement?: {
    id: string;
    name: string;
  } | null;
  submission?: AuditLogSubmissionDetails | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function enrichAuditLogs(adminClient: any, rawLogs: any[]): Promise<AuditLogEntry[]> {
  if (!rawLogs || rawLogs.length === 0) return [];

  const actorIds = [...new Set(rawLogs.map((e) => e.actor_id).filter(Boolean))];
  const submissionIds = [
    ...new Set(rawLogs.filter((e) => e.target_type === 'submissions' && e.target_id).map((e) => e.target_id)),
  ];
  const userTargetIds = [
    ...new Set(rawLogs.filter((e) => e.target_type === 'users' && e.target_id).map((e) => e.target_id)),
  ];
  const reqTargetIds = [
    ...new Set(rawLogs.filter((e) => e.target_type === 'requirements' && e.target_id).map((e) => e.target_id)),
  ];

  const allUserIds = [...new Set([...actorIds, ...userTargetIds])];

  const [usersRes, submissionsRes, requirementsRes] = await Promise.all([
    allUserIds.length > 0
      ? adminClient.from('users').select('id, email, role').in('id', allUserIds)
      : Promise.resolve({ data: [] }),
    submissionIds.length > 0
      ? adminClient
          .from('submissions')
          .select(`
            id,
            state,
            intern_id,
            requirements(id, name),
            users!submissions_intern_id_fkey(id, email),
            submission_versions(id, version_number, file_url, is_superseded, created_at)
          `)
          .in('id', submissionIds)
      : Promise.resolve({ data: [] }),
    reqTargetIds.length > 0
      ? adminClient.from('requirements').select('id, name').in('id', reqTargetIds)
      : Promise.resolve({ data: [] }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usersMap = new Map((usersRes.data || []).map((u: any) => [u.id, u]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submissionsMap = new Map((submissionsRes.data || []).map((s: any) => [s.id, s]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requirementsMap = new Map((requirementsRes.data || []).map((r: any) => [r.id, r]));

  return rawLogs.map((e) => {
    const actorUser = e.actor_id ? usersMap.get(e.actor_id) || null : null;
    const targetUser = e.target_type === 'users' && e.target_id ? usersMap.get(e.target_id) || null : null;
    const targetReq = e.target_type === 'requirements' && e.target_id ? requirementsMap.get(e.target_id) || null : null;

    let submissionDetails: AuditLogSubmissionDetails | null = null;
    if (e.target_type === 'submissions' && e.target_id) {
      const sub = submissionsMap.get(e.target_id);
      if (sub) {
        const versions = sub.submission_versions || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const activeVer = versions.find((v: any) => !v.is_superseded) || versions[0] || null;
        submissionDetails = {
          id: sub.id,
          requirement_name: sub.requirements?.name || 'Document Requirement',
          intern_email: sub.users?.email || null,
          state: sub.state,
          version_number: activeVer?.version_number || 1,
          has_file: !!activeVer?.file_url,
          file_url: activeVer?.file_url || null,
        };
      }
    }

    return {
      id: e.id,
      actor_id: e.actor_id,
      action: e.action,
      target_type: e.target_type,
      target_id: e.target_id,
      source_ip: e.source_ip,
      created_at: e.created_at,
      users: actorUser ? { id: actorUser.id, email: actorUser.email } : null,
      target_user: targetUser ? { id: targetUser.id, email: targetUser.email, role: targetUser.role } : null,
      target_requirement: targetReq ? { id: targetReq.id, name: targetReq.name } : null,
      submission: submissionDetails,
    };
  });
}

export async function getAuditLogs(options?: { actorId?: string; targetId?: string; limit?: number }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!dbUser || !['admin', 'system_admin'].includes(dbUser.role)) {
    throw new Error('Forbidden');
  }

  const adminClient = createAdminClient();
  const limit = options?.limit || 100;

  let query = adminClient
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options?.actorId) {
    query = query.eq('actor_id', options.actorId);
  }
  if (options?.targetId) {
    query = query.eq('target_id', options.targetId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load audit logs: ${error.message}`);
  }

  return enrichAuditLogs(adminClient, data || []);
}
