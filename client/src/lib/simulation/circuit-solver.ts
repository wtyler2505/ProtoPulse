/**
 * Circuit Solver — Modified Nodal Analysis (Phase 13.3)
 *
 * A lightweight JavaScript circuit solver using Modified Nodal Analysis (MNA).
 * Supports:
 *   - DC operating point: resistive networks + independent sources
 *   - Basic transient: Backward Euler integration for RC/RL circuits
 *   - DC sweep: parameterize a source and sweep its value
 *
 * Limitations:
 *   - No nonlinear device models (diodes, BJTs, MOSFETs)
 *   - No convergence for nonlinear circuits
 *   - No AC small-signal analysis (use SPICE export for that)
 *   - Max ~100 nodes (practical for embedded solver)
 */

import type { SimulationLimits } from './sim-limits';
import { DEFAULT_SIM_LIMITS, checkSimLimits } from './sim-limits';
import type { DiodeParams, BJTParams, MOSFETParams } from './device-models';
import { evaluateDiode, evaluateBJT, evaluateMOSFET, DIODE_DEFAULTS, BJT_DEFAULTS, NMOS_DEFAULTS } from './device-models';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SolverComponent {
  id: string;
  type: 'R' | 'C' | 'L' | 'V' | 'I' | 'VCVS' | 'VCCS' | 'D' | 'Q' | 'M';
  value: number;
  nodes: [number, number];          // [positive, negative] for 2-terminal
  controlNodes?: [number, number];  // For controlled sources
  /** Diode parameters (type 'D'). nodes: [anode, cathode]. */
  diodeParams?: DiodeParams;
  /** BJT parameters (type 'Q'). nodes: [collector, base]. value unused. Extra node for emitter via thirdNode. */
  bjtParams?: BJTParams;
  /** MOSFET parameters (type 'M'). nodes: [drain, gate]. value unused. Extra node for source via thirdNode. */
  mosfetParams?: MOSFETParams;
  /** Third terminal node (emitter for BJT, source for MOSFET). */
  thirdNode?: number;
}

/** Newton-Raphson convergence options for nonlinear DC analysis. */
export interface NROptions {
  /** Maximum NR iterations (default 150). */
  maxIterations?: number;
  /** Voltage tolerance — convergence when max |deltaV| < VNTOL (default 1e-6 V). */
  vntol?: number;
  /** Absolute current tolerance (default 1e-12 A). */
  abstol?: number;
  /** Damping factor limit — if |dx| exceeds this, halve the step (default 5 * Vt ~ 0.13V). */
  dampLimit?: number;
}

export interface SolverInput {
  numNodes: number;           // Excluding ground (node 0)
  components: SolverComponent[];
  groundNode: number;         // Usually 0
  /** Newton-Raphson options for circuits containing nonlinear devices (D, Q, M). */
  nrOptions?: NROptions;
}

export interface DCResult {
  nodeVoltages: Record<number, number>;
  branchCurrents: Record<string, number>;  // component id → current
  converged: boolean;
  iterations: number;
}

export interface TransientResult {
  timePoints: number[];
  nodeVoltages: Record<number, number[]>;   // node → voltage at each time point
  branchCurrents: Record<string, number[]>; // component id → current at each time
  converged: boolean;
}

export interface DCSweepResult {
  sweepValues: number[];
  nodeVoltages: Record<number, number[]>;
  branchCurrents: Record<string, number[]>;
}

// ---------------------------------------------------------------------------
// Dense matrix operations (simple, no external deps)
// ---------------------------------------------------------------------------

/**
 * Create an NxN matrix initialized to zero.
 */
function createMatrix(n: number): number[][] {
  const m: number[][] = [];
  for (let i = 0; i < n; i++) {
    m.push(new Array(n).fill(0));
  }
  return m;
}

/**
 * Create a vector of length n initialized to zero.
 */
function createVector(n: number): number[] {
  return new Array(n).fill(0);
}

/**
 * Solve Ax = b using Gaussian elimination with partial pivoting.
 * Returns x, or null if the matrix is singular.
 */
export function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;

  // Augmented matrix [A | b]
  const aug: number[][] = [];
  for (let i = 0; i < n; i++) {
    aug.push([...A[i], b[i]]);
  }

  // Forward elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(aug[row][col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = row;
      }
    }

    // Check for singular matrix
    if (maxVal < 1e-15) return null;

    // Swap rows
    if (maxRow !== col) {
      const temp = aug[col];
      aug[col] = aug[maxRow];
      aug[maxRow] = temp;
    }

    // Eliminate column below pivot
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
    if (Math.abs(aug[row][row]) < 1e-15) return null;
    x[row] = sum / aug[row][row];
  }

  return x;
}

// ---------------------------------------------------------------------------
// MNA Matrix Stamping
// ---------------------------------------------------------------------------

/**
 * Stamp a resistor into the MNA matrix.
 * R between nodes i and j: G = 1/R
 *   G[i][i] += G, G[j][j] += G, G[i][j] -= G, G[j][i] -= G
 */
function stampResistor(
  G: number[][],
  _I: number[],
  nodeI: number,
  nodeJ: number,
  value: number,
): void {
  if (value === 0) return; // Short circuit
  const g = 1 / value;
  if (nodeI > 0) G[nodeI - 1][nodeI - 1] += g;
  if (nodeJ > 0) G[nodeJ - 1][nodeJ - 1] += g;
  if (nodeI > 0 && nodeJ > 0) {
    G[nodeI - 1][nodeJ - 1] -= g;
    G[nodeJ - 1][nodeI - 1] -= g;
  }
}

/**
 * Stamp a conductance (1/R) into the MNA matrix.
 */
function stampConductance(
  G: number[][],
  nodeI: number,
  nodeJ: number,
  g: number,
): void {
  if (nodeI > 0) G[nodeI - 1][nodeI - 1] += g;
  if (nodeJ > 0) G[nodeJ - 1][nodeJ - 1] += g;
  if (nodeI > 0 && nodeJ > 0) {
    G[nodeI - 1][nodeJ - 1] -= g;
    G[nodeJ - 1][nodeI - 1] -= g;
  }
}

/**
 * Stamp an independent current source into the RHS vector.
 * I from nodeJ to nodeI (conventional current enters nodeI):
 *   b[nodeI] += I, b[nodeJ] -= I
 */
function stampCurrentSource(
  _G: number[][],
  b: number[],
  nodeI: number,
  nodeJ: number,
  value: number,
): void {
  if (nodeI > 0) b[nodeI - 1] += value;
  if (nodeJ > 0) b[nodeJ - 1] -= value;
}

/**
 * Stamp an independent voltage source.
 * Adds an extra row/column for the branch current variable.
 *
 * V_nodeI - V_nodeJ = V
 *   Row vsIdx: G[vsIdx][nodeI] = 1, G[vsIdx][nodeJ] = -1, b[vsIdx] = V
 *   Col vsIdx: G[nodeI][vsIdx] = 1, G[nodeJ][vsIdx] = -1
 */
function stampVoltageSource(
  G: number[][],
  b: number[],
  nodeI: number,
  nodeJ: number,
  value: number,
  vsIdx: number,
): void {
  if (nodeI > 0) {
    G[nodeI - 1][vsIdx] += 1;
    G[vsIdx][nodeI - 1] += 1;
  }
  if (nodeJ > 0) {
    G[nodeJ - 1][vsIdx] -= 1;
    G[vsIdx][nodeJ - 1] -= 1;
  }
  b[vsIdx] = value;
}

// ---------------------------------------------------------------------------
// DC Operating Point
// ---------------------------------------------------------------------------

/**
 * Check if the circuit contains any nonlinear devices (D, Q, M).
 */
function hasNonlinearDevices(components: SolverComponent[]): boolean {
  return components.some(c => c.type === 'D' || c.type === 'Q' || c.type === 'M');
}

/**
 * Stamp linear components into the MNA matrix. Shared between linear
 * and nonlinear solve paths.
 */
function stampLinearComponents(
  G: number[][],
  b: number[],
  components: SolverComponent[],
  vsIndexMap: Map<string, number>,
): void {
  for (const comp of components) {
    const [nPlus, nMinus] = comp.nodes;

    switch (comp.type) {
      case 'R':
        stampResistor(G, b, nPlus, nMinus, comp.value);
        break;

      case 'C':
        // In DC, capacitor is open circuit — don't stamp
        break;

      case 'L':
        // In DC, inductor is short circuit — stamp as zero-resistance wire
        {
          const idx = vsIndexMap.get(comp.id);
          if (idx !== undefined) {
            stampVoltageSource(G, b, nPlus, nMinus, 0, idx);
          }
        }
        break;

      case 'V':
        {
          const idx = vsIndexMap.get(comp.id);
          if (idx !== undefined) {
            stampVoltageSource(G, b, nPlus, nMinus, comp.value, idx);
          }
        }
        break;

      case 'I':
        stampCurrentSource(G, b, nPlus, nMinus, comp.value);
        break;

      case 'VCVS':
        if (comp.controlNodes) {
          const idx = vsIndexMap.get(comp.id);
          if (idx !== undefined) {
            stampVoltageSource(G, b, nPlus, nMinus, 0, idx);
            const [cPlus, cMinus] = comp.controlNodes;
            if (cPlus > 0) { G[idx][cPlus - 1] -= comp.value; }
            if (cMinus > 0) { G[idx][cMinus - 1] += comp.value; }
          }
        }
        break;

      case 'VCCS':
        if (comp.controlNodes) {
          const [cPlus, cMinus] = comp.controlNodes;
          if (nPlus > 0 && cPlus > 0) { G[nPlus - 1][cPlus - 1] += comp.value; }
          if (nPlus > 0 && cMinus > 0) { G[nPlus - 1][cMinus - 1] -= comp.value; }
          if (nMinus > 0 && cPlus > 0) { G[nMinus - 1][cPlus - 1] -= comp.value; }
          if (nMinus > 0 && cMinus > 0) { G[nMinus - 1][cMinus - 1] += comp.value; }
        }
        break;

      // Nonlinear devices (D, Q, M) are stamped separately per NR iteration
      default:
        break;
    }
  }
}

/**
 * Stamp nonlinear device companion models into the MNA matrix for one NR iteration.
 * Each nonlinear device is linearized around its current operating point voltage(s)
 * and replaced by a parallel Geq + Ieq (conductance + current source).
 */
function stampNonlinearCompanions(
  G: number[][],
  b: number[],
  components: SolverComponent[],
  nodeVoltages: Record<number, number>,
): void {
  for (const comp of components) {
    if (comp.type === 'D') {
      // Diode: nodes = [anode, cathode]
      const [nAnode, nCathode] = comp.nodes;
      const vAnode = nodeVoltages[nAnode] ?? 0;
      const vCathode = nodeVoltages[nCathode] ?? 0;
      const Vd = vAnode - vCathode;
      const params = comp.diodeParams ?? DIODE_DEFAULTS;
      const { I, dIdV } = evaluateDiode(Vd, params);

      // Companion model: I = Geq * V + Ieq where V = Vanode - Vcathode
      const G_MIN = 1e-12;
      const Geq = Math.max(dIdV, G_MIN);
      const Ieq = I - Geq * Vd;

      // Stamp conductance Geq across anode-cathode
      stampConductance(G, nAnode, nCathode, Geq);

      // Stamp equivalent current source Ieq (from cathode to anode)
      if (nAnode > 0) { b[nAnode - 1] -= Ieq; }
      if (nCathode > 0) { b[nCathode - 1] += Ieq; }
    } else if (comp.type === 'Q') {
      // BJT: nodes = [collector, base], thirdNode = emitter
      const [nCollector, nBase] = comp.nodes;
      const nEmitter = comp.thirdNode ?? 0;
      const params = comp.bjtParams ?? BJT_DEFAULTS;

      const vBase = nodeVoltages[nBase] ?? 0;
      const vCollector = nodeVoltages[nCollector] ?? 0;
      const vEmitter = nodeVoltages[nEmitter] ?? 0;
      const Vbe = vBase - vEmitter;
      const Vce = vCollector - vEmitter;

      const result = evaluateBJT(Vbe, Vce, params);

      // Linearize Ic around (Vbe, Vce):
      //   Ic ≈ Ic0 + gm*(Vbe - Vbe0) + go*(Vce - Vce0)
      // Companion: Ic = gm*Vbe + go*Vce + Ieq_c
      //   where Ieq_c = Ic0 - gm*Vbe0 - go*Vce0
      // Similarly Ib ≈ gpi*Vbe + Ieq_b
      //   where Ieq_b = Ib0 - gpi*Vbe0

      const gm = result.gm;
      const go = result.go;
      const gpi = result.gpi;

      // Stamp gm as VCCS: Ic += gm * Vbe (controlled by base-emitter, output at collector-emitter)
      // gm stamp: G[nC][nB] += gm, G[nC][nE] -= gm, G[nE][nB] -= gm, G[nE][nE] += gm
      if (nCollector > 0 && nBase > 0) { G[nCollector - 1][nBase - 1] += gm; }
      if (nCollector > 0 && nEmitter > 0) { G[nCollector - 1][nEmitter - 1] -= gm; }
      if (nEmitter > 0 && nBase > 0) { G[nEmitter - 1][nBase - 1] -= gm; }
      if (nEmitter > 0 && nEmitter > 0) { G[nEmitter - 1][nEmitter - 1] += gm; }

      // Stamp go (output conductance) across collector-emitter
      stampConductance(G, nCollector, nEmitter, go);

      // Stamp gpi (input conductance) across base-emitter
      stampConductance(G, nBase, nEmitter, gpi);

      // Current source equivalents
      const Ieq_c = result.Ic - gm * Vbe - go * Vce;
      const Ieq_b = result.Ib - gpi * Vbe;

      // Stamp Ieq_c: current into collector, out of emitter
      if (nCollector > 0) { b[nCollector - 1] -= Ieq_c; }
      if (nEmitter > 0) { b[nEmitter - 1] += Ieq_c; }

      // Stamp Ieq_b: current into base, out of emitter
      if (nBase > 0) { b[nBase - 1] -= Ieq_b; }
      if (nEmitter > 0) { b[nEmitter - 1] += Ieq_b; }
    } else if (comp.type === 'M') {
      // MOSFET: nodes = [drain, gate], thirdNode = source
      const [nDrain, nGate] = comp.nodes;
      const nSource = comp.thirdNode ?? 0;
      const params = comp.mosfetParams ?? NMOS_DEFAULTS;

      const vGate = nodeVoltages[nGate] ?? 0;
      const vDrain = nodeVoltages[nDrain] ?? 0;
      const vSource = nodeVoltages[nSource] ?? 0;
      const Vgs = vGate - vSource;
      const Vds = vDrain - vSource;

      const result = evaluateMOSFET(Vgs, Vds, params);

      // Linearize Id around (Vgs, Vds):
      //   Id ≈ Id0 + gm*(Vgs - Vgs0) + gds*(Vds - Vds0)
      // Companion: Id = gm*Vgs + gds*Vds + Ieq
      //   where Ieq = Id0 - gm*Vgs0 - gds*Vds0

      const { gm: gmM, gds } = result;

      // Stamp gm as VCCS: Id += gm * Vgs (gate-source controls drain-source)
      if (nDrain > 0 && nGate > 0) { G[nDrain - 1][nGate - 1] += gmM; }
      if (nDrain > 0 && nSource > 0) { G[nDrain - 1][nSource - 1] -= gmM; }
      if (nSource > 0 && nGate > 0) { G[nSource - 1][nGate - 1] -= gmM; }
      if (nSource > 0 && nSource > 0) { G[nSource - 1][nSource - 1] += gmM; }

      // Stamp gds across drain-source
      stampConductance(G, nDrain, nSource, gds);

      // Current source equivalent
      const Ieq = result.Id - gmM * Vgs - gds * Vds;

      // Stamp Ieq: current into drain, out of source
      if (nDrain > 0) { b[nDrain - 1] -= Ieq; }
      if (nSource > 0) { b[nSource - 1] += Ieq; }
    }
  }
}

/**
 * Extract node voltages and branch currents from a solved MNA solution vector.
 */
function extractResults(
  solution: number[],
  numNodes: number,
  components: SolverComponent[],
  vsIndexMap: Map<string, number>,
): { nodeVoltages: Record<number, number>; branchCurrents: Record<string, number> } {
  const nodeVoltages: Record<number, number> = { 0: 0 };
  for (let i = 0; i < numNodes; i++) {
    nodeVoltages[i + 1] = solution[i];
  }

  const branchCurrents: Record<string, number> = {};

  // Voltage source currents from solution vector
  vsIndexMap.forEach((idx, id) => {
    branchCurrents[id] = solution[idx];
  });

  // Resistor currents from V=IR
  for (const comp of components) {
    if (comp.type === 'R' && comp.value > 0) {
      const v1 = nodeVoltages[comp.nodes[0]] ?? 0;
      const v2 = nodeVoltages[comp.nodes[1]] ?? 0;
      branchCurrents[comp.id] = (v1 - v2) / comp.value;
    }
  }

  // Current source currents are their values
  for (const comp of components) {
    if (comp.type === 'I') {
      branchCurrents[comp.id] = comp.value;
    }
  }

  // Diode currents from the device model
  for (const comp of components) {
    if (comp.type === 'D') {
      const vAnode = nodeVoltages[comp.nodes[0]] ?? 0;
      const vCathode = nodeVoltages[comp.nodes[1]] ?? 0;
      const Vd = vAnode - vCathode;
      const params = comp.diodeParams ?? DIODE_DEFAULTS;
      branchCurrents[comp.id] = evaluateDiode(Vd, params).I;
    }
  }

  // BJT currents
  for (const comp of components) {
    if (comp.type === 'Q') {
      const params = comp.bjtParams ?? BJT_DEFAULTS;
      const vBase = nodeVoltages[comp.nodes[1]] ?? 0;
      const vCollector = nodeVoltages[comp.nodes[0]] ?? 0;
      const vEmitter = nodeVoltages[comp.thirdNode ?? 0] ?? 0;
      const result = evaluateBJT(vBase - vEmitter, vCollector - vEmitter, params);
      branchCurrents[`${comp.id}_Ic`] = result.Ic;
      branchCurrents[`${comp.id}_Ib`] = result.Ib;
      branchCurrents[`${comp.id}_Ie`] = result.Ie;
    }
  }

  // MOSFET currents
  for (const comp of components) {
    if (comp.type === 'M') {
      const params = comp.mosfetParams ?? NMOS_DEFAULTS;
      const vGate = nodeVoltages[comp.nodes[1]] ?? 0;
      const vDrain = nodeVoltages[comp.nodes[0]] ?? 0;
      const vSource = nodeVoltages[comp.thirdNode ?? 0] ?? 0;
      branchCurrents[comp.id] = evaluateMOSFET(vGate - vSource, vDrain - vSource, params).Id;
    }
  }

  return { nodeVoltages, branchCurrents };
}

/**
 * Solve for DC operating point.
 *
 * For purely linear circuits (R, V, I, C, L, VCVS, VCCS): single MNA solve.
 * For circuits with nonlinear devices (D, Q, M): Newton-Raphson iteration
 * using companion model linearization until convergence.
 *
 * NR convergence criteria:
 *   - |deltaV| < VNTOL for all node voltages
 *   - Max iterations exceeded → converged: false
 *   - Damped Newton step when |deltaV| exceeds dampLimit (halves the step)
 */
export function solveDCOperatingPoint(input: SolverInput): DCResult {
  const { numNodes, components } = input;

  // Count voltage sources to determine matrix size
  const voltageSources = components.filter(c => c.type === 'V');
  const matrixSize = numNodes + voltageSources.length;

  if (matrixSize === 0) {
    return { nodeVoltages: {}, branchCurrents: {}, converged: true, iterations: 0 };
  }

  // Assign voltage source indices
  const vsIndexMap = new Map<string, number>();
  let vsIdx = numNodes;
  for (const vs of voltageSources) {
    vsIndexMap.set(vs.id, vsIdx++);
  }

  // Fast path for purely linear circuits — single solve, no NR iteration needed.
  if (!hasNonlinearDevices(components)) {
    const G = createMatrix(matrixSize);
    const b = createVector(matrixSize);
    stampLinearComponents(G, b, components, vsIndexMap);

    const solution = solveLinearSystem(G, b);
    if (!solution) {
      return { nodeVoltages: {}, branchCurrents: {}, converged: false, iterations: 1 };
    }

    const { nodeVoltages, branchCurrents } = extractResults(solution, numNodes, components, vsIndexMap);
    return { nodeVoltages, branchCurrents, converged: true, iterations: 1 };
  }

  // ---------------------------------------------------------------------------
  // Newton-Raphson iteration for nonlinear circuits
  // ---------------------------------------------------------------------------
  const opts = input.nrOptions ?? {};
  const maxIter = opts.maxIterations ?? 150;
  const VNTOL = opts.vntol ?? 1e-6;
  const ABSTOL = opts.abstol ?? 1e-12;
  const VT_ROOM = 0.02585; // ~26mV at 300K
  const dampLimit = opts.dampLimit ?? 5 * VT_ROOM; // ~130mV

  // Initial guess: all nodes at 0V
  let nodeVoltages: Record<number, number> = { 0: 0 };
  for (let i = 1; i <= numNodes; i++) {
    nodeVoltages[i] = 0;
  }

  // Heuristic initial guess: set nodes connected to voltage sources
  for (const comp of components) {
    if (comp.type === 'V') {
      const [nPlus, nMinus] = comp.nodes;
      if (nPlus > 0) { nodeVoltages[nPlus] = comp.value + (nodeVoltages[nMinus] ?? 0); }
    }
  }

  let prevSolution: number[] | null = null;

  for (let iter = 0; iter < maxIter; iter++) {
    // Build MNA matrix from scratch each iteration (nonlinear stamps change)
    const G = createMatrix(matrixSize);
    const b = createVector(matrixSize);

    // Stamp linear components (constant across iterations)
    stampLinearComponents(G, b, components, vsIndexMap);

    // Stamp nonlinear companion models based on current node voltages
    stampNonlinearCompanions(G, b, components, nodeVoltages);

    // Solve the linearized system
    const solution = solveLinearSystem(G, b);
    if (!solution) {
      return { nodeVoltages, branchCurrents: {}, converged: false, iterations: iter + 1 };
    }

    // Check convergence: max |deltaV| across all node voltages
    let maxDelta = 0;
    const newVoltages: Record<number, number> = { 0: 0 };

    for (let i = 0; i < numNodes; i++) {
      let newV = solution[i];
      const oldV = nodeVoltages[i + 1] ?? 0;
      let delta = newV - oldV;

      // Damped Newton step: if delta exceeds limit, halve repeatedly
      if (Math.abs(delta) > dampLimit) {
        // Apply damping: keep halving until within limit or min 1/16 of original
        let dampFactor = 1.0;
        while (Math.abs(delta * dampFactor) > dampLimit && dampFactor > 0.0625) {
          dampFactor *= 0.5;
        }
        newV = oldV + delta * dampFactor;
        delta = newV - oldV;
      }

      newVoltages[i + 1] = newV;
      maxDelta = Math.max(maxDelta, Math.abs(delta));
    }

    nodeVoltages = newVoltages;
    prevSolution = solution;

    // Convergence check: all node voltage changes below VNTOL
    if (maxDelta < VNTOL) {
      // Also check that we're past at least 1 iteration (to avoid false convergence from initial guess)
      if (iter > 0 || maxDelta < ABSTOL) {
        const { nodeVoltages: finalV, branchCurrents } = extractResults(
          // Re-extract using converged node voltages (solution may be damped)
          (() => {
            // Rebuild solution vector from nodeVoltages for accurate extraction
            const sol = createVector(matrixSize);
            for (let i = 0; i < numNodes; i++) {
              sol[i] = nodeVoltages[i + 1] ?? 0;
            }
            // Copy voltage source branch currents from last solution
            for (let i = numNodes; i < matrixSize; i++) {
              sol[i] = solution[i];
            }
            return sol;
          })(),
          numNodes,
          components,
          vsIndexMap,
        );
        return { nodeVoltages: finalV, branchCurrents, converged: true, iterations: iter + 1 };
      }
    }
  }

  // Did not converge — return best result so far
  const finalSol = prevSolution ?? createVector(matrixSize);
  // Update finalSol with damped voltages
  for (let i = 0; i < numNodes; i++) {
    finalSol[i] = nodeVoltages[i + 1] ?? 0;
  }
  const { nodeVoltages: finalV, branchCurrents } = extractResults(finalSol, numNodes, components, vsIndexMap);
  return { nodeVoltages: finalV, branchCurrents, converged: false, iterations: maxIter };
}

// ---------------------------------------------------------------------------
// Transient Analysis — Backward Euler
// ---------------------------------------------------------------------------

/**
 * Run transient analysis using Backward Euler integration.
 *
 * In Backward Euler, at time step n+1:
 *   C: I = C * (V(n+1) - V(n)) / h  → companion model: G_eq = C/h, I_eq = C*V(n)/h
 *   L: V = L * (I(n+1) - I(n)) / h  → companion model: R_eq = L/h, V_eq = L*I(n)/h
 */
export function solveTransient(
  input: SolverInput,
  startTime: number,
  stopTime: number,
  timeStep: number,
  maxPoints: number = 10000,
  limits: SimulationLimits = DEFAULT_SIM_LIMITS,
): TransientResult {
  const { numNodes, components } = input;

  // Clamp time step to avoid excessive points
  const numSteps = Math.min(
    Math.ceil((stopTime - startTime) / timeStep),
    maxPoints,
  );
  const h = (stopTime - startTime) / numSteps;

  // Separate component types
  const resistors = components.filter(c => c.type === 'R');
  const capacitors = components.filter(c => c.type === 'C');
  const inductors = components.filter(c => c.type === 'L');
  const voltageSources = components.filter(c => c.type === 'V');
  const currentSources = components.filter(c => c.type === 'I');

  // Matrix size: numNodes + voltage sources + inductors (inductor companion is a V source)
  const numVS = voltageSources.length + inductors.length;
  const matrixSize = numNodes + numVS;

  if (matrixSize === 0) {
    return { timePoints: [], nodeVoltages: {}, branchCurrents: {}, converged: true };
  }

  // Voltage source index map
  const vsIndexMap = new Map<string, number>();
  let vsIdx = numNodes;
  for (const vs of voltageSources) {
    vsIndexMap.set(vs.id, vsIdx++);
  }
  for (const ind of inductors) {
    vsIndexMap.set(ind.id, vsIdx++);
  }

  // Result arrays
  const timePoints: number[] = [];
  const nodeVoltageArrays: Record<number, number[]> = {};
  const branchCurrentArrays: Record<string, number[]> = {};

  for (let i = 0; i <= numNodes; i++) {
    nodeVoltageArrays[i] = [];
  }
  for (const comp of components) {
    branchCurrentArrays[comp.id] = [];
  }

  // Previous state
  let prevNodeVoltages: Record<number, number> = {};
  for (let i = 0; i <= numNodes; i++) {
    prevNodeVoltages[i] = 0;
  }
  let prevInductorCurrents: Record<string, number> = {};
  for (const ind of inductors) {
    prevInductorCurrents[ind.id] = 0;
  }

  // Time stepping
  const wallStart = performance.now();
  for (let step = 0; step <= numSteps; step++) {
    // Check resource limits every 100 steps to avoid excessive perf.now() calls
    if (step % 100 === 0) {
      checkSimLimits(wallStart, step, timePoints.length, limits);
    }

    const t = startTime + step * h;
    timePoints.push(t);

    const G = createMatrix(matrixSize);
    const b = createVector(matrixSize);

    // Stamp resistors
    for (const r of resistors) {
      stampResistor(G, b, r.nodes[0], r.nodes[1], r.value);
    }

    // Stamp capacitor companion models (Backward Euler: G_eq = C/h)
    for (const cap of capacitors) {
      const gEq = cap.value / h;
      stampConductance(G, cap.nodes[0], cap.nodes[1], gEq);

      // Equivalent current source: I_eq = G_eq * V_prev
      const vPrev = (prevNodeVoltages[cap.nodes[0]] ?? 0) - (prevNodeVoltages[cap.nodes[1]] ?? 0);
      const iEq = gEq * vPrev;
      if (cap.nodes[0] > 0) b[cap.nodes[0] - 1] += iEq;
      if (cap.nodes[1] > 0) b[cap.nodes[1] - 1] -= iEq;
    }

    // Stamp inductor companion models (Backward Euler: R_eq = L/h, V_eq = R_eq * I_prev)
    for (const ind of inductors) {
      const idx = vsIndexMap.get(ind.id);
      if (idx === undefined) continue;

      const rEq = ind.value / h;
      // Inductor as voltage source: V_L = R_eq * I_branch - R_eq * I_prev
      // Stamp as V source with series resistance
      stampVoltageSource(G, b, ind.nodes[0], ind.nodes[1], 0, idx);
      G[idx][idx] -= rEq;
      b[idx] = -(rEq * (prevInductorCurrents[ind.id] ?? 0));
    }

    // Stamp voltage sources
    for (const vs of voltageSources) {
      const idx = vsIndexMap.get(vs.id);
      if (idx !== undefined) {
        stampVoltageSource(G, b, vs.nodes[0], vs.nodes[1], vs.value, idx);
      }
    }

    // Stamp current sources
    for (const cs of currentSources) {
      stampCurrentSource(G, b, cs.nodes[0], cs.nodes[1], cs.value);
    }

    // Solve
    const solution = solveLinearSystem(G, b);

    if (!solution) {
      // Failed to converge at this step — fill remaining with zeros
      for (let remaining = step; remaining <= numSteps; remaining++) {
        if (remaining > step) timePoints.push(startTime + remaining * h);
        for (let i = 0; i <= numNodes; i++) {
          nodeVoltageArrays[i].push(0);
        }
        for (const comp of components) {
          branchCurrentArrays[comp.id].push(0);
        }
      }
      return { timePoints, nodeVoltages: nodeVoltageArrays, branchCurrents: branchCurrentArrays, converged: false };
    }

    // Extract node voltages
    nodeVoltageArrays[0].push(0);
    for (let i = 0; i < numNodes; i++) {
      const v = solution[i];
      nodeVoltageArrays[i + 1].push(v);
      prevNodeVoltages[i + 1] = v;
    }

    // Extract branch currents
    for (const vs of voltageSources) {
      const idx = vsIndexMap.get(vs.id);
      branchCurrentArrays[vs.id].push(idx !== undefined ? solution[idx] : 0);
    }
    for (const ind of inductors) {
      const idx = vsIndexMap.get(ind.id);
      const current = idx !== undefined ? solution[idx] : 0;
      branchCurrentArrays[ind.id].push(current);
      prevInductorCurrents[ind.id] = current;
    }
    for (const r of resistors) {
      const v1 = prevNodeVoltages[r.nodes[0]] ?? 0;
      const v2 = prevNodeVoltages[r.nodes[1]] ?? 0;
      branchCurrentArrays[r.id].push(r.value > 0 ? (v1 - v2) / r.value : 0);
    }
    for (const cap of capacitors) {
      const vNow = (prevNodeVoltages[cap.nodes[0]] ?? 0) - (prevNodeVoltages[cap.nodes[1]] ?? 0);
      const vPrev = step > 0
        ? (nodeVoltageArrays[cap.nodes[0]][step - 1] ?? 0) - (nodeVoltageArrays[cap.nodes[1]][step - 1] ?? 0)
        : 0;
      branchCurrentArrays[cap.id].push(cap.value * (vNow - vPrev) / h);
    }
    for (const cs of currentSources) {
      branchCurrentArrays[cs.id].push(cs.value);
    }
  }

  return { timePoints, nodeVoltages: nodeVoltageArrays, branchCurrents: branchCurrentArrays, converged: true };
}

// ---------------------------------------------------------------------------
// DC Sweep
// ---------------------------------------------------------------------------

/**
 * Run DC sweep: vary one source value and solve DC operating point at each step.
 */
export function solveDCSweep(
  input: SolverInput,
  sourceId: string,
  startValue: number,
  stopValue: number,
  stepValue: number,
  maxPoints: number = 10000,
  limits: SimulationLimits = DEFAULT_SIM_LIMITS,
): DCSweepResult {
  const numSteps = Math.min(
    Math.ceil(Math.abs(stopValue - startValue) / Math.abs(stepValue)) + 1,
    maxPoints,
  );
  const actualStep = (stopValue - startValue) / (numSteps - 1 || 1);

  const sweepValues: number[] = [];
  const nodeVoltageArrays: Record<number, number[]> = {};
  const branchCurrentArrays: Record<string, number[]> = {};

  for (let i = 0; i <= input.numNodes; i++) {
    nodeVoltageArrays[i] = [];
  }
  for (const comp of input.components) {
    branchCurrentArrays[comp.id] = [];
  }

  const wallStart = performance.now();
  for (let i = 0; i < numSteps; i++) {
    // Check resource limits every 100 sweep points
    if (i % 100 === 0) {
      checkSimLimits(wallStart, i, sweepValues.length, limits);
    }

    const sweepVal = startValue + i * actualStep;
    sweepValues.push(sweepVal);

    // Clone components and update the swept source
    const modifiedComponents = input.components.map(c => {
      if (c.id === sourceId) {
        return { ...c, value: sweepVal };
      }
      return c;
    });

    const result = solveDCOperatingPoint({
      ...input,
      components: modifiedComponents,
    });

    for (let node = 0; node <= input.numNodes; node++) {
      nodeVoltageArrays[node].push(result.nodeVoltages[node] ?? 0);
    }
    for (const comp of input.components) {
      branchCurrentArrays[comp.id].push(result.branchCurrents[comp.id] ?? 0);
    }
  }

  return { sweepValues, nodeVoltages: nodeVoltageArrays, branchCurrents: branchCurrentArrays };
}

// ---------------------------------------------------------------------------
// Convenience: Build SolverInput from SPICE-like component list
// ---------------------------------------------------------------------------

export interface SimplifiedComponent {
  id: string;
  type: 'R' | 'C' | 'L' | 'V' | 'I' | 'D' | 'Q' | 'M';
  value: number;
  nodePlus: number;
  nodeMinus: number;
  /** Third terminal node (emitter for BJT, source for MOSFET). */
  thirdNode?: number;
  /** Diode parameters (type 'D'). */
  diodeParams?: DiodeParams;
  /** BJT parameters (type 'Q'). */
  bjtParams?: BJTParams;
  /** MOSFET parameters (type 'M'). */
  mosfetParams?: MOSFETParams;
}

/**
 * Create a SolverInput from a simplified component list.
 * Automatically determines the number of nodes.
 */
export function buildSolverInput(components: SimplifiedComponent[]): SolverInput {
  let maxNode = 0;
  const solverComponents: SolverComponent[] = [];

  for (const c of components) {
    maxNode = Math.max(maxNode, c.nodePlus, c.nodeMinus);
    if (c.thirdNode !== undefined) {
      maxNode = Math.max(maxNode, c.thirdNode);
    }
    solverComponents.push({
      id: c.id,
      type: c.type,
      value: c.value,
      nodes: [c.nodePlus, c.nodeMinus],
      thirdNode: c.thirdNode,
      diodeParams: c.diodeParams,
      bjtParams: c.bjtParams,
      mosfetParams: c.mosfetParams,
    });
  }

  return {
    numNodes: maxNode,
    components: solverComponents,
    groundNode: 0,
  };
}

// ---------------------------------------------------------------------------
// Power consumption calculation
// ---------------------------------------------------------------------------

export interface PowerResult {
  totalPower: number;
  perComponent: Record<string, { power: number; voltage: number; current: number }>;
}

/**
 * Calculate power consumption from DC operating point results.
 */
export function calculatePower(
  components: SolverComponent[],
  dcResult: DCResult,
): PowerResult {
  const perComponent: Record<string, { power: number; voltage: number; current: number }> = {};
  let totalPower = 0;

  for (const comp of components) {
    const v1 = dcResult.nodeVoltages[comp.nodes[0]] ?? 0;
    const v2 = dcResult.nodeVoltages[comp.nodes[1]] ?? 0;
    const voltage = v1 - v2;
    const current = dcResult.branchCurrents[comp.id] ?? 0;
    const power = Math.abs(voltage * current);

    perComponent[comp.id] = { power, voltage, current };

    // Only count sources as power delivery/consumption
    if (comp.type === 'V' || comp.type === 'I') {
      totalPower += power;
    }
  }

  return { totalPower, perComponent };
}
