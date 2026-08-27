import {
  getApproverQueue,
  approveSubmissionSigned,
  returnSubmission,
  getSubmissionSignedDownloadUrl,
} from '@lib/data/submissions';
import { hasEnrolledSignature, getOwnSignaturePreviewUrl, enrollSignature } from '@lib/data/signatures';
import { createClient } from '@lib/supabase/server';
import { ApproverQueue } from '@/components/ApproverQueue';
import { AdminSignatureOverlay } from '@/components/AdminSignatureOverlay';
import { redirect } from 'next/navigation';

export default async function AdminFinalApprovalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: dbUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!dbUser || !['admin', 'system_admin'].includes(dbUser.role)) {
    redirect('/login');
  }

  const [allItems, hasSignature, signaturePreview] = await Promise.all([
    getApproverQueue(),
    hasEnrolledSignature(user.id),
    getOwnSignaturePreviewUrl(),
  ]);

  // Filter to only show items at Step 2 (Admin Final Approval) in a 2-way routing template
  const step2Items = allItems.filter(
    (item: { totalSteps?: number; currentStep?: number; stepRole?: string }) =>
      item.totalSteps && item.totalSteps >= 2 && item.currentStep === 2 && item.stepRole === 'admin'
  );

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

  async function handleReassign() {
    'use server';
    return { error: 'Reassignment is not available for final admin approval step.' };
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

  async function handleSaveSignature(formData: FormData) {
    'use server';
    try {
      await enrollSignature(formData);
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save signature';
      return { error: msg };
    }
  }

  return (
    <div className="p-6 md:p-10 space-y-8">
      {/* Page Header with Top-Right Signature Overlay Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Final Approval Queue</h1>
          <p className="text-sm text-text-muted mt-1">
            Documents awaiting your final sign-off (Step 2 of 2-way approval). These have already been reviewed and approved by a supervisor.
          </p>
        </div>

        {/* Top-Right Signature Button */}
        <div className="shrink-0">
          <AdminSignatureOverlay
            hasSignature={hasSignature}
            signaturePreviewUrl={signaturePreview.previewUrl}
            lastUpdatedAt={signaturePreview.updatedAt}
            onSaveSignatureAction={handleSaveSignature}
          />
        </div>
      </div>

      {/* Approval Queue Table */}
      {step2Items.length === 0 ? (
        <div className="bg-surface-bg border border-border-default rounded-xl p-10 text-center">
          <svg className="mx-auto h-12 w-12 text-status-approved mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-sm font-bold text-text-primary">No pending final approvals</h3>
          <p className="text-xs text-text-muted mt-1">
            All 2-way approval documents have been processed or are still at Supervisor review (Step 1).
          </p>
        </div>
      ) : (
        <ApproverQueue
          items={step2Items}
          approverEmail={user.email}
          hasSignature={hasSignature}
          signaturePreviewUrl={signaturePreview.previewUrl}
          approversList={[]}
          hideHeader
          onApproveAction={handleApprove}
          onReturnAction={handleReturn}
          onReassignAction={handleReassign}
          onGetDownloadUrlAction={handleGetDownloadUrl}
        />
      )}
    </div>
  );
}
