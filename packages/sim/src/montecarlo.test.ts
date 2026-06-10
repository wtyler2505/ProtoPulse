import { readFileSync } from 'node:fs';

import { materialize, opEnvelopeSchema, parseValue } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { SpiceEngine, vectorByName } from './engine.js';
import { mulberry32, simulateMonteCarlo, siValueString } from './montecarlo.js';
import { simulate } from './run.js';

import type { Analysis } from './analyses.js';
import type { DesignGraph } from '@protopulse/graph';

const parts = seedPartDb();

/** Materialize the real led-resistor golden fixture. */
function ledResistorGraph(): DesignGraph {
  const url = new URL('../../../tools/golden/fixtures/led-resistor/ops.json', import.meta.url);
  const envelopes = z.array(opEnvelopeSchema).parse(JSON.parse(readFileSync(url, 'utf8')));
  const { graph } = materialize(envelopes);
  return graph;
}

const engine = new SpiceEngine();

beforeAll(async () => {
  await engine.start();
}, 60_000);

afterAll(async () => {
  await engine.stop();
});

const TRAN: Analysis = { kind: 'tran', stepS: 1e-5, stopS: 1e-3 };

function lastOf(values: readonly number[] | undefined): number {
  expect(values).toBeDefined();
  const v = values?.[values.length - 1];
  expect(v).toBeDefined();
  return v ?? Number.NaN;
}

describe('mulberry32', () => {
  it('is deterministic and uniform in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const drawsA = Array.from({ length: 100 }, () => a());
    const drawsB = Array.from({ length: 100 }, () => b());
    expect(drawsB).toEqual(drawsA);
    for (const d of drawsA) {
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(1);
    }
    expect(new Set(drawsA).size).toBeGreaterThan(90);
  });

  it('different seeds draw different sequences', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(Array.from({ length: 10 }, () => a())).not.toEqual(
      Array.from({ length: 10 }, () => b()),
    );
  });
});

describe('siValueString', () => {
  it('round-trips through parseValue for every jitter class', () => {
    const cases: [number, string, 'resistor' | 'capacitor' | 'inductor'][] = [
      [346.5, '', 'resistor'],
      [10500, '', 'resistor'],
      [1.05e-5, 'F', 'capacitor'],
      [97e-9, 'F', 'capacitor'],
      [3.3e-12, 'F', 'capacitor'],
      [0.0107, 'H', 'inductor'],
      [2.2, 'H', 'inductor'],
    ];
    for (const [value, unit, cls] of cases) {
      const text = siValueString(value, unit);
      expect(text).not.toMatch(/e[+-]?\d/i);
      const parsed = parseValue(text, cls);
      if ('error' in parsed) throw new Error(`"${text}" did not parse: ${parsed.error}`);
      expect(parsed.value).toBeCloseTo(value, 12);
    }
  });
});

describe('simulateMonteCarlo — led-resistor golden fixture', () => {
  it('rejects a non-positive or fractional run count', async () => {
    const graph = ledResistorGraph();
    await expect(
      simulateMonteCarlo(graph, parts, { base: TRAN, runs: 0 }, { engine }),
    ).rejects.toThrow('positive integer');
    await expect(
      simulateMonteCarlo(graph, parts, { base: TRAN, runs: 2.5 }, { engine }),
    ).rejects.toThrow('positive integer');
  });

  it('draws identical jitters for the same seed and reports the seed', async () => {
    const graph = ledResistorGraph();
    const spec = { base: { kind: 'op' } as const, runs: 4, seed: 1234 };
    const a = await simulateMonteCarlo(graph, parts, spec, { engine });
    const b = await simulateMonteCarlo(graph, parts, spec, { engine });
    expect(a.seed).toBe(1234);
    expect(b.trials.map((t) => t.jitter)).toEqual(a.trials.map((t) => t.jitter));
    const c = await simulateMonteCarlo(graph, parts, { ...spec, seed: 99 }, { engine });
    expect(c.trials.map((t) => t.jitter)).not.toEqual(a.trials.map((t) => t.jitter));
  });

  it('runs the requested trial count with jitters inside the tolerance band', async () => {
    const tol = 0.1;
    const { trials, manifest, seed } = await simulateMonteCarlo(
      ledResistorGraph(),
      parts,
      { base: TRAN, runs: 6, seed: 7, tolerances: { resistor: tol } },
      { engine },
    );
    expect(seed).toBe(7);
    expect(trials).toHaveLength(6);
    expect(trials.map((t) => t.trial)).toEqual([0, 1, 2, 3, 4, 5]);
    for (const trial of trials) {
      // Only R1 is jitterable: the battery is a source, the LED has no
      // numeric value.
      expect(Object.keys(trial.jitter)).toEqual(['R1']);
      const m = trial.jitter.R1 ?? Number.NaN;
      expect(m).toBeGreaterThanOrEqual(1 - tol);
      expect(m).toBeLessThanOrEqual(1 + tol);
    }
    // Manifest still reports honest tiers.
    expect(manifest.map((e) => [e.ref, e.tier])).toEqual([
      ['BT1', 'behavioral'],
      ['D1', 'behavioral'],
      ['R1', 'spice'],
    ]);
  });

  it('spreads the final LED node voltage — nonzero but bounded', async () => {
    const { trials } = await simulateMonteCarlo(
      ledResistorGraph(),
      parts,
      { base: TRAN, runs: 8, seed: 42, tolerances: { resistor: 0.1 } },
      { engine },
    );
    const finals = trials.map((t) => lastOf(vectorByName(t, 'v(led_a)')?.values));
    const min = Math.min(...finals);
    const max = Math.max(...finals);
    expect(max - min).toBeGreaterThan(0);
    // Still a red LED forward drop — jitter must not fling the physics.
    expect(min).toBeGreaterThanOrEqual(1.8);
    expect(max).toBeLessThanOrEqual(2.6);
  });

  it('with zero tolerance, trial 0 equals a plain simulate run', async () => {
    const graph = ledResistorGraph();
    const mc = await simulateMonteCarlo(
      graph,
      parts,
      { base: TRAN, runs: 1, seed: 5, tolerances: { resistor: 0, capacitor: 0, inductor: 0 } },
      { engine },
    );
    const plain = await simulate(graph, parts, TRAN, { engine });
    const trial = mc.trials[0];
    expect(trial).toBeDefined();
    expect(trial?.jitter).toEqual({ R1: 1 });
    expect(trial?.variables).toEqual(plain.variables);
    for (const name of ['v(led_a)', 'i(vbt1)']) {
      const a = lastOf(vectorByName(trial ?? plain, name)?.values);
      const b = lastOf(vectorByName(plain, name)?.values);
      expect(a).toBeCloseTo(b, 9);
    }
    expect(mc.manifest).toEqual(plain.manifest);
  });
});
