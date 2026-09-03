import {
  getApproverQueue,
  approveSubmissionSigned,
  returnSubmission,
  reassignApprover,
  getSubmissionSignedDownloadUrl,
} from '@lib/data/submissions';
import { hasEnrolledSignature, getOwnSignaturePreviewUrl, enrollSignature } from '@lib/data/signatures';
import { getApproversList } from '@lib/data/routing';
import { getOwnFullName, setFullName } from '@lib/data/users';
import { createClient } from '@lib/supabase/server';
import { AdminApprovalQueueView } from '@/components/AdminApprovalQueueView';
import { AdminSignatureOverlay } from '@/components/AdminSignatureOverlay';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

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

  // Admins are also an approver step (final sign-off), so they need a printed name too
  // (FR-11) -- but only a plain 'admin', not system_admin, which doesn't act as a
  // routing-template approver.
  const isPlainAdmin = dbUser.role === 'admin';

  const [allItems, hasSignature, signaturePreview, approversList, currentFullName] = await Promise.all([
    getApproverQueue(),
    hasEnrolledSignature(user.id),
    getOwnSignaturePreviewUrl(),
    getApproversList(),
    isPlainAdmin ? getOwnFullName() : Promise.resolve(null),
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

  async function handleSaveName(fullName: string) {
    'use server';
    try {
      await setFullName(fullName);
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save printed name';
      return { error: msg };
    }
  }

  return (
    <div className="p-6 md:p-10 space-y-8">
      {/* Page Header with Top-Right Signature Overlay Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Approval Queue</h1>
          <p className="text-sm text-text-muted mt-1">
            Review and sign Step 2 final approvals, or approve Step 1 submissions on behalf of unavailable supervisors.
          </p>
        </div>

        {/* Top-Right Signature Button */}
        <div className="shrink-0">
          <AdminSignatureOverlay
            hasSignature={hasSignature}
            signaturePreviewUrl={signaturePreview.previewUrl}
            lastUpdatedAt={signaturePreview.updatedAt}
            onSaveSignatureAction={handleSaveSignature}
            {...(isPlainAdmin ? { currentFullName, onSaveNameAction: handleSaveName } : {})}
          />
        </div>
      </div>

      {/* Tabbed Approval Queue View */}
      <AdminApprovalQueueView
        allItems={allItems}
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
