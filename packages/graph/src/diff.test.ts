import { describe, expect, it } from 'vitest';

import { diff, isEmptyDelta, netFingerprint } from './diff.js';
import { buildGraph, FIX, ledCircuitOps, pcbViewOps } from './test-helpers.js';

import type { OpBody } from './ops.js';

function withExtra(extra: OpBody[]): ReturnType<typeof buildGraph> {
  return buildGraph([...ledCircuitOps(), ...extra]);
}

describe('diff', () => {
  it('identical graphs produce an empty delta', () => {
    const d = diff(buildGraph(ledCircuitOps()), buildGraph(ledCircuitOps()));
    expect(isEmptyDelta(d)).toBe(true);
  });

  it('detects added and removed components', () => {
    const a = buildGraph(ledCircuitOps());
    const b = withExtra([{ kind: 'add_component', id: 'c9', ref: 'R9', partId: 'p1', partRev: 1 }]);
    const d = diff(a, b);
    expect(d.components.added).toEqual(['c9']);
    expect(isEmptyDelta(d)).toBe(false);
    const back = diff(b, a);
    expect(back.components.removed).toEqual(['c9']);
  });

  it('detects property changes field-by-field', () => {
    const a = buildGraph(ledCircuitOps());
    const b = withExtra([
      {
        kind: 'set_component_props',
        id: FIX.r1,
        props: { ref: 'R77', value: '1k', dnp: true, fields: { note: 'x' } },
      },
    ]);
    const d = diff(a, b);
    const deltas = d.components.changed.get(FIX.r1);
    expect(deltas?.map((x) => x.field).sort()).toEqual(['dnp', 'fields', 'ref', 'value']);
  });

  it('detects net membership and rename changes', () => {
    const a = buildGraph(ledCircuitOps());
    const b = withExtra([
      { kind: 'add_component', id: 'c9', ref: 'R9', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c9:1', netId: FIX.netA },
      { kind: 'rename_net', netId: FIX.netA, name: 'VCC' },
    ]);
    const d = diff(a, b);
    expect(d.nets.membership.get(FIX.netA)).toEqual({ addedPorts: ['c9:1'], removedPorts: [] });
    expect(d.nets.renamed.get(FIX.netA)).toEqual(['N$1', 'VCC']);
  });

  it('pairs delete+recreate via connectivity fingerprint as "recreated"', () => {
    const a = buildGraph(ledCircuitOps());
    // Rebuild netB under a different UUID with identical membership.
    const b = withExtra([
      { kind: 'disconnect', port: `${FIX.r1}:2` },
      { kind: 'disconnect', port: `${FIX.led}:A` },
      { kind: 'connect', port: `${FIX.r1}:2`, newNetId: 'n-b2' },
      { kind: 'connect', port: `${FIX.led}:A`, netId: 'n-b2' },
    ]);
    const d = diff(a, b);
    expect(d.nets.recreated).toEqual([[FIX.netB, 'n-b2']]);
    expect(d.nets.added).toEqual([]);
    expect(d.nets.removed).toEqual([]);
    // Name changed (auto names differ), surfaced as a rename on the new id.
    expect(d.nets.renamed.has('n-b2')).toBe(true);
  });

  it('reports genuinely new and genuinely dead nets when fingerprints differ', () => {
    const a = buildGraph(ledCircuitOps());
    const b = withExtra([
      { kind: 'add_component', id: 'c9', ref: 'R9', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c9:1', newNetId: 'n9' },
    ]);
    expect(diff(a, b).nets.added).toEqual(['n9']);
    expect(diff(b, a).nets.removed).toEqual(['n9']);
  });

  it('fingerprint consumes each removed net at most once', () => {
    // Two added nets with the same fingerprint as one removed net: only
    // the first pairs; the second reads as added.
    const a = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
    ]);
    const fp = netFingerprint(a.nets.get('n1') as never);
    expect(fp).toBe('c1:1');
    const b = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'nX' },
    ]);
    const d = diff(a, b);
    expect(d.nets.recreated).toEqual([['n1', 'nX']]);
  });

  it('detects constraint add/remove/change', () => {
    const k = (amps: number): OpBody => ({
      kind: 'add_constraint',
      id: 'k1',
      body: { kind: 'current_max', netId: FIX.netA, amps },
    });
    const a = buildGraph([...ledCircuitOps(), k(1)]);
    const b = buildGraph([...ledCircuitOps(), k(2)]);
    const none = buildGraph(ledCircuitOps());
    expect(diff(none, a).constraints.added).toEqual(['k1']);
    expect(diff(a, none).constraints.removed).toEqual(['k1']);
    expect(diff(a, b).constraints.changed).toEqual(['k1']);
  });

  it('detects placement, unplacement, move, and wire changes', () => {
    const a = buildGraph(ledCircuitOps());
    const b = withExtra([
      { kind: 'move_symbol', componentId: FIX.r1, at: { x: 0, y: 1270000 }, rot: 0, mirror: false },
      { kind: 'unplace_symbol', componentId: FIX.led },
      { kind: 'set_wire_geometry', netId: FIX.netA, segments: [{ a: { x: 0, y: 0 }, b: { x: 5, y: 0 } }] },
    ]);
    const d = diff(a, b);
    expect(d.schematicView.moved).toEqual([FIX.r1]);
    expect(d.schematicView.unplaced).toEqual([FIX.led]);
    expect(d.schematicView.wiresChanged).toEqual([FIX.netA]);
    const back = diff(b, a);
    expect(back.schematicView.placed).toEqual([FIX.led]);
  });
});

describe('diff — coverage edges', () => {
  it('detects partId/partRev changes', () => {
    const a = buildGraph([{ kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 }]);
    const b = buildGraph([{ kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p2', partRev: 3 }]);
    const fields = diff(a, b).components.changed.get('c1')?.map((d) => d.field).sort();
    expect(fields).toEqual(['partId', 'partRev']);
  });

  it('detects wire removal (present in a, absent in b)', () => {
    const a = buildGraph([
      ...ledCircuitOps(),
      { kind: 'set_wire_geometry', netId: FIX.netA, segments: [{ a: { x: 0, y: 0 }, b: { x: 3, y: 0 } }] },
    ]);
    const b = buildGraph(ledCircuitOps());
    expect(diff(a, b).schematicView.wiresChanged).toEqual([FIX.netA]);
  });
});

describe('diff — PCB view', () => {
  const moveR1 = (patch: Partial<{ x: number; y: number; rotMilli: number; side: 'top' | 'bottom'; locked: boolean }>): OpBody => ({
    kind: 'move_footprint',
    componentId: FIX.r1,
    at: { x: patch.x ?? 0, y: patch.y ?? 0 },
    rotMilli: patch.rotMilli ?? 0,
    side: patch.side ?? 'top',
    locked: patch.locked ?? false,
  });

  it('identical pcb views produce an empty delta', () => {
    const ops = [...ledCircuitOps(), ...pcbViewOps()];
    expect(isEmptyDelta(diff(buildGraph(ops), buildGraph(ops)))).toBe(true);
  });

  it('detects footprint placement and unplacement', () => {
    const a = buildGraph(ledCircuitOps());
    const b = buildGraph([...ledCircuitOps(), ...pcbViewOps()]);
    const d = diff(a, b);
    expect(d.pcbView.placed.sort()).toEqual([FIX.led, FIX.r1]);
    expect(isEmptyDelta(d)).toBe(false);
    expect(diff(b, a).pcbView.unplaced.sort()).toEqual([FIX.led, FIX.r1]);
  });

  it('detects footprint moves on every field: x, y, rotation, side, lock', () => {
    const base = [...ledCircuitOps(), ...pcbViewOps()];
    const a = buildGraph(base);
    const cases: Parameters<typeof moveR1>[0][] = [
      { x: 1_000_000 },
      { y: 1_000_000 },
      { rotMilli: 90_000 },
      { side: 'bottom' },
      { locked: true },
    ];
    for (const patch of cases) {
      const b = buildGraph([...base, moveR1(patch)]);
      expect(diff(a, b).pcbView.moved, JSON.stringify(patch)).toEqual([FIX.r1]);
    }
  });

  it('detects added and removed traces and vias', () => {
    const a = buildGraph(ledCircuitOps());
    const b = buildGraph([...ledCircuitOps(), ...pcbViewOps()]);
    const d = diff(a, b);
    expect(d.pcbView.tracesAdded).toEqual(['t1']);
    expect(d.pcbView.viasAdded).toEqual(['v1']);
    const back = diff(b, a);
    expect(back.pcbView.tracesRemoved).toEqual(['t1']);
    expect(back.pcbView.viasRemoved).toEqual(['v1']);
  });

  it('a trace changed under the same id reads as removed + added', () => {
    const a = buildGraph([...ledCircuitOps(), ...pcbViewOps()]);
    const b = buildGraph([
      ...ledCircuitOps(),
      ...pcbViewOps(),
      { kind: 'remove_trace', id: 't1' },
      { kind: 'route_trace', id: 't1', netId: FIX.netB, layerId: 'F.Cu', widthNm: 300_000, path: [{ x: 0, y: 0 }, { x: 5_000_000, y: 0 }] },
    ]);
    const d = diff(a, b);
    expect(d.pcbView.tracesAdded).toEqual(['t1']);
    expect(d.pcbView.tracesRemoved).toEqual(['t1']);
    expect(d.pcbView.viasAdded).toEqual([]);
    expect(d.pcbView.viasRemoved).toEqual([]);
  });
});

describe('diff — identical wires are not a change', () => {
  it('same wire geometry on both sides stays out of the delta', () => {
    const wired: OpBody[] = [
      ...ledCircuitOps(),
      { kind: 'set_wire_geometry', netId: FIX.netA, segments: [{ a: { x: 0, y: 0 }, b: { x: 3, y: 0 } }] },
    ];
    const d = diff(buildGraph(wired), buildGraph(wired));
    expect(d.schematicView.wiresChanged).toEqual([]);
    expect(isEmptyDelta(d)).toBe(true);
  });
});
