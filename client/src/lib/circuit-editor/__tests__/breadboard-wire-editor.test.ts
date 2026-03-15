import { describe, it, expect } from 'vitest';
import {
  selectWireAtPoint,
  deleteWire,
  moveWireEndpoint,
  getWireHitBox,
  getWireEndpoints,
  hitTestEndpoint,
  type BreadboardWire,
} from '../breadboard-wire-editor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWire(
  id: number,
  points: Array<{ x: number; y: number }>,
  overrides?: Partial<BreadboardWire>,
): BreadboardWire {
  return {
    id,
    points,
    width: 1.5,
    color: '#2ecc71',
    view: 'breadboard',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getWireHitBox
// ---------------------------------------------------------------------------

describe('getWireHitBox', () => {
  it('returns a zero-area box for a wire with no points', () => {
    const wire = makeWire(1, []);
    const box = getWireHitBox(wire);
    expect(box.minX).toBe(0);
    expect(box.minY).toBe(0);
    expect(box.maxX).toBe(0);
    expect(box.maxY).toBe(0);
  });

  it('returns an expanded bounding box around a single-segment wire', () => {
    const wire = makeWire(1, [{ x: 10, y: 20 }, { x: 50, y: 20 }]);
    const box = getWireHitBox(wire);
    expect(box.minX).toBeLessThan(10);
    expect(box.maxX).toBeGreaterThan(50);
    expect(box.minY).toBeLessThan(20);
    expect(box.maxY).toBeGreaterThan(20);
  });

  it('accounts for wire width', () => {
    const thin = makeWire(1, [{ x: 0, y: 0 }, { x: 100, y: 0 }], { width: 1 });
    const thick = makeWire(2, [{ x: 0, y: 0 }, { x: 100, y: 0 }], { width: 10 });
    const thinBox = getWireHitBox(thin);
    const thickBox = getWireHitBox(thick);
    // Thick wire should have a larger vertical extent
    expect(thickBox.maxY - thickBox.minY).toBeGreaterThan(thinBox.maxY - thinBox.minY);
  });

  it('spans all waypoints in a multi-point wire', () => {
    const wire = makeWire(1, [
      { x: 10, y: 10 },
      { x: 50, y: 10 },
      { x: 50, y: 80 },
    ]);
    const box = getWireHitBox(wire);
    expect(box.minX).toBeLessThan(10);
    expect(box.maxX).toBeGreaterThan(50);
    expect(box.minY).toBeLessThan(10);
    expect(box.maxY).toBeGreaterThan(80);
  });
});

// ---------------------------------------------------------------------------
// selectWireAtPoint
// ---------------------------------------------------------------------------

describe('selectWireAtPoint', () => {
  it('returns null for an empty wire list', () => {
    expect(selectWireAtPoint(10, 10, [])).toBeNull();
  });

  it('selects a wire when clicking directly on it', () => {
    const wire = makeWire(1, [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    const result = selectWireAtPoint(50, 0, [wire]);
    expect(result).not.toBeNull();
    expect(result!.wire.id).toBe(1);
  });

  it('selects a wire when clicking within hit radius', () => {
    const wire = makeWire(1, [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    // 2px above the wire — within the MIN_HIT_RADIUS of 3
    const result = selectWireAtPoint(50, 2, [wire]);
    expect(result).not.toBeNull();
    expect(result!.wire.id).toBe(1);
  });

  it('returns null when clicking far from any wire', () => {
    const wire = makeWire(1, [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    const result = selectWireAtPoint(50, 50, [wire]);
    expect(result).toBeNull();
  });

  it('selects the closest wire when multiple overlap', () => {
    const wire1 = makeWire(1, [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    const wire2 = makeWire(2, [{ x: 0, y: 2 }, { x: 100, y: 2 }]);
    // Click at y=1 — closer to wire1 (1px away) than wire2 (1px away but wire2 is at y=2)
    const result = selectWireAtPoint(50, 0.5, [wire1, wire2]);
    expect(result).not.toBeNull();
    expect(result!.wire.id).toBe(1);
  });

  it('ignores wires not in breadboard view', () => {
    const wire = makeWire(1, [{ x: 0, y: 0 }, { x: 100, y: 0 }], { view: 'schematic' });
    const result = selectWireAtPoint(50, 0, [wire]);
    expect(result).toBeNull();
  });

  it('ignores wires with fewer than 2 points', () => {
    const wire = makeWire(1, [{ x: 50, y: 50 }]);
    const result = selectWireAtPoint(50, 50, [wire]);
    expect(result).toBeNull();
  });

  it('returns the correct segment index for multi-segment wires', () => {
    const wire = makeWire(1, [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
    ]);
    // Click near the second segment (x=50, y=25)
    const result = selectWireAtPoint(50, 25, [wire]);
    expect(result).not.toBeNull();
    expect(result!.segmentIndex).toBe(1);
  });

  it('hits a diagonal wire segment', () => {
    const wire = makeWire(1, [{ x: 0, y: 0 }, { x: 100, y: 100 }]);
    // Point on the diagonal: (50, 50)
    const result = selectWireAtPoint(50, 50, [wire]);
    expect(result).not.toBeNull();
    expect(result!.wire.id).toBe(1);
  });

  it('returns distance in the result', () => {
    const wire = makeWire(1, [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    const result = selectWireAtPoint(50, 2, [wire]);
    expect(result).not.toBeNull();
    expect(result!.distance).toBeCloseTo(2, 1);
  });
});

// ---------------------------------------------------------------------------
// deleteWire
// ---------------------------------------------------------------------------

describe('deleteWire', () => {
  it('removes the wire with the given ID', () => {
    const wires = [
      makeWire(1, [{ x: 0, y: 0 }, { x: 10, y: 10 }]),
      makeWire(2, [{ x: 0, y: 0 }, { x: 20, y: 20 }]),
      makeWire(3, [{ x: 0, y: 0 }, { x: 30, y: 30 }]),
    ];
    const result = deleteWire(2, wires);
    expect(result).toHaveLength(2);
    expect(result.map(w => w.id)).toEqual([1, 3]);
  });

  it('returns a copy if no wire matches', () => {
    const wires = [makeWire(1, [{ x: 0, y: 0 }, { x: 10, y: 10 }])];
    const result = deleteWire(999, wires);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('returns an empty array when deleting the last wire', () => {
    const wires = [makeWire(1, [{ x: 0, y: 0 }, { x: 10, y: 10 }])];
    const result = deleteWire(1, wires);
    expect(result).toHaveLength(0);
  });

  it('does not mutate the original array', () => {
    const wires = [
      makeWire(1, [{ x: 0, y: 0 }, { x: 10, y: 10 }]),
      makeWire(2, [{ x: 0, y: 0 }, { x: 20, y: 20 }]),
    ];
    deleteWire(1, wires);
    expect(wires).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// moveWireEndpoint
// ---------------------------------------------------------------------------

describe('moveWireEndpoint', () => {
  it('moves the start endpoint', () => {
    const wire = makeWire(1, [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    const result = moveWireEndpoint(1, 'start', { x: 5, y: 5 }, [wire]);
    expect(result[0].points[0]).toEqual({ x: 5, y: 5 });
    expect(result[0].points[1]).toEqual({ x: 100, y: 0 });
  });

  it('moves the end endpoint', () => {
    const wire = makeWire(1, [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    const result = moveWireEndpoint(1, 'end', { x: 80, y: 20 }, [wire]);
    expect(result[0].points[0]).toEqual({ x: 0, y: 0 });
    expect(result[0].points[1]).toEqual({ x: 80, y: 20 });
  });

  it('moves the end of a multi-point wire without affecting middle points', () => {
    const wire = makeWire(1, [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
    ]);
    const result = moveWireEndpoint(1, 'end', { x: 60, y: 60 }, [wire]);
    expect(result[0].points[0]).toEqual({ x: 0, y: 0 });
    expect(result[0].points[1]).toEqual({ x: 50, y: 0 });
    expect(result[0].points[2]).toEqual({ x: 60, y: 60 });
  });

  it('does not modify other wires', () => {
    const wires = [
      makeWire(1, [{ x: 0, y: 0 }, { x: 10, y: 10 }]),
      makeWire(2, [{ x: 20, y: 20 }, { x: 30, y: 30 }]),
    ];
    const result = moveWireEndpoint(1, 'start', { x: 5, y: 5 }, wires);
    expect(result[1].points[0]).toEqual({ x: 20, y: 20 });
  });

  it('returns unchanged copy if wire ID is not found', () => {
    const wire = makeWire(1, [{ x: 0, y: 0 }, { x: 10, y: 10 }]);
    const result = moveWireEndpoint(999, 'start', { x: 5, y: 5 }, [wire]);
    expect(result[0].points[0]).toEqual({ x: 0, y: 0 });
  });

  it('does not mutate the original array', () => {
    const wire = makeWire(1, [{ x: 0, y: 0 }, { x: 10, y: 10 }]);
    const wires = [wire];
    moveWireEndpoint(1, 'start', { x: 5, y: 5 }, wires);
    expect(wires[0].points[0]).toEqual({ x: 0, y: 0 });
  });
});

// ---------------------------------------------------------------------------
// getWireEndpoints
// ---------------------------------------------------------------------------

describe('getWireEndpoints', () => {
  it('returns start and end points', () => {
    const wire = makeWire(1, [{ x: 10, y: 20 }, { x: 30, y: 40 }, { x: 50, y: 60 }]);
    const endpoints = getWireEndpoints(wire);
    expect(endpoints).not.toBeNull();
    expect(endpoints!.start).toEqual({ x: 10, y: 20 });
    expect(endpoints!.end).toEqual({ x: 50, y: 60 });
  });

  it('returns null for a wire with fewer than 2 points', () => {
    expect(getWireEndpoints(makeWire(1, []))).toBeNull();
    expect(getWireEndpoints(makeWire(1, [{ x: 0, y: 0 }]))).toBeNull();
  });

  it('returns copies, not references', () => {
    const wire = makeWire(1, [{ x: 10, y: 20 }, { x: 30, y: 40 }]);
    const endpoints = getWireEndpoints(wire)!;
    endpoints.start.x = 999;
    expect(wire.points[0].x).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// hitTestEndpoint
// ---------------------------------------------------------------------------

describe('hitTestEndpoint', () => {
  it('returns "start" when clicking near the start point', () => {
    const wire = makeWire(1, [{ x: 10, y: 10 }, { x: 100, y: 10 }]);
    expect(hitTestEndpoint(11, 11, wire)).toBe('start');
  });

  it('returns "end" when clicking near the end point', () => {
    const wire = makeWire(1, [{ x: 10, y: 10 }, { x: 100, y: 10 }]);
    expect(hitTestEndpoint(99, 10, wire)).toBe('end');
  });

  it('returns null when clicking far from both endpoints', () => {
    const wire = makeWire(1, [{ x: 10, y: 10 }, { x: 100, y: 10 }]);
    expect(hitTestEndpoint(50, 10, wire)).toBeNull();
  });

  it('returns the closer endpoint when both are within radius', () => {
    // Very short wire — both endpoints within 5px of center
    const wire = makeWire(1, [{ x: 10, y: 10 }, { x: 14, y: 10 }]);
    expect(hitTestEndpoint(11, 10, wire)).toBe('start');
    expect(hitTestEndpoint(13, 10, wire)).toBe('end');
  });

  it('returns null for a wire with fewer than 2 points', () => {
    const wire = makeWire(1, [{ x: 10, y: 10 }]);
    expect(hitTestEndpoint(10, 10, wire)).toBeNull();
  });

  it('respects custom radius', () => {
    const wire = makeWire(1, [{ x: 10, y: 10 }, { x: 100, y: 10 }]);
    // 8px away — outside default radius of 5, within custom radius of 10
    expect(hitTestEndpoint(10, 18, wire, 5)).toBeNull();
    expect(hitTestEndpoint(10, 18, wire, 10)).toBe('start');
  });
});
