import 'server-only';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import crypto from 'crypto';

export interface SignatureConfig {
  page?: 'first' | 'last' | number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface CompositeParams {
  originalFileBuffer: Buffer;
  originalMimeType: string;
  signaturePngBuffer: Buffer;
  approverName: string;
  approvalDate: Date;
  config?: SignatureConfig;
}

export interface CompositeResult {
  signedPdfBuffer: Buffer;
  fileHash: string;
}

/**
 * Composites an approver's signature PNG, printed name, and approval timestamp onto a document.
 * PRD FR-11 & Appendix B
 */
export async function compositeSignedPdf({
  originalFileBuffer,
  originalMimeType,
  signaturePngBuffer,
  approverName,
  approvalDate,
  config = {},
}: CompositeParams): Promise<CompositeResult> {
  let pdfDoc: PDFDocument;

  if (originalMimeType === 'application/pdf') {
    pdfDoc = await PDFDocument.load(originalFileBuffer);
  } else if (originalMimeType === 'image/png') {
    pdfDoc = await PDFDocument.create();
    const embeddedImg = await pdfDoc.embedPng(originalFileBuffer);
    const page = pdfDoc.addPage([embeddedImg.width, embeddedImg.height]);
    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: embeddedImg.width,
      height: embeddedImg.height,
    });
  } else if (originalMimeType === 'image/jpeg') {
    pdfDoc = await PDFDocument.create();
    const embeddedImg = await pdfDoc.embedJpg(originalFileBuffer);
    const page = pdfDoc.addPage([embeddedImg.width, embeddedImg.height]);
    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: embeddedImg.width,
      height: embeddedImg.height,
    });
  } else {
    throw new Error(`Unsupported document type for PDF compositing: ${originalMimeType}`);
  }

  const pages = pdfDoc.getPages();
  if (pages.length === 0) {
    throw new Error('Document contains no pages.');
  }

  // Determine target page
  let targetPage = pages[pages.length - 1]; // Default: last page
  if (config.page === 'first') {
    targetPage = pages[0];
  } else if (typeof config.page === 'number' && config.page > 0 && config.page <= pages.length) {
    targetPage = pages[config.page - 1];
  }

  const { width: pageWidth } = targetPage.getSize();

  // Embed signature image
  const signatureImage = await pdfDoc.embedPng(signaturePngBuffer);
  const sigWidth = config.width || 140;
  const sigHeight = config.height || (signatureImage.height * (sigWidth / signatureImage.width));

  // Coordinates (default: bottom right corner with margin)
  const x = config.x !== undefined ? config.x : Math.max(20, pageWidth - sigWidth - 50);
  const y = config.y !== undefined ? config.y : 60;

  // Draw signature image
  targetPage.drawImage(signatureImage, {
    x,
    y,
    width: sigWidth,
    height: sigHeight,
  });

  // Embed font for printed name and date
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 8;

  // Format UTC date string
  const dateStr = approvalDate.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  // Draw attestation metadata text below / alongside signature
  targetPage.drawText(`Digitally Approved by:`, {
    x,
    y: Math.max(10, y - 10),
    size: fontSize - 1,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  targetPage.drawText(approverName, {
    x,
    y: Math.max(10, y - 20),
    size: fontSize,
    font: boldFont,
    color: rgb(0.1, 0.2, 0.3),
  });

  targetPage.drawText(`Date: ${dateStr}`, {
    x,
    y: Math.max(10, y - 29),
    size: fontSize - 1,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Save the modified PDF bytes
  const signedPdfBytes = await pdfDoc.save();
  const signedPdfBuffer = Buffer.from(signedPdfBytes);

  // Compute SHA-256 hash of the signed artifact
  const fileHash = crypto.createHash('sha256').update(signedPdfBuffer).digest('hex');

  return {
    signedPdfBuffer,
    fileHash,
  };
}
