/**
 * FFT for transient traces — pure math, no DOM, no canvas (the SimPanel
 * pairs this with a second log-x Plot). Pipeline:
 *
 *   1. Uniformly RESAMPLE the (possibly non-uniform — ngspice adapts its
 *      timestep) time window by linear interpolation onto the next
 *      power-of-two grid, capped at FFT_MAX_N points.
 *   2. Apply a periodic HANN window (kills the rectangular-window leakage
 *      a non-integer number of cycles would smear everywhere).
 *   3. Radix-2 Cooley-Tukey FFT.
 *   4. One-sided AMPLITUDE spectrum in dB: bins are normalized by the
 *      window's coherent gain (sum of the window), and interior bins are
 *      doubled to fold in the negative frequencies — a unit-amplitude
 *      sine that lands on a bin reads 0 dB; DC reads its own level.
 *
 * Frequency axis: bin k sits at k·fs/n where fs = 1/dt of the resampled
 * grid, k = 0…n/2. Bin 0 (DC) is included; a log-x plot simply clips it.
 */

/** Hard cap on FFT size — plenty for a plot, cheap to compute. */
export const FFT_MAX_N = 4096;

/** Smallest power of two ≥ n (n ≥ 1). */
export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Periodic Hann window: w[i] = 0.5·(1 − cos(2πi/n)). */
export function hannWindow(n: number): number[] {
  const w = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / n));
  }
  return w;
}

/**
 * Resample (xs, ys) onto n uniform points spanning [xs[0], xs[last]] by
 * linear interpolation. xs must be ascending (simulation sweeps are).
 * Returns null when there are fewer than two points or zero time span.
 */
export function resampleUniform(
  xs: readonly number[],
  ys: readonly number[],
  n: number,
): { ys: number[]; dt: number } | null {
  const m = Math.min(xs.length, ys.length);
  if (m < 2 || n < 2) return null;
  const x0 = xs[0];
  const xEnd = xs[m - 1];
  if (x0 === undefined || xEnd === undefined || !(xEnd > x0)) return null;

  const dt = (xEnd - x0) / (n - 1);
  const out = new Array<number>(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * dt;
    while (j < m - 2 && (xs[j + 1] ?? Infinity) < x) j += 1;
    const xa = xs[j] ?? x0;
    const xb = xs[j + 1] ?? xEnd;
    const ya = ys[j] ?? 0;
    const yb = ys[j + 1] ?? 0;
    out[i] = xb === xa ? ya : ya + ((x - xa) / (xb - xa)) * (yb - ya);
  }
  return { ys: out, dt };
}

/**
 * In-place-style radix-2 Cooley-Tukey over copies of the inputs.
 * Lengths must match and be a power of two. Returns new arrays.
 */
export function fftRadix2(
  reIn: readonly number[],
  imIn: readonly number[],
): { re: number[]; im: number[] } {
  const n = reIn.length;
  if (imIn.length !== n) throw new Error('fftRadix2: re/im length mismatch');
  if (n === 0 || (n & (n - 1)) !== 0) {
    throw new Error(`fftRadix2: length must be a power of two (got ${String(n)})`);
  }
  const re = [...reIn];
  const im = [...imIn];

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; (j & bit) !== 0; bit >>= 1) j ^= bit;
    j |= bit;
    if (i < j) {
      const tr = re[i] ?? 0;
      const ti = im[i] ?? 0;
      re[i] = re[j] ?? 0;
      im[i] = im[j] ?? 0;
      re[j] = tr;
      im[j] = ti;
    }
  }

  // Butterflies; per-k trig keeps twiddle drift out of long stages.
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const step = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k++) {
        const a = step * k;
        const wr = Math.cos(a);
        const wi = Math.sin(a);
        const lo = i + k;
        const hi = lo + half;
        const xr = re[hi] ?? 0;
        const xi = im[hi] ?? 0;
        const tr = xr * wr - xi * wi;
        const ti = xr * wi + xi * wr;
        re[hi] = (re[lo] ?? 0) - tr;
        im[hi] = (im[lo] ?? 0) - ti;
        re[lo] = (re[lo] ?? 0) + tr;
        im[lo] = (im[lo] ?? 0) + ti;
      }
    }
  }
  return { re, im };
}

export interface FftSpectrum {
  /** Bin frequencies, k·fs/n for k = 0…n/2 (length n/2 + 1). */
  freqs: number[];
  /** One-sided amplitude spectrum in dB (−Infinity for exact zeros). */
  db: number[];
  /** FFT size actually used after resampling. */
  n: number;
  /** Sample rate of the resampled grid, Hz. */
  sampleRate: number;
}

/**
 * The whole pipeline: resample → Hann → FFT → one-sided dB magnitudes.
 * Returns null for inputs that cannot be resampled (under two points or
 * a degenerate time span).
 */
export function fftSpectrum(
  xs: readonly number[],
  ys: readonly number[],
  maxN: number = FFT_MAX_N,
): FftSpectrum | null {
  const m = Math.min(xs.length, ys.length);
  if (m < 2) return null;
  const n = Math.min(maxN, nextPow2(m));
  const resampled = resampleUniform(xs, ys, n);
  if (!resampled) return null;

  const w = hannWindow(n);
  let windowSum = 0;
  const re = new Array<number>(n);
  const im = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const wi = w[i] ?? 0;
    windowSum += wi;
    re[i] = (resampled.ys[i] ?? 0) * wi;
  }

  const spec = fftRadix2(re, im);
  const sampleRate = 1 / resampled.dt;
  const half = n / 2;
  const freqs = new Array<number>(half + 1);
  const db = new Array<number>(half + 1);
  for (let k = 0; k <= half; k++) {
    freqs[k] = (k * sampleRate) / n;
    // Coherent-gain normalization; interior bins fold in −f.
    const fold = k === 0 || k === half ? 1 : 2;
    const mag = (fold * Math.hypot(spec.re[k] ?? 0, spec.im[k] ?? 0)) / windowSum;
    db[k] = 20 * Math.log10(mag);
  }
  return { freqs, db, n, sampleRate };
}
