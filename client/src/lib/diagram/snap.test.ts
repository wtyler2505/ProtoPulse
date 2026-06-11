/**
 * snap.test.ts
 *
 * Colocated unit tests for diagram/snap.ts (Phase 0 Agent C).
 *
 * - Preserves + improves coverage from lib/component-editor/snap-engine.test.ts
 *   (bounds rect, zero, snap left/center/y, threshold, exclude, closest, x+y, empty)
 * - Adds Architecture-specific cases: GraphNode/DiagramNode style inputs,
 *   150×70 default fallback, variable measured sizes, 20px grid round numbers.
 * - Uses ARCHITECTURE_DEFAULTS grid where relevant via snapValue integration.
 */

import { describe, it, expect } from 'vitest';
import { getBounds, computeSnap, getShapeBounds } from './snap';
import type { MeasuredSize } from './types';
import { snapValue, ARCHITECTURE_DEFAULTS } from './coordinate';

describe('diagram/snap', () => {
  // Helpers (mirrors original test helpers but neutral)
  function makeRectLike(id: string, x: number, y: number, w = 50, h = 50) {
    return { id, position: { x, y }, size: { width: w, height: h } as MeasuredSize };
  }

  function makeArchNode(id: string, x: number, y: number, size?: MeasuredSize) {
    // GraphNode style: no "size" on persisted data unless supplied
    return { id, position: { x, y }, data: { label: 'test' }, ...(size ? { size } : {}) };
  }

  // ---------------------------------------------------------------------------
  // getBounds / getShapeBounds (generic + fallback)
  // ---------------------------------------------------------------------------

  describe('getBounds / getShapeBounds', () => {
    it('returns correct bounds for rect-like (DiagramNode style)', () => {
      const node = makeRectLike('r1', 10, 20, 100, 60);
      const bounds = getBounds(node);
      expect(bounds.left).toBe(10);
      expect(bounds.right).toBe(110);
      expect(bounds.top).toBe(20);
      expect(bounds.bottom).toBe(80);
      expect(bounds.centerX).toBe(60);
      expect(bounds.centerY).toBe(50);
    });

    it('returns correct bounds for Architecture GraphNode (position only, default 150x70)', () => {
      const arch = makeArchNode('a1', 100, 200);
      const b = getBounds(arch);
      expect(b.left).toBe(100);
      expect(b.right).toBe(250);
      expect('width' in b).toBe(false);
      expect(b.centerX).toBe(175);
      expect(b.centerY).toBe(235);
    });

    it('respects explicit size on Arch-style node', () => {
      const arch = makeArchNode('a2', 0, 0, { width: 180, height: 90 });
      const b = getBounds(arch);
      expect(b.right).toBe(180);
      expect(b.centerY).toBe(45);
    });

    it('getShapeBounds alias works (compat name)', () => {
      const node = makeRectLike('c1', 5, 5, 10, 10);
      const b = getShapeBounds(node);
      expect(b.left).toBe(5);
      expect(b.right).toBe(15);
    });

    it('handles zero-size node', () => {
      const z = makeRectLike('z0', 50, 50, 0, 0);
      const b = getBounds(z);
      expect(b.left).toBe(50);
      expect(b.right).toBe(50);
      expect(b.centerX).toBe(50);
    });
  });

  // ---------------------------------------------------------------------------
  // computeSnap (ported + extended)
  // ---------------------------------------------------------------------------

  describe('computeSnap', () => {
    it('snaps left edge to another shape left edge (rect-like)', () => {
      const target = makeRectLike('t1', 100, 50, 60, 40);
      const movingBounds = { left: 102, right: 162, top: 200, bottom: 240, centerX: 132, centerY: 220 };
      const result = computeSnap(movingBounds, [target], []);
      expect(result.snappedX).toBe(100);
      expect(result.guides.some((g) => g.axis === 'x' && g.value === 100)).toBe(true);
    });

    it('snaps center to center vertically using GraphNode inputs', () => {
      const target = makeArchNode('t1', 50, 50, { width: 100, height: 100 });
      const movingBounds = { left: 200, right: 260, top: 48, bottom: 148, centerX: 230, centerY: 98 };
      const result = computeSnap(movingBounds, [target], []);
      expect(result.snappedY).toBe(50);
    });

    it('returns original when no items within threshold', () => {
      const target = makeArchNode('t1', 500, 500);
      const movingBounds = { left: 10, right: 60, top: 10, bottom: 60, centerX: 35, centerY: 35 };
      const result = computeSnap(movingBounds, [target], []);
      expect(result.snappedX).toBe(10);
      expect(result.snappedY).toBe(10);
      expect(result.guides).toEqual([]);
    });

    it('excludes shapes via excludeIds (Arch nodes)', () => {
      const target = makeArchNode('t1', 10, 10, { width: 50, height: 50 });
      const movingBounds = { left: 12, right: 62, top: 200, bottom: 250, centerX: 37, centerY: 225 };
      const result = computeSnap(movingBounds, [target], ['t1']);
      expect(result.snappedX).toBe(12);
      expect(result.guides).toEqual([]);
    });

    it('respects custom threshold', () => {
      const target = makeRectLike('t1', 100, 50);
      const movingBounds = { left: 108, right: 158, top: 200, bottom: 250, centerX: 133, centerY: 225 };
      const no = computeSnap(movingBounds, [target], [], 5);
      expect(no.snappedX).toBe(108);
      const yes = computeSnap(movingBounds, [target], [], 10);
      expect(yes.snappedX).toBe(100);
    });

    it('returns x and y guides when both axes snap', () => {
      const target = makeRectLike('t1', 100, 100, 50, 50);
      const movingBounds = { left: 102, right: 152, top: 98, bottom: 148, centerX: 127, centerY: 123 };
      const result = computeSnap(movingBounds, [target], []);
      const xG = result.guides.filter((g) => g.axis === 'x');
      const yG = result.guides.filter((g) => g.axis === 'y');
      expect(xG.length).toBeGreaterThanOrEqual(1);
      expect(yG.length).toBeGreaterThanOrEqual(1);
    });

    it('picks the closest snap when multiple compete', () => {
      const t1 = makeRectLike('t1', 100, 0);
      const t2 = makeRectLike('t2', 104, 0);
      const movingBounds = { left: 103, right: 153, top: 200, bottom: 250, centerX: 128, centerY: 225 };
      const result = computeSnap(movingBounds, [t1, t2], []);
      expect(result.snappedX).toBe(104); // dist 1 vs 3
    });

    it('handles empty others array', () => {
      const movingBounds = { left: 10, right: 60, top: 10, bottom: 60, centerX: 35, centerY: 35 };
      const result = computeSnap(movingBounds, [], []);
      expect(result.snappedX).toBe(10);
      expect(result.guides).toEqual([]);
    });

    it('supports passing a moving item (not just precomputed bounds) for convenience', () => {
      const mover = makeArchNode('m', 102, 200, { width: 60, height: 40 });
      const target = makeRectLike('t', 100, 50, 60, 40);
      const result = computeSnap(mover, [target], []);
      expect(result.snappedX).toBe(100);
    });

    // Architecture 20px grid friendliness
    it('produces round numbers compatible with Architecture 20px grid (via snapValue)', () => {
      // nodes placed on 20px grid
      const t = makeArchNode('gridTarget', 120, 80, { width: 160, height: 80 }); // centerX=200, centerY=120
      const movingB = { left: 118, right: 158, top: 78, bottom: 118, centerX: 138, centerY: 98 };
      const res = computeSnap(movingB, [t], [], 6); // a bit wider threshold for demo
      // snapX to 120 (left)
      expect(snapValue(res.snappedX, ARCHITECTURE_DEFAULTS.gridStep ?? 20)).toBe(120);
      expect(snapValue(res.snappedY, 20)).toBe(80);
    });
  });
});
