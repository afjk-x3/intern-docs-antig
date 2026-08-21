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
    <div className="min-h-screen p-6 md:p-10 bg-surface-muted">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-primary flex items-center justify-center text-white font-bold">
              ID
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-primary">InternDocs</h1>
              <p className="text-xs text-text-muted">Makerspace Document Submission & Tracking</p>
            </div>
          </div>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-xs text-text-muted hover:text-text-primary font-medium px-3 py-1.5 rounded-lg border border-border-default bg-surface-bg hover:bg-slate-50 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>

        <InternChecklist
          items={items}
          internEmail={user.email}
          onUploadAction={handleUpload}
          onResubmitAction={handleResubmit}
          onGetDownloadUrlAction={handleGetDownloadUrl}
        />
      </div>
    </div>
  );
}
