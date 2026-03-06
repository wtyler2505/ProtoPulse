/**
 * TraceRouter — Interactive PCB trace routing engine.
 *
 * Manages the state machine for drawing copper traces on the PCB layout,
 * including 45-degree angle snapping, via insertion with layer switching,
 * and real-time DRC clearance checking against obstacles.
 *
 * Pure logic — no React, no DOM, no side effects.
 */

import type { ActiveLayer } from '@/components/views/pcb-layout/LayerManager';
import { DEFAULT_TRACE_WIDTH } from '@/components/views/pcb-layout/LayerManager';
import type { Via } from '@/lib/pcb/via-model';
import { ViaModel } from '@/lib/pcb/via-model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TracePoint {
  x: number; // mm
  y: number; // mm
}

export interface TracePreview {
  points: TracePoint[];
  layer: string;
  width: number; // mm
  violations: DRCViolation[];
  valid: boolean;
}

export interface TraceResult {
  wires: Array<{ points: TracePoint[]; layer: string; width: number }>;
  vias: Via[];
  netId: string;
}

export interface DRCViolation {
  type: string;
  message: string;
  position: TracePoint;
  severity: 'error' | 'warning';
}

export interface Obstacle {
  type: 'pad' | 'via' | 'trace';
  position: TracePoint;
  radius: number; // effective clearance radius in mm
  layer: string;  // 'front', 'back', or 'both'
  netId?: string;
}

// ---------------------------------------------------------------------------
// Internal state types
// ---------------------------------------------------------------------------

type RouterState = 'idle' | 'routing';

interface WireSegment {
  points: TracePoint[];
  layer: ActiveLayer;
  width: number;
}

// ---------------------------------------------------------------------------
// Utility functions (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Snap a target point to the nearest 45-degree angle relative to an origin.
 *
 * Returns the snapped point. Handles all 8 octants (0, 45, 90, 135, 180,
 * 225, 270, 315 degrees).
 */
export function snapAngle45(from: TracePoint, to: TracePoint): TracePoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // Handle zero-length case
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
    return { x: from.x, y: from.y };
  }

  // Compute angle in radians, snap to nearest 45 degrees
  const angle = Math.atan2(dy, dx);
  const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);

  // Project (dx, dy) onto the snapped direction to preserve the
  // coordinate along that axis rather than the euclidean distance.
  const cosA = Math.cos(snappedAngle);
  const sinA = Math.sin(snappedAngle);
  const projection = dx * cosA + dy * sinA;

  return {
    x: from.x + projection * cosA,
    y: from.y + projection * sinA,
  };
}

/**
 * Generate staircase routing points from a start point to a target.
 *
 * Produces intermediate waypoints using horizontal/vertical + diagonal
 * segments to approximate the target while respecting 45-degree routing.
 * Returns at least [from, to].
 */
function staircaseRoute(from: TracePoint, to: TracePoint): TracePoint[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  // If already on a 45-degree angle (or axis-aligned), direct connection
  if (adx < 1e-9 || ady < 1e-9 || Math.abs(adx - ady) < 1e-9) {
    return [from, to];
  }

  // Staircase: horizontal first, then diagonal
  const signX = dx >= 0 ? 1 : -1;
  const signY = dy >= 0 ? 1 : -1;

  if (adx > ady) {
    // Horizontal segment first, then diagonal
    const horizDist = adx - ady;
    const mid: TracePoint = {
      x: from.x + signX * horizDist,
      y: from.y,
    };
    return [from, mid, to];
  } else {
    // Vertical segment first, then diagonal
    const vertDist = ady - adx;
    const mid: TracePoint = {
      x: from.x,
      y: from.y + signY * vertDist,
    };
    return [from, mid, to];
  }
}

/**
 * Snap a point to the nearest grid intersection.
 */
export function snapToGrid(point: TracePoint, gridSize: number): TracePoint {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

/**
 * Compute the minimum distance from a point to a line segment.
 */
export function pointToSegmentDistance(
  point: TracePoint,
  segStart: TracePoint,
  segEnd: TracePoint,
): number {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lenSq = dx * dx + dy * dy;

  // Zero-length segment: distance to the point
  if (lenSq < 1e-18) {
    const px = point.x - segStart.x;
    const py = point.y - segStart.y;
    return Math.sqrt(px * px + py * py);
  }

  // Project point onto line, clamped to [0, 1]
  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = segStart.x + t * dx;
  const projY = segStart.y + t * dy;
  const ex = point.x - projX;
  const ey = point.y - projY;

  return Math.sqrt(ex * ex + ey * ey);
}

// ---------------------------------------------------------------------------
// TraceRouter
// ---------------------------------------------------------------------------

export class TraceRouter {
  private state: RouterState = 'idle';
  private traceWidth: number = DEFAULT_TRACE_WIDTH;
  private currentLayer: ActiveLayer = 'front';
  private netId = '';
  private obstacles: Obstacle[] = [];
  private minClearance = 0.2; // mm

  // Committed segments (after addVertex or insertVia)
  private committedSegments: WireSegment[] = [];
  // Committed vertices on the current layer segment
  private vertices: TracePoint[] = [];
  // Last preview points (from latest updatePreview)
  private lastPreviewPoints: TracePoint[] = [];
  // Vias inserted during this trace
  private vias: Via[] = [];
  // Current violations
  private currentViolations: DRCViolation[] = [];

  // ─── Configuration ─────────────────────────────────────────────────

  setTraceWidth(width: number): void {
    this.traceWidth = width;
  }

  setObstacles(obstacles: Obstacle[]): void {
    this.obstacles = obstacles;
  }

  setMinClearance(clearance: number): void {
    this.minClearance = clearance;
  }

  // ─── State queries ─────────────────────────────────────────────────

  isRouting(): boolean {
    return this.state === 'routing';
  }

  getCurrentLayer(): ActiveLayer {
    if (this.state !== 'routing') {
      throw new Error('Cannot get layer: not routing');
    }
    return this.currentLayer;
  }

  getViolations(): DRCViolation[] {
    return this.currentViolations;
  }

  // ─── Routing lifecycle ─────────────────────────────────────────────

  startTrace(
    fromPad: { x: number; y: number; netId?: number },
    layer: ActiveLayer,
    netId: string,
  ): void {
    if (this.state === 'routing') {
      throw new Error('Cannot start trace: already routing');
    }

    this.state = 'routing';
    this.currentLayer = layer;
    this.netId = netId;
    this.committedSegments = [];
    this.vertices = [{ x: fromPad.x, y: fromPad.y }];
    this.lastPreviewPoints = [];
    this.vias = [];
    this.currentViolations = [];
  }

  updatePreview(mousePos: TracePoint): TracePreview {
    if (this.state !== 'routing') {
      throw new Error('Cannot update preview: not routing');
    }

    const lastVertex = this.vertices[this.vertices.length - 1];
    const snapped = snapAngle45(lastVertex, mousePos);
    const segmentPoints = staircaseRoute(lastVertex, snapped);

    // Build full preview: all committed vertices + current segment
    const allPoints: TracePoint[] = [...this.vertices];
    // Append segment points (skip first since it duplicates the last vertex)
    for (let i = 1; i < segmentPoints.length; i++) {
      allPoints.push(segmentPoints[i]);
    }

    this.lastPreviewPoints = segmentPoints;

    // DRC checking
    const violations = this.checkSegmentsDRC(segmentPoints);
    this.currentViolations = violations;

    return {
      points: allPoints,
      layer: this.currentLayer,
      width: this.traceWidth,
      violations,
      valid: violations.length === 0,
    };
  }

  addVertex(): void {
    if (this.state !== 'routing') {
      throw new Error('Cannot add vertex: not routing');
    }

    // Commit the preview points to the vertex list
    if (this.lastPreviewPoints.length > 1) {
      // Add all intermediate and final points from the preview
      for (let i = 1; i < this.lastPreviewPoints.length; i++) {
        this.vertices.push(this.lastPreviewPoints[i]);
      }
    }
  }

  insertVia(): Via {
    if (this.state !== 'routing') {
      throw new Error('Cannot insert via: not routing');
    }

    const lastVertex = this.vertices[this.vertices.length - 1];
    const fromLayer = this.currentLayer;
    const toLayer: ActiveLayer = this.currentLayer === 'front' ? 'back' : 'front';

    // Commit the current segment as a wire on the current layer
    if (this.vertices.length >= 2) {
      this.committedSegments.push({
        points: [...this.vertices],
        layer: this.currentLayer,
        width: this.traceWidth,
      });
    }

    // Create the via
    const via = ViaModel.create(
      { x: lastVertex.x, y: lastVertex.y },
      { fromLayer, toLayer },
    );
    this.vias.push(via);

    // Switch layer and start fresh vertex list from via position
    this.currentLayer = toLayer;
    this.vertices = [{ x: lastVertex.x, y: lastVertex.y }];
    this.lastPreviewPoints = [];

    return via;
  }

  finishTrace(toPad?: { x: number; y: number }): TraceResult {
    if (this.state !== 'routing') {
      throw new Error('Cannot finish trace: not routing');
    }

    // If a target pad is provided, use it as the endpoint
    if (toPad) {
      const lastVertex = this.vertices[this.vertices.length - 1];
      const segPoints = staircaseRoute(lastVertex, { x: toPad.x, y: toPad.y });
      for (let i = 1; i < segPoints.length; i++) {
        this.vertices.push(segPoints[i]);
      }
    } else if (this.lastPreviewPoints.length > 1) {
      // Commit the last preview segment
      for (let i = 1; i < this.lastPreviewPoints.length; i++) {
        this.vertices.push(this.lastPreviewPoints[i]);
      }
    }

    // Commit the final segment
    if (this.vertices.length >= 1) {
      this.committedSegments.push({
        points: [...this.vertices],
        layer: this.currentLayer,
        width: this.traceWidth,
      });
    }

    const result: TraceResult = {
      wires: this.committedSegments.map((seg) => ({
        points: seg.points,
        layer: seg.layer,
        width: seg.width,
      })),
      vias: [...this.vias],
      netId: this.netId,
    };

    this.resetState();
    return result;
  }

  cancelTrace(): void {
    if (this.state !== 'routing') {
      throw new Error('Cannot cancel trace: not routing');
    }
    this.resetState();
  }

  // ─── Private helpers ───────────────────────────────────────────────

  private resetState(): void {
    this.state = 'idle';
    this.committedSegments = [];
    this.vertices = [];
    this.lastPreviewPoints = [];
    this.vias = [];
    this.currentViolations = [];
  }

  /**
   * Check proposed trace segment points against obstacles for clearance violations.
   */
  private checkSegmentsDRC(segmentPoints: TracePoint[]): DRCViolation[] {
    const violations: DRCViolation[] = [];

    for (const obstacle of this.obstacles) {
      // Skip obstacles on different layers (unless obstacle is 'both')
      if (obstacle.layer !== 'both' && obstacle.layer !== this.currentLayer) {
        continue;
      }

      // Skip obstacles belonging to the same net
      if (obstacle.netId === this.netId) {
        continue;
      }

      // Check distance from obstacle to each segment
      for (let i = 0; i < segmentPoints.length - 1; i++) {
        const dist = pointToSegmentDistance(
          obstacle.position,
          segmentPoints[i],
          segmentPoints[i + 1],
        );

        // Account for trace half-width and obstacle radius
        const effectiveClearance = dist - this.traceWidth / 2 - obstacle.radius;

        if (effectiveClearance < this.minClearance) {
          violations.push({
            type: 'clearance',
            message: `Trace clearance violation: ${effectiveClearance.toFixed(3)}mm < ${this.minClearance.toFixed(3)}mm minimum (${obstacle.type} obstacle)`,
            position: obstacle.position,
            severity: 'error',
          });
          break; // One violation per obstacle is enough
        }
      }
    }

    return violations;
  }
}

// ---------------------------------------------------------------------------
// Hit test result types
// ---------------------------------------------------------------------------

export interface SegmentHit {
  traceIndex: number;
  wireIndex: number;
  segmentIndex: number;
  distance: number;
}

export interface VertexHit {
  traceIndex: number;
  wireIndex: number;
  vertexIndex: number;
  distance: number;
}

// ---------------------------------------------------------------------------
// TraceEditor — editing operations on completed traces
// ---------------------------------------------------------------------------

export class TraceEditor {
  /**
   * Find the closest trace segment to a click point within the given tolerance.
   * Returns null if no segment is within tolerance.
   */
  hitTestSegment(
    point: TracePoint,
    traces: TraceResult[],
    tolerance: number,
  ): SegmentHit | null {
    let best: SegmentHit | null = null;

    for (let ti = 0; ti < traces.length; ti++) {
      const trace = traces[ti];
      for (let wi = 0; wi < trace.wires.length; wi++) {
        const wire = trace.wires[wi];
        for (let si = 0; si < wire.points.length - 1; si++) {
          const dist = pointToSegmentDistance(point, wire.points[si], wire.points[si + 1]);
          if (dist <= tolerance && (best === null || dist < best.distance)) {
            best = { traceIndex: ti, wireIndex: wi, segmentIndex: si, distance: dist };
          }
        }
      }
    }

    return best;
  }

  /**
   * Find the closest vertex to a click point within the given tolerance.
   * Returns null if no vertex is within tolerance.
   */
  hitTestVertex(
    point: TracePoint,
    traces: TraceResult[],
    tolerance: number,
  ): VertexHit | null {
    let best: VertexHit | null = null;

    for (let ti = 0; ti < traces.length; ti++) {
      const trace = traces[ti];
      for (let wi = 0; wi < trace.wires.length; wi++) {
        const wire = trace.wires[wi];
        for (let vi = 0; vi < wire.points.length; vi++) {
          const dx = point.x - wire.points[vi].x;
          const dy = point.y - wire.points[vi].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= tolerance && (best === null || dist < best.distance)) {
            best = { traceIndex: ti, wireIndex: wi, vertexIndex: vi, distance: dist };
          }
        }
      }
    }

    return best;
  }

  /**
   * Move a vertex to a new position. Returns a new TraceResult (immutable).
   */
  moveVertex(
    trace: TraceResult,
    wireIndex: number,
    vertexIndex: number,
    newPos: TracePoint,
  ): TraceResult {
    const newWires = trace.wires.map((wire, wi) => {
      if (wi !== wireIndex) {
        return { ...wire, points: wire.points.map((p) => ({ ...p })) };
      }
      const newPoints = wire.points.map((p, pi) => {
        if (pi === vertexIndex) {
          return { x: newPos.x, y: newPos.y };
        }
        return { ...p };
      });
      return { ...wire, points: newPoints };
    });

    return {
      wires: newWires,
      vias: trace.vias.map((v) => ({ ...v, position: { ...v.position } })),
      netId: trace.netId,
    };
  }

  /**
   * Move a segment (both of its endpoints) by a delta. Returns a new TraceResult.
   * The segment at segmentIndex connects points[segmentIndex] and points[segmentIndex+1].
   */
  moveSegment(
    trace: TraceResult,
    wireIndex: number,
    segmentIndex: number,
    delta: TracePoint,
  ): TraceResult {
    const newWires = trace.wires.map((wire, wi) => {
      if (wi !== wireIndex) {
        return { ...wire, points: wire.points.map((p) => ({ ...p })) };
      }
      const newPoints = wire.points.map((p, pi) => {
        if (pi === segmentIndex || pi === segmentIndex + 1) {
          return { x: p.x + delta.x, y: p.y + delta.y };
        }
        return { ...p };
      });
      return { ...wire, points: newPoints };
    });

    return {
      wires: newWires,
      vias: trace.vias.map((v) => ({ ...v, position: { ...v.position } })),
      netId: trace.netId,
    };
  }

  /**
   * Delete a segment from a wire, splitting the trace into fragments.
   *
   * Returns 0, 1, or 2 TraceResult fragments:
   * - 0: the wire had only one segment (entire wire deleted)
   * - 1: segment was at the start or end of the wire
   * - 2: segment was in the middle, splitting the wire into two parts
   */
  deleteSegment(
    trace: TraceResult,
    wireIndex: number,
    segmentIndex: number,
  ): TraceResult[] {
    const wire = trace.wires[wireIndex];
    const numSegments = wire.points.length - 1;

    // Only one segment — delete the whole wire
    if (numSegments <= 1) {
      return [];
    }

    const fragments: TraceResult[] = [];

    // Points before the deleted segment: [0..segmentIndex]
    if (segmentIndex > 0) {
      const beforePoints = wire.points.slice(0, segmentIndex + 1);
      fragments.push({
        wires: [{ points: beforePoints.map((p) => ({ ...p })), layer: wire.layer, width: wire.width }],
        vias: [],
        netId: trace.netId,
      });
    }

    // Points after the deleted segment: [segmentIndex+1..end]
    if (segmentIndex + 1 < wire.points.length - 1) {
      const afterPoints = wire.points.slice(segmentIndex + 1);
      fragments.push({
        wires: [{ points: afterPoints.map((p) => ({ ...p })), layer: wire.layer, width: wire.width }],
        vias: [],
        netId: trace.netId,
      });
    }

    return fragments;
  }

  /**
   * Select all traces belonging to a given net.
   */
  selectNet(netId: string, traces: TraceResult[]): TraceResult[] {
    return traces.filter((t) => t.netId === netId);
  }
}
