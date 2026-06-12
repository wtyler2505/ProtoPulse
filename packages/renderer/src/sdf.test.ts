import { describe, expect, it } from 'vitest';

import { edt, sdfFromAlpha } from './sdf.js';

/**
 * The distance transform is exact — so the tests can assert exact
 * squared distances against brute force, not tolerances.
 */

function bruteForce(grid: Float64Array, width: number, height: number): Float64Array {
  const features: [number, number][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y * width + x] === 0) features.push([x, y]);
    }
  }
  const out = new Float64Array(width * height).fill(1e20);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (const [fx, fy] of features) {
        const d = (x - fx) * (x - fx) + (y - fy) * (y - fy);
        const i = y * width + x;
        if (d < (out[i] ?? 1e20)) out[i] = d;
      }
    }
  }
  return out;
}

function gridOf(width: number, height: number, features: [number, number][]): Float64Array {
  const g = new Float64Array(width * height).fill(1e20);
  for (const [x, y] of features) g[y * width + x] = 0;
  return g;
}

describe('edt', () => {
  it('a single feature point yields exact squared Euclidean distances', () => {
    const g = gridOf(7, 5, [[3, 2]]);
    const d = edt(g, 7, 5);
    expect(d[2 * 7 + 3]).toBe(0);
    expect(d[2 * 7 + 4]).toBe(1);
    expect(d[1 * 7 + 2]).toBe(2); // diagonal neighbor
    expect(d[0]).toBe(9 + 4); // corner (0,0) vs (3,2)
  });

  it('matches brute force on a scattered multi-feature grid', () => {
    const features: [number, number][] = [
      [0, 0],
      [11, 2],
      [5, 7],
      [3, 3],
      [9, 9],
    ];
    const g = gridOf(12, 10, features);
    expect([...edt(g, 12, 10)]).toEqual([...bruteForce(g, 12, 10)]);
  });

  it('a non-square grid transforms both axes (regression: row/col swap)', () => {
    const g = gridOf(9, 3, [[8, 0]]);
    const d = edt(g, 9, 3);
    expect(d[2 * 9 + 0]).toBe(64 + 4);
  });

  it('an all-empty grid stays unreachable everywhere', () => {
    const d = edt(new Float64Array(6).fill(1e20), 3, 2);
    for (const v of d) expect(v).toBeGreaterThan(1e15);
  });
});

describe('sdfFromAlpha', () => {
  const W = 16;
  const H = 16;
  const SPREAD = 4;

  /** Filled axis-aligned rect [x0,x1)×[y0,y1) at full alpha. */
  function rectAlpha(x0: number, y0: number, x1: number, y1: number): Uint8Array {
    const a = new Uint8Array(W * H);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) a[y * W + x] = 255;
    return a;
  }

  it('maps the inside above 128 and the outside below it', () => {
    const sdf = sdfFromAlpha(rectAlpha(4, 4, 12, 12), W, H, SPREAD);
    expect(sdf[8 * W + 8]).toBeGreaterThan(128); // deep inside
    expect(sdf[8 * W + 4]).toBeGreaterThan(128); // boundary pixel is inside
    expect(sdf[8 * W + 3]).toBeLessThan(128); // first outside pixel
    expect(sdf[0]).toBe(0); // far corner, beyond the spread
  });

  it('encodes exact one-pixel steps across a straight edge', () => {
    const sdf = sdfFromAlpha(rectAlpha(8, 0, 16, 16), W, H, SPREAD);
    // Signed distance at x=7 (1px outside) is -1 → 0.5 - 1/8 of 255.
    expect(sdf[8 * W + 7]).toBe(Math.round((0.5 - 1 / (2 * SPREAD)) * 255));
    // At x=8 (boundary pixel, 1px from uncovered) it is +1.
    expect(sdf[8 * W + 8]).toBe(Math.round((0.5 + 1 / (2 * SPREAD)) * 255));
  });

  it('saturates at the spread radius', () => {
    const sdf = sdfFromAlpha(rectAlpha(8, 0, 16, 16), W, H, SPREAD);
    expect(sdf[8 * W + 0]).toBe(0); // 8px outside ≥ spread
    expect(sdf[8 * W + 15]).toBe(255); // 8px inside ≥ spread
  });

  it('an empty bitmap is all 0 and a full bitmap is all 255', () => {
    expect(new Set(sdfFromAlpha(new Uint8Array(W * H), W, H, SPREAD))).toEqual(new Set([0]));
    expect(new Set(sdfFromAlpha(new Uint8Array(W * H).fill(255), W, H, SPREAD))).toEqual(
      new Set([255]),
    );
  });

  it('low-coverage haze stays below the render threshold everywhere', () => {
    const a = new Uint8Array(W * H).fill(64); // quarter-covered, no real edge
    for (const v of sdfFromAlpha(a, W, H, SPREAD)) expect(v).toBeLessThan(128);
  });

  it('antialiased boundary pixels shift the edge sub-pixel (TinySDF seeding)', () => {
    // Two vertical edges: a hard one, and one whose boundary column is
    // three-quarters covered — its edge must read closer to "inside".
    const hard = rectAlpha(8, 0, 16, 16);
    const soft = rectAlpha(8, 0, 16, 16);
    for (let y = 0; y < H; y++) soft[y * W + 7] = 191; // ~0.75 coverage
    const sdfHard = sdfFromAlpha(hard, W, H, SPREAD);
    const sdfSoft = sdfFromAlpha(soft, W, H, SPREAD);
    const i = 8 * W + 7;
    expect(sdfSoft[i] ?? 0).toBeGreaterThan(sdfHard[i] ?? 0); // pulled inward
    expect(sdfSoft[i] ?? 0).toBeGreaterThan(128); // mostly covered → inside
    expect(sdfHard[i] ?? 0).toBeLessThan(128);
  });
});
