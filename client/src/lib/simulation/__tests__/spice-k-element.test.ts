/**
 * Vitest tests for SPICE K Element — Mutual Inductance / Transformer (BL-0511)
 *
 * Coverage:
 *   - K element parsing (valid syntax, various coupling values)
 *   - Mutual inductance calculation (M = k * sqrt(L1 * L2))
 *   - Perfect coupling (k=1), loose coupling (k=0.5), zero coupling (k=0)
 *   - Transformer turns ratio (from inductance ratio)
 *   - MNA stamp correctness (off-diagonal terms)
 *   - Ideal transformer (1:1, 1:10, step-up, step-down)
 *   - Energy conservation check (P_primary ≈ P_secondary for k≈1)
 *   - Edge cases: k=0, k=1, very different L values, negative coupling (error), k>1 (error)
 *   - Parse errors (missing fields, invalid coupling)
 *   - AC stamp correctness (imaginary cross-coupling)
 *   - Validation against inductor map
 */

import { describe, it, expect } from 'vitest';
import {
  parseKElement,
  computeMutualInductance,
  computeMutualInductanceParams,
  stampMutualInductance,
  stampMutualInductanceAC,
  createTransformer,
  computeTransformerPower,
  idealTransformerRelations,
  validateKElement,
} from '../spice-k-element';
import type {
  KElementDef,
  InductorDef,
  TransformerModel,
} from '../spice-k-element';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOL = 1e-9;
const REL_TOL = 0.01; // 1% for physics checks

function approx(actual: number, expected: number, tolerance = TOL): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

function relApprox(actual: number, expected: number, relTol = REL_TOL): boolean {
  if (expected === 0) {
    return Math.abs(actual) < relTol;
  }
  return Math.abs((actual - expected) / expected) <= relTol;
}

/** Create a zero-filled NxN matrix. */
function createMatrix(n: number): number[][] {
  const m: number[][] = [];
  for (let i = 0; i < n; i++) {
    m.push(new Array(n).fill(0));
  }
  return m;
}

/** Create a zero-filled vector of length n. */
function createVector(n: number): number[] {
  return new Array(n).fill(0);
}

/** Create an InductorDef for testing. */
function makeInductor(name: string, node1: number, node2: number, inductance: number): InductorDef {
  return { name, node1, node2, inductance };
}

/** Build an inductor map (UPPERCASE keys) from an array of InductorDefs. */
function makeInductorMap(inductors: InductorDef[]): Map<string, InductorDef> {
  const map = new Map<string, InductorDef>();
  for (const ind of inductors) {
    map.set(ind.name.toUpperCase(), ind);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

describe('parseKElement', () => {
  it('parses basic K element statement', () => {
    const result = parseKElement('K1 L1 L2 0.99');
    expect(result.name).toBe('K1');
    expect(result.inductor1).toBe('L1');
    expect(result.inductor2).toBe('L2');
    expect(result.coupling).toBe(0.99);
  });

  it('parses K element with descriptive names', () => {
    const result = parseKElement('KXFMR LPRI LSEC 0.95');
    expect(result.name).toBe('KXFMR');
    expect(result.inductor1).toBe('LPRI');
    expect(result.inductor2).toBe('LSEC');
    expect(result.coupling).toBe(0.95);
  });

  it('parses K element with underscore names', () => {
    const result = parseKElement('K_couple L_a L_b 0.5');
    expect(result.name).toBe('K_couple');
    expect(result.inductor1).toBe('L_a');
    expect(result.inductor2).toBe('L_b');
    expect(result.coupling).toBe(0.5);
  });

  it('parses perfect coupling (k=1)', () => {
    const result = parseKElement('K1 L1 L2 1');
    expect(result.coupling).toBe(1);
  });

  it('parses zero coupling (k=0)', () => {
    const result = parseKElement('K1 L1 L2 0');
    expect(result.coupling).toBe(0);
  });

  it('parses with extra whitespace', () => {
    const result = parseKElement('  K1   L1   L2   0.75  ');
    expect(result.name).toBe('K1');
    expect(result.coupling).toBe(0.75);
  });

  it('parses coupling with scientific notation', () => {
    const result = parseKElement('K1 L1 L2 9.9e-1');
    expect(approx(result.coupling, 0.99)).toBe(true);
  });

  it('throws on empty line', () => {
    expect(() => parseKElement('')).toThrow('empty');
  });

  it('throws on whitespace-only line', () => {
    expect(() => parseKElement('   ')).toThrow('empty');
  });

  it('throws on too few tokens', () => {
    expect(() => parseKElement('K1 L1')).toThrow('4 fields');
  });

  it('throws on three tokens', () => {
    expect(() => parseKElement('K1 L1 L2')).toThrow('4 fields');
  });

  it('throws when name does not start with K', () => {
    expect(() => parseKElement('R1 L1 L2 0.5')).toThrow("start with 'K'");
  });

  it('throws when first inductor does not start with L', () => {
    expect(() => parseKElement('K1 R1 L2 0.5')).toThrow("start with 'L'");
  });

  it('throws when second inductor does not start with L', () => {
    expect(() => parseKElement('K1 L1 C2 0.5')).toThrow("start with 'L'");
  });

  it('throws on non-numeric coupling', () => {
    expect(() => parseKElement('K1 L1 L2 abc')).toThrow('must be a number');
  });

  it('throws on negative coupling', () => {
    expect(() => parseKElement('K1 L1 L2 -0.5')).toThrow('>= 0');
  });

  it('throws on coupling > 1', () => {
    expect(() => parseKElement('K1 L1 L2 1.5')).toThrow('<= 1');
  });
});

// ---------------------------------------------------------------------------
// Mutual Inductance Calculation
// ---------------------------------------------------------------------------

describe('computeMutualInductance', () => {
  it('computes M = k * sqrt(L1 * L2) for typical values', () => {
    // k=0.99, L1=10mH, L2=10mH → M = 0.99 * sqrt(0.01*0.01) = 0.99 * 0.01 = 9.9mH
    const M = computeMutualInductance(0.99, 0.01, 0.01);
    expect(approx(M, 0.0099)).toBe(true);
  });

  it('computes M for different inductance values', () => {
    // k=1, L1=1H, L2=4H → M = 1 * sqrt(4) = 2H
    const M = computeMutualInductance(1, 1, 4);
    expect(approx(M, 2)).toBe(true);
  });

  it('returns 0 for k=0 (no coupling)', () => {
    const M = computeMutualInductance(0, 1, 1);
    expect(M).toBe(0);
  });

  it('returns sqrt(L1*L2) for k=1 (perfect coupling)', () => {
    const M = computeMutualInductance(1, 0.001, 0.004);
    // M = sqrt(0.001 * 0.004) = sqrt(4e-6) = 2e-3
    expect(approx(M, 0.002)).toBe(true);
  });

  it('handles very small inductances', () => {
    // 1nH inductors, k=0.5
    const M = computeMutualInductance(0.5, 1e-9, 1e-9);
    expect(approx(M, 0.5e-9)).toBe(true);
  });

  it('handles very different L values', () => {
    // k=1, L1=1uH, L2=1H → M = sqrt(1e-6) = 1e-3
    const M = computeMutualInductance(1, 1e-6, 1);
    expect(approx(M, 0.001)).toBe(true);
  });

  it('returns 0 when either L is 0', () => {
    expect(computeMutualInductance(1, 0, 10)).toBe(0);
    expect(computeMutualInductance(1, 10, 0)).toBe(0);
  });

  it('throws on negative coupling', () => {
    expect(() => computeMutualInductance(-0.1, 1, 1)).toThrow('[0, 1]');
  });

  it('throws on coupling > 1', () => {
    expect(() => computeMutualInductance(1.01, 1, 1)).toThrow('[0, 1]');
  });

  it('throws on negative L1', () => {
    expect(() => computeMutualInductance(0.5, -1, 1)).toThrow('L1');
  });

  it('throws on negative L2', () => {
    expect(() => computeMutualInductance(0.5, 1, -1)).toThrow('L2');
  });
});

// ---------------------------------------------------------------------------
// computeMutualInductanceParams
// ---------------------------------------------------------------------------

describe('computeMutualInductanceParams', () => {
  it('computes full parameter set for coupled inductors', () => {
    const inductors = makeInductorMap([
      makeInductor('L1', 1, 2, 0.01),
      makeInductor('L2', 3, 4, 0.04),
    ]);
    const kDef: KElementDef = { name: 'K1', inductor1: 'L1', inductor2: 'L2', coupling: 1 };
    const result = computeMutualInductanceParams(kDef, inductors);

    expect(result.L1).toBe(0.01);
    expect(result.L2).toBe(0.04);
    expect(result.k).toBe(1);
    // M = 1 * sqrt(0.01 * 0.04) = sqrt(4e-4) = 0.02
    expect(approx(result.M, 0.02)).toBe(true);
    // turnsRatio = sqrt(0.01/0.04) = sqrt(0.25) = 0.5
    expect(approx(result.turnsRatio, 0.5)).toBe(true);
  });

  it('resolves case-insensitive inductor names', () => {
    const inductors = makeInductorMap([
      makeInductor('L1', 1, 0, 1),
      makeInductor('L2', 2, 0, 1),
    ]);
    const kDef: KElementDef = { name: 'K1', inductor1: 'l1', inductor2: 'l2', coupling: 0.5 };
    const result = computeMutualInductanceParams(kDef, inductors);
    expect(approx(result.M, 0.5)).toBe(true);
  });

  it('throws if first inductor not found', () => {
    const inductors = makeInductorMap([makeInductor('L2', 1, 0, 1)]);
    const kDef: KElementDef = { name: 'K1', inductor1: 'L1', inductor2: 'L2', coupling: 0.5 };
    expect(() => computeMutualInductanceParams(kDef, inductors)).toThrow('L1');
  });

  it('throws if second inductor not found', () => {
    const inductors = makeInductorMap([makeInductor('L1', 1, 0, 1)]);
    const kDef: KElementDef = { name: 'K1', inductor1: 'L1', inductor2: 'L2', coupling: 0.5 };
    expect(() => computeMutualInductanceParams(kDef, inductors)).toThrow('L2');
  });
});

// ---------------------------------------------------------------------------
// MNA Stamping (Transient)
// ---------------------------------------------------------------------------

describe('stampMutualInductance', () => {
  it('is a no-op for DC analysis (no h)', () => {
    const G = createMatrix(4);
    const b = createVector(4);
    const inductors = makeInductorMap([
      makeInductor('L1', 1, 0, 0.01),
      makeInductor('L2', 2, 0, 0.01),
    ]);
    const vsMap = new Map<string, number>([['L1', 2], ['L2', 3]]);
    const kDef: KElementDef = { name: 'K1', inductor1: 'L1', inductor2: 'L2', coupling: 0.99 };

    stampMutualInductance(G, b, kDef, inductors, vsMap);

    // All zeros — no stamps in DC
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        expect(G[i][j]).toBe(0);
      }
      expect(b[i]).toBe(0);
    }
  });

  it('stamps cross-coupling terms for transient analysis', () => {
    // Matrix: 2 nodes + 2 inductor branch vars = indices 0,1 (nodes), 2,3 (branches)
    const G = createMatrix(4);
    const b = createVector(4);
    const inductors = makeInductorMap([
      makeInductor('L1', 1, 0, 0.01),  // 10mH
      makeInductor('L2', 2, 0, 0.01),  // 10mH
    ]);
    const vsMap = new Map<string, number>([['L1', 2], ['L2', 3]]);
    const kDef: KElementDef = { name: 'K1', inductor1: 'L1', inductor2: 'L2', coupling: 1 };
    const h = 0.001; // 1ms step

    stampMutualInductance(G, b, kDef, inductors, vsMap, h);

    // M = 1 * sqrt(0.01 * 0.01) = 0.01H
    // M/h = 0.01 / 0.001 = 10
    // Cross-coupling: G[2][3] -= 10, G[3][2] -= 10
    expect(approx(G[2][3], -10)).toBe(true);
    expect(approx(G[3][2], -10)).toBe(true);

    // No stamps on node rows (0, 1) or diagonal
    expect(G[0][0]).toBe(0);
    expect(G[1][1]).toBe(0);
    expect(G[2][2]).toBe(0);
    expect(G[3][3]).toBe(0);
  });

  it('stamps history terms from previous currents', () => {
    const G = createMatrix(4);
    const b = createVector(4);
    const inductors = makeInductorMap([
      makeInductor('L1', 1, 0, 0.001),  // 1mH
      makeInductor('L2', 2, 0, 0.001),  // 1mH
    ]);
    const vsMap = new Map<string, number>([['L1', 2], ['L2', 3]]);
    const kDef: KElementDef = { name: 'K1', inductor1: 'L1', inductor2: 'L2', coupling: 0.5 };
    const h = 0.0001; // 100us
    const prevCurrents = { L1: 0.1, L2: 0.2 };

    stampMutualInductance(G, b, kDef, inductors, vsMap, h, prevCurrents);

    // M = 0.5 * sqrt(0.001 * 0.001) = 0.0005H
    // M/h = 0.0005 / 0.0001 = 5
    // b[2] -= 5 * 0.2 = -1.0
    // b[3] -= 5 * 0.1 = -0.5
    expect(approx(b[2], -1.0)).toBe(true);
    expect(approx(b[3], -0.5)).toBe(true);
  });

  it('handles zero coupling (no stamps)', () => {
    const G = createMatrix(4);
    const b = createVector(4);
    const inductors = makeInductorMap([
      makeInductor('L1', 1, 0, 0.01),
      makeInductor('L2', 2, 0, 0.01),
    ]);
    const vsMap = new Map<string, number>([['L1', 2], ['L2', 3]]);
    const kDef: KElementDef = { name: 'K1', inductor1: 'L1', inductor2: 'L2', coupling: 0 };

    stampMutualInductance(G, b, kDef, inductors, vsMap, 0.001);

    // M = 0, so no stamps
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        expect(G[i][j]).toBe(0);
      }
    }
  });

  it('returns silently if inductors not found in map', () => {
    const G = createMatrix(4);
    const b = createVector(4);
    const inductors = new Map<string, InductorDef>();
    const vsMap = new Map<string, number>([['L1', 2], ['L2', 3]]);
    const kDef: KElementDef = { name: 'K1', inductor1: 'L1', inductor2: 'L2', coupling: 0.99 };

    // Should not throw
    stampMutualInductance(G, b, kDef, inductors, vsMap, 0.001);

    // No stamps
    expect(G[2][3]).toBe(0);
  });

  it('returns silently if branch indices not found in vsMap', () => {
    const G = createMatrix(4);
    const b = createVector(4);
    const inductors = makeInductorMap([
      makeInductor('L1', 1, 0, 0.01),
      makeInductor('L2', 2, 0, 0.01),
    ]);
    const vsMap = new Map<string, number>(); // Empty — no indices
    const kDef: KElementDef = { name: 'K1', inductor1: 'L1', inductor2: 'L2', coupling: 0.99 };

    stampMutualInductance(G, b, kDef, inductors, vsMap, 0.001);
    expect(G[0][0]).toBe(0);
  });

  it('handles asymmetric inductances', () => {
    const G = createMatrix(4);
    const b = createVector(4);
    const inductors = makeInductorMap([
      makeInductor('L1', 1, 0, 0.001),  // 1mH
      makeInductor('L2', 2, 0, 0.1),    // 100mH
    ]);
    const vsMap = new Map<string, number>([['L1', 2], ['L2', 3]]);
    const kDef: KElementDef = { name: 'K1', inductor1: 'L1', inductor2: 'L2', coupling: 0.95 };
    const h = 0.001;

    stampMutualInductance(G, b, kDef, inductors, vsMap, h);

    // M = 0.95 * sqrt(0.001 * 0.1) = 0.95 * sqrt(1e-4) = 0.95 * 0.01 = 0.0095
    // M/h = 0.0095 / 0.001 = 9.5
    expect(approx(G[2][3], -9.5)).toBe(true);
    expect(approx(G[3][2], -9.5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MNA Stamping (AC / Frequency Domain)
// ---------------------------------------------------------------------------

describe('stampMutualInductanceAC', () => {
  it('stamps imaginary cross-coupling terms at given frequency', () => {
    const Gimag = createMatrix(4);
    const inductors = makeInductorMap([
      makeInductor('L1', 1, 0, 0.01),
      makeInductor('L2', 2, 0, 0.01),
    ]);
    const vsMap = new Map<string, number>([['L1', 2], ['L2', 3]]);
    const kDef: KElementDef = { name: 'K1', inductor1: 'L1', inductor2: 'L2', coupling: 1 };
    const omega = 2 * Math.PI * 1000; // 1 kHz

    stampMutualInductanceAC(Gimag, omega, kDef, inductors, vsMap);

    // M = 1 * sqrt(0.01 * 0.01) = 0.01H
    // wM = 2*pi*1000 * 0.01 = 62.832...
    const wM = omega * 0.01;
    expect(approx(Gimag[2][3], -wM, 1e-6)).toBe(true);
    expect(approx(Gimag[3][2], -wM, 1e-6)).toBe(true);
  });

  it('stamps zero for k=0', () => {
    const Gimag = createMatrix(4);
    const inductors = makeInductorMap([
      makeInductor('L1', 1, 0, 0.01),
      makeInductor('L2', 2, 0, 0.01),
    ]);
    const vsMap = new Map<string, number>([['L1', 2], ['L2', 3]]);
    const kDef: KElementDef = { name: 'K1', inductor1: 'L1', inductor2: 'L2', coupling: 0 };

    stampMutualInductanceAC(Gimag, 2 * Math.PI * 1000, kDef, inductors, vsMap);

    expect(Gimag[2][3]).toBe(0);
    expect(Gimag[3][2]).toBe(0);
  });

  it('scales with frequency', () => {
    const Gimag1 = createMatrix(4);
    const Gimag2 = createMatrix(4);
    const inductors = makeInductorMap([
      makeInductor('L1', 1, 0, 0.01),
      makeInductor('L2', 2, 0, 0.01),
    ]);
    const vsMap = new Map<string, number>([['L1', 2], ['L2', 3]]);
    const kDef: KElementDef = { name: 'K1', inductor1: 'L1', inductor2: 'L2', coupling: 0.5 };

    stampMutualInductanceAC(Gimag1, 1000, kDef, inductors, vsMap);
    stampMutualInductanceAC(Gimag2, 2000, kDef, inductors, vsMap);

    // Double the frequency → double the stamp magnitude
    expect(relApprox(Gimag2[2][3] / Gimag1[2][3], 2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Transformer Model
// ---------------------------------------------------------------------------

describe('createTransformer', () => {
  it('creates 1:1 transformer', () => {
    const t = createTransformer(0.01, 0.01, 1);
    expect(t.primary).toBe(0.01);
    expect(t.secondary).toBe(0.01);
    expect(t.coupling).toBe(1);
    expect(approx(t.turnsRatio, 1)).toBe(true);
    expect(approx(t.mutualInductance, 0.01)).toBe(true);
  });

  it('creates 1:10 step-up transformer', () => {
    // N1:N2 = 1:10, so L1:L2 = 1:100
    const t = createTransformer(0.001, 0.1, 1);
    expect(approx(t.turnsRatio, 0.1)).toBe(true); // sqrt(0.001/0.1) = sqrt(0.01) = 0.1
    expect(approx(t.mutualInductance, Math.sqrt(0.001 * 0.1))).toBe(true);
  });

  it('creates 10:1 step-down transformer', () => {
    const t = createTransformer(0.1, 0.001, 1);
    expect(approx(t.turnsRatio, 10)).toBe(true); // sqrt(0.1/0.001) = sqrt(100) = 10
  });

  it('defaults coupling to 1', () => {
    const t = createTransformer(1, 1);
    expect(t.coupling).toBe(1);
    expect(approx(t.mutualInductance, 1)).toBe(true);
  });

  it('computes mutual inductance with partial coupling', () => {
    const t = createTransformer(0.01, 0.04, 0.95);
    // M = 0.95 * sqrt(0.01 * 0.04) = 0.95 * 0.02 = 0.019
    expect(approx(t.mutualInductance, 0.019)).toBe(true);
  });

  it('throws on negative primary', () => {
    expect(() => createTransformer(-1, 1, 1)).toThrow('Primary');
  });

  it('throws on zero primary', () => {
    expect(() => createTransformer(0, 1, 1)).toThrow('Primary');
  });

  it('throws on negative secondary', () => {
    expect(() => createTransformer(1, -1, 1)).toThrow('Secondary');
  });

  it('throws on zero secondary', () => {
    expect(() => createTransformer(1, 0, 1)).toThrow('Secondary');
  });

  it('throws on coupling out of range', () => {
    expect(() => createTransformer(1, 1, -0.1)).toThrow('[0, 1]');
    expect(() => createTransformer(1, 1, 1.1)).toThrow('[0, 1]');
  });
});

// ---------------------------------------------------------------------------
// Ideal Transformer Relations
// ---------------------------------------------------------------------------

describe('idealTransformerRelations', () => {
  it('computes V2 = V1/n and I2 = I1*n for 1:1', () => {
    const model = createTransformer(1, 1, 1);
    const { V2, I2 } = idealTransformerRelations(model, 10, 1);
    expect(approx(V2, 10)).toBe(true);
    expect(approx(I2, 1)).toBe(true);
  });

  it('steps up voltage for n < 1 (step-up transformer)', () => {
    // L1=0.001, L2=0.1 → n = sqrt(0.001/0.1) = 0.1 → V2 = V1/0.1 = 10*V1
    const model = createTransformer(0.001, 0.1, 1);
    const { V2, I2 } = idealTransformerRelations(model, 1, 1);
    expect(approx(V2, 10)).toBe(true);    // 1V → 10V
    expect(approx(I2, 0.1)).toBe(true);   // 1A → 0.1A
  });

  it('steps down voltage for n > 1 (step-down transformer)', () => {
    // L1=0.1, L2=0.001 → n = sqrt(0.1/0.001) = 10 → V2 = V1/10
    const model = createTransformer(0.1, 0.001, 1);
    const { V2, I2 } = idealTransformerRelations(model, 120, 0.5);
    expect(approx(V2, 12)).toBe(true);    // 120V → 12V
    expect(approx(I2, 5)).toBe(true);     // 0.5A → 5A
  });

  it('conserves power: V1*I1 = V2*I2 for ideal transformer', () => {
    const model = createTransformer(0.01, 0.04, 1);
    const V1 = 100;
    const I1 = 2;
    const { V2, I2 } = idealTransformerRelations(model, V1, I1);
    const P1 = V1 * I1;
    const P2 = V2 * I2;
    expect(relApprox(P1, P2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Power Analysis
// ---------------------------------------------------------------------------

describe('computeTransformerPower', () => {
  it('computes power for ideal transformer (efficiency ≈ 1)', () => {
    const result = computeTransformerPower(120, 1, 12, 10);
    expect(approx(result.primaryPower, 120)).toBe(true);
    expect(approx(result.secondaryPower, 120)).toBe(true);
    expect(approx(result.efficiency, 1)).toBe(true);
    expect(approx(result.leakagePower, 0)).toBe(true);
  });

  it('computes power with leakage (efficiency < 1)', () => {
    const result = computeTransformerPower(120, 1, 12, 9); // 108W out vs 120W in
    expect(approx(result.primaryPower, 120)).toBe(true);
    expect(approx(result.secondaryPower, 108)).toBe(true);
    expect(approx(result.efficiency, 0.9)).toBe(true);
    expect(approx(result.leakagePower, 12)).toBe(true);
  });

  it('handles zero primary power', () => {
    const result = computeTransformerPower(0, 0, 0, 0);
    expect(result.efficiency).toBe(0);
    expect(result.leakagePower).toBe(0);
  });

  it('handles negative voltages (absolute power)', () => {
    const result = computeTransformerPower(-120, 1, -12, 10);
    expect(approx(result.primaryPower, 120)).toBe(true);
    expect(approx(result.secondaryPower, 120)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('validateKElement', () => {
  it('returns empty array for valid K element', () => {
    const inductors = makeInductorMap([
      makeInductor('L1', 1, 0, 0.01),
      makeInductor('L2', 2, 0, 0.01),
    ]);
    const kDef: KElementDef = { name: 'K1', inductor1: 'L1', inductor2: 'L2', coupling: 0.99 };
    expect(validateKElement(kDef, inductors)).toHaveLength(0);
  });

  it('reports missing first inductor', () => {
    const inductors = makeInductorMap([makeInductor('L2', 2, 0, 0.01)]);
    const kDef: KElementDef = { name: 'K1', inductor1: 'L1', inductor2: 'L2', coupling: 0.99 };
    const errors = validateKElement(kDef, inductors);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('L1');
  });

  it('reports missing second inductor', () => {
    const inductors = makeInductorMap([makeInductor('L1', 1, 0, 0.01)]);
    const kDef: KElementDef = { name: 'K1', inductor1: 'L1', inductor2: 'L2', coupling: 0.99 };
    const errors = validateKElement(kDef, inductors);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('L2');
  });

  it('reports both missing inductors', () => {
    const inductors = new Map<string, InductorDef>();
    const kDef: KElementDef = { name: 'K1', inductor1: 'L1', inductor2: 'L2', coupling: 0.99 };
    const errors = validateKElement(kDef, inductors);
    expect(errors).toHaveLength(2);
  });

  it('reports self-coupling', () => {
    const inductors = makeInductorMap([makeInductor('L1', 1, 0, 0.01)]);
    const kDef: KElementDef = { name: 'K1', inductor1: 'L1', inductor2: 'L1', coupling: 0.5 };
    const errors = validateKElement(kDef, inductors);
    expect(errors.some(e => e.includes('itself'))).toBe(true);
  });

  it('reports out-of-range coupling', () => {
    const inductors = makeInductorMap([
      makeInductor('L1', 1, 0, 0.01),
      makeInductor('L2', 2, 0, 0.01),
    ]);
    const kDef: KElementDef = { name: 'K1', inductor1: 'L1', inductor2: 'L2', coupling: 1.5 };
    const errors = validateKElement(kDef, inductors);
    expect(errors.some(e => e.includes('out of range'))).toBe(true);
  });

  it('accumulates multiple errors', () => {
    const inductors = new Map<string, InductorDef>();
    const kDef: KElementDef = { name: 'K1', inductor1: 'L1', inductor2: 'L1', coupling: 2 };
    const errors = validateKElement(kDef, inductors);
    // coupling out of range + L1 not found + self-coupling = 3 errors
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Physics Integration Tests
// ---------------------------------------------------------------------------

describe('Physics Integration', () => {
  it('M^2 <= L1 * L2 (Schwarz inequality)', () => {
    const L1 = 0.01;
    const L2 = 0.04;
    for (const k of [0, 0.1, 0.5, 0.9, 0.99, 1]) {
      const M = computeMutualInductance(k, L1, L2);
      expect(M * M).toBeLessThanOrEqual(L1 * L2 + TOL);
    }
  });

  it('M = sqrt(L1*L2) only when k=1', () => {
    const L1 = 0.005;
    const L2 = 0.02;
    const maxM = Math.sqrt(L1 * L2);
    const M_perfect = computeMutualInductance(1, L1, L2);
    const M_partial = computeMutualInductance(0.5, L1, L2);

    expect(approx(M_perfect, maxM)).toBe(true);
    expect(M_partial).toBeLessThan(maxM);
  });

  it('transformer turns ratio satisfies N1/N2 = sqrt(L1/L2)', () => {
    const t = createTransformer(0.016, 0.004, 1);
    // N1/N2 = sqrt(0.016/0.004) = sqrt(4) = 2
    expect(approx(t.turnsRatio, 2)).toBe(true);
  });

  it('ideal transformer conserves apparent power across multiple ratios', () => {
    const ratios = [
      { L1: 1, L2: 1 },       // 1:1
      { L1: 0.01, L2: 1 },    // 1:10
      { L1: 1, L2: 0.01 },    // 10:1
      { L1: 0.001, L2: 0.1 }, // 1:~10
    ];

    for (const { L1, L2 } of ratios) {
      const model = createTransformer(L1, L2, 1);
      const V1 = 100;
      const I1 = 2;
      const { V2, I2 } = idealTransformerRelations(model, V1, I1);
      const P1 = V1 * I1;
      const P2 = V2 * I2;
      expect(relApprox(P1, P2, 1e-9)).toBe(true);
    }
  });

  it('loose coupling reduces mutual inductance proportionally', () => {
    const L1 = 0.01;
    const L2 = 0.01;
    const M_full = computeMutualInductance(1, L1, L2);
    const M_half = computeMutualInductance(0.5, L1, L2);
    expect(relApprox(M_half / M_full, 0.5)).toBe(true);
  });
});
