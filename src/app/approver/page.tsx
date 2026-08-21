import {
  getApproverQueue,
  approveSubmissionSigned,
  returnSubmission,
  reassignApprover,
  getSubmissionSignedDownloadUrl,
} from '@lib/data/submissions';
import { hasEnrolledSignature, getOwnSignaturePreviewUrl } from '@lib/data/signatures';
import { getApproversList } from '@lib/data/routing';
import { createClient } from '@lib/supabase/server';
import { ApproverQueue } from '@/components/ApproverQueue';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function ApproverDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [items, hasSignature, signaturePreview, approversList] = await Promise.all([
    getApproverQueue(),
    hasEnrolledSignature(user.id),
    getOwnSignaturePreviewUrl(),
    getApproversList(),
  ]);

  async function handleApprove(submissionId: string) {
    'use server';
    try {
      const res = await approveSubmissionSigned(submissionId);
      return { success: true, final: res.final, signedUrl: res.signedUrl };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Approval failed';
      return { error: msg };
    }
  }

  async function handleReturn(submissionId: string, comment: string) {
    'use server';
    try {
      await returnSubmission(submissionId, comment);
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Return failed';
      return { error: msg };
    }
  }

  async function handleReassign(submissionId: string, newApproverId: string, reason: string) {
    'use server';
    try {
      await reassignApprover(submissionId, newApproverId, reason);
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Reassignment failed';
      return { error: msg };
    }
  }

  async function handleGetDownloadUrl(submissionId: string) {
    'use server';
    try {
      const res = await getSubmissionSignedDownloadUrl(submissionId);
      return { signedUrl: res.signedUrl, isVerified: res.isVerified, fileHash: res.fileHash };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch download link';
      return { error: msg };
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-10 bg-surface-muted">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-primary flex items-center justify-center text-white font-bold">
              ID
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-primary">InternDocs — Approver Console</h1>
              <p className="text-xs text-text-muted">Review, verify, and sign intern submissions</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/approver/signature"
              className="text-xs text-text-primary font-semibold px-3 py-1.5 rounded-lg border border-border-default bg-surface-bg hover:bg-slate-50 transition-colors flex items-center gap-1.5"
            >
              <svg className="h-4 w-4 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              {hasSignature ? 'Manage Signature' : 'Enroll Signature'}
            </Link>

            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-xs text-text-muted hover:text-text-primary font-medium px-3 py-1.5 rounded-lg border border-border-default bg-surface-bg hover:bg-slate-50 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        {/* Missing Signature Alert Banner */}
        {!hasSignature && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5">
              <span className="text-amber-600 text-lg">⚠️</span>
              <div>
                <h4 className="text-xs font-bold text-amber-900">Signature Required for Approvals</h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  You have not enrolled your digital signature stamp yet. You must enroll a signature before you can approve submissions.
                </p>
              </div>
            </div>
            <Link
              href="/approver/signature"
              className="shrink-0 px-3.5 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary-hover transition-colors"
            >
              Enroll Signature Now →
            </Link>
          </div>
        )}

        <ApproverQueue
          items={items}
          approverEmail={user.email}
          hasSignature={hasSignature}
          signaturePreviewUrl={signaturePreview.previewUrl}
          approversList={approversList}
          onApproveAction={handleApprove}
          onReturnAction={handleReturn}
          onReassignAction={handleReassign}
          onGetDownloadUrlAction={handleGetDownloadUrl}
        />
      </div>
    </div>
  );
}
