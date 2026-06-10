import { applyOp, emptyGraph, MM } from '@protopulse/graph';
import { describe, expect, it } from 'vitest';

import {
  dedupePath,
  findPadAt,
  footprintOf,
  octilinearPath,
  PcbPlaceTool,
  pcbDeleteSelectionOps,
  pcbFlipSelectionOps,
  PcbSelectTool,
  PcbTraceTool,
  PcbViaTool,
  resolveTraceEndpoint,
  snapPcb
} from './tools.js';
import { asOpBodies, DEFAULT_TRACE_WIDTH_NM, DEFAULT_VIA_DRILL_NM, DEFAULT_VIA_PAD_NM, PCB_SNAP_NM } from './types.js';

import type { PadSource, PcbToolEnv } from './tools.js';
import type { DesignGraph, OpBody } from '@protopulse/graph';
import type {
  PcbFootprintSpec,
  PcbPlacementLike,
  PcbTraceLike,
  PcbViaLike,
  PickHit,
} from '@protopulse/renderer';

/**
 * PCB tool state machines. The graph's pcb view and Part.footprint land
 * on a parallel track — both are MOCKED here against the pinned v0.4
 * contracts. Components/nets use the real graph ops (those exist).
 */

const FOOTPRINT: PcbFootprintSpec = {
  pads: [
    { pinKey: '1', at: { x: -1 * MM, y: 0 }, wNm: 800_000, hNm: 800_000, shape: 'rect' },
    { pinKey: '2', at: { x: 1 * MM, y: 0 }, wNm: 800_000, hNm: 800_000, shape: 'rect' },
  ],
  courtyard: { wNm: 4 * MM, hNm: 2 * MM },
};

const padSource: PadSource = { get: () => ({ footprint: FOOTPRINT }) };
const bareSource: PadSource = { get: () => ({}) };

/** r1+r2 wired: net na = r1:2+r2:1, net nb = r1:1+r2:2. */
function wiredGraph(): DesignGraph {
  const g = emptyGraph();
  const ops: OpBody[] = [
    { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
    { kind: 'add_component', id: 'r2', ref: 'R2', partId: 'core:resistor', partRev: 1 },
    { kind: 'connect', port: 'r1:2', newNetId: 'na' },
    { kind: 'connect', port: 'r2:1', netId: 'na' },
    { kind: 'connect', port: 'r1:1', newNetId: 'nb' },
    { kind: 'connect', port: 'r2:2', netId: 'nb' },
  ];
  for (const op of ops) {
    const res = applyOp(g, op);
    if (!res.ok) throw new Error(res.error);
  }
  return g;
}

function placement(over: Partial<PcbPlacementLike> = {}): PcbPlacementLike {
  return { at: { x: 0, y: 0 }, rotMilli: 0, side: 'top', locked: false, ...over };
}

interface ViewOpts {
  placements?: [string, PcbPlacementLike][];
  traces?: [string, PcbTraceLike][];
  vias?: [string, PcbViaLike][];
}

function view(opts: ViewOpts = {}) {
  return {
    placements: new Map(opts.placements ?? []),
    traces: new Map(opts.traces ?? []),
    vias: new Map(opts.vias ?? []),
  };
}

function hit(id: string, kind: PickHit['kind']): PickHit {
  return { id, kind, bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, area: 0 };
}

function env(graph: DesignGraph, overrides: Partial<PcbToolEnv> = {}): PcbToolEnv {
  return {
    graph,
    view: view({
      placements: [
        ['r1', placement()],
        ['r2', placement({ at: { x: 10 * MM, y: 0 } })],
      ],
    }),
    parts: padSource,
    pick: () => [],
    activeLayer: 'F.Cu',
    traceWidthNm: DEFAULT_TRACE_WIDTH_NM,
    traceMode: 'manual',
    clearanceNm: 127_000,
    ...overrides,
  };
}

const makeId = () => 'fixed-id';

// ── Geometry helpers ─────────────────────────────────────────────────

describe('snapPcb', () => {
  it('snaps to the 0.25mm pcb grid', () => {
    expect(snapPcb({ x: 260_000, y: -130_000 })).toEqual({ x: 250_000, y: -250_000 });
    expect(snapPcb({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(PCB_SNAP_NM).toBe(250_000);
  });
});

describe('octilinearPath', () => {
  it('axis-aligned and exact-45° pairs are a single segment', () => {
    expect(octilinearPath({ x: 0, y: 0 }, { x: 5, y: 0 })).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ]);
    expect(octilinearPath({ x: 0, y: 0 }, { x: 4, y: -4 })).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: -4 },
    ]);
  });

  it('doglegs take the 45° diagonal first, then the straight', () => {
    expect(octilinearPath({ x: 0, y: 0 }, { x: 10, y: 4 })).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      { x: 10, y: 4 },
    ]);
    expect(octilinearPath({ x: 0, y: 0 }, { x: -3, y: 8 })).toEqual([
      { x: 0, y: 0 },
      { x: -3, y: 3 },
      { x: -3, y: 8 },
    ]);
  });

  it('coincident points collapse', () => {
    expect(octilinearPath({ x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([{ x: 1, y: 1 }]);
    expect(dedupePath([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }])).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
  });
});

describe('findPadAt', () => {
  const graph = wiredGraph();

  it('hits the nearest pad and resolves its net', () => {
    const e = env(graph);
    const pad = findPadAt(graph, e.view, padSource, { x: 1 * MM + 100_000, y: 50_000 });
    expect(pad).toMatchObject({ componentId: 'r1', pinKey: '2', netId: 'na' });
    expect(pad?.at).toEqual({ x: 1 * MM, y: 0 });
  });

  it('respects placement rotation', () => {
    const e = env(graph, {
      view: view({ placements: [['r1', placement({ rotMilli: 90_000 })]] }),
    });
    // pad 2 local (1mm,0) → rot90 → (0,1mm)
    const pad = findPadAt(graph, e.view, padSource, { x: 0, y: 1 * MM });
    expect(pad).toMatchObject({ componentId: 'r1', pinKey: '2' });
  });

  it('misses when out of reach and on footprint-less parts', () => {
    const e = env(graph);
    expect(findPadAt(graph, e.view, padSource, { x: 5 * MM, y: 5 * MM })).toBeNull();
    expect(findPadAt(graph, e.view, bareSource, { x: 1 * MM, y: 0 })).toBeNull();
    expect(footprintOf(graph, bareSource, 'r1')).toBeNull();
  });
});

// ── Place tool ───────────────────────────────────────────────────────

describe('PcbPlaceTool', () => {
  const graph = wiredGraph();

  it('emits a snapped place_footprint on click and resets to select', () => {
    const tool = new PcbPlaceTool('r1');
    const res = tool.pointerDown({ x: 2 * MM + 60_000, y: -60_000 }, env(graph));
    expect(res.ops).toEqual([
      {
        kind: 'place_footprint',
        componentId: 'r1',
        at: { x: 2 * MM, y: 0 },
        rotMilli: 0,
        side: 'top',
        locked: false,
      },
    ]);
    expect(res.selection).toEqual(['r1']);
    expect(res.resetTool).toBe(true);
  });

  it('R rotates the ghost in 90° steps and the placement uses it', () => {
    const tool = new PcbPlaceTool('r1');
    const e = env(graph);
    expect(tool.pointerMove({ x: 0, y: 0 }, e).ghost).toBeInstanceOf(Float32Array);
    tool.rotate(e);
    expect(tool.rotation).toBe(90_000);
    tool.rotate(e);
    tool.rotate(e);
    tool.rotate(e);
    expect(tool.rotation).toBe(0);
    tool.rotate(e);
    const res = tool.pointerDown({ x: 0, y: 0 }, e);
    expect(res.ops?.[0]).toMatchObject({ kind: 'place_footprint', rotMilli: 90_000 });
  });

  it('flags footprint-less parts instead of placing', () => {
    const tool = new PcbPlaceTool('r1');
    const res = tool.pointerDown({ x: 0, y: 0 }, env(graph, { parts: bareSource }));
    expect(res.ops).toBeUndefined();
    expect(res.status).toMatch(/no footprint/);
    expect(res.resetTool).toBe(true);
  });
});

// ── Select tool ──────────────────────────────────────────────────────

describe('PcbSelectTool', () => {
  const graph = wiredGraph();

  it('click selects; empty click clears', () => {
    const tool = new PcbSelectTool();
    const e = env(graph, { pick: () => [hit('r1', 'footprint')] });
    expect(tool.pointerDown({ x: 0, y: 0 }, e).selection).toEqual(['r1']);
    expect(tool.pointerDown({ x: 0, y: 0 }, env(graph)).selection).toEqual([]);
    tool.cancel();
  });

  it('drag moves a footprint to the snapped target', () => {
    const tool = new PcbSelectTool();
    const e = env(graph, { pick: () => [hit('r1', 'footprint')] });
    tool.pointerDown({ x: 0, y: 0 }, e);
    const moveRes = tool.pointerMove({ x: 2 * MM + 10_000, y: 1 * MM }, e);
    expect(moveRes.ghost).toBeInstanceOf(Float32Array);
    const res = tool.pointerUp({ x: 2 * MM + 10_000, y: 1 * MM }, e);
    expect(res.ops).toEqual([
      {
        kind: 'move_footprint',
        componentId: 'r1',
        at: { x: 2 * MM, y: 1 * MM },
        rotMilli: 0,
        side: 'top',
        locked: false,
      },
    ]);
  });

  it('a no-move drag emits nothing', () => {
    const tool = new PcbSelectTool();
    const e = env(graph, { pick: () => [hit('r1', 'footprint')] });
    tool.pointerDown({ x: 0, y: 0 }, e);
    const res = tool.pointerUp({ x: 40_000, y: -40_000 }, e); // snaps back to origin
    expect(res.ops).toBeUndefined();
  });

  it('locked footprints select but refuse to drag', () => {
    const tool = new PcbSelectTool();
    const e = env(graph, {
      pick: () => [hit('r1', 'footprint')],
      view: view({ placements: [['r1', placement({ locked: true })]] }),
    });
    const res = tool.pointerDown({ x: 0, y: 0 }, e);
    expect(res.selection).toEqual(['r1']);
    expect(res.status).toMatch(/locked/);
    expect(tool.pointerUp({ x: 5 * MM, y: 0 }, e).ops).toBeUndefined();
  });
});

// ── Trace tool ───────────────────────────────────────────────────────

const TRACE_NA: PcbTraceLike = {
  netId: 'na',
  layerId: 'F.Cu',
  widthNm: 200_000,
  path: [
    { x: 1 * MM, y: 0 },
    { x: 5 * MM, y: 0 },
  ],
};

describe('PcbTraceTool', () => {
  const graph = wiredGraph();

  it('routes pad → pad on the same net (id, layer, width from env)', () => {
    const tool = new PcbTraceTool(makeId);
    const e = env(graph);
    // start on r1 pad 2 (net na, at 1mm,0)
    tool.pointerDown({ x: 1 * MM, y: 0 }, e);
    expect(tool.routing).toBe(true);
    // commit on r2 pad 1 (net na, at 9mm,0)
    const res = tool.pointerDown({ x: 9 * MM, y: 0 }, e);
    expect(res.ops).toEqual([
      {
        kind: 'route_trace',
        id: 'fixed-id',
        netId: 'na',
        layerId: 'F.Cu',
        widthNm: DEFAULT_TRACE_WIDTH_NM,
        path: [
          { x: 1 * MM, y: 0 },
          { x: 9 * MM, y: 0 },
        ],
      },
    ]);
    expect(tool.routing).toBe(false);
  });

  it('routes on the active layer from the env', () => {
    const tool = new PcbTraceTool(makeId);
    const e = env(graph, { activeLayer: 'B.Cu' });
    tool.pointerDown({ x: 1 * MM, y: 0 }, e);
    const res = tool.pointerDown({ x: 9 * MM, y: 0 }, e);
    expect(res.ops?.[0]).toMatchObject({ kind: 'route_trace', layerId: 'B.Cu' });
  });

  it('REFUSES cross-net commits with a status flash and keeps routing', () => {
    const tool = new PcbTraceTool(makeId);
    const e = env(graph);
    tool.pointerDown({ x: 1 * MM, y: 0 }, e); // net na
    const res = tool.pointerDown({ x: 11 * MM, y: 0 }, e); // r2 pad 2 → net nb
    expect(res.ops).toBeUndefined();
    expect(res.status).toMatch(/Refused/);
    expect(tool.routing).toBe(true);
  });

  it('refuses to start on empty board or an unwired pad', () => {
    const tool = new PcbTraceTool(makeId);
    const e = env(graph);
    expect(tool.pointerDown({ x: 50 * MM, y: 50 * MM }, e).status).toMatch(/start on a pad/);
    // r3 has a placed footprint but no nets
    const g2 = wiredGraph();
    const r3 = applyOp(g2, { kind: 'add_component', id: 'r3', ref: 'R3', partId: 'core:resistor', partRev: 1 });
    expect(r3.ok).toBe(true);
    const e2 = env(g2, { view: view({ placements: [['r3', placement()]] }) });
    expect(tool.pointerDown({ x: 1 * MM, y: 0 }, e2).status).toMatch(/no net/);
    expect(tool.routing).toBe(false);
  });

  it('commits onto a same-net trace segment at the snapped point', () => {
    const tool = new PcbTraceTool(makeId);
    const e = env(graph, {
      view: view({
        placements: [
          ['r1', placement()],
          ['r2', placement({ at: { x: 10 * MM, y: 0 } })],
        ],
        traces: [['t1', TRACE_NA]],
      }),
      // pads win when close; this click is far from any pad
      pick: (pt) => (pt.x === 4 * MM ? [hit('t1', 'trace')] : []),
    });
    tool.pointerDown({ x: 9 * MM, y: 0 }, e); // start r2 pad 1, net na
    const res = tool.pointerDown({ x: 4 * MM, y: 0 }, e);
    expect(res.ops?.[0]).toMatchObject({
      kind: 'route_trace',
      netId: 'na',
      path: [
        { x: 9 * MM, y: 0 },
        { x: 4 * MM, y: 0 },
      ],
    });
  });

  it('clicks on empty board drop octilinear waypoints into the path', () => {
    const tool = new PcbTraceTool(makeId);
    const e = env(graph);
    tool.pointerDown({ x: 1 * MM, y: 0 }, e); // start, net na
    tool.pointerDown({ x: 3 * MM, y: 2 * MM }, e); // waypoint (dogleg)
    const res = tool.pointerDown({ x: 9 * MM, y: 0 }, e); // commit on r2 pad 1
    const op = res.ops?.[0];
    expect(op?.kind).toBe('route_trace');
    if (op?.kind !== 'route_trace') throw new Error('expected route_trace');
    expect(op.path[0]).toEqual({ x: 1 * MM, y: 0 });
    expect(op.path[op.path.length - 1]).toEqual({ x: 9 * MM, y: 0 });
    expect(op.path.length).toBeGreaterThan(2);
  });

  it('preview ghost follows octilinear routing; Escape cancels', () => {
    const tool = new PcbTraceTool(makeId);
    const e = env(graph);
    expect(tool.pointerMove({ x: 0, y: 0 }, e)).toEqual({});
    tool.pointerDown({ x: 1 * MM, y: 0 }, e);
    const ghost = tool.pointerMove({ x: 4 * MM, y: 1 * MM }, e).ghost;
    expect(ghost).toBeInstanceOf(Float32Array);
    expect(ghost && ghost.length >= 8).toBe(true); // ≥2 segments (dogleg)
    tool.cancel();
    expect(tool.routing).toBe(false);
  });

  it('resolveTraceEndpoint prefers pads over traces', () => {
    const e = env(graph, {
      view: view({ placements: [['r1', placement()]], traces: [['t1', TRACE_NA]] }),
      pick: () => [hit('t1', 'trace')],
    });
    const onPad = resolveTraceEndpoint({ x: 1 * MM, y: 0 }, e);
    expect(onPad?.kind).toBe('pad');
    const onTrace = resolveTraceEndpoint({ x: 4 * MM, y: 0 }, e);
    expect(onTrace).toMatchObject({ kind: 'trace', netId: 'na', traceId: 't1' });
  });
});

// ── Via tool ─────────────────────────────────────────────────────────

describe('PcbViaTool', () => {
  const graph = wiredGraph();

  it('drops a full-stack via on a trace, inheriting its net', () => {
    const tool = new PcbViaTool(makeId);
    const e = env(graph, {
      view: view({ traces: [['t1', TRACE_NA]] }),
      pick: () => [hit('t1', 'trace')],
    });
    const res = tool.pointerDown({ x: 3 * MM + 30_000, y: 0 }, e);
    expect(res.ops).toEqual([
      {
        kind: 'place_via',
        id: 'fixed-id',
        netId: 'na',
        at: { x: 3 * MM, y: 0 },
        drillNm: DEFAULT_VIA_DRILL_NM,
        padNm: DEFAULT_VIA_PAD_NM,
        span: ['F.Cu', 'B.Cu'],
      },
    ]);
  });

  it('refuses off-trace clicks with guidance', () => {
    const tool = new PcbViaTool(makeId);
    const res = tool.pointerDown({ x: 0, y: 0 }, env(graph));
    expect(res.ops).toBeUndefined();
    expect(res.status).toMatch(/trace/);
  });
});

// ── Delete ───────────────────────────────────────────────────────────

describe('pcbDeleteSelectionOps', () => {
  it('unplaces footprints, removes traces and vias, skips locked', () => {
    const v = view({
      placements: [
        ['r1', placement()],
        ['r2', placement({ locked: true })],
      ],
      traces: [['t1', TRACE_NA]],
      vias: [['v1', { netId: 'na', at: { x: 0, y: 0 }, drillNm: 300_000, padNm: 600_000, span: ['F.Cu', 'B.Cu'] }]],
    });
    const ops = pcbDeleteSelectionOps(v, new Set(['r1', 'r2', 't1', 'v1', 'ghost']));
    expect(ops).toEqual([
      { kind: 'unplace_footprint', componentId: 'r1' },
      { kind: 'remove_trace', id: 't1' },
      { kind: 'remove_via', id: 'v1' },
    ]);
  });
});

describe('pcbFlipSelectionOps', () => {
  it('flips a top-side footprint to the bottom, keeping position and rotation', () => {
    const graph = wiredGraph();
    const v = view({ placements: [['r1', placement({ at: { x: 2 * MM, y: -1 * MM }, rotMilli: 90_000 })]] });
    const res = pcbFlipSelectionOps(graph, v, new Set(['r1']));
    expect(res.ops).toEqual([
      {
        kind: 'move_footprint',
        componentId: 'r1',
        at: { x: 2 * MM, y: -1 * MM },
        rotMilli: 90_000,
        side: 'bottom',
        locked: false,
      },
    ]);
    expect(res.status).toBe('Flipped R1 to the bottom (B.Cu).');
  });

  it('flips a bottom-side footprint back to the top', () => {
    const graph = wiredGraph();
    const v = view({ placements: [['r1', placement({ side: 'bottom' })]] });
    const res = pcbFlipSelectionOps(graph, v, new Set(['r1']));
    expect(res.ops[0]).toMatchObject({ kind: 'move_footprint', side: 'top' });
    expect(res.status).toBe('Flipped R1 to the top (F.Cu).');
  });

  it('skips locked placements and says so when nothing else flipped', () => {
    const graph = wiredGraph();
    const v = view({ placements: [['r1', placement({ locked: true })]] });
    const res = pcbFlipSelectionOps(graph, v, new Set(['r1']));
    expect(res.ops).toEqual([]);
    expect(res.status).toBe('That footprint is locked — unlock it to flip it.');
  });

  it('ignores traces, vias, and unplaced ids — empty selection is silent', () => {
    const graph = wiredGraph();
    const v = view({
      placements: [['r1', placement()]],
      traces: [['t1', TRACE_NA]],
    });
    const res = pcbFlipSelectionOps(graph, v, new Set(['t1', 'ghost']));
    expect(res.ops).toEqual([]);
    expect(res.status).toBeNull();
  });

  it('flips every unlocked footprint in a multi-selection (deterministic order)', () => {
    const graph = wiredGraph();
    const v = view({
      placements: [
        ['r2', placement({ at: { x: 10 * MM, y: 0 } })],
        ['r1', placement()],
      ],
    });
    const res = pcbFlipSelectionOps(graph, v, new Set(['r2', 'r1']));
    expect(res.ops.map((op) => (op.kind === 'move_footprint' ? op.componentId : ''))).toEqual([
      'r1',
      'r2',
    ]);
    expect(res.ops.every((op) => op.kind === 'move_footprint' && op.side === 'bottom')).toBe(true);
    expect(res.status).toBe('Flipped 2 footprints.');
  });

  it('flip ops round-trip through the real graph apply (side lands)', () => {
    const graph = wiredGraph();
    const place: OpBody = {
      kind: 'place_footprint',
      componentId: 'r1',
      at: { x: 0, y: 0 },
      rotMilli: 0,
      side: 'top',
      locked: false,
    };
    expect(applyOp(graph, place).ok).toBe(true);
    const v = view({ placements: [['r1', placement()]] });
    const res = pcbFlipSelectionOps(graph, v, new Set(['r1']));
    for (const op of asOpBodies(res.ops)) {
      expect(applyOp(graph, op).ok).toBe(true);
    }
    expect(graph.pcb.placements.get('r1')?.side).toBe('bottom');
  });
});

describe('PcbTraceTool — walk and shove modes', () => {
  /** wiredGraph + placements + a vertical nb trace crossing the na
   *  corridor at x=5mm. Built with real ops so graph.pcb is populated
   *  (planShove reads the graph, not the mocked view). */
  function boardWithCrossing(): DesignGraph {
    const g = emptyGraph();
    const ops: OpBody[] = [
      { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
      { kind: 'add_component', id: 'r2', ref: 'R2', partId: 'core:resistor', partRev: 1 },
      { kind: 'connect', port: 'r1:2', newNetId: 'na' },
      { kind: 'connect', port: 'r2:1', netId: 'na' },
      { kind: 'connect', port: 'r1:1', newNetId: 'nb' },
      { kind: 'connect', port: 'r2:2', netId: 'nb' },
      { kind: 'place_footprint', componentId: 'r1', at: { x: 0, y: 0 }, rotMilli: 0, side: 'top', locked: false },
      { kind: 'place_footprint', componentId: 'r2', at: { x: 10 * MM, y: 0 }, rotMilli: 0, side: 'top', locked: false },
      {
        kind: 'route_trace',
        id: 'crossing',
        netId: 'nb',
        layerId: 'F.Cu',
        widthNm: 250_000,
        path: [
          { x: 5 * MM, y: -3 * MM },
          { x: 5 * MM, y: 3 * MM },
        ],
      },
    ];
    for (const op of ops) {
      const res = applyOp(g, op);
      if (!res.ok) throw new Error(res.error);
    }
    return g;
  }

  function crossingEnv(graph: DesignGraph, overrides: Partial<PcbToolEnv> = {}): PcbToolEnv {
    return env(graph, {
      view: view({
        placements: [
          ['r1', placement()],
          ['r2', placement({ at: { x: 10 * MM, y: 0 } })],
        ],
        traces: [
          [
            'crossing',
            {
              netId: 'nb',
              layerId: 'F.Cu',
              widthNm: 250_000,
              path: [
                { x: 5 * MM, y: -3 * MM },
                { x: 5 * MM, y: 3 * MM },
              ],
            },
          ],
        ],
      }),
      ...overrides,
    });
  }

  it('walk mode detours around the crossing trace', () => {
    const tool = new PcbTraceTool(makeId);
    const e = crossingEnv(boardWithCrossing(), { traceMode: 'walk' });
    tool.pointerDown({ x: 1 * MM, y: 0 }, e);
    const res = tool.pointerDown({ x: 9 * MM, y: 0 }, e);
    const op = res.ops?.[0];
    expect(op).toMatchObject({ kind: 'route_trace', netId: 'na' });
    if (op?.kind !== 'route_trace') throw new Error('expected a route');
    expect(op.path.length).toBeGreaterThan(2); // it walked, not straight
    expect(res.opsLabel).toBe('route trace');
  });

  it('walk mode refuses while the deck is still loading', () => {
    const tool = new PcbTraceTool(makeId);
    const e = crossingEnv(boardWithCrossing(), { traceMode: 'walk', clearanceNm: null });
    tool.pointerDown({ x: 1 * MM, y: 0 }, e);
    const res = tool.pointerDown({ x: 9 * MM, y: 0 }, e);
    expect(res.ops).toBeUndefined();
    expect(res.status).toContain('still loading');
    expect(tool.routing).toBe(true); // state kept — try again after load
  });

  it('shove mode routes straight and pushes the crossing trace aside', () => {
    const tool = new PcbTraceTool(makeId);
    const e = crossingEnv(boardWithCrossing(), { traceMode: 'shove' });
    tool.pointerDown({ x: 1 * MM, y: 0 }, e);
    const res = tool.pointerDown({ x: 9 * MM, y: 0 }, e);
    expect(res.opsLabel).toBe('shove');
    expect(res.ops?.map((o) => o.kind)).toEqual(['route_trace', 'remove_trace', 'route_trace']);
    const [newTrace, , victim] = res.ops ?? [];
    expect(newTrace).toMatchObject({
      kind: 'route_trace',
      netId: 'na',
      path: [
        { x: 1 * MM, y: 0 },
        { x: 9 * MM, y: 0 },
      ],
    });
    if (victim?.kind !== 'route_trace') throw new Error('expected the victim reroute');
    expect(victim.id).toBe('crossing');
    expect(victim.netId).toBe('nb');
    expect(victim.widthNm).toBe(250_000);
    expect(victim.path[0]).toEqual({ x: 5 * MM, y: -3 * MM });
    expect(victim.path.at(-1)).toEqual({ x: 5 * MM, y: 3 * MM });
    expect(victim.path.length).toBeGreaterThan(2); // it moved
  });

  it('shove mode refuses when the victim has nowhere to go, keeping the route alive', () => {
    // Shrink the crossing trace so its endpoints sit inside the new
    // trace's clearance hull — unshovable.
    const g = emptyGraph();
    const ops: OpBody[] = [
      { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
      { kind: 'add_component', id: 'r2', ref: 'R2', partId: 'core:resistor', partRev: 1 },
      { kind: 'connect', port: 'r1:2', newNetId: 'na' },
      { kind: 'connect', port: 'r2:1', netId: 'na' },
      { kind: 'connect', port: 'r1:1', newNetId: 'nb' },
      { kind: 'place_footprint', componentId: 'r1', at: { x: 0, y: 0 }, rotMilli: 0, side: 'top', locked: false },
      { kind: 'place_footprint', componentId: 'r2', at: { x: 10 * MM, y: 0 }, rotMilli: 0, side: 'top', locked: false },
      {
        kind: 'route_trace',
        id: 'stuck',
        netId: 'nb',
        layerId: 'F.Cu',
        widthNm: 250_000,
        path: [
          { x: 5 * MM, y: -200_000 },
          { x: 5 * MM, y: 200_000 },
        ],
      },
    ];
    for (const op of ops) {
      const res = applyOp(g, op);
      if (!res.ok) throw new Error(res.error);
    }
    const tool = new PcbTraceTool(makeId);
    const e = crossingEnv(g, { traceMode: 'shove' });
    tool.pointerDown({ x: 1 * MM, y: 0 }, e);
    const res = tool.pointerDown({ x: 9 * MM, y: 0 }, e);
    expect(res.ops).toBeUndefined();
    expect(res.status).toContain('Shove refused');
    expect(tool.routing).toBe(true); // user adjusts and retries
  });
});
