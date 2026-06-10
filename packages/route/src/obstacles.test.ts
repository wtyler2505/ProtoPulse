import { materialize, MM } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import {
  buildObstacleSet,
  makeObstacle,
  queryObstacles,
  segmentViolates,
  segObstacleDistance,
} from './obstacles.js';

import type { Obstacle } from './obstacles.js';
import type { DesignGraph, OpBody } from '@protopulse/graph';

const parts = seedPartDb();

/** Deck-ish defaults for tests: JLC clearance, house default width. */
const CLEARANCE = 127_000;
const WIDTH = 200_000;
const INFLATE = CLEARANCE + WIDTH / 2; // 227000

// PROVENANCE: graphOf copied from packages/drc/src/drc.test.ts — the
// same "ops in, materialized graph out, fail loudly" test scaffold.
function graphOf(ops: OpBody[]): DesignGraph {
  const result = materialize(ops.map((op, i) => ({ actor: 't', lamport: i + 1, ts: 0, op })));
  const failed = result.warnings.filter((w) => w.kind === 'apply_failed');
  if (failed.length > 0) throw new Error(failed.map((w) => w.message).join('; '));
  if (result.violations.length > 0) throw new Error(result.violations[0]?.message ?? 'violation');
  return result.graph;
}

/** r1 (0805, pads ±0.95mm) at origin, led 10mm right, wired in series. */
function placedBoard(): OpBody[] {
  return [
    { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '330' },
    { kind: 'add_component', id: 'led', ref: 'D1', partId: 'core:led', partRev: 1 },
    { kind: 'connect', port: 'r1:2', newNetId: 'nm' },
    { kind: 'connect', port: 'led:A', netId: 'nm' },
    { kind: 'connect', port: 'r1:1', newNetId: 'nv' },
    { kind: 'connect', port: 'led:K', newNetId: 'ng' },
    { kind: 'place_footprint', componentId: 'r1', at: { x: 0, y: 0 }, rotMilli: 0, side: 'top', locked: false },
    { kind: 'place_footprint', componentId: 'led', at: { x: 10 * MM, y: 0 }, rotMilli: 0, side: 'top', locked: false },
  ];
}

const midTrace: OpBody = {
  kind: 'route_trace',
  id: 'tm',
  netId: 'nm',
  layerId: 'F.Cu',
  widthNm: 250_000,
  path: [
    { x: 950_000, y: 0 },
    { x: 5 * MM, y: 0 },
    { x: 9_050_000, y: 0 },
  ],
};

function build(ops: OpBody[], over: { layerId?: string; netId?: string } = {}) {
  return buildObstacleSet(graphOf(ops), parts, {
    layerId: over.layerId ?? 'F.Cu',
    clearanceNm: CLEARANCE,
    widthNm: WIDTH,
    ...(over.netId !== undefined ? { netId: over.netId } : {}),
  });
}

describe('buildObstacleSet — traces', () => {
  it('each trace segment becomes a capsule with r = width/2 on its layer', () => {
    const set = build([...placedBoard(), midTrace]);
    const segs = set.obstacles.filter((o) => o.label === 'trace tm');
    expect(segs).toHaveLength(2); // 3-point path → 2 segments
    expect(segs[0]?.shape).toEqual({
      kind: 'capsule',
      a: { x: 950_000, y: 0 },
      b: { x: 5 * MM, y: 0 },
      r: 125_000,
    });
    expect(segs.every((s) => s.netId === 'nm')).toBe(true);
  });

  it('traces on the other copper layer are not obstacles', () => {
    const set = build([...placedBoard(), midTrace], { layerId: 'B.Cu' });
    expect(set.obstacles.filter((o) => o.label === 'trace tm')).toHaveLength(0);
  });
});

describe('buildObstacleSet — vias', () => {
  const viaOp: OpBody = {
    kind: 'place_via',
    id: 'v1',
    netId: 'nm',
    at: { x: 5 * MM, y: 2 * MM },
    drillNm: 300_000,
    padNm: 600_000,
    span: ['F.Cu', 'B.Cu'],
  };

  it('a via is a point capsule (r = pad/2) on BOTH layers of its span', () => {
    for (const layerId of ['F.Cu', 'B.Cu']) {
      const set = build([...placedBoard(), viaOp], { layerId });
      const via = set.obstacles.find((o) => o.label === 'via v1');
      expect(via?.shape).toEqual({
        kind: 'capsule',
        a: { x: 5 * MM, y: 2 * MM },
        b: { x: 5 * MM, y: 2 * MM },
        r: 300_000,
      });
    }
  });
});

describe('buildObstacleSet — pads', () => {
  it('SMD pads land on the placement side layer only', () => {
    const top = build(placedBoard());
    // Placements iterate in sorted componentId order: 'led' < 'r1'.
    expect(top.obstacles.map((o) => o.label)).toEqual(['D1:A', 'D1:K', 'R1:1', 'R1:2']);
    const bottom = build(placedBoard(), { layerId: 'B.Cu' });
    expect(bottom.obstacles).toHaveLength(0);
  });

  it('rect pad shape, net, and inflated hull are exact', () => {
    const set = build(placedBoard());
    const pad = set.obstacles.find((o) => o.label === 'R1:1');
    // 0805 pad 1: rect 1.0×1.25mm at (-0.95mm, 0)
    expect(pad?.shape).toEqual({
      kind: 'rect',
      rect: { at: { x: -950_000, y: 0 }, wNm: 1_000_000, hNm: 1_250_000 },
    });
    expect(pad?.netId).toBe('nv');
    expect(set.inflateNm).toBe(INFLATE);
    expect(pad?.hull).toEqual({
      minX: -950_000 - 500_000 - INFLATE,
      minY: -625_000 - INFLATE,
      maxX: -950_000 + 500_000 + INFLATE,
      maxY: 625_000 + INFLATE,
    });
  });

  it('through-hole pads (DIP-8) are obstacles on both copper layers', () => {
    const ops: OpBody[] = [
      { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 },
      { kind: 'place_footprint', componentId: 'u1', at: { x: 0, y: 0 }, rotMilli: 0, side: 'top', locked: false },
    ];
    for (const layerId of ['F.Cu', 'B.Cu']) {
      const set = build(ops, { layerId });
      const drilled = set.obstacles.filter((o) => o.label.startsWith('U1:'));
      expect(drilled).toHaveLength(8);
      expect(drilled.every((o) => o.shape.kind === 'capsule')).toBe(true); // circle pads
    }
  });

  it('a quarter turn swaps rect pad extents and moves the center', () => {
    const ops = placedBoard().map((op) =>
      op.kind === 'place_footprint' && op.componentId === 'r1' ? { ...op, rotMilli: 90_000 } : op,
    );
    const pad = build(ops).obstacles.find((o) => o.label === 'R1:1');
    // local (-0.95mm, 0) rotates 90° CCW to (0, -0.95mm); w/h swap.
    expect(pad?.shape).toEqual({
      kind: 'rect',
      rect: { at: { x: 0, y: -950_000 }, wNm: 1_250_000, hNm: 1_000_000 },
    });
  });

  it('bottom-side placements mirror X and obstacle the B.Cu layer', () => {
    const ops = placedBoard().map((op) =>
      op.kind === 'place_footprint' && op.componentId === 'r1' ? { ...op, side: 'bottom' as const } : op,
    );
    expect(build(ops).obstacles.map((o) => o.label)).toEqual(['D1:A', 'D1:K']);
    const pad = build(ops, { layerId: 'B.Cu' }).obstacles.find((o) => o.label === 'R1:1');
    expect(pad?.shape).toMatchObject({ rect: { at: { x: 950_000, y: 0 } } }); // mirrored
  });

  it('pads on no net are still obstacles (they demand clearance)', () => {
    const ops: OpBody[] = [
      { kind: 'add_component', id: 'r9', ref: 'R9', partId: 'core:resistor', partRev: 1 },
      { kind: 'place_footprint', componentId: 'r9', at: { x: 0, y: 0 }, rotMilli: 0, side: 'top', locked: false },
    ];
    const set = build(ops, { netId: 'whatever' });
    expect(set.obstacles.map((o) => [o.label, o.netId])).toEqual([
      ['R9:1', null],
      ['R9:2', null],
    ]);
  });
});

describe('buildObstacleSet — routing-net exclusion', () => {
  it('same-net pads and traces are excluded; foreign nets stay', () => {
    const set = build([...placedBoard(), midTrace], { netId: 'nm' });
    const labels = set.obstacles.map((o) => o.label);
    expect(labels).toEqual(['D1:K', 'R1:1']); // R1:2/D1:A/trace tm are net nm
  });

  it('without netId everything is an obstacle', () => {
    const set = build([...placedBoard(), midTrace]);
    expect(set.obstacles).toHaveLength(6); // 2 trace segs + 4 pads
  });
});

describe('buildObstacleSet — plumbing', () => {
  it('an empty board yields an empty set with no index', () => {
    const set = build([]);
    expect(set.obstacles).toEqual([]);
    expect(set.index).toBeNull();
    expect(queryObstacles(set, { x: 0, y: 0 }, { x: MM, y: 0 })).toEqual([]);
  });

  it('rejects non-integer clearance/width at the boundary (zod)', () => {
    const graph = graphOf([]);
    expect(() =>
      buildObstacleSet(graph, parts, { layerId: 'F.Cu', clearanceNm: 127_000.5, widthNm: WIDTH }),
    ).toThrow();
    expect(() =>
      buildObstacleSet(graph, parts, { layerId: 'F.Cu', clearanceNm: CLEARANCE, widthNm: -1 }),
    ).toThrow();
  });

  it('queryObstacles is a broad phase: far-away copper is not returned', () => {
    const set = build([...placedBoard(), midTrace]);
    // A short probe near the led only.
    const near = queryObstacles(set, { x: 9 * MM, y: 0 }, { x: 9.5 * MM, y: 0 });
    expect(near.some((o) => o.label.startsWith('D1:'))).toBe(true);
    expect(near.some((o) => o.label.startsWith('R1:'))).toBe(false);
  });
});

describe('segObstacleDistance / segmentViolates', () => {
  const rect: Obstacle = makeObstacle(
    'rect',
    null,
    { kind: 'rect', rect: { at: { x: 0, y: 0 }, wNm: 1_000_000, hNm: 1_000_000 } },
    INFLATE,
  );
  const capsule: Obstacle = makeObstacle(
    'cap',
    null,
    { kind: 'capsule', a: { x: 0, y: 0 }, b: { x: MM, y: 0 }, r: 100_000 },
    INFLATE,
  );

  it('measures centerline-to-copper distance for both shapes', () => {
    // Horizontal probe 1mm above the rect's top edge (copper to y=500000).
    expect(segObstacleDistance({ x: -MM, y: 1_500_000 }, { x: MM, y: 1_500_000 }, rect)).toBe(1_000_000);
    // Probe 1mm above the capsule centerline minus its radius.
    expect(segObstacleDistance({ x: 0, y: MM }, { x: MM, y: MM }, capsule)).toBe(900_000);
  });

  it('exactly inflateNm away is legal — the comparison is strict', () => {
    // Top of rect copper is y=500000; centerline at 500000+INFLATE.
    const y = 500_000 + INFLATE;
    expect(segmentViolates({ x: -MM, y }, { x: MM, y }, rect, INFLATE)).toBe(false);
    expect(segmentViolates({ x: -MM, y: y - 1 }, { x: MM, y: y - 1 }, rect, INFLATE)).toBe(true);
  });
});
