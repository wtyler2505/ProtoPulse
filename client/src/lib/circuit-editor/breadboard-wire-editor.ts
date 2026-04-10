/**
 * Breadboard wire editing engine — BL-0543
 *
 * Provides hit-testing, deletion, and endpoint relocation for breadboard wires.
 * Pure functions that operate on CircuitWireRow arrays (no side effects).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal wire shape needed by the editor (matches CircuitWireRow fields). */
export interface BreadboardWire {
  id: number;
  points: Array<{ x: number; y: number }>;
  width?: number | null;
  color?: string | null;
  view: string;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type WireEndpoint = 'start' | 'end';

/** Result of a hit test — includes the hit wire and the segment index. */
export interface WireHitResult {
  wire: BreadboardWire;
  /** Index of the first point of the segment that was hit (0-based). */
  segmentIndex: number;
  /** Distance from the query point to the nearest point on the segment. */
  distance: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum hit-test distance (in board-space pixels) for thin wires. */
const MIN_HIT_RADIUS = 3;

/** Extra padding around each side of the wire for the bounding box. */
const BBOX_PADDING = 4;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/**
 * Compute the shortest distance from point P to the line segment AB.
 */
function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Degenerate segment (A === B)
    return Math.hypot(px - ax, py - ay);
  }

  // Project P onto the AB line, clamped to [0,1]
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;

  return Math.hypot(px - projX, py - projY);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute an expanded bounding box for a wire, suitable for coarse
 * culling before per-segment hit tests.
 */
export function getWireHitBox(wire: BreadboardWire): BoundingBox {
  const pts = wire.points;
  if (pts.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of pts) {
    if (p.x < minX) { minX = p.x; }
    if (p.y < minY) { minY = p.y; }
    if (p.x > maxX) { maxX = p.x; }
    if (p.y > maxY) { maxY = p.y; }
  }

  const halfWidth = Math.max(MIN_HIT_RADIUS, (wire.width ?? 1.5) / 2);
  const pad = halfWidth + BBOX_PADDING;

  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
  };
}

/**
 * Test whether point (x, y) is inside a bounding box.
 */
function pointInBox(x: number, y: number, box: BoundingBox): boolean {
  return x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY;
}

/**
 * Find the wire closest to point (x, y) within hit distance.
 *
 * Hit distance is the larger of `MIN_HIT_RADIUS` and half the wire width,
 * so even very thin wires remain clickable.
 *
 * Only considers breadboard-view wires (wire.view === 'breadboard').
 *
 * @returns The matching wire, or null if nothing is within range.
 */
export function selectWireAtPoint(
  x: number,
  y: number,
  wires: ReadonlyArray<BreadboardWire>,
): WireHitResult | null {
  let best: WireHitResult | null = null;

  for (const wire of wires) {
    if (wire.view !== 'breadboard') { continue; }
    const pts = wire.points;
    if (pts.length < 2) { continue; }

    // Coarse AABB check
    const box = getWireHitBox(wire);
    if (!pointInBox(x, y, box)) { continue; }

    const hitRadius = Math.max(MIN_HIT_RADIUS, (wire.width ?? 1.5) / 2 + 1);

    // Per-segment fine check
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distanceToSegment(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      if (d <= hitRadius && (best === null || d < best.distance)) {
        best = { wire, segmentIndex: i, distance: d };
      }
    }
  }

  return best;
}

/**
 * Remove a wire from the array by ID.
 *
 * @returns A new array with the wire removed. If no wire matches, returns
 *          a shallow copy of the original array.
 */
export function deleteWire(
  wireId: number,
  wires: ReadonlyArray<BreadboardWire>,
): BreadboardWire[] {
  return wires.filter(w => w.id !== wireId);
}

/**
 * Relocate one endpoint of a wire.
 *
 * @param endpoint  Which end to move — 'start' moves points[0],
 *                  'end' moves points[points.length - 1].
 * @param newPos    The new position for the endpoint.
 * @returns A new array with the specified wire's endpoint updated.
 *          If the wire is not found, returns a shallow copy unchanged.
 */
export function moveWireEndpoint(
  wireId: number,
  endpoint: WireEndpoint,
  newPos: { x: number; y: number },
  wires: ReadonlyArray<BreadboardWire>,
): BreadboardWire[] {
  return wires.map(w => {
    if (w.id !== wireId) { return w; }
    const pts = [...w.points.map(p => ({ ...p }))];
    if (pts.length === 0) { return w; }

    if (endpoint === 'start') {
      pts[0] = { x: newPos.x, y: newPos.y };
    } else {
      pts[pts.length - 1] = { x: newPos.x, y: newPos.y };
    }

    return { ...w, points: pts };
  });
}

/**
 * Return the pixel positions of a wire's start and end points.
 * Useful for rendering drag handles.
 *
 * @returns `null` if the wire has fewer than 2 points.
 */
export function getWireEndpoints(
  wire: BreadboardWire,
): { start: { x: number; y: number }; end: { x: number; y: number } } | null {
  if (wire.points.length < 2) { return null; }
  return {
    start: { ...wire.points[0] },
    end: { ...wire.points[wire.points.length - 1] },
  };
}

/**
 * Test if a point (x, y) is close enough to a wire endpoint to start a drag.
 *
 * @param radius  Maximum distance to consider a "hit" on the handle.
 * @returns The endpoint identifier ('start' or 'end') if hit, otherwise null.
 */
export function hitTestEndpoint(
  x: number,
  y: number,
  wire: BreadboardWire,
  radius = 5,
): WireEndpoint | null {
  const endpoints = getWireEndpoints(wire);
  if (!endpoints) { return null; }

  const dStart = Math.hypot(x - endpoints.start.x, y - endpoints.start.y);
  const dEnd = Math.hypot(x - endpoints.end.x, y - endpoints.end.y);

  // If both are within radius, prefer the closer one
  if (dStart <= radius && dEnd <= radius) {
    return dStart <= dEnd ? 'start' : 'end';
  }
  if (dStart <= radius) { return 'start'; }
  if (dEnd <= radius) { return 'end'; }

  return null;
}

// ---------------------------------------------------------------------------
// T-junction helpers (S6-03)
// ---------------------------------------------------------------------------

/** Result of projecting a point onto a wire. */
export interface WireProjection {
  /** The nearest point on the wire's path. */
  point: { x: number; y: number };
  /** Index of the segment containing the nearest point (0-based). */
  segmentIndex: number;
  /** Distance from the query point to the projected point. */
  distance: number;
}

/**
 * Project a point onto the nearest position along a wire's path.
 *
 * Only considers breadboard-view wires with at least 2 points.
 *
 * @returns The projection result, or null if the wire is ineligible.
 */
export function nearestPointOnWire(
  x: number,
  y: number,
  wire: BreadboardWire,
): WireProjection | null {
  if (wire.view !== 'breadboard') { return null; }
  const pts = wire.points;
  if (pts.length < 2) { return null; }

  let bestDist = Infinity;
  let bestPoint = { x: 0, y: 0 };
  let bestSegment = 0;

  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i].x;
    const ay = pts[i].y;
    const bx = pts[i + 1].x;
    const by = pts[i + 1].y;

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    let projX: number;
    let projY: number;

    if (lenSq === 0) {
      projX = ax;
      projY = ay;
    } else {
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lenSq));
      projX = ax + t * dx;
      projY = ay + t * dy;
    }

    const d = Math.hypot(x - projX, y - projY);
    if (d < bestDist) {
      bestDist = d;
      bestPoint = { x: projX, y: projY };
      bestSegment = i;
    }
  }

  return {
    point: bestPoint,
    segmentIndex: bestSegment,
    distance: bestDist,
  };
}

/** Simple incrementing counter for generating split wire IDs. */
let nextSplitId = Date.now();

/**
 * Split a wire into two at a given point along a specific segment.
 *
 * The original wire is replaced by two new wires:
 *   1. From the original start through all points up to (and including)
 *      the segment start, then the split point.
 *   2. From the split point, then the segment end through all remaining
 *      points to the original end.
 *
 * Other wires in the array are preserved unchanged.
 *
 * @param wireId       The ID of the wire to split.
 * @param splitPoint   The point at which to split.
 * @param segmentIndex Index of the segment containing the split point.
 * @param wires        The full wire array.
 * @returns A new array with the target wire replaced by two halves.
 */
export function splitWireAtPoint(
  wireId: number,
  splitPoint: { x: number; y: number },
  segmentIndex: number,
  wires: ReadonlyArray<BreadboardWire>,
): BreadboardWire[] {
  const target = wires.find(w => w.id === wireId);
  if (!target) {
    return [...wires];
  }

  const pts = target.points;

  // First half: points[0..segmentIndex] + splitPoint
  const firstHalfPoints = [
    ...pts.slice(0, segmentIndex + 1).map(p => ({ ...p })),
    { x: splitPoint.x, y: splitPoint.y },
  ];

  // Second half: splitPoint + points[segmentIndex+1..end]
  const secondHalfPoints = [
    { x: splitPoint.x, y: splitPoint.y },
    ...pts.slice(segmentIndex + 1).map(p => ({ ...p })),
  ];

  const id1 = ++nextSplitId;
  const id2 = ++nextSplitId;

  const wire1: BreadboardWire = {
    ...target,
    id: id1,
    points: firstHalfPoints,
  };

  const wire2: BreadboardWire = {
    ...target,
    id: id2,
    points: secondHalfPoints,
  };

  const result: BreadboardWire[] = [];
  for (const w of wires) {
    if (w.id === wireId) {
      result.push(wire1, wire2);
    } else {
      result.push(w);
    }
  }
  return result;
}
