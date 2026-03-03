/**
 * LED Resistor Calculator
 *
 * Given supply voltage (Vs), LED forward voltage (Vf), and desired forward
 * current (If), calculates the required current-limiting resistor value
 * and suggests the nearest E24/E96 standard value.
 *
 * Formula: R = (Vs - Vf) / If
 */

import { findNearestStandard, formatEngineering, E24_VALUES, E96_VALUES } from './types';
import type { CalculatorError, ResistorResult } from './types';

export interface LedResistorInput {
  /** Supply voltage in volts. */
  supplyVoltage: number;
  /** LED forward voltage in volts. */
  forwardVoltage: number;
  /** Desired forward current in amps. */
  forwardCurrent: number;
}

export interface LedResistorOutput {
  /** Calculated resistor value. */
  resistor: ResistorResult;
  /** Actual current with nearest E24 resistor. */
  actualCurrentE24: number;
  /** Actual current with nearest E96 resistor. */
  actualCurrentE96: number;
  /** Power dissipated by the resistor in watts. */
  resistorPower: number;
  /** Power dissipated by the LED in watts. */
  ledPower: number;
}

function validate(input: LedResistorInput): CalculatorError[] {
  const errors: CalculatorError[] = [];

  if (input.supplyVoltage <= 0) {
    errors.push({ field: 'supplyVoltage', message: 'Supply voltage must be positive' });
  }
  if (input.forwardVoltage < 0) {
    errors.push({ field: 'forwardVoltage', message: 'Forward voltage must be non-negative' });
  }
  if (input.forwardCurrent <= 0) {
    errors.push({ field: 'forwardCurrent', message: 'Forward current must be positive' });
  }
  if (input.supplyVoltage <= input.forwardVoltage) {
    errors.push({
      field: 'supplyVoltage',
      message: 'Supply voltage must be greater than LED forward voltage',
    });
  }

  return errors;
}

/**
 * Calculate the required LED current-limiting resistor.
 */
export function solveLedResistor(
  input: LedResistorInput,
): { result: LedResistorOutput } | { errors: CalculatorError[] } {
  const errors = validate(input);
  if (errors.length > 0) {
    return { errors };
  }

  const { supplyVoltage, forwardVoltage, forwardCurrent } = input;
  const voltageDrop = supplyVoltage - forwardVoltage;
  const exactR = voltageDrop / forwardCurrent;

  const nearestE24 = findNearestStandard(exactR, E24_VALUES);
  const nearestE96 = findNearestStandard(exactR, E96_VALUES);

  const actualCurrentE24 = voltageDrop / nearestE24;
  const actualCurrentE96 = voltageDrop / nearestE96;

  const resistorPower = voltageDrop * forwardCurrent;
  const ledPower = forwardVoltage * forwardCurrent;

  return {
    result: {
      resistor: {
        value: exactR,
        unit: '\u03A9',
        formatted: formatEngineering(exactR, '\u03A9'),
        nearestE24,
        nearestE96,
        nearestE24Formatted: formatEngineering(nearestE24, '\u03A9'),
        nearestE96Formatted: formatEngineering(nearestE96, '\u03A9'),
      },
      actualCurrentE24,
      actualCurrentE96,
      resistorPower,
      ledPower,
    },
  };
}
