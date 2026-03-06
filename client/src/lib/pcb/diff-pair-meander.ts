/**
 * DiffPairMeander — Serpentine meander generator for trace length tuning.
 *
 * Generates trombone (rectangular U-turn) and sawtooth (triangular zigzag)
 * meander patterns to add controlled extra length to a trace path. Used for
 * differential pair skew compensation and single-trace length matching.
 *
 * Pure logic — no React, no DOM, no side effects. All dimensions in mm.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Point2D {
  x: number;
  y: number;
}

export type MeanderStyle = 'trombone' | 'sawtooth';

export type MeanderSide = 'left' | 'right';

export interface MeanderCalcConfig {
  /** Extra trace length to add (mm). Must be >= 0. */
  additionalLength: number;
  /** Peak-to-baseline height of each meander loop (mm). Must be > 0. */
  amplitude: number;
  /** Distance along travel axis between successive turns (mm). */
  spacing: number;
  /** Meander pattern style. */
  style: MeanderStyle;
}

export interface MeanderParams {
  /** Number of U-turns (trombone) or zigzag peaks (sawtooth). */
  turnCount: number;
  /** Total extra length that will be added (mm). >= additionalLength. */
  totalAdded: number;
  /** Length of one segment within a meander turn (mm). */
  segmentLength: number;
}

export interface MeanderConfig {
  /** Start point of the segment to meander. */
  start: Point2D;
  /** End point of the segment to meander. */
  end: Point2D;
  /** Extra trace length to add (mm). */
  additionalLength: number;
  /** Peak-to-baseline height (mm). */
  amplitude: number;
  /** Distance along travel axis between turns (mm). */
  spacing: number;
  /** Meander pattern style. */
  style: MeanderStyle;
  /** Which side of the travel direction the meander extends to. */
  side: MeanderSide;
}

export interface MeanderResult {
  /** Array of meander path points in world coordinates. */
  points: Point2D[];
  /** Actual extra length added by the meander (mm). */
  addedLength: number;
}

export interface FitMeanderConfig {
  /** Extra trace length to add (mm). */
  additionalLength: number;
  /** Peak-to-baseline height (mm). */
  amplitude: number;
  /** Distance along travel axis between turns (mm). */
  spacing: number;
  /** Meander pattern style. */
  style: MeanderStyle;
  /** Which side of the travel direction the meander extends to. */
  side: MeanderSide;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function dist(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function pathLength(pts: Point2D[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += dist(pts[i - 1], pts[i]);
  }
  return len;
}

/** Transform a point from local frame (X = travel, Y = perpendicular) to world. */
function localToWorld(
  localX: number,
  localY: number,
  origin: Point2D,
  dirX: number,
  dirY: number,
  perpX: number,
  perpY: number,
): Point2D {
  return {
    x: origin.x + localX * dirX + localY * perpX,
    y: origin.y + localX * dirY + localY * perpY,
  };
}

// ---------------------------------------------------------------------------
// calculateMeanderParams
// ---------------------------------------------------------------------------

/**
 * Compute the number of meander turns and total added length for a given
 * target additional length, amplitude, and spacing.
 */
export function calculateMeanderParams(config: MeanderCalcConfig): MeanderParams {
  const { additionalLength, amplitude, spacing, style } = config;

  if (additionalLength < 0) {
    throw new Error('Cannot compute meander with negative additional length');
  }
  if (amplitude <= 0) {
    throw new Error('Meander amplitude must be positive');
  }

  if (additionalLength === 0) {
    return { turnCount: 0, totalAdded: 0, segmentLength: 0 };
  }

  if (style === 'trombone') {
    // Each U-turn adds 2 * amplitude of extra length (go up + come back down)
    const addedPerTurn = 2 * amplitude;
    const turnCount = Math.ceil(additionalLength / addedPerTurn);
    const totalAdded = turnCount * addedPerTurn;
    return { turnCount, totalAdded, segmentLength: spacing };
  }

  // Sawtooth: each zigzag peak adds extra length
  // Peak path: 2 * sqrt(amplitude^2 + (spacing/2)^2) vs straight spacing
  const halfSpacing = spacing / 2;
  const legLength = Math.sqrt(amplitude * amplitude + halfSpacing * halfSpacing);
  const addedPerPeak = 2 * legLength - spacing;
  const turnCount = Math.ceil(additionalLength / addedPerPeak);
  const totalAdded = turnCount * addedPerPeak;
  return { turnCount, totalAdded, segmentLength: spacing };
}

// ---------------------------------------------------------------------------
// generateMeander
// ---------------------------------------------------------------------------

/**
 * Generate meander points between start and end.
 *
 * Works by computing points in a local frame where the travel axis is X,
 * then rotating to world coordinates.
 */
export function generateMeander(config: MeanderConfig): MeanderResult {
  const { start, end, additionalLength, amplitude, spacing, style, side } = config;

  // Zero additional → straight line
  if (additionalLength <= 0) {
    return { points: [{ ...start }, { ...end }], addedLength: 0 };
  }

  const segLen = dist(start, end);
  if (segLen < 1e-9) {
    return { points: [{ ...start }, { ...end }], addedLength: 0 };
  }

  // Build local coordinate frame
  const dirX = (end.x - start.x) / segLen;
  const dirY = (end.y - start.y) / segLen;
  // Perpendicular: rotate direction 90 degrees CCW
  const perpX = -dirY;
  const perpY = dirX;

  // Side multiplier: "left" = positive perpendicular, "right" = negative
  const sideMul = side === 'left' ? 1 : -1;

  const params = calculateMeanderParams({ additionalLength, amplitude, spacing, style });
  const { turnCount } = params;

  if (turnCount === 0) {
    return { points: [{ ...start }, { ...end }], addedLength: 0 };
  }

  // Total X-axis distance consumed by the meander region
  const meanderExtent = turnCount * spacing;

  // If meander is longer than the segment, center it but still produce valid geometry
  // Place meander in the center of the segment
  const xStart = (segLen - meanderExtent) / 2;
  const xEnd = xStart + meanderExtent;

  // Generate local-frame points
  const localPts: Array<{ lx: number; ly: number }> = [];

  // Lead-in from start to meander region
  localPts.push({ lx: 0, ly: 0 });

  if (style === 'trombone') {
    // Trombone: rectangular U-turns
    // Each turn: baseline → up amplitude → forward spacing → down to baseline
    for (let i = 0; i < turnCount; i++) {
      const turnX = xStart + i * spacing;

      // Baseline at turn start (dedup removes if consecutive)
      localPts.push({ lx: turnX, ly: 0 });
      // Go up to amplitude
      localPts.push({ lx: turnX, ly: sideMul * amplitude });
      // Move forward one spacing at amplitude
      localPts.push({ lx: turnX + spacing, ly: sideMul * amplitude });
      // Come back to baseline
      localPts.push({ lx: turnX + spacing, ly: 0 });
    }
  } else {
    // Sawtooth: triangular zigzag peaks
    // Baseline at meander region start
    localPts.push({ lx: xStart, ly: 0 });
    for (let i = 0; i < turnCount; i++) {
      const turnX = xStart + i * spacing;
      const peakDir = i % 2 === 0 ? 1 : -1;

      // Peak at midpoint of this spacing slot
      localPts.push({ lx: turnX + spacing / 2, ly: sideMul * peakDir * amplitude });
      // Back to baseline at end of slot
      localPts.push({ lx: turnX + spacing, ly: 0 });
    }
  }

  // Lead-out to end
  localPts.push({ lx: segLen, ly: 0 });

  // Remove duplicate consecutive points (same lx, ly within tolerance)
  const deduped: Array<{ lx: number; ly: number }> = [localPts[0]];
  for (let i = 1; i < localPts.length; i++) {
    const prev = deduped[deduped.length - 1];
    if (Math.abs(localPts[i].lx - prev.lx) > 1e-6 || Math.abs(localPts[i].ly - prev.ly) > 1e-6) {
      deduped.push(localPts[i]);
    }
  }

  // Transform to world coordinates
  const worldPts: Point2D[] = deduped.map((lp) => localToWorld(lp.lx, lp.ly, start, dirX, dirY, perpX, perpY));

  // Force exact start/end
  worldPts[0] = { ...start };
  worldPts[worldPts.length - 1] = { ...end };

  // Measure actual added length
  const totalPath = pathLength(worldPts);
  const addedLength = totalPath - segLen;

  return { points: worldPts, addedLength: Math.max(0, addedLength) };
}

// ---------------------------------------------------------------------------
// fitMeander
// ---------------------------------------------------------------------------

/**
 * Find the longest straight segment in the path, insert a meander there,
 * and return the modified path.
 */
export function fitMeander(path: Point2D[], config: FitMeanderConfig): MeanderResult {
  const { additionalLength } = config;

  if (additionalLength <= 0) {
    return { points: path.map((p) => ({ ...p })), addedLength: 0 };
  }

  if (path.length < 2) {
    throw new Error('Path must have at least 2 points');
  }

  // Find the longest segment
  let longestIdx = 0;
  let longestLen = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const len = dist(path[i], path[i + 1]);
    if (len > longestLen) {
      longestLen = len;
      longestIdx = i;
    }
  }

  // Check if the meander fits
  const minRequired = config.spacing * 3;
  if (longestLen < minRequired) {
    throw new Error(`Cannot fit meander: longest segment (${longestLen.toFixed(2)}mm) is shorter than minimum (${minRequired.toFixed(2)}mm)`);
  }

  // Generate meander for the longest segment
  const segStart = path[longestIdx];
  const segEnd = path[longestIdx + 1];
  const meanderResult = generateMeander({
    start: segStart,
    end: segEnd,
    additionalLength: config.additionalLength,
    amplitude: config.amplitude,
    spacing: config.spacing,
    style: config.style,
    side: config.side,
  });

  // Splice the meander into the path:
  // path[0..longestIdx] + meanderPoints + path[longestIdx+2..end]
  const before = path.slice(0, longestIdx);
  const after = path.slice(longestIdx + 2);
  const combined = [...before, ...meanderResult.points, ...after];

  return { points: combined, addedLength: meanderResult.addedLength };
}
