/**
 * diagram/coordinate.ts
 *
 * Unified coordinate / viewport / zoom / grid / transform functions.
 *
 * Merges the best behaviors from:
 *  - client/src/components/views/component-editor/CanvasTransforms.ts
 *    (pointer-preserving wheel zoom, zoom-to-fit on shapes, screenToPartSpace)
 *  - client/src/components/views/pcb-layout/PCBCoordinateSystem.ts
 *    (clampZoom, snapValue/snapToGrid, configurable-feeling constants, clean pure math)
 *
 * Design goals:
 * - Pure TS, zero React/DOM side effects (DOMRect accepted only for screen* because browser provides it).
 * - Configurable per canvas (grid, zoom limits) via optional params + exported defaults.
 * - Consistent use of `Point` and `ZoomResult { zoom, pan: Point }`.
 * - Names chosen for future consumers (Architecture, component-editor, PCB, schematic).
 * - Round-trippable where mathematically sensible.
 *
 * Consumers in Phase 1+ will import from '@/lib/diagram' and gradually replace
 * local copies + hardcoded 20 / 10 / 12.7 / +75/+35 logic.
 */

import type { Point, ZoomResult, Bounds, MeasuredSize, CoordinateConfig } from './types';
import {
  DEFAULT_COORDINATE_CONFIG,
  ARCHITECTURE_DEFAULTS,
  PCB_DEFAULTS,
} from './types';

// ---------------------------------------------------------------------------
// Constants (re-export sensible merged set; prefer DEFAULT_COORDINATE_CONFIG in new code)
// ---------------------------------------------------------------------------

export const MIN_ZOOM = DEFAULT_COORDINATE_CONFIG.minZoom;
export const MAX_ZOOM = DEFAULT_COORDINATE_CONFIG.maxZoom;
export const GRID_STEP = DEFAULT_COORDINATE_CONFIG.gridStep;

// Per-domain convenience re-exports (so existing code can migrate with minimal diff)
export { DEFAULT_COORDINATE_CONFIG, ARCHITECTURE_DEFAULTS, PCB_DEFAULTS };

// ---------------------------------------------------------------------------
// Screen <-> World transforms (unified naming: screenToWorld / worldToScreen)
// ---------------------------------------------------------------------------

/**
 * Convert screen/client coordinates to world/canvas coordinates.
 * Replaces screenToPartSpace + screenToBoardCoords.
 *
 * @param screenX - e.clientX or pointer event x
 * @param screenY - e.clientY
 * @param containerRect - DOMRect of the scrollable/zoomable container (SVG, div, etc.)
 * @param pan - current pan offset in screen pixels
 * @param zoom - current zoom scale
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  containerRect: DOMRect,
  pan: Point,
  zoom: number
): Point {
  return {
    x: (screenX - containerRect.left - pan.x) / zoom,
    y: (screenY - containerRect.top - pan.y) / zoom,
  };
}

/**
 * Inverse of screenToWorld: world point back to screen/client coords relative to container.
 * Useful for placing DOM overlays, tooltips, or hit testing in screen space.
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  containerRect: DOMRect,
  pan: Point,
  zoom: number
): Point {
  return {
    x: containerRect.left + pan.x + worldX * zoom,
    y: containerRect.top + pan.y + worldY * zoom,
  };
}

// ---------------------------------------------------------------------------
// Zoom math (pointer-preserving + simple step variants)
// ---------------------------------------------------------------------------

/**
 * Compute new zoom + pan after a wheel event so that the pointer position
 * stays fixed in world space (best UX, from CanvasTransforms).
 *
 * Falls back to linear step when pointer info not supplied.
 */
export interface WheelZoomInput {
  deltaY: number;
  mouseX: number;
  mouseY: number;
  containerRect: DOMRect;
  currentZoom: number;
  currentPan: Point;
  minZoom?: number;
  maxZoom?: number;
  wheelZoomFactor?: number;
}

export function computeWheelZoom(input: WheelZoomInput): ZoomResult {
  const {
    deltaY,
    mouseX,
    mouseY,
    containerRect,
    currentZoom,
    currentPan,
    minZoom = DEFAULT_COORDINATE_CONFIG.minZoom,
    maxZoom = DEFAULT_COORDINATE_CONFIG.maxZoom,
    wheelZoomFactor = DEFAULT_COORDINATE_CONFIG.wheelZoomFactor ?? 1.1,
  } = input;

  const mx = mouseX - containerRect.left;
  const my = mouseY - containerRect.top;

  const factor = deltaY < 0 ? wheelZoomFactor : 1 / wheelZoomFactor;
  const nz = Math.min(maxZoom, Math.max(minZoom, currentZoom * factor));

  const scale = nz / currentZoom;

  return {
    zoom: nz,
    pan: {
      x: mx - (mx - currentPan.x) * scale,
      y: my - (my - currentPan.y) * scale,
    },
  };
}

/**
 * Simpler zoom step (no pointer lock) — useful for +/- buttons or PCB-style.
 * Matches the spirit of PCBCoordinateSystem.computeWheelZoom but uses clamp.
 */
export function computeZoomStep(
  currentZoom: number,
  direction: 1 | -1,
  step = 0.15,
  minZoom = DEFAULT_COORDINATE_CONFIG.minZoom,
  maxZoom = DEFAULT_COORDINATE_CONFIG.maxZoom
): number {
  const nz = currentZoom + direction * step;
  return clampZoom(nz, minZoom, maxZoom);
}

// ---------------------------------------------------------------------------
// Zoom-to-fit (generic over Bounds or node-like items)
// ---------------------------------------------------------------------------

export interface ZoomToFitOptions {
  minZoom?: number;
  maxZoom?: number;
  padding?: number;
}

/**
 * Compute zoom + pan so that all provided items are visible with padding.
 * Generic: accepts any array of objects that have {x, y, width, height}.
 * Replaces the Shape-specific version; works for GraphNode+measuredSize, PCB footprints, etc.
 */
export function computeZoomToFit(
  items: Bounds[],
  viewportWidth: number,
  viewportHeight: number,
  opts: ZoomToFitOptions = {}
): ZoomResult {
  const {
    minZoom = DEFAULT_COORDINATE_CONFIG.minZoom,
    maxZoom = DEFAULT_COORDINATE_CONFIG.maxZoom,
    padding = 20,
  } = opts;

  if (!items.length) {
    return { zoom: 1, pan: { x: 0, y: 0 } };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const item of items) {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  }

  const bw = maxX - minX;
  const bh = maxY - minY;
  const vw = viewportWidth - padding * 2;
  const vh = viewportHeight - padding * 2;

  if (bw <= 0 || bh <= 0) {
    return { zoom: 1, pan: { x: 0, y: 0 } };
  }

  const newZoom = Math.min(maxZoom, Math.max(minZoom, Math.min(vw / bw, vh / bh)));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return {
    zoom: newZoom,
    pan: {
      x: viewportWidth / 2 - cx * newZoom,
      y: viewportHeight / 2 - cy * newZoom,
    },
  };
}

/**
 * Convenience overload: zoom-to-fit using DiagramNode[] or GraphNode-like
 * with optional runtime measured sizes. Falls back to 150×70 when size absent
 * (preserves current Architecture behavior until measured sizes land).
 */
export function computeZoomToFitNodes(
  nodes: Array<{ position: Point; size?: MeasuredSize }>,
  viewportWidth: number,
  viewportHeight: number,
  opts: ZoomToFitOptions = {}
): ZoomResult {
  const bounds: Bounds[] = nodes.map((n) => ({
    x: n.position.x,
    y: n.position.y,
    width: n.size?.width ?? 150,
    height: n.size?.height ?? 70,
  }));
  return computeZoomToFit(bounds, viewportWidth, viewportHeight, opts);
}

// ---------------------------------------------------------------------------
// Grid snapping (unified, with per-call override)
// ---------------------------------------------------------------------------

/** Snap a single scalar value to the nearest multiple of gridStep. */
export function snapValue(value: number, gridStep = DEFAULT_COORDINATE_CONFIG.gridStep): number {
  return Math.round(value / gridStep) * gridStep;
}

/** Snap a Point to the grid. */
export function snapToGrid(p: Point, gridStep = DEFAULT_COORDINATE_CONFIG.gridStep): Point {
  return {
    x: snapValue(p.x, gridStep),
    y: snapValue(p.y, gridStep),
  };
}

// ---------------------------------------------------------------------------
// Zoom limits
// ---------------------------------------------------------------------------

/** Clamp zoom to [min, max] inclusive. */
export function clampZoom(
  zoom: number,
  minZoom = DEFAULT_COORDINATE_CONFIG.minZoom,
  maxZoom = DEFAULT_COORDINATE_CONFIG.maxZoom
): number {
  return Math.max(minZoom, Math.min(maxZoom, zoom));
}

// ---------------------------------------------------------------------------
// Small helpers (display, unit conversion) — merged from PCB
// ---------------------------------------------------------------------------

export function roundForDisplay(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Example conversion helpers (PCB heritage; harmless to keep for future board views). */
export function svgUnitsToMm(svgUnits: number): number {
  return svgUnits / 10;
}
export function mmToSvgUnits(mm: number): number {
  return mm * 10;
}
