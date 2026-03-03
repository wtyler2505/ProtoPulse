/**
 * SnapGuideEngine — Snap-to-grid and snap-to-shape-edge logic layer.
 *
 * This module re-exports the core snap functions from the lib-level
 * `snap-engine.ts` and adds canvas-specific grid snapping.
 *
 * The visual rendering of snap guides lives in `SnapGuides.tsx`; this file
 * contains only the computation logic.
 */
import type { SnapTarget, SnapResult } from '@/lib/component-editor/snap-engine';

export type { SnapTarget, SnapResult };
export { computeSnap, getShapeBounds } from '@/lib/component-editor/snap-engine';

// ---------------------------------------------------------------------------
// Grid snapping
// ---------------------------------------------------------------------------

export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function snapPointToGrid(
  x: number,
  y: number,
  gridSize: number,
): { x: number; y: number } {
  return {
    x: snapToGrid(x, gridSize),
    y: snapToGrid(y, gridSize),
  };
}
