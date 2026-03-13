/**
 * Worst-Case Corner Analysis Engine (BL-0120).
 *
 * Evaluates circuit behavior at component tolerance extremes. For each
 * component with a tolerance, computes output at nominal, all-min, all-max,
 * and statistically worst (RSS) corners. Also computes per-parameter
 * sensitivity via central-difference perturbation.
 *
 * Uses the singleton + subscribe pattern for useSyncExternalStore integration.
 *
 * Usage:
 *   import { worstCaseAnalyzer } from './worst-case-analysis';
 *   worstCaseAnalyzer.defineParameters([
 *     { id: 'R1', name: 'R1', nominal: 10000, tolerance: 500, toleranceType: 'absolute' },
 *     { id: 'R2', name: 'R2', nominal: 10000, tolerance: 0.05, toleranceType: 'percentage' },
 *   ]);
 *   const result = worstCaseAnalyzer.runAnalysis((values) => {
 *     const r1 = values['R1']!;
 *     const r2 = values['R2']!;
 *     return 5 * r2 / (r1 + r2); // Voltage divider
 *   });
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** How the tolerance value is interpreted. */
export type ToleranceType = 'absolute' | 'percentage';

/** A single parameter (component) with its nominal value and tolerance. */
export interface WCAParameter {
  /** Unique identifier for this parameter. */
  id: string;
  /** Human-readable name (e.g. "R1 Resistance"). */
  name: string;
  /** Nominal value in base SI units. */
  nominal: number;
  /** Tolerance magnitude. For 'absolute', the +/- delta. For 'percentage', the fraction (0.05 = 5%). */
  tolerance: number;
  /** How to interpret the tolerance value. */
  toleranceType: ToleranceType;
}

/** The type of corner being evaluated. */
export type CornerType = 'nominal' | 'all_min' | 'all_max' | 'rss_min' | 'rss_max';

/** Result of evaluating the circuit at one specific corner. */
export interface WCACorner {
  /** Which corner this represents. */
  type: CornerType;
  /** Parameter values used for this corner (id -> value). */
  values: Record<string, number>;
  /** The circuit output at this corner. */
  result: number;
  /** Deviation from nominal output (result - nominalResult). */
  deviation: number;
}

/** Per-parameter sensitivity information. */
export interface Sensitivity {
  /** The parameter ID. */
  parameterId: string;
  /** Human-readable name. */
  name: string;
  /** Normalized influence (0-1 range, relative to the parameter with highest influence). */
  influence: number;
  /** Raw sensitivity coefficient (dOutput/dParam). */
  rawSensitivity: number;
  /** Direction of the dominant effect. */
  direction: 'positive' | 'negative';
}

/** Full result of a worst-case analysis run. */
export interface WCAResult {
  /** All evaluated corners. */
  corners: WCACorner[];
  /** Nominal output value. */
  nominal: number;
  /** Minimum output across all corners. */
  minResult: number;
  /** Maximum output across all corners. */
  maxResult: number;
  /** Total output spread (maxResult - minResult). */
  spread: number;
  /** Per-parameter sensitivity analysis. */
  sensitivities: Sensitivity[];
}

/** State exposed by the singleton for useSyncExternalStore. */
export interface WCAState {
  /** Currently defined parameters. */
  parameters: WCAParameter[];
  /** Last analysis result, or null if not yet run. */
  result: WCAResult | null;
  /** Whether an analysis is currently running. */
  running: boolean;
}

type Listener = () => void;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the absolute delta for a parameter.
 * For 'percentage' type: delta = nominal * tolerance
 * For 'absolute' type: delta = tolerance
 */
function getAbsoluteDelta(param: WCAParameter): number {
  if (param.toleranceType === 'percentage') {
    return Math.abs(param.nominal) * param.tolerance;
  }
  return Math.abs(param.tolerance);
}

// ---------------------------------------------------------------------------
// WorstCaseAnalyzer — singleton + subscribe pattern
// ---------------------------------------------------------------------------

class WorstCaseAnalyzer {
  private _parameters: WCAParameter[] = [];
  private _result: WCAResult | null = null;
  private _running = false;
  private _version = 0;
  private listeners = new Set<Listener>();

  // ---- State access ----

  /** Get current state snapshot (for useSyncExternalStore). */
  getState(): WCAState {
    return {
      parameters: [...this._parameters],
      result: this._result,
      running: this._running,
    };
  }

  /** Monotonic version counter for useSyncExternalStore. */
  get version(): number {
    return this._version;
  }

  // ---- Parameter management ----

  /**
   * Define (replace) the full set of parameters to analyze.
   * Clears any previous result.
   */
  defineParameters(params: WCAParameter[]): void {
    this._parameters = params.map((p) => ({ ...p }));
    this._result = null;
    this._version++;
    this.notify();
  }

  /**
   * Add a single parameter. If a parameter with the same ID exists, it is replaced.
   * Clears any previous result.
   */
  addParameter(param: WCAParameter): void {
    const idx = this._parameters.findIndex((p) => p.id === param.id);
    if (idx >= 0) {
      this._parameters[idx] = { ...param };
    } else {
      this._parameters.push({ ...param });
    }
    this._result = null;
    this._version++;
    this.notify();
  }

  /**
   * Remove a parameter by ID. Returns true if found and removed.
   * Clears any previous result.
   */
  removeParameter(id: string): boolean {
    const idx = this._parameters.findIndex((p) => p.id === id);
    if (idx === -1) {
      return false;
    }
    this._parameters.splice(idx, 1);
    this._result = null;
    this._version++;
    this.notify();
    return true;
  }

  /**
   * Update a single parameter. Returns true if found and updated.
   * Clears any previous result.
   */
  updateParameter(id: string, updates: Partial<Omit<WCAParameter, 'id'>>): boolean {
    const param = this._parameters.find((p) => p.id === id);
    if (!param) {
      return false;
    }
    if (updates.name !== undefined) {
      param.name = updates.name;
    }
    if (updates.nominal !== undefined) {
      param.nominal = updates.nominal;
    }
    if (updates.tolerance !== undefined) {
      param.tolerance = updates.tolerance;
    }
    if (updates.toleranceType !== undefined) {
      param.toleranceType = updates.toleranceType;
    }
    this._result = null;
    this._version++;
    this.notify();
    return true;
  }

  /** Clear all parameters and results. */
  clearParameters(): void {
    this._parameters = [];
    this._result = null;
    this._version++;
    this.notify();
  }

  // ---- Analysis ----

  /**
   * Run worst-case analysis with the currently defined parameters.
   *
   * @param evalFn - Circuit evaluation function. Receives a record of parameter
   *   id -> value, returns the scalar output metric.
   * @returns Full WCAResult with all corners, spread, and sensitivities.
   * @throws Error if no parameters are defined.
   */
  runAnalysis(evalFn: (values: Record<string, number>) => number): WCAResult {
    if (this._parameters.length === 0) {
      throw new Error('No parameters defined for worst-case analysis');
    }

    this._running = true;
    this._version++;
    this.notify();

    try {
      const corners: WCACorner[] = [];

      // 1. Nominal corner — all parameters at their nominal values
      const nominalValues: Record<string, number> = {};
      for (const p of this._parameters) {
        nominalValues[p.id] = p.nominal;
      }
      const nominalResult = evalFn(nominalValues);
      corners.push({
        type: 'nominal',
        values: { ...nominalValues },
        result: nominalResult,
        deviation: 0,
      });

      // 2. All-min corner — all parameters at nominal - delta
      const allMinValues: Record<string, number> = {};
      for (const p of this._parameters) {
        allMinValues[p.id] = p.nominal - getAbsoluteDelta(p);
      }
      const allMinResult = evalFn(allMinValues);
      corners.push({
        type: 'all_min',
        values: { ...allMinValues },
        result: allMinResult,
        deviation: allMinResult - nominalResult,
      });

      // 3. All-max corner — all parameters at nominal + delta
      const allMaxValues: Record<string, number> = {};
      for (const p of this._parameters) {
        allMaxValues[p.id] = p.nominal + getAbsoluteDelta(p);
      }
      const allMaxResult = evalFn(allMaxValues);
      corners.push({
        type: 'all_max',
        values: { ...allMaxValues },
        result: allMaxResult,
        deviation: allMaxResult - nominalResult,
      });

      // 4. Sensitivity analysis — central difference for each parameter
      const sensitivities = this.computeSensitivities(evalFn, nominalValues, nominalResult);

      // 5. RSS corners — statistical worst case using root-sum-squares
      // RSS deviation = sqrt(sum( (dOutput/dParam_i * delta_i)^2 ))
      const rssCorners = this.computeRSSCorners(
        evalFn,
        nominalValues,
        nominalResult,
        sensitivities,
      );
      corners.push(...rssCorners);

      // Compute overall min/max across all corners
      const allResults = corners.map((c) => c.result);
      const minResult = Math.min(...allResults);
      const maxResult = Math.max(...allResults);

      const result: WCAResult = {
        corners,
        nominal: nominalResult,
        minResult,
        maxResult,
        spread: maxResult - minResult,
        sensitivities,
      };

      this._result = result;
      this._running = false;
      this._version++;
      this.notify();

      return result;
    } catch (err) {
      this._running = false;
      this._version++;
      this.notify();
      throw err;
    }
  }

  /**
   * Get the sensitivities from the last run, or empty array if not yet run.
   */
  getSensitivities(): Sensitivity[] {
    return this._result?.sensitivities ?? [];
  }

  // ---- Subscribe pattern (useSyncExternalStore compatible) ----

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

  /**
   * Compute per-parameter sensitivity using central-difference approximation.
   *
   * For each parameter, perturb by +/- 1% of nominal (or +/- 1% of tolerance delta
   * if nominal is zero) while holding all others at nominal. The raw sensitivity
   * is dOutput / dParam. The normalized influence is scaled relative to the
   * parameter with the highest absolute raw sensitivity.
   */
  private computeSensitivities(
    evalFn: (values: Record<string, number>) => number,
    nominalValues: Record<string, number>,
    _nominalResult: number,
  ): Sensitivity[] {
    const PERTURBATION_FRACTION = 0.01; // 1% perturbation
    const rawResults: Array<{
      parameterId: string;
      name: string;
      rawSensitivity: number;
      direction: 'positive' | 'negative';
    }> = [];

    for (const p of this._parameters) {
      const delta = getAbsoluteDelta(p);
      // Perturbation amount: 1% of nominal, or 1% of delta if nominal is ~0
      const perturbation = Math.abs(p.nominal) > 1e-15
        ? Math.abs(p.nominal) * PERTURBATION_FRACTION
        : delta * PERTURBATION_FRACTION;

      if (perturbation === 0) {
        rawResults.push({
          parameterId: p.id,
          name: p.name,
          rawSensitivity: 0,
          direction: 'positive',
        });
        continue;
      }

      // f(p + dp)
      const plusValues = { ...nominalValues };
      plusValues[p.id] = p.nominal + perturbation;
      const outputPlus = evalFn(plusValues);

      // f(p - dp)
      const minusValues = { ...nominalValues };
      minusValues[p.id] = p.nominal - perturbation;
      const outputMinus = evalFn(minusValues);

      // Central difference: dOutput / dParam
      const rawSensitivity = (outputPlus - outputMinus) / (2 * perturbation);

      rawResults.push({
        parameterId: p.id,
        name: p.name,
        rawSensitivity,
        direction: rawSensitivity >= 0 ? 'positive' : 'negative',
      });
    }

    // Normalize influence to [0, 1] relative to the maximum absolute sensitivity
    const maxAbsSens = Math.max(
      ...rawResults.map((r) => Math.abs(r.rawSensitivity)),
      1e-30, // Avoid division by zero
    );

    return rawResults.map((r) => ({
      parameterId: r.parameterId,
      name: r.name,
      influence: Math.abs(r.rawSensitivity) / maxAbsSens,
      rawSensitivity: r.rawSensitivity,
      direction: r.direction,
    }));
  }

  /**
   * Compute RSS (Root Sum of Squares) corners.
   *
   * The RSS method estimates the statistical worst case by computing:
   *   RSS deviation = sqrt( sum_i (dOutput/dParam_i * delta_i)^2 )
   *
   * This gives two corners: nominal +/- RSS deviation.
   * The RSS approach is less conservative than all-min/all-max because it
   * accounts for the statistical improbability of all parameters being at
   * their worst simultaneously.
   */
  private computeRSSCorners(
    evalFn: (values: Record<string, number>) => number,
    nominalValues: Record<string, number>,
    nominalResult: number,
    sensitivities: Sensitivity[],
  ): WCACorner[] {
    // Build a map for quick lookup
    const sensMap = new Map<string, number>();
    for (const s of sensitivities) {
      sensMap.set(s.parameterId, s.rawSensitivity);
    }

    // Compute RSS deviation
    let sumSquares = 0;
    for (const p of this._parameters) {
      const delta = getAbsoluteDelta(p);
      const sens = sensMap.get(p.id) ?? 0;
      sumSquares += (sens * delta) * (sens * delta);
    }
    const rssDeviation = Math.sqrt(sumSquares);

    // For RSS corners, we set each parameter in the direction that would
    // produce the worst output. For rss_min, each parameter goes in the
    // direction that decreases output; for rss_max, the direction that increases.
    // The magnitude of each parameter's shift is proportional to its contribution
    // to the RSS deviation.

    // RSS min corner values
    const rssMinValues: Record<string, number> = {};
    const rssMaxValues: Record<string, number> = {};
    for (const p of this._parameters) {
      const delta = getAbsoluteDelta(p);
      const sens = sensMap.get(p.id) ?? 0;
      // For RSS min: shift parameter in the direction that decreases output
      // If sensitivity > 0, decreasing the parameter decreases output -> go to min
      // If sensitivity < 0, increasing the parameter decreases output -> go to max
      if (sens >= 0) {
        rssMinValues[p.id] = p.nominal - delta;
        rssMaxValues[p.id] = p.nominal + delta;
      } else {
        rssMinValues[p.id] = p.nominal + delta;
        rssMaxValues[p.id] = p.nominal - delta;
      }
    }

    // Evaluate at the directional worst corners, but report the RSS deviation
    // as the expected statistical deviation
    const rssMinResult = nominalResult - rssDeviation;
    const rssMaxResult = nominalResult + rssDeviation;

    // Also evaluate the actual circuit at the directional corners for the values
    const _actualRssMinResult = evalFn(rssMinValues);
    const _actualRssMaxResult = evalFn(rssMaxValues);

    return [
      {
        type: 'rss_min' as CornerType,
        values: { ...rssMinValues },
        result: rssMinResult,
        deviation: rssMinResult - nominalResult,
      },
      {
        type: 'rss_max' as CornerType,
        values: { ...rssMaxValues },
        result: rssMaxResult,
        deviation: rssMaxResult - nominalResult,
      },
    ];
  }

  /** Reset all state. For testing only. */
  _reset(): void {
    this._parameters = [];
    this._result = null;
    this._running = false;
    this._version++;
    this.notify();
  }
}

/** Singleton instance. */
export const worstCaseAnalyzer = new WorstCaseAnalyzer();
