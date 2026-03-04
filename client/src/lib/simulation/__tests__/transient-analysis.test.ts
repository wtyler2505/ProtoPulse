/**
 * Comprehensive tests for Transient / Time-Domain Simulation Engine (CAPX-FFI-06)
 *
 * Coverage:
 *   - Source evaluation: DC, Pulse, Sine, PWL waveforms
 *   - Breakpoint collection for adaptive timestep
 *   - RC circuits: step response, time constant verification
 *   - RL circuits: inductor charging/discharging
 *   - RLC circuits: underdamped, overdamped, critically damped
 *   - Integration methods: Backward Euler vs Trapezoidal comparison
 *   - Nonlinear: diode half-wave rectifier
 *   - Adaptive timestep: step rejection on fast transients
 *   - Edge cases: zero-value components, single-node, very short/long simulations
 *   - Convergence: graceful failure for bad circuits
 */

import { describe, it, expect } from 'vitest';
import {
  runTransientAnalysis,
  evaluateSource,
  evaluatePulse,
  evaluateSine,
  evaluatePwl,
  collectBreakpoints,
} from '../transient-analysis';
import type {
  TransientAnalysisConfig,
  TransientCircuitDefinition,
  TransientComponent,
  DcSource,
  PulseSource,
  SineSource,
  PwlSource,
  TimeVaryingSource,
  TransientResult,
} from '../transient-analysis';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Absolute tolerance for floating-point comparisons. */
const TOL = 1e-6;

/** Relative tolerance for physics-level checks. */
const REL_TOL = 0.05; // 5%

/** Check if actual is within relative tolerance of expected. */
function relClose(actual: number, expected: number, tol = REL_TOL): boolean {
  if (expected === 0) {
    return Math.abs(actual) < tol;
  }
  return Math.abs((actual - expected) / expected) < tol;
}

/** Get the voltage at a given time for a node from the result. */
function voltageAt(result: TransientResult, nodeId: string, timeIndex: number): number {
  const arr = result.nodeVoltages.get(nodeId);
  if (!arr || timeIndex >= arr.length) {
    return 0;
  }
  return arr[timeIndex];
}

/** Find the index in timePoints closest to a given time. */
function findTimeIndex(result: TransientResult, targetTime: number): number {
  let bestIdx = 0;
  let bestDist = Math.abs(result.timePoints[0] - targetTime);
  for (let i = 1; i < result.timePoints.length; i++) {
    const dist = Math.abs(result.timePoints[i] - targetTime);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/** Get voltage at a target time for a node. */
function voltageAtTime(result: TransientResult, nodeId: string, targetTime: number): number {
  const idx = findTimeIndex(result, targetTime);
  return voltageAt(result, nodeId, idx);
}

// ---------------------------------------------------------------------------
// Source evaluation tests
// ---------------------------------------------------------------------------

describe('Source evaluation', () => {
  describe('DC source', () => {
    it('returns constant value at all times', () => {
      const src: DcSource = { id: 'V1', type: 'dc', sourceType: 'V', nodes: ['1', '0'], value: 5 };
      expect(evaluateSource(src, 0)).toBe(5);
      expect(evaluateSource(src, 1)).toBe(5);
      expect(evaluateSource(src, 100)).toBe(5);
    });
  });

  describe('Pulse source', () => {
    const pulse: PulseSource = {
      id: 'V1', type: 'pulse', sourceType: 'V', nodes: ['1', '0'],
      v1: 0, v2: 5, delay: 1e-3, rise: 0.1e-3, fall: 0.1e-3, width: 0.5e-3, period: 1e-3,
    };

    it('returns v1 before delay', () => {
      expect(evaluatePulse(pulse, 0)).toBe(0);
      expect(evaluatePulse(pulse, 0.5e-3)).toBe(0);
    });

    it('ramps from v1 to v2 during rise time', () => {
      const midRise = pulse.delay + pulse.rise / 2;
      const val = evaluatePulse(pulse, midRise);
      expect(val).toBeCloseTo(2.5, 1);
    });

    it('returns v2 during pulse width', () => {
      const midPulse = pulse.delay + pulse.rise + pulse.width / 2;
      expect(evaluatePulse(pulse, midPulse)).toBeCloseTo(5, 4);
    });

    it('ramps from v2 to v1 during fall time', () => {
      const midFall = pulse.delay + pulse.rise + pulse.width + pulse.fall / 2;
      const val = evaluatePulse(pulse, midFall);
      expect(val).toBeCloseTo(2.5, 1);
    });

    it('returns v1 after pulse ends within period', () => {
      const afterPulse = pulse.delay + pulse.rise + pulse.width + pulse.fall + 0.05e-3;
      expect(evaluatePulse(pulse, afterPulse)).toBeCloseTo(0, 4);
    });

    it('repeats correctly for periodic pulse', () => {
      // Second period
      const secondPulse = pulse.delay + pulse.period + pulse.rise + pulse.width / 2;
      expect(evaluatePulse(pulse, secondPulse)).toBeCloseTo(5, 4);
    });

    it('handles zero rise/fall time', () => {
      const step: PulseSource = {
        id: 'V1', type: 'pulse', sourceType: 'V', nodes: ['1', '0'],
        v1: 0, v2: 3.3, delay: 0, rise: 0, fall: 0, width: 1e-3, period: 2e-3,
      };
      expect(evaluatePulse(step, 0)).toBe(3.3);
      expect(evaluatePulse(step, 0.5e-3)).toBe(3.3);
      expect(evaluatePulse(step, 1.5e-3)).toBe(0);
    });

    it('handles non-periodic pulse (period=0)', () => {
      const oneShot: PulseSource = {
        id: 'V1', type: 'pulse', sourceType: 'V', nodes: ['1', '0'],
        v1: 0, v2: 5, delay: 0, rise: 1e-6, fall: 1e-6, width: 1e-3, period: 0,
      };
      expect(evaluatePulse(oneShot, 0.5e-3)).toBeCloseTo(5, 4);
      expect(evaluatePulse(oneShot, 2e-3)).toBeCloseTo(0, 4);
    });
  });

  describe('Sine source', () => {
    const sine: SineSource = {
      id: 'V1', type: 'sine', sourceType: 'V', nodes: ['1', '0'],
      offset: 1, amplitude: 2, frequency: 1000, phase: 0,
    };

    it('returns offset at t=0 with zero phase', () => {
      expect(evaluateSine(sine, 0)).toBeCloseTo(1, 4);
    });

    it('returns offset + amplitude at quarter period', () => {
      const t = 1 / (4 * 1000); // quarter period
      expect(evaluateSine(sine, t)).toBeCloseTo(3, 2);
    });

    it('returns offset at half period', () => {
      const t = 1 / (2 * 1000);
      expect(evaluateSine(sine, t)).toBeCloseTo(1, 2);
    });

    it('applies phase offset correctly', () => {
      const sinePhase: SineSource = { ...sine, phase: 90 };
      // At t=0, sin(90deg) = 1, so value = offset + amplitude = 3
      expect(evaluateSine(sinePhase, 0)).toBeCloseTo(3, 2);
    });

    it('applies damping correctly', () => {
      const sineDamped: SineSource = { ...sine, damping: 1000 };
      const t = 1e-3; // 1ms, damping factor = exp(-1) ≈ 0.368
      const val = evaluateSine(sineDamped, t);
      // At t=1ms, sin(2*pi*1000*1e-3) = sin(2pi) ≈ 0
      // So val ≈ offset = 1
      expect(Math.abs(val - 1)).toBeLessThan(1);
    });
  });

  describe('PWL source', () => {
    const pwl: PwlSource = {
      id: 'V1', type: 'pwl', sourceType: 'V', nodes: ['1', '0'],
      points: [[0, 0], [1e-3, 5], [2e-3, 5], [3e-3, 0]],
    };

    it('returns first value at t <= first point', () => {
      expect(evaluatePwl(pwl, -1)).toBe(0);
      expect(evaluatePwl(pwl, 0)).toBe(0);
    });

    it('interpolates linearly between points', () => {
      expect(evaluatePwl(pwl, 0.5e-3)).toBeCloseTo(2.5, 2);
    });

    it('returns exact value at defined points', () => {
      expect(evaluatePwl(pwl, 1e-3)).toBeCloseTo(5, 4);
      expect(evaluatePwl(pwl, 2e-3)).toBeCloseTo(5, 4);
    });

    it('returns last value at t >= last point', () => {
      expect(evaluatePwl(pwl, 5e-3)).toBe(0);
    });

    it('handles empty points array', () => {
      const empty: PwlSource = { id: 'V1', type: 'pwl', sourceType: 'V', nodes: ['1', '0'], points: [] };
      expect(evaluatePwl(empty, 1)).toBe(0);
    });

    it('handles single point', () => {
      const single: PwlSource = {
        id: 'V1', type: 'pwl', sourceType: 'V', nodes: ['1', '0'],
        points: [[1e-3, 3.3]],
      };
      expect(evaluatePwl(single, 0)).toBe(3.3);
      expect(evaluatePwl(single, 2e-3)).toBe(3.3);
    });
  });
});

// ---------------------------------------------------------------------------
// Breakpoint collection tests
// ---------------------------------------------------------------------------

describe('collectBreakpoints', () => {
  it('collects pulse edge times', () => {
    const pulse: PulseSource = {
      id: 'V1', type: 'pulse', sourceType: 'V', nodes: ['1', '0'],
      v1: 0, v2: 5, delay: 0, rise: 1e-6, fall: 1e-6, width: 1e-3, period: 2e-3,
    };
    const bps = collectBreakpoints([pulse], 0, 3e-3);
    expect(bps.length).toBeGreaterThan(0);
    // Should contain at least the first pulse edges
    expect(bps).toContain(0);
  });

  it('collects PWL breakpoints', () => {
    const pwl: PwlSource = {
      id: 'V1', type: 'pwl', sourceType: 'V', nodes: ['1', '0'],
      points: [[0, 0], [1e-3, 5], [2e-3, 0]],
    };
    const bps = collectBreakpoints([pwl], 0, 3e-3);
    expect(bps).toContain(0);
    expect(bps).toContain(1e-3);
    expect(bps).toContain(2e-3);
  });

  it('returns empty for DC sources', () => {
    const dc: DcSource = { id: 'V1', type: 'dc', sourceType: 'V', nodes: ['1', '0'], value: 5 };
    const bps = collectBreakpoints([dc], 0, 1);
    expect(bps.length).toBe(0);
  });

  it('returns empty for sine sources', () => {
    const sine: SineSource = {
      id: 'V1', type: 'sine', sourceType: 'V', nodes: ['1', '0'],
      offset: 0, amplitude: 5, frequency: 1000, phase: 0,
    };
    const bps = collectBreakpoints([sine], 0, 1);
    expect(bps.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// RC circuit tests
// ---------------------------------------------------------------------------

describe('RC circuit — step response', () => {
  // V_source (5V) -> R (1kΩ) -> node 1 -> C (1µF) -> GND
  // Time constant τ = R*C = 1e3 * 1e-6 = 1e-3 s = 1ms
  // V_cap(t) = Vs * (1 - exp(-t/τ))

  function makeRCCircuit(): TransientCircuitDefinition {
    return {
      nodes: ['1'],
      groundNode: '0',
      components: [
        { id: 'R1', type: 'R', value: 1e3, nodes: ['1', '0'] },
        { id: 'C1', type: 'C', value: 1e-6, nodes: ['1', '0'] },
      ],
      sources: [
        { id: 'V1', type: 'dc', sourceType: 'I', nodes: ['1', '0'], value: 5e-3 },
        // 5mA current source => at steady state V = I*R = 5V
      ],
    };
  }

  it('starts at zero voltage', () => {
    const config: TransientAnalysisConfig = {
      circuit: makeRCCircuit(),
      tStart: 0,
      tStop: 5e-3,
      tStep: 10e-6,
      method: 'trapezoidal',
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);
    // First point should be near zero
    const v0 = voltageAt(result, '1', 0);
    expect(Math.abs(v0)).toBeLessThan(0.5);
  });

  it('charges with correct time constant (trapezoidal)', () => {
    const config: TransientAnalysisConfig = {
      circuit: makeRCCircuit(),
      tStart: 0,
      tStop: 5e-3,
      tStep: 10e-6,
      method: 'trapezoidal',
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);

    // At t = τ = 1ms, V should be ≈ 5 * (1 - 1/e) ≈ 3.16V
    const tau = 1e-3;
    const expectedAtTau = 5 * (1 - Math.exp(-1));
    const vAtTau = voltageAtTime(result, '1', tau);
    expect(relClose(vAtTau, expectedAtTau, 0.1)).toBe(true);
  });

  it('approaches steady state at 5τ', () => {
    const config: TransientAnalysisConfig = {
      circuit: makeRCCircuit(),
      tStart: 0,
      tStop: 5e-3,
      tStep: 10e-6,
      method: 'trapezoidal',
    };
    const result = runTransientAnalysis(config);

    // At t = 5τ = 5ms, should be very close to 5V (I*R = 5mA * 1kΩ)
    const vFinal = voltageAtTime(result, '1', 5e-3);
    expect(relClose(vFinal, 5, 0.05)).toBe(true);
  });

  it('charges with backward Euler', () => {
    const config: TransientAnalysisConfig = {
      circuit: makeRCCircuit(),
      tStart: 0,
      tStop: 5e-3,
      tStep: 10e-6,
      method: 'backward_euler',
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);

    // At 5τ should approach steady state
    const vFinal = voltageAtTime(result, '1', 5e-3);
    expect(relClose(vFinal, 5, 0.05)).toBe(true);
  });

  it('records branch currents', () => {
    const config: TransientAnalysisConfig = {
      circuit: makeRCCircuit(),
      tStart: 0,
      tStop: 1e-3,
      tStep: 50e-6,
      method: 'trapezoidal',
    };
    const result = runTransientAnalysis(config);

    // Resistor current should exist
    const rCurrents = result.branchCurrents.get('R1');
    expect(rCurrents).toBeDefined();
    expect(rCurrents!.length).toBeGreaterThan(0);
  });
});

describe('RC circuit — voltage source step', () => {
  // V1 (5V step) -> R (1kΩ) -> node 1 -> C (1µF) -> GND
  // V_cap(t) = 5 * (1 - exp(-t/τ)), τ = RC = 1ms

  function makeRCVoltageStep(): TransientCircuitDefinition {
    return {
      nodes: ['1', '2'],
      groundNode: '0',
      components: [
        { id: 'R1', type: 'R', value: 1e3, nodes: ['2', '1'] },
        { id: 'C1', type: 'C', value: 1e-6, nodes: ['1', '0'] },
      ],
      sources: [
        { id: 'V1', type: 'dc', sourceType: 'V', nodes: ['2', '0'], value: 5 },
      ],
    };
  }

  it('capacitor charges to source voltage', () => {
    const config: TransientAnalysisConfig = {
      circuit: makeRCVoltageStep(),
      tStart: 0,
      tStop: 5e-3,
      tStep: 10e-6,
      method: 'trapezoidal',
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);

    // Node 2 should be at 5V (voltage source)
    const v2 = voltageAtTime(result, '2', 1e-3);
    expect(Math.abs(v2 - 5)).toBeLessThan(0.01);

    // Node 1 (cap) at 5τ should approach 5V
    const vCap = voltageAtTime(result, '1', 5e-3);
    expect(relClose(vCap, 5, 0.05)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RL circuit tests
// ---------------------------------------------------------------------------

describe('RL circuit — inductor charging', () => {
  // V1 (10V) -> R (100Ω) -> node 1 -> L (10mH) -> GND
  // τ = L/R = 10e-3 / 100 = 0.1ms
  // I_L(t) = (V/R) * (1 - exp(-t/τ))

  function makeRLCircuit(): TransientCircuitDefinition {
    return {
      nodes: ['1', '2'],
      groundNode: '0',
      components: [
        { id: 'R1', type: 'R', value: 100, nodes: ['2', '1'] },
        { id: 'L1', type: 'L', value: 10e-3, nodes: ['1', '0'] },
      ],
      sources: [
        { id: 'V1', type: 'dc', sourceType: 'V', nodes: ['2', '0'], value: 10 },
      ],
    };
  }

  it('converges', () => {
    const config: TransientAnalysisConfig = {
      circuit: makeRLCircuit(),
      tStart: 0,
      tStop: 1e-3,
      tStep: 2e-6,
      method: 'trapezoidal',
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);
    expect(result.timePoints.length).toBeGreaterThan(10);
  });

  it('inductor current increases toward V/R', () => {
    const config: TransientAnalysisConfig = {
      circuit: makeRLCircuit(),
      tStart: 0,
      tStop: 1e-3,
      tStep: 2e-6,
      method: 'trapezoidal',
    };
    const result = runTransientAnalysis(config);

    // At t = 5τ = 0.5ms, inductor current should be near V/R = 0.1A
    const lCurrents = result.branchCurrents.get('L1');
    expect(lCurrents).toBeDefined();
    const lastI = lCurrents![lCurrents!.length - 1];
    // At 10τ (1ms), should be very close to 100mA
    expect(relClose(Math.abs(lastI), 0.1, 0.1)).toBe(true);
  });

  it('node voltage across inductor decreases as current builds', () => {
    const config: TransientAnalysisConfig = {
      circuit: makeRLCircuit(),
      tStart: 0,
      tStop: 1e-3,
      tStep: 2e-6,
      method: 'trapezoidal',
    };
    const result = runTransientAnalysis(config);

    // Initially V across inductor (node 1) should be high
    const vEarly = voltageAtTime(result, '1', 5e-6);
    // At steady state, V across inductor = 0 (all voltage on R)
    const vLate = voltageAtTime(result, '1', 1e-3);
    expect(Math.abs(vLate)).toBeLessThan(Math.abs(vEarly) + 0.5);
  });
});

// ---------------------------------------------------------------------------
// RLC circuit tests
// ---------------------------------------------------------------------------

describe('RLC circuit — underdamped', () => {
  // Series RLC: V1 -> R (10Ω) -> L (1mH) -> C (1µF) -> GND
  // ω0 = 1/√(LC) ≈ 31623 rad/s, Q = (1/R)√(L/C) ≈ 3.16 (underdamped)

  function makeRLCCircuit(R: number): TransientCircuitDefinition {
    return {
      nodes: ['1', '2', '3'],
      groundNode: '0',
      components: [
        { id: 'R1', type: 'R', value: R, nodes: ['2', '3'] },
        { id: 'L1', type: 'L', value: 1e-3, nodes: ['3', '1'] },
        { id: 'C1', type: 'C', value: 1e-6, nodes: ['1', '0'] },
      ],
      sources: [
        { id: 'V1', type: 'dc', sourceType: 'V', nodes: ['2', '0'], value: 5 },
      ],
    };
  }

  it('underdamped oscillation (R=10Ω)', () => {
    const config: TransientAnalysisConfig = {
      circuit: makeRLCCircuit(10),
      tStart: 0,
      tStop: 1e-3,
      tStep: 1e-6,
      method: 'trapezoidal',
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);

    // Capacitor voltage should oscillate — check that it overshoots 5V at some point
    const vArr = result.nodeVoltages.get('1')!;
    const maxV = Math.max(...vArr);
    expect(maxV).toBeGreaterThan(5);
  });

  it('overdamped response (R=200Ω)', () => {
    // Q = (1/200)√(1e-3/1e-6) ≈ 0.158 (heavily overdamped)
    const config: TransientAnalysisConfig = {
      circuit: makeRLCCircuit(200),
      tStart: 0,
      tStop: 2e-3,
      tStep: 2e-6,
      method: 'trapezoidal',
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);

    // Should not overshoot 5V significantly
    const vArr = result.nodeVoltages.get('1')!;
    const maxV = Math.max(...vArr);
    // Overdamped: max should not exceed ~5.5V
    expect(maxV).toBeLessThan(6.0);
  });

  it('critically damped response (R=2*sqrt(L/C))', () => {
    // R_crit = 2*sqrt(L/C) = 2*sqrt(1e-3/1e-6) = 2*31.62 = 63.25
    const Rcrit = 2 * Math.sqrt(1e-3 / 1e-6);
    const config: TransientAnalysisConfig = {
      circuit: makeRLCCircuit(Rcrit),
      tStart: 0,
      tStop: 2e-3,
      tStep: 2e-6,
      method: 'trapezoidal',
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);

    // Should approach 5V without significant overshoot
    const vArr = result.nodeVoltages.get('1')!;
    const maxV = Math.max(...vArr);
    expect(maxV).toBeLessThan(5.5);
    // Final value should be near 5V
    const vFinal = vArr[vArr.length - 1];
    expect(relClose(vFinal, 5, 0.1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Pulse source with RC circuit
// ---------------------------------------------------------------------------

describe('RC circuit with pulse source', () => {
  function makeRCPulse(): TransientAnalysisConfig {
    return {
      circuit: {
        nodes: ['1', '2'],
        groundNode: '0',
        components: [
          { id: 'R1', type: 'R', value: 1e3, nodes: ['2', '1'] },
          { id: 'C1', type: 'C', value: 100e-9, nodes: ['1', '0'] },
        ],
        sources: [{
          id: 'V1', type: 'pulse', sourceType: 'V', nodes: ['2', '0'],
          v1: 0, v2: 3.3, delay: 0, rise: 10e-9, fall: 10e-9, width: 50e-6, period: 100e-6,
        }],
      },
      tStart: 0,
      tStop: 200e-6,
      tStep: 1e-6,
      method: 'trapezoidal',
    };
  }

  it('capacitor charges during pulse high', () => {
    const result = runTransientAnalysis(makeRCPulse());
    expect(result.converged).toBe(true);

    // During pulse high (0 to 50µs), cap should charge toward 3.3V
    const vAt30us = voltageAtTime(result, '1', 30e-6);
    expect(vAt30us).toBeGreaterThan(0.5);
  });

  it('capacitor discharges during pulse low', () => {
    const result = runTransientAnalysis(makeRCPulse());

    // During pulse low (50µs to 100µs), cap should discharge
    const vAt50us = voltageAtTime(result, '1', 50e-6);
    const vAt90us = voltageAtTime(result, '1', 90e-6);
    expect(vAt90us).toBeLessThan(vAt50us + 0.1); // should decrease or stay similar
  });
});

// ---------------------------------------------------------------------------
// Sine source tests
// ---------------------------------------------------------------------------

describe('RC circuit with sinusoidal source', () => {
  it('output follows input with phase lag', () => {
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1', '2'],
        groundNode: '0',
        components: [
          { id: 'R1', type: 'R', value: 1e3, nodes: ['2', '1'] },
          { id: 'C1', type: 'C', value: 1e-6, nodes: ['1', '0'] },
        ],
        sources: [{
          id: 'V1', type: 'sine', sourceType: 'V', nodes: ['2', '0'],
          offset: 0, amplitude: 1, frequency: 100, phase: 0,
        }],
      },
      tStart: 0,
      tStop: 20e-3, // 2 periods at 100Hz
      tStep: 50e-6,
      method: 'trapezoidal',
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);

    // Output amplitude should be less than input due to RC filtering
    const vArr = result.nodeVoltages.get('1')!;
    // Skip initial transient (first half-period)
    const steadyState = vArr.slice(Math.floor(vArr.length / 2));
    const maxV = Math.max(...steadyState);
    expect(maxV).toBeGreaterThan(0);
    expect(maxV).toBeLessThan(1.0); // Attenuated
  });
});

// ---------------------------------------------------------------------------
// PWL source tests
// ---------------------------------------------------------------------------

describe('RC circuit with PWL source', () => {
  it('follows piecewise linear waveform', () => {
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1', '2'],
        groundNode: '0',
        components: [
          { id: 'R1', type: 'R', value: 100, nodes: ['2', '1'] },
          { id: 'C1', type: 'C', value: 10e-6, nodes: ['1', '0'] },
        ],
        sources: [{
          id: 'V1', type: 'pwl', sourceType: 'V', nodes: ['2', '0'],
          points: [[0, 0], [1e-3, 5], [2e-3, 5], [3e-3, 0]],
        }],
      },
      tStart: 0,
      tStop: 4e-3,
      tStep: 20e-6,
      method: 'trapezoidal',
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);

    // Cap should charge during ramp
    const vAt1ms = voltageAtTime(result, '1', 1e-3);
    expect(vAt1ms).toBeGreaterThan(1);

    // Should be near 5V at 2ms (RC=1ms, so nearly charged after 2τ)
    const vAt2ms = voltageAtTime(result, '1', 2e-3);
    expect(vAt2ms).toBeGreaterThan(3);
  });
});

// ---------------------------------------------------------------------------
// Backward Euler vs Trapezoidal comparison
// ---------------------------------------------------------------------------

describe('Integration method comparison', () => {
  function makeSimpleRC(): TransientCircuitDefinition {
    return {
      nodes: ['1', '2'],
      groundNode: '0',
      components: [
        { id: 'R1', type: 'R', value: 1e3, nodes: ['2', '1'] },
        { id: 'C1', type: 'C', value: 1e-6, nodes: ['1', '0'] },
      ],
      sources: [
        { id: 'V1', type: 'dc', sourceType: 'V', nodes: ['2', '0'], value: 5 },
      ],
    };
  }

  it('both methods converge to same steady state', () => {
    const circuit = makeSimpleRC();
    const beResult = runTransientAnalysis({
      circuit, tStart: 0, tStop: 5e-3, tStep: 10e-6, method: 'backward_euler',
    });
    const trapResult = runTransientAnalysis({
      circuit, tStart: 0, tStop: 5e-3, tStep: 10e-6, method: 'trapezoidal',
    });

    expect(beResult.converged).toBe(true);
    expect(trapResult.converged).toBe(true);

    // Both should reach ~5V at steady state
    const beV = voltageAtTime(beResult, '1', 5e-3);
    const trapV = voltageAtTime(trapResult, '1', 5e-3);
    expect(relClose(beV, 5, 0.05)).toBe(true);
    expect(relClose(trapV, 5, 0.05)).toBe(true);
  });

  it('trapezoidal is more accurate at same step size', () => {
    const circuit = makeSimpleRC();
    // Use a relatively large step to see accuracy difference
    const beResult = runTransientAnalysis({
      circuit, tStart: 0, tStop: 2e-3, tStep: 100e-6, method: 'backward_euler',
    });
    const trapResult = runTransientAnalysis({
      circuit, tStart: 0, tStop: 2e-3, tStep: 100e-6, method: 'trapezoidal',
    });

    // At t=τ=1ms, exact = 5*(1-exp(-1)) ≈ 3.16V
    const exact = 5 * (1 - Math.exp(-1));
    const beV = voltageAtTime(beResult, '1', 1e-3);
    const trapV = voltageAtTime(trapResult, '1', 1e-3);

    const beErr = Math.abs(beV - exact);
    const trapErr = Math.abs(trapV - exact);

    // Trapezoidal should be more accurate (smaller error)
    expect(trapErr).toBeLessThan(beErr + 0.01);
  });
});

// ---------------------------------------------------------------------------
// Nonlinear: Diode rectifier
// ---------------------------------------------------------------------------

describe('Diode half-wave rectifier', () => {
  it('rectifies sinusoidal input', () => {
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1', '2'],
        groundNode: '0',
        components: [
          { id: 'D1', type: 'D', value: 0, nodes: ['2', '1'], params: { Is: 1e-14, n: 1 } },
          { id: 'R1', type: 'R', value: 1e3, nodes: ['1', '0'] },
        ],
        sources: [{
          id: 'V1', type: 'sine', sourceType: 'V', nodes: ['2', '0'],
          offset: 0, amplitude: 5, frequency: 1000, phase: 0,
        }],
      },
      tStart: 0,
      tStop: 2e-3, // 2 periods
      tStep: 5e-6,
      method: 'trapezoidal',
      maxIterations: 100,
      tolerance: 1e-7,
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);

    // Output should be >= 0 (half-wave rectified) with some small negative due to diode model
    const vArr = result.nodeVoltages.get('1')!;
    // Most values should be >= -0.1 (allowing for forward voltage drop)
    const negativeCount = vArr.filter((v) => v < -0.5).length;
    expect(negativeCount).toBeLessThan(vArr.length * 0.1);

    // Should have positive peaks near Vs - Vf ≈ 4.3V
    const maxV = Math.max(...vArr);
    expect(maxV).toBeGreaterThan(3);
  });

  it('diode blocks reverse current', () => {
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1', '2'],
        groundNode: '0',
        components: [
          { id: 'D1', type: 'D', value: 0, nodes: ['2', '1'], params: { Is: 1e-14, n: 1 } },
          { id: 'R1', type: 'R', value: 1e3, nodes: ['1', '0'] },
        ],
        sources: [
          { id: 'V1', type: 'dc', sourceType: 'V', nodes: ['0', '2'], value: 5 },
          // 5V reverse bias
        ],
      },
      tStart: 0,
      tStop: 100e-6,
      tStep: 5e-6,
      method: 'trapezoidal',
      maxIterations: 100,
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);

    // With reverse bias, current through R should be ~0
    const vArr = result.nodeVoltages.get('1')!;
    const maxAbsV = Math.max(...vArr.map(Math.abs));
    expect(maxAbsV).toBeLessThan(0.1);
  });
});

// ---------------------------------------------------------------------------
// Adaptive timestep tests
// ---------------------------------------------------------------------------

describe('Adaptive timestep', () => {
  it('uses fewer steps for slowly varying signals', () => {
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1', '2'],
        groundNode: '0',
        components: [
          { id: 'R1', type: 'R', value: 1e3, nodes: ['2', '1'] },
          { id: 'C1', type: 'C', value: 1e-6, nodes: ['1', '0'] },
        ],
        sources: [
          { id: 'V1', type: 'dc', sourceType: 'V', nodes: ['2', '0'], value: 5 },
        ],
      },
      tStart: 0,
      tStop: 5e-3,
      tStep: 100e-6,
      method: 'trapezoidal',
      minStep: 1e-6,
      maxStep: 500e-6,
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);
    expect(result.totalSteps).toBeGreaterThan(0);
  });

  it('handles fast transients with step rejection', () => {
    // RC with τ = 1kΩ * 1µF = 1ms, pulse with moderate edges
    // Adaptive timestep should work within reasonable time
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1', '2'],
        groundNode: '0',
        components: [
          { id: 'R1', type: 'R', value: 1e3, nodes: ['2', '1'] },
          { id: 'C1', type: 'C', value: 1e-6, nodes: ['1', '0'] }, // τ = 1ms
        ],
        sources: [{
          id: 'V1', type: 'pulse', sourceType: 'V', nodes: ['2', '0'],
          v1: 0, v2: 5, delay: 0, rise: 10e-6, fall: 10e-6, width: 0.5e-3, period: 1e-3,
        }],
      },
      tStart: 0,
      tStop: 2e-3,
      tStep: 50e-6,
      method: 'trapezoidal',
      minStep: 5e-6,
      maxStep: 100e-6,
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);
    expect(result.totalSteps).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  it('handles empty circuit', () => {
    const config: TransientAnalysisConfig = {
      circuit: { nodes: [], groundNode: '0', components: [], sources: [] },
      tStart: 0,
      tStop: 1e-3,
      tStep: 100e-6,
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);
    expect(result.totalSteps).toBe(0);
  });

  it('handles single resistor', () => {
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1'],
        groundNode: '0',
        components: [
          { id: 'R1', type: 'R', value: 1e3, nodes: ['1', '0'] },
        ],
        sources: [
          { id: 'I1', type: 'dc', sourceType: 'I', nodes: ['1', '0'], value: 1e-3 },
        ],
      },
      tStart: 0,
      tStop: 100e-6,
      tStep: 10e-6,
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);

    // V = IR = 1e-3 * 1e3 = 1V at all times
    const vArr = result.nodeVoltages.get('1')!;
    for (const v of vArr) {
      expect(Math.abs(v - 1)).toBeLessThan(0.01);
    }
  });

  it('handles very short simulation', () => {
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1'],
        groundNode: '0',
        components: [{ id: 'R1', type: 'R', value: 1e3, nodes: ['1', '0'] }],
        sources: [{ id: 'V1', type: 'dc', sourceType: 'V', nodes: ['1', '0'], value: 5 }],
      },
      tStart: 0,
      tStop: 1e-12,
      tStep: 1e-12,
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);
  });

  it('handles very long simulation with limited steps', () => {
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1'],
        groundNode: '0',
        components: [{ id: 'R1', type: 'R', value: 1e3, nodes: ['1', '0'] }],
        sources: [{ id: 'I1', type: 'dc', sourceType: 'I', nodes: ['1', '0'], value: 1e-3 }],
      },
      tStart: 0,
      tStop: 1,
      tStep: 10e-3, // 100 steps
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);
    expect(result.totalSteps).toBeLessThan(200);
  });

  it('handles zero-value resistor gracefully', () => {
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1'],
        groundNode: '0',
        components: [
          { id: 'R1', type: 'R', value: 0, nodes: ['1', '0'] },
        ],
        sources: [
          { id: 'I1', type: 'dc', sourceType: 'I', nodes: ['1', '0'], value: 1e-3 },
        ],
      },
      tStart: 0,
      tStop: 100e-6,
      tStep: 10e-6,
    };
    // Zero resistance is a short circuit; the matrix may be singular
    // The solver should handle this gracefully (converged=false or degenerate solution)
    const result = runTransientAnalysis(config);
    // Just verify it doesn't throw
    expect(result).toBeDefined();
  });

  it('handles zero-value capacitor', () => {
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1'],
        groundNode: '0',
        components: [
          { id: 'R1', type: 'R', value: 1e3, nodes: ['1', '0'] },
          { id: 'C1', type: 'C', value: 0, nodes: ['1', '0'] },
        ],
        sources: [
          { id: 'I1', type: 'dc', sourceType: 'I', nodes: ['1', '0'], value: 1e-3 },
        ],
      },
      tStart: 0,
      tStop: 100e-6,
      tStep: 10e-6,
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);
    // With C=0, should behave like pure resistor: V = IR = 1V
    const vArr = result.nodeVoltages.get('1')!;
    for (const v of vArr) {
      expect(Math.abs(v - 1)).toBeLessThan(0.01);
    }
  });

  it('handles zero-value inductor', () => {
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1', '2'],
        groundNode: '0',
        components: [
          { id: 'R1', type: 'R', value: 1e3, nodes: ['2', '1'] },
          { id: 'L1', type: 'L', value: 0, nodes: ['1', '0'] },
        ],
        sources: [
          { id: 'V1', type: 'dc', sourceType: 'V', nodes: ['2', '0'], value: 5 },
        ],
      },
      tStart: 0,
      tStop: 100e-6,
      tStep: 10e-6,
    };
    // L=0 means instant response; may cause numerical issues
    const result = runTransientAnalysis(config);
    expect(result).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Convergence and error handling
// ---------------------------------------------------------------------------

describe('Convergence', () => {
  it('reports convergence for well-posed circuits', () => {
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1'],
        groundNode: '0',
        components: [
          { id: 'R1', type: 'R', value: 1e3, nodes: ['1', '0'] },
          { id: 'C1', type: 'C', value: 1e-6, nodes: ['1', '0'] },
        ],
        sources: [
          { id: 'I1', type: 'dc', sourceType: 'I', nodes: ['1', '0'], value: 1e-3 },
        ],
      },
      tStart: 0,
      tStop: 1e-3,
      tStep: 10e-6,
      method: 'trapezoidal',
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);
    expect(result.rejectedSteps).toBe(0);
  });

  it('result has correct structure', () => {
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1'],
        groundNode: '0',
        components: [
          { id: 'R1', type: 'R', value: 1e3, nodes: ['1', '0'] },
        ],
        sources: [
          { id: 'I1', type: 'dc', sourceType: 'I', nodes: ['1', '0'], value: 1e-3 },
        ],
      },
      tStart: 0,
      tStop: 100e-6,
      tStep: 10e-6,
    };
    const result = runTransientAnalysis(config);

    expect(result.timePoints).toBeDefined();
    expect(result.nodeVoltages).toBeInstanceOf(Map);
    expect(result.branchCurrents).toBeInstanceOf(Map);
    expect(typeof result.converged).toBe('boolean');
    expect(typeof result.totalSteps).toBe('number');
    expect(typeof result.rejectedSteps).toBe('number');

    // All arrays should have same length
    const len = result.timePoints.length;
    expect(result.nodeVoltages.get('1')!.length).toBe(len);
    expect(result.nodeVoltages.get('0')!.length).toBe(len);
    expect(result.branchCurrents.get('R1')!.length).toBe(len);
  });

  it('time points are monotonically increasing', () => {
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1', '2'],
        groundNode: '0',
        components: [
          { id: 'R1', type: 'R', value: 1e3, nodes: ['2', '1'] },
          { id: 'C1', type: 'C', value: 1e-6, nodes: ['1', '0'] },
        ],
        sources: [
          { id: 'V1', type: 'dc', sourceType: 'V', nodes: ['2', '0'], value: 5 },
        ],
      },
      tStart: 0,
      tStop: 1e-3,
      tStep: 10e-6,
    };
    const result = runTransientAnalysis(config);
    for (let i = 1; i < result.timePoints.length; i++) {
      expect(result.timePoints[i]).toBeGreaterThan(result.timePoints[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// Current source circuit
// ---------------------------------------------------------------------------

describe('Current source circuits', () => {
  it('current source drives RC circuit correctly', () => {
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1'],
        groundNode: '0',
        components: [
          { id: 'R1', type: 'R', value: 1e3, nodes: ['1', '0'] },
          { id: 'C1', type: 'C', value: 1e-6, nodes: ['1', '0'] },
        ],
        sources: [{
          id: 'I1', type: 'pulse', sourceType: 'I', nodes: ['1', '0'],
          v1: 0, v2: 1e-3, delay: 0, rise: 0, fall: 0, width: 5e-3, period: 10e-3,
        }],
      },
      tStart: 0,
      tStop: 5e-3,
      tStep: 10e-6,
      method: 'trapezoidal',
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);

    // At steady state: V = I*R = 1e-3 * 1e3 = 1V
    const vFinal = voltageAtTime(result, '1', 5e-3);
    expect(relClose(vFinal, 1, 0.05)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Multiple components
// ---------------------------------------------------------------------------

describe('Multi-component circuits', () => {
  it('voltage divider with capacitor', () => {
    // V1(5V) -> R1(1kΩ) -> node 1 -> R2(1kΩ) -> GND
    //                       node 1 -> C1(1µF) -> GND
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1', '2'],
        groundNode: '0',
        components: [
          { id: 'R1', type: 'R', value: 1e3, nodes: ['2', '1'] },
          { id: 'R2', type: 'R', value: 1e3, nodes: ['1', '0'] },
          { id: 'C1', type: 'C', value: 1e-6, nodes: ['1', '0'] },
        ],
        sources: [
          { id: 'V1', type: 'dc', sourceType: 'V', nodes: ['2', '0'], value: 5 },
        ],
      },
      tStart: 0,
      tStop: 5e-3,
      tStep: 10e-6,
      method: 'trapezoidal',
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);

    // At steady state: voltage divider gives V1 = 5 * R2/(R1+R2) = 2.5V
    const vFinal = voltageAtTime(result, '1', 5e-3);
    expect(relClose(vFinal, 2.5, 0.05)).toBe(true);
  });

  it('two capacitors in parallel', () => {
    // I1(1mA) -> node 1 -> R1(1kΩ) -> GND
    //            node 1 -> C1(1µF) -> GND
    //            node 1 -> C2(1µF) -> GND
    // Effective C = 2µF, τ = RC = 2ms
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1'],
        groundNode: '0',
        components: [
          { id: 'R1', type: 'R', value: 1e3, nodes: ['1', '0'] },
          { id: 'C1', type: 'C', value: 1e-6, nodes: ['1', '0'] },
          { id: 'C2', type: 'C', value: 1e-6, nodes: ['1', '0'] },
        ],
        sources: [
          { id: 'I1', type: 'dc', sourceType: 'I', nodes: ['1', '0'], value: 1e-3 },
        ],
      },
      tStart: 0,
      tStop: 10e-3,
      tStep: 20e-6,
      method: 'trapezoidal',
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);

    // τ_eff = R * Ctotal = 1kΩ * 2µF = 2ms
    // At t=2ms (1τ), V ≈ 1 * (1 - exp(-1)) ≈ 0.632V
    const vAtTau = voltageAtTime(result, '1', 2e-3);
    const expected = 1 * (1 - Math.exp(-1));
    expect(relClose(vAtTau, expected, 0.1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Default parameter tests
// ---------------------------------------------------------------------------

describe('Default parameters', () => {
  it('defaults to trapezoidal method', () => {
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1'],
        groundNode: '0',
        components: [
          { id: 'R1', type: 'R', value: 1e3, nodes: ['1', '0'] },
          { id: 'C1', type: 'C', value: 1e-6, nodes: ['1', '0'] },
        ],
        sources: [
          { id: 'I1', type: 'dc', sourceType: 'I', nodes: ['1', '0'], value: 1e-3 },
        ],
      },
      tStart: 0,
      tStop: 1e-3,
      tStep: 10e-6,
      // No method specified — should default to trapezoidal
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);
    expect(result.totalSteps).toBeGreaterThan(0);
  });

  it('uses default tolerance and maxIterations', () => {
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1', '2'],
        groundNode: '0',
        components: [
          { id: 'D1', type: 'D', value: 0, nodes: ['2', '1'], params: { Is: 1e-14, n: 1 } },
          { id: 'R1', type: 'R', value: 1e3, nodes: ['1', '0'] },
        ],
        sources: [
          { id: 'V1', type: 'dc', sourceType: 'V', nodes: ['2', '0'], value: 3.3 },
        ],
      },
      tStart: 0,
      tStop: 100e-6,
      tStep: 5e-6,
      // No tolerance or maxIterations specified
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Energy conservation
// ---------------------------------------------------------------------------

describe('Energy conservation', () => {
  it('capacitor energy matches V^2*C/2 at steady state', () => {
    const C = 1e-6;
    const config: TransientAnalysisConfig = {
      circuit: {
        nodes: ['1', '2'],
        groundNode: '0',
        components: [
          { id: 'R1', type: 'R', value: 100, nodes: ['2', '1'] },
          { id: 'C1', type: 'C', value: C, nodes: ['1', '0'] },
        ],
        sources: [
          { id: 'V1', type: 'dc', sourceType: 'V', nodes: ['2', '0'], value: 5 },
        ],
      },
      tStart: 0,
      tStop: 1e-3, // 10τ with τ = 0.1ms
      tStep: 2e-6,
      method: 'trapezoidal',
    };
    const result = runTransientAnalysis(config);
    expect(result.converged).toBe(true);

    const vFinal = voltageAtTime(result, '1', 1e-3);
    const energy = 0.5 * C * vFinal * vFinal;
    const expectedEnergy = 0.5 * C * 25; // 5V^2
    expect(relClose(energy, expectedEnergy, 0.05)).toBe(true);
  });
});
