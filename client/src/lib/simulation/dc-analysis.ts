/**
 * DC Operating Point Analysis Engine
 *
 * Solves for all node voltages and branch currents at DC steady state
 * using Modified Nodal Analysis (MNA).
 *
 * Algorithm:
 *   1. Parse circuit topology (nodes, components, connections)
 *   2. Build MNA matrix: conductance matrix G and source vector I
 *      - Resistors: stamp conductance (1/R) into G matrix
 *      - Voltage sources: add branch equation, stamp into expanded matrix
 *      - Current sources: stamp into I vector
 *      - Capacitors: open circuit at DC (no stamp)
 *      - Inductors: short circuit at DC (0V voltage source)
 *      - Ground node (node 0) eliminated from matrix
 *   3. Solve Gx = I using Gaussian elimination with partial pivoting
 *   4. Extract node voltages from solution vector
 *   5. Calculate branch currents from node voltages
 *   6. Compute per-component and total power dissipation
 *
 * References:
 *   - Vlach & Singhal, "Computer Methods for Circuit Analysis and Design"
 *   - Cheng, "Field and Wave Electromagnetics"
 */

import type { SolverComponent, SolverInput } from './circuit-solver';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of a DC operating point analysis. */
export interface DCOperatingPoint {
  /** Map from node ID (string) to voltage in volts. */
  nodeVoltages: Map<string, number>;
  /** Map from branch/component ID to current in amps. */
  branchCurrents: Map<string, number>;
  /** Map from component ID to power dissipation in watts. */
  powerDissipation: Map<string, number>;
  /** Total power delivered by all sources. */
  totalPower: number;
  /** Whether the solver converged to a solution. */
  converged: boolean;
  /** Number of iterations taken (1 for linear DC). */
  iterations: number;
}

/** Options for DC operating point analysis. */
export interface DCAnalysisOptions {
  /** Maximum number of iterations (default 100). Not used for linear DC but reserved for NR. */
  maxIterations?: number;
  /** Convergence tolerance (default 1e-9). */
  tolerance?: number;
  /** Ground/reference node identifier (default '0'). */
  groundNode?: string;
}

/** Circuit definition for DC analysis using string node identifiers. */
export interface DCCircuitDefinition {
  /** All unique node IDs in the circuit (excluding ground). */
  nodeIds: string[];
  /** Components in the circuit. */
  components: DCComponent[];
  /** Ground node ID (default '0'). */
  groundNode?: string;
}

/** A component in the DC circuit. */
export interface DCComponent {
  /** Unique component identifier. */
  id: string;
  /** Component type. */
  type: 'R' | 'C' | 'L' | 'V' | 'I' | 'VCVS' | 'VCCS';
  /** Component value (ohms, farads, henries, volts, amps, or gain). */
  value: number;
  /** [positive node, negative node] as string IDs. */
  nodes: [string, string];
  /** Control nodes for dependent sources. */
  controlNodes?: [string, string];
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
function solveLinearSystem(A: number[][], b: number[], tolerance: number): number[] | null {
  const n = A.length;

  // Build augmented matrix [A | b]
  const aug: number[][] = [];
  for (let i = 0; i < n; i++) {
    aug.push([...A[i], b[i]]);
  }

  // Forward elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot with maximum magnitude
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(aug[row][col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = row;
      }
    }

    // Singular check
    if (maxVal < tolerance) {
      return null;
    }

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
    if (Math.abs(aug[row][row]) < tolerance) {
      return null;
    }
    x[row] = sum / aug[row][row];
  }

  return x;
}

// ---------------------------------------------------------------------------
// MNA stamping
// ---------------------------------------------------------------------------

/**
 * Stamp a resistor into the MNA matrix.
 * Conductance G = 1/R is stamped symmetrically.
 */
function stampResistor(
  G: number[][],
  nodeI: number,
  nodeJ: number,
  value: number,
): void {
  if (value === 0) {
    return;
  }
  const g = 1 / value;
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

/**
 * Stamp a current source into the RHS vector.
 * Current flows from negative node to positive node.
 */
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

/**
 * Stamp a voltage source into the MNA matrix.
 * Adds an extra row/column for the branch current variable.
 * V_nodeI - V_nodeJ = voltage
 */
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
// Core DC analysis using string node IDs
// ---------------------------------------------------------------------------

/**
 * Solve the DC operating point for a circuit defined with string node IDs.
 *
 * @param circuit - Circuit definition with string node identifiers
 * @param options - Analysis options (tolerance, ground node, etc.)
 * @returns DCOperatingPoint with node voltages, branch currents, and power
 */
export function solveDCOperatingPoint(
  circuit: DCCircuitDefinition,
  options?: DCAnalysisOptions,
): DCOperatingPoint {
  const tolerance = options?.tolerance ?? 1e-9;
  const groundNode = options?.groundNode ?? circuit.groundNode ?? '0';
  const maxIterations = options?.maxIterations ?? 100;

  // Build node index map: non-ground nodes get indices 0..N-1
  const nodeIndexMap = new Map<string, number>();
  let nodeCount = 0;
  for (const nodeId of circuit.nodeIds) {
    if (nodeId !== groundNode) {
      nodeIndexMap.set(nodeId, nodeCount++);
    }
  }

  // Count voltage sources and inductors (need extra MNA rows)
  const voltageSources = circuit.components.filter((c) => c.type === 'V');
  const inductors = circuit.components.filter((c) => c.type === 'L');
  const vcvsSources = circuit.components.filter((c) => c.type === 'VCVS');
  const numExtraRows = voltageSources.length + inductors.length + vcvsSources.length;
  const matrixSize = nodeCount + numExtraRows;

  // Handle empty circuit
  if (matrixSize === 0) {
    return {
      nodeVoltages: new Map([[groundNode, 0]]),
      branchCurrents: new Map(),
      powerDissipation: new Map(),
      totalPower: 0,
      converged: true,
      iterations: 0,
    };
  }

  const G = createMatrix(matrixSize);
  const b = createVector(matrixSize);

  // Assign extra-row indices for voltage sources
  const vsIndexMap = new Map<string, number>();
  let vsIdx = nodeCount;
  for (const vs of voltageSources) {
    vsIndexMap.set(vs.id, vsIdx++);
  }
  // Inductors are short circuits at DC (0V voltage source)
  for (const ind of inductors) {
    vsIndexMap.set(ind.id, vsIdx++);
  }
  // VCVS also needs extra rows
  for (const vcvs of vcvsSources) {
    vsIndexMap.set(vcvs.id, vsIdx++);
  }

  /** Resolve a string node ID to a matrix index, or -1 for ground. */
  function nodeIdx(nodeId: string): number {
    if (nodeId === groundNode) {
      return -1;
    }
    return nodeIndexMap.get(nodeId) ?? -1;
  }

  // Stamp all components
  for (const comp of circuit.components) {
    const nPlus = nodeIdx(comp.nodes[0]);
    const nMinus = nodeIdx(comp.nodes[1]);

    switch (comp.type) {
      case 'R': {
        stampResistor(G, nPlus, nMinus, comp.value);
        break;
      }

      case 'C': {
        // Open circuit at DC — no stamp
        break;
      }

      case 'L': {
        // Short circuit at DC — 0V voltage source
        const idx = vsIndexMap.get(comp.id);
        if (idx !== undefined) {
          stampVoltageSource(G, b, nPlus, nMinus, 0, idx);
        }
        break;
      }

      case 'V': {
        const idx = vsIndexMap.get(comp.id);
        if (idx !== undefined) {
          stampVoltageSource(G, b, nPlus, nMinus, comp.value, idx);
        }
        break;
      }

      case 'I': {
        stampCurrentSource(b, nPlus, nMinus, comp.value);
        break;
      }

      case 'VCVS': {
        // Voltage-Controlled Voltage Source: V_out = gain * V_control
        if (comp.controlNodes) {
          const idx = vsIndexMap.get(comp.id);
          if (idx !== undefined) {
            stampVoltageSource(G, b, nPlus, nMinus, 0, idx);
            const cPlus = nodeIdx(comp.controlNodes[0]);
            const cMinus = nodeIdx(comp.controlNodes[1]);
            if (cPlus >= 0) {
              G[idx][cPlus] -= comp.value;
            }
            if (cMinus >= 0) {
              G[idx][cMinus] += comp.value;
            }
          }
        }
        break;
      }

      case 'VCCS': {
        // Voltage-Controlled Current Source: I_out = gm * V_control
        if (comp.controlNodes) {
          const cPlus = nodeIdx(comp.controlNodes[0]);
          const cMinus = nodeIdx(comp.controlNodes[1]);
          if (nPlus >= 0 && cPlus >= 0) {
            G[nPlus][cPlus] += comp.value;
          }
          if (nPlus >= 0 && cMinus >= 0) {
            G[nPlus][cMinus] -= comp.value;
          }
          if (nMinus >= 0 && cPlus >= 0) {
            G[nMinus][cPlus] -= comp.value;
          }
          if (nMinus >= 0 && cMinus >= 0) {
            G[nMinus][cMinus] += comp.value;
          }
        }
        break;
      }
    }
  }

  // Solve the linear system
  const solution = solveLinearSystem(G, b, tolerance);

  if (!solution) {
    return {
      nodeVoltages: new Map(),
      branchCurrents: new Map(),
      powerDissipation: new Map(),
      totalPower: 0,
      converged: false,
      iterations: maxIterations,
    };
  }

  // Extract node voltages
  const nodeVoltages = new Map<string, number>();
  nodeVoltages.set(groundNode, 0);
  nodeIndexMap.forEach((idx, nodeId) => {
    nodeVoltages.set(nodeId, solution[idx]);
  });

  // Extract branch currents
  const branchCurrents = new Map<string, number>();

  // Voltage source and inductor currents from the extra MNA variables
  vsIndexMap.forEach((idx, compId) => {
    branchCurrents.set(compId, solution[idx]);
  });

  // Resistor currents from Ohm's law: I = (V+ - V-) / R
  for (const comp of circuit.components) {
    if (comp.type === 'R' && comp.value > 0) {
      const vPlus = nodeVoltages.get(comp.nodes[0]) ?? 0;
      const vMinus = nodeVoltages.get(comp.nodes[1]) ?? 0;
      branchCurrents.set(comp.id, (vPlus - vMinus) / comp.value);
    }
  }

  // Current source currents are their defined values
  for (const comp of circuit.components) {
    if (comp.type === 'I') {
      branchCurrents.set(comp.id, comp.value);
    }
  }

  // Compute power dissipation
  const powerDissipation = new Map<string, number>();
  let totalSourcePower = 0;

  for (const comp of circuit.components) {
    const vPlus = nodeVoltages.get(comp.nodes[0]) ?? 0;
    const vMinus = nodeVoltages.get(comp.nodes[1]) ?? 0;
    const voltage = vPlus - vMinus;
    const current = branchCurrents.get(comp.id) ?? 0;

    switch (comp.type) {
      case 'R': {
        // Resistors always dissipate power: P = I^2 * R = V^2 / R
        const power = voltage * current;
        powerDissipation.set(comp.id, Math.abs(power));
        break;
      }
      case 'V':
      case 'I': {
        // Sources deliver (or absorb) power: P = V * I
        // Convention: positive power = source delivers power
        const power = voltage * current;
        powerDissipation.set(comp.id, Math.abs(power));
        totalSourcePower += Math.abs(power);
        break;
      }
      case 'L': {
        // Inductor is a short at DC — no power dissipation
        powerDissipation.set(comp.id, 0);
        break;
      }
      case 'C': {
        // Capacitor is open at DC — no power dissipation
        powerDissipation.set(comp.id, 0);
        break;
      }
      case 'VCVS':
      case 'VCCS': {
        const power = voltage * current;
        powerDissipation.set(comp.id, Math.abs(power));
        totalSourcePower += Math.abs(power);
        break;
      }
    }
  }

  return {
    nodeVoltages,
    branchCurrents,
    powerDissipation,
    totalPower: totalSourcePower,
    converged: true,
    iterations: 1,
  };
}

// ---------------------------------------------------------------------------
// Convenience: Convert SolverInput to DCCircuitDefinition
// ---------------------------------------------------------------------------

/**
 * Convert a numeric SolverInput (from circuit-solver.ts) to a DCCircuitDefinition
 * with string node IDs. Useful for interop with existing circuit solver types.
 */
export function solverInputToDCCircuit(input: SolverInput): DCCircuitDefinition {
  const nodeIds: string[] = [];
  for (let i = 1; i <= input.numNodes; i++) {
    nodeIds.push(String(i));
  }

  const components: DCComponent[] = input.components.map((c) => ({
    id: c.id,
    type: c.type,
    value: c.value,
    nodes: [String(c.nodes[0]), String(c.nodes[1])] as [string, string],
    controlNodes: c.controlNodes
      ? ([String(c.controlNodes[0]), String(c.controlNodes[1])] as [string, string])
      : undefined,
  }));

  return {
    nodeIds,
    components,
    groundNode: String(input.groundNode),
  };
}

// ---------------------------------------------------------------------------
// Unit formatting utilities
// ---------------------------------------------------------------------------

/** SI prefixes for engineering notation. */
const SI_PREFIXES: Array<{ threshold: number; divisor: number; suffix: string }> = [
  { threshold: 1e12, divisor: 1e12, suffix: 'T' },
  { threshold: 1e9, divisor: 1e9, suffix: 'G' },
  { threshold: 1e6, divisor: 1e6, suffix: 'M' },
  { threshold: 1e3, divisor: 1e3, suffix: 'k' },
  { threshold: 1, divisor: 1, suffix: '' },
  { threshold: 1e-3, divisor: 1e-3, suffix: 'm' },
  { threshold: 1e-6, divisor: 1e-6, suffix: '\u00B5' },
  { threshold: 1e-9, divisor: 1e-9, suffix: 'n' },
  { threshold: 1e-12, divisor: 1e-12, suffix: 'p' },
  { threshold: 1e-15, divisor: 1e-15, suffix: 'f' },
];

/**
 * Format a value with an SI prefix and unit.
 * Uses engineering notation (multiples of 10^3).
 */
function formatWithUnit(value: number, unit: string, precision: number = 4): string {
  if (value === 0) {
    return `0 ${unit}`;
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  for (const prefix of SI_PREFIXES) {
    if (absValue >= prefix.threshold) {
      const scaled = absValue / prefix.divisor;
      return `${sign}${scaled.toPrecision(precision)} ${prefix.suffix}${unit}`;
    }
  }

  // Extremely small — use exponential notation
  return `${value.toExponential(precision - 1)} ${unit}`;
}

/**
 * Format a voltage value with smart unit selection.
 * Examples: "3.300 V", "500.0 mV", "1.200 kV"
 */
export function formatVoltage(v: number): string {
  return formatWithUnit(v, 'V');
}

/**
 * Format a current value with smart unit selection.
 * Examples: "10.00 mA", "500.0 \u00B5A", "2.500 A"
 */
export function formatCurrent(i: number): string {
  return formatWithUnit(i, 'A');
}

/**
 * Format a power value with smart unit selection.
 * Examples: "250.0 mW", "1.500 W", "50.00 \u00B5W"
 */
export function formatPower(p: number): string {
  return formatWithUnit(p, 'W');
}
