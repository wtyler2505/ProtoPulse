import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  hitTestSegment,
  computeReroutedPath,
  validateReroute,
  snapToGrid,
  wireRerouterManager,
  type WireSegment,
  type Point,
  type ExistingWire,
} from '../wire-rerouter';

// ---------------------------------------------------------------------------
// snapToGrid
// ---------------------------------------------------------------------------

describe('snapToGrid', () => {
  it('snaps to nearest grid point', () => {
    expect(snapToGrid({ x: 13, y: 27 }, 10)).toEqual({ x: 10, y: 30 });
  });

  it('returns exact value when already on grid', () => {
    expect(snapToGrid({ x: 20, y: 40 }, 10)).toEqual({ x: 20, y: 40 });
  });

  it('handles grid size of 1', () => {
    expect(snapToGrid({ x: 3.7, y: 8.2 }, 1)).toEqual({ x: 4, y: 8 });
  });

  it('snaps negative coordinates', () => {
    expect(snapToGrid({ x: -13, y: -27 }, 10)).toEqual({ x: -10, y: -30 });
  });

  it('returns copy when gridSize is 0 (no snap)', () => {
    const pt = { x: 13, y: 27 };
    const result = snapToGrid(pt, 0);
    expect(result).toEqual({ x: 13, y: 27 });
    expect(result).not.toBe(pt); // must be a copy
  });

  it('snaps to large grid size', () => {
    expect(snapToGrid({ x: 55, y: 145 }, 100)).toEqual({ x: 100, y: 100 });
  });

  it('rounds 0.5 up', () => {
    expect(snapToGrid({ x: 15, y: 25 }, 10)).toEqual({ x: 20, y: 30 });
  });
});

// ---------------------------------------------------------------------------
// hitTestSegment
// ---------------------------------------------------------------------------

describe('hitTestSegment', () => {
  const makeSeg = (
    wireId: string,
    segmentIndex: number,
    sx: number, sy: number,
    ex: number, ey: number,
  ): WireSegment => ({
    wireId,
    segmentIndex,
    start: { x: sx, y: sy },
    end: { x: ex, y: ey },
  });

  it('returns null for empty segment list', () => {
    expect(hitTestSegment({ x: 0, y: 0 }, [])).toBeNull();
  });

  it('returns null when point is beyond threshold', () => {
    const segs = [makeSeg('w1', 0, 0, 0, 100, 0)];
    expect(hitTestSegment({ x: 50, y: 20 }, segs, 8)).toBeNull();
  });

  it('finds a horizontal segment within threshold', () => {
    const segs = [makeSeg('w1', 0, 0, 0, 100, 0)];
    const result = hitTestSegment({ x: 50, y: 5 }, segs, 8);
    expect(result).not.toBeNull();
    expect(result!.segment.wireId).toBe('w1');
    expect(result!.projection.y).toBeCloseTo(0, 1);
    expect(result!.projection.x).toBeCloseTo(50, 1);
    expect(result!.distance).toBeCloseTo(5, 1);
  });

  it('finds a vertical segment within threshold', () => {
    const segs = [makeSeg('w1', 0, 0, 0, 0, 100)];
    const result = hitTestSegment({ x: 3, y: 50 }, segs, 8);
    expect(result).not.toBeNull();
    expect(result!.segment.wireId).toBe('w1');
    expect(result!.distance).toBeCloseTo(3, 1);
  });

  it('returns the closest segment when multiple are within threshold', () => {
    const segs = [
      makeSeg('w1', 0, 0, 0, 100, 0),   // y=0
      makeSeg('w2', 0, 0, 10, 100, 10),  // y=10
    ];
    const result = hitTestSegment({ x: 50, y: 7 }, segs, 8);
    expect(result).not.toBeNull();
    expect(result!.segment.wireId).toBe('w2'); // closer to y=10 line (distance 3 vs 7)
  });

  it('respects custom threshold', () => {
    const segs = [makeSeg('w1', 0, 0, 0, 100, 0)];
    // Distance is 15, default threshold 8 would miss
    expect(hitTestSegment({ x: 50, y: 15 }, segs, 8)).toBeNull();
    // But threshold 20 catches it
    expect(hitTestSegment({ x: 50, y: 15 }, segs, 20)).not.toBeNull();
  });

  it('projects onto segment endpoints (clamps t to [0,1])', () => {
    const segs = [makeSeg('w1', 0, 10, 0, 90, 0)];
    // Point is before the segment start
    const result = hitTestSegment({ x: 5, y: 3 }, segs, 8);
    expect(result).not.toBeNull();
    expect(result!.projection.x).toBeCloseTo(10, 1); // clamped to start
  });

  it('handles zero-length segments', () => {
    const segs = [makeSeg('w1', 0, 50, 50, 50, 50)];
    const result = hitTestSegment({ x: 53, y: 50 }, segs, 8);
    expect(result).not.toBeNull();
    expect(result!.distance).toBeCloseTo(3, 1);
  });

  it('handles diagonal segments', () => {
    const segs = [makeSeg('w1', 0, 0, 0, 100, 100)];
    // Point on the line y=x at (50,50) — distance 0
    const result = hitTestSegment({ x: 50, y: 50 }, segs, 8);
    expect(result).not.toBeNull();
    expect(result!.distance).toBeCloseTo(0, 1);
  });
});

// ---------------------------------------------------------------------------
// computeReroutedPath
// ---------------------------------------------------------------------------

describe('computeReroutedPath', () => {
  const makeSeg = (
    sx: number, sy: number,
    ex: number, ey: number,
  ): WireSegment => ({
    wireId: 'w1',
    segmentIndex: 0,
    start: { x: sx, y: sy },
    end: { x: ex, y: ey },
  });

  it('reroutes horizontal segment with vertical detour', () => {
    const seg = makeSeg(0, 0, 100, 0);
    const result = computeReroutedPath(seg, { x: 50, y: 40 }, 0);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ x: 0, y: 0 });      // start
    expect(result[1]).toEqual({ x: 0, y: 40 });      // corner1
    expect(result[2]).toEqual({ x: 100, y: 40 });    // corner2
    expect(result[3]).toEqual({ x: 100, y: 0 });     // end
  });

  it('reroutes vertical segment with horizontal detour', () => {
    const seg = makeSeg(0, 0, 0, 100);
    const result = computeReroutedPath(seg, { x: 40, y: 50 }, 0);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ x: 0, y: 0 });       // start
    expect(result[1]).toEqual({ x: 40, y: 0 });      // corner1
    expect(result[2]).toEqual({ x: 40, y: 100 });    // corner2
    expect(result[3]).toEqual({ x: 0, y: 100 });     // end
  });

  it('reroutes diagonal segment through drag point', () => {
    const seg = makeSeg(0, 0, 100, 100);
    const result = computeReroutedPath(seg, { x: 60, y: 50 }, 0);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[1]).toEqual({ x: 60, y: 0 });
    expect(result[2]).toEqual({ x: 60, y: 100 });
    expect(result[3]).toEqual({ x: 100, y: 100 });
  });

  it('snaps drag point to grid', () => {
    const seg = makeSeg(0, 0, 100, 0);
    const result = computeReroutedPath(seg, { x: 53, y: 37 }, 20);
    // dragPoint snaps to (60, 40)
    expect(result[1]).toEqual({ x: 0, y: 40 });
    expect(result[2]).toEqual({ x: 100, y: 40 });
  });

  it('preserves start and end points exactly', () => {
    const seg = makeSeg(10, 20, 90, 20);
    const result = computeReroutedPath(seg, { x: 50, y: 60 }, 0);
    expect(result[0]).toEqual({ x: 10, y: 20 });
    expect(result[result.length - 1]).toEqual({ x: 90, y: 20 });
  });

  it('handles drag back to original line (zero displacement for horizontal)', () => {
    const seg = makeSeg(0, 0, 100, 0);
    const result = computeReroutedPath(seg, { x: 50, y: 0 }, 0);
    // Corners collapse onto the original line
    expect(result[1]).toEqual({ x: 0, y: 0 });
    expect(result[2]).toEqual({ x: 100, y: 0 });
  });

  it('handles negative drag coordinates', () => {
    const seg = makeSeg(0, 0, 100, 0);
    const result = computeReroutedPath(seg, { x: 50, y: -30 }, 0);
    expect(result[1]).toEqual({ x: 0, y: -30 });
    expect(result[2]).toEqual({ x: 100, y: -30 });
  });

  it('handles reversed segment direction (end < start)', () => {
    const seg = makeSeg(100, 0, 0, 0);
    const result = computeReroutedPath(seg, { x: 50, y: 40 }, 0);
    expect(result[0]).toEqual({ x: 100, y: 0 });
    expect(result[result.length - 1]).toEqual({ x: 0, y: 0 });
  });

  it('handles very small segment', () => {
    const seg = makeSeg(50, 50, 52, 50);
    const result = computeReroutedPath(seg, { x: 51, y: 60 }, 0);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ x: 50, y: 50 });
    expect(result[result.length - 1]).toEqual({ x: 52, y: 50 });
  });

  it('uses grid snapping for diagonal segments', () => {
    const seg = makeSeg(0, 0, 100, 100);
    const result = computeReroutedPath(seg, { x: 47, y: 50 }, 20);
    // snaps to (40, ...)
    expect(result[1].x).toBe(40);
    expect(result[2].x).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// validateReroute
// ---------------------------------------------------------------------------

describe('validateReroute', () => {
  it('returns true for a valid path with no overlaps', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 40 },
      { x: 100, y: 40 },
      { x: 100, y: 0 },
    ];
    expect(validateReroute(points, [])).toBe(true);
  });

  it('returns false when all points collapse to a single point', () => {
    const points: Point[] = [
      { x: 50, y: 50 },
      { x: 50, y: 50 },
      { x: 50, y: 50 },
    ];
    expect(validateReroute(points, [])).toBe(false);
  });

  it('returns false when only one distinct point', () => {
    const points: Point[] = [{ x: 10, y: 20 }];
    expect(validateReroute(points, [])).toBe(false);
  });

  it('detects horizontal overlap with existing wire', () => {
    const newPoints: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 0 },
    ];
    const existing: ExistingWire[] = [
      { wireId: 'other', points: [{ x: 20, y: 50 }, { x: 80, y: 50 }] },
    ];
    expect(validateReroute(newPoints, existing)).toBe(false);
  });

  it('detects vertical overlap with existing wire', () => {
    const newPoints: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 100 },
      { x: 0, y: 100 },
    ];
    const existing: ExistingWire[] = [
      { wireId: 'other', points: [{ x: 50, y: 20 }, { x: 50, y: 80 }] },
    ];
    expect(validateReroute(newPoints, existing)).toBe(false);
  });

  it('allows non-overlapping wires on the same axis', () => {
    const newPoints: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 0 },
    ];
    const existing: ExistingWire[] = [
      // Same Y=50, but x range 200-300 — no overlap
      { wireId: 'other', points: [{ x: 200, y: 50 }, { x: 300, y: 50 }] },
    ];
    expect(validateReroute(newPoints, existing)).toBe(true);
  });

  it('validates grid alignment when gridSize > 0', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 40 },
      { x: 100, y: 40 },
      { x: 100, y: 0 },
    ];
    // All on grid 20 — valid
    expect(validateReroute(points, [], 20)).toBe(true);
  });

  it('rejects off-grid points when gridSize > 0', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 37 }, // not on grid 20
      { x: 100, y: 37 },
      { x: 100, y: 0 },
    ];
    expect(validateReroute(points, [], 20)).toBe(false);
  });

  it('skips grid check when gridSize is 0', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 37.5 },
      { x: 100, y: 37.5 },
      { x: 100, y: 0 },
    ];
    expect(validateReroute(points, [], 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// WireRerouterManager — drag state machine
// ---------------------------------------------------------------------------

describe('WireRerouterManager', () => {
  beforeEach(() => {
    wireRerouterManager.reset();
    wireRerouterManager.setGridSize(0); // no snap for cleaner test assertions
  });

  describe('initial state', () => {
    it('starts in idle state', () => {
      expect(wireRerouterManager.state).toBe('idle');
      expect(wireRerouterManager.isDragging).toBe(false);
    });

    it('has no preview', () => {
      expect(wireRerouterManager.getDragPreview()).toBeNull();
    });

    it('has no drag point', () => {
      expect(wireRerouterManager.getDragPoint()).toBeNull();
    });

    it('has no drag wire ID', () => {
      expect(wireRerouterManager.getDragWireId()).toBeNull();
    });
  });

  describe('startDrag', () => {
    it('transitions to dragging state', () => {
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      expect(wireRerouterManager.state).toBe('dragging');
      expect(wireRerouterManager.isDragging).toBe(true);
      expect(wireRerouterManager.getDragWireId()).toBe('w1');
    });

    it('cancels previous drag if already dragging', () => {
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      wireRerouterManager.startDrag('w2', 0, points);
      expect(wireRerouterManager.getDragWireId()).toBe('w2');
    });

    it('increments version', () => {
      const v0 = wireRerouterManager.version;
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      expect(wireRerouterManager.version).toBeGreaterThan(v0);
    });
  });

  describe('updateDrag', () => {
    it('does nothing when not dragging', () => {
      const v0 = wireRerouterManager.version;
      wireRerouterManager.updateDrag({ x: 50, y: 30 });
      expect(wireRerouterManager.version).toBe(v0);
      expect(wireRerouterManager.getDragPreview()).toBeNull();
    });

    it('computes preview during active drag', () => {
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      wireRerouterManager.updateDrag({ x: 50, y: 40 });

      const preview = wireRerouterManager.getDragPreview();
      expect(preview).not.toBeNull();
      expect(preview!.wireId).toBe('w1');
      expect(preview!.points.length).toBeGreaterThanOrEqual(2);
    });

    it('updates drag point', () => {
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      wireRerouterManager.updateDrag({ x: 50, y: 40 });
      expect(wireRerouterManager.getDragPoint()).toEqual({ x: 50, y: 40 });
    });

    it('updates preview on subsequent calls', () => {
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);

      wireRerouterManager.updateDrag({ x: 50, y: 40 });
      const preview1 = wireRerouterManager.getDragPreview();

      wireRerouterManager.updateDrag({ x: 50, y: 80 });
      const preview2 = wireRerouterManager.getDragPreview();

      expect(preview1).not.toEqual(preview2);
    });
  });

  describe('endDrag', () => {
    it('returns null when not dragging', () => {
      expect(wireRerouterManager.endDrag()).toBeNull();
    });

    it('returns null when dragging but no preview computed', () => {
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      // no updateDrag called, so no preview
      expect(wireRerouterManager.endDrag()).toBeNull();
    });

    it('returns valid result after drag + update', () => {
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      wireRerouterManager.updateDrag({ x: 50, y: 40 });
      const result = wireRerouterManager.endDrag();
      expect(result).not.toBeNull();
      expect(result!.wireId).toBe('w1');
      expect(result!.isValid).toBe(true);
      expect(result!.newPoints.length).toBeGreaterThanOrEqual(2);
    });

    it('resets state after ending', () => {
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      wireRerouterManager.updateDrag({ x: 50, y: 40 });
      wireRerouterManager.endDrag();

      expect(wireRerouterManager.state).toBe('idle');
      expect(wireRerouterManager.isDragging).toBe(false);
      expect(wireRerouterManager.getDragPreview()).toBeNull();
    });

    it('marks invalid when overlapping other wires', () => {
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      wireRerouterManager.updateDrag({ x: 50, y: 40 });

      const existing: ExistingWire[] = [
        { wireId: 'other', points: [{ x: 0, y: 40 }, { x: 100, y: 40 }] },
      ];
      const result = wireRerouterManager.endDrag(existing);
      expect(result).not.toBeNull();
      expect(result!.isValid).toBe(false);
    });
  });

  describe('cancelDrag', () => {
    it('is a no-op when not dragging', () => {
      const v0 = wireRerouterManager.version;
      wireRerouterManager.cancelDrag();
      expect(wireRerouterManager.version).toBe(v0);
    });

    it('resets to idle when dragging', () => {
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      wireRerouterManager.cancelDrag();
      expect(wireRerouterManager.state).toBe('idle');
      expect(wireRerouterManager.getDragPreview()).toBeNull();
      expect(wireRerouterManager.getDragWireId()).toBeNull();
    });

    it('increments version', () => {
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      const v0 = wireRerouterManager.version;
      wireRerouterManager.cancelDrag();
      expect(wireRerouterManager.version).toBeGreaterThan(v0);
    });
  });

  describe('subscribe', () => {
    it('notifies listener on startDrag', () => {
      let count = 0;
      wireRerouterManager.subscribe(() => { count++; });
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      expect(count).toBe(1);
    });

    it('notifies listener on updateDrag', () => {
      let count = 0;
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      wireRerouterManager.subscribe(() => { count++; });
      wireRerouterManager.updateDrag({ x: 50, y: 40 });
      expect(count).toBe(1);
    });

    it('notifies listener on cancelDrag', () => {
      let count = 0;
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      wireRerouterManager.subscribe(() => { count++; });
      wireRerouterManager.cancelDrag();
      expect(count).toBe(1);
    });

    it('notifies listener on endDrag', () => {
      let count = 0;
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      wireRerouterManager.updateDrag({ x: 50, y: 40 });
      wireRerouterManager.subscribe(() => { count++; });
      wireRerouterManager.endDrag();
      expect(count).toBe(1);
    });

    it('stops notifying after unsubscribe', () => {
      let count = 0;
      const unsub = wireRerouterManager.subscribe(() => { count++; });
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      expect(count).toBe(1);

      unsub();
      wireRerouterManager.cancelDrag();
      expect(count).toBe(1); // no additional notification
    });

    it('supports multiple listeners', () => {
      let count1 = 0;
      let count2 = 0;
      wireRerouterManager.subscribe(() => { count1++; });
      wireRerouterManager.subscribe(() => { count2++; });

      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);

      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });

    it('getSnapshot returns version', () => {
      const v = wireRerouterManager.getSnapshot();
      expect(v).toBe(wireRerouterManager.version);
    });
  });

  describe('grid snapping during drag', () => {
    it('snaps rerouted path to grid', () => {
      wireRerouterManager.setGridSize(20);
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      wireRerouterManager.updateDrag({ x: 53, y: 37 });

      const preview = wireRerouterManager.getDragPreview();
      expect(preview).not.toBeNull();
      // Drag point snapped to (60, 40) — corners at y=40
      const corners = preview!.points.filter(
        (p) => Math.abs(p.y - 40) < 0.01,
      );
      expect(corners.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('edge cases', () => {
    it('handles wire with only 2 points (single segment)', () => {
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      wireRerouterManager.updateDrag({ x: 50, y: 40 });
      const result = wireRerouterManager.endDrag();
      expect(result).not.toBeNull();
      expect(result!.isValid).toBe(true);
    });

    it('handles multi-segment wire — reroutes only the targeted segment', () => {
      // Wire with 3 points = 2 segments
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 100 },
      ];
      wireRerouterManager.startDrag('w1', 0, points);
      wireRerouterManager.updateDrag({ x: 25, y: 40 });

      const preview = wireRerouterManager.getDragPreview();
      expect(preview).not.toBeNull();
      // The last point (50, 100) should still be in the preview
      const lastPt = preview!.points[preview!.points.length - 1];
      expect(lastPt).toEqual({ x: 50, y: 100 });
    });

    it('handles reroute of middle segment in multi-segment wire', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 0, y: 50 },
        { x: 100, y: 50 },
        { x: 100, y: 100 },
      ];
      // Reroute segment 1 (from (0,50) to (100,50))
      wireRerouterManager.startDrag('w1', 1, points);
      wireRerouterManager.updateDrag({ x: 50, y: 80 });

      const preview = wireRerouterManager.getDragPreview();
      expect(preview).not.toBeNull();
      // First point should be (0,0), last should be (100,100)
      expect(preview!.points[0]).toEqual({ x: 0, y: 0 });
      expect(preview!.points[preview!.points.length - 1]).toEqual({ x: 100, y: 100 });
    });

    it('deduplicates zero-length segments in preview', () => {
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      // Drag back to original line — corners collapse
      wireRerouterManager.updateDrag({ x: 50, y: 0 });

      const preview = wireRerouterManager.getDragPreview();
      expect(preview).not.toBeNull();
      // After dedup, should have no consecutive duplicate points
      for (let i = 1; i < preview!.points.length; i++) {
        const prev = preview!.points[i - 1];
        const curr = preview!.points[i];
        const same = Math.abs(prev.x - curr.x) < 0.01 && Math.abs(prev.y - curr.y) < 0.01;
        expect(same).toBe(false);
      }
    });

    it('reset clears all state', () => {
      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      wireRerouterManager.updateDrag({ x: 50, y: 40 });

      wireRerouterManager.reset();

      expect(wireRerouterManager.state).toBe('idle');
      expect(wireRerouterManager.isDragging).toBe(false);
      expect(wireRerouterManager.getDragPreview()).toBeNull();
      expect(wireRerouterManager.getDragPoint()).toBeNull();
      expect(wireRerouterManager.getDragWireId()).toBeNull();
    });
  });

  describe('full drag workflow integration', () => {
    it('start → update → end produces valid result', () => {
      const wirePoints: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ];

      wireRerouterManager.startDrag('w1', 0, wirePoints);
      expect(wireRerouterManager.isDragging).toBe(true);

      wireRerouterManager.updateDrag({ x: 50, y: 40 });
      const preview = wireRerouterManager.getDragPreview();
      expect(preview).not.toBeNull();

      const result = wireRerouterManager.endDrag();
      expect(result).not.toBeNull();
      expect(result!.wireId).toBe('w1');
      expect(result!.isValid).toBe(true);
      expect(result!.newPoints.length).toBeGreaterThanOrEqual(3);
      expect(wireRerouterManager.isDragging).toBe(false);
    });

    it('start → update → cancel → no result', () => {
      const wirePoints: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];

      wireRerouterManager.startDrag('w1', 0, wirePoints);
      wireRerouterManager.updateDrag({ x: 50, y: 40 });
      wireRerouterManager.cancelDrag();

      expect(wireRerouterManager.isDragging).toBe(false);
      expect(wireRerouterManager.getDragPreview()).toBeNull();
    });

    it('sequential drags on different wires work independently', () => {
      const wire1: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      const wire2: Point[] = [{ x: 200, y: 0 }, { x: 300, y: 0 }];

      wireRerouterManager.startDrag('w1', 0, wire1);
      wireRerouterManager.updateDrag({ x: 50, y: 40 });
      const result1 = wireRerouterManager.endDrag();

      wireRerouterManager.startDrag('w2', 0, wire2);
      wireRerouterManager.updateDrag({ x: 250, y: 60 });
      const result2 = wireRerouterManager.endDrag();

      expect(result1!.wireId).toBe('w1');
      expect(result2!.wireId).toBe('w2');
    });

    it('starting new drag while dragging auto-cancels previous', () => {
      const wire1: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      const wire2: Point[] = [{ x: 200, y: 0 }, { x: 300, y: 0 }];

      wireRerouterManager.startDrag('w1', 0, wire1);
      wireRerouterManager.updateDrag({ x: 50, y: 40 });
      // Start a new drag without ending the first
      wireRerouterManager.startDrag('w2', 0, wire2);

      expect(wireRerouterManager.getDragWireId()).toBe('w2');
      // Old preview is gone
      expect(wireRerouterManager.getDragPreview()).toBeNull();
    });

    it('version increments through full workflow', () => {
      const v0 = wireRerouterManager.version;

      const points: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      wireRerouterManager.startDrag('w1', 0, points);
      const v1 = wireRerouterManager.version;
      expect(v1).toBeGreaterThan(v0);

      wireRerouterManager.updateDrag({ x: 50, y: 40 });
      const v2 = wireRerouterManager.version;
      expect(v2).toBeGreaterThan(v1);

      wireRerouterManager.endDrag();
      const v3 = wireRerouterManager.version;
      expect(v3).toBeGreaterThan(v2);
    });
  });
});
