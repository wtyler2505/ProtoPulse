import { describe, expect, it } from 'vitest';

import { FFT_MAX_N, fftRadix2, fftSpectrum, hannWindow, nextPow2, resampleUniform } from './fft.js';

/** mulberry32-style deterministic noise for the Parseval check. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** n uniform samples at spacing dt of a callback. */
function sampled(n: number, dt: number, f: (t: number) => number): { xs: number[]; ys: number[] } {
  const xs = Array.from({ length: n }, (_, i) => i * dt);
  return { xs, ys: xs.map(f) };
}

describe('nextPow2', () => {
  it('returns the smallest power of two ≥ n', () => {
    expect(nextPow2(1)).toBe(1);
    expect(nextPow2(2)).toBe(2);
    expect(nextPow2(3)).toBe(4);
    expect(nextPow2(1000)).toBe(1024);
    expect(nextPow2(1024)).toBe(1024);
    expect(nextPow2(1025)).toBe(2048);
  });
});

describe('hannWindow', () => {
  it('is periodic: zero at the left edge, symmetric about n/2, sums to n/2', () => {
    const n = 256;
    const w = hannWindow(n);
    expect(w[0]).toBe(0);
    expect(w[n / 2]).toBeCloseTo(1, 12);
    for (let i = 1; i < n / 2; i++) {
      expect(w[i]).toBeCloseTo(w[n - i] ?? NaN, 12);
    }
    const sum = w.reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(n / 2, 9);
  });
});

describe('fftRadix2', () => {
  it('rejects non-power-of-two lengths', () => {
    expect(() => fftRadix2([1, 2, 3], [0, 0, 0])).toThrow(/power of two/);
    expect(() => fftRadix2([], [])).toThrow(/power of two/);
    expect(() => fftRadix2([1, 2], [0])).toThrow(/mismatch/);
  });

  it('transforms an impulse to a flat unit spectrum', () => {
    const n = 64;
    const re = new Array<number>(n).fill(0);
    re[0] = 1;
    const out = fftRadix2(re, new Array<number>(n).fill(0));
    for (let k = 0; k < n; k++) {
      expect(out.re[k]).toBeCloseTo(1, 12);
      expect(out.im[k]).toBeCloseTo(0, 12);
    }
  });

  it('satisfies Parseval: Σ|X[k]|² = n·Σ|x[i]|² on random data', () => {
    const n = 256;
    const rand = prng(42);
    const re = Array.from({ length: n }, () => rand() * 2 - 1);
    const im = new Array<number>(n).fill(0);
    const out = fftRadix2(re, im);
    const timeEnergy = re.reduce((s, v) => s + v * v, 0);
    const freqEnergy = out.re.reduce(
      (s, v, k) => s + v * v + (out.im[k] ?? 0) * (out.im[k] ?? 0),
      0,
    );
    expect(freqEnergy / (n * timeEnergy)).toBeCloseTo(1, 9);
  });
});

describe('resampleUniform', () => {
  it('reproduces a linear function exactly from non-uniform samples', () => {
    // Quadratically spaced sample times of y = 3x + 1.
    const xs = Array.from({ length: 50 }, (_, i) => (i / 49) ** 2);
    const ys = xs.map((x) => 3 * x + 1);
    const out = resampleUniform(xs, ys, 64);
    expect(out).not.toBeNull();
    const dt = out?.dt ?? NaN;
    expect(dt).toBeCloseTo(1 / 63, 12);
    out?.ys.forEach((y, i) => {
      expect(y).toBeCloseTo(3 * (i * dt) + 1, 9);
    });
  });

  it('returns null for degenerate inputs', () => {
    expect(resampleUniform([0], [1], 8)).toBeNull();
    expect(resampleUniform([0, 0], [1, 2], 8)).toBeNull(); // zero span
    expect(resampleUniform([0, 1], [1, 2], 1)).toBeNull();
    expect(resampleUniform([], [], 8)).toBeNull();
  });
});

describe('fftSpectrum', () => {
  it('reads a DC level at bin 0 and (near-)nothing past the window skirt', () => {
    const { xs, ys } = sampled(1024, 1e-4, () => 2);
    const spec = fftSpectrum(xs, ys);
    expect(spec).not.toBeNull();
    expect(spec?.n).toBe(1024);
    // 20·log10(2) ≈ 6.0206 dB at DC, coherent gain exactly compensated.
    expect(spec?.db[0]).toBeCloseTo(20 * Math.log10(2), 6);
    expect(spec?.freqs[0]).toBe(0);
    // The periodic Hann transform is zero beyond ±1 bin: pure numeric floor.
    for (let k = 2; k <= 10; k++) {
      expect(spec?.db[k] ?? 0).toBeLessThan(-100);
    }
  });

  it('puts an on-bin unit sine at exactly its bin, reading 0 dB', () => {
    // fs = 8192 Hz, n = 1024 → bin width 8 Hz; 512 Hz = bin 64 exactly.
    const f0 = 512;
    const { xs, ys } = sampled(1024, 1 / 8192, (t) => Math.sin(2 * Math.PI * f0 * t));
    const spec = fftSpectrum(xs, ys);
    expect(spec).not.toBeNull();
    const db = spec?.db ?? [];
    const peak = db.indexOf(Math.max(...db));
    expect(peak).toBe(64);
    expect(spec?.freqs[peak]).toBeCloseTo(f0, 6);
    expect(db[peak]).toBeCloseTo(0, 3);
  });

  it('finds an off-bin sine within ±1 bin with bounded scalloping loss', () => {
    // 516 Hz sits exactly between bins 64 and 65 (8 Hz bins) — the
    // worst case for leakage; Hann scalloping loss is at most ~1.42 dB.
    const f0 = 516;
    const { xs, ys } = sampled(1024, 1 / 8192, (t) => Math.sin(2 * Math.PI * f0 * t));
    const spec = fftSpectrum(xs, ys);
    const db = spec?.db ?? [];
    const peak = db.indexOf(Math.max(...db));
    const expected = Math.round((f0 * 1024) / 8192); // 64.5 → 65 (or 64)
    expect(Math.abs(peak - expected)).toBeLessThanOrEqual(1);
    expect(db[peak] ?? -999).toBeGreaterThan(-1.5);
    expect(db[peak] ?? 999).toBeLessThan(0.1);
  });

  it('recovers the tone frequency from a NON-uniform transient timebase', () => {
    // ngspice-like adaptive steps: jittered spacing around 1/8192 s.
    const rand = prng(7);
    const xs: number[] = [0];
    while ((xs[xs.length - 1] ?? 0) < 0.124) {
      xs.push((xs[xs.length - 1] ?? 0) + (0.6 + 0.8 * rand()) / 8192);
    }
    const f0 = 200;
    const ys = xs.map((t) => Math.sin(2 * Math.PI * f0 * t));
    const spec = fftSpectrum(xs, ys);
    expect(spec).not.toBeNull();
    const db = spec?.db ?? [];
    const peak = db.indexOf(Math.max(...db));
    const binWidth = (spec?.sampleRate ?? NaN) / (spec?.n ?? NaN);
    expect(Math.abs((spec?.freqs[peak] ?? NaN) - f0)).toBeLessThanOrEqual(binWidth);
    // Amplitude survives interpolation to within a dB or so.
    expect(db[peak] ?? -999).toBeGreaterThan(-1.5);
  });

  it('caps the FFT size at FFT_MAX_N for long traces', () => {
    const { xs, ys } = sampled(6000, 1e-5, (t) => Math.sin(2 * Math.PI * 1000 * t));
    const spec = fftSpectrum(xs, ys);
    expect(spec?.n).toBe(FFT_MAX_N);
    expect(spec?.freqs).toHaveLength(FFT_MAX_N / 2 + 1);
    expect(spec?.db).toHaveLength(FFT_MAX_N / 2 + 1);
  });

  it('pads short traces up to the next power of two', () => {
    const { xs, ys } = sampled(600, 1e-4, (t) => Math.sin(2 * Math.PI * 100 * t));
    const spec = fftSpectrum(xs, ys);
    expect(spec?.n).toBe(1024);
  });

  it('returns null when there is nothing to transform', () => {
    expect(fftSpectrum([], [])).toBeNull();
    expect(fftSpectrum([0], [1])).toBeNull();
    expect(fftSpectrum([1, 1], [0, 1])).toBeNull(); // zero time span
  });
});
