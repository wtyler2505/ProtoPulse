import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TraceRouter,
  snapToGrid,
  snapAngle45,
  pointToSegmentDistance,
} from '@/lib/pcb/trace-router';
import type {
  TracePoint,
  TracePreview,
  TraceResult,
  DRCViolation,
  Obstacle,
} from '@/lib/pcb/trace-router';

// Mock crypto.randomUUID for deterministic IDs in tests
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${String(++uuidCounter)}`,
});

describe('TraceRouter', () => {
  let router: TraceRouter;

  beforeEach(() => {
    router = new TraceRouter();
    uuidCounter = 0;
  });

  // ───────────────────────────────────────────────────────────────────────
  // State machine
  // ───────────────────────────────────────────────────────────────────────

  describe('state machine', () => {
    it('starts in IDLE state', () => {
      expect(router.isRouting()).toBe(false);
    });

    it('transitions to ROUTING after startTrace', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      expect(router.isRouting()).toBe(true);
    });

    it('transitions back to IDLE after finishTrace', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      router.finishTrace();
      expect(router.isRouting()).toBe(false);
    });

    it('transitions back to IDLE after cancelTrace', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.cancelTrace();
      expect(router.isRouting()).toBe(false);
    });

    it('throws if startTrace called while already routing', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      expect(() => router.startTrace({ x: 5, y: 5 }, 'front', 'net2')).toThrow(
        'Cannot start trace: already routing',
      );
    });

    it('throws if finishTrace called while not routing', () => {
      expect(() => router.finishTrace()).toThrow('Cannot finish trace: not routing');
    });

    it('throws if cancelTrace called while not routing', () => {
      expect(() => router.cancelTrace()).toThrow('Cannot cancel trace: not routing');
    });

    it('throws if addVertex called while not routing', () => {
      expect(() => router.addVertex()).toThrow('Cannot add vertex: not routing');
    });

    it('throws if insertVia called while not routing', () => {
      expect(() => router.insertVia()).toThrow('Cannot insert via: not routing');
    });

    it('throws if updatePreview called while not routing', () => {
      expect(() => router.updatePreview({ x: 5, y: 5 })).toThrow(
        'Cannot update preview: not routing',
      );
    });

    it('allows starting a new trace after finishing', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      router.finishTrace();
      router.startTrace({ x: 20, y: 20 }, 'back', 'net2');
      expect(router.isRouting()).toBe(true);
      expect(router.getCurrentLayer()).toBe('back');
    });

    it('allows starting a new trace after cancelling', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.cancelTrace();
      router.startTrace({ x: 20, y: 20 }, 'back', 'net2');
      expect(router.isRouting()).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // getCurrentLayer
  // ───────────────────────────────────────────────────────────────────────

  describe('getCurrentLayer', () => {
    it('returns the layer passed to startTrace', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      expect(router.getCurrentLayer()).toBe('front');
    });

    it('returns back when started on back layer', () => {
      router.startTrace({ x: 0, y: 0 }, 'back', 'net1');
      expect(router.getCurrentLayer()).toBe('back');
    });

    it('throws when not routing', () => {
      expect(() => router.getCurrentLayer()).toThrow('Cannot get layer: not routing');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // 45-degree angle snapping
  // ───────────────────────────────────────────────────────────────────────

  describe('snapAngle45 (utility)', () => {
    it('snaps to 0 degrees (horizontal right)', () => {
      const result = snapAngle45({ x: 0, y: 0 }, { x: 10, y: 1 });
      expect(result.x).toBeCloseTo(10, 5);
      expect(result.y).toBeCloseTo(0, 5);
    });

    it('snaps to 90 degrees (vertical down)', () => {
      const result = snapAngle45({ x: 0, y: 0 }, { x: 1, y: 10 });
      expect(result.x).toBeCloseTo(0, 5);
      expect(result.y).toBeCloseTo(10, 5);
    });

    it('snaps to 180 degrees (horizontal left)', () => {
      const result = snapAngle45({ x: 0, y: 0 }, { x: -10, y: -1 });
      expect(result.x).toBeCloseTo(-10, 5);
      expect(result.y).toBeCloseTo(0, 5);
    });

    it('snaps to 270 degrees (vertical up)', () => {
      const result = snapAngle45({ x: 0, y: 0 }, { x: -1, y: -10 });
      expect(result.x).toBeCloseTo(0, 5);
      expect(result.y).toBeCloseTo(-10, 5);
    });

    it('snaps to 45 degrees (diagonal down-right)', () => {
      const result = snapAngle45({ x: 0, y: 0 }, { x: 10, y: 9 });
      // Should snap to 45 deg: both x and y should equal max(|dx|,|dy|) in some form
      expect(result.x).toBeCloseTo(result.y, 5);
    });

    it('snaps to 135 degrees (diagonal down-left)', () => {
      const result = snapAngle45({ x: 0, y: 0 }, { x: -10, y: 9 });
      expect(result.x).toBeCloseTo(-result.y, 5);
    });

    it('snaps to 225 degrees (diagonal up-left)', () => {
      const result = snapAngle45({ x: 0, y: 0 }, { x: -10, y: -9 });
      expect(result.x).toBeCloseTo(result.y, 5);
    });

    it('snaps to 315 degrees (diagonal up-right)', () => {
      const result = snapAngle45({ x: 0, y: 0 }, { x: 10, y: -9 });
      expect(result.x).toBeCloseTo(-result.y, 5);
    });

    it('returns origin offset when from and to are same point', () => {
      const result = snapAngle45({ x: 5, y: 5 }, { x: 5, y: 5 });
      expect(result.x).toBeCloseTo(5, 5);
      expect(result.y).toBeCloseTo(5, 5);
    });

    it('works with non-origin start points', () => {
      const result = snapAngle45({ x: 10, y: 10 }, { x: 20, y: 11 });
      expect(result.x).toBeCloseTo(20, 5);
      expect(result.y).toBeCloseTo(10, 5);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Grid snapping
  // ───────────────────────────────────────────────────────────────────────

  describe('snapToGrid (utility)', () => {
    it('snaps to nearest grid point with default grid size', () => {
      const result = snapToGrid({ x: 2.6, y: 5.1 }, 2.54);
      expect(result.x).toBeCloseTo(2.54, 5);
      expect(result.y).toBeCloseTo(5.08, 5);
    });

    it('snaps to nearest grid point with custom grid size', () => {
      const result = snapToGrid({ x: 0.7, y: 1.3 }, 0.5);
      expect(result.x).toBeCloseTo(0.5, 5);
      expect(result.y).toBeCloseTo(1.5, 5);
    });

    it('returns exact point if already on grid', () => {
      const result = snapToGrid({ x: 5.08, y: 7.62 }, 2.54);
      expect(result.x).toBeCloseTo(5.08, 5);
      expect(result.y).toBeCloseTo(7.62, 5);
    });

    it('snaps to origin for small values', () => {
      const result = snapToGrid({ x: 0.1, y: -0.1 }, 1.0);
      expect(result.x).toBeCloseTo(0, 5);
      expect(result.y).toBeCloseTo(0, 5);
    });

    it('handles negative coordinates', () => {
      const result = snapToGrid({ x: -3.8, y: -6.3 }, 2.54);
      // -3.8 / 2.54 = -1.496 → round to -1 → -2.54
      expect(result.x).toBeCloseTo(-2.54, 5);
      // -6.3 / 2.54 = -2.48 → round to -2 → -5.08
      expect(result.y).toBeCloseTo(-5.08, 5);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Preview
  // ───────────────────────────────────────────────────────────────────────

  describe('updatePreview', () => {
    it('returns preview with correct layer', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      const preview = router.updatePreview({ x: 10, y: 0 });
      expect(preview.layer).toBe('front');
    });

    it('returns preview with correct width', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      const preview = router.updatePreview({ x: 10, y: 0 });
      expect(preview.width).toBe(2.0); // DEFAULT_TRACE_WIDTH
    });

    it('returns preview with start point included', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      const preview = router.updatePreview({ x: 10, y: 0 });
      expect(preview.points[0]).toEqual({ x: 0, y: 0 });
    });

    it('returns preview with snapped endpoint', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      // Mouse slightly off horizontal — should snap to 0 degrees
      const preview = router.updatePreview({ x: 10, y: 1 });
      const lastPoint = preview.points[preview.points.length - 1];
      expect(lastPoint.x).toBeCloseTo(10, 5);
      expect(lastPoint.y).toBeCloseTo(0, 5);
    });

    it('returns valid=true when no violations', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      const preview = router.updatePreview({ x: 10, y: 0 });
      expect(preview.valid).toBe(true);
      expect(preview.violations).toHaveLength(0);
    });

    it('uses staircase routing with horizontal-then-diagonal segments', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      // Target at 30 degrees — should produce horizontal + diagonal segments
      const preview = router.updatePreview({ x: 10, y: 5 });
      expect(preview.points.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Multi-segment (addVertex)
  // ───────────────────────────────────────────────────────────────────────

  describe('addVertex', () => {
    it('commits the current segment and starts a new one', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      router.addVertex();
      // Should still be routing
      expect(router.isRouting()).toBe(true);
    });

    it('includes committed vertices in subsequent previews', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      router.addVertex();
      const preview = router.updatePreview({ x: 10, y: 10 });
      // Should include the start, the vertex, and the new endpoint
      expect(preview.points.length).toBeGreaterThanOrEqual(3);
      expect(preview.points[0]).toEqual({ x: 0, y: 0 });
    });

    it('creates a multi-segment trace on finish', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      router.addVertex();
      router.updatePreview({ x: 10, y: 10 });
      const result = router.finishTrace();
      expect(result.wires.length).toBeGreaterThanOrEqual(1);
      // Should have points from start through vertex to end
      const allPoints = result.wires.flatMap((w) => w.points);
      expect(allPoints.length).toBeGreaterThanOrEqual(3);
    });

    it('supports multiple vertices in sequence', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      router.addVertex();
      router.updatePreview({ x: 10, y: 10 });
      router.addVertex();
      router.updatePreview({ x: 20, y: 10 });
      const result = router.finishTrace();
      const allPoints = result.wires.flatMap((w) => w.points);
      expect(allPoints.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Via insertion
  // ───────────────────────────────────────────────────────────────────────

  describe('insertVia', () => {
    it('creates a via at the current routing position', () => {
      router.startTrace({ x: 5, y: 5 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 5 });
      router.addVertex();
      const via = router.insertVia();
      expect(via.position.x).toBeCloseTo(10, 5);
      expect(via.position.y).toBeCloseTo(5, 5);
    });

    it('toggles the active layer from front to back', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      router.addVertex();
      router.insertVia();
      expect(router.getCurrentLayer()).toBe('back');
    });

    it('toggles the active layer from back to front', () => {
      router.startTrace({ x: 0, y: 0 }, 'back', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      router.addVertex();
      router.insertVia();
      expect(router.getCurrentLayer()).toBe('front');
    });

    it('includes the via in the trace result', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      router.addVertex();
      router.insertVia();
      router.updatePreview({ x: 20, y: 0 });
      const result = router.finishTrace();
      expect(result.vias).toHaveLength(1);
      expect(result.vias[0].position.x).toBeCloseTo(10, 5);
    });

    it('creates via with through type by default', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      router.addVertex();
      const via = router.insertVia();
      expect(via.type).toBe('through');
    });

    it('via layers match the layer transition', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      router.addVertex();
      const via = router.insertVia();
      expect(via.fromLayer).toBe('front');
      expect(via.toLayer).toBe('back');
    });

    it('subsequent segments use the new layer after via', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      router.addVertex();
      router.insertVia();
      const preview = router.updatePreview({ x: 20, y: 0 });
      expect(preview.layer).toBe('back');
    });

    it('supports multiple via insertions', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      router.addVertex();
      router.insertVia(); // front → back
      router.updatePreview({ x: 20, y: 0 });
      router.addVertex();
      router.insertVia(); // back → front
      expect(router.getCurrentLayer()).toBe('front');
      router.updatePreview({ x: 30, y: 0 });
      const result = router.finishTrace();
      expect(result.vias).toHaveLength(2);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Trace width
  // ───────────────────────────────────────────────────────────────────────

  describe('setTraceWidth', () => {
    it('changes the trace width', () => {
      router.setTraceWidth(0.5);
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      const preview = router.updatePreview({ x: 10, y: 0 });
      expect(preview.width).toBe(0.5);
    });

    it('uses the new width in the trace result', () => {
      router.setTraceWidth(1.0);
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      const result = router.finishTrace();
      expect(result.wires[0].width).toBe(1.0);
    });

    it('can be changed mid-route', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      router.addVertex();
      router.setTraceWidth(0.25);
      const preview = router.updatePreview({ x: 20, y: 0 });
      expect(preview.width).toBe(0.25);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Finish trace
  // ───────────────────────────────────────────────────────────────────────

  describe('finishTrace', () => {
    it('returns a trace result with the correct netId', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      const result = router.finishTrace();
      expect(result.netId).toBe('net1');
    });

    it('returns wires with correct layer', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      const result = router.finishTrace();
      expect(result.wires[0].layer).toBe('front');
    });

    it('returns empty vias when no via was inserted', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      const result = router.finishTrace();
      expect(result.vias).toHaveLength(0);
    });

    it('includes target pad position when provided', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      const result = router.finishTrace({ x: 10, y: 0 });
      const lastWire = result.wires[result.wires.length - 1];
      const lastPoint = lastWire.points[lastWire.points.length - 1];
      expect(lastPoint.x).toBeCloseTo(10, 5);
      expect(lastPoint.y).toBeCloseTo(0, 5);
    });

    it('creates separate wire segments for different layers', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      router.addVertex();
      router.insertVia(); // front → back
      router.updatePreview({ x: 20, y: 0 });
      const result = router.finishTrace();
      // Should have at least 2 wire segments (one front, one back)
      expect(result.wires.length).toBeGreaterThanOrEqual(2);
      expect(result.wires[0].layer).toBe('front');
      expect(result.wires[result.wires.length - 1].layer).toBe('back');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Cancel trace
  // ───────────────────────────────────────────────────────────────────────

  describe('cancelTrace', () => {
    it('clears all routing state', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      router.addVertex();
      router.cancelTrace();
      expect(router.isRouting()).toBe(false);
    });

    it('getViolations returns empty after cancel', () => {
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.cancelTrace();
      expect(router.getViolations()).toHaveLength(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // DRC obstacle checking
  // ───────────────────────────────────────────────────────────────────────

  describe('DRC obstacle checking', () => {
    it('detects a clearance violation when trace is too close to obstacle', () => {
      const obstacles: Obstacle[] = [
        { type: 'pad', position: { x: 5, y: 0.1 }, radius: 0.5, layer: 'front', netId: 'other' },
      ];
      router.setObstacles(obstacles);
      router.setMinClearance(0.2);
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      const preview = router.updatePreview({ x: 10, y: 0 });
      expect(preview.valid).toBe(false);
      expect(preview.violations.length).toBeGreaterThan(0);
      expect(preview.violations[0].type).toBe('clearance');
    });

    it('no violation when obstacle is far enough away', () => {
      const obstacles: Obstacle[] = [
        { type: 'pad', position: { x: 5, y: 10 }, radius: 0.5, layer: 'front', netId: 'other' },
      ];
      router.setObstacles(obstacles);
      router.setMinClearance(0.2);
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      const preview = router.updatePreview({ x: 10, y: 0 });
      expect(preview.valid).toBe(true);
      expect(preview.violations).toHaveLength(0);
    });

    it('ignores obstacles on different layer', () => {
      const obstacles: Obstacle[] = [
        { type: 'pad', position: { x: 5, y: 0.1 }, radius: 0.5, layer: 'back', netId: 'other' },
      ];
      router.setObstacles(obstacles);
      router.setMinClearance(0.2);
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      const preview = router.updatePreview({ x: 10, y: 0 });
      expect(preview.valid).toBe(true);
    });

    it('ignores obstacles belonging to the same net', () => {
      const obstacles: Obstacle[] = [
        { type: 'pad', position: { x: 5, y: 0.1 }, radius: 0.5, layer: 'front', netId: 'net1' },
      ];
      router.setObstacles(obstacles);
      router.setMinClearance(0.2);
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      const preview = router.updatePreview({ x: 10, y: 0 });
      expect(preview.valid).toBe(true);
    });

    it('getViolations returns current violations during routing', () => {
      const obstacles: Obstacle[] = [
        { type: 'via', position: { x: 5, y: 0.1 }, radius: 0.3, layer: 'front', netId: 'other' },
      ];
      router.setObstacles(obstacles);
      router.setMinClearance(0.2);
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      const violations = router.getViolations();
      expect(violations.length).toBeGreaterThan(0);
    });

    it('reports violation with correct severity', () => {
      const obstacles: Obstacle[] = [
        { type: 'trace', position: { x: 5, y: 0.05 }, radius: 0.1, layer: 'front', netId: 'other' },
      ];
      router.setObstacles(obstacles);
      router.setMinClearance(0.2);
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      const preview = router.updatePreview({ x: 10, y: 0 });
      expect(preview.violations[0].severity).toBe('error');
    });

    it('checks obstacles on both layers for through-hole pads', () => {
      const obstacles: Obstacle[] = [
        { type: 'pad', position: { x: 5, y: 0.1 }, radius: 0.5, layer: 'both', netId: 'other' },
      ];
      router.setObstacles(obstacles);
      router.setMinClearance(0.2);
      router.startTrace({ x: 0, y: 0 }, 'back', 'net1');
      const preview = router.updatePreview({ x: 10, y: 0 });
      expect(preview.valid).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // pointToSegmentDistance (utility)
  // ───────────────────────────────────────────────────────────────────────

  describe('pointToSegmentDistance (utility)', () => {
    it('returns perpendicular distance for point beside segment', () => {
      const dist = pointToSegmentDistance({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 });
      expect(dist).toBeCloseTo(3, 5);
    });

    it('returns distance to start when point projects before segment', () => {
      const dist = pointToSegmentDistance({ x: -3, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 });
      expect(dist).toBeCloseTo(5, 5);
    });

    it('returns distance to end when point projects past segment', () => {
      const dist = pointToSegmentDistance({ x: 13, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 });
      expect(dist).toBeCloseTo(5, 5);
    });

    it('returns 0 for point on the segment', () => {
      const dist = pointToSegmentDistance({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 });
      expect(dist).toBeCloseTo(0, 5);
    });

    it('handles zero-length segment (same start and end)', () => {
      const dist = pointToSegmentDistance({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 });
      expect(dist).toBeCloseTo(5, 5);
    });

    it('works with diagonal segments', () => {
      const dist = pointToSegmentDistance({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 1 });
      // Distance from (0,1) to line from (0,0) to (1,1) should be ~0.707
      expect(dist).toBeCloseTo(Math.SQRT2 / 2, 4);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Edge cases
  // ───────────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles zero-length trace (finish at start)', () => {
      router.startTrace({ x: 5, y: 5 }, 'front', 'net1');
      router.updatePreview({ x: 5, y: 5 });
      const result = router.finishTrace({ x: 5, y: 5 });
      expect(result.wires).toHaveLength(1);
      expect(result.netId).toBe('net1');
    });

    it('handles trace with pad info on start', () => {
      router.startTrace({ x: 0, y: 0, netId: 42 }, 'front', 'net1');
      router.updatePreview({ x: 10, y: 0 });
      const result = router.finishTrace();
      expect(result.netId).toBe('net1');
    });

    it('setObstacles replaces previous obstacles', () => {
      router.setObstacles([
        { type: 'pad', position: { x: 5, y: 0.1 }, radius: 0.5, layer: 'front', netId: 'other' },
      ]);
      router.setObstacles([]); // clear
      router.setMinClearance(0.2);
      router.startTrace({ x: 0, y: 0 }, 'front', 'net1');
      const preview = router.updatePreview({ x: 10, y: 0 });
      expect(preview.valid).toBe(true);
    });
  });
});
