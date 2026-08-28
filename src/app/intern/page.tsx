import { getInternChecklist, uploadSubmission, resubmitSubmission, getSubmissionSignedDownloadUrl } from '@lib/data/submissions';
import { getRequirementTemplateDownloadUrl } from '@lib/data/requirements';
import { createClient } from '@lib/supabase/server';
import { InternChecklist } from '@/components/InternChecklist';
import { AutoRefresh } from '@/components/AutoRefresh';
import { redirect } from 'next/navigation';

export default async function InternDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const items = await getInternChecklist();

  async function handleUpload(formData: FormData) {
    'use server';
    try {
      await uploadSubmission(formData);
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      return { error: msg };
    }
  }

  async function handleResubmit(formData: FormData) {
    'use server';
    try {
      await resubmitSubmission(formData);
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Re-upload failed';
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

  async function handleGetTemplateUrl(requirementId: string) {
    'use server';
    try {
      const res = await getRequirementTemplateDownloadUrl(requirementId);
      return { signedUrl: res.signedUrl };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch template download link';
      return { error: msg };
    }
  }

  return (
    <>
      {/* Background auto-refresh so interns see status updates automatically -- re-runs this
          page's Server Components every 60s via router.refresh(), no client-side querying.
          Longer interval than the approver/admin views since this page is lower urgency. */}
      <AutoRefresh intervalMs={60_000} />
      <InternChecklist
        items={items}
        internEmail={user.email}
        onUploadAction={handleUpload}
        onResubmitAction={handleResubmit}
        onGetDownloadUrlAction={handleGetDownloadUrl}
        onGetTemplateUrlAction={handleGetTemplateUrl}
      />
    </>
  );
}
