import { readFileSync } from 'node:fs';

import { materialize, opEnvelopeSchema } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { SpiceEngine, vectorByName } from './engine.js';
import { simulate } from './run.js';

import type { DesignGraph } from '@protopulse/graph';

const parts = seedPartDb();

/** Materialize the real traffic-light-555 golden fixture. */
function trafficLightGraph(): DesignGraph {
  const url = new URL(
    '../../../tools/golden/fixtures/traffic-light-555/ops.json',
    import.meta.url,
  );
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

describe('NE555 behavioral macromodel — traffic-light-555 golden fixture', () => {
  // RA=10k, RB=47k, C=10µF → t_high ≈ 0.693·(RA+RB)·C ≈ 0.395s,
  // period ≈ 0.693·(RA+2RB)·C ≈ 0.72s. One heavy 2s transient covers
  // the startup plus ~2 full periods.
  it('oscillates astable: output toggles rail-to-rail with >= 2 rising edges', async () => {
    const vcc = 5; // core:pwr-vcc default rail
    const result = await simulate(
      trafficLightGraph(),
      parts,
      { kind: 'tran', stepS: 1e-3, stopS: 2 },
      { engine, title: 'traffic-light-555 golden' },
    );

    const out = vectorByName(result, 'v(out_555)');
    const time = vectorByName(result, 'time');
    expect(out).toBeDefined();
    expect(time).toBeDefined();
    const values = out?.values ?? [];
    expect(values.length).toBeGreaterThan(100);

    // The output truly toggles: low phase below 1V, high phase above 60% Vcc.
    expect(Math.min(...values)).toBeLessThan(1);
    expect(Math.max(...values)).toBeGreaterThan(vcc * 0.6);

    // At least 2 rising edges through Vcc/2.
    const edges: number[] = [];
    for (let i = 1; i < values.length; i++) {
      const prev = values[i - 1] ?? Number.NaN;
      const curr = values[i] ?? Number.NaN;
      if (prev < vcc / 2 && curr >= vcc / 2) {
        edges.push(time?.values[i] ?? Number.NaN);
      }
    }
    expect(edges.length).toBeGreaterThanOrEqual(2);

    // Steady-state period tracks the 0.693·(RA+2RB)·C ≈ 0.72s theory.
    const period = (edges[edges.length - 1] ?? Number.NaN) - (edges[edges.length - 2] ?? Number.NaN);
    expect(period).toBeGreaterThan(0.5);
    expect(period).toBeLessThan(0.95);

    // The fidelity manifest is honest about the macromodel.
    const u1 = result.manifest.find((e) => e.ref === 'U1');
    expect(u1?.tier).toBe('behavioral');
    expect(u1?.partId).toBe('core:ne555');
    expect(u1?.note).toContain('no supply-current modeling');
    expect(u1?.note).toContain('ideal comparators');
    // No stubs anywhere in this design any more.
    expect(result.manifest.every((e) => e.tier !== 'stub')).toBe(true);
  }, 30_000);
});
