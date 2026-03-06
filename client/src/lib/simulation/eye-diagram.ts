/**
 * Eye Diagram Generator — Statistical eye diagram construction and measurement
 *
 * Generates NRZ waveforms with channel impairments (ISI, jitter, loss) and
 * folds them into a 2-UI (unit interval) eye diagram for visual signal
 * integrity analysis. Provides quantitative eye measurements (height, width,
 * opening, jitter) and bathtub BER curves.
 *
 * Workflow:
 *   1. Generate a pseudorandom bit sequence (PRBS-7)
 *   2. Create an ideal NRZ waveform with finite rise time
 *   3. Convolve with a channel impulse response (from transmission line model)
 *   4. Add random and deterministic jitter
 *   5. Fold the waveform into a 2-UI eye diagram
 *   6. Measure eye height, width, and opening percentage
 *
 * References:
 *   - Maxim Integrated, "Jitter in Digital Communication Systems"
 *   - SiSoft, "Eye Diagram Fundamentals"
 *
 * Usage:
 *   import { generatePRBS7, generateNRZWaveform, buildEyeDiagram, measureEye } from './eye-diagram';
 */

import { microstripZ0, skinEffectLoss, dielectricLoss } from './transmission-line';
import type { TransmissionLineParams } from './transmission-line';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EyeDiagramConfig {
  dataRate: number; // bits/second
  signalAmplitude: number; // volts (peak)
  riseTime: number; // seconds (10-90%)
  channelParams: TransmissionLineParams;
  rjRms?: number; // random jitter RMS (seconds)
  djPp?: number; // deterministic jitter peak-to-peak (seconds)
  numBits?: number; // default 1024
}

export interface EyeDiagram {
  traces: Array<{ time: number[]; voltage: number[] }>; // overlaid bit periods
  measurements: EyeMeasurement;
}

export interface EyeMeasurement {
  eyeHeight: number; // volts
  eyeWidth: number; // seconds
  openingPercent: number; // 0-100
  jitterRms: number; // seconds
  jitterPp: number; // seconds
  riseTime: number; // seconds (measured)
  fallTime: number; // seconds (measured)
}

export interface BathtubPoint {
  timingOffset: number; // seconds from center
  ber: number; // bit error rate
}

// ---------------------------------------------------------------------------
// Seeded PRNG (deterministic for reproducibility)
// ---------------------------------------------------------------------------

/**
 * Simple xorshift32 PRNG for deterministic random numbers.
 */
function xorshift32(state: { s: number }): number {
  let x = state.s;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  state.s = x >>> 0;
  return (state.s) / 0xFFFFFFFF;
}

// ---------------------------------------------------------------------------
// PRBS-7 generator
// ---------------------------------------------------------------------------

/**
 * Generate a PRBS-7 (2^7 - 1 = 127) pseudorandom bit sequence.
 *
 * Uses a 7-bit linear feedback shift register with taps at positions 7 and 6
 * (polynomial: x^7 + x^6 + 1).
 *
 * @param length - Number of bits to generate
 * @returns Array of 0s and 1s
 */
export function generatePRBS7(length: number): number[] {
  if (length <= 0) {
    return [];
  }

  const bits: number[] = [];
  let lfsr = 0x7F; // initial seed: all ones (7-bit)

  for (let i = 0; i < length; i++) {
    // Output the MSB (bit 6, 0-indexed)
    bits.push((lfsr >> 6) & 1);

    // Polynomial x^7 + x + 1: feedback = XOR of bit 6 and bit 0 (0-indexed)
    const feedback = ((lfsr >> 6) ^ lfsr) & 1;
    lfsr = ((lfsr << 1) | feedback) & 0x7F;
  }

  return bits;
}

// ---------------------------------------------------------------------------
// NRZ waveform generation
// ---------------------------------------------------------------------------

/**
 * Generate an ideal NRZ (Non-Return-to-Zero) waveform from a bit sequence.
 *
 * Each bit maps to +amplitude (1) or -amplitude (0) with finite rise/fall
 * transitions modeled as error-function (erf) shaped edges.
 *
 * @param bits - Array of 0s and 1s
 * @param bitPeriod - Duration of one bit in seconds
 * @param amplitude - Peak signal amplitude in volts
 * @param riseTime - 10-90% rise time in seconds
 * @param samplesPerBit - Number of samples per bit period
 * @returns Waveform as array of voltage samples
 */
export function generateNRZWaveform(
  bits: number[],
  bitPeriod: number,
  amplitude: number,
  riseTime: number,
  samplesPerBit: number,
): number[] {
  const totalSamples = bits.length * samplesPerBit;
  const waveform = new Array<number>(totalSamples);
  const dt = bitPeriod / samplesPerBit;

  // Time constant for the transition (erf approximation)
  // Rise time (10-90%) relates to the Gaussian sigma: tRise = 2.2 * sigma
  const sigma = riseTime / 2.2;

  // Build ideal target levels per sample
  const targets = new Array<number>(totalSamples);
  for (let b = 0; b < bits.length; b++) {
    const level = bits[b] === 1 ? amplitude : -amplitude;
    for (let s = 0; s < samplesPerBit; s++) {
      targets[b * samplesPerBit + s] = level;
    }
  }

  // Apply transition filtering using a first-order RC-like filter
  // tau = sigma / 1.1 gives approximately correct 10-90% rise time
  const tau = sigma / 1.1;
  const alpha = dt / (tau + dt);

  waveform[0] = targets[0];
  for (let i = 1; i < totalSamples; i++) {
    waveform[i] = waveform[i - 1] + alpha * (targets[i] - waveform[i - 1]);
  }

  return waveform;
}

// ---------------------------------------------------------------------------
// Channel impulse response
// ---------------------------------------------------------------------------

/**
 * Generate a simplified channel impulse response from transmission line parameters.
 *
 * Models the channel as a dispersive lossy line. The impulse response is
 * approximated as a Gaussian pulse centered at the propagation delay, with
 * width determined by frequency-dependent losses.
 *
 * @param params - Transmission line geometry and material
 * @param numTaps - Number of taps in the impulse response
 * @returns Impulse response array (normalized to sum ≈ 1 for low-loss channels)
 */
export function channelImpulseResponse(
  params: TransmissionLineParams,
  numTaps: number,
): number[] {
  const ir = new Array<number>(numTaps).fill(0);

  const { delay: delayPsPerMm } = microstripZ0(params);

  // Total propagation delay in tap units
  // We normalize so the impulse response spans numTaps
  const totalDelayPs = delayPsPerMm * params.length;

  // Center the main pulse at about 1/4 of the way through the IR
  const centerTap = Math.min(Math.floor(numTaps / 4), numTaps - 1);

  // Loss at a reference frequency (1 GHz) determines pulse broadening
  const { erEff } = microstripZ0(params);
  const refFreq = 1e9;
  const cLoss = skinEffectLoss(refFreq, params.width, params.thickness, params.length);
  const dLoss = dielectricLoss(refFreq, erEff, params.tanD, params.length);
  const totalLossDb = cLoss + dLoss;

  // Pulse amplitude from loss: A = 10^(-loss/20)
  const amplitude = Math.pow(10, -totalLossDb / 20);

  // Pulse width (sigma in taps) increases with loss
  // Higher loss -> more dispersion -> wider pulse
  const baseSigma = 1.0; // minimum sigma
  const lossSigma = totalLossDb * 0.3; // empirical scaling
  const sigma = baseSigma + lossSigma;

  // Generate Gaussian pulse
  let sum = 0;
  for (let i = 0; i < numTaps; i++) {
    const x = (i - centerTap) / sigma;
    ir[i] = amplitude * Math.exp(-0.5 * x * x);
    sum += ir[i];
  }

  // Normalize so sum = amplitude (energy conservation minus loss)
  if (sum > 0) {
    const scale = amplitude / sum;
    for (let i = 0; i < numTaps; i++) {
      ir[i] *= scale;
    }
  }

  return ir;
}

// ---------------------------------------------------------------------------
// Convolution
// ---------------------------------------------------------------------------

/**
 * Convolve a waveform with an impulse response (channel filter).
 *
 * Applies inter-symbol interference (ISI) by convolving the ideal waveform
 * with the channel impulse response. Output is truncated to the input length.
 *
 * @param waveform - Input signal samples
 * @param impulse - Channel impulse response
 * @returns Filtered waveform (same length as input)
 */
export function convolveChannel(
  waveform: number[],
  impulse: number[],
): number[] {
  const n = waveform.length;
  const m = impulse.length;
  const result = new Array<number>(n).fill(0);

  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < m; j++) {
      const idx = i - j;
      if (idx >= 0 && idx < n) {
        sum += waveform[idx] * impulse[j];
      }
    }
    result[i] = sum;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Jitter injection
// ---------------------------------------------------------------------------

/**
 * Add random and deterministic jitter to a waveform by perturbing sample timing.
 *
 * Random jitter (RJ) is modeled as Gaussian timing noise.
 * Deterministic jitter (DJ) is modeled as sinusoidal timing modulation.
 *
 * @param waveform - Input signal samples
 * @param bitPeriod - Bit period in seconds
 * @param samplesPerBit - Samples per bit
 * @param rjRms - Random jitter RMS in seconds (0 = none)
 * @param djPp - Deterministic jitter peak-to-peak in seconds (0 = none)
 * @returns Jittered waveform (same length)
 */
export function addJitter(
  waveform: number[],
  bitPeriod: number,
  samplesPerBit: number,
  rjRms: number,
  djPp: number,
): number[] {
  if (rjRms === 0 && djPp === 0) {
    return [...waveform];
  }

  const n = waveform.length;
  const result = new Array<number>(n);
  const dt = bitPeriod / samplesPerBit;

  // Deterministic jitter frequency: one period per 10 bits
  const djFreq = 1 / (10 * bitPeriod);

  // Seeded PRNG for random jitter
  const prng = { s: 42 };

  for (let i = 0; i < n; i++) {
    const t = i * dt;

    // Random jitter: Box-Muller transform for Gaussian
    let rjOffset = 0;
    if (rjRms > 0) {
      const u1 = Math.max(1e-10, xorshift32(prng));
      const u2 = xorshift32(prng);
      rjOffset = rjRms * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }

    // Deterministic jitter: sinusoidal
    let djOffset = 0;
    if (djPp > 0) {
      djOffset = (djPp / 2) * Math.sin(2 * Math.PI * djFreq * t);
    }

    // Total timing offset in samples
    const totalOffset = (rjOffset + djOffset) / dt;

    // Interpolate: shift the read position
    const srcIdx = i - totalOffset;
    const srcIdxFloor = Math.floor(srcIdx);
    const frac = srcIdx - srcIdxFloor;

    if (srcIdxFloor >= 0 && srcIdxFloor < n - 1) {
      result[i] = waveform[srcIdxFloor] * (1 - frac) + waveform[srcIdxFloor + 1] * frac;
    } else if (srcIdxFloor >= 0 && srcIdxFloor < n) {
      result[i] = waveform[srcIdxFloor];
    } else {
      result[i] = waveform[Math.max(0, Math.min(n - 1, Math.round(srcIdx)))];
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Eye diagram construction
// ---------------------------------------------------------------------------

/**
 * Build an eye diagram by folding a waveform into 2-UI (unit interval) windows.
 *
 * Takes the sequential waveform and overlays segments of 2 bit-periods,
 * creating the characteristic "eye" pattern. The measurement is computed
 * from the overlaid traces.
 *
 * @param waveform - Signal waveform samples
 * @param bitPeriod - Bit period in seconds (1/data_rate)
 * @param samplesPerBit - Number of samples per bit period
 * @returns Eye diagram with traces and basic measurements
 */
export function buildEyeDiagram(
  waveform: number[],
  bitPeriod: number,
  samplesPerBit: number,
): EyeDiagram {
  const windowSize = 2 * samplesPerBit; // 2 UI
  const traces: Array<{ time: number[]; voltage: number[] }> = [];

  // Fold waveform into 2-UI segments, stepping by 1 bit at a time
  const numTraces = Math.floor((waveform.length - windowSize) / samplesPerBit);

  for (let i = 0; i < numTraces; i++) {
    const startIdx = i * samplesPerBit;
    const time: number[] = [];
    const voltage: number[] = [];

    for (let j = 0; j < windowSize; j++) {
      time.push((j / samplesPerBit) * bitPeriod);
      voltage.push(waveform[startIdx + j]);
    }

    traces.push({ time, voltage });
  }

  // Compute measurements
  const measurements = measureEye({ traces, measurements: {} as EyeMeasurement });

  return { traces, measurements };
}

// ---------------------------------------------------------------------------
// Eye measurements
// ---------------------------------------------------------------------------

/**
 * Measure eye diagram parameters from overlaid traces.
 *
 * Extracts:
 *   - Eye height: vertical opening at the center of the eye
 *   - Eye width: horizontal opening at the decision threshold (0V)
 *   - Opening percentage: eyeHeight / (max - min) * 100
 *   - Jitter RMS and peak-to-peak from crossing time variations
 *   - Rise and fall times from edge transitions
 *
 * @param diagram - Eye diagram with traces
 * @returns Eye measurements
 */
export function measureEye(diagram: EyeDiagram): EyeMeasurement {
  const { traces } = diagram;

  if (traces.length === 0 || traces[0].voltage.length === 0) {
    return {
      eyeHeight: 0,
      eyeWidth: 0,
      openingPercent: 0,
      jitterRms: 0,
      jitterPp: 0,
      riseTime: 0,
      fallTime: 0,
    };
  }

  const samplesPerTrace = traces[0].voltage.length;
  const halfSamples = Math.floor(samplesPerTrace / 2);

  // For each time slot, collect all voltages across traces
  // Focus on the center of the eye (around the middle of the 2-UI window)
  const centerSlot = Math.floor(samplesPerTrace / 2); // center of 2-UI window

  // Collect voltages at the center column (decision point)
  const centerVoltages: number[] = [];
  for (const trace of traces) {
    if (centerSlot < trace.voltage.length) {
      centerVoltages.push(trace.voltage[centerSlot]);
    }
  }

  if (centerVoltages.length === 0) {
    return {
      eyeHeight: 0,
      eyeWidth: 0,
      openingPercent: 0,
      jitterRms: 0,
      jitterPp: 0,
      riseTime: 0,
      fallTime: 0,
    };
  }

  // Separate into "high" and "low" populations using threshold at mean
  const mean = centerVoltages.reduce((a, b) => a + b, 0) / centerVoltages.length;
  const highVoltages = centerVoltages.filter((v) => v > mean);
  const lowVoltages = centerVoltages.filter((v) => v <= mean);

  // Eye height: gap between lowest "high" and highest "low"
  let eyeHeight = 0;
  if (highVoltages.length > 0 && lowVoltages.length > 0) {
    const minHigh = Math.min(...highVoltages);
    const maxLow = Math.max(...lowVoltages);
    eyeHeight = Math.max(0, minHigh - maxLow);
  }

  // Overall amplitude
  const allMin = Math.min(...centerVoltages);
  const allMax = Math.max(...centerVoltages);
  const totalAmplitude = allMax - allMin;

  // Opening percentage
  const openingPercent = totalAmplitude > 0 ? (eyeHeight / totalAmplitude) * 100 : 0;

  // Eye width: find the time span where the eye is open
  // Scan each column for overlap between high and low distributions
  let openStart = -1;
  let openEnd = -1;

  for (let col = 0; col < samplesPerTrace; col++) {
    const colVoltages: number[] = [];
    for (const trace of traces) {
      if (col < trace.voltage.length) {
        colVoltages.push(trace.voltage[col]);
      }
    }

    if (colVoltages.length === 0) {
      continue;
    }

    const colHigh = colVoltages.filter((v) => v > mean);
    const colLow = colVoltages.filter((v) => v <= mean);

    if (colHigh.length > 0 && colLow.length > 0) {
      const colMinHigh = Math.min(...colHigh);
      const colMaxLow = Math.max(...colLow);
      if (colMinHigh > colMaxLow) {
        // Eye is open at this column
        if (openStart === -1) {
          openStart = col;
        }
        openEnd = col;
      }
    }
  }

  let eyeWidth = 0;
  if (openStart >= 0 && openEnd > openStart && traces[0].time.length > 0) {
    const dt = traces[0].time.length > 1
      ? traces[0].time[1] - traces[0].time[0]
      : 0;
    eyeWidth = (openEnd - openStart) * dt;
  }

  // Jitter: measure zero-crossing time variations
  const crossingTimes: number[] = [];
  for (const trace of traces) {
    for (let k = 1; k < trace.voltage.length; k++) {
      const v0 = trace.voltage[k - 1];
      const v1 = trace.voltage[k];
      // Detect zero crossing
      if ((v0 < 0 && v1 >= 0) || (v0 >= 0 && v1 < 0)) {
        // Linear interpolation for crossing time
        const frac = Math.abs(v0) / (Math.abs(v0) + Math.abs(v1));
        const crossTime = trace.time[k - 1] + frac * (trace.time[k] - trace.time[k - 1]);
        crossingTimes.push(crossTime);
      }
    }
  }

  let jitterRms = 0;
  let jitterPp = 0;

  if (crossingTimes.length > 1) {
    // Group crossings by their approximate position within the 2-UI window
    // and compute jitter statistics
    const crossMean = crossingTimes.reduce((a, b) => a + b, 0) / crossingTimes.length;
    const variance = crossingTimes.reduce((sum, t) => sum + (t - crossMean) ** 2, 0) / crossingTimes.length;
    jitterRms = Math.sqrt(variance);
    jitterPp = Math.max(...crossingTimes) - Math.min(...crossingTimes);
  }

  // Rise/fall time: measure from the first trace with a rising edge
  let riseTime = 0;
  let fallTime = 0;

  for (const trace of traces) {
    const vMin = Math.min(...trace.voltage);
    const vMax = Math.max(...trace.voltage);
    const range = vMax - vMin;
    if (range < 1e-10) {
      continue;
    }

    const v10 = vMin + 0.1 * range;
    const v90 = vMin + 0.9 * range;

    // Find rising edge (10% to 90%)
    for (let k = 1; k < trace.voltage.length; k++) {
      if (trace.voltage[k - 1] < v10 && trace.voltage[k] >= v90) {
        const dt = trace.time[k] - trace.time[k - 1];
        if (riseTime === 0 || dt < riseTime) {
          riseTime = dt;
        }
      }
    }

    // Find falling edge (90% to 10%)
    for (let k = 1; k < trace.voltage.length; k++) {
      if (trace.voltage[k - 1] > v90 && trace.voltage[k] <= v10) {
        const dt = trace.time[k] - trace.time[k - 1];
        if (fallTime === 0 || dt < fallTime) {
          fallTime = dt;
        }
      }
    }
  }

  return {
    eyeHeight,
    eyeWidth,
    openingPercent,
    jitterRms,
    jitterPp,
    riseTime,
    fallTime,
  };
}

// ---------------------------------------------------------------------------
// Bathtub curve (BER vs. sampling point)
// ---------------------------------------------------------------------------

/**
 * Generate a bathtub curve showing BER vs. sampling timing offset.
 *
 * The bathtub curve represents the bit error rate as a function of where
 * in the unit interval the signal is sampled. It has a characteristic
 * "bathtub" shape — high BER at the edges (near transitions) and low BER
 * at the center (optimal sampling point).
 *
 * Uses a Gaussian BER model:
 *   BER(t) ~ 0.5 * erfc(Q(t) / sqrt(2))
 *   where Q(t) is the eye opening at time offset t
 *
 * @param diagram - Eye diagram with traces
 * @param targetBer - Target BER for reference (e.g., 1e-12)
 * @returns Array of bathtub points
 */
export function bathtubCurve(
  diagram: EyeDiagram,
  targetBer: number,
): BathtubPoint[] {
  const { traces } = diagram;

  if (traces.length === 0 || traces[0].voltage.length === 0) {
    return [];
  }

  const samplesPerTrace = traces[0].voltage.length;
  const points: BathtubPoint[] = [];

  // Compute mean voltage for threshold
  let globalSum = 0;
  let globalCount = 0;
  for (const trace of traces) {
    for (const v of trace.voltage) {
      globalSum += v;
      globalCount++;
    }
  }
  const threshold = globalCount > 0 ? globalSum / globalCount : 0;

  // For each time column, compute the eye opening and estimate BER
  const dt = traces[0].time.length > 1 ? traces[0].time[1] - traces[0].time[0] : 0;
  const centerTime = traces[0].time.length > 0
    ? (traces[0].time[0] + traces[0].time[traces[0].time.length - 1]) / 2
    : 0;

  for (let col = 0; col < samplesPerTrace; col++) {
    const colVoltages: number[] = [];
    for (const trace of traces) {
      if (col < trace.voltage.length) {
        colVoltages.push(trace.voltage[col]);
      }
    }

    if (colVoltages.length === 0) {
      continue;
    }

    // Separate high/low
    const high = colVoltages.filter((v) => v > threshold);
    const low = colVoltages.filter((v) => v <= threshold);

    let ber: number;

    if (high.length === 0 || low.length === 0) {
      // Only one level visible — can't determine BER properly
      ber = 0.5;
    } else {
      // Q factor from eye opening and noise
      const meanHigh = high.reduce((a, b) => a + b, 0) / high.length;
      const meanLow = low.reduce((a, b) => a + b, 0) / low.length;

      const varHigh = high.reduce((s, v) => s + (v - meanHigh) ** 2, 0) / high.length;
      const varLow = low.reduce((s, v) => s + (v - meanLow) ** 2, 0) / low.length;

      const sigmaHigh = Math.sqrt(varHigh);
      const sigmaLow = Math.sqrt(varLow);
      const sigmaCombined = sigmaHigh + sigmaLow;

      if (sigmaCombined > 0) {
        const q = (meanHigh - meanLow) / sigmaCombined;
        // BER ~ 0.5 * erfc(Q/sqrt(2)) ≈ exp(-Q^2/2) / (Q * sqrt(2*pi))
        if (q > 0) {
          ber = 0.5 * erfc(q / Math.SQRT2);
        } else {
          ber = 0.5;
        }
      } else {
        // Zero noise — either perfect or meaningless
        if (meanHigh > meanLow) {
          ber = 1e-20; // effectively zero
        } else {
          ber = 0.5;
        }
      }
    }

    const timingOffset = col * dt - (centerTime - traces[0].time[0]);
    points.push({ timingOffset, ber: Math.max(ber, 1e-20) });
  }

  return points;
}

// ---------------------------------------------------------------------------
// Complementary error function (erfc) approximation
// ---------------------------------------------------------------------------

/**
 * Approximate the complementary error function erfc(x).
 *
 * Uses Abramowitz & Stegun approximation 7.1.26 (max error: 1.5e-7).
 */
function erfc(x: number): number {
  if (x < 0) {
    return 2 - erfc(-x);
  }

  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;

  const t = 1 / (1 + p * x);
  const poly = t * (a1 + t * (a2 + t * (a3 + t * (a4 + t * a5))));
  return poly * Math.exp(-x * x);
}
