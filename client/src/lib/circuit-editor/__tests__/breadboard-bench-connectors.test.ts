/**
 * Unit tests for getBenchConnectorAnchorPositions (audit finding #342).
 * Pure function: anchor position calculation with optional part + rotation.
 */

import { describe, it, expect } from 'vitest';

import { getBenchConnectorAnchorPositions } from '../breadboard-bench-connectors';
import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';

function makeInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 1,
    circuitId: 1,
    partId: 10,
    referenceDesignator: 'U1',
    designator: 'U1',
    instanceName: 'U1',
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: 0,
    benchX: 100,
    benchY: 200,
    schematicX: 0,
    schematicY: 0,
    schematicRotation: 0,
    rotation: 0,
    value: null,
    params: {},
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as CircuitInstanceRow;
}

function makePart(connectorCount: number): ComponentPart {
  return {
    id: 10,
    name: 'Test Part',
    partNumber: 'TP-1',
    manufacturer: 'ACME',
    family: 'ic',
    category: 'ic',
    pinCount: connectorCount,
    meta: {},
    views: {},
    connectors: Array.from({ length: connectorCount }, (_, i) => ({
      id: `pin${i + 1}`,
      name: `Pin ${i + 1}`,
      terminalPositions: {
        breadboard: { x: i * 10, y: 0 },
        schematic: { x: 0, y: 0 },
      },
    })),
  } as unknown as ComponentPart;
}

describe('getBenchConnectorAnchorPositions', () => {
  it('returns empty array when benchX/Y are null', () => {
    const instance = makeInstance({ benchX: null, benchY: null });
    expect(getBenchConnectorAnchorPositions(instance)).toEqual([]);
  });

  it('returns empty array when no part supplied (no connectors source)', () => {
    const instance = makeInstance();
    expect(getBenchConnectorAnchorPositions(instance)).toEqual([]);
  });

  it('produces one anchor per connector with breadboard terminal', () => {
    const part = makePart(4);
    const instance = makeInstance();
    const anchors = getBenchConnectorAnchorPositions(instance, part);
    expect(anchors).toHaveLength(4);
    expect(anchors[0]).toMatchObject({
      instanceId: 1,
      connectorId: 'pin1',
      pinId: 'pin1',
    });
  });

  it('applies instance bench position as anchor origin (no rotation)', () => {
    const part = makePart(1);
    const instance = makeInstance({ benchX: 500, benchY: 300, breadboardRotation: 0 });
    const [anchor] = getBenchConnectorAnchorPositions(instance, part);
    // With no exact bounds and index 0: localPoint = { x: -28, y: -10 + 0 }
    expect(anchor.x).toBe(500 + -28);
    expect(anchor.y).toBe(300 + -10);
  });

  it('rotates local point by breadboardRotation (90 deg)', () => {
    const part = makePart(1);
    const instance = makeInstance({ benchX: 0, benchY: 0, breadboardRotation: 90 });
    const [anchor] = getBenchConnectorAnchorPositions(instance, part);
    // localPoint (-28, -10) rotated 90deg -> approx (10, -28) but math uses radians
    // cos(pi/2)≈0, sin(pi/2)≈1 => x = -28*0 - (-10)*1 = 10; y = -28*1 + -10*0 = -28
    expect(anchor.x).toBeCloseTo(10, 5);
    expect(anchor.y).toBeCloseTo(-28, 5);
  });
});
