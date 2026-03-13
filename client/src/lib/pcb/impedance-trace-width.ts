/**
 * ImpedanceTraceWidthManager — Impedance-aware trace width enforcement
 *
 * When a net has an impedance target (via net class), auto-suggest or enforce
 * the trace width required to hit that impedance given the board stackup.
 *
 * Uses IPC-2141 formulas (microstrip) and standard stripline formulas,
 * consistent with transmission-line.ts and board-stackup.ts.
 *
 * All dimensions in mm. Internally uses a Newton-Raphson search to invert
 * the impedance-vs-width relationship.
 *
 * Singleton + subscribe pattern (useSyncExternalStore compatible).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TraceType = 'microstrip' | 'stripline';

export interface StackupParams {
  /** Relative permittivity (e.g. 4.4 for FR4, 3.55 for Rogers 4003C). */
  dielectricConstant: number;
  /** Dielectric height to reference plane (mm). */
  dielectricHeight: number;
  /** Copper thickness (mm). Typically 0.035 for 1oz copper. */
  copperThickness: number;
  /** Trace type — outer layer (microstrip) or inner layer (stripline). */
  traceType: TraceType;
}

export interface TraceWidthResult {
  /** Required trace width (mm). */
  width: number;
  /** Actual impedance achieved at the computed width (ohms). */
  actualImpedance: number;
  /** Target impedance (ohms). */
  targetImpedance: number;
  /** Absolute error between actual and target impedance (ohms). */
  error: number;
}

export interface NetWithTarget {
  netId: string;
  netName: string;
  currentWidth: number; // mm
  targetImpedance: number; // ohms
}

export interface WidthSuggestion {
  netId: string;
  netName: string;
  currentWidth: number; // mm
  suggestedWidth: number; // mm
  targetZ: number; // ohms
  actualZ: number; // ohms
  compliant: boolean;
}

export interface ComplianceResult {
  compliant: boolean;
  targetZ: number; // ohms
  actualZ: number; // ohms
  /** Relative deviation: abs(actualZ - targetZ) / targetZ. */
  deviation: number;
  suggestedWidth: number; // mm
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default compliance tolerance: 5% impedance deviation is considered passing. */
const DEFAULT_TOLERANCE = 0.05;

/** Maximum iterations for the binary search. */
const MAX_ITERATIONS = 200;

/** Impedance convergence tolerance (ohms). */
const IMPEDANCE_TOLERANCE = 0.01;

/** Minimum practical trace width (mm) — ~0.05mm / 2 mil. */
const MIN_WIDTH = 0.001;

/** Maximum practical trace width (mm) — ~10mm / 400 mil. */
const MAX_WIDTH = 25.0;

// ---------------------------------------------------------------------------
// Impedance formulas (mm-based, matching transmission-line.ts)
// ---------------------------------------------------------------------------

/**
 * Microstrip impedance (IPC-2141):
 *   Z0 = (87 / sqrt(εr + 1.41)) * ln(5.98 * h / (0.8 * w + t))
 *
 * @param w - Trace width (mm)
 * @param h - Dielectric height (mm)
 * @param t - Copper thickness (mm)
 * @param er - Relative permittivity
 * @returns Impedance in ohms, or NaN if geometry is non-physical.
 */
function microstripImpedance(w: number, h: number, t: number, er: number): number {
  const arg = (5.98 * h) / (0.8 * w + t);
  if (arg <= 1) {
    return NaN;
  }
  return (87 / Math.sqrt(er + 1.41)) * Math.log(arg);
}

/**
 * Stripline impedance:
 *   Z0 = (60 / sqrt(εr)) * ln(4 * h / (0.67 * π * (0.8 * w + t)))
 *
 * where h is the distance from trace center to ONE reference plane.
 * For symmetric stripline, total dielectric = 2*h.
 *
 * @param w - Trace width (mm)
 * @param h - Dielectric height to ONE reference plane (mm)
 * @param t - Copper thickness (mm)
 * @param er - Relative permittivity
 * @returns Impedance in ohms, or NaN if geometry is non-physical.
 */
function striplineImpedance(w: number, h: number, t: number, er: number): number {
  const arg = (4 * h) / (0.67 * Math.PI * (0.8 * w + t));
  if (arg <= 1) {
    return NaN;
  }
  return (60 / Math.sqrt(er)) * Math.log(arg);
}

// ---------------------------------------------------------------------------
// Core calculation: compute impedance for a given width + stackup
// ---------------------------------------------------------------------------

/**
 * Calculate impedance for a given trace width and stackup parameters.
 *
 * @returns Impedance in ohms, or NaN if the geometry is non-physical.
 */
export function calculateImpedance(width: number, stackup: StackupParams): number {
  if (width <= 0 || stackup.dielectricHeight <= 0 || stackup.dielectricConstant < 1) {
    return NaN;
  }

  if (stackup.traceType === 'microstrip') {
    return microstripImpedance(width, stackup.dielectricHeight, stackup.copperThickness, stackup.dielectricConstant);
  }
  return striplineImpedance(width, stackup.dielectricHeight, stackup.copperThickness, stackup.dielectricConstant);
}

// ---------------------------------------------------------------------------
// Core calculation: find width for target impedance (binary search)
// ---------------------------------------------------------------------------

/**
 * Binary search for the trace width that yields the target impedance.
 *
 * Impedance is monotonically decreasing with increasing width (wider trace =
 * lower impedance). The binary search exploits this monotonicity.
 *
 * @returns TraceWidthResult, or null if the target impedance is unreachable.
 */
function findWidthForImpedance(targetZ: number, stackup: StackupParams): TraceWidthResult | null {
  if (targetZ <= 0) {
    return null;
  }

  let lo = MIN_WIDTH;
  let hi = MAX_WIDTH;

  // Check that the target is within the achievable range
  const zAtMinWidth = calculateImpedance(lo, stackup);
  const zAtMaxWidth = calculateImpedance(hi, stackup);

  if (Number.isNaN(zAtMinWidth) && Number.isNaN(zAtMaxWidth)) {
    return null;
  }

  // Impedance decreases as width increases
  // zAtMinWidth is the maximum achievable impedance
  // zAtMaxWidth is the minimum achievable impedance
  if (!Number.isNaN(zAtMinWidth) && targetZ > zAtMinWidth) {
    // Target impedance is higher than what the narrowest trace can achieve
    // Return the narrowest trace as the best approximation
    return {
      width: lo,
      actualImpedance: zAtMinWidth,
      targetImpedance: targetZ,
      error: Math.abs(zAtMinWidth - targetZ),
    };
  }

  if (!Number.isNaN(zAtMaxWidth) && targetZ < zAtMaxWidth) {
    return {
      width: hi,
      actualImpedance: zAtMaxWidth,
      targetImpedance: targetZ,
      error: Math.abs(zAtMaxWidth - targetZ),
    };
  }

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    const z = calculateImpedance(mid, stackup);

    if (Number.isNaN(z)) {
      // Non-physical region — narrow the trace (move lo up)
      lo = mid;
      continue;
    }

    const diff = z - targetZ;

    if (Math.abs(diff) < IMPEDANCE_TOLERANCE) {
      return {
        width: Math.round(mid * 10000) / 10000,
        actualImpedance: Math.round(z * 100) / 100,
        targetImpedance: targetZ,
        error: Math.round(Math.abs(diff) * 100) / 100,
      };
    }

    if (diff > 0) {
      // Impedance too high — need wider trace
      lo = mid;
    } else {
      // Impedance too low — need narrower trace
      hi = mid;
    }
  }

  // Return best approximation
  const finalWidth = (lo + hi) / 2;
  const finalZ = calculateImpedance(finalWidth, stackup);
  const finalZSafe = Number.isNaN(finalZ) ? 0 : finalZ;

  return {
    width: Math.round(finalWidth * 10000) / 10000,
    actualImpedance: Math.round(finalZSafe * 100) / 100,
    targetImpedance: targetZ,
    error: Math.round(Math.abs(finalZSafe - targetZ) * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// ImpedanceTraceWidthManager — Singleton + Subscribe
// ---------------------------------------------------------------------------

/**
 * Manages impedance-aware trace width enforcement.
 *
 * Singleton with subscribe pattern for useSyncExternalStore compatibility.
 * Stores the current stackup params and compliance tolerance so the UI
 * can reactively update when params change.
 */
export class ImpedanceTraceWidthManager {
  private static instance: ImpedanceTraceWidthManager | null = null;

  private stackupParams: StackupParams = {
    dielectricConstant: 4.4, // FR4 default
    dielectricHeight: 0.2,   // ~8 mils
    copperThickness: 0.035,  // 1oz copper
    traceType: 'microstrip',
  };

  private tolerance: number = DEFAULT_TOLERANCE;
  private listeners = new Set<Listener>();

  static getInstance(): ImpedanceTraceWidthManager {
    if (!ImpedanceTraceWidthManager.instance) {
      ImpedanceTraceWidthManager.instance = new ImpedanceTraceWidthManager();
    }
    return ImpedanceTraceWidthManager.instance;
  }

  static resetForTesting(): void {
    ImpedanceTraceWidthManager.instance = null;
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

  getSnapshot(): StackupParams {
    return { ...this.stackupParams };
  }

  private notify(): void {
    for (const listener of Array.from(this.listeners)) {
      listener();
    }
  }

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  setStackupParams(params: StackupParams): void {
    this.stackupParams = { ...params };
    this.notify();
  }

  getStackupParams(): StackupParams {
    return { ...this.stackupParams };
  }

  setTolerance(tolerance: number): void {
    if (tolerance < 0 || tolerance > 1) {
      throw new Error('Tolerance must be between 0 and 1');
    }
    this.tolerance = tolerance;
    this.notify();
  }

  getTolerance(): number {
    return this.tolerance;
  }

  // -----------------------------------------------------------------------
  // Core API
  // -----------------------------------------------------------------------

  /**
   * Calculate the required trace width to achieve a target impedance
   * given the stackup parameters.
   *
   * @param targetZ - Target impedance in ohms
   * @param stackup - Stackup parameters (uses instance defaults if omitted)
   * @returns TraceWidthResult or null if unreachable
   */
  calculateRequiredWidth(targetZ: number, stackup?: StackupParams): TraceWidthResult | null {
    const params = stackup ?? this.stackupParams;
    return findWidthForImpedance(targetZ, params);
  }

  /**
   * Batch: generate width suggestions for all nets with impedance targets.
   *
   * @param nets - Array of nets with current width and target impedance
   * @param stackup - Stackup parameters (uses instance defaults if omitted)
   * @returns Array of width suggestions
   */
  getWidthSuggestions(nets: NetWithTarget[], stackup?: StackupParams): WidthSuggestion[] {
    const params = stackup ?? this.stackupParams;

    return nets.map((net) => {
      const result = findWidthForImpedance(net.targetImpedance, params);

      if (!result) {
        // Cannot compute — return current width as suggestion, mark non-compliant
        return {
          netId: net.netId,
          netName: net.netName,
          currentWidth: net.currentWidth,
          suggestedWidth: net.currentWidth,
          targetZ: net.targetImpedance,
          actualZ: 0,
          compliant: false,
        };
      }

      // Check compliance at the CURRENT width, not the suggested width
      const currentZ = calculateImpedance(net.currentWidth, params);
      const currentZSafe = Number.isNaN(currentZ) ? 0 : currentZ;
      const deviation = net.targetImpedance > 0
        ? Math.abs(currentZSafe - net.targetImpedance) / net.targetImpedance
        : 1;

      return {
        netId: net.netId,
        netName: net.netName,
        currentWidth: net.currentWidth,
        suggestedWidth: result.width,
        targetZ: net.targetImpedance,
        actualZ: Math.round(currentZSafe * 100) / 100,
        compliant: deviation <= this.tolerance,
      };
    });
  }

  /**
   * Check whether a specific net's current trace width is compliant
   * with its impedance target.
   *
   * @param netId - Net identifier (for context only)
   * @param currentWidth - Current trace width (mm)
   * @param targetZ - Target impedance (ohms)
   * @param stackup - Stackup parameters (uses instance defaults if omitted)
   * @returns ComplianceResult
   */
  checkCompliance(
    _netId: string,
    currentWidth: number,
    targetZ: number,
    stackup?: StackupParams,
  ): ComplianceResult {
    const params = stackup ?? this.stackupParams;

    const actualZ = calculateImpedance(currentWidth, params);
    const actualZSafe = Number.isNaN(actualZ) ? 0 : actualZ;

    const deviation = targetZ > 0
      ? Math.abs(actualZSafe - targetZ) / targetZ
      : 1;

    const suggested = findWidthForImpedance(targetZ, params);
    const suggestedWidth = suggested ? suggested.width : currentWidth;

    return {
      compliant: deviation <= this.tolerance,
      targetZ,
      actualZ: Math.round(actualZSafe * 100) / 100,
      deviation: Math.round(deviation * 10000) / 10000,
      suggestedWidth,
    };
  }
}
