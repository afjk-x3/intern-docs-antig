import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { compositeSignedPdf } from '../lib/pdf/composite';
import crypto from 'crypto';

describe('Server-Side PDF Compositing Engine (FR-11, Appendix B)', () => {
  async function createSamplePdf(): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    page.drawText('Makerspace Internship Evaluation Form', { x: 50, y: 750, size: 16 });
    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  function createSamplePng(): Buffer {
    // 1x1 transparent PNG pixel base64
    const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    return Buffer.from(base64Png, 'base64');
  }

  it('composites signature PNG, printed name, and date onto PDF without modifying original buffer', async () => {
    const originalPdf = await createSamplePdf();
    const originalHash = crypto.createHash('sha256').update(originalPdf).digest('hex');
    const signaturePng = createSamplePng();

    const result = await compositeSignedPdf({
      originalFileBuffer: originalPdf,
      originalMimeType: 'application/pdf',
      signaturePngBuffer: signaturePng,
      approverName: 'Carl Supervisor (approver@makerspace.ph)',
      approvalDate: new Date('2026-08-21T10:00:00Z'),
      config: { x: 380, y: 80, width: 140, height: 50 },
    });

    // Check signed PDF validity
    expect(result.signedPdfBuffer).toBeDefined();
    expect(result.signedPdfBuffer.toString('ascii', 0, 5)).toBe('%PDF-');

    // Check SHA-256 calculation
    const calculatedHash = crypto.createHash('sha256').update(result.signedPdfBuffer).digest('hex');
    expect(result.fileHash).toBe(calculatedHash);
    expect(result.fileHash).not.toBe(originalHash);

    // Verify original buffer was not mutated
    const postOriginalHash = crypto.createHash('sha256').update(originalPdf).digest('hex');
    expect(postOriginalHash).toBe(originalHash);
  });

  it('wraps image submission (PNG) into a PDF and stamps signature', async () => {
    const originalImage = createSamplePng();
    const signaturePng = createSamplePng();

    const result = await compositeSignedPdf({
      originalFileBuffer: originalImage,
      originalMimeType: 'image/png',
      signaturePngBuffer: signaturePng,
      approverName: 'Admin Approver',
      approvalDate: new Date(),
    });

    expect(result.signedPdfBuffer.toString('ascii', 0, 5)).toBe('%PDF-');
    expect(result.fileHash).toHaveLength(64);
  });
});
