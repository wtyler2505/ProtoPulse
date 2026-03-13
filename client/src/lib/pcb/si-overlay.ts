/**
 * SIOverlayManager — Signal Integrity overlay state management.
 *
 * Singleton + subscribe pattern (compatible with useSyncExternalStore).
 * Converts SI advisory data (from si-advisor / crosstalk-solver / transmission-line)
 * into renderable annotations for the PCB canvas overlay.
 *
 * Annotation types:
 *   - StubLengthMarker: highlights trace stubs that exceed maximum stub length
 *   - ImpedanceWarning: marks traces with impedance deviating from target
 *   - CrosstalkIndicator: shows coupling between adjacent traces
 *
 * Severity colour coding:
 *   - info  → cyan (#00F0FF)
 *   - warning → yellow (#FACC15)
 *   - error → red (#EF4444)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SIAdvisoryType = 'stub-length' | 'impedance-mismatch' | 'crosstalk';

export type SISeverity = 'info' | 'warning' | 'error';

/**
 * Input advisory produced by the SI analysis engines.
 * Consumers pass these into the manager; the manager converts them to
 * renderable annotations.
 */
export interface SIAdvisory {
  /** Unique identifier for this advisory. */
  id: string;
  /** Which kind of SI concern. */
  type: SIAdvisoryType;
  /** Human-readable description. */
  message: string;
  /** Severity determines visual styling. */
  severity: SISeverity;
  /** X coordinate on the PCB canvas. */
  x: number;
  /** Y coordinate on the PCB canvas. */
  y: number;

  // -- Type-specific optional fields --

  /** Stub length in mm (stub-length advisories). */
  stubLength?: number;
  /** Maximum allowed stub length in mm (stub-length advisories). */
  maxStubLength?: number;

  /** Actual impedance in ohms (impedance-mismatch advisories). */
  actualZ0?: number;
  /** Target impedance in ohms (impedance-mismatch advisories). */
  targetZ0?: number;
  /** Impedance deviation percentage (impedance-mismatch advisories). */
  deviationPct?: number;

  /** NEXT in dB (crosstalk advisories). */
  nextDb?: number;
  /** FEXT in dB (crosstalk advisories). */
  fextDb?: number;
  /** Second trace endpoint for crosstalk line rendering. */
  x2?: number;
  /** Second trace endpoint for crosstalk line rendering. */
  y2?: number;
}

/**
 * Renderable annotation placed on the PCB canvas overlay.
 * Each annotation maps to exactly one advisory.
 */
export interface SIAnnotation {
  /** Mirrors the advisory id. */
  id: string;
  /** Annotation category determines rendering shape. */
  type: SIAdvisoryType;
  /** Visual severity. */
  severity: SISeverity;
  /** Colour string for the annotation. */
  color: string;
  /** Centre X on canvas. */
  x: number;
  /** Centre Y on canvas. */
  y: number;
  /** Tooltip text. */
  tooltip: string;

  // -- Rendering hints per type --

  /** Stub marker radius (stub-length). */
  radius?: number;
  /** Second point X (crosstalk line). */
  x2?: number;
  /** Second point Y (crosstalk line). */
  y2?: number;
  /** Deviation percentage label (impedance). */
  label?: string;
}

/** Immutable snapshot of overlay state for useSyncExternalStore. */
export interface SIOverlayState {
  enabled: boolean;
  annotations: readonly SIAnnotation[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<SISeverity, string> = {
  info: '#00F0FF',
  warning: '#FACC15',
  error: '#EF4444',
};

/** Default stub marker radius in SVG units. */
const DEFAULT_STUB_RADIUS = 6;

/** Minimum stub marker radius. */
const MIN_STUB_RADIUS = 3;

/** Scale factor: stub-length mm → radius px. */
const STUB_RADIUS_SCALE = 1.5;

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Advisory → Annotation conversion
// ---------------------------------------------------------------------------

function advisoryToAnnotation(advisory: SIAdvisory): SIAnnotation {
  const color = SEVERITY_COLORS[advisory.severity];
  const base = {
    id: advisory.id,
    type: advisory.type,
    severity: advisory.severity,
    color,
    x: advisory.x,
    y: advisory.y,
  };

  switch (advisory.type) {
    case 'stub-length': {
      const stubLen = advisory.stubLength ?? 0;
      const radius = Math.max(MIN_STUB_RADIUS, Math.min(stubLen * STUB_RADIUS_SCALE, DEFAULT_STUB_RADIUS * 2));
      return {
        ...base,
        tooltip: advisory.message,
        radius,
      };
    }
    case 'impedance-mismatch': {
      const dev = advisory.deviationPct ?? 0;
      const label = `${dev >= 0 ? '+' : ''}${dev.toFixed(1)}%`;
      return {
        ...base,
        tooltip: advisory.message,
        label,
      };
    }
    case 'crosstalk': {
      return {
        ...base,
        tooltip: advisory.message,
        x2: advisory.x2,
        y2: advisory.y2,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// SIOverlayManager
// ---------------------------------------------------------------------------

/**
 * Manages the SI overlay state — enabled/disabled toggle and advisory→annotation
 * conversion. Follows singleton + subscribe pattern for integration with
 * `useSyncExternalStore`.
 *
 * Use `SIOverlayManager.create()` for testing or `getSIOverlayManager()` for
 * the app-wide singleton.
 */
export class SIOverlayManager {
  private enabled = false;
  private advisories: SIAdvisory[] = [];
  private cachedAnnotations: readonly SIAnnotation[] = [];
  private listeners = new Set<Listener>();

  private constructor() {}

  /** Factory — creates a fresh instance (test-friendly, no global singleton). */
  static create(): SIOverlayManager {
    return new SIOverlayManager();
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
  getSnapshot(): SIOverlayState {
    return {
      enabled: this.enabled,
      annotations: this.cachedAnnotations,
    };
  }

  // -----------------------------------------------------------------------
  // State mutation
  // -----------------------------------------------------------------------

  /** Enable or disable the SI overlay. */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) {
      return;
    }
    this.enabled = enabled;
    this.rebuildAnnotations();
    this.notify();
  }

  /** Toggle the overlay on/off. Returns the new enabled state. */
  toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  /** Replace all advisories. Triggers annotation rebuild if enabled. */
  updateAdvisories(advisories: SIAdvisory[]): void {
    this.advisories = [...advisories];
    this.rebuildAnnotations();
    this.notify();
  }

  /** Clear all advisories. */
  clearAdvisories(): void {
    this.advisories = [];
    this.rebuildAnnotations();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Whether the overlay is currently enabled. */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** Get renderable annotations. Returns empty array when disabled. */
  getAnnotations(): readonly SIAnnotation[] {
    return this.cachedAnnotations;
  }

  /** Get the raw advisory count (regardless of enabled state). */
  getAdvisoryCount(): number {
    return this.advisories.length;
  }

  /** Get annotations filtered by severity. */
  getAnnotationsBySeverity(severity: SISeverity): readonly SIAnnotation[] {
    return this.cachedAnnotations.filter((a) => a.severity === severity);
  }

  /** Get annotations filtered by type. */
  getAnnotationsByType(type: SIAdvisoryType): readonly SIAnnotation[] {
    return this.cachedAnnotations.filter((a) => a.type === type);
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private rebuildAnnotations(): void {
    if (!this.enabled || this.advisories.length === 0) {
      this.cachedAnnotations = [];
      return;
    }
    this.cachedAnnotations = Object.freeze(this.advisories.map(advisoryToAnnotation));
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

let singleton: SIOverlayManager | null = null;

/** Get (or create) the app-wide SIOverlayManager singleton. */
export function getSIOverlayManager(): SIOverlayManager {
  if (!singleton) {
    singleton = SIOverlayManager.create();
  }
  return singleton;
}

/** Reset the singleton (for testing only). */
export function resetSIOverlayManager(): void {
  singleton = null;
}

// ---------------------------------------------------------------------------
// Utility: severity color lookup (for external consumers)
// ---------------------------------------------------------------------------

/** Get the colour string for a given severity level. */
export function getSeverityColor(severity: SISeverity): string {
  return SEVERITY_COLORS[severity];
}
