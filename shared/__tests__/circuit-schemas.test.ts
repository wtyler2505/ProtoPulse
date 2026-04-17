/**
 * Tests for the Zod schemas that replaced `z.any()` route bypasses (task #45).
 *
 * These validate that:
 * 1. Canonical payload shapes parse successfully (no regression).
 * 2. Malicious / malformed payloads are REJECTED.
 * 3. Unknown fields pass through (forward-compat).
 * 4. All three legitimate NetSegment shapes are accepted via union.
 */
import { describe, it, expect } from 'vitest';
import {
  circuitSettingsSchema,
  netSegmentSchema,
  netSegmentGraphSchema,
  netSegmentLineSchema,
  netSegmentIrSchema,
  netLabelSchema,
  netStyleSchema,
  partMetaSchema,
  partStateSchema,
} from '../circuit-schemas';

// ---------------------------------------------------------------------------
// circuitSettingsSchema
// ---------------------------------------------------------------------------
describe('circuitSettingsSchema', () => {
  it('accepts empty settings blob', () => {
    expect(circuitSettingsSchema.parse({}).powerSymbols).toBeUndefined();
  });

  it('accepts canonical CircuitSettings shape', () => {
    const settings = {
      gridSize: 50,
      netColors: { GND: '#000000', VCC: '#ff0000' },
      defaultBusWidth: 8,
      showPowerNets: true,
      showNetLabels: true,
      powerSymbols: [
        { id: 'ps1', type: 'VCC', netName: 'VCC', x: 10, y: 20, rotation: 0 },
      ],
      noConnectMarkers: [],
      netLabels: [],
      annotations: [],
    };
    const result = circuitSettingsSchema.parse(settings);
    expect(result.gridSize).toBe(50);
    expect(result.powerSymbols).toHaveLength(1);
  });

  it('rejects payloads where powerSymbols is not an array', () => {
    expect(() => circuitSettingsSchema.parse({ powerSymbols: 'not-an-array' })).toThrow();
  });

  it('rejects powerSymbol with invalid type', () => {
    expect(() =>
      circuitSettingsSchema.parse({
        powerSymbols: [{ id: 'x', type: 'INVALID_POWER_TYPE', netName: 'X', x: 0, y: 0, rotation: 0 }],
      }),
    ).toThrow();
  });

  it('rejects powerSymbol missing required fields', () => {
    expect(() =>
      circuitSettingsSchema.parse({
        powerSymbols: [{ id: 'x', type: 'VCC' }], // missing netName/x/y/rotation
      }),
    ).toThrow();
  });

  it('passes through forward-compat unknown keys on the root', () => {
    const result = circuitSettingsSchema.parse({
      gridSize: 25,
      futureField: 'whatever',
      anotherNew: { nested: 42 },
    }) as Record<string, unknown>;
    expect(result.futureField).toBe('whatever');
  });

  it('passes through unknown keys on nested power symbols', () => {
    const result = circuitSettingsSchema.parse({
      powerSymbols: [
        { id: 'p', type: 'GND', netName: 'GND', x: 0, y: 0, rotation: 0, futureTag: 'beta' },
      ],
    });
    const sym = result.powerSymbols?.[0] as Record<string, unknown> | undefined;
    expect(sym?.futureTag).toBe('beta');
  });

  it('rejects annotation with non-positive fontSize', () => {
    expect(() =>
      circuitSettingsSchema.parse({
        annotations: [{ id: 'a', text: 'note', x: 0, y: 0, fontSize: 0, color: '#fff' }],
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// netSegmentSchema — accepts 3 legitimate shapes
// ---------------------------------------------------------------------------
describe('netSegmentSchema — union of 3 legitimate shapes', () => {
  it('accepts canonical graph-edge segment (fromInstanceId/fromPin)', () => {
    const payload = {
      fromInstanceId: 1,
      fromPin: 'A',
      toInstanceId: 2,
      toPin: 'K',
      waypoints: [{ x: 10, y: 20 }],
    };
    expect(netSegmentGraphSchema.parse(payload)).toMatchObject(payload);
    expect(netSegmentSchema.parse(payload)).toMatchObject(payload);
  });

  it('graph segment defaults empty waypoints', () => {
    const result = netSegmentGraphSchema.parse({
      fromInstanceId: 1,
      fromPin: 'A',
      toInstanceId: 2,
      toPin: 'K',
    });
    expect(result.waypoints).toEqual([]);
  });

  it('rejects graph segment with negative instance id', () => {
    expect(() =>
      netSegmentGraphSchema.parse({
        fromInstanceId: -1,
        fromPin: 'A',
        toInstanceId: 2,
        toPin: 'K',
      }),
    ).toThrow();
  });

  it('rejects graph segment with empty pin name', () => {
    expect(() =>
      netSegmentGraphSchema.parse({
        fromInstanceId: 1,
        fromPin: '',
        toInstanceId: 2,
        toPin: 'K',
      }),
    ).toThrow();
  });

  it('accepts line segment (x1,y1,x2,y2)', () => {
    const payload = { x1: 0, y1: 0, x2: 100, y2: 0 };
    expect(netSegmentLineSchema.parse(payload)).toMatchObject(payload);
    expect(netSegmentSchema.parse(payload)).toMatchObject(payload);
  });

  it('accepts DSL irId segment', () => {
    const payload = { irId: 'net-42' };
    expect(netSegmentIrSchema.parse(payload)).toMatchObject(payload);
    expect(netSegmentSchema.parse(payload)).toMatchObject(payload);
  });

  it('rejects segment with none of the three shapes', () => {
    expect(() => netSegmentSchema.parse({ nonsense: true })).toThrow();
  });

  it('rejects segment with null fields', () => {
    expect(() =>
      netSegmentSchema.parse({ fromInstanceId: null, fromPin: null, toInstanceId: null, toPin: null }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// netLabelSchema
// ---------------------------------------------------------------------------
describe('netLabelSchema', () => {
  it('accepts canonical label', () => {
    expect(
      netLabelSchema.parse({ x: 10, y: 20, text: 'CLK', view: 'schematic' }),
    ).toMatchObject({ text: 'CLK', view: 'schematic' });
  });

  it('accepts all view enum values', () => {
    for (const view of ['schematic', 'breadboard', 'pcb'] as const) {
      expect(netLabelSchema.parse({ x: 0, y: 0, text: 't', view }).view).toBe(view);
    }
  });

  it('rejects invalid view enum', () => {
    expect(() => netLabelSchema.parse({ x: 0, y: 0, text: 't', view: 'nope' })).toThrow();
  });

  it('rejects missing coordinates', () => {
    expect(() => netLabelSchema.parse({ text: 't', view: 'schematic' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// netStyleSchema
// ---------------------------------------------------------------------------
describe('netStyleSchema', () => {
  it('accepts empty object', () => {
    expect(netStyleSchema.parse({}).color).toBeUndefined();
  });

  it('accepts color only', () => {
    expect(netStyleSchema.parse({ color: '#ff0000' }).color).toBe('#ff0000');
  });

  it('accepts lineStyle enum values', () => {
    expect(netStyleSchema.parse({ lineStyle: 'solid' }).lineStyle).toBe('solid');
    expect(netStyleSchema.parse({ lineStyle: 'dashed' }).lineStyle).toBe('dashed');
  });

  it('rejects invalid lineStyle', () => {
    expect(() => netStyleSchema.parse({ lineStyle: 'wiggly' })).toThrow();
  });

  it('passes through forward-compat keys', () => {
    const result = netStyleSchema.parse({ color: '#fff', futureWidth: 2 }) as Record<string, unknown>;
    expect(result.futureWidth).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// partMetaSchema
// ---------------------------------------------------------------------------
describe('partMetaSchema', () => {
  const minimalMeta = {
    title: 'LM317T',
    tags: ['regulator', 'linear'],
    mountingType: 'tht' as const,
    properties: [{ key: 'voltage', value: '1.2-37V' }],
  };

  it('accepts minimal valid meta', () => {
    const result = partMetaSchema.parse(minimalMeta);
    expect(result.title).toBe('LM317T');
    expect(result.tags).toHaveLength(2);
  });

  it('accepts meta with all documented optional fields', () => {
    const full = {
      ...minimalMeta,
      aliases: ['LM317'],
      family: 'voltage-regulator',
      manufacturer: 'Texas Instruments',
      mpn: 'LM317T',
      description: 'Adjustable regulator',
      packageType: 'TO-220',
      datasheetUrl: 'https://example.com',
      version: '1.0',
      breadboardFit: 'native' as const,
      breadboardModelQuality: 'verified' as const,
      verificationNotes: ['Reviewed'],
      benchCategory: 'power',
      spiceSubcircuit: '.SUBCKT ...',
    };
    const result = partMetaSchema.parse(full);
    expect(result.manufacturer).toBe('Texas Instruments');
    expect(result.breadboardFit).toBe('native');
  });

  it('rejects meta missing title', () => {
    const { title: _omit, ...rest } = minimalMeta;
    expect(() => partMetaSchema.parse(rest)).toThrow();
  });

  it('rejects meta with invalid mountingType', () => {
    expect(() => partMetaSchema.parse({ ...minimalMeta, mountingType: 'magic' })).toThrow();
  });

  it('rejects meta with invalid breadboardFit enum', () => {
    expect(() => partMetaSchema.parse({ ...minimalMeta, breadboardFit: 'huh' })).toThrow();
  });

  it('rejects property with empty key', () => {
    expect(() =>
      partMetaSchema.parse({ ...minimalMeta, properties: [{ key: '', value: 'v' }] }),
    ).toThrow();
  });

  it('passes through forward-compat unknown fields', () => {
    const result = partMetaSchema.parse({
      ...minimalMeta,
      futurePartFlag: true,
      newMetaBlob: { x: 1 },
    }) as Record<string, unknown>;
    expect(result.futurePartFlag).toBe(true);
    expect(result.newMetaBlob).toEqual({ x: 1 });
  });
});

// ---------------------------------------------------------------------------
// partStateSchema
// ---------------------------------------------------------------------------
describe('partStateSchema', () => {
  // Canonical Connector shape per shared/component-types.ts:73-81 requires
  // id + name + connectorType + shapeIds + terminalPositions (and optional
  // description + padSpec). These test fixtures match that real shape — an
  // earlier version under-specified the schema with just {id} which was a
  // validation hole.
  const canonicalConnector = {
    id: 'c1',
    name: 'Pin 1',
    connectorType: 'male' as const,
    shapeIds: { breadboard: ['shape-1'] },
    terminalPositions: { breadboard: { x: 0, y: 0 } },
  };
  const minimalState = {
    meta: {
      title: 'Resistor',
      tags: [],
      mountingType: 'smd' as const,
      properties: [],
    },
    connectors: [canonicalConnector],
    buses: [],
    views: {
      breadboard: { shapes: [] },
      schematic: { shapes: [] },
      pcb: { shapes: [] },
    },
  };

  it('accepts minimal part state with full Connector shape', () => {
    const result = partStateSchema.parse(minimalState);
    expect(result.meta.title).toBe('Resistor');
    expect(result.connectors).toHaveLength(1);
    expect(result.connectors[0].id).toBe('c1');
  });

  it('rejects state where meta is missing', () => {
    const { meta: _omit, ...rest } = minimalState;
    expect(() => partStateSchema.parse(rest)).toThrow();
  });

  it('rejects state where views is missing required sub-view', () => {
    expect(() =>
      partStateSchema.parse({
        ...minimalState,
        views: { breadboard: { shapes: [] }, schematic: { shapes: [] } }, // missing pcb
      }),
    ).toThrow();
  });

  it('rejects connector missing required fields (name/connectorType/shapeIds/terminalPositions)', () => {
    expect(() =>
      partStateSchema.parse({
        ...minimalState,
        connectors: [{ id: 'c1' }], // missing required fields — this used to pass under the old loose schema
      }),
    ).toThrow();
  });

  it('rejects connector with invalid connectorType enum', () => {
    expect(() =>
      partStateSchema.parse({
        ...minimalState,
        connectors: [{ ...canonicalConnector, connectorType: 'bogus' }],
      }),
    ).toThrow();
  });

  it('accepts connector with optional padSpec', () => {
    const result = partStateSchema.parse({
      ...minimalState,
      connectors: [{
        ...canonicalConnector,
        padSpec: { type: 'smd' as const, shape: 'rect' as const, width: 1.6, height: 0.8 },
      }],
    });
    // Zod's passthrough output widens the nested shape's inferred type;
    // assert via Record access instead of dotted path.
    const padSpec = (result.connectors[0] as Record<string, unknown>).padSpec as
      | { type: string; shape: string }
      | undefined;
    expect(padSpec?.type).toBe('smd');
    expect(padSpec?.shape).toBe('rect');
  });

  it('passes through connector/bus forward-compat fields', () => {
    const result = partStateSchema.parse({
      ...minimalState,
      connectors: [{ ...canonicalConnector, futureAnchor: { x: 5 } }],
    });
    expect((result.connectors[0] as Record<string, unknown>).futureAnchor).toEqual({ x: 5 });
  });

  it('accepts bus with full shape', () => {
    const result = partStateSchema.parse({
      ...minimalState,
      buses: [{ id: 'b1', name: 'I2C', connectorIds: ['c1'] }],
    });
    expect(result.buses[0].name).toBe('I2C');
  });

  it('rejects bus missing required name', () => {
    expect(() =>
      partStateSchema.parse({
        ...minimalState,
        buses: [{ id: 'b1', connectorIds: [] }],
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Security regression — reject attacker-style payloads
// ---------------------------------------------------------------------------
describe('security regression — reject attacker payloads', () => {
  it('rejects string payload to segment union', () => {
    expect(() => netSegmentSchema.parse('<script>alert(1)</script>')).toThrow();
  });

  it('rejects function payload', () => {
    expect(() => netSegmentSchema.parse(() => 1)).toThrow();
  });

  it('rejects Symbol payload', () => {
    expect(() => netSegmentSchema.parse(Symbol('x'))).toThrow();
  });

  it('does not execute nested code in passthrough fields (passthrough stores values, not calls them)', () => {
    let called = false;
    const result = partMetaSchema.parse({
      title: 't',
      tags: [],
      mountingType: '',
      properties: [],
      // Passthrough stores this as data; never invoked by schema parse
      evilGetter: {
        get foo() {
          called = true;
          return 'x';
        },
      },
    });
    expect(result).toBeDefined();
    // The getter should only fire when consumer code accesses it — never during parse
    expect(called).toBe(false);
  });
});
