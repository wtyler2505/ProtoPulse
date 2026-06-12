import { describe, it, expect } from 'vitest';

import { COPPER_THICKNESS_MM } from '../../scene/trace-geometry';
import { buildLayerStack } from '../layer-stack';
import {
  describeSelection,
  findComponent,
  findPad,
  findTrace,
  findVia,
  nextSelection,
  selectionBounds,
  traceLength,
} from '../scene-lookup';

import type {
  SceneComponent,
  SceneModel,
  ScenePad,
  SceneSelection,
  SceneTrace,
  SceneVia,
} from '../scene-model';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeComponent(over: Partial<SceneComponent> = {}): SceneComponent {
  return {
    id: 'circuit-instance-1',
    refDes: 'U1',
    package: 'SOIC-8',
    x: 10,
    z: -5,
    rotationDeg: 0,
    side: 'top',
    bodyW: 6,
    bodyD: 4,
    bodyH: 1.5,
    color: '#1a1a1a',
    material: 'body-ic',
    ...over,
  };
}

function makePad(over: Partial<ScenePad> = {}): ScenePad {
  return {
    id: 'circuit-instance-1-pad-1',
    componentId: 'circuit-instance-1',
    x: 8,
    z: -5,
    diameter: 1.2,
    through: false,
    side: 'top',
    material: 'tin',
    ...over,
  };
}

function makeTrace(over: Partial<SceneTrace> = {}): SceneTrace {
  return {
    id: 'circuit-wire-1',
    points: [
      { x: 0, z: 0 },
      { x: 3, z: 4 },
    ],
    width: 0.3,
    side: 'top',
    y: 0.8,
    material: 'copper',
    netName: 'VCC',
    ...over,
  };
}

function makeVia(over: Partial<SceneVia> = {}): SceneVia {
  return {
    id: 'circuit-via-1',
    x: -20,
    z: 12,
    drillDiameter: 0.3,
    outerDiameter: 0.6,
    yBottom: -0.8,
    yTop: 0.8,
    material: 'tin',
    netName: 'GND',
    ...over,
  };
}

function makeModel(over: Partial<SceneModel> = {}): SceneModel {
  return {
    board: {
      widthMm: 100,
      heightMm: 80,
      thicknessMm: 1.6,
      cornerRadiusMm: 2,
      layerCount: 2,
      maskColor: '#1a6b1a',
      silkColor: '#f5f5f5',
      finish: 'HASL',
      padMaterial: 'tin',
    },
    stack: buildLayerStack(2, 1.6, '#1a6b1a'),
    components: [makeComponent()],
    pads: [makePad()],
    traces: [makeTrace()],
    vias: [makeVia()],
    drillHoles: [],
    isEmpty: false,
    ...over,
  };
}

const SEL_COMPONENT: SceneSelection = { kind: 'component', id: 'circuit-instance-1' };
const SEL_PAD: SceneSelection = { kind: 'pad', id: 'circuit-instance-1-pad-1' };
const SEL_TRACE: SceneSelection = { kind: 'trace', id: 'circuit-wire-1' };
const SEL_VIA: SceneSelection = { kind: 'via', id: 'circuit-via-1' };

// ---------------------------------------------------------------------------
// nextSelection
// ---------------------------------------------------------------------------

describe('nextSelection', () => {
  it('selects an element from nothing', () => {
    expect(nextSelection(null, SEL_COMPONENT)).toEqual(SEL_COMPONENT);
  });

  it('switches selection to a different element', () => {
    expect(nextSelection(SEL_COMPONENT, SEL_TRACE)).toEqual(SEL_TRACE);
  });

  it('toggles off when re-clicking the selected element', () => {
    expect(nextSelection(SEL_COMPONENT, { ...SEL_COMPONENT })).toBeNull();
  });

  it('clears on a null click (background / pointer-missed)', () => {
    expect(nextSelection(SEL_COMPONENT, null)).toBeNull();
  });

  it('does not toggle off when kind differs but id matches', () => {
    const padWithSameId: SceneSelection = { kind: 'pad', id: SEL_COMPONENT.id };
    expect(nextSelection(SEL_COMPONENT, padWithSameId)).toEqual(padWithSameId);
  });
});

// ---------------------------------------------------------------------------
// find*
// ---------------------------------------------------------------------------

describe('element lookup', () => {
  const model = makeModel();

  it('finds each element family by id', () => {
    expect(findComponent(model, 'circuit-instance-1')?.refDes).toBe('U1');
    expect(findPad(model, 'circuit-instance-1-pad-1')?.componentId).toBe('circuit-instance-1');
    expect(findTrace(model, 'circuit-wire-1')?.netName).toBe('VCC');
    expect(findVia(model, 'circuit-via-1')?.netName).toBe('GND');
  });

  it('returns null for unknown ids', () => {
    expect(findComponent(model, 'nope')).toBeNull();
    expect(findPad(model, 'nope')).toBeNull();
    expect(findTrace(model, 'nope')).toBeNull();
    expect(findVia(model, 'nope')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// traceLength
// ---------------------------------------------------------------------------

describe('traceLength', () => {
  it('sums polyline segment lengths', () => {
    // 3-4-5 triangle → 5mm, plus a 5mm horizontal run.
    const t = makeTrace({
      points: [
        { x: 0, z: 0 },
        { x: 3, z: 4 },
        { x: 8, z: 4 },
      ],
    });
    expect(traceLength(t)).toBeCloseTo(10);
  });

  it('is 0 for a single point', () => {
    expect(traceLength(makeTrace({ points: [{ x: 1, z: 1 }] }))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// describeSelection
// ---------------------------------------------------------------------------

describe('describeSelection', () => {
  it('returns null for no selection', () => {
    expect(describeSelection(makeModel(), null)).toBeNull();
  });

  it('returns null for a stale selection id', () => {
    expect(describeSelection(makeModel(), { kind: 'component', id: 'gone' })).toBeNull();
  });

  it('describes a component with refDes/package/value/pads', () => {
    const model = makeModel({
      components: [
        makeComponent({ value: '10k', datasheetUrl: 'https://e.com/ds.pdf', supplier: 'DigiKey' }),
      ],
    });
    const d = describeSelection(model, SEL_COMPONENT);
    expect(d).not.toBeNull();
    expect(d?.kind).toBe('component');
    expect(d?.title).toBe('U1');
    expect(d?.subtitle).toBe('SOIC-8');
    const labels = d?.fields.map((f) => f.label);
    expect(labels).toContain('Value');
    expect(labels).toContain('Pads');
    expect(d?.fields.find((f) => f.label === 'Value')?.value).toBe('10k');
    expect(d?.fields.find((f) => f.label === 'Pads')?.value).toBe('1');
    expect(d?.fields.find((f) => f.label === 'Datasheet')?.href).toBe('https://e.com/ds.pdf');
    expect(d?.fields.find((f) => f.label === 'Supplier')?.value).toBe('DigiKey');
  });

  it('omits optional component fields when absent', () => {
    const d = describeSelection(makeModel(), SEL_COMPONENT);
    const labels = d?.fields.map((f) => f.label) ?? [];
    expect(labels).not.toContain('Value');
    expect(labels).not.toContain('Datasheet');
    expect(labels).not.toContain('Supplier');
  });

  it('describes a pad with its parent refDes', () => {
    const d = describeSelection(makeModel(), SEL_PAD);
    expect(d?.kind).toBe('pad');
    expect(d?.title).toBe('U1 pad');
    expect(d?.fields.find((f) => f.label === 'Component')?.value).toBe('U1');
    expect(d?.fields.find((f) => f.label === 'Type')?.value).toBe('SMD');
  });

  it('describes a trace with net name and computed length', () => {
    const d = describeSelection(makeModel(), SEL_TRACE);
    expect(d?.kind).toBe('trace');
    expect(d?.title).toBe('Trace — VCC');
    expect(d?.fields.find((f) => f.label === 'Net')?.value).toBe('VCC');
    expect(d?.fields.find((f) => f.label === 'Length')?.value).toBe('5.00 mm');
    expect(d?.fields.find((f) => f.label === 'Layer')?.value).toBe('top copper');
  });

  it('describes an unnamed trace without a Net row', () => {
    const model = makeModel({ traces: [makeTrace({ netName: undefined })] });
    const d = describeSelection(model, SEL_TRACE);
    expect(d?.title).toBe('Trace');
    expect(d?.fields.map((f) => f.label)).not.toContain('Net');
  });

  it('describes a via with net and drill data', () => {
    const d = describeSelection(makeModel(), SEL_VIA);
    expect(d?.kind).toBe('via');
    expect(d?.title).toBe('Via — GND');
    expect(d?.fields.find((f) => f.label === 'Drill')?.value).toBe('0.30 mm');
    expect(d?.fields.find((f) => f.label === 'Outer')?.value).toBe('0.60 mm');
  });
});

// ---------------------------------------------------------------------------
// selectionBounds
// ---------------------------------------------------------------------------

describe('selectionBounds', () => {
  it('returns null for no/stale selection', () => {
    expect(selectionBounds(makeModel(), null)).toBeNull();
    expect(selectionBounds(makeModel(), { kind: 'via', id: 'gone' })).toBeNull();
  });

  it('bounds an unrotated top-side component above the board face', () => {
    const b = selectionBounds(makeModel(), SEL_COMPONENT);
    expect(b).toEqual({
      min: { x: 10 - 3, y: 0.8, z: -5 - 2 },
      max: { x: 10 + 3, y: 0.8 + 1.5, z: -5 + 2 },
    });
  });

  it('bounds a bottom-side component below the board face', () => {
    const model = makeModel({ components: [makeComponent({ side: 'bottom' })] });
    const b = selectionBounds(model, SEL_COMPONENT);
    expect(b?.max.y).toBeCloseTo(-0.8);
    expect(b?.min.y).toBeCloseTo(-0.8 - 1.5);
  });

  it('swaps the footprint AABB for a 90° rotated component', () => {
    const model = makeModel({ components: [makeComponent({ rotationDeg: 90 })] });
    const b = selectionBounds(model, SEL_COMPONENT);
    // bodyW=6/bodyD=4 swap: half-extents become 2 and 3.
    expect(b!.max.x - b!.min.x).toBeCloseTo(4);
    expect(b!.max.z - b!.min.z).toBeCloseTo(6);
  });

  it('bounds a trace by its points expanded by half the width', () => {
    const b = selectionBounds(makeModel(), SEL_TRACE);
    expect(b?.min.x).toBeCloseTo(-0.15);
    expect(b?.max.x).toBeCloseTo(3.15);
    expect(b?.min.z).toBeCloseTo(-0.15);
    expect(b?.max.z).toBeCloseTo(4.15);
    expect(b?.max.y).toBeCloseTo(0.8 + COPPER_THICKNESS_MM);
  });

  it('bounds a via by its outer radius and barrel span', () => {
    const b = selectionBounds(makeModel(), SEL_VIA);
    expect(b?.min.x).toBeCloseTo(-20.3);
    expect(b?.max.x).toBeCloseTo(-19.7);
    expect(b?.min.y).toBeCloseTo(-0.8 - COPPER_THICKNESS_MM);
    expect(b?.max.y).toBeCloseTo(0.8 + COPPER_THICKNESS_MM);
  });
});
