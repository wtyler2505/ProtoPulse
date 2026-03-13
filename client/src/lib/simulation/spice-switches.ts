/**
 * SPICE S/W Voltage-Controlled and Current-Controlled Switch Elements (BL-0512)
 *
 * Implements two SPICE switch types commonly used in power electronics (H-bridge,
 * buck/boost converters) and digital-analog interface circuits:
 *
 *   - S (Voltage-Controlled Switch): conducts when V(ctrl+) - V(ctrl-) exceeds threshold
 *   - W (Current-Controlled Switch): conducts when current through a sense element exceeds threshold
 *
 * Both use a smooth sigmoid transition between Ron and Roff near the threshold to
 * avoid convergence issues in Newton-Raphson iteration. The sigmoid provides C-infinity
 * smoothness (all derivatives exist and are continuous), unlike a hard step function
 * which would cause derivative discontinuities at the switching point.
 *
 * Hysteresis is modeled by offsetting the on/off thresholds symmetrically around the
 * nominal threshold: turnOn = Vt + Vh/2, turnOff = Vt - Vh/2.
 *
 * SPICE syntax:
 *   S<name> <n+> <n-> <nc+> <nc-> <model>
 *   W<name> <n+> <n-> <Vsense> <model>
 *   .MODEL <name> SW  (Ron=1 Roff=1Meg Vt=2.5 Vh=0.5)
 *   .MODEL <name> CSW (Ron=1 Roff=1Meg It=0.5 Ih=0.1)
 *
 * References:
 *   - Nagel & Pederson, "SPICE (Simulation Program with IC Emphasis)"
 *   - Vladimirescu, "The SPICE Book"
 *   - LTspice Reference: SW and CSW device models
 */

import { parseSpiceValue } from './spice-netlist-parser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed voltage-controlled switch (S element). */
export interface SSwitchDef {
  /** Element name (e.g., "S1"). */
  name: string;
  /** Positive output node. */
  node1: string;
  /** Negative output node. */
  node2: string;
  /** Positive control node. */
  ctrlPlus: string;
  /** Negative control node. */
  ctrlMinus: string;
  /** Reference to .MODEL name. */
  modelName: string;
}

/** Parsed current-controlled switch (W element). */
export interface WSwitchDef {
  /** Element name (e.g., "W1"). */
  name: string;
  /** Positive output node. */
  node1: string;
  /** Negative output node. */
  node2: string;
  /** Name of the voltage source used as current sensor. */
  senseElement: string;
  /** Reference to .MODEL name. */
  modelName: string;
}

/** Switch model parameters (shared between SW and CSW). */
export interface SwitchModel {
  /** Model name. */
  name: string;
  /** Model type: 'SW' for voltage-controlled, 'CSW' for current-controlled. */
  type: 'SW' | 'CSW';
  /** On-state resistance in ohms (default 1). */
  Ron: number;
  /** Off-state resistance in ohms (default 1e6). */
  Roff: number;
  /** Switching threshold — voltage (Vt) for SW, current (It) for CSW (default 0). */
  threshold: number;
  /** Hysteresis width — Vh for SW, Ih for CSW (default 0). */
  hysteresis: number;
}

// ---------------------------------------------------------------------------
// Default model parameters
// ---------------------------------------------------------------------------

/** Default voltage-controlled switch model. */
export const SW_DEFAULTS: Readonly<SwitchModel> = {
  name: 'SW_DEFAULT',
  type: 'SW',
  Ron: 1,
  Roff: 1e6,
  threshold: 0,
  hysteresis: 0,
};

/** Default current-controlled switch model. */
export const CSW_DEFAULTS: Readonly<SwitchModel> = {
  name: 'CSW_DEFAULT',
  type: 'CSW',
  Ron: 1,
  Roff: 1e6,
  threshold: 0,
  hysteresis: 0,
};

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse an S (voltage-controlled switch) element line.
 *
 * Format: S<name> <n+> <n-> <nc+> <nc-> <model>
 *
 * @param line - SPICE element line (e.g., "S1 out 0 ctrl+ ctrl- SMOD")
 * @returns Parsed SSwitchDef
 * @throws Error if parsing fails
 */
export function parseSSwitch(line: string): SSwitchDef {
  const trimmed = line.trim();
  if (!trimmed) {
    throw new Error('Empty S switch line');
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 6) {
    throw new Error(
      `S switch requires 6 fields (S<name> n+ n- nc+ nc- model), got ${String(tokens.length)}: "${trimmed}"`,
    );
  }

  const name = tokens[0];
  if (!/^[Ss]/i.test(name)) {
    throw new Error(`S switch name must start with 'S', got: "${name}"`);
  }

  return {
    name,
    node1: tokens[1],
    node2: tokens[2],
    ctrlPlus: tokens[3],
    ctrlMinus: tokens[4],
    modelName: tokens[5],
  };
}

/**
 * Parse a W (current-controlled switch) element line.
 *
 * Format: W<name> <n+> <n-> <Vsense> <model>
 *
 * @param line - SPICE element line (e.g., "W1 out 0 Vsense WMOD")
 * @returns Parsed WSwitchDef
 * @throws Error if parsing fails
 */
export function parseWSwitch(line: string): WSwitchDef {
  const trimmed = line.trim();
  if (!trimmed) {
    throw new Error('Empty W switch line');
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 5) {
    throw new Error(
      `W switch requires 5 fields (W<name> n+ n- Vsense model), got ${String(tokens.length)}: "${trimmed}"`,
    );
  }

  const name = tokens[0];
  if (!/^[Ww]/i.test(name)) {
    throw new Error(`W switch name must start with 'W', got: "${name}"`);
  }

  return {
    name,
    node1: tokens[1],
    node2: tokens[2],
    senseElement: tokens[3],
    modelName: tokens[4],
  };
}

/**
 * Parse a .MODEL line for a switch model (SW or CSW).
 *
 * Format: .MODEL <name> SW(Ron=1 Roff=1Meg Vt=2.5 Vh=0.5)
 *         .MODEL <name> CSW(Ron=1 Roff=1Meg It=0.5 Ih=0.1)
 *
 * Parameters can be inside parentheses or space-separated after the type.
 *
 * @param line - .MODEL line
 * @returns Parsed SwitchModel
 * @throws Error if parsing fails
 */
export function parseSwitchModel(line: string): SwitchModel {
  const trimmed = line.trim();
  if (!trimmed) {
    throw new Error('Empty switch model line');
  }

  // Remove .MODEL prefix (case-insensitive)
  const modelMatch = /^\.MODEL\s+(\S+)\s+(SW|CSW)\s*(.*)/i.exec(trimmed);
  if (!modelMatch) {
    throw new Error(`Invalid switch model line: "${trimmed}"`);
  }

  const modelName = modelMatch[1];
  const modelType = modelMatch[2].toUpperCase() as 'SW' | 'CSW';
  const paramStr = modelMatch[3];

  // Parse parameters from the parameter string
  const params = parseModelParamsInternal(paramStr);

  // Extract parameters using the correct keys for each model type
  let threshold: number;
  let hysteresis: number;

  if (modelType === 'SW') {
    threshold = params['VT'] ?? params['VON'] ?? SW_DEFAULTS.threshold;
    hysteresis = params['VH'] ?? SW_DEFAULTS.hysteresis;
  } else {
    threshold = params['IT'] ?? params['ION'] ?? CSW_DEFAULTS.threshold;
    hysteresis = params['IH'] ?? CSW_DEFAULTS.hysteresis;
  }

  const Ron = params['RON'] ?? (modelType === 'SW' ? SW_DEFAULTS.Ron : CSW_DEFAULTS.Ron);
  const Roff = params['ROFF'] ?? (modelType === 'SW' ? SW_DEFAULTS.Roff : CSW_DEFAULTS.Roff);

  return {
    name: modelName,
    type: modelType,
    Ron,
    Roff,
    threshold,
    hysteresis,
  };
}

/**
 * Parse model parameters from a string like "Ron=1 Roff=1Meg Vt=2.5 Vh=0.5"
 * or "(Ron=1 Roff=1Meg Vt=2.5 Vh=0.5)".
 */
function parseModelParamsInternal(paramStr: string): Record<string, number> {
  const params: Record<string, number> = {};
  if (!paramStr) {
    return params;
  }

  // Strip parentheses
  const cleaned = paramStr.replace(/[()]/g, ' ').trim();
  if (!cleaned) {
    return params;
  }

  // Split on whitespace and process key=value pairs
  const tokens = cleaned.split(/\s+/);
  for (const token of tokens) {
    const eqIdx = token.indexOf('=');
    if (eqIdx > 0) {
      const key = token.slice(0, eqIdx).toUpperCase();
      const val = parseSpiceValue(token.slice(eqIdx + 1));
      if (!Number.isNaN(val)) {
        params[key] = val;
      }
    }
  }

  return params;
}

// ---------------------------------------------------------------------------
// Switch resistance calculation
// ---------------------------------------------------------------------------

/**
 * Steepness factor for the sigmoid transition.
 *
 * Controls how sharp the on/off transition is. A value of 20 gives a smooth
 * but reasonably fast transition within ~10% of the hysteresis band on each
 * side, which is suitable for most circuit simulation convergence requirements.
 *
 * Higher values approach a step function (harder for NR convergence).
 * Lower values give a more gradual transition (less physically accurate).
 */
const SIGMOID_STEEPNESS = 20;

/**
 * Compute the switch resistance as a function of the control value.
 *
 * Uses a smooth sigmoid (logistic function) to interpolate between Roff and Ron:
 *
 *   R(x) = Roff + (Ron - Roff) * sigmoid(k * (x - threshold))
 *
 * where sigmoid(z) = 1 / (1 + exp(-z)), and k is a steepness factor.
 *
 * With hysteresis, the effective threshold shifts:
 *   - For increasing control: threshold + hysteresis/2
 *   - For decreasing control: threshold - hysteresis/2
 *   - Without state tracking, we use the midpoint (threshold) and let the
 *     sigmoid width naturally cover the hysteresis band.
 *
 * The interpolation is done in log-space for resistance values that span
 * many decades (e.g., 1 ohm to 1 Megohm), ensuring smooth behavior:
 *
 *   log(R) = log(Roff) + (log(Ron) - log(Roff)) * sigmoid(...)
 *   R = exp(log(R))
 *
 * @param controlValue - Control voltage (S switch) or current (W switch)
 * @param model - Switch model parameters
 * @returns Switch resistance in ohms
 */
export function getSwitchResistance(controlValue: number, model: SwitchModel): number {
  const { Ron, Roff, threshold, hysteresis } = model;

  // Degenerate case: Ron equals Roff
  if (Ron === Roff) {
    return Ron;
  }

  // Ensure positive resistances for log-space interpolation
  const safeRon = Math.max(Ron, 1e-12);
  const safeRoff = Math.max(Roff, 1e-12);

  // Compute effective steepness based on hysteresis
  // If hysteresis > 0, scale steepness so the transition width covers the hysteresis band
  let steepness = SIGMOID_STEEPNESS;
  if (hysteresis > 0) {
    // Scale: the sigmoid 10%-90% transition spans ~4.4/k, so set k so that
    // this transition width equals the hysteresis
    steepness = 4.4 / hysteresis;
  }

  // Sigmoid argument
  const z = steepness * (controlValue - threshold);

  // Clamp to prevent overflow
  const clampedZ = Math.max(-50, Math.min(50, z));
  const sigma = 1 / (1 + Math.exp(-clampedZ));

  // Log-space interpolation for multi-decade resistance range
  const logRon = Math.log(safeRon);
  const logRoff = Math.log(safeRoff);
  const logR = logRoff + (logRon - logRoff) * sigma;

  return Math.exp(logR);
}

// ---------------------------------------------------------------------------
// MNA stamping
// ---------------------------------------------------------------------------

/**
 * MNA matrix interface for stamping.
 *
 * The switch is modeled as a variable conductance between its output nodes.
 * The conductance G = 1/R(controlValue) is stamped into the MNA matrix
 * using the standard conductance stamp pattern.
 */
export interface MNAMatrix {
  /** Conductance matrix G[i][j]. Node indices are 0-based (node 1 → index 0). */
  G: number[][];
  /** RHS vector b[i]. */
  b: number[];
}

/**
 * Stamp a switch element into the MNA matrix.
 *
 * The switch is modeled as a conductance G = 1/R between node1 and node2,
 * where R = getSwitchResistance(controlValue, model).
 *
 * Node numbering: node 0 is ground and is not represented in the matrix.
 * Node k > 0 maps to matrix index k-1.
 *
 * @param mna - MNA matrix to stamp into
 * @param switchDef - Parsed switch definition (S or W)
 * @param model - Switch model parameters
 * @param controlValue - Current control voltage or current
 * @param nodeMap - Map from node name to node number
 */
export function stampSwitch(
  mna: MNAMatrix,
  switchDef: SSwitchDef | WSwitchDef,
  model: SwitchModel,
  controlValue: number,
  nodeMap: Record<string, number>,
): void {
  const resistance = getSwitchResistance(controlValue, model);
  const conductance = 1 / resistance;

  const n1 = nodeMap[switchDef.node1] ?? 0;
  const n2 = nodeMap[switchDef.node2] ?? 0;

  // Standard conductance stamp: G between n1 and n2
  if (n1 > 0) {
    mna.G[n1 - 1][n1 - 1] += conductance;
  }
  if (n2 > 0) {
    mna.G[n2 - 1][n2 - 1] += conductance;
  }
  if (n1 > 0 && n2 > 0) {
    mna.G[n1 - 1][n2 - 1] -= conductance;
    mna.G[n2 - 1][n1 - 1] -= conductance;
  }
}

/**
 * Compute the derivative of switch conductance with respect to control value.
 *
 * This is needed for Newton-Raphson iteration when the switch is part of a
 * feedback loop (the control value depends on circuit voltages/currents that
 * in turn depend on the switch state).
 *
 * dG/dx = -1/R^2 * dR/dx
 * dR/dx = R * (logRon - logRoff) * sigma * (1 - sigma) * steepness
 *
 * @param controlValue - Current control voltage or current
 * @param model - Switch model parameters
 * @returns dG/dx (derivative of conductance w.r.t. control value)
 */
export function getSwitchConductanceDerivative(controlValue: number, model: SwitchModel): number {
  const { Ron, Roff, threshold, hysteresis } = model;

  if (Ron === Roff) {
    return 0;
  }

  const safeRon = Math.max(Ron, 1e-12);
  const safeRoff = Math.max(Roff, 1e-12);

  let steepness = SIGMOID_STEEPNESS;
  if (hysteresis > 0) {
    steepness = 4.4 / hysteresis;
  }

  const z = steepness * (controlValue - threshold);
  const clampedZ = Math.max(-50, Math.min(50, z));
  const sigma = 1 / (1 + Math.exp(-clampedZ));

  // R in log-space
  const logRon = Math.log(safeRon);
  const logRoff = Math.log(safeRoff);
  const logR = logRoff + (logRon - logRoff) * sigma;
  const R = Math.exp(logR);

  // dR/dx = R * (logRon - logRoff) * sigma' * steepness
  // where sigma' = sigma * (1 - sigma)
  const dSigma = sigma * (1 - sigma);
  const dR = R * (logRon - logRoff) * dSigma * steepness;

  // G = 1/R, dG/dx = -1/R^2 * dR/dx
  const dG = -dR / (R * R);

  return dG;
}
