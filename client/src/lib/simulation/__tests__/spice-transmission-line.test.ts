/**
 * Vitest tests for SPICE T Element — Ideal Transmission Line (BL-0513)
 *
 * Coverage:
 *   - Parsing valid T lines (standard, value multipliers, lossy, case-insensitive)
 *   - Parsing invalid T lines (empty, too few tokens, missing Z0/TD, invalid values)
 *   - Validation (Z0 > 0, TD >= 0, non-empty nodes, loss >= 0)
 *   - DC stamp (wire-through conductance pattern)
 *   - AC stamp (frequency-dependent Y-parameters, zero delay, quarter-wave, lossy)
 *   - Transient stamp + delay buffer (create, push, interpolation, Bergeron model)
 *   - Physical parameter helpers (Z0, TD, velocity, wavelength, electrical length)
 *   - Edge cases (zero delay, very high Z0, lossy attenuation, degenerate buffer)
 */

import { describe, it, expect } from 'vitest';
import {
  parseTLine,
  validateTLine,
  stampTLineDC,
  stampTLineAC,
  createDelayBuffer,
  pushDelayBuffer,
  getDelayedValue,
  stampTLineTransient,
  computeCharacteristicImpedance,
  computePropagationDelay,
  computePropagationVelocity,
  computeWavelength,
  computeElectricalLength,
} from '../spice-transmission-line';
import type { TLineDef, DelayBuffer } from '../spice-transmission-line';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a zero-filled NxN matrix. */
function zeroMatrix(n: number): number[][] {
  const m: number[][] = [];
  for (let i = 0; i < n; i++) {
    m.push(new Array(n).fill(0));
  }
  return m;
}

/** Sum of absolute values of all entries in a matrix. */
function matrixAbsSum(m: number[][]): number {
  let sum = 0;
  for (const row of m) {
    for (const val of row) {
      sum += Math.abs(val);
    }
  }
  return sum;
}

/** Check relative closeness. */
function relClose(actual: number, expected: number, tol = 0.05): boolean {
  if (expected === 0) {
    return Math.abs(actual) < tol;
  }
  return Math.abs((actual - expected) / expected) <= tol;
}

// ---------------------------------------------------------------------------
// Parsing — Valid T Lines
// ---------------------------------------------------------------------------

describe('parseTLine', () => {
  it('parses a standard T line with integer Z0 and nano-second delay', () => {
    const result = parseTLine('T1 in1 gnd1 out1 gnd2 Z0=50 TD=1n');
    expect(result.name).toBe('T1');
    expect(result.inputPlus).toBe('in1');
    expect(result.inputMinus).toBe('gnd1');
    expect(result.outputPlus).toBe('out1');
    expect(result.outputMinus).toBe('gnd2');
    expect(result.z0).toBe(50);
    expect(result.td).toBeCloseTo(1e-9, 15);
    expect(result.loss).toBe(0);
  });

  it('parses numeric node names', () => {
    const result = parseTLine('T2 1 0 2 0 Z0=75 TD=5n');
    expect(result.name).toBe('T2');
    expect(result.inputPlus).toBe('1');
    expect(result.inputMinus).toBe('0');
    expect(result.outputPlus).toBe('2');
    expect(result.outputMinus).toBe('0');
    expect(result.z0).toBe(75);
    expect(result.td).toBeCloseTo(5e-9, 15);
  });

  it('parses with various SPICE value multipliers', () => {
    // pico
    const r1 = parseTLine('T3 a b c d Z0=100 TD=500p');
    expect(r1.td).toBeCloseTo(500e-12, 15);

    // micro
    const r2 = parseTLine('T4 a b c d Z0=50 TD=1u');
    expect(r2.td).toBeCloseTo(1e-6, 12);

    // milli
    const r3 = parseTLine('T5 a b c d Z0=50 TD=2m');
    expect(r3.td).toBeCloseTo(2e-3, 9);
  });

  it('parses a lossy transmission line', () => {
    const result = parseTLine('T6 in 0 out 0 Z0=50 TD=1n LOSS=0.1');
    expect(result.z0).toBe(50);
    expect(result.td).toBeCloseTo(1e-9, 15);
    expect(result.loss).toBeCloseTo(0.1, 10);
  });

  it('parses case-insensitively on parameter names', () => {
    const result = parseTLine('T7 a b c d z0=120 td=10n');
    expect(result.z0).toBe(120);
    expect(result.td).toBeCloseTo(10e-9, 15);
  });

  it('parses with extra whitespace', () => {
    const result = parseTLine('  T8   in  gnd  out  gnd2   Z0=50   TD=1n  ');
    expect(result.name).toBe('T8');
    expect(result.z0).toBe(50);
  });

  it('parses fractional Z0', () => {
    const result = parseTLine('T9 a 0 b 0 Z0=37.5 TD=2n');
    expect(result.z0).toBeCloseTo(37.5, 10);
  });

  it('parses scientific notation', () => {
    const result = parseTLine('T10 a 0 b 0 Z0=5e1 TD=1e-9');
    expect(result.z0).toBe(50);
    expect(result.td).toBe(1e-9);
  });

  it('parses with zero delay', () => {
    const result = parseTLine('T11 a 0 b 0 Z0=50 TD=0');
    expect(result.td).toBe(0);
  });

  it('preserves node names with special characters', () => {
    const result = parseTLine('T12 net_a gnd_1 net_b gnd_2 Z0=50 TD=1n');
    expect(result.inputPlus).toBe('net_a');
    expect(result.inputMinus).toBe('gnd_1');
    expect(result.outputPlus).toBe('net_b');
    expect(result.outputMinus).toBe('gnd_2');
  });
});

// ---------------------------------------------------------------------------
// Parsing — Invalid T Lines
// ---------------------------------------------------------------------------

describe('parseTLine — errors', () => {
  it('throws on empty string', () => {
    expect(() => parseTLine('')).toThrow('T element line is empty');
  });

  it('throws on whitespace-only string', () => {
    expect(() => parseTLine('   ')).toThrow('T element line is empty');
  });

  it('throws when too few tokens', () => {
    expect(() => parseTLine('T1 a b c')).toThrow('at least 7 fields');
  });

  it('throws when name does not start with T', () => {
    expect(() => parseTLine('R1 a b c d Z0=50 TD=1n')).toThrow("must start with 'T'");
  });

  it('throws when Z0 is missing', () => {
    expect(() => parseTLine('T1 a b c d TD=1n FOO=5')).toThrow('missing required parameter Z0');
  });

  it('throws when TD is missing', () => {
    expect(() => parseTLine('T1 a b c d Z0=50 FOO=5')).toThrow('missing required parameter TD');
  });

  it('throws on invalid Z0 value', () => {
    expect(() => parseTLine('T1 a b c d Z0=abc TD=1n')).toThrow('invalid Z0');
  });

  it('throws on invalid TD value', () => {
    expect(() => parseTLine('T1 a b c d Z0=50 TD=xyz')).toThrow('invalid TD');
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('validateTLine', () => {
  const validTLine: TLineDef = {
    name: 'T1',
    inputPlus: 'in',
    inputMinus: 'gnd',
    outputPlus: 'out',
    outputMinus: 'gnd2',
    z0: 50,
    td: 1e-9,
    loss: 0,
  };

  it('returns no errors for a valid definition', () => {
    expect(validateTLine(validTLine)).toEqual([]);
  });

  it('flags Z0 <= 0', () => {
    const errors = validateTLine({ ...validTLine, z0: 0 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Z0');
  });

  it('flags negative Z0', () => {
    const errors = validateTLine({ ...validTLine, z0: -50 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Z0');
  });

  it('flags negative TD', () => {
    const errors = validateTLine({ ...validTLine, td: -1e-9 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('TD');
  });

  it('allows TD = 0', () => {
    const errors = validateTLine({ ...validTLine, td: 0 });
    expect(errors).toEqual([]);
  });

  it('flags negative loss', () => {
    const errors = validateTLine({ ...validTLine, loss: -0.5 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Loss');
  });

  it('flags empty node names', () => {
    const errors = validateTLine({ ...validTLine, inputPlus: '', outputMinus: '' });
    expect(errors.length).toBe(2);
  });

  it('flags empty element name', () => {
    const errors = validateTLine({ ...validTLine, name: '' });
    expect(errors.some((e) => e.includes('name'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DC Stamp
// ---------------------------------------------------------------------------

describe('stampTLineDC', () => {
  it('stamps large conductance between input and output nodes', () => {
    const size = 4;
    const G = zeroMatrix(size);
    const tline: TLineDef = {
      name: 'T1',
      inputPlus: 'a',
      inputMinus: '0',
      outputPlus: 'b',
      outputMinus: '0',
      z0: 50,
      td: 1e-9,
      loss: 0,
    };
    const nodeMap: Record<string, number> = { a: 1, b: 2, '0': 0 };

    stampTLineDC(G, tline, nodeMap);

    // G[0][0] should have conductance for a↔b
    expect(G[0][0]).toBeGreaterThan(1e5);
    expect(G[1][1]).toBeGreaterThan(1e5);
    // Off-diagonal should be negative (mutual)
    expect(G[0][1]).toBeLessThan(-1e5);
    expect(G[1][0]).toBeLessThan(-1e5);
  });

  it('handles ground nodes correctly', () => {
    const size = 2;
    const G = zeroMatrix(size);
    const tline: TLineDef = {
      name: 'T1',
      inputPlus: 'a',
      inputMinus: '0',
      outputPlus: 'b',
      outputMinus: '0',
      z0: 50,
      td: 1e-9,
      loss: 0,
    };
    const nodeMap: Record<string, number> = { a: 1, b: 2, '0': 0 };

    stampTLineDC(G, tline, nodeMap);

    // Both nodes connected to ground — only diagonal stamps
    expect(G[0][0]).toBeGreaterThan(0);
    expect(G[1][1]).toBeGreaterThan(0);
  });

  it('stamps all four nodes when none are ground', () => {
    const size = 4;
    const G = zeroMatrix(size);
    const tline: TLineDef = {
      name: 'T1',
      inputPlus: 'a',
      inputMinus: 'b',
      outputPlus: 'c',
      outputMinus: 'd',
      z0: 50,
      td: 1e-9,
      loss: 0,
    };
    const nodeMap: Record<string, number> = { a: 1, b: 2, c: 3, d: 4 };

    stampTLineDC(G, tline, nodeMap);

    // Matrix should not be all zeros
    expect(matrixAbsSum(G)).toBeGreaterThan(0);
    // Symmetry check
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        expect(G[i][j]).toBeCloseTo(G[j][i], 10);
      }
    }
  });

  it('produces symmetric MNA matrix', () => {
    const size = 4;
    const G = zeroMatrix(size);
    const tline: TLineDef = {
      name: 'T1',
      inputPlus: 'n1',
      inputMinus: 'n2',
      outputPlus: 'n3',
      outputMinus: 'n4',
      z0: 75,
      td: 5e-9,
      loss: 0,
    };
    const nodeMap: Record<string, number> = { n1: 1, n2: 2, n3: 3, n4: 4 };

    stampTLineDC(G, tline, nodeMap);

    for (let i = 0; i < size; i++) {
      for (let j = i + 1; j < size; j++) {
        expect(G[i][j]).toBeCloseTo(G[j][i], 10);
      }
    }
  });

  it('uses wire-through model at DC (very large conductance)', () => {
    const size = 2;
    const G = zeroMatrix(size);
    const tline: TLineDef = {
      name: 'T1',
      inputPlus: 'a',
      inputMinus: '0',
      outputPlus: 'b',
      outputMinus: '0',
      z0: 50,
      td: 1e-9,
      loss: 0,
    };
    const nodeMap: Record<string, number> = { a: 1, b: 2, '0': 0 };

    stampTLineDC(G, tline, nodeMap);

    // The conductance should be much larger than 1/Z0
    const g_z0 = 1 / 50;
    expect(G[0][0]).toBeGreaterThan(g_z0 * 100);
  });
});

// ---------------------------------------------------------------------------
// AC Stamp
// ---------------------------------------------------------------------------

describe('stampTLineAC', () => {
  it('stamps non-zero entries at non-zero frequency', () => {
    const size = 2;
    const Gr = zeroMatrix(size);
    const Gi = zeroMatrix(size);
    const tline: TLineDef = {
      name: 'T1',
      inputPlus: 'a',
      inputMinus: '0',
      outputPlus: 'b',
      outputMinus: '0',
      z0: 50,
      td: 1e-9,
      loss: 0,
    };
    const nodeMap: Record<string, number> = { a: 1, b: 2, '0': 0 };

    stampTLineAC(Gr, Gi, 1e9, tline, nodeMap);

    // At 1 GHz with 1ns delay, theta = 2*pi*1e9*1e-9 = 2*pi
    // This is a full wavelength — special case
    // In general, the matrix should have non-zero entries
    expect(matrixAbsSum(Gr) + matrixAbsSum(Gi)).toBeGreaterThan(0);
  });

  it('produces wire-through stamp at zero delay', () => {
    const size = 2;
    const Gr = zeroMatrix(size);
    const Gi = zeroMatrix(size);
    const tline: TLineDef = {
      name: 'T1',
      inputPlus: 'a',
      inputMinus: '0',
      outputPlus: 'b',
      outputMinus: '0',
      z0: 50,
      td: 0,
      loss: 0,
    };
    const nodeMap: Record<string, number> = { a: 1, b: 2, '0': 0 };

    stampTLineAC(Gr, Gi, 1e9, tline, nodeMap);

    // Should be large conductance (wire)
    expect(Gr[0][0]).toBeGreaterThan(1e5);
    expect(Gr[1][1]).toBeGreaterThan(1e5);
    // Imaginary part should be zero for a wire
    expect(matrixAbsSum(Gi)).toBe(0);
  });

  it('produces symmetric real and imaginary matrices', () => {
    const size = 4;
    const Gr = zeroMatrix(size);
    const Gi = zeroMatrix(size);
    const tline: TLineDef = {
      name: 'T1',
      inputPlus: 'a',
      inputMinus: 'b',
      outputPlus: 'c',
      outputMinus: 'd',
      z0: 50,
      td: 1e-9,
      loss: 0,
    };
    const nodeMap: Record<string, number> = { a: 1, b: 2, c: 3, d: 4 };

    stampTLineAC(Gr, Gi, 500e6, tline, nodeMap);

    // Y-parameter matrix of a reciprocal network is symmetric
    for (let i = 0; i < size; i++) {
      for (let j = i + 1; j < size; j++) {
        expect(Gr[i][j]).toBeCloseTo(Gr[j][i], 10);
        expect(Gi[i][j]).toBeCloseTo(Gi[j][i], 10);
      }
    }
  });

  it('produces quarter-wave transformer behavior at f = 1/(4*TD)', () => {
    // At quarter-wave frequency: theta = pi/2
    // Y11 = Y22 = cosh(j*pi/2) / (Z0 * sinh(j*pi/2)) = cos(pi/2) / (Z0 * j*sin(pi/2))
    //           = 0 / (Z0 * j) = 0 (real part)
    // Y12 = Y21 = -1 / (Z0 * sinh(j*pi/2)) = -1 / (Z0 * j*sin(pi/2)) = -1/(Z0*j)
    //           = j/(Z0) → real part 0, imag part 1/Z0
    const size = 2;
    const Gr = zeroMatrix(size);
    const Gi = zeroMatrix(size);
    const td = 1e-9;
    const z0 = 50;
    const tline: TLineDef = {
      name: 'T1',
      inputPlus: 'a',
      inputMinus: '0',
      outputPlus: 'b',
      outputMinus: '0',
      z0,
      td,
      loss: 0,
    };
    const nodeMap: Record<string, number> = { a: 1, b: 2, '0': 0 };

    // Quarter-wave frequency: f = 1/(4*TD)
    const f_qw = 1 / (4 * td);
    stampTLineAC(Gr, Gi, f_qw, tline, nodeMap);

    // At quarter-wave: Y11 real should be ≈ 0
    expect(Math.abs(Gr[0][0])).toBeLessThan(1e-6);
    expect(Math.abs(Gr[1][1])).toBeLessThan(1e-6);

    // Y12 imaginary should be ≈ 1/Z0 = 0.02
    // (the off-diagonal imaginary)
    const y12_imag = Gi[0][1]; // Mutual admittance imaginary part
    expect(Math.abs(Math.abs(y12_imag) - 1 / z0)).toBeLessThan(1e-6);
  });

  it('handles half-wave frequency (theta = pi)', () => {
    const size = 2;
    const Gr = zeroMatrix(size);
    const Gi = zeroMatrix(size);
    const td = 1e-9;
    const z0 = 50;
    const tline: TLineDef = {
      name: 'T1',
      inputPlus: 'a',
      inputMinus: '0',
      outputPlus: 'b',
      outputMinus: '0',
      z0,
      td,
      loss: 0,
    };
    const nodeMap: Record<string, number> = { a: 1, b: 2, '0': 0 };

    // Half-wave: f = 1/(2*TD)
    const f_hw = 1 / (2 * td);
    stampTLineAC(Gr, Gi, f_hw, tline, nodeMap);

    // At half-wave: sinh(j*pi) = j*sin(pi) ≈ 0, so B ≈ 0
    // This is a degenerate case — should fall back to wire stamp
    // The matrix should have large values (wire-through)
    expect(matrixAbsSum(Gr) + matrixAbsSum(Gi)).toBeGreaterThan(0);
  });

  it('lossy line reduces Y-parameter magnitudes', () => {
    const size = 2;
    const nodeMap: Record<string, number> = { a: 1, b: 2, '0': 0 };
    const freq = 1e9;

    // Lossless
    const Gr1 = zeroMatrix(size);
    const Gi1 = zeroMatrix(size);
    const tlineLossless: TLineDef = {
      name: 'T1',
      inputPlus: 'a',
      inputMinus: '0',
      outputPlus: 'b',
      outputMinus: '0',
      z0: 50,
      td: 2e-9,
      loss: 0,
    };
    stampTLineAC(Gr1, Gi1, freq, tlineLossless, nodeMap);
    const mag1 = matrixAbsSum(Gr1) + matrixAbsSum(Gi1);

    // Lossy
    const Gr2 = zeroMatrix(size);
    const Gi2 = zeroMatrix(size);
    const tlineLossy: TLineDef = {
      name: 'T2',
      inputPlus: 'a',
      inputMinus: '0',
      outputPlus: 'b',
      outputMinus: '0',
      z0: 50,
      td: 2e-9,
      loss: 1e9,
    };
    stampTLineAC(Gr2, Gi2, freq, tlineLossy, nodeMap);
    const mag2 = matrixAbsSum(Gr2) + matrixAbsSum(Gi2);

    // Lossy line should produce different magnitudes
    expect(mag1).not.toBeCloseTo(mag2, 1);
  });

  it('handles zero frequency as degenerate (wire-through)', () => {
    const size = 2;
    const Gr = zeroMatrix(size);
    const Gi = zeroMatrix(size);
    const tline: TLineDef = {
      name: 'T1',
      inputPlus: 'a',
      inputMinus: '0',
      outputPlus: 'b',
      outputMinus: '0',
      z0: 50,
      td: 1e-9,
      loss: 0,
    };
    const nodeMap: Record<string, number> = { a: 1, b: 2, '0': 0 };

    stampTLineAC(Gr, Gi, 0, tline, nodeMap);

    // At f=0, theta=0, sinh(0)=0 → B=0 → degenerate → wire
    expect(Gr[0][0]).toBeGreaterThan(1e5);
  });

  it('stamps with high impedance line (Z0 = 1000)', () => {
    const size = 2;
    const Gr = zeroMatrix(size);
    const Gi = zeroMatrix(size);
    const tline: TLineDef = {
      name: 'T1',
      inputPlus: 'a',
      inputMinus: '0',
      outputPlus: 'b',
      outputMinus: '0',
      z0: 1000,
      td: 1e-9,
      loss: 0,
    };
    const nodeMap: Record<string, number> = { a: 1, b: 2, '0': 0 };

    // At a frequency where theta is not degenerate
    stampTLineAC(Gr, Gi, 100e6, tline, nodeMap);

    // Higher Z0 → smaller Y-parameters (Y ~ 1/Z0)
    const totalMag = matrixAbsSum(Gr) + matrixAbsSum(Gi);
    expect(totalMag).toBeGreaterThan(0);
    expect(totalMag).toBeLessThan(1); // 1/Z0 = 0.001, so admittances are small
  });

  it('varies Y-parameters with frequency', () => {
    const size = 2;
    const nodeMap: Record<string, number> = { a: 1, b: 2, '0': 0 };
    const tline: TLineDef = {
      name: 'T1',
      inputPlus: 'a',
      inputMinus: '0',
      outputPlus: 'b',
      outputMinus: '0',
      z0: 50,
      td: 1e-9,
      loss: 0,
    };

    const results: number[] = [];
    for (const freq of [100e6, 200e6, 300e6, 400e6]) {
      const Gr = zeroMatrix(size);
      const Gi = zeroMatrix(size);
      stampTLineAC(Gr, Gi, freq, tline, nodeMap);
      results.push(Gr[0][0]);
    }

    // The real part of Y11 should change with frequency
    const allSame = results.every((v) => Math.abs(v - results[0]) < 1e-10);
    expect(allSame).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Delay Buffer
// ---------------------------------------------------------------------------

describe('createDelayBuffer', () => {
  it('creates a buffer with correct capacity', () => {
    const buf = createDelayBuffer(1e-9, 0.1e-9);
    // Need ceil(1e-9 / 0.1e-9) + 2 = 12
    expect(buf.capacity).toBeGreaterThanOrEqual(12);
    expect(buf.writeIndex).toBe(0);
    expect(buf.sampleCount).toBe(0);
    expect(buf.dt).toBe(0.1e-9);
    expect(buf.td).toBe(1e-9);
  });

  it('creates a minimum-size buffer for very small delay', () => {
    const buf = createDelayBuffer(0, 1e-9);
    expect(buf.capacity).toBeGreaterThanOrEqual(4);
  });

  it('throws on non-positive dt', () => {
    expect(() => createDelayBuffer(1e-9, 0)).toThrow('dt must be > 0');
    expect(() => createDelayBuffer(1e-9, -1)).toThrow('dt must be > 0');
  });

  it('throws on negative td', () => {
    expect(() => createDelayBuffer(-1, 1e-9)).toThrow('td must be >= 0');
  });
});

describe('pushDelayBuffer + getDelayedValue', () => {
  it('returns [0, 0] when buffer has fewer than 2 samples', () => {
    const buf = createDelayBuffer(1e-9, 0.5e-9);
    expect(getDelayedValue(buf)).toEqual([0, 0]);

    pushDelayBuffer(buf, 1.0, 0.5);
    expect(getDelayedValue(buf)).toEqual([0, 0]);
  });

  it('returns correct delayed values after filling', () => {
    // td = 2ns, dt = 1ns → need to look 2 samples back
    const buf = createDelayBuffer(2e-9, 1e-9);

    // Push samples at t=0, 1ns, 2ns, 3ns, 4ns
    pushDelayBuffer(buf, 0, 0);    // t=0
    pushDelayBuffer(buf, 1, 0.1);  // t=1ns
    pushDelayBuffer(buf, 2, 0.2);  // t=2ns
    pushDelayBuffer(buf, 3, 0.3);  // t=3ns
    pushDelayBuffer(buf, 4, 0.4);  // t=4ns

    // At t=4ns, delayed by 2ns → should get values from t=2ns
    const [v, c] = getDelayedValue(buf);
    expect(v).toBeCloseTo(2, 5);
    expect(c).toBeCloseTo(0.2, 5);
  });

  it('interpolates between samples for non-integer delay ratios', () => {
    // td = 1.5ns, dt = 1ns → need to interpolate between 1 and 2 samples back
    const buf = createDelayBuffer(1.5e-9, 1e-9);

    pushDelayBuffer(buf, 0, 0);
    pushDelayBuffer(buf, 10, 1);
    pushDelayBuffer(buf, 20, 2);
    pushDelayBuffer(buf, 30, 3);

    // At most recent (30, 3), looking 1.5 samples back:
    // Integer part = 1, frac = 0.5
    // 1 back = (20, 2), 2 back = (10, 1)
    // Interpolated: 20*(1-0.5) + 10*0.5 = 15, 2*0.5 + 1*0.5 = 1.5
    const [v, c] = getDelayedValue(buf);
    expect(v).toBeCloseTo(15, 5);
    expect(c).toBeCloseTo(1.5, 5);
  });

  it('wraps around correctly in circular buffer', () => {
    const buf = createDelayBuffer(2e-9, 1e-9);
    // capacity should be at least 4

    // Push more samples than capacity to test wrap-around
    for (let i = 0; i < 20; i++) {
      pushDelayBuffer(buf, i * 10, i * 1);
    }

    // Most recent is (190, 19), 2 samples back should be (170, 17)
    const [v, c] = getDelayedValue(buf);
    expect(v).toBeCloseTo(170, 1);
    expect(c).toBeCloseTo(17, 1);
  });

  it('handles zero delay (returns most recent value)', () => {
    const buf = createDelayBuffer(0, 1e-9);
    pushDelayBuffer(buf, 5, 0.5);
    pushDelayBuffer(buf, 10, 1.0);

    // Zero delay = 0 samples back = most recent
    const [v, c] = getDelayedValue(buf);
    expect(v).toBeCloseTo(10, 5);
    expect(c).toBeCloseTo(1.0, 5);
  });
});

// ---------------------------------------------------------------------------
// Transient Stamp
// ---------------------------------------------------------------------------

describe('stampTLineTransient', () => {
  it('stamps Z0 conductance at both ports', () => {
    const size = 2;
    const G = zeroMatrix(size);
    const b = new Array(size).fill(0);
    const z0 = 50;
    const tline: TLineDef = {
      name: 'T1',
      inputPlus: 'a',
      inputMinus: '0',
      outputPlus: 'b',
      outputMinus: '0',
      z0,
      td: 2e-9,
      loss: 0,
    };
    const nodeMap: Record<string, number> = { a: 1, b: 2, '0': 0 };

    const hist1 = createDelayBuffer(2e-9, 1e-9);
    const hist2 = createDelayBuffer(2e-9, 1e-9);

    stampTLineTransient(G, b, tline, nodeMap, hist1, hist2);

    // Each port gets G = 1/Z0 = 0.02 S
    expect(G[0][0]).toBeCloseTo(1 / z0, 10);
    expect(G[1][1]).toBeCloseTo(1 / z0, 10);
  });

  it('injects history-dependent current sources into RHS', () => {
    const size = 2;
    const G = zeroMatrix(size);
    const b = new Array(size).fill(0);
    const z0 = 50;
    const tline: TLineDef = {
      name: 'T1',
      inputPlus: 'a',
      inputMinus: '0',
      outputPlus: 'b',
      outputMinus: '0',
      z0,
      td: 2e-9,
      loss: 0,
    };
    const nodeMap: Record<string, number> = { a: 1, b: 2, '0': 0 };

    const hist1 = createDelayBuffer(2e-9, 1e-9);
    const hist2 = createDelayBuffer(2e-9, 1e-9);

    // Fill history buffers with known values
    for (let i = 0; i < 5; i++) {
      pushDelayBuffer(hist1, i * 1.0, i * 0.02);
      pushDelayBuffer(hist2, i * 2.0, i * 0.04);
    }

    stampTLineTransient(G, b, tline, nodeMap, hist1, hist2);

    // RHS should be non-zero due to history sources
    expect(Math.abs(b[0]) + Math.abs(b[1])).toBeGreaterThan(0);
  });

  it('uses wire stamp for zero delay', () => {
    const size = 2;
    const G = zeroMatrix(size);
    const b = new Array(size).fill(0);
    const tline: TLineDef = {
      name: 'T1',
      inputPlus: 'a',
      inputMinus: '0',
      outputPlus: 'b',
      outputMinus: '0',
      z0: 50,
      td: 0,
      loss: 0,
    };
    const nodeMap: Record<string, number> = { a: 1, b: 2, '0': 0 };

    const hist1 = createDelayBuffer(0, 1e-9);
    const hist2 = createDelayBuffer(0, 1e-9);

    stampTLineTransient(G, b, tline, nodeMap, hist1, hist2);

    // Should be large conductance (wire)
    expect(G[0][0]).toBeGreaterThan(1e5);
  });

  it('applies attenuation for lossy lines', () => {
    const size = 2;
    const nodeMap: Record<string, number> = { a: 1, b: 2, '0': 0 };
    const td = 2e-9;
    const z0 = 50;

    // Fill same history for both
    const fill = (buf: DelayBuffer) => {
      for (let i = 0; i < 5; i++) {
        pushDelayBuffer(buf, 10, 0.2);
      }
    };

    // Lossless
    const G1 = zeroMatrix(size);
    const b1 = new Array(size).fill(0);
    const h1a = createDelayBuffer(td, 1e-9);
    const h1b = createDelayBuffer(td, 1e-9);
    fill(h1a);
    fill(h1b);
    stampTLineTransient(
      G1,
      b1,
      { name: 'T1', inputPlus: 'a', inputMinus: '0', outputPlus: 'b', outputMinus: '0', z0, td, loss: 0 },
      nodeMap,
      h1a,
      h1b,
    );

    // Lossy
    const G2 = zeroMatrix(size);
    const b2 = new Array(size).fill(0);
    const h2a = createDelayBuffer(td, 1e-9);
    const h2b = createDelayBuffer(td, 1e-9);
    fill(h2a);
    fill(h2b);
    stampTLineTransient(
      G2,
      b2,
      { name: 'T2', inputPlus: 'a', inputMinus: '0', outputPlus: 'b', outputMinus: '0', z0, td, loss: 1e9 },
      nodeMap,
      h2a,
      h2b,
    );

    // The RHS current sources should be attenuated in the lossy case
    // G stamps are the same (1/Z0), but b values differ
    expect(G1[0][0]).toBeCloseTo(G2[0][0], 10);
    expect(Math.abs(b2[0])).toBeLessThan(Math.abs(b1[0]));
  });

  it('stamps all four non-ground nodes', () => {
    const size = 4;
    const G = zeroMatrix(size);
    const b = new Array(size).fill(0);
    const tline: TLineDef = {
      name: 'T1',
      inputPlus: 'a',
      inputMinus: 'b',
      outputPlus: 'c',
      outputMinus: 'd',
      z0: 50,
      td: 1e-9,
      loss: 0,
    };
    const nodeMap: Record<string, number> = { a: 1, b: 2, c: 3, d: 4 };

    const hist1 = createDelayBuffer(1e-9, 0.5e-9);
    const hist2 = createDelayBuffer(1e-9, 0.5e-9);
    for (let i = 0; i < 5; i++) {
      pushDelayBuffer(hist1, 5, 0.1);
      pushDelayBuffer(hist2, 5, 0.1);
    }

    stampTLineTransient(G, b, tline, nodeMap, hist1, hist2);

    // Check that all relevant entries are non-zero
    expect(G[0][0]).toBeGreaterThan(0);
    expect(G[1][1]).toBeGreaterThan(0);
    expect(G[2][2]).toBeGreaterThan(0);
    expect(G[3][3]).toBeGreaterThan(0);
    expect(G[0][1]).toBeLessThan(0);
    expect(G[2][3]).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// Physical Parameter Helpers
// ---------------------------------------------------------------------------

describe('computeCharacteristicImpedance', () => {
  it('computes Z0 = sqrt(L/C) for typical PCB trace', () => {
    // Typical microstrip: L ≈ 400 nH/m, C ≈ 160 pF/m → Z0 = 50 ohm
    const L = 400e-9; // H/m
    const C = 160e-12; // F/m
    const z0 = computeCharacteristicImpedance(L, C);
    expect(z0).toBeCloseTo(50, 0);
  });

  it('computes Z0 for coaxial cable (75 ohm)', () => {
    // RG-6: L ≈ 345 nH/m, C ≈ 61.3 pF/m → Z0 ≈ 75
    const L = 345e-9;
    const C = 61.3e-12;
    const z0 = computeCharacteristicImpedance(L, C);
    expect(relClose(z0, 75, 0.02)).toBe(true);
  });

  it('throws on non-positive L', () => {
    expect(() => computeCharacteristicImpedance(0, 1e-12)).toThrow('L per meter must be > 0');
    expect(() => computeCharacteristicImpedance(-1, 1e-12)).toThrow('L per meter must be > 0');
  });

  it('throws on non-positive C', () => {
    expect(() => computeCharacteristicImpedance(1e-9, 0)).toThrow('C per meter must be > 0');
  });
});

describe('computePropagationDelay', () => {
  it('computes TD = length * sqrt(L*C)', () => {
    const L = 400e-9;
    const C = 160e-12;
    const length = 0.1; // 10 cm
    const td = computePropagationDelay(L, C, length);
    // sqrt(400e-9 * 160e-12) = sqrt(64e-21) = 8e-10.5 ≈ 2.53e-10
    // TD = 0.1 * 2.53e-10 ≈ 2.53e-11
    // Actually sqrt(400e-9 * 160e-12) = sqrt(6.4e-17) ≈ 2.53e-8.5 ≈ 8e-9
    // TD = 0.1 * 8e-9 = 8e-10 = 0.8 ns
    const expected = length * Math.sqrt(L * C);
    expect(td).toBeCloseTo(expected, 15);
  });

  it('returns 0 for zero length', () => {
    expect(computePropagationDelay(400e-9, 160e-12, 0)).toBe(0);
  });

  it('throws on non-positive L', () => {
    expect(() => computePropagationDelay(0, 1e-12, 1)).toThrow('L per meter must be > 0');
  });

  it('throws on non-positive C', () => {
    expect(() => computePropagationDelay(1e-9, 0, 1)).toThrow('C per meter must be > 0');
  });

  it('throws on negative length', () => {
    expect(() => computePropagationDelay(1e-9, 1e-12, -1)).toThrow('Length must be >= 0');
  });
});

describe('computePropagationVelocity', () => {
  it('computes v = 1/sqrt(L*C) for free space', () => {
    // Free space: L_0 = mu_0 / (2*pi) * ln(b/a), C_0 = 2*pi*eps_0 / ln(b/a)
    // For simplicity: L*C = mu_0 * eps_0 → v = c = 3e8
    const mu0 = 4 * Math.PI * 1e-7;
    const eps0 = 8.854e-12;
    // For a line with L*C = mu0*eps0: v = 1/sqrt(L*C) = c
    const L = mu0;
    const C = eps0;
    const v = computePropagationVelocity(L, C);
    expect(relClose(v, 3e8, 0.01)).toBe(true);
  });

  it('throws on invalid inputs', () => {
    expect(() => computePropagationVelocity(0, 1e-12)).toThrow();
    expect(() => computePropagationVelocity(1e-9, -1)).toThrow();
  });
});

describe('computeWavelength', () => {
  it('computes lambda = v_p / f', () => {
    const L = 400e-9;
    const C = 160e-12;
    const freq = 1e9;
    const lambda = computeWavelength(freq, L, C);
    const vp = computePropagationVelocity(L, C);
    expect(lambda).toBeCloseTo(vp / freq, 10);
  });

  it('throws on non-positive frequency', () => {
    expect(() => computeWavelength(0, 1e-9, 1e-12)).toThrow('Frequency must be > 0');
    expect(() => computeWavelength(-1, 1e-9, 1e-12)).toThrow('Frequency must be > 0');
  });
});

describe('computeElectricalLength', () => {
  it('computes 90 degrees at quarter-wave frequency', () => {
    const td = 1e-9;
    const f_qw = 1 / (4 * td);
    const theta = computeElectricalLength(f_qw, td);
    expect(theta).toBeCloseTo(90, 5);
  });

  it('computes 180 degrees at half-wave frequency', () => {
    const td = 1e-9;
    const f_hw = 1 / (2 * td);
    const theta = computeElectricalLength(f_hw, td);
    expect(theta).toBeCloseTo(180, 5);
  });

  it('computes 360 degrees at full-wave frequency', () => {
    const td = 1e-9;
    const f_fw = 1 / td;
    const theta = computeElectricalLength(f_fw, td);
    expect(theta).toBeCloseTo(360, 5);
  });

  it('returns 0 for zero frequency', () => {
    expect(computeElectricalLength(0, 1e-9)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('very high Z0 produces small AC admittances', () => {
    const size = 2;
    const Gr = zeroMatrix(size);
    const Gi = zeroMatrix(size);
    const tline: TLineDef = {
      name: 'T1',
      inputPlus: 'a',
      inputMinus: '0',
      outputPlus: 'b',
      outputMinus: '0',
      z0: 1e6, // 1 Mohm
      td: 1e-9,
      loss: 0,
    };
    const nodeMap: Record<string, number> = { a: 1, b: 2, '0': 0 };

    stampTLineAC(Gr, Gi, 100e6, tline, nodeMap);

    // Y ~ 1/Z0 = 1e-6 → very small
    const total = matrixAbsSum(Gr) + matrixAbsSum(Gi);
    expect(total).toBeLessThan(0.01);
    expect(total).toBeGreaterThan(0);
  });

  it('parseTLine with mixed case parameters', () => {
    const result = parseTLine('T1 a 0 b 0 z0=50 Td=1n Loss=0.1');
    expect(result.z0).toBe(50);
    expect(result.td).toBeCloseTo(1e-9, 15);
    expect(result.loss).toBeCloseTo(0.1, 10);
  });

  it('delay buffer handles large sample counts without overflow', () => {
    const buf = createDelayBuffer(5e-9, 1e-9);

    // Push 10000 samples
    for (let i = 0; i < 10000; i++) {
      pushDelayBuffer(buf, Math.sin(i * 0.01), Math.cos(i * 0.01));
    }

    // Should still return valid values
    const [v, c] = getDelayedValue(buf);
    expect(Number.isFinite(v)).toBe(true);
    expect(Number.isFinite(c)).toBe(true);
  });

  it('transient stamp with zero-filled history produces zero RHS', () => {
    const size = 2;
    const G = zeroMatrix(size);
    const b = new Array(size).fill(0);
    const tline: TLineDef = {
      name: 'T1',
      inputPlus: 'a',
      inputMinus: '0',
      outputPlus: 'b',
      outputMinus: '0',
      z0: 50,
      td: 1e-9,
      loss: 0,
    };
    const nodeMap: Record<string, number> = { a: 1, b: 2, '0': 0 };

    const hist1 = createDelayBuffer(1e-9, 0.5e-9);
    const hist2 = createDelayBuffer(1e-9, 0.5e-9);
    // Push zero values
    for (let i = 0; i < 5; i++) {
      pushDelayBuffer(hist1, 0, 0);
      pushDelayBuffer(hist2, 0, 0);
    }

    stampTLineTransient(G, b, tline, nodeMap, hist1, hist2);

    // RHS should be zero when all history is zero
    expect(b[0]).toBeCloseTo(0, 10);
    expect(b[1]).toBeCloseTo(0, 10);
    // But conductance should still be stamped
    expect(G[0][0]).toBeCloseTo(1 / 50, 10);
  });

  it('validateTLine catches multiple errors simultaneously', () => {
    const errors = validateTLine({
      name: '',
      inputPlus: '',
      inputMinus: 'b',
      outputPlus: 'c',
      outputMinus: '',
      z0: -10,
      td: -1,
      loss: -0.5,
    });
    // Should have errors for: name, inputPlus, outputMinus, Z0, TD, loss
    expect(errors.length).toBe(6);
  });
});
