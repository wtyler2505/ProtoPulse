/**
 * DragManager — Shape drag logic with snap integration.
 *
 * Pure functions that compute new positions given drag state and snap results.
 * The actual state updates are dispatched by the orchestrator (ShapeCanvas).
 */
import type { Shape } from '@shared/component-types';
import { computeSnap, getShapeBounds } from '@/lib/component-editor/snap-engine';
import type { SnapTarget } from '@/lib/component-editor/snap-engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DragMoveResult {
  moves: Array<{ id: string; x: number; y: number }>;
  guides: SnapTarget[];
}

// ---------------------------------------------------------------------------
// Build initial drag origins from current selection
// ---------------------------------------------------------------------------

export function buildDragOrigins(
  shapes: Shape[],
  selectedIds: string[],
  shapeId: string,
  shiftKey: boolean,
): Map<string, { x: number; y: number }> {
  const origins = new Map<string, { x: number; y: number }>();
  const ids = shiftKey
    ? (selectedIds.includes(shapeId) ? selectedIds.filter((id) => id !== shapeId) : [...selectedIds, shapeId])
    : (selectedIds.includes(shapeId) ? selectedIds : [shapeId]);
  shapes.forEach((s) => {
    if (ids.includes(s.id)) { origins.set(s.id, { x: s.x, y: s.y }); }
  });
  if (!ids.includes(shapeId)) {
    const shape = shapes.find((s) => s.id === shapeId);
    if (shape) { origins.set(shapeId, { x: shape.x, y: shape.y }); }
  }
  return origins;
}

// ---------------------------------------------------------------------------
// Compute snapped drag positions
// ---------------------------------------------------------------------------

export function computeDragMove(
  dragOrigins: Map<string, { x: number; y: number }>,
  dragStart: { x: number; y: number },
  currentPos: { x: number; y: number },
  shapes: Shape[],
): DragMoveResult {
  const rawDx = currentPos.x - dragStart.x;
  const rawDy = currentPos.y - dragStart.y;

  const draggedIds = Array.from(dragOrigins.keys());
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  Array.from(dragOrigins.entries()).forEach(([id, origin]) => {
    const shape = shapes.find((s) => s.id === id);
    if (!shape) { return; }
    const b = getShapeBounds(shape);
    const w = b.right - b.left;
    const h = b.bottom - b.top;
    const newLeft = origin.x + rawDx;
    const newTop = origin.y + rawDy;
    minX = Math.min(minX, newLeft);
    minY = Math.min(minY, newTop);
    maxX = Math.max(maxX, newLeft + w);
    maxY = Math.max(maxY, newTop + h);
  });

  const movingBounds = {
    left: minX, right: maxX, top: minY, bottom: maxY,
    centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2,
  };

  const snapResult = computeSnap(movingBounds, shapes, draggedIds);
  const snapDx = snapResult.snappedX - minX;
  const snapDy = snapResult.snappedY - minY;

  const moves = Array.from(dragOrigins.entries()).map(([id, o]) => ({
    id, x: o.x + rawDx + snapDx, y: o.y + rawDy + snapDy,
  }));

  return { moves, guides: snapResult.guides };
}
