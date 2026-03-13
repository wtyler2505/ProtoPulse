/**
 * CurrentAnimationManager — EveryCircuit-style live current/voltage animation.
 *
 * Animated dots flow along wire paths proportional to current magnitude,
 * with direction following current sign. Wire color intensity maps to
 * voltage (blue=low -> cyan -> yellow -> red=high).
 *
 * Singleton + subscribe pattern for useSyncExternalStore integration.
 * Pure module — no React/DOM dependencies.
 *
 * BL-0128
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WireSimData {
  wireId: string;
  current: number;
  voltage: number;
}

export interface WireSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type AnimationState = 'idle' | 'playing' | 'paused';

export interface AnimatedDot {
  /** Unique identifier for React keys. */
  id: string;
  /** X position in canvas coordinates. */
  x: number;
  /** Y position in canvas coordinates. */
  y: number;
  /** Dot radius in px. */
  radius: number;
  /** CSS color string (HSL). */
  color: string;
  /** Wire this dot belongs to. */
  wireId: string;
  /** Whether this dot should render a direction arrow. */
  showArrow: boolean;
  /** Angle in radians for direction arrow. */
  angle: number;
}

export interface VoltageColoredWire {
  wireId: string;
  segments: WireSegment[];
  color: string;
  opacity: number;
}

export interface AnimationFrame {
  dots: AnimatedDot[];
  wires: VoltageColoredWire[];
  state: AnimationState;
  speed: number;
}

export interface VoltageRange {
  min: number;
  max: number;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface WireAnimState {
  wireId: string;
  current: number;
  voltage: number;
  segments: WireSegment[];
  /** Cumulative segment lengths for position interpolation. */
  cumulativeLengths: number[];
  /** Total path length. */
  totalLength: number;
  /** Current animation offset along the path (0 to totalLength). */
  offset: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum dot spacing in px (at max current). */
const MIN_DOT_SPACING = 10;

/** Maximum dot spacing in px (at near-zero current). */
const MAX_DOT_SPACING = 60;

/** Reference current for spacing calculation — currents above this get MIN_DOT_SPACING. */
const REFERENCE_CURRENT = 1.0;

/** Base animation speed in px/s at 1x multiplier for 1A current. */
const BASE_SPEED = 60;

/** Every Nth dot gets a direction arrow. */
const ARROW_INTERVAL = 3;

/** Default dot radius. */
const DOT_RADIUS = 3.5;

/** Minimum segment length to consider (skip degenerate segments). */
const MIN_SEGMENT_LENGTH = 0.1;

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/**
 * Map a voltage to an HSL color string.
 *
 * Range mapping:
 *   min voltage -> hue 240 (blue)
 *   25%         -> hue 190 (cyan)
 *   50%         -> hue 60  (yellow)
 *   max voltage -> hue 0   (red)
 *
 * Returns HSL with 100% saturation and 60% lightness.
 */
export function getVoltageColor(voltage: number, range: VoltageRange): string {
  const span = range.max - range.min;
  if (span <= 0) {
    return 'hsl(190, 100%, 60%)'; // cyan default
  }

  const normalized = Math.max(0, Math.min(1, (voltage - range.min) / span));

  // Piecewise linear hue mapping: 0->240, 0.25->190, 0.5->60, 1.0->0
  let hue: number;
  if (normalized <= 0.25) {
    // blue (240) to cyan (190)
    hue = 240 - (normalized / 0.25) * 50;
  } else if (normalized <= 0.5) {
    // cyan (190) to yellow (60)
    hue = 190 - ((normalized - 0.25) / 0.25) * 130;
  } else {
    // yellow (60) to red (0)
    hue = 60 - ((normalized - 0.5) / 0.5) * 60;
  }

  return `hsl(${Math.round(hue)}, 100%, 60%)`;
}

/**
 * Compute dot spacing inversely proportional to current magnitude.
 *
 * Returns spacing in px:
 *   |current| >= REFERENCE_CURRENT -> MIN_DOT_SPACING (10px)
 *   |current| near 0              -> MAX_DOT_SPACING (60px)
 *
 * Uses exponential decay for smooth transitions.
 */
export function getCurrentDotSpacing(current: number): number {
  const absCurrent = Math.abs(current);
  if (absCurrent <= 0) {
    return MAX_DOT_SPACING;
  }
  if (absCurrent >= REFERENCE_CURRENT) {
    return MIN_DOT_SPACING;
  }

  // Exponential interpolation: spacing = MIN + (MAX - MIN) * e^(-k * current)
  // where k is chosen so that at REFERENCE_CURRENT we're at ~MIN
  const ratio = absCurrent / REFERENCE_CURRENT;
  const spacing = MIN_DOT_SPACING + (MAX_DOT_SPACING - MIN_DOT_SPACING) * (1 - ratio);
  return Math.round(spacing * 10) / 10;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function segmentLength(seg: WireSegment): number {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function computeCumulativeLengths(segments: WireSegment[]): { cumulative: number[]; total: number } {
  const cumulative: number[] = [];
  let total = 0;
  for (const seg of segments) {
    total += segmentLength(seg);
    cumulative.push(total);
  }
  return { cumulative, total };
}

/**
 * Given a distance along the wire path, returns the (x, y) position and angle.
 */
function positionOnPath(
  distance: number,
  segments: WireSegment[],
  cumulativeLengths: number[],
): { x: number; y: number; angle: number } | null {
  if (segments.length === 0) {
    return null;
  }

  let prevCumulative = 0;
  for (let i = 0; i < segments.length; i++) {
    const segLen = cumulativeLengths[i] - prevCumulative;
    if (distance <= cumulativeLengths[i] || i === segments.length - 1) {
      const segDist = distance - prevCumulative;
      const t = segLen > 0 ? Math.max(0, Math.min(1, segDist / segLen)) : 0;
      const seg = segments[i];
      const dx = seg.x2 - seg.x1;
      const dy = seg.y2 - seg.y1;
      return {
        x: seg.x1 + dx * t,
        y: seg.y1 + dy * t,
        angle: Math.atan2(dy, dx),
      };
    }
    prevCumulative = cumulativeLengths[i];
  }

  return null;
}

// ---------------------------------------------------------------------------
// CurrentAnimationManager
// ---------------------------------------------------------------------------

export class CurrentAnimationManager {
  private animState: AnimationState = 'idle';
  private speed = 1.0;
  private showVoltageHeatmap = true;
  private wireStates: Map<string, WireAnimState> = new Map();
  private simData: WireSimData[] = [];
  private wirePaths: Map<string, WireSegment[]> = new Map();
  private voltageRange: VoltageRange = { min: 0, max: 5 };
  private listeners = new Set<Listener>();
  private cachedFrame: AnimationFrame | null = null;

  private constructor() {}

  /** Factory — creates a fresh instance (testing-friendly). */
  static create(): CurrentAnimationManager {
    return new CurrentAnimationManager();
  }

  // -----------------------------------------------------------------------
  // Subscription (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.cachedFrame = null;
    Array.from(this.listeners).forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Data management
  // -----------------------------------------------------------------------

  /**
   * Load simulation results. Recalculates voltage range and rebuilds
   * internal wire animation states.
   */
  setSimulationData(results: WireSimData[]): void {
    this.simData = [...results];
    this.recalculateVoltageRange();
    this.rebuildWireStates();
    this.notify();
  }

  getSimulationData(): WireSimData[] {
    return this.simData;
  }

  /**
   * Set wire segment geometry. Each wire has an ordered list of segments
   * forming a path.
   */
  setWirePaths(paths: Map<string, WireSegment[]>): void {
    this.wirePaths = new Map(paths);
    this.rebuildWireStates();
    this.notify();
  }

  getWirePaths(): Map<string, WireSegment[]> {
    return this.wirePaths;
  }

  // -----------------------------------------------------------------------
  // Playback control
  // -----------------------------------------------------------------------

  play(): void {
    if (this.animState === 'playing') {
      return;
    }
    this.animState = 'playing';
    this.notify();
  }

  pause(): void {
    if (this.animState !== 'playing') {
      return;
    }
    this.animState = 'paused';
    this.notify();
  }

  stop(): void {
    this.animState = 'idle';
    // Reset all offsets
    for (const ws of Array.from(this.wireStates.values())) {
      ws.offset = 0;
    }
    this.notify();
  }

  getState(): AnimationState {
    return this.animState;
  }

  // -----------------------------------------------------------------------
  // Speed control
  // -----------------------------------------------------------------------

  setSpeed(multiplier: number): void {
    this.speed = Math.max(0.25, Math.min(4, multiplier));
    this.notify();
  }

  getSpeed(): number {
    return this.speed;
  }

  // -----------------------------------------------------------------------
  // Voltage heatmap toggle
  // -----------------------------------------------------------------------

  setShowVoltageHeatmap(show: boolean): void {
    if (this.showVoltageHeatmap === show) {
      return;
    }
    this.showVoltageHeatmap = show;
    this.notify();
  }

  getShowVoltageHeatmap(): boolean {
    return this.showVoltageHeatmap;
  }

  // -----------------------------------------------------------------------
  // Voltage range
  // -----------------------------------------------------------------------

  getVoltageRange(): VoltageRange {
    return { ...this.voltageRange };
  }

  // -----------------------------------------------------------------------
  // Animation tick
  // -----------------------------------------------------------------------

  /**
   * Advance animation by deltaMs milliseconds.
   * Only advances when state is 'playing'.
   */
  tick(deltaMs: number): void {
    if (this.animState !== 'playing' || deltaMs <= 0) {
      return;
    }

    const deltaSec = deltaMs / 1000;

    for (const ws of Array.from(this.wireStates.values())) {
      if (ws.totalLength < MIN_SEGMENT_LENGTH || ws.current === 0) {
        continue;
      }

      // Speed proportional to |current| * base speed * multiplier
      const pixelsPerSec = Math.abs(ws.current) * BASE_SPEED * this.speed;
      const advance = pixelsPerSec * deltaSec;

      // Direction: positive current -> forward, negative -> backward
      const direction = ws.current >= 0 ? 1 : -1;
      ws.offset += advance * direction;

      // Wrap offset to [0, totalLength)
      if (ws.totalLength > 0) {
        ws.offset = ((ws.offset % ws.totalLength) + ws.totalLength) % ws.totalLength;
      }
    }

    this.notify();
  }

  // -----------------------------------------------------------------------
  // Frame generation
  // -----------------------------------------------------------------------

  /**
   * Get the current animation frame for rendering.
   * Returns dot positions, colors, sizes, and voltage-colored wires.
   */
  getAnimationFrame(): AnimationFrame {
    if (this.cachedFrame) {
      return this.cachedFrame;
    }

    const dots: AnimatedDot[] = [];
    const wires: VoltageColoredWire[] = [];

    if (this.animState === 'idle') {
      this.cachedFrame = { dots, wires, state: this.animState, speed: this.speed };
      return this.cachedFrame;
    }

    for (const ws of Array.from(this.wireStates.values())) {
      // Voltage heatmap wires
      if (this.showVoltageHeatmap && ws.segments.length > 0) {
        const color = getVoltageColor(ws.voltage, this.voltageRange);
        wires.push({
          wireId: ws.wireId,
          segments: ws.segments,
          color,
          opacity: 0.4,
        });
      }

      // Skip dots for zero current or degenerate paths
      if (ws.current === 0 || ws.totalLength < MIN_SEGMENT_LENGTH) {
        continue;
      }

      const spacing = getCurrentDotSpacing(ws.current);
      const dotColor = getVoltageColor(ws.voltage, this.voltageRange);
      let dotIndex = 0;

      // Place dots along the path at regular intervals, starting from offset
      let pos = ws.offset % spacing;
      while (pos < ws.totalLength) {
        const point = positionOnPath(pos, ws.segments, ws.cumulativeLengths);
        if (point) {
          const isArrow = dotIndex % ARROW_INTERVAL === 0;
          const arrowAngle = ws.current < 0 ? point.angle + Math.PI : point.angle;

          dots.push({
            id: `${ws.wireId}-dot-${String(dotIndex)}`,
            x: point.x,
            y: point.y,
            radius: DOT_RADIUS,
            color: dotColor,
            wireId: ws.wireId,
            showArrow: isArrow,
            angle: arrowAngle,
          });

          dotIndex++;
        }
        pos += spacing;
      }
    }

    this.cachedFrame = { dots, wires, state: this.animState, speed: this.speed };
    return this.cachedFrame;
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private recalculateVoltageRange(): void {
    if (this.simData.length === 0) {
      this.voltageRange = { min: 0, max: 5 };
      return;
    }

    let min = Infinity;
    let max = -Infinity;
    for (const d of this.simData) {
      if (d.voltage < min) {
        min = d.voltage;
      }
      if (d.voltage > max) {
        max = d.voltage;
      }
    }

    // Ensure non-zero range
    if (min === max) {
      min = min - 1;
      max = max + 1;
    }

    this.voltageRange = { min, max };
  }

  private rebuildWireStates(): void {
    const newStates = new Map<string, WireAnimState>();

    for (const data of this.simData) {
      const segments = this.wirePaths.get(data.wireId);
      if (!segments || segments.length === 0) {
        continue;
      }

      // Filter out degenerate segments
      const validSegments = segments.filter((s) => segmentLength(s) >= MIN_SEGMENT_LENGTH);
      if (validSegments.length === 0) {
        continue;
      }

      const { cumulative, total } = computeCumulativeLengths(validSegments);

      // Preserve existing offset if wire was already animated
      const existing = this.wireStates.get(data.wireId);

      newStates.set(data.wireId, {
        wireId: data.wireId,
        current: data.current,
        voltage: data.voltage,
        segments: validSegments,
        cumulativeLengths: cumulative,
        totalLength: total,
        offset: existing ? existing.offset % total : 0,
      });
    }

    this.wireStates = newStates;
  }
}

// ---------------------------------------------------------------------------
// App-wide singleton
// ---------------------------------------------------------------------------

let singleton: CurrentAnimationManager | null = null;

/** Get (or create) the app-wide CurrentAnimationManager singleton. */
export function getCurrentAnimationManager(): CurrentAnimationManager {
  if (!singleton) {
    singleton = CurrentAnimationManager.create();
  }
  return singleton;
}

/** Reset the singleton (for testing only). */
export function resetCurrentAnimationManager(): void {
  singleton = null;
}
