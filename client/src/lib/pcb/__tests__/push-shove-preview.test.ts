import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  PushShovePreviewManager,
  getPushShovePreviewManager,
  resetPushShovePreviewManager,
} from '../push-shove-preview';
import type {
  PushShovePreviewResult,
  PushedTrace,
  Point,
  Segment,
  PreviewSegment,
} from '../push-shove-preview';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSeg(x1: number, y1: number, x2: number, y2: number): Segment {
  return { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } };
}

function makePushedTrace(overrides?: Partial<PushedTrace>): PushedTrace {
  return {
    traceId: 'trace-1',
    netId: 'net-1',
    originalSegments: [makeSeg(0, 0, 10, 0)],
    newSegments: [makeSeg(0, 2, 10, 2)],
    displacement: 2,
    ...overrides,
  };
}

function makeResult(overrides?: Partial<PushShovePreviewResult>): PushShovePreviewResult {
  return {
    pushedTraces: [makePushedTrace()],
    routingTrace: [
      { x: 0, y: 1 },
      { x: 10, y: 1 },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PushShovePreviewManager', () => {
  let mgr: PushShovePreviewManager;

  beforeEach(() => {
    mgr = PushShovePreviewManager.create();
  });

  // -----------------------------------------------------------------------
  // Active / inactive toggle
  // -----------------------------------------------------------------------

  describe('active state', () => {
    it('starts inactive', () => {
      expect(mgr.isActive()).toBe(false);
      expect(mgr.getSnapshot().active).toBe(false);
    });

    it('setActive(true) activates', () => {
      mgr.setActive(true);
      expect(mgr.isActive()).toBe(true);
      expect(mgr.getSnapshot().active).toBe(true);
    });

    it('setActive(false) deactivates', () => {
      mgr.setActive(true);
      mgr.setActive(false);
      expect(mgr.isActive()).toBe(false);
    });

    it('setActive with same value is a no-op (no notify)', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.setActive(false); // already false
      expect(listener).not.toHaveBeenCalled();
    });

    it('toggle flips state and returns new value', () => {
      expect(mgr.toggle()).toBe(true);
      expect(mgr.isActive()).toBe(true);
      expect(mgr.toggle()).toBe(false);
      expect(mgr.isActive()).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Preview update generates correct segments
  // -----------------------------------------------------------------------

  describe('updatePreview', () => {
    it('generates segments when active', () => {
      mgr.setActive(true);
      mgr.updatePreview(makeResult());

      const segs = mgr.getPreviewSegments();
      expect(segs.length).toBeGreaterThan(0);
    });

    it('does not generate segments when inactive', () => {
      mgr.updatePreview(makeResult());

      const segs = mgr.getPreviewSegments();
      expect(segs.length).toBe(0);
    });

    it('activating after update rebuilds segments', () => {
      mgr.updatePreview(makeResult());
      expect(mgr.getPreviewSegments().length).toBe(0);

      mgr.setActive(true);
      expect(mgr.getPreviewSegments().length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Original segments rendered as ghost (gray, low opacity, dashed)
  // -----------------------------------------------------------------------

  describe('original segments', () => {
    it('renders original segments with gray color and low opacity', () => {
      mgr.setActive(true);
      mgr.updatePreview(makeResult());

      const originals = mgr.getSegmentsByType('original');
      expect(originals.length).toBe(1);
      expect(originals[0].color).toBe('#6B7280');
      expect(originals[0].opacity).toBe(0.3);
    });

    it('renders original segments with dash array', () => {
      mgr.setActive(true);
      mgr.updatePreview(makeResult());

      const originals = mgr.getSegmentsByType('original');
      expect(originals[0].dashArray).toBe('4 3');
    });

    it('has correct points from original segment', () => {
      mgr.setActive(true);
      mgr.updatePreview(makeResult());

      const originals = mgr.getSegmentsByType('original');
      expect(originals[0].points).toEqual([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]);
    });

    it('generates unique IDs per original segment', () => {
      const trace = makePushedTrace({
        originalSegments: [makeSeg(0, 0, 5, 0), makeSeg(5, 0, 10, 0)],
        newSegments: [makeSeg(0, 2, 5, 2), makeSeg(5, 2, 10, 2)],
      });
      mgr.setActive(true);
      mgr.updatePreview({ pushedTraces: [trace], routingTrace: [] });

      const originals = mgr.getSegmentsByType('original');
      expect(originals.length).toBe(2);
      expect(originals[0].id).not.toBe(originals[1].id);
    });
  });

  // -----------------------------------------------------------------------
  // Pushed segments rendered highlighted (yellow)
  // -----------------------------------------------------------------------

  describe('pushed segments', () => {
    it('renders pushed segments with yellow color', () => {
      mgr.setActive(true);
      mgr.updatePreview(makeResult());

      const pushed = mgr.getSegmentsByType('pushed');
      expect(pushed.length).toBe(1);
      expect(pushed[0].color).toBe('#FACC15');
      expect(pushed[0].opacity).toBe(0.8);
    });

    it('has no dash array on pushed segments', () => {
      mgr.setActive(true);
      mgr.updatePreview(makeResult());

      const pushed = mgr.getSegmentsByType('pushed');
      expect(pushed[0].dashArray).toBeUndefined();
    });

    it('has correct points from pushed segment', () => {
      mgr.setActive(true);
      mgr.updatePreview(makeResult());

      const pushed = mgr.getSegmentsByType('pushed');
      expect(pushed[0].points).toEqual([
        { x: 0, y: 2 },
        { x: 10, y: 2 },
      ]);
    });
  });

  // -----------------------------------------------------------------------
  // Routing trace rendered in cyan
  // -----------------------------------------------------------------------

  describe('routing segments', () => {
    it('renders routing trace with cyan color', () => {
      mgr.setActive(true);
      mgr.updatePreview(makeResult());

      const routing = mgr.getSegmentsByType('routing');
      expect(routing.length).toBe(1);
      expect(routing[0].color).toBe('#00F0FF');
      expect(routing[0].opacity).toBe(0.9);
    });

    it('generates one segment per consecutive point pair', () => {
      const trace: Point[] = [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 5 },
      ];
      mgr.setActive(true);
      mgr.updatePreview({ pushedTraces: [], routingTrace: trace });

      const routing = mgr.getSegmentsByType('routing');
      expect(routing.length).toBe(2);
      expect(routing[0].points).toEqual([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ]);
      expect(routing[1].points).toEqual([
        { x: 5, y: 0 },
        { x: 10, y: 5 },
      ]);
    });

    it('does not generate routing segments for fewer than 2 points', () => {
      mgr.setActive(true);
      mgr.updatePreview({ pushedTraces: [], routingTrace: [{ x: 0, y: 0 }] });

      const routing = mgr.getSegmentsByType('routing');
      expect(routing.length).toBe(0);
    });

    it('does not generate routing segments for empty trace', () => {
      mgr.setActive(true);
      mgr.updatePreview({ pushedTraces: [], routingTrace: [] });

      const routing = mgr.getSegmentsByType('routing');
      expect(routing.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Displacement arrows between original and pushed
  // -----------------------------------------------------------------------

  describe('displacement arrows', () => {
    it('generates arrows between original and pushed midpoints', () => {
      mgr.setActive(true);
      mgr.updatePreview(makeResult());

      const arrows = mgr.getSegmentsByType('displacement_arrow');
      expect(arrows.length).toBe(1);
      expect(arrows[0].color).toBe('#F97316');
      expect(arrows[0].opacity).toBe(0.7);
    });

    it('arrow points go from original midpoint to pushed midpoint', () => {
      mgr.setActive(true);
      mgr.updatePreview(makeResult());

      const arrows = mgr.getSegmentsByType('displacement_arrow');
      // Original: (0,0)→(10,0), midpoint = (5,0)
      // Pushed: (0,2)→(10,2), midpoint = (5,2)
      expect(arrows[0].points[0]).toEqual({ x: 5, y: 0 });
      expect(arrows[0].points[1]).toEqual({ x: 5, y: 2 });
    });

    it('skips arrows for zero displacement', () => {
      const trace = makePushedTrace({
        displacement: 0,
        originalSegments: [makeSeg(0, 0, 10, 0)],
        newSegments: [makeSeg(0, 0, 10, 0)],
      });
      mgr.setActive(true);
      mgr.updatePreview({ pushedTraces: [trace], routingTrace: [] });

      const arrows = mgr.getSegmentsByType('displacement_arrow');
      expect(arrows.length).toBe(0);
    });

    it('skips arrows with negligible midpoint distance', () => {
      const trace = makePushedTrace({
        displacement: 0.001,
        originalSegments: [makeSeg(0, 0, 10, 0)],
        newSegments: [makeSeg(0, 0.005, 10, 0.005)],
      });
      mgr.setActive(true);
      mgr.updatePreview({ pushedTraces: [trace], routingTrace: [] });

      const arrows = mgr.getSegmentsByType('displacement_arrow');
      expect(arrows.length).toBe(0);
    });

    it('generates multiple arrows for multi-segment traces', () => {
      const trace = makePushedTrace({
        traceId: 'multi',
        originalSegments: [makeSeg(0, 0, 5, 0), makeSeg(5, 0, 10, 0)],
        newSegments: [makeSeg(0, 3, 5, 3), makeSeg(5, 3, 10, 3)],
        displacement: 3,
      });
      mgr.setActive(true);
      mgr.updatePreview({ pushedTraces: [trace], routingTrace: [] });

      const arrows = mgr.getSegmentsByType('displacement_arrow');
      expect(arrows.length).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Clear preview removes all segments
  // -----------------------------------------------------------------------

  describe('clearPreview', () => {
    it('removes all segments', () => {
      mgr.setActive(true);
      mgr.updatePreview(makeResult());
      expect(mgr.getPreviewSegments().length).toBeGreaterThan(0);

      mgr.clearPreview();
      expect(mgr.getPreviewSegments().length).toBe(0);
    });

    it('resets pushed trace count', () => {
      mgr.setActive(true);
      mgr.updatePreview(makeResult());
      expect(mgr.getPushedTraceCount()).toBe(1);

      mgr.clearPreview();
      expect(mgr.getPushedTraceCount()).toBe(0);
    });

    it('resets total displacement', () => {
      mgr.setActive(true);
      mgr.updatePreview(makeResult());
      expect(mgr.getTotalDisplacement()).toBe(2);

      mgr.clearPreview();
      expect(mgr.getTotalDisplacement()).toBe(0);
    });

    it('notifies listeners on clear', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.setActive(true);
      listener.mockClear();

      mgr.clearPreview();
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Multiple pushed traces
  // -----------------------------------------------------------------------

  describe('multiple pushed traces', () => {
    it('generates segments for all pushed traces', () => {
      const result: PushShovePreviewResult = {
        pushedTraces: [
          makePushedTrace({ traceId: 'a', netId: 'net-a' }),
          makePushedTrace({ traceId: 'b', netId: 'net-b' }),
          makePushedTrace({ traceId: 'c', netId: 'net-c' }),
        ],
        routingTrace: [
          { x: 0, y: 1 },
          { x: 10, y: 1 },
        ],
      };
      mgr.setActive(true);
      mgr.updatePreview(result);

      const originals = mgr.getSegmentsByType('original');
      const pushed = mgr.getSegmentsByType('pushed');
      const arrows = mgr.getSegmentsByType('displacement_arrow');
      const routing = mgr.getSegmentsByType('routing');

      expect(originals.length).toBe(3);
      expect(pushed.length).toBe(3);
      expect(arrows.length).toBe(3);
      expect(routing.length).toBe(1);
    });

    it('all segment IDs are unique', () => {
      const result: PushShovePreviewResult = {
        pushedTraces: [
          makePushedTrace({ traceId: 'a' }),
          makePushedTrace({ traceId: 'b' }),
        ],
        routingTrace: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 10, y: 5 },
        ],
      };
      mgr.setActive(true);
      mgr.updatePreview(result);

      const allSegs = mgr.getPreviewSegments();
      const ids = allSegs.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('reports correct pushed trace count', () => {
      const result: PushShovePreviewResult = {
        pushedTraces: [
          makePushedTrace({ traceId: 'a' }),
          makePushedTrace({ traceId: 'b' }),
        ],
        routingTrace: [],
      };
      mgr.updatePreview(result);
      expect(mgr.getPushedTraceCount()).toBe(2);
    });

    it('reports correct total displacement', () => {
      const result: PushShovePreviewResult = {
        pushedTraces: [
          makePushedTrace({ traceId: 'a', displacement: 1.5 }),
          makePushedTrace({ traceId: 'b', displacement: 3.0 }),
        ],
        routingTrace: [],
      };
      mgr.updatePreview(result);
      expect(mgr.getTotalDisplacement()).toBeCloseTo(4.5);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('empty result produces no segments', () => {
      mgr.setActive(true);
      mgr.updatePreview({ pushedTraces: [], routingTrace: [] });

      expect(mgr.getPreviewSegments().length).toBe(0);
    });

    it('result with no pushed traces but routing trace works', () => {
      mgr.setActive(true);
      mgr.updatePreview({
        pushedTraces: [],
        routingTrace: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
      });

      const segs = mgr.getPreviewSegments();
      expect(segs.length).toBe(1);
      expect(segs[0].type).toBe('routing');
    });

    it('pushed traces with empty segment arrays', () => {
      const trace = makePushedTrace({
        originalSegments: [],
        newSegments: [],
        displacement: 0,
      });
      mgr.setActive(true);
      mgr.updatePreview({ pushedTraces: [trace], routingTrace: [] });

      expect(mgr.getPreviewSegments().length).toBe(0);
    });

    it('mismatched original/new segment counts only generates matching arrows', () => {
      const trace = makePushedTrace({
        originalSegments: [makeSeg(0, 0, 5, 0), makeSeg(5, 0, 10, 0)],
        newSegments: [makeSeg(0, 2, 5, 2)], // only 1 new segment
        displacement: 2,
      });
      mgr.setActive(true);
      mgr.updatePreview({ pushedTraces: [trace], routingTrace: [] });

      // 2 originals, 1 pushed, 1 arrow (min of counts)
      const originals = mgr.getSegmentsByType('original');
      const pushed = mgr.getSegmentsByType('pushed');
      const arrows = mgr.getSegmentsByType('displacement_arrow');

      expect(originals.length).toBe(2);
      expect(pushed.length).toBe(1);
      expect(arrows.length).toBe(1);
    });

    it('getPreviewSegments returns empty when inactive with data', () => {
      mgr.updatePreview(makeResult());
      expect(mgr.getPreviewSegments().length).toBe(0);
    });

    it('getSnapshot returns frozen segments array', () => {
      mgr.setActive(true);
      mgr.updatePreview(makeResult());
      const snapshot = mgr.getSnapshot();
      expect(Object.isFrozen(snapshot.segments)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Singleton + subscribe / unsubscribe
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    beforeEach(() => {
      resetPushShovePreviewManager();
    });

    it('getPushShovePreviewManager returns same instance', () => {
      const a = getPushShovePreviewManager();
      const b = getPushShovePreviewManager();
      expect(a).toBe(b);
    });

    it('resetPushShovePreviewManager clears singleton', () => {
      const a = getPushShovePreviewManager();
      resetPushShovePreviewManager();
      const b = getPushShovePreviewManager();
      expect(a).not.toBe(b);
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('notifies listeners on setActive', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.setActive(true);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on updatePreview', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.updatePreview(makeResult());
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on clearPreview', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.clearPreview();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on toggle', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.toggle();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);
      unsub();
      mgr.setActive(true);
      expect(listener).not.toHaveBeenCalled();
    });

    it('multiple listeners all get notified', () => {
      const l1 = vi.fn();
      const l2 = vi.fn();
      const l3 = vi.fn();
      mgr.subscribe(l1);
      mgr.subscribe(l2);
      mgr.subscribe(l3);
      mgr.setActive(true);
      expect(l1).toHaveBeenCalledTimes(1);
      expect(l2).toHaveBeenCalledTimes(1);
      expect(l3).toHaveBeenCalledTimes(1);
    });

    it('unsubscribing one listener does not affect others', () => {
      const l1 = vi.fn();
      const l2 = vi.fn();
      mgr.subscribe(l1);
      const unsub2 = mgr.subscribe(l2);
      unsub2();
      mgr.setActive(true);
      expect(l1).toHaveBeenCalledTimes(1);
      expect(l2).not.toHaveBeenCalled();
    });

    it('getSnapshot returns consistent state', () => {
      mgr.setActive(true);
      mgr.updatePreview(makeResult());

      const snap = mgr.getSnapshot();
      expect(snap.active).toBe(true);
      expect(snap.segments.length).toBeGreaterThan(0);

      // Snapshot is a new object each time but data matches
      const snap2 = mgr.getSnapshot();
      expect(snap2.active).toBe(snap.active);
      expect(snap2.segments).toBe(snap.segments); // same frozen array reference
    });
  });

  // -----------------------------------------------------------------------
  // Segment type identification
  // -----------------------------------------------------------------------

  describe('segment IDs include type prefix', () => {
    it('original segments prefixed with orig-', () => {
      mgr.setActive(true);
      mgr.updatePreview(makeResult());
      const originals = mgr.getSegmentsByType('original');
      for (const s of originals) {
        expect(s.id).toMatch(/^orig-/);
      }
    });

    it('pushed segments prefixed with pushed-', () => {
      mgr.setActive(true);
      mgr.updatePreview(makeResult());
      const pushed = mgr.getSegmentsByType('pushed');
      for (const s of pushed) {
        expect(s.id).toMatch(/^pushed-/);
      }
    });

    it('routing segments prefixed with routing-', () => {
      mgr.setActive(true);
      mgr.updatePreview(makeResult());
      const routing = mgr.getSegmentsByType('routing');
      for (const s of routing) {
        expect(s.id).toMatch(/^routing-/);
      }
    });

    it('displacement arrows prefixed with arrow-', () => {
      mgr.setActive(true);
      mgr.updatePreview(makeResult());
      const arrows = mgr.getSegmentsByType('displacement_arrow');
      for (const s of arrows) {
        expect(s.id).toMatch(/^arrow-/);
      }
    });
  });
});
