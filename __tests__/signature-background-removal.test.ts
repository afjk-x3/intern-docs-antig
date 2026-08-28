import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { removeWhiteBackground } from '../lib/data/signatures';

async function readPixel(buffer: Buffer, x: number, y: number) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const idx = (y * info.width + x) * info.channels;
  return { r: data[idx], g: data[idx + 1], b: data[idx + 2], a: data[idx + 3] };
}

// 10x10 white canvas with a 4x4 solid black square in the top-left corner --
// stands in for "dark ink on light paper".
async function makeSignatureLikeImage(): Promise<Buffer> {
  const white = { create: { width: 10, height: 10, channels: 4 as const, background: { r: 255, g: 255, b: 255, alpha: 1 } } };
  const blackSquare = await sharp({ create: { width: 4, height: 4, channels: 4 as const, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
    .png()
    .toBuffer();
  return sharp(white).composite([{ input: blackSquare, top: 0, left: 0 }]).png().toBuffer();
}

describe('Signature background removal (removeWhiteBackground)', () => {
  it('makes the white background transparent and keeps dark ink opaque', async () => {
    const input = await makeSignatureLikeImage();
    const output = await removeWhiteBackground(input);

    const inkPixel = await readPixel(output, 1, 1); // inside the black square
    const bgPixel = await readPixel(output, 8, 8); // outside the square, pure white

    expect(inkPixel.a).toBeGreaterThan(200); // ink stays opaque
    expect(bgPixel.a).toBeLessThan(20); // white background becomes transparent
  });

  it('never increases existing transparency (only makes pixels more transparent)', async () => {
    // A pixel that's already half-transparent should stay at or below that alpha,
    // even if its color is dark (which alone would push alpha toward opaque).
    const partiallyTransparentDark = await sharp({
      create: { width: 4, height: 4, channels: 4 as const, background: { r: 10, g: 10, b: 10, alpha: 0.5 } },
    }).png().toBuffer();

    const output = await removeWhiteBackground(partiallyTransparentDark);
    const pixel = await readPixel(output, 1, 1);

    expect(pixel.a).toBeLessThanOrEqual(128); // never made *more* opaque than the original ~50%
  });

  it('produces a valid PNG output', async () => {
    const input = await makeSignatureLikeImage();
    const output = await removeWhiteBackground(input);
    const metadata = await sharp(output).metadata();
    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(10);
    expect(metadata.height).toBe(10);
  });
});
