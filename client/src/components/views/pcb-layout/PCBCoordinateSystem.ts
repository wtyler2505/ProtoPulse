/**
 * PCBCoordinateSystem — Coordinate transforms, snapping, grid alignment,
 * and measurement utilities for the PCB layout canvas.
 *
 * Pure math functions — no React, no side effects.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Grid step in SVG units. 12.7 SVG units = 0.5mm = 50 mil. */
export const GRID_STEP = 12.7;

/** Default board outline in SVG units (1 unit = 0.1mm). 500 = 50mm, 400 = 40mm. */
export const DEFAULT_BOARD: { width: number; height: number } = { width: 500, height: 400 };

/** Zoom limits */
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 6;

/** Zoom step applied on wheel or button press */
export const ZOOM_WHEEL_STEP = 0.15;
export const ZOOM_BUTTON_STEP = 0.3;

/** Default pan offset */
export const DEFAULT_PAN: { x: number; y: number } = { x: 40, y: 40 };

/** Default zoom */
export const DEFAULT_ZOOM = 1.5;

// ---------------------------------------------------------------------------
// Screen → board coordinate conversion
// ---------------------------------------------------------------------------

/**
 * Convert a screen-space mouse position to board-space coordinates.
 *
 * @param clientX - e.clientX
 * @param clientY - e.clientY
 * @param svgRect - bounding rectangle of the SVG element
 * @param panX - current horizontal pan offset
 * @param panY - current vertical pan offset
 * @param zoom - current zoom factor
 */
export function screenToBoardCoords(
  clientX: number,
  clientY: number,
  svgRect: DOMRect,
  panX: number,
  panY: number,
  zoom: number,
): { x: number; y: number } {
  return {
    x: (clientX - svgRect.left - panX) / zoom,
    y: (clientY - svgRect.top - panY) / zoom,
  };
}

// ---------------------------------------------------------------------------
// Grid snapping
// ---------------------------------------------------------------------------

/** Snap a single value to the nearest grid point. */
export function snapValue(value: number, gridStep: number = GRID_STEP): number {
  return Math.round(value / gridStep) * gridStep;
}

/** Snap a 2D point to the nearest grid intersection. */
export function snapToGrid(
  x: number,
  y: number,
  gridStep: number = GRID_STEP,
): { x: number; y: number } {
  return {
    x: snapValue(x, gridStep),
    y: snapValue(y, gridStep),
  };
}

// ---------------------------------------------------------------------------
// Zoom helpers
// ---------------------------------------------------------------------------

/** Clamp zoom to allowed range. */
export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

/** Compute new zoom after a wheel event. */
export function computeWheelZoom(currentZoom: number, deltaY: number): number {
  return clampZoom(currentZoom + (deltaY > 0 ? -ZOOM_WHEEL_STEP : ZOOM_WHEEL_STEP));
}

// ---------------------------------------------------------------------------
// Board coordinate display helpers
// ---------------------------------------------------------------------------

/**
 * Round a board-space value to 1 decimal place for coordinate readout.
 * SVG units are 0.1mm, so this gives sub-mm precision.
 */
export function roundForDisplay(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Convert SVG units (0.1mm each) to millimeters.
 */
export function svgUnitsToMm(svgUnits: number): number {
  return svgUnits / 10;
}

/**
 * Convert millimeters to SVG units (0.1mm each).
 */
export function mmToSvgUnits(mm: number): number {
  return mm * 10;
}
