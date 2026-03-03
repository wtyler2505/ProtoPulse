/**
 * RC Time Constant Calculator
 *
 * Computes:
 * - Time constant: tau = R * C
 * - Settling time: 5*tau for 99.3% charge
 * - Cutoff frequency: f = 1 / (2*pi*R*C)
 * - Voltage at time t: V(t) = Vfinal * (1 - e^(-t/tau))  (charging)
 * - Voltage at time t: V(t) = Vinitial * e^(-t/tau)       (discharging)
 */

import { formatEngineering } from './types';
import type { CalculatorResult, CalculatorError } from './types';

export interface RcTimeConstantInput {
  /** Resistance in ohms. */
  resistance: number;
  /** Capacitance in farads. */
  capacitance: number;
}

export interface RcTimeConstantResult {
  /** Time constant tau = R*C in seconds. */
  tau: CalculatorResult;
  /** Time to 99.3% charge (5*tau) in seconds. */
  settlingTime: CalculatorResult;
  /** Cutoff frequency f = 1/(2*pi*R*C) in Hz. */
  cutoffFrequency: CalculatorResult;
  /** Time to reach specific charge percentages. */
  chargeTimes: Array<{ percent: number; time: CalculatorResult }>;
}

export interface RcVoltageAtTimeInput {
  resistance: number;
  capacitance: number;
  /** Time in seconds. */
  time: number;
  /** Final voltage (for charging) or initial voltage (for discharging). */
  voltage: number;
  /** 'charging' or 'discharging'. */
  mode: 'charging' | 'discharging';
}

function validate(input: RcTimeConstantInput): CalculatorError[] {
  const errors: CalculatorError[] = [];
  if (input.resistance <= 0) {
    errors.push({ field: 'resistance', message: 'Resistance must be positive' });
  }
  if (input.capacitance <= 0) {
    errors.push({ field: 'capacitance', message: 'Capacitance must be positive' });
  }
  return errors;
}

/**
 * Calculate RC time constant, settling time, and cutoff frequency.
 */
export function solveRcTimeConstant(
  input: RcTimeConstantInput,
): { result: RcTimeConstantResult } | { errors: CalculatorError[] } {
  const errors = validate(input);
  if (errors.length > 0) {
    return { errors };
  }

  const { resistance, capacitance } = input;
  const tau = resistance * capacitance;
  const settlingTime = 5 * tau;
  const cutoffFrequency = 1 / (2 * Math.PI * tau);

  // Standard charge percentages: 1tau=63.2%, 2tau=86.5%, 3tau=95.0%, 4tau=98.2%, 5tau=99.3%
  const chargePercentages = [
    { tauMultiple: 1, percent: 63.2 },
    { tauMultiple: 2, percent: 86.5 },
    { tauMultiple: 3, percent: 95.0 },
    { tauMultiple: 4, percent: 98.2 },
    { tauMultiple: 5, percent: 99.3 },
  ];

  const chargeTimes = chargePercentages.map(({ tauMultiple, percent }) => ({
    percent,
    time: {
      value: tauMultiple * tau,
      unit: 's',
      formatted: formatEngineering(tauMultiple * tau, 's'),
    },
  }));

  return {
    result: {
      tau: { value: tau, unit: 's', formatted: formatEngineering(tau, 's') },
      settlingTime: { value: settlingTime, unit: 's', formatted: formatEngineering(settlingTime, 's') },
      cutoffFrequency: { value: cutoffFrequency, unit: 'Hz', formatted: formatEngineering(cutoffFrequency, 'Hz') },
      chargeTimes,
    },
  };
}

/**
 * Calculate voltage at a given time for an RC circuit charging or discharging.
 */
export function solveRcVoltageAtTime(
  input: RcVoltageAtTimeInput,
): { result: CalculatorResult } | { errors: CalculatorError[] } {
  const errors: CalculatorError[] = [];

  if (input.resistance <= 0) {
    errors.push({ field: 'resistance', message: 'Resistance must be positive' });
  }
  if (input.capacitance <= 0) {
    errors.push({ field: 'capacitance', message: 'Capacitance must be positive' });
  }
  if (input.time < 0) {
    errors.push({ field: 'time', message: 'Time must be non-negative' });
  }
  if (errors.length > 0) {
    return { errors };
  }

  const tau = input.resistance * input.capacitance;
  let voltage: number;

  if (input.mode === 'charging') {
    // V(t) = Vfinal * (1 - e^(-t/tau))
    voltage = input.voltage * (1 - Math.exp(-input.time / tau));
  } else {
    // V(t) = Vinitial * e^(-t/tau)
    voltage = input.voltage * Math.exp(-input.time / tau);
  }

  return {
    result: {
      value: voltage,
      unit: 'V',
      formatted: formatEngineering(voltage, 'V'),
    },
  };
}
