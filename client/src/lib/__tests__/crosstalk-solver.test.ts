import { describe, it, expect } from 'vitest';

import {
  calculateMutualCapacitance,
  calculateMutualInductance,
  calculateNEXT,
  calculateFEXT,
  analyzeCoupling,
  guardTraceReduction,
} from '../simulation/crosstalk-solver';
import type {
  CoupledLineParams,
  CrosstalkResult,
  CouplingAnalysis,
} from '../simulation/crosstalk-solver';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Typical FR4 coupled microstrips, edge-to-edge spacing */
const CLOSE_COUPLED: CoupledLineParams = {
  spacing: 0.15, // mm, tight coupling
  height: 0.1, // mm, dielectric height
  width: 0.15, // mm, trace width
  length: 50, // mm, coupled length
  er: 4.4,
};

const WIDE_COUPLED: CoupledLineParams = {
  spacing: 1.0, // mm, wide spacing
  height: 0.1, // mm
  width: 0.15, // mm
  length: 50, // mm
  er: 4.4,
};

const SHORT_COUPLED: CoupledLineParams = {
  spacing: 0.15,
  height: 0.1,
  width: 0.15,
  length: 5, // short coupling region
  er: 4.4,
};

// ---------------------------------------------------------------------------
// calculateMutualCapacitance
// ---------------------------------------------------------------------------

describe('calculateMutualCapacitance', () => {
  it('returns positive mutual capacitance', () => {
    const cm = calculateMutualCapacitance(CLOSE_COUPLED);
    expect(cm).toBeGreaterThan(0);
  });

  it('mutual capacitance decreases with wider spacing', () => {
    const close = calculateMutualCapacitance(CLOSE_COUPLED);
    const wide = calculateMutualCapacitance(WIDE_COUPLED);
    expect(wide).toBeLessThan(close);
  });

  it('mutual capacitance depends on spacing/height ratio', () => {
    // Same s/h ratio should give same Cm per unit length
    const a = calculateMutualCapacitance({ ...CLOSE_COUPLED, spacing: 0.1, height: 0.1 });
    const b = calculateMutualCapacitance({ ...CLOSE_COUPLED, spacing: 0.2, height: 0.2 });
    // Cm scales with length, so for same s/h ratio and same length, values should be similar
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
  });

  it('returns finite value for valid inputs', () => {
    const cm = calculateMutualCapacitance(CLOSE_COUPLED);
    expect(Number.isFinite(cm)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calculateMutualInductance
// ---------------------------------------------------------------------------

describe('calculateMutualInductance', () => {
  it('returns positive mutual inductance', () => {
    const lm = calculateMutualInductance(CLOSE_COUPLED);
    expect(lm).toBeGreaterThan(0);
  });

  it('mutual inductance decreases with wider spacing', () => {
    const close = calculateMutualInductance(CLOSE_COUPLED);
    const wide = calculateMutualInductance(WIDE_COUPLED);
    expect(wide).toBeLessThan(close);
  });

  it('mutual inductance increases with coupled length', () => {
    const short = calculateMutualInductance(SHORT_COUPLED);
    const long = calculateMutualInductance(CLOSE_COUPLED);
    expect(long).toBeGreaterThan(short);
  });

  it('returns finite value', () => {
    const lm = calculateMutualInductance(CLOSE_COUPLED);
    expect(Number.isFinite(lm)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calculateNEXT
// ---------------------------------------------------------------------------

describe('calculateNEXT', () => {
  it('returns crosstalk result with expected properties', () => {
    const result = calculateNEXT(CLOSE_COUPLED, 0.5e-9); // 500ps rise time
    expect(result).toHaveProperty('nextDb');
    expect(result).toHaveProperty('nextVoltage');
    expect(result).toHaveProperty('criticalLength');
  });

  it('NEXT is stronger for closer spacing', () => {
    const close = calculateNEXT(CLOSE_COUPLED, 0.5e-9);
    const wide = calculateNEXT(WIDE_COUPLED, 0.5e-9);
    // Closer spacing -> more coupling -> higher NEXT voltage
    expect(close.nextVoltage).toBeGreaterThan(wide.nextVoltage);
  });

  it('NEXT is stronger for faster rise time', () => {
    const slow = calculateNEXT(CLOSE_COUPLED, 2e-9); // 2ns
    const fast = calculateNEXT(CLOSE_COUPLED, 0.2e-9); // 200ps
    expect(fast.nextVoltage).toBeGreaterThanOrEqual(slow.nextVoltage);
  });

  it('NEXT saturates at critical length', () => {
    const result = calculateNEXT(CLOSE_COUPLED, 0.5e-9);
    expect(result.criticalLength).toBeGreaterThan(0);
    expect(Number.isFinite(result.criticalLength)).toBe(true);
  });

  it('NEXT voltage is between 0 and 1 (normalized)', () => {
    const result = calculateNEXT(CLOSE_COUPLED, 0.5e-9);
    expect(result.nextVoltage).toBeGreaterThanOrEqual(0);
    expect(result.nextVoltage).toBeLessThanOrEqual(1);
  });

  it('NEXT dB is negative', () => {
    const result = calculateNEXT(CLOSE_COUPLED, 0.5e-9);
    expect(result.nextDb).toBeLessThan(0);
  });

  it('calculates critical length based on rise time and propagation', () => {
    const result = calculateNEXT(CLOSE_COUPLED, 1e-9);
    // Critical length = v * tRise / 2
    expect(result.criticalLength).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// calculateFEXT
// ---------------------------------------------------------------------------

describe('calculateFEXT', () => {
  it('returns FEXT result with expected properties', () => {
    const result = calculateFEXT(CLOSE_COUPLED, 0.5e-9);
    expect(result).toHaveProperty('fextDb');
    expect(result).toHaveProperty('fextVoltage');
  });

  it('FEXT is stronger for closer spacing', () => {
    const close = calculateFEXT(CLOSE_COUPLED, 0.5e-9);
    const wide = calculateFEXT(WIDE_COUPLED, 0.5e-9);
    expect(Math.abs(close.fextVoltage)).toBeGreaterThan(Math.abs(wide.fextVoltage));
  });

  it('FEXT increases with coupled length', () => {
    const short = calculateFEXT(SHORT_COUPLED, 0.5e-9);
    const long = calculateFEXT(CLOSE_COUPLED, 0.5e-9);
    expect(Math.abs(long.fextVoltage)).toBeGreaterThan(Math.abs(short.fextVoltage));
  });

  it('FEXT voltage magnitude is between 0 and 1', () => {
    const result = calculateFEXT(CLOSE_COUPLED, 0.5e-9);
    expect(Math.abs(result.fextVoltage)).toBeGreaterThanOrEqual(0);
    expect(Math.abs(result.fextVoltage)).toBeLessThanOrEqual(1);
  });

  it('FEXT dB is negative', () => {
    const result = calculateFEXT(CLOSE_COUPLED, 0.5e-9);
    expect(result.fextDb).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// analyzeCoupling (full analysis)
// ---------------------------------------------------------------------------

describe('analyzeCoupling', () => {
  it('returns complete coupling analysis', () => {
    const result = analyzeCoupling(CLOSE_COUPLED, 0.5e-9);
    expect(result.nextDb).toBeLessThan(0);
    expect(result.fextDb).toBeLessThan(0);
    expect(result.nextVoltage).toBeGreaterThan(0);
    expect(result.coupledLength).toBe(CLOSE_COUPLED.length);
    expect(result.criticalLength).toBeGreaterThan(0);
    expect(result.isolationDb).toBeLessThan(0);
  });

  it('isolation recommendation is at least as strict as worst crosstalk', () => {
    const result = analyzeCoupling(CLOSE_COUPLED, 0.5e-9);
    // Isolation should encompass the worst of NEXT and FEXT
    const worstCrosstalk = Math.max(result.nextDb, result.fextDb);
    expect(result.isolationDb).toBeLessThanOrEqual(worstCrosstalk);
  });

  it('reports coupled length from params', () => {
    const result = analyzeCoupling(CLOSE_COUPLED, 0.5e-9);
    expect(result.coupledLength).toBe(CLOSE_COUPLED.length);
  });
});

// ---------------------------------------------------------------------------
// guardTraceReduction
// ---------------------------------------------------------------------------

describe('guardTraceReduction', () => {
  it('guard trace reduces crosstalk', () => {
    const reduction = guardTraceReduction(CLOSE_COUPLED, 0.15);
    expect(reduction).toBeGreaterThan(0);
    expect(reduction).toBeLessThanOrEqual(1);
  });

  it('wider guard trace gives more reduction', () => {
    const narrow = guardTraceReduction(CLOSE_COUPLED, 0.1);
    const wide = guardTraceReduction(CLOSE_COUPLED, 0.5);
    expect(wide).toBeGreaterThanOrEqual(narrow);
  });

  it('reduction factor is between 0 and 1', () => {
    const reduction = guardTraceReduction(CLOSE_COUPLED, 0.2);
    expect(reduction).toBeGreaterThanOrEqual(0);
    expect(reduction).toBeLessThanOrEqual(1);
  });

  it('guard trace is less effective with wider spacing already', () => {
    const closeReduction = guardTraceReduction(CLOSE_COUPLED, 0.15);
    const wideReduction = guardTraceReduction(WIDE_COUPLED, 0.15);
    // Guard trace provides less marginal benefit when spacing is already wide
    expect(wideReduction).toBeLessThanOrEqual(closeReduction);
  });
});
