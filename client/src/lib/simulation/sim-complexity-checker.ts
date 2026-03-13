/**
 * Simulation Complexity Checker — Detailed Pre-Flight Analysis (BL-0514)
 *
 * Evaluates circuit complexity at the MNA solver level before running a
 * simulation. Produces structured warnings with severity levels, estimated
 * resource consumption (matrix size, memory, runtime), and actionable
 * simplification suggestions.
 *
 * Unlike the simpler `complexity-check.ts` (which operates on UI-level
 * instances), this module works with solver-level circuit descriptions
 * (SolverComponent / TransientComponent shapes) and provides granular
 * metrics including matrix size estimation, memory projection, and
 * Newton-Raphson iteration cost multipliers.
 */

import type { SolverComponent, SolverInput } from './circuit-solver';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Detailed complexity metrics for a circuit. */
export interface CircuitComplexityMetrics {
  /** Number of circuit nodes (excluding ground). */
  nodeCount: number;
  /** Number of nonlinear devices (D, Q, M) requiring NR iteration. */
  nonlinearDeviceCount: number;
  /** Number of linear passive devices (R, C, L). */
  linearDeviceCount: number;
  /** Number of independent nets (approximated as nodeCount). */
  netCount: number;
  /** Number of coupled inductors (mutual inductance pairs). */
  coupledInductors: number;
  /** Number of transmission line elements. */
  transmissionLines: number;
  /** Estimated MNA matrix dimension (nodes + voltage source rows). */
  estimatedMatrixSize: number;
  /** Estimated peak memory usage in MB. */
  estimatedMemoryMB: number;
  /** Estimated runtime in milliseconds. */
  estimatedRuntimeMs: number;
}

/** Configurable thresholds for complexity warnings. */
export interface SimComplexityThresholds {
  /** Maximum node count before warning (default 50). */
  maxNodes: number;
  /** Maximum nonlinear device count before warning (default 20). */
  maxNonlinear: number;
  /**
   * Maximum transient span in seconds when timestep is small.
   * Default: 0.01 (10ms). Warning fires when span > this AND step < 1us.
   */
  maxTransientSpan: number;
  /** Maximum MNA matrix dimension before warning (default 200). */
  maxMatrixSize: number;
  /** Maximum estimated memory in MB before warning (default 100). */
  maxMemoryMB: number;
}

/** Severity level for a complexity warning. */
export type WarningLevel = 'info' | 'warning' | 'danger';

/** A single complexity warning with actionable context. */
export interface ComplexityWarning {
  /** Severity level. */
  level: WarningLevel;
  /** Which metric triggered this warning. */
  metric: string;
  /** Current value of the metric. */
  value: number;
  /** Threshold that was exceeded. */
  threshold: number;
  /** Human-readable warning message. */
  message: string;
  /** Actionable suggestion for reducing complexity. */
  suggestion: string;
}

/** Transient analysis parameters for runtime estimation. */
export interface TransientParams {
  /** Total time span in seconds. */
  timeSpan: number;
  /** Time step in seconds. */
  timeStep: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default complexity thresholds — safe for browser-based simulation. */
export const DEFAULT_THRESHOLDS: Readonly<SimComplexityThresholds> = {
  maxNodes: 50,
  maxNonlinear: 20,
  maxTransientSpan: 0.01,
  maxMatrixSize: 200,
  maxMemoryMB: 100,
};

// ---------------------------------------------------------------------------
// Constants for estimation heuristics
// ---------------------------------------------------------------------------

/** Bytes per matrix entry (float64). */
const BYTES_PER_ENTRY = 8;

/** Bytes in one megabyte. */
const BYTES_PER_MB = 1_048_576;

/**
 * Estimated overhead factor for auxiliary data structures
 * (index maps, solution vectors, result arrays, etc.).
 */
const OVERHEAD_FACTOR = 3;

/**
 * Base cost unit: nanoseconds per matrix entry for Gaussian elimination.
 * Calibrated for browser JS on a mid-range machine (~2 GHz).
 * Gaussian elimination is O(n^3/3) — we use n^2.5 as practical fit.
 */
const NS_PER_MATRIX_OP = 15;

/** Average NR iterations per timestep for nonlinear circuits. */
const AVG_NR_ITERATIONS = 8;

/** Additional NR cost multiplier per nonlinear device. */
const NR_DEVICE_COST_FACTOR = 0.3;

// ---------------------------------------------------------------------------
// Core analysis functions
// ---------------------------------------------------------------------------

/**
 * Count the different component types in a solver input.
 */
function countComponents(components: SolverComponent[]): {
  linear: number;
  nonlinear: number;
  voltageSources: number;
  inductors: number;
  coupledInductors: number;
  transmissionLines: number;
} {
  let linear = 0;
  let nonlinear = 0;
  let voltageSources = 0;
  let inductors = 0;

  for (const comp of components) {
    switch (comp.type) {
      case 'R':
      case 'C':
        linear++;
        break;
      case 'L':
        linear++;
        inductors++;
        break;
      case 'V':
      case 'VCVS':
        voltageSources++;
        break;
      case 'VCCS':
      case 'I':
        linear++;
        break;
      case 'D':
      case 'Q':
      case 'M':
        nonlinear++;
        break;
    }
  }

  return {
    linear,
    nonlinear,
    voltageSources,
    inductors,
    coupledInductors: 0, // Detected by caller if coupled inductor data is present
    transmissionLines: 0, // Detected by caller if T-line data is present
  };
}

/**
 * Estimate the MNA matrix size for a circuit.
 *
 * Matrix size = numNodes + voltage source count + inductor count
 * (inductors use a voltage-source companion model requiring an extra MNA row).
 */
function estimateMatrixSize(
  numNodes: number,
  voltageSources: number,
  inductors: number,
): number {
  return numNodes + voltageSources + inductors;
}

/**
 * Estimate peak memory usage in megabytes.
 *
 * Memory = matrixSize^2 * 8 bytes (dense matrix)
 *        + matrixSize * 8 bytes (RHS vector)
 *        + matrixSize * 8 bytes (solution vector)
 *        + overhead factor for auxiliary data
 *
 * For transient analysis, multiply by the number of stored result arrays.
 */
function estimateMemory(
  matrixSize: number,
  transientSteps: number | null,
  nodeCount: number,
  componentCount: number,
): number {
  // Dense matrix storage
  const matrixBytes = matrixSize * matrixSize * BYTES_PER_ENTRY;

  // Vectors (RHS, solution, augmented matrix row copies)
  const vectorBytes = matrixSize * BYTES_PER_ENTRY * 4;

  // Augmented matrix for Gaussian elimination: (n) x (n+1)
  const augmentedBytes = matrixSize * (matrixSize + 1) * BYTES_PER_ENTRY;

  // Base solve memory
  let totalBytes = (matrixBytes + vectorBytes + augmentedBytes) * OVERHEAD_FACTOR;

  // Result storage for transient: arrays of voltages/currents per time point
  if (transientSteps !== null && transientSteps > 0) {
    const resultArrays = nodeCount + componentCount;
    const resultBytes = resultArrays * transientSteps * BYTES_PER_ENTRY;
    totalBytes += resultBytes;
  }

  return totalBytes / BYTES_PER_MB;
}

/**
 * Estimate transient analysis runtime in milliseconds.
 *
 * Heuristic:
 *   runtime = steps * solveTime * nrMultiplier
 *
 * Where:
 *   solveTime ≈ matrixSize^2.5 * NS_PER_MATRIX_OP (practical Gaussian elimination)
 *   nrMultiplier = nonlinearCount > 0 ? AVG_NR_ITERATIONS * (1 + NR_DEVICE_COST_FACTOR * nonlinearCount) : 1
 */
export function estimateTransientRuntime(
  nodeCount: number,
  timeSpan: number,
  timeStep: number,
  nonlinearCount: number,
): number {
  if (timeStep <= 0 || timeSpan <= 0) {
    return 0;
  }

  const steps = Math.ceil(timeSpan / timeStep);

  // Approximate matrix size (nodes + some extra rows for V sources / inductors)
  // Without full component data, assume ~10% extra rows
  const matrixSize = Math.ceil(nodeCount * 1.1);

  // Per-step solve cost in nanoseconds
  const solveCostNs = Math.pow(Math.max(matrixSize, 1), 2.5) * NS_PER_MATRIX_OP;

  // NR iteration multiplier
  const nrMultiplier = nonlinearCount > 0
    ? AVG_NR_ITERATIONS * (1 + NR_DEVICE_COST_FACTOR * nonlinearCount)
    : 1;

  const totalNs = steps * solveCostNs * nrMultiplier;
  return totalNs / 1_000_000; // Convert to milliseconds
}

/**
 * Estimate DC operating point runtime in milliseconds.
 */
function estimateDCRuntime(
  matrixSize: number,
  nonlinearCount: number,
): number {
  const solveCostNs = Math.pow(Math.max(matrixSize, 1), 2.5) * NS_PER_MATRIX_OP;

  const nrMultiplier = nonlinearCount > 0
    ? AVG_NR_ITERATIONS * (1 + NR_DEVICE_COST_FACTOR * nonlinearCount)
    : 1;

  return (solveCostNs * nrMultiplier) / 1_000_000;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze the complexity of a circuit described by a SolverInput.
 *
 * @param input - The MNA solver input (numNodes + components)
 * @param transientParams - Transient parameters, if applicable
 * @param coupledInductors - Number of coupled inductor pairs (K elements)
 * @param transmissionLines - Number of transmission line elements (T elements)
 * @returns Detailed complexity metrics
 */
export function analyzeComplexity(
  input: SolverInput,
  transientParams?: TransientParams,
  coupledInductors = 0,
  transmissionLines = 0,
): CircuitComplexityMetrics {
  const { numNodes, components } = input;
  const counts = countComponents(components);

  const matrixSize = estimateMatrixSize(
    numNodes,
    counts.voltageSources,
    counts.inductors,
  );

  const totalSteps = transientParams
    ? (transientParams.timeStep > 0
      ? Math.ceil(transientParams.timeSpan / transientParams.timeStep)
      : null)
    : null;

  const memoryMB = estimateMemory(
    matrixSize,
    totalSteps,
    numNodes,
    components.length,
  );

  let runtimeMs: number;
  if (transientParams && transientParams.timeStep > 0) {
    runtimeMs = estimateTransientRuntime(
      numNodes,
      transientParams.timeSpan,
      transientParams.timeStep,
      counts.nonlinear,
    );
  } else {
    runtimeMs = estimateDCRuntime(matrixSize, counts.nonlinear);
  }

  return {
    nodeCount: numNodes,
    nonlinearDeviceCount: counts.nonlinear,
    linearDeviceCount: counts.linear,
    netCount: numNodes, // Approximation: nets ≈ nodes
    coupledInductors,
    transmissionLines,
    estimatedMatrixSize: matrixSize,
    estimatedMemoryMB: Math.round(memoryMB * 100) / 100,
    estimatedRuntimeMs: Math.round(runtimeMs * 100) / 100,
  };
}

/**
 * Check complexity metrics against thresholds and produce warnings.
 *
 * @param metrics - Complexity metrics from `analyzeComplexity`
 * @param thresholds - Custom thresholds (defaults apply for omitted fields)
 * @param transientParams - Transient parameters for span/step warnings
 * @returns Array of warnings (empty if all metrics are within thresholds)
 */
export function checkThresholds(
  metrics: CircuitComplexityMetrics,
  thresholds: Partial<SimComplexityThresholds> = {},
  transientParams?: TransientParams,
): ComplexityWarning[] {
  const t: SimComplexityThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const warnings: ComplexityWarning[] = [];

  // Node count
  if (metrics.nodeCount > t.maxNodes) {
    const ratio = metrics.nodeCount / t.maxNodes;
    warnings.push({
      level: ratio > 3 ? 'danger' : ratio > 1.5 ? 'warning' : 'info',
      metric: 'nodeCount',
      value: metrics.nodeCount,
      threshold: t.maxNodes,
      message: `Circuit has ${metrics.nodeCount} nodes (limit: ${t.maxNodes}). The MNA matrix will be large.`,
      suggestion: 'Split the circuit into smaller subcircuits or use hierarchical simulation.',
    });
  }

  // Nonlinear device count
  if (metrics.nonlinearDeviceCount > t.maxNonlinear) {
    const ratio = metrics.nonlinearDeviceCount / t.maxNonlinear;
    warnings.push({
      level: ratio > 3 ? 'danger' : ratio > 1.5 ? 'warning' : 'info',
      metric: 'nonlinearDeviceCount',
      value: metrics.nonlinearDeviceCount,
      threshold: t.maxNonlinear,
      message: `Circuit has ${metrics.nonlinearDeviceCount} nonlinear devices (limit: ${t.maxNonlinear}). Newton-Raphson convergence may be slow.`,
      suggestion: 'Replace some nonlinear models with linear approximations where precision is not critical.',
    });
  }

  // Matrix size
  if (metrics.estimatedMatrixSize > t.maxMatrixSize) {
    const ratio = metrics.estimatedMatrixSize / t.maxMatrixSize;
    warnings.push({
      level: ratio > 3 ? 'danger' : ratio > 1.5 ? 'warning' : 'info',
      metric: 'estimatedMatrixSize',
      value: metrics.estimatedMatrixSize,
      threshold: t.maxMatrixSize,
      message: `MNA matrix is ${metrics.estimatedMatrixSize}x${metrics.estimatedMatrixSize} (limit: ${t.maxMatrixSize}). Gaussian elimination will be O(n^3).`,
      suggestion: 'Reduce the number of voltage sources and inductors, or simplify the circuit topology.',
    });
  }

  // Memory
  if (metrics.estimatedMemoryMB > t.maxMemoryMB) {
    const ratio = metrics.estimatedMemoryMB / t.maxMemoryMB;
    warnings.push({
      level: ratio > 3 ? 'danger' : ratio > 1.5 ? 'warning' : 'info',
      metric: 'estimatedMemoryMB',
      value: metrics.estimatedMemoryMB,
      threshold: t.maxMemoryMB,
      message: `Estimated memory usage: ${metrics.estimatedMemoryMB.toFixed(1)} MB (limit: ${t.maxMemoryMB} MB). May cause browser tab to slow down or crash.`,
      suggestion: 'Reduce transient simulation span, increase time step, or simplify the circuit.',
    });
  }

  // Transient span with small timestep
  if (transientParams) {
    const { timeSpan, timeStep } = transientParams;
    if (timeStep > 0 && timeStep < 1e-6 && timeSpan > t.maxTransientSpan) {
      const steps = Math.ceil(timeSpan / timeStep);
      const ratio = steps / 100_000;
      warnings.push({
        level: ratio > 10 ? 'danger' : ratio > 2 ? 'warning' : 'info',
        metric: 'transientSpan',
        value: timeSpan,
        threshold: t.maxTransientSpan,
        message: `Transient span ${formatTime(timeSpan)} with step ${formatTime(timeStep)} requires ~${steps.toLocaleString()} time steps.`,
        suggestion: 'Reduce the transient time span or increase the time step size.',
      });
    }
  }

  return warnings;
}

/**
 * Generate actionable simplification suggestions based on warnings.
 *
 * @param warnings - Warnings from `checkThresholds`
 * @returns Array of unique suggestion strings
 */
export function getSimplificationSuggestions(warnings: ComplexityWarning[]): string[] {
  if (warnings.length === 0) {
    return [];
  }

  const suggestions: string[] = [];
  const seen = new Set<string>();

  // Always include warning-specific suggestions first
  for (const w of warnings) {
    if (!seen.has(w.suggestion)) {
      seen.add(w.suggestion);
      suggestions.push(w.suggestion);
    }
  }

  // Add general suggestions based on which metrics are problematic
  const hasNodeWarning = warnings.some((w) => w.metric === 'nodeCount');
  const hasNonlinearWarning = warnings.some((w) => w.metric === 'nonlinearDeviceCount');
  const hasTransientWarning = warnings.some((w) => w.metric === 'transientSpan');
  const hasMemoryWarning = warnings.some((w) => w.metric === 'estimatedMemoryMB');

  if (hasNodeWarning || hasMemoryWarning) {
    const s = 'Split circuit into subcircuits and simulate each independently.';
    if (!seen.has(s)) {
      seen.add(s);
      suggestions.push(s);
    }
  }

  if (hasNonlinearWarning) {
    const s = 'Use ideal switch models instead of transistor-level models where switching behavior is all that matters.';
    if (!seen.has(s)) {
      seen.add(s);
      suggestions.push(s);
    }
  }

  if (hasTransientWarning) {
    const s = 'Use adaptive timestep (set minStep and maxStep) to let the solver choose optimal step sizes.';
    if (!seen.has(s)) {
      seen.add(s);
      suggestions.push(s);
    }
  }

  return suggestions;
}

/**
 * Format a human-readable runtime estimate from milliseconds.
 */
export function formatRuntimeEstimate(ms: number): string {
  if (ms < 100) {
    return 'Less than a second';
  }
  if (ms < 1000) {
    return 'About a second';
  }
  if (ms < 5000) {
    return 'A few seconds';
  }
  if (ms < 30_000) {
    return `~${Math.round(ms / 1000)} seconds`;
  }
  if (ms < 120_000) {
    return `~${Math.round(ms / 1000)} seconds (${(ms / 60_000).toFixed(1)} min)`;
  }
  if (ms < 600_000) {
    return `~${(ms / 60_000).toFixed(1)} minutes`;
  }
  return `${(ms / 60_000).toFixed(0)}+ minutes — consider simplifying`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a time value in seconds to a human-readable string with SI prefix. */
function formatTime(seconds: number): string {
  if (seconds >= 1) {
    return `${seconds}s`;
  }
  if (seconds >= 1e-3) {
    return `${(seconds * 1e3).toFixed(1)}ms`;
  }
  if (seconds >= 1e-6) {
    return `${(seconds * 1e6).toFixed(1)}us`;
  }
  return `${(seconds * 1e9).toFixed(1)}ns`;
}
