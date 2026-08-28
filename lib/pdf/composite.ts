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

export interface SignatoryEntry {
  stepNumber?: number;
  roleTitle?: string;
  signaturePngBuffer: Buffer;
  signatureMimeType?: 'image/png' | 'image/jpeg';
  approverName: string;
  approvalDate: Date;
}

export interface CompositeParams {
  originalFileBuffer: Buffer;
  originalMimeType: string;
  signaturePngBuffer?: Buffer;
  approverName?: string;
  approvalDate?: Date;
  signatories?: SignatoryEntry[];
  config?: SignatureConfig;
}

export interface CompositeResult {
  signedPdfBuffer: Buffer;
  fileHash: string;
}

/**
 * Composites approver signature PNG(s), printed name(s), and approval timestamp(s) onto a document.
 * PRD FR-11 & Appendix B
 */
export async function compositeSignedPdf({
  originalFileBuffer,
  originalMimeType,
  signaturePngBuffer,
  approverName,
  approvalDate,
  signatories,
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

  // Prepare list of signatories
  const allSignatories: SignatoryEntry[] =
    signatories && signatories.length > 0
      ? signatories
      : signaturePngBuffer && approverName && approvalDate
      ? [
          {
            signaturePngBuffer,
            approverName,
            approvalDate,
            roleTitle: 'Digitally Approved by:',
          },
        ]
      : [];

  if (allSignatories.length === 0) {
    throw new Error('No signature data provided for compositing.');
  }

  const totalSigs = allSignatories.length;
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 8;

  for (let i = 0; i < totalSigs; i++) {
    const sig = allSignatories[i];
    const signatureImage = sig.signatureMimeType === 'image/jpeg'
      ? await pdfDoc.embedJpg(sig.signaturePngBuffer)
      : await pdfDoc.embedPng(sig.signaturePngBuffer);
    const sigWidth = config.width || (totalSigs > 1 ? 120 : 140);
    const sigHeight = config.height || (signatureImage.height * (sigWidth / signatureImage.width));

    let sigX: number;
    let sigY: number;

    if (totalSigs === 1) {
      sigX = config.x !== undefined ? config.x : Math.max(20, pageWidth - sigWidth - 50);
      sigY = config.y !== undefined ? config.y : 60;
    } else {
      // Multi-step (2-way approval): Step 1 on the left, Step 2 on the right
      if (i === 0) {
        sigX = 50;
      } else {
        sigX = Math.max(sigWidth + 80, pageWidth - sigWidth - 50);
      }
      sigY = config.y !== undefined ? config.y : 60;
    }

    // Draw signature image
    targetPage.drawImage(signatureImage, {
      x: sigX,
      y: sigY,
      width: sigWidth,
      height: sigHeight,
    });

    const dateStr = sig.approvalDate.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    const title =
      sig.roleTitle ||
      (totalSigs > 1
        ? `Step ${sig.stepNumber || i + 1} (${i === 0 ? 'Supervisor' : 'Final Admin'}):`
        : `Digitally Approved by:`);

    // Draw attestation metadata text below signature
    targetPage.drawText(title, {
      x: sigX,
      y: Math.max(10, sigY - 10),
      size: fontSize - 1,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });

    targetPage.drawText(sig.approverName, {
      x: sigX,
      y: Math.max(10, sigY - 20),
      size: fontSize,
      font: boldFont,
      color: rgb(0.1, 0.2, 0.3),
    });

    targetPage.drawText(`Date: ${dateStr}`, {
      x: sigX,
      y: Math.max(10, sigY - 29),
      size: fontSize - 1,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

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
