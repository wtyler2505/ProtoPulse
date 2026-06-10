import { materialize, MM } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { collectShoveRecords, springBackOps } from './springback.js';

import type { DesignGraph, OpBody, OpEnvelope, Vec } from '@protopulse/graph';
import type { FootprintSource } from '@protopulse/route';

const parts = seedPartDb() as unknown as FootprintSource;
const CLEARANCE = 127_000;
const LAYER = 'F.Cu';

const ORIGINAL: Vec[] = [
  { x: -5 * MM, y: 0 },
  { x: 5 * MM, y: 0 },
];
const SHOVED: Vec[] = [
  { x: -5 * MM, y: 0 },
  { x: -352_000, y: -3_352_000 },
  { x: 352_000, y: -3_352_000 },
  { x: 5 * MM, y: 0 },
];
const SHOVER_PATH: Vec[] = [
  { x: 0, y: -3 * MM },
  { x: 0, y: 3 * MM },
];

function baseOps(): OpBody[] {
  return [
    { kind: 'add_component', id: 'ra', ref: 'R1', partId: 'core:resistor', partRev: 1 },
    { kind: 'add_component', id: 'rb', ref: 'R2', partId: 'core:resistor', partRev: 1 },
    { kind: 'connect', port: 'ra:1', newNetId: 'nv' },
    { kind: 'connect', port: 'rb:1', newNetId: 'nn' },
    { kind: 'place_footprint', componentId: 'ra', at: { x: 50 * MM, y: 50 * MM }, rotMilli: 0, side: 'top', locked: false },
    { kind: 'place_footprint', componentId: 'rb', at: { x: 60 * MM, y: 50 * MM }, rotMilli: 0, side: 'top', locked: false },
    { kind: 'route_trace', id: 'victim', netId: 'nv', layerId: LAYER, widthNm: 250_000, path: ORIGINAL },
  ];
}

function shoveBatch(): OpBody {
  return {
    kind: 'batch',
    label: 'shove',
    ops: [
      { kind: 'route_trace', id: 'shover', netId: 'nn', layerId: LAYER, widthNm: 200_000, path: SHOVER_PATH },
      { kind: 'remove_trace', id: 'victim' },
      { kind: 'route_trace', id: 'victim', netId: 'nv', layerId: LAYER, widthNm: 250_000, path: SHOVED },
    ],
  };
}

function envelopesOf(ops: OpBody[]): OpEnvelope[] {
  return ops.map((op, i) => ({ actor: 't', lamport: i + 1, ts: 0, op }));
}

function graphOf(envelopes: OpEnvelope[]): DesignGraph {
  const r = materialize(envelopes);
  const failed = r.warnings.filter((w) => w.kind === 'apply_failed');
  if (failed.length > 0) throw new Error(failed.map((w) => w.message).join('; '));
  return r.graph;
}

describe('collectShoveRecords', () => {
  it('records shover → victims with original and shoved paths', () => {
    const envs = envelopesOf([...baseOps(), shoveBatch()]);
    const records = collectShoveRecords(envs);
    const recs = records.get('shover');
    expect(recs).toHaveLength(1);
    expect(recs?.[0]?.victimId).toBe('victim');
    expect(recs?.[0]?.originalPath).toEqual(ORIGINAL);
    expect(recs?.[0]?.shovedPath).toEqual(SHOVED);
  });

  it('ignores non-shove batches', () => {
    const envs = envelopesOf([
      ...baseOps(),
      { ...shoveBatch(), label: 'route trace' } as OpBody,
    ]);
    expect(collectShoveRecords(envs).size).toBe(0);
  });
});

describe('springBackOps', () => {
  it('restores the victim when the shover is deleted', () => {
    const envs = envelopesOf([...baseOps(), shoveBatch()]);
    const graph = graphOf(envs);
    const ops = springBackOps(envs, graph, parts, new Set(['shover']), CLEARANCE);
    expect(ops).toEqual([
      { kind: 'remove_trace', id: 'victim' },
      { kind: 'route_trace', id: 'victim', netId: 'nv', layerId: LAYER, widthNm: 250_000, path: ORIGINAL },
    ]);
  });

  it('does nothing when the deck has not loaded', () => {
    const envs = envelopesOf([...baseOps(), shoveBatch()]);
    const graph = graphOf(envs);
    expect(springBackOps(envs, graph, parts, new Set(['shover']), null)).toEqual([]);
  });

  it("a user re-route after the shove outranks restoration", () => {
    const rerouted: Vec[] = [
      { x: -5 * MM, y: 0 },
      { x: -1 * MM, y: -4 * MM },
      { x: 5 * MM, y: 0 },
    ];
    const envs = envelopesOf([
      ...baseOps(),
      shoveBatch(),
      { kind: 'remove_trace', id: 'victim' },
      { kind: 'route_trace', id: 'victim', netId: 'nv', layerId: LAYER, widthNm: 250_000, path: rerouted },
    ]);
    const graph = graphOf(envs);
    expect(springBackOps(envs, graph, parts, new Set(['shover']), CLEARANCE)).toEqual([]);
  });

  it('no restore when the original corridor got occupied meanwhile', () => {
    const envs = envelopesOf([
      ...baseOps(),
      shoveBatch(),
      // A third net's trace now sits on the victim's original path.
      { kind: 'connect', port: 'ra:2', newNetId: 'nx' },
      { kind: 'route_trace', id: 'squatter', netId: 'nx', layerId: LAYER, widthNm: 250_000, path: ORIGINAL },
    ]);
    const graph = graphOf(envs);
    expect(springBackOps(envs, graph, parts, new Set(['shover']), CLEARANCE)).toEqual([]);
  });

  it('victim deleted together with the shover does not resurrect', () => {
    const envs = envelopesOf([...baseOps(), shoveBatch()]);
    const graph = graphOf(envs);
    expect(
      springBackOps(envs, graph, parts, new Set(['shover', 'victim']), CLEARANCE),
    ).toEqual([]);
  });
});
