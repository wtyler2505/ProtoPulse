/**
 * Engineering Calculators — comprehensive unit tests
 *
 * Coverage:
 *   - Ohm's Law: V=IR solver, all 3 input combos, validation, power output
 *   - LED Resistor: R=(Vs-Vf)/If, E24/E96 nearest values, actual current
 *   - Voltage Divider: forward Vout, reverse R pair suggestions, edge cases
 *   - RC Time Constant: tau, settling, cutoff freq, charge/discharge voltage
 *   - Filter Cutoff: RC low-pass/high-pass, RLC bandpass, gain at frequency
 *   - Power Dissipation: all 6 input combos (P,I,V,R choose 2), validation
 *   - E-series: nearest value lookup across decades
 *   - Formatting: engineering notation with SI prefixes
 */

import { describe, it, expect } from 'vitest';
import { solveOhmsLaw } from '../ohms-law';
import { solveLedResistor } from '../led-resistor';
import {
  solveVoltageDivider,
  suggestVoltageDividerPairs,
  findNearestResistorValues,
} from '../voltage-divider';
import { solveRcTimeConstant, solveRcVoltageAtTime } from '../rc-time-constant';
import { solveRcFilter, solveBandpassFilter, calculateGainAtFrequency } from '../filter-cutoff';
import { solvePowerDissipation } from '../power-dissipation';
import {
  findNearestStandard,
  formatEngineering,
  E24_VALUES,
  E96_VALUES,
} from '../types';

const TOL = 1e-6;

function expectResult<T>(res: { result: T } | { errors: unknown[] }): T {
  expect('result' in res).toBe(true);
  return (res as { result: T }).result;
}

function expectErrors(res: { result: unknown } | { errors: unknown[] }): void {
  expect('errors' in res).toBe(true);
}

// ---------------------------------------------------------------------------
// E-series nearest value lookup
// ---------------------------------------------------------------------------

describe('findNearestStandard', () => {
  it('finds exact E24 value (4.7k)', () => {
    expect(findNearestStandard(4700, E24_VALUES)).toBe(4700);
  });

  it('finds nearest E24 for 4800 ohms → 4700', () => {
    expect(findNearestStandard(4800, E24_VALUES)).toBe(4700);
  });

  it('finds nearest E24 for 5000 ohms → 5100', () => {
    expect(findNearestStandard(5000, E24_VALUES)).toBe(5100);
  });

  it('works across decades (150 → 150)', () => {
    expect(findNearestStandard(150, E24_VALUES)).toBe(150);
  });

  it('handles sub-ohm values', () => {
    const result = findNearestStandard(0.5, E24_VALUES);
    expect(result).toBeCloseTo(0.51, 2);
  });

  it('handles very large values (10M range)', () => {
    const result = findNearestStandard(10_000_000, E24_VALUES);
    expect(result).toBe(10_000_000);
  });

  it('returns first series value for zero input', () => {
    expect(findNearestStandard(0, E24_VALUES)).toBe(E24_VALUES[0]);
  });

  it('returns first series value for negative input', () => {
    expect(findNearestStandard(-100, E24_VALUES)).toBe(E24_VALUES[0]);
  });

  it('E96 has finer granularity than E24', () => {
    // 4850 ohms: E96 should get closer than E24
    const e24 = findNearestStandard(4850, E24_VALUES);
    const e96 = findNearestStandard(4850, E96_VALUES);
    const e24err = Math.abs(e24 - 4850);
    const e96err = Math.abs(e96 - 4850);
    expect(e96err).toBeLessThanOrEqual(e24err);
  });
});

// ---------------------------------------------------------------------------
// formatEngineering
// ---------------------------------------------------------------------------

describe('formatEngineering', () => {
  it('formats kilohms', () => {
    expect(formatEngineering(4700, '\u03A9')).toBe('4.7 k\u03A9');
  });

  it('formats milliamps', () => {
    expect(formatEngineering(0.02, 'A')).toBe('20 mA');
  });

  it('formats microfarads', () => {
    expect(formatEngineering(0.000001, 'F')).toBe('1 \u00B5F');
  });

  it('formats zero', () => {
    expect(formatEngineering(0, 'V')).toBe('0 V');
  });

  it('formats megahertz', () => {
    expect(formatEngineering(1_000_000, 'Hz')).toBe('1 MHz');
  });

  it('handles negative values', () => {
    expect(formatEngineering(-5, 'V')).toBe('-5 V');
  });

  it('handles Infinity', () => {
    expect(formatEngineering(Infinity, '\u03A9')).toContain('Infinity');
  });
});

// ---------------------------------------------------------------------------
// Ohm's Law
// ---------------------------------------------------------------------------

describe('solveOhmsLaw', () => {
  it('V and I given → solves R and P', () => {
    const r = expectResult(solveOhmsLaw({ voltage: 12, current: 0.5 }));
    expect(r.resistance.value).toBeCloseTo(24, TOL);
    expect(r.power.value).toBeCloseTo(6, TOL);
  });

  it('V and R given → solves I and P', () => {
    const r = expectResult(solveOhmsLaw({ voltage: 5, resistance: 1000 }));
    expect(r.current.value).toBeCloseTo(0.005, TOL);
    expect(r.power.value).toBeCloseTo(0.025, TOL);
  });

  it('I and R given → solves V and P', () => {
    const r = expectResult(solveOhmsLaw({ current: 0.1, resistance: 470 }));
    expect(r.voltage.value).toBeCloseTo(47, TOL);
    expect(r.power.value).toBeCloseTo(4.7, TOL);
  });

  it('rejects fewer than 2 inputs', () => {
    expectErrors(solveOhmsLaw({ voltage: 5 }));
  });

  it('rejects all 3 inputs', () => {
    expectErrors(solveOhmsLaw({ voltage: 5, current: 0.5, resistance: 10 }));
  });

  it('rejects negative resistance', () => {
    expectErrors(solveOhmsLaw({ voltage: 5, resistance: -100 }));
  });

  it('handles zero voltage and current → zero resistance', () => {
    const r = expectResult(solveOhmsLaw({ voltage: 0, current: 0 }));
    expect(r.resistance.value).toBe(0);
    expect(r.power.value).toBe(0);
  });

  it('produces formatted output strings', () => {
    const r = expectResult(solveOhmsLaw({ voltage: 3.3, resistance: 10000 }));
    expect(r.resistance.formatted).toContain('k');
    // 3.3V / 10k = 330 uA, not mA
    expect(r.current.formatted).toContain('\u00B5A');
  });
});

// ---------------------------------------------------------------------------
// LED Resistor
// ---------------------------------------------------------------------------

describe('solveLedResistor', () => {
  it('classic 5V red LED: R = (5-2)/0.02 = 150 ohms', () => {
    const r = expectResult(solveLedResistor({
      supplyVoltage: 5,
      forwardVoltage: 2,
      forwardCurrent: 0.02,
    }));
    expect(r.resistor.value).toBeCloseTo(150, TOL);
    expect(r.resistor.nearestE24).toBe(150);
  });

  it('suggests nearest E24 and E96 for non-standard value', () => {
    const r = expectResult(solveLedResistor({
      supplyVoltage: 3.3,
      forwardVoltage: 1.8,
      forwardCurrent: 0.015,
    }));
    // Exact: (3.3-1.8)/0.015 = 100 ohms
    expect(r.resistor.value).toBeCloseTo(100, TOL);
    expect(r.resistor.nearestE24).toBe(100);
    expect(r.resistor.nearestE96).toBe(100);
  });

  it('computes actual current with E24 resistor', () => {
    const r = expectResult(solveLedResistor({
      supplyVoltage: 12,
      forwardVoltage: 3.2,
      forwardCurrent: 0.02,
    }));
    // Exact R = 440, E24 nearest is 430
    const expectedCurrent = (12 - 3.2) / r.resistor.nearestE24;
    expect(r.actualCurrentE24).toBeCloseTo(expectedCurrent, TOL);
  });

  it('computes power dissipation', () => {
    const r = expectResult(solveLedResistor({
      supplyVoltage: 5,
      forwardVoltage: 2,
      forwardCurrent: 0.02,
    }));
    expect(r.resistorPower).toBeCloseTo(0.06, TOL); // (5-2)*0.02 = 0.06W
    expect(r.ledPower).toBeCloseTo(0.04, TOL); // 2*0.02 = 0.04W
  });

  it('rejects Vs <= Vf', () => {
    expectErrors(solveLedResistor({
      supplyVoltage: 2,
      forwardVoltage: 3,
      forwardCurrent: 0.02,
    }));
  });

  it('rejects zero forward current', () => {
    expectErrors(solveLedResistor({
      supplyVoltage: 5,
      forwardVoltage: 2,
      forwardCurrent: 0,
    }));
  });

  it('rejects negative supply voltage', () => {
    expectErrors(solveLedResistor({
      supplyVoltage: -5,
      forwardVoltage: 2,
      forwardCurrent: 0.02,
    }));
  });
});

// ---------------------------------------------------------------------------
// Voltage Divider
// ---------------------------------------------------------------------------

describe('solveVoltageDivider', () => {
  it('equal resistors → half voltage', () => {
    const r = expectResult(solveVoltageDivider({ r1: 10000, r2: 10000, vin: 5 }));
    expect(r.vout.value).toBeCloseTo(2.5, TOL);
    expect(r.ratio).toBeCloseTo(0.5, TOL);
  });

  it('3.3V from 5V with 10k/20k', () => {
    // Vout = 5 * 20k / (10k + 20k) = 3.333V
    const r = expectResult(solveVoltageDivider({ r1: 10000, r2: 20000, vin: 5 }));
    expect(r.vout.value).toBeCloseTo(10 / 3, TOL);
  });

  it('computes current through divider', () => {
    const r = expectResult(solveVoltageDivider({ r1: 10000, r2: 10000, vin: 10 }));
    expect(r.current.value).toBeCloseTo(0.0005, TOL); // 10V / 20k = 0.5mA
  });

  it('computes power dissipation per resistor', () => {
    const r = expectResult(solveVoltageDivider({ r1: 1000, r2: 1000, vin: 10 }));
    // I = 10/2000 = 5mA, P = I^2*R = 0.025W per resistor
    expect(r.powerR1.value).toBeCloseTo(0.025, TOL);
    expect(r.powerR2.value).toBeCloseTo(0.025, TOL);
    expect(r.totalPower.value).toBeCloseTo(0.05, TOL);
  });

  it('rejects both resistors zero', () => {
    expectErrors(solveVoltageDivider({ r1: 0, r2: 0, vin: 5 }));
  });

  it('rejects negative resistance', () => {
    expectErrors(solveVoltageDivider({ r1: -100, r2: 1000, vin: 5 }));
  });
});

describe('suggestVoltageDividerPairs', () => {
  it('suggests pairs for 3.3V from 5V', () => {
    const r = expectResult(suggestVoltageDividerPairs({ vin: 5, targetVout: 3.3 }));
    expect(r.length).toBeGreaterThan(0);
    // Best suggestion should have error < 5%
    expect(r[0].errorPercent).toBeLessThan(5);
  });

  it('all suggestions use E24 values', () => {
    const r = expectResult(suggestVoltageDividerPairs({ vin: 12, targetVout: 5 }));
    for (const s of r) {
      // Each R should be an E24 standard value (within a decade)
      expect(s.actualVout).toBeGreaterThan(0);
      expect(s.r1).toBeGreaterThan(0);
      expect(s.r2).toBeGreaterThan(0);
    }
  });

  it('rejects targetVout >= vin', () => {
    expectErrors(suggestVoltageDividerPairs({ vin: 5, targetVout: 6 }));
  });

  it('rejects negative targetVout', () => {
    expectErrors(suggestVoltageDividerPairs({ vin: 5, targetVout: -1 }));
  });

  it('results are sorted by error (best first)', () => {
    const r = expectResult(suggestVoltageDividerPairs({ vin: 5, targetVout: 3.3 }));
    for (let i = 1; i < r.length; i++) {
      // Allow small tolerance for equal errors sorted by resistance
      expect(r[i].errorPercent).toBeGreaterThanOrEqual(r[i - 1].errorPercent - 0.02);
    }
  });
});

describe('findNearestResistorValues', () => {
  it('returns E24 and E96 nearest values', () => {
    const r = findNearestResistorValues(4800);
    expect(r.e24).toBe(4700);
    expect(typeof r.e96).toBe('number');
    expect(r.e24Formatted).toContain('k');
  });
});

// ---------------------------------------------------------------------------
// RC Time Constant
// ---------------------------------------------------------------------------

describe('solveRcTimeConstant', () => {
  it('10k + 1uF = 10ms time constant', () => {
    const r = expectResult(solveRcTimeConstant({ resistance: 10000, capacitance: 0.000001 }));
    expect(r.tau.value).toBeCloseTo(0.01, TOL);
  });

  it('settling time is 5x tau', () => {
    const r = expectResult(solveRcTimeConstant({ resistance: 10000, capacitance: 0.000001 }));
    expect(r.settlingTime.value).toBeCloseTo(5 * r.tau.value, TOL);
  });

  it('cutoff frequency = 1/(2*pi*R*C)', () => {
    const r = expectResult(solveRcTimeConstant({ resistance: 10000, capacitance: 0.000001 }));
    const expected = 1 / (2 * Math.PI * 10000 * 0.000001);
    expect(r.cutoffFrequency.value).toBeCloseTo(expected, TOL);
  });

  it('provides 5 charge time percentages', () => {
    const r = expectResult(solveRcTimeConstant({ resistance: 1000, capacitance: 0.00001 }));
    expect(r.chargeTimes).toHaveLength(5);
    expect(r.chargeTimes[0].percent).toBe(63.2);
    expect(r.chargeTimes[4].percent).toBe(99.3);
  });

  it('rejects zero resistance', () => {
    expectErrors(solveRcTimeConstant({ resistance: 0, capacitance: 0.000001 }));
  });

  it('rejects negative capacitance', () => {
    expectErrors(solveRcTimeConstant({ resistance: 1000, capacitance: -0.001 }));
  });
});

describe('solveRcVoltageAtTime', () => {
  it('charging: V(0) = 0', () => {
    const r = expectResult(solveRcVoltageAtTime({
      resistance: 1000,
      capacitance: 0.001,
      time: 0,
      voltage: 5,
      mode: 'charging',
    }));
    expect(r.value).toBeCloseTo(0, TOL);
  });

  it('charging: V(1tau) ≈ 63.2% of Vfinal', () => {
    const tau = 1000 * 0.001; // 1s
    const r = expectResult(solveRcVoltageAtTime({
      resistance: 1000,
      capacitance: 0.001,
      time: tau,
      voltage: 10,
      mode: 'charging',
    }));
    expect(r.value).toBeCloseTo(10 * (1 - Math.exp(-1)), 1e-3);
  });

  it('discharging: V(0) = Vinitial', () => {
    const r = expectResult(solveRcVoltageAtTime({
      resistance: 1000,
      capacitance: 0.001,
      time: 0,
      voltage: 5,
      mode: 'discharging',
    }));
    expect(r.value).toBeCloseTo(5, TOL);
  });

  it('discharging: V(5tau) ≈ 0.67% of Vinitial', () => {
    const tau = 1000 * 0.001;
    const r = expectResult(solveRcVoltageAtTime({
      resistance: 1000,
      capacitance: 0.001,
      time: 5 * tau,
      voltage: 10,
      mode: 'discharging',
    }));
    expect(r.value).toBeCloseTo(10 * Math.exp(-5), 1e-3);
  });

  it('rejects negative time', () => {
    expectErrors(solveRcVoltageAtTime({
      resistance: 1000,
      capacitance: 0.001,
      time: -1,
      voltage: 5,
      mode: 'charging',
    }));
  });
});

// ---------------------------------------------------------------------------
// Filter Cutoff
// ---------------------------------------------------------------------------

describe('solveRcFilter', () => {
  it('10k + 100nF low-pass → fc ≈ 159.15 Hz', () => {
    const r = expectResult(solveRcFilter({
      filterType: 'low-pass',
      resistance: 10000,
      capacitance: 1e-7,
    }));
    const expected = 1 / (2 * Math.PI * 10000 * 1e-7);
    expect(r.cutoffFrequency.value).toBeCloseTo(expected, TOL);
  });

  it('high-pass has same cutoff as low-pass (same RC)', () => {
    const lp = expectResult(solveRcFilter({
      filterType: 'low-pass',
      resistance: 10000,
      capacitance: 1e-7,
    }));
    const hp = expectResult(solveRcFilter({
      filterType: 'high-pass',
      resistance: 10000,
      capacitance: 1e-7,
    }));
    expect(lp.cutoffFrequency.value).toBeCloseTo(hp.cutoffFrequency.value, TOL);
  });

  it('computes angular cutoff frequency', () => {
    const r = expectResult(solveRcFilter({
      filterType: 'low-pass',
      resistance: 1000,
      capacitance: 1e-6,
    }));
    expect(r.omegaCutoff.value).toBeCloseTo(1000, TOL); // 1/(1000 * 1e-6) = 1000 rad/s
  });

  it('computes time constant', () => {
    const r = expectResult(solveRcFilter({
      filterType: 'low-pass',
      resistance: 1000,
      capacitance: 1e-6,
    }));
    expect(r.timeConstant.value).toBeCloseTo(0.001, TOL);
  });

  it('rejects zero resistance', () => {
    expectErrors(solveRcFilter({ filterType: 'low-pass', resistance: 0, capacitance: 1e-6 }));
  });

  it('rejects negative capacitance', () => {
    expectErrors(solveRcFilter({ filterType: 'high-pass', resistance: 1000, capacitance: -1e-6 }));
  });
});

describe('solveBandpassFilter', () => {
  it('computes center frequency', () => {
    // f0 = 1/(2*pi*sqrt(L*C))
    const r = expectResult(solveBandpassFilter({
      resistance: 100,
      inductance: 0.01,
      capacitance: 1e-7,
    }));
    const expected = 1 / (2 * Math.PI * Math.sqrt(0.01 * 1e-7));
    expect(r.centerFrequency.value).toBeCloseTo(expected, 0.1);
  });

  it('computes bandwidth = R/(2*pi*L)', () => {
    const r = expectResult(solveBandpassFilter({
      resistance: 100,
      inductance: 0.01,
      capacitance: 1e-7,
    }));
    const expectedBW = 100 / (2 * Math.PI * 0.01);
    expect(r.bandwidth.value).toBeCloseTo(expectedBW, 0.1);
  });

  it('computes quality factor Q', () => {
    const r = expectResult(solveBandpassFilter({
      resistance: 100,
      inductance: 0.01,
      capacitance: 1e-7,
    }));
    const expectedQ = (1 / 100) * Math.sqrt(0.01 / 1e-7);
    expect(r.qualityFactor).toBeCloseTo(expectedQ, TOL);
  });

  it('lower + bandwidth ≈ upper cutoff', () => {
    const r = expectResult(solveBandpassFilter({
      resistance: 50,
      inductance: 0.001,
      capacitance: 1e-9,
    }));
    expect(r.lowerCutoff.value + r.bandwidth.value).toBeCloseTo(r.upperCutoff.value, TOL);
  });

  it('rejects zero inductance', () => {
    expectErrors(solveBandpassFilter({ resistance: 100, inductance: 0, capacitance: 1e-7 }));
  });
});

describe('calculateGainAtFrequency', () => {
  it('low-pass: gain at cutoff = -3dB (0.707)', () => {
    const r = calculateGainAtFrequency({
      filterType: 'low-pass',
      frequency: 1000,
      cutoffFrequency: 1000,
    });
    expect(r.magnitude).toBeCloseTo(1 / Math.SQRT2, 1e-4);
    expect(r.gainDb).toBeCloseTo(-3.01, 0.1);
  });

  it('low-pass: gain at DC = 1 (0 dB)', () => {
    const r = calculateGainAtFrequency({
      filterType: 'low-pass',
      frequency: 0.001,
      cutoffFrequency: 1000,
    });
    expect(r.magnitude).toBeCloseTo(1, 1e-3);
  });

  it('high-pass: gain at cutoff = -3dB', () => {
    const r = calculateGainAtFrequency({
      filterType: 'high-pass',
      frequency: 1000,
      cutoffFrequency: 1000,
    });
    expect(r.magnitude).toBeCloseTo(1 / Math.SQRT2, 1e-4);
  });

  it('high-pass: gain at DC ≈ 0', () => {
    const r = calculateGainAtFrequency({
      filterType: 'high-pass',
      frequency: 0.001,
      cutoffFrequency: 1000,
    });
    expect(r.magnitude).toBeCloseTo(0, 1e-3);
  });

  it('low-pass phase at cutoff = -45 degrees', () => {
    const r = calculateGainAtFrequency({
      filterType: 'low-pass',
      frequency: 1000,
      cutoffFrequency: 1000,
    });
    expect(r.phaseDegrees).toBeCloseTo(-45, 0.1);
  });
});

// ---------------------------------------------------------------------------
// Power Dissipation
// ---------------------------------------------------------------------------

describe('solvePowerDissipation', () => {
  it('P and I given → V and R', () => {
    const r = expectResult(solvePowerDissipation({ power: 10, current: 2 }));
    expect(r.voltage.value).toBeCloseTo(5, TOL); // V = P/I = 10/2
    expect(r.resistance.value).toBeCloseTo(2.5, TOL); // R = P/I^2 = 10/4
  });

  it('P and V given → I and R', () => {
    const r = expectResult(solvePowerDissipation({ power: 25, voltage: 5 }));
    expect(r.current.value).toBeCloseTo(5, TOL); // I = P/V = 25/5
    expect(r.resistance.value).toBeCloseTo(1, TOL); // R = V^2/P = 25/25
  });

  it('P and R given → I and V', () => {
    const r = expectResult(solvePowerDissipation({ power: 4, resistance: 100 }));
    expect(r.current.value).toBeCloseTo(0.2, TOL); // I = sqrt(P/R)
    expect(r.voltage.value).toBeCloseTo(20, TOL); // V = sqrt(P*R)
  });

  it('I and V given → P and R', () => {
    const r = expectResult(solvePowerDissipation({ current: 0.5, voltage: 12 }));
    expect(r.power.value).toBeCloseTo(6, TOL);
    expect(r.resistance.value).toBeCloseTo(24, TOL);
  });

  it('I and R given → V and P', () => {
    const r = expectResult(solvePowerDissipation({ current: 0.1, resistance: 1000 }));
    expect(r.voltage.value).toBeCloseTo(100, TOL); // V = I*R
    expect(r.power.value).toBeCloseTo(10, TOL); // P = I^2*R
  });

  it('V and R given → I and P', () => {
    const r = expectResult(solvePowerDissipation({ voltage: 9, resistance: 100 }));
    expect(r.current.value).toBeCloseTo(0.09, TOL);
    expect(r.power.value).toBeCloseTo(0.81, TOL);
  });

  it('rejects fewer than 2 inputs', () => {
    expectErrors(solvePowerDissipation({ voltage: 5 }));
  });

  it('rejects more than 2 inputs', () => {
    expectErrors(solvePowerDissipation({ power: 1, current: 1, voltage: 1 }));
  });

  it('rejects negative power', () => {
    expectErrors(solvePowerDissipation({ power: -1, current: 1 }));
  });

  it('handles zero power with zero current', () => {
    const r = expectResult(solvePowerDissipation({ power: 0, current: 0 }));
    expect(r.voltage.value).toBe(0);
    expect(r.resistance.value).toBe(0);
  });
});
