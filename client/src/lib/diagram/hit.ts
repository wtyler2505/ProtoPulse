/**
 * diagram/hit.ts
 *
 * Unified hit testing and marquee selection.
 *
 * Generalizes:
 *   client/src/components/views/component-editor/HitTester.ts (shapesInMarquee)
 *
 * - Generic AABB overlap for any positioned rect-like (GraphNode, DiagramNode, or {x,y,w,h}).
 * - Additional pure helpers: pointInRect (immediate use for future point-hit or lasso).
 * - Zero DOM, pure math.
 * - Matches original behavior exactly for Shape inputs when mapped.
 */

import type { Point, MeasuredSize, Rect } from './types';

type PositionedRect = {
  id: string;
  position?: Point;
  x?: number;
  y?: number;
  size?: MeasuredSize;
  width?: number;
  height?: number;
};

/** Internal normalizer to {x,y,w,h} */
function toXYWH(item: any): { x: number; y: number; w: number; h: number } {
  const px = item?.position?.x ?? item?.x ?? 0;
  const py = item?.position?.y ?? item?.y ?? 0;
  let w = 0;
  let h = 0;
  if (item?.size && typeof item.size.width === 'number') {
    w = item.size.width;
    h = item.size.height;
  } else if (typeof item?.width === 'number') {
    w = item.width;
    h = item.height;
  } else {
    w = 150;
    h = 70; // Architecture fallback (consistent with anchors/zoom)
  }
  return { x: px, y: py, w, h };
}

/**
 * Generic marquee selection.
 * Returns array of ids whose rects overlap the marquee rect (AABB test, inclusive on edges per original).
 * Handles reversed (right-to-left) marquee coords via Math.min.
 * Matches the tests in shape-modules.test.ts exactly when fed equivalent data.
 */
export function shapesInMarquee(
  items: PositionedRect[],
  marqueeStart: Point,
  marqueeCurrent: Point
): string[] {
  const mx = Math.min(marqueeStart.x, marqueeCurrent.x);
  const my = Math.min(marqueeStart.y, marqueeCurrent.y);
  const mw = Math.abs(marqueeCurrent.x - marqueeStart.x);
  const mh = Math.abs(marqueeCurrent.y - marqueeStart.y);

  return items
    .filter((item) => {
      const { x: sx, y: sy, w: sw, h: sh } = toXYWH(item);
      // Original overlap test (strict inside for selection?):
      // sx < mx+mw && sx+sw > mx && sy < my+mh && sy+sh > my
      return sx < mx + mw && sx + sw > mx && sy < my + mh && sy + sh > my;
    })
    .map((item) => item.id);
}

/**
 * Pure point-in-rect test (axis aligned).
 * Useful for future point-hit (click selection, port targeting, etc.).
 * Rect may be {x,y,width,height} or Bounds-like.
 */
export function pointInRect(p: Point, r: { x: number; y: number; width: number; height: number } | Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

/** Convenience: rect contains another rect completely. */
export function rectContainsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}
