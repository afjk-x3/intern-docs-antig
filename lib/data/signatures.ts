import 'server-only';
import { createClient } from '../supabase/server';
import { createAdminClient } from '../supabase/admin';
import { detectMagicBytes } from './file-validation';
import { headers } from 'next/headers';

const MAX_SIGNATURE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export interface SignatureStatus {
  hasSignature: boolean;
  signaturePath: string | null;
  updatedAt: string | null;
  previewUrl?: string | null;
}

/**
 * Validates and enrolls an approver's signature image (Canvas draw or transparent PNG upload).
 * PRD FR-9 & 12-backend-security-rules.md §4
 */
export async function enrollSignature(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const { data: dbUser } = await supabase
    .from('users')
    .select('id, role, signature_path')
    .eq('id', user.id)
    .single();

  if (!dbUser || !['approver', 'admin', 'system_admin'].includes(dbUser.role)) {
    throw new Error('Forbidden: Only approvers and administrators can enroll signatures.');
  }

  let fileBuffer: Buffer | null = null;

  const fileInput = formData.get('file') as File | null;
  const base64Input = formData.get('signature_data') as string | null;

  if (fileInput && fileInput.size > 0) {
    const arrayBuffer = await fileInput.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
  } else if (base64Input) {
    const base64Data = base64Input.replace(/^data:image\/png;base64,/, '');
    fileBuffer = Buffer.from(base64Data, 'base64');
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Please draw or select a signature image.');
  }

  if (fileBuffer.length > MAX_SIGNATURE_SIZE_BYTES) {
    throw new Error(`Signature image size (${(fileBuffer.length / 1024).toFixed(1)} KB) exceeds the 2 MB limit.`);
  }

  const detectedMime = detectMagicBytes(fileBuffer);
  if (detectedMime !== 'image/png') {
    throw new Error('Invalid format: Signature must be a transparent PNG image.');
  }

  const storagePath = `${user.id}/signature.png`;
  const adminClient = createAdminClient();
  const isReplacement = !!dbUser.signature_path;

  // Upload to private signatures bucket using authenticated client (with admin fallback)
  let uploadErr = null;
  const { error: userUploadErr } = await supabase.storage
    .from('signatures')
    .upload(storagePath, fileBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (userUploadErr) {
    const { error: adminUploadErr } = await adminClient.storage
      .from('signatures')
      .upload(storagePath, fileBuffer, {
        contentType: 'image/png',
        upsert: true,
      });
    uploadErr = adminUploadErr;
  }

  if (uploadErr) {
    throw new Error(`Failed to store signature image: ${uploadErr.message}`);
  }

  const now = new Date().toISOString();

  // Update user record (using authenticated user client, fallback admin)
  const { error: updateErr } = await supabase
    .from('users')
    .update({
      signature_path: storagePath,
      signature_updated_at: now,
    })
    .eq('id', user.id);

  if (updateErr) {
    await adminClient
      .from('users')
      .update({
        signature_path: storagePath,
        signature_updated_at: now,
      })
      .eq('id', user.id);
  }

  // Audit log write
  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';

  await adminClient.from('audit_log').insert({
    actor_id: user.id,
    action: isReplacement ? 'SIGNATURE_REPLACED' : 'SIGNATURE_ENROLLED',
    target_id: user.id,
    target_type: 'signatures',
    source_ip: ip,
  });

  return { success: true, path: storagePath };
}

/**
 * Returns a 5-minute signed URL strictly for the authenticated user's own signature.
 * 12-backend-security-rules.md §4: No client role has read access; owner preview only via signed URL.
 */
export async function getOwnSignaturePreviewUrl(): Promise<SignatureStatus> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const { data: dbUser } = await supabase
    .from('users')
    .select('signature_path, signature_updated_at')
    .eq('id', user.id)
    .single();

  if (!dbUser?.signature_path) {
    return {
      hasSignature: false,
      signaturePath: null,
      updatedAt: null,
      previewUrl: null,
    };
  }

  const adminClient = createAdminClient();
  let signedUrl: string | null = null;

  // Try user client first
  const { data: userSigned } = await supabase.storage
    .from('signatures')
    .createSignedUrl(dbUser.signature_path, 300);

  if (userSigned?.signedUrl) {
    signedUrl = userSigned.signedUrl;
  } else {
    const { data: adminSigned } = await adminClient.storage
      .from('signatures')
      .createSignedUrl(dbUser.signature_path, 300);
    signedUrl = adminSigned?.signedUrl || null;
  }

  return {
    hasSignature: true,
    signaturePath: dbUser.signature_path,
    updatedAt: dbUser.signature_updated_at,
    previewUrl: signedUrl,
  };
}

/**
 * Checks if a specific user has an enrolled signature.
 */
export async function hasEnrolledSignature(userId: string): Promise<boolean> {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from('users')
    .select('signature_path')
    .eq('id', userId)
    .single();

  return !!data?.signature_path;
}

/**
 * Server-only helper: Fetches raw signature PNG bytes for PDF compositing.
 */
export async function getSignatureBytesForCompositing(userId: string): Promise<Buffer> {
  const adminClient = createAdminClient();
  const { data: user } = await adminClient
    .from('users')
    .select('signature_path')
    .eq('id', userId)
    .single();

  if (!user?.signature_path) {
    throw new Error('Approver does not have an enrolled signature.');
  }

  const { data, error } = await adminClient.storage
    .from('signatures')
    .download(user.signature_path);

  if (error || !data) {
    throw new Error(`Failed to download approver signature for compositing: ${error?.message}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
