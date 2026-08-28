import { describe, it, expect } from 'vitest';
import { isWebP, isLikelySvg, rasterizeToPng, MAX_SIGNATURE_RASTER_DIMENSION } from '../lib/data/signatures';
import { detectMagicBytes } from '../lib/data/file-validation';
import sharp from 'sharp';

const SIMPLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50" fill="black"/></svg>';

// Larger than the stamp needs, but still decodable (12M px, under sharp's 20M limitInputPixels)
// -- exercises the resize-clamp path.
const LARGE_BUT_DECODABLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="3000"><rect width="4000" height="3000" fill="black"/></svg>';

// Declares a genuinely enormous intrinsic size (2.5B px) -- the kind of tiny-file, huge-output
// "SVG bomb" that sharp's limitInputPixels is meant to refuse outright rather than decode.
const BOMB_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="50000" height="50000"><rect width="50000" height="50000" fill="black"/></svg>';

async function makeWebPBuffer(): Promise<Buffer> {
  return sharp({ create: { width: 20, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
    .webp()
    .toBuffer();
}

describe('Signature format expansion: WebP/SVG detection (isWebP, isLikelySvg)', () => {
  it('detects a genuine WebP RIFF/WEBP container', async () => {
    const webp = await makeWebPBuffer();
    expect(isWebP(webp)).toBe(true);
  });

  it('does not misidentify a PNG as WebP', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00]);
    expect(isWebP(png)).toBe(false);
  });

  it('recognizes a plain SVG document', () => {
    expect(isLikelySvg(Buffer.from(SIMPLE_SVG, 'utf8'))).toBe(true);
  });

  it('recognizes an SVG with an XML declaration, doctype, comment, and BOM', () => {
    const withPreamble =
      '﻿<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<!-- a comment -->\n' +
      SIMPLE_SVG;
    expect(isLikelySvg(Buffer.from(withPreamble, 'utf8'))).toBe(true);
  });

  it('does not misidentify arbitrary text or PNG bytes as SVG', () => {
    expect(isLikelySvg(Buffer.from('not an image at all', 'utf8'))).toBe(false);
    expect(isLikelySvg(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(false);
  });
});

describe('Signature format expansion: rasterizeToPng', () => {
  it('rasterizes a valid SVG into a real PNG', async () => {
    const png = await rasterizeToPng(Buffer.from(SIMPLE_SVG, 'utf8'));
    expect(detectMagicBytes(png)).toBe('image/png');
  });

  it('rasterizes a valid WebP into a real PNG', async () => {
    const webp = await makeWebPBuffer();
    const png = await rasterizeToPng(webp);
    expect(detectMagicBytes(png)).toBe('image/png');
  });

  it('clamps a large-but-decodable SVG down to the max stamp dimension', async () => {
    const png = await rasterizeToPng(Buffer.from(LARGE_BUT_DECODABLE_SVG, 'utf8'));
    const metadata = await sharp(png).metadata();
    expect(metadata.width).toBeLessThanOrEqual(MAX_SIGNATURE_RASTER_DIMENSION);
    expect(metadata.height).toBeLessThanOrEqual(MAX_SIGNATURE_RASTER_DIMENSION);
  });

  it('outright rejects an SVG bomb (tiny file, ~2.5 billion declared pixels) rather than decoding it', async () => {
    await expect(rasterizeToPng(Buffer.from(BOMB_SVG, 'utf8')))
      .rejects.toThrow('Invalid format: Signature must be a valid PNG, JPEG, WebP, or SVG image.');
  });

  it('rejects a malformed/garbage buffer with a clean error, not a raw library exception', async () => {
    await expect(rasterizeToPng(Buffer.from('this is not svg, webp, or anything else', 'utf8')))
      .rejects.toThrow('Invalid format: Signature must be a valid PNG, JPEG, WebP, or SVG image.');
  });
});
