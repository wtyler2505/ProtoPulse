import { readFileSync } from 'node:fs';

import { materialize, opEnvelopeSchema } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { SpiceEngine, vectorByName } from './engine.js';
import { fidelitySummary, simulate } from './run.js';

import type { FidelityEntry } from './models.js';
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

describe('simulate — led-resistor golden fixture end to end', () => {
  it('produces physically sane transient results with an honest manifest', async () => {
    const result = await simulate(
      ledResistorGraph(),
      parts,
      { kind: 'tran', stepS: 1e-5, stopS: 1e-3 },
      { engine, title: 'led-resistor golden' },
    );

    // Physics: LED node sits at the forward drop, loop current ≈ 20mA.
    const vLed = vectorByName(result, 'v(led_a)');
    expect(vLed).toBeDefined();
    const lastV = vLed?.values[vLed.values.length - 1] ?? Number.NaN;
    expect(lastV).toBeGreaterThanOrEqual(1.8);
    expect(lastV).toBeLessThanOrEqual(2.6);

    // Battery BT1 emits element VBT1 → ngspice reports i(vbt1).
    const iBat = vectorByName(result, 'i(vbt1)');
    expect(iBat).toBeDefined();
    const lastI = Math.abs(iBat?.values[iBat.values.length - 1] ?? Number.NaN);
    expect(lastI).toBeGreaterThanOrEqual(0.015);
    expect(lastI).toBeLessThanOrEqual(0.025);

    // Manifest: D1 is honest about being a behavioral LED model.
    const d1 = result.manifest.find((e) => e.ref === 'D1');
    expect(d1?.tier).toBe('behavioral');
    expect(d1?.partId).toBe('core:led');
    expect(result.manifest.map((e) => [e.ref, e.tier])).toEqual([
      ['BT1', 'behavioral'],
      ['D1', 'behavioral'],
      ['R1', 'spice'],
    ]);
  });

  it('runs an operating-point analysis through the same path', async () => {
    const result = await simulate(ledResistorGraph(), parts, { kind: 'op' }, { engine });
    expect(result.points).toBe(1);
    const vBat = vectorByName(result, 'v(vbat)');
    expect(vBat?.values[0]).toBeCloseTo(9, 6);
  });
});

describe('fidelitySummary', () => {
  const entry = (ref: string, tier: FidelityEntry['tier']): FidelityEntry => ({
    ref,
    partId: 'core:x',
    tier,
  });

  it('rolls up tiers in spice/behavioral/stub order and names exclusions', () => {
    const manifest = [
      entry('R1', 'spice'),
      entry('R2', 'spice'),
      entry('R3', 'spice'),
      entry('D1', 'behavioral'),
      entry('BT1', 'behavioral'),
      entry('U1', 'stub'),
    ];
    expect(fidelitySummary(manifest)).toBe('3 spice, 2 behavioral, 1 stub (U1 excluded)');
  });

  it('omits absent tiers', () => {
    expect(fidelitySummary([entry('R1', 'spice')])).toBe('1 spice');
    expect(fidelitySummary([entry('U1', 'stub'), entry('J1', 'stub')])).toBe(
      '2 stub (U1, J1 excluded)',
    );
  });

  it('handles an empty manifest', () => {
    expect(fidelitySummary([])).toBe('no components');
  });
});
