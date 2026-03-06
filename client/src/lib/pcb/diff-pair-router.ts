/**
 * DiffPairRouter — Differential pair geometry core.
 *
 * Pure functions for generating differential pair trace paths from a centerline,
 * computing path offsets with miter joins, and placing paired vias.
 * All dimensions in millimeters.
 *
 * No React, no DOM, no side effects.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 2D point in board coordinates (mm). */
export interface Point2D {
  x: number;
  y: number;
}

/** Configuration for a differential pair. */
export interface DiffPairConfig {
  traceWidth: number; // mm — width of each trace
  gap: number; // mm — spacing between inner edges of P and N traces
  layer: string; // active copper layer, e.g. 'F.Cu'
  netIdP: string; // net identifier for the positive trace
  netIdN: string; // net identifier for the negative trace
}

/** Result of generating a differential pair from a centerline. */
export interface DiffPairResult {
  pathP: Point2D[]; // positive trace path
  pathN: Point2D[]; // negative trace path
  lengthP: number; // mm — total length of P path
  lengthN: number; // mm — total length of N path
  skewMm: number; // mm — |lengthP - lengthN|
  traceWidth: number;
  gap: number;
  layer: string;
  netIdP: string;
  netIdN: string;
}

/** Result of generating paired vias for a diff pair layer transition. */
export interface DiffPairViaResult {
  viaP: { position: Point2D; fromLayer: string; toLayer: string };
  viaN: { position: Point2D; fromLayer: string; toLayer: string };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum miter ratio — caps offset distance at 3x to prevent spikes. */
const MITER_LIMIT = 3.0;

/** Minimum segment length below which we treat as zero-length. */
const LENGTH_EPSILON = 1e-9;

// ---------------------------------------------------------------------------
// pathLength
// ---------------------------------------------------------------------------

/**
 * Compute the total euclidean length of a polyline.
 *
 * @param points - Ordered polyline vertices.
 * @returns Total path length in mm.
 */
export function pathLength(points: Point2D[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

// ---------------------------------------------------------------------------
// offsetPath
// ---------------------------------------------------------------------------

/**
 * Offset a polyline path perpendicular to each segment.
 *
 * Positive offset shifts to the left of the travel direction; negative shifts right.
 * At bends, uses a miter join (bisector intersection) capped at {@link MITER_LIMIT}x
 * to prevent spikes at sharp angles.
 *
 * @param centerline - Input polyline vertices.
 * @param offset - Perpendicular offset distance (mm). Positive = left of travel.
 * @returns New polyline with the same number of vertices, offset from the input.
 */
export function offsetPath(centerline: Point2D[], offset: number): Point2D[] {
  if (centerline.length === 0) {
    return [];
  }
  if (centerline.length === 1) {
    return [{ x: centerline[0].x, y: centerline[0].y }];
  }

  // Compute per-segment unit normals (perpendicular left of travel direction)
  const normals = computeSegmentNormals(centerline);
  const n = centerline.length;
  const result: Point2D[] = [];

  for (let i = 0; i < n; i++) {
    if (i === 0) {
      // First point — use first segment's normal
      result.push({
        x: centerline[i].x + normals[0].x * offset,
        y: centerline[i].y + normals[0].y * offset,
      });
    } else if (i === n - 1) {
      // Last point — use last segment's normal
      result.push({
        x: centerline[i].x + normals[normals.length - 1].x * offset,
        y: centerline[i].y + normals[normals.length - 1].y * offset,
      });
    } else {
      // Interior vertex — miter join between segment i-1 and segment i
      const n1 = normals[i - 1];
      const n2 = normals[i];
      result.push(miterOffset(centerline[i], n1, n2, offset));
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// generateDiffPair
// ---------------------------------------------------------------------------

/**
 * Generate positive (P) and negative (N) trace paths from a centerline.
 *
 * P is offset to the left of travel (+halfPitch), N to the right (-halfPitch),
 * where halfPitch = (traceWidth + gap) / 2 — the center-to-center distance
 * of each trace from the centerline.
 *
 * @param centerline - Centerline polyline (must have >= 2 points).
 * @param config - Differential pair configuration.
 * @returns P/N paths with lengths and skew.
 * @throws If centerline has fewer than 2 points or config has invalid dimensions.
 */
export function generateDiffPair(
  centerline: Point2D[],
  config: DiffPairConfig,
): DiffPairResult {
  if (centerline.length < 2) {
    throw new Error('Differential pair centerline must have at least 2 points');
  }
  if (config.gap <= 0) {
    throw new Error(`Differential pair gap must be positive, got ${config.gap}`);
  }
  if (config.traceWidth <= 0) {
    throw new Error(`Differential pair traceWidth must be positive, got ${config.traceWidth}`);
  }

  const halfPitch = (config.traceWidth + config.gap) / 2;
  const pathP = offsetPath(centerline, halfPitch);
  const pathN = offsetPath(centerline, -halfPitch);
  const lengthP = pathLength(pathP);
  const lengthN = pathLength(pathN);

  return {
    pathP,
    pathN,
    lengthP,
    lengthN,
    skewMm: Math.abs(lengthP - lengthN),
    traceWidth: config.traceWidth,
    gap: config.gap,
    layer: config.layer,
    netIdP: config.netIdP,
    netIdN: config.netIdN,
  };
}

// ---------------------------------------------------------------------------
// diffPairVias
// ---------------------------------------------------------------------------

/**
 * Generate two via positions for a differential pair layer transition.
 *
 * The vias are placed at +/-halfPitch perpendicular to the given travel direction,
 * centered on the provided point.
 *
 * @param center - Center point between the two vias.
 * @param direction - Travel direction vector (does not need to be unit length).
 * @param config - Differential pair configuration (traceWidth, gap used).
 * @param fromLayer - Source copper layer name.
 * @param toLayer - Destination copper layer name.
 * @returns Positions and layer info for P and N vias.
 */
export function diffPairVias(
  center: Point2D,
  direction: Point2D,
  config: DiffPairConfig,
  fromLayer: string,
  toLayer: string,
): DiffPairViaResult {
  const halfPitch = (config.traceWidth + config.gap) / 2;
  const norm = perpendicular(direction);

  return {
    viaP: {
      position: {
        x: center.x + norm.x * halfPitch,
        y: center.y + norm.y * halfPitch,
      },
      fromLayer,
      toLayer,
    },
    viaN: {
      position: {
        x: center.x - norm.x * halfPitch,
        y: center.y - norm.y * halfPitch,
      },
      fromLayer,
      toLayer,
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute unit perpendicular (left-of-travel) for a direction vector.
 * Returns (0,0) for zero-length input.
 */
function perpendicular(dir: Point2D): Point2D {
  const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
  if (len < LENGTH_EPSILON) {
    return { x: 0, y: 0 };
  }
  // Perpendicular to (dx, dy) pointing left is (-dy, dx)
  return { x: -dir.y / len, y: dir.x / len };
}

/**
 * Compute unit normal vectors (perpendicular left of travel) for each segment
 * in a polyline. Returns normals.length === points.length - 1.
 * Zero-length segments get a (0,0) normal.
 */
function computeSegmentNormals(points: Point2D[]): Point2D[] {
  const normals: Point2D[] = [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    normals.push(perpendicular({ x: dx, y: dy }));
  }
  return normals;
}

/**
 * Compute a miter-joined offset point at an interior vertex.
 *
 * Given the incoming segment normal n1 and outgoing segment normal n2,
 * computes the bisector direction and scales the offset so the offset point
 * lies at the intersection of the two offset lines. Caps the miter at
 * MITER_LIMIT * |offset| to prevent spikes at sharp angles.
 */
function miterOffset(
  vertex: Point2D,
  n1: Point2D,
  n2: Point2D,
  offset: number,
): Point2D {
  // Bisector = average of the two normals
  const bx = n1.x + n2.x;
  const by = n1.y + n2.y;
  const bLen = Math.sqrt(bx * bx + by * by);

  // If normals are opposite (180-degree turn), bisector is zero — fall back to n1
  if (bLen < LENGTH_EPSILON) {
    return {
      x: vertex.x + n1.x * offset,
      y: vertex.y + n1.y * offset,
    };
  }

  // Unit bisector
  const ubx = bx / bLen;
  const uby = by / bLen;

  // Miter distance = offset / dot(bisector, n1)
  const dot = ubx * n1.x + uby * n1.y;

  // Guard against near-zero dot (very sharp angles)
  if (Math.abs(dot) < LENGTH_EPSILON) {
    return {
      x: vertex.x + n1.x * offset,
      y: vertex.y + n1.y * offset,
    };
  }

  let miterDist = offset / dot;

  // Cap miter to prevent spikes
  const maxDist = MITER_LIMIT * Math.abs(offset);
  if (Math.abs(miterDist) > maxDist) {
    miterDist = Math.sign(miterDist) * maxDist;
  }

  return {
    x: vertex.x + ubx * miterDist,
    y: vertex.y + uby * miterDist,
  };
}
