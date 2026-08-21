import { describe, it, expect } from 'vitest';
import { detectMagicBytes, validateAndSealFile } from '../lib/data/file-validation';

describe('File Validation (Magic Bytes & SHA-256)', () => {
  it('correctly detects genuine PDF magic bytes', () => {
    // "%PDF-1.4..."
    const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const detected = detectMagicBytes(pdfBuffer);
    expect(detected).toBe('application/pdf');
  });

  it('correctly detects genuine PNG magic bytes', () => {
    // "\x89PNG\r\n\x1a\n..."
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const detected = detectMagicBytes(pngBuffer);
    expect(detected).toBe('image/png');
  });

  it('correctly detects genuine JPEG magic bytes', () => {
    // "\xFF\xD8\xFF..."
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const detected = detectMagicBytes(jpegBuffer);
    expect(detected).toBe('image/jpeg');
  });

  it('rejects disguised executable or text file disguised as PDF', () => {
    // Text file containing "Hello World"
    const textBuffer = Buffer.from('Hello World this is a text file not a PDF');
    expect(() => validateAndSealFile(textBuffer, ['application/pdf'])).toThrow(
      'Invalid file format'
    );
  });

  it('rejects file exceeding 20 MB maximum size', () => {
    // Create a mock large buffer header
    const largeBuffer = Buffer.alloc(21 * 1024 * 1024);
    // Write PDF magic bytes
    largeBuffer.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0);

    expect(() => validateAndSealFile(largeBuffer, ['application/pdf'], 20)).toThrow(
      'exceeds the maximum allowed limit of 20 MB'
    );
  });

  it('computes deterministic SHA-256 hash for valid PDF', () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 Test Document Content');
    const result = validateAndSealFile(pdfBuffer, ['application/pdf']);

    expect(result.isValid).toBe(true);
    expect(result.mimeType).toBe('application/pdf');
    expect(result.hash).toHaveLength(64); // 64 hex characters
    expect(typeof result.hash).toBe('string');
  });
});
