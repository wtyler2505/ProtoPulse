/**
 * BL-0544: Breadboard DRC engine tests.
 *
 * Tests for client/src/lib/circuit-editor/breadboard-drc.ts.
 * Runs in client project config (happy-dom environment).
 */

import { describe, it, expect } from 'vitest';
import {
  runBreadboardDrc,
  type BreadboardDrcViolation,
  type BreadboardDrcResult,
} from '../breadboard-drc';
import { coordToPixel } from '../breadboard-model';
import type { CircuitNetRow, CircuitWireRow, CircuitInstanceRow, ComponentPart } from '@shared/schema';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

let nextId = 1;

function makeNet(overrides: Partial<CircuitNetRow> & { id?: number; name?: string } = {}): CircuitNetRow {
  const id = overrides.id ?? nextId++;
  return {
    id,
    circuitId: 1,
    name: overrides.name ?? `NET_${id}`,
    netType: 'signal',
    voltage: null,
    busWidth: null,
    segments: overrides.segments ?? [],
    labels: [],
    style: {},
    createdAt: new Date(),
    ...overrides,
  } as unknown as CircuitNetRow;
}

function makeWire(overrides: Partial<CircuitWireRow> & { netId?: number; view?: string; points?: unknown[] } = {}): CircuitWireRow {
  const id = overrides.id ?? nextId++;
  return {
    id,
    circuitId: 1,
    netId: overrides.netId ?? 1,
    view: overrides.view ?? 'breadboard',
    points: overrides.points ?? [],
    layer: 'front',
    color: overrides.color ?? '#2ecc71',
    width: overrides.width ?? 1.5,
    wireType: overrides.wireType ?? 'wire',
    createdAt: new Date(),
    ...overrides,
  } as unknown as CircuitWireRow;
}

function makeInstance(overrides: Partial<CircuitInstanceRow> & {
  referenceDesignator?: string;
  breadboardX?: number | null;
  breadboardY?: number | null;
  partId?: number | null;
  properties?: unknown;
} = {}): CircuitInstanceRow {
  const id = overrides.id ?? nextId++;
  return {
    id,
    circuitId: 1,
    partId: overrides.partId ?? null,
    subDesignId: null,
    referenceDesignator: overrides.referenceDesignator ?? `R${id}`,
    schematicX: 0,
    schematicY: 0,
    schematicRotation: 0,
    breadboardX: overrides.breadboardX ?? null,
    breadboardY: overrides.breadboardY ?? null,
    breadboardRotation: 0,
    pcbX: null,
    pcbY: null,
    pcbRotation: 0,
    pcbSide: 'front',
    benchX: null,
    benchY: null,
    properties: overrides.properties ?? {},
    createdAt: new Date(),
    ...overrides,
  } as unknown as CircuitInstanceRow;
}

function makePart(overrides: Partial<ComponentPart> & {
  connectors?: unknown[];
  meta?: unknown;
} = {}): ComponentPart {
  const id = overrides.id ?? nextId++;
  return {
    id,
    projectId: 1,
    nodeId: null,
    connectors: overrides.connectors ?? [{ id: '1' }, { id: '2' }],
    buses: [],
    views: {},
    constraints: [],
    meta: overrides.meta ?? {},
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as ComponentPart;
}

/**
 * Get pixel position for a terminal tie-point.
 * Convenience wrapper for building wire points that land on grid.
 */
function terminalPixel(col: string, row: number): { x: number; y: number } {
  const px = coordToPixel({
    type: 'terminal',
    col: col as 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j',
    row,
  });
  return { x: px.x, y: px.y };
}

function railPixel(rail: 'top_pos' | 'top_neg' | 'bottom_pos' | 'bottom_neg', index: number): { x: number; y: number } {
  const px = coordToPixel({ type: 'rail', rail, index });
  return { x: px.x, y: px.y };
}

// Reset ID counter between describe blocks
function resetIds(): void {
  nextId = 1;
}

// ---------------------------------------------------------------------------
// Empty / no violations
// ---------------------------------------------------------------------------

describe('runBreadboardDrc — empty inputs', () => {
  it('returns no violations for empty inputs', () => {
    const result = runBreadboardDrc([], [], [], []);
    expect(result.violations).toHaveLength(0);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it('returns no violations when no wires exist', () => {
    resetIds();
    const nets = [makeNet({ name: 'VCC' })];
    const result = runBreadboardDrc(nets, [], [], []);
    expect(result.violations).toHaveLength(0);
  });

  it('ignores schematic-only wires', () => {
    resetIds();
    const nets = [makeNet({ id: 1, name: 'VCC' }), makeNet({ id: 2, name: 'GND' })];
    // Wire in schematic view — should be ignored
    const wires = [
      makeWire({ netId: 1, view: 'schematic', points: [terminalPixel('a', 1), terminalPixel('a', 5)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [], []);
    expect(result.violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Clean circuit — no violations
// ---------------------------------------------------------------------------

describe('runBreadboardDrc — clean circuit', () => {
  it('returns no violations for a properly wired circuit', () => {
    resetIds();
    const nets = [makeNet({ id: 1, name: 'VCC' }), makeNet({ id: 2, name: 'GND' })];
    // VCC on row 5 left group, GND on row 10 left group — separate rows, no conflict
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('a', 5), terminalPixel('c', 5)] }),
      makeWire({ netId: 2, view: 'breadboard', points: [terminalPixel('a', 10), terminalPixel('c', 10)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [], []);
    expect(result.violations).toHaveLength(0);
  });

  it('allows same net on multiple rows without violation', () => {
    resetIds();
    const nets = [makeNet({ id: 1, name: 'SIG1' })];
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('a', 1), terminalPixel('c', 1)] }),
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('a', 2), terminalPixel('c', 2)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [], []);
    expect(result.violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Short circuit detection
// ---------------------------------------------------------------------------

describe('runBreadboardDrc — short circuits', () => {
  it('detects short circuit when two nets share the same left-group row', () => {
    resetIds();
    const nets = [makeNet({ id: 1, name: 'VCC' }), makeNet({ id: 2, name: 'SIG1' })];
    // Both nets touch row 5, left side (a-e are connected)
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('a', 5), terminalPixel('b', 5)] }),
      makeWire({ netId: 2, view: 'breadboard', points: [terminalPixel('d', 5), terminalPixel('e', 5)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [], []);
    const shorts = result.violations.filter(v => v.type === 'short_circuit');
    expect(shorts.length).toBeGreaterThanOrEqual(1);
    expect(shorts[0].severity).toBe('error');
    expect(shorts[0].netIds).toBeDefined();
    expect(shorts[0].netIds!.length).toBe(2);
  });

  it('detects short circuit when two nets share the same right-group row', () => {
    resetIds();
    const nets = [makeNet({ id: 1, name: 'A' }), makeNet({ id: 2, name: 'B' })];
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('f', 10), terminalPixel('g', 10)] }),
      makeWire({ netId: 2, view: 'breadboard', points: [terminalPixel('i', 10), terminalPixel('j', 10)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [], []);
    const shorts = result.violations.filter(v => v.type === 'short_circuit');
    expect(shorts.length).toBeGreaterThanOrEqual(1);
  });

  it('does not flag two nets on different sides of the same row as short', () => {
    resetIds();
    const nets = [makeNet({ id: 1, name: 'A' }), makeNet({ id: 2, name: 'B' })];
    // Net 1 on left side (a), Net 2 on right side (f) — same row but different groups
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('a', 5), terminalPixel('b', 5)] }),
      makeWire({ netId: 2, view: 'breadboard', points: [terminalPixel('f', 5), terminalPixel('g', 5)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [], []);
    const shorts = result.violations.filter(v => v.type === 'short_circuit');
    expect(shorts).toHaveLength(0);
  });

  it('short circuit message includes net names', () => {
    resetIds();
    const nets = [makeNet({ id: 1, name: 'VCC' }), makeNet({ id: 2, name: 'GND' })];
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('a', 3)] }),
      makeWire({ netId: 2, view: 'breadboard', points: [terminalPixel('c', 3)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [], []);
    const shorts = result.violations.filter(v => v.type === 'short_circuit');
    expect(shorts.length).toBeGreaterThanOrEqual(1);
    expect(shorts[0].message).toContain('VCC');
    expect(shorts[0].message).toContain('GND');
  });
});

// ---------------------------------------------------------------------------
// Bus conflict detection
// ---------------------------------------------------------------------------

describe('runBreadboardDrc — bus conflicts', () => {
  it('detects bus conflict when 3+ nets share a row', () => {
    resetIds();
    const nets = [
      makeNet({ id: 1, name: 'A' }),
      makeNet({ id: 2, name: 'B' }),
      makeNet({ id: 3, name: 'C' }),
    ];
    // All three nets on left row 7
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('a', 7)] }),
      makeWire({ netId: 2, view: 'breadboard', points: [terminalPixel('b', 7)] }),
      makeWire({ netId: 3, view: 'breadboard', points: [terminalPixel('c', 7)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [], []);
    const busConflicts = result.violations.filter(v => v.type === 'bus_conflict');
    expect(busConflicts.length).toBeGreaterThanOrEqual(1);
    expect(busConflicts[0].severity).toBe('error');
    expect(busConflicts[0].netIds!.length).toBe(3);
  });

  it('bus conflict implies short circuit (both reported)', () => {
    resetIds();
    const nets = [
      makeNet({ id: 1, name: 'X' }),
      makeNet({ id: 2, name: 'Y' }),
      makeNet({ id: 3, name: 'Z' }),
    ];
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('a', 20)] }),
      makeWire({ netId: 2, view: 'breadboard', points: [terminalPixel('b', 20)] }),
      makeWire({ netId: 3, view: 'breadboard', points: [terminalPixel('c', 20)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [], []);
    const shorts = result.violations.filter(v => v.type === 'short_circuit');
    const busConflicts = result.violations.filter(v => v.type === 'bus_conflict');
    // Both short circuit and bus conflict should be reported
    expect(shorts.length).toBeGreaterThanOrEqual(1);
    expect(busConflicts.length).toBeGreaterThanOrEqual(1);
  });

  it('two nets on a row is a short but not a bus conflict', () => {
    resetIds();
    const nets = [makeNet({ id: 1, name: 'P' }), makeNet({ id: 2, name: 'Q' })];
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('a', 15)] }),
      makeWire({ netId: 2, view: 'breadboard', points: [terminalPixel('b', 15)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [], []);
    const shorts = result.violations.filter(v => v.type === 'short_circuit');
    const busConflicts = result.violations.filter(v => v.type === 'bus_conflict');
    expect(shorts.length).toBeGreaterThanOrEqual(1);
    expect(busConflicts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Power rail polarity
// ---------------------------------------------------------------------------

describe('runBreadboardDrc — power rail polarity', () => {
  it('flags power net on negative rail', () => {
    resetIds();
    const nets = [makeNet({ id: 1, name: 'VCC' })];
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [railPixel('top_neg', 5)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [], []);
    const polarity = result.violations.filter(v => v.type === 'power_rail_polarity');
    expect(polarity.length).toBe(1);
    expect(polarity[0].severity).toBe('error');
    expect(polarity[0].message).toContain('VCC');
    expect(polarity[0].message).toContain('negative');
  });

  it('flags ground net on positive rail', () => {
    resetIds();
    const nets = [makeNet({ id: 1, name: 'GND' })];
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [railPixel('top_pos', 3)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [], []);
    const polarity = result.violations.filter(v => v.type === 'power_rail_polarity');
    expect(polarity.length).toBe(1);
    expect(polarity[0].message).toContain('GND');
    expect(polarity[0].message).toContain('positive');
  });

  it('allows VCC on positive rail without violation', () => {
    resetIds();
    const nets = [makeNet({ id: 1, name: 'VCC' })];
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [railPixel('top_pos', 5)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [], []);
    const polarity = result.violations.filter(v => v.type === 'power_rail_polarity');
    expect(polarity).toHaveLength(0);
  });

  it('allows GND on negative rail without violation', () => {
    resetIds();
    const nets = [makeNet({ id: 1, name: 'GND' })];
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [railPixel('bottom_neg', 10)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [], []);
    const polarity = result.violations.filter(v => v.type === 'power_rail_polarity');
    expect(polarity).toHaveLength(0);
  });

  it('allows signal net on any rail without violation', () => {
    resetIds();
    const nets = [makeNet({ id: 1, name: 'SIG1' })];
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [railPixel('top_pos', 0)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [], []);
    const polarity = result.violations.filter(v => v.type === 'power_rail_polarity');
    expect(polarity).toHaveLength(0);
  });

  it('detects polarity error for 5V on bottom_neg rail', () => {
    resetIds();
    const nets = [makeNet({ id: 1, name: '5V' })];
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [railPixel('bottom_neg', 20)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [], []);
    const polarity = result.violations.filter(v => v.type === 'power_rail_polarity');
    expect(polarity.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Floating components
// ---------------------------------------------------------------------------

describe('runBreadboardDrc — floating components', () => {
  it('flags a placed component with no net connections as floating', () => {
    resetIds();
    const px = terminalPixel('a', 5);
    const inst = makeInstance({
      referenceDesignator: 'R1',
      breadboardX: px.x,
      breadboardY: px.y,
      properties: { type: 'resistor' },
    });
    // No wires at all — component is floating
    const result = runBreadboardDrc([], [], [inst], []);
    const floating = result.violations.filter(v => v.type === 'floating_component');
    expect(floating.length).toBe(1);
    expect(floating[0].severity).toBe('warning');
    expect(floating[0].message).toContain('R1');
    expect(floating[0].instanceId).toBe(inst.id);
  });

  it('does not flag a component that has net connections', () => {
    resetIds();
    const px = terminalPixel('a', 5);
    const inst = makeInstance({
      referenceDesignator: 'R1',
      breadboardX: px.x,
      breadboardY: px.y,
      properties: { type: 'resistor' },
    });
    const nets = [makeNet({ id: 1, name: 'SIG1' })];
    // Wire touches same row left side — component is connected
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('b', 5), terminalPixel('c', 5)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [inst], []);
    const floating = result.violations.filter(v => v.type === 'floating_component');
    expect(floating).toHaveLength(0);
  });

  it('does not flag instance without breadboard placement', () => {
    resetIds();
    // Instance with no breadboard coordinates — not placed
    const inst = makeInstance({
      referenceDesignator: 'R1',
      breadboardX: null,
      breadboardY: null,
    });
    const result = runBreadboardDrc([], [], [inst], []);
    expect(result.violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Unconnected pins
// ---------------------------------------------------------------------------

describe('runBreadboardDrc — unconnected pins', () => {
  it('flags unconnected pins when component is partially connected', () => {
    resetIds();
    const px = terminalPixel('c', 10);
    // 4-pin component: connectors span 2 rows (rows 10, 11)
    const part = makePart({
      connectors: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }] as unknown[],
      meta: { type: 'connector' },
    });
    const inst = makeInstance({
      referenceDesignator: 'J1',
      breadboardX: px.x,
      breadboardY: px.y,
      partId: part.id,
      properties: { type: 'connector' },
    });
    const nets = [makeNet({ id: 1, name: 'SIG1' })];
    // Wire on row 10 only — row 11 (second pin row) is unconnected
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('a', 10), terminalPixel('b', 10)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [inst], [part]);
    const unconnected = result.violations.filter(v => v.type === 'unconnected_pin');
    expect(unconnected.length).toBeGreaterThanOrEqual(1);
    expect(unconnected[0].severity).toBe('warning');
    expect(unconnected[0].message).toContain('J1');
    expect(unconnected[0].instanceId).toBe(inst.id);
  });

  it('does not flag unconnected pins when all pins are wired', () => {
    resetIds();
    const px = terminalPixel('c', 10);
    const inst = makeInstance({
      referenceDesignator: 'R1',
      breadboardX: px.x,
      breadboardY: px.y,
      properties: { type: 'resistor' },
    });
    const nets = [makeNet({ id: 1, name: 'SIG1' }), makeNet({ id: 2, name: 'SIG2' })];
    // Wires on both row 10 and row 11 (both pins of 2-pin component)
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('a', 10), terminalPixel('b', 10)] }),
      makeWire({ netId: 2, view: 'breadboard', points: [terminalPixel('a', 11), terminalPixel('b', 11)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [inst], []);
    const unconnected = result.violations.filter(v => v.type === 'unconnected_pin');
    expect(unconnected).toHaveLength(0);
  });

  it('DIP IC with partially connected pins reports unconnected', () => {
    resetIds();
    const px = terminalPixel('e', 5);
    const part = makePart({
      connectors: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }, { id: '6' }, { id: '7' }, { id: '8' }] as unknown[],
      meta: { type: 'ic' },
    });
    const inst = makeInstance({
      referenceDesignator: 'U1',
      breadboardX: px.x,
      breadboardY: px.y,
      partId: part.id,
      properties: { type: 'ic' },
    });
    const nets = [makeNet({ id: 1, name: 'SIG1' })];
    // Only wire on row 5 left side — IC has 4 rows of pins
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('a', 5), terminalPixel('d', 5)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [inst], [part]);
    const unconnected = result.violations.filter(v => v.type === 'unconnected_pin');
    // At least some pins should be flagged
    expect(unconnected.length).toBeGreaterThan(0);
    // All unconnected pins reference the IC instance
    for (const v of unconnected) {
      expect(v.instanceId).toBe(inst.id);
    }
  });
});

// ---------------------------------------------------------------------------
// Result counts
// ---------------------------------------------------------------------------

describe('runBreadboardDrc — result counts', () => {
  it('errorCount matches number of error violations', () => {
    resetIds();
    const nets = [makeNet({ id: 1, name: 'VCC' }), makeNet({ id: 2, name: 'GND' })];
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('a', 5)] }),
      makeWire({ netId: 2, view: 'breadboard', points: [terminalPixel('c', 5)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [], []);
    const errors = result.violations.filter(v => v.severity === 'error');
    expect(result.errorCount).toBe(errors.length);
    expect(result.errorCount).toBeGreaterThan(0);
  });

  it('warningCount matches number of warning violations', () => {
    resetIds();
    const px = terminalPixel('a', 5);
    const inst = makeInstance({
      referenceDesignator: 'R1',
      breadboardX: px.x,
      breadboardY: px.y,
      properties: { type: 'resistor' },
    });
    const result = runBreadboardDrc([], [], [inst], []);
    const warnings = result.violations.filter(v => v.severity === 'warning');
    expect(result.warningCount).toBe(warnings.length);
    expect(result.warningCount).toBeGreaterThan(0);
  });

  it('violations array is returned (always defined)', () => {
    const result = runBreadboardDrc([], [], [], []);
    expect(Array.isArray(result.violations)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Violation structure
// ---------------------------------------------------------------------------

describe('runBreadboardDrc — violation structure', () => {
  it('each violation has type, severity, message, coord, pixel', () => {
    resetIds();
    const nets = [makeNet({ id: 1, name: 'VCC' }), makeNet({ id: 2, name: 'GND' })];
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('a', 5)] }),
      makeWire({ netId: 2, view: 'breadboard', points: [terminalPixel('c', 5)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [], []);
    for (const v of result.violations) {
      expect(v.type).toBeDefined();
      expect(v.severity).toBeDefined();
      expect(typeof v.message).toBe('string');
      expect(v.message.length).toBeGreaterThan(0);
      expect(v.coord).toBeDefined();
      expect(typeof v.pixel.x).toBe('number');
      expect(typeof v.pixel.y).toBe('number');
    }
  });

  it('severity is either error or warning', () => {
    resetIds();
    const px = terminalPixel('a', 5);
    const inst = makeInstance({
      referenceDesignator: 'R1',
      breadboardX: px.x,
      breadboardY: px.y,
      properties: { type: 'resistor' },
    });
    const nets = [makeNet({ id: 1, name: 'VCC' }), makeNet({ id: 2, name: 'GND' })];
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('a', 5)] }),
      makeWire({ netId: 2, view: 'breadboard', points: [terminalPixel('c', 5)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [inst], []);
    for (const v of result.violations) {
      expect(['error', 'warning']).toContain(v.severity);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('runBreadboardDrc — edge cases', () => {
  it('handles wire with empty points array', () => {
    resetIds();
    const nets = [makeNet({ id: 1, name: 'A' })];
    const wires = [makeWire({ netId: 1, view: 'breadboard', points: [] })];
    const result = runBreadboardDrc(nets, wires, [], []);
    expect(result.violations).toHaveLength(0);
  });

  it('handles wire with single point', () => {
    resetIds();
    const nets = [makeNet({ id: 1, name: 'A' })];
    const wires = [makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('a', 1)] })];
    const result = runBreadboardDrc(nets, wires, [], []);
    // Single net, single point — no short circuit
    const shorts = result.violations.filter(v => v.type === 'short_circuit');
    expect(shorts).toHaveLength(0);
  });

  it('handles multiple instances at different locations without false positives', () => {
    resetIds();
    const px1 = terminalPixel('a', 5);
    const px2 = terminalPixel('a', 20);
    const inst1 = makeInstance({ referenceDesignator: 'R1', breadboardX: px1.x, breadboardY: px1.y, properties: { type: 'resistor' } });
    const inst2 = makeInstance({ referenceDesignator: 'R2', breadboardX: px2.x, breadboardY: px2.y, properties: { type: 'resistor' } });
    const nets = [makeNet({ id: 1, name: 'SIG1' }), makeNet({ id: 2, name: 'SIG2' })];
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('b', 5), terminalPixel('b', 6)] }),
      makeWire({ netId: 2, view: 'breadboard', points: [terminalPixel('b', 20), terminalPixel('b', 21)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [inst1, inst2], []);
    // No short circuits (different rows, different nets)
    const shorts = result.violations.filter(v => v.type === 'short_circuit');
    expect(shorts).toHaveLength(0);
  });

  it('does not produce duplicate violations for same group', () => {
    resetIds();
    const nets = [makeNet({ id: 1, name: 'A' }), makeNet({ id: 2, name: 'B' })];
    // Multiple wire points on the same row, same group — only one short circuit violation
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('a', 5), terminalPixel('b', 5), terminalPixel('c', 5)] }),
      makeWire({ netId: 2, view: 'breadboard', points: [terminalPixel('d', 5), terminalPixel('e', 5)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [], []);
    const shorts = result.violations.filter(v => v.type === 'short_circuit');
    // Should be exactly 1 (one group has the conflict)
    expect(shorts).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// DIP pin column derivation (audit #361)
// ---------------------------------------------------------------------------

describe('runBreadboardDrc — DIP pin column derivation', () => {
  it('DIP-16 at e/f (standard channel straddle) produces 16 pin positions, 8 per side', () => {
    resetIds();
    // DIP-16: 16 pins, 8 per side, placed at col 'e' → crosses channel → 'e'+'f' for 8 rows
    const px = terminalPixel('e', 5);
    const part = makePart({
      connectors: Array.from({ length: 16 }, (_, i) => ({ id: String(i + 1) })) as unknown[],
      meta: { type: 'ic' },
    });
    const inst = makeInstance({
      referenceDesignator: 'U1',
      breadboardX: px.x,
      breadboardY: px.y,
      partId: part.id,
      properties: { type: 'ic' },
    });
    const nets = [makeNet({ id: 1, name: 'VCC' })];
    // Wire all 8 left-side rows (col e, rows 5-12) and all 8 right-side rows (col f, rows 5-12)
    const wires = [
      // Left side — col 'e' is in the left group (a-e)
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('e', 5), terminalPixel('e', 6)] }),
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('e', 7), terminalPixel('e', 8)] }),
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('e', 9), terminalPixel('e', 10)] }),
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('e', 11), terminalPixel('e', 12)] }),
      // Right side — col 'f' is in the right group (f-j)
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('f', 5), terminalPixel('f', 6)] }),
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('f', 7), terminalPixel('f', 8)] }),
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('f', 9), terminalPixel('f', 10)] }),
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('f', 11), terminalPixel('f', 12)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [inst], [part]);
    // All 16 pins are connected — no floating or unconnected violations for U1
    const floating = result.violations.filter(v => v.type === 'floating_component' && v.instanceId === inst.id);
    const unconnected = result.violations.filter(v => v.type === 'unconnected_pin' && v.instanceId === inst.id);
    expect(floating).toHaveLength(0);
    expect(unconnected).toHaveLength(0);
  });

  it('DIP-14 at startCol c (non-channel-crossing) produces pin positions on left side only, no crash', () => {
    resetIds();
    // DIP placed at col 'c' — does not cross the channel, sits on left side
    // With colSpan=2, pins occupy cols c+d for each of the 7 rows (14 pins total)
    const px = terminalPixel('c', 1);
    const part = makePart({
      connectors: Array.from({ length: 14 }, (_, i) => ({ id: String(i + 1) })) as unknown[],
      meta: { type: 'ic' },
    });
    const inst = makeInstance({
      referenceDesignator: 'U2',
      breadboardX: px.x,
      breadboardY: px.y,
      partId: part.id,
      properties: { type: 'ic' },
    });
    // No wires — all pins unconnected, but it should not crash
    const result = runBreadboardDrc([], [], [inst], [part]);
    // Component should be flagged as floating (no nets connected)
    const floating = result.violations.filter(v => v.type === 'floating_component' && v.instanceId === inst.id);
    expect(floating).toHaveLength(1);
    // No crash — result is always defined
    expect(Array.isArray(result.violations)).toBe(true);
  });

  it('DIP at startCol b (non-standard col) does not crash and is reported as floating', () => {
    resetIds();
    const px = terminalPixel('b', 3);
    const part = makePart({
      connectors: Array.from({ length: 8 }, (_, i) => ({ id: String(i + 1) })) as unknown[],
      meta: { type: 'mcu' },
    });
    const inst = makeInstance({
      referenceDesignator: 'U3',
      breadboardX: px.x,
      breadboardY: px.y,
      partId: part.id,
      properties: { type: 'mcu' },
    });
    const result = runBreadboardDrc([], [], [inst], [part]);
    // Must not throw; component is floating (no wires)
    expect(() => result).not.toThrow();
    const floating = result.violations.filter(v => v.type === 'floating_component' && v.instanceId === inst.id);
    expect(floating).toHaveLength(1);
  });

  it('non-e/f DIP-14 reports unconnected_pin violations (not just floating) when partially wired', () => {
    resetIds();
    const px = terminalPixel('c', 1);
    const part = makePart({
      connectors: Array.from({ length: 14 }, (_, i) => ({ id: String(i + 1) })) as unknown[],
      meta: { type: 'ic' },
    });
    const inst = makeInstance({
      referenceDesignator: 'U4',
      breadboardX: px.x,
      breadboardY: px.y,
      partId: part.id,
      properties: { type: 'ic' },
    });
    const nets = [makeNet({ id: 1, name: 'SIG1' })];
    // Wire only col c, row 1 — one pin connected out of 14
    const wires = [
      makeWire({ netId: 1, view: 'breadboard', points: [terminalPixel('a', 1), terminalPixel('c', 1)] }),
    ];
    const result = runBreadboardDrc(nets, wires, [inst], [part]);
    // At least some unconnected_pin violations for U4 (not all 14 pins are wired)
    const unconnected = result.violations.filter(v => v.type === 'unconnected_pin' && v.instanceId === inst.id);
    expect(unconnected.length).toBeGreaterThan(0);
    // Not reported as floating because at least one pin has a net
    const floating = result.violations.filter(v => v.type === 'floating_component' && v.instanceId === inst.id);
    expect(floating).toHaveLength(0);
  });
});
