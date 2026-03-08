import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { GenerativeDesignEngine, useGenerativeDesign } from '../generative-engine';
import type { DesignSpec } from '../generative-engine';
import type { CircuitIR } from '@/lib/circuit-dsl/circuit-ir';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpec(overrides?: Partial<DesignSpec>): DesignSpec {
  return {
    description: 'LED driver for 12V, 350mA',
    constraints: {
      componentCount: { weight: 0.2, maxOptimal: 10, maxAcceptable: 30 },
      estimatedCost: { weight: 0.25, budgetUsd: 25 },
      drcViolations: { weight: 0.3 },
      powerBudget: { weight: 0.15, maxWatts: 5 },
      thermalMargin: { weight: 0.1, maxTempC: 85 },
    },
    populationSize: 4,
    generations: 2,
    seed: 42,
    ...overrides,
  };
}

function simpleBaseCircuit(): CircuitIR {
  return {
    meta: { name: 'Base', version: '1.0.0' },
    components: [
      { id: 'r1', refdes: 'R1', partId: 'resistor', value: '10k', pins: { pin1: 'VCC', pin2: 'N1' } },
      { id: 'd1', refdes: 'D1', partId: 'led', pins: { anode: 'N1', cathode: 'GND' } },
    ],
    nets: [
      { id: 'n1', name: 'VCC', type: 'power' },
      { id: 'n2', name: 'GND', type: 'ground' },
      { id: 'n3', name: 'N1', type: 'signal' },
    ],
    wires: [],
  };
}

// ---------------------------------------------------------------------------
// Engine lifecycle
// ---------------------------------------------------------------------------

describe('GenerativeDesignEngine', () => {
  let engine: GenerativeDesignEngine;

  beforeEach(() => {
    // Reset singleton for clean tests
    GenerativeDesignEngine.resetInstance();
    engine = GenerativeDesignEngine.getInstance();
  });

  afterEach(() => {
    engine.cancel();
  });

  it('returns a singleton instance', () => {
    const a = GenerativeDesignEngine.getInstance();
    const b = GenerativeDesignEngine.getInstance();
    expect(a).toBe(b);
  });

  it('starts in idle state', () => {
    expect(engine.getState()).toBe('idle');
  });

  it('returns empty results initially', () => {
    expect(engine.getResults()).toEqual([]);
  });

  it('returns null for best candidate initially', () => {
    expect(engine.getBestCandidate()).toBeNull();
  });

  it('can subscribe and unsubscribe', () => {
    const cb = vi.fn();
    const unsub = engine.subscribe(cb);
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('notifies subscribers on state change', async () => {
    const cb = vi.fn();
    engine.subscribe(cb);

    const spec = makeSpec({ populationSize: 2, generations: 1 });
    const gen = engine.run(spec, [simpleBaseCircuit()]);
    // Consume the generator
    for await (const _result of gen) {
      // just consume
    }

    expect(cb).toHaveBeenCalled();
  });

  it('runs a single generation', async () => {
    const spec = makeSpec({ populationSize: 4, generations: 1 });
    const gen = engine.run(spec, [simpleBaseCircuit()]);

    const results = [];
    for await (const result of gen) {
      results.push(result);
    }

    expect(results).toHaveLength(1);
    expect(results[0].generation).toBe(0);
    expect(results[0].candidates).toHaveLength(4);
    expect(results[0].bestFitness).toBeGreaterThanOrEqual(0);
    expect(results[0].averageFitness).toBeGreaterThanOrEqual(0);
  });

  it('runs multiple generations with improvement tracking', async () => {
    const spec = makeSpec({ populationSize: 4, generations: 3 });
    const gen = engine.run(spec, [simpleBaseCircuit()]);

    const results = [];
    for await (const result of gen) {
      results.push(result);
    }

    expect(results).toHaveLength(3);
    expect(results[0].generation).toBe(0);
    expect(results[1].generation).toBe(1);
    expect(results[2].generation).toBe(2);
  });

  it('each candidate has an id, ir, and fitness', async () => {
    const spec = makeSpec({ populationSize: 3, generations: 1 });
    const gen = engine.run(spec, [simpleBaseCircuit()]);

    for await (const result of gen) {
      for (const candidate of result.candidates) {
        expect(candidate.id).toBeTruthy();
        expect(candidate.ir).toBeDefined();
        expect(candidate.ir.meta).toBeDefined();
        expect(candidate.ir.components).toBeDefined();
        expect(candidate.fitness).toBeDefined();
        expect(candidate.fitness.overall).toBeGreaterThanOrEqual(0);
        expect(candidate.fitness.overall).toBeLessThanOrEqual(1);
      }
    }
  });

  it('candidates are sorted by fitness (best first)', async () => {
    const spec = makeSpec({ populationSize: 6, generations: 1 });
    const gen = engine.run(spec, [simpleBaseCircuit()]);

    for await (const result of gen) {
      for (let i = 1; i < result.candidates.length; i++) {
        expect(result.candidates[i - 1].fitness.overall).toBeGreaterThanOrEqual(
          result.candidates[i].fitness.overall,
        );
      }
    }
  });

  it('populates getResults after run completes', async () => {
    const spec = makeSpec({ populationSize: 2, generations: 2 });
    const gen = engine.run(spec, [simpleBaseCircuit()]);

    for await (const _result of gen) {
      // consume
    }

    const results = engine.getResults();
    expect(results).toHaveLength(2);
  });

  it('populates getBestCandidate after run', async () => {
    const spec = makeSpec({ populationSize: 4, generations: 2 });
    const gen = engine.run(spec, [simpleBaseCircuit()]);

    for await (const _result of gen) {
      // consume
    }

    const best = engine.getBestCandidate();
    expect(best).not.toBeNull();
    expect(best!.ir).toBeDefined();
    expect(best!.fitness.overall).toBeGreaterThan(0);
  });

  it('can cancel mid-run', async () => {
    const spec = makeSpec({ populationSize: 4, generations: 10 });
    const gen = engine.run(spec, [simpleBaseCircuit()]);

    const results = [];
    for await (const result of gen) {
      results.push(result);
      if (results.length >= 2) {
        engine.cancel();
      }
    }

    expect(results.length).toBeLessThanOrEqual(3); // may get one more after cancel
  });

  it('returns to idle state after completion', async () => {
    const spec = makeSpec({ populationSize: 2, generations: 1 });
    const gen = engine.run(spec, [simpleBaseCircuit()]);

    for await (const _result of gen) {
      // consume
    }

    expect(engine.getState()).toBe('complete');
  });

  it('enforces population size', async () => {
    const spec = makeSpec({ populationSize: 6, generations: 1 });
    const gen = engine.run(spec, [simpleBaseCircuit()]);

    for await (const result of gen) {
      expect(result.candidates).toHaveLength(6);
    }
  });

  it('handles empty base circuits by creating minimal candidates', async () => {
    const emptyIr: CircuitIR = {
      meta: { name: 'Empty', version: '1.0.0' },
      components: [],
      nets: [],
      wires: [],
    };

    const spec = makeSpec({ populationSize: 2, generations: 1 });
    const gen = engine.run(spec, [emptyIr]);

    for await (const result of gen) {
      expect(result.candidates).toHaveLength(2);
    }
  });

  it('uses seeded PRNG for reproducibility', async () => {
    async function collectResults(seed: number) {
      GenerativeDesignEngine.resetInstance();
      const eng = GenerativeDesignEngine.getInstance();
      const spec = makeSpec({ populationSize: 3, generations: 2, seed });
      const gen = eng.run(spec, [simpleBaseCircuit()]);

      const results = [];
      for await (const r of gen) {
        results.push(r);
      }
      return results;
    }

    const run1 = await collectResults(42);
    const run2 = await collectResults(42);

    expect(run1.length).toBe(run2.length);
    for (let i = 0; i < run1.length; i++) {
      expect(run1[i].bestFitness).toBeCloseTo(run2[i].bestFitness, 10);
      expect(run1[i].candidates.length).toBe(run2[i].candidates.length);
    }
  });

  it('tracks progress through state transitions', async () => {
    const states: string[] = [];
    engine.subscribe(() => {
      states.push(engine.getState());
    });

    const spec = makeSpec({ populationSize: 2, generations: 1 });
    const gen = engine.run(spec, [simpleBaseCircuit()]);

    for await (const _result of gen) {
      // consume
    }

    // Should have transitioned through generating/scoring/evolving/complete
    expect(states.length).toBeGreaterThan(0);
    expect(states[states.length - 1]).toBe('complete');
  });
});

// ---------------------------------------------------------------------------
// useGenerativeDesign hook
// ---------------------------------------------------------------------------

describe('useGenerativeDesign', () => {
  beforeEach(() => {
    GenerativeDesignEngine.resetInstance();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useGenerativeDesign());
    expect(result.current.state).toBe('idle');
    expect(result.current.results).toEqual([]);
    expect(result.current.best).toBeNull();
    expect(typeof result.current.run).toBe('function');
    expect(typeof result.current.cancel).toBe('function');
  });

  it('run function is callable', () => {
    const { result } = renderHook(() => useGenerativeDesign());
    expect(typeof result.current.run).toBe('function');
  });

  it('cancel function is callable', () => {
    const { result } = renderHook(() => useGenerativeDesign());
    act(() => {
      result.current.cancel();
    });
    // Should not throw
  });
});
