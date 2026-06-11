import type { RGBA } from './scene.js';

/**
 * Entity-index ↔ RGB encoding for the GPU pick buffer. Each scene node
 * draws into an offscreen RGBA8 pass with its index baked into the
 * color; `readPixels` at the cursor decodes the topmost node in O(1)
 * regardless of scene density (ADR-0016). 24 bits — 16.7M nodes.
 *
 * Index 0 of the *color space* is reserved for "nothing here" (the
 * clear color), so node index i encodes as i+1.
 */

export const MAX_PICK_INDEX = 0xffffff - 1;

/** Node index → normalized RGBA for a flat-color uniform (alpha 1). */
export function pickColor(index: number): RGBA {
  if (!Number.isInteger(index) || index < 0 || index > MAX_PICK_INDEX) {
    throw new Error(`pick index out of range: ${String(index)}`);
  }
  const v = index + 1;
  return [((v >> 16) & 0xff) / 255, ((v >> 8) & 0xff) / 255, (v & 0xff) / 255, 1];
}

/** Read-back bytes → node index; null for the cleared background. */
export function pickIndexFromPixel(r: number, g: number, b: number): number | null {
  const v = ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
  return v === 0 ? null : v - 1;
}
