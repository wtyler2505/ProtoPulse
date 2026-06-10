import { materialize, MM } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { buildObstacleSet } from './obstacles.js';
import { pathIsLegal, planShove } from './shove.js';
import { pathIsClear } from './walkaround.js';

import type { ShoveResult } from './shove.js';
import type { DesignGraph, OpBody, Vec } from '@protopulse/graph';

const parts = seedPartDb();

const CLEARANCE = 127_000;
const WIDTH = 200_000;
const LAYER = 'F.Cu';

// PROVENANCE: graphOf copied from obstacles.test.ts — the same "ops in,
// materialized graph out, fail loudly" test scaffold.
function graphOf(ops: OpBody[]): DesignGraph {
  const result = materialize(ops.map((op, i) => ({ actor: 't', lamport: i + 1, ts: 0, op })));
  const failed = result.warnings.filter((w) => w.kind === 'apply_failed');
  if (failed.length > 0) throw new Error(failed.map((w) => w.message).join('; '));
  if (result.violations.length > 0) throw new Error(result.violations[0]?.message ?? 'violation');
  return result.graph;
}

/** Two nets, no components: a horizontal victim trace on net 'nv' along
 *  y=0, and the new trace will cross it vertically on net 'nn'. Nets
 *  exist via two far-apart resistors so the graph is valid. */
function crossingBoard(): OpBody[] {
  return [
    { kind: 'add_component', id: 'ra', ref: 'R1', partId: 'core:resistor', partRev: 1 },
    { kind: 'add_component', id: 'rb', ref: 'R2', partId: 'core:resistor', partRev: 1 },
    { kind: 'connect', port: 'ra:1', newNetId: 'nv' },
    { kind: 'connect', port: 'rb:1', newNetId: 'nn' },
    // Components parked far away so their pads never matter here.
    { kind: 'place_footprint', componentId: 'ra', at: { x: 50 * MM, y: 50 * MM }, rotMilli: 0, side: 'top', locked: false },
    { kind: 'place_footprint', componentId: 'rb', at: { x: 60 * MM, y: 50 * MM }, rotMilli: 0, side: 'top', locked: false },
    {
      kind: 'route_trace',
      id: 'victim',
      netId: 'nv',
      layerId: LAYER,
      widthNm: 250_000,
      path: [
        { x: -5 * MM, y: 0 },
        { x: 5 * MM, y: 0 },
      ],
    },
  ];
}

const newPathThrough: Vec[] = [
  { x: 0, y: -3 * MM },
  { x: 0, y: 3 * MM },
];

const OPTS = { layerId: LAYER, clearanceNm: CLEARANCE, widthNm: WIDTH, netId: 'nn' };

function expectShove(result: ShoveResult): Extract<ShoveResult, { kind: 'shove' }> {
  expect(result.kind).toBe('shove');
  if (result.kind !== 'shove') throw new Error('unreachable');
  return result;
}

describe('planShove', () => {
  it('clear when nothing is near', () => {
    const graph = graphOf(crossingBoard());
    const far: Vec[] = [
      { x: 20 * MM, y: -3 * MM },
      { x: 20 * MM, y: 3 * MM },
    ];
    expect(planShove(far, graph, parts, OPTS)).toEqual({ kind: 'clear' });
  });

  it('shoves a crossing trace: victim detours, final config is mutually clear', () => {
    const graph = graphOf(crossingBoard());
    const result = expectShove(planShove(newPathThrough, graph, parts, OPTS));
    expect(result.reroutes).toHaveLength(1);
    const reroute = result.reroutes[0];
    expect(reroute?.traceId).toBe('victim');
    // Endpoints preserved.
    expect(reroute?.path[0]).toEqual({ x: -5 * MM, y: 0 });
    expect(reroute?.path.at(-1)).toEqual({ x: 5 * MM, y: 0 });
    // The detour actually moved (more than the straight 2 points).
    expect(reroute?.path.length).toBeGreaterThan(2);

    // Mutual legality: apply the shove to the graph and check both ways.
    const shoved = graphOf([
      ...crossingBoard().map((op) =>
        op.kind === 'route_trace' && op.id === 'victim'
          ? { ...op, path: reroute?.path ?? [] }
          : op,
      ),
      { kind: 'route_trace', id: 'newt', netId: 'nn', layerId: LAYER, widthNm: WIDTH, path: newPathThrough },
    ]);
    const victimView = buildObstacleSet(shoved, parts, {
      layerId: LAYER,
      clearanceNm: CLEARANCE,
      widthNm: 250_000,
      netId: 'nv',
    });
    expect(pathIsClear(reroute?.path ?? [], victimView)).toBe(true);
    const newView = buildObstacleSet(shoved, parts, {
      layerId: LAYER,
      clearanceNm: CLEARANCE,
      widthNm: WIDTH,
      netId: 'nn',
    });
    expect(pathIsClear(newPathThrough, newView)).toBe(true);
  });

  it('same-net copper is never a victim', () => {
    const graph = graphOf(crossingBoard());
    const sameNet = planShove(newPathThrough, graph, parts, { ...OPTS, netId: 'nv' });
    expect(sameNet).toEqual({ kind: 'clear' });
  });

  it('blocks on pads — components do not move', () => {
    const graph = graphOf([
      ...crossingBoard(),
      { kind: 'add_component', id: 'rc', ref: 'R3', partId: 'core:resistor', partRev: 1 },
      { kind: 'connect', port: 'rc:1', newNetId: 'np' },
      // Rotated 90° so its pads sit ON the new path's centerline.
      { kind: 'place_footprint', componentId: 'rc', at: { x: 0, y: 2 * MM }, rotMilli: 90_000, side: 'top', locked: false },
    ]);
    const result = planShove(newPathThrough, graph, parts, OPTS);
    expect(result.kind).toBe('blocked');
    if (result.kind === 'blocked') expect(result.reason).toContain("don't move");
  });

  it('two victims plan sequentially and stay clear of each other', () => {
    const graph = graphOf([
      ...crossingBoard(),
      { kind: 'connect', port: 'ra:2', newNetId: 'nv2' },
      {
        kind: 'route_trace',
        id: 'victim2',
        netId: 'nv2',
        layerId: LAYER,
        widthNm: 250_000,
        path: [
          { x: -5 * MM, y: 1 * MM },
          { x: 5 * MM, y: 1 * MM },
        ],
      },
    ]);
    const result = expectShove(planShove(newPathThrough, graph, parts, OPTS));
    expect(result.reroutes.map((r) => r.traceId).sort()).toEqual(['victim', 'victim2']);

    // Apply both reroutes + the new trace; every path must be legal.
    const ops = [
      ...graphOf([]).components.keys(), // noop — keep ts quiet about unused
    ];
    void ops;
    const shovedOps: OpBody[] = [
      ...crossingBoard(),
      { kind: 'connect', port: 'ra:2', newNetId: 'nv2' },
      {
        kind: 'route_trace',
        id: 'victim2',
        netId: 'nv2',
        layerId: LAYER,
        widthNm: 250_000,
        path: [
          { x: -5 * MM, y: 1 * MM },
          { x: 5 * MM, y: 1 * MM },
        ],
      },
    ];
    let shoved = graphOf(shovedOps);
    // Patch in the reroutes + the new trace through a fresh materialize.
    const patched: OpBody[] = shovedOps.map((op) => {
      if (op.kind !== 'route_trace') return op;
      const r = result.reroutes.find((x) => x.traceId === op.id);
      return r ? { ...op, path: r.path } : op;
    });
    patched.push({ kind: 'route_trace', id: 'newt', netId: 'nn', layerId: LAYER, widthNm: WIDTH, path: newPathThrough });
    shoved = graphOf(patched);
    for (const trace of shoved.pcb.traces.values()) {
      const view = buildObstacleSet(shoved, parts, {
        layerId: LAYER,
        clearanceNm: CLEARANCE,
        widthNm: trace.widthNm,
        netId: trace.netId,
      });
      expect(pathIsClear(trace.path, view)).toBe(true);
    }
  });

  it('blocks when a victim has nowhere to go', () => {
    // A short victim whose ENDPOINTS sit inside the new trace's
    // clearance hull: every possible reroute starts in violation, so
    // the walkaround must give up and the shove must refuse whole.
    const graph = graphOf([
      ...crossingBoard().filter((op) => op.kind !== 'route_trace'),
      {
        kind: 'route_trace',
        id: 'victim',
        netId: 'nv',
        layerId: LAYER,
        widthNm: 250_000,
        path: [
          { x: -300_000, y: 0 },
          { x: 300_000, y: 0 },
        ],
      },
    ]);
    const result = planShove(newPathThrough, graph, parts, OPTS);
    expect(result.kind).toBe('blocked');
    if (result.kind === 'blocked') expect(result.reason).toContain('victim');
  });
});

describe('pathIsLegal (spring-back legality)', () => {
  it('original path is illegal while the shover exists, legal once ignored/removed', () => {
    const graph = graphOf([
      ...crossingBoard(),
      { kind: 'route_trace', id: 'shover', netId: 'nn', layerId: LAYER, widthNm: WIDTH, path: newPathThrough },
    ]);
    const original: Vec[] = [
      { x: -5 * MM, y: 0 },
      { x: 5 * MM, y: 0 },
    ];
    const victimOpts = { layerId: LAYER, clearanceNm: CLEARANCE, widthNm: 250_000, netId: 'nv' };
    // Crossing the live shover: illegal (ignoring the victim's own copper).
    expect(pathIsLegal(original, graph, parts, { ...victimOpts, ignoreTraceId: 'victim' })).toBe(false);
    // Without the shover: legal again.
    const without = graphOf(crossingBoard());
    expect(pathIsLegal(original, without, parts, { ...victimOpts, ignoreTraceId: 'victim' })).toBe(true);
  });
});
