import { readFileSync } from 'node:fs';

import { materialize, opEnvelopeSchema } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { SpiceEngine, vectorByName } from './engine.js';
import { fidelitySummary, simulate } from './run.js';

import type { FidelityEntry } from './models.js';
import type { DesignGraph, OpBody } from '@protopulse/graph';

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

function graphOf(ops: OpBody[]): DesignGraph {
  return materialize(ops.map((op, i) => ({ actor: 't', lamport: i + 1, ts: 0, op }))).graph;
}

/** Battery driving a 10k/10k divider; fields.ac optionally set on BT1. */
function dividerOps(ac: string | null): OpBody[] {
  const ops: OpBody[] = [
    { kind: 'add_component', id: 'bat', ref: 'BT1', partId: 'core:battery', partRev: 1, value: '5V' },
    { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '10k' },
    { kind: 'add_component', id: 'r2', ref: 'R2', partId: 'core:resistor', partRev: 1, value: '10k' },
    { kind: 'connect', port: 'bat:+', newNetId: 'nin' },
    { kind: 'connect', port: 'r1:1', netId: 'nin' },
    { kind: 'connect', port: 'r1:2', newNetId: 'nout' },
    { kind: 'connect', port: 'r2:1', netId: 'nout' },
    { kind: 'connect', port: 'r2:2', newNetId: 'ng' },
    { kind: 'connect', port: 'bat:-', netId: 'ng' },
    { kind: 'rename_net', netId: 'nin', name: 'IN' },
    { kind: 'rename_net', netId: 'nout', name: 'OUT' },
    { kind: 'rename_net', netId: 'ng', name: 'GND' },
  ];
  if (ac !== null) {
    ops.push({ kind: 'set_component_props', id: 'bat', props: { fields: { ac } } });
  }
  return ops;
}

describe('simulate — graph-driven AC and noise via fields.ac', () => {
  it('runs a graph-driven .ac end to end: the divider reads ~0.5 across the band', async () => {
    const result = await simulate(
      graphOf(dividerOps('1')),
      parts,
      { kind: 'ac', variation: 'dec', points: 5, fStart: 10, fStop: 1e5 },
      { engine },
    );
    expect(result.points).toBeGreaterThan(0);
    const out = vectorByName(result, 'v(out)');
    expect(out).toBeDefined();
    expect(out?.imag).toBeDefined();
    for (let i = 0; i < (out?.values.length ?? 0); i++) {
      const mag = Math.hypot(out?.values[i] ?? NaN, out?.imag?.[i] ?? NaN);
      expect(mag).toBeGreaterThan(0.499);
      expect(mag).toBeLessThan(0.501);
    }
    // The manifest is honest about where the AC magnitude came from.
    expect(result.manifest.find((e) => e.ref === 'BT1')?.note).toContain(
      'AC small-signal magnitude 1 (fields.ac)',
    );
  });

  it('runs a graph-driven .noise end to end (previously: "no AC value" error)', async () => {
    const result = await simulate(
      graphOf(dividerOps('1')),
      parts,
      {
        kind: 'noise',
        output: 'out',
        source: 'VBT1',
        variation: 'dec',
        points: 5,
        fStart: 10,
        fStop: 1e5,
      },
      { engine },
    );
    expect(result.analysis.kind).toBe('noise');
    expect(result.points).toBeGreaterThan(0);
    const onoise = vectorByName(result, 'onoise_spectrum');
    expect(onoise).toBeDefined();
    // Thermal noise of 10k ∥ 10k is flat: 4kTR ≈ 8.3e-17 V²/Hz.
    for (const v of onoise?.values ?? []) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1e-6);
    }
  });

  it('still rejects .noise without fields.ac — the field is what unlocks it', async () => {
    await expect(
      simulate(
        graphOf(dividerOps(null)),
        parts,
        {
          kind: 'noise',
          output: 'out',
          source: 'VBT1',
          variation: 'dec',
          points: 5,
          fStart: 10,
          fStop: 1e5,
        },
        { engine },
      ),
    ).rejects.toThrow(/no AC value/i);
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
