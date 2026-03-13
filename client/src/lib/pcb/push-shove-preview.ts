/**
 * PushShovePreviewManager — Visual feedback state for push-and-shove routing.
 *
 * Singleton + subscribe pattern (compatible with useSyncExternalStore).
 * Converts PushShoveResult data into renderable preview segments that show:
 *   - Original trace positions (ghost/dim gray)
 *   - New pushed positions (highlighted yellow)
 *   - The active routing trace (cyan)
 *   - Displacement arrows between original → pushed positions (orange)
 *
 * Colour scheme:
 *   - original  → gray (#6B7280), opacity 0.3
 *   - pushed    → yellow (#FACC15), opacity 0.8
 *   - routing   → cyan (#00F0FF), opacity 0.9
 *   - arrow     → orange (#F97316), opacity 0.7
 *
 * All coordinates are in millimeters, matching push-shove-engine.ts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  start: Point;
  end: Point;
}

/** A trace that was displaced by the push-shove engine. */
export interface PushedTrace {
  traceId: string;
  netId: string;
  originalSegments: Segment[];
  newSegments: Segment[];
  /** Total displacement distance in mm. */
  displacement: number;
}

/** Input to the preview manager — the result of a push-shove computation. */
export interface PushShovePreviewResult {
  /** Traces that were pushed aside. */
  pushedTraces: PushedTrace[];
  /** The new routing trace being drawn by the user. */
  routingTrace: Point[];
}

/** Segment type determines rendering style. */
export type PreviewSegmentType = 'original' | 'pushed' | 'routing' | 'displacement_arrow';

/** A renderable segment for the SVG overlay. */
export interface PreviewSegment {
  id: string;
  type: PreviewSegmentType;
  points: Point[];
  color: string;
  opacity: number;
  dashArray?: string;
}

/** Immutable snapshot for useSyncExternalStore. */
export interface PushShovePreviewState {
  active: boolean;
  segments: readonly PreviewSegment[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLORS = {
  original: '#6B7280',
  pushed: '#FACC15',
  routing: '#00F0FF',
  arrow: '#F97316',
} as const;

const OPACITIES = {
  original: 0.3,
  pushed: 0.8,
  routing: 0.9,
  arrow: 0.7,
} as const;

const DASH_ORIGINAL = '4 3';

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Segment builders
// ---------------------------------------------------------------------------

function buildOriginalSegments(trace: PushedTrace): PreviewSegment[] {
  return trace.originalSegments.map((seg, i) => ({
    id: `orig-${trace.traceId}-${String(i)}`,
    type: 'original' as const,
    points: [{ x: seg.start.x, y: seg.start.y }, { x: seg.end.x, y: seg.end.y }],
    color: COLORS.original,
    opacity: OPACITIES.original,
    dashArray: DASH_ORIGINAL,
  }));
}

function buildPushedSegments(trace: PushedTrace): PreviewSegment[] {
  return trace.newSegments.map((seg, i) => ({
    id: `pushed-${trace.traceId}-${String(i)}`,
    type: 'pushed' as const,
    points: [{ x: seg.start.x, y: seg.start.y }, { x: seg.end.x, y: seg.end.y }],
    color: COLORS.pushed,
    opacity: OPACITIES.pushed,
  }));
}

/**
 * Build displacement arrows from original segment midpoints to pushed segment midpoints.
 * Only generates arrows for traces with non-zero displacement.
 */
function buildDisplacementArrows(trace: PushedTrace): PreviewSegment[] {
  if (trace.displacement <= 0) {
    return [];
  }

  const count = Math.min(trace.originalSegments.length, trace.newSegments.length);
  const arrows: PreviewSegment[] = [];

  for (let i = 0; i < count; i++) {
    const orig = trace.originalSegments[i];
    const pushed = trace.newSegments[i];

    const origMid: Point = {
      x: (orig.start.x + orig.end.x) / 2,
      y: (orig.start.y + orig.end.y) / 2,
    };
    const pushedMid: Point = {
      x: (pushed.start.x + pushed.end.x) / 2,
      y: (pushed.start.y + pushed.end.y) / 2,
    };

    // Skip arrows with negligible displacement
    const dx = pushedMid.x - origMid.x;
    const dy = pushedMid.y - origMid.y;
    if (Math.sqrt(dx * dx + dy * dy) < 0.01) {
      continue;
    }

    arrows.push({
      id: `arrow-${trace.traceId}-${String(i)}`,
      type: 'displacement_arrow',
      points: [origMid, pushedMid],
      color: COLORS.arrow,
      opacity: OPACITIES.arrow,
    });
  }

  return arrows;
}

function buildRoutingSegments(routingTrace: Point[]): PreviewSegment[] {
  if (routingTrace.length < 2) {
    return [];
  }

  const segments: PreviewSegment[] = [];
  for (let i = 0; i < routingTrace.length - 1; i++) {
    segments.push({
      id: `routing-${String(i)}`,
      type: 'routing',
      points: [
        { x: routingTrace[i].x, y: routingTrace[i].y },
        { x: routingTrace[i + 1].x, y: routingTrace[i + 1].y },
      ],
      color: COLORS.routing,
      opacity: OPACITIES.routing,
    });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// PushShovePreviewManager
// ---------------------------------------------------------------------------

/**
 * Manages push-shove preview overlay state. Follows singleton + subscribe
 * pattern for useSyncExternalStore integration.
 *
 * Use `PushShovePreviewManager.create()` for testing or
 * `getPushShovePreviewManager()` for the app-wide singleton.
 */
export class PushShovePreviewManager {
  private active = false;
  private cachedSegments: readonly PreviewSegment[] = [];
  private currentResult: PushShovePreviewResult | null = null;
  private listeners = new Set<Listener>();

  private constructor() {}

  /** Factory — creates a fresh instance (test-friendly, no global singleton). */
  static create(): PushShovePreviewManager {
    return new PushShovePreviewManager();
  }

  // -----------------------------------------------------------------------
  // Subscription (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Get the current immutable state snapshot. */
  getSnapshot(): PushShovePreviewState {
    return {
      active: this.active,
      segments: this.cachedSegments,
    };
  }

  // -----------------------------------------------------------------------
  // State mutation
  // -----------------------------------------------------------------------

  /** Enable or disable preview mode. */
  setActive(active: boolean): void {
    if (this.active === active) {
      return;
    }
    this.active = active;
    this.rebuildSegments();
    this.notify();
  }

  /** Toggle preview on/off. Returns the new active state. */
  toggle(): boolean {
    this.setActive(!this.active);
    return this.active;
  }

  /** Update the preview with the latest push-shove computation result. */
  updatePreview(result: PushShovePreviewResult): void {
    this.currentResult = result;
    this.rebuildSegments();
    this.notify();
  }

  /** Clear all preview data. */
  clearPreview(): void {
    this.currentResult = null;
    this.rebuildSegments();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Whether preview mode is currently active. */
  isActive(): boolean {
    return this.active;
  }

  /** Get all renderable preview segments. Returns empty array when inactive. */
  getPreviewSegments(): readonly PreviewSegment[] {
    return this.cachedSegments;
  }

  /** Get segments filtered by type. */
  getSegmentsByType(type: PreviewSegmentType): readonly PreviewSegment[] {
    return this.cachedSegments.filter((s) => s.type === type);
  }

  /** Get the count of pushed traces in the current result. */
  getPushedTraceCount(): number {
    return this.currentResult?.pushedTraces.length ?? 0;
  }

  /** Get total displacement across all pushed traces. */
  getTotalDisplacement(): number {
    if (!this.currentResult) {
      return 0;
    }
    let total = 0;
    for (const trace of this.currentResult.pushedTraces) {
      total += trace.displacement;
    }
    return total;
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private rebuildSegments(): void {
    if (!this.active || !this.currentResult) {
      this.cachedSegments = [];
      return;
    }

    const segments: PreviewSegment[] = [];

    // Build segments for each pushed trace
    for (const trace of this.currentResult.pushedTraces) {
      segments.push(...buildOriginalSegments(trace));
      segments.push(...buildPushedSegments(trace));
      segments.push(...buildDisplacementArrows(trace));
    }

    // Build routing trace segments
    segments.push(...buildRoutingSegments(this.currentResult.routingTrace));

    this.cachedSegments = Object.freeze(segments);
  }

  private notify(): void {
    Array.from(this.listeners).forEach((l) => {
      l();
    });
  }
}

// ---------------------------------------------------------------------------
// App-wide singleton
// ---------------------------------------------------------------------------

let singleton: PushShovePreviewManager | null = null;

/** Get (or create) the app-wide PushShovePreviewManager singleton. */
export function getPushShovePreviewManager(): PushShovePreviewManager {
  if (!singleton) {
    singleton = PushShovePreviewManager.create();
  }
  return singleton;
}

/** Reset the singleton (for testing only). */
export function resetPushShovePreviewManager(): void {
  singleton = null;
}
