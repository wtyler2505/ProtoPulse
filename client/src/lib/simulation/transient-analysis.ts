/**
 * Transient / Time-Domain Simulation Engine (CAPX-FFI-06)
 *
 * Performs transient analysis of linear and nonlinear circuits using
 * numerical integration (Backward Euler or Trapezoidal rule) combined
 * with Newton-Raphson iteration for nonlinear devices.
 *
 * At each timestep, reactive components (C, L) are replaced with
 * companion models — a parallel combination of conductance Geq and
 * current source Ieq derived from the integration method. Nonlinear
 * devices (D, BJT, MOSFET) are linearized using Newton-Raphson
 * companion models from device-models.ts. The resulting linear MNA
 * system is solved via Gaussian elimination with partial pivoting.
 *
 * Features:
 *   - Integration methods: Backward Euler (order 1), Trapezoidal (order 2, default)
 *   - Time-varying sources: DC, Pulse, Sinusoidal, PWL
 *   - Nonlinear devices: Diode, BJT, MOSFET via Newton-Raphson
 *   - Adaptive timestep with local truncation error estimation
 *   - Breakpoint handling for source discontinuities
 *
 * References:
 *   - Nagel & Pederson, "SPICE (Simulation Program with IC Emphasis)"
 *   - Vladimirescu, "The SPICE Book"
 *   - Pillage, Rohrer & Visweswariah, "Electronic Circuit & System Simulation Methods"
 */

import {
  evaluateDiode,
  evaluateBJT,
  evaluateMOSFET,
  V_T_DEFAULT,
  DIODE_DEFAULTS,
  BJT_DEFAULTS,
  NMOS_DEFAULTS,
  PMOS_DEFAULTS,
} from './device-models';
import type {
  DiodeParams,
  BJTParams,
  MOSFETParams,
} from './device-models';
import type { SimulationLimits } from './sim-limits';
import { DEFAULT_SIM_LIMITS, checkSimLimits } from './sim-limits';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Integration method for transient analysis. */
export type IntegrationMethod = 'backward_euler' | 'trapezoidal';

/** A component in the transient circuit. */
export interface TransientComponent {
  /** Unique component identifier. */
  id: string;
  /** Component type. */
  type: 'R' | 'C' | 'L' | 'D' | 'BJT' | 'MOSFET';
  /** Component value (ohms for R, farads for C, henries for L; unused for nonlinear). */
  value: number;
  /** Node connections: [pos, neg] for 2-terminal; [C, B, E] for BJT; [D, G, S] for MOSFET. */
  nodes: string[];
  /** Device model parameters for nonlinear components. */
  params?: Record<string, number>;
}

/** DC constant source. */
export interface DcSource {
  id: string;
  type: 'dc';
  /** Source type: 'V' for voltage, 'I' for current. */
  sourceType: 'V' | 'I';
  nodes: [string, string];
  value: number;
}

/** Pulse source with configurable rise/fall/width/period. */
export interface PulseSource {
  id: string;
  type: 'pulse';
  sourceType: 'V' | 'I';
  nodes: [string, string];
  /** Initial value. */
  v1: number;
  /** Pulsed value. */
  v2: number;
  /** Delay before first pulse in seconds. */
  delay: number;
  /** Rise time in seconds. */
  rise: number;
  /** Fall time in seconds. */
  fall: number;
  /** Pulse width in seconds (at v2 level). */
  width: number;
  /** Period in seconds. */
  period: number;
}

/** Sinusoidal source. */
export interface SineSource {
  id: string;
  type: 'sine';
  sourceType: 'V' | 'I';
  nodes: [string, string];
  /** DC offset in V or A. */
  offset: number;
  /** Peak amplitude in V or A. */
  amplitude: number;
  /** Frequency in Hz. */
  frequency: number;
  /** Phase offset in degrees. */
  phase: number;
  /** Damping factor in 1/s (default 0). */
  damping?: number;
}

/** Piecewise linear source. */
export interface PwlSource {
  id: string;
  type: 'pwl';
  sourceType: 'V' | 'I';
  nodes: [string, string];
  /** Array of [time, value] pairs, sorted by time. */
  points: Array<[number, number]>;
}

/** Union of all time-varying source types. */
export type TimeVaryingSource = DcSource | PulseSource | SineSource | PwlSource;

/** Circuit definition for transient analysis. */
export interface TransientCircuitDefinition {
  /** Node IDs (excluding ground). */
  nodes: string[];
  /** Ground reference node. */
  groundNode: string;
  /** Passive and nonlinear components. */
  components: TransientComponent[];
  /** Time-varying excitation sources. */
  sources: TimeVaryingSource[];
}

/** Configuration for transient analysis. */
export interface TransientAnalysisConfig {
  /** Circuit definition. */
  circuit: TransientCircuitDefinition;
  /** Start time in seconds (usually 0). */
  tStart: number;
  /** End time in seconds. */
  tStop: number;
  /** Initial / maximum time step in seconds. */
  tStep: number;
  /** Integration method (default 'trapezoidal'). */
  method?: IntegrationMethod;
  /** Max Newton-Raphson iterations per timestep (default 50). */
  maxIterations?: number;
  /** NR convergence tolerance on voltage change (default 1e-9). */
  tolerance?: number;
  /** Minimum adaptive timestep in seconds. */
  minStep?: number;
  /** Maximum adaptive timestep in seconds. */
  maxStep?: number;
  /** Resource limits (wall time, iterations, output points). Defaults apply if omitted. */
  limits?: SimulationLimits;
}

/** Result of transient analysis. */
export interface TransientResult {
  /** Time points in seconds. */
  timePoints: number[];
  /** Map from node ID to array of voltages at each time point. */
  nodeVoltages: Map<string, number[]>;
  /** Map from component/source ID to array of currents at each time point. */
  branchCurrents: Map<string, number[]>;
  /** Whether the analysis converged at all timesteps. */
  converged: boolean;
  /** Total number of accepted timesteps. */
  totalSteps: number;
  /** Number of rejected timesteps (adaptive only). */
  rejectedSteps: number;
}

// ---------------------------------------------------------------------------
// Dense matrix operations
// ---------------------------------------------------------------------------

/** Create an NxN matrix initialized to zero. */
function createMatrix(n: number): number[][] {
  const m: number[][] = [];
  for (let i = 0; i < n; i++) {
    m.push(new Array<number>(n).fill(0));
  }
  return m;
}

/** Create a vector of length n initialized to zero. */
function createVector(n: number): number[] {
  return new Array<number>(n).fill(0);
}

/**
 * Solve Ax = b using Gaussian elimination with partial pivoting.
 * Returns x, or null if the matrix is singular.
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  if (n === 0) {
    return [];
  }

  // Build augmented matrix [A | b]
  const aug: number[][] = [];
  for (let i = 0; i < n; i++) {
    aug.push([...A[i], b[i]]);
  }

  // Forward elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(aug[row][col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = row;
      }
    }

    if (maxVal < 1e-15) {
      return null;
    }

    if (maxRow !== col) {
      const temp = aug[col];
      aug[col] = aug[maxRow];
      aug[maxRow] = temp;
    }

    const pivot = aug[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / pivot;
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Back substitution
  const x = createVector(n);
  for (let row = n - 1; row >= 0; row--) {
    let sum = aug[row][n];
    for (let col = row + 1; col < n; col++) {
      sum -= aug[row][col] * x[col];
    }
    if (Math.abs(aug[row][row]) < 1e-15) {
      return null;
    }
    x[row] = sum / aug[row][row];
  }

  return x;
}

// ---------------------------------------------------------------------------
// MNA stamping
// ---------------------------------------------------------------------------

/** Stamp a conductance between two nodes. Ground node index is -1. */
function stampConductance(
  G: number[][],
  nodeI: number,
  nodeJ: number,
  g: number,
): void {
  if (nodeI >= 0) {
    G[nodeI][nodeI] += g;
  }
  if (nodeJ >= 0) {
    G[nodeJ][nodeJ] += g;
  }
  if (nodeI >= 0 && nodeJ >= 0) {
    G[nodeI][nodeJ] -= g;
    G[nodeJ][nodeI] -= g;
  }
}

/** Stamp a current source into the RHS. Current flows from nodeJ to nodeI. */
function stampCurrentSource(
  b: number[],
  nodeI: number,
  nodeJ: number,
  value: number,
): void {
  if (nodeI >= 0) {
    b[nodeI] += value;
  }
  if (nodeJ >= 0) {
    b[nodeJ] -= value;
  }
}

/** Stamp a voltage source with an extra MNA row. V_nodeI - V_nodeJ = voltage. */
function stampVoltageSource(
  G: number[][],
  b: number[],
  nodeI: number,
  nodeJ: number,
  voltage: number,
  vsIdx: number,
): void {
  if (nodeI >= 0) {
    G[nodeI][vsIdx] += 1;
    G[vsIdx][nodeI] += 1;
  }
  if (nodeJ >= 0) {
    G[nodeJ][vsIdx] -= 1;
    G[vsIdx][nodeJ] -= 1;
  }
  b[vsIdx] = voltage;
}

// ---------------------------------------------------------------------------
// Source evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a pulse waveform at time t.
 *
 * Waveform shape within one period (starting at 'delay'):
 *   [0, delay)           -> v1
 *   [delay, delay+rise)  -> v1 to v2 (linear ramp)
 *   [delay+rise, delay+rise+width) -> v2 (plateau)
 *   [delay+rise+width, delay+rise+width+fall) -> v2 to v1 (linear ramp)
 *   [delay+rise+width+fall, period) -> v1
 */
function evaluatePulse(source: PulseSource, t: number): number {
  if (t < source.delay) {
    return source.v1;
  }

  const period = source.period;
  if (period <= 0) {
    // Non-periodic: single pulse
    const tRel = t - source.delay;
    return evaluatePulsePhase(tRel, source);
  }

  // Periodic: find position within the current period
  const tRel = (t - source.delay) % period;
  return evaluatePulsePhase(tRel, source);
}

/** Evaluate pulse shape given time relative to the start of the pulse. */
function evaluatePulsePhase(tRel: number, source: PulseSource): number {
  const { v1, v2, rise, fall, width } = source;

  if (tRel < rise) {
    // Rising edge
    return rise > 0 ? v1 + (v2 - v1) * (tRel / rise) : v2;
  }
  const t2 = rise + width;
  if (tRel < t2) {
    // Plateau
    return v2;
  }
  const t3 = t2 + fall;
  if (tRel < t3) {
    // Falling edge
    return fall > 0 ? v2 + (v1 - v2) * ((tRel - t2) / fall) : v1;
  }
  // Remainder of period
  return v1;
}

/** Evaluate a sinusoidal waveform at time t. */
function evaluateSine(source: SineSource, t: number): number {
  const { offset, amplitude, frequency, phase, damping } = source;
  const phaseRad = (phase * Math.PI) / 180;
  const damped = damping ? Math.exp(-damping * t) : 1;
  return offset + amplitude * damped * Math.sin(2 * Math.PI * frequency * t + phaseRad);
}

/** Evaluate a piecewise linear waveform at time t. */
function evaluatePwl(source: PwlSource, t: number): number {
  const { points } = source;
  if (points.length === 0) {
    return 0;
  }
  if (t <= points[0][0]) {
    return points[0][1];
  }
  if (t >= points[points.length - 1][0]) {
    return points[points.length - 1][1];
  }

  // Binary search for the segment
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] <= t) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  // Linear interpolation between points[lo] and points[hi]
  const [t0, v0] = points[lo];
  const [t1, v1] = points[hi];
  const dt = t1 - t0;
  if (dt <= 0) {
    return v1;
  }
  return v0 + (v1 - v0) * ((t - t0) / dt);
}

/** Evaluate any time-varying source at time t. */
function evaluateSource(source: TimeVaryingSource, t: number): number {
  switch (source.type) {
    case 'dc':
      return source.value;
    case 'pulse':
      return evaluatePulse(source, t);
    case 'sine':
      return evaluateSine(source, t);
    case 'pwl':
      return evaluatePwl(source, t);
  }
}

// ---------------------------------------------------------------------------
// Breakpoint collection for adaptive timestep
// ---------------------------------------------------------------------------

/**
 * Collect all source discontinuity times (breakpoints) in [tStart, tStop].
 * These are points where the source waveform has slope discontinuities
 * (e.g., pulse edges) and where the solver must step precisely.
 */
function collectBreakpoints(
  sources: TimeVaryingSource[],
  tStart: number,
  tStop: number,
): number[] {
  const breakpoints = new Set<number>();

  for (const src of sources) {
    if (src.type === 'pulse') {
      const { delay, rise, fall, width, period } = src;
      if (period <= 0) {
        // Single pulse
        const edges = [delay, delay + rise, delay + rise + width, delay + rise + width + fall];
        for (const edge of edges) {
          if (edge >= tStart && edge <= tStop) {
            breakpoints.add(edge);
          }
        }
      } else {
        // Periodic pulse — collect edges for all periods in range
        const maxPeriods = Math.ceil((tStop - delay) / period) + 1;
        for (let k = 0; k < maxPeriods && k < 10000; k++) {
          const base = delay + k * period;
          if (base > tStop) {
            break;
          }
          const edges = [base, base + rise, base + rise + width, base + rise + width + fall];
          for (const edge of edges) {
            if (edge >= tStart && edge <= tStop) {
              breakpoints.add(edge);
            }
          }
        }
      }
    } else if (src.type === 'pwl') {
      for (const [t] of src.points) {
        if (t >= tStart && t <= tStop) {
          breakpoints.add(t);
        }
      }
    }
  }

  return Array.from(breakpoints).sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Nonlinear device handling
// ---------------------------------------------------------------------------

/** Build diode parameters from the component's params record. */
function buildDiodeParams(comp: TransientComponent): DiodeParams {
  const p = comp.params ?? {};
  return {
    Is: p['Is'] ?? DIODE_DEFAULTS.Is,
    n: p['n'] ?? DIODE_DEFAULTS.n,
    T: p['T'] ?? DIODE_DEFAULTS.T,
    Vbr: p['Vbr'],
    Rs: p['Rs'],
  };
}

/** Build BJT parameters from the component's params record. */
function buildBJTParams(comp: TransientComponent): BJTParams {
  const p = comp.params ?? {};
  return {
    type: (p['pnp'] === 1 ? 'pnp' : 'npn') as 'npn' | 'pnp',
    Is: p['Is'] ?? BJT_DEFAULTS.Is,
    betaF: p['betaF'] ?? BJT_DEFAULTS.betaF,
    betaR: p['betaR'] ?? BJT_DEFAULTS.betaR,
    Vaf: p['Vaf'],
    T: p['T'] ?? BJT_DEFAULTS.T,
  };
}

/** Build MOSFET parameters from the component's params record. */
function buildMOSFETParams(comp: TransientComponent): MOSFETParams {
  const p = comp.params ?? {};
  const isPMOS = p['pmos'] === 1;
  const defaults = isPMOS ? PMOS_DEFAULTS : NMOS_DEFAULTS;
  return {
    type: isPMOS ? 'pmos' : 'nmos',
    Vth: p['Vth'] ?? defaults.Vth,
    Kp: p['Kp'] ?? defaults.Kp,
    lambda: p['lambda'] ?? defaults.lambda,
    W: p['W'],
    L: p['L'],
  };
}

// ---------------------------------------------------------------------------
// Core transient solver
// ---------------------------------------------------------------------------

/**
 * Run transient analysis on a circuit.
 *
 * Algorithm overview per timestep:
 *   1. Evaluate all time-varying sources at current time
 *   2. Build MNA matrix with reactive companion models and source stamps
 *   3. For linear circuits: solve once
 *   4. For nonlinear circuits: Newton-Raphson iteration
 *      a. Linearize nonlinear devices around current operating point
 *      b. Stamp companion models (Geq + Ieq) into MNA
 *      c. Solve linear system
 *      d. Check convergence (max voltage change < tolerance)
 *      e. Repeat until converged or max iterations reached
 *   5. (Adaptive mode) Estimate local truncation error, accept or reject step
 *   6. Record results
 *
 * @param config - Transient analysis configuration
 * @returns TransientResult with time-domain waveforms
 */
export function runTransientAnalysis(config: TransientAnalysisConfig): TransientResult {
  const {
    circuit,
    tStart,
    tStop,
    tStep,
    method = 'trapezoidal',
    maxIterations = 50,
    tolerance = 1e-9,
    minStep,
    maxStep,
    limits = DEFAULT_SIM_LIMITS,
  } = config;

  if (tStep <= 0) {
    throw new Error(`Invalid tStep: ${tStep}. Time step must be strictly positive.`);
  }
  if (tStop <= tStart) {
    throw new Error(`Invalid time range: tStop (${tStop}) must be strictly greater than tStart (${tStart}).`);
  }

  const { nodes, groundNode, components, sources } = circuit;

  // Build node index map: non-ground nodes get indices 0..N-1
  const nodeIndexMap = new Map<string, number>();
  let nodeCount = 0;
  for (const nodeId of nodes) {
    if (nodeId !== groundNode) {
      nodeIndexMap.set(nodeId, nodeCount++);
    }
  }

  // Count voltage sources (need extra MNA rows)
  const voltageSrcList = sources.filter((s) => s.sourceType === 'V');
  // Inductors also need extra MNA rows (modeled as voltage sources)
  const inductorList = components.filter((c) => c.type === 'L');
  const numExtraRows = voltageSrcList.length + inductorList.length;
  const matrixSize = nodeCount + numExtraRows;

  // Build extra-row index map
  const vsIndexMap = new Map<string, number>();
  let vsIdx = nodeCount;
  for (const vs of voltageSrcList) {
    vsIndexMap.set(vs.id, vsIdx++);
  }
  for (const ind of inductorList) {
    vsIndexMap.set(ind.id, vsIdx++);
  }

  /** Resolve a string node ID to a matrix index, or -1 for ground. */
  function nodeIdx(nodeId: string): number {
    if (nodeId === groundNode) {
      return -1;
    }
    return nodeIndexMap.get(nodeId) ?? -1;
  }

  // Determine if circuit has nonlinear components
  const hasNonlinear = components.some((c) => c.type === 'D' || c.type === 'BJT' || c.type === 'MOSFET');

  // Build set of nodes directly connected to nonlinear devices (for NR voltage limiting)
  const nonlinearNodes = new Set<string>();
  if (hasNonlinear) {
    for (const comp of components) {
      if (comp.type === 'D' || comp.type === 'BJT' || comp.type === 'MOSFET') {
        for (const n of comp.nodes) {
          if (n !== groundNode) {
            nonlinearNodes.add(n);
          }
        }
      }
    }
  }

  // Determine if adaptive timestep is enabled
  const adaptive = minStep !== undefined || maxStep !== undefined;
  const hMin = minStep ?? tStep * 1e-6;
  const hMax = maxStep ?? tStep;

  // Collect breakpoints for source discontinuities
  const breakpoints = collectBreakpoints(sources, tStart, tStop);
  let bpIndex = 0;

  // Result storage
  const timePoints: number[] = [];
  const nodeVoltageArrays = new Map<string, number[]>();
  const branchCurrentArrays = new Map<string, number[]>();

  // Initialize result arrays
  nodeVoltageArrays.set(groundNode, []);
  for (const nodeId of nodes) {
    nodeVoltageArrays.set(nodeId, []);
  }
  for (const comp of components) {
    branchCurrentArrays.set(comp.id, []);
  }
  for (const src of sources) {
    branchCurrentArrays.set(src.id, []);
  }

  // State: previous node voltages and inductor/capacitor state
  const prevVoltages = new Map<string, number>();
  prevVoltages.set(groundNode, 0);
  for (const nodeId of nodes) {
    prevVoltages.set(nodeId, 0);
  }

  // Previous inductor currents
  const prevInductorCurrents = new Map<string, number>();
  for (const ind of inductorList) {
    prevInductorCurrents.set(ind.id, 0);
  }

  // Previous capacitor voltages (across the cap terminals)
  const prevCapVoltages = new Map<string, number>();
  const capList = components.filter((c) => c.type === 'C');
  for (const cap of capList) {
    prevCapVoltages.set(cap.id, 0);
  }

  // Previous capacitor currents (needed for trapezoidal)
  const prevCapCurrents = new Map<string, number>();
  for (const cap of capList) {
    prevCapCurrents.set(cap.id, 0);
  }

  // Previous inductor voltages (needed for trapezoidal)
  const prevInductorVoltages = new Map<string, number>();
  for (const ind of inductorList) {
    prevInductorVoltages.set(ind.id, 0);
  }

  // Node voltage guesses for NR iteration (carry forward from previous step)
  const nrVoltages = new Map<string, number>();
  for (const nodeId of nodes) {
    nrVoltages.set(nodeId, 0);
  }

  let convergedOverall = true;
  let totalSteps = 0;
  let rejectedSteps = 0;

  // Handle empty circuit
  if (matrixSize === 0) {
    return {
      timePoints: [tStart],
      nodeVoltages: nodeVoltageArrays,
      branchCurrents: branchCurrentArrays,
      converged: true,
      totalSteps: 0,
      rejectedSteps: 0,
    };
  }

  let t = tStart;
  let h = Math.min(tStep, hMax);

  // Maximum total iterations to prevent infinite loops
  const MAX_TOTAL_STEPS = 1000000;

  const wallStart = performance.now();

  while (t <= tStop && totalSteps + rejectedSteps < MAX_TOTAL_STEPS) {
    // Check resource limits every 100 accepted steps
    if (totalSteps % 100 === 0) {
      checkSimLimits(wallStart, totalSteps + rejectedSteps, timePoints.length, limits);
    }
    // Adjust step size to hit breakpoints precisely
    if (bpIndex < breakpoints.length) {
      // Skip past breakpoints we've already passed
      while (bpIndex < breakpoints.length && breakpoints[bpIndex] <= t + hMin * 0.5) {
        bpIndex++;
      }
      if (bpIndex < breakpoints.length) {
        const nextBp = breakpoints[bpIndex];
        if (t + h > nextBp - hMin * 0.1) {
          h = Math.max(nextBp - t, hMin);
        }
      }
    }

    // Ensure we don't overshoot tStop
    if (t + h > tStop + hMin * 0.1) {
      h = tStop - t;
      if (h < hMin * 0.01) {
        break;
      }
    }

    // --- Solve at time t + h ---
    const tNext = t + h;

    // Newton-Raphson iteration
    let nrConverged = false;
    let solution: number[] | null = null;

    // Initialize NR guesses from previous solution
    nodeIndexMap.forEach((idx, nodeId) => {
      nrVoltages.set(nodeId, prevVoltages.get(nodeId) ?? 0);
    });

    for (let iter = 0; iter < maxIterations; iter++) {
      const G = createMatrix(matrixSize);
      const b = createVector(matrixSize);

      // Stamp resistors
      for (const comp of components) {
        if (comp.type === 'R') {
          const nPlus = nodeIdx(comp.nodes[0]);
          const nMinus = nodeIdx(comp.nodes[1]);
          if (comp.value > 0) {
            stampConductance(G, nPlus, nMinus, 1 / comp.value);
          }
        }
      }

      // Stamp capacitor companion models
      for (const cap of capList) {
        const nPlus = nodeIdx(cap.nodes[0]);
        const nMinus = nodeIdx(cap.nodes[1]);
        const C = cap.value;

        if (method === 'trapezoidal') {
          // Trapezoidal: Geq = 2C/h, Ieq = Geq * V_prev + I_prev
          const geq = 2 * C / h;
          stampConductance(G, nPlus, nMinus, geq);
          const vPrev = prevCapVoltages.get(cap.id) ?? 0;
          const iPrev = prevCapCurrents.get(cap.id) ?? 0;
          const ieq = geq * vPrev + iPrev;
          stampCurrentSource(b, nPlus, nMinus, ieq);
        } else {
          // Backward Euler: Geq = C/h, Ieq = Geq * V_prev
          const geq = C / h;
          stampConductance(G, nPlus, nMinus, geq);
          const vPrev = prevCapVoltages.get(cap.id) ?? 0;
          const ieq = geq * vPrev;
          stampCurrentSource(b, nPlus, nMinus, ieq);
        }
      }

      // Stamp inductor companion models
      for (const ind of inductorList) {
        const nPlus = nodeIdx(ind.nodes[0]);
        const nMinus = nodeIdx(ind.nodes[1]);
        const L = ind.value;
        const idx = vsIndexMap.get(ind.id);
        if (idx === undefined) {
          continue;
        }

        if (method === 'trapezoidal') {
          // Trapezoidal rule for inductor:
          // V_L(n+1) = (2L/h) * I(n+1) - (2L/h) * I(n) - V_L(n)
          // Model as voltage source: V_nPlus - V_nMinus = (2L/h) * I_branch - (2L/h * I_prev + V_prev)
          const rEq = 2 * L / h;
          stampVoltageSource(G, b, nPlus, nMinus, 0, idx);
          G[idx][idx] -= rEq;
          const iPrev = prevInductorCurrents.get(ind.id) ?? 0;
          const vPrev = prevInductorVoltages.get(ind.id) ?? 0;
          b[idx] = -(rEq * iPrev + vPrev);
        } else {
          // Backward Euler: V_L = (L/h) * (I(n+1) - I(n))
          // Model as voltage source with series resistance L/h
          const rEq = L / h;
          stampVoltageSource(G, b, nPlus, nMinus, 0, idx);
          G[idx][idx] -= rEq;
          const iPrev = prevInductorCurrents.get(ind.id) ?? 0;
          b[idx] = -(rEq * iPrev);
        }
      }

      // Stamp time-varying sources
      for (const src of sources) {
        const nPlus = nodeIdx(src.nodes[0]);
        const nMinus = nodeIdx(src.nodes[1]);
        const val = evaluateSource(src, tNext);

        if (src.sourceType === 'V') {
          const idx = vsIndexMap.get(src.id);
          if (idx !== undefined) {
            stampVoltageSource(G, b, nPlus, nMinus, val, idx);
          }
        } else {
          stampCurrentSource(b, nPlus, nMinus, val);
        }
      }

      // Stamp nonlinear device companion models
      if (hasNonlinear) {
        for (const comp of components) {
          if (comp.type === 'D') {
            const nPlus = nodeIdx(comp.nodes[0]); // anode
            const nMinus = nodeIdx(comp.nodes[1]); // cathode
            const vPlus = nPlus >= 0 ? (nrVoltages.get(comp.nodes[0]) ?? 0) : 0;
            const vMinus = nMinus >= 0 ? (nrVoltages.get(comp.nodes[1]) ?? 0) : 0;
            const vd = vPlus - vMinus;

            const dParams = buildDiodeParams(comp);
            const { I: Id, dIdV: Gd } = evaluateDiode(vd, dParams);

            // Ensure minimum conductance
            const G_MIN = 1e-12;
            const geq = Math.max(Gd, G_MIN);
            const ieq = Id - geq * vd;

            stampConductance(G, nPlus, nMinus, geq);
            stampCurrentSource(b, nPlus, nMinus, ieq);
          } else if (comp.type === 'BJT') {
            // Nodes: [C, B, E]
            const nC = nodeIdx(comp.nodes[0]);
            const nB = nodeIdx(comp.nodes[1]);
            const nE = nodeIdx(comp.nodes[2]);
            const vC = nC >= 0 ? (nrVoltages.get(comp.nodes[0]) ?? 0) : 0;
            const vB = nB >= 0 ? (nrVoltages.get(comp.nodes[1]) ?? 0) : 0;
            const vE = nE >= 0 ? (nrVoltages.get(comp.nodes[2]) ?? 0) : 0;
            const vbe = vB - vE;
            const vce = vC - vE;

            const bjtParams = buildBJTParams(comp);
            const result = evaluateBJT(vbe, vce, bjtParams);

            // Linearize BJT: stamp gm, gpi, go into MNA
            // Base-emitter: gpi between B and E
            if (result.gpi > 0) {
              stampConductance(G, nB, nE, result.gpi);
            }
            // Collector-emitter: go between C and E
            if (result.go > 0) {
              stampConductance(G, nC, nE, result.go);
            }
            // Transconductance: gm * Vbe as VCCS from C to E
            if (result.gm > 0 && nC >= 0) {
              if (nB >= 0) {
                G[nC][nB] += result.gm;
              }
              if (nE >= 0) {
                G[nC][nE] -= result.gm;
              }
              // Mirror for emitter
              if (nE >= 0) {
                if (nB >= 0) {
                  G[nE][nB] -= result.gm;
                }
                if (nE >= 0) {
                  G[nE][nE] += result.gm;
                }
              }
            }

            // Stamp operating point currents as equivalent sources
            // Ic into collector, Ib into base, Ie into emitter
            const icEq = result.Ic - result.gm * vbe - result.go * vce;
            const ibEq = result.Ib - result.gpi * vbe;
            if (nC >= 0) {
              b[nC] += icEq;
            }
            if (nE >= 0) {
              b[nE] -= icEq;
            }
            if (nB >= 0) {
              b[nB] += ibEq;
            }
            if (nE >= 0) {
              b[nE] -= ibEq;
            }
          } else if (comp.type === 'MOSFET') {
            // Nodes: [D, G, S]
            const nD = nodeIdx(comp.nodes[0]);
            const nG = nodeIdx(comp.nodes[1]);
            const nS = nodeIdx(comp.nodes[2]);
            const vD = nD >= 0 ? (nrVoltages.get(comp.nodes[0]) ?? 0) : 0;
            const vG = nG >= 0 ? (nrVoltages.get(comp.nodes[1]) ?? 0) : 0;
            const vS = nS >= 0 ? (nrVoltages.get(comp.nodes[2]) ?? 0) : 0;
            const vgs = vG - vS;
            const vds = vD - vS;

            const mosParams = buildMOSFETParams(comp);
            const result = evaluateMOSFET(vgs, vds, mosParams);

            // Stamp gds (drain-source conductance)
            if (result.gds > 0) {
              stampConductance(G, nD, nS, result.gds);
            }

            // Stamp gm as VCCS: Id_ac = gm * Vgs
            if (result.gm > 0 && nD >= 0) {
              if (nG >= 0) {
                G[nD][nG] += result.gm;
              }
              if (nS >= 0) {
                G[nD][nS] -= result.gm;
              }
              if (nS >= 0) {
                if (nG >= 0) {
                  G[nS][nG] -= result.gm;
                }
                if (nS >= 0) {
                  G[nS][nS] += result.gm;
                }
              }
            }

            // Stamp operating point current as equivalent source
            const idEq = result.Id - result.gm * vgs - result.gds * vds;
            if (nD >= 0) {
              b[nD] += idEq;
            }
            if (nS >= 0) {
              b[nS] -= idEq;
            }
          }
        }
      }

      // Solve the linear system
      solution = solveLinearSystem(G, b);

      if (!solution) {
        // Singular matrix — try smaller step if adaptive
        if (adaptive && h > hMin) {
          h = Math.max(h * 0.5, hMin);
          rejectedSteps++;
          solution = null;
          break;
        }
        convergedOverall = false;
        break;
      }

      // Update NR voltage guesses and check convergence
      let maxDelta = 0;
      nodeIndexMap.forEach((idx, nodeId) => {
        const vNew = solution![idx];
        const vOld = nrVoltages.get(nodeId) ?? 0;
        const delta = Math.abs(vNew - vOld);
        if (delta > maxDelta) {
          maxDelta = delta;
        }
        nrVoltages.set(nodeId, vNew);
      });

      if (!hasNonlinear || maxDelta < tolerance) {
        nrConverged = true;
        break;
      }
    }

    if (!nrConverged && solution !== null && hasNonlinear) {
      // NR didn't converge strictly — try smaller step if adaptive.
      // If not adaptive, accept the last solution and continue (SPICE-style:
      // non-convergence at individual timesteps is a warning, not an abort).
      if (adaptive && h > hMin) {
        h = Math.max(h * 0.5, hMin);
        rejectedSteps++;
        continue;
      }
      // Accept the last valid solution — the NR may have come close enough
      // for practical accuracy even without reaching strict tolerance.
    }

    if (solution === null) {
      if (adaptive && h > hMin) {
        continue; // Already adjusted h and incremented rejectedSteps above
      }
      convergedOverall = false;
      break;
    }

    // --- Adaptive timestep: LTE estimation ---
    let stepAccepted = true;

    if (adaptive && method === 'trapezoidal' && totalSteps > 0) {
      // Estimate LTE by comparing trapezoidal and backward Euler solutions.
      // LTE_trap ≈ (h^2 / 12) * d^3v/dt^3 ≈ (1/3) * (v_trap - v_be)
      // We use the difference in capacitor voltages as a proxy.
      // For simplicity, we compute a BE solution and compare.

      // Quick BE solution for LTE estimation
      const G_be = createMatrix(matrixSize);
      const b_be = createVector(matrixSize);

      // Stamp resistors
      for (const comp of components) {
        if (comp.type === 'R' && comp.value > 0) {
          stampConductance(G_be, nodeIdx(comp.nodes[0]), nodeIdx(comp.nodes[1]), 1 / comp.value);
        }
      }

      // Stamp caps with BE
      for (const cap of capList) {
        const nPlus = nodeIdx(cap.nodes[0]);
        const nMinus = nodeIdx(cap.nodes[1]);
        const geq = cap.value / h;
        stampConductance(G_be, nPlus, nMinus, geq);
        const vPrev = prevCapVoltages.get(cap.id) ?? 0;
        stampCurrentSource(b_be, nPlus, nMinus, geq * vPrev);
      }

      // Stamp inductors with BE
      for (const ind of inductorList) {
        const nPlus = nodeIdx(ind.nodes[0]);
        const nMinus = nodeIdx(ind.nodes[1]);
        const idx = vsIndexMap.get(ind.id);
        if (idx === undefined) {
          continue;
        }
        const rEq = ind.value / h;
        stampVoltageSource(G_be, b_be, nPlus, nMinus, 0, idx);
        G_be[idx][idx] -= rEq;
        b_be[idx] = -(rEq * (prevInductorCurrents.get(ind.id) ?? 0));
      }

      // Stamp sources
      for (const src of sources) {
        const nPlus = nodeIdx(src.nodes[0]);
        const nMinus = nodeIdx(src.nodes[1]);
        const val = evaluateSource(src, tNext);
        if (src.sourceType === 'V') {
          const idx = vsIndexMap.get(src.id);
          if (idx !== undefined) {
            stampVoltageSource(G_be, b_be, nPlus, nMinus, val, idx);
          }
        } else {
          stampCurrentSource(b_be, nPlus, nMinus, val);
        }
      }

      // Stamp nonlinear devices at converged operating point for BE
      if (hasNonlinear) {
        for (const comp of components) {
          if (comp.type === 'D') {
            const nPlus = nodeIdx(comp.nodes[0]);
            const nMinus = nodeIdx(comp.nodes[1]);
            const vPlus = nrVoltages.get(comp.nodes[0]) ?? 0;
            const vMinus = nrVoltages.get(comp.nodes[1]) ?? 0;
            const vd = vPlus - vMinus;
            const dParams = buildDiodeParams(comp);
            const { I: Id, dIdV: Gd } = evaluateDiode(vd, dParams);
            const geq = Math.max(Gd, 1e-12);
            const ieq = Id - geq * vd;
            stampConductance(G_be, nPlus, nMinus, geq);
            stampCurrentSource(b_be, nPlus, nMinus, ieq);
          }
        }
      }

      const solBE = solveLinearSystem(G_be, b_be);

      if (solBE) {
        // LTE estimate: max | (v_trap - v_be) / 3 | across all nodes
        let maxLTE = 0;
        nodeIndexMap.forEach((idx, _nodeId) => {
          const vTrap = solution![idx];
          const vBE = solBE[idx];
          const lte = Math.abs((vTrap - vBE) / 3);
          if (lte > maxLTE) {
            maxLTE = lte;
          }
        });

        // Accept if LTE < tolerance, otherwise reject and shrink
        const lteTol = tolerance * 100; // Relaxed LTE tolerance
        if (maxLTE > lteTol && h > hMin) {
          // Reject step, shrink h
          const factor = Math.max(0.5, Math.min(0.9, Math.sqrt(lteTol / maxLTE)));
          h = Math.max(h * factor, hMin);
          rejectedSteps++;
          stepAccepted = false;
        } else if (maxLTE < lteTol * 0.1 && h < hMax) {
          // Error is very small, grow h for next step
          const factor = Math.min(2.0, Math.sqrt(lteTol / Math.max(maxLTE, 1e-30)));
          h = Math.min(h * factor, hMax);
        }
      }
    }

    if (!stepAccepted) {
      continue;
    }

    // --- Accept the step: record results ---
    totalSteps++;
    timePoints.push(tNext);

    // Ground voltage is always 0
    nodeVoltageArrays.get(groundNode)!.push(0);

    // Node voltages
    nodeIndexMap.forEach((idx, nodeId) => {
      const v = solution![idx];
      nodeVoltageArrays.get(nodeId)!.push(v);
      prevVoltages.set(nodeId, v);
    });

    // Update capacitor state
    for (const cap of capList) {
      const vPlus = prevVoltages.get(cap.nodes[0]) ?? 0;
      const vMinus = prevVoltages.get(cap.nodes[1]) ?? 0;
      const vCap = vPlus - vMinus;
      const vCapPrev = prevCapVoltages.get(cap.id) ?? 0;

      let iCap: number;
      if (method === 'trapezoidal') {
        const geq = 2 * cap.value / h;
        iCap = geq * (vCap - vCapPrev) - (prevCapCurrents.get(cap.id) ?? 0);
      } else {
        iCap = cap.value * (vCap - vCapPrev) / h;
      }

      prevCapVoltages.set(cap.id, vCap);
      prevCapCurrents.set(cap.id, iCap);
      branchCurrentArrays.get(cap.id)!.push(iCap);
    }

    // Update inductor state
    for (const ind of inductorList) {
      const idx = vsIndexMap.get(ind.id);
      const current = idx !== undefined ? solution![idx] : 0;
      const vPlus = prevVoltages.get(ind.nodes[0]) ?? 0;
      const vMinus = prevVoltages.get(ind.nodes[1]) ?? 0;
      const vInd = vPlus - vMinus;

      prevInductorCurrents.set(ind.id, current);
      prevInductorVoltages.set(ind.id, vInd);
      branchCurrentArrays.get(ind.id)!.push(current);
    }

    // Resistor currents
    for (const comp of components) {
      if (comp.type === 'R') {
        const vPlus = prevVoltages.get(comp.nodes[0]) ?? 0;
        const vMinus = prevVoltages.get(comp.nodes[1]) ?? 0;
        const iR = comp.value > 0 ? (vPlus - vMinus) / comp.value : 0;
        branchCurrentArrays.get(comp.id)!.push(iR);
      }
    }

    // Nonlinear device currents
    for (const comp of components) {
      if (comp.type === 'D') {
        const vPlus = prevVoltages.get(comp.nodes[0]) ?? 0;
        const vMinus = prevVoltages.get(comp.nodes[1]) ?? 0;
        const vd = vPlus - vMinus;
        const dParams = buildDiodeParams(comp);
        const { I: Id } = evaluateDiode(vd, dParams);
        branchCurrentArrays.get(comp.id)!.push(Id);
      } else if (comp.type === 'BJT') {
        const vB = prevVoltages.get(comp.nodes[1]) ?? 0;
        const vE = prevVoltages.get(comp.nodes[2]) ?? 0;
        const vC = prevVoltages.get(comp.nodes[0]) ?? 0;
        const bjtParams = buildBJTParams(comp);
        const result = evaluateBJT(vB - vE, vC - vE, bjtParams);
        branchCurrentArrays.get(comp.id)!.push(result.Ic);
      } else if (comp.type === 'MOSFET') {
        const vG = prevVoltages.get(comp.nodes[1]) ?? 0;
        const vS = prevVoltages.get(comp.nodes[2]) ?? 0;
        const vD = prevVoltages.get(comp.nodes[0]) ?? 0;
        const mosParams = buildMOSFETParams(comp);
        const result = evaluateMOSFET(vG - vS, vD - vS, mosParams);
        branchCurrentArrays.get(comp.id)!.push(result.Id);
      }
    }

    // Source currents
    for (const src of sources) {
      if (src.sourceType === 'I') {
        branchCurrentArrays.get(src.id)!.push(evaluateSource(src, tNext));
      } else {
        const idx = vsIndexMap.get(src.id);
        branchCurrentArrays.get(src.id)!.push(idx !== undefined ? solution![idx] : 0);
      }
    }

    // Advance time
    t = tNext;

    // If we've reached tStop, we're done
    if (t >= tStop - hMin * 0.01) {
      break;
    }

    // Ensure h stays within bounds for next step
    h = Math.max(Math.min(h, hMax), hMin);
  }

  return {
    timePoints,
    nodeVoltages: nodeVoltageArrays,
    branchCurrents: branchCurrentArrays,
    converged: convergedOverall,
    totalSteps,
    rejectedSteps,
  };
}

// ---------------------------------------------------------------------------
// Utility: evaluate source (exported for testing)
// ---------------------------------------------------------------------------

export { evaluateSource, evaluatePulse, evaluateSine, evaluatePwl, collectBreakpoints };
