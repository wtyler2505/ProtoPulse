/**
 * Harmonic Distortion Analysis — THD & IMD
 *
 * Provides FFT-based harmonic distortion measurement for circuit simulation
 * output waveforms. Includes:
 *   - Radix-2 DIT (decimation-in-time) FFT implementation
 *   - Window functions: Hann, Hamming, Blackman, rectangular
 *   - THD computation (RSS of harmonics / fundamental)
 *   - IMD computation (intermodulation products at sum/difference frequencies)
 *   - Spectral peak detection with configurable threshold
 *   - Distortion classification (excellent/good/moderate/poor/unacceptable)
 *
 * Usage:
 *   const signal = generateSineWave(1000, 48000, 1024);
 *   const spectrum = computeFFT(signal, 'hann');
 *   const thd = computeTHD(spectrum, 1000, 48000);
 *   const classification = classifyTHD(thd.thdPercent);
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WindowFunction = 'rectangular' | 'hann' | 'hamming' | 'blackman';

/** A single frequency bin from the FFT magnitude spectrum. */
export interface SpectralBin {
  /** Frequency in Hz */
  frequency: number;
  /** Magnitude (linear scale) */
  magnitude: number;
  /** Phase in radians */
  phase: number;
}

/** Result of THD computation. */
export interface THDResult {
  /** THD as a fraction (0-1 range typically, can exceed 1 for extreme distortion) */
  thd: number;
  /** THD as a percentage */
  thdPercent: number;
  /** THD in dB: 20 * log10(thd) */
  thdDb: number;
  /** Fundamental frequency detected (Hz) */
  fundamentalFrequency: number;
  /** Fundamental magnitude */
  fundamentalMagnitude: number;
  /** Individual harmonic magnitudes (index 0 = 2nd harmonic, 1 = 3rd, etc.) */
  harmonicMagnitudes: number[];
  /** Number of harmonics included in the computation */
  harmonicCount: number;
}

/** Intermodulation product descriptor. */
export interface IntermodProduct {
  /** Frequency of the intermodulation product (Hz) */
  frequency: number;
  /** Magnitude at that frequency */
  magnitude: number;
  /** Order of the product (2 for f1+f2, 3 for 2f1+f2, etc.) */
  order: number;
  /** Description (e.g., "f1+f2", "2f1-f2") */
  label: string;
}

/** Result of IMD computation. */
export interface IMDResult {
  /** IMD as a fraction */
  imd: number;
  /** IMD as a percentage */
  imdPercent: number;
  /** IMD in dB */
  imdDb: number;
  /** First tone frequency (Hz) */
  f1: number;
  /** Second tone frequency (Hz) */
  f2: number;
  /** Detected intermodulation products */
  products: IntermodProduct[];
}

/** Detected spectral peak. */
export interface SpectralPeak {
  /** Bin index in the spectrum */
  binIndex: number;
  /** Frequency in Hz */
  frequency: number;
  /** Magnitude (linear) */
  magnitude: number;
  /** Phase in radians */
  phase: number;
}

/** THD quality classification. */
export type DistortionClass = 'excellent' | 'good' | 'moderate' | 'poor' | 'unacceptable';

// ---------------------------------------------------------------------------
// Window Functions
// ---------------------------------------------------------------------------

/**
 * Apply a window function to a time-domain signal.
 * Windowing reduces spectral leakage in the FFT.
 */
export function applyWindow(signal: Float64Array, windowType: WindowFunction): Float64Array {
  const N = signal.length;
  const windowed = new Float64Array(N);

  for (let n = 0; n < N; n++) {
    windowed[n] = signal[n] * windowCoefficient(n, N, windowType);
  }

  return windowed;
}

/** Compute a single window coefficient. */
export function windowCoefficient(n: number, N: number, windowType: WindowFunction): number {
  switch (windowType) {
    case 'rectangular':
      return 1.0;
    case 'hann':
      return 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
    case 'hamming':
      return 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1));
    case 'blackman':
      return (
        0.42 -
        0.5 * Math.cos((2 * Math.PI * n) / (N - 1)) +
        0.08 * Math.cos((4 * Math.PI * n) / (N - 1))
      );
  }
}

// ---------------------------------------------------------------------------
// FFT — Radix-2 Decimation-in-Time
// ---------------------------------------------------------------------------

/**
 * Check if a number is a power of 2.
 */
export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Pad or truncate a signal to the next power of 2.
 */
export function padToPowerOfTwo(signal: Float64Array): Float64Array {
  if (isPowerOfTwo(signal.length)) {
    return signal;
  }
  let size = 1;
  while (size < signal.length) {
    size *= 2;
  }
  const padded = new Float64Array(size);
  padded.set(signal);
  return padded;
}

/**
 * Compute the FFT of a real-valued signal using the radix-2 DIT algorithm.
 * The input length must be a power of 2.
 *
 * Returns arrays of real and imaginary parts of the frequency-domain representation.
 */
export function fftRadix2(
  real: Float64Array,
  imag: Float64Array,
): { real: Float64Array; imag: Float64Array } {
  const N = real.length;
  if (!isPowerOfTwo(N)) {
    throw new Error(`FFT input length must be a power of 2, got ${N}`);
  }
  if (imag.length !== N) {
    throw new Error('Real and imaginary arrays must have the same length');
  }

  // Copy to avoid mutating inputs
  const re = new Float64Array(real);
  const im = new Float64Array(imag);

  // Bit-reversal permutation
  const bits = Math.log2(N);
  for (let i = 0; i < N; i++) {
    const j = bitReverse(i, bits);
    if (j > i) {
      // Swap real
      const tmpRe = re[i];
      re[i] = re[j];
      re[j] = tmpRe;
      // Swap imaginary
      const tmpIm = im[i];
      im[i] = im[j];
      im[j] = tmpIm;
    }
  }

  // Butterfly stages
  for (let size = 2; size <= N; size *= 2) {
    const halfSize = size / 2;
    const angleStep = (-2 * Math.PI) / size;

    for (let i = 0; i < N; i += size) {
      for (let k = 0; k < halfSize; k++) {
        const angle = angleStep * k;
        const twiddleRe = Math.cos(angle);
        const twiddleIm = Math.sin(angle);

        const evenIdx = i + k;
        const oddIdx = i + k + halfSize;

        // Complex multiply: twiddle * odd
        const tRe = twiddleRe * re[oddIdx] - twiddleIm * im[oddIdx];
        const tIm = twiddleRe * im[oddIdx] + twiddleIm * re[oddIdx];

        // Butterfly
        re[oddIdx] = re[evenIdx] - tRe;
        im[oddIdx] = im[evenIdx] - tIm;
        re[evenIdx] = re[evenIdx] + tRe;
        im[evenIdx] = im[evenIdx] + tIm;
      }
    }
  }

  return { real: re, imag: im };
}

/** Reverse the bits of index `i` given `bits` total bits. */
function bitReverse(i: number, bits: number): number {
  let reversed = 0;
  let val = i;
  for (let b = 0; b < bits; b++) {
    reversed = (reversed << 1) | (val & 1);
    val >>= 1;
  }
  return reversed;
}

// ---------------------------------------------------------------------------
// Spectrum computation
// ---------------------------------------------------------------------------

/**
 * Compute the magnitude spectrum of a real signal.
 * Applies windowing, zero-pads to power of 2, runs FFT, and returns
 * the one-sided magnitude + phase spectrum as SpectralBin[].
 */
export function computeFFT(
  signal: Float64Array,
  windowType: WindowFunction = 'hann',
  sampleRate: number = 1,
): SpectralBin[] {
  const windowed = applyWindow(signal, windowType);
  const padded = padToPowerOfTwo(windowed);
  const N = padded.length;

  const imag = new Float64Array(N);
  const result = fftRadix2(padded, imag);

  // One-sided spectrum (DC to Nyquist)
  const numBins = Math.floor(N / 2) + 1;
  const bins: SpectralBin[] = [];
  const freqResolution = sampleRate / N;

  for (let i = 0; i < numBins; i++) {
    const re = result.real[i];
    const im = result.imag[i];
    let magnitude = Math.sqrt(re * re + im * im) / N;
    // Double for non-DC and non-Nyquist bins (energy split between positive/negative)
    if (i > 0 && i < N / 2) {
      magnitude *= 2;
    }
    const phase = Math.atan2(im, re);

    bins.push({
      frequency: i * freqResolution,
      magnitude,
      phase,
    });
  }

  return bins;
}

// ---------------------------------------------------------------------------
// Spectral peak detection
// ---------------------------------------------------------------------------

/**
 * Find peaks in a magnitude spectrum.
 * A peak is a bin whose magnitude exceeds its neighbors and is above
 * the threshold (fraction of the maximum magnitude).
 */
export function findSpectralPeaks(
  spectrum: SpectralBin[],
  threshold: number = 0.01,
): SpectralPeak[] {
  if (spectrum.length < 3) {
    return [];
  }

  const maxMag = Math.max(...spectrum.map((b) => b.magnitude));
  if (maxMag === 0) {
    return [];
  }

  const absThreshold = threshold * maxMag;
  const peaks: SpectralPeak[] = [];

  for (let i = 1; i < spectrum.length - 1; i++) {
    const mag = spectrum[i].magnitude;
    if (
      mag > spectrum[i - 1].magnitude &&
      mag > spectrum[i + 1].magnitude &&
      mag >= absThreshold
    ) {
      peaks.push({
        binIndex: i,
        frequency: spectrum[i].frequency,
        magnitude: mag,
        phase: spectrum[i].phase,
      });
    }
  }

  // Sort by magnitude descending
  peaks.sort((a, b) => b.magnitude - a.magnitude);

  return peaks;
}

// ---------------------------------------------------------------------------
// THD computation
// ---------------------------------------------------------------------------

/**
 * Find the FFT bin index closest to a target frequency.
 */
function findClosestBin(spectrum: SpectralBin[], targetFreq: number): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < spectrum.length; i++) {
    const dist = Math.abs(spectrum[i].frequency - targetFreq);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Get the magnitude at a frequency, searching nearby bins for the peak
 * to handle frequency resolution limitations.
 */
function getMagnitudeAtFrequency(
  spectrum: SpectralBin[],
  targetFreq: number,
  searchRadius: number = 2,
): number {
  const centerIdx = findClosestBin(spectrum, targetFreq);
  let maxMag = 0;
  const startIdx = Math.max(0, centerIdx - searchRadius);
  const endIdx = Math.min(spectrum.length - 1, centerIdx + searchRadius);
  for (let i = startIdx; i <= endIdx; i++) {
    if (spectrum[i].magnitude > maxMag) {
      maxMag = spectrum[i].magnitude;
    }
  }
  return maxMag;
}

/**
 * Compute Total Harmonic Distortion (THD) from a magnitude spectrum.
 *
 * THD = sqrt(V2^2 + V3^2 + ... + Vn^2) / V1
 *
 * where V1 is the fundamental and V2..Vn are the harmonic magnitudes.
 *
 * @param spectrum - One-sided magnitude spectrum from computeFFT()
 * @param fundamentalFreq - Expected fundamental frequency in Hz
 * @param sampleRate - Sample rate used to generate the spectrum
 * @param maxHarmonics - Maximum number of harmonics to consider (default: 10)
 */
export function computeTHD(
  spectrum: SpectralBin[],
  fundamentalFreq: number,
  sampleRate: number,
  maxHarmonics: number = 10,
): THDResult {
  const nyquist = sampleRate / 2;

  // Find fundamental magnitude
  const fundamentalMag = getMagnitudeAtFrequency(spectrum, fundamentalFreq);

  if (fundamentalMag === 0) {
    return {
      thd: 0,
      thdPercent: 0,
      thdDb: -Infinity,
      fundamentalFrequency: fundamentalFreq,
      fundamentalMagnitude: 0,
      harmonicMagnitudes: [],
      harmonicCount: 0,
    };
  }

  // Collect harmonic magnitudes (2nd, 3rd, ...)
  const harmonicMags: number[] = [];
  let sumSquared = 0;

  for (let h = 2; h <= maxHarmonics + 1; h++) {
    const harmonicFreq = fundamentalFreq * h;
    if (harmonicFreq > nyquist) {
      break;
    }
    const mag = getMagnitudeAtFrequency(spectrum, harmonicFreq);
    harmonicMags.push(mag);
    sumSquared += mag * mag;
  }

  const thd = Math.sqrt(sumSquared) / fundamentalMag;
  const thdPercent = thd * 100;
  const thdDb = thd > 0 ? 20 * Math.log10(thd) : -Infinity;

  return {
    thd,
    thdPercent,
    thdDb,
    fundamentalFrequency: fundamentalFreq,
    fundamentalMagnitude: fundamentalMag,
    harmonicMagnitudes: harmonicMags,
    harmonicCount: harmonicMags.length,
  };
}

// ---------------------------------------------------------------------------
// IMD computation
// ---------------------------------------------------------------------------

/**
 * Compute Intermodulation Distortion (IMD) from a two-tone test.
 *
 * Measures the intermod products at sum and difference frequencies
 * of the two input tones and their multiples:
 *   2nd order: f1+f2, f2-f1
 *   3rd order: 2f1-f2, 2f2-f1, 2f1+f2, 2f2+f1
 *
 * IMD = sqrt(sum of intermod product magnitudes^2) / sqrt(f1_mag^2 + f2_mag^2)
 *
 * @param spectrum - One-sided magnitude spectrum from computeFFT()
 * @param f1 - First tone frequency in Hz
 * @param f2 - Second tone frequency in Hz
 * @param sampleRate - Sample rate
 * @param maxOrder - Maximum intermodulation order to check (default: 3)
 */
export function computeIMD(
  spectrum: SpectralBin[],
  f1: number,
  f2: number,
  sampleRate: number,
  maxOrder: number = 3,
): IMDResult {
  const nyquist = sampleRate / 2;
  const f1Mag = getMagnitudeAtFrequency(spectrum, f1);
  const f2Mag = getMagnitudeAtFrequency(spectrum, f2);
  const refMag = Math.sqrt(f1Mag * f1Mag + f2Mag * f2Mag);

  if (refMag === 0) {
    return {
      imd: 0,
      imdPercent: 0,
      imdDb: -Infinity,
      f1,
      f2,
      products: [],
    };
  }

  // Generate intermodulation product frequencies
  const products: IntermodProduct[] = [];
  const checkedFreqs = new Set<number>();

  // Ensure f1 < f2 for consistent labeling
  const fLow = Math.min(f1, f2);
  const fHigh = Math.max(f1, f2);

  for (let m = 0; m <= maxOrder; m++) {
    for (let n = 0; n <= maxOrder; n++) {
      if (m + n < 2 || m + n > maxOrder) {
        continue;
      }
      // Skip fundamental tones themselves (m=1,n=0 and m=0,n=1)
      if ((m === 1 && n === 0) || (m === 0 && n === 1)) {
        continue;
      }

      const order = m + n;

      // Sum and difference combinations
      const combos: Array<{ freq: number; label: string }> = [];

      // m*f1 + n*f2
      const sumFreq = m * fLow + n * fHigh;
      if (sumFreq > 0 && sumFreq <= nyquist) {
        combos.push({ freq: sumFreq, label: `${m}f1+${n}f2` });
      }

      // m*f1 - n*f2
      const diff1 = Math.abs(m * fLow - n * fHigh);
      if (diff1 > 0 && diff1 <= nyquist) {
        combos.push({ freq: diff1, label: m * fLow > n * fHigh ? `${m}f1-${n}f2` : `${n}f2-${m}f1` });
      }

      // n*f1 + m*f2 (only if different from above, i.e., m !== n)
      if (m !== n) {
        const sumFreq2 = n * fLow + m * fHigh;
        if (sumFreq2 > 0 && sumFreq2 <= nyquist) {
          combos.push({ freq: sumFreq2, label: `${n}f1+${m}f2` });
        }

        const diff2 = Math.abs(n * fLow - m * fHigh);
        if (diff2 > 0 && diff2 <= nyquist) {
          combos.push({ freq: diff2, label: n * fLow > m * fHigh ? `${n}f1-${m}f2` : `${m}f2-${n}f1` });
        }
      }

      for (const combo of combos) {
        // Round to avoid floating-point key issues
        const roundedFreq = Math.round(combo.freq * 1000) / 1000;
        if (checkedFreqs.has(roundedFreq)) {
          continue;
        }
        checkedFreqs.add(roundedFreq);

        const mag = getMagnitudeAtFrequency(spectrum, combo.freq);
        if (mag > 0) {
          products.push({
            frequency: combo.freq,
            magnitude: mag,
            order,
            label: combo.label,
          });
        }
      }
    }
  }

  // Sort products by magnitude descending
  products.sort((a, b) => b.magnitude - a.magnitude);

  // Compute IMD
  let sumSquared = 0;
  for (const p of products) {
    sumSquared += p.magnitude * p.magnitude;
  }

  const imd = Math.sqrt(sumSquared) / refMag;
  const imdPercent = imd * 100;
  const imdDb = imd > 0 ? 20 * Math.log10(imd) : -Infinity;

  return {
    imd,
    imdPercent,
    imdDb,
    f1: fLow,
    f2: fHigh,
    products,
  };
}

// ---------------------------------------------------------------------------
// THD / IMD classification
// ---------------------------------------------------------------------------

/**
 * Classify THD quality level.
 *
 * - excellent: < 0.1% (hi-fi audio, precision instrumentation)
 * - good: 0.1% - 1% (general audio, decent amplifiers)
 * - moderate: 1% - 5% (acceptable for many applications)
 * - poor: 5% - 10% (noticeable distortion)
 * - unacceptable: > 10% (severe distortion)
 */
export function classifyTHD(thdPercent: number): DistortionClass {
  if (thdPercent < 0.1) {
    return 'excellent';
  }
  if (thdPercent < 1) {
    return 'good';
  }
  if (thdPercent < 5) {
    return 'moderate';
  }
  if (thdPercent < 10) {
    return 'poor';
  }
  return 'unacceptable';
}

/**
 * Classify IMD quality level (same thresholds as THD).
 */
export function classifyIMD(imdPercent: number): DistortionClass {
  if (imdPercent < 0.1) {
    return 'excellent';
  }
  if (imdPercent < 1) {
    return 'good';
  }
  if (imdPercent < 5) {
    return 'moderate';
  }
  if (imdPercent < 10) {
    return 'poor';
  }
  return 'unacceptable';
}

// ---------------------------------------------------------------------------
// Test signal generators (useful for validation)
// ---------------------------------------------------------------------------

/**
 * Generate a pure sine wave signal.
 */
export function generateSineWave(
  frequency: number,
  sampleRate: number,
  numSamples: number,
  amplitude: number = 1.0,
  phase: number = 0,
): Float64Array {
  const signal = new Float64Array(numSamples);
  for (let n = 0; n < numSamples; n++) {
    signal[n] = amplitude * Math.sin(2 * Math.PI * frequency * n / sampleRate + phase);
  }
  return signal;
}

/**
 * Generate a two-tone test signal (sum of two sine waves).
 */
export function generateTwoTone(
  f1: number,
  f2: number,
  sampleRate: number,
  numSamples: number,
  amplitude: number = 1.0,
): Float64Array {
  const signal = new Float64Array(numSamples);
  for (let n = 0; n < numSamples; n++) {
    signal[n] =
      amplitude * Math.sin(2 * Math.PI * f1 * n / sampleRate) +
      amplitude * Math.sin(2 * Math.PI * f2 * n / sampleRate);
  }
  return signal;
}

/**
 * Add harmonic distortion to a signal by mixing in harmonics.
 * `harmonicLevels` maps harmonic number (2, 3, ...) to amplitude fraction
 * relative to the fundamental.
 */
export function addHarmonicDistortion(
  signal: Float64Array,
  fundamentalFreq: number,
  sampleRate: number,
  harmonicLevels: Map<number, number>,
): Float64Array {
  const result = new Float64Array(signal);
  const amplitude = Math.max(...Array.from(signal).map(Math.abs));

  harmonicLevels.forEach((level, harmonic) => {
    for (let n = 0; n < result.length; n++) {
      result[n] += amplitude * level * Math.sin(2 * Math.PI * fundamentalFreq * harmonic * n / sampleRate);
    }
  });

  return result;
}
