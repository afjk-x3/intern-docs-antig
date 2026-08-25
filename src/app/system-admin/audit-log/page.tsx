import { AuditLogTable, AuditLogEntry } from '@/components/AuditLogTable';
import { createAdminClient } from '@lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function SystemAdminAuditLogPage() {
  const adminClient = createAdminClient();
  
  // Fetch initial data server-side
  const { data, error } = await adminClient
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(150);
    
  let initialLogs: AuditLogEntry[] = [];

  if (!error && data) {
    const actorIds = [...new Set(data.map(e => e.actor_id).filter(Boolean))];
    const { data: usersData } = await adminClient
      .from('users')
      .select('id, email')
      .in('id', actorIds);

    const usersMap = new Map((usersData || []).map(u => [u.id, u]));
    
    initialLogs = JSON.parse(JSON.stringify(data.map(e => ({
      ...e,
      users: e.actor_id ? usersMap.get(e.actor_id) || null : null
    }))));
  }

  return (
    <div className="p-6 md:p-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Security Audit Log</h1>
        <p className="text-sm text-text-muted mt-1">
          Append-only, immutable record of all authentication, state transition, and administrative events.
        </p>
      </div>
      
      {error ? (
        <div className="rounded-xl bg-rose-50 p-6 text-sm text-rose-800 border border-rose-200">
          Failed to load audit logs: {error.message}
        </div>
      ) : (
        <AuditLogTable initialLogs={initialLogs} />
      )}
    </div>
  );
}
