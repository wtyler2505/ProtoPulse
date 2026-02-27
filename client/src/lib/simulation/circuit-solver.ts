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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SolverComponent {
  id: string;
  type: 'R' | 'C' | 'L' | 'V' | 'I' | 'VCVS' | 'VCCS';
  value: number;
  nodes: [number, number];          // [positive, negative] for 2-terminal
  controlNodes?: [number, number];  // For controlled sources
}

export interface SolverInput {
  numNodes: number;           // Excluding ground (node 0)
  components: SolverComponent[];
  groundNode: number;         // Usually 0
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
 * Solve for DC operating point.
 */
export function solveDCOperatingPoint(input: SolverInput): DCResult {
  const { numNodes, components } = input;

  // Count voltage sources to determine matrix size
  const voltageSources = components.filter(c => c.type === 'V');
  const matrixSize = numNodes + voltageSources.length;

  if (matrixSize === 0) {
    return { nodeVoltages: {}, branchCurrents: {}, converged: true, iterations: 0 };
  }

  const G = createMatrix(matrixSize);
  const b = createVector(matrixSize);

  // Assign voltage source indices
  const vsIndexMap = new Map<string, number>();
  let vsIdx = numNodes;
  for (const vs of voltageSources) {
    vsIndexMap.set(vs.id, vsIdx++);
  }

  // Stamp all components
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
        // Use voltage source with V=0
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
        // Voltage-Controlled Voltage Source: V_out = gain * V_control
        if (comp.controlNodes) {
          const idx = vsIndexMap.get(comp.id);
          if (idx !== undefined) {
            stampVoltageSource(G, b, nPlus, nMinus, 0, idx);
            const [cPlus, cMinus] = comp.controlNodes;
            if (cPlus > 0) G[idx][cPlus - 1] -= comp.value;
            if (cMinus > 0) G[idx][cMinus - 1] += comp.value;
          }
        }
        break;

      case 'VCCS':
        // Voltage-Controlled Current Source: I_out = gm * V_control
        if (comp.controlNodes) {
          const [cPlus, cMinus] = comp.controlNodes;
          if (nPlus > 0 && cPlus > 0) G[nPlus - 1][cPlus - 1] += comp.value;
          if (nPlus > 0 && cMinus > 0) G[nPlus - 1][cMinus - 1] -= comp.value;
          if (nMinus > 0 && cPlus > 0) G[nMinus - 1][cPlus - 1] -= comp.value;
          if (nMinus > 0 && cMinus > 0) G[nMinus - 1][cMinus - 1] += comp.value;
        }
        break;
    }
  }

  // Solve
  const solution = solveLinearSystem(G, b);

  if (!solution) {
    return { nodeVoltages: {}, branchCurrents: {}, converged: false, iterations: 1 };
  }

  // Extract results
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

  return { nodeVoltages, branchCurrents, converged: true, iterations: 1 };
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
  for (let step = 0; step <= numSteps; step++) {
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

  for (let i = 0; i < numSteps; i++) {
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
  type: 'R' | 'C' | 'L' | 'V' | 'I';
  value: number;
  nodePlus: number;
  nodeMinus: number;
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
    solverComponents.push({
      id: c.id,
      type: c.type,
      value: c.value,
      nodes: [c.nodePlus, c.nodeMinus],
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
