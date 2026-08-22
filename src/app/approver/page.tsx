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
    <div className="p-6 md:p-10 space-y-6">
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
  );
}
