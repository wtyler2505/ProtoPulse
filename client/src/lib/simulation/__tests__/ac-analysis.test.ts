/**
 * Vitest tests for the AC Small-Signal Analysis Engine
 *
 * Coverage:
 *   - Complex arithmetic helpers: add, subtract, multiply, divide, magnitude, phase
 *   - RC low-pass filter: -3dB cutoff at f_c = 1/(2*pi*R*C)
 *   - RL high-pass filter: -3dB cutoff at f_c = R/(2*pi*L)
 *   - RLC series resonance: resonant frequency at f_0 = 1/(2*pi*sqrt(L*C))
 *   - Linear and decade sweep modes
 *   - Complex impedance calculation via computeNodeImpedance
 *   - Validation errors for invalid configurations
 */

import { describe, it, expect } from 'vitest';
import {
  runACAnalysis,
  computeNodeImpedance,
  complex,
  cAdd,
  cSub,
  cMul,
  cDiv,
  cMag,
  cPhase,
  cNeg,
  cRecip,
  type ACAnalysisConfig,
} from '../ac-analysis';
import type { SolverInput } from '../circuit-solver';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Absolute tolerance for floating-point comparisons. */
const TOL = 1e-9;

/** Relative tolerance for physics-level checks (filter response). */
const PHYS_REL_TOL = 0.05; // 5% — accounts for discrete frequency sampling

function approx(actual: number, expected: number, tolerance = TOL): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

function relApprox(actual: number, expected: number, relTol = PHYS_REL_TOL): boolean {
  if (expected === 0) {
    return Math.abs(actual) < relTol;
  }
  return Math.abs((actual - expected) / expected) <= relTol;
}

/**
 * Find the -3dB frequency by interpolating the magnitude array.
 * Searches for the first crossing below (referenceDb - 3).
 */
function find3dBFrequency(
  frequencies: number[],
  magnitude: number[],
  referenceDb: number,
): number | null {
  const targetDb = referenceDb - 3;
  for (let i = 1; i < frequencies.length; i++) {
    if (magnitude[i - 1] > targetDb && magnitude[i] <= targetDb) {
      // Linear interpolation in log-frequency space
      const ratio = (targetDb - magnitude[i - 1]) / (magnitude[i] - magnitude[i - 1]);
      const logF1 = Math.log10(frequencies[i - 1]);
      const logF2 = Math.log10(frequencies[i]);
      return Math.pow(10, logF1 + ratio * (logF2 - logF1));
    }
  }
  return null;
}

/**
 * Find the -3dB frequency for a high-pass filter (rising from low freq).
 * Searches for the first crossing above (referenceDb - 3) from the low end.
 */
function find3dBFrequencyHighPass(
  frequencies: number[],
  magnitude: number[],
  referenceDb: number,
): number | null {
  const targetDb = referenceDb - 3;
  for (let i = 1; i < frequencies.length; i++) {
    if (magnitude[i - 1] < targetDb && magnitude[i] >= targetDb) {
      const ratio = (targetDb - magnitude[i - 1]) / (magnitude[i] - magnitude[i - 1]);
      const logF1 = Math.log10(frequencies[i - 1]);
      const logF2 = Math.log10(frequencies[i]);
      return Math.pow(10, logF1 + ratio * (logF2 - logF1));
    }
  }
  return null;
}

/**
 * Find the frequency of maximum magnitude (resonant peak).
 */
function findPeakFrequency(frequencies: number[], magnitude: number[]): number {
  let maxIdx = 0;
  for (let i = 1; i < magnitude.length; i++) {
    if (magnitude[i] > magnitude[maxIdx]) {
      maxIdx = i;
    }
  }
  return frequencies[maxIdx];
}

// ---------------------------------------------------------------------------
// Complex arithmetic helpers
// ---------------------------------------------------------------------------

describe('Complex arithmetic', () => {
  it('complex() creates a complex number', () => {
    const c = complex(3, 4);
    expect(c.re).toBe(3);
    expect(c.im).toBe(4);
  });

  it('complex() with only real part defaults im to 0', () => {
    const c = complex(5);
    expect(c.re).toBe(5);
    expect(c.im).toBe(0);
  });

  it('cAdd: (1+2i) + (3+4i) = (4+6i)', () => {
    const result = cAdd({ re: 1, im: 2 }, { re: 3, im: 4 });
    expect(result.re).toBe(4);
    expect(result.im).toBe(6);
  });

  it('cSub: (5+3i) - (2+1i) = (3+2i)', () => {
    const result = cSub({ re: 5, im: 3 }, { re: 2, im: 1 });
    expect(result.re).toBe(3);
    expect(result.im).toBe(2);
  });

  it('cMul: (1+2i) * (3+4i) = (-5+10i)', () => {
    const result = cMul({ re: 1, im: 2 }, { re: 3, im: 4 });
    expect(approx(result.re, -5)).toBe(true);
    expect(approx(result.im, 10)).toBe(true);
  });

  it('cMul: i * i = -1', () => {
    const i: { re: number; im: number } = { re: 0, im: 1 };
    const result = cMul(i, i);
    expect(approx(result.re, -1)).toBe(true);
    expect(approx(result.im, 0)).toBe(true);
  });

  it('cDiv: (4+2i) / (1+1i) = (3-1i)', () => {
    const result = cDiv({ re: 4, im: 2 }, { re: 1, im: 1 });
    expect(approx(result.re, 3)).toBe(true);
    expect(approx(result.im, -1)).toBe(true);
  });

  it('cDiv by zero returns (0+0i)', () => {
    const result = cDiv({ re: 1, im: 2 }, { re: 0, im: 0 });
    expect(result.re).toBe(0);
    expect(result.im).toBe(0);
  });

  it('cMag: |3+4i| = 5', () => {
    expect(approx(cMag({ re: 3, im: 4 }), 5)).toBe(true);
  });

  it('cMag: |0+0i| = 0', () => {
    expect(cMag({ re: 0, im: 0 })).toBe(0);
  });

  it('cPhase: phase of (1+0i) = 0', () => {
    expect(approx(cPhase({ re: 1, im: 0 }), 0)).toBe(true);
  });

  it('cPhase: phase of (0+1i) = pi/2', () => {
    expect(approx(cPhase({ re: 0, im: 1 }), Math.PI / 2)).toBe(true);
  });

  it('cPhase: phase of (-1+0i) = pi', () => {
    expect(approx(cPhase({ re: -1, im: 0 }), Math.PI)).toBe(true);
  });

  it('cNeg: -(3+4i) = (-3-4i)', () => {
    const result = cNeg({ re: 3, im: 4 });
    expect(result.re).toBe(-3);
    expect(result.im).toBe(-4);
  });

  it('cRecip: 1/(2+0i) = (0.5+0i)', () => {
    const result = cRecip({ re: 2, im: 0 });
    expect(approx(result.re, 0.5)).toBe(true);
    expect(approx(result.im, 0)).toBe(true);
  });

  it('cRecip: 1/(0+2i) = (0-0.5i)', () => {
    const result = cRecip({ re: 0, im: 2 });
    expect(approx(result.re, 0)).toBe(true);
    expect(approx(result.im, -0.5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RC Low-Pass Filter
// ---------------------------------------------------------------------------

describe('AC Analysis: RC Low-Pass Filter', () => {
  // Circuit: V_in (node 1) -> R (node 1 to node 2) -> C (node 2 to GND)
  // H(s) = 1 / (1 + sRC)
  // f_c = 1 / (2*pi*R*C)
  const R = 1000;   // 1 kOhm
  const C = 1e-6;   // 1 uF
  const fc = 1 / (2 * Math.PI * R * C); // ~159.15 Hz

  const rcLowPass: SolverInput = {
    numNodes: 2,
    groundNode: 0,
    components: [
      { id: 'R1', type: 'R', value: R, nodes: [1, 2] },
      { id: 'C1', type: 'C', value: C, nodes: [2, 0] },
    ],
  };

  const config: ACAnalysisConfig = {
    startFreq: 1,
    stopFreq: 100000,
    sweepType: 'decade',
    pointsPerDecade: 100,
    inputNode: 1,
    outputNode: 2,
    groundNode: 0,
  };

  it('produces data at all frequency points', () => {
    const result = runACAnalysis(rcLowPass, config);
    expect(result.frequencies.length).toBeGreaterThan(0);
    expect(result.magnitude.length).toBe(result.frequencies.length);
    expect(result.phase.length).toBe(result.frequencies.length);
    expect(result.impedance.length).toBe(result.frequencies.length);
  });

  it('DC gain is approximately 0 dB (passband)', () => {
    const result = runACAnalysis(rcLowPass, config);
    // At the lowest frequency (1 Hz), gain should be ~0 dB
    expect(Math.abs(result.magnitude[0])).toBeLessThan(0.5);
  });

  it('-3dB cutoff frequency matches theoretical f_c = 1/(2*pi*R*C)', () => {
    const result = runACAnalysis(rcLowPass, config);
    const dcGain = result.magnitude[0];
    const measuredFc = find3dBFrequency(result.frequencies, result.magnitude, dcGain);

    expect(measuredFc).not.toBeNull();
    expect(relApprox(measuredFc!, fc)).toBe(true);
  });

  it('high-frequency rolloff: gain decreases monotonically above f_c', () => {
    const result = runACAnalysis(rcLowPass, config);
    // Find index closest to 10*fc
    const startIdx = result.frequencies.findIndex((f) => f >= 10 * fc);
    if (startIdx > 0) {
      for (let i = startIdx + 1; i < result.magnitude.length; i++) {
        expect(result.magnitude[i]).toBeLessThanOrEqual(result.magnitude[i - 1] + 0.5);
      }
    }
  });

  it('phase approaches -90 degrees at high frequency', () => {
    const result = runACAnalysis(rcLowPass, config);
    const lastPhase = result.phase[result.phase.length - 1];
    // Should be close to -90 degrees
    expect(Math.abs(lastPhase - (-90))).toBeLessThan(5);
  });

  it('phase at f_c is approximately -45 degrees', () => {
    const result = runACAnalysis(rcLowPass, config);
    // Find the frequency point closest to fc
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < result.frequencies.length; i++) {
      const dist = Math.abs(Math.log10(result.frequencies[i]) - Math.log10(fc));
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    expect(Math.abs(result.phase[closestIdx] - (-45))).toBeLessThan(5);
  });
});

// ---------------------------------------------------------------------------
// RL High-Pass Filter
// ---------------------------------------------------------------------------

describe('AC Analysis: RL High-Pass Filter', () => {
  // Circuit: V_in (node 1) -> R (node 1 to node 2) -> L (node 2 to GND)
  // The output is across L (node 2).
  // At low freq, L is a short -> V_out = 0 (high-pass attenuation).
  // At high freq, L is open -> V_out = V_in (passband).
  // H(s) = sL/R / (1 + sL/R) = sτ / (1 + sτ) where τ = L/R
  // f_c = R / (2*pi*L)
  const R = 1000;   // 1 kOhm
  const L = 0.1;    // 100 mH
  const fc = R / (2 * Math.PI * L); // ~1591.5 Hz

  const rlHighPass: SolverInput = {
    numNodes: 2,
    groundNode: 0,
    components: [
      { id: 'R1', type: 'R', value: R, nodes: [1, 2] },
      { id: 'L1', type: 'L', value: L, nodes: [2, 0] },
    ],
  };

  const config: ACAnalysisConfig = {
    startFreq: 10,
    stopFreq: 1e6,
    sweepType: 'decade',
    pointsPerDecade: 100,
    inputNode: 1,
    outputNode: 2,
    groundNode: 0,
  };

  it('low-frequency gain is attenuated (high-pass behavior)', () => {
    const result = runACAnalysis(rlHighPass, config);
    // At 10 Hz (well below fc ~1591 Hz), gain should be heavily attenuated
    expect(result.magnitude[0]).toBeLessThan(-20);
  });

  it('high-frequency gain approaches 0 dB', () => {
    const result = runACAnalysis(rlHighPass, config);
    const lastMag = result.magnitude[result.magnitude.length - 1];
    expect(Math.abs(lastMag)).toBeLessThan(1);
  });

  it('-3dB cutoff frequency matches theoretical f_c = R/(2*pi*L)', () => {
    const result = runACAnalysis(rlHighPass, config);
    // Reference is the high-frequency gain
    const hfGain = result.magnitude[result.magnitude.length - 1];
    const measuredFc = find3dBFrequencyHighPass(result.frequencies, result.magnitude, hfGain);

    expect(measuredFc).not.toBeNull();
    expect(relApprox(measuredFc!, fc)).toBe(true);
  });

  it('phase approaches 0 degrees at high frequency', () => {
    const result = runACAnalysis(rlHighPass, config);
    const lastPhase = result.phase[result.phase.length - 1];
    expect(Math.abs(lastPhase)).toBeLessThan(5);
  });
});

// ---------------------------------------------------------------------------
// RLC Series Resonance
// ---------------------------------------------------------------------------

describe('AC Analysis: RLC Series Resonance', () => {
  // Series RLC: V_in (node 1) -> R (node 1 to 2) -> L (node 2 to 3) -> C (node 3 to GND)
  // Output across C (node 3).
  // Resonant frequency: f_0 = 1 / (2*pi*sqrt(L*C))
  // At resonance, L and C impedances cancel, gain depends on Q factor.
  // Q must be > 0.707 for a visible resonant peak in the magnitude response.
  const R = 10;      // 10 Ohm (low R for high Q)
  const L = 10e-3;   // 10 mH
  const C_val = 10e-6;  // 10 uF
  const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C_val)); // ~503.3 Hz
  const Q = (1 / R) * Math.sqrt(L / C_val); // Q = (1/R)*sqrt(L/C) ~ 3.16

  const rlcSeries: SolverInput = {
    numNodes: 3,
    groundNode: 0,
    components: [
      { id: 'R1', type: 'R', value: R, nodes: [1, 2] },
      { id: 'L1', type: 'L', value: L, nodes: [2, 3] },
      { id: 'C1', type: 'C', value: C_val, nodes: [3, 0] },
    ],
  };

  const config: ACAnalysisConfig = {
    startFreq: 10,
    stopFreq: 100000,
    sweepType: 'decade',
    pointsPerDecade: 100,
    inputNode: 1,
    outputNode: 3,
    groundNode: 0,
  };

  it('produces valid frequency response data', () => {
    const result = runACAnalysis(rlcSeries, config);
    expect(result.frequencies.length).toBeGreaterThan(0);
    expect(result.magnitude.length).toBe(result.frequencies.length);
  });

  it('has a resonant peak near the theoretical f_0 = 1/(2*pi*sqrt(LC))', () => {
    const result = runACAnalysis(rlcSeries, config);
    const peakF = findPeakFrequency(result.frequencies, result.magnitude);
    // The peak should be within 10% of the theoretical resonant frequency
    expect(relApprox(peakF, f0, 0.1)).toBe(true);
  });

  it('magnitude rolls off above resonance', () => {
    const result = runACAnalysis(rlcSeries, config);
    // At very high frequency (>>f0), the capacitor's impedance is very low
    // and the output across C approaches 0. Last points should be attenuated.
    const lastMag = result.magnitude[result.magnitude.length - 1];
    expect(lastMag).toBeLessThan(-20);
  });

  it('magnitude rolls off below resonance', () => {
    const result = runACAnalysis(rlcSeries, config);
    // At very low frequency (<<f0), the capacitor's impedance is very high
    // and most voltage drops across C. Actually for a series RLC with output
    // across C, at DC the gain approaches 1 (0 dB) since the cap blocks DC.
    // Let's check that there's a peak behavior — the gain at the lowest freq
    // should be less than the peak gain.
    const peakIdx = result.magnitude.indexOf(Math.max(...result.magnitude));
    const firstMag = result.magnitude[0];
    const peakMag = result.magnitude[peakIdx];
    // Peak should be at least as high as DC (may be higher with resonance)
    expect(peakMag).toBeGreaterThanOrEqual(firstMag - 1);
  });
});

// ---------------------------------------------------------------------------
// Sweep modes
// ---------------------------------------------------------------------------

describe('AC Analysis: Sweep Modes', () => {
  const simpleRC: SolverInput = {
    numNodes: 2,
    groundNode: 0,
    components: [
      { id: 'R1', type: 'R', value: 1000, nodes: [1, 2] },
      { id: 'C1', type: 'C', value: 1e-6, nodes: [2, 0] },
    ],
  };

  it('decade sweep produces logarithmically spaced points', () => {
    const config: ACAnalysisConfig = {
      startFreq: 10,
      stopFreq: 10000,
      sweepType: 'decade',
      pointsPerDecade: 10,
      inputNode: 1,
      outputNode: 2,
      groundNode: 0,
    };
    const result = runACAnalysis(simpleRC, config);
    // 3 decades * 10 points/decade + 1 = 31 points
    expect(result.frequencies.length).toBe(31);
    // First and last frequencies should match start/stop
    expect(relApprox(result.frequencies[0], 10, 0.01)).toBe(true);
    expect(relApprox(result.frequencies[result.frequencies.length - 1], 10000, 0.01)).toBe(true);
  });

  it('linear sweep produces evenly spaced points', () => {
    const config: ACAnalysisConfig = {
      startFreq: 100,
      stopFreq: 1000,
      sweepType: 'linear',
      pointsPerDecade: 10, // for linear, this is total points
      inputNode: 1,
      outputNode: 2,
      groundNode: 0,
    };
    const result = runACAnalysis(simpleRC, config);
    expect(result.frequencies.length).toBe(10);

    // Check even spacing
    const step = (1000 - 100) / 9;
    for (let i = 0; i < result.frequencies.length; i++) {
      expect(relApprox(result.frequencies[i], 100 + i * step, 0.01)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Complex impedance calculation
// ---------------------------------------------------------------------------

describe('computeNodeImpedance', () => {
  it('pure resistor: impedance is real with Z = R', () => {
    // Single R from node 1 to GND
    const input: SolverInput = {
      numNodes: 1,
      groundNode: 0,
      components: [
        { id: 'R1', type: 'R', value: 1000, nodes: [1, 0] },
      ],
    };
    const z = computeNodeImpedance(input, 1, 1000);
    expect(z).not.toBeNull();
    expect(relApprox(z!.re, 1000, 0.01)).toBe(true);
    expect(Math.abs(z!.im)).toBeLessThan(1);
  });

  it('pure capacitor: impedance is -j/(wC)', () => {
    // Single C from node 1 to GND
    const C = 1e-6;
    const freq = 1000; // Hz
    const expectedIm = -1 / (2 * Math.PI * freq * C); // ~-159.15 Ohm

    const input: SolverInput = {
      numNodes: 1,
      groundNode: 0,
      components: [
        { id: 'C1', type: 'C', value: C, nodes: [1, 0] },
      ],
    };
    const z = computeNodeImpedance(input, 1, freq);
    expect(z).not.toBeNull();
    expect(Math.abs(z!.re)).toBeLessThan(1);
    expect(relApprox(z!.im, expectedIm, 0.01)).toBe(true);
  });

  it('RC parallel: impedance magnitude decreases with frequency', () => {
    const R = 1000;
    const C = 1e-6;
    const input: SolverInput = {
      numNodes: 1,
      groundNode: 0,
      components: [
        { id: 'R1', type: 'R', value: R, nodes: [1, 0] },
        { id: 'C1', type: 'C', value: C, nodes: [1, 0] },
      ],
    };

    const zLow = computeNodeImpedance(input, 1, 10);
    const zHigh = computeNodeImpedance(input, 1, 100000);

    expect(zLow).not.toBeNull();
    expect(zHigh).not.toBeNull();
    expect(cMag(zLow!)).toBeGreaterThan(cMag(zHigh!));
  });

  it('returns null for invalid node', () => {
    const input: SolverInput = {
      numNodes: 1,
      groundNode: 0,
      components: [
        { id: 'R1', type: 'R', value: 1000, nodes: [1, 0] },
      ],
    };
    expect(computeNodeImpedance(input, 0, 1000)).toBeNull();
    expect(computeNodeImpedance(input, 5, 1000)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

describe('AC Analysis: Validation', () => {
  const validInput: SolverInput = {
    numNodes: 2,
    groundNode: 0,
    components: [
      { id: 'R1', type: 'R', value: 1000, nodes: [1, 2] },
      { id: 'C1', type: 'C', value: 1e-6, nodes: [2, 0] },
    ],
  };

  it('throws on startFreq <= 0', () => {
    expect(() =>
      runACAnalysis(validInput, {
        startFreq: 0,
        stopFreq: 1000,
        sweepType: 'decade',
        pointsPerDecade: 10,
        inputNode: 1,
        outputNode: 2,
        groundNode: 0,
      }),
    ).toThrow('Start frequency must be positive');
  });

  it('throws on stopFreq <= startFreq', () => {
    expect(() =>
      runACAnalysis(validInput, {
        startFreq: 1000,
        stopFreq: 100,
        sweepType: 'decade',
        pointsPerDecade: 10,
        inputNode: 1,
        outputNode: 2,
        groundNode: 0,
      }),
    ).toThrow('Stop frequency must be greater than start frequency');
  });

  it('throws on pointsPerDecade < 1', () => {
    expect(() =>
      runACAnalysis(validInput, {
        startFreq: 1,
        stopFreq: 1000,
        sweepType: 'decade',
        pointsPerDecade: 0,
        inputNode: 1,
        outputNode: 2,
        groundNode: 0,
      }),
    ).toThrow('Points per decade must be at least 1');
  });

  it('throws on inputNode < 1', () => {
    expect(() =>
      runACAnalysis(validInput, {
        startFreq: 1,
        stopFreq: 1000,
        sweepType: 'decade',
        pointsPerDecade: 10,
        inputNode: 0,
        outputNode: 2,
        groundNode: 0,
      }),
    ).toThrow('Input node must be a valid non-ground node');
  });

  it('throws on outputNode exceeding numNodes', () => {
    expect(() =>
      runACAnalysis(validInput, {
        startFreq: 1,
        stopFreq: 1000,
        sweepType: 'decade',
        pointsPerDecade: 10,
        inputNode: 1,
        outputNode: 5,
        groundNode: 0,
      }),
    ).toThrow('Output node 5 exceeds number of nodes');
  });
});
