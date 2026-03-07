/**
 * PCBDrcChecker — PCB-specific DRC with spatial indexing for real-time
 * interactive routing checks.
 *
 * All dimensions are in millimeters. Pure class, no React dependencies.
 */

import type { CopperZone, FillResult, ZoneConflict } from '@/lib/copper-pour';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ObstacleGeometry =
  | { kind: 'segment'; x1: number; y1: number; x2: number; y2: number; width: number }
  | { kind: 'circle'; cx: number; cy: number; radius: number }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rotation?: number }
  | { kind: 'polygon'; points: Array<{ x: number; y: number }> }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }; // board edge

export interface PCBObstacle {
  id: string;
  type: 'trace' | 'pad' | 'via' | 'pour' | 'edge';
  layer: string; // 'front', 'back', or 'all' for through-hole/edge
  netId?: string;
  geometry: ObstacleGeometry;
}

export interface PCBDrcViolation {
  type:
    | 'trace-trace'
    | 'trace-pad'
    | 'trace-via'
    | 'via-via'
    | 'trace-edge'
    | 'min-width'
    | 'unrouted'
    | 'pour-min-width'
    | 'pour-island'
    | 'pour-conflict'
    | 'thermal-relief';
  message: string;
  position: { x: number; y: number };
  severity: 'error' | 'warning';
  obstacleIds: string[];
  clearanceRequired: number; // mm
  clearanceActual: number; // mm
}

// ---------------------------------------------------------------------------
// AABB helper
// ---------------------------------------------------------------------------

interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function geometryToAABB(g: ObstacleGeometry): AABB {
  switch (g.kind) {
    case 'segment': {
      const hw = g.width / 2;
      return {
        minX: Math.min(g.x1, g.x2) - hw,
        minY: Math.min(g.y1, g.y2) - hw,
        maxX: Math.max(g.x1, g.x2) + hw,
        maxY: Math.max(g.y1, g.y2) + hw,
      };
    }
    case 'circle':
      return {
        minX: g.cx - g.radius,
        minY: g.cy - g.radius,
        maxX: g.cx + g.radius,
        maxY: g.cy + g.radius,
      };
    case 'rect':
      return {
        minX: g.x,
        minY: g.y,
        maxX: g.x + g.width,
        maxY: g.y + g.height,
      };
    case 'polygon': {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of g.points) {
        if (p.x < minX) { minX = p.x; }
        if (p.y < minY) { minY = p.y; }
        if (p.x > maxX) { maxX = p.x; }
        if (p.y > maxY) { maxY = p.y; }
      }
      return { minX, minY, maxX, maxY };
    }
    case 'line':
      return {
        minX: Math.min(g.x1, g.x2),
        minY: Math.min(g.y1, g.y2),
        maxX: Math.max(g.x1, g.x2),
        maxY: Math.max(g.y1, g.y2),
      };
  }
}

// ---------------------------------------------------------------------------
// Spatial Grid
// ---------------------------------------------------------------------------

class SpatialGrid {
  private cellSize: number;
  private cells = new Map<string, Set<string>>();
  private obstacles = new Map<string, { obstacle: PCBObstacle; aabb: AABB }>();

  constructor(cellSize = 1.0) {
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

  insert(obstacle: PCBObstacle): void {
    const aabb = geometryToAABB(obstacle.geometry);
    this.obstacles.set(obstacle.id, { obstacle, aabb });
    const range = this.getCellRange(aabb);
    for (let cx = range.x0; cx <= range.x1; cx++) {
      for (let cy = range.y0; cy <= range.y1; cy++) {
        const key = this.cellKey(cx, cy);
        let cell = this.cells.get(key);
        if (!cell) {
          cell = new Set();
          this.cells.set(key, cell);
        }
        cell.add(obstacle.id);
      }
    }
  }

  remove(id: string): void {
    const entry = this.obstacles.get(id);
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
    this.obstacles.delete(id);
  }

  clear(): void {
    this.cells.clear();
    this.obstacles.clear();
  }

  /** Query all obstacle IDs whose AABB overlaps the given AABB. */
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

  getObstacle(id: string): PCBObstacle | undefined {
    return this.obstacles.get(id)?.obstacle;
  }

  getAllIds(): string[] {
    return Array.from(this.obstacles.keys());
  }

  getAll(): PCBObstacle[] {
    return Array.from(this.obstacles.values()).map((e) => e.obstacle);
  }
}

// ---------------------------------------------------------------------------
// Geometry distance helpers
// ---------------------------------------------------------------------------

/** Floating-point epsilon for boundary comparisons. */
const EPSILON = 1e-6;

function pointToPointDist(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Minimum distance from point (px, py) to segment (sx1,sy1)→(sx2,sy2).
 * Returns the distance and the closest point on the segment.
 */
function pointToSegmentDist(
  px: number,
  py: number,
  sx1: number,
  sy1: number,
  sx2: number,
  sy2: number,
): { dist: number; closestX: number; closestY: number } {
  const dx = sx2 - sx1;
  const dy = sy2 - sy1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < EPSILON * EPSILON) {
    // Degenerate segment (zero length)
    const d = pointToPointDist(px, py, sx1, sy1);
    return { dist: d, closestX: sx1, closestY: sy1 };
  }
  let t = ((px - sx1) * dx + (py - sy1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = sx1 + t * dx;
  const closestY = sy1 + t * dy;
  return { dist: pointToPointDist(px, py, closestX, closestY), closestX, closestY };
}

/**
 * Minimum distance between two line segments.
 * Returns the distance and the midpoint of the closest pair.
 */
function segmentToSegmentDist(
  ax1: number,
  ay1: number,
  ax2: number,
  ay2: number,
  bx1: number,
  by1: number,
  bx2: number,
  by2: number,
): { dist: number; midX: number; midY: number } {
  // Check if segments intersect
  if (segmentsIntersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2)) {
    const pt = segmentIntersectionPoint(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2);
    return { dist: 0, midX: pt.x, midY: pt.y };
  }

  // Check all 4 point-to-segment combinations
  const d1 = pointToSegmentDist(ax1, ay1, bx1, by1, bx2, by2);
  const d2 = pointToSegmentDist(ax2, ay2, bx1, by1, bx2, by2);
  const d3 = pointToSegmentDist(bx1, by1, ax1, ay1, ax2, ay2);
  const d4 = pointToSegmentDist(bx2, by2, ax1, ay1, ax2, ay2);

  let best = d1;
  let bestPx = ax1;
  let bestPy = ay1;
  if (d2.dist < best.dist) {
    best = d2;
    bestPx = ax2;
    bestPy = ay2;
  }
  if (d3.dist < best.dist) {
    best = d3;
    bestPx = bx1;
    bestPy = by1;
  }
  if (d4.dist < best.dist) {
    best = d4;
    bestPx = bx2;
    bestPy = by2;
  }

  return {
    dist: best.dist,
    midX: (bestPx + best.closestX) / 2,
    midY: (bestPy + best.closestY) / 2,
  };
}

function cross(ox: number, oy: number, ax: number, ay: number, bx: number, by: number): number {
  return (ax - ox) * (by - oy) - (ay - oy) * (bx - ox);
}

function segmentsIntersect(
  ax1: number,
  ay1: number,
  ax2: number,
  ay2: number,
  bx1: number,
  by1: number,
  bx2: number,
  by2: number,
): boolean {
  const d1 = cross(bx1, by1, bx2, by2, ax1, ay1);
  const d2 = cross(bx1, by1, bx2, by2, ax2, ay2);
  const d3 = cross(ax1, ay1, ax2, ay2, bx1, by1);
  const d4 = cross(ax1, ay1, ax2, ay2, bx2, by2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  // Collinear overlap cases
  if (Math.abs(d1) < EPSILON && onSegment(bx1, by1, bx2, by2, ax1, ay1)) { return true; }
  if (Math.abs(d2) < EPSILON && onSegment(bx1, by1, bx2, by2, ax2, ay2)) { return true; }
  if (Math.abs(d3) < EPSILON && onSegment(ax1, ay1, ax2, ay2, bx1, by1)) { return true; }
  if (Math.abs(d4) < EPSILON && onSegment(ax1, ay1, ax2, ay2, bx2, by2)) { return true; }
  return false;
}

function onSegment(sx1: number, sy1: number, sx2: number, sy2: number, px: number, py: number): boolean {
  return (
    px >= Math.min(sx1, sx2) - EPSILON &&
    px <= Math.max(sx1, sx2) + EPSILON &&
    py >= Math.min(sy1, sy2) - EPSILON &&
    py <= Math.max(sy1, sy2) + EPSILON
  );
}

function segmentIntersectionPoint(
  ax1: number,
  ay1: number,
  ax2: number,
  ay2: number,
  bx1: number,
  by1: number,
  bx2: number,
  by2: number,
): { x: number; y: number } {
  const dax = ax2 - ax1;
  const day = ay2 - ay1;
  const dbx = bx2 - bx1;
  const dby = by2 - by1;
  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) < EPSILON) {
    // Parallel/collinear — return midpoint of overlap
    return { x: (ax1 + bx1) / 2, y: (ay1 + by1) / 2 };
  }
  const t = ((bx1 - ax1) * dby - (by1 - ay1) * dbx) / denom;
  return { x: ax1 + t * dax, y: ay1 + t * day };
}

/**
 * Distance from a point to the nearest edge of a polygon.
 */
function pointToPolygonDist(px: number, py: number, points: Array<{ x: number; y: number }>): number {
  let minDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const d = pointToSegmentDist(px, py, points[i].x, points[i].y, points[j].x, points[j].y);
    if (d.dist < minDist) {
      minDist = d.dist;
    }
  }
  // Check if point is inside the polygon — if so, distance is to nearest edge (negative convention)
  if (pointInPolygon(px, py, points)) {
    return -minDist; // negative means inside
  }
  return minDist;
}

function pointInPolygon(px: number, py: number, points: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Minimum distance from a segment to a polygon (edge-to-edge).
 */
function segmentToPolygonDist(
  sx1: number,
  sy1: number,
  sx2: number,
  sy2: number,
  points: Array<{ x: number; y: number }>,
): { dist: number; midX: number; midY: number } {
  let minDist = Infinity;
  let bestMidX = (sx1 + sx2) / 2;
  let bestMidY = (sy1 + sy2) / 2;

  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const d = segmentToSegmentDist(
      sx1, sy1, sx2, sy2,
      points[i].x, points[i].y, points[j].x, points[j].y,
    );
    if (d.dist < minDist) {
      minDist = d.dist;
      bestMidX = d.midX;
      bestMidY = d.midY;
    }
  }

  // Also check if segment endpoints are inside the polygon
  if (pointInPolygon(sx1, sy1, points) || pointInPolygon(sx2, sy2, points)) {
    return { dist: 0, midX: bestMidX, midY: bestMidY };
  }

  return { dist: minDist, midX: bestMidX, midY: bestMidY };
}

/**
 * Distance from point to a rectangle (x, y, width, height) edge.
 * If inside, returns negative distance.
 */
function pointToRectDist(px: number, py: number, rx: number, ry: number, rw: number, rh: number): number {
  const dx = Math.max(rx - px, 0, px - (rx + rw));
  const dy = Math.max(ry - py, 0, py - (ry + rh));
  if (dx === 0 && dy === 0) {
    // Inside the rect — return negative of distance to nearest edge
    const distToEdge = Math.min(
      px - rx,
      (rx + rw) - px,
      py - ry,
      (ry + rh) - py,
    );
    return -distToEdge;
  }
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Minimum distance from a segment to a rectangle.
 */
function segmentToRectDist(
  sx1: number,
  sy1: number,
  sx2: number,
  sy2: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): { dist: number; midX: number; midY: number } {
  // Convert rect to 4 edges and check segment-to-segment
  const corners: Array<{ x: number; y: number }> = [
    { x: rx, y: ry },
    { x: rx + rw, y: ry },
    { x: rx + rw, y: ry + rh },
    { x: rx, y: ry + rh },
  ];
  return segmentToPolygonDist(sx1, sy1, sx2, sy2, corners);
}

// ---------------------------------------------------------------------------
// Main clearance distance between a check-segment and an obstacle geometry
// ---------------------------------------------------------------------------

interface ClearanceResult {
  /** Edge-to-edge clearance (negative = overlap). */
  clearance: number;
  /** Position of the violation (midpoint of closest approach). */
  midX: number;
  midY: number;
}

/**
 * Compute the edge-to-edge clearance between a trace segment (with width)
 * and an obstacle geometry.
 *
 * For segments: subtracts half-widths from center-to-center distance.
 * For circles: subtracts radius.
 * For edges: computes perpendicular distance.
 */
function segmentToObstacleClearance(
  sx1: number,
  sy1: number,
  sx2: number,
  sy2: number,
  traceHalfWidth: number,
  geom: ObstacleGeometry,
): ClearanceResult {
  switch (geom.kind) {
    case 'segment': {
      const obsHalfWidth = geom.width / 2;
      const d = segmentToSegmentDist(sx1, sy1, sx2, sy2, geom.x1, geom.y1, geom.x2, geom.y2);
      return {
        clearance: d.dist - traceHalfWidth - obsHalfWidth,
        midX: d.midX,
        midY: d.midY,
      };
    }
    case 'circle': {
      // Find closest point on trace segment to the circle center
      const d = pointToSegmentDist(geom.cx, geom.cy, sx1, sy1, sx2, sy2);
      return {
        clearance: d.dist - traceHalfWidth - geom.radius,
        midX: (geom.cx + d.closestX) / 2,
        midY: (geom.cy + d.closestY) / 2,
      };
    }
    case 'rect': {
      const d = segmentToRectDist(sx1, sy1, sx2, sy2, geom.x, geom.y, geom.width, geom.height);
      return {
        clearance: d.dist - traceHalfWidth,
        midX: d.midX,
        midY: d.midY,
      };
    }
    case 'polygon': {
      const d = segmentToPolygonDist(sx1, sy1, sx2, sy2, geom.points);
      return {
        clearance: d.dist - traceHalfWidth,
        midX: d.midX,
        midY: d.midY,
      };
    }
    case 'line': {
      // Board edge — treat as a zero-width segment
      const d = segmentToSegmentDist(sx1, sy1, sx2, sy2, geom.x1, geom.y1, geom.x2, geom.y2);
      return {
        clearance: d.dist - traceHalfWidth,
        midX: d.midX,
        midY: d.midY,
      };
    }
  }
}

/**
 * Compute edge-to-edge clearance between a circular check area (via/pad)
 * and an obstacle geometry.
 */
function circleToObstacleClearance(
  cx: number,
  cy: number,
  radius: number,
  geom: ObstacleGeometry,
): ClearanceResult {
  switch (geom.kind) {
    case 'segment': {
      const d = pointToSegmentDist(cx, cy, geom.x1, geom.y1, geom.x2, geom.y2);
      return {
        clearance: d.dist - radius - geom.width / 2,
        midX: (cx + d.closestX) / 2,
        midY: (cy + d.closestY) / 2,
      };
    }
    case 'circle': {
      const dist = pointToPointDist(cx, cy, geom.cx, geom.cy);
      return {
        clearance: dist - radius - geom.radius,
        midX: (cx + geom.cx) / 2,
        midY: (cy + geom.cy) / 2,
      };
    }
    case 'rect': {
      const d = pointToRectDist(cx, cy, geom.x, geom.y, geom.width, geom.height);
      return {
        clearance: (d < 0 ? d : d) - radius,
        midX: cx,
        midY: cy,
      };
    }
    case 'polygon': {
      const d = pointToPolygonDist(cx, cy, geom.points);
      return {
        clearance: (d < 0 ? d : d) - radius,
        midX: cx,
        midY: cy,
      };
    }
    case 'line': {
      const d = pointToSegmentDist(cx, cy, geom.x1, geom.y1, geom.x2, geom.y2);
      return {
        clearance: d.dist - radius,
        midX: (cx + d.closestX) / 2,
        midY: (cy + d.closestY) / 2,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Violation type classification
// ---------------------------------------------------------------------------

function classifyViolationType(
  checkType: 'trace' | 'via',
  obstacleType: PCBObstacle['type'],
): PCBDrcViolation['type'] {
  if (obstacleType === 'edge') {
    return 'trace-edge';
  }
  if (checkType === 'via' && obstacleType === 'via') {
    return 'via-via';
  }
  if (obstacleType === 'pad') {
    return 'trace-pad';
  }
  if (obstacleType === 'via') {
    return 'trace-via';
  }
  // trace, pour
  return 'trace-trace';
}

// ---------------------------------------------------------------------------
// Layer compatibility check
// ---------------------------------------------------------------------------

function layersOverlap(layerA: string, layerB: string): boolean {
  if (layerA === 'all' || layerB === 'all') {
    return true;
  }
  return layerA === layerB;
}

// ---------------------------------------------------------------------------
// PCBDrcChecker
// ---------------------------------------------------------------------------

export class PCBDrcChecker {
  private grid: SpatialGrid;
  private clearance: number;
  private minTraceWidth: number;
  private boardEdgeClearance: number;
  private violations: PCBDrcViolation[] = [];

  constructor(defaultClearance = 0.2) {
    this.grid = new SpatialGrid(1.0); // 1mm cells
    this.clearance = defaultClearance;
    this.minTraceWidth = 0.1; // 0.1mm default minimum
    this.boardEdgeClearance = 0.5; // 0.5mm default
  }

  // -------------------------------------------------------------------------
  // Obstacle DB management
  // -------------------------------------------------------------------------

  buildObstacleDB(obstacles: PCBObstacle[]): void {
    this.grid.clear();
    for (const obs of obstacles) {
      this.grid.insert(obs);
    }
  }

  addObstacle(obstacle: PCBObstacle): void {
    this.grid.insert(obstacle);
  }

  removeObstacle(id: string): void {
    this.grid.remove(id);
  }

  clearObstacles(): void {
    this.grid.clear();
  }

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  setClearance(clearance: number): void {
    this.clearance = clearance;
  }

  setMinTraceWidth(width: number): void {
    this.minTraceWidth = width;
  }

  setBoardEdgeClearance(clearance: number): void {
    this.boardEdgeClearance = clearance;
  }

  // -------------------------------------------------------------------------
  // Real-time checks
  // -------------------------------------------------------------------------

  /**
   * Check a proposed trace (polyline) against all existing obstacles.
   * Returns violations found.
   */
  checkTrace(
    points: Array<{ x: number; y: number }>,
    width: number,
    layer: string,
    netId?: string,
  ): PCBDrcViolation[] {
    const results: PCBDrcViolation[] = [];

    // Min width check
    if (width < this.minTraceWidth - EPSILON) {
      const midIdx = Math.floor(points.length / 2);
      const pos = points[midIdx] ?? points[0];
      if (pos) {
        results.push({
          type: 'min-width',
          message: `Trace width ${String(width)}mm is below minimum ${String(this.minTraceWidth)}mm`,
          position: { x: pos.x, y: pos.y },
          severity: 'error',
          obstacleIds: [],
          clearanceRequired: this.minTraceWidth,
          clearanceActual: width,
        });
      }
    }

    if (points.length < 2) {
      return results;
    }

    const halfWidth = width / 2;

    // Process each segment of the polyline
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      // Build query AABB for this segment (expanded by clearance)
      const expand = halfWidth + Math.max(this.clearance, this.boardEdgeClearance) + 1.0; // +1mm margin
      const queryAABB: AABB = {
        minX: Math.min(p1.x, p2.x) - expand,
        minY: Math.min(p1.y, p2.y) - expand,
        maxX: Math.max(p1.x, p2.x) + expand,
        maxY: Math.max(p1.y, p2.y) + expand,
      };

      const candidateIds = this.grid.query(queryAABB);

      for (const candidateId of candidateIds) {
        const obstacle = this.grid.getObstacle(candidateId);
        if (!obstacle) {
          continue;
        }

        // Layer filter
        if (!layersOverlap(layer, obstacle.layer)) {
          continue;
        }

        // Same-net bypass (except edges)
        if (obstacle.type !== 'edge' && netId && obstacle.netId && netId === obstacle.netId) {
          continue;
        }

        // Determine required clearance
        const required = obstacle.type === 'edge' ? this.boardEdgeClearance : this.clearance;

        const cr = segmentToObstacleClearance(p1.x, p1.y, p2.x, p2.y, halfWidth, obstacle.geometry);

        if (cr.clearance < required - EPSILON) {
          const violationType = classifyViolationType('trace', obstacle.type);
          results.push({
            type: violationType,
            message: `${violationType} clearance violation: ${String(cr.clearance.toFixed(3))}mm (required: ${String(required)}mm)`,
            position: { x: cr.midX, y: cr.midY },
            severity: 'error',
            obstacleIds: [candidateId],
            clearanceRequired: required,
            clearanceActual: cr.clearance,
          });
        }
      }
    }

    return results;
  }

  /**
   * Check a proposed via placement against all existing obstacles.
   */
  checkVia(
    position: { x: number; y: number },
    drillDiam: number,
    outerDiam: number,
    netId?: string,
  ): PCBDrcViolation[] {
    const results: PCBDrcViolation[] = [];
    const radius = outerDiam / 2;

    // Query area around the via
    const expand = radius + Math.max(this.clearance, this.boardEdgeClearance) + 1.0;
    const queryAABB: AABB = {
      minX: position.x - expand,
      minY: position.y - expand,
      maxX: position.x + expand,
      maxY: position.y + expand,
    };

    const candidateIds = this.grid.query(queryAABB);

    for (const candidateId of candidateIds) {
      const obstacle = this.grid.getObstacle(candidateId);
      if (!obstacle) {
        continue;
      }

      // Via is 'all' layers — check against everything
      if (!layersOverlap('all', obstacle.layer)) {
        continue;
      }

      // Same-net bypass (except edges)
      if (obstacle.type !== 'edge' && netId && obstacle.netId && netId === obstacle.netId) {
        continue;
      }

      const required = obstacle.type === 'edge' ? this.boardEdgeClearance : this.clearance;

      const cr = circleToObstacleClearance(position.x, position.y, radius, obstacle.geometry);

      if (cr.clearance < required - EPSILON) {
        const violationType = classifyViolationType('via', obstacle.type);
        results.push({
          type: violationType,
          message: `${violationType} clearance violation: ${String(cr.clearance.toFixed(3))}mm (required: ${String(required)}mm)`,
          position: { x: cr.midX, y: cr.midY },
          severity: 'error',
          obstacleIds: [candidateId],
          clearanceRequired: required,
          clearanceActual: cr.clearance,
        });
      }
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Full board check
  // -------------------------------------------------------------------------

  /**
   * Run DRC on all existing obstacles (pairwise).
   * De-duplicates: checks each pair only once (i < j).
   */
  checkAll(): PCBDrcViolation[] {
    this.violations = [];
    const allIds = this.grid.getAllIds();
    const checkedPairs = new Set<string>();

    for (const idA of allIds) {
      const obstacleA = this.grid.getObstacle(idA);
      if (!obstacleA) {
        continue;
      }

      const aabb = geometryToAABB(obstacleA.geometry);
      // Expand AABB by clearance for neighbor search
      const expand = Math.max(this.clearance, this.boardEdgeClearance) + 1.0;
      const queryAABB: AABB = {
        minX: aabb.minX - expand,
        minY: aabb.minY - expand,
        maxX: aabb.maxX + expand,
        maxY: aabb.maxY + expand,
      };

      const neighborIds = this.grid.query(queryAABB);

      for (const idB of neighborIds) {
        if (idA === idB) {
          continue;
        }

        // De-duplicate pairs
        const pairKey = idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
        if (checkedPairs.has(pairKey)) {
          continue;
        }
        checkedPairs.add(pairKey);

        const obstacleB = this.grid.getObstacle(idB);
        if (!obstacleB) {
          continue;
        }

        // Layer filter
        if (!layersOverlap(obstacleA.layer, obstacleB.layer)) {
          continue;
        }

        // Same-net bypass (except edges)
        if (
          obstacleA.type !== 'edge' &&
          obstacleB.type !== 'edge' &&
          obstacleA.netId &&
          obstacleB.netId &&
          obstacleA.netId === obstacleB.netId
        ) {
          continue;
        }

        // Compute clearance between the two geometries
        const isEdgePair = obstacleA.type === 'edge' || obstacleB.type === 'edge';
        const required = isEdgePair ? this.boardEdgeClearance : this.clearance;

        const cr = this.computePairClearance(obstacleA, obstacleB);

        if (cr.clearance < required - EPSILON) {
          const violationType = this.classifyPairViolation(obstacleA, obstacleB);
          this.violations.push({
            type: violationType,
            message: `${violationType} clearance violation: ${String(cr.clearance.toFixed(3))}mm (required: ${String(required)}mm)`,
            position: { x: cr.midX, y: cr.midY },
            severity: 'error',
            obstacleIds: [idA, idB],
            clearanceRequired: required,
            clearanceActual: cr.clearance,
          });
        }
      }
    }

    return [...this.violations];
  }

  // -------------------------------------------------------------------------
  // Copper pour validation
  // -------------------------------------------------------------------------

  /**
   * Validate copper pour zones for DRC violations.
   *
   * Checks:
   * - **pour-conflict**: Overlapping zones on the same layer with equal priority
   * - **pour-min-width**: Fill polygons narrower than the zone's minWidth
   * - **pour-island**: Disconnected copper fill fragments (more than 1 polygon
   *   after fill = potential orphan islands)
   * - **thermal-relief**: Zones with thermal relief set to 'none' on same-net
   *   pads (warns about potential cold solder joints)
   *
   * @param zones       All copper pour zones
   * @param conflicts   Zone overlap conflicts (from CopperPourEngine.detectConflicts)
   * @param fillResults Fill results per zone (from CopperPourEngine.fillZone)
   */
  validateCopperPour(
    zones: CopperZone[],
    conflicts: ZoneConflict[],
    fillResults: Map<string, FillResult>,
  ): PCBDrcViolation[] {
    const results: PCBDrcViolation[] = [];

    // --- pour-conflict: overlapping zones with same priority ---
    for (const conflict of conflicts) {
      if (conflict.resolution === 'error') {
        const z1 = zones.find((z) => z.id === conflict.zone1Id);
        const z2 = zones.find((z) => z.id === conflict.zone2Id);
        const pos = this.zoneCentroid(z1);

        results.push({
          type: 'pour-conflict',
          message: `Zone overlap conflict: "${z1?.name ?? conflict.zone1Id}" and "${z2?.name ?? conflict.zone2Id}" share ${String(conflict.overlapArea.toFixed(1))} sq mil overlap with equal priority`,
          position: pos,
          severity: 'error',
          obstacleIds: [conflict.zone1Id, conflict.zone2Id],
          clearanceRequired: 0,
          clearanceActual: 0,
        });
      }
    }

    // --- per-zone checks ---
    for (const zone of zones) {
      if (zone.isKeepout || zone.pourType === 'none') {
        continue;
      }

      const fill = fillResults.get(zone.id);
      if (!fill) {
        continue;
      }

      const zoneCentroid = this.zoneCentroid(zone);

      // --- pour-min-width: check each fill polygon ---
      for (const poly of fill.polygons) {
        if (poly.length < 3) {
          continue;
        }

        const width = this.estimatePolygonMinWidth(poly);
        if (width < zone.minWidth && width > 0) {
          // Find centroid of the thin polygon for violation position
          const polyCentroid = this.polygonCentroid(poly);
          results.push({
            type: 'pour-min-width',
            message: `Copper pour "${zone.name}" has fill strip ~${String(width.toFixed(1))} mils wide (minimum: ${String(zone.minWidth)} mils)`,
            position: polyCentroid,
            severity: 'error',
            obstacleIds: [zone.id],
            clearanceRequired: zone.minWidth,
            clearanceActual: width,
          });
        }
      }

      // --- pour-island: disconnected fill fragments ---
      if (fill.polygons.length > 1) {
        results.push({
          type: 'pour-island',
          message: `Copper pour "${zone.name}" has ${String(fill.polygons.length)} disconnected fill fragments — ${String(fill.polygons.length - 1)} potential orphan island(s)`,
          position: zoneCentroid,
          severity: 'warning',
          obstacleIds: [zone.id],
          clearanceRequired: 0,
          clearanceActual: 0,
        });
      }

      // --- thermal-relief: warn when thermal relief is 'none' ---
      if (zone.thermalRelief === 'none' && fill.thermalConnections.length > 0) {
        results.push({
          type: 'thermal-relief',
          message: `Copper pour "${zone.name}" has thermal relief disabled — ${String(fill.thermalConnections.length)} same-net pad(s) will have no thermal isolation, risking cold solder joints`,
          position: zoneCentroid,
          severity: 'warning',
          obstacleIds: [zone.id],
          clearanceRequired: 0,
          clearanceActual: 0,
        });
      }
    }

    // Append to internal violations list
    this.violations.push(...results);
    return results;
  }

  /**
   * Run full DRC including copper pour validation.
   * Convenience method that calls checkAll() then validateCopperPour().
   */
  checkAllWithPour(
    zones: CopperZone[],
    conflicts: ZoneConflict[],
    fillResults: Map<string, FillResult>,
  ): PCBDrcViolation[] {
    const routingViolations = this.checkAll();
    const pourViolations = this.validateCopperPour(zones, conflicts, fillResults);
    return [...routingViolations, ...pourViolations];
  }

  // -------------------------------------------------------------------------
  // Results
  // -------------------------------------------------------------------------

  getViolations(): PCBDrcViolation[] {
    return [...this.violations];
  }

  getViolationCount(): number {
    return this.violations.length;
  }

  clearViolations(): void {
    this.violations = [];
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private computePairClearance(a: PCBObstacle, b: PCBObstacle): ClearanceResult {
    // Use the geometry-specific functions based on both shapes
    const gA = a.geometry;
    const gB = b.geometry;

    // If either is a segment (trace), use segmentToObstacleClearance
    if (gA.kind === 'segment') {
      return segmentToObstacleClearance(gA.x1, gA.y1, gA.x2, gA.y2, gA.width / 2, gB);
    }
    if (gB.kind === 'segment') {
      return segmentToObstacleClearance(gB.x1, gB.y1, gB.x2, gB.y2, gB.width / 2, gA);
    }

    // If either is a circle, use circleToObstacleClearance
    if (gA.kind === 'circle') {
      return circleToObstacleClearance(gA.cx, gA.cy, gA.radius, gB);
    }
    if (gB.kind === 'circle') {
      return circleToObstacleClearance(gB.cx, gB.cy, gB.radius, gA);
    }

    // Line (edge) to other geometry
    if (gA.kind === 'line') {
      return segmentToObstacleClearance(gA.x1, gA.y1, gA.x2, gA.y2, 0, gB);
    }
    if (gB.kind === 'line') {
      return segmentToObstacleClearance(gB.x1, gB.y1, gB.x2, gB.y2, 0, gA);
    }

    // Rect-to-rect or polygon-to-polygon — convert to polygon edges
    if (gA.kind === 'rect' && gB.kind === 'rect') {
      const cornersA: Array<{ x: number; y: number }> = [
        { x: gA.x, y: gA.y },
        { x: gA.x + gA.width, y: gA.y },
        { x: gA.x + gA.width, y: gA.y + gA.height },
        { x: gA.x, y: gA.y + gA.height },
      ];
      const cornersB: Array<{ x: number; y: number }> = [
        { x: gB.x, y: gB.y },
        { x: gB.x + gB.width, y: gB.y },
        { x: gB.x + gB.width, y: gB.y + gB.height },
        { x: gB.x, y: gB.y + gB.height },
      ];
      let minDist = Infinity;
      let bestMidX = 0;
      let bestMidY = 0;
      for (let i = 0; i < cornersA.length; i++) {
        const j = (i + 1) % cornersA.length;
        const d = segmentToPolygonDist(
          cornersA[i].x, cornersA[i].y, cornersA[j].x, cornersA[j].y, cornersB,
        );
        if (d.dist < minDist) {
          minDist = d.dist;
          bestMidX = d.midX;
          bestMidY = d.midY;
        }
      }
      return { clearance: minDist, midX: bestMidX, midY: bestMidY };
    }

    // Fallback: polygon edge comparison
    const pointsA = gA.kind === 'polygon' ? gA.points : [];
    const pointsB = gB.kind === 'polygon' ? gB.points : [];
    if (pointsA.length > 0 && pointsB.length > 0) {
      let minDist = Infinity;
      let bestMidX = 0;
      let bestMidY = 0;
      for (let i = 0; i < pointsA.length; i++) {
        const j = (i + 1) % pointsA.length;
        const d = segmentToPolygonDist(
          pointsA[i].x, pointsA[i].y, pointsA[j].x, pointsA[j].y, pointsB,
        );
        if (d.dist < minDist) {
          minDist = d.dist;
          bestMidX = d.midX;
          bestMidY = d.midY;
        }
      }
      return { clearance: minDist, midX: bestMidX, midY: bestMidY };
    }

    // Unknown combination — assume no violation
    return { clearance: Infinity, midX: 0, midY: 0 };
  }

  private zoneCentroid(zone: CopperZone | undefined): { x: number; y: number } {
    if (!zone || zone.boundary.length === 0) {
      return { x: 0, y: 0 };
    }
    let sumX = 0;
    let sumY = 0;
    for (const p of zone.boundary) {
      sumX += p.x;
      sumY += p.y;
    }
    return { x: sumX / zone.boundary.length, y: sumY / zone.boundary.length };
  }

  private polygonCentroid(poly: Array<{ x: number; y: number }>): { x: number; y: number } {
    if (poly.length === 0) {
      return { x: 0, y: 0 };
    }
    let sumX = 0;
    let sumY = 0;
    for (const p of poly) {
      sumX += p.x;
      sumY += p.y;
    }
    return { x: sumX / poly.length, y: sumY / poly.length };
  }

  /**
   * Estimate the minimum width of a polygon using the area/perimeter heuristic.
   * approxWidth = 2 * area / perimeter
   */
  private estimatePolygonMinWidth(poly: Array<{ x: number; y: number }>): number {
    if (poly.length < 3) {
      return 0;
    }
    let area = 0;
    let perimeter = 0;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += poly[i].x * poly[j].y;
      area -= poly[j].x * poly[i].y;
      const dx = poly[j].x - poly[i].x;
      const dy = poly[j].y - poly[i].y;
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    area = Math.abs(area) / 2;
    if (perimeter === 0) {
      return 0;
    }
    return (2 * area) / perimeter;
  }

  private classifyPairViolation(a: PCBObstacle, b: PCBObstacle): PCBDrcViolation['type'] {
    if (a.type === 'edge' || b.type === 'edge') {
      return 'trace-edge';
    }
    if (a.type === 'via' && b.type === 'via') {
      return 'via-via';
    }
    if (a.type === 'via' || b.type === 'via') {
      return 'trace-via';
    }
    if (a.type === 'pad' || b.type === 'pad') {
      return 'trace-pad';
    }
    return 'trace-trace';
  }
}
