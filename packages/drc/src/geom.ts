import type { Vec } from '@protopulse/graph';

/**
 * Geometry helpers for DRC, all in integer-nm inputs. Distances come
 * back as (possibly fractional) nm doubles — nm-scale magnitudes are
 * far inside double precision, so the math stays exact enough that a
 * sub-nm error can never flip a check whose thresholds are ≥1000nm.
 */

export interface Aabb {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Axis-aligned rectangle by center and full extents. */
export interface Rect {
  at: Vec;
  wNm: number;
  hNm: number;
}

export function inflateAabb(box: Aabb, by: number): Aabb {
  return { minX: box.minX - by, minY: box.minY - by, maxX: box.maxX + by, maxY: box.maxY + by };
}

export function segAabb(a: Vec, b: Vec): Aabb {
  return {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
  };
}

export function rectAabb(rect: Rect): Aabb {
  return {
    minX: rect.at.x - rect.wNm / 2,
    minY: rect.at.y - rect.hNm / 2,
    maxX: rect.at.x + rect.wNm / 2,
    maxY: rect.at.y + rect.hNm / 2,
  };
}

/** Distance from point p to segment ab (degenerate ab = point distance). */
export function pointSegDistance(p: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

function orient(a: Vec, b: Vec, c: Vec): number {
  return Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
}

function onSegment(a: Vec, b: Vec, p: Vec): boolean {
  return (
    Math.min(a.x, b.x) <= p.x &&
    p.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= p.y &&
    p.y <= Math.max(a.y, b.y)
  );
}

/** Proper or touching intersection of segments a1b1 and a2b2. */
export function segmentsIntersect(a1: Vec, b1: Vec, a2: Vec, b2: Vec): boolean {
  const o1 = orient(a1, b1, a2);
  const o2 = orient(a1, b1, b2);
  const o3 = orient(a2, b2, a1);
  const o4 = orient(a2, b2, b1);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a1, b1, a2)) return true;
  if (o2 === 0 && onSegment(a1, b1, b2)) return true;
  if (o3 === 0 && onSegment(a2, b2, a1)) return true;
  if (o4 === 0 && onSegment(a2, b2, b1)) return true;
  return false;
}

/** Minimum distance between two segments (0 when they intersect). */
export function segSegDistance(a1: Vec, b1: Vec, a2: Vec, b2: Vec): number {
  if (segmentsIntersect(a1, b1, a2, b2)) return 0;
  return Math.min(
    pointSegDistance(a2, a1, b1),
    pointSegDistance(b2, a1, b1),
    pointSegDistance(a1, a2, b2),
    pointSegDistance(b1, a2, b2),
  );
}

function rectCorners(rect: Rect): [Vec, Vec, Vec, Vec] {
  const hw = rect.wNm / 2;
  const hh = rect.hNm / 2;
  return [
    { x: rect.at.x - hw, y: rect.at.y - hh },
    { x: rect.at.x + hw, y: rect.at.y - hh },
    { x: rect.at.x + hw, y: rect.at.y + hh },
    { x: rect.at.x - hw, y: rect.at.y + hh },
  ];
}

function pointInRect(p: Vec, rect: Rect): boolean {
  return (
    Math.abs(p.x - rect.at.x) <= rect.wNm / 2 && Math.abs(p.y - rect.at.y) <= rect.hNm / 2
  );
}

/** Minimum distance from segment ab to an axis-aligned rect (0 inside). */
export function segRectDistance(a: Vec, b: Vec, rect: Rect): number {
  if (pointInRect(a, rect) || pointInRect(b, rect)) return 0;
  const [c1, c2, c3, c4] = rectCorners(rect);
  return Math.min(
    segSegDistance(a, b, c1, c2),
    segSegDistance(a, b, c2, c3),
    segSegDistance(a, b, c3, c4),
    segSegDistance(a, b, c4, c1),
  );
}

/** Minimum distance between two axis-aligned rects (0 when overlapping). */
export function rectRectDistance(r1: Rect, r2: Rect): number {
  const dx = Math.max(0, Math.abs(r1.at.x - r2.at.x) - (r1.wNm + r2.wNm) / 2);
  const dy = Math.max(0, Math.abs(r1.at.y - r2.at.y) - (r1.hNm + r2.hNm) / 2);
  return Math.hypot(dx, dy);
}
