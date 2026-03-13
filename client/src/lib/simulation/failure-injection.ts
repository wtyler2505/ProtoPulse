/**
 * FailureInjectionManager — singleton+subscribe manager for circuit fault injection.
 *
 * Allows users to inject faults into circuit simulation for FMEA and reliability testing:
 * open circuits, short circuits, noisy sensors, degraded (drifted) components,
 * and intermittent connections.
 *
 * Uses a seeded PRNG (mulberry32 from @shared/prng) for reproducible noise/intermittent behavior.
 */

import { mulberry32 } from '@shared/prng';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Fault types that can be injected into a circuit. */
export type FaultType = 'open' | 'short' | 'noise' | 'drift' | 'intermittent';

/** Definition of a single fault to inject. */
export interface FaultDefinition {
  /** Unique fault ID (assigned on inject). */
  id: string;
  /** ID of the component to fault. */
  componentId: string;
  /** Human-readable name of the component. */
  componentName: string;
  /** Type of fault to inject. */
  faultType: FaultType;
  /** Severity in [0, 1]. 0 = no effect, 1 = full effect. */
  severity: number;
  /** Peak-to-peak noise amplitude (for 'noise' faults). Defaults to 10% of nominal. */
  noiseAmplitude?: number;
  /** Drift percentage as a fraction (for 'drift' faults, e.g. 0.2 = 20%). Defaults to severity * 50%. */
  driftPercent?: number;
  /** PRNG seed for reproducible noise/intermittent behavior. */
  seed?: number;
}

/** Summary report of all injected faults. */
export interface FaultReport {
  /** Total number of active faults. */
  totalFaults: number;
  /** Count of faults broken down by type. */
  byType: Record<FaultType, number>;
  /** List of unique component IDs affected. */
  affectedComponents: string[];
}

/** Data required to create a new fault (id is auto-assigned). */
export interface CreateFaultData {
  componentId: string;
  componentName: string;
  faultType: FaultType;
  severity: number;
  noiseAmplitude?: number;
  driftPercent?: number;
  seed?: number;
}

type Listener = () => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Resistance value used for open-circuit faults (effectively infinite). */
const OPEN_CIRCUIT_RESISTANCE = 1e12;

/** Resistance value used for short-circuit faults (effectively zero). */
const SHORT_CIRCUIT_RESISTANCE = 1e-9;

/** Default noise amplitude as a fraction of the nominal value. */
const DEFAULT_NOISE_FRACTION = 0.1;

/** Default maximum drift as a fraction (50%). Actual drift = severity * this. */
const DEFAULT_MAX_DRIFT_FRACTION = 0.5;

/** Default seed when none is provided. */
const DEFAULT_SEED = 42;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a Gaussian random sample using Box-Muller transform.
 * Returns a value with mean 0 and standard deviation 1.
 */
function gaussianRandom(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-15); // avoid log(0)
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ---------------------------------------------------------------------------
// FailureInjectionManager
// ---------------------------------------------------------------------------

class FailureInjectionManager {
  private faults = new Map<string, FaultDefinition>();
  private listeners = new Set<Listener>();
  private _version = 0;

  /** Monotonic version counter for useSyncExternalStore integration. */
  get version(): number {
    return this._version;
  }

  // ---- Query API ----

  /** List all currently injected faults. */
  listFaults(): FaultDefinition[] {
    return Array.from(this.faults.values());
  }

  /** Get a single fault by ID. */
  getFault(id: string): FaultDefinition | undefined {
    return this.faults.get(id);
  }

  /** Get a summary report of all injected faults. */
  getFaultReport(): FaultReport {
    const byType: Record<FaultType, number> = {
      open: 0,
      short: 0,
      noise: 0,
      drift: 0,
      intermittent: 0,
    };

    const componentIds = new Set<string>();

    for (const fault of Array.from(this.faults.values())) {
      byType[fault.faultType]++;
      componentIds.add(fault.componentId);
    }

    return {
      totalFaults: this.faults.size,
      byType,
      affectedComponents: Array.from(componentIds),
    };
  }

  // ---- Mutation API ----

  /**
   * Inject a new fault. Returns the fault ID.
   * Severity is clamped to [0, 1].
   */
  injectFault(data: CreateFaultData): string {
    const id = crypto.randomUUID();
    const severity = Math.max(0, Math.min(1, data.severity));

    const fault: FaultDefinition = {
      id,
      componentId: data.componentId,
      componentName: data.componentName,
      faultType: data.faultType,
      severity,
      noiseAmplitude: data.noiseAmplitude,
      driftPercent: data.driftPercent,
      seed: data.seed,
    };

    this.faults.set(id, fault);
    this._version++;
    this.notify();
    return id;
  }

  /** Remove a fault by ID. Returns true if it existed and was removed. */
  removeFault(id: string): boolean {
    const existed = this.faults.delete(id);
    if (existed) {
      this._version++;
      this.notify();
    }
    return existed;
  }

  /** Remove all faults. */
  clearAllFaults(): void {
    if (this.faults.size === 0) {
      return;
    }
    this.faults.clear();
    this._version++;
    this.notify();
  }

  /**
   * Apply all active faults to a set of component values.
   *
   * Takes a Record mapping componentId -> nominal value and returns a new
   * Record with faults applied. Components without faults pass through unchanged.
   *
   * When multiple faults target the same component, they are applied in sequence
   * (order: open, short, drift, noise, intermittent — by fault insertion order).
   */
  applyFaults(componentValues: Record<string, number>): Record<string, number> {
    const result: Record<string, number> = { ...componentValues };

    for (const fault of Array.from(this.faults.values())) {
      const componentId = fault.componentId;
      if (!(componentId in result)) {
        continue;
      }

      const nominal = componentValues[componentId];
      const current = result[componentId];
      const { severity } = fault;

      if (severity === 0) {
        continue;
      }

      switch (fault.faultType) {
        case 'open': {
          // Interpolate between current value and open-circuit resistance
          result[componentId] = current + (OPEN_CIRCUIT_RESISTANCE - current) * severity;
          break;
        }

        case 'short': {
          // Interpolate between current value and short-circuit resistance
          result[componentId] = current + (SHORT_CIRCUIT_RESISTANCE - current) * severity;
          break;
        }

        case 'noise': {
          // Add Gaussian noise scaled by amplitude and severity
          const amplitude = fault.noiseAmplitude ?? Math.abs(nominal) * DEFAULT_NOISE_FRACTION;
          const seed = fault.seed ?? DEFAULT_SEED;
          const rng = mulberry32(seed);
          const noiseValue = gaussianRandom(rng) * amplitude * severity;
          result[componentId] = current + noiseValue;
          break;
        }

        case 'drift': {
          // Shift value by a percentage of the nominal
          const driftFraction = fault.driftPercent ?? severity * DEFAULT_MAX_DRIFT_FRACTION;
          const shift = Math.abs(nominal) * driftFraction * severity;
          // Positive drift direction (value increases)
          result[componentId] = current + shift;
          break;
        }

        case 'intermittent': {
          // Probability-based open circuit: severity is the probability of being open
          const seed = fault.seed ?? DEFAULT_SEED;
          const rng = mulberry32(seed);
          const roll = rng();
          if (roll < severity) {
            // Open state
            result[componentId] = OPEN_CIRCUIT_RESISTANCE;
          }
          // Otherwise stays at current value (closed state)
          break;
        }
      }
    }

    return result;
  }

  // ---- Subscribe pattern ----

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---- Internal ----

  private notify(): void {
    for (const listener of Array.from(this.listeners)) {
      listener();
    }
  }

  /** Reset all state. For testing only. */
  _reset(): void {
    this.faults.clear();
    this._version = 0;
    this.notify();
  }
}

/** Singleton instance. */
export const failureInjectionManager = new FailureInjectionManager();

// ---------------------------------------------------------------------------
// Export constants for testing
// ---------------------------------------------------------------------------

export { OPEN_CIRCUIT_RESISTANCE, SHORT_CIRCUIT_RESISTANCE, DEFAULT_NOISE_FRACTION, DEFAULT_MAX_DRIFT_FRACTION, DEFAULT_SEED };
