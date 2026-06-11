/**
 * diagram/drag.ts
 *
 * Unified drag origin + move computation with snap integration.
 *
 * Generalizes:
 *   client/src/components/views/component-editor/DragManager.ts
 *   (buildDragOrigins, computeDragMove + DragMoveResult)
 *
 * Design:
 * - Pure, generic over any "positioned item" with { id, position: Point, size? }
 *   Works for DiagramNode, GraphNode (Architecture), or mapped Shape objects.
 * - Selection / shiftKey logic preserved exactly (single, multi, toggle).
 * - Uses diagram/snap computeSnap on the *group hull* of selected dragged items
 *   (same as original) so whole selection snaps as rigid body.
 * - Returns DragMoveResult { moves: [{id, x, y}], guides: SnapTarget[] }
 * - No mutation. Callers apply the returned moves to state.
 *
 * Import from '@/lib/diagram' in Phase 1+ integration.
 */

import type { Point, MeasuredSize, SnapTarget, DragMoveResult } from './types';
import { computeSnap, getBounds } from './snap';

type PositionedItem = {
  id: string;
  position: Point;
  size?: MeasuredSize;
};

/**
 * Build the map of original positions for the items that will participate in a drag.
 * Mirrors the exact selection rules from the component-editor DragManager:
 * - no shift + unselected click: only the clicked item
 * - no shift + selected click: the whole current selection
 * - shift + unselected: add it
 * - shift + selected: remove it from the temp set, but ensure clicked is always included (fallback)
 */
export function buildDragOrigins(
  items: PositionedItem[],
  selectedIds: string[],
  itemId: string,
  shiftKey: boolean
): Map<string, { x: number; y: number }> {
  const origins = new Map<string, { x: number; y: number }>();

  const ids = shiftKey
    ? (selectedIds.includes(itemId)
        ? selectedIds.filter((id) => id !== itemId)
        : [...selectedIds, itemId])
    : (selectedIds.includes(itemId) ? selectedIds : [itemId]);

  items.forEach((item) => {
    if (ids.includes(item.id)) {
      origins.set(item.id, { x: item.position.x, y: item.position.y });
    }
  });

  if (!ids.includes(itemId)) {
    const item = items.find((i) => i.id === itemId);
    if (item) {
      origins.set(itemId, { x: item.position.x, y: item.position.y });
    }
  }

  return origins;
}

/**
 * Compute the final positions for a drag in progress, incorporating snap guides.
 * Generic: items provide current (pre-drag) state for hull calc + exclude set.
 * dragOrigins: the starting positions captured at gesture start.
 * dragStart / currentPos: pointer positions in *world* space.
 * Returns moves (new absolute positions) + any active snap guides for rendering.
 */
export function computeDragMove(
  dragOrigins: Map<string, { x: number; y: number }>,
  dragStart: Point,
  currentPos: Point,
  items: PositionedItem[]
): DragMoveResult {
  const rawDx = currentPos.x - dragStart.x;
  const rawDy = currentPos.y - dragStart.y;

  const draggedIds = Array.from(dragOrigins.keys());

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  draggedIds.forEach((id) => {
    const origin = dragOrigins.get(id);
    if (!origin) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;

    // Use getBounds to obtain width/height (supports variable size or default)
    const b = getBounds(item);
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
    left: minX,
    right: maxX,
    top: minY,
    bottom: maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };

  const snapResult = computeSnap(movingBounds, items, draggedIds);

  const snapDx = snapResult.snappedX - minX;
  const snapDy = snapResult.snappedY - minY;

  const moves = Array.from(dragOrigins.entries()).map(([id, o]) => ({
    id,
    x: o.x + rawDx + snapDx,
    y: o.y + rawDy + snapDy,
  }));

  return { moves, guides: snapResult.guides };
}
