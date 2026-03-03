/**
 * CanvasTransforms — Pan, zoom, coordinate system transforms,
 * and screen-to-canvas conversion utilities.
 */
import type { Shape } from '@shared/component-types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 10;
export const GRID_SIZE = 10;

// ---------------------------------------------------------------------------
// Screen → part-space coordinate conversion
// ---------------------------------------------------------------------------

export function screenToPartSpace(
  screenX: number,
  screenY: number,
  svgRect: DOMRect,
  panX: number,
  panY: number,
  zoom: number,
): { x: number; y: number } {
  return {
    x: (screenX - svgRect.left - panX) / zoom,
    y: (screenY - svgRect.top - panY) / zoom,
  };
}

// ---------------------------------------------------------------------------
// Wheel zoom: compute new zoom + pan so pointer stays fixed
// ---------------------------------------------------------------------------

export interface ZoomResult {
  zoom: number;
  panX: number;
  panY: number;
}

export function computeWheelZoom(
  deltaY: number,
  mouseX: number,
  mouseY: number,
  svgRect: DOMRect,
  currentZoom: number,
  currentPanX: number,
  currentPanY: number,
): ZoomResult {
  const mx = mouseX - svgRect.left;
  const my = mouseY - svgRect.top;
  const factor = deltaY < 0 ? 1.1 : 0.9;
  const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom * factor));
  return {
    zoom: nz,
    panX: mx - (mx - currentPanX) * (nz / currentZoom),
    panY: my - (my - currentPanY) * (nz / currentZoom),
  };
}

// ---------------------------------------------------------------------------
// Zoom-to-fit: compute zoom + pan to show all shapes
// ---------------------------------------------------------------------------

export function computeZoomToFit(
  shapes: Shape[],
  viewportWidth: number,
  viewportHeight: number,
): ZoomResult {
  if (shapes.length === 0) {
    return { zoom: 1, panX: 0, panY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  shapes.forEach((s) => {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + s.width);
    maxY = Math.max(maxY, s.y + s.height);
  });

  const pad = 20;
  const bw = maxX - minX;
  const bh = maxY - minY;
  const vw = viewportWidth - pad * 2;
  const vh = viewportHeight - pad * 2;

  if (bw <= 0 || bh <= 0) {
    return { zoom: 1, panX: 0, panY: 0 };
  }

  const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(vw / bw, vh / bh)));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return {
    zoom: newZoom,
    panX: viewportWidth / 2 - cx * newZoom,
    panY: viewportHeight / 2 - cy * newZoom,
  };
}
