/**
 * diagram/index.ts
 *
 * Clean public barrel for the shared diagram primitives library.
 * Phase 0 complete (Agent B scaffold + Agent C snap/drag/hit/anchors).
 *
 * Import as:
 *   import {
 *     // types
 *     Point, MeasuredSize, NodeAnchor, AnchorKind, SnapTarget, SnapResult, DragMoveResult,
 *     // coordinate
 *     screenToWorld, computeWheelZoom, computeZoomToFitNodes, snapValue, clampZoom,
 *     // snap/drag/hit/anchors
 *     getBounds, computeSnap, buildDragOrigins, computeDragMove, shapesInMarquee, getNodeAnchor,
 *     ...
 *   } from '@/lib/diagram';
 */

export * from './types';
export * from './coordinate';
export * from './snap';
export * from './drag';
export * from './hit';
export * from './anchors';

// Re-export key constants under short names for ergonomics (already exported from coordinate)
export {
  DEFAULT_COORDINATE_CONFIG,
  ARCHITECTURE_DEFAULTS,
  PCB_DEFAULTS,
} from './types';
