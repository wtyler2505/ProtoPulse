import { describe, it, expect } from 'vitest';

import type { Footprint } from '@/lib/pcb/footprint-library';

import type { CircuitInstanceRow, CircuitNetRow, CircuitViaRow, CircuitWireRow } from '@shared/schema';

import { buildSceneModel  } from '../buildSceneModel';

import type {BuildSceneBoard} from '../buildSceneModel';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeBoard(over: Partial<BuildSceneBoard> = {}): BuildSceneBoard {
  return {
    widthMm: 100,
    heightMm: 80,
    thicknessMm: 1.6,
    cornerRadiusMm: 2,
    layers: 2,
    finish: 'HASL',
    solderMaskColor: 'green',
    silkscreenColor: 'white',
    ...over,
  };
}

function makeInstance(over: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 1,
    circuitId: 1,
    partId: null,
    subDesignId: null,
    referenceDesignator: 'U1',
    schematicX: 0,
    schematicY: 0,
    schematicRotation: 0,
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: 0,
    benchX: null,
    benchY: null,
    pcbX: 50,
    pcbY: 40,
    pcbRotation: 0,
    pcbSide: 'front',
    properties: {},
    createdAt: new Date(0),
    ...over,
  } as CircuitInstanceRow;
}

function makeWire(over: Partial<CircuitWireRow> = {}): CircuitWireRow {
  return {
    id: 1,
    circuitId: 1,
    netId: 1,
    view: 'pcb',
    points: [
      { x: 10, y: 10 },
      { x: 40, y: 10 },
    ],
    layer: 'front',
    width: 0.25,
    color: null,
    wireType: 'wire',
    endpointMeta: null,
    provenance: 'manual',
    createdAt: new Date(0),
    ...over,
  } as CircuitWireRow;
}

function makeVia(over: Partial<CircuitViaRow> = {}): CircuitViaRow {
  return {
    id: 1,
    circuitId: 1,
    netId: 1,
    x: 20,
    y: 30,
    outerDiameter: 0.8,
    drillDiameter: 0.4,
    viaType: 'through',
    layerStart: 'front',
    layerEnd: 'back',
    tented: true,
    createdAt: new Date(0),
    ...over,
  } as CircuitViaRow;
}

/** Deterministic footprint resolver so pad/body assertions are stable. */
const stubFootprint: Footprint = {
  packageType: 'SOIC-8',
  description: 'stub',
  pads: [
    { number: 1, type: 'smd', shape: 'rect', position: { x: -2, y: -1 }, width: 0.6, height: 1.5, layer: 'front' },
    { number: 2, type: 'smd', shape: 'rect', position: { x: 2, y: 1 }, width: 0.6, height: 1.5, layer: 'front' },
  ],
  courtyard: { x: 0, y: 0, width: 6, height: 5 },
  boundingBox: { x: 0, y: 0, width: 4.9, height: 3.9 },
  silkscreen: [],
  mountingType: 'smd',
  pinCount: 8,
};

const resolveFootprint = () => stubFootprint;

const EMPTY = { instances: [], wires: [], vias: [] };

// ---------------------------------------------------------------------------
// Empty → valid shell
// ---------------------------------------------------------------------------

describe('buildSceneModel — empty project yields a valid shell', () => {
  it('produces a board + stack with no geometry and isEmpty=true', () => {
    const model = buildSceneModel({ board: makeBoard(), ...EMPTY });
    expect(model.isEmpty).toBe(true);
    expect(model.components).toHaveLength(0);
    expect(model.traces).toHaveLength(0);
    expect(model.vias).toHaveLength(0);
    // Shell is still present.
    expect(model.board.widthMm).toBe(100);
    expect(model.stack.layers.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// N instances → N entries
// ---------------------------------------------------------------------------

describe('buildSceneModel — component instances', () => {
  it('maps N placed instances to N component entries with stable ids', () => {
    const instances = [
      makeInstance({ id: 11, referenceDesignator: 'U1', pcbX: 10, pcbY: 10 }),
      makeInstance({ id: 12, referenceDesignator: 'R1', pcbX: 20, pcbY: 20 }),
      makeInstance({ id: 13, referenceDesignator: 'C1', pcbX: 30, pcbY: 30 }),
    ];
    const model = buildSceneModel({ board: makeBoard(), instances, wires: [], vias: [], resolveFootprint });
    expect(model.components).toHaveLength(3);
    expect(model.components.map((c) => c.id)).toEqual([
      'circuit-instance-11',
      'circuit-instance-12',
      'circuit-instance-13',
    ]);
    expect(model.isEmpty).toBe(false);
  });

  it('ids are deterministic across repeated builds (no random uuids)', () => {
    const instances = [makeInstance({ id: 7 })];
    const a = buildSceneModel({ board: makeBoard(), instances, wires: [], vias: [], resolveFootprint });
    const b = buildSceneModel({ board: makeBoard(), instances, wires: [], vias: [], resolveFootprint });
    expect(a.components[0].id).toBe(b.components[0].id);
    expect(a.pads.map((p) => p.id)).toEqual(b.pads.map((p) => p.id));
  });

  it('skips instances without a PCB position', () => {
    const instances = [
      makeInstance({ id: 1, pcbX: null, pcbY: null }),
      makeInstance({ id: 2, pcbX: 5, pcbY: 5 }),
    ];
    const model = buildSceneModel({ board: makeBoard(), instances, wires: [], vias: [], resolveFootprint });
    expect(model.components).toHaveLength(1);
    expect(model.components[0].id).toBe('circuit-instance-2');
  });

  it('recentres pcb coordinates to board-centred scene space', () => {
    // Board 100×80 → centre at (50,40). An instance at pcb (50,40) is the origin.
    const instances = [makeInstance({ id: 1, pcbX: 50, pcbY: 40 })];
    const model = buildSceneModel({ board: makeBoard(), instances, wires: [], vias: [], resolveFootprint });
    expect(model.components[0].x).toBeCloseTo(0, 6);
    expect(model.components[0].z).toBeCloseTo(0, 6);
  });

  it('maps pcbSide back → bottom and front → top', () => {
    const instances = [
      makeInstance({ id: 1, pcbSide: 'back', pcbX: 1, pcbY: 1 }),
      makeInstance({ id: 2, pcbSide: 'front', pcbX: 2, pcbY: 2 }),
    ];
    const model = buildSceneModel({ board: makeBoard(), instances, wires: [], vias: [], resolveFootprint });
    expect(model.components.find((c) => c.id === 'circuit-instance-1')?.side).toBe('bottom');
    expect(model.components.find((c) => c.id === 'circuit-instance-2')?.side).toBe('top');
  });

  it('sizes the body from footprint bbox and package height', () => {
    const instances = [makeInstance({ id: 1, properties: { packageType: 'SOIC-8' } })];
    const model = buildSceneModel({ board: makeBoard(), instances, wires: [], vias: [], resolveFootprint });
    const c = model.components[0];
    expect(c.bodyW).toBeCloseTo(4.9, 6); // stub bbox width
    expect(c.bodyD).toBeCloseTo(3.9, 6); // stub bbox height
    expect(c.bodyH).toBeCloseTo(1.75, 6); // SOIC-8 height
  });

  it('falls back to default body extents when no footprint resolves', () => {
    const instances = [makeInstance({ id: 1 })];
    const model = buildSceneModel({ board: makeBoard(), instances, wires: [], vias: [], resolveFootprint: () => null });
    expect(model.components[0].bodyW).toBe(5.0);
    expect(model.components[0].bodyD).toBe(5.0);
  });
});

// ---------------------------------------------------------------------------
// Pads
// ---------------------------------------------------------------------------

describe('buildSceneModel — pads', () => {
  it('emits a pad per footprint pad, offset from the component centre', () => {
    const instances = [makeInstance({ id: 5, pcbX: 50, pcbY: 40 })]; // centre → origin
    const model = buildSceneModel({ board: makeBoard(), instances, wires: [], vias: [], resolveFootprint });
    expect(model.pads).toHaveLength(2);
    expect(model.pads[0].id).toBe('circuit-instance-5-pad-1');
    // pad 1 is at local (-2,-1); component at origin → scene (-2,-1).
    expect(model.pads[0].x).toBeCloseTo(-2, 6);
    expect(model.pads[0].z).toBeCloseTo(-1, 6);
    expect(model.pads[0].componentId).toBe('circuit-instance-5');
  });

  it('marks tht pads as through and smd pads as not through', () => {
    const thtFp: Footprint = {
      ...stubFootprint,
      pads: [{ number: 1, type: 'tht', shape: 'circle', position: { x: 0, y: 0 }, width: 1.5, height: 1.5, drill: 0.8, layer: 'both' }],
    };
    const instances = [makeInstance({ id: 1 })];
    const model = buildSceneModel({ board: makeBoard(), instances, wires: [], vias: [], resolveFootprint: () => thtFp });
    expect(model.pads[0].through).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Traces
// ---------------------------------------------------------------------------

describe('buildSceneModel — traces', () => {
  it('maps pcb-view wires to ribbon traces with width + recentred points', () => {
    const wires = [makeWire({ id: 3, width: 0.3, points: [{ x: 50, y: 40 }, { x: 60, y: 40 }] })];
    const model = buildSceneModel({ board: makeBoard(), instances: [], wires, vias: [] });
    expect(model.traces).toHaveLength(1);
    expect(model.traces[0].id).toBe('circuit-wire-3');
    expect(model.traces[0].width).toBe(0.3);
    expect(model.traces[0].points[0]).toEqual({ x: 0, z: 0 });
    expect(model.traces[0].points[1]).toEqual({ x: 10, z: 0 });
  });

  it('places back/bottom-layer wires on the bottom copper plane', () => {
    const wires = [
      makeWire({ id: 1, layer: 'front' }),
      makeWire({ id: 2, layer: 'back' }),
    ];
    const model = buildSceneModel({ board: makeBoard(), instances: [], wires, vias: [] });
    const top = model.traces.find((t) => t.id === 'circuit-wire-1');
    const bottom = model.traces.find((t) => t.id === 'circuit-wire-2');
    expect(top?.side).toBe('top');
    expect(top?.y).toBeCloseTo(0.8, 6); // +thickness/2
    expect(bottom?.side).toBe('bottom');
    expect(bottom?.y).toBeCloseTo(-0.8, 6);
  });

  it('ignores non-pcb-view wires and degenerate (<2 pt) wires', () => {
    const wires = [
      makeWire({ id: 1, view: 'schematic' }),
      makeWire({ id: 2, view: 'pcb', points: [{ x: 1, y: 1 }] }),
      makeWire({ id: 3, view: 'pcb' }),
    ];
    const model = buildSceneModel({ board: makeBoard(), instances: [], wires, vias: [] });
    expect(model.traces.map((t) => t.id)).toEqual(['circuit-wire-3']);
  });
});

// ---------------------------------------------------------------------------
// Vias
// ---------------------------------------------------------------------------

describe('buildSceneModel — vias', () => {
  it('maps vias to barrels spanning the board thickness with stable ids', () => {
    const vias = [makeVia({ id: 9, x: 50, y: 40, drillDiameter: 0.4, outerDiameter: 0.8 })];
    const model = buildSceneModel({ board: makeBoard(), instances: [], wires: [], vias });
    expect(model.vias).toHaveLength(1);
    const v = model.vias[0];
    expect(v.id).toBe('circuit-via-9');
    expect(v.x).toBeCloseTo(0, 6);
    expect(v.z).toBeCloseTo(0, 6);
    expect(v.drillDiameter).toBe(0.4);
    expect(v.outerDiameter).toBe(0.8);
    expect(v.yBottom).toBeCloseTo(-0.8, 6);
    expect(v.yTop).toBeCloseTo(0.8, 6);
  });
});

// ---------------------------------------------------------------------------
// Board appearance & finish → material
// ---------------------------------------------------------------------------

describe('buildSceneModel — board appearance', () => {
  it('resolves mask/silk colour names to hex', () => {
    const model = buildSceneModel({ board: makeBoard({ solderMaskColor: 'red', silkscreenColor: 'black' }), ...EMPTY });
    expect(model.board.maskColor).toBe('#7a1f1f');
    expect(model.board.silkColor).toBe('#141414');
  });

  it('falls back to green/white for unknown colour names', () => {
    const model = buildSceneModel({ board: makeBoard({ solderMaskColor: 'chartreuse', silkscreenColor: 'cyan' }), ...EMPTY });
    expect(model.board.maskColor).toBe('#1a6b1a');
    expect(model.board.silkColor).toBe('#f5f5f5');
  });

  it('maps finish → pad material (ENIG→gold, HASL→tin, OSP→copper)', () => {
    expect(buildSceneModel({ board: makeBoard({ finish: 'ENIG' }), ...EMPTY }).board.padMaterial).toBe('gold');
    expect(buildSceneModel({ board: makeBoard({ finish: 'HASL' }), ...EMPTY }).board.padMaterial).toBe('tin');
    expect(buildSceneModel({ board: makeBoard({ finish: 'OSP' }), ...EMPTY }).board.padMaterial).toBe('copper');
  });

  it('propagates the layer count into the generated stack', () => {
    const model = buildSceneModel({ board: makeBoard({ layers: 6 }), ...EMPTY });
    expect(model.board.layerCount).toBe(6);
    expect(model.stack.layers.filter((l) => l.role === 'copper')).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// PP3D-5: net names + inspector metadata
// ---------------------------------------------------------------------------

describe('buildSceneModel — net resolution (PP3D-5)', () => {
  const nets = [
    { id: 1, circuitId: 1, name: 'VCC', netType: 'power', voltage: '3.3V', busWidth: null, segments: [], labels: [], style: {}, createdAt: new Date(0) },
    { id: 2, circuitId: 1, name: 'GND', netType: 'ground', voltage: null, busWidth: null, segments: [], labels: [], style: {}, createdAt: new Date(0) },
  ] as CircuitNetRow[];

  it('resolves wire.netId → trace.netName', () => {
    const model = buildSceneModel({
      board: makeBoard(),
      instances: [],
      wires: [makeWire({ id: 1, netId: 1 }), makeWire({ id: 2, netId: 2 })],
      vias: [],
      nets,
    });
    expect(model.traces[0].netName).toBe('VCC');
    expect(model.traces[1].netName).toBe('GND');
  });

  it('resolves via.netId → via.netName', () => {
    const model = buildSceneModel({
      board: makeBoard(),
      instances: [],
      wires: [],
      vias: [makeVia({ id: 1, netId: 2 })],
      nets,
    });
    expect(model.vias[0].netName).toBe('GND');
  });

  it('leaves netName undefined when nets are absent or netId unknown', () => {
    const noNets = buildSceneModel({ board: makeBoard(), instances: [], wires: [makeWire()], vias: [makeVia()] });
    expect(noNets.traces[0].netName).toBeUndefined();
    expect(noNets.vias[0].netName).toBeUndefined();

    const unknown = buildSceneModel({
      board: makeBoard(),
      instances: [],
      wires: [makeWire({ netId: 99 })],
      vias: [],
      nets,
    });
    expect(unknown.traces[0].netName).toBeUndefined();
  });
});

describe('buildSceneModel — component inspector metadata (PP3D-5)', () => {
  it('extracts value/datasheetUrl/supplier from instance properties', () => {
    const model = buildSceneModel({
      board: makeBoard(),
      instances: [
        makeInstance({
          properties: {
            value: '10k',
            datasheetUrl: 'https://example.com/ds.pdf',
            supplier: 'DigiKey',
          },
        }),
      ],
      wires: [],
      vias: [],
      resolveFootprint,
    });
    expect(model.components[0].value).toBe('10k');
    expect(model.components[0].datasheetUrl).toBe('https://example.com/ds.pdf');
    expect(model.components[0].supplier).toBe('DigiKey');
  });

  it('coerces numeric values and falls back to datasheet/manufacturer keys', () => {
    const model = buildSceneModel({
      board: makeBoard(),
      instances: [
        makeInstance({ properties: { value: 470, datasheet: 'https://x.com/d.pdf', manufacturer: 'TI' } }),
      ],
      wires: [],
      vias: [],
      resolveFootprint,
    });
    expect(model.components[0].value).toBe('470');
    expect(model.components[0].datasheetUrl).toBe('https://x.com/d.pdf');
    expect(model.components[0].supplier).toBe('TI');
  });

  it('leaves metadata undefined for empty properties', () => {
    const model = buildSceneModel({
      board: makeBoard(),
      instances: [makeInstance({ properties: {} })],
      wires: [],
      vias: [],
      resolveFootprint,
    });
    expect(model.components[0].value).toBeUndefined();
    expect(model.components[0].datasheetUrl).toBeUndefined();
    expect(model.components[0].supplier).toBeUndefined();
  });
});
