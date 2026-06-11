import { describe, expect, it } from 'vitest';

import { applyOp } from './apply.js';
import { diff } from './diff.js';
import { invertOp } from './inverse.js';
import { materialize } from './materialize.js';
import { threeWayMerge } from './merge.js';
import { validateGraph } from './invariants.js';
import { graphFromJson, graphToJson } from './store/serialize.js';
import { cloneGraph } from './types.js';
import { buildGraph, envelopes, FIX, ledCircuitOps } from './test-helpers.js';

import type { OpBody } from './ops.js';
import type { DesignGraph, Vec } from './types.js';

/** Zones through the whole core: apply/GC, inverse closure, diff,
 *  merge, invariants, serialization — the via pattern, polygon-shaped. */

const OUTLINE: Vec[] = [
  { x: 0, y: 0 },
  { x: 10_000_000, y: 0 },
  { x: 10_000_000, y: 10_000_000 },
  { x: 0, y: 10_000_000 },
];

function placeZone(id = 'z1', extra: Partial<Extract<OpBody, { kind: 'place_zone' }>> = {}): OpBody {
  return {
    kind: 'place_zone',
    id,
    netId: FIX.netGnd,
    layerId: 'F.Cu',
    outline: OUTLINE,
    ...extra,
  };
}

function withZone(extra: OpBody[] = []): DesignGraph {
  return buildGraph([...ledCircuitOps(), placeZone(), ...extra]);
}

describe('zone apply', () => {
  it('places and removes; the zone is deep-copied', () => {
    const g = withZone();
    const zone = g.pcb.zones.get('z1');
    expect(zone).toMatchObject({ netId: FIX.netGnd, layerId: 'F.Cu' });
    expect(zone?.outline).toEqual(OUTLINE);
    expect(zone?.outline[0]).not.toBe(OUTLINE[0]); // copied, not aliased
    expect(zone?.clearanceNm).toBeUndefined();

    const g2 = withZone([{ kind: 'remove_zone', id: 'z1' }]);
    expect(g2.pcb.zones.size).toBe(0);
  });

  it('keeps an explicit clearance override', () => {
    const g = buildGraph([...ledCircuitOps(), placeZone('z2', { clearanceNm: 200_000 })]);
    expect(g.pcb.zones.get('z2')?.clearanceNm).toBe(200_000);
  });

  it('rejects unknown nets, duplicate ids, and removing the missing', () => {
    const g = buildGraph(ledCircuitOps());
    expect(applyOp(g, placeZone('zx', { netId: 'n-ghost' })).ok).toBe(false);
    expect(applyOp(g, placeZone('zd')).ok).toBe(true);
    expect(applyOp(g, placeZone('zd')).ok).toBe(false);
    expect(applyOp(g, { kind: 'remove_zone', id: 'ghost' }).ok).toBe(false);
  });

  it("GC sweeps a dead net's zones (and only that net's)", () => {
    const g = withZone([placeZone('z-keep', { netId: FIX.netB })]);
    // Kill GND by disconnecting its last ports.
    const r1 = applyOp(g, { kind: 'disconnect', port: `${FIX.led}:K` });
    expect(r1.ok).toBe(true);
    const r2 = applyOp(g, { kind: 'disconnect', port: `${FIX.bat}:-` });
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      expect(r2.warnings.some((w) => w.code === 'zone_gc')).toBe(true);
    }
    expect(g.pcb.zones.has('z1')).toBe(false);
    expect(g.pcb.zones.has('z-keep')).toBe(true);
  });
});

describe('zone inverse closure', () => {
  it('place ↔ remove round-trips, preserving the clearance override', () => {
    const base = buildGraph(ledCircuitOps());
    const op = placeZone('z1', { clearanceNm: 150_000 });
    const inv = invertOp(base, op);
    expect(inv).toEqual([{ kind: 'remove_zone', id: 'z1' }]);

    const placed = cloneGraph(base);
    expect(applyOp(placed, op).ok).toBe(true);
    const invRemove = invertOp(placed, { kind: 'remove_zone', id: 'z1' });
    expect(invRemove).toEqual([op]);
    // Removing a zone that does not exist inverts to nothing.
    expect(invertOp(base, { kind: 'remove_zone', id: 'ghost' })).toEqual([]);
  });

  it('a net GC takes its zone along and the inverse resurrects both', () => {
    const g = withZone();
    const kill: OpBody = {
      kind: 'batch',
      label: 'kill gnd',
      ops: [
        { kind: 'disconnect', port: `${FIX.led}:K` },
        { kind: 'disconnect', port: `${FIX.bat}:-` },
      ],
    };
    const inv = invertOp(g, kill);
    const after = cloneGraph(g);
    expect(applyOp(after, kill).ok).toBe(true);
    expect(after.pcb.zones.size).toBe(0);
    for (const op of inv) expect(applyOp(after, op).ok).toBe(true);
    expect(after.pcb.zones.get('z1')?.outline).toEqual(OUTLINE);
  });

  it('un-merging nets re-points zones back (remove + place, id preserved)', () => {
    // A bystander zone on another net must NOT be re-pointed.
    const g = withZone([placeZone('z-other', { netId: FIX.netB })]);
    const merge: OpBody = { kind: 'merge_nets', survivor: FIX.netA, absorbed: FIX.netGnd };
    const inv = invertOp(g, merge);
    const after = cloneGraph(g);
    expect(applyOp(after, merge).ok).toBe(true);
    expect(after.pcb.zones.get('z1')?.netId).toBe(FIX.netA); // re-pointed by merge
    expect(after.pcb.zones.get('z-other')?.netId).toBe(FIX.netB); // bystander untouched
    for (const op of inv) expect(applyOp(after, op).ok).toBe(true);
    expect(after.pcb.zones.get('z1')?.netId).toBe(FIX.netGnd);
  });
});

describe('zone diff + merge', () => {
  it('diff reports zonesAdded / zonesRemoved; changed reads as both', () => {
    const a = buildGraph(ledCircuitOps());
    const b = withZone();
    const d = diff(a, b);
    expect(d.pcbView.zonesAdded).toEqual(['z1']);
    expect(diff(b, a).pcbView.zonesRemoved).toEqual(['z1']);

    const c = buildGraph([
      ...ledCircuitOps(),
      placeZone('z1', { outline: [...OUTLINE, { x: 0, y: 5_000_000 }] }),
    ]);
    const changed = diff(b, c);
    expect(changed.pcbView.zonesAdded).toEqual(['z1']);
    expect(changed.pcbView.zonesRemoved).toEqual(['z1']);
  });

  it('three-way merge replays theirs-only zone adds and removes', () => {
    const base = buildGraph(ledCircuitOps());
    const theirs = withZone([placeZone('z-clr', { clearanceNm: 180_000 })]);
    const { autoOps, conflicts } = threeWayMerge(base, cloneGraph(base), theirs);
    expect(conflicts).toEqual([]);
    const merged = cloneGraph(base);
    for (const op of autoOps) expect(applyOp(merged, op).ok).toBe(true);
    expect(merged.pcb.zones.has('z1')).toBe(true);
    expect(merged.pcb.zones.get('z-clr')?.clearanceNm).toBe(180_000);

    // Theirs removed it, ours untouched → removed.
    const withZ = withZone();
    const theirsRemoved = buildGraph(ledCircuitOps());
    const rm = threeWayMerge(withZ, cloneGraph(withZ), theirsRemoved);
    const merged2 = cloneGraph(withZ);
    for (const op of rm.autoOps) expect(applyOp(merged2, op).ok).toBe(true);
    expect(merged2.pcb.zones.size).toBe(0);
  });

  it('ours-touched zones win geometry races; both-added-same-id is a no-op', () => {
    const base = withZone();
    const oursOutline = [...OUTLINE, { x: -5_000_000, y: 5_000_000 }];
    const ours = buildGraph([...ledCircuitOps(), placeZone('z1', { outline: oursOutline })]);
    const theirs = buildGraph([
      ...ledCircuitOps(),
      placeZone('z1', { outline: [...OUTLINE, { x: 5_000_000, y: 15_000_000 }] }),
    ]);
    const race = threeWayMerge(base, ours, theirs);
    const merged = cloneGraph(ours);
    for (const op of race.autoOps) expect(applyOp(merged, op).ok).toBe(true);
    expect(merged.pcb.zones.get('z1')?.outline).toEqual(oursOutline); // ours kept

    // Both added the same zone id with identical content: nothing to do.
    const both = threeWayMerge(buildGraph(ledCircuitOps()), withZone(), withZone());
    expect(both.autoOps.filter((o) => o.kind === 'place_zone')).toEqual([]);
  });

  it('a theirs zone on a net ours no longer has is skipped, not crashed', () => {
    const base = buildGraph(ledCircuitOps());
    const theirs = withZone();
    const ours = cloneGraph(base);
    expect(applyOp(ours, { kind: 'disconnect', port: `${FIX.led}:K` }).ok).toBe(true);
    expect(applyOp(ours, { kind: 'disconnect', port: `${FIX.bat}:-` }).ok).toBe(true);
    const { autoOps } = threeWayMerge(base, ours, theirs);
    expect(autoOps.filter((o) => o.kind === 'place_zone')).toEqual([]);
  });
});

describe('zone invariants + serialization', () => {
  it('flags zones on missing nets and non-integer outlines', () => {
    const g = withZone();
    g.pcb.zones.set('z-bad', { id: 'z-bad', netId: 'n-ghost', layerId: 'F.Cu', outline: OUTLINE });
    g.pcb.zones.set('z-float', {
      id: 'z-float',
      netId: FIX.netGnd,
      layerId: 'F.Cu',
      outline: [{ x: 0.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    });
    const codes = validateGraph(g).map((v) => `${v.code}:${v.entityId ?? ''}`);
    expect(codes).toContain('geometry_on_dead_net:z-bad');
    expect(codes).toContain('non_integer_coordinate:z-float');
  });

  it('round-trips through graph JSON; legacy snapshots without zones load', () => {
    const g = withZone();
    const back = graphFromJson(graphToJson(g));
    expect(back.pcb.zones.get('z1')?.outline).toEqual(OUTLINE);

    const legacy = graphToJson(buildGraph(ledCircuitOps()));
    delete (legacy.pcb as { zones?: unknown[] }).zones;
    expect(graphFromJson(legacy).pcb.zones.size).toBe(0);
  });

  it('replay determinism holds with zones in the log', () => {
    const ops = [...ledCircuitOps(), placeZone(), { kind: 'remove_zone', id: 'z1' } as OpBody, placeZone('z2')];
    const a = materialize(envelopes(ops)).graph;
    const b = materialize([...envelopes(ops)].reverse()).graph;
    expect([...a.pcb.zones.keys()]).toEqual(['z2']);
    expect([...b.pcb.zones.keys()]).toEqual(['z2']);
  });
});
