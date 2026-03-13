/**
 * SimResultsOverlayManager — Renders DC operating point results (node voltages,
 * branch currents) as static labels/badges directly on the schematic canvas.
 *
 * Different from CurrentAnimationManager (BL-0128) which animates moving dots.
 * This overlay shows static value labels, probe indicators, and color-coded
 * badges at node positions.
 *
 * Singleton + subscribe pattern for useSyncExternalStore integration.
 * Pure module — no React/DOM dependencies.
 *
 * BL-0560
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProbeType = 'voltage' | 'current';

export interface ProbePoint {
  /** Unique identifier for this probe. */
  id: string;
  /** Whether this probe measures voltage or current. */
  type: ProbeType;
  /** The node or component ID this probe is attached to. */
  nodeId: string;
  /** Display label for the probe. */
  label: string;
  /** Canvas position of the probe indicator. */
  position: { x: number; y: number };
}

export type ColorMode = 'magnitude' | 'polarity';

export interface SimOverlayData {
  /** Map from node ID to voltage in volts. */
  nodeVoltages: Map<string, number>;
  /** Map from component/branch ID to current in amps. */
  branchCurrents: Map<string, number>;
  /** Active probe points on the canvas. */
  probes: ProbePoint[];
  /** Whether the overlay is currently visible. */
  visible: boolean;
  /** Color mode for voltage badges. */
  colorMode: ColorMode;
}

// ---------------------------------------------------------------------------
// SI prefix formatting
// ---------------------------------------------------------------------------

const SI_PREFIXES: ReadonlyArray<{ threshold: number; divisor: number; suffix: string }> = [
  { threshold: 1e12, divisor: 1e12, suffix: 'T' },
  { threshold: 1e9, divisor: 1e9, suffix: 'G' },
  { threshold: 1e6, divisor: 1e6, suffix: 'M' },
  { threshold: 1e3, divisor: 1e3, suffix: 'k' },
  { threshold: 1, divisor: 1, suffix: '' },
  { threshold: 1e-3, divisor: 1e-3, suffix: 'm' },
  { threshold: 1e-6, divisor: 1e-6, suffix: '\u00B5' },
  { threshold: 1e-9, divisor: 1e-9, suffix: 'n' },
  { threshold: 1e-12, divisor: 1e-12, suffix: 'p' },
  { threshold: 1e-15, divisor: 1e-15, suffix: 'f' },
];

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// SimResultsOverlayManager
// ---------------------------------------------------------------------------

export class SimResultsOverlayManager {
  private nodeVoltages: Map<string, number> = new Map();
  private branchCurrents: Map<string, number> = new Map();
  private probes: ProbePoint[] = [];
  private visible = false;
  private colorMode: ColorMode = 'magnitude';
  private listeners = new Set<Listener>();
  private nextProbeId = 1;
  private snapshotVersion = 0;

  private constructor() {}

  /** Factory — creates a fresh instance (testing-friendly). */
  static create(): SimResultsOverlayManager {
    return new SimResultsOverlayManager();
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

  /** Returns a version number that changes on every state mutation. */
  getSnapshot(): number {
    return this.snapshotVersion;
  }

  private notify(): void {
    this.snapshotVersion++;
    Array.from(this.listeners).forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Result loading
  // -----------------------------------------------------------------------

  /**
   * Load simulation results from a DC operating point solve.
   * Accepts plain Record objects (from circuit-solver.ts output) and converts
   * them to Maps internally.
   */
  setResults(
    voltages: Record<string, number>,
    currents: Record<string, number>,
  ): void {
    this.nodeVoltages = new Map(Object.entries(voltages));
    this.branchCurrents = new Map(Object.entries(currents));
    this.notify();
  }

  /** Clear all simulation results and probes. */
  clearResults(): void {
    this.nodeVoltages = new Map();
    this.branchCurrents = new Map();
    this.probes = [];
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Probe management
  // -----------------------------------------------------------------------

  /**
   * Add a probe point at the given position for the specified node/component.
   * Returns the probe ID.
   */
  addProbe(
    nodeId: string,
    type: ProbeType,
    position: { x: number; y: number },
  ): string {
    const id = `probe-${String(this.nextProbeId++)}`;
    const value = type === 'voltage'
      ? this.nodeVoltages.get(nodeId)
      : this.branchCurrents.get(nodeId);
    const unit = type === 'voltage' ? 'V' : 'A';
    const label = value !== undefined
      ? formatValue(value, unit)
      : `${nodeId} (no data)`;

    this.probes = [
      ...this.probes,
      { id, type, nodeId, label, position },
    ];
    this.notify();
    return id;
  }

  /** Remove a probe by its ID. */
  removeProbe(probeId: string): void {
    const prev = this.probes.length;
    this.probes = this.probes.filter((p) => p.id !== probeId);
    if (this.probes.length !== prev) {
      this.notify();
    }
  }

  /**
   * Toggle a probe: if a probe of the given type already exists at nodeId,
   * remove it; otherwise add a new one.
   */
  toggleProbe(
    nodeId: string,
    type: ProbeType,
    position: { x: number; y: number },
  ): void {
    const existing = this.probes.find(
      (p) => p.nodeId === nodeId && p.type === type,
    );
    if (existing) {
      this.removeProbe(existing.id);
    } else {
      this.addProbe(nodeId, type, position);
    }
  }

  /** Get all probes attached to a given node ID. */
  getProbesForNode(nodeId: string): ProbePoint[] {
    return this.probes.filter((p) => p.nodeId === nodeId);
  }

  // -----------------------------------------------------------------------
  // Visibility
  // -----------------------------------------------------------------------

  setVisible(visible: boolean): void {
    if (this.visible === visible) {
      return;
    }
    this.visible = visible;
    this.notify();
  }

  toggleVisible(): void {
    this.visible = !this.visible;
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Color mode
  // -----------------------------------------------------------------------

  setColorMode(mode: ColorMode): void {
    if (this.colorMode === mode) {
      return;
    }
    this.colorMode = mode;
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Color calculation
  // -----------------------------------------------------------------------

  /**
   * Map a voltage value to an HSL color string.
   *
   * Magnitude mode:
   *   0V         → hsl(0, 0%, 50%)   gray
   *   low pos    → hsl(180, 90%, 50%) cyan
   *   mid pos    → hsl(60, 90%, 50%)  yellow
   *   high pos   → hsl(0, 90%, 50%)   red
   *   negative   → hsl(240, 90%, 40%) deep blue ... hsl(210, 90%, 50%) blue
   *
   * Polarity mode:
   *   negative   → blue gradient
   *   zero       → gray
   *   positive   → cyan-yellow-red gradient
   *
   * Both modes use the same gradient; polarity is the default behavior.
   */
  getVoltageColor(voltage: number): string {
    if (voltage === 0) {
      return 'hsl(0, 0%, 50%)';
    }

    if (this.colorMode === 'magnitude') {
      // Magnitude mode: treat sign as irrelevant, map |V| to cyan→yellow→red
      const absV = Math.abs(voltage);
      return this.voltageToHsl(absV);
    }

    // Polarity mode
    if (voltage < 0) {
      // Negative voltages: deep blue (240) for large negative → lighter blue (210) for small negative
      const absV = Math.abs(voltage);
      // Clamp to a reasonable range for color mapping
      const t = Math.min(absV / 20, 1); // 20V as "max" reference
      const hue = 210 + (1 - t) * 30; // 210 (large neg) → 240 (small neg)
      const lightness = 40 + (1 - t) * 15; // 40% (large neg) → 55% (small neg)
      return `hsl(${Math.round(hue)}, 90%, ${Math.round(lightness)}%)`;
    }

    return this.voltageToHsl(voltage);
  }

  /**
   * Map a current value to an HSL color string.
   *
   * Gradient: green (low) → yellow (medium) → orange (high).
   * Uses absolute magnitude — sign determines arrow direction, not color.
   */
  getCurrentColor(current: number): string {
    const absI = Math.abs(current);

    if (absI === 0) {
      return 'hsl(0, 0%, 50%)'; // gray for zero current
    }

    // Reference: 1A is "high", scale logarithmically for wide range
    // log10(1e-6) = -6, log10(1) = 0 → normalize to 0..1
    const logI = Math.log10(Math.max(absI, 1e-12));
    // Map -12..0 → 0..1
    const t = Math.max(0, Math.min(1, (logI + 12) / 12));

    // Green (120) → Yellow (60) → Orange (30)
    let hue: number;
    if (t <= 0.5) {
      // green (120) → yellow (60)
      hue = 120 - (t / 0.5) * 60;
    } else {
      // yellow (60) → orange (30)
      hue = 60 - ((t - 0.5) / 0.5) * 30;
    }

    const saturation = 80 + t * 20; // 80% → 100%
    const lightness = 45 + (1 - t) * 10; // 45% → 55%

    return `hsl(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`;
  }

  /**
   * Determine arrow direction for a current value.
   * Positive current → forward, negative → reverse.
   */
  getCurrentArrowDirection(current: number): 'forward' | 'reverse' {
    return current >= 0 ? 'forward' : 'reverse';
  }

  // -----------------------------------------------------------------------
  // Data accessors
  // -----------------------------------------------------------------------

  /** Get a copy of all overlay data for rendering. */
  getOverlayData(): SimOverlayData {
    return {
      nodeVoltages: new Map(this.nodeVoltages),
      branchCurrents: new Map(this.branchCurrents),
      probes: [...this.probes],
      visible: this.visible,
      colorMode: this.colorMode,
    };
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Map a positive voltage magnitude to HSL.
   * 0 → gray, low → cyan (180), mid → yellow (60), high → red (0).
   */
  private voltageToHsl(v: number): string {
    if (v === 0) {
      return 'hsl(0, 0%, 50%)';
    }

    // Reference: 12V as "high" for typical embedded circuits
    // Use logarithmic scale for wide dynamic range
    const logV = Math.log10(Math.max(v, 1e-12));
    // Map -12..~1.1 (12V) → 0..1
    const t = Math.max(0, Math.min(1, (logV + 12) / 13.08)); // 13.08 = 12 + log10(12)

    // Cyan (180) → Yellow (60) → Red (0)
    let hue: number;
    if (t <= 0.5) {
      // cyan (180) → yellow (60)
      hue = 180 - (t / 0.5) * 120;
    } else {
      // yellow (60) → red (0)
      hue = 60 - ((t - 0.5) / 0.5) * 60;
    }

    return `hsl(${Math.round(hue)}, 90%, 50%)`;
  }
}

// ---------------------------------------------------------------------------
// Standalone formatting function (exported for use in components)
// ---------------------------------------------------------------------------

/**
 * Format a numeric value with SI prefix and unit.
 *
 * Examples:
 *   formatValue(3.3, 'V')      → "3.300 V"
 *   formatValue(0.0047, 'A')   → "4.700 mA"
 *   formatValue(-0.000015, 'A') → "-15.00 µA"
 *   formatValue(0, 'V')        → "0 V"
 *   formatValue(1500, 'V')     → "1.500 kV"
 */
export function formatValue(value: number, unit: 'V' | 'A'): string {
  if (value === 0) {
    return `0 ${unit}`;
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  for (const prefix of SI_PREFIXES) {
    if (absValue >= prefix.threshold) {
      const scaled = absValue / prefix.divisor;
      return `${sign}${scaled.toPrecision(4)} ${prefix.suffix}${unit}`;
    }
  }

  // Extremely small — use exponential notation
  return `${value.toExponential(3)} ${unit}`;
}

// ---------------------------------------------------------------------------
// App-wide singleton
// ---------------------------------------------------------------------------

let singleton: SimResultsOverlayManager | null = null;

/** Get (or create) the app-wide SimResultsOverlayManager singleton. */
export function getSimResultsOverlayManager(): SimResultsOverlayManager {
  if (!singleton) {
    singleton = SimResultsOverlayManager.create();
  }
  return singleton;
}

/** Reset the singleton (for testing only). */
export function resetSimResultsOverlayManager(): void {
  singleton = null;
}
