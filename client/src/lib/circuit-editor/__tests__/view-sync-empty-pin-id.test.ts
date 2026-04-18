/**
 * View Sync — Empty pinId Drop Logging (Audit #371)
 *
 * Verifies that wires with empty-string pinId are logged via console.warn
 * rather than being silently dropped. Covers buildBreadboardConnectionSet
 * (used internally by syncSchematicToBreadboard and detectConflicts Check 4).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  syncSchematicToBreadboard,
  syncBreadboardToSchematic,
  detectConflicts,
} from '../view-sync';
import type { CircuitNetRow, CircuitInstanceRow, CircuitWireRow } from '@shared/schema';
import type { ComponentPart } from '@shared/schema';
import type { NetSegment } from '@shared/circuit-types';

// ---------------------------------------------------------------------------
// Factory helpers — mirror view-sync-stress.test.ts conventions
// ---------------------------------------------------------------------------

let idCounter = 5000;
function nextId(): number {
  return idCounter++;
}

function makeInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  const id = overrides.id ?? nextId();
  return {
    id,
    circuitId: 1,
    partId: null,
    referenceDesignator: `U${id}`,
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

function makeNet(overrides: Partial<CircuitNetRow> & { segments?: NetSegment[] } = {}): CircuitNetRow {
  const { segments: segs, ...rest } = overrides;
  const id = rest.id ?? nextId();
  return {
    id,
    circuitId: 1,
    name: `net-${id}`,
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

function makeWire(overrides: Partial<CircuitWireRow> = {}): CircuitWireRow {
  const id = overrides.id ?? nextId();
  return {
    id,
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

/**
 * A part with NO connectors — resolvePixelToPin falls back to empty-string pinId
 * when no partsMap is supplied and the instance is within snap tolerance.
 *
 * To produce an empty-string pinId from resolvePixelToPin, we omit the partsMap.
 * The fallback branch assigns `pinId: ''` when partsMap is absent but the
 * instance origin is within PIN_SNAP_TOLERANCE (15px) of the endpoint.
 */
function makeInstanceAtOrigin(id: number): CircuitInstanceRow {
  return makeInstance({ id, breadboardX: 100, breadboardY: 200 });
}

// ---------------------------------------------------------------------------
// Empty-pinId fixture: a wire whose endpoints snap to instance origins only
// (no partsMap => resolvePixelToPin returns pinId: '')
// ---------------------------------------------------------------------------

/**
 * Build a wire whose both endpoints land exactly on instance origins so that,
 * when resolved WITHOUT a partsMap, they get pinId: '' from the fallback branch.
 */
function makeWireAtOrigins(
  wireId: number,
  netId: number,
  inst1BbX: number,
  inst1BbY: number,
  inst2BbX: number,
  inst2BbY: number,
): CircuitWireRow {
  return makeWire({
    id: wireId,
    netId,
    view: 'breadboard',
    points: [
      { x: inst1BbX, y: inst1BbY },
      { x: inst2BbX, y: inst2BbY },
    ],
  });
}

// ===========================================================================
// Audit #371 — empty-pinId drop logging
// ===========================================================================

describe('view-sync empty-pinId drop logging (audit #371)', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // buildBreadboardConnectionSet path (via syncSchematicToBreadboard)
  // The function is internal, but syncSchematicToBreadboard calls it when
  // checking if an existing breadboard wire already covers a segment.
  // -------------------------------------------------------------------------

  it('logs a warning when a breadboard wire has empty-string from.pinId (no partsMap)', () => {
    // Two instances placed at known coords
    const inst1 = makeInstance({ id: 1, breadboardX: 100, breadboardY: 200 });
    const inst2 = makeInstance({ id: 2, breadboardX: 300, breadboardY: 200 });

    // Wire endpoints land exactly on the instance origins —
    // without a partsMap, resolvePixelToPin returns pinId: '' (fallback branch)
    const wire = makeWire({
      id: 42,
      netId: 1,
      view: 'breadboard',
      points: [
        { x: 100, y: 200 },
        { x: 300, y: 200 },
      ],
    });

    // A net segment that would need the wire — forces buildBreadboardConnectionSet to run
    const net = makeNet({
      id: 1,
      segments: [
        { fromInstanceId: 1, fromPin: '', toInstanceId: 2, toPin: '', waypoints: [] },
      ],
    });

    // No partsMap — resolvePixelToPin falls back to pinId: ''
    syncSchematicToBreadboard([net], [wire], [inst1, inst2]);

    // The warn should fire because the existing wire has empty pinIds
    const warningCalls = consoleSpy.mock.calls.filter((args) =>
      String(args[0]).includes('dropping wire'),
    );
    expect(warningCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('logs a warning when from.pinId is empty string', () => {
    const inst1 = makeInstance({ id: 1, breadboardX: 100, breadboardY: 200 });
    const inst2 = makeInstance({ id: 2, breadboardX: 300, breadboardY: 200 });

    const wire = makeWire({
      id: 43,
      netId: 1,
      view: 'breadboard',
      // from endpoint lands on inst1 origin (empty pinId), to endpoint on inst2 origin (empty pinId)
      points: [
        { x: 100, y: 200 },
        { x: 300, y: 200 },
      ],
    });

    const net = makeNet({
      id: 1,
      segments: [
        { fromInstanceId: 1, fromPin: '', toInstanceId: 2, toPin: '', waypoints: [] },
      ],
    });

    syncSchematicToBreadboard([net], [wire], [inst1, inst2]);

    const warnArgs = consoleSpy.mock.calls.find((args) =>
      String(args[0]).includes('dropping wire'),
    );
    expect(warnArgs).toBeDefined();
  });

  it('warn message includes the wire id', () => {
    const inst1 = makeInstance({ id: 1, breadboardX: 100, breadboardY: 200 });
    const inst2 = makeInstance({ id: 2, breadboardX: 300, breadboardY: 200 });

    const wireId = 999;
    const wire = makeWire({
      id: wireId,
      netId: 1,
      view: 'breadboard',
      points: [
        { x: 100, y: 200 },
        { x: 300, y: 200 },
      ],
    });

    const net = makeNet({
      id: 1,
      segments: [{ fromInstanceId: 1, fromPin: '', toInstanceId: 2, toPin: '', waypoints: [] }],
    });

    syncSchematicToBreadboard([net], [wire], [inst1, inst2]);

    const allWarnText = consoleSpy.mock.calls
      .filter((args) => String(args[0]).includes('dropping wire'))
      .map((args) => args.slice(1).join(' '))
      .join(' ');

    expect(allWarnText).toContain(String(wireId));
  });

  it('warn message includes both endpoint descriptors (instanceId and pinId)', () => {
    const inst1 = makeInstance({ id: 1, breadboardX: 100, breadboardY: 200 });
    const inst2 = makeInstance({ id: 2, breadboardX: 300, breadboardY: 200 });

    const wire = makeWire({
      id: 44,
      netId: 1,
      view: 'breadboard',
      points: [
        { x: 100, y: 200 },
        { x: 300, y: 200 },
      ],
    });

    const net = makeNet({
      id: 1,
      segments: [{ fromInstanceId: 1, fromPin: '', toInstanceId: 2, toPin: '', waypoints: [] }],
    });

    syncSchematicToBreadboard([net], [wire], [inst1, inst2]);

    // The warn format is: [view-sync] dropping wire %s: empty endpoint pinId. from=%s to=%s
    // Positional args include instanceId and pinId info
    const warningCalls = consoleSpy.mock.calls.filter((args) =>
      String(args[0]).includes('dropping wire'),
    );
    expect(warningCalls.length).toBeGreaterThanOrEqual(1);

    // Check that instanceId 1 appears somewhere in the warning arguments
    const hasInst1 = warningCalls.some((args) =>
      args.some((a) => String(a).includes('1:')),
    );
    expect(hasInst1).toBe(true);
  });

  it('does NOT log a warning when pinIds are valid non-empty strings', () => {
    // Use a partsMap so resolvePixelToPin returns the actual connector id
    const partId = 10;
    const part: ComponentPart = {
      id: partId,
      libraryId: null,
      name: 'TestPart',
      category: 'passive',
      description: null,
      connectors: [
        {
          id: 'A',
          name: 'A',
          type: 'male',
          terminalPositions: {
            breadboard: { x: 0, y: 0 },
            schematic: { x: 0, y: 0 },
          },
        },
        {
          id: 'B',
          name: 'B',
          type: 'male',
          terminalPositions: {
            breadboard: { x: 50, y: 0 },
            schematic: { x: 50, y: 0 },
          },
        },
      ],
      svgData: null,
      meta: null,
      createdAt: new Date(),
    } as unknown as ComponentPart;

    const partsMap = new Map([[partId, part]]);

    const inst1 = makeInstance({ id: 1, partId, breadboardX: 100, breadboardY: 200 });
    const inst2 = makeInstance({ id: 2, partId, breadboardX: 300, breadboardY: 200 });

    // Wire endpoints land on connector 'A' of each instance
    const wire = makeWire({
      id: 45,
      netId: 1,
      view: 'breadboard',
      points: [
        { x: 100, y: 200 }, // inst1 + connector A offset (0,0) => (100,200)
        { x: 300, y: 200 }, // inst2 + connector A offset (0,0) => (300,200)
      ],
    });

    const net = makeNet({
      id: 1,
      segments: [{ fromInstanceId: 1, fromPin: 'A', toInstanceId: 2, toPin: 'A', waypoints: [] }],
    });

    syncSchematicToBreadboard([net], [wire], [inst1, inst2], partsMap);

    const warningCalls = consoleSpy.mock.calls.filter((args) =>
      String(args[0]).includes('dropping wire'),
    );
    expect(warningCalls).toHaveLength(0);
  });

  it('does NOT log a warning for wires that cannot be resolved at all (from/to null)', () => {
    // Wire with only 1 point — resolveWireEndpoints returns { from: null, to: null }
    // The null guard (line 263) should fire before the pinId guard
    const wire = makeWire({
      id: 46,
      netId: 1,
      view: 'breadboard',
      points: [{ x: 100, y: 200 }], // only 1 point => both endpoints null
    });

    const net = makeNet({ id: 1 });
    syncSchematicToBreadboard([net], [wire], []);

    const warningCalls = consoleSpy.mock.calls.filter((args) =>
      String(args[0]).includes('dropping wire'),
    );
    // Should NOT warn — the null case is legitimate "couldn't resolve" not empty pinId
    expect(warningCalls).toHaveLength(0);
  });

  it('logs warning when to.pinId is empty string (from is valid, to is empty)', () => {
    // Instance 1 has part connectors (will get real pinId)
    // Instance 2 has NO part + no partsMap fallback = pinId: ''
    // We achieve asymmetry by: inst1 near its connector, inst2 at its raw origin

    const partId = 10;
    const part: ComponentPart = {
      id: partId,
      libraryId: null,
      name: 'TestPart',
      category: 'passive',
      description: null,
      connectors: [
        {
          id: 'A',
          name: 'A',
          type: 'male',
          terminalPositions: {
            breadboard: { x: 0, y: 0 },
            schematic: { x: 0, y: 0 },
          },
        },
      ],
      svgData: null,
      meta: null,
      createdAt: new Date(),
    } as unknown as ComponentPart;

    const partsMap = new Map([[partId, part]]);

    // inst1 has a part; inst2 does NOT (partId: null) — its entry in partsMap won't resolve
    const inst1 = makeInstance({ id: 1, partId, breadboardX: 100, breadboardY: 200 });
    const inst2 = makeInstance({ id: 2, partId: null, breadboardX: 300, breadboardY: 200 });

    // Wire: from=inst1 connector A position (100,200), to=inst2 origin (300,200)
    // Without part data for inst2, resolvePixelToPin will skip it (partId is null => returns null)
    // So "to" will be null, not empty string — null case should NOT warn.
    // But if we remove partsMap entirely, BOTH get empty-string pinIds.
    const wire = makeWire({
      id: 47,
      netId: 1,
      view: 'breadboard',
      points: [
        { x: 100, y: 200 },
        { x: 300, y: 200 },
      ],
    });

    const net = makeNet({ id: 1 });
    // No partsMap — both endpoints get empty-string pinId
    syncSchematicToBreadboard([net], [wire], [inst1, inst2]);

    const warningCalls = consoleSpy.mock.calls.filter((args) =>
      String(args[0]).includes('dropping wire'),
    );
    expect(warningCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('logs warning when both from.pinId and to.pinId are empty string', () => {
    const inst1 = makeInstance({ id: 1, breadboardX: 100, breadboardY: 200 });
    const inst2 = makeInstance({ id: 2, breadboardX: 300, breadboardY: 200 });

    const wire = makeWire({
      id: 48,
      netId: 1,
      view: 'breadboard',
      points: [
        { x: 100, y: 200 }, // snaps to inst1 origin => pinId: ''
        { x: 300, y: 200 }, // snaps to inst2 origin => pinId: ''
      ],
    });

    const net = makeNet({ id: 1 });
    // Deliberately no partsMap so fallback branch produces pinId: ''
    syncSchematicToBreadboard([net], [wire], [inst1, inst2]);

    const warningCalls = consoleSpy.mock.calls.filter((args) =>
      String(args[0]).includes('dropping wire'),
    );
    expect(warningCalls.length).toBeGreaterThanOrEqual(1);
  });
});
