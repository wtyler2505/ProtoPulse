import { applyOp, emptyGraph, MM } from '@protopulse/graph';
import { describe, expect, it } from 'vitest';

import { pcbAnchorIds, pcbAnchorPosition } from './anchors.js';
import { unplacedPcbComponents } from './selectors.js';

import type { NamedPadSource } from './selectors.js';
import type { PadSource } from './tools.js';
import type { DesignGraph, OpBody } from '@protopulse/graph';
import type { PcbFootprintSpec, PcbViewLike } from '@protopulse/renderer';

/** Pcb view + footprints are mocked (pinned v0.4 contract). */

const FOOTPRINT: PcbFootprintSpec = {
  pads: [
    { pinKey: '1', at: { x: -1 * MM, y: 0 }, wNm: 800_000, hNm: 800_000, shape: 'rect' },
    { pinKey: '2', at: { x: 1 * MM, y: 0 }, wNm: 800_000, hNm: 800_000, shape: 'rect' },
  ],
  courtyard: { wNm: 4 * MM, hNm: 2 * MM },
};

function buildGraph(ops: OpBody[]): DesignGraph {
  const g = emptyGraph();
  for (const op of ops) {
    const res = applyOp(g, op);
    if (!res.ok) throw new Error(res.error);
  }
  return g;
}

function emptyView(): PcbViewLike {
  return { placements: new Map(), traces: new Map(), vias: new Map() };
}

describe('unplacedPcbComponents (tray selector)', () => {
  const graph = buildGraph([
    { kind: 'add_component', id: 'c9', ref: 'R9', partId: 'core:resistor', partRev: 1 },
    { kind: 'add_component', id: 'c1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
    { kind: 'add_component', id: 'c2', ref: 'U1', partId: 'core:opamp', partRev: 1 },
    { kind: 'add_component', id: 'c3', ref: 'R3', partId: 'core:resistor', partRev: 1 },
    { kind: 'place_symbol', componentId: 'c9', at: { x: 0, y: 0 }, rot: 0, mirror: false },
    { kind: 'place_symbol', componentId: 'c1', at: { x: 0, y: 0 }, rot: 0, mirror: false },
    { kind: 'place_symbol', componentId: 'c2', at: { x: 0, y: 0 }, rot: 0, mirror: false },
    // c3 has NO schematic placement → it never reaches the tray
  ]);
  const parts: NamedPadSource = {
    get: (partId) =>
      partId === 'core:resistor'
        ? { name: 'Resistor', footprint: FOOTPRINT }
        : { name: 'Op-amp' }, // no footprint yet
  };

  it('lists schematic-placed components missing from the board, by ref', () => {
    const entries = unplacedPcbComponents(graph, emptyView(), parts);
    expect(entries.map((e) => e.ref)).toEqual(['R1', 'R9', 'U1']);
    expect(entries[0]).toEqual({
      componentId: 'c1',
      ref: 'R1',
      partName: 'Resistor',
      hasFootprint: true,
    });
    expect(entries[2]).toMatchObject({ ref: 'U1', hasFootprint: false });
  });

  it('drops components once they are placed on the board', () => {
    const view: PcbViewLike = {
      placements: new Map([['c1', { at: { x: 0, y: 0 }, rotMilli: 0, side: 'top', locked: false }]]),
      traces: new Map(),
      vias: new Map(),
    };
    const entries = unplacedPcbComponents(graph, view, parts);
    expect(entries.map((e) => e.ref)).toEqual(['R9', 'U1']);
  });
});

describe('pcb anchors (DRC focus)', () => {
  const graph = buildGraph([
    { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
    { kind: 'connect', port: 'r1:2', newNetId: 'na' },
  ]);
  const parts: PadSource = { get: () => ({ footprint: FOOTPRINT }) };
  const view: PcbViewLike = {
    placements: new Map([['r1', { at: { x: 5 * MM, y: 0 }, rotMilli: 0, side: 'top', locked: false }]]),
    traces: new Map([
      ['t1', { netId: 'na', layerId: 'F.Cu', widthNm: 200_000, path: [{ x: 6 * MM, y: 0 }, { x: 9 * MM, y: 0 }] }],
      ['t2', { netId: 'other', layerId: 'F.Cu', widthNm: 200_000, path: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }],
    ]),
    vias: new Map([
      ['v1', { netId: 'na', at: { x: 9 * MM, y: 0 }, drillNm: 300_000, padNm: 600_000, span: ['F.Cu', 'B.Cu'] }],
    ]),
  };

  it('net anchors light up the net plus its traces and vias', () => {
    expect(pcbAnchorIds(view, { kind: 'net', netId: 'na' })).toEqual(['na', 't1', 'v1']);
    expect(pcbAnchorIds(view, { kind: 'component', componentId: 'r1' })).toEqual(['r1']);
    expect(pcbAnchorIds(view, { kind: 'port', port: 'r1:2' })).toEqual(['r1']);
  });

  it('positions: component → placement, port → pad, net → first copper', () => {
    expect(pcbAnchorPosition(graph, view, parts, { kind: 'component', componentId: 'r1' }))
      .toEqual({ x: 5 * MM, y: 0 });
    expect(pcbAnchorPosition(graph, view, parts, { kind: 'port', port: 'r1:2' }))
      .toEqual({ x: 6 * MM, y: 0 });
    expect(pcbAnchorPosition(graph, view, parts, { kind: 'net', netId: 'na' }))
      .toEqual({ x: 6 * MM, y: 0 });
    expect(pcbAnchorPosition(graph, view, parts, { kind: 'component', componentId: 'nope' }))
      .toBeNull();
  });
});
