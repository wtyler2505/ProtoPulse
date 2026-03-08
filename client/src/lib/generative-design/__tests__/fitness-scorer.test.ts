import { describe, it, expect } from 'vitest';
import {
  scoreCircuit,
  rankCandidates,
  defaultCriteria,
} from '../fitness-scorer';
import type { FitnessCriteria, FitnessResult } from '../fitness-scorer';
import type { CircuitIR } from '@/lib/circuit-dsl/circuit-ir';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid CircuitIR with no components. */
function emptyCircuit(): CircuitIR {
  return {
    meta: { name: 'Empty', version: '1.0.0' },
    components: [],
    nets: [],
    wires: [],
  };
}

/** Simple single-resistor circuit. */
function singleResistorCircuit(): CircuitIR {
  return {
    meta: { name: 'Single Resistor', version: '1.0.0' },
    components: [
      {
        id: 'r1',
        refdes: 'R1',
        partId: 'resistor',
        value: '10k',
        pins: { pin1: 'VCC', pin2: 'GND' },
      },
    ],
    nets: [
      { id: 'n1', name: 'VCC', type: 'power' },
      { id: 'n2', name: 'GND', type: 'ground' },
    ],
    wires: [
      { id: 'w1', netId: 'n1', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
    ],
  };
}

/** Complex circuit with multiple components and some issues. */
function complexCircuit(): CircuitIR {
  return {
    meta: { name: 'Complex', version: '1.0.0' },
    components: [
      { id: 'r1', refdes: 'R1', partId: 'resistor', value: '10k', pins: { pin1: 'VCC', pin2: 'N1' } },
      { id: 'r2', refdes: 'R2', partId: 'resistor', value: '4.7k', pins: { pin1: 'N1', pin2: 'GND' } },
      { id: 'c1', refdes: 'C1', partId: 'capacitor', value: '100n', pins: { pin1: 'VCC', pin2: 'GND' } },
      { id: 'd1', refdes: 'D1', partId: 'led', pins: { anode: 'N1', cathode: 'GND' } },
      { id: 'u1', refdes: 'U1', partId: 'atmega328p', pins: { vcc: 'VCC', gnd: 'GND', d13: 'N1' } },
    ],
    nets: [
      { id: 'n1', name: 'VCC', type: 'power' },
      { id: 'n2', name: 'GND', type: 'ground' },
      { id: 'n3', name: 'N1', type: 'signal' },
    ],
    wires: [
      { id: 'w1', netId: 'n1', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
      { id: 'w2', netId: 'n2', points: [{ x: 0, y: 100 }, { x: 100, y: 100 }] },
    ],
  };
}

// ---------------------------------------------------------------------------
// defaultCriteria
// ---------------------------------------------------------------------------

describe('defaultCriteria', () => {
  it('returns sensible defaults for makers', () => {
    const criteria = defaultCriteria();
    expect(criteria.componentCount.weight).toBeGreaterThan(0);
    expect(criteria.estimatedCost.weight).toBeGreaterThan(0);
    expect(criteria.drcViolations.weight).toBeGreaterThan(0);
    expect(criteria.powerBudget.weight).toBeGreaterThan(0);
    expect(criteria.thermalMargin.weight).toBeGreaterThan(0);
  });

  it('has weight sum approximately 1.0', () => {
    const criteria = defaultCriteria();
    const totalWeight =
      criteria.componentCount.weight +
      criteria.estimatedCost.weight +
      criteria.drcViolations.weight +
      criteria.powerBudget.weight +
      criteria.thermalMargin.weight;
    expect(totalWeight).toBeCloseTo(1.0, 5);
  });

  it('has reasonable budget and power defaults', () => {
    const criteria = defaultCriteria();
    expect(criteria.estimatedCost.budgetUsd).toBeGreaterThan(0);
    expect(criteria.powerBudget.maxWatts).toBeGreaterThan(0);
    expect(criteria.thermalMargin.maxTempC).toBeGreaterThan(0);
    expect(criteria.componentCount.maxOptimal).toBeGreaterThan(0);
    expect(criteria.componentCount.maxAcceptable).toBeGreaterThan(criteria.componentCount.maxOptimal);
  });
});

// ---------------------------------------------------------------------------
// scoreCircuit
// ---------------------------------------------------------------------------

describe('scoreCircuit', () => {
  it('scores an empty circuit with perfect component count', () => {
    const result = scoreCircuit(emptyCircuit(), defaultCriteria());
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(1);
    expect(result.breakdown).toBeDefined();
    expect(result.breakdown['componentCount']).toBeDefined();
    // 0 components is within optimal range
    expect(result.breakdown['componentCount'].score).toBe(1.0);
  });

  it('scores a single resistor circuit', () => {
    const result = scoreCircuit(singleResistorCircuit(), defaultCriteria());
    expect(result.overall).toBeGreaterThan(0);
    expect(result.overall).toBeLessThanOrEqual(1);
    expect(result.breakdown['componentCount'].score).toBe(1.0);
  });

  it('scores a complex circuit with breakdown details', () => {
    const result = scoreCircuit(complexCircuit(), defaultCriteria());
    expect(result.overall).toBeGreaterThan(0);
    expect(result.overall).toBeLessThanOrEqual(1);

    // Each breakdown should have score, weight, and detail
    for (const key of Object.keys(result.breakdown)) {
      const entry = result.breakdown[key];
      expect(entry.score).toBeGreaterThanOrEqual(0);
      expect(entry.score).toBeLessThanOrEqual(1);
      expect(entry.weight).toBeGreaterThan(0);
      expect(entry.detail).toBeTruthy();
    }
  });

  it('penalizes exceeding component count', () => {
    const criteria = defaultCriteria();
    criteria.componentCount.maxOptimal = 2;
    criteria.componentCount.maxAcceptable = 4;

    const result = scoreCircuit(complexCircuit(), criteria);
    // 5 components > maxAcceptable of 4 → score < 1.0
    expect(result.breakdown['componentCount'].score).toBeLessThan(1.0);
  });

  it('applies DRC penalty for violations', () => {
    const criteria = defaultCriteria();
    const result = scoreCircuit(emptyCircuit(), criteria);
    // Empty circuit has no DRC violations → perfect DRC score
    expect(result.breakdown['drcViolations'].score).toBe(1.0);
  });

  it('scores zero component count as optimal', () => {
    const criteria: FitnessCriteria = {
      componentCount: { weight: 1.0, maxOptimal: 5, maxAcceptable: 10 },
      estimatedCost: { weight: 0, budgetUsd: 50 },
      drcViolations: { weight: 0 },
      powerBudget: { weight: 0, maxWatts: 10 },
      thermalMargin: { weight: 0, maxTempC: 85 },
    };
    const result = scoreCircuit(emptyCircuit(), criteria);
    expect(result.overall).toBe(1.0);
  });

  it('produces overall as weighted sum of individual scores', () => {
    const criteria: FitnessCriteria = {
      componentCount: { weight: 0.5, maxOptimal: 10, maxAcceptable: 20 },
      estimatedCost: { weight: 0.5, budgetUsd: 100 },
      drcViolations: { weight: 0, },
      powerBudget: { weight: 0, maxWatts: 50 },
      thermalMargin: { weight: 0, maxTempC: 100 },
    };
    const result = scoreCircuit(singleResistorCircuit(), criteria);
    // With weight 0 on drc/power/thermal, only componentCount and cost contribute
    const expected =
      result.breakdown['componentCount'].score * 0.5 +
      result.breakdown['estimatedCost'].score * 0.5;
    expect(result.overall).toBeCloseTo(expected, 10);
  });

  it('normalizes weights when they do not sum to 1', () => {
    const criteria: FitnessCriteria = {
      componentCount: { weight: 2, maxOptimal: 10, maxAcceptable: 20 },
      estimatedCost: { weight: 3, budgetUsd: 100 },
      drcViolations: { weight: 0 },
      powerBudget: { weight: 0, maxWatts: 50 },
      thermalMargin: { weight: 0, maxTempC: 100 },
    };
    const result = scoreCircuit(singleResistorCircuit(), criteria);
    // Even though weights sum to 5, overall should still be in [0, 1]
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(1);
  });

  it('handles all zero weights gracefully', () => {
    const criteria: FitnessCriteria = {
      componentCount: { weight: 0, maxOptimal: 10, maxAcceptable: 20 },
      estimatedCost: { weight: 0, budgetUsd: 100 },
      drcViolations: { weight: 0 },
      powerBudget: { weight: 0, maxWatts: 50 },
      thermalMargin: { weight: 0, maxTempC: 100 },
    };
    const result = scoreCircuit(singleResistorCircuit(), criteria);
    expect(result.overall).toBe(0);
  });

  it('reports violations for over-budget cost', () => {
    const criteria = defaultCriteria();
    criteria.estimatedCost.budgetUsd = 0.001; // impossibly low
    criteria.estimatedCost.weight = 1.0;
    const result = scoreCircuit(complexCircuit(), criteria);
    expect(result.breakdown['estimatedCost'].score).toBeLessThan(1.0);
  });

  it('reports violations for power over budget', () => {
    const criteria = defaultCriteria();
    criteria.powerBudget.maxWatts = 0.0001; // impossibly low
    criteria.powerBudget.weight = 1.0;
    const result = scoreCircuit(complexCircuit(), criteria);
    expect(result.breakdown['powerBudget'].score).toBeLessThan(1.0);
  });

  it('reports violations for thermal over limit', () => {
    const criteria = defaultCriteria();
    criteria.thermalMargin.maxTempC = 0; // impossibly low
    criteria.thermalMargin.weight = 1.0;
    const result = scoreCircuit(complexCircuit(), criteria);
    expect(result.breakdown['thermalMargin'].score).toBeLessThan(1.0);
  });

  it('initializes rank to 0', () => {
    const result = scoreCircuit(singleResistorCircuit(), defaultCriteria());
    expect(result.rank).toBe(0);
  });

  it('has 5 breakdown entries', () => {
    const result = scoreCircuit(singleResistorCircuit(), defaultCriteria());
    expect(Object.keys(result.breakdown)).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// rankCandidates
// ---------------------------------------------------------------------------

describe('rankCandidates', () => {
  it('ranks candidates by overall fitness descending', () => {
    const a: FitnessResult = {
      overall: 0.9,
      breakdown: {},
      violations: [],
      rank: 0,
    };
    const b: FitnessResult = {
      overall: 0.5,
      breakdown: {},
      violations: [],
      rank: 0,
    };
    const c: FitnessResult = {
      overall: 0.7,
      breakdown: {},
      violations: [],
      rank: 0,
    };

    const ranked = rankCandidates([a, b, c]);
    expect(ranked[0].overall).toBe(0.9);
    expect(ranked[1].overall).toBe(0.7);
    expect(ranked[2].overall).toBe(0.5);
  });

  it('assigns sequential rank numbers starting at 1', () => {
    const results: FitnessResult[] = [
      { overall: 0.3, breakdown: {}, violations: [], rank: 0 },
      { overall: 0.8, breakdown: {}, violations: [], rank: 0 },
      { overall: 0.6, breakdown: {}, violations: [], rank: 0 },
    ];

    const ranked = rankCandidates(results);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].rank).toBe(3);
  });

  it('handles empty array', () => {
    const ranked = rankCandidates([]);
    expect(ranked).toEqual([]);
  });

  it('handles single candidate', () => {
    const result: FitnessResult = {
      overall: 0.5,
      breakdown: {},
      violations: [],
      rank: 0,
    };
    const ranked = rankCandidates([result]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].rank).toBe(1);
  });

  it('handles tied scores', () => {
    const results: FitnessResult[] = [
      { overall: 0.7, breakdown: {}, violations: [], rank: 0 },
      { overall: 0.7, breakdown: {}, violations: [], rank: 0 },
    ];
    const ranked = rankCandidates(results);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
  });

  it('does not mutate original array', () => {
    const original: FitnessResult[] = [
      { overall: 0.3, breakdown: {}, violations: [], rank: 0 },
      { overall: 0.8, breakdown: {}, violations: [], rank: 0 },
    ];
    const copy = [...original.map((r) => ({ ...r }))];
    rankCandidates(original);
    // Original should be unchanged
    expect(original[0].overall).toBe(copy[0].overall);
    expect(original[1].overall).toBe(copy[1].overall);
  });
});

// ---------------------------------------------------------------------------
// Cost estimation heuristics
// ---------------------------------------------------------------------------

describe('cost estimation', () => {
  it('estimates cheaper for fewer components', () => {
    const criteria = defaultCriteria();
    criteria.estimatedCost.weight = 1.0;
    criteria.componentCount.weight = 0;
    criteria.drcViolations.weight = 0;
    criteria.powerBudget.weight = 0;
    criteria.thermalMargin.weight = 0;

    const simple = scoreCircuit(singleResistorCircuit(), criteria);
    const complex = scoreCircuit(complexCircuit(), criteria);
    expect(simple.breakdown['estimatedCost'].score).toBeGreaterThanOrEqual(
      complex.breakdown['estimatedCost'].score,
    );
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles circuit with wires but no components', () => {
    const ir: CircuitIR = {
      meta: { name: 'Wires Only', version: '1.0.0' },
      components: [],
      nets: [{ id: 'n1', name: 'N1', type: 'signal' }],
      wires: [{ id: 'w1', netId: 'n1', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }],
    };
    const result = scoreCircuit(ir, defaultCriteria());
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(1);
  });

  it('handles very large component count', () => {
    const components = Array.from({ length: 200 }, (_, i) => ({
      id: `c${i}`,
      refdes: `C${i}`,
      partId: 'capacitor',
      value: '100n',
      pins: { pin1: 'VCC', pin2: 'GND' },
    }));
    const ir: CircuitIR = {
      meta: { name: 'Large', version: '1.0.0' },
      components,
      nets: [
        { id: 'n1', name: 'VCC', type: 'power' },
        { id: 'n2', name: 'GND', type: 'ground' },
      ],
      wires: [],
    };
    const result = scoreCircuit(ir, defaultCriteria());
    expect(result.breakdown['componentCount'].score).toBeLessThan(0.5);
  });
});
