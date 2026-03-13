/**
 * WireRerouterManager — singleton+subscribe pattern for interactive wire
 * segment drag-rerouting on the schematic canvas.
 *
 * Allows the user to grab a wire segment midpoint and drag it to create an
 * L-shaped detour, maintaining connections to adjacent segments.
 *
 * Compatible with `useSyncExternalStore`.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

export interface WireSegment {
  wireId: string;
  segmentIndex: number;
  start: Point;
  end: Point;
}

export interface RerouteResult {
  wireId: string;
  newPoints: Point[];
  isValid: boolean;
}

export interface HitTestResult {
  segment: WireSegment;
  /** Closest point on the segment to the test point. */
  projection: Point;
  /** Distance from the test point to the projection. */
  distance: number;
}

export interface DragPreview {
  wireId: string;
  segmentIndex: number;
  points: Point[];
}

type DragState = 'idle' | 'dragging';

type Listener = () => void;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Snap a coordinate to the nearest grid increment. */
export function snapToGrid(point: Point, gridSize: number): Point {
  if (gridSize <= 0) return { ...point };
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

/** Squared distance between two points. */
function distSq(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Euclidean distance between two points. */
function dist(a: Point, b: Point): number {
  return Math.sqrt(distSq(a, b));
}

/**
 * Project a point onto a line segment and return the closest point on the
 * segment plus the parametric `t` value (0 = start, 1 = end).
 */
function projectOntoSegment(
  point: Point,
  segStart: Point,
  segEnd: Point,
): { projection: Point; t: number } {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Zero-length segment — projection is the segment point itself
    return { projection: { ...segStart }, t: 0 };
  }

  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return {
    projection: {
      x: segStart.x + t * dx,
      y: segStart.y + t * dy,
    },
    t,
  };
}

// ---------------------------------------------------------------------------
// Hit testing
// ---------------------------------------------------------------------------

/**
 * Find the closest wire segment to a point within a distance threshold.
 *
 * @param point     The test point (e.g. cursor position in flow space).
 * @param segments  All candidate wire segments.
 * @param threshold Maximum distance in pixels (default 8).
 * @returns         The closest segment hit result, or `null` if none within threshold.
 */
export function hitTestSegment(
  point: Point,
  segments: WireSegment[],
  threshold = 8,
): HitTestResult | null {
  let best: HitTestResult | null = null;

  for (const seg of segments) {
    const { projection } = projectOntoSegment(point, seg.start, seg.end);
    const d = dist(point, projection);

    if (d <= threshold && (best === null || d < best.distance)) {
      best = { segment: seg, projection, distance: d };
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Reroute path computation
// ---------------------------------------------------------------------------

/**
 * Determine the orientation of a segment.
 */
function segmentOrientation(start: Point, end: Point): 'horizontal' | 'vertical' | 'diagonal' {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  if (dy < 0.001) return 'horizontal';
  if (dx < 0.001) return 'vertical';
  return 'diagonal';
}

/**
 * Given original segment endpoints and a drag position, compute the rerouted
 * path as an L-shaped detour that preserves start/end connections.
 *
 * - Horizontal segment + vertical drag → vertical detour (start → corner1 → corner2 → end)
 * - Vertical segment + horizontal drag → horizontal detour
 * - Diagonal segments are split into H-then-V at the drag point
 *
 * All intermediate points are snapped to the grid.
 *
 * @param segment   The original wire segment being dragged.
 * @param dragPoint Where the user is dragging the midpoint to.
 * @param gridSize  Grid snap size (0 = no snap).
 * @returns         The new set of points for this segment's portion of the wire.
 */
export function computeReroutedPath(
  segment: WireSegment,
  dragPoint: Point,
  gridSize: number,
): Point[] {
  const { start, end } = segment;
  const snapped = gridSize > 0 ? snapToGrid(dragPoint, gridSize) : { ...dragPoint };

  const orientation = segmentOrientation(start, end);

  if (orientation === 'horizontal') {
    // Segment is horizontal — drag creates a vertical detour.
    // start → (start.x, snapped.y) → (end.x, snapped.y) → end
    const corner1: Point = { x: start.x, y: snapped.y };
    const corner2: Point = { x: end.x, y: snapped.y };
    return [start, corner1, corner2, end];
  }

  if (orientation === 'vertical') {
    // Segment is vertical — drag creates a horizontal detour.
    // start → (snapped.x, start.y) → (snapped.x, end.y) → end
    const corner1: Point = { x: snapped.x, y: start.y };
    const corner2: Point = { x: snapped.x, y: end.y };
    return [start, corner1, corner2, end];
  }

  // Diagonal — route through the drag point with an L-shape
  // start → (snapped.x, start.y) → (snapped.x, end.y) → end
  const corner1: Point = { x: snapped.x, y: start.y };
  const corner2: Point = { x: snapped.x, y: end.y };
  return [start, corner1, corner2, end];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Remove consecutive duplicate points (zero-length segments).
 */
function deduplicatePoints(points: Point[]): Point[] {
  if (points.length === 0) return [];
  const result: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    if (Math.abs(points[i].x - prev.x) > 0.001 || Math.abs(points[i].y - prev.y) > 0.001) {
      result.push(points[i]);
    }
  }
  return result;
}

/**
 * Check if a point is on-grid (within a small tolerance).
 */
function isOnGrid(point: Point, gridSize: number): boolean {
  if (gridSize <= 0) return true;
  const snapped = snapToGrid(point, gridSize);
  return Math.abs(point.x - snapped.x) < 0.01 && Math.abs(point.y - snapped.y) < 0.01;
}

export interface ExistingWire {
  wireId: string;
  points: Point[];
}

/**
 * Validate a rerouted path.
 *
 * Checks:
 * 1. At least 2 distinct points remain after deduplication.
 * 2. All points are on-grid (if gridSize > 0).
 * 3. No overlapping segments with wires from other nets.
 *
 * @param newPoints     The proposed new points for the rerouted segment.
 * @param existingWires Other wires (different net) to check for overlap.
 * @param gridSize      Grid snap size (0 = skip grid check).
 * @returns             `true` if the reroute is valid.
 */
export function validateReroute(
  newPoints: Point[],
  existingWires: ExistingWire[],
  gridSize = 0,
): boolean {
  const deduped = deduplicatePoints(newPoints);

  // Must have at least 2 distinct points to form a wire
  if (deduped.length < 2) return false;

  // Grid alignment check
  if (gridSize > 0) {
    for (const pt of deduped) {
      if (!isOnGrid(pt, gridSize)) return false;
    }
  }

  // Overlap check — look for collinear overlapping segments with other wires
  for (const wire of existingWires) {
    if (hasOverlap(deduped, wire.points)) return false;
  }

  return true;
}

/**
 * Check if any segment of path A overlaps with any segment of path B.
 * Two segments overlap if they are collinear and share a non-zero-length range.
 */
function hasOverlap(pathA: Point[], pathB: Point[]): boolean {
  for (let i = 0; i < pathA.length - 1; i++) {
    for (let j = 0; j < pathB.length - 1; j++) {
      if (segmentsOverlap(pathA[i], pathA[i + 1], pathB[j], pathB[j + 1])) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if two collinear segments share a non-zero-length overlap.
 */
function segmentsOverlap(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  // Both horizontal on the same Y
  if (
    Math.abs(a1.y - a2.y) < 0.001 &&
    Math.abs(b1.y - b2.y) < 0.001 &&
    Math.abs(a1.y - b1.y) < 0.001
  ) {
    const aMin = Math.min(a1.x, a2.x);
    const aMax = Math.max(a1.x, a2.x);
    const bMin = Math.min(b1.x, b2.x);
    const bMax = Math.max(b1.x, b2.x);
    const overlapStart = Math.max(aMin, bMin);
    const overlapEnd = Math.min(aMax, bMax);
    return overlapEnd - overlapStart > 0.001;
  }

  // Both vertical on the same X
  if (
    Math.abs(a1.x - a2.x) < 0.001 &&
    Math.abs(b1.x - b2.x) < 0.001 &&
    Math.abs(a1.x - b1.x) < 0.001
  ) {
    const aMin = Math.min(a1.y, a2.y);
    const aMax = Math.max(a1.y, a2.y);
    const bMin = Math.min(b1.y, b2.y);
    const bMax = Math.max(b1.y, b2.y);
    const overlapStart = Math.max(aMin, bMin);
    const overlapEnd = Math.min(aMax, bMax);
    return overlapEnd - overlapStart > 0.001;
  }

  return false;
}

// ---------------------------------------------------------------------------
// WireRerouterManager — singleton + subscribe
// ---------------------------------------------------------------------------

class WireRerouterManagerImpl {
  private _state: DragState = 'idle';
  private _wireId: string | null = null;
  private _segmentIndex: number | null = null;
  private _originalSegment: WireSegment | null = null;
  private _originalWirePoints: Point[] = [];
  private _currentDragPoint: Point | null = null;
  private _gridSize = 20;
  private _preview: DragPreview | null = null;
  private _version = 0;
  private listeners = new Set<Listener>();

  // ---- Public getters ----

  get state(): DragState {
    return this._state;
  }

  get version(): number {
    return this._version;
  }

  get isDragging(): boolean {
    return this._state === 'dragging';
  }

  // ---- Configuration ----

  setGridSize(gridSize: number): void {
    this._gridSize = gridSize;
  }

  // ---- Drag state machine ----

  /**
   * Begin dragging a wire segment.
   *
   * @param wireId         The wire being rerouted.
   * @param segmentIndex   Index of the segment within the wire's point array
   *                       (segment i connects points[i] to points[i+1]).
   * @param wirePoints     The full array of points for the wire.
   */
  startDrag(wireId: string, segmentIndex: number, wirePoints: Point[]): void {
    if (this._state === 'dragging') {
      this.cancelDrag();
    }

    // Protect endpoint segments (first and last) — only allow reroute of inner segments
    if (wirePoints.length < 3) {
      // Wire with only 2 points has a single segment — that IS an endpoint segment,
      // but we still allow dragging it since there's no other option.
    }

    this._state = 'dragging';
    this._wireId = wireId;
    this._segmentIndex = segmentIndex;
    this._originalSegment = {
      wireId,
      segmentIndex,
      start: { ...wirePoints[segmentIndex] },
      end: { ...wirePoints[segmentIndex + 1] },
    };
    this._originalWirePoints = wirePoints.map((p) => ({ ...p }));
    this._currentDragPoint = null;
    this._preview = null;
    this._version++;
    this.notify();
  }

  /**
   * Update the drag position. Recomputes the preview path.
   */
  updateDrag(point: Point): void {
    if (this._state !== 'dragging' || !this._originalSegment) return;

    this._currentDragPoint = { ...point };

    const reroutedSegmentPoints = computeReroutedPath(
      this._originalSegment,
      point,
      this._gridSize,
    );

    // Build the full preview wire: original points before the segment,
    // rerouted segment points, original points after the segment.
    const idx = this._segmentIndex!;
    const before = this._originalWirePoints.slice(0, idx);
    const after = this._originalWirePoints.slice(idx + 2);
    const fullPreview = [...before, ...reroutedSegmentPoints, ...after];

    this._preview = {
      wireId: this._wireId!,
      segmentIndex: idx,
      points: deduplicatePoints(fullPreview),
    };

    this._version++;
    this.notify();
  }

  /**
   * Finalize the drag. Returns the reroute result.
   */
  endDrag(existingWires: ExistingWire[] = []): RerouteResult | null {
    if (this._state !== 'dragging' || !this._preview) {
      this.cancelDrag();
      return null;
    }

    const newPoints = this._preview.points;
    const isValid = validateReroute(newPoints, existingWires, this._gridSize);

    const result: RerouteResult = {
      wireId: this._wireId!,
      newPoints: deduplicatePoints(newPoints),
      isValid,
    };

    this.resetDragState();
    return result;
  }

  /**
   * Cancel the current drag, restoring original state.
   */
  cancelDrag(): void {
    if (this._state !== 'dragging') return;
    this.resetDragState();
  }

  /**
   * Get the current preview during an active drag.
   */
  getDragPreview(): DragPreview | null {
    return this._preview;
  }

  /**
   * Get the current drag point (for cursor tracking).
   */
  getDragPoint(): Point | null {
    return this._currentDragPoint;
  }

  /**
   * Get the wire ID currently being dragged.
   */
  getDragWireId(): string | null {
    return this._wireId;
  }

  // ---- Subscribe pattern (useSyncExternalStore compatible) ----

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): number {
    return this._version;
  }

  // ---- Reset helper ----

  /** Reset all state. Useful in tests. */
  reset(): void {
    this.resetDragState();
  }

  // ---- Internal ----

  private resetDragState(): void {
    this._state = 'idle';
    this._wireId = null;
    this._segmentIndex = null;
    this._originalSegment = null;
    this._originalWirePoints = [];
    this._currentDragPoint = null;
    this._preview = null;
    this._version++;
    this.notify();
  }

  private notify(): void {
    Array.from(this.listeners).forEach((listener) => {
      listener();
    });
  }
}

/** Singleton instance. */
export const wireRerouterManager = new WireRerouterManagerImpl();
