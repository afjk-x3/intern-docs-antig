import Link from 'next/link';
import { createAdminClient } from '@lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function RetentionPage() {
  const adminClient = createAdminClient();

  const { data: submissions } = await adminClient
    .from('submissions')
    .select(`
      id,
      requirements(name),
      users!submissions_intern_id_fkey(email),
      submission_versions(deleted_at)
    `)
    .eq('state', 'PURGED')
    .order('created_at', { ascending: false });

  const purgedItems = submissions || [];

  return (
    <div className="p-6 md:p-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Retention & Deletions</h1>
        <p className="text-sm text-text-muted mt-1">
          Submissions whose file bytes have been permanently purged under the 30-day retention policy. The
          approval record, hash, and audit trail survive for at least 3 years — only the file itself is gone.
        </p>
      </div>

      <div className="bg-surface-bg border border-border-default rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Purged submissions">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted border-b border-border-default text-xs uppercase font-semibold text-text-muted">
              <tr>
                <th className="px-6 py-3">Intern</th>
                <th className="px-6 py-3">Requirement</th>
                <th className="px-6 py-3">Purged On</th>
                <th className="px-6 py-3 text-right">Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {purgedItems.map((item) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const versions = (item.submission_versions || []) as any[];
                const deletedAt = versions.find((v) => v.deleted_at)?.deleted_at;
                return (
                  <tr key={item.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 font-medium text-text-primary">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(item.users as any)?.email || '—'}
                    </td>
                    <td className="px-6 py-4 text-text-primary">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(item.requirements as any)?.name || '—'}
                    </td>
                    <td className="px-6 py-4 text-text-muted">
                      {deletedAt ? new Date(deletedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/admin/submissions/${item.id}`} className="text-xs font-semibold text-brand-primary hover:underline">
                        View Record →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {purgedItems.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-text-muted text-sm">
                    No submissions have reached the 30-day deletion threshold yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
