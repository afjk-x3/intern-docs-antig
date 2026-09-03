import 'server-only';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import crypto from 'crypto';
import { trimSignatureWhitespace } from '../image/trim-signature';

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
    // Fallback trim for signatures enrolled before lib/data/signatures.ts started
    // trimming at enrollment time -- see trim-signature.ts's own comment. PNG only,
    // same reasoning as enrollment: JPEG has no alpha channel to trim by.
    const signatureBytes = sig.signatureMimeType === 'image/jpeg'
      ? sig.signaturePngBuffer
      : await trimSignatureWhitespace(sig.signaturePngBuffer);
    const signatureImage = sig.signatureMimeType === 'image/jpeg'
      ? await pdfDoc.embedJpg(signatureBytes)
      : await pdfDoc.embedPng(signatureBytes);
    const sigWidth = config.width || (totalSigs > 1 ? 75 : 90);
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
    const dateLine = `Date: ${dateStr}`;

    // Centers each line under the (already full-width) signature image, on a shared
    // vertical axis through the middle of the sigX..sigX+sigWidth column, rather than
    // left-aligning text of varying width against the image's left edge.
    const centeredX = (text: string, lineFont: typeof font, size: number) =>
      sigX + (sigWidth - lineFont.widthOfTextAtSize(text, size)) / 2;

    // Draw attestation metadata below the signature -- printed name directly under the
    // signature image, close enough to read as a signature given *on* a line just above
    // its own printed name, then the role title and date beneath that.
    targetPage.drawText(sig.approverName, {
      x: centeredX(sig.approverName, boldFont, fontSize),
      y: Math.max(10, sigY - 3),
      size: fontSize,
      font: boldFont,
      color: rgb(0.1, 0.2, 0.3),
    });

    targetPage.drawText(title, {
      x: centeredX(title, font, fontSize - 1),
      y: Math.max(10, sigY - 12),
      size: fontSize - 1,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });

    targetPage.drawText(dateLine, {
      x: centeredX(dateLine, font, fontSize - 1),
      y: Math.max(10, sigY - 21),
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
