/**
 * SimCompareManager — Simulation Compare Mode (BL-0125)
 *
 * Captures simulation snapshots, stores them (max 10, FIFO eviction),
 * and compares any two snapshots with statistical analysis:
 *   - RMS error per signal
 *   - Peak deviation per signal
 *   - Pearson correlation per signal
 *   - Overlay data for chart rendering
 *
 * Singleton + subscribe pattern for useSyncExternalStore integration.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single named data series within a simulation result. */
export interface Signal {
  /** Human-readable signal name (e.g. "V(out)", "I(R1)"). */
  name: string;
  /** Independent variable values (time, frequency, sweep, etc.). */
  xValues: number[];
  /** Dependent variable values corresponding to each x. */
  yValues: number[];
  /** Unit of x axis (e.g. "s", "Hz"). */
  xUnit?: string;
  /** Unit of y axis (e.g. "V", "A", "dB"). */
  yUnit?: string;
}

/** Generic simulation data containing one or more signals. */
export interface SimulationData {
  /** The type of simulation this data came from. */
  simType: 'dc' | 'ac' | 'transient' | 'monte_carlo' | 'frequency' | 'other';
  /** Signals produced by the simulation. */
  signals: Signal[];
}

/** A timestamped snapshot of simulation results. */
export interface SimSnapshot {
  /** Unique snapshot identifier. */
  id: string;
  /** User-provided label (e.g. "Before R1 change", "After filter tweak"). */
  label: string;
  /** ISO-8601 timestamp of when the snapshot was captured. */
  capturedAt: string;
  /** The simulation data frozen at capture time. */
  data: SimulationData;
}

/** Statistical comparison between two signals. */
export interface SignalDiff {
  /** Name of the signal being compared. */
  signalName: string;
  /** Root Mean Square error between the two signals. */
  rmsError: number;
  /** Maximum absolute deviation between the two signals. */
  peakDeviation: number;
  /** Pearson correlation coefficient (−1.0 to 1.0). */
  correlation: number;
  /** Whether the signal existed in snapshot A. */
  inA: boolean;
  /** Whether the signal existed in snapshot B. */
  inB: boolean;
}

/** Full comparison result between two snapshots. */
export interface CompareResult {
  /** ID of snapshot A. */
  snapshotAId: string;
  /** ID of snapshot B. */
  snapshotBId: string;
  /** Per-signal statistical diffs. */
  signalDiffs: SignalDiff[];
  /** Overall RMS error averaged across all paired signals. */
  overallRmsError: number;
  /** Overall peak deviation (max across all paired signals). */
  overallPeakDeviation: number;
}

/** Data ready for overlay chart rendering. */
export interface OverlayData {
  /** ID of snapshot A. */
  snapshotAId: string;
  /** ID of snapshot B. */
  snapshotBId: string;
  /** Per-signal overlay series. */
  series: OverlaySeries[];
}

/** Overlay data for a single signal. */
export interface OverlaySeries {
  /** Signal name. */
  signalName: string;
  /** X values from snapshot A. */
  xA: number[];
  /** Y values from snapshot A. */
  yA: number[];
  /** X values from snapshot B. */
  xB: number[];
  /** Y values from snapshot B. */
  yB: number[];
  /** X-axis unit. */
  xUnit?: string;
  /** Y-axis unit. */
  yUnit?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SNAPSHOTS = 10;
const STORAGE_KEY = 'protopulse-sim-compare-snapshots';

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

/**
 * Linearly interpolate array `ys` (at positions `xs`) onto new x positions `xTarget`.
 * Assumes `xs` is sorted in ascending order. Values outside the range are clamped.
 */
function interpolateSignal(xs: number[], ys: number[], xTarget: number[]): number[] {
  const n = xs.length;
  if (n === 0) {
    return xTarget.map(() => 0);
  }
  if (n === 1) {
    return xTarget.map(() => ys[0]);
  }

  const result: number[] = [];
  let j = 0; // pointer into xs

  for (const xt of xTarget) {
    // Clamp to range
    if (xt <= xs[0]) {
      result.push(ys[0]);
      continue;
    }
    if (xt >= xs[n - 1]) {
      result.push(ys[n - 1]);
      continue;
    }

    // Advance j so xs[j] <= xt < xs[j+1]
    while (j < n - 2 && xs[j + 1] < xt) {
      j++;
    }

    const x0 = xs[j];
    const x1 = xs[j + 1];
    const y0 = ys[j];
    const y1 = ys[j + 1];
    const t = (xt - x0) / (x1 - x0);
    result.push(y0 + t * (y1 - y0));
  }

  return result;
}

/** Compute RMS error between two equal-length arrays. */
function computeRmsError(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) {
    return 0;
  }
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const diff = a[i] - b[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq / n);
}

/** Compute maximum absolute deviation between two equal-length arrays. */
function computePeakDeviation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let max = 0;
  for (let i = 0; i < n; i++) {
    const dev = Math.abs(a[i] - b[i]);
    if (dev > max) {
      max = dev;
    }
  }
  return max;
}

/** Compute Pearson correlation coefficient between two equal-length arrays. */
function computeCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) {
    return n === 1 ? 1.0 : 0;
  }

  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }

  const denom = Math.sqrt(varA * varB);
  if (denom === 0) {
    // Both signals are constant — perfectly "correlated" if equal, otherwise undefined.
    // Return 1.0 if both constant at the same value, 0.0 otherwise.
    return Math.abs(meanA - meanB) < 1e-15 ? 1.0 : 0;
  }

  return cov / denom;
}

/**
 * Build a common x-axis grid from two signals.
 * Takes the union of x ranges (intersection of domains) and uses
 * the finer resolution of the two signals.
 */
function buildCommonXGrid(sigA: Signal, sigB: Signal): number[] {
  const xMinA = sigA.xValues[0];
  const xMaxA = sigA.xValues[sigA.xValues.length - 1];
  const xMinB = sigB.xValues[0];
  const xMaxB = sigB.xValues[sigB.xValues.length - 1];

  // Intersection of domains
  const xMin = Math.max(xMinA, xMinB);
  const xMax = Math.min(xMaxA, xMaxB);

  if (xMin >= xMax) {
    // No overlap — return the single midpoint
    return [(xMin + xMax) / 2];
  }

  // Use the finer resolution (more points per range)
  const nPoints = Math.max(sigA.xValues.length, sigB.xValues.length);
  const step = (xMax - xMin) / (nPoints - 1);

  const grid: number[] = [];
  for (let i = 0; i < nPoints; i++) {
    grid.push(xMin + i * step);
  }
  return grid;
}

// ---------------------------------------------------------------------------
// SimCompareManager
// ---------------------------------------------------------------------------

type Listener = () => void;

class SimCompareManager {
  private snapshots: SimSnapshot[] = [];
  private listeners = new Set<Listener>();
  private _version = 0;

  constructor() {
    this.load();
  }

  /** Monotonic version counter for useSyncExternalStore. */
  get version(): number {
    return this._version;
  }

  // ---- Snapshot CRUD ----

  /** Capture a new snapshot. Returns the created snapshot. FIFO evicts oldest if at capacity. */
  captureSnapshot(label: string, data: SimulationData): SimSnapshot {
    const snapshot: SimSnapshot = {
      id: crypto.randomUUID(),
      label,
      capturedAt: new Date().toISOString(),
      data: structuredClone(data),
    };

    this.snapshots.push(snapshot);

    // FIFO eviction
    while (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots.shift();
    }

    this._version++;
    this.persist();
    this.notify();
    return snapshot;
  }

  /** List all snapshots, oldest first. */
  listSnapshots(): SimSnapshot[] {
    return [...this.snapshots];
  }

  /** Get a snapshot by ID, or undefined if not found. */
  getSnapshot(id: string): SimSnapshot | undefined {
    return this.snapshots.find((s) => s.id === id);
  }

  /** Delete a snapshot by ID. Returns true if found and deleted. */
  deleteSnapshot(id: string): boolean {
    const index = this.snapshots.findIndex((s) => s.id === id);
    if (index === -1) {
      return false;
    }
    this.snapshots.splice(index, 1);
    this._version++;
    this.persist();
    this.notify();
    return true;
  }

  /** Update a snapshot's label. Returns the updated snapshot or undefined. */
  renameSnapshot(id: string, newLabel: string): SimSnapshot | undefined {
    const snap = this.snapshots.find((s) => s.id === id);
    if (!snap) {
      return undefined;
    }
    snap.label = newLabel;
    this._version++;
    this.persist();
    this.notify();
    return snap;
  }

  /** Number of snapshots currently stored. */
  get count(): number {
    return this.snapshots.length;
  }

  // ---- Comparison ----

  /**
   * Compare two snapshots by ID.
   * Signals are matched by name. Signals unique to one snapshot get
   * a diff entry with `inA` / `inB` flags and zeroed stats.
   */
  compare(snapshotAId: string, snapshotBId: string): CompareResult | undefined {
    const a = this.getSnapshot(snapshotAId);
    const b = this.getSnapshot(snapshotBId);
    if (!a || !b) {
      return undefined;
    }

    const signalMapA = new Map(a.data.signals.map((s) => [s.name, s]));
    const signalMapB = new Map(b.data.signals.map((s) => [s.name, s]));

    // Collect all signal names (union)
    const allNames = new Set<string>();
    for (const s of a.data.signals) {
      allNames.add(s.name);
    }
    for (const s of b.data.signals) {
      allNames.add(s.name);
    }

    const signalDiffs: SignalDiff[] = [];
    let totalRms = 0;
    let pairedCount = 0;
    let overallPeak = 0;

    for (const name of Array.from(allNames)) {
      const sigA = signalMapA.get(name);
      const sigB = signalMapB.get(name);

      if (sigA && sigB) {
        // Both present — compute stats
        const { rms, peak, corr } = this.compareSignals(sigA, sigB);
        signalDiffs.push({
          signalName: name,
          rmsError: rms,
          peakDeviation: peak,
          correlation: corr,
          inA: true,
          inB: true,
        });
        totalRms += rms;
        pairedCount++;
        if (peak > overallPeak) {
          overallPeak = peak;
        }
      } else {
        // Signal only in one snapshot
        signalDiffs.push({
          signalName: name,
          rmsError: 0,
          peakDeviation: 0,
          correlation: 0,
          inA: !!sigA,
          inB: !!sigB,
        });
      }
    }

    return {
      snapshotAId,
      snapshotBId,
      signalDiffs,
      overallRmsError: pairedCount > 0 ? totalRms / pairedCount : 0,
      overallPeakDeviation: overallPeak,
    };
  }

  /**
   * Get overlay data suitable for rendering two snapshots on the same chart.
   */
  getOverlayData(snapshotAId: string, snapshotBId: string): OverlayData | undefined {
    const a = this.getSnapshot(snapshotAId);
    const b = this.getSnapshot(snapshotBId);
    if (!a || !b) {
      return undefined;
    }

    const signalMapA = new Map(a.data.signals.map((s) => [s.name, s]));
    const signalMapB = new Map(b.data.signals.map((s) => [s.name, s]));

    const allNames = new Set<string>();
    for (const s of a.data.signals) {
      allNames.add(s.name);
    }
    for (const s of b.data.signals) {
      allNames.add(s.name);
    }

    const series: OverlaySeries[] = [];

    for (const name of Array.from(allNames)) {
      const sigA = signalMapA.get(name);
      const sigB = signalMapB.get(name);

      series.push({
        signalName: name,
        xA: sigA ? [...sigA.xValues] : [],
        yA: sigA ? [...sigA.yValues] : [],
        xB: sigB ? [...sigB.xValues] : [],
        yB: sigB ? [...sigB.yValues] : [],
        xUnit: sigA?.xUnit ?? sigB?.xUnit,
        yUnit: sigA?.yUnit ?? sigB?.yUnit,
      });
    }

    return { snapshotAId, snapshotBId, series };
  }

  // ---- Subscribe pattern ----

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---- Internal ----

  private compareSignals(sigA: Signal, sigB: Signal): { rms: number; peak: number; corr: number } {
    // Handle trivial cases
    if (sigA.xValues.length === 0 && sigB.xValues.length === 0) {
      return { rms: 0, peak: 0, corr: 1 };
    }
    if (sigA.xValues.length === 0 || sigB.xValues.length === 0) {
      return { rms: 0, peak: 0, corr: 0 };
    }

    // Single-point signals
    if (sigA.xValues.length === 1 && sigB.xValues.length === 1) {
      const diff = Math.abs(sigA.yValues[0] - sigB.yValues[0]);
      return { rms: diff, peak: diff, corr: diff < 1e-15 ? 1.0 : computeCorrelation(sigA.yValues, sigB.yValues) };
    }

    // Build common x grid and interpolate both signals onto it
    const commonX = buildCommonXGrid(sigA, sigB);
    const yA = interpolateSignal(sigA.xValues, sigA.yValues, commonX);
    const yB = interpolateSignal(sigB.xValues, sigB.yValues, commonX);

    return {
      rms: computeRmsError(yA, yB),
      peak: computePeakDeviation(yA, yB),
      corr: computeCorrelation(yA, yB),
    };
  }

  private notify(): void {
    for (const listener of Array.from(this.listeners)) {
      listener();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshots));
    } catch {
      // localStorage may be unavailable or full
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return;
      }
      this.snapshots = parsed.filter(
        (s): s is SimSnapshot =>
          typeof s === 'object' &&
          s !== null &&
          typeof (s as Record<string, unknown>).id === 'string' &&
          typeof (s as Record<string, unknown>).label === 'string' &&
          typeof (s as Record<string, unknown>).capturedAt === 'string' &&
          typeof (s as Record<string, unknown>).data === 'object',
      );
      // Enforce max on load in case storage was manually edited
      while (this.snapshots.length > MAX_SNAPSHOTS) {
        this.snapshots.shift();
      }
    } catch {
      // Ignore corrupt data
    }
  }

  /** Reset all state. For testing only. */
  _reset(): void {
    this.snapshots = [];
    this._version = 0;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
    this.notify();
  }
}

/** Singleton instance. */
export const simCompareManager = new SimCompareManager();

// Re-export constants for test assertions
export { MAX_SNAPSHOTS };
