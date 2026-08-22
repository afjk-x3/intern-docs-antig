import { getInternChecklist, uploadSubmission, resubmitSubmission, getSubmissionSignedDownloadUrl } from '@lib/data/submissions';
import { createClient } from '@lib/supabase/server';
import { InternChecklist } from '@/components/InternChecklist';
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

  return (
    <InternChecklist
      items={items}
      internEmail={user.email}
      onUploadAction={handleUpload}
      onResubmitAction={handleResubmit}
      onGetDownloadUrlAction={handleGetDownloadUrl}
    />
  );
}
