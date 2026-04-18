/**
 * View Sync — Empty pinId Drop Logging (Audit #371)
 *
 * Verifies that wires with empty-string pinId are logged via console.warn
 * rather than being silently dropped. Covers buildBreadboardConnectionSet
 * (used internally by syncSchematicToBreadboard and detectConflicts Check 4).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncSchematicToBreadboard } from '../view-sync';
import type { CircuitNetRow, CircuitInstanceRow, CircuitWireRow } from '@shared/schema';
import type { ComponentPart } from '@shared/schema';
import type { NetSegment } from '@shared/circuit-types';

// ---------------------------------------------------------------------------
// Typed helper for inspecting console.warn spy calls
// consoleSpy.mock.calls is unknown[][] in strict TS
// ---------------------------------------------------------------------------
function warnCallsContaining(
  spy: ReturnType<typeof vi.spyOn>,
  substring: string,
): unknown[][] {
  return (spy.mock.calls as unknown[][]).filter(
    (args: unknown[]) => String(args[0]).includes(substring),
  );
}

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

function makePartWithConnector(partId: number, connectorId: string): ComponentPart {
  return {
    id: partId,
    libraryId: null,
    name: 'TestPart',
    category: 'passive',
    description: null,
    connectors: [
      {
        id: connectorId,
        name: connectorId,
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
  // buildBreadboardConnectionSet path (via syncSchematicToBreadboard).
  // The function is internal, but syncSchematicToBreadboard calls it when
  // checking if an existing breadboard wire already covers a segment.
  // Without a partsMap, resolvePixelToPin falls back to pinId: '' for any
  // instance whose origin is within PIN_SNAP_TOLERANCE (15px) of the endpoint.
  // -------------------------------------------------------------------------

  it('logs a warning when a breadboard wire resolves to empty-string from.pinId (no partsMap)', () => {
    const inst1 = makeInstance({ id: 1, breadboardX: 100, breadboardY: 200 });
    const inst2 = makeInstance({ id: 2, breadboardX: 300, breadboardY: 200 });

    // Endpoints land exactly on instance origins — no partsMap => pinId: ''
    const wire = makeWire({
      id: 42,
      netId: 1,
      view: 'breadboard',
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

    const warningCalls = warnCallsContaining(consoleSpy, 'dropping wire');
    expect(warningCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('logs a warning when from.pinId is empty string', () => {
    const inst1 = makeInstance({ id: 1, breadboardX: 100, breadboardY: 200 });
    const inst2 = makeInstance({ id: 2, breadboardX: 300, breadboardY: 200 });

    const wire = makeWire({
      id: 43,
      netId: 1,
      view: 'breadboard',
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

    const warningCalls = warnCallsContaining(consoleSpy, 'dropping wire');
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

    const warningCalls = warnCallsContaining(consoleSpy, 'dropping wire');
    expect(warningCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('logs warning when to.pinId is empty string (no partsMap, both instances at origin)', () => {
    const inst1 = makeInstance({ id: 1, breadboardX: 100, breadboardY: 200 });
    const inst2 = makeInstance({ id: 2, partId: null, breadboardX: 300, breadboardY: 200 });

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
    // No partsMap — both endpoints get empty-string pinId via fallback branch
    syncSchematicToBreadboard([net], [wire], [inst1, inst2]);

    const warningCalls = warnCallsContaining(consoleSpy, 'dropping wire');
    expect(warningCalls.length).toBeGreaterThanOrEqual(1);
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

    // Collect all positional args from warn calls about dropping wires,
    // skipping the format string (args[0]) and joining the rest
    const allWarnText = warnCallsContaining(consoleSpy, 'dropping wire')
      .map((args: unknown[]) => args.slice(1).join(' '))
      .join(' ');

    expect(allWarnText).toContain(String(wireId));
  });

  it('warn message includes endpoint descriptors with instanceId', () => {
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

    const warningCalls = warnCallsContaining(consoleSpy, 'dropping wire');
    expect(warningCalls.length).toBeGreaterThanOrEqual(1);

    // The format string uses %s substitution: from=<instanceId>:<pinId>
    // Check that instanceId 1 appears in at least one arg of at least one call
    const hasInst1 = warningCalls.some((args: unknown[]) =>
      args.some((a: unknown) => String(a).includes('1:')),
    );
    expect(hasInst1).toBe(true);
  });

  it('does NOT log a dropping-wire warning when pinIds are valid non-empty strings', () => {
    const partId = 10;
    const part = makePartWithConnector(partId, 'A');
    const partsMap = new Map([[partId, part]]);

    const inst1 = makeInstance({ id: 1, partId, breadboardX: 100, breadboardY: 200 });
    const inst2 = makeInstance({ id: 2, partId, breadboardX: 300, breadboardY: 200 });

    // Wire endpoints land on connector 'A' of each instance (offset 0,0)
    const wire = makeWire({
      id: 45,
      netId: 1,
      view: 'breadboard',
      points: [
        { x: 100, y: 200 }, // inst1 + connector A (0,0) => (100,200)
        { x: 300, y: 200 }, // inst2 + connector A (0,0) => (300,200)
      ],
    });

    const net = makeNet({
      id: 1,
      segments: [{ fromInstanceId: 1, fromPin: 'A', toInstanceId: 2, toPin: 'A', waypoints: [] }],
    });

    syncSchematicToBreadboard([net], [wire], [inst1, inst2], partsMap);

    const warningCalls = warnCallsContaining(consoleSpy, 'dropping wire');
    expect(warningCalls).toHaveLength(0);
  });

  it('does NOT log a dropping-wire warning for wires that cannot be resolved at all (from/to null)', () => {
    // Wire with only 1 point — resolveWireEndpoints returns { from: null, to: null }.
    // The null guard at line 263 fires first; the empty-pinId guard must NOT fire.
    const wire = makeWire({
      id: 46,
      netId: 1,
      view: 'breadboard',
      points: [{ x: 100, y: 200 }], // only 1 point => both endpoints null
    });

    const net = makeNet({ id: 1 });
    syncSchematicToBreadboard([net], [wire], []);

    const warningCalls = warnCallsContaining(consoleSpy, 'dropping wire');
    expect(warningCalls).toHaveLength(0);
  });
});
