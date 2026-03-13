/**
 * CurrentDensityOverlayManager — Manages current density visualization data
 * for PCB traces and copper pours.
 *
 * Color-codes traces by current density (A/mm²) using IPC-2152 reference
 * thresholds. Highlights traces at risk of overheating or fusing.
 *
 * Severity thresholds (A/mm²):
 *   - safe:     < 15  → green
 *   - caution:  15–30 → yellow
 *   - danger:   30–50 → orange
 *   - critical: > 50  → red
 *
 * Singleton + subscribe pattern for useSyncExternalStore integration.
 * Pure module — no React/DOM dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

export interface TraceSegment {
  start: Point;
  end: Point;
}

export interface TraceCurrentData {
  traceId: string;
  netName: string;
  /** Current flowing through the trace in amps. */
  current: number;
  /** Segments of this trace. */
  segments: TraceSegment[];
  /** Trace width in mm. */
  width: number;
  /** Copper thickness in mm (default 0.035 = 1oz copper). */
  copperThickness: number;
}

export type DensitySeverity = 'safe' | 'caution' | 'danger' | 'critical';

export interface DensityLimits {
  /** Maximum safe density (A/mm²). */
  safe: number;
  /** Maximum caution density (A/mm²). */
  caution: number;
  /** Maximum danger density (A/mm²). Anything above is critical. */
  danger: number;
}

export interface DensitySegment {
  id: string;
  start: Point;
  end: Point;
  /** Trace width in mm. */
  width: number;
  /** Current density in A/mm². */
  density: number;
  /** CSS color string for this segment. */
  color: string;
  /** Severity category. */
  severity: DensitySeverity;
}

export interface HotTrace {
  traceId: string;
  netName: string;
  /** Maximum current density across all segments in A/mm². */
  maxDensity: number;
  /** Severity based on maximum density. */
  severity: DensitySeverity;
  /** Human-readable recommendation. */
  recommendation: string;
}

export interface LegendStop {
  /** Normalized position 0–1. */
  position: number;
  /** Density at this stop in A/mm². */
  density: number;
  /** CSS color at this stop. */
  color: string;
  /** Severity label. */
  label: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** IPC-2152 reference thresholds in A/mm². */
export const DEFAULT_DENSITY_LIMITS: DensityLimits = {
  safe: 15,
  caution: 30,
  danger: 50,
};

/** Default copper thickness for 1oz copper in mm. */
export const DEFAULT_COPPER_THICKNESS_MM = 0.035;

/** Legend stop count. */
const LEGEND_STOP_COUNT = 5;

/** Severity colors. */
const SEVERITY_COLORS: Record<DensitySeverity, string> = {
  safe: '#22C55E',     // green-500
  caution: '#EAB308',  // yellow-500
  danger: '#F97316',   // orange-500
  critical: '#EF4444', // red-500
};

/** Gradient stops for continuous color mapping: fraction → RGB. */
const GRADIENT_STOPS: Array<{ frac: number; r: number; g: number; b: number }> = [
  { frac: 0.0, r: 0x22, g: 0xC5, b: 0x5E }, // green (safe low)
  { frac: 0.3, r: 0x86, g: 0xEF, b: 0xAC }, // light green (safe high)
  { frac: 0.5, r: 0xEA, g: 0xB3, b: 0x08 }, // yellow (caution)
  { frac: 0.7, r: 0xF9, g: 0x73, b: 0x16 }, // orange (danger)
  { frac: 1.0, r: 0xEF, g: 0x44, b: 0x44 }, // red (critical)
];

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Color interpolation
// ---------------------------------------------------------------------------

function interpolateGradient(frac: number): { r: number; g: number; b: number } {
  const t = Math.max(0, Math.min(1, frac));

  for (let i = 0; i < GRADIENT_STOPS.length - 1; i++) {
    const a = GRADIENT_STOPS[i];
    const b = GRADIENT_STOPS[i + 1];
    if (t >= a.frac && t <= b.frac) {
      const span = b.frac - a.frac;
      const local = span === 0 ? 0 : (t - a.frac) / span;
      return {
        r: Math.round(a.r + (b.r - a.r) * local),
        g: Math.round(a.g + (b.g - a.g) * local),
        b: Math.round(a.b + (b.b - a.b) * local),
      };
    }
  }

  const last = GRADIENT_STOPS[GRADIENT_STOPS.length - 1];
  return { r: last.r, g: last.g, b: last.b };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const hex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

function densityToSeverity(density: number, limits: DensityLimits): DensitySeverity {
  if (density < limits.safe) {
    return 'safe';
  }
  if (density < limits.caution) {
    return 'caution';
  }
  if (density < limits.danger) {
    return 'danger';
  }
  return 'critical';
}

function severityToRecommendation(severity: DensitySeverity, density: number, traceWidth: number): string {
  switch (severity) {
    case 'safe':
      return `Current density ${density.toFixed(1)} A/mm² is within safe limits.`;
    case 'caution':
      return `Current density ${density.toFixed(1)} A/mm² is elevated. Consider widening trace from ${traceWidth.toFixed(2)}mm or using heavier copper.`;
    case 'danger':
      return `Current density ${density.toFixed(1)} A/mm² is dangerously high. Widen trace from ${traceWidth.toFixed(2)}mm or add parallel traces.`;
    case 'critical':
      return `Current density ${density.toFixed(1)} A/mm² exceeds safe limits — trace may fuse. Immediate redesign required: widen trace from ${traceWidth.toFixed(2)}mm, use heavier copper, or add copper pours.`;
  }
}

// ---------------------------------------------------------------------------
// CurrentDensityOverlayManager
// ---------------------------------------------------------------------------

export class CurrentDensityOverlayManager {
  private enabled = false;
  private traceData: TraceCurrentData[] = [];
  private limits: DensityLimits = { ...DEFAULT_DENSITY_LIMITS };
  private cachedSegments: DensitySegment[] | null = null;
  private cachedHotTraces: HotTrace[] | null = null;
  private listeners = new Set<Listener>();

  private constructor() {}

  /** Factory — creates a fresh instance (testing-friendly, no global singleton). */
  static create(): CurrentDensityOverlayManager {
    return new CurrentDensityOverlayManager();
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
    Array.from(this.listeners).forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Enable / Disable
  // -----------------------------------------------------------------------

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) {
      return;
    }
    this.enabled = enabled;
    this.notify();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // -----------------------------------------------------------------------
  // Data management
  // -----------------------------------------------------------------------

  updateCurrentData(data: TraceCurrentData[]): void {
    this.traceData = [...data];
    this.invalidateCache();
    this.notify();
  }

  getCurrentData(): TraceCurrentData[] {
    return this.traceData;
  }

  clearCurrentData(): void {
    this.traceData = [];
    this.invalidateCache();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Limits
  // -----------------------------------------------------------------------

  setLimits(limits: DensityLimits): void {
    this.limits = { ...limits };
    this.invalidateCache();
    this.notify();
  }

  getLimits(): DensityLimits {
    return { ...this.limits };
  }

  // -----------------------------------------------------------------------
  // Density calculation
  // -----------------------------------------------------------------------

  /**
   * Calculate current density in A/mm².
   *
   * @param current     - Current in amps
   * @param traceWidth  - Trace width in mm
   * @param copperThickness - Copper thickness in mm (default 0.035 = 1oz)
   * @returns Current density in A/mm²
   */
  calculateDensity(current: number, traceWidth: number, copperThickness: number): number {
    if (traceWidth <= 0 || copperThickness <= 0) {
      return Infinity;
    }
    const crossSectionArea = traceWidth * copperThickness; // mm²
    return Math.abs(current) / crossSectionArea;
  }

  // -----------------------------------------------------------------------
  // Color mapping
  // -----------------------------------------------------------------------

  /**
   * Map a density value to a CSS color string.
   * Uses a continuous gradient from green (safe) through yellow/orange to red (critical).
   * Normalizes density against the danger threshold: 0 → safe, 1 → critical.
   */
  densityToColor(density: number, limits: DensityLimits): string {
    // Normalize: 0 at 0 A/mm², 1 at danger threshold, clamped at [0, 1]
    const maxRef = limits.danger;
    const frac = maxRef <= 0 ? 1 : Math.min(density / maxRef, 1);
    const { r, g, b } = interpolateGradient(frac);
    return rgbToHex(r, g, b);
  }

  // -----------------------------------------------------------------------
  // Segment generation
  // -----------------------------------------------------------------------

  getDensitySegments(): DensitySegment[] {
    if (this.cachedSegments) {
      return this.cachedSegments;
    }

    if (this.traceData.length === 0) {
      this.cachedSegments = [];
      return this.cachedSegments;
    }

    const segments: DensitySegment[] = [];

    for (const trace of this.traceData) {
      const thickness = trace.copperThickness > 0 ? trace.copperThickness : DEFAULT_COPPER_THICKNESS_MM;
      const density = this.calculateDensity(trace.current, trace.width, thickness);
      const color = this.densityToColor(density, this.limits);
      const severity = densityToSeverity(density, this.limits);

      for (let i = 0; i < trace.segments.length; i++) {
        const seg = trace.segments[i];
        segments.push({
          id: `${trace.traceId}-seg-${String(i)}`,
          start: { ...seg.start },
          end: { ...seg.end },
          width: trace.width,
          density,
          color,
          severity,
        });
      }
    }

    this.cachedSegments = segments;
    return this.cachedSegments;
  }

  // -----------------------------------------------------------------------
  // Hot trace detection
  // -----------------------------------------------------------------------

  getHotTraces(): HotTrace[] {
    if (this.cachedHotTraces) {
      return this.cachedHotTraces;
    }

    const hotTraces: HotTrace[] = [];

    for (const trace of this.traceData) {
      const thickness = trace.copperThickness > 0 ? trace.copperThickness : DEFAULT_COPPER_THICKNESS_MM;
      const density = this.calculateDensity(trace.current, trace.width, thickness);
      const severity = densityToSeverity(density, this.limits);

      if (severity !== 'safe') {
        hotTraces.push({
          traceId: trace.traceId,
          netName: trace.netName,
          maxDensity: density,
          severity,
          recommendation: severityToRecommendation(severity, density, trace.width),
        });
      }
    }

    this.cachedHotTraces = hotTraces;
    return this.cachedHotTraces;
  }

  // -----------------------------------------------------------------------
  // Legend
  // -----------------------------------------------------------------------

  getLegendStops(): LegendStop[] {
    const stops: LegendStop[] = [];
    const maxDensity = this.limits.danger;

    const severityLabels: Array<{ pos: number; label: string }> = [
      { pos: 0, label: '0' },
      { pos: this.limits.safe / maxDensity, label: `${String(this.limits.safe)} (safe)` },
      { pos: this.limits.caution / maxDensity, label: `${String(this.limits.caution)} (caution)` },
      { pos: this.limits.danger / maxDensity, label: `${String(this.limits.danger)}+ (danger)` },
    ];

    // Evenly spaced stops + threshold stops
    for (let i = 0; i < LEGEND_STOP_COUNT; i++) {
      const position = i / (LEGEND_STOP_COUNT - 1);
      const density = position * maxDensity;
      const color = this.densityToColor(density, this.limits);

      // Find closest severity label
      let closestLabel = `${density.toFixed(0)} A/mm²`;
      let closestDist = Infinity;
      for (const sl of severityLabels) {
        const dist = Math.abs(sl.pos - position);
        if (dist < closestDist) {
          closestDist = dist;
          closestLabel = sl.label;
        }
      }

      stops.push({
        position,
        density: Math.round(density * 10) / 10,
        color,
        label: closestLabel,
      });
    }

    return stops;
  }

  // -----------------------------------------------------------------------
  // Cache invalidation
  // -----------------------------------------------------------------------

  private invalidateCache(): void {
    this.cachedSegments = null;
    this.cachedHotTraces = null;
  }
}

// ---------------------------------------------------------------------------
// App-wide singleton
// ---------------------------------------------------------------------------

let singleton: CurrentDensityOverlayManager | null = null;

/** Get (or create) the app-wide CurrentDensityOverlayManager singleton. */
export function getCurrentDensityOverlayManager(): CurrentDensityOverlayManager {
  if (!singleton) {
    singleton = CurrentDensityOverlayManager.create();
  }
  return singleton;
}

/** Reset the singleton (for testing only). */
export function resetCurrentDensityOverlayManager(): void {
  singleton = null;
}
