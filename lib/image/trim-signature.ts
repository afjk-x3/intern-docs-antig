import 'server-only';
import sharp from 'sharp';

/**
 * Crops away the surrounding whitespace/transparent margin so an image's bounding box
 * tightly hugs its actual drawn content. Shared by lib/data/signatures.ts (trims once at
 * enrollment, so the stored bytes are already tight) and lib/pdf/composite.ts (trims
 * again at compositing time as a fallback for signatures enrolled before this existed,
 * without requiring anyone to re-enroll).
 *
 * Needed because the signature canvas (SignaturePad.tsx) exports its *entire* drawing
 * box as the PNG -- wherever within that box the user actually signed, not just the
 * stroke bounds. That margin is invisible on its own preview, but becomes a visible gap
 * once composited above the printed name, which is positioned relative to the image's
 * bounding box, not its visible content.
 *
 * `sharp().trim()` crops edges matching the top-left pixel's color/alpha within a
 * threshold -- works for a transparent canvas background and a white/light photo
 * background alike. A small margin is added back after trimming so the result doesn't
 * look pixel-tight. Fails open: an image sharp can't usefully trim (e.g. ink touching
 * every edge already, or a fully blank canvas) is returned unchanged rather than
 * throwing, since this is a cosmetic step, never one that should block enrollment or
 * approval.
 */
export async function trimSignatureWhitespace(pngBuffer: Buffer): Promise<Buffer> {
  try {
    const trimmed = await sharp(pngBuffer)
      .trim({ threshold: 10 })
      .extend({ top: 2, bottom: 2, left: 2, right: 2, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const { width, height } = await sharp(trimmed).metadata();
    if (!width || !height || width < 4 || height < 4) return pngBuffer;
    return trimmed;
  } catch {
    return pngBuffer;
  }
}
