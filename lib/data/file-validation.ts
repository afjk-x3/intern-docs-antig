import 'server-only';
import crypto from 'crypto';

export type SupportedMimeType = 'application/pdf' | 'image/png' | 'image/jpeg';

export interface FileValidationResult {
  isValid: boolean;
  mimeType: SupportedMimeType;
  hash: string;
  sizeBytes: number;
}

/**
 * Inspects the magic bytes of a file buffer to determine its true MIME type.
 * PRD FR-6: Validated by magic-byte inspection, not by extension.
 */
export function detectMagicBytes(buffer: Buffer): SupportedMimeType | null {
  if (!buffer || buffer.length < 4) {
    return null;
  }

  // PDF: %PDF- (hex: 25 50 44 46 2d)
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return 'application/pdf';
  }

  // PNG: \x89PNG\r\n\x1a\n (hex: 89 50 4e 47 0d 0a 1a 0a)
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: \xff\xd8\xff (SOI + marker)
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  return null;
}

/**
 * Validates a file against allowed formats and maximum size, and generates SHA-256 hash.
 */
export function validateAndSealFile(
  buffer: Buffer,
  allowedMimeTypes: string[] = ['application/pdf', 'image/png', 'image/jpeg'],
  maxSizeMb: number = 20
): FileValidationResult {
  const maxSizeBytes = maxSizeMb * 1024 * 1024;
  if (buffer.length > maxSizeBytes) {
    throw new Error(`File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed limit of ${maxSizeMb} MB.`);
  }

  const detectedMime = detectMagicBytes(buffer);
  if (!detectedMime) {
    throw new Error('Invalid file format: The file content does not match any accepted format (PDF, PNG, JPEG). Disguised or corrupted files are rejected.');
  }

  if (!allowedMimeTypes.includes(detectedMime)) {
    throw new Error(`Unaccepted file type: ${detectedMime}. This requirement only accepts: ${allowedMimeTypes.join(', ')}.`);
  }

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  return {
    isValid: true,
    mimeType: detectedMime,
    hash,
    sizeBytes: buffer.length,
  };
}
