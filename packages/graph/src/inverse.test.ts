import { describe, expect, it } from 'vitest';

import { applyOp } from './apply.js';
import { invertOp } from './inverse.js';
import { buildGraph, canonicalGraph as canonical, FIX, ledCircuitOps } from './test-helpers.js';
import { cloneGraph  } from './types.js';

import type { OpBody } from './ops.js';
import type {DesignGraph} from './types.js';


/** Apply op, then its inverses; the visible graph must round-trip. */
function expectRoundTrip(start: DesignGraph, op: OpBody): void {
  const before = cloneGraph(start);
  const g = cloneGraph(start);
  const res = applyOp(g, op);
  expect(res.ok).toBe(true);
  const inverses = invertOp(before, op);
  for (const inv of inverses) {
    const invRes = applyOp(g, inv);
    expect(invRes.ok).toBe(true);
  }
  expect(canonical(g)).toBe(canonical(before));
}

describe('invertOp — round-trips', () => {
  const base = (): DesignGraph => buildGraph(ledCircuitOps());

  it('add_component', () => {
    expectRoundTrip(base(), { kind: 'add_component', id: 'c9', ref: 'R9', partId: 'p1', partRev: 1 });
  });

  it('remove_component resurrects placement, memberships, and GC’d nets with wires', () => {
    const g = buildGraph([
      ...ledCircuitOps(),
      {
        kind: 'set_wire_geometry',
        netId: FIX.netB,
        segments: [{ a: { x: 0, y: 0 }, b: { x: 1270000, y: 0 } }],
      },
    ]);
    // Removing the LED leaves netB with one port (r1:2) and netGnd with bat:-.
    expectRoundTrip(g, { kind: 'remove_component', id: FIX.led });
    // Removing r1 after led would GC netB entirely — exercise the restore path.
    const g2 = cloneGraph(g);
    expect(applyOp(g2, { kind: 'remove_component', id: FIX.led }).ok).toBe(true);
    expectRoundTrip(g2, { kind: 'remove_component', id: FIX.r1 });
  });

  it('set_component_props (all fields, including value)', () => {
    expectRoundTrip(base(), {
      kind: 'set_component_props',
      id: FIX.r1,
      props: { ref: 'R99', value: '4k7', dnp: true, fields: { note: 'hot' } },
    });
    expectRoundTrip(base(), { kind: 'set_component_props', id: FIX.r1, props: { value: null } });
  });

  it('connect to existing net and connect creating a net', () => {
    const g = buildGraph([
      ...ledCircuitOps(),
      { kind: 'add_component', id: 'c9', ref: 'R9', partId: 'p1', partRev: 1 },
    ]);
    expectRoundTrip(g, { kind: 'connect', port: 'c9:1', netId: FIX.netA });
    expectRoundTrip(g, { kind: 'connect', port: 'c9:1', newNetId: 'n9' });
  });

  it('disconnect (net survives) and disconnect (net GC’d, wires restored)', () => {
    const g = buildGraph([
      ...ledCircuitOps(),
      { kind: 'add_component', id: 'c9', ref: 'R9', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c9:1', newNetId: 'n9' },
      { kind: 'set_wire_geometry', netId: 'n9', segments: [{ a: { x: 3, y: 3 }, b: { x: 9, y: 3 } }] },
    ]);
    expectRoundTrip(g, { kind: 'disconnect', port: `${FIX.r1}:1` });
    expectRoundTrip(g, { kind: 'disconnect', port: 'c9:1' });
  });

  it('merge_nets restores both nets, names, classes, and wires', () => {
    const g = buildGraph([
      ...ledCircuitOps(),
      { kind: 'set_net_class', netId: FIX.netB, netClass: 'signal' },
      { kind: 'set_wire_geometry', netId: FIX.netA, segments: [{ a: { x: 0, y: 0 }, b: { x: 7, y: 0 } }] },
      { kind: 'set_wire_geometry', netId: FIX.netB, segments: [{ a: { x: 9, y: 9 }, b: { x: 9, y: 0 } }] },
    ]);
    expectRoundTrip(g, { kind: 'merge_nets', survivor: FIX.netA, absorbed: FIX.netB });
  });

  it('split_net', () => {
    expectRoundTrip(base(), {
      kind: 'split_net',
      netId: FIX.netB,
      movedPorts: [`${FIX.led}:A`],
      newNetId: 'n-split',
    });
  });

  it('rename_net, set_net_class', () => {
    expectRoundTrip(base(), { kind: 'rename_net', netId: FIX.netA, name: 'VCC' });
    expectRoundTrip(base(), { kind: 'set_net_class', netId: FIX.netA, netClass: 'power' });
  });

  it('add_constraint / remove_constraint', () => {
    expectRoundTrip(base(), {
      kind: 'add_constraint',
      id: 'k1',
      body: { kind: 'current_max', netId: FIX.netA, amps: 0.02 },
      rationale: 'LED limit',
    });
    const g = buildGraph([
      ...ledCircuitOps(),
      {
        kind: 'add_constraint',
        id: 'k1',
        body: { kind: 'current_max', netId: FIX.netA, amps: 0.02 },
        rationale: 'LED limit',
      },
    ]);
    expectRoundTrip(g, { kind: 'remove_constraint', id: 'k1' });
  });

  it('place (fresh → unplace), move (→ restore), unplace (→ place)', () => {
    const g = buildGraph([
      ...ledCircuitOps(),
      { kind: 'add_component', id: 'c9', ref: 'R9', partId: 'p1', partRev: 1 },
    ]);
    expectRoundTrip(g, { kind: 'place_symbol', componentId: 'c9', at: { x: 0, y: 1270000 }, rot: 0, mirror: false });
    expectRoundTrip(g, { kind: 'move_symbol', componentId: FIX.r1, at: { x: 0, y: 0 }, rot: 270, mirror: true });
    expectRoundTrip(g, { kind: 'unplace_symbol', componentId: FIX.r1 });
  });

  it('set_wire_geometry (had none / had some)', () => {
    const g = buildGraph(ledCircuitOps());
    expectRoundTrip(g, {
      kind: 'set_wire_geometry',
      netId: FIX.netA,
      segments: [{ a: { x: 0, y: 0 }, b: { x: 1270000, y: 0 } }],
    });
    const g2 = buildGraph([
      ...ledCircuitOps(),
      { kind: 'set_wire_geometry', netId: FIX.netA, segments: [{ a: { x: 1, y: 1 }, b: { x: 2, y: 1 } }] },
    ]);
    expectRoundTrip(g2, { kind: 'set_wire_geometry', netId: FIX.netA, segments: [] });
  });

  it('set_design_meta restores prior values and blanks new keys', () => {
    const g = buildGraph([{ kind: 'set_design_meta', patch: { title: 'old' } }]);
    const before = cloneGraph(g);
    const op: OpBody = { kind: 'set_design_meta', patch: { title: 'new', extra: 'x' } };
    applyOp(g, op);
    for (const inv of invertOp(before, op)) applyOp(g, inv);
    expect(g.meta.title).toBe('old');
    expect(g.meta.extra).toBe('');
  });

  it('batch inverts to a reverse-ordered batch', () => {
    const g = buildGraph(ledCircuitOps());
    expectRoundTrip(g, {
      kind: 'batch',
      label: 'add wired resistor',
      ops: [
        { kind: 'add_component', id: 'c9', ref: 'R9', partId: 'p1', partRev: 1 },
        { kind: 'place_symbol', componentId: 'c9', at: { x: 0, y: 2540000 }, rot: 0, mirror: false },
        { kind: 'connect', port: 'c9:1', netId: FIX.netA },
        { kind: 'connect', port: 'c9:2', newNetId: 'n9' },
      ],
    });
  });

  it('non-undoable ops invert to []', () => {
    const g = buildGraph(ledCircuitOps());
    expect(invertOp(g, { kind: 'checkpoint', label: 'x' })).toEqual([]);
    expect(invertOp(g, { kind: 'annotate', anchor: 'n1', text: 'note' })).toEqual([]);
    expect(
      invertOp(g, { kind: 'route_trace', netId: 'n1', layerId: 'F.Cu', widthNm: 1, path: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }),
    ).toEqual([]);
  });

  it('inverting ops against stale state degrades to [] instead of throwing', () => {
    const g = buildGraph(ledCircuitOps());
    expect(invertOp(g, { kind: 'remove_component', id: 'ghost' })).toEqual([]);
    expect(invertOp(g, { kind: 'set_component_props', id: 'ghost', props: {} })).toEqual([]);
    expect(invertOp(g, { kind: 'disconnect', port: 'ghost:1' })).toEqual([]);
    expect(invertOp(g, { kind: 'merge_nets', survivor: 'ghost', absorbed: FIX.netA })).toEqual([]);
    expect(invertOp(g, { kind: 'split_net', netId: 'ghost', movedPorts: ['a:1'], newNetId: 'x' })).toEqual([]);
    expect(invertOp(g, { kind: 'rename_net', netId: 'ghost', name: 'X' })).toEqual([]);
    expect(invertOp(g, { kind: 'set_net_class', netId: 'ghost', netClass: 'x' })).toEqual([]);
    expect(invertOp(g, { kind: 'remove_constraint', id: 'ghost' })).toEqual([]);
    expect(invertOp(g, { kind: 'unplace_symbol', componentId: 'ghost' })).toEqual([]);
  });
});

describe('invertOp — coverage edges', () => {
  it('resurrects a component carrying dnp and fields', () => {
    const g = buildGraph([
      ...ledCircuitOps(),
      { kind: 'set_component_props', id: FIX.led, props: { dnp: true, fields: { bin: 'red' } } },
    ]);
    expectRoundTripPublic(g, { kind: 'remove_component', id: FIX.led });
  });
});

// re-exported tiny wrapper so the extra describe can reuse the helper
function expectRoundTripPublic(start: Parameters<typeof invertOp>[0], op: Parameters<typeof invertOp>[1]): void {
  const before = cloneGraph(start);
  const g = cloneGraph(start);
  expect(applyOp(g, op).ok).toBe(true);
  for (const inv of invertOp(before, op)) expect(applyOp(g, inv).ok).toBe(true);
  expect(canonical(g)).toBe(canonical(before));
}
