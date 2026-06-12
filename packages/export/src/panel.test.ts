import { materialize, validateGraph } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { exportExcellon } from './excellon.js';
import { exportEdgeCuts, exportGerberLayer } from './gerber.js';
import { BITE_DRILL_NM, BITE_PITCH_NM, panelizeGraph } from './panel.js';
import { exportPickPlace } from './pick-place.js';

import type { OpBody } from '@protopulse/graph';

const parts = seedPartDb();
const DATE = '2026-01-01T00:00:00.000Z';
const MM = 1_000_000;

function graphOf(ops: OpBody[]) {
  return materialize(ops.map((op, i) => ({ actor: 't', lamport: i + 1, ts: 0, op }))).graph;
}

/** One resistor, one trace, one via, a 20×12mm rectangular outline. */
function boardOps(): OpBody[] {
  return [
    { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '330' },
    { kind: 'connect', port: 'r1:1', newNetId: 'n1' },
    { kind: 'place_footprint', componentId: 'r1', at: { x: 10 * MM, y: 6 * MM }, rotMilli: 0, side: 'top', locked: false },
    { kind: 'route_trace', id: 't1', netId: 'n1', layerId: 'F.Cu', widthNm: 250_000, path: [{ x: 4 * MM, y: 6 * MM }, { x: 9 * MM, y: 6 * MM }] },
    { kind: 'place_via', id: 'v1', netId: 'n1', at: { x: 4 * MM, y: 6 * MM }, drillNm: 300_000, padNm: 600_000, span: ['F.Cu', 'B.Cu'] },
    {
      kind: 'set_board_outline',
      outline: [
        { x: 0, y: 0 },
        { x: 20 * MM, y: 0 },
        { x: 20 * MM, y: 12 * MM },
        { x: 0, y: 12 * MM },
      ],
    },
  ];
}

describe('panelizeGraph', () => {
  it('refuses without an outline, on non-rectangular outlines, and on a pointless 1×1', () => {
    const noOutline = graphOf(boardOps().filter((op) => op.kind !== 'set_board_outline'));
    const r1 = panelizeGraph(noOutline, { rows: 2, cols: 2, railNm: 0 });
    expect(r1).toMatchObject({ ok: false });
    if (!r1.ok) expect(r1.reason).toContain('no board outline');

    const lShape = graphOf([
      ...boardOps().filter((op) => op.kind !== 'set_board_outline'),
      {
        kind: 'set_board_outline',
        outline: [
          { x: 0, y: 0 },
          { x: 20 * MM, y: 0 },
          { x: 20 * MM, y: 6 * MM },
          { x: 10 * MM, y: 6 * MM },
          { x: 10 * MM, y: 12 * MM },
          { x: 0, y: 12 * MM },
        ],
      },
    ]);
    const r2 = panelizeGraph(lShape, { rows: 2, cols: 1, railNm: 0 });
    expect(r2).toMatchObject({ ok: false });
    if (!r2.ok) expect(r2.reason).toContain('RECTANGULAR');

    const r3 = panelizeGraph(graphOf(boardOps()), { rows: 1, cols: 1, railNm: 0 });
    expect(r3).toMatchObject({ ok: false });
  });

  it('2×3 replicates everything with offsets, distinct ids, and a valid graph', () => {
    const result = panelizeGraph(graphOf(boardOps()), { rows: 2, cols: 3, railNm: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.copies).toBe(6);
    const g = result.graph;

    expect(g.components.size).toBe(6);
    expect(g.pcb.traces.size).toBe(6);
    expect(g.pcb.vias.size).toBe(6);
    expect(g.nets.size).toBe(6);
    // Copy 1 keeps the original identity; copy 6 sits one row down, two cols right.
    expect(g.components.has('r1')).toBe(true);
    expect(g.components.get('r1~P6')?.ref).toBe('R1~P6');
    expect(g.pcb.placements.get('r1~P6')?.at).toEqual({ x: (10 + 40) * MM, y: (6 + 12) * MM });
    expect(g.pcb.vias.get('v1~P6')?.netId).toBe('n1~P6');
    expect(g.nets.get('n1~P6')?.ports).toEqual(['r1~P6:1']);

    // Panel outline spans 60×24mm; internal boundaries become V-cuts.
    expect(g.pcb.outline).toEqual([
      { x: 0, y: 0 },
      { x: 60 * MM, y: 0 },
      { x: 60 * MM, y: 24 * MM },
      { x: 0, y: 24 * MM },
    ]);
    expect(result.vCuts).toHaveLength(3); // 2 vertical + 1 horizontal
    // The panel graph is structurally sound — invariants hold.
    expect(validateGraph(g)).toEqual([]);
  });

  it('rails extend the outline and add their joint V-cuts', () => {
    const result = panelizeGraph(graphOf(boardOps()), { rows: 1, cols: 2, railNm: 5 * MM });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.pcb.outline).toEqual([
      { x: 0, y: -5 * MM },
      { x: 40 * MM, y: -5 * MM },
      { x: 40 * MM, y: 17 * MM },
      { x: 0, y: 17 * MM },
    ]);
    // 1 internal vertical + 2 rail joints.
    expect(result.vCuts).toHaveLength(3);
    expect(result.vCuts).toContainEqual({ a: { x: 0, y: 0 }, b: { x: 40 * MM, y: 0 } });
    expect(result.vCuts).toContainEqual({ a: { x: 0, y: 12 * MM }, b: { x: 40 * MM, y: 12 * MM } });
  });

  it('the panel graph flows through the EXISTING exporters unchanged', () => {
    const single = graphOf(boardOps());
    const result = panelizeGraph(single, { rows: 2, cols: 2, railNm: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Copper: 4× the flashes/draws of the single board.
    const one = exportGerberLayer(single, parts, 'F.Cu', { date: DATE });
    const four = exportGerberLayer(result.graph, parts, 'F.Cu', { date: DATE });
    const flashes = (s: string) => (s.match(/D03\*/g) ?? []).length;
    expect(flashes(four)).toBe(4 * flashes(one));

    // Pick-and-place: 4 placements, suffixed refs included.
    const pnp = exportPickPlace(result.graph, parts);
    expect(pnp).toContain('R1~P4');

    // Edge.Cuts: panel outline + one stroke per V-cut.
    const edges = exportEdgeCuts(result.graph, { date: DATE }, result.vCuts);
    expect(edges).not.toBeNull();
    expect((edges?.match(/D02\*/g) ?? []).length).toBe(1 + result.vCuts.length);

    // Deterministic end to end.
    const again = panelizeGraph(single, { rows: 2, cols: 2, railNm: 0 });
    if (again.ok) {
      expect(exportGerberLayer(again.graph, parts, 'F.Cu', { date: DATE })).toBe(four);
    }
  });
});

describe('panelizeGraph — mouse-bites', () => {
  const GAP = 2 * MM;
  const TAB = 5 * MM;
  /** Holes per tab at the default 5mm width / 0.75mm pitch. */
  const HOLES_PER_TAB = Math.floor(TAB / BITE_PITCH_NM) + 1;

  it('copies separate by the routed channel; v-cut output stays empty', () => {
    const result = panelizeGraph(graphOf(boardOps()), {
      rows: 2,
      cols: 2,
      railNm: 0,
      separation: 'mouse-bites',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.vCuts).toEqual([]);
    // Copy 4 (row 1, col 1) offsets by board + gap in both axes.
    expect(result.graph.pcb.placements.get('r1~P4')?.at).toEqual({
      x: 10 * MM + 20 * MM + GAP,
      y: 6 * MM + 12 * MM + GAP,
    });
    // Panel outline spans the copies plus the internal channels.
    expect(result.graph.pcb.outline).toEqual([
      { x: 0, y: 0 },
      { x: 40 * MM + GAP, y: 0 },
      { x: 40 * MM + GAP, y: 24 * MM + GAP },
      { x: 0, y: 24 * MM + GAP },
    ]);
    expect(validateGraph(result.graph)).toEqual([]);
  });

  it('bites run along BOTH edges of every channel, two tabs per copy edge', () => {
    const result = panelizeGraph(graphOf(boardOps()), {
      rows: 2,
      cols: 2,
      railNm: 0,
      separation: 'mouse-bites',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 1 vertical channel × 2 rows + 1 horizontal channel × 2 cols,
    // each bridged copy edge gets 2 tabs × both channel edges.
    const tabs = (1 * 2 + 1 * 2) * 2 * 2;
    expect(result.bites).toHaveLength(tabs * HOLES_PER_TAB);
    // Every bite center sits exactly on a piece edge line.
    const edgeXs = new Set([20 * MM, 20 * MM + GAP]);
    const edgeYs = new Set([12 * MM, 12 * MM + GAP]);
    for (const b of result.bites) {
      expect(edgeXs.has(b.x) || edgeYs.has(b.y)).toBe(true);
    }
    // Per-piece outlines: 4 copies × 4 edges.
    expect(result.edgeSegments).toHaveLength(16);
  });

  it('rails get their own strips, tabs, and bites', () => {
    const result = panelizeGraph(graphOf(boardOps()), {
      rows: 1,
      cols: 2,
      railNm: 5 * MM,
      separation: 'mouse-bites',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Outline: rails + their channels above and below the single row.
    expect(result.graph.pcb.outline).toEqual([
      { x: 0, y: -(5 * MM + GAP) },
      { x: 40 * MM + GAP, y: -(5 * MM + GAP) },
      { x: 40 * MM + GAP, y: 12 * MM + 5 * MM + GAP },
      { x: 0, y: 12 * MM + 5 * MM + GAP },
    ]);
    // Pieces: 2 copies + 2 rails = 4 rects of 4 edges.
    expect(result.edgeSegments).toHaveLength(16);
    // Channels: 1 vertical (1 row) + 2 rail channels (2 cols each);
    // tabs: (1×2 + 2×2×... ) — vertical: 2 tabs × 2 edges; rails:
    // 2 channels × 2 cols × 2 tabs × 2 edges.
    const tabs = 1 * 2 * 2 + 2 * 2 * 2 * 2;
    expect(result.bites).toHaveLength(tabs * HOLES_PER_TAB);
  });

  it('bites flow into the drill file as extra holes; default output is untouched', () => {
    const single = graphOf(boardOps());
    const result = panelizeGraph(single, {
      rows: 1,
      cols: 2,
      railNm: 0,
      separation: 'mouse-bites',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const plain = exportExcellon(result.graph, parts, { date: DATE });
    const withBites = exportExcellon(
      result.graph,
      parts,
      { date: DATE },
      result.bites.map((at) => ({ at, drillNm: BITE_DRILL_NM })),
    );
    // The bite tool joins the table and each hole lands once.
    expect(withBites).toContain('C0.500');
    expect(plain).not.toContain('C0.500');
    const holeLines = (s: string) => (s.match(/^X.*Y.*$/gm) ?? []).length;
    expect(holeLines(withBites)).toBe(holeLines(plain) + result.bites.length);

    // Edge.Cuts: outline + per-piece edges ride the extra-segments param.
    const edges = exportEdgeCuts(result.graph, { date: DATE }, result.edgeSegments);
    expect((edges?.match(/D02\*/g) ?? []).length).toBe(1 + result.edgeSegments.length);
  });
});
