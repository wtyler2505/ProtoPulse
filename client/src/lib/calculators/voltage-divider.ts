/**
 * Voltage Divider Calculator
 *
 * Forward:  Vout = Vin * R2 / (R1 + R2)
 * Reverse:  Given target Vout and Vin, suggest R1/R2 pairs from E24 series.
 */

import { findNearestStandard, formatEngineering, E24_VALUES, E96_VALUES } from './types';
import type { CalculatorResult, CalculatorError } from './types';

export interface VoltageDividerInput {
  r1: number;
  r2: number;
  vin: number;
}

export interface VoltageDividerResult {
  vout: CalculatorResult;
  ratio: number;
  current: CalculatorResult;
  powerR1: CalculatorResult;
  powerR2: CalculatorResult;
  totalPower: CalculatorResult;
}

export interface VoltageDividerReverseInput {
  vin: number;
  targetVout: number;
}

export interface ResistorPairSuggestion {
  r1: number;
  r2: number;
  r1Formatted: string;
  r2Formatted: string;
  actualVout: number;
  errorPercent: number;
}

function validateForward(input: VoltageDividerInput): CalculatorError[] {
  const errors: CalculatorError[] = [];
  if (input.r1 < 0) {
    errors.push({ field: 'r1', message: 'R1 must be non-negative' });
  }
  if (input.r2 < 0) {
    errors.push({ field: 'r2', message: 'R2 must be non-negative' });
  }
  if (input.r1 === 0 && input.r2 === 0) {
    errors.push({ field: 'r1', message: 'R1 and R2 cannot both be zero' });
  }
  if (input.vin < 0) {
    errors.push({ field: 'vin', message: 'Input voltage must be non-negative' });
  }
  return errors;
}

function validateReverse(input: VoltageDividerReverseInput): CalculatorError[] {
  const errors: CalculatorError[] = [];
  if (input.vin <= 0) {
    errors.push({ field: 'vin', message: 'Input voltage must be positive' });
  }
  if (input.targetVout < 0) {
    errors.push({ field: 'targetVout', message: 'Target Vout must be non-negative' });
  }
  if (input.targetVout >= input.vin) {
    errors.push({ field: 'targetVout', message: 'Target Vout must be less than Vin' });
  }
  return errors;
}

/**
 * Calculate Vout for a voltage divider.
 */
export function solveVoltageDivider(
  input: VoltageDividerInput,
): { result: VoltageDividerResult } | { errors: CalculatorError[] } {
  const errors = validateForward(input);
  if (errors.length > 0) {
    return { errors };
  }

  const { r1, r2, vin } = input;
  const totalR = r1 + r2;
  const vout = totalR === 0 ? 0 : vin * r2 / totalR;
  const ratio = totalR === 0 ? 0 : r2 / totalR;
  const current = totalR === 0 ? 0 : vin / totalR;
  const powerR1 = current * current * r1;
  const powerR2 = current * current * r2;
  const totalPower = powerR1 + powerR2;

  return {
    result: {
      vout: { value: vout, unit: 'V', formatted: formatEngineering(vout, 'V') },
      ratio,
      current: { value: current, unit: 'A', formatted: formatEngineering(current, 'A') },
      powerR1: { value: powerR1, unit: 'W', formatted: formatEngineering(powerR1, 'W') },
      powerR2: { value: powerR2, unit: 'W', formatted: formatEngineering(powerR2, 'W') },
      totalPower: { value: totalPower, unit: 'W', formatted: formatEngineering(totalPower, 'W') },
    },
  };
}

/**
 * Suggest R1/R2 pairs from the E24 series to achieve a target Vout.
 *
 * Strategy: pick common reference R2 values across decades, compute the
 * required R1, snap both to E24, and rank by output voltage error.
 */
export function suggestVoltageDividerPairs(
  input: VoltageDividerReverseInput,
): { result: ResistorPairSuggestion[] } | { errors: CalculatorError[] } {
  const errors = validateReverse(input);
  if (errors.length > 0) {
    return { errors };
  }

  const { vin, targetVout } = input;
  // Target ratio = Vout / Vin = R2 / (R1 + R2)  →  R1 = R2 * (Vin/Vout - 1)
  const targetRatio = targetVout / vin;

  const suggestions: ResistorPairSuggestion[] = [];
  const seen = new Set<string>();

  // Try R2 values across practical decades (100 ohm to 1M ohm)
  const decades = [1e2, 1e3, 1e4, 1e5, 1e6];

  for (const decade of decades) {
    for (const multiplier of E24_VALUES) {
      const r2 = multiplier * decade;
      // Compute exact R1 needed
      const exactR1 = r2 * (1 / targetRatio - 1);
      if (exactR1 <= 0 || !Number.isFinite(exactR1)) {
        continue;
      }

      // Snap R1 to nearest E24
      const r1 = findNearestStandard(exactR1, E24_VALUES);
      const key = `${r1}-${r2}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const actualVout = vin * r2 / (r1 + r2);
      const errorPercent = Math.abs((actualVout - targetVout) / targetVout) * 100;

      suggestions.push({
        r1,
        r2,
        r1Formatted: formatEngineering(r1, '\u03A9'),
        r2Formatted: formatEngineering(r2, '\u03A9'),
        actualVout,
        errorPercent,
      });
    }
  }

  // Sort by error (best matches first), then by lower total resistance for efficiency
  suggestions.sort((a, b) => {
    const errDiff = a.errorPercent - b.errorPercent;
    if (Math.abs(errDiff) > 0.01) {
      return errDiff;
    }
    return (a.r1 + a.r2) - (b.r1 + b.r2);
  });

  // Return top 10 suggestions
  return { result: suggestions.slice(0, 10) };
}

/**
 * Find nearest E24 and E96 values for a given resistance.
 */
export function findNearestResistorValues(ohms: number): {
  e24: number;
  e24Formatted: string;
  e96: number;
  e96Formatted: string;
} {
  const e24 = findNearestStandard(ohms, E24_VALUES);
  const e96 = findNearestStandard(ohms, E96_VALUES);
  return {
    e24,
    e24Formatted: formatEngineering(e24, '\u03A9'),
    e96,
    e96Formatted: formatEngineering(e96, '\u03A9'),
  };
}
