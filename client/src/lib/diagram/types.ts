/**
 * diagram/types.ts
 *
 * Core shared types for the unified diagram / canvas interaction layer.
 * Pure data types — no React, framework agnostic.
 * Designed for compatibility with GraphNode (architecture), Shape (component-editor),
 * board elements (pcb-layout), and future tldraw boundary objects.
 *
 * This is the single source of truth for Point, MeasuredSize, anchors, snap results,
 * drag results, viewport math outputs, etc. Later modules (coordinate, snap, anchors)
 * re-export or build on these.
 */

// ---------------------------------------------------------------------------
// Basic geometry
// ---------------------------------------------------------------------------

/** 2D point in world/canvas/screen space (units depend on caller). */
export interface Point {
  x: number;
  y: number;
}

/** Measured or declared size of a node/shape (from DOM getBoundingClientRect or data). */
export interface MeasuredSize {
  width: number;
  height: number;
}

/** Axis-aligned bounding box in world/canvas coordinates (x,y = top-left). */
export interface Bounds extends Point, MeasuredSize {}

/** Generic rectangle (used for marquee selection, viewport descriptions, hit areas). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Viewport / transform / interaction state
// ---------------------------------------------------------------------------

/** Result of a zoom operation (wheel, fit, button). Pan is in screen pixels. */
export interface ZoomResult {
  zoom: number;
  pan: Point;
}

/** State for active panning gesture (used by interaction managers). */
export interface PanState {
  isPanning: boolean;
  lastMouse: Point;
}

/** Immutable rect describing an active selection marquee (in world coords). */
export interface SelectionRect extends Rect {}

// ---------------------------------------------------------------------------
// Snap system (populated here for shared use by snap.ts + drag consumers)
// ---------------------------------------------------------------------------

export interface SnapTarget {
  axis: 'x' | 'y';
  value: number;
  sourceEdge: string;
  targetShapeId: string;
  targetEdge: string;
}

export interface SnapResult {
  snappedX: number;
  snappedY: number;
  guides: SnapTarget[];
}

// ---------------------------------------------------------------------------
// Drag orchestration results (from DragManager-style logic)
// ---------------------------------------------------------------------------

export interface DragMoveResult {
  moves: Array<{ id: string; x: number; y: number }>;
  guides: SnapTarget[];
}

// ---------------------------------------------------------------------------
// Node anchor / port resolution (for anchors.ts getNodeAnchor)
// ---------------------------------------------------------------------------

/**
 * Supported anchor kinds for attaching edges, wires, labels or ports to a node.
 * 'center' is the legacy default for 150×70 boxes used in ArchitectureView edge math.
 * Future: explicit ports in node.data will allow 'port:foo' etc.
 */
export type AnchorKind =
  | 'center'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

/**
 * Resolved anchor point + kind in world coordinates.
 * getNodeAnchor(...) will return this (see anchors.ts).
 */
export interface NodeAnchor extends Point {
  kind: AnchorKind;
}

// ---------------------------------------------------------------------------
// Minimal neutral diagram node (for generic helpers, zoom-to-fit, anchors)
// Allows coordinate/anchor fns to accept GraphNode | Shape | custom without
// forcing import of either. Callers adapt with a 1-line mapper.
// ---------------------------------------------------------------------------

export interface DiagramNode<TData = Record<string, unknown>> {
  id: string;
  position: Point;
  /** Optional runtime or declared size. When absent, anchors/zoom use fallback. */
  size?: MeasuredSize;
  data?: TData;
}

// ---------------------------------------------------------------------------
// Coordinate system configuration (per-canvas tuning of grid + zoom limits)
// ---------------------------------------------------------------------------

export interface CoordinateConfig {
  /** Grid step in world units for snapValue / snapToGrid. */
  gridStep: number;
  minZoom: number;
  maxZoom: number;
  /** Multiplicative factor for pointer-lock wheel zoom (default 1.1). */
  wheelZoomFactor?: number;
}

/** Safe common defaults (component-editor heritage). */
export const DEFAULT_COORDINATE_CONFIG: CoordinateConfig = {
  gridStep: 10,
  minZoom: 0.1,
  maxZoom: 10,
  wheelZoomFactor: 1.1,
};

/** ArchitectureView-friendly defaults (matches its current 20px snap + visual grid). */
export const ARCHITECTURE_DEFAULTS: Partial<CoordinateConfig> = {
  gridStep: 20,
  minZoom: 0.2,
  maxZoom: 5,
};

/** PCB layout friendly defaults (0.5mm / 12.7 SVG units grid). */
export const PCB_DEFAULTS: Partial<CoordinateConfig> = {
  gridStep: 12.7,
  minZoom: 0.3,
  maxZoom: 6,
};
