/**
 * canvas-variance — reusable non-blank-canvas assertion helper (PP3D-2).
 *
 * Closes the "verification hole" called out in the 3D-viewer upgrade plan (§3,
 * §10): the legacy e2e suite asserts only DOM/text and "passes with a blank 3D
 * canvas." This helper screenshots a live `<canvas>` and asserts the rendered
 * pixels actually vary — a uniform clear color (blank render) fails, a real
 * scene passes.
 *
 * Design notes:
 *   - We use Playwright's `locator.screenshot()` rather than `gl.readPixels`,
 *     because a `frameloop="demand"` canvas without `preserveDrawingBuffer`
 *     returns a blank buffer to readPixels even on a good render. Screenshotting
 *     the composited element avoids that entirely.
 *   - The variance computation ({@link pixelVariance}) is pure and decoded from
 *     raw RGBA bytes, so it is unit-testable in isolation (proving it fails on a
 *     uniform buffer and passes on a noisy one) without a browser.
 */

import type { Locator } from '@playwright/test';
// `sharp` ships transitively (Playwright's image tooling); decode PNG → RGBA.
// Falling back to a tiny inline PNG decoder is avoided — sharp is already present.
import sharp from 'sharp';

/** Default minimum mean per-channel variance for a canvas to count as rendered. */
export const DEFAULT_VARIANCE_THRESHOLD = 25;

/**
 * Compute the mean per-channel variance of an RGBA pixel buffer.
 *
 * Returns the average of the R, G, B channel variances (alpha ignored). A
 * perfectly uniform image returns 0; any spatial color change raises it. Pure
 * and synchronous — the unit-test target that proves the gate's discrimination.
 *
 * @param rgba   Flat RGBA byte array (length must be a multiple of 4).
 * @param stride Bytes per pixel (4 for RGBA). Exposed for testability.
 */
export function pixelVariance(rgba: Uint8Array | Uint8ClampedArray | number[], stride = 4): number {
  const pixelCount = Math.floor(rgba.length / stride);
  if (pixelCount === 0) {
    return 0;
  }

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (let i = 0; i < pixelCount; i += 1) {
    const o = i * stride;
    sumR += rgba[o];
    sumG += rgba[o + 1];
    sumB += rgba[o + 2];
  }
  const meanR = sumR / pixelCount;
  const meanG = sumG / pixelCount;
  const meanB = sumB / pixelCount;

  let varR = 0;
  let varG = 0;
  let varB = 0;
  for (let i = 0; i < pixelCount; i += 1) {
    const o = i * stride;
    const dR = rgba[o] - meanR;
    const dG = rgba[o + 1] - meanG;
    const dB = rgba[o + 2] - meanB;
    varR += dR * dR;
    varG += dG * dG;
    varB += dB * dB;
  }

  return (varR / pixelCount + varG / pixelCount + varB / pixelCount) / 3;
}

/**
 * Screenshot a canvas locator and return the mean per-channel pixel variance of
 * the rendered image.
 */
export async function canvasPixelVariance(canvas: Locator): Promise<number> {
  const png = await canvas.screenshot();
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // sharp emits tightly-packed channels; channels is 4 after ensureAlpha().
  return pixelVariance(data, info.channels);
}

export interface NonBlankCanvasResult {
  variance: number;
  threshold: number;
  rendered: boolean;
}

/**
 * Measure a canvas and decide whether it is non-blank.
 *
 * Does not assert — returns a structured result so the caller (an e2e spec) can
 * attach a clear expectation/message. Use with the exported threshold default.
 */
export async function measureNonBlankCanvas(
  canvas: Locator,
  threshold: number = DEFAULT_VARIANCE_THRESHOLD,
): Promise<NonBlankCanvasResult> {
  const variance = await canvasPixelVariance(canvas);
  return { variance, threshold, rendered: variance > threshold };
}
