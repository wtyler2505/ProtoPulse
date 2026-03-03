/**
 * AC Small-Signal Analysis Engine
 *
 * Performs AC frequency-domain analysis by:
 *   1. Computing the DC operating point (linearization point) via the circuit solver
 *   2. Building a small-signal equivalent circuit using Modified Nodal Analysis (MNA):
 *      - Voltage sources -> short circuit (zero impedance)
 *      - Current sources -> open circuit (infinite impedance)
 *      - Capacitors -> admittance jwC
 *      - Inductors -> impedance jwL
 *      - Resistors -> conductance 1/R (unchanged)
 *   3. Solving the complex-valued MNA system at each frequency point
 *   4. Computing transfer function H(jw) = V_out / V_in
 *
 * Supports linear and logarithmic (decade) frequency sweeps.
 *
 * References:
 *   - Vlach & Singhal, "Computer Methods for Circuit Analysis and Design"
 *   - Pillage, Rohrer & Visweswariah, "Electronic Circuit & System Simulation Methods"
 */

import type { SolverComponent, SolverInput } from './circuit-solver';

// ---------------------------------------------------------------------------
// Complex number type and arithmetic
// ---------------------------------------------------------------------------

/** Complex number with real and imaginary parts. */
export interface Complex {
  re: number;
  im: number;
}

/** Create a complex number from real and imaginary parts. */
export function complex(re: number, im: number = 0): Complex {
  return { re, im };
}

/** Add two complex numbers. */
export function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

/** Subtract two complex numbers: a - b. */
export function cSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

/** Multiply two complex numbers. */
export function cMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

/** Divide two complex numbers: a / b. Returns {0,0} if b is zero. */
export function cDiv(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  if (denom === 0) {
    return { re: 0, im: 0 };
  }
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
}

/** Magnitude (absolute value) of a complex number. */
export function cMag(c: Complex): number {
  return Math.sqrt(c.re * c.re + c.im * c.im);
}

/** Phase angle of a complex number in radians. */
export function cPhase(c: Complex): number {
  return Math.atan2(c.im, c.re);
}

/** Negate a complex number. */
export function cNeg(c: Complex): Complex {
  return { re: -c.re, im: -c.im };
}

/** Reciprocal: 1/c. */
export function cRecip(c: Complex): Complex {
  return cDiv({ re: 1, im: 0 }, c);
}

// ---------------------------------------------------------------------------
// AC analysis types
// ---------------------------------------------------------------------------

/** Configuration for an AC small-signal analysis. */
export interface ACAnalysisConfig {
  /** Start frequency in Hz (must be > 0). */
  startFreq: number;
  /** Stop frequency in Hz (must be > startFreq). */
  stopFreq: number;
  /** Frequency sweep type. */
  sweepType: 'linear' | 'decade';
  /** Points per decade for decade sweep, or total points for linear sweep. */
  pointsPerDecade: number;
  /** Node index where the AC stimulus (1V source) is applied. */
  inputNode: number;
  /** Node index where the output voltage is measured. */
  outputNode: number;
  /** Ground node index (typically 0). */
  groundNode: number;
}

/** Result of an AC small-signal analysis. */
export interface ACAnalysisResult {
  /** Frequency points in Hz. */
  frequencies: number[];
  /** Magnitude of H(jw) in dB at each frequency. */
  magnitude: number[];
  /** Phase of H(jw) in degrees at each frequency. */
  phase: number[];
  /** Complex impedance at the output node at each frequency. */
  impedance: Complex[];
}

// ---------------------------------------------------------------------------
// Frequency sweep generation
// ---------------------------------------------------------------------------

/**
 * Generate logarithmically spaced frequency points (decade sweep).
 * Returns frequencies from fMin to fMax with the given points per decade.
 */
function generateLogFrequencies(fMin: number, fMax: number, pointsPerDecade: number): number[] {
  const logMin = Math.log10(fMin);
  const logMax = Math.log10(fMax);
  const decades = logMax - logMin;
  const totalPoints = Math.max(2, Math.round(decades * pointsPerDecade));

  const frequencies: number[] = [];
  for (let i = 0; i <= totalPoints; i++) {
    const logF = logMin + (i / totalPoints) * (logMax - logMin);
    frequencies.push(Math.pow(10, logF));
  }
  return frequencies;
}

/**
 * Generate linearly spaced frequency points.
 * Returns `numPoints` frequencies evenly distributed from fMin to fMax.
 */
function generateLinearFrequencies(fMin: number, fMax: number, numPoints: number): number[] {
  const frequencies: number[] = [];
  const step = (fMax - fMin) / Math.max(1, numPoints - 1);
  for (let i = 0; i < numPoints; i++) {
    frequencies.push(fMin + i * step);
  }
  return frequencies;
}

// ---------------------------------------------------------------------------
// Complex matrix operations for AC MNA
// ---------------------------------------------------------------------------

/** Create an NxN complex matrix initialized to zero. */
function createComplexMatrix(n: number): Complex[][] {
  const m: Complex[][] = [];
  for (let i = 0; i < n; i++) {
    const row: Complex[] = [];
    for (let j = 0; j < n; j++) {
      row.push({ re: 0, im: 0 });
    }
    m.push(row);
  }
  return m;
}

/** Create a complex vector of length n initialized to zero. */
function createComplexVector(n: number): Complex[] {
  const v: Complex[] = [];
  for (let i = 0; i < n; i++) {
    v.push({ re: 0, im: 0 });
  }
  return v;
}

/**
 * Solve a complex linear system Ax = b using Gaussian elimination with partial pivoting.
 * Returns x, or null if the matrix is singular.
 */
function solveComplexSystem(A: Complex[][], b: Complex[]): Complex[] | null {
  const n = A.length;

  // Build augmented matrix [A | b]
  const aug: Complex[][] = [];
  for (let i = 0; i < n; i++) {
    const row: Complex[] = [];
    for (let j = 0; j < n; j++) {
      row.push({ re: A[i][j].re, im: A[i][j].im });
    }
    row.push({ re: b[i].re, im: b[i].im });
    aug.push(row);
  }

  // Forward elimination with partial pivoting (by magnitude)
  for (let col = 0; col < n; col++) {
    // Find pivot with maximum magnitude
    let maxMag = cMag(aug[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      const mag = cMag(aug[row][col]);
      if (mag > maxMag) {
        maxMag = mag;
        maxRow = row;
      }
    }

    // Singular check
    if (maxMag < 1e-15) {
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
      const factor = cDiv(aug[row][col], pivot);
      for (let j = col; j <= n; j++) {
        aug[row][j] = cSub(aug[row][j], cMul(factor, aug[col][j]));
      }
    }
  }

  // Back substitution
  const x = createComplexVector(n);
  for (let row = n - 1; row >= 0; row--) {
    let sum: Complex = { re: aug[row][n].re, im: aug[row][n].im };
    for (let col = row + 1; col < n; col++) {
      sum = cSub(sum, cMul(aug[row][col], x[col]));
    }
    if (cMag(aug[row][row]) < 1e-15) {
      return null;
    }
    x[row] = cDiv(sum, aug[row][row]);
  }

  return x;
}

// ---------------------------------------------------------------------------
// AC MNA stamping
// ---------------------------------------------------------------------------

/**
 * Stamp a complex admittance Y between nodes i and j into the MNA conductance matrix.
 * Follows the standard MNA stamping pattern:
 *   Y[i][i] += Y, Y[j][j] += Y, Y[i][j] -= Y, Y[j][i] -= Y
 * Node 0 is ground and is not represented in the matrix.
 */
function stampAdmittance(
  Y: Complex[][],
  nodeI: number,
  nodeJ: number,
  admittance: Complex,
): void {
  if (nodeI > 0) {
    Y[nodeI - 1][nodeI - 1] = cAdd(Y[nodeI - 1][nodeI - 1], admittance);
  }
  if (nodeJ > 0) {
    Y[nodeJ - 1][nodeJ - 1] = cAdd(Y[nodeJ - 1][nodeJ - 1], admittance);
  }
  if (nodeI > 0 && nodeJ > 0) {
    Y[nodeI - 1][nodeJ - 1] = cSub(Y[nodeI - 1][nodeJ - 1], admittance);
    Y[nodeJ - 1][nodeI - 1] = cSub(Y[nodeJ - 1][nodeI - 1], admittance);
  }
}

/**
 * Stamp an AC voltage source into the MNA matrix.
 * Adds an extra row/column for the branch current variable.
 *
 * V_nodeI - V_nodeJ = V_ac
 *   Row vsIdx: Y[vsIdx][nodeI-1] = 1, Y[vsIdx][nodeJ-1] = -1, b[vsIdx] = V_ac
 *   Col vsIdx: Y[nodeI-1][vsIdx] = 1, Y[nodeJ-1][vsIdx] = -1
 */
function stampACVoltageSource(
  Y: Complex[][],
  b: Complex[],
  nodeI: number,
  nodeJ: number,
  voltage: Complex,
  vsIdx: number,
): void {
  const one: Complex = { re: 1, im: 0 };
  const negOne: Complex = { re: -1, im: 0 };

  if (nodeI > 0) {
    Y[nodeI - 1][vsIdx] = cAdd(Y[nodeI - 1][vsIdx], one);
    Y[vsIdx][nodeI - 1] = cAdd(Y[vsIdx][nodeI - 1], one);
  }
  if (nodeJ > 0) {
    Y[nodeJ - 1][vsIdx] = cAdd(Y[nodeJ - 1][vsIdx], negOne);
    Y[vsIdx][nodeJ - 1] = cAdd(Y[vsIdx][nodeJ - 1], negOne);
  }
  b[vsIdx] = cAdd(b[vsIdx], voltage);
}

// ---------------------------------------------------------------------------
// Core AC analysis
// ---------------------------------------------------------------------------

/**
 * Build and solve the AC MNA system at a single angular frequency omega.
 *
 * Small-signal linearization rules:
 *   - Resistors: admittance Y = 1/R (real, frequency-independent)
 *   - Capacitors: admittance Y = jwC
 *   - Inductors: admittance Y = 1/(jwL)
 *   - Independent voltage sources: short circuit (0V in small-signal),
 *     EXCEPT the AC stimulus source which is set to 1V (unit amplitude)
 *   - Independent current sources: open circuit (removed in small-signal)
 *   - VCVS, VCCS: linearized around operating point (stamps preserved)
 *
 * @param input - Circuit description (same format as DC solver)
 * @param omega - Angular frequency (2*pi*f) in rad/s
 * @param acInputNode - Node where the 1V AC stimulus is injected
 * @param groundNode - Ground reference node (typically 0)
 * @returns Complex node voltages, or null if system is singular
 */
function solveACPoint(
  input: SolverInput,
  omega: number,
  acInputNode: number,
  groundNode: number,
): Complex[] | null {
  const { numNodes, components } = input;

  // In AC small-signal: DC voltage sources become 0V (short circuit).
  // We add one AC stimulus source (1V) at the input node.
  // Count voltage sources that need extra MNA rows.
  const dcVoltageSources = components.filter((c) => c.type === 'V');
  const inductors = components.filter((c) => c.type === 'L');

  // Each DC voltage source gets an extra row (shorted: V=0 in small-signal).
  // Each inductor gets an extra row (impedance jwL modeled as V source with Z=jwL).
  // Plus one extra row for the AC stimulus source.
  const numExtraVS = dcVoltageSources.length;
  const numExtraL = inductors.length;
  const acStimIdx = numNodes + numExtraVS + numExtraL; // index for the AC stimulus row
  const matrixSize = numNodes + numExtraVS + numExtraL + 1;

  if (matrixSize === 0) {
    return null;
  }

  const Y = createComplexMatrix(matrixSize);
  const b = createComplexVector(matrixSize);

  // Assign MNA extra-row indices for DC voltage sources
  const vsIndexMap = new Map<string, number>();
  let vsIdx = numNodes;
  for (const vs of dcVoltageSources) {
    vsIndexMap.set(vs.id, vsIdx++);
  }

  // Assign MNA extra-row indices for inductors
  const lIndexMap = new Map<string, number>();
  for (const ind of inductors) {
    lIndexMap.set(ind.id, vsIdx++);
  }

  const jw: Complex = { re: 0, im: omega };

  // Stamp components
  for (const comp of components) {
    const [nPlus, nMinus] = comp.nodes;

    switch (comp.type) {
      case 'R': {
        // Admittance = 1/R (real, frequency-independent)
        if (comp.value > 0) {
          stampAdmittance(Y, nPlus, nMinus, { re: 1 / comp.value, im: 0 });
        }
        break;
      }

      case 'C': {
        // Admittance = jwC
        const yC = cMul(jw, { re: comp.value, im: 0 });
        stampAdmittance(Y, nPlus, nMinus, yC);
        break;
      }

      case 'L': {
        // Inductor modeled with an extra MNA row.
        // Impedance Z_L = jwL.
        // MNA equation: V_nPlus - V_nMinus = Z_L * I_branch
        // This is: V_nPlus - V_nMinus - jwL * I_branch = 0
        const idx = lIndexMap.get(comp.id);
        if (idx !== undefined) {
          const one: Complex = { re: 1, im: 0 };
          const negOne: Complex = { re: -1, im: 0 };

          // Stamp the voltage equation row
          if (nPlus > 0) {
            Y[nPlus - 1][idx] = cAdd(Y[nPlus - 1][idx], one);
            Y[idx][nPlus - 1] = cAdd(Y[idx][nPlus - 1], one);
          }
          if (nMinus > 0) {
            Y[nMinus - 1][idx] = cAdd(Y[nMinus - 1][idx], negOne);
            Y[idx][nMinus - 1] = cAdd(Y[idx][nMinus - 1], negOne);
          }

          // The impedance term: -jwL on the diagonal for the branch current variable
          const zL = cMul(jw, { re: comp.value, im: 0 });
          Y[idx][idx] = cSub(Y[idx][idx], zL);

          // RHS = 0 (no independent source in small-signal inductor)
          // b[idx] remains 0
        }
        break;
      }

      case 'V': {
        // DC voltage source -> short circuit in small-signal (V_ac = 0)
        const idx = vsIndexMap.get(comp.id);
        if (idx !== undefined) {
          stampACVoltageSource(Y, b, nPlus, nMinus, { re: 0, im: 0 }, idx);
        }
        break;
      }

      case 'I': {
        // Independent current source -> open circuit in small-signal
        // (removed from small-signal circuit; no stamp needed)
        break;
      }

      case 'VCVS': {
        // Voltage-Controlled Voltage Source: V_out = gain * V_control
        // Linearized: same stamp as DC (small-signal gain = DC gain for linear VCVS)
        if (comp.controlNodes) {
          const idx = vsIndexMap.get(comp.id);
          if (idx !== undefined) {
            stampACVoltageSource(Y, b, nPlus, nMinus, { re: 0, im: 0 }, idx);
            const [cPlus, cMinus] = comp.controlNodes;
            if (cPlus > 0) {
              Y[idx][cPlus - 1] = cSub(Y[idx][cPlus - 1], { re: comp.value, im: 0 });
            }
            if (cMinus > 0) {
              Y[idx][cMinus - 1] = cAdd(Y[idx][cMinus - 1], { re: comp.value, im: 0 });
            }
          }
        }
        break;
      }

      case 'VCCS': {
        // Voltage-Controlled Current Source: I_out = gm * V_control
        // Linearized: same transconductance stamp
        if (comp.controlNodes) {
          const [cPlus, cMinus] = comp.controlNodes;
          const gm: Complex = { re: comp.value, im: 0 };
          if (nPlus > 0 && cPlus > 0) {
            Y[nPlus - 1][cPlus - 1] = cAdd(Y[nPlus - 1][cPlus - 1], gm);
          }
          if (nPlus > 0 && cMinus > 0) {
            Y[nPlus - 1][cMinus - 1] = cSub(Y[nPlus - 1][cMinus - 1], gm);
          }
          if (nMinus > 0 && cPlus > 0) {
            Y[nMinus - 1][cPlus - 1] = cSub(Y[nMinus - 1][cPlus - 1], gm);
          }
          if (nMinus > 0 && cMinus > 0) {
            Y[nMinus - 1][cMinus - 1] = cAdd(Y[nMinus - 1][cMinus - 1], gm);
          }
        }
        break;
      }
    }
  }

  // Stamp the AC stimulus: 1V source from acInputNode to groundNode
  stampACVoltageSource(Y, b, acInputNode, groundNode, { re: 1, im: 0 }, acStimIdx);

  // Solve the complex system
  return solveComplexSystem(Y, b);
}

// ---------------------------------------------------------------------------
// Phase wrapping
// ---------------------------------------------------------------------------

/** Convert radians to degrees. */
function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Wrap phase to [-180, +180] degrees. */
function wrapPhase(degrees: number): number {
  let wrapped = degrees % 360;
  if (wrapped > 180) {
    wrapped -= 360;
  }
  if (wrapped < -180) {
    wrapped += 360;
  }
  return wrapped;
}

// ---------------------------------------------------------------------------
// Main AC analysis function
// ---------------------------------------------------------------------------

/**
 * Run AC small-signal analysis on a circuit.
 *
 * Performs a frequency sweep, solving the linearized MNA system at each point
 * to compute the voltage transfer function H(jw) = V_out(jw) / V_in(jw).
 *
 * The AC stimulus is a 1V source at the input node, so H(jw) = V_out directly.
 *
 * @param input - Circuit description (SolverInput from circuit-solver.ts)
 * @param config - AC analysis configuration (frequency range, sweep type, I/O nodes)
 * @returns ACAnalysisResult with magnitude (dB), phase (deg), and impedance at each frequency
 * @throws Error if configuration is invalid
 */
export function runACAnalysis(input: SolverInput, config: ACAnalysisConfig): ACAnalysisResult {
  // Validate configuration
  if (config.startFreq <= 0) {
    throw new Error('Start frequency must be positive');
  }
  if (config.stopFreq <= config.startFreq) {
    throw new Error('Stop frequency must be greater than start frequency');
  }
  if (config.pointsPerDecade < 1) {
    throw new Error('Points per decade must be at least 1');
  }
  if (config.inputNode < 1) {
    throw new Error('Input node must be a valid non-ground node (>= 1)');
  }
  if (config.outputNode < 1) {
    throw new Error('Output node must be a valid non-ground node (>= 1)');
  }
  if (config.inputNode > input.numNodes) {
    throw new Error(`Input node ${config.inputNode} exceeds number of nodes (${input.numNodes})`);
  }
  if (config.outputNode > input.numNodes) {
    throw new Error(`Output node ${config.outputNode} exceeds number of nodes (${input.numNodes})`);
  }

  // Generate frequency points
  let frequencies: number[];
  if (config.sweepType === 'decade') {
    frequencies = generateLogFrequencies(config.startFreq, config.stopFreq, config.pointsPerDecade);
  } else {
    frequencies = generateLinearFrequencies(config.startFreq, config.stopFreq, config.pointsPerDecade);
  }

  const magnitude: number[] = [];
  const phase: number[] = [];
  const impedance: Complex[] = [];

  // Solve at each frequency point
  for (const freq of frequencies) {
    const omega = 2 * Math.PI * freq;

    const solution = solveACPoint(input, omega, config.inputNode, config.groundNode);

    if (solution) {
      // Output voltage is the complex voltage at the output node
      // (node indices in the solution vector are 0-based: node k -> index k-1)
      const vOut = solution[config.outputNode - 1];
      // Input voltage is 1V (the AC stimulus), so H(jw) = vOut / 1 = vOut
      const mag = cMag(vOut);
      const magDb = mag > 0 ? 20 * Math.log10(mag) : -200;
      const phaseDeg = wrapPhase(radToDeg(cPhase(vOut)));

      magnitude.push(magDb);
      phase.push(phaseDeg);
      impedance.push(vOut);
    } else {
      // Singular matrix at this frequency — push sentinel values
      magnitude.push(-200);
      phase.push(0);
      impedance.push({ re: 0, im: 0 });
    }
  }

  return { frequencies, magnitude, phase, impedance };
}

// ---------------------------------------------------------------------------
// Convenience: compute complex impedance at a single node and frequency
// ---------------------------------------------------------------------------

/**
 * Compute the complex impedance seen looking into a node at a given frequency.
 *
 * This injects a 1A test current at the node and measures the resulting voltage.
 * Z = V / I = V (since I = 1A).
 *
 * @param input - Circuit description
 * @param node - Node to probe
 * @param frequency - Frequency in Hz
 * @param groundNode - Ground reference (default 0)
 * @returns Complex impedance, or null if the system is singular
 */
export function computeNodeImpedance(
  input: SolverInput,
  node: number,
  frequency: number,
  groundNode: number = 0,
): Complex | null {
  const { numNodes, components } = input;
  const omega = 2 * Math.PI * frequency;

  // For impedance measurement we don't use a voltage stimulus.
  // Instead, we inject a 1A current and measure voltage.
  // Build the small-signal MNA without the AC voltage source.

  const dcVoltageSources = components.filter((c) => c.type === 'V');
  const inductors = components.filter((c) => c.type === 'L');

  const numExtraVS = dcVoltageSources.length;
  const numExtraL = inductors.length;
  const matrixSize = numNodes + numExtraVS + numExtraL;

  if (matrixSize === 0 || node < 1 || node > numNodes) {
    return null;
  }

  const Y = createComplexMatrix(matrixSize);
  const b = createComplexVector(matrixSize);

  const vsIndexMap = new Map<string, number>();
  let vsIdx = numNodes;
  for (const vs of dcVoltageSources) {
    vsIndexMap.set(vs.id, vsIdx++);
  }

  const lIndexMap = new Map<string, number>();
  for (const ind of inductors) {
    lIndexMap.set(ind.id, vsIdx++);
  }

  const jw: Complex = { re: 0, im: omega };

  // Stamp all components (same as solveACPoint but without AC stimulus)
  for (const comp of components) {
    const [nPlus, nMinus] = comp.nodes;

    switch (comp.type) {
      case 'R': {
        if (comp.value > 0) {
          stampAdmittance(Y, nPlus, nMinus, { re: 1 / comp.value, im: 0 });
        }
        break;
      }
      case 'C': {
        const yC = cMul(jw, { re: comp.value, im: 0 });
        stampAdmittance(Y, nPlus, nMinus, yC);
        break;
      }
      case 'L': {
        const idx = lIndexMap.get(comp.id);
        if (idx !== undefined) {
          const one: Complex = { re: 1, im: 0 };
          const negOne: Complex = { re: -1, im: 0 };
          if (nPlus > 0) {
            Y[nPlus - 1][idx] = cAdd(Y[nPlus - 1][idx], one);
            Y[idx][nPlus - 1] = cAdd(Y[idx][nPlus - 1], one);
          }
          if (nMinus > 0) {
            Y[nMinus - 1][idx] = cAdd(Y[nMinus - 1][idx], negOne);
            Y[idx][nMinus - 1] = cAdd(Y[idx][nMinus - 1], negOne);
          }
          const zL = cMul(jw, { re: comp.value, im: 0 });
          Y[idx][idx] = cSub(Y[idx][idx], zL);
        }
        break;
      }
      case 'V': {
        const idx = vsIndexMap.get(comp.id);
        if (idx !== undefined) {
          stampACVoltageSource(Y, b, nPlus, nMinus, { re: 0, im: 0 }, idx);
        }
        break;
      }
      case 'I': {
        // Open circuit in small-signal
        break;
      }
      case 'VCVS': {
        if (comp.controlNodes) {
          const idx = vsIndexMap.get(comp.id);
          if (idx !== undefined) {
            stampACVoltageSource(Y, b, nPlus, nMinus, { re: 0, im: 0 }, idx);
            const [cPlus, cMinus] = comp.controlNodes;
            if (cPlus > 0) {
              Y[idx][cPlus - 1] = cSub(Y[idx][cPlus - 1], { re: comp.value, im: 0 });
            }
            if (cMinus > 0) {
              Y[idx][cMinus - 1] = cAdd(Y[idx][cMinus - 1], { re: comp.value, im: 0 });
            }
          }
        }
        break;
      }
      case 'VCCS': {
        if (comp.controlNodes) {
          const [cPlus, cMinus] = comp.controlNodes;
          const gm: Complex = { re: comp.value, im: 0 };
          if (nPlus > 0 && cPlus > 0) {
            Y[nPlus - 1][cPlus - 1] = cAdd(Y[nPlus - 1][cPlus - 1], gm);
          }
          if (nPlus > 0 && cMinus > 0) {
            Y[nPlus - 1][cMinus - 1] = cSub(Y[nPlus - 1][cMinus - 1], gm);
          }
          if (nMinus > 0 && cPlus > 0) {
            Y[nMinus - 1][cPlus - 1] = cSub(Y[nMinus - 1][cPlus - 1], gm);
          }
          if (nMinus > 0 && cMinus > 0) {
            Y[nMinus - 1][cMinus - 1] = cAdd(Y[nMinus - 1][cMinus - 1], gm);
          }
        }
        break;
      }
    }
  }

  // Inject 1A test current at the probe node
  if (node > 0) {
    b[node - 1] = cAdd(b[node - 1], { re: 1, im: 0 });
  }

  const solution = solveComplexSystem(Y, b);

  if (!solution) {
    return null;
  }

  // Z = V_node / 1A = V_node
  return solution[node - 1];
}
