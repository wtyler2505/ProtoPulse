import { describe, it, expect } from 'vitest';
import {
  applyWindow,
  windowCoefficient,
  isPowerOfTwo,
  padToPowerOfTwo,
  fftRadix2,
  computeFFT,
  findSpectralPeaks,
  computeTHD,
  computeIMD,
  classifyTHD,
  classifyIMD,
  generateSineWave,
  generateTwoTone,
  addHarmonicDistortion,
} from '../harmonic-distortion';
import type {
  WindowFunction,
  SpectralBin,
  THDResult,
  IMDResult,
  DistortionClass,
} from '../harmonic-distortion';

// ---------------------------------------------------------------------------
// Window functions
// ---------------------------------------------------------------------------

describe('windowCoefficient', () => {
  it('rectangular window returns 1 for all samples', () => {
    for (let n = 0; n < 64; n++) {
      expect(windowCoefficient(n, 64, 'rectangular')).toBe(1.0);
    }
  });

  it('hann window is 0 at endpoints', () => {
    const N = 64;
    expect(windowCoefficient(0, N, 'hann')).toBeCloseTo(0, 10);
    expect(windowCoefficient(N - 1, N, 'hann')).toBeCloseTo(0, 10);
  });

  it('hann window peaks at center', () => {
    const N = 64;
    const center = windowCoefficient(Math.floor((N - 1) / 2), N, 'hann');
    expect(center).toBeGreaterThan(0.9);
  });

  it('hamming window is non-zero at endpoints', () => {
    const N = 64;
    expect(windowCoefficient(0, N, 'hamming')).toBeCloseTo(0.08, 1);
    expect(windowCoefficient(N - 1, N, 'hamming')).toBeCloseTo(0.08, 1);
  });

  it('blackman window is near zero at endpoints', () => {
    const N = 64;
    expect(windowCoefficient(0, N, 'blackman')).toBeCloseTo(0, 2);
    expect(windowCoefficient(N - 1, N, 'blackman')).toBeCloseTo(0, 2);
  });

  it('all windows produce values in [0, 1]', () => {
    const types: WindowFunction[] = ['rectangular', 'hann', 'hamming', 'blackman'];
    types.forEach((wt) => {
      for (let n = 0; n < 128; n++) {
        const c = windowCoefficient(n, 128, wt);
        expect(c).toBeGreaterThanOrEqual(-0.001);
        expect(c).toBeLessThanOrEqual(1.001);
      }
    });
  });
});

describe('applyWindow', () => {
  it('rectangular window preserves signal', () => {
    const signal = new Float64Array([1, 2, 3, 4]);
    const windowed = applyWindow(signal, 'rectangular');
    expect(Array.from(windowed)).toEqual([1, 2, 3, 4]);
  });

  it('hann window zeroes endpoints', () => {
    const signal = new Float64Array(64).fill(1);
    const windowed = applyWindow(signal, 'hann');
    expect(windowed[0]).toBeCloseTo(0, 10);
    expect(windowed[63]).toBeCloseTo(0, 10);
  });

  it('returns same length as input', () => {
    const signal = new Float64Array(128).fill(1);
    const windowed = applyWindow(signal, 'blackman');
    expect(windowed.length).toBe(128);
  });
});

// ---------------------------------------------------------------------------
// Power-of-two utilities
// ---------------------------------------------------------------------------

describe('isPowerOfTwo', () => {
  it('identifies powers of two', () => {
    expect(isPowerOfTwo(1)).toBe(true);
    expect(isPowerOfTwo(2)).toBe(true);
    expect(isPowerOfTwo(4)).toBe(true);
    expect(isPowerOfTwo(1024)).toBe(true);
    expect(isPowerOfTwo(65536)).toBe(true);
  });

  it('rejects non-powers of two', () => {
    expect(isPowerOfTwo(0)).toBe(false);
    expect(isPowerOfTwo(3)).toBe(false);
    expect(isPowerOfTwo(5)).toBe(false);
    expect(isPowerOfTwo(100)).toBe(false);
    expect(isPowerOfTwo(-4)).toBe(false);
  });
});

describe('padToPowerOfTwo', () => {
  it('returns same array if already power of two', () => {
    const signal = new Float64Array(16);
    const padded = padToPowerOfTwo(signal);
    expect(padded.length).toBe(16);
  });

  it('pads to next power of two', () => {
    const signal = new Float64Array(10);
    const padded = padToPowerOfTwo(signal);
    expect(padded.length).toBe(16);
  });

  it('preserves original data', () => {
    const signal = new Float64Array([1, 2, 3, 4, 5]);
    const padded = padToPowerOfTwo(signal);
    expect(padded.length).toBe(8);
    expect(padded[0]).toBe(1);
    expect(padded[4]).toBe(5);
    expect(padded[5]).toBe(0);
    expect(padded[7]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// FFT
// ---------------------------------------------------------------------------

describe('fftRadix2', () => {
  it('throws for non-power-of-two length', () => {
    const re = new Float64Array(6);
    const im = new Float64Array(6);
    expect(() => fftRadix2(re, im)).toThrow('power of 2');
  });

  it('throws for mismatched lengths', () => {
    const re = new Float64Array(8);
    const im = new Float64Array(4);
    expect(() => fftRadix2(re, im)).toThrow('same length');
  });

  it('DC signal has energy only at bin 0', () => {
    const N = 8;
    const re = new Float64Array(N).fill(1);
    const im = new Float64Array(N);
    const result = fftRadix2(re, im);

    expect(result.real[0]).toBeCloseTo(N, 5);
    for (let i = 1; i < N; i++) {
      expect(Math.abs(result.real[i])).toBeLessThan(1e-10);
      expect(Math.abs(result.imag[i])).toBeLessThan(1e-10);
    }
  });

  it('pure sine at bin frequency produces correct peak', () => {
    const N = 64;
    const sampleRate = 64;
    const freq = 4; // bin 4
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    for (let n = 0; n < N; n++) {
      re[n] = Math.sin(2 * Math.PI * freq * n / sampleRate);
    }
    const result = fftRadix2(re, im);

    // Energy should be concentrated at bin 4 and bin N-4
    const mag4 = Math.sqrt(result.real[4] ** 2 + result.imag[4] ** 2);
    const mag60 = Math.sqrt(result.real[60] ** 2 + result.imag[60] ** 2);
    expect(mag4).toBeGreaterThan(N / 3);
    expect(mag60).toBeGreaterThan(N / 3);

    // Other bins should be near zero
    for (let i = 1; i < N; i++) {
      if (i === 4 || i === N - 4) {
        continue;
      }
      const mag = Math.sqrt(result.real[i] ** 2 + result.imag[i] ** 2);
      expect(mag).toBeLessThan(1e-8);
    }
  });

  it('Parseval theorem: time energy ≈ frequency energy', () => {
    const N = 128;
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    for (let n = 0; n < N; n++) {
      re[n] = Math.sin(2 * Math.PI * 7 * n / N) + 0.5 * Math.cos(2 * Math.PI * 13 * n / N);
    }

    const timeEnergy = Array.from(re).reduce((s, v) => s + v * v, 0);
    const result = fftRadix2(re, im);
    const freqEnergy = Array.from(result.real).reduce((s, v, i) =>
      s + v * v + result.imag[i] * result.imag[i], 0,
    ) / N;

    expect(freqEnergy).toBeCloseTo(timeEnergy, 5);
  });
});

// ---------------------------------------------------------------------------
// computeFFT (high-level)
// ---------------------------------------------------------------------------

describe('computeFFT', () => {
  it('returns correct number of bins (one-sided)', () => {
    const signal = generateSineWave(100, 1024, 1024);
    const spectrum = computeFFT(signal, 'rectangular', 1024);
    expect(spectrum.length).toBe(513); // N/2 + 1
  });

  it('detects single tone frequency', () => {
    const sampleRate = 8192;
    const freq = 1000;
    const signal = generateSineWave(freq, sampleRate, 8192);
    const spectrum = computeFFT(signal, 'rectangular', sampleRate);

    // Find the bin with maximum magnitude (excluding DC)
    let maxMag = 0;
    let maxFreq = 0;
    for (let i = 1; i < spectrum.length; i++) {
      if (spectrum[i].magnitude > maxMag) {
        maxMag = spectrum[i].magnitude;
        maxFreq = spectrum[i].frequency;
      }
    }
    expect(maxFreq).toBeCloseTo(freq, 0);
  });

  it('different window functions produce different spectral shapes', () => {
    const signal = generateSineWave(500, 4096, 4096);
    const rectSpectrum = computeFFT(signal, 'rectangular', 4096);
    const hannSpectrum = computeFFT(signal, 'hann', 4096);

    // Hann window should have lower sidelobes
    const rectMax = Math.max(...rectSpectrum.map((b) => b.magnitude));
    const hannMax = Math.max(...hannSpectrum.map((b) => b.magnitude));
    // Both should detect the signal but with different amplitudes due to windowing
    expect(rectMax).toBeGreaterThan(0);
    expect(hannMax).toBeGreaterThan(0);
    // Rectangular preserves amplitude better for on-bin signals
    expect(rectMax).toBeGreaterThanOrEqual(hannMax * 0.9);
  });

  it('handles non-power-of-two input by padding', () => {
    const signal = generateSineWave(100, 1000, 1000);
    const spectrum = computeFFT(signal, 'hann', 1000);
    // Padded to 1024, so N/2+1 = 513 bins
    expect(spectrum.length).toBe(513);
  });
});

// ---------------------------------------------------------------------------
// Spectral peak detection
// ---------------------------------------------------------------------------

describe('findSpectralPeaks', () => {
  it('finds single tone peak', () => {
    const sampleRate = 4096;
    const signal = generateSineWave(500, sampleRate, 4096);
    const spectrum = computeFFT(signal, 'rectangular', sampleRate);
    const peaks = findSpectralPeaks(spectrum, 0.01);

    expect(peaks.length).toBeGreaterThanOrEqual(1);
    expect(peaks[0].frequency).toBeCloseTo(500, 0);
  });

  it('finds two tone peaks', () => {
    const sampleRate = 8192;
    const signal = generateTwoTone(1000, 2000, sampleRate, 8192);
    const spectrum = computeFFT(signal, 'rectangular', sampleRate);
    const peaks = findSpectralPeaks(spectrum, 0.1);

    expect(peaks.length).toBeGreaterThanOrEqual(2);
    const freqs = peaks.map((p) => p.frequency).sort((a, b) => a - b);
    expect(freqs.some((f) => Math.abs(f - 1000) < 10)).toBe(true);
    expect(freqs.some((f) => Math.abs(f - 2000) < 10)).toBe(true);
  });

  it('returns empty for flat spectrum', () => {
    const spectrum: SpectralBin[] = Array.from({ length: 100 }, (_, i) => ({
      frequency: i,
      magnitude: 1,
      phase: 0,
    }));
    const peaks = findSpectralPeaks(spectrum, 0.01);
    expect(peaks).toHaveLength(0);
  });

  it('returns empty for all-zero spectrum', () => {
    const spectrum: SpectralBin[] = Array.from({ length: 100 }, (_, i) => ({
      frequency: i,
      magnitude: 0,
      phase: 0,
    }));
    const peaks = findSpectralPeaks(spectrum, 0.01);
    expect(peaks).toHaveLength(0);
  });

  it('respects threshold parameter', () => {
    const sampleRate = 4096;
    const signal = generateSineWave(500, sampleRate, 4096);
    const spectrum = computeFFT(signal, 'hann', sampleRate);

    const lowThresh = findSpectralPeaks(spectrum, 0.001);
    const highThresh = findSpectralPeaks(spectrum, 0.5);
    expect(lowThresh.length).toBeGreaterThanOrEqual(highThresh.length);
  });

  it('sorts peaks by magnitude descending', () => {
    const sampleRate = 8192;
    const signal = generateTwoTone(1000, 2000, sampleRate, 8192);
    const spectrum = computeFFT(signal, 'rectangular', sampleRate);
    const peaks = findSpectralPeaks(spectrum, 0.01);

    for (let i = 1; i < peaks.length; i++) {
      expect(peaks[i].magnitude).toBeLessThanOrEqual(peaks[i - 1].magnitude);
    }
  });

  it('handles spectrum with fewer than 3 bins', () => {
    const spectrum: SpectralBin[] = [
      { frequency: 0, magnitude: 1, phase: 0 },
      { frequency: 1, magnitude: 2, phase: 0 },
    ];
    const peaks = findSpectralPeaks(spectrum);
    expect(peaks).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// THD computation
// ---------------------------------------------------------------------------

describe('computeTHD', () => {
  it('pure sine has near-zero THD', () => {
    const sampleRate = 8192;
    const freq = 1000;
    const signal = generateSineWave(freq, sampleRate, 8192);
    const spectrum = computeFFT(signal, 'rectangular', sampleRate);
    const thd = computeTHD(spectrum, freq, sampleRate);

    expect(thd.thdPercent).toBeLessThan(0.1);
    expect(thd.fundamentalFrequency).toBe(freq);
    expect(thd.fundamentalMagnitude).toBeGreaterThan(0);
    expect(classifyTHD(thd.thdPercent)).toBe('excellent');
  });

  it('detects known harmonic distortion', () => {
    const sampleRate = 8192;
    const freq = 500;
    const signal = generateSineWave(freq, sampleRate, 8192);

    // Add 10% second harmonic and 5% third harmonic
    const harmonics = new Map<number, number>([
      [2, 0.1],
      [3, 0.05],
    ]);
    const distorted = addHarmonicDistortion(signal, freq, sampleRate, harmonics);
    const spectrum = computeFFT(distorted, 'rectangular', sampleRate);
    const thd = computeTHD(spectrum, freq, sampleRate);

    // THD = sqrt(0.1^2 + 0.05^2) ≈ 11.18%
    expect(thd.thdPercent).toBeCloseTo(11.18, 0);
    expect(thd.harmonicCount).toBeGreaterThanOrEqual(2);
    expect(thd.harmonicMagnitudes.length).toBeGreaterThanOrEqual(2);
  });

  it('returns zero THD for zero-magnitude fundamental', () => {
    const spectrum: SpectralBin[] = Array.from({ length: 100 }, (_, i) => ({
      frequency: i * 10,
      magnitude: 0,
      phase: 0,
    }));
    const thd = computeTHD(spectrum, 100, 2000);
    expect(thd.thd).toBe(0);
    expect(thd.thdPercent).toBe(0);
    expect(thd.thdDb).toBe(-Infinity);
  });

  it('thdDb is correct for known THD', () => {
    const sampleRate = 8192;
    const freq = 500;
    const signal = generateSineWave(freq, sampleRate, 8192);
    const harmonics = new Map<number, number>([[2, 0.1]]);
    const distorted = addHarmonicDistortion(signal, freq, sampleRate, harmonics);
    const spectrum = computeFFT(distorted, 'rectangular', sampleRate);
    const thd = computeTHD(spectrum, freq, sampleRate);

    // THD ≈ 0.1 → THD_dB ≈ -20 dB
    expect(thd.thdDb).toBeCloseTo(-20, 0);
  });

  it('limits harmonics to below Nyquist', () => {
    const sampleRate = 4096;
    const freq = 1500; // 3rd harmonic at 4500 Hz > Nyquist (2048)
    const signal = generateSineWave(freq, sampleRate, 4096);
    const spectrum = computeFFT(signal, 'rectangular', sampleRate);
    const thd = computeTHD(spectrum, freq, sampleRate);

    // Should only have harmonics below Nyquist
    expect(thd.harmonicCount).toBeLessThanOrEqual(1);
  });

  it('respects maxHarmonics parameter', () => {
    const sampleRate = 16384;
    const freq = 100;
    const signal = generateSineWave(freq, sampleRate, 16384);
    const harmonics = new Map<number, number>([
      [2, 0.1], [3, 0.05], [4, 0.02], [5, 0.01],
    ]);
    const distorted = addHarmonicDistortion(signal, freq, sampleRate, harmonics);
    const spectrum = computeFFT(distorted, 'rectangular', sampleRate);

    const thd2 = computeTHD(spectrum, freq, sampleRate, 2);
    const thd10 = computeTHD(spectrum, freq, sampleRate, 10);

    expect(thd2.harmonicCount).toBe(2);
    expect(thd10.harmonicCount).toBeGreaterThan(2);
    // More harmonics means higher measured THD
    expect(thd10.thd).toBeGreaterThanOrEqual(thd2.thd);
  });
});

// ---------------------------------------------------------------------------
// IMD computation
// ---------------------------------------------------------------------------

describe('computeIMD', () => {
  it('pure two-tone has near-zero IMD', () => {
    const sampleRate = 16384;
    const signal = generateTwoTone(1000, 1200, sampleRate, 16384);
    const spectrum = computeFFT(signal, 'rectangular', sampleRate);
    const imd = computeIMD(spectrum, 1000, 1200, sampleRate);

    expect(imd.imdPercent).toBeLessThan(1);
    expect(imd.f1).toBe(1000);
    expect(imd.f2).toBe(1200);
  });

  it('detects intermod products from nonlinear distortion', () => {
    const sampleRate = 16384;
    const f1 = 1000;
    const f2 = 1200;
    const N = 16384;
    const signal = new Float64Array(N);

    // Create two-tone + square it (nonlinear) to produce intermod
    for (let n = 0; n < N; n++) {
      const s = Math.sin(2 * Math.PI * f1 * n / sampleRate) +
                Math.sin(2 * Math.PI * f2 * n / sampleRate);
      signal[n] = s + 0.1 * s * s; // mild nonlinearity
    }

    const spectrum = computeFFT(signal, 'rectangular', sampleRate);
    const imd = computeIMD(spectrum, f1, f2, sampleRate);

    // Should detect intermod products
    expect(imd.products.length).toBeGreaterThan(0);
    expect(imd.imdPercent).toBeGreaterThan(0);
  });

  it('returns zero IMD for zero-magnitude tones', () => {
    const spectrum: SpectralBin[] = Array.from({ length: 100 }, (_, i) => ({
      frequency: i * 10,
      magnitude: 0,
      phase: 0,
    }));
    const imd = computeIMD(spectrum, 100, 200, 2000);
    expect(imd.imd).toBe(0);
    expect(imd.imdDb).toBe(-Infinity);
  });

  it('products are sorted by magnitude descending', () => {
    const sampleRate = 16384;
    const N = 16384;
    const f1 = 1000;
    const f2 = 1200;
    const signal = new Float64Array(N);
    for (let n = 0; n < N; n++) {
      const s = Math.sin(2 * Math.PI * f1 * n / sampleRate) +
                Math.sin(2 * Math.PI * f2 * n / sampleRate);
      signal[n] = s + 0.15 * s * s;
    }
    const spectrum = computeFFT(signal, 'rectangular', sampleRate);
    const imd = computeIMD(spectrum, f1, f2, sampleRate);

    for (let i = 1; i < imd.products.length; i++) {
      expect(imd.products[i].magnitude).toBeLessThanOrEqual(imd.products[i - 1].magnitude);
    }
  });

  it('normalizes f1 < f2', () => {
    const sampleRate = 8192;
    const signal = generateTwoTone(2000, 1000, sampleRate, 8192);
    const spectrum = computeFFT(signal, 'rectangular', sampleRate);
    const imd = computeIMD(spectrum, 2000, 1000, sampleRate);

    expect(imd.f1).toBe(1000);
    expect(imd.f2).toBe(2000);
  });

  it('imdDb is consistent with imd value', () => {
    const sampleRate = 16384;
    const N = 16384;
    const f1 = 1000;
    const f2 = 1200;
    const signal = new Float64Array(N);
    for (let n = 0; n < N; n++) {
      const s = Math.sin(2 * Math.PI * f1 * n / sampleRate) +
                Math.sin(2 * Math.PI * f2 * n / sampleRate);
      signal[n] = s + 0.1 * s * s;
    }
    const spectrum = computeFFT(signal, 'rectangular', sampleRate);
    const imd = computeIMD(spectrum, f1, f2, sampleRate);

    if (imd.imd > 0) {
      expect(imd.imdDb).toBeCloseTo(20 * Math.log10(imd.imd), 5);
    }
  });
});

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

describe('classifyTHD', () => {
  it('excellent for < 0.1%', () => {
    expect(classifyTHD(0.05)).toBe('excellent');
    expect(classifyTHD(0)).toBe('excellent');
  });

  it('good for 0.1% - 1%', () => {
    expect(classifyTHD(0.1)).toBe('good');
    expect(classifyTHD(0.5)).toBe('good');
    expect(classifyTHD(0.99)).toBe('good');
  });

  it('moderate for 1% - 5%', () => {
    expect(classifyTHD(1)).toBe('moderate');
    expect(classifyTHD(3)).toBe('moderate');
    expect(classifyTHD(4.99)).toBe('moderate');
  });

  it('poor for 5% - 10%', () => {
    expect(classifyTHD(5)).toBe('poor');
    expect(classifyTHD(7.5)).toBe('poor');
    expect(classifyTHD(9.99)).toBe('poor');
  });

  it('unacceptable for >= 10%', () => {
    expect(classifyTHD(10)).toBe('unacceptable');
    expect(classifyTHD(50)).toBe('unacceptable');
    expect(classifyTHD(100)).toBe('unacceptable');
  });
});

describe('classifyIMD', () => {
  it('uses same thresholds as THD', () => {
    expect(classifyIMD(0.05)).toBe('excellent');
    expect(classifyIMD(0.5)).toBe('good');
    expect(classifyIMD(3)).toBe('moderate');
    expect(classifyIMD(7)).toBe('poor');
    expect(classifyIMD(15)).toBe('unacceptable');
  });
});

// ---------------------------------------------------------------------------
// Signal generators
// ---------------------------------------------------------------------------

describe('generateSineWave', () => {
  it('generates correct number of samples', () => {
    const signal = generateSineWave(100, 1000, 512);
    expect(signal.length).toBe(512);
  });

  it('respects amplitude parameter', () => {
    // Use frequency that divides evenly into sample rate for exact peak alignment
    const signal = generateSineWave(250, 4000, 4000, 2.5);
    const maxVal = Math.max(...Array.from(signal));
    expect(maxVal).toBeCloseTo(2.5, 1);
  });

  it('values are bounded by amplitude', () => {
    const amplitude = 3.0;
    const signal = generateSineWave(440, 44100, 1024, amplitude);
    for (let i = 0; i < signal.length; i++) {
      expect(Math.abs(signal[i])).toBeLessThanOrEqual(amplitude + 0.001);
    }
  });

  it('starts at correct phase', () => {
    const signal = generateSineWave(100, 1000, 1000, 1.0, Math.PI / 2);
    // At phase π/2, sin(π/2) = 1
    expect(signal[0]).toBeCloseTo(1.0, 5);
  });
});

describe('generateTwoTone', () => {
  it('generates correct number of samples', () => {
    const signal = generateTwoTone(1000, 2000, 44100, 1024);
    expect(signal.length).toBe(1024);
  });

  it('peak amplitude is approximately 2x single amplitude', () => {
    const signal = generateTwoTone(1000, 2000, 44100, 44100, 1.0);
    const maxVal = Math.max(...Array.from(signal));
    // Two unit-amplitude sine waves can sum to 2.0
    expect(maxVal).toBeLessThanOrEqual(2.001);
    expect(maxVal).toBeGreaterThan(1.5);
  });
});

describe('addHarmonicDistortion', () => {
  it('adds harmonics to a clean signal', () => {
    const sampleRate = 8192;
    const freq = 500;
    const clean = generateSineWave(freq, sampleRate, 8192);
    const harmonics = new Map<number, number>([[2, 0.5]]);
    const distorted = addHarmonicDistortion(clean, freq, sampleRate, harmonics);

    // Distorted signal should have larger peak amplitude
    const cleanMax = Math.max(...Array.from(clean).map(Math.abs));
    const distortedMax = Math.max(...Array.from(distorted).map(Math.abs));
    expect(distortedMax).toBeGreaterThan(cleanMax);
  });

  it('preserves original signal length', () => {
    const signal = generateSineWave(100, 1000, 512);
    const harmonics = new Map<number, number>([[2, 0.1], [3, 0.05]]);
    const distorted = addHarmonicDistortion(signal, 100, 1000, harmonics);
    expect(distorted.length).toBe(512);
  });

  it('does not modify original signal', () => {
    const signal = generateSineWave(100, 1000, 256);
    const original = new Float64Array(signal);
    const harmonics = new Map<number, number>([[2, 0.1]]);
    addHarmonicDistortion(signal, 100, 1000, harmonics);
    expect(Array.from(signal)).toEqual(Array.from(original));
  });
});

// ---------------------------------------------------------------------------
// Integration / round-trip tests
// ---------------------------------------------------------------------------

describe('integration', () => {
  it('end-to-end THD measurement workflow', () => {
    const sampleRate = 16384;
    const freq = 1000;
    const N = 16384;

    // Generate clean signal
    const clean = generateSineWave(freq, sampleRate, N);

    // Add known distortion: 5% 2nd harmonic, 2% 3rd harmonic
    const harmonics = new Map<number, number>([
      [2, 0.05],
      [3, 0.02],
    ]);
    const distorted = addHarmonicDistortion(clean, freq, sampleRate, harmonics);

    // Compute FFT with rectangular window for accuracy
    const spectrum = computeFFT(distorted, 'rectangular', sampleRate);

    // Measure THD
    const thd = computeTHD(spectrum, freq, sampleRate);

    // Expected THD = sqrt(0.05^2 + 0.02^2) ≈ 5.385%
    expect(thd.thdPercent).toBeCloseTo(5.385, 0);
    expect(thd.fundamentalFrequency).toBe(freq);
    expect(classifyTHD(thd.thdPercent)).toBe('poor');

    // Verify peaks exist at harmonic frequencies
    const peaks = findSpectralPeaks(spectrum, 0.01);
    const peakFreqs = peaks.map((p) => p.frequency);
    expect(peakFreqs.some((f) => Math.abs(f - freq) < 5)).toBe(true);
    expect(peakFreqs.some((f) => Math.abs(f - 2 * freq) < 5)).toBe(true);
    expect(peakFreqs.some((f) => Math.abs(f - 3 * freq) < 5)).toBe(true);
  });

  it('end-to-end IMD measurement workflow', () => {
    const sampleRate = 32768;
    const f1 = 1000;
    const f2 = 1200;
    const N = 32768;

    // Create two-tone with nonlinear distortion
    const signal = new Float64Array(N);
    for (let n = 0; n < N; n++) {
      const s =
        Math.sin(2 * Math.PI * f1 * n / sampleRate) +
        Math.sin(2 * Math.PI * f2 * n / sampleRate);
      signal[n] = s + 0.05 * s * s + 0.02 * s * s * s;
    }

    const spectrum = computeFFT(signal, 'rectangular', sampleRate);
    const imd = computeIMD(spectrum, f1, f2, sampleRate);

    expect(imd.f1).toBe(f1);
    expect(imd.f2).toBe(f2);
    expect(imd.products.length).toBeGreaterThan(0);
    expect(imd.imdPercent).toBeGreaterThan(0);
    expect(imd.imdDb).toBeLessThan(0);
  });
});
