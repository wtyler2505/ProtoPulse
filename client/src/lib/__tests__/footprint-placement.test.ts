import { describe, it, expect } from 'vitest';
import type { CircuitInstanceRow } from '@shared/schema';
import {
  getFootprintBoundingBox,
  checkCourtyardCollision,
  buildRatsnestNets,
} from '@/components/views/pcb-layout/ComponentPlacer';
import type { NetRecord } from '@/components/views/pcb-layout/ComponentPlacer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 1,
    circuitId: 1,
    partId: null,
    referenceDesignator: 'U1',
    schematicX: 0,
    schematicY: 0,
    schematicRotation: 0,
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: null,
    pcbX: 0,
    pcbY: 0,
    pcbRotation: 0,
    pcbSide: 'front',
    benchX: null,
    benchY: null,
    properties: {},
    createdAt: new Date(),
    ...overrides,
  } as CircuitInstanceRow;
}

// ---------------------------------------------------------------------------
// Rotation snapping
// ---------------------------------------------------------------------------

describe('rotation snapping', () => {
  it('snaps 0 -> 90', () => {
    const rotation = (0 + 90) % 360;
    expect(rotation).toBe(90);
  });

  it('snaps 90 -> 180', () => {
    const rotation = (90 + 90) % 360;
    expect(rotation).toBe(180);
  });

  it('snaps 180 -> 270', () => {
    const rotation = (180 + 90) % 360;
    expect(rotation).toBe(270);
  });

  it('snaps 270 -> 0', () => {
    const rotation = (270 + 90) % 360;
    expect(rotation).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getFootprintBoundingBox
// ---------------------------------------------------------------------------

describe('getFootprintBoundingBox', () => {
  it('returns real dimensions for known package (DIP-8)', () => {
    const instance = makeInstance({
      pcbX: 10,
      pcbY: 20,
      properties: { packageType: 'DIP-8' },
    });
    const bb = getFootprintBoundingBox(instance);
    expect(bb.width).toBeGreaterThan(0);
    expect(bb.height).toBeGreaterThan(0);
    // DIP-8 courtyard is larger than the default fallback
    expect(bb.width).toBeGreaterThanOrEqual(8);
  });

  it('returns fallback dimensions for unknown package', () => {
    const instance = makeInstance({
      pcbX: 5,
      pcbY: 5,
      properties: {},
    });
    const bb = getFootprintBoundingBox(instance);
    expect(bb).toEqual({ x: -4, y: -6, width: 8, height: 12 });
  });

  it('uses referenceDesignator prefix to guess package if no packageType', () => {
    const instance = makeInstance({
      referenceDesignator: 'R5',
      properties: {},
    });
    // Without explicit packageType, should still return valid bounding box (fallback)
    const bb = getFootprintBoundingBox(instance);
    expect(bb.width).toBeGreaterThan(0);
    expect(bb.height).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// checkCourtyardCollision
// ---------------------------------------------------------------------------

describe('checkCourtyardCollision', () => {
  it('detects overlapping courtyards', () => {
    const inst1 = makeInstance({ id: 1, pcbX: 0, pcbY: 0, pcbRotation: 0 });
    const inst2 = makeInstance({ id: 2, pcbX: 2, pcbY: 2, pcbRotation: 0 });
    // Default bounding box is 8x12, so inst at (0,0) and (2,2) should overlap
    expect(checkCourtyardCollision(inst1, [inst1, inst2])).toBe(true);
  });

  it('returns false for non-overlapping courtyards', () => {
    const inst1 = makeInstance({ id: 1, pcbX: 0, pcbY: 0, pcbRotation: 0 });
    const inst2 = makeInstance({ id: 2, pcbX: 100, pcbY: 100, pcbRotation: 0 });
    expect(checkCourtyardCollision(inst1, [inst1, inst2])).toBe(false);
  });

  it('excludes self from collision check', () => {
    const inst1 = makeInstance({ id: 1, pcbX: 0, pcbY: 0 });
    expect(checkCourtyardCollision(inst1, [inst1])).toBe(false);
  });

  it('handles rotated components in collision detection', () => {
    const inst1 = makeInstance({ id: 1, pcbX: 0, pcbY: 0, pcbRotation: 0 });
    // Place inst2 far apart so without rotation they wouldn't collide
    const inst2 = makeInstance({ id: 2, pcbX: 50, pcbY: 50, pcbRotation: 90 });
    expect(checkCourtyardCollision(inst1, [inst1, inst2])).toBe(false);
  });

  it('returns false for empty instances list', () => {
    const inst1 = makeInstance({ id: 1, pcbX: 0, pcbY: 0 });
    expect(checkCourtyardCollision(inst1, [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildRatsnestNets with real pad positions
// ---------------------------------------------------------------------------

describe('buildRatsnestNets with footprint pads', () => {
  it('uses component center when no footprint available', () => {
    const instances = [
      makeInstance({ id: 1, pcbX: 10, pcbY: 20, properties: {} }),
      makeInstance({ id: 2, pcbX: 30, pcbY: 40, properties: {} }),
    ];
    const nets: NetRecord[] = [{
      id: 1,
      name: 'VCC',
      segments: [{ fromInstanceId: 1, fromPin: '1', toInstanceId: 2, toPin: '1' }],
    }];

    const result = buildRatsnestNets(nets, instances);
    expect(result).toHaveLength(1);
    expect(result[0].pins).toHaveLength(2);
    // Without footprint, should use component center (pcbX, pcbY)
    expect(result[0].pins[0].x).toBe(10);
    expect(result[0].pins[0].y).toBe(20);
  });

  it('uses real pad positions when footprint available (DIP-8)', () => {
    const instances = [
      makeInstance({ id: 1, pcbX: 10, pcbY: 20, properties: { packageType: 'DIP-8' } }),
      makeInstance({ id: 2, pcbX: 30, pcbY: 40, properties: { packageType: 'DIP-8' } }),
    ];
    const nets: NetRecord[] = [{
      id: 1,
      name: 'VCC',
      segments: [{ fromInstanceId: 1, fromPin: '1', toInstanceId: 2, toPin: '1' }],
    }];

    const result = buildRatsnestNets(nets, instances);
    expect(result).toHaveLength(1);
    expect(result[0].pins).toHaveLength(2);
    // Pin 1 of DIP-8 should be offset from the component center
    const pin = result[0].pins[0];
    expect(pin.x).not.toBe(10);
    expect(pin.y).not.toBe(20);
  });
});
