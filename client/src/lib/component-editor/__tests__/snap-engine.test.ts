import { describe, it, expect } from 'vitest';
import { getShapeBounds, computeSnap, type SnapResult } from '../snap-engine';
import type { RectShape, CircleShape, Shape } from '@shared/component-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRect(id: string, x: number, y: number, w = 50, h = 50): RectShape {
  return { id, type: 'rect', x, y, width: w, height: h, rotation: 0 };
}

function makeCircle(id: string, cx: number, cy: number, w = 50, h = 50): CircleShape {
  return { id, type: 'circle', x: cx - w / 2, y: cy - h / 2, width: w, height: h, rotation: 0, cx, cy };
}

// ---------------------------------------------------------------------------
// getShapeBounds
// ---------------------------------------------------------------------------

describe('getShapeBounds', () => {
  it('returns correct bounds for a rect', () => {
    const rect = makeRect('r1', 10, 20, 100, 60);
    const bounds = getShapeBounds(rect);
    expect(bounds.left).toBe(10);
    expect(bounds.right).toBe(110);
    expect(bounds.top).toBe(20);
    expect(bounds.bottom).toBe(80);
    expect(bounds.centerX).toBe(60);
    expect(bounds.centerY).toBe(50);
  });

  it('returns correct bounds for a circle', () => {
    const circle = makeCircle('c1', 100, 100, 60, 60);
    const bounds = getShapeBounds(circle);
    const r = 30; // min(60,60)/2
    expect(bounds.left).toBe(70);   // 100 - 30
    expect(bounds.right).toBe(130); // 100 + 30
    expect(bounds.top).toBe(70);
    expect(bounds.bottom).toBe(130);
    expect(bounds.centerX).toBe(100);
    expect(bounds.centerY).toBe(100);
  });

  it('handles zero-size shape', () => {
    const rect = makeRect('r0', 50, 50, 0, 0);
    const bounds = getShapeBounds(rect);
    expect(bounds.left).toBe(50);
    expect(bounds.right).toBe(50);
    expect(bounds.centerX).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// computeSnap
// ---------------------------------------------------------------------------

describe('computeSnap', () => {
  it('snaps left edge to another shape left edge', () => {
    const target = makeRect('t1', 100, 50, 60, 40);
    const movingBounds = { left: 102, right: 162, top: 200, bottom: 240, centerX: 132, centerY: 220 };
    const result = computeSnap(movingBounds, [target], []);
    // left edge 102 should snap to target left 100 (dist=2, within default threshold 5)
    expect(result.snappedX).toBe(100);
    expect(result.guides.some(g => g.axis === 'x' && g.value === 100)).toBe(true);
  });

  it('snaps center to center vertically', () => {
    const target = makeRect('t1', 50, 50, 100, 100); // centerY = 100
    const movingBounds = { left: 200, right: 260, top: 48, bottom: 148, centerX: 230, centerY: 98 };
    const result = computeSnap(movingBounds, [target], []);
    // centerY 98 snaps to target centerY 100 (dist=2)
    // snappedY = movingBounds.top + dy = 48 + (100-98) = 50
    expect(result.snappedY).toBe(50);
  });

  it('returns original position when no shapes are within threshold', () => {
    const target = makeRect('t1', 500, 500);
    const movingBounds = { left: 10, right: 60, top: 10, bottom: 60, centerX: 35, centerY: 35 };
    const result = computeSnap(movingBounds, [target], []);
    expect(result.snappedX).toBe(10);
    expect(result.snappedY).toBe(10);
    expect(result.guides).toEqual([]);
  });

  it('excludes shapes in the exclude list', () => {
    const target = makeRect('t1', 10, 10, 50, 50); // left=10
    const movingBounds = { left: 12, right: 62, top: 200, bottom: 250, centerX: 37, centerY: 225 };
    const result = computeSnap(movingBounds, [target], ['t1']);
    // t1 is excluded, so no snap
    expect(result.snappedX).toBe(12);
    expect(result.guides).toEqual([]);
  });

  it('uses custom threshold', () => {
    const target = makeRect('t1', 100, 50);
    const movingBounds = { left: 108, right: 158, top: 200, bottom: 250, centerX: 133, centerY: 225 };
    // With threshold 5 (default), dist=8 is too far
    const noSnap = computeSnap(movingBounds, [target], [], 5);
    expect(noSnap.snappedX).toBe(108);
    // With threshold 10, dist=8 should snap
    const withSnap = computeSnap(movingBounds, [target], [], 10);
    expect(withSnap.snappedX).toBe(100);
  });

  it('returns both x and y guides when both snap', () => {
    const target = makeRect('t1', 100, 100, 50, 50); // left=100, top=100
    const movingBounds = { left: 102, right: 152, top: 98, bottom: 148, centerX: 127, centerY: 123 };
    const result = computeSnap(movingBounds, [target], []);
    const xGuides = result.guides.filter(g => g.axis === 'x');
    const yGuides = result.guides.filter(g => g.axis === 'y');
    expect(xGuides.length).toBeGreaterThanOrEqual(1);
    expect(yGuides.length).toBeGreaterThanOrEqual(1);
  });

  it('picks the closest snap when multiple edges compete', () => {
    // Two targets: one at x=100, one at x=104
    const t1 = makeRect('t1', 100, 0);
    const t2 = makeRect('t2', 104, 0);
    const movingBounds = { left: 103, right: 153, top: 200, bottom: 250, centerX: 128, centerY: 225 };
    const result = computeSnap(movingBounds, [t1, t2], []);
    // Dist to t1 left: |103-100|=3, dist to t2 left: |103-104|=1
    // Should snap to t2 (closer)
    expect(result.snappedX).toBe(104);
  });

  it('handles empty shapes array', () => {
    const movingBounds = { left: 10, right: 60, top: 10, bottom: 60, centerX: 35, centerY: 35 };
    const result = computeSnap(movingBounds, [], []);
    expect(result.snappedX).toBe(10);
    expect(result.snappedY).toBe(10);
    expect(result.guides).toEqual([]);
  });
});
