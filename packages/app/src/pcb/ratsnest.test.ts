import { applyOp, emptyGraph, MM } from '@protopulse/graph';
import { describe, expect, it } from 'vitest';

import { dashedLines, ratsnestSegments } from './ratsnest.js';

import type { PadSource } from './tools.js';
import type { DesignGraph, OpBody } from '@protopulse/graph';
import type { PcbFootprintSpec, PcbPlacementLike, PcbTraceLike, PcbViewLike } from '@protopulse/renderer';

/** Pcb view + footprints are mocked (pinned v0.4 contract). */

const FOOTPRINT: PcbFootprintSpec = {
  pads: [
    { pinKey: '1', at: { x: -1 * MM, y: 0 }, wNm: 800_000, hNm: 800_000, shape: 'rect' },
    { pinKey: '2', at: { x: 1 * MM, y: 0 }, wNm: 800_000, hNm: 800_000, shape: 'rect' },
  ],
  courtyard: { wNm: 4 * MM, hNm: 2 * MM },
};

const parts: PadSource = { get: () => ({ footprint: FOOTPRINT }) };

function graphWith(ops: OpBody[]): DesignGraph {
  const g = emptyGraph();
  for (const op of ops) {
    const res = applyOp(g, op);
    if (!res.ok) throw new Error(res.error);
  }
  return g;
}

/** r1:2 and r2:1 on net na; r1 at origin, r2 at (10mm, 0). */
function netGraph(extra: OpBody[] = []): DesignGraph {
  return graphWith([
    { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
    { kind: 'add_component', id: 'r2', ref: 'R2', partId: 'core:resistor', partRev: 1 },
    { kind: 'connect', port: 'r1:2', newNetId: 'na' },
    { kind: 'connect', port: 'r2:1', netId: 'na' },
    ...extra,
  ]);
}

function placement(at: { x: number; y: number }): PcbPlacementLike {
  return { at, rotMilli: 0, side: 'top', locked: false };
}

function viewOf(placements: [string, PcbPlacementLike][], traces: [string, PcbTraceLike][] = []): PcbViewLike {
  return { placements: new Map(placements), traces: new Map(traces), vias: new Map() };
}

describe('ratsnestSegments', () => {
  it('draws one airwire between two unconnected placed pads of a net', () => {
    const graph = netGraph();
    const segs = ratsnestSegments(
      graph,
      viewOf([
        ['r1', placement({ x: 0, y: 0 })],
        ['r2', placement({ x: 10 * MM, y: 0 })],
      ]),
      parts,
    );
    expect(segs).toEqual([
      { netId: 'na', a: { x: 1 * MM, y: 0 }, b: { x: 9 * MM, y: 0 }, aPort: 'r1:2', bPort: 'r2:1' },
    ]);
  });

  it('skips nets whose pads a trace already joins', () => {
    const graph = netGraph();
    const trace: PcbTraceLike = {
      netId: 'na',
      layerId: 'F.Cu',
      widthNm: 200_000,
      path: [
        { x: 1 * MM, y: 0 },
        { x: 9 * MM, y: 0 },
      ],
    };
    const segs = ratsnestSegments(
      graph,
      viewOf(
        [
          ['r1', placement({ x: 0, y: 0 })],
          ['r2', placement({ x: 10 * MM, y: 0 })],
        ],
        [['t1', trace]],
      ),
      parts,
    );
    expect(segs).toEqual([]);
  });

  it('a partially-routed net still gets airwires from the copper to the rest', () => {
    const graph = graphWith([
      { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
      { kind: 'add_component', id: 'r2', ref: 'R2', partId: 'core:resistor', partRev: 1 },
      { kind: 'add_component', id: 'r3', ref: 'R3', partId: 'core:resistor', partRev: 1 },
      { kind: 'connect', port: 'r1:2', newNetId: 'na' },
      { kind: 'connect', port: 'r2:1', netId: 'na' },
      { kind: 'connect', port: 'r3:1', netId: 'na' },
    ]);
    // trace reaches ONLY r1:2 (1mm,0); r2:1 (9mm,0) and r3:1 (19mm,0) dangle
    const trace: PcbTraceLike = {
      netId: 'na',
      layerId: 'F.Cu',
      widthNm: 200_000,
      path: [
        { x: 1 * MM, y: 0 },
        { x: 1 * MM, y: 5 * MM },
      ],
    };
    const segs = ratsnestSegments(
      graph,
      viewOf(
        [
          ['r1', placement({ x: 0, y: 0 })],
          ['r2', placement({ x: 10 * MM, y: 0 })],
          ['r3', placement({ x: 20 * MM, y: 0 })],
        ],
        [['t1', trace]],
      ),
      parts,
    );
    // chain: traced r1:2 → r2:1, then r2:1 → r3:1 (nearest connected)
    expect(segs).toEqual([
      { netId: 'na', a: { x: 1 * MM, y: 0 }, b: { x: 9 * MM, y: 0 }, aPort: 'r1:2', bPort: 'r2:1' },
      { netId: 'na', a: { x: 9 * MM, y: 0 }, b: { x: 19 * MM, y: 0 }, aPort: 'r2:1', bPort: 'r3:1' },
    ]);
  });

  it('ignores pads of unplaced components', () => {
    const graph = netGraph();
    const segs = ratsnestSegments(graph, viewOf([['r1', placement({ x: 0, y: 0 })]]), parts);
    expect(segs).toEqual([]);
  });
});

describe('dashedLines', () => {
  it('splits airwires into dash quads covering the segment', () => {
    const lines = dashedLines(
      [{ netId: 'na', a: { x: 0, y: 0 }, b: { x: 2_000_000, y: 0 }, aPort: 'a:1', bPort: 'b:1' }],
      600_000,
      400_000,
    );
    expect(lines.length % 4).toBe(0);
    expect(lines.length).toBe(8); // dashes at [0,0.6mm] and [1mm,1.6mm]
    expect(lines[0]).toBe(0);
    expect(lines[2]).toBe(600_000);
    expect(lines[4]).toBe(1_000_000);
    expect(lines[6]).toBe(1_600_000);
  });

  it('zero-length segments produce nothing', () => {
    expect(
      dashedLines([{ netId: 'x', a: { x: 5, y: 5 }, b: { x: 5, y: 5 }, aPort: 'a:1', bPort: 'b:1' }])
        .length,
    ).toBe(0);
  });
});
