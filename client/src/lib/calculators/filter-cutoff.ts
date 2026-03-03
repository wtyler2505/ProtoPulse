/**
 * Filter Cutoff Frequency Calculator
 *
 * Supports:
 * - Low-pass RC filter:  fc = 1 / (2*pi*R*C)
 * - High-pass RC filter: fc = 1 / (2*pi*R*C)  (same formula, different topology)
 * - Bandpass filter:     fc = 1 / (2*pi*sqrt(L*C)), BW = R/L
 *
 * Also provides:
 * - -3dB gain point
 * - Gain at a specific frequency
 * - Phase at a specific frequency
 */

import { formatEngineering } from './types';
import type { CalculatorResult, CalculatorError, FilterType } from './types';

export interface RcFilterInput {
  filterType: 'low-pass' | 'high-pass';
  resistance: number;
  capacitance: number;
}

export interface BandpassFilterInput {
  resistance: number;
  inductance: number;
  capacitance: number;
}

export interface RcFilterResult {
  cutoffFrequency: CalculatorResult;
  /** Angular cutoff frequency in rad/s. */
  omegaCutoff: CalculatorResult;
  /** Time constant tau = R*C. */
  timeConstant: CalculatorResult;
}

export interface BandpassFilterResult {
  /** Center frequency. */
  centerFrequency: CalculatorResult;
  /** Bandwidth = R / (2*pi*L). */
  bandwidth: CalculatorResult;
  /** Lower -3dB frequency. */
  lowerCutoff: CalculatorResult;
  /** Upper -3dB frequency. */
  upperCutoff: CalculatorResult;
  /** Quality factor Q = (1/R) * sqrt(L/C). */
  qualityFactor: number;
}

export interface GainAtFrequencyInput {
  filterType: FilterType;
  /** Frequency to evaluate in Hz. */
  frequency: number;
  /** Cutoff frequency in Hz. */
  cutoffFrequency: number;
}

export interface GainAtFrequencyResult {
  /** Magnitude gain (0 to 1 for passive). */
  magnitude: number;
  /** Gain in decibels. */
  gainDb: number;
  /** Phase shift in degrees. */
  phaseDegrees: number;
}

function validateRcFilter(input: RcFilterInput): CalculatorError[] {
  const errors: CalculatorError[] = [];
  if (input.resistance <= 0) {
    errors.push({ field: 'resistance', message: 'Resistance must be positive' });
  }
  if (input.capacitance <= 0) {
    errors.push({ field: 'capacitance', message: 'Capacitance must be positive' });
  }
  return errors;
}

function validateBandpass(input: BandpassFilterInput): CalculatorError[] {
  const errors: CalculatorError[] = [];
  if (input.resistance <= 0) {
    errors.push({ field: 'resistance', message: 'Resistance must be positive' });
  }
  if (input.inductance <= 0) {
    errors.push({ field: 'inductance', message: 'Inductance must be positive' });
  }
  if (input.capacitance <= 0) {
    errors.push({ field: 'capacitance', message: 'Capacitance must be positive' });
  }
  return errors;
}

/**
 * Solve RC low-pass or high-pass filter cutoff frequency.
 */
export function solveRcFilter(
  input: RcFilterInput,
): { result: RcFilterResult } | { errors: CalculatorError[] } {
  const errors = validateRcFilter(input);
  if (errors.length > 0) {
    return { errors };
  }

  const { resistance, capacitance } = input;
  const tau = resistance * capacitance;
  const omegaCutoff = 1 / tau;
  const cutoffFrequency = omegaCutoff / (2 * Math.PI);

  return {
    result: {
      cutoffFrequency: {
        value: cutoffFrequency,
        unit: 'Hz',
        formatted: formatEngineering(cutoffFrequency, 'Hz'),
      },
      omegaCutoff: {
        value: omegaCutoff,
        unit: 'rad/s',
        formatted: formatEngineering(omegaCutoff, 'rad/s'),
      },
      timeConstant: {
        value: tau,
        unit: 's',
        formatted: formatEngineering(tau, 's'),
      },
    },
  };
}

/**
 * Solve RLC bandpass filter parameters.
 */
export function solveBandpassFilter(
  input: BandpassFilterInput,
): { result: BandpassFilterResult } | { errors: CalculatorError[] } {
  const errors = validateBandpass(input);
  if (errors.length > 0) {
    return { errors };
  }

  const { resistance, inductance, capacitance } = input;

  // Center frequency: f0 = 1 / (2*pi*sqrt(L*C))
  const omega0 = 1 / Math.sqrt(inductance * capacitance);
  const centerFrequency = omega0 / (2 * Math.PI);

  // Bandwidth: BW = R / (2*pi*L)
  const bandwidth = resistance / (2 * Math.PI * inductance);

  // Quality factor: Q = f0 / BW = (1/R) * sqrt(L/C)
  const qualityFactor = (1 / resistance) * Math.sqrt(inductance / capacitance);

  // -3dB points: fL and fH
  const lowerCutoff = centerFrequency - bandwidth / 2;
  const upperCutoff = centerFrequency + bandwidth / 2;

  return {
    result: {
      centerFrequency: {
        value: centerFrequency,
        unit: 'Hz',
        formatted: formatEngineering(centerFrequency, 'Hz'),
      },
      bandwidth: {
        value: bandwidth,
        unit: 'Hz',
        formatted: formatEngineering(bandwidth, 'Hz'),
      },
      lowerCutoff: {
        value: lowerCutoff,
        unit: 'Hz',
        formatted: formatEngineering(lowerCutoff, 'Hz'),
      },
      upperCutoff: {
        value: upperCutoff,
        unit: 'Hz',
        formatted: formatEngineering(upperCutoff, 'Hz'),
      },
      qualityFactor,
    },
  };
}

/**
 * Calculate gain magnitude and phase at a specific frequency for a first-order filter.
 */
export function calculateGainAtFrequency(input: GainAtFrequencyInput): GainAtFrequencyResult {
  const { filterType, frequency, cutoffFrequency } = input;
  const ratio = frequency / cutoffFrequency;

  let magnitude: number;
  let phaseDegrees: number;

  if (filterType === 'low-pass') {
    // H(jw) = 1 / (1 + jw/wc)
    magnitude = 1 / Math.sqrt(1 + ratio * ratio);
    phaseDegrees = -Math.atan(ratio) * (180 / Math.PI);
  } else if (filterType === 'high-pass') {
    // H(jw) = (jw/wc) / (1 + jw/wc)
    magnitude = ratio / Math.sqrt(1 + ratio * ratio);
    phaseDegrees = 90 - Math.atan(ratio) * (180 / Math.PI);
  } else {
    // Bandpass: approximate as Q * ratio / sqrt(1 + Q^2*(ratio - 1/ratio)^2)
    // For simplicity with first-order, treat as the product of HP and LP
    magnitude = ratio / (1 + ratio * ratio);
    // Normalize so peak = 1
    magnitude *= 2; // Peak of ratio/(1+ratio^2) is at ratio=1, value=0.5, so *2
    phaseDegrees = 90 - 2 * Math.atan(ratio) * (180 / Math.PI);
  }

  const gainDb = 20 * Math.log10(Math.max(magnitude, 1e-20));

  return { magnitude, gainDb, phaseDegrees };
}
