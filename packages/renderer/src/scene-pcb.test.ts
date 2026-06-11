import { diff, MM } from '@protopulse/graph';
import { PartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { PickIndex } from './pick.js';
import {
  applyPcbPlacement,
  buildFootprintNode,
  buildPcbScene,
  buildTraceNode,
  buildViaNode,
  circleFanTris,
  layerColor,
  padWorldPosition,
  PCB_LAYER_COLORS,
  pcbViewOf,
  quadTris,
  quarterTurnsOf,
  rebuildPcbScene,
  strokeSegmentTris,
  syncPcbScene,
  tessellateFootprint,
  tessellatePad,
  tessellatePadHoleTris,
  tessellatePadTris,
  tessellateTraceTris,
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
        zones: new Map(),
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
  it('rect pad: a thin 4-segment outline (the fill is triangles now)', () => {
    const lines = tessellatePad(FOOTPRINT.pads[0]!, placement());
    expect(lines.length).toBe(4 * 4);
    // outline corners are at pad.at ± half size
    expect(lines.slice(0, 4)).toEqual([-1 * MM - 400_000, -450_000, -1 * MM + 400_000, -450_000]);
  });

  it('circle pad: outline loop + drill loop', () => {
    const lines = tessellatePad(FOOTPRINT.pads[1]!, placement());
    expect(lines.length).toBe(CIRCLE_SEGMENTS * 2 * 4);
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

// ── Triangle tessellation ────────────────────────────────────────────

/** Signed area of an x,y triangle stream — positive = CCW winding. */
function signedArea(tris: ArrayLike<number>): number {
  let area = 0;
  for (let i = 0; i + 5 < tris.length; i += 6) {
    const ax = tris[i]!;
    const ay = tris[i + 1]!;
    const bx = tris[i + 2]!;
    const by = tris[i + 3]!;
    const cx = tris[i + 4]!;
    const cy = tris[i + 5]!;
    area += ((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
  }
  return area;
}

describe('quadTris / circleFanTris / strokeSegmentTris', () => {
  it('quad: 2 triangles whose signed area is the quad area (CCW)', () => {
    const tris = quadTris({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 });
    expect(tris.length).toBe(2 * 6);
    expect(signedArea(tris)).toBe(12);
  });

  it('circle fan: CIRCLE_SEGMENTS triangles, CCW, area ≈ πr²', () => {
    const r = 400_000;
    const tris = circleFanTris({ x: 1 * MM, y: -2 * MM }, r);
    expect(tris.length).toBe(CIRCLE_SEGMENTS * 6);
    const area = signedArea(tris);
    expect(area).toBeGreaterThan(0); // CCW
    // a 16-gon inscribes ~97.4% of the disc; allow integer rounding slop
    expect(area).toBeGreaterThan(Math.PI * r * r * 0.95);
    expect(area).toBeLessThan(Math.PI * r * r * 1.01);
  });

  it('stroked segment: axis-aligned quad has exact area len × width', () => {
    const tris = strokeSegmentTris({ x: 0, y: 0 }, { x: 4 * MM, y: 0 }, 200_000);
    expect(tris.length).toBe(2 * 6);
    expect(signedArea(tris)).toBe(4 * MM * 200_000);
    // expanded perpendicular by width/2 on each side
    const ys = tris.filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBe(-100_000);
    expect(Math.max(...ys)).toBe(100_000);
  });

  it('stroked segment: 45° quad area ≈ len × width (integer rounding)', () => {
    const tris = strokeSegmentTris({ x: 0, y: 0 }, { x: 1 * MM, y: 1 * MM }, 200_000);
    const ideal = Math.hypot(1 * MM, 1 * MM) * 200_000;
    expect(signedArea(tris)).toBeGreaterThan(ideal * 0.999);
    expect(signedArea(tris)).toBeLessThan(ideal * 1.001);
  });

  it('stroked segment: zero length or zero width emits nothing', () => {
    expect(strokeSegmentTris({ x: 5, y: 5 }, { x: 5, y: 5 }, 200_000)).toEqual([]);
    expect(strokeSegmentTris({ x: 0, y: 0 }, { x: 1 * MM, y: 0 }, 0)).toEqual([]);
  });
});

describe('tessellatePadTris / tessellatePadHoleTris', () => {
  it('rect pad fills as 2 triangles with area w × h', () => {
    const tris = tessellatePadTris(FOOTPRINT.pads[0]!, placement());
    expect(tris.length).toBe(2 * 6);
    expect(signedArea(tris)).toBe(800_000 * 900_000);
  });

  it('rect pad fill follows the placement rotation (90° swaps extents)', () => {
    const pad = { pinKey: '1', at: { x: 0, y: 0 }, wNm: 800_000, hNm: 400_000, shape: 'rect' as const };
    const tris = tessellatePadTris(pad, placement({ rotMilli: 90_000 }));
    const xs = tris.filter((_, i) => i % 2 === 0);
    const ys = tris.filter((_, i) => i % 2 === 1);
    expect(Math.max(...xs)).toBe(200_000);
    expect(Math.max(...ys)).toBe(400_000);
  });

  it('circle pad fills as a 16-segment fan around the world center', () => {
    const tris = tessellatePadTris(FOOTPRINT.pads[1]!, placement({ at: { x: 2 * MM, y: 0 } }));
    expect(tris.length).toBe(CIRCLE_SEGMENTS * 6);
    // fan center vertex repeats at the transformed pad position
    expect(tris[0]).toBe(3 * MM);
    expect(tris[1]).toBe(0);
  });

  it('drilled pads punch a hole fan; SMD pads do not', () => {
    const hole = tessellatePadHoleTris(FOOTPRINT.pads[1]!, placement());
    expect(hole.length).toBe(CIRCLE_SEGMENTS * 6);
    const r = 200_000; // drillNm / 2
    expect(signedArea(hole)).toBeGreaterThan(Math.PI * r * r * 0.95);
    expect(tessellatePadHoleTris(FOOTPRINT.pads[0]!, placement())).toEqual([]);
  });

  it('bottom-side mirror flips the fill winding (and the geometry)', () => {
    const top = tessellatePadTris(FOOTPRINT.pads[0]!, placement());
    const bottom = tessellatePadTris(FOOTPRINT.pads[0]!, placement({ side: 'bottom' }));
    expect(signedArea(top)).toBeGreaterThan(0);
    expect(signedArea(bottom)).toBeLessThan(0); // mirrored — GL never culls
    // pad 1 sits at x = -1mm locally; the mirror puts its fill at +1mm
    const xs = bottom.filter((_, i) => i % 2 === 0);
    expect(Math.min(...xs)).toBe(1 * MM - 400_000);
    expect(Math.max(...xs)).toBe(1 * MM + 400_000);
  });
});

describe('tessellateTraceTris', () => {
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

  it('emits one quad per segment plus a joint fan per vertex', () => {
    const tris = tessellateTraceTris(trace);
    // 2 segments × 2 tris + 3 vertices × CIRCLE_SEGMENTS fan tris
    expect(tris.length).toBe((2 * 2 + 3 * CIRCLE_SEGMENTS) * 6);
  });

  it('covers the stroked width: bounds extend widthNm/2 past the path', () => {
    const tris = tessellateTraceTris(trace);
    const xs = tris.filter((_, i) => i % 2 === 0);
    const ys = tris.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBe(-100_000);
    expect(Math.max(...xs)).toBe(3 * MM + 100_000);
    expect(Math.min(...ys)).toBe(-100_000);
    expect(Math.max(...ys)).toBe(1 * MM + 100_000);
  });

  it('degenerate paths emit nothing', () => {
    expect(tessellateTraceTris({ ...trace, path: [{ x: 0, y: 0 }] })).toEqual([]);
    expect(tessellateTraceTris({ ...trace, path: [] })).toEqual([]);
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

  it('footprint node carries pad fills and drill holes as triangles', () => {
    const node = buildFootprintNode(component('r1', 'R1'), FOOTPRINT, placement());
    // rect pad (2 tris) + circle pad (fan)
    expect(node.tris?.length).toBe((2 + CIRCLE_SEGMENTS) * 6);
    // only the circle pad has a drill
    expect(node.holeTris?.length).toBe(CIRCLE_SEGMENTS * 6);
  });

  it('bottom-side footprint mirrors its pad fills (B.Cu tint comes from color)', () => {
    const node = buildFootprintNode(
      component('r1', 'R1'),
      FOOTPRINT,
      placement({ side: 'bottom' }),
    );
    // rect pad 1 sits at x = -1mm locally → +1mm mirrored; its fill is
    // the first 12 floats of the tri stream.
    const rectXs = [...node.tris!.slice(0, 12)].filter((_, i) => i % 2 === 0);
    expect(Math.min(...rectXs)).toBe(1 * MM - 400_000);
    expect(Math.max(...rectXs)).toBe(1 * MM + 400_000);
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

  it('trace node: centerline polyline + stroked-width fill, layer color', () => {
    const node = buildTraceNode('t1', trace);
    expect(node.kind).toBe('trace');
    expect(node.lines.length).toBe(2 * 4); // centerline (picking keys on it)
    expect(node.tris?.length).toBe((2 * 2 + 3 * CIRCLE_SEGMENTS) * 6);
    expect(node.color).toEqual(PCB_LAYER_COLORS['F.Cu']);
    // bounds cover the stroke, not just the centerline
    expect(node.bounds).toEqual({
      minX: -100_000,
      minY: -100_000,
      maxX: 3 * MM + 100_000,
      maxY: 1 * MM + 100_000,
    });
    expect(buildTraceNode('t2', { ...trace, layerId: 'B.Cu' }).color).toEqual(
      PCB_LAYER_COLORS['B.Cu'],
    );
  });

  it('via node: filled annulus (copper fan + background drill fan) under two loops', () => {
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
    expect(node.tris?.length).toBe(CIRCLE_SEGMENTS * 6); // outer copper fan
    expect(node.holeTris?.length).toBe(CIRCLE_SEGMENTS * 6); // drill fan
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

describe('buildPcbScene / rebuildPcbScene', () => {
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

  it('full rebuild removes stale nodes and picks up new ones', () => {
    const before = mockGraph({ placements: [['r1', placement()]] });
    const scene = buildPcbScene(before, parts);
    const after = mockGraph({
      placements: [['r2', placement({ at: { x: 4 * MM, y: 0 } })]],
      vias: [['v1', { netId: 'n1', at: { x: 0, y: 0 }, drillNm: 300_000, padNm: 600_000, span: ['F.Cu', 'B.Cu'] }]],
    });
    rebuildPcbScene(scene, after, parts);
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

// ── Incremental delta sync ───────────────────────────────────────────

describe('syncPcbScene — incremental delta sync', () => {
  const TRACE: PcbTraceLike = {
    netId: 'n1',
    layerId: 'F.Cu',
    widthNm: 200_000,
    path: [
      { x: 0, y: 0 },
      { x: 5 * MM, y: 0 },
    ],
  };
  const VIA: PcbViaLike = {
    netId: 'n1',
    at: { x: 5 * MM, y: 0 },
    drillNm: 300_000,
    padNm: 600_000,
    span: ['F.Cu', 'B.Cu'],
  };

  function fullGraph(r2At = { x: 10 * MM, y: 0 }, r2Side: 'top' | 'bottom' = 'top') {
    return mockGraph({
      placements: [
        ['r1', placement()],
        ['r2', placement({ at: r2At, side: r2Side })],
      ],
      traces: [['t1', TRACE]],
      vias: [['v1', VIA]],
    });
  }

  it('a footprint move re-tessellates ONLY that node; others keep identity', () => {
    const a = fullGraph();
    const scene = buildPcbScene(a, parts);
    const r1Before = scene.get('r1')!;
    const r2Before = scene.get('r2')!;
    const traceBefore = scene.get('t1')!;
    const viaBefore = scene.get('v1')!;

    const b = fullGraph({ x: 14 * MM, y: 2 * MM });
    syncPcbScene(scene, diff(a, b), b, parts);

    expect(scene.get('r1')).toBe(r1Before); // untouched — same object
    expect(scene.get('t1')).toBe(traceBefore); // untouched — same object
    expect(scene.get('v1')).toBe(viaBefore); // untouched — same object
    expect(scene.get('r2')).not.toBe(r2Before); // rebuilt
    expect(scene.get('r2')!.bounds.minX).toBeGreaterThan(10 * MM);
  });

  it('a side flip re-tessellates the flipped footprint with the B.Cu color', () => {
    const a = fullGraph();
    const scene = buildPcbScene(a, parts);
    const r1Before = scene.get('r1')!;

    const b = fullGraph({ x: 10 * MM, y: 0 }, 'bottom');
    syncPcbScene(scene, diff(a, b), b, parts);

    expect(scene.get('r1')).toBe(r1Before);
    expect(scene.get('r2')!.color).toEqual(PCB_LAYER_COLORS['B.Cu']);
  });

  it('a newly placed footprint gains a node; existing nodes keep identity', () => {
    const a = mockGraph({ placements: [['r1', placement()]] });
    const scene = buildPcbScene(a, parts);
    const r1Before = scene.get('r1')!;

    const b = mockGraph({
      placements: [
        ['r1', placement()],
        ['r2', placement({ at: { x: 10 * MM, y: 0 } })],
      ],
    });
    syncPcbScene(scene, diff(a, b), b, parts);

    expect(scene.get('r1')).toBe(r1Before);
    expect(scene.get('r2')?.kind).toBe('footprint');
  });

  it('an unplaced footprint loses its node', () => {
    const a = fullGraph();
    const scene = buildPcbScene(a, parts);
    const b = mockGraph({ placements: [['r1', placement()]], traces: [['t1', TRACE]], vias: [['v1', VIA]] });
    syncPcbScene(scene, diff(a, b), b, parts);
    expect(scene.get('r2')).toBeUndefined();
    expect([...scene.nodes.keys()].sort()).toEqual(['r1', 't1', 'v1']);
  });

  it('a trace changed in place (removed + added, same id) rebuilds that node only', () => {
    const a = fullGraph();
    const scene = buildPcbScene(a, parts);
    const r1Before = scene.get('r1')!;
    const traceBefore = scene.get('t1')!;

    const rerouted: PcbTraceLike = { ...TRACE, path: [{ x: 0, y: 0 }, { x: 5 * MM, y: 2 * MM }] };
    const b = mockGraph({
      placements: [
        ['r1', placement()],
        ['r2', placement({ at: { x: 10 * MM, y: 0 } })],
      ],
      traces: [['t1', rerouted]],
      vias: [['v1', VIA]],
    });
    syncPcbScene(scene, diff(a, b), b, parts);

    expect(scene.get('r1')).toBe(r1Before);
    expect(scene.get('t1')).not.toBe(traceBefore);
    expect(scene.get('t1')!.bounds.maxY).toBeGreaterThan(2 * MM - 200_000);
  });

  it('trace and via removal drop their nodes; addition picks them up', () => {
    const a = mockGraph({ placements: [['r1', placement()]], traces: [['t1', TRACE]] });
    const scene = buildPcbScene(a, parts);
    const r1Before = scene.get('r1')!;

    const b = mockGraph({ placements: [['r1', placement()]], vias: [['v1', VIA]] });
    syncPcbScene(scene, diff(a, b), b, parts);

    expect(scene.get('r1')).toBe(r1Before);
    expect(scene.get('t1')).toBeUndefined();
    expect(scene.get('v1')?.kind).toBe('via');
  });

  it('a component prop change refreshes the placed footprint label', () => {
    const a = fullGraph();
    const scene = buildPcbScene(a, parts);
    const r2Before = scene.get('r2')!;

    const b = fullGraph();
    b.components.set('r1', component('r1', 'R99'));
    syncPcbScene(scene, diff(a, b), b, parts);

    expect(scene.get('r1')!.texts[0]?.text).toBe('R99');
    expect(scene.get('r2')).toBe(r2Before);
  });

  it('an empty delta touches nothing', () => {
    const a = fullGraph();
    const scene = buildPcbScene(a, parts);
    const nodesBefore = [...scene.nodes.values()];
    const versionBefore = scene.version;

    syncPcbScene(scene, diff(a, fullGraph()), fullGraph(), parts);

    expect([...scene.nodes.values()]).toEqual(nodesBefore);
    expect(scene.nodes.size).toBe(4);
    expect(scene.version).toBe(versionBefore);
  });
});
