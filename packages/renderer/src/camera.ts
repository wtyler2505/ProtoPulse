import { MM } from '@protopulse/graph';

import type { Bounds } from './tessellate.js';
import type { Vec } from '@protopulse/graph';

/**
 * Camera: world (integer nm, Y-up) ↔ screen (CSS px, Y-down). Pure math,
 * DOM-free. The renderer derives its clip transform from the same state.
 */

export interface CanvasSize {
  width: number;
  height: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

/** Text is drawn only above this zoom (px per mm). */
export const TEXT_LOD_PX_PER_MM = 8;
/** The 1.27mm grid is drawn only above this zoom (px per mm). */
export const GRID_LOD_PX_PER_MM = 3;
/** Zoom clamps: 0.01 px/mm … 10000 px/mm. */
export const MIN_PX_PER_NM = 1e-8;
export const MAX_PX_PER_NM = 1e-2;

export class Camera {
  center: Vec = { x: 0, y: 0 };
  /** Scale: screen pixels per world nanometer. 1e-4 = 100 px/mm. */
  pxPerNm = 1e-4;
  /** Bumped on every mutation — render loops key on it. */
  version = 0;

  pxPerMm(): number {
    return this.pxPerNm * MM;
  }

  showText(): boolean {
    return this.pxPerMm() > TEXT_LOD_PX_PER_MM;
  }

  showGrid(): boolean {
    return this.pxPerMm() > GRID_LOD_PX_PER_MM;
  }

  worldToScreen(p: Vec, size: CanvasSize): ScreenPoint {
    return {
      x: (p.x - this.center.x) * this.pxPerNm + size.width / 2,
      y: size.height / 2 - (p.y - this.center.y) * this.pxPerNm,
    };
  }

  screenToWorld(p: ScreenPoint, size: CanvasSize): Vec {
    return {
      x: this.center.x + (p.x - size.width / 2) / this.pxPerNm,
      y: this.center.y + (size.height / 2 - p.y) / this.pxPerNm,
    };
  }

  /** Zoom by `factor`, keeping the world point under `screenPt` fixed. */
  zoomAt(screenPt: ScreenPoint, factor: number, size: CanvasSize): void {
    const anchor = this.screenToWorld(screenPt, size);
    const next = Math.min(MAX_PX_PER_NM, Math.max(MIN_PX_PER_NM, this.pxPerNm * factor));
    if (next === this.pxPerNm) return;
    this.pxPerNm = next;
    this.center = {
      x: anchor.x - (screenPt.x - size.width / 2) / this.pxPerNm,
      y: anchor.y - (size.height / 2 - screenPt.y) / this.pxPerNm,
    };
    this.version++;
  }

  /** Pan by a pointer drag of (dxPx, dyPx): content follows the pointer. */
  pan(dxPx: number, dyPx: number): void {
    this.center = {
      x: this.center.x - dxPx / this.pxPerNm,
      y: this.center.y + dyPx / this.pxPerNm,
    };
    this.version++;
  }

  /** Center on a world point without changing zoom. */
  centerOn(p: Vec): void {
    this.center = { x: p.x, y: p.y };
    this.version++;
  }

  /** Fit bounds into the canvas with a pixel margin. */
  fitBounds(bounds: Bounds, size: CanvasSize, marginPx = 40): void {
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    this.center = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    };
    const availW = Math.max(1, size.width - 2 * marginPx);
    const availH = Math.max(1, size.height - 2 * marginPx);
    if (w > 0 || h > 0) {
      const sx = w > 0 ? availW / w : Infinity;
      const sy = h > 0 ? availH / h : Infinity;
      this.pxPerNm = Math.min(MAX_PX_PER_NM, Math.max(MIN_PX_PER_NM, Math.min(sx, sy)));
    }
    this.version++;
  }
}
