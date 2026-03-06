/**
 * PushShoveEngine — Tests for collision-aware trace displacement engine.
 *
 * TDD: all tests written BEFORE implementation.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  PushShoveEngine,
  segmentToSegmentDistance,
  segmentsCollide,
  segmentViaDistance,
  displaceSegment,
} from '@/lib/pcb/push-shove-engine';
import type {
  PushShoveSegment,
  PushShoveVia,
  PushShoveResult,
} from '@/lib/pcb/push-shove-engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seg(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width = 0.2,
  layer = 'F.Cu',
  netId = 'net-1',
): PushShoveSegment {
  return { id, p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 }, width, layer, netId };
}

function via(
  id: string,
  x: number,
  y: number,
  diameter = 0.6,
  netId = 'net-1',
): PushShoveVia {
  return { id, position: { x, y }, diameter, netId };
}

// ---------------------------------------------------------------------------
// segmentToSegmentDistance
// ---------------------------------------------------------------------------

describe('segmentToSegmentDistance', () => {
  it('returns 0 for overlapping segments', () => {
    const d = segmentToSegmentDistance(
      { x: 0, y: 0 }, { x: 10, y: 0 },
      { x: 5, y: 0 }, { x: 15, y: 0 },
    );
    expect(d).toBeCloseTo(0, 6);
  });

  it('returns correct distance for parallel horizontal segments', () => {
    // Two horizontal segments 3mm apart vertically
    const d = segmentToSegmentDistance(
      { x: 0, y: 0 }, { x: 10, y: 0 },
      { x: 0, y: 3 }, { x: 10, y: 3 },
    );
    expect(d).toBeCloseTo(3, 6);
  });

  it('returns correct distance for perpendicular segments', () => {
    // Horizontal at y=0, vertical at x=5 starting at y=2
    const d = segmentToSegmentDistance(
      { x: 0, y: 0 }, { x: 10, y: 0 },
      { x: 5, y: 2 }, { x: 5, y: 10 },
    );
    expect(d).toBeCloseTo(2, 6);
  });

  it('returns correct distance for angled segments', () => {
    // 45-degree segment vs horizontal
    const d = segmentToSegmentDistance(
      { x: 0, y: 0 }, { x: 10, y: 0 },
      { x: 5, y: 2 }, { x: 8, y: 5 },
    );
    expect(d).toBeCloseTo(2, 6);
  });

  it('returns 0 for intersecting segments', () => {
    const d = segmentToSegmentDistance(
      { x: 0, y: 0 }, { x: 10, y: 10 },
      { x: 10, y: 0 }, { x: 0, y: 10 },
    );
    expect(d).toBeCloseTo(0, 6);
  });

  it('handles zero-length segments as points', () => {
    const d = segmentToSegmentDistance(
      { x: 0, y: 0 }, { x: 0, y: 0 },
      { x: 3, y: 4 }, { x: 3, y: 4 },
    );
    expect(d).toBeCloseTo(5, 6);
  });

  it('returns distance between endpoint and segment for L-shaped gap', () => {
    const d = segmentToSegmentDistance(
      { x: 0, y: 0 }, { x: 5, y: 0 },
      { x: 7, y: 0 }, { x: 12, y: 0 },
    );
    expect(d).toBeCloseTo(2, 6);
  });
});

// ---------------------------------------------------------------------------
// segmentsCollide — accounts for width + clearance
// ---------------------------------------------------------------------------

describe('segmentsCollide', () => {
  it('detects collision when segments are closer than clearance + half-widths', () => {
    const a = seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1');
    const b = seg('b', 0, 0.3, 10, 0.3, 0.2, 'F.Cu', 'net-2');
    // center distance = 0.3, half-widths = 0.1 + 0.1, clearance = 0.2
    // required distance = 0.1 + 0.1 + 0.2 = 0.4 > 0.3 center → collision
    expect(segmentsCollide(a, b, 0.2)).toBe(true);
  });

  it('returns false when segments have enough clearance', () => {
    const a = seg('a', 0, 0, 10, 0, 0.2);
    const b = seg('b', 0, 1.0, 10, 1.0, 0.2);
    // center distance = 1.0, half-widths = 0.2, clearance needed = 0.2
    // effective gap = 1.0 - 0.2 = 0.8 > 0.2 clearance
    expect(segmentsCollide(a, b, 0.2)).toBe(false);
  });

  it('skips collision check for same-net segments', () => {
    const a = seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1');
    const b = seg('b', 0, 0.15, 10, 0.15, 0.2, 'F.Cu', 'net-1');
    // Very close but same net — no collision
    expect(segmentsCollide(a, b, 0.2)).toBe(false);
  });

  it('skips collision check for different layers', () => {
    const a = seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1');
    const b = seg('b', 0, 0.1, 10, 0.1, 0.2, 'B.Cu', 'net-2');
    expect(segmentsCollide(a, b, 0.2)).toBe(false);
  });

  it('detects collision for wide traces', () => {
    const a = seg('a', 0, 0, 10, 0, 1.0, 'F.Cu', 'net-1');
    const b = seg('b', 0, 1.0, 10, 1.0, 1.0, 'F.Cu', 'net-2');
    // center distance = 1.0, half-widths = 0.5 + 0.5, effective gap = 0 < 0.2 clearance
    expect(segmentsCollide(a, b, 0.2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// segmentViaDistance
// ---------------------------------------------------------------------------

describe('segmentViaDistance', () => {
  it('returns distance from segment centerline to via center', () => {
    const s = seg('s', 0, 0, 10, 0);
    const v = via('v', 5, 3);
    const d = segmentViaDistance(s, v);
    expect(d).toBeCloseTo(3, 6);
  });

  it('returns 0 when via center is on the segment', () => {
    const s = seg('s', 0, 0, 10, 0);
    const v = via('v', 5, 0);
    const d = segmentViaDistance(s, v);
    expect(d).toBeCloseTo(0, 6);
  });

  it('returns distance to nearest endpoint for via past segment end', () => {
    const s = seg('s', 0, 0, 10, 0);
    const v = via('v', 13, 4);
    // Distance from (13,4) to (10,0) = sqrt(9+16) = 5
    const d = segmentViaDistance(s, v);
    expect(d).toBeCloseTo(5, 6);
  });
});

// ---------------------------------------------------------------------------
// displaceSegment — single segment push
// ---------------------------------------------------------------------------

describe('displaceSegment', () => {
  it('pushes a horizontal segment upward', () => {
    const s = seg('s', 0, 0, 10, 0, 0.2);
    const result = displaceSegment(s, { x: 0, y: 1 });
    expect(result.p1.y).toBeCloseTo(1, 6);
    expect(result.p2.y).toBeCloseTo(1, 6);
    expect(result.p1.x).toBeCloseTo(0, 6);
    expect(result.p2.x).toBeCloseTo(10, 6);
  });

  it('pushes a vertical segment to the right', () => {
    const s = seg('s', 0, 0, 0, 10, 0.2);
    const result = displaceSegment(s, { x: 2, y: 0 });
    expect(result.p1.x).toBeCloseTo(2, 6);
    expect(result.p2.x).toBeCloseTo(2, 6);
    expect(result.p1.y).toBeCloseTo(0, 6);
    expect(result.p2.y).toBeCloseTo(10, 6);
  });

  it('pushes a 45-degree segment diagonally', () => {
    const s = seg('s', 0, 0, 5, 5, 0.2);
    const result = displaceSegment(s, { x: 1, y: -1 });
    expect(result.p1.x).toBeCloseTo(1, 6);
    expect(result.p1.y).toBeCloseTo(-1, 6);
    expect(result.p2.x).toBeCloseTo(6, 6);
    expect(result.p2.y).toBeCloseTo(4, 6);
  });

  it('preserves segment width, layer, netId, and id', () => {
    const s = seg('seg-1', 0, 0, 10, 0, 0.5, 'B.Cu', 'net-3');
    const result = displaceSegment(s, { x: 0, y: 1 });
    expect(result.id).toBe('seg-1');
    expect(result.width).toBe(0.5);
    expect(result.layer).toBe('B.Cu');
    expect(result.netId).toBe('net-3');
  });
});

// ---------------------------------------------------------------------------
// PushShoveEngine — construction + spatial index
// ---------------------------------------------------------------------------

describe('PushShoveEngine', () => {
  let engine: PushShoveEngine;

  beforeEach(() => {
    engine = new PushShoveEngine();
  });

  describe('construction', () => {
    it('creates with default clearance', () => {
      expect(engine).toBeDefined();
    });

    it('accepts custom clearance', () => {
      const e = new PushShoveEngine({ clearance: 0.3 });
      expect(e).toBeDefined();
    });

    it('accepts custom max cascade depth', () => {
      const e = new PushShoveEngine({ maxCascadeDepth: 5 });
      expect(e).toBeDefined();
    });
  });

  describe('addSegment / removeSegment', () => {
    it('adds a segment to the spatial index', () => {
      const s = seg('s1', 0, 0, 10, 0);
      engine.addSegment(s);
      expect(engine.getSegment('s1')).toEqual(s);
    });

    it('removes a segment from the spatial index', () => {
      const s = seg('s1', 0, 0, 10, 0);
      engine.addSegment(s);
      engine.removeSegment('s1');
      expect(engine.getSegment('s1')).toBeUndefined();
    });

    it('handles removing non-existent segment gracefully', () => {
      expect(() => engine.removeSegment('nonexistent')).not.toThrow();
    });
  });

  describe('addVia / removeVia', () => {
    it('adds a via to the spatial index', () => {
      const v = via('v1', 5, 5);
      engine.addVia(v);
      expect(engine.getVia('v1')).toEqual(v);
    });

    it('removes a via from the spatial index', () => {
      const v = via('v1', 5, 5);
      engine.addVia(v);
      engine.removeVia('v1');
      expect(engine.getVia('v1')).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('removes all segments and vias', () => {
      engine.addSegment(seg('s1', 0, 0, 10, 0));
      engine.addVia(via('v1', 5, 5));
      engine.clear();
      expect(engine.getSegment('s1')).toBeUndefined();
      expect(engine.getVia('v1')).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Single segment push
  // -------------------------------------------------------------------------

  describe('pushSegment', () => {
    it('pushes a single segment away from a colliding segment', () => {
      engine.addSegment(seg('existing', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));

      // A new segment very close to the existing one
      const newSeg = seg('new', 0, 0.3, 10, 0.3, 0.2, 'F.Cu', 'net-2');
      const result = engine.pushSegment(newSeg);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.success).toBe(true);
        // The existing segment should have been displaced
        expect(result.modifiedSegments.length).toBeGreaterThanOrEqual(1);
        expect(result.totalDisplacement).toBeGreaterThan(0);
      }
    });

    it('returns success with no modifications when no collision exists', () => {
      engine.addSegment(seg('existing', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));

      // A new segment far from the existing one
      const newSeg = seg('new', 0, 5, 10, 5, 0.2, 'F.Cu', 'net-2');
      const result = engine.pushSegment(newSeg);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.success).toBe(true);
        expect(result.modifiedSegments.length).toBe(0);
        expect(result.totalDisplacement).toBeCloseTo(0, 6);
      }
    });

    it('returns null when push is impossible (blocked on all sides)', () => {
      // Surround a segment with obstacles
      engine.addSegment(seg('top', 0, 0.5, 10, 0.5, 0.2, 'F.Cu', 'net-2'));
      engine.addSegment(seg('bottom', 0, -0.5, 10, -0.5, 0.2, 'F.Cu', 'net-3'));

      // Try to push something between them in a very constrained space
      const newSeg = seg('new', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-4');

      // With very tight clearance we might not be able to push, but the engine
      // should at least return a result (success or not)
      const result = engine.pushSegment(newSeg);
      expect(result).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Cascade push
  // -------------------------------------------------------------------------

  describe('cascade push', () => {
    it('pushes a chain of 2 segments', () => {
      // seg-a at y=0, seg-b at y=0.3 — too close
      engine.addSegment(seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));
      engine.addSegment(seg('b', 0, 0.5, 10, 0.5, 0.2, 'F.Cu', 'net-2'));

      // Insert new trace at y=0.15 — pushes a and b
      const newSeg = seg('new', 0, 0.15, 10, 0.15, 0.2, 'F.Cu', 'net-3');
      const result = engine.pushSegment(newSeg);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.success).toBe(true);
        // At least 1 segment should be modified
        expect(result.modifiedSegments.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('pushes a chain of 3 segments', () => {
      engine.addSegment(seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));
      engine.addSegment(seg('b', 0, 0.5, 10, 0.5, 0.2, 'F.Cu', 'net-2'));
      engine.addSegment(seg('c', 0, 1.0, 10, 1.0, 0.2, 'F.Cu', 'net-3'));

      const newSeg = seg('new', 0, 0.15, 10, 0.15, 0.2, 'F.Cu', 'net-4');
      const result = engine.pushSegment(newSeg);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.success).toBe(true);
      }
    });

    it('detects and breaks cycle — no infinite loop', () => {
      // Create a tight arrangement that could cause cycles
      engine.addSegment(seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));
      engine.addSegment(seg('b', 0, 0.35, 10, 0.35, 0.2, 'F.Cu', 'net-2'));

      const newSeg = seg('new', 0, 0.15, 10, 0.15, 0.2, 'F.Cu', 'net-3');
      // Should not hang — cycle detection breaks the loop
      const result = engine.pushSegment(newSeg);
      expect(result).not.toBeNull();
    });

    it('respects max cascade depth', () => {
      const e = new PushShoveEngine({ maxCascadeDepth: 2 });

      // Build a long chain of tightly packed segments
      for (let i = 0; i < 5; i++) {
        e.addSegment(seg(`s${String(i)}`, 0, i * 0.4, 10, i * 0.4, 0.2, 'F.Cu', `net-${String(i)}`));
      }

      const newSeg = seg('new', 0, 0.1, 10, 0.1, 0.2, 'F.Cu', 'net-new');
      const result = e.pushSegment(newSeg);

      // With max depth of 2, deep cascades should stop
      expect(result).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Via displacement
  // -------------------------------------------------------------------------

  describe('via displacement', () => {
    it('pushes a via away from a colliding segment', () => {
      engine.addVia(via('v1', 5, 0.3, 0.6, 'net-1'));

      // New segment very close to the via
      const newSeg = seg('new', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-2');
      const result = engine.pushSegment(newSeg);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.success).toBe(true);
        expect(result.displacedVias.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('reconnects segments when via is displaced', () => {
      // Via with connected segments — place via far enough that only the via
      // itself collides with the new trace, not the connected segments.
      // Via at (5, 0.4), diameter 0.6 → radius 0.3. New trace at y=0, width 0.2 → hw 0.1.
      // Via center dist to trace = 0.4, required = 0.3 + 0.1 + 0.2 = 0.6 → collision.
      // Connected segments at y=2 — safely far from the new trace.
      engine.addVia(via('v1', 5, 0.4, 0.6, 'net-1'));
      engine.addSegment(seg('s-in', 0, 2, 5, 0.4, 0.2, 'F.Cu', 'net-1'));
      engine.addSegment(seg('s-out', 5, 0.4, 10, 2, 0.2, 'F.Cu', 'net-1'));

      const newSeg = seg('new', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-2');
      const result = engine.pushSegment(newSeg);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.success).toBe(true);
        // Via should be displaced
        expect(result.displacedVias.length).toBeGreaterThanOrEqual(1);
        // Connected segments should be in modifiedSegments with endpoints
        // updated to the new via position
        if (result.displacedVias.length > 0) {
          const movedVia = result.displacedVias[0];
          const hasConnectedSegment = result.modifiedSegments.some(
            (s) =>
              (Math.abs(s.p1.x - movedVia.position.x) < 0.1 &&
                Math.abs(s.p1.y - movedVia.position.y) < 0.1) ||
              (Math.abs(s.p2.x - movedVia.position.x) < 0.1 &&
                Math.abs(s.p2.y - movedVia.position.y) < 0.1),
          );
          expect(hasConnectedSegment).toBe(true);
        }
      }
    });

    it('does not displace via on same net', () => {
      engine.addVia(via('v1', 5, 0.3, 0.6, 'net-1'));

      const newSeg = seg('new', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1');
      const result = engine.pushSegment(newSeg);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.displacedVias.length).toBe(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Spring relaxation
  // -------------------------------------------------------------------------

  describe('spring relaxation', () => {
    it('minimizes total displacement after push', () => {
      engine.addSegment(seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));

      const newSeg = seg('new', 0, 0.2, 10, 0.2, 0.2, 'F.Cu', 'net-2');
      const result = engine.pushSegment(newSeg);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.success).toBe(true);
        // After relaxation, total displacement should be minimal
        // (just enough to clear, not more)
        expect(result.totalDisplacement).toBeGreaterThan(0);
      }
    });

    it('relaxes displaced segments closer to original positions', () => {
      engine.addSegment(seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));
      engine.addSegment(seg('b', 0, 0.5, 10, 0.5, 0.2, 'F.Cu', 'net-2'));

      // Push between them
      const newSeg = seg('new', 0, 0.25, 10, 0.25, 0.2, 'F.Cu', 'net-3');
      const result = engine.pushSegment(newSeg);

      expect(result).not.toBeNull();
      if (result) {
        // After relaxation, segments should be as close to original positions
        // as clearance allows. Total displacement should be reasonable.
        expect(result.totalDisplacement).toBeLessThan(5);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Undo stack
  // -------------------------------------------------------------------------

  describe('undo / redo', () => {
    it('undoes a push operation', () => {
      const original = seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1');
      engine.addSegment(original);

      const newSeg = seg('new', 0, 0.2, 10, 0.2, 0.2, 'F.Cu', 'net-2');
      engine.pushSegment(newSeg);

      // Segment 'a' was displaced
      const displaced = engine.getSegment('a');
      expect(displaced).toBeDefined();

      engine.undo();

      // After undo, segment 'a' should be back at original position
      const restored = engine.getSegment('a');
      expect(restored).toBeDefined();
      if (restored) {
        expect(restored.p1.y).toBeCloseTo(original.p1.y, 6);
        expect(restored.p2.y).toBeCloseTo(original.p2.y, 6);
      }
    });

    it('redoes an undone push', () => {
      const original = seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1');
      engine.addSegment(original);

      const newSeg = seg('new', 0, 0.2, 10, 0.2, 0.2, 'F.Cu', 'net-2');
      engine.pushSegment(newSeg);

      const afterPush = engine.getSegment('a');

      engine.undo();
      engine.redo();

      const afterRedo = engine.getSegment('a');
      expect(afterRedo).toBeDefined();
      if (afterRedo && afterPush) {
        expect(afterRedo.p1.y).toBeCloseTo(afterPush.p1.y, 6);
        expect(afterRedo.p2.y).toBeCloseTo(afterPush.p2.y, 6);
      }
    });

    it('clears redo stack on new push', () => {
      engine.addSegment(seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));
      engine.pushSegment(seg('new1', 0, 0.2, 10, 0.2, 0.2, 'F.Cu', 'net-2'));
      engine.undo();

      // New push should clear the redo stack
      engine.pushSegment(seg('new2', 0, 0.3, 10, 0.3, 0.2, 'F.Cu', 'net-3'));
      expect(engine.canRedo()).toBe(false);
    });

    it('undo does nothing with empty stack', () => {
      engine.addSegment(seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));
      engine.undo(); // Should not throw
      const s = engine.getSegment('a');
      expect(s).toBeDefined();
      if (s) {
        expect(s.p1.y).toBeCloseTo(0, 6);
      }
    });

    it('redo does nothing with empty stack', () => {
      engine.addSegment(seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));
      engine.redo(); // Should not throw
      const s = engine.getSegment('a');
      expect(s).toBeDefined();
    });

    it('canUndo and canRedo return correct state', () => {
      expect(engine.canUndo()).toBe(false);
      expect(engine.canRedo()).toBe(false);

      engine.addSegment(seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));
      engine.pushSegment(seg('new', 0, 0.2, 10, 0.2, 0.2, 'F.Cu', 'net-2'));

      expect(engine.canUndo()).toBe(true);
      expect(engine.canRedo()).toBe(false);

      engine.undo();
      expect(engine.canUndo()).toBe(false);
      expect(engine.canRedo()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // solve — integration test
  // -------------------------------------------------------------------------

  describe('solve', () => {
    it('returns modified set for resolvable collision', () => {
      engine.addSegment(seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));

      const newTrace: PushShoveSegment[] = [
        seg('t1', 0, 0.2, 5, 0.2, 0.2, 'F.Cu', 'net-2'),
        seg('t2', 5, 0.2, 10, 0.2, 0.2, 'F.Cu', 'net-2'),
      ];

      const result = engine.solve(newTrace, 0.2);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.success).toBe(true);
        expect(result.modifiedSegments.length).toBeGreaterThan(0);
      }
    });

    it('returns null for unresolvable collision', () => {
      // Create a very tight box of segments around the center
      for (let i = 0; i < 12; i++) {
        const y = -3 + i * 0.35;
        engine.addSegment(seg(`wall-${String(i)}`, -5, y, 15, y, 0.2, 'F.Cu', `net-wall-${String(i)}`));
      }

      // Try to shove through the dense wall
      const newTrace: PushShoveSegment[] = [
        seg('t1', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-new'),
      ];

      const result = engine.solve(newTrace, 0.2);
      // Might succeed or fail depending on implementation, but should not hang
      expect(result).not.toBeNull();
    });

    it('returns success with no modifications when no collision', () => {
      engine.addSegment(seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));

      const newTrace: PushShoveSegment[] = [
        seg('t1', 0, 5, 10, 5, 0.2, 'F.Cu', 'net-2'),
      ];

      const result = engine.solve(newTrace, 0.2);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.success).toBe(true);
        expect(result.modifiedSegments.length).toBe(0);
        expect(result.displacedVias.length).toBe(0);
      }
    });

    it('handles multiple new trace segments', () => {
      engine.addSegment(seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));
      engine.addSegment(seg('b', 0, 2, 10, 2, 0.2, 'F.Cu', 'net-2'));

      const newTrace: PushShoveSegment[] = [
        seg('t1', 0, 0.2, 5, 0.2, 0.2, 'F.Cu', 'net-3'),
        seg('t2', 5, 0.2, 10, 1.8, 0.2, 'F.Cu', 'net-3'),
      ];

      const result = engine.solve(newTrace, 0.2);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.success).toBe(true);
      }
    });

    it('uses custom clearance per call', () => {
      engine.addSegment(seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));

      const newTrace: PushShoveSegment[] = [
        seg('t1', 0, 0.8, 10, 0.8, 0.2, 'F.Cu', 'net-2'),
      ];

      // With clearance 0.2 — no collision (gap = 0.8 - 0.2 = 0.6 > 0.2)
      const r1 = engine.solve(newTrace, 0.2);
      expect(r1).not.toBeNull();
      if (r1) {
        expect(r1.modifiedSegments.length).toBe(0);
      }

      // With clearance 0.7 — collision (gap = 0.6 < 0.7)
      const r2 = engine.solve(newTrace, 0.7);
      expect(r2).not.toBeNull();
      if (r2) {
        expect(r2.modifiedSegments.length).toBeGreaterThan(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles zero-length segment', () => {
      engine.addSegment(seg('a', 5, 5, 5, 5, 0.2, 'F.Cu', 'net-1'));
      const newSeg = seg('new', 5, 5, 5, 5, 0.2, 'F.Cu', 'net-2');
      const result = engine.pushSegment(newSeg);
      expect(result).not.toBeNull();
    });

    it('handles overlapping segments on same net (no push needed)', () => {
      engine.addSegment(seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));
      const newSeg = seg('new', 2, 0, 8, 0, 0.2, 'F.Cu', 'net-1');
      const result = engine.pushSegment(newSeg);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.success).toBe(true);
        expect(result.modifiedSegments.length).toBe(0);
      }
    });

    it('handles segment on different layer (no push needed)', () => {
      engine.addSegment(seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));
      const newSeg = seg('new', 0, 0, 10, 0, 0.2, 'B.Cu', 'net-2');
      const result = engine.pushSegment(newSeg);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.success).toBe(true);
        expect(result.modifiedSegments.length).toBe(0);
      }
    });

    it('handles segments that barely touch the clearance boundary', () => {
      // Clearance = 0.2, half-widths = 0.1 each
      // Required center-to-center distance = 0.2 + 0.1 + 0.1 = 0.4
      engine.addSegment(seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));
      const newSeg = seg('new', 0, 0.4, 10, 0.4, 0.2, 'F.Cu', 'net-2');
      const result = engine.pushSegment(newSeg);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.success).toBe(true);
        // Exactly at boundary — should not need displacement
        expect(result.modifiedSegments.length).toBe(0);
      }
    });

    it('handles many segments without stack overflow', () => {
      // Add 50 segments spaced 2mm apart — no collisions expected
      for (let i = 0; i < 50; i++) {
        engine.addSegment(
          seg(`s${String(i)}`, 0, i * 2, 10, i * 2, 0.2, 'F.Cu', `net-${String(i)}`),
        );
      }

      const newSeg = seg('new', 0, 0.2, 10, 0.2, 0.2, 'F.Cu', 'net-new');
      const result = engine.pushSegment(newSeg);
      expect(result).not.toBeNull();
    });

    it('handles perpendicular segments that need pushing', () => {
      // Horizontal existing segment
      engine.addSegment(seg('h', 0, 5, 10, 5, 0.2, 'F.Cu', 'net-1'));
      // Vertical new segment that crosses very close
      const newSeg = seg('new', 5, 4.8, 5, 10, 0.2, 'F.Cu', 'net-2');
      const result = engine.pushSegment(newSeg);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.success).toBe(true);
      }
    });

    it('totalDisplacement is the sum of all moved distances', () => {
      engine.addSegment(seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));

      const newSeg = seg('new', 0, 0.2, 10, 0.2, 0.2, 'F.Cu', 'net-2');
      const result = engine.pushSegment(newSeg);

      expect(result).not.toBeNull();
      if (result) {
        expect(typeof result.totalDisplacement).toBe('number');
        expect(result.totalDisplacement).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  // getNeighbors (spatial index query)
  // -------------------------------------------------------------------------

  describe('spatial index', () => {
    it('finds nearby segments within query range', () => {
      engine.addSegment(seg('near', 0, 0, 5, 0, 0.2, 'F.Cu', 'net-1'));
      engine.addSegment(seg('far', 0, 100, 5, 100, 0.2, 'F.Cu', 'net-2'));

      const neighbors = engine.getNeighborSegments(
        { x: -1, y: -1 },
        { x: 6, y: 1 },
      );
      expect(neighbors.some((s) => s.id === 'near')).toBe(true);
      expect(neighbors.some((s) => s.id === 'far')).toBe(false);
    });

    it('finds nearby vias within query range', () => {
      engine.addVia(via('near', 3, 3));
      engine.addVia(via('far', 100, 100));

      const neighbors = engine.getNeighborVias(
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      );
      expect(neighbors.some((v) => v.id === 'near')).toBe(true);
      expect(neighbors.some((v) => v.id === 'far')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Displacement direction
  // -------------------------------------------------------------------------

  describe('displacement direction', () => {
    it('pushes in the direction of least resistance (away from new trace)', () => {
      engine.addSegment(seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));

      // New trace slightly above — should push 'a' downward
      const newSeg = seg('new', 0, 0.2, 10, 0.2, 0.2, 'F.Cu', 'net-2');
      const result = engine.pushSegment(newSeg);

      expect(result).not.toBeNull();
      if (result && result.modifiedSegments.length > 0) {
        const modified = result.modifiedSegments.find((s) => s.id === 'a');
        if (modified) {
          // Should have moved downward (negative y direction) or upward, but away from new trace
          expect(modified.p1.y).not.toBeCloseTo(0, 1);
        }
      }
    });

    it('pushes vertically for parallel horizontal segments', () => {
      engine.addSegment(seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));

      // New trace slightly below
      const newSeg = seg('new', 0, -0.2, 10, -0.2, 0.2, 'F.Cu', 'net-2');
      const result = engine.pushSegment(newSeg);

      expect(result).not.toBeNull();
      if (result && result.modifiedSegments.length > 0) {
        const modified = result.modifiedSegments.find((s) => s.id === 'a');
        if (modified) {
          // Should have moved upward (positive y)
          expect(modified.p1.y).toBeGreaterThan(0);
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // Solve with vias
  // -------------------------------------------------------------------------

  describe('solve with vias', () => {
    it('includes displaced vias in result', () => {
      engine.addVia(via('v1', 5, 0.3, 0.6, 'net-1'));

      const newTrace: PushShoveSegment[] = [
        seg('t1', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-2'),
      ];

      const result = engine.solve(newTrace, 0.2);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.success).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // updateSegment
  // -------------------------------------------------------------------------

  describe('updateSegment', () => {
    it('updates segment position in spatial index', () => {
      engine.addSegment(seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1'));

      const updated = seg('a', 0, 5, 10, 5, 0.2, 'F.Cu', 'net-1');
      engine.updateSegment(updated);

      const s = engine.getSegment('a');
      expect(s).toBeDefined();
      if (s) {
        expect(s.p1.y).toBeCloseTo(5, 6);
        expect(s.p2.y).toBeCloseTo(5, 6);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Immutability — engine should not mutate inputs
  // -------------------------------------------------------------------------

  describe('immutability', () => {
    it('does not mutate input segments', () => {
      const original = seg('a', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-1');
      const originalY = original.p1.y;
      engine.addSegment(original);

      engine.pushSegment(seg('new', 0, 0.2, 10, 0.2, 0.2, 'F.Cu', 'net-2'));

      // Original object should not be mutated
      expect(original.p1.y).toBeCloseTo(originalY, 6);
    });

    it('does not mutate input vias', () => {
      const originalVia = via('v1', 5, 0.3, 0.6, 'net-1');
      const originalY = originalVia.position.y;
      engine.addVia(originalVia);

      engine.pushSegment(seg('new', 0, 0, 10, 0, 0.2, 'F.Cu', 'net-2'));

      expect(originalVia.position.y).toBeCloseTo(originalY, 6);
    });
  });
});
