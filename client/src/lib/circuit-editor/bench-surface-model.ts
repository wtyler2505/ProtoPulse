/**
 * Bench surface model — coordinate system for dual placement modes.
 *
 * The breadboard lives as a zone within a larger "bench surface". Components
 * can be placed on the breadboard grid (breadboardX/Y) or freely on the bench
 * (benchX/benchY). This module provides:
 *
 *   - Zone detection: is a position within the breadboard zone?
 *   - Snap logic: is a position close enough to snap to a breadboard hole?
 *   - Coordinate transforms: bench ↔ board-local pixel space.
 */

import { getBoardDimensions, pixelToCoord, coordToPixel, BB } from './breadboard-model';
import type { BreadboardCoord, PixelPos } from './breadboard-model';
import type { PartMeta } from '@shared/component-types';

type BreadboardFit = NonNullable<PartMeta['breadboardFit']>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BenchPosition {
  x: number;
  y: number;
}

export interface BenchSurfaceConfig {
  /** Total surface width in pixels. */
  surfaceWidth: number;
  /** Total surface height in pixels. */
  surfaceHeight: number;
  /** Top-left corner of the breadboard within the surface. */
  breadboardOrigin: BenchPosition;
  /** Breadboard zone width in pixels. */
  breadboardWidth: number;
  /** Breadboard zone height in pixels. */
  breadboardHeight: number;
  /** Distance in pixels from the breadboard edge within which drops snap to the grid. */
  snapThreshold: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const boardDims = getBoardDimensions();

export const BENCH_DEFAULTS: BenchSurfaceConfig = {
  surfaceWidth: boardDims.width + 400,
  surfaceHeight: boardDims.height + 300,
  breadboardOrigin: { x: 200, y: 150 },
  breadboardWidth: boardDims.width,
  breadboardHeight: boardDims.height,
  snapThreshold: 20,
};

// ---------------------------------------------------------------------------
// Zone detection
// ---------------------------------------------------------------------------

/**
 * Returns true when `pos` (in bench/surface coordinates) falls within the
 * breadboard zone, expanded by the snap threshold on all sides.
 */
export function isWithinBreadboard(
  pos: BenchPosition,
  config: BenchSurfaceConfig = BENCH_DEFAULTS,
): boolean {
  const { breadboardOrigin: o, breadboardWidth: w, breadboardHeight: h, snapThreshold: t } = config;
  return (
    pos.x >= o.x - t &&
    pos.x <= o.x + w + t &&
    pos.y >= o.y - t &&
    pos.y <= o.y + h + t
  );
}

// ---------------------------------------------------------------------------
// Snap to breadboard hole
// ---------------------------------------------------------------------------

/**
 * Attempts to snap a bench-surface position to the nearest breadboard hole.
 * Returns the breadboard coordinate if within range, or null if the position
 * is too far from any tie-point.
 *
 * This first checks the zone gate (isWithinBreadboard), then converts to
 * board-local pixels and delegates to `pixelToCoord` from breadboard-model.
 */
export function snapToBreadboard(
  pos: BenchPosition,
  config: BenchSurfaceConfig = BENCH_DEFAULTS,
): BreadboardCoord | null {
  if (!isWithinBreadboard(pos, config)) {
    return null;
  }
  const localPixel = benchToPixel(pos, config);
  return pixelToCoord(localPixel, BB.PITCH * 0.6);
}

// ---------------------------------------------------------------------------
// Coordinate transforms
// ---------------------------------------------------------------------------

/**
 * Convert a bench-surface position to board-local pixel coordinates.
 * Board-local (0,0) corresponds to the breadboard's top-left corner.
 */
export function benchToPixel(
  pos: BenchPosition,
  config: BenchSurfaceConfig = BENCH_DEFAULTS,
): PixelPos {
  return {
    x: pos.x - config.breadboardOrigin.x,
    y: pos.y - config.breadboardOrigin.y,
  };
}

/**
 * Convert board-local pixel coordinates back to bench-surface coordinates.
 */
export function pixelToBench(
  pixel: PixelPos,
  config: BenchSurfaceConfig = BENCH_DEFAULTS,
): BenchPosition {
  return {
    x: pixel.x + config.breadboardOrigin.x,
    y: pixel.y + config.breadboardOrigin.y,
  };
}

// ---------------------------------------------------------------------------
// Placement mode decision
// ---------------------------------------------------------------------------

/** Fits that must always go to the bench, never on the breadboard grid. */
const BENCH_ONLY_FITS: ReadonlySet<BreadboardFit> = new Set([
  'not_breadboard_friendly',
  'breakout_required',
]);

export interface PlacementResult {
  /** Where the component should be placed. */
  mode: 'board' | 'bench';
  /** Breadboard coordinate — set only when mode === 'board'. */
  coord: BreadboardCoord | null;
  /** Board-local pixel position of the snapped hole — set only when mode === 'board'. */
  boardPixel: PixelPos | null;
  /** Bench-surface position — set only when mode === 'bench'. */
  benchPosition: BenchPosition | null;
}

/**
 * Decide whether a component drop lands on the breadboard grid or the bench.
 *
 * Rules:
 *   1. `not_breadboard_friendly` or `breakout_required` → always bench.
 *   2. Within snap threshold and close to a hole → board (snap to hole).
 *   3. Everything else → bench (free-form placement).
 */
export function determinePlacementMode(
  dropPos: BenchPosition,
  fit: BreadboardFit,
  config: BenchSurfaceConfig = BENCH_DEFAULTS,
): PlacementResult {
  if (BENCH_ONLY_FITS.has(fit)) {
    return { mode: 'bench', coord: null, boardPixel: null, benchPosition: dropPos };
  }

  const coord = snapToBreadboard(dropPos, config);
  if (coord) {
    const boardPixel = coordToPixel(coord);
    return { mode: 'board', coord, boardPixel, benchPosition: null };
  }

  return { mode: 'bench', coord: null, boardPixel: null, benchPosition: dropPos };
}
