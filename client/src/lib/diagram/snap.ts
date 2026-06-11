/**
 * diagram/snap.ts
 *
 * Unified snap + bounds logic for diagram canvases.
 *
 * Generalizes the proven implementation from:
 *   client/src/lib/component-editor/snap-engine.ts (computeSnap, getShapeBounds, SnapTarget/Result)
 *
 * Design:
 * - Pure functions, zero side effects.
 * - Works on plain rect-like objects (GraphNode / DiagramNode style: {position, size?})
 *   and legacy Shape style {x, y, width, height}.
 * - getBounds (aliased as getShapeBounds for easy compat shims in old modules).
 * - computeSnap accepts precomputed movingBounds (for group drag hulls) or single item;
 *   otherItems can be any shape/node-like with id.
 * - Uses same edge set (left/center/right , top/middle/bottom) and closest-wins logic.
 * - Default threshold 5 (component-editor heritage); Architecture will pass grid-aware or keep.
 * - No dependency on React or view-specific types.
 *
 * Later consumers (Architecture edge snap, component shapes, PCB) import from '@/lib/diagram'.
 */

import type { Point, MeasuredSize, SnapTarget, SnapResult } from './types';

const SNAP_THRESHOLD = 5;

const DEFAULT_NODE_SIZE: MeasuredSize = { width: 150, height: 70 };

/** Internal: extract position from either {position} or {x,y} style. */
function getItemPosition(item: any): Point {
  if (item && typeof item.position === 'object' && item.position !== null) {
    return { x: Number(item.position.x) || 0, y: Number(item.position.y) || 0 };
  }
  return { x: Number(item?.x) || 0, y: Number(item?.y) || 0 };
}

/** Internal: extract size preferring explicit measuredSize, node.size, {w,h}, or sensible 150x70 fallback. */
function getItemSize(item: any): MeasuredSize {
  if (item?.size && typeof item.size.width === 'number' && typeof item.size.height === 'number') {
    return { width: item.size.width, height: item.size.height };
  }
  if (typeof item?.width === 'number' && typeof item?.height === 'number') {
    return { width: item.width, height: item.height };
  }
  return DEFAULT_NODE_SIZE;
}

/**
 * Generic bounds extractor.
 * Accepts GraphNode/DiagramNode style or plain rect {x,y,width,height}.
 * Falls back to 150×70 when size is absent (Architecture compat until measured sizes are wired).
 * Returns the six-edge object used by computeSnap (and by original getShapeBounds).
 */
export function getBounds(item: any): {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
} {
  const pos = getItemPosition(item);
  const sz = getItemSize(item);
  const x = pos.x;
  const y = pos.y;
  const w = sz.width;
  const h = sz.height;
  return {
    left: x,
    right: x + w,
    top: y,
    bottom: y + h,
    centerX: x + w / 2,
    centerY: y + h / 2,
  };
}

/**
 * Alias for getBounds — allows drop-in name compatibility when old modules
 * gradually shim their imports (e.g. re-export getShapeBounds from diagram in a future pass).
 * Does not import or know about @shared/component-types Shape.
 */
export const getShapeBounds = getBounds;

/**
 * Core snap computation.
 * movingBounds: the AABB (with centers) of the item or group hull being dragged.
 * otherItems: array of node/shape-like objects (must have .id for guides + exclude).
 * excludeIds: ids that must not snap against (the dragged set).
 * threshold: pixel distance in world units to consider a candidate (default 5).
 *
 * Returns snapped top-left of the *moving group hull* + the winning guide(s).
 * Callers (e.g. computeDragMove) then apply the delta uniformly to members.
 */
export function computeSnap(
  movingBoundsOrItem:
    | { left: number; right: number; top: number; bottom: number; centerX: number; centerY: number }
    | any,
  otherItems: any[],
  excludeIds: string[] = [],
  threshold: number = SNAP_THRESHOLD
): SnapResult {
  const movingBounds =
    movingBoundsOrItem &&
    typeof movingBoundsOrItem.left === 'number' &&
    typeof movingBoundsOrItem.right === 'number'
      ? movingBoundsOrItem
      : getBounds(movingBoundsOrItem);

  let dx = 0;
  let dy = 0;
  let bestXDist = Infinity;
  let bestYDist = Infinity;
  let xGuides: SnapTarget[] = [];
  let yGuides: SnapTarget[] = [];

  const others = otherItems.filter((s) => {
    const sid = (s as any)?.id;
    return typeof sid === 'string' ? !excludeIds.includes(sid) : true;
  });

  const movingXEdges = [
    { value: movingBounds.left, edge: 'left' },
    { value: movingBounds.centerX, edge: 'center' },
    { value: movingBounds.right, edge: 'right' },
  ];

  const movingYEdges = [
    { value: movingBounds.top, edge: 'top' },
    { value: movingBounds.centerY, edge: 'middle' },
    { value: movingBounds.bottom, edge: 'bottom' },
  ];

  for (const other of others) {
    const ob = getBounds(other);
    const targetXEdges = [
      { value: ob.left, edge: 'left' },
      { value: ob.centerX, edge: 'center' },
      { value: ob.right, edge: 'right' },
    ];
    const targetYEdges = [
      { value: ob.top, edge: 'top' },
      { value: ob.centerY, edge: 'middle' },
      { value: ob.bottom, edge: 'bottom' },
    ];

    for (const me of movingXEdges) {
      for (const te of targetXEdges) {
        const dist = Math.abs(me.value - te.value);
        if (dist > threshold) continue;
        const guide: SnapTarget = {
          axis: 'x',
          value: te.value,
          sourceEdge: me.edge,
          targetShapeId: (other as any)?.id ?? 'unknown',
          targetEdge: te.edge,
        };
        if (dist < bestXDist) {
          bestXDist = dist;
          dx = te.value - me.value;
          xGuides = [guide];
        } else if (dist === bestXDist) {
          xGuides.push(guide);
        }
      }
    }

    for (const me of movingYEdges) {
      for (const te of targetYEdges) {
        const dist = Math.abs(me.value - te.value);
        if (dist > threshold) continue;
        const guide: SnapTarget = {
          axis: 'y',
          value: te.value,
          sourceEdge: me.edge,
          targetShapeId: (other as any)?.id ?? 'unknown',
          targetEdge: te.edge,
        };
        if (dist < bestYDist) {
          bestYDist = dist;
          dy = te.value - me.value;
          yGuides = [guide];
        } else if (dist === bestYDist) {
          yGuides.push(guide);
        }
      }
    }
  }

  return {
    snappedX: movingBounds.left + dx,
    snappedY: movingBounds.top + dy,
    guides: [...xGuides, ...yGuides],
  };
}
