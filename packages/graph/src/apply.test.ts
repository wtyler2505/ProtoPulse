import { describe, expect, it } from 'vitest';

import { applyOp } from './apply.js';
import { buildGraph, FIX, ledCircuitOps } from './test-helpers.js';
import { emptyGraph, makePortRef, netOfPort } from './types.js';

import type { OpBody } from './ops.js';


function expectFail(graph = emptyGraph()) {
  return (op: OpBody, errorPart: string): void => {
    const res = applyOp(graph, op);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain(errorPart);
  };
}

describe('applyOp — components', () => {
  it('adds a component with defaults', () => {
    const g = emptyGraph();
    const res = applyOp(g, {
      kind: 'add_component',
      id: 'c1',
      ref: 'R1',
      partId: 'p1',
      partRev: 1,
      value: '10k',
    });
    expect(res.ok).toBe(true);
    const comp = g.components.get('c1');
    expect(comp).toMatchObject({ ref: 'R1', value: '10k', dnp: false, fields: {} });
  });

  it('rejects duplicate component id and duplicate ref', () => {
    const g = buildGraph([{ kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 }]);
    expectFail(g)({ kind: 'add_component', id: 'c1', ref: 'R2', partId: 'p1', partRev: 1 }, 'already exists');
    expectFail(g)({ kind: 'add_component', id: 'c2', ref: 'R1', partId: 'p1', partRev: 1 }, 'already in use');
  });

  it('removes a component, its placement, and GCs emptied nets (with wire geometry)', () => {
    const g = buildGraph([
      ...ledCircuitOps(),
      {
        kind: 'set_wire_geometry',
        netId: FIX.netA,
        segments: [{ a: { x: 0, y: 0 }, b: { x: 1270000, y: 0 } }],
      },
    ]);
    // netB connects only r1:2 and led:A. Removing both components empties it.
    const res1 = applyOp(g, { kind: 'remove_component', id: FIX.led });
    expect(res1.ok).toBe(true);
    const res2 = applyOp(g, { kind: 'remove_component', id: FIX.r1 });
    expect(res2.ok && res2.warnings.some((w) => w.code === 'net_gc')).toBe(true);
    if (res2.ok) {
      // netA had wire geometry and got emptied too (bat:+ remains? no — bat:+ is on netA)
      expect(res2.warnings.some((w) => w.code === 'wire_gc')).toBe(false);
    }
    expect(g.nets.has(FIX.netB)).toBe(false);
    expect(g.schematic.placements.has(FIX.r1)).toBe(false);
    // netA survives with bat:+ only.
    expect(g.nets.get(FIX.netA)?.ports).toEqual([makePortRef(FIX.bat, '+')]);
  });

  it('GCs wire geometry when the wired net empties', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
      { kind: 'set_wire_geometry', netId: 'n1', segments: [{ a: { x: 0, y: 0 }, b: { x: 10, y: 0 } }] },
    ]);
    const res = applyOp(g, { kind: 'remove_component', id: 'c1' });
    expect(res.ok && res.warnings.some((w) => w.code === 'wire_gc')).toBe(true);
    expect(g.schematic.wires.has('n1')).toBe(false);
  });

  it('rejects removing a missing component', () => {
    expectFail()({ kind: 'remove_component', id: 'ghost' }, 'not found');
  });

  it('sets component props: ref, value, null value, dnp, fields', () => {
    const g = buildGraph([{ kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1, value: '1k' }]);
    expect(
      applyOp(g, {
        kind: 'set_component_props',
        id: 'c1',
        props: { ref: 'R9', value: '4k7', dnp: true, fields: { tolerance: '1%' } },
      }).ok,
    ).toBe(true);
    expect(g.components.get('c1')).toMatchObject({
      ref: 'R9',
      value: '4k7',
      dnp: true,
      fields: { tolerance: '1%' },
    });
    expect(applyOp(g, { kind: 'set_component_props', id: 'c1', props: { value: null } }).ok).toBe(true);
    expect(g.components.get('c1')?.value).toBeUndefined();
  });

  it('allows a no-op ref set to the same value, rejects taking another ref', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'add_component', id: 'c2', ref: 'R2', partId: 'p1', partRev: 1 },
    ]);
    expect(applyOp(g, { kind: 'set_component_props', id: 'c1', props: { ref: 'R1' } }).ok).toBe(true);
    expectFail(g)({ kind: 'set_component_props', id: 'c1', props: { ref: 'R2' } }, 'already in use');
    expectFail(g)({ kind: 'set_component_props', id: 'ghost', props: {} }, 'not found');
  });
});

describe('applyOp — connectivity', () => {
  it('connect creates a net with a deterministic auto name', () => {
    const g = buildGraph([{ kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 }]);
    expect(applyOp(g, { kind: 'connect', port: 'c1:1', newNetId: 'n1' }).ok).toBe(true);
    expect(g.nets.get('n1')).toMatchObject({ name: 'N$1', ports: ['c1:1'], netClass: 'default' });
  });

  it('connect to an existing net keeps ports sorted', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'a', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'add_component', id: 'b', ref: 'R2', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'b:2', newNetId: 'n1' },
      { kind: 'connect', port: 'a:1', netId: 'n1' },
      { kind: 'connect', port: 'b:1', netId: 'n1' },
    ]);
    expect(g.nets.get('n1')?.ports).toEqual(['a:1', 'b:1', 'b:2']);
  });

  it('connect failure paths: missing component, already-connected port, missing net, no newNetId, dup net id', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
    ]);
    expectFail(g)({ kind: 'connect', port: 'ghost:1', newNetId: 'nX' }, 'missing component');
    expectFail(g)({ kind: 'connect', port: 'c1:1', netId: 'n1' }, 'explicit merge_nets');
    expectFail(g)({ kind: 'connect', port: 'c1:2', netId: 'ghost' }, 'not found');
    expectFail(g)({ kind: 'connect', port: 'c1:2' }, 'pre-allocated newNetId');
    expectFail(g)({ kind: 'connect', port: 'c1:2', newNetId: 'n1' }, 'already exists');
  });

  it('disconnect removes the port; last port GCs the net', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'add_component', id: 'c2', ref: 'R2', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
      { kind: 'connect', port: 'c2:1', netId: 'n1' },
    ]);
    expect(applyOp(g, { kind: 'disconnect', port: 'c1:1' }).ok).toBe(true);
    expect(g.nets.get('n1')?.ports).toEqual(['c2:1']);
    const res = applyOp(g, { kind: 'disconnect', port: 'c2:1' });
    expect(res.ok && res.warnings.some((w) => w.code === 'net_gc')).toBe(true);
    expect(g.nets.size).toBe(0);
    expectFail(g)({ kind: 'disconnect', port: 'c1:1' }, 'not connected');
  });

  it('merge_nets moves ports and wire geometry to the survivor', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'add_component', id: 'c2', ref: 'R2', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
      { kind: 'connect', port: 'c2:1', newNetId: 'n2' },
      { kind: 'set_wire_geometry', netId: 'n1', segments: [{ a: { x: 0, y: 0 }, b: { x: 5, y: 0 } }] },
      { kind: 'set_wire_geometry', netId: 'n2', segments: [{ a: { x: 9, y: 0 }, b: { x: 9, y: 9 } }] },
    ]);
    expect(applyOp(g, { kind: 'merge_nets', survivor: 'n1', absorbed: 'n2' }).ok).toBe(true);
    expect(g.nets.has('n2')).toBe(false);
    expect(g.nets.get('n1')?.ports).toEqual(['c1:1', 'c2:1']);
    expect(g.schematic.wires.get('n1')).toHaveLength(2);
    expect(g.schematic.wires.has('n2')).toBe(false);
  });

  it('merge_nets without absorbed-side wires leaves survivor wires alone', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'add_component', id: 'c2', ref: 'R2', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
      { kind: 'connect', port: 'c2:1', newNetId: 'n2' },
    ]);
    expect(applyOp(g, { kind: 'merge_nets', survivor: 'n1', absorbed: 'n2' }).ok).toBe(true);
    expect(g.schematic.wires.has('n1')).toBe(false);
  });

  it('merge_nets failure paths', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
    ]);
    expectFail(g)({ kind: 'merge_nets', survivor: 'ghost', absorbed: 'n1' }, 'survivor');
    expectFail(g)({ kind: 'merge_nets', survivor: 'n1', absorbed: 'ghost' }, 'absorbed');
    expectFail(g)({ kind: 'merge_nets', survivor: 'n1', absorbed: 'n1' }, 'itself');
  });

  it('split_net moves the partition to a new net inheriting the class', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'add_component', id: 'c2', ref: 'R2', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
      { kind: 'connect', port: 'c2:1', netId: 'n1' },
      { kind: 'set_net_class', netId: 'n1', netClass: 'power' },
    ]);
    expect(applyOp(g, { kind: 'split_net', netId: 'n1', movedPorts: ['c2:1'], newNetId: 'n2' }).ok).toBe(true);
    expect(g.nets.get('n1')?.ports).toEqual(['c1:1']);
    expect(g.nets.get('n2')).toMatchObject({ ports: ['c2:1'], netClass: 'power' });
  });

  it('split_net that moves every port GCs the source net', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
    ]);
    const res = applyOp(g, { kind: 'split_net', netId: 'n1', movedPorts: ['c1:1'], newNetId: 'n2' });
    expect(res.ok && res.warnings.some((w) => w.code === 'net_gc')).toBe(true);
    expect(g.nets.has('n1')).toBe(false);
    expect(g.nets.get('n2')?.ports).toEqual(['c1:1']);
  });

  it('split_net failure paths', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
    ]);
    expectFail(g)({ kind: 'split_net', netId: 'ghost', movedPorts: ['c1:1'], newNetId: 'n2' }, 'not found');
    expectFail(g)({ kind: 'split_net', netId: 'n1', movedPorts: ['c1:1'], newNetId: 'n1' }, 'already exists');
    expectFail(g)({ kind: 'split_net', netId: 'n1', movedPorts: ['c9:9'], newNetId: 'n2' }, 'not on net');
  });

  it('rename_net and set_net_class, with failure paths', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
    ]);
    expect(applyOp(g, { kind: 'rename_net', netId: 'n1', name: 'VBAT' }).ok).toBe(true);
    expect(applyOp(g, { kind: 'set_net_class', netId: 'n1', netClass: 'power' }).ok).toBe(true);
    expect(g.nets.get('n1')).toMatchObject({ name: 'VBAT', netClass: 'power' });
    expectFail(g)({ kind: 'rename_net', netId: 'ghost', name: 'X' }, 'not found');
    expectFail(g)({ kind: 'set_net_class', netId: 'ghost', netClass: 'x' }, 'not found');
  });
});

describe('applyOp — constraints, view, meta', () => {
  it('adds and removes constraints with rationale', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
    ]);
    expect(
      applyOp(g, {
        kind: 'add_constraint',
        id: 'k1',
        body: { kind: 'current_max', netId: 'n1', amps: 0.5 },
        rationale: 'LED string budget',
      }).ok,
    ).toBe(true);
    expect(g.constraints.get('k1')?.rationale).toBe('LED string budget');
    expectFail(g)({ kind: 'add_constraint', id: 'k1', body: { kind: 'current_max', netId: 'n1', amps: 1 } }, 'already exists');
    expect(applyOp(g, { kind: 'remove_constraint', id: 'k1' }).ok).toBe(true);
    expectFail(g)({ kind: 'remove_constraint', id: 'k1' }, 'not found');
  });

  it('add_constraint without rationale stores none', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
      { kind: 'add_constraint', id: 'k1', body: { kind: 'current_max', netId: 'n1', amps: 1 } },
    ]);
    expect(g.constraints.get('k1')?.rationale).toBeUndefined();
  });

  it('place, move, unplace symbol with failure paths', () => {
    const g = buildGraph([{ kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 }]);
    expectFail(g)({ kind: 'move_symbol', componentId: 'c1', at: { x: 0, y: 0 }, rot: 0, mirror: false }, 'no placement');
    expectFail(g)({ kind: 'place_symbol', componentId: 'ghost', at: { x: 0, y: 0 }, rot: 0, mirror: false }, 'not found');
    expect(applyOp(g, { kind: 'place_symbol', componentId: 'c1', at: { x: 0, y: 0 }, rot: 0, mirror: false }).ok).toBe(true);
    expect(applyOp(g, { kind: 'move_symbol', componentId: 'c1', at: { x: 1270000, y: 0 }, rot: 90, mirror: true }).ok).toBe(true);
    expect(g.schematic.placements.get('c1')).toMatchObject({ at: { x: 1270000, y: 0 }, rot: 90, mirror: true });
    expect(applyOp(g, { kind: 'unplace_symbol', componentId: 'c1' }).ok).toBe(true);
    expect(g.schematic.placements.has('c1')).toBe(false);
    expectFail(g)({ kind: 'unplace_symbol', componentId: 'c1' }, 'no placement');
  });

  it('set_wire_geometry replaces, empty array clears, missing net fails', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
    ]);
    expect(
      applyOp(g, { kind: 'set_wire_geometry', netId: 'n1', segments: [{ a: { x: 0, y: 0 }, b: { x: 5, y: 0 } }] }).ok,
    ).toBe(true);
    expect(g.schematic.wires.get('n1')).toHaveLength(1);
    expect(applyOp(g, { kind: 'set_wire_geometry', netId: 'n1', segments: [] }).ok).toBe(true);
    expect(g.schematic.wires.has('n1')).toBe(false);
    expectFail(g)({ kind: 'set_wire_geometry', netId: 'ghost', segments: [] }, 'not found');
  });

  it('PCB ops report unimplemented in M1', () => {
    expectFail()({ kind: 'place_footprint', componentId: 'c1', at: { x: 0, y: 0 }, rotMilli: 0, side: 'top', locked: false }, 'unimplemented');
    expectFail()({ kind: 'route_trace', netId: 'n1', layerId: 'F.Cu', widthNm: 200000, path: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }, 'unimplemented');
    expectFail()({ kind: 'place_via', netId: 'n1', at: { x: 0, y: 0 }, drillNm: 300000, padNm: 600000, span: ['F.Cu', 'B.Cu'] }, 'unimplemented');
  });

  it('checkpoint is a no-op; annotate appends; set_design_meta merges', () => {
    const g = emptyGraph();
    expect(applyOp(g, { kind: 'checkpoint', label: 'before review' }).ok).toBe(true);
    expect(applyOp(g, { kind: 'annotate', anchor: 'n1', text: 'sag here' }).ok).toBe(true);
    expect(g.annotations).toEqual([{ anchor: 'n1', text: 'sag here' }]);
    expect(applyOp(g, { kind: 'set_design_meta', patch: { title: 'Probe' } }).ok).toBe(true);
    expect(applyOp(g, { kind: 'set_design_meta', patch: { rev: 'A' } }).ok).toBe(true);
    expect(g.meta).toEqual({ title: 'Probe', rev: 'A' });
  });
});

describe('applyOp — batch atomicity', () => {
  it('a successful batch commits all member ops as one unit', () => {
    const g = emptyGraph();
    const res = applyOp(g, {
      kind: 'batch',
      label: 'add resistor',
      ops: [
        { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
        { kind: 'place_symbol', componentId: 'c1', at: { x: 0, y: 0 }, rot: 0, mirror: false },
        { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
      ],
    });
    expect(res.ok).toBe(true);
    expect(g.components.has('c1')).toBe(true);
    expect(g.schematic.placements.has('c1')).toBe(true);
    expect(g.nets.has('n1')).toBe(true);
  });

  it('a failing member rolls the whole batch back', () => {
    const g = buildGraph([{ kind: 'add_component', id: 'c0', ref: 'R1', partId: 'p1', partRev: 1 }]);
    const res = applyOp(g, {
      kind: 'batch',
      label: 'doomed',
      ops: [
        { kind: 'add_component', id: 'c1', ref: 'R2', partId: 'p1', partRev: 1 },
        { kind: 'add_component', id: 'c2', ref: 'R1', partId: 'p1', partRev: 1 }, // dup ref → fails
      ],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('doomed');
    expect(g.components.has('c1')).toBe(false);
    expect(g.components.size).toBe(1);
  });

  it('batch propagates member warnings', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
    ]);
    const res = applyOp(g, {
      kind: 'batch',
      label: 'disconnect all',
      ops: [{ kind: 'disconnect', port: 'c1:1' }],
    });
    expect(res.ok && res.warnings.some((w) => w.code === 'net_gc')).toBe(true);
  });

  it('netOfPort finds membership and misses cleanly', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
    ]);
    expect(netOfPort(g, 'c1:1')?.id).toBe('n1');
    expect(netOfPort(g, 'c1:2')).toBeUndefined();
  });
});

describe('applyOp — coverage edges', () => {
  it('merge_nets moves wires onto a survivor that had none', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'add_component', id: 'c2', ref: 'R2', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
      { kind: 'connect', port: 'c2:1', newNetId: 'n2' },
      { kind: 'set_wire_geometry', netId: 'n2', segments: [{ a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }] },
    ]);
    expect(applyOp(g, { kind: 'merge_nets', survivor: 'n1', absorbed: 'n2' }).ok).toBe(true);
    expect(g.schematic.wires.get('n1')).toHaveLength(1);
  });
});
