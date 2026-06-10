import { readFileSync } from 'node:fs';

import { materialize, opEnvelopeSchema } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { SpiceEngine, vectorByName } from './engine.js';
import { simulateStep } from './step.js';

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

describe('simulateStep — led-resistor golden fixture', () => {
  it('throws on an unknown component ref', async () => {
    await expect(
      simulateStep(
        ledResistorGraph(),
        parts,
        { base: TRAN, componentRef: 'R99', values: ['100'] },
        { engine },
      ),
    ).rejects.toThrow('unknown component ref "R99"');
  });

  it('throws on an empty value list', async () => {
    await expect(
      simulateStep(
        ledResistorGraph(),
        parts,
        { base: TRAN, componentRef: 'R1', values: [] },
        { engine },
      ),
    ).rejects.toThrow('at least one entry');
  });

  it('steps R1 through 100/330/1k — loop current magnitude decreases', async () => {
    const { runs, manifest } = await simulateStep(
      ledResistorGraph(),
      parts,
      { base: TRAN, componentRef: 'R1', values: ['100', '330', '1k'] },
      { engine },
    );
    expect(runs.map((r) => r.value)).toEqual(['100', '330', '1k']);

    const currents = runs.map((r) => {
      const i = vectorByName(r, 'i(vbt1)');
      expect(i).toBeDefined();
      return Math.abs(i?.values[i.values.length - 1] ?? Number.NaN);
    });
    // Bigger series resistor, less LED current — strictly monotonic.
    expect(currents[0]).toBeGreaterThan(currents[1] ?? Number.NaN);
    expect(currents[1]).toBeGreaterThan(currents[2] ?? Number.NaN);
    // Sanity: ~20mA at 330Ω from the 9V battery.
    expect(currents[1]).toBeGreaterThanOrEqual(0.015);
    expect(currents[1]).toBeLessThanOrEqual(0.025);

    expect(manifest.map((e) => [e.ref, e.tier])).toEqual([
      ['BT1', 'behavioral'],
      ['D1', 'behavioral'],
      ['R1', 'spice'],
    ]);
  });
});
