/**
 * Power Dissipation Calculator
 *
 * Three equivalent forms:
 *   P = I * V
 *   P = I^2 * R
 *   P = V^2 / R
 *
 * Given any two of P, I, V, R — solve for the remaining two.
 */

import { formatEngineering } from './types';
import type { CalculatorResult, CalculatorError } from './types';

export interface PowerDissipationInput {
  power?: number;
  current?: number;
  voltage?: number;
  resistance?: number;
}

export interface PowerDissipationResult {
  power: CalculatorResult;
  current: CalculatorResult;
  voltage: CalculatorResult;
  resistance: CalculatorResult;
}

function validate(input: PowerDissipationInput): CalculatorError[] {
  const errors: CalculatorError[] = [];
  const values = [input.power, input.current, input.voltage, input.resistance];
  const defined = values.filter((v) => v !== undefined && v !== null);

  if (defined.length !== 2) {
    errors.push({ field: 'general', message: 'Provide exactly 2 of the 4 values (P, I, V, R)' });
    return errors;
  }

  if (input.power !== undefined && input.power < 0) {
    errors.push({ field: 'power', message: 'Power must be non-negative' });
  }
  if (input.current !== undefined && input.current < 0) {
    errors.push({ field: 'current', message: 'Current must be non-negative' });
  }
  if (input.voltage !== undefined && input.voltage < 0) {
    errors.push({ field: 'voltage', message: 'Voltage must be non-negative' });
  }
  if (input.resistance !== undefined && input.resistance < 0) {
    errors.push({ field: 'resistance', message: 'Resistance must be non-negative' });
  }
  if (input.resistance !== undefined && input.resistance === 0) {
    // Zero resistance is only valid if we're not trying to compute voltage from it
    if (input.power !== undefined && input.power > 0) {
      errors.push({ field: 'resistance', message: 'Resistance cannot be zero with non-zero power' });
    }
    if (input.voltage !== undefined && input.voltage > 0) {
      errors.push({ field: 'resistance', message: 'Resistance cannot be zero with non-zero voltage (infinite current)' });
    }
  }

  return errors;
}

function makeResult(power: number, current: number, voltage: number, resistance: number): PowerDissipationResult {
  return {
    power: { value: power, unit: 'W', formatted: formatEngineering(power, 'W') },
    current: { value: current, unit: 'A', formatted: formatEngineering(current, 'A') },
    voltage: { value: voltage, unit: 'V', formatted: formatEngineering(voltage, 'V') },
    resistance: { value: resistance, unit: '\u03A9', formatted: formatEngineering(resistance, '\u03A9') },
  };
}

/**
 * Solve power dissipation: given any two of P, I, V, R, compute the other two.
 */
export function solvePowerDissipation(
  input: PowerDissipationInput,
): { result: PowerDissipationResult } | { errors: CalculatorError[] } {
  const errors = validate(input);
  if (errors.length > 0) {
    return { errors };
  }

  const { power: p, current: i, voltage: v, resistance: r } = input;

  // P and I given → V = P/I, R = P/I^2
  if (p !== undefined && i !== undefined) {
    const voltage = i === 0 ? 0 : p / i;
    const resistance = i === 0 ? 0 : p / (i * i);
    return { result: makeResult(p, i, voltage, resistance) };
  }

  // P and V given → I = P/V, R = V^2/P
  if (p !== undefined && v !== undefined) {
    const current = v === 0 ? 0 : p / v;
    const resistance = p === 0 ? 0 : (v * v) / p;
    return { result: makeResult(p, current, v, resistance) };
  }

  // P and R given → I = sqrt(P/R), V = sqrt(P*R)
  if (p !== undefined && r !== undefined) {
    const current = r === 0 ? 0 : Math.sqrt(p / r);
    const voltage = Math.sqrt(p * r);
    return { result: makeResult(p, current, voltage, r) };
  }

  // I and V given → P = I*V, R = V/I
  if (i !== undefined && v !== undefined) {
    const power = i * v;
    const resistance = i === 0 ? 0 : v / i;
    return { result: makeResult(power, i, v, resistance) };
  }

  // I and R given → V = I*R, P = I^2*R
  if (i !== undefined && r !== undefined) {
    const voltage = i * r;
    const power = i * i * r;
    return { result: makeResult(power, i, voltage, r) };
  }

  // V and R given → I = V/R, P = V^2/R
  if (v !== undefined && r !== undefined) {
    const current = r === 0 ? 0 : v / r;
    const power = r === 0 ? 0 : (v * v) / r;
    return { result: makeResult(power, current, v, r) };
  }

  return { errors: [{ field: 'general', message: 'Unable to solve with the given inputs' }] };
}
