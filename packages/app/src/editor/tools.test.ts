import {
  applyOp,
  emptyGraph,
  netOfPort,
  SCHEMATIC_GRID
  
  
} from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';


import {
  deleteSelectionOps,
  deriveWireOps,
  findPinAt,
  manhattanPath,
  nextFreeRef,
  PlaceTool,
  SelectTool,
  snapToGrid,
  WireTool
  
} from './tools.js';

import type {ToolEnv} from './tools.js';
import type {DesignGraph, OpBody} from '@protopulse/graph';
import type { PickHit } from '@protopulse/renderer';

const G = SCHEMATIC_GRID;
const parts = seedPartDb();

function buildGraph(ops: OpBody[]): DesignGraph {
  const g = emptyGraph();
  for (const op of ops) {
    const res = applyOp(g, op);
    if (!res.ok) throw new Error(res.error);
  }
  return g;
}

/** Two resistors 10 grid units apart; pins r1:2 at (2G,0), r2:1 at (8G,0). */
function twoResistors(extra: OpBody[] = []): DesignGraph {
  return buildGraph([
    { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
    { kind: 'add_component', id: 'r2', ref: 'R2', partId: 'core:resistor', partRev: 1 },
    { kind: 'place_symbol', componentId: 'r1', at: { x: 0, y: 0 }, rot: 0, mirror: false },
    { kind: 'place_symbol', componentId: 'r2', at: { x: 10 * G, y: 0 }, rot: 0, mirror: false },
    ...extra,
  ]);
}

function env(graph: DesignGraph, overrides: Partial<ToolEnv> = {}): ToolEnv {
  return {
    graph,
    parts,
    selection: new Set<string>(),
    pick: () => [],
    queryRect: () => [],
    ...overrides,
  };
}

function applyAll(graph: DesignGraph, ops: OpBody[]): DesignGraph {
  for (const op of ops) {
    const res = applyOp(graph, op);
    if (!res.ok) throw new Error(res.error);
  }
  return graph;
}

describe('snapToGrid', () => {
  it('rounds to the nearest 1.27mm grid point', () => {
    expect(snapToGrid({ x: G + 1, y: -G - 1 })).toEqual({ x: G, y: -G });
    expect(snapToGrid({ x: Math.round(G * 1.6), y: Math.round(G * 0.4) })).toEqual({
      x: 2 * G,
      y: 0,
    });
    expect(snapToGrid({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe('nextFreeRef', () => {
  it('starts at 1 on an empty graph', () => {
    expect(nextFreeRef(emptyGraph(), 'R')).toBe('R1');
  });

  it('uses max+1, ignoring other prefixes and non-numeric suffixes', () => {
    const graph = buildGraph([
      { kind: 'add_component', id: 'a', ref: 'R1', partId: 'core:resistor', partRev: 1 },
      { kind: 'add_component', id: 'b', ref: 'R7', partId: 'core:resistor', partRev: 1 },
      { kind: 'add_component', id: 'c', ref: 'C2', partId: 'core:capacitor', partRev: 1 },
      { kind: 'add_component', id: 'd', ref: 'RX', partId: 'core:resistor', partRev: 1 },
    ]);
    expect(nextFreeRef(graph, 'R')).toBe('R8');
    expect(nextFreeRef(graph, 'C')).toBe('C3');
    expect(nextFreeRef(graph, 'U')).toBe('U1');
  });
});

describe('manhattanPath', () => {
  it('returns [] for identical points', () => {
    expect(manhattanPath({ x: G, y: G }, { x: G, y: G })).toEqual([]);
  });

  it('returns one segment for collinear points', () => {
    expect(manhattanPath({ x: 0, y: 0 }, { x: 3 * G, y: 0 })).toEqual([
      { a: { x: 0, y: 0 }, b: { x: 3 * G, y: 0 } },
    ]);
  });

  it('returns an L with the corner at (end.x, start.y)', () => {
    expect(manhattanPath({ x: 0, y: 0 }, { x: 3 * G, y: 2 * G })).toEqual([
      { a: { x: 0, y: 0 }, b: { x: 3 * G, y: 0 } },
      { a: { x: 3 * G, y: 0 }, b: { x: 3 * G, y: 2 * G } },
    ]);
  });
});

describe('findPinAt', () => {
  it('finds the exact pin within tolerance', () => {
    const graph = twoResistors();
    const hit = findPinAt(graph, parts, { x: 2 * G + 1000, y: -2000 });
    expect(hit?.port).toBe('r1:2');
    expect(hit?.at).toEqual({ x: 2 * G, y: 0 });
  });

  it('returns null when nothing is near', () => {
    const graph = twoResistors();
    expect(findPinAt(graph, parts, { x: 5 * G, y: 5 * G })).toBeNull();
  });

  it('prefers the closest pin when several are in range', () => {
    const graph = twoResistors();
    // halfway-ish between r1:2 (2G) and r2:1 (8G), nearer to r2:1
    const hit = findPinAt(graph, parts, { x: 8 * G - 1000, y: 0 }, 7 * G);
    expect(hit?.port).toBe('r2:1');
  });
});

describe('deriveWireOps — the connect matrix', () => {
  const segs = manhattanPath({ x: 2 * G, y: 0 }, { x: 8 * G, y: 0 });

  it('case 1: neither pin on a net → new net + two connects + geometry', () => {
    const graph = twoResistors();
    const ops = deriveWireOps(graph, 'r1:2', 'r2:1', segs, () => 'net-new');
    expect(ops.map((o) => o.kind)).toEqual(['connect', 'connect', 'set_wire_geometry']);

    const after = applyAll(graph, ops);
    const net = netOfPort(after, 'r1:2');
    expect(net?.id).toBe('net-new');
    expect(net?.ports).toEqual(['r1:2', 'r2:1']);
    expect(after.schematic.wires.get('net-new')).toEqual(segs);
  });

  it('case 2: one pin on net N → connect the other into N, geometry appends', () => {
    const graph = twoResistors([
      { kind: 'connect', port: 'r1:2', newNetId: 'netA' },
      {
        kind: 'set_wire_geometry',
        netId: 'netA',
        segments: [{ a: { x: 2 * G, y: 0 }, b: { x: 2 * G, y: 2 * G } }],
      },
    ]);
    const ops = deriveWireOps(graph, 'r1:2', 'r2:1', segs, () => {
      throw new Error('must not allocate a net');
    });
    expect(ops.map((o) => o.kind)).toEqual(['connect', 'set_wire_geometry']);

    const after = applyAll(graph, ops);
    expect(netOfPort(after, 'r2:1')?.id).toBe('netA');
    // APPENDED, not replaced:
    expect(after.schematic.wires.get('netA')).toEqual([
      { a: { x: 2 * G, y: 0 }, b: { x: 2 * G, y: 2 * G } },
      ...segs,
    ]);
  });

  it('case 2 mirrored: only the SECOND pin is on a net', () => {
    const graph = twoResistors([{ kind: 'connect', port: 'r2:1', newNetId: 'netB' }]);
    const ops = deriveWireOps(graph, 'r1:2', 'r2:1', segs);
    const after = applyAll(graph, ops);
    expect(netOfPort(after, 'r1:2')?.id).toBe('netB');
    expect(after.schematic.wires.get('netB')).toEqual(segs);
  });

  it('case 3: pins on different nets → merge_nets, combined geometry', () => {
    const graph = twoResistors([
      { kind: 'connect', port: 'r1:2', newNetId: 'netA' },
      { kind: 'connect', port: 'r2:1', newNetId: 'netB' },
      {
        kind: 'set_wire_geometry',
        netId: 'netB',
        segments: [{ a: { x: 8 * G, y: 0 }, b: { x: 8 * G, y: 2 * G } }],
      },
    ]);
    const ops = deriveWireOps(graph, 'r1:2', 'r2:1', segs);
    expect(ops[0]).toEqual({ kind: 'merge_nets', survivor: 'netA', absorbed: 'netB' });

    const after = applyAll(graph, ops);
    expect(after.nets.has('netB')).toBe(false);
    expect(netOfPort(after, 'r2:1')?.id).toBe('netA');
    const wires = after.schematic.wires.get('netA')!;
    expect(wires).toContainEqual({ a: { x: 8 * G, y: 0 }, b: { x: 8 * G, y: 2 * G } });
    for (const seg of segs) expect(wires).toContainEqual(seg);
  });

  it('case 4: both pins already on the same net → geometry only', () => {
    const graph = twoResistors([
      { kind: 'connect', port: 'r1:2', newNetId: 'netA' },
      { kind: 'connect', port: 'r2:1', netId: 'netA' },
    ]);
    const ops = deriveWireOps(graph, 'r1:2', 'r2:1', segs);
    expect(ops.map((o) => o.kind)).toEqual(['set_wire_geometry']);
    const after = applyAll(graph, ops);
    expect(after.schematic.wires.get('netA')).toEqual(segs);
  });

  it('same pin twice → no ops', () => {
    expect(deriveWireOps(twoResistors(), 'r1:2', 'r1:2', segs)).toEqual([]);
  });
});

describe('deleteSelectionOps', () => {
  it('components → remove_component; nets → empty wire geometry', () => {
    const graph = twoResistors([
      { kind: 'connect', port: 'r1:2', newNetId: 'netA' },
      { kind: 'connect', port: 'r2:1', netId: 'netA' },
      { kind: 'set_wire_geometry', netId: 'netA', segments: [{ a: { x: 2 * G, y: 0 }, b: { x: 8 * G, y: 0 } }] },
    ]);
    const ops = deleteSelectionOps(graph, new Set(['r1', 'netA', 'unknown-id']));
    expect(ops).toEqual([
      { kind: 'remove_component', id: 'r1' },
      { kind: 'set_wire_geometry', netId: 'netA', segments: [] },
    ]);
  });
});

describe('PlaceTool', () => {
  it('click emits one add_component + place_symbol batch, snapped, with the next free ref', () => {
    const graph = twoResistors();
    const tool = new PlaceTool('core:resistor', () => 'r-new');
    const res = tool.pointerDown({ x: 5 * G + 1000, y: -3 * G + 999 }, env(graph));
    expect(res.ops).toEqual([
      { kind: 'add_component', id: 'r-new', ref: 'R3', partId: 'core:resistor', partRev: 1 },
      {
        kind: 'place_symbol',
        componentId: 'r-new',
        at: { x: 5 * G, y: -3 * G },
        rot: 0,
        mirror: false,
      },
    ]);
    expect(res.selection).toEqual(['r-new']);
  });

  it('ghost follows the cursor snapped to grid', () => {
    const tool = new PlaceTool('core:resistor');
    const res = tool.pointerMove({ x: 4 * G + 100, y: 100 }, env(emptyGraph()));
    expect(res.ghost).toBeInstanceOf(Float32Array);
    expect(res.ghost!.length).toBeGreaterThan(0);
  });

  it('unknown part does nothing', () => {
    const tool = new PlaceTool('core:bogus');
    expect(tool.pointerDown({ x: 0, y: 0 }, env(emptyGraph()))).toEqual({});
  });
});

describe('SelectTool', () => {
  const symbolHit: PickHit = {
    id: 'r1',
    kind: 'symbol',
    bounds: { minX: -2 * G, minY: -G, maxX: 2 * G, maxY: G },
    area: 4 * G * 2 * G,
  };

  it('click on a symbol selects it', () => {
    const graph = twoResistors();
    const res = new SelectTool().pointerDown(
      { x: 0, y: 0 },
      env(graph, { pick: () => [symbolHit] }),
    );
    expect(res.selection).toEqual(['r1']);
  });

  it('click on empty space clears selection and starts a marquee', () => {
    const graph = twoResistors();
    const tool = new SelectTool();
    expect(tool.pointerDown({ x: 50 * G, y: 50 * G }, env(graph)).selection).toEqual([]);
    const up = tool.pointerUp(
      { x: 60 * G, y: 60 * G },
      env(graph, { queryRect: () => ['r1', 'r2'] }),
    );
    expect(up.selection).toEqual(['r1', 'r2']);
    expect(up.ghost).toBeNull();
  });

  it('drag of a symbol dispatches ONE snapped move_symbol on pointerup', () => {
    const graph = twoResistors();
    const e = env(graph, { pick: () => [symbolHit] });
    const tool = new SelectTool();
    tool.pointerDown({ x: 0, y: 0 }, e);
    tool.pointerMove({ x: 2 * G, y: G }, e);
    const res = tool.pointerUp({ x: 3 * G + 700, y: 2 * G - 300 }, e);
    expect(res.ops).toEqual([
      {
        kind: 'move_symbol',
        componentId: 'r1',
        at: { x: 3 * G, y: 2 * G }, // snapped
        rot: 0,
        mirror: false,
      },
    ]);
  });

  it('click without movement emits no move op', () => {
    const graph = twoResistors();
    const e = env(graph, { pick: () => [symbolHit] });
    const tool = new SelectTool();
    tool.pointerDown({ x: 100, y: -100 }, e);
    const res = tool.pointerUp({ x: 120, y: -90 }, e);
    expect(res.ops).toBeUndefined();
  });

  it('cancel clears drag state and the ghost', () => {
    const graph = twoResistors();
    const e = env(graph, { pick: () => [symbolHit] });
    const tool = new SelectTool();
    tool.pointerDown({ x: 0, y: 0 }, e);
    expect(tool.cancel().ghost).toBeNull();
    expect(tool.pointerUp({ x: 5 * G, y: 0 }, e).ops).toBeUndefined();
  });
});

describe('WireTool', () => {
  it('two clicks on pins derive the connect ops', () => {
    const graph = twoResistors();
    const e = env(graph);
    const tool = new WireTool(() => 'net-x');

    expect(tool.pointerDown({ x: 2 * G, y: 0 }, e).ops).toBeUndefined();
    expect(tool.pendingFrom?.port).toBe('r1:2');

    const res = tool.pointerDown({ x: 8 * G, y: 0 }, e);
    expect(res.ops?.map((o) => o.kind)).toEqual(['connect', 'connect', 'set_wire_geometry']);
    expect(tool.pendingFrom).toBeNull();

    const after = applyAll(graph, res.ops!);
    expect(netOfPort(after, 'r1:2')?.ports).toEqual(['r1:2', 'r2:1']);
    expect(after.schematic.wires.get('net-x')).toEqual([
      { a: { x: 2 * G, y: 0 }, b: { x: 8 * G, y: 0 } },
    ]);
  });

  it('preview ghost is the Manhattan L-path from the start pin', () => {
    const graph = twoResistors();
    const e = env(graph);
    const tool = new WireTool();
    tool.pointerDown({ x: 2 * G, y: 0 }, e);
    const res = tool.pointerMove({ x: 5 * G + 100, y: 3 * G - 100 }, e);
    expect([...res.ghost!]).toEqual([
      2 * G, 0, 5 * G, 0, // horizontal first
      5 * G, 0, 5 * G, 3 * G, // then vertical (corner at end.x, start.y)
    ]);
  });

  it('click on empty space does not start a wire; Escape cancels a pending one', () => {
    const graph = twoResistors();
    const e = env(graph);
    const tool = new WireTool();
    expect(tool.pointerDown({ x: 5 * G, y: 5 * G }, e)).toEqual({});
    tool.pointerDown({ x: 2 * G, y: 0 }, e);
    expect(tool.pendingFrom).not.toBeNull();
    tool.cancel();
    expect(tool.pendingFrom).toBeNull();
  });
});
