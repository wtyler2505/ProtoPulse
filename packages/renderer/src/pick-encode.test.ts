import { describe, expect, it } from 'vitest';

import { MAX_PICK_INDEX, pickColor, pickIndexFromPixel } from './pick-encode.js';

describe('pick-encode', () => {
  it('round-trips indices through an 8-bit framebuffer exactly', () => {
    const samples = [0, 1, 254, 255, 256, 65535, 65536, 123456, MAX_PICK_INDEX];
    for (const index of samples) {
      const [r, g, b, a] = pickColor(index);
      expect(a).toBe(1);
      // What the GPU stores and readPixels returns: round(channel*255).
      expect(pickIndexFromPixel(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255))).toBe(
        index,
      );
    }
  });

  it('every channel is an exact k/255 — no quantization drift', () => {
    for (const index of [0, 7, 300, 70000]) {
      for (const c of pickColor(index).slice(0, 3)) {
        expect(Number.isInteger(c * 255)).toBe(true);
      }
    }
  });

  it('the cleared background decodes to null, not node 0', () => {
    expect(pickIndexFromPixel(0, 0, 0)).toBeNull();
    expect(pickColor(0)).toEqual([0, 0, 1 / 255, 1]);
  });

  it('rejects out-of-range indices', () => {
    expect(() => pickColor(-1)).toThrow('out of range');
    expect(() => pickColor(MAX_PICK_INDEX + 1)).toThrow('out of range');
    expect(() => pickColor(1.5)).toThrow('out of range');
  });
});
