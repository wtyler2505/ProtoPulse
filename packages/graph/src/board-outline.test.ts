import { describe, expect, it } from 'vitest';

import { applyOp } from './apply.js';
import { diff, isEmptyDelta } from './diff.js';
import { validateGraph } from './invariants.js';
import { invertOp } from './inverse.js';
import { materialize } from './materialize.js';
import { threeWayMerge } from './merge.js';
import { graphFromJson, graphToJson } from './store/serialize.js';
import { buildGraph, envelopes, ledCircuitOps } from './test-helpers.js';
import { cloneGraph } from './types.js';

import type { OpBody } from './ops.js';
import type { Vec } from './types.js';

/** The board outline through the whole core: apply, inverse, diff,
 *  merge, invariants, serialization — the singleton-entity pattern. */

const RECT: Vec[] = [
  { x: 0, y: 0 },
  { x: 20_000_000, y: 0 },
  { x: 20_000_000, y: 15_000_000 },
  { x: 0, y: 15_000_000 },
];

const BIGGER: Vec[] = RECT.map((v) => ({ x: v.x * 2, y: v.y * 2 }));

const setOutline = (outline: Vec[] | null): OpBody => ({ kind: 'set_board_outline', outline });

describe('board outline', () => {
  it('sets, reshapes, and clears; the polygon is deep-copied', () => {
    const g = buildGraph([...ledCircuitOps(), setOutline(RECT)]);
    expect(g.pcb.outline).toEqual(RECT);
    expect(g.pcb.outline?.[0]).not.toBe(RECT[0]);

    expect(applyOp(g, setOutline(BIGGER)).ok).toBe(true);
    expect(g.pcb.outline).toEqual(BIGGER);

    expect(applyOp(g, setOutline(null)).ok).toBe(true);
    expect(g.pcb.outline).toBeUndefined();
  });

  it('inverse closure: set ↔ previous value, including the no-outline state', () => {
    const bare = buildGraph(ledCircuitOps());
    // No previous outline → inverse clears.
    expect(invertOp(bare, setOutline(RECT))).toEqual([setOutline(null)]);

    const withOutline = cloneGraph(bare);
    expect(applyOp(withOutline, setOutline(RECT)).ok).toBe(true);
    // Previous outline → inverse restores it (deep copy).
    const inv = invertOp(withOutline, setOutline(BIGGER));
    expect(inv).toEqual([setOutline(RECT)]);

    // Round-trip: apply, invert-apply, identical graph.
    const round = cloneGraph(withOutline);
    expect(applyOp(round, setOutline(BIGGER)).ok).toBe(true);
    for (const op of inv) expect(applyOp(round, op).ok).toBe(true);
    expect(round.pcb.outline).toEqual(withOutline.pcb.outline);
  });

  it('diff flags outlineChanged in both directions; unchanged stays empty', () => {
    const a = buildGraph(ledCircuitOps());
    const b = buildGraph([...ledCircuitOps(), setOutline(RECT)]);
    expect(diff(a, b).pcbView.outlineChanged).toBe(true);
    expect(diff(b, a).pcbView.outlineChanged).toBe(true);
    expect(isEmptyDelta(diff(a, b))).toBe(false);
    expect(diff(a, a).pcbView.outlineChanged).toBe(false);
    expect(isEmptyDelta(diff(a, a))).toBe(true);
  });

  it('merge replays a theirs-only outline (set and clear); ours-touched wins', () => {
    const baseOps = envelopes(ledCircuitOps());
    const withOp = (op: OpBody, actor: string) => [
      ...baseOps,
      { actor, lamport: baseOps.length + 1, ts: 0, op },
    ];
    const base = materialize(baseOps).graph;

    // Theirs sets; ours untouched → replayed.
    const theirsSet = materialize(withOp(setOutline(RECT), 'them')).graph;
    const m1 = threeWayMerge(base, base, theirsSet);
    expect(m1.autoOps).toContainEqual(setOutline(RECT));

    // Theirs clears (base had one); ours untouched → replayed as null.
    const baseWith = materialize(withOp(setOutline(RECT), 'test-actor')).graph;
    const theirsClear = materialize([
      ...withOp(setOutline(RECT), 'test-actor'),
      { actor: 'them', lamport: baseOps.length + 2, ts: 0, op: setOutline(null) },
    ]).graph;
    const m2 = threeWayMerge(baseWith, baseWith, theirsClear);
    expect(m2.autoOps).toContainEqual(setOutline(null));

    // Both touched → ours wins (no replay).
    const oursSet = materialize(withOp(setOutline(BIGGER), 'test-actor')).graph;
    const m3 = threeWayMerge(base, oursSet, theirsSet);
    expect(m3.autoOps.some((op) => op.kind === 'set_board_outline')).toBe(false);
  });

  it('round-trips through graph JSON; absent stays absent', () => {
    const g = buildGraph([...ledCircuitOps(), setOutline(RECT)]);
    expect(graphFromJson(graphToJson(g)).pcb.outline).toEqual(RECT);
    const bare = buildGraph(ledCircuitOps());
    expect(graphFromJson(graphToJson(bare)).pcb.outline).toBeUndefined();
  });

  it('invariants flag non-integer outline coordinates', () => {
    const g = buildGraph([...ledCircuitOps(), setOutline(RECT)]);
    expect(validateGraph(g)).toEqual([]);
    if (g.pcb.outline?.[0]) g.pcb.outline[0].x = 0.5;
    expect(validateGraph(g).some((v) => v.code === 'non_integer_coordinate')).toBe(true);
  });
});
