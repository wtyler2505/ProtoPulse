/**
 * Signed-distance-field generation from a coverage (alpha) bitmap —
 * exact Euclidean distance transform (Felzenszwalb & Huttenlocher 2012),
 * DOM-free so the glyph-atlas math is fully unit-testable. The GL layer
 * feeds canvas-rasterized glyphs through `sdfFromAlpha` and samples the
 * result with a smoothstep shader: crisp text at every zoom.
 *
 * Single-channel SDF, not multi-channel MSDF: sharp corners round off
 * by up to a pixel of the source raster at extreme magnification — the
 * accepted trade for needing no vector font outlines (ADR-0015).
 */

const INF = 1e20;

/**
 * 1D squared-distance transform of a sampled function (in place into
 * `d`). `f` holds per-cell parabola heights (0 = feature, INF = empty);
 * `v`/`z` are scratch (length n and n+1).
 */
function edt1d(
  f: Float64Array,
  d: Float64Array,
  v: Int32Array,
  z: Float64Array,
  n: number,
): void {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    const fq = f[q] ?? INF;
    for (;;) {
      const vk = v[k] ?? 0;
      const s = (fq + q * q - ((f[vk] ?? INF) + vk * vk)) / (2 * q - 2 * vk);
      if (s <= (z[k] ?? -INF) && k > 0) {
        k--;
        continue;
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
      break;
    }
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while ((z[k + 1] ?? INF) < q) k++;
    const vk = v[k] ?? 0;
    d[q] = (q - vk) * (q - vk) + (f[vk] ?? INF);
  }
}

/**
 * 2D squared Euclidean distance transform. `grid` holds 0 at feature
 * cells and INF elsewhere; returns squared distance to the nearest
 * feature cell (row-major, width×height). Exact, O(n).
 */
export function edt(grid: Float64Array, width: number, height: number): Float64Array {
  const out = Float64Array.from(grid);
  const n = Math.max(width, height);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) f[y] = out[y * width + x] ?? INF;
    edt1d(f, d, v, z, height);
    for (let y = 0; y < height; y++) out[y * width + x] = d[y] ?? INF;
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) f[x] = out[y * width + x] ?? INF;
    edt1d(f, d, v, z, width);
    for (let x = 0; x < width; x++) out[y * width + x] = d[x] ?? INF;
  }
  return out;
}

/**
 * Coverage bitmap → byte SDF. Distances are mapped so 128 sits on the
 * glyph edge, 255 is ≥`spreadPx` inside, 0 is ≥`spreadPx` outside —
 * exactly what a `smoothstep(0.5-aa, 0.5+aa, d)` shader wants.
 *
 * Partially-covered (antialiased) pixels seed the transform with their
 * sub-pixel edge offset — the TinySDF trick — so contours stay smooth
 * instead of stair-stepping along the source raster.
 */
export function sdfFromAlpha(
  alpha: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  spreadPx: number,
): Uint8Array {
  const size = width * height;
  const insideGrid = new Float64Array(size);
  const outsideGrid = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    const a = (alpha[i] ?? 0) / 255;
    // A pixel with coverage a sits |0.5 - a| from the true edge.
    if (a >= 1) {
      insideGrid[i] = 0;
      outsideGrid[i] = INF;
    } else if (a <= 0) {
      insideGrid[i] = INF;
      outsideGrid[i] = 0;
    } else {
      const dOut = Math.max(0, 0.5 - a);
      const dIn = Math.max(0, a - 0.5);
      insideGrid[i] = dOut * dOut;
      outsideGrid[i] = dIn * dIn;
    }
  }
  const toCovered = edt(insideGrid, width, height);
  const toUncovered = edt(outsideGrid, width, height);

  const out = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    // Positive inside the glyph, negative outside.
    const sd = Math.sqrt(toUncovered[i] ?? INF) - Math.sqrt(toCovered[i] ?? INF);
    const v = 0.5 + sd / (2 * spreadPx);
    out[i] = Math.round(Math.min(1, Math.max(0, v)) * 255);
  }
  return out;
}
