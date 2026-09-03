import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { trimSignatureWhitespace } from '../lib/image/trim-signature';

describe('trimSignatureWhitespace', () => {
  it('shrinks a mostly-blank canvas export down to the drawn ink', async () => {
    // Mimics SignaturePad's real export: a 400x176 transparent canvas with a small
    // squiggle drawn only in the upper-middle portion -- most of the box is empty. This
    // whitespace is invisible on the signature's own preview but becomes a visible gap
    // once composited above the printed name (lib/pdf/composite.ts).
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="176">
      <path d="M100,40 Q140,10 180,35 T260,25" stroke="#0F172A" stroke-width="3" fill="none" stroke-linecap="round"/>
    </svg>`;
    const wideBlankCanvas = await sharp(Buffer.from(svg)).png().toBuffer();
    const before = await sharp(wideBlankCanvas).metadata();

    const trimmed = await trimSignatureWhitespace(wideBlankCanvas);
    const after = await sharp(trimmed).metadata();

    expect(after.width!).toBeLessThan(before.width!);
    expect(after.height!).toBeLessThan(before.height!);
    // The squiggle only occupies roughly the top ~55px of a 176px-tall canvas.
    expect(after.height!).toBeLessThan(90);
  });

  it('does not throw or degenerate on a fully blank image (nothing to trim against)', async () => {
    // The UI never lets a blank signature reach enrollment (SignaturePad.tsx checks
    // hasDrawn/uploadFile first) -- this just proves the fallback path is safe if one
    // ever did. sharp's trim() finds no edge that differs from the uniform background,
    // so dimensions are left as-is (then padded slightly by the margin step); the only
    // real requirement is that this stays a valid, sane-sized image, not a crash or a
    // 0x0 result.
    const blank = await sharp({
      create: { width: 100, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer();

    const result = await trimSignatureWhitespace(blank);
    const meta = await sharp(result).metadata();
    expect(meta.width).toBeGreaterThanOrEqual(4);
    expect(meta.height).toBeGreaterThanOrEqual(4);
  });

  it('fails open (returns the original buffer) on invalid input instead of throwing', async () => {
    const notAnImage = Buffer.from('not a real png');
    const result = await trimSignatureWhitespace(notAnImage);
    expect(result).toEqual(notAnImage);
  });
});
