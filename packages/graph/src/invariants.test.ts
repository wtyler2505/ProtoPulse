import { describe, expect, it } from 'vitest';

import { validateGraph } from './invariants.js';
import { buildGraph, ledCircuitOps } from './test-helpers.js';
import { emptyGraph } from './types.js';

/**
 * apply() makes these states unrepresentable, so the corrupt states are
 * constructed by hand — exactly what a corrupted log or a buggy import
 * would produce.
 */
describe('validateGraph', () => {
  it('passes a healthy graph', () => {
    expect(validateGraph(buildGraph(ledCircuitOps()))).toEqual([]);
    expect(validateGraph(emptyGraph())).toEqual([]);
  });

  it('flags dangling ports', () => {
    const g = emptyGraph();
    g.nets.set('n1', { id: 'n1', name: 'X', ports: ['ghost:1'], netClass: 'default' });
    expect(validateGraph(g).map((v) => v.code)).toContain('dangling_port');
  });

  it('flags unknown pins when a pin checker is provided', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:99', newNetId: 'n1' },
    ]);
    const violations = validateGraph(g, { pinExists: () => false });
    expect(violations.map((v) => v.code)).toContain('unknown_pin');
    expect(validateGraph(g, { pinExists: () => true })).toEqual([]);
  });

  it('flags a port on two nets', () => {
    const g = buildGraph([{ kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 }]);
    g.nets.set('n1', { id: 'n1', name: 'A', ports: ['c1:1'], netClass: 'default' });
    g.nets.set('n2', { id: 'n2', name: 'B', ports: ['c1:1'], netClass: 'default' });
    expect(validateGraph(g).map((v) => v.code)).toContain('port_in_multiple_nets');
  });

  it('flags duplicate ref designators', () => {
    const g = emptyGraph();
    g.components.set('c1', { id: 'c1', ref: 'R1', partId: 'p', partRev: 1, dnp: false, fields: {} });
    g.components.set('c2', { id: 'c2', ref: 'R1', partId: 'p', partRev: 1, dnp: false, fields: {} });
    expect(validateGraph(g).map((v) => v.code)).toContain('duplicate_ref');
  });

  it('flags wire geometry on a dead net', () => {
    const g = emptyGraph();
    g.schematic.wires.set('ghost', [{ a: { x: 0, y: 0 }, b: { x: 1, y: 0 } }]);
    expect(validateGraph(g).map((v) => v.code)).toContain('geometry_on_dead_net');
  });

  it('flags traces and vias on dead nets', () => {
    const g = emptyGraph();
    g.pcb.traces.set('t1', { id: 't1', netId: 'ghost', layerId: 'F.Cu', widthNm: 250000, path: [{ x: 0, y: 0 }, { x: 1, y: 0 }] });
    g.pcb.vias.set('v1', { id: 'v1', netId: 'ghost', at: { x: 0, y: 0 }, drillNm: 300000, padNm: 600000, span: ['F.Cu', 'B.Cu'] });
    expect(validateGraph(g).filter((v) => v.code === 'geometry_on_dead_net')).toHaveLength(2);
  });

  it('flags placements without components', () => {
    const g = emptyGraph();
    g.schematic.placements.set('ghost', { at: { x: 0, y: 0 }, rot: 0, mirror: false });
    g.pcb.placements.set('ghost', { at: { x: 0, y: 0 }, rotMilli: 0, side: 'top', locked: false });
    expect(validateGraph(g).filter((v) => v.code === 'placement_without_component')).toHaveLength(2);
  });

  it('flags non-integer coordinates in placements and wires', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
      { kind: 'place_symbol', componentId: 'c1', at: { x: 0, y: 0 }, rot: 0, mirror: false },
    ]);
    const placement = g.schematic.placements.get('c1');
    if (placement) placement.at = { x: 0.5, y: 0 };
    g.schematic.wires.set('n1', [{ a: { x: 0, y: 0.25 }, b: { x: 1, y: 0 } }]);
    const codes = validateGraph(g).map((v) => v.code);
    expect(codes.filter((c) => c === 'non_integer_coordinate')).toHaveLength(2);
  });

  it('flags non-integer coordinates in footprints, traces, and vias', () => {
    const g = buildGraph([
      { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'p1', partRev: 1 },
      { kind: 'connect', port: 'c1:1', newNetId: 'n1' },
      { kind: 'place_footprint', componentId: 'c1', at: { x: 0, y: 0 }, rotMilli: 0, side: 'top', locked: false },
      { kind: 'route_trace', id: 't1', netId: 'n1', layerId: 'F.Cu', widthNm: 250000, path: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
      { kind: 'place_via', id: 'v1', netId: 'n1', at: { x: 0, y: 0 }, drillNm: 300000, padNm: 600000, span: ['F.Cu', 'B.Cu'] },
    ]);
    expect(validateGraph(g)).toEqual([]);
    const placement = g.pcb.placements.get('c1');
    if (placement) placement.at = { x: 0.5, y: 0 };
    const trace = g.pcb.traces.get('t1');
    if (trace) trace.path = [{ x: 0, y: 0 }, { x: 1.5, y: 0 }];
    const via = g.pcb.vias.get('v1');
    if (via) via.at = { x: 0, y: 0.5 };
    const codes = validateGraph(g).map((v) => v.code);
    expect(codes.filter((c) => c === 'non_integer_coordinate')).toHaveLength(3);
  });
});
