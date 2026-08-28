import 'server-only';
import sharp from 'sharp';
import { createClient } from '../supabase/server';
import { createAdminClient } from '../supabase/admin';
import { detectMagicBytes } from './file-validation';
import { headers } from 'next/headers';

const MAX_SIGNATURE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

// WebP: RIFF????WEBP container (bytes 0-3 "RIFF", bytes 8-11 "WEBP").
export function isWebP(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  );
}

// SVG has no fixed magic bytes (it's XML text). This is a fast-path selector only --
// the real gatekeeper is the sharp/librsvg rasterization below, which throws on anything
// that isn't valid, well-formed SVG. librsvg never executes <script> or fetches remote
// resources, so a disguised or malicious "SVG" either fails to parse (rejected) or
// rasterizes to an inert bitmap -- there is no path from an uploaded SVG to code execution.
export function isLikelySvg(buffer: Buffer): boolean {
  let text = buffer.subarray(0, 2048).toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip UTF-8 BOM if present
  const head = text.trimStart();
  return /^(<\?xml[^>]*\?>\s*)?(<!doctype\s+svg[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head);
}

export const MAX_SIGNATURE_RASTER_DIMENSION = 800; // px -- far larger than the ~140px stamp size in lib/pdf/composite.ts

/**
 * Rasterizes a WebP or SVG signature into a PNG buffer. Dimensions are clamped so a tiny
 * SVG that declares an enormous width/height (a "decompression bomb") can't blow up memory
 * or produce an oversized composited PDF.
 */
export async function rasterizeToPng(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer, { limitInputPixels: 20_000_000 })
      .resize(MAX_SIGNATURE_RASTER_DIMENSION, MAX_SIGNATURE_RASTER_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
  } catch {
    throw new Error('Invalid format: Signature must be a valid PNG, JPEG, WebP, or SVG image.');
  }
}

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
    // Canvas-drawn signatures always come through as PNG data URLs.
    const base64Data = base64Input.replace(/^data:image\/\w+;base64,/, '');
    fileBuffer = Buffer.from(base64Data, 'base64');
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Please draw or select a signature image.');
  }

  if (fileBuffer.length > MAX_SIGNATURE_SIZE_BYTES) {
    throw new Error(`Signature image size (${(fileBuffer.length / 1024).toFixed(1)} KB) exceeds the 2 MB limit.`);
  }

  let detectedMime = detectMagicBytes(fileBuffer);

  if (detectedMime !== 'image/png' && detectedMime !== 'image/jpeg') {
    // Not a directly-embeddable format -- try WebP or SVG, both of which get normalized to
    // a PNG here so storage, the bucket's mime allowlist, and lib/pdf/composite.ts never
    // need to know about them.
    if (isWebP(fileBuffer) || isLikelySvg(fileBuffer)) {
      fileBuffer = await rasterizeToPng(fileBuffer);
      if (fileBuffer.length > MAX_SIGNATURE_SIZE_BYTES) {
        throw new Error('Signature image exceeds the 2 MB limit after conversion.');
      }
      detectedMime = 'image/png';
    } else {
      throw new Error('Invalid format: Signature must be a PNG, JPEG, WebP, or SVG image.');
    }
  }

  const ext = detectedMime === 'image/jpeg' ? 'jpg' : 'png';
  const storagePath = `${user.id}/signature.${ext}`;
  const adminClient = createAdminClient();
  const isReplacement = !!dbUser.signature_path;

  // Upload to private signatures bucket using authenticated client (with admin fallback)
  let uploadErr = null;
  const { error: userUploadErr } = await supabase.storage
    .from('signatures')
    .upload(storagePath, fileBuffer, {
      contentType: detectedMime,
      upsert: true,
    });

  if (userUploadErr) {
    const { error: adminUploadErr } = await adminClient.storage
      .from('signatures')
      .upload(storagePath, fileBuffer, {
        contentType: detectedMime,
        upsert: true,
      });
    uploadErr = adminUploadErr;
  }

  if (uploadErr) {
    console.error('[enrollSignature] Storage upload failed:', uploadErr.message);
    throw new Error('We could not save your signature right now. Please try again in a moment.');
  }

  // Clean up a previously enrolled signature under a different extension (e.g. switching PNG -> JPG)
  // so an orphaned file isn't left behind in the bucket.
  if (dbUser.signature_path && dbUser.signature_path !== storagePath) {
    await adminClient.storage.from('signatures').remove([dbUser.signature_path]);
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

export interface SignatureBytesForCompositing {
  buffer: Buffer;
  mimeType: 'image/png' | 'image/jpeg';
}

/**
 * Server-only helper: Fetches raw signature image bytes (PNG or JPEG) for PDF compositing.
 */
export async function getSignatureBytesForCompositing(userId: string): Promise<SignatureBytesForCompositing> {
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
  const ext = user.signature_path.split('.').pop()?.toLowerCase();
  const mimeType: 'image/png' | 'image/jpeg' = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';

  return { buffer: Buffer.from(arrayBuffer), mimeType };
}
