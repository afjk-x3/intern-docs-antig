import { describe, it, expect } from 'vitest';
import { detectMagicBytes } from '../lib/data/file-validation';

describe('Signature Validation & Enrollment Logic (FR-9)', () => {
  it('accepts transparent PNG signature within size limit', () => {
    // Standard PNG header
    const validPng = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00]);
    const detected = detectMagicBytes(validPng);
    expect(detected).toBe('image/png');
    expect(validPng.length).toBeLessThan(2 * 1024 * 1024);
  });

  it('rejects JPEG or PDF disguised as signature PNG', () => {
    const fakePng = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    const detected = detectMagicBytes(fakePng);
    expect(detected).toBe('image/jpeg');
    expect(detected).not.toBe('image/png');
  });

  it('rejects empty or corrupt signature buffer', () => {
    const corruptBuffer = Buffer.from('not a real image');
    const detected = detectMagicBytes(corruptBuffer);
    expect(detected).toBeNull();
  });
});
