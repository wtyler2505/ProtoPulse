/**
 * Simulation Resource Guardrails (BL-0127)
 *
 * Shared types, defaults, and check function for enforcing wall-clock time,
 * iteration count, and output-point limits across all simulation engines.
 * Limits are always optional — callers that pass nothing get safe defaults.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Resource limits for a simulation run. */
export interface SimulationLimits {
  /** Maximum wall-clock duration in milliseconds. */
  maxDurationMs: number;
  /** Maximum iteration / time-step count. */
  maxIterations: number;
  /** Maximum number of output data points. */
  maxOutputPoints: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_SIM_LIMITS: Readonly<SimulationLimits> = {
  maxDurationMs: 30_000,    // 30 seconds
  maxIterations: 100_000,   // 100 K iterations
  maxOutputPoints: 50_000,  // 50 K output data points
};

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

/** Limit type that was exceeded. */
export type SimLimitType = 'time' | 'iterations' | 'output';

/**
 * Thrown when a simulation exceeds one of its resource limits.
 * Callers can inspect `limitType` to determine which limit was hit.
 */
export class SimulationLimitError extends Error {
  public readonly limitType: SimLimitType;

  constructor(limitType: SimLimitType, message: string) {
    super(message);
    this.name = 'SimulationLimitError';
    this.limitType = limitType;
  }
}

// ---------------------------------------------------------------------------
// Check function
// ---------------------------------------------------------------------------

/**
 * Check all three resource limits and throw `SimulationLimitError` on violation.
 *
 * @param startTime   - `performance.now()` timestamp captured before the loop
 * @param iterCount   - current iteration / step counter
 * @param outputCount - current number of output data points produced
 * @param limits      - limit thresholds (use `DEFAULT_SIM_LIMITS` as fallback)
 */
export function checkSimLimits(
  startTime: number,
  iterCount: number,
  outputCount: number,
  limits: SimulationLimits = DEFAULT_SIM_LIMITS,
): void {
  if (iterCount > limits.maxIterations) {
    throw new SimulationLimitError(
      'iterations',
      `Simulation exceeded iteration limit (${limits.maxIterations.toLocaleString()})`,
    );
  }

  if (outputCount > limits.maxOutputPoints) {
    throw new SimulationLimitError(
      'output',
      `Simulation exceeded output point limit (${limits.maxOutputPoints.toLocaleString()})`,
    );
  }

  // Wall-clock check is the most expensive (calls performance.now()), so do it last
  const elapsed = performance.now() - startTime;
  if (elapsed > limits.maxDurationMs) {
    throw new SimulationLimitError(
      'time',
      `Simulation exceeded time limit (${(limits.maxDurationMs / 1000).toFixed(1)}s)`,
    );
  }
}
