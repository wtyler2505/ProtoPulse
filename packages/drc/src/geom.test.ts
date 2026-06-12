import { describe, expect, it } from 'vitest';

import {
  inflateAabb,
  pointSegDistance,
  rectAabb,
  rectRectDistance,
  segAabb,
  segRectDistance,
  segSegDistance,
  segmentsIntersect,
} from './geom.js';

import type { Rect } from './geom.js';

const rect = (x: number, y: number, w: number, h: number): Rect => ({ at: { x, y }, wNm: w, hNm: h });

describe('pointSegDistance', () => {
  it('projects onto the segment interior', () => {
    expect(pointSegDistance({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
  });

  it('clamps to the nearest endpoint beyond the ends', () => {
    expect(pointSegDistance({ x: -3, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
    expect(pointSegDistance({ x: 13, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
  });

  it('handles a degenerate (zero-length) segment as a point', () => {
    expect(pointSegDistance({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });
});

describe('segmentsIntersect / segSegDistance', () => {
  it('crossing segments intersect and have zero distance', () => {
    const args = [{ x: 0, y: -5 }, { x: 0, y: 5 }, { x: -5, y: 0 }, { x: 5, y: 0 }] as const;
    expect(segmentsIntersect(...args)).toBe(true);
    expect(segSegDistance(...args)).toBe(0);
  });

  it('touching endpoints count as intersecting', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 0 }, { x: 9, y: 9 })).toBe(true);
  });

  it('collinear overlapping segments intersect; separated ones measure the gap', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 3, y: 0 }, { x: 9, y: 0 })).toBe(true);
    expect(segSegDistance({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 8, y: 0 }, { x: 12, y: 0 })).toBe(3);
  });

  it('parallel segments measure the perpendicular gap', () => {
    expect(segSegDistance({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 7 }, { x: 10, y: 7 })).toBe(7);
  });

  it('skew non-crossing segments measure endpoint-to-segment distance', () => {
    expect(segSegDistance({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 4, y: 3 }, { x: 4, y: 9 })).toBe(3);
  });
});

describe('segRectDistance', () => {
  it('is zero when an endpoint is inside or the segment crosses through', () => {
    expect(segRectDistance({ x: 0, y: 0 }, { x: 20, y: 0 }, rect(0, 0, 4, 4))).toBe(0);
    expect(segRectDistance({ x: -20, y: 0 }, { x: 20, y: 0 }, rect(0, 0, 4, 4))).toBe(0);
  });

  it('measures the gap to the nearest edge outside', () => {
    expect(segRectDistance({ x: 0, y: 10 }, { x: 20, y: 10 }, rect(0, 0, 4, 4))).toBe(8);
    expect(segRectDistance({ x: 10, y: -9 }, { x: 10, y: 9 }, rect(0, 0, 4, 4))).toBe(8);
  });
});

describe('rectRectDistance', () => {
  it('is zero for overlapping or touching rects', () => {
    expect(rectRectDistance(rect(0, 0, 4, 4), rect(1, 1, 4, 4))).toBe(0);
    expect(rectRectDistance(rect(0, 0, 4, 4), rect(4, 0, 4, 4))).toBe(0);
  });

  it('measures axis and diagonal gaps', () => {
    expect(rectRectDistance(rect(0, 0, 4, 4), rect(10, 0, 4, 4))).toBe(6);
    expect(rectRectDistance(rect(0, 0, 4, 4), rect(5, 6, 2, 2))).toBe(Math.hypot(2, 3));
  });
});

describe('aabb helpers', () => {
  it('segAabb and rectAabb bound their shapes; inflateAabb grows symmetrically', () => {
    expect(segAabb({ x: 5, y: -2 }, { x: 1, y: 9 })).toEqual({ minX: 1, minY: -2, maxX: 5, maxY: 9 });
    expect(rectAabb(rect(10, 10, 4, 2))).toEqual({ minX: 8, minY: 9, maxX: 12, maxY: 11 });
    expect(inflateAabb({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, 3)).toEqual({ minX: -3, minY: -3, maxX: 4, maxY: 4 });
  });
});
