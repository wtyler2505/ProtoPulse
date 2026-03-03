/**
 * Ohm's Law Calculator: V = I * R
 *
 * Given any two of voltage, current, resistance, solves for the third.
 */

import { formatEngineering } from './types';
import type { CalculatorResult, CalculatorError } from './types';

export interface OhmsLawInput {
  voltage?: number;
  current?: number;
  resistance?: number;
}

export interface OhmsLawResult {
  voltage: CalculatorResult;
  current: CalculatorResult;
  resistance: CalculatorResult;
  power: CalculatorResult;
}

/**
 * Validate that exactly two of the three values are provided and positive.
 */
function validate(input: OhmsLawInput): CalculatorError[] {
  const errors: CalculatorError[] = [];
  const defined = [input.voltage, input.current, input.resistance].filter(
    (v) => v !== undefined && v !== null,
  );

  if (defined.length !== 2) {
    errors.push({ field: 'general', message: 'Provide exactly 2 of the 3 values (V, I, R)' });
    return errors;
  }

  if (input.voltage !== undefined && input.voltage < 0) {
    errors.push({ field: 'voltage', message: 'Voltage must be non-negative' });
  }
  if (input.current !== undefined && input.current < 0) {
    errors.push({ field: 'current', message: 'Current must be non-negative' });
  }
  if (input.resistance !== undefined && input.resistance < 0) {
    errors.push({ field: 'resistance', message: 'Resistance must be non-negative' });
  }
  if (input.resistance !== undefined && input.resistance === 0 && input.voltage !== undefined) {
    errors.push({ field: 'resistance', message: 'Resistance cannot be zero when voltage is given' });
  }
  if (input.current !== undefined && input.current === 0 && input.voltage !== undefined && input.voltage > 0) {
    errors.push({ field: 'current', message: 'Current cannot be zero with non-zero voltage (infinite resistance)' });
  }

  return errors;
}

/**
 * Solve Ohm's Law: given any two of V, I, R, compute the third plus power.
 */
export function solveOhmsLaw(input: OhmsLawInput): { result: OhmsLawResult } | { errors: CalculatorError[] } {
  const errors = validate(input);
  if (errors.length > 0) {
    return { errors };
  }

  let voltage: number;
  let current: number;
  let resistance: number;

  if (input.voltage !== undefined && input.current !== undefined) {
    voltage = input.voltage;
    current = input.current;
    resistance = current === 0 ? 0 : voltage / current;
  } else if (input.voltage !== undefined && input.resistance !== undefined) {
    voltage = input.voltage;
    resistance = input.resistance;
    current = resistance === 0 ? 0 : voltage / resistance;
  } else {
    // current and resistance provided
    current = input.current!;
    resistance = input.resistance!;
    voltage = current * resistance;
  }

  const power = voltage * current;

  return {
    result: {
      voltage: {
        value: voltage,
        unit: 'V',
        formatted: formatEngineering(voltage, 'V'),
      },
      current: {
        value: current,
        unit: 'A',
        formatted: formatEngineering(current, 'A'),
      },
      resistance: {
        value: resistance,
        unit: '\u03A9',
        formatted: formatEngineering(resistance, '\u03A9'),
      },
      power: {
        value: power,
        unit: 'W',
        formatted: formatEngineering(power, 'W'),
      },
    },
  };
}
