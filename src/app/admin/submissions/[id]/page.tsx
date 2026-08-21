import { createClient } from '@lib/supabase/server';
import { createAdminClient } from '@lib/supabase/admin';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

export default async function AdminSubmissionViewPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!dbUser || !['admin', 'system_admin'].includes(dbUser.role)) {
    redirect('/unauthorized');
  }

  const adminClient = createAdminClient();
  const { id } = params;

  // Fetch submission details with versions and approvals
  const { data: submission, error } = await adminClient
    .from('submissions')
    .select(`
      *,
      users!submissions_intern_id_fkey(email, internship_start, internship_end),
      requirements(name),
      submission_versions(*),
      approvals(*, users!approvals_approver_id_fkey(email, role))
    `)
    .eq('id', id)
    .single();

  if (error || !submission) {
    notFound();
  }

  // Find active version
  const versions = submission.submission_versions || [];
  const activeVersion = versions.find((v: any) => !v.is_superseded) || versions[0];
  
  // Sort approvals
  const approvals = (submission.approvals || []).sort((a: any, b: any) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="min-h-screen bg-surface-muted py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard" className="text-sm font-semibold text-text-muted hover:text-text-primary">
            &larr; Back to Dashboard
          </Link>
        </div>

        <div className="bg-surface-bg border border-border-default rounded-xl shadow-xs p-6">
          <div className="flex justify-between items-start mb-6 border-b border-border-default pb-4">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Submission Record</h1>
              <p className="text-sm text-text-muted mt-1">
                <strong>Intern:</strong> {submission.users?.email}
              </p>
              <p className="text-sm text-text-muted">
                <strong>Requirement:</strong> {submission.requirements?.name}
              </p>
            </div>
            <div>
              <span className={`px-3 py-1 text-xs font-bold rounded-lg uppercase tracking-wider ${
                submission.state === 'PURGED' ? 'bg-slate-100 text-slate-800 border border-slate-300' :
                submission.state === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                'bg-amber-100 text-amber-800'
              }`}>
                {submission.state}
              </span>
            </div>
          </div>

          {activeVersion?.deleted_at ? (
            <div className="mb-6 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700">
              <div className="flex items-center gap-2 font-bold mb-2 text-slate-900">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Document Deleted (Retention Policy)
              </div>
              <p>The file bytes for this submission were permanently deleted on <strong>{new Date(activeVersion.deleted_at).toLocaleString()}</strong> in accordance with data retention policies.</p>
              <p className="mt-2 font-mono text-[11px] bg-white px-2 py-1 border border-slate-200 rounded inline-block">
                Original SHA-256 Hash: {activeVersion.file_hash}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                This record serves as cryptographic proof that the approval took place prior to data deletion.
              </p>
            </div>
          ) : (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              File bytes are still securely stored. Retention purge has not yet occurred.
            </div>
          )}

          <div>
            <h2 className="text-lg font-bold text-text-primary mb-3">Approval History</h2>
            {approvals.length === 0 ? (
              <p className="text-sm text-text-muted italic">No approvals recorded.</p>
            ) : (
              <div className="space-y-4">
                {approvals.map((appr: any) => (
                  <div key={appr.id} className="bg-surface-muted border border-border-default rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-text-primary">Step {appr.step} Approval</p>
                      <p className="text-xs text-text-muted">by {appr.users?.email} ({appr.users?.role})</p>
                      <p className="text-xs text-text-muted mt-1">{new Date(appr.created_at).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-[10px] text-text-muted bg-white border border-border-default px-2 py-1 rounded block mb-1">
                        SHA-256: {appr.file_hash.substring(0, 16)}...
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
