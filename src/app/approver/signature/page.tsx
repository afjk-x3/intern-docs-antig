import { getOwnSignaturePreviewUrl, enrollSignature } from '@lib/data/signatures';
import { getOwnFullName, setFullName } from '@lib/data/users';
import { createClient } from '@lib/supabase/server';
import { SignaturePad } from '@/components/SignaturePad';
import { PrintedNameForm } from '@/components/PrintedNameForm';
import { redirect } from 'next/navigation';

export default async function ApproverSignaturePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [signatureStatus, currentFullName] = await Promise.all([
    getOwnSignaturePreviewUrl(),
    getOwnFullName(),
  ]);

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
    <div className="p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Signature Management</h1>
              <p className="text-xs text-text-muted">Enroll or update your digital signature stamp</p>
            </div>
          </div>
        </div>

        <PrintedNameForm
          currentName={currentFullName}
          onSaveNameAction={handleSaveName}
        />

        <SignaturePad
          currentSignatureUrl={signatureStatus.previewUrl}
          lastUpdatedAt={signatureStatus.updatedAt}
          onSaveSignature={handleSave}
        />
      </div>
    </div>
  );
}
