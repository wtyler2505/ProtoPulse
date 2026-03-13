/**
 * SPICE T Element — Ideal Transmission Line (BL-0513)
 *
 * Models a lossless (or lossy) transmission line using the SPICE T statement:
 *   T<name> <in+> <in-> <out+> <out-> Z0=<impedance> TD=<delay> [LOSS=<dB/m>]
 *
 * Physics:
 *   A transmission line is a distributed 2-port network characterized by its
 *   characteristic impedance Z0 and propagation delay TD. The line relates
 *   voltage and current at the input port to those at the output port.
 *
 * Analysis modes:
 *   - DC: The ideal lossless line is a through-connection (wire) since at DC
 *     (f = 0) the line has zero electrical length.
 *   - AC: Uses the ABCD (chain) matrix representation:
 *       [V1]   [cosh(gamma*l)      Z0*sinh(gamma*l)] [V2]
 *       [I1] = [sinh(gamma*l)/Z0   cosh(gamma*l)   ] [I2]
 *     where gamma = j*2*pi*f*TD for lossless lines (alpha + j*beta for lossy).
 *   - Transient: Bergeron companion model — the line is replaced by two
 *     voltage sources with series resistance Z0, driven by delayed past values.
 *     v1(t) + Z0*i1(t) = v2(t-TD) + Z0*i2(t-TD)
 *     v2(t) + Z0*i2(t) = v1(t-TD) + Z0*i1(t-TD)
 *
 * References:
 *   - Dommel, "Digital Computer Solution of Electromagnetic Transients"
 *   - Vladimirescu, "The SPICE Book"
 *   - Branin, "Transient Analysis of Lossless Transmission Lines"
 *   - Paul, "Analysis of Multiconductor Transmission Lines"
 */

import { parseSpiceValue } from './spice-netlist-parser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed SPICE T (transmission line) element definition. */
export interface TLineDef {
  /** Element name (e.g., "T1"). */
  name: string;
  /** Positive input node. */
  inputPlus: string;
  /** Negative input node. */
  inputMinus: string;
  /** Positive output node. */
  outputPlus: string;
  /** Negative output node. */
  outputMinus: string;
  /** Characteristic impedance in ohms. */
  z0: number;
  /** One-way propagation delay in seconds. */
  td: number;
  /** Optional loss in nepers per second (attenuation). 0 for lossless. */
  loss: number;
}

/** Circular delay buffer for transient simulation history. */
export interface DelayBuffer {
  /** Buffer storage for (voltage, current) pairs at each sample. */
  voltages: Float64Array;
  currents: Float64Array;
  /** Number of samples the buffer can hold. */
  capacity: number;
  /** Current write index. */
  writeIndex: number;
  /** Time step used to fill the buffer. */
  dt: number;
  /** Target delay in seconds. */
  td: number;
  /** Number of valid samples written so far. */
  sampleCount: number;
}

/** Complex number as [real, imaginary]. */
export type Complex = [number, number];

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a SPICE T element statement.
 *
 * Format: T<name> <in+> <in-> <out+> <out-> Z0=<value> TD=<value> [LOSS=<value>]
 * Examples:
 *   T1 in1 gnd1 out1 gnd2 Z0=50 TD=1n
 *   T_line 1 0 2 0 Z0=75 TD=5ns LOSS=0.1
 *   TPCB a b c d Z0=100 TD=0.5n
 *
 * @throws Error if the line cannot be parsed or has invalid structure.
 */
export function parseTLine(line: string): TLineDef {
  const trimmed = line.trim();
  if (!trimmed) {
    throw new Error('T element line is empty');
  }

  const tokens = trimmed.split(/\s+/);

  // Need at least: name, 4 nodes, Z0=val, TD=val = 7 tokens
  if (tokens.length < 7) {
    throw new Error(
      `T element requires at least 7 fields (T<name> in+ in- out+ out- Z0=<v> TD=<v>), got ${String(tokens.length)}: "${trimmed}"`,
    );
  }

  const name = tokens[0];

  // Validate name starts with T (case-insensitive)
  if (!/^[Tt]/i.test(name)) {
    throw new Error(`T element name must start with 'T', got "${name}"`);
  }

  const inputPlus = tokens[1];
  const inputMinus = tokens[2];
  const outputPlus = tokens[3];
  const outputMinus = tokens[4];

  // Parse key=value parameters from remaining tokens
  const params = parseKeyValueParams(tokens.slice(5));

  const z0Raw = params['Z0'];
  const tdRaw = params['TD'];
  const lossRaw = params['LOSS'];

  if (z0Raw === undefined) {
    throw new Error(`T element "${name}" missing required parameter Z0`);
  }
  if (tdRaw === undefined) {
    throw new Error(`T element "${name}" missing required parameter TD`);
  }

  const z0 = parseSpiceValue(z0Raw);
  const td = parseSpiceValue(tdRaw);
  const loss = lossRaw !== undefined ? parseSpiceValue(lossRaw) : 0;

  if (Number.isNaN(z0)) {
    throw new Error(`T element "${name}" has invalid Z0 value: "${z0Raw}"`);
  }
  if (Number.isNaN(td)) {
    throw new Error(`T element "${name}" has invalid TD value: "${tdRaw}"`);
  }

  return { name, inputPlus, inputMinus, outputPlus, outputMinus, z0, td, loss };
}

/**
 * Parse key=value pairs from an array of tokens.
 * Returns a map of uppercase keys to raw value strings.
 */
function parseKeyValueParams(tokens: string[]): Record<string, string> {
  const params: Record<string, string> = {};
  for (const token of tokens) {
    const eqIdx = token.indexOf('=');
    if (eqIdx > 0) {
      const key = token.slice(0, eqIdx).toUpperCase();
      const val = token.slice(eqIdx + 1);
      params[key] = val;
    }
  }
  return params;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a TLineDef.
 * Returns an array of error messages (empty if valid).
 */
export function validateTLine(tline: TLineDef): string[] {
  const errors: string[] = [];

  if (!tline.name) {
    errors.push('T element name is empty');
  }

  if (!tline.inputPlus) {
    errors.push('Input positive node name is empty');
  }
  if (!tline.inputMinus) {
    errors.push('Input negative node name is empty');
  }
  if (!tline.outputPlus) {
    errors.push('Output positive node name is empty');
  }
  if (!tline.outputMinus) {
    errors.push('Output negative node name is empty');
  }

  if (tline.z0 <= 0) {
    errors.push(`Z0 must be > 0, got ${String(tline.z0)}`);
  }

  if (tline.td < 0) {
    errors.push(`TD must be >= 0, got ${String(tline.td)}`);
  }

  if (tline.loss < 0) {
    errors.push(`Loss must be >= 0, got ${String(tline.loss)}`);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// DC Stamping
// ---------------------------------------------------------------------------

/**
 * Stamp a transmission line for DC analysis.
 *
 * At DC (f = 0), an ideal lossless transmission line is electrically
 * transparent — it behaves as a wire connecting input to output. We model
 * this by stamping a very large conductance (small resistance) between
 * the input-positive and output-positive nodes, and similarly between
 * input-negative and output-negative nodes.
 *
 * The through-conductance is 1/Z0 * 1e6 (effectively a short, but finite
 * to keep the MNA matrix non-singular).
 *
 * Node numbering: node "0" or 0 is ground and is not stamped.
 *
 * @param G — Conductance matrix (modified in place).
 * @param tline — Transmission line definition.
 * @param nodeMap — Map from node name to MNA matrix index (1-based; 0 = ground).
 */
export function stampTLineDC(
  G: number[][],
  tline: TLineDef,
  nodeMap: Record<string, number>,
): void {
  // At DC the line is a wire. Model as a large conductance (G_dc) between
  // corresponding input and output nodes.
  const G_dc = 1e6; // Very large conductance ≈ short circuit

  // Connect inputPlus ↔ outputPlus
  stampConductance(G, nodeMap[tline.inputPlus] ?? 0, nodeMap[tline.outputPlus] ?? 0, G_dc);
  // Connect inputMinus ↔ outputMinus
  stampConductance(G, nodeMap[tline.inputMinus] ?? 0, nodeMap[tline.outputMinus] ?? 0, G_dc);
}

/**
 * Stamp a conductance G between nodes n1 and n2 into the MNA matrix.
 * Node 0 is ground and not represented in the matrix.
 * Nodes > 0 map to matrix index (node - 1).
 */
function stampConductance(G: number[][], n1: number, n2: number, g: number): void {
  if (n1 > 0) {
    G[n1 - 1][n1 - 1] += g;
  }
  if (n2 > 0) {
    G[n2 - 1][n2 - 1] += g;
  }
  if (n1 > 0 && n2 > 0) {
    G[n1 - 1][n2 - 1] -= g;
    G[n2 - 1][n1 - 1] -= g;
  }
}

// ---------------------------------------------------------------------------
// AC Stamping (Frequency Domain)
// ---------------------------------------------------------------------------

/**
 * Stamp a transmission line for AC (frequency-domain) analysis.
 *
 * Uses the ABCD (chain/transfer) matrix of a transmission line:
 *
 *   [V1]   [A  B] [V2]       A = cosh(gamma*l)
 *   [I1] = [C  D] [I2]       B = Z0 * sinh(gamma*l)
 *                              C = sinh(gamma*l) / Z0
 *                              D = cosh(gamma*l)
 *
 * where gamma = alpha + j*beta, and for a lossless line:
 *   alpha = 0 (or loss-derived attenuation)
 *   beta = 2*pi*f*TD / l  (but since we parameterize by TD, gamma*l = j*2*pi*f*TD)
 *
 * The ABCD matrix is converted to a Y-parameter (admittance) matrix for
 * direct MNA stamping:
 *
 *   Y11 = D/B,  Y12 = -1/(B) * (AD - BC) = -(AD-BC)/B
 *   Y21 = -1/B, Y22 = A/B
 *
 * For a reciprocal line AD - BC = 1, so:
 *   Y11 = Y22 = cosh(gamma*l) / (Z0 * sinh(gamma*l)) = 1/(Z0 * tanh(gamma*l))
 *   Y12 = Y21 = -1 / (Z0 * sinh(gamma*l))
 *
 * @param Greal — Real part of MNA conductance matrix (modified in place).
 * @param Gimag — Imaginary part of MNA conductance matrix (modified in place).
 * @param freq — Frequency in Hz.
 * @param tline — Transmission line definition.
 * @param nodeMap — Map from node name to MNA index (1-based; 0 = ground).
 */
export function stampTLineAC(
  Greal: number[][],
  Gimag: number[][],
  freq: number,
  tline: TLineDef,
  nodeMap: Record<string, number>,
): void {
  const n1p = nodeMap[tline.inputPlus] ?? 0;
  const n1m = nodeMap[tline.inputMinus] ?? 0;
  const n2p = nodeMap[tline.outputPlus] ?? 0;
  const n2m = nodeMap[tline.outputMinus] ?? 0;

  // Handle zero delay: line is a wire
  if (tline.td === 0) {
    const G_dc = 1e6;
    stampConductance(Greal, n1p, n2p, G_dc);
    stampConductance(Greal, n1m, n2m, G_dc);
    return;
  }

  const omega = 2 * Math.PI * freq;
  const theta = omega * tline.td; // Electrical length in radians

  // Complex propagation: gamma*l = alpha*TD + j*theta
  // For lossless: alpha = 0. For lossy: alpha contributes real attenuation.
  const alphaL = tline.loss * tline.td; // attenuation in nepers

  // cosh(gamma*l) = cosh(alphaL + j*theta) = cosh(alphaL)*cos(theta) + j*sinh(alphaL)*sin(theta)
  const coshR = Math.cosh(alphaL) * Math.cos(theta);
  const coshI = Math.sinh(alphaL) * Math.sin(theta);

  // sinh(gamma*l) = sinh(alphaL + j*theta) = sinh(alphaL)*cos(theta) + j*cosh(alphaL)*sin(theta)
  const sinhR = Math.sinh(alphaL) * Math.cos(theta);
  const sinhI = Math.cosh(alphaL) * Math.sin(theta);

  // B = Z0 * sinh(gamma*l) — complex
  const Br = tline.z0 * sinhR;
  const Bi = tline.z0 * sinhI;

  // |B|^2
  const Bmag2 = Br * Br + Bi * Bi;

  // Handle degenerate case (freq = 0 with zero theta)
  if (Bmag2 < 1e-30) {
    const G_dc = 1e6;
    stampConductance(Greal, n1p, n2p, G_dc);
    stampConductance(Greal, n1m, n2m, G_dc);
    return;
  }

  // Y11 = Y22 = cosh(gamma*l) / B = cosh / (Z0 * sinh)
  // Complex division: (coshR + j*coshI) / (Br + j*Bi)
  const y11r = (coshR * Br + coshI * Bi) / Bmag2;
  const y11i = (coshI * Br - coshR * Bi) / Bmag2;

  // Y12 = Y21 = -1/B
  // -1/(Br + j*Bi) = -Br/(Br^2+Bi^2) + j*Bi/(Br^2+Bi^2)
  const y12r = -Br / Bmag2;
  const y12i = Bi / Bmag2;

  // Stamp the 2-port Y-parameters into the MNA matrix.
  // The transmission line is a 4-terminal device with differential ports:
  //   Port 1: (n1p, n1m), Port 2: (n2p, n2m)
  //
  // I(n1p) =  Y11 * V(n1p-n1m) + Y12 * V(n2p-n2m)
  // I(n2p) =  Y21 * V(n1p-n1m) + Y22 * V(n2p-n2m)
  //
  // This expands to individual node stamps for each Y element.

  // Y11 stamp (port 1 self-admittance)
  stampComplexAdmittance(Greal, Gimag, n1p, n1m, y11r, y11i);

  // Y22 stamp (port 2 self-admittance) — same as Y11 for symmetric line
  stampComplexAdmittance(Greal, Gimag, n2p, n2m, y11r, y11i);

  // Y12 stamp (port 1 to port 2 mutual admittance)
  stampComplexMutualAdmittance(Greal, Gimag, n1p, n1m, n2p, n2m, y12r, y12i);

  // Y21 stamp (port 2 to port 1) — same as Y12 for reciprocal line
  stampComplexMutualAdmittance(Greal, Gimag, n2p, n2m, n1p, n1m, y12r, y12i);
}

/**
 * Stamp a complex self-admittance Y between differential nodes (np, nm).
 * Expands: I(np) - I(nm) = Y * (V(np) - V(nm))
 */
function stampComplexAdmittance(
  Gr: number[][],
  Gi: number[][],
  np: number,
  nm: number,
  yr: number,
  yi: number,
): void {
  if (np > 0) {
    Gr[np - 1][np - 1] += yr;
    Gi[np - 1][np - 1] += yi;
  }
  if (nm > 0) {
    Gr[nm - 1][nm - 1] += yr;
    Gi[nm - 1][nm - 1] += yi;
  }
  if (np > 0 && nm > 0) {
    Gr[np - 1][nm - 1] -= yr;
    Gi[np - 1][nm - 1] -= yi;
    Gr[nm - 1][np - 1] -= yr;
    Gi[nm - 1][np - 1] -= yi;
  }
}

/**
 * Stamp complex mutual admittance Y between port (np1, nm1) driven by port (np2, nm2).
 * I(np1) += Y * V(np2),  I(np1) -= Y * V(nm2), etc.
 */
function stampComplexMutualAdmittance(
  Gr: number[][],
  Gi: number[][],
  np1: number,
  nm1: number,
  np2: number,
  nm2: number,
  yr: number,
  yi: number,
): void {
  // I(np1) += Y * V(np2)
  if (np1 > 0 && np2 > 0) {
    Gr[np1 - 1][np2 - 1] += yr;
    Gi[np1 - 1][np2 - 1] += yi;
  }
  // I(np1) -= Y * V(nm2)
  if (np1 > 0 && nm2 > 0) {
    Gr[np1 - 1][nm2 - 1] -= yr;
    Gi[np1 - 1][nm2 - 1] -= yi;
  }
  // I(nm1) -= Y * V(np2)
  if (nm1 > 0 && np2 > 0) {
    Gr[nm1 - 1][np2 - 1] -= yr;
    Gi[nm1 - 1][np2 - 1] -= yi;
  }
  // I(nm1) += Y * V(nm2)
  if (nm1 > 0 && nm2 > 0) {
    Gr[nm1 - 1][nm2 - 1] += yr;
    Gi[nm1 - 1][nm2 - 1] += yi;
  }
}

// ---------------------------------------------------------------------------
// Transient Stamping (Bergeron Companion Model)
// ---------------------------------------------------------------------------

/**
 * Create a delay buffer for transient simulation.
 *
 * The buffer stores past voltage and current values at each time step,
 * allowing retrieval of values at time (t - TD) via linear interpolation.
 *
 * @param td — Propagation delay in seconds.
 * @param dt — Simulation time step in seconds.
 * @returns A new DelayBuffer sized to hold at least ceil(TD/dt) + 2 samples.
 */
export function createDelayBuffer(td: number, dt: number): DelayBuffer {
  if (dt <= 0) {
    throw new Error(`Time step dt must be > 0, got ${String(dt)}`);
  }
  if (td < 0) {
    throw new Error(`Delay td must be >= 0, got ${String(td)}`);
  }

  // Need enough samples to cover the delay, plus margin for interpolation
  const capacity = Math.max(Math.ceil(td / dt) + 2, 4);

  return {
    voltages: new Float64Array(capacity),
    currents: new Float64Array(capacity),
    capacity,
    writeIndex: 0,
    dt,
    td,
    sampleCount: 0,
  };
}

/**
 * Push a new (voltage, current) sample into the delay buffer.
 */
export function pushDelayBuffer(buf: DelayBuffer, voltage: number, current: number): void {
  buf.voltages[buf.writeIndex] = voltage;
  buf.currents[buf.writeIndex] = current;
  buf.writeIndex = (buf.writeIndex + 1) % buf.capacity;
  buf.sampleCount++;
}

/**
 * Retrieve a delayed value from the buffer using linear interpolation.
 *
 * Returns the value at time (t_current - delay) where t_current corresponds
 * to the most recently pushed sample.
 *
 * @param buf — The delay buffer.
 * @returns [voltage, current] at time (t - TD), or [0, 0] if not enough history.
 */
export function getDelayedValue(buf: DelayBuffer): [number, number] {
  if (buf.sampleCount < 2) {
    return [0, 0];
  }

  // Number of samples back we need to go
  const samplesBack = buf.td / buf.dt;

  // Integer part and fractional part for interpolation
  const intSamples = Math.floor(samplesBack);
  const frac = samplesBack - intSamples;

  // Clamp to available history
  const maxBack = Math.min(buf.sampleCount - 1, buf.capacity - 1);

  const idx1Back = Math.min(intSamples, maxBack);
  const idx2Back = Math.min(intSamples + 1, maxBack);

  // Convert "samples back from most recent" to buffer indices
  // Most recent sample is at writeIndex - 1
  const mostRecent = (buf.writeIndex - 1 + buf.capacity) % buf.capacity;
  const i1 = (mostRecent - idx1Back + buf.capacity) % buf.capacity;
  const i2 = (mostRecent - idx2Back + buf.capacity) % buf.capacity;

  // Linear interpolation
  const v = buf.voltages[i1] * (1 - frac) + buf.voltages[i2] * frac;
  const c = buf.currents[i1] * (1 - frac) + buf.currents[i2] * frac;

  return [v, c];
}

/**
 * Stamp a transmission line for transient analysis using the Bergeron
 * companion model.
 *
 * The Bergeron model replaces the transmission line with two decoupled
 * companion circuits, one at each port. Each port sees a resistance Z0
 * in series with a history-dependent voltage source:
 *
 *   Port 1: v1(t) + Z0*i1(t) = e1(t)
 *     where e1(t) = v2(t-TD) + Z0*i2(t-TD)  (history from port 2)
 *
 *   Port 2: v2(t) + Z0*i2(t) = e2(t)
 *     where e2(t) = v1(t-TD) + Z0*i1(t-TD)  (history from port 1)
 *
 * In the MNA matrix, each port is stamped as:
 *   - Conductance G = 1/Z0 between the port nodes (self-admittance)
 *   - Current source I_eq = e(t) / Z0 injected at the port nodes (RHS)
 *
 * @param G — Conductance matrix (modified in place).
 * @param b — RHS vector (modified in place).
 * @param tline — Transmission line definition.
 * @param nodeMap — Map from node name to MNA index (1-based; 0 = ground).
 * @param histPort1 — Delay buffer storing port 1 past values.
 * @param histPort2 — Delay buffer storing port 2 past values.
 */
export function stampTLineTransient(
  G: number[][],
  b: number[],
  tline: TLineDef,
  nodeMap: Record<string, number>,
  histPort1: DelayBuffer,
  histPort2: DelayBuffer,
): void {
  const n1p = nodeMap[tline.inputPlus] ?? 0;
  const n1m = nodeMap[tline.inputMinus] ?? 0;
  const n2p = nodeMap[tline.outputPlus] ?? 0;
  const n2m = nodeMap[tline.outputMinus] ?? 0;

  // Zero delay: wire through
  if (tline.td === 0 || tline.z0 <= 0) {
    const G_dc = 1e6;
    stampConductance(G, n1p, n2p, G_dc);
    stampConductance(G, n1m, n2m, G_dc);
    return;
  }

  const g = 1 / tline.z0; // Conductance = 1/Z0

  // Attenuation factor for lossy lines
  const atten = tline.loss > 0 ? Math.exp(-tline.loss * tline.td) : 1;

  // Port 1: stamp G = 1/Z0 as self-admittance
  stampConductance(G, n1p, n1m, g);

  // Port 2: stamp G = 1/Z0 as self-admittance
  stampConductance(G, n2p, n2m, g);

  // History sources from delay buffers:
  // e1 = v2_delayed + Z0 * i2_delayed (drives port 1)
  // e2 = v1_delayed + Z0 * i1_delayed (drives port 2)
  const [v2d, i2d] = getDelayedValue(histPort2);
  const [v1d, i1d] = getDelayedValue(histPort1);

  const e1 = atten * (v2d + tline.z0 * i2d);
  const e2 = atten * (v1d + tline.z0 * i1d);

  // Inject equivalent current sources: I_eq = e / Z0 = e * g
  const ieq1 = e1 * g;
  const ieq2 = e2 * g;

  // Port 1 current injection
  if (n1p > 0) {
    b[n1p - 1] += ieq1;
  }
  if (n1m > 0) {
    b[n1m - 1] -= ieq1;
  }

  // Port 2 current injection
  if (n2p > 0) {
    b[n2p - 1] += ieq2;
  }
  if (n2m > 0) {
    b[n2m - 1] -= ieq2;
  }
}

// ---------------------------------------------------------------------------
// Physical Parameter Helpers
// ---------------------------------------------------------------------------

/**
 * Compute characteristic impedance from per-unit-length parameters.
 *
 *   Z0 = sqrt(L / C)
 *
 * where L is inductance per meter and C is capacitance per meter.
 *
 * @param L_per_m — Inductance per unit length in H/m.
 * @param C_per_m — Capacitance per unit length in F/m.
 * @returns Characteristic impedance Z0 in ohms.
 * @throws Error if inputs are invalid.
 */
export function computeCharacteristicImpedance(L_per_m: number, C_per_m: number): number {
  if (L_per_m <= 0) {
    throw new Error(`L per meter must be > 0, got ${String(L_per_m)}`);
  }
  if (C_per_m <= 0) {
    throw new Error(`C per meter must be > 0, got ${String(C_per_m)}`);
  }
  return Math.sqrt(L_per_m / C_per_m);
}

/**
 * Compute one-way propagation delay from per-unit-length parameters and length.
 *
 *   TD = length * sqrt(L * C)
 *
 * The propagation velocity is v = 1/sqrt(L*C), so TD = length / v.
 *
 * @param L_per_m — Inductance per unit length in H/m.
 * @param C_per_m — Capacitance per unit length in F/m.
 * @param length — Physical length of the line in meters.
 * @returns Propagation delay in seconds.
 * @throws Error if inputs are invalid.
 */
export function computePropagationDelay(L_per_m: number, C_per_m: number, length: number): number {
  if (L_per_m <= 0) {
    throw new Error(`L per meter must be > 0, got ${String(L_per_m)}`);
  }
  if (C_per_m <= 0) {
    throw new Error(`C per meter must be > 0, got ${String(C_per_m)}`);
  }
  if (length < 0) {
    throw new Error(`Length must be >= 0, got ${String(length)}`);
  }
  return length * Math.sqrt(L_per_m * C_per_m);
}

/**
 * Compute propagation velocity from per-unit-length parameters.
 *
 *   v_p = 1 / sqrt(L * C)
 *
 * For a transmission line in a dielectric medium:
 *   v_p = c / sqrt(epsilon_r) where c = 3e8 m/s
 *
 * @param L_per_m — Inductance per unit length in H/m.
 * @param C_per_m — Capacitance per unit length in F/m.
 * @returns Propagation velocity in m/s.
 */
export function computePropagationVelocity(L_per_m: number, C_per_m: number): number {
  if (L_per_m <= 0) {
    throw new Error(`L per meter must be > 0, got ${String(L_per_m)}`);
  }
  if (C_per_m <= 0) {
    throw new Error(`C per meter must be > 0, got ${String(C_per_m)}`);
  }
  return 1 / Math.sqrt(L_per_m * C_per_m);
}

/**
 * Compute wavelength at a given frequency for a transmission line.
 *
 *   lambda = v_p / f
 *
 * @param freq — Frequency in Hz.
 * @param L_per_m — Inductance per unit length in H/m.
 * @param C_per_m — Capacitance per unit length in F/m.
 * @returns Wavelength in meters.
 */
export function computeWavelength(freq: number, L_per_m: number, C_per_m: number): number {
  if (freq <= 0) {
    throw new Error(`Frequency must be > 0, got ${String(freq)}`);
  }
  const vp = computePropagationVelocity(L_per_m, C_per_m);
  return vp / freq;
}

/**
 * Compute the electrical length of a transmission line in degrees.
 *
 *   theta = 360 * f * TD  (degrees)
 *   theta = 2 * pi * f * TD  (radians)
 *
 * @param freq — Frequency in Hz.
 * @param td — Propagation delay in seconds.
 * @returns Electrical length in degrees.
 */
export function computeElectricalLength(freq: number, td: number): number {
  return 360 * freq * td;
}
