/**
 * PushShoveEngine — Collision-aware trace displacement engine for interactive
 * PCB routing (push-and-shove routing).
 *
 * Given a new trace and a set of existing traces + vias, computes the minimal
 * set of displacements needed to maintain clearance. Uses a grid-based spatial
 * index, iterative cascade pushing with cycle detection, and spring relaxation
 * to minimize total displacement energy.
 *
 * All dimensions are in millimeters. Pure class — no React, no DOM.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PushShoveSegment {
  id: string;
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  width: number;
  layer: string;
  netId: string;
}

export interface PushShoveVia {
  id: string;
  position: { x: number; y: number };
  diameter: number;
  netId: string;
}

export interface PushShoveResult {
  success: boolean;
  modifiedSegments: PushShoveSegment[];
  displacedVias: PushShoveVia[];
  totalDisplacement: number; // sum of all moved distances (mm)
}

export interface PushShoveOptions {
  clearance?: number; // mm, default 0.2
  maxCascadeDepth?: number; // default 10
  relaxationIterations?: number; // default 5
  cellSize?: number; // spatial grid cell size in mm, default 1.0
}

// ---------------------------------------------------------------------------
// AABB
// ---------------------------------------------------------------------------

interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ---------------------------------------------------------------------------
// Undo snapshot
// ---------------------------------------------------------------------------

interface Snapshot {
  segments: Map<string, PushShoveSegment>;
  vias: Map<string, PushShoveVia>;
}

// ---------------------------------------------------------------------------
// Geometry utilities (exported for testing)
// ---------------------------------------------------------------------------

const EPSILON = 1e-9;

/**
 * Minimum distance between two line segments (center-to-center, ignoring width).
 */
export function segmentToSegmentDistance(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number },
): number {
  // Check intersection first
  if (segmentsIntersect(a1, a2, b1, b2)) {
    return 0;
  }

  // Check all 4 point-to-segment combinations
  const d1 = pointToSegmentDist(a1, b1, b2);
  const d2 = pointToSegmentDist(a2, b1, b2);
  const d3 = pointToSegmentDist(b1, a1, a2);
  const d4 = pointToSegmentDist(b2, a1, a2);

  return Math.min(d1, d2, d3, d4);
}

function pointToSegmentDist(
  p: { x: number; y: number },
  s1: { x: number; y: number },
  s2: { x: number; y: number },
): number {
  const dx = s2.x - s1.x;
  const dy = s2.y - s1.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq < EPSILON * EPSILON) {
    const px = p.x - s1.x;
    const py = p.y - s1.y;
    return Math.sqrt(px * px + py * py);
  }

  let t = ((p.x - s1.x) * dx + (p.y - s1.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = s1.x + t * dx;
  const projY = s1.y + t * dy;
  const ex = p.x - projX;
  const ey = p.y - projY;

  return Math.sqrt(ex * ex + ey * ey);
}

function crossProduct(
  o: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function onSegment(
  s1: { x: number; y: number },
  s2: { x: number; y: number },
  p: { x: number; y: number },
): boolean {
  return (
    p.x >= Math.min(s1.x, s2.x) - EPSILON &&
    p.x <= Math.max(s1.x, s2.x) + EPSILON &&
    p.y >= Math.min(s1.y, s2.y) - EPSILON &&
    p.y <= Math.max(s1.y, s2.y) + EPSILON
  );
}

function segmentsIntersect(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number },
): boolean {
  const d1 = crossProduct(b1, b2, a1);
  const d2 = crossProduct(b1, b2, a2);
  const d3 = crossProduct(a1, a2, b1);
  const d4 = crossProduct(a1, a2, b2);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  if (Math.abs(d1) < EPSILON && onSegment(b1, b2, a1)) { return true; }
  if (Math.abs(d2) < EPSILON && onSegment(b1, b2, a2)) { return true; }
  if (Math.abs(d3) < EPSILON && onSegment(a1, a2, b1)) { return true; }
  if (Math.abs(d4) < EPSILON && onSegment(a1, a2, b2)) { return true; }

  return false;
}

/**
 * Check if two PushShoveSegments collide, accounting for width and clearance.
 * Returns false for same-net or different-layer segments.
 */
export function segmentsCollide(
  a: PushShoveSegment,
  b: PushShoveSegment,
  clearance: number,
): boolean {
  // Same-net bypass
  if (a.netId === b.netId) {
    return false;
  }

  // Different-layer bypass
  if (a.layer !== b.layer) {
    return false;
  }

  const centerDist = segmentToSegmentDistance(a.p1, a.p2, b.p1, b.p2);
  const requiredDist = a.width / 2 + b.width / 2 + clearance;

  return centerDist < requiredDist - EPSILON;
}

/**
 * Minimum distance from a segment centerline to a via center.
 */
export function segmentViaDistance(
  seg: PushShoveSegment,
  v: PushShoveVia,
): number {
  return pointToSegmentDist(v.position, seg.p1, seg.p2);
}

/**
 * Displace a segment by a delta vector. Returns a new segment (immutable).
 */
export function displaceSegment(
  seg: PushShoveSegment,
  delta: { x: number; y: number },
): PushShoveSegment {
  return {
    id: seg.id,
    p1: { x: seg.p1.x + delta.x, y: seg.p1.y + delta.y },
    p2: { x: seg.p2.x + delta.x, y: seg.p2.y + delta.y },
    width: seg.width,
    layer: seg.layer,
    netId: seg.netId,
  };
}

// ---------------------------------------------------------------------------
// Spatial Grid (for fast neighbor lookup)
// ---------------------------------------------------------------------------

class PushShoveSpatialGrid {
  private cellSize: number;
  private cells = new Map<string, Set<string>>();
  private entries = new Map<string, { aabb: AABB }>();

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  private cellKey(cx: number, cy: number): string {
    return `${String(cx)},${String(cy)}`;
  }

  private getCellRange(aabb: AABB): { x0: number; y0: number; x1: number; y1: number } {
    return {
      x0: Math.floor(aabb.minX / this.cellSize),
      y0: Math.floor(aabb.minY / this.cellSize),
      x1: Math.floor(aabb.maxX / this.cellSize),
      y1: Math.floor(aabb.maxY / this.cellSize),
    };
  }

  insert(id: string, aabb: AABB): void {
    this.entries.set(id, { aabb });
    const range = this.getCellRange(aabb);
    for (let cx = range.x0; cx <= range.x1; cx++) {
      for (let cy = range.y0; cy <= range.y1; cy++) {
        const key = this.cellKey(cx, cy);
        let cell = this.cells.get(key);
        if (!cell) {
          cell = new Set();
          this.cells.set(key, cell);
        }
        cell.add(id);
      }
    }
  }

  remove(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) {
      return;
    }
    const range = this.getCellRange(entry.aabb);
    for (let cx = range.x0; cx <= range.x1; cx++) {
      for (let cy = range.y0; cy <= range.y1; cy++) {
        const key = this.cellKey(cx, cy);
        const cell = this.cells.get(key);
        if (cell) {
          cell.delete(id);
          if (cell.size === 0) {
            this.cells.delete(key);
          }
        }
      }
    }
    this.entries.delete(id);
  }

  query(aabb: AABB): string[] {
    const result = new Set<string>();
    const range = this.getCellRange(aabb);
    for (let cx = range.x0; cx <= range.x1; cx++) {
      for (let cy = range.y0; cy <= range.y1; cy++) {
        const cell = this.cells.get(this.cellKey(cx, cy));
        if (cell) {
          cell.forEach((id) => {
            result.add(id);
          });
        }
      }
    }
    return Array.from(result);
  }

  clear(): void {
    this.cells.clear();
    this.entries.clear();
  }
}

// ---------------------------------------------------------------------------
// AABB builders
// ---------------------------------------------------------------------------

function segmentAABB(seg: PushShoveSegment, margin: number): AABB {
  const hw = seg.width / 2 + margin;
  return {
    minX: Math.min(seg.p1.x, seg.p2.x) - hw,
    minY: Math.min(seg.p1.y, seg.p2.y) - hw,
    maxX: Math.max(seg.p1.x, seg.p2.x) + hw,
    maxY: Math.max(seg.p1.y, seg.p2.y) + hw,
  };
}

function viaAABB(v: PushShoveVia, margin: number): AABB {
  const r = v.diameter / 2 + margin;
  return {
    minX: v.position.x - r,
    minY: v.position.y - r,
    maxX: v.position.x + r,
    maxY: v.position.y + r,
  };
}

function mergeAABB(a: AABB, b: AABB): AABB {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

// ---------------------------------------------------------------------------
// Helper: compute push direction for a segment being pushed by another
// ---------------------------------------------------------------------------

function computePushVector(
  existing: PushShoveSegment,
  pusher: PushShoveSegment,
  clearance: number,
): { x: number; y: number } | null {
  const centerDist = segmentToSegmentDistance(existing.p1, existing.p2, pusher.p1, pusher.p2);
  const requiredDist = existing.width / 2 + pusher.width / 2 + clearance;

  if (centerDist >= requiredDist - EPSILON) {
    return null; // No push needed
  }

  const pushAmount = requiredDist - centerDist + EPSILON * 10;

  // Determine push direction: perpendicular away from pusher
  // Use the midpoints of the segments to determine direction
  const existMidX = (existing.p1.x + existing.p2.x) / 2;
  const existMidY = (existing.p1.y + existing.p2.y) / 2;
  const pushMidX = (pusher.p1.x + pusher.p2.x) / 2;
  const pushMidY = (pusher.p1.y + pusher.p2.y) / 2;

  let dx = existMidX - pushMidX;
  let dy = existMidY - pushMidY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < EPSILON) {
    // Segments have the same midpoint — push in the direction perpendicular
    // to the existing segment
    const segDx = existing.p2.x - existing.p1.x;
    const segDy = existing.p2.y - existing.p1.y;
    const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
    if (segLen < EPSILON) {
      // Zero-length segment — push upward as fallback
      return { x: 0, y: pushAmount };
    }
    // Perpendicular direction
    dx = -segDy / segLen;
    dy = segDx / segLen;
  } else {
    dx /= dist;
    dy /= dist;
  }

  return { x: dx * pushAmount, y: dy * pushAmount };
}

function computeViaPushVector(
  v: PushShoveVia,
  pusher: PushShoveSegment,
  clearance: number,
): { x: number; y: number } | null {
  const centerDist = pointToSegmentDist(v.position, pusher.p1, pusher.p2);
  const requiredDist = v.diameter / 2 + pusher.width / 2 + clearance;

  if (centerDist >= requiredDist - EPSILON) {
    return null;
  }

  const pushAmount = requiredDist - centerDist + EPSILON * 10;

  // Direction: away from the closest point on the pusher segment
  const dx2 = pusher.p2.x - pusher.p1.x;
  const dy2 = pusher.p2.y - pusher.p1.y;
  const lenSq = dx2 * dx2 + dy2 * dy2;

  let closestX: number;
  let closestY: number;
  if (lenSq < EPSILON * EPSILON) {
    closestX = pusher.p1.x;
    closestY = pusher.p1.y;
  } else {
    let t = ((v.position.x - pusher.p1.x) * dx2 + (v.position.y - pusher.p1.y) * dy2) / lenSq;
    t = Math.max(0, Math.min(1, t));
    closestX = pusher.p1.x + t * dx2;
    closestY = pusher.p1.y + t * dy2;
  }

  let dirX = v.position.x - closestX;
  let dirY = v.position.y - closestY;
  const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);

  if (dirLen < EPSILON) {
    // Via is on the segment — push perpendicular to segment direction
    const segLen = Math.sqrt(lenSq);
    if (segLen < EPSILON) {
      return { x: 0, y: pushAmount };
    }
    dirX = -dy2 / segLen;
    dirY = dx2 / segLen;
  } else {
    dirX /= dirLen;
    dirY /= dirLen;
  }

  return { x: dirX * pushAmount, y: dirY * pushAmount };
}

// ---------------------------------------------------------------------------
// PushShoveEngine
// ---------------------------------------------------------------------------

export class PushShoveEngine {
  private segments = new Map<string, PushShoveSegment>();
  private vias = new Map<string, PushShoveVia>();
  private segGrid: PushShoveSpatialGrid;
  private viaGrid: PushShoveSpatialGrid;

  private clearance: number;
  private maxCascadeDepth: number;
  private relaxationIterations: number;

  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];

  constructor(options?: PushShoveOptions) {
    this.clearance = options?.clearance ?? 0.2;
    this.maxCascadeDepth = options?.maxCascadeDepth ?? 10;
    this.relaxationIterations = options?.relaxationIterations ?? 5;
    const cellSize = options?.cellSize ?? 1.0;
    this.segGrid = new PushShoveSpatialGrid(cellSize);
    this.viaGrid = new PushShoveSpatialGrid(cellSize);
  }

  // -------------------------------------------------------------------------
  // Segment CRUD
  // -------------------------------------------------------------------------

  addSegment(seg: PushShoveSegment): void {
    const copy = deepCopySegment(seg);
    this.segments.set(copy.id, copy);
    this.segGrid.insert(copy.id, segmentAABB(copy, this.clearance));
  }

  removeSegment(id: string): void {
    this.segments.delete(id);
    this.segGrid.remove(id);
  }

  updateSegment(seg: PushShoveSegment): void {
    this.removeSegment(seg.id);
    this.addSegment(seg);
  }

  getSegment(id: string): PushShoveSegment | undefined {
    const s = this.segments.get(id);
    return s ? deepCopySegment(s) : undefined;
  }

  // -------------------------------------------------------------------------
  // Via CRUD
  // -------------------------------------------------------------------------

  addVia(v: PushShoveVia): void {
    const copy = deepCopyVia(v);
    this.vias.set(copy.id, copy);
    this.viaGrid.insert(copy.id, viaAABB(copy, this.clearance));
  }

  removeVia(id: string): void {
    this.vias.delete(id);
    this.viaGrid.remove(id);
  }

  getVia(id: string): PushShoveVia | undefined {
    const v = this.vias.get(id);
    return v ? deepCopyVia(v) : undefined;
  }

  // -------------------------------------------------------------------------
  // Clear
  // -------------------------------------------------------------------------

  clear(): void {
    this.segments.clear();
    this.vias.clear();
    this.segGrid.clear();
    this.viaGrid.clear();
    this.undoStack = [];
    this.redoStack = [];
  }

  // -------------------------------------------------------------------------
  // Spatial queries
  // -------------------------------------------------------------------------

  getNeighborSegments(
    min: { x: number; y: number },
    max: { x: number; y: number },
  ): PushShoveSegment[] {
    const aabb: AABB = { minX: min.x, minY: min.y, maxX: max.x, maxY: max.y };
    const ids = this.segGrid.query(aabb);
    const result: PushShoveSegment[] = [];
    for (const id of ids) {
      const s = this.segments.get(id);
      if (s) {
        result.push(deepCopySegment(s));
      }
    }
    return result;
  }

  getNeighborVias(
    min: { x: number; y: number },
    max: { x: number; y: number },
  ): PushShoveVia[] {
    const aabb: AABB = { minX: min.x, minY: min.y, maxX: max.x, maxY: max.y };
    const ids = this.viaGrid.query(aabb);
    const result: PushShoveVia[] = [];
    for (const id of ids) {
      const v = this.vias.get(id);
      if (v) {
        result.push(deepCopyVia(v));
      }
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // Undo / Redo
  // -------------------------------------------------------------------------

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): void {
    if (this.undoStack.length === 0) {
      return;
    }

    // Save current state to redo stack
    this.redoStack.push(this.takeSnapshot());

    // Restore from undo stack
    const snapshot = this.undoStack.pop()!;
    this.restoreSnapshot(snapshot);
  }

  redo(): void {
    if (this.redoStack.length === 0) {
      return;
    }

    // Save current state to undo stack
    this.undoStack.push(this.takeSnapshot());

    // Restore from redo stack
    const snapshot = this.redoStack.pop()!;
    this.restoreSnapshot(snapshot);
  }

  private takeSnapshot(): Snapshot {
    const segs = new Map<string, PushShoveSegment>();
    for (const [id, s] of Array.from(this.segments.entries())) {
      segs.set(id, deepCopySegment(s));
    }
    const viaCopies = new Map<string, PushShoveVia>();
    for (const [id, v] of Array.from(this.vias.entries())) {
      viaCopies.set(id, deepCopyVia(v));
    }
    return { segments: segs, vias: viaCopies };
  }

  private restoreSnapshot(snapshot: Snapshot): void {
    // Clear grids
    this.segGrid.clear();
    this.viaGrid.clear();

    // Restore segments
    this.segments.clear();
    for (const [id, s] of Array.from(snapshot.segments.entries())) {
      const copy = deepCopySegment(s);
      this.segments.set(id, copy);
      this.segGrid.insert(id, segmentAABB(copy, this.clearance));
    }

    // Restore vias
    this.vias.clear();
    for (const [id, v] of Array.from(snapshot.vias.entries())) {
      const copy = deepCopyVia(v);
      this.vias.set(id, copy);
      this.viaGrid.insert(id, viaAABB(copy, this.clearance));
    }
  }

  // -------------------------------------------------------------------------
  // pushSegment — push existing items away from a new segment
  // -------------------------------------------------------------------------

  pushSegment(newSeg: PushShoveSegment): PushShoveResult {
    // Take snapshot for undo
    const snapshot = this.takeSnapshot();

    const modifiedSegments = new Map<string, PushShoveSegment>();
    const displacedVias = new Map<string, PushShoveVia>();
    const originalPositions = new Map<string, { p1: { x: number; y: number }; p2: { x: number; y: number } }>();
    const originalViaPositions = new Map<string, { x: number; y: number }>();

    // Record original positions for displacement calculation
    for (const [id, s] of Array.from(this.segments.entries())) {
      originalPositions.set(id, { p1: { ...s.p1 }, p2: { ...s.p2 } });
    }
    for (const [id, v] of Array.from(this.vias.entries())) {
      originalViaPositions.set(id, { ...v.position });
    }

    // Iterative cascade push
    const success = this.cascadePush(
      newSeg,
      this.clearance,
      modifiedSegments,
      displacedVias,
      new Set<string>(),
      0,
    );

    // Spring relaxation to minimize total displacement
    if (success && (modifiedSegments.size > 0 || displacedVias.size > 0)) {
      this.relax(newSeg, modifiedSegments, displacedVias, originalPositions, originalViaPositions);
    }

    // Calculate total displacement
    let totalDisplacement = 0;
    for (const [id, modified] of Array.from(modifiedSegments.entries())) {
      const orig = originalPositions.get(id);
      if (orig) {
        const d1 = Math.sqrt(
          (modified.p1.x - orig.p1.x) ** 2 + (modified.p1.y - orig.p1.y) ** 2,
        );
        const d2 = Math.sqrt(
          (modified.p2.x - orig.p2.x) ** 2 + (modified.p2.y - orig.p2.y) ** 2,
        );
        totalDisplacement += (d1 + d2) / 2; // average displacement of endpoints
      }
    }
    for (const [id, modified] of Array.from(displacedVias.entries())) {
      const orig = originalViaPositions.get(id);
      if (orig) {
        totalDisplacement += Math.sqrt(
          (modified.position.x - orig.x) ** 2 + (modified.position.y - orig.y) ** 2,
        );
      }
    }

    // Save undo snapshot only if modifications were made
    if (modifiedSegments.size > 0 || displacedVias.size > 0) {
      this.undoStack.push(snapshot);
      this.redoStack = [];
    }

    return {
      success,
      modifiedSegments: Array.from(modifiedSegments.values()).map(deepCopySegment),
      displacedVias: Array.from(displacedVias.values()).map(deepCopyVia),
      totalDisplacement,
    };
  }

  // -------------------------------------------------------------------------
  // solve — push existing items away from an entire new trace
  // -------------------------------------------------------------------------

  solve(newTrace: PushShoveSegment[], clearance: number): PushShoveResult {
    const snapshot = this.takeSnapshot();

    const allModifiedSegments = new Map<string, PushShoveSegment>();
    const allDisplacedVias = new Map<string, PushShoveVia>();
    const originalPositions = new Map<string, { p1: { x: number; y: number }; p2: { x: number; y: number } }>();
    const originalViaPositions = new Map<string, { x: number; y: number }>();

    for (const [id, s] of Array.from(this.segments.entries())) {
      originalPositions.set(id, { p1: { ...s.p1 }, p2: { ...s.p2 } });
    }
    for (const [id, v] of Array.from(this.vias.entries())) {
      originalViaPositions.set(id, { ...v.position });
    }

    let overallSuccess = true;

    for (const seg of newTrace) {
      const segModified = new Map<string, PushShoveSegment>();
      const segDisplacedVias = new Map<string, PushShoveVia>();

      const success = this.cascadePush(
        seg,
        clearance,
        segModified,
        segDisplacedVias,
        new Set<string>(),
        0,
      );

      if (!success) {
        overallSuccess = false;
        // Restore and return failure
        this.restoreSnapshot(snapshot);
        return {
          success: false,
          modifiedSegments: [],
          displacedVias: [],
          totalDisplacement: 0,
        };
      }

      // Merge results
      for (const [id, s] of Array.from(segModified.entries())) {
        allModifiedSegments.set(id, s);
      }
      for (const [id, v] of Array.from(segDisplacedVias.entries())) {
        allDisplacedVias.set(id, v);
      }
    }

    // Relaxation
    if (overallSuccess && (allModifiedSegments.size > 0 || allDisplacedVias.size > 0)) {
      // Relax against all new trace segments
      for (const seg of newTrace) {
        this.relax(seg, allModifiedSegments, allDisplacedVias, originalPositions, originalViaPositions);
      }
    }

    // Calculate total displacement
    let totalDisplacement = 0;
    for (const [id, modified] of Array.from(allModifiedSegments.entries())) {
      const orig = originalPositions.get(id);
      if (orig) {
        const d1 = Math.sqrt(
          (modified.p1.x - orig.p1.x) ** 2 + (modified.p1.y - orig.p1.y) ** 2,
        );
        const d2 = Math.sqrt(
          (modified.p2.x - orig.p2.x) ** 2 + (modified.p2.y - orig.p2.y) ** 2,
        );
        totalDisplacement += (d1 + d2) / 2;
      }
    }
    for (const [id, modified] of Array.from(allDisplacedVias.entries())) {
      const orig = originalViaPositions.get(id);
      if (orig) {
        totalDisplacement += Math.sqrt(
          (modified.position.x - orig.x) ** 2 + (modified.position.y - orig.y) ** 2,
        );
      }
    }

    if (allModifiedSegments.size > 0 || allDisplacedVias.size > 0) {
      this.undoStack.push(snapshot);
      this.redoStack = [];
    }

    return {
      success: overallSuccess,
      modifiedSegments: Array.from(allModifiedSegments.values()).map(deepCopySegment),
      displacedVias: Array.from(allDisplacedVias.values()).map(deepCopyVia),
      totalDisplacement,
    };
  }

  // -------------------------------------------------------------------------
  // Private: cascade push
  // -------------------------------------------------------------------------

  private cascadePush(
    pusher: PushShoveSegment,
    clearance: number,
    modifiedSegments: Map<string, PushShoveSegment>,
    displacedVias: Map<string, PushShoveVia>,
    visited: Set<string>,
    depth: number,
  ): boolean {
    if (depth > this.maxCascadeDepth) {
      return true; // Max depth reached — stop cascading, not a failure
    }

    // Find colliding segments in the spatial index
    const queryAABB = segmentAABB(pusher, clearance + 1.0);
    const candidateSegIds = this.segGrid.query(queryAABB);

    for (const candidateId of candidateSegIds) {
      if (candidateId === pusher.id) {
        continue;
      }

      // Cycle detection
      if (visited.has(candidateId)) {
        continue;
      }

      const existing = this.segments.get(candidateId);
      if (!existing) {
        continue;
      }

      // Same net or different layer — skip
      if (existing.netId === pusher.netId) {
        continue;
      }
      if (existing.layer !== pusher.layer) {
        continue;
      }

      const pushVec = computePushVector(existing, pusher, clearance);
      if (!pushVec) {
        continue;
      }

      // Displace the segment
      const displaced = displaceSegment(existing, pushVec);

      // Update internal state
      this.segments.set(displaced.id, displaced);
      this.segGrid.remove(displaced.id);
      this.segGrid.insert(displaced.id, segmentAABB(displaced, clearance));
      modifiedSegments.set(displaced.id, displaced);

      // Cascade — the displaced segment might now collide with others
      visited.add(displaced.id);
      const cascadeSuccess = this.cascadePush(
        displaced,
        clearance,
        modifiedSegments,
        displacedVias,
        visited,
        depth + 1,
      );

      if (!cascadeSuccess) {
        return false;
      }
    }

    // Find colliding vias
    const viaQueryAABB = segmentAABB(pusher, clearance + 1.0);
    const candidateViaIds = this.viaGrid.query(viaQueryAABB);

    for (const candidateId of candidateViaIds) {
      const existingVia = this.vias.get(candidateId);
      if (!existingVia) {
        continue;
      }

      // Same net — skip
      if (existingVia.netId === pusher.netId) {
        continue;
      }

      const pushVec = computeViaPushVector(existingVia, pusher, clearance);
      if (!pushVec) {
        continue;
      }

      // Displace via
      const displacedVia: PushShoveVia = {
        id: existingVia.id,
        position: {
          x: existingVia.position.x + pushVec.x,
          y: existingVia.position.y + pushVec.y,
        },
        diameter: existingVia.diameter,
        netId: existingVia.netId,
      };

      this.vias.set(displacedVia.id, displacedVia);
      this.viaGrid.remove(displacedVia.id);
      this.viaGrid.insert(displacedVia.id, viaAABB(displacedVia, clearance));
      displacedVias.set(displacedVia.id, displacedVia);

      // Find and update segments connected to this via
      this.reconnectViaSegments(existingVia, displacedVia, modifiedSegments);
    }

    return true;
  }

  // -------------------------------------------------------------------------
  // Private: reconnect segments when a via is displaced
  // -------------------------------------------------------------------------

  private reconnectViaSegments(
    oldVia: PushShoveVia,
    newVia: PushShoveVia,
    modifiedSegments: Map<string, PushShoveSegment>,
  ): void {
    const tolerance = 0.01; // mm

    for (const [id, seg] of Array.from(this.segments.entries())) {
      if (seg.netId !== oldVia.netId) {
        continue;
      }

      let modified = false;
      let newP1 = { ...seg.p1 };
      let newP2 = { ...seg.p2 };

      // Check if p1 was connected to old via position
      if (
        Math.abs(seg.p1.x - oldVia.position.x) < tolerance &&
        Math.abs(seg.p1.y - oldVia.position.y) < tolerance
      ) {
        newP1 = { x: newVia.position.x, y: newVia.position.y };
        modified = true;
      }

      // Check if p2 was connected to old via position
      if (
        Math.abs(seg.p2.x - oldVia.position.x) < tolerance &&
        Math.abs(seg.p2.y - oldVia.position.y) < tolerance
      ) {
        newP2 = { x: newVia.position.x, y: newVia.position.y };
        modified = true;
      }

      if (modified) {
        const updatedSeg: PushShoveSegment = {
          id: seg.id,
          p1: newP1,
          p2: newP2,
          width: seg.width,
          layer: seg.layer,
          netId: seg.netId,
        };

        this.segments.set(id, updatedSeg);
        this.segGrid.remove(id);
        this.segGrid.insert(id, segmentAABB(updatedSeg, this.clearance));
        modifiedSegments.set(id, updatedSeg);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Private: spring relaxation
  // -------------------------------------------------------------------------

  private relax(
    pusher: PushShoveSegment,
    modifiedSegments: Map<string, PushShoveSegment>,
    _displacedVias: Map<string, PushShoveVia>,
    originalPositions: Map<string, { p1: { x: number; y: number }; p2: { x: number; y: number } }>,
    _originalViaPositions: Map<string, { x: number; y: number }>,
  ): void {
    // Spring relaxation: try to move modified segments back toward their
    // original positions while maintaining clearance.
    for (let iter = 0; iter < this.relaxationIterations; iter++) {
      let improved = false;

      for (const [id, seg] of Array.from(modifiedSegments.entries())) {
        const orig = originalPositions.get(id);
        if (!orig) {
          continue;
        }

        const current = this.segments.get(id);
        if (!current) {
          continue;
        }

        // Direction from current position back toward original
        const dx1 = orig.p1.x - current.p1.x;
        const dy1 = orig.p1.y - current.p1.y;
        const dx2 = orig.p2.x - current.p2.x;
        const dy2 = orig.p2.y - current.p2.y;

        const avgDx = (dx1 + dx2) / 2;
        const avgDy = (dy1 + dy2) / 2;
        const dist = Math.sqrt(avgDx * avgDx + avgDy * avgDy);

        if (dist < EPSILON) {
          continue;
        }

        // Try to move a fraction of the way back
        const stepFraction = 0.3;
        const stepDx = avgDx * stepFraction;
        const stepDy = avgDy * stepFraction;

        const candidate: PushShoveSegment = {
          id: current.id,
          p1: { x: current.p1.x + stepDx, y: current.p1.y + stepDy },
          p2: { x: current.p2.x + stepDx, y: current.p2.y + stepDy },
          width: current.width,
          layer: current.layer,
          netId: current.netId,
        };

        // Check if moving back would violate clearance with the pusher
        if (segmentsCollide(candidate, pusher, this.clearance)) {
          continue;
        }

        // Check if moving back would violate clearance with other modified segments
        let violates = false;
        for (const [otherId] of Array.from(modifiedSegments.entries())) {
          if (otherId === id) {
            continue;
          }
          const other = this.segments.get(otherId);
          if (!other) {
            continue;
          }
          if (segmentsCollide(candidate, other, this.clearance)) {
            violates = true;
            break;
          }
        }

        if (!violates) {
          // Apply the relaxation step
          this.segments.set(id, candidate);
          this.segGrid.remove(id);
          this.segGrid.insert(id, segmentAABB(candidate, this.clearance));
          modifiedSegments.set(id, candidate);
          improved = true;
        }
      }

      if (!improved) {
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Deep copy helpers
// ---------------------------------------------------------------------------

function deepCopySegment(s: PushShoveSegment): PushShoveSegment {
  return {
    id: s.id,
    p1: { x: s.p1.x, y: s.p1.y },
    p2: { x: s.p2.x, y: s.p2.y },
    width: s.width,
    layer: s.layer,
    netId: s.netId,
  };
}

function deepCopyVia(v: PushShoveVia): PushShoveVia {
  return {
    id: v.id,
    position: { x: v.position.x, y: v.position.y },
    diameter: v.diameter,
    netId: v.netId,
  };
}
