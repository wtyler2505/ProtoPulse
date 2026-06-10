import { MM } from '@protopulse/graph';
import { PartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { PickIndex } from './pick.js';
import {
  applyPcbPlacement,
  buildFootprintNode,
  buildPcbScene,
  buildTraceNode,
  buildViaNode,
  layerColor,
  padWorldPosition,
  PCB_LAYER_COLORS,
  pcbViewOf,
  quarterTurnsOf,
  syncPcbScene,
  tessellateFootprint,
  tessellatePad,
  VIA_COLOR,
} from './scene-pcb.js';
import { CIRCLE_SEGMENTS } from './tessellate.js';

import type {
  PartWithFootprint,
  PcbFootprintSpec,
  PcbPlacementLike,
  PcbTraceLike,
  PcbViaLike,
} from './scene-pcb.js';
import type { Component, DesignGraph } from '@protopulse/graph';
import type { Part } from '@protopulse/parts';

// ── Fixtures (pcb graph bits are MOCKED — @protopulse/graph's pcb ops
//    land on a parallel track; these tests pin the v0.4 contract) ──────

const FOOTPRINT: PcbFootprintSpec = {
  pads: [
    { pinKey: '1', at: { x: -1 * MM, y: 0 }, wNm: 800_000, hNm: 900_000, shape: 'rect' },
    { pinKey: '2', at: { x: 1 * MM, y: 0 }, wNm: 800_000, hNm: 900_000, shape: 'circle', drillNm: 400_000 },
  ],
  courtyard: { wNm: 4 * MM, hNm: 2 * MM },
};

function part(): Part {
  const p: PartWithFootprint = {
    id: 'core:resistor',
    rev: 1,
    name: 'Resistor',
    refPrefix: 'R',
    class: 'resistor',
    pins: [
      { key: '1', name: '1', electricalType: 'passive' },
      { key: '2', name: '2', electricalType: 'passive' },
    ],
    symbol: { primitives: [], pins: [] },
    provenance: 'unverified',
    footprint: FOOTPRINT,
  };
  return p;
}

function component(id: string, ref: string): Component {
  return { id, ref, partId: 'core:resistor', partRev: 1, dnp: false, fields: {} };
}

function placement(over: Partial<PcbPlacementLike> = {}): PcbPlacementLike {
  return { at: { x: 0, y: 0 }, rotMilli: 0, side: 'top', locked: false, ...over };
}

/** A DesignGraph with a Map-backed (pinned-contract) pcb view. */
function mockGraph(opts: {
  placements?: [string, PcbPlacementLike][];
  traces?: [string, PcbTraceLike][];
  vias?: [string, PcbViaLike][];
  legacyArrays?: boolean;
}): DesignGraph {
  const components = new Map(
    (opts.placements ?? []).map(([id], i) => [id, component(id, `R${String(i + 1)}`)] as const),
  );
  const pcb = opts.legacyArrays
    ? {
        placements: new Map(opts.placements ?? []),
        traces: (opts.traces ?? []).map(([, t]) => t),
        vias: (opts.vias ?? []).map(([, v]) => v),
      }
    : {
        placements: new Map(opts.placements ?? []),
        traces: new Map(opts.traces ?? []),
        vias: new Map(opts.vias ?? []),
      };
  return {
    components,
    nets: new Map(),
    buses: new Map(),
    constraints: new Map(),
    schematic: { placements: new Map(), wires: new Map() },
    pcb,
    annotations: [],
    meta: {},
    counters: { net: 0 },
  } as unknown as DesignGraph;
}

const parts = new PartDb([part()]);

// ── Transforms ───────────────────────────────────────────────────────

describe('quarterTurnsOf / applyPcbPlacement', () => {
  it('maps millidegree rotations to quarter turns (snapping off-axis)', () => {
    expect(quarterTurnsOf(0)).toBe(0);
    expect(quarterTurnsOf(90_000)).toBe(1);
    expect(quarterTurnsOf(180_000)).toBe(2);
    expect(quarterTurnsOf(270_000)).toBe(3);
    expect(quarterTurnsOf(359_000)).toBe(0); // snaps to nearest quarter
    expect(quarterTurnsOf(-90_000)).toBe(3);
  });

  it('rotates CCW in 90° steps around the placement origin', () => {
    const p = { x: 2 * MM, y: 0 };
    expect(applyPcbPlacement(p, placement())).toEqual({ x: 2 * MM, y: 0 });
    expect(applyPcbPlacement(p, placement({ rotMilli: 90_000 }))).toEqual({ x: 0, y: 2 * MM });
    expect(applyPcbPlacement(p, placement({ rotMilli: 180_000 }))).toEqual({ x: -2 * MM, y: 0 });
    expect(applyPcbPlacement(p, placement({ rotMilli: 270_000 }))).toEqual({ x: 0, y: -2 * MM });
  });

  it('mirrors X for bottom-side placements, before rotation', () => {
    const p = { x: 2 * MM, y: 1 * MM };
    expect(applyPcbPlacement(p, placement({ side: 'bottom' }))).toEqual({ x: -2 * MM, y: 1 * MM });
    // mirror then rot 90: (-2,1) → (-1,-2)
    expect(applyPcbPlacement(p, placement({ side: 'bottom', rotMilli: 90_000 }))).toEqual({
      x: -1 * MM,
      y: -2 * MM,
    });
  });

  it('translates by placement.at', () => {
    expect(applyPcbPlacement({ x: 1, y: 2 }, placement({ at: { x: 10, y: 20 } }))).toEqual({
      x: 11,
      y: 22,
    });
  });
});

describe('padWorldPosition', () => {
  it('returns the transformed pad center, or null for unknown pins', () => {
    const pl = placement({ at: { x: 5 * MM, y: 0 }, rotMilli: 90_000 });
    expect(padWorldPosition(FOOTPRINT, pl, '1')).toEqual({ x: 5 * MM, y: -1 * MM });
    expect(padWorldPosition(FOOTPRINT, pl, 'nope')).toBeNull();
  });
});

// ── Tessellation ─────────────────────────────────────────────────────

describe('tessellatePad', () => {
  it('rect pad: 4 outline segments + 2 diagonals (the X)', () => {
    const lines = tessellatePad(FOOTPRINT.pads[0]!, placement());
    expect(lines.length).toBe(6 * 4);
    // outline corners are at pad.at ± half size
    expect(lines.slice(0, 4)).toEqual([-1 * MM - 400_000, -450_000, -1 * MM + 400_000, -450_000]);
  });

  it('circle pad: loop + X + drill loop', () => {
    const lines = tessellatePad(FOOTPRINT.pads[1]!, placement());
    // pad loop + drill loop + 2 cross lines
    expect(lines.length).toBe((CIRCLE_SEGMENTS * 2 + 2) * 4);
  });

  it('rect pad rotates with the placement (90° swaps extents)', () => {
    const pad = { pinKey: '1', at: { x: 0, y: 0 }, wNm: 800_000, hNm: 400_000, shape: 'rect' as const };
    const lines = tessellatePad(pad, placement({ rotMilli: 90_000 }));
    const xs = lines.filter((_, i) => i % 2 === 0);
    const ys = lines.filter((_, i) => i % 2 === 1);
    expect(Math.max(...xs)).toBe(200_000);
    expect(Math.max(...ys)).toBe(400_000);
  });
});

describe('tessellateFootprint / buildFootprintNode', () => {
  it('emits courtyard outline plus every pad', () => {
    const lines = tessellateFootprint(FOOTPRINT, placement());
    const rectPad = tessellatePad(FOOTPRINT.pads[0]!, placement());
    const circlePad = tessellatePad(FOOTPRINT.pads[1]!, placement());
    expect(lines.length).toBe(4 * 4 + rectPad.length + circlePad.length);
  });

  it('footprint node: side picks the layer color, bounds cover the label', () => {
    const top = buildFootprintNode(component('r1', 'R1'), FOOTPRINT, placement());
    expect(top.kind).toBe('footprint');
    expect(top.color).toEqual(PCB_LAYER_COLORS['F.Cu']);
    expect(top.texts[0]?.text).toBe('R1');
    expect(top.bounds.maxY).toBeGreaterThan(1 * MM); // courtyard top + label

    const bottom = buildFootprintNode(
      component('r1', 'R1'),
      FOOTPRINT,
      placement({ side: 'bottom' }),
    );
    expect(bottom.color).toEqual(PCB_LAYER_COLORS['B.Cu']);
  });
});

describe('buildTraceNode / buildViaNode / layerColor', () => {
  const trace: PcbTraceLike = {
    netId: 'n1',
    layerId: 'F.Cu',
    widthNm: 200_000,
    path: [
      { x: 0, y: 0 },
      { x: 1 * MM, y: 1 * MM },
      { x: 3 * MM, y: 1 * MM },
    ],
  };

  it('trace node: one polyline segment per path edge, layer color', () => {
    const node = buildTraceNode('t1', trace);
    expect(node.kind).toBe('trace');
    expect(node.lines.length).toBe(2 * 4);
    expect(node.color).toEqual(PCB_LAYER_COLORS['F.Cu']);
    expect(node.bounds).toEqual({ minX: 0, minY: 0, maxX: 3 * MM, maxY: 1 * MM });
    expect(buildTraceNode('t2', { ...trace, layerId: 'B.Cu' }).color).toEqual(
      PCB_LAYER_COLORS['B.Cu'],
    );
  });

  it('via node: two concentric loops at the via position', () => {
    const via: PcbViaLike = {
      netId: 'n1',
      at: { x: 2 * MM, y: 0 },
      drillNm: 300_000,
      padNm: 600_000,
      span: ['F.Cu', 'B.Cu'],
    };
    const node = buildViaNode('v1', via);
    expect(node.kind).toBe('via');
    expect(node.color).toEqual(VIA_COLOR);
    expect(node.lines.length).toBe(CIRCLE_SEGMENTS * 2 * 4);
    expect(node.bounds.minX).toBe(2 * MM - 300_000);
    expect(node.bounds.maxX).toBe(2 * MM + 300_000);
  });

  it('unknown layers fall back to a neutral color', () => {
    expect(layerColor('In1.Cu')).not.toEqual(PCB_LAYER_COLORS['F.Cu']);
    expect(layerColor('F.Cu')).toEqual(PCB_LAYER_COLORS['F.Cu']);
  });
});

// ── Graph → scene ────────────────────────────────────────────────────

describe('pcbViewOf', () => {
  it('passes Map-backed (pinned contract) views through', () => {
    const graph = mockGraph({
      placements: [['r1', placement()]],
      traces: [['t1', { netId: 'n1', layerId: 'F.Cu', widthNm: 200_000, path: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }]],
      vias: [['v1', { netId: 'n1', at: { x: 0, y: 0 }, drillNm: 300_000, padNm: 600_000, span: ['F.Cu', 'B.Cu'] }]],
    });
    const view = pcbViewOf(graph);
    expect([...view.placements.keys()]).toEqual(['r1']);
    expect([...view.traces.keys()]).toEqual(['t1']);
    expect([...view.vias.keys()]).toEqual(['v1']);
  });

  it('normalizes legacy array-backed traces/vias with synthetic ids', () => {
    const graph = mockGraph({
      placements: [['r1', placement()]],
      traces: [['ignored', { netId: 'n1', layerId: 'B.Cu', widthNm: 200_000, path: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }]],
      legacyArrays: true,
    });
    const view = pcbViewOf(graph);
    expect([...view.traces.keys()]).toEqual(['trace:0']);
    expect(view.vias.size).toBe(0);
  });
});

describe('buildPcbScene / syncPcbScene', () => {
  it('builds nodes for placed footprints, traces, and vias', () => {
    const graph = mockGraph({
      placements: [
        ['r1', placement()],
        ['r2', placement({ at: { x: 10 * MM, y: 0 } })],
      ],
      traces: [['t1', { netId: 'n1', layerId: 'F.Cu', widthNm: 200_000, path: [{ x: 0, y: 0 }, { x: 5 * MM, y: 0 }] }]],
      vias: [['v1', { netId: 'n1', at: { x: 5 * MM, y: 0 }, drillNm: 300_000, padNm: 600_000, span: ['F.Cu', 'B.Cu'] }]],
    });
    const scene = buildPcbScene(graph, parts);
    expect([...scene.nodes.keys()].sort()).toEqual(['r1', 'r2', 't1', 'v1']);
    expect(scene.bounds()).not.toBeNull();
  });

  it('sync removes stale nodes and picks up new ones', () => {
    const before = mockGraph({ placements: [['r1', placement()]] });
    const scene = buildPcbScene(before, parts);
    const after = mockGraph({
      placements: [['r2', placement({ at: { x: 4 * MM, y: 0 } })]],
      vias: [['v1', { netId: 'n1', at: { x: 0, y: 0 }, drillNm: 300_000, padNm: 600_000, span: ['F.Cu', 'B.Cu'] }]],
    });
    syncPcbScene(scene, after, parts);
    expect([...scene.nodes.keys()].sort()).toEqual(['r2', 'v1']);
  });

  it('pcb nodes pick through the existing PickIndex (footprints over traces)', () => {
    const graph = mockGraph({
      placements: [['r1', placement()]],
      traces: [['t1', { netId: 'n1', layerId: 'F.Cu', widthNm: 200_000, path: [{ x: -2 * MM, y: 0 }, { x: 2 * MM, y: 0 }] }]],
    });
    const idx = new PickIndex();
    idx.rebuild(buildPcbScene(graph, parts));
    const hits = idx.pick({ x: 0, y: 0 }, 100_000);
    expect(hits.map((h) => h.id)).toEqual(['r1', 't1']);
    // trace AABB corners don't pick (segment proximity required)
    expect(idx.pick({ x: -2 * MM, y: 2 * MM }, 100_000).find((h) => h.id === 't1')).toBeUndefined();
  });
});
