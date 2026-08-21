import { getOwnSignaturePreviewUrl, enrollSignature } from '@lib/data/signatures';
import { createClient } from '@lib/supabase/server';
import { SignaturePad } from '@/components/SignaturePad';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function ApproverSignaturePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const signatureStatus = await getOwnSignaturePreviewUrl();

  async function handleSave(formData: FormData) {
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
    <div className="min-h-screen p-6 md:p-10 bg-surface-muted">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/approver"
              className="p-2 rounded-lg border border-border-default bg-surface-bg text-text-muted hover:text-text-primary hover:bg-slate-50 transition-colors"
              title="Back to Review Queue"
            >
              ←
            </Link>
            <div>
              <h1 className="text-xl font-bold text-text-primary">Signature Management</h1>
              <p className="text-xs text-text-muted">Enroll or update your digital signature stamp</p>
            </div>
          </div>

          <Link
            href="/approver"
            className="text-xs font-semibold text-brand-primary hover:underline"
          >
            Go to Review Queue →
          </Link>
        </div>

        <SignaturePad
          currentSignatureUrl={signatureStatus.previewUrl}
          lastUpdatedAt={signatureStatus.updatedAt}
          onSaveSignature={handleSave}
        />
      </div>
    </div>
  );
}
