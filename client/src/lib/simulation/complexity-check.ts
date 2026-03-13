/**
 * Simulation Complexity Checker (BL-0514)
 *
 * Evaluates circuit complexity before running a simulation and produces
 * a warning when the circuit is large enough that the simulation may be
 * slow or resource-intensive.
 *
 * Thresholds (configurable):
 *   - >50 nodes
 *   - >20 nonlinear devices (diodes, BJTs, MOSFETs)
 *   - Transient: span > 10ms at timestep < 0.1ms (>100K steps)
 */

export interface ComplexityMetrics {
  /** Total number of unique circuit nodes. */
  nodeCount: number;
  /** Number of components in the circuit. */
  componentCount: number;
  /** Number of nonlinear devices (D, Q, M). */
  nonlinearDeviceCount: number;
  /** Estimated number of time steps (transient only). */
  estimatedTimeSteps: number | null;
  /** Estimated runtime description. */
  estimatedRuntime: string;
}

export interface ComplexityWarning {
  /** Whether a warning should be shown. */
  shouldWarn: boolean;
  /** The complexity metrics. */
  metrics: ComplexityMetrics;
  /** Warning messages (empty if shouldWarn is false). */
  warnings: string[];
}

/** Minimal circuit instance shape for complexity analysis. */
export interface CircuitInstanceForComplexity {
  referenceDesignator: string;
  componentType: string;
  properties?: Record<string, unknown> | null;
  /** Pin/node connections (array of node IDs). */
  pins?: string[];
}

/** Transient analysis parameters for complexity estimation. */
export interface TransientComplexityParams {
  /** Simulation span in seconds. */
  spanSeconds: number;
  /** Time step in seconds (0 = auto). */
  timeStepSeconds: number;
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

const NODE_THRESHOLD = 50;
const NONLINEAR_THRESHOLD = 20;
const TRANSIENT_STEP_THRESHOLD = 100_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getComponentType(inst: CircuitInstanceForComplexity): string {
  const fromProps =
    inst.properties && typeof inst.properties === 'object'
      ? String((inst.properties as Record<string, unknown>).componentType ?? '')
      : '';
  return inst.componentType || fromProps;
}

function isNonlinear(inst: CircuitInstanceForComplexity): boolean {
  const refDes = inst.referenceDesignator.toUpperCase();
  const compType = getComponentType(inst).toLowerCase();

  // SPICE convention: D = diode, Q = BJT, M = MOSFET, J = JFET
  if (/^[DQMJ]/.test(refDes)) {
    return true;
  }

  return /diode|bjt|transistor|mosfet|jfet|igbt|scr|triac|thyristor|op.?amp/i.test(compType);
}

function estimateNodeCount(instances: CircuitInstanceForComplexity[]): number {
  const nodeSet = new Set<string>();

  for (const inst of instances) {
    if (inst.pins) {
      for (const pin of inst.pins) {
        nodeSet.add(pin);
      }
    }
  }

  // If no pin info available, estimate ~2 nodes per 2-terminal component, ~3 for 3-terminal
  if (nodeSet.size === 0) {
    if (instances.length === 0) {
      return 0;
    }
    let estimate = 0;
    for (const inst of instances) {
      if (isNonlinear(inst)) {
        estimate += 3; // 3-terminal devices
      } else {
        estimate += 2; // 2-terminal devices
      }
    }
    // Rough estimate: unique nodes ≈ total pins / 2 (shared connections)
    return Math.max(1, Math.ceil(estimate / 2));
  }

  return nodeSet.size;
}

function estimateRuntime(metrics: ComplexityMetrics): string {
  // Very rough heuristic
  const baseCost = metrics.nodeCount * metrics.nodeCount; // MNA is O(n^2) to O(n^3)
  const nlMultiplier = metrics.nonlinearDeviceCount > 0
    ? 1 + metrics.nonlinearDeviceCount * 0.5 // NR iterations add cost
    : 1;

  const steps = metrics.estimatedTimeSteps ?? 1;
  const totalOps = baseCost * nlMultiplier * steps;

  if (totalOps < 1_000_000) {
    return 'Less than a second';
  }
  if (totalOps < 10_000_000) {
    return 'A few seconds';
  }
  if (totalOps < 100_000_000) {
    return '10-30 seconds';
  }
  if (totalOps < 1_000_000_000) {
    return '30 seconds to a few minutes';
  }
  return 'Several minutes or more';
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Analyze circuit complexity and determine if a warning should be shown.
 *
 * @param instances - Circuit component instances
 * @param transientParams - Transient parameters (null if not running transient)
 */
export function checkCircuitComplexity(
  instances: CircuitInstanceForComplexity[],
  transientParams: TransientComplexityParams | null = null,
): ComplexityWarning {
  const nodeCount = estimateNodeCount(instances);
  const componentCount = instances.length;
  const nonlinearDeviceCount = instances.filter(isNonlinear).length;

  let estimatedTimeSteps: number | null = null;
  if (transientParams) {
    const { spanSeconds, timeStepSeconds } = transientParams;
    if (timeStepSeconds > 0) {
      estimatedTimeSteps = Math.ceil(spanSeconds / timeStepSeconds);
    } else {
      // Auto time step: estimate based on circuit — typical default is span/1000
      estimatedTimeSteps = 1000;
    }
  }

  const metrics: ComplexityMetrics = {
    nodeCount,
    componentCount,
    nonlinearDeviceCount,
    estimatedTimeSteps,
    estimatedRuntime: '', // filled below
  };

  metrics.estimatedRuntime = estimateRuntime(metrics);

  const warnings: string[] = [];

  if (nodeCount > NODE_THRESHOLD) {
    warnings.push(
      `Circuit has ${nodeCount} nodes (threshold: ${NODE_THRESHOLD}). ` +
      'The MNA matrix solve may be slow.',
    );
  }

  if (nonlinearDeviceCount > NONLINEAR_THRESHOLD) {
    warnings.push(
      `Circuit has ${nonlinearDeviceCount} nonlinear devices (threshold: ${NONLINEAR_THRESHOLD}). ` +
      'Newton-Raphson convergence may require many iterations.',
    );
  }

  if (estimatedTimeSteps !== null && estimatedTimeSteps > TRANSIENT_STEP_THRESHOLD) {
    warnings.push(
      `Transient analysis will compute ~${estimatedTimeSteps.toLocaleString()} time steps ` +
      `(threshold: ${TRANSIENT_STEP_THRESHOLD.toLocaleString()}). Consider increasing the time step or reducing the span.`,
    );
  }

  return {
    shouldWarn: warnings.length > 0,
    metrics,
    warnings,
  };
}
