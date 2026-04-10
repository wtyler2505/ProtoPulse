/**
 * View Sync — Wire Provenance Tests
 *
 * Verifies that sync-created wires carry `provenance: 'synced'` so the
 * system can distinguish user-drawn ('manual') wires from engine-generated ones.
 */

import { describe, it, expect } from 'vitest';
import { syncSchematicToBreadboard, syncBreadboardToSchematic } from '../view-sync';
import type { CircuitNetRow, CircuitInstanceRow, CircuitWireRow } from '@shared/schema';
import type { ComponentPart } from '@shared/schema';
import type { NetSegment } from '@shared/circuit-types';

// ---------------------------------------------------------------------------
// Factory helpers — Drizzle inferred types require all columns
// ---------------------------------------------------------------------------

function makeInstance(overrides: Partial<CircuitInstanceRow>): CircuitInstanceRow {
  return {
    id: 1,
    circuitId: 1,
    partId: null,
    referenceDesignator: 'R1',
    breadboardX: 100,
    breadboardY: 200,
    schematicX: 50,
    schematicY: 60,
    schematicRotation: 0,
    breadboardRotation: 0,
    pcbX: null,
    pcbY: null,
    pcbRotation: 0,
    pcbSide: 'front',
    subDesignId: null,
    benchX: null,
    benchY: null,
    properties: null,
    createdAt: new Date(),
    ...(overrides as Record<string, unknown>),
  } as unknown as CircuitInstanceRow;
}

function makeNet(overrides: Partial<CircuitNetRow> & { segments?: NetSegment[] }): CircuitNetRow {
  const { segments: segs, ...rest } = overrides;
  return {
    id: 1,
    circuitId: 1,
    name: 'GND',
    netType: 'signal',
    voltage: null,
    busWidth: null,
    segments: segs ?? [],
    labels: null,
    style: null,
    createdAt: new Date(),
    ...(rest as Record<string, unknown>),
  } as CircuitNetRow;
}

function makeWire(overrides: Partial<CircuitWireRow>): CircuitWireRow {
  return {
    id: 1,
    circuitId: 1,
    netId: 1,
    view: 'breadboard',
    points: [
      { x: 100, y: 200 },
      { x: 300, y: 200 },
    ],
    layer: null,
    width: null,
    color: null,
    wireType: 'wire',
    endpointMeta: null,
    provenance: 'manual',
    createdAt: new Date(),
    ...(overrides as Record<string, unknown>),
  } as unknown as CircuitWireRow;
}

function makePart(overrides: Partial<ComponentPart>): ComponentPart {
  return {
    id: 1,
    libraryId: null,
    name: 'Resistor',
    category: 'passive',
    description: null,
    connectors: [
      {
        id: 'pin1',
        name: 'pin1',
        type: 'male',
        terminalPositions: {
          breadboard: { x: 0, y: 0 },
          schematic: { x: 0, y: 0 },
        },
      },
      {
        id: 'pin2',
        name: 'pin2',
        type: 'male',
        terminalPositions: {
          breadboard: { x: 20, y: 0 },
          schematic: { x: 40, y: 0 },
        },
      },
    ],
    svgData: null,
    meta: null,
    createdAt: new Date(),
  } as unknown as ComponentPart;
}

// ---------------------------------------------------------------------------
// syncSchematicToBreadboard — provenance
// ---------------------------------------------------------------------------

describe('syncSchematicToBreadboard provenance', () => {
  it('sets provenance to "synced" on created wires', () => {
    const part = makePart({ id: 10 });
    const partsMap = new Map([[10, part]]);

    const instances = [
      makeInstance({ id: 1, partId: 10, breadboardX: 100, breadboardY: 200, schematicX: 0, schematicY: 0 }),
      makeInstance({ id: 2, partId: 10, breadboardX: 300, breadboardY: 200, schematicX: 100, schematicY: 0 }),
    ];

    const nets = [
      makeNet({
        id: 1,
        segments: [
          { fromInstanceId: 1, fromPin: 'pin2', toInstanceId: 2, toPin: 'pin1', waypoints: [] },
        ],
      }),
    ];

    const result = syncSchematicToBreadboard(nets, [], instances, partsMap);

    expect(result.wiresToCreate).toHaveLength(1);
    expect(result.wiresToCreate[0].provenance).toBe('synced');
  });

  it('does not set provenance on wires that already exist (no creation)', () => {
    const part = makePart({ id: 10 });
    const partsMap = new Map([[10, part]]);

    const instances = [
      makeInstance({ id: 1, partId: 10, breadboardX: 100, breadboardY: 200 }),
      makeInstance({ id: 2, partId: 10, breadboardX: 300, breadboardY: 200 }),
    ];

    // Wire already exists at exactly the pin positions
    const existingWires = [
      makeWire({
        id: 100,
        netId: 1,
        view: 'breadboard',
        points: [
          { x: 120, y: 200 }, // inst1.bbX(100) + pin2.bb.x(20) = 120
          { x: 300, y: 200 }, // inst2.bbX(300) + pin1.bb.x(0) = 300
        ],
      }),
    ];

    const nets = [
      makeNet({
        id: 1,
        segments: [
          { fromInstanceId: 1, fromPin: 'pin2', toInstanceId: 2, toPin: 'pin1', waypoints: [] },
        ],
      }),
    ];

    const result = syncSchematicToBreadboard(nets, existingWires, instances, partsMap);

    // No new wires needed — existing one covers the connection
    expect(result.wiresToCreate).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// syncBreadboardToSchematic — provenance
// ---------------------------------------------------------------------------

describe('syncBreadboardToSchematic provenance', () => {
  it('sets provenance to "synced" on schematic wires created from breadboard', () => {
    const part = makePart({ id: 10 });
    const partsMap = new Map([[10, part]]);

    const instances = [
      makeInstance({ id: 1, partId: 10, breadboardX: 100, breadboardY: 200, schematicX: 50, schematicY: 60 }),
      makeInstance({ id: 2, partId: 10, breadboardX: 300, breadboardY: 200, schematicX: 200, schematicY: 60 }),
    ];

    // Breadboard wire connecting pin2 of inst1 to pin1 of inst2
    const wires = [
      makeWire({
        id: 1,
        netId: 1,
        view: 'breadboard',
        points: [
          { x: 120, y: 200 }, // inst1 pin2 breadboard pos
          { x: 300, y: 200 }, // inst2 pin1 breadboard pos
        ],
      }),
    ];

    // No existing schematic nets covering this connection
    const existingNets: CircuitNetRow[] = [];

    const result = syncBreadboardToSchematic(wires, existingNets, instances, partsMap);

    expect(result.wiresToCreate).toHaveLength(1);
    expect(result.wiresToCreate[0].provenance).toBe('synced');
  });
});
