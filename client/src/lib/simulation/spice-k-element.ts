/**
 * SPICE K Element — Mutual Inductance / Transformer (BL-0511)
 *
 * Models magnetic coupling between two inductors using the SPICE K statement:
 *   K<name> L<ref1> L<ref2> <coupling>
 *
 * Physics:
 *   M = k * sqrt(L1 * L2)      — mutual inductance
 *   N1:N2 = sqrt(L1/L2)        — turns ratio (ideal transformer)
 *
 * MNA stamping for mutual inductance between inductors:
 *   In MNA, each inductor L with branch current variable i_L is modeled as a
 *   voltage source with V_L = L * di_L/dt. For DC analysis, inductors are short
 *   circuits (V = 0). In the frequency domain, V_L = jωL * I_L.
 *
 *   Mutual inductance M between two inductors adds cross-coupling:
 *     V_L1 = jωL1 * I_L1 + jωM * I_L2
 *     V_L2 = jωM * I_L1 + jωL2 * I_L2
 *
 *   In the MNA matrix, the off-diagonal terms for the two inductor branch
 *   equations get stamps proportional to M.
 *
 * References:
 *   - Vladimirescu, "The SPICE Book"
 *   - Nagel & Pederson, "SPICE (Simulation Program with IC Emphasis)"
 *   - Sedra & Smith, "Microelectronic Circuits" — transformer models
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed SPICE K element definition. */
export interface KElementDef {
  /** K element name (e.g., "K1"). */
  name: string;
  /** Name of the first coupled inductor (e.g., "L1"). */
  inductor1: string;
  /** Name of the second coupled inductor (e.g., "L2"). */
  inductor2: string;
  /** Coupling coefficient k, where 0 <= k <= 1. */
  coupling: number;
}

/** Inductor definition needed for mutual inductance calculations. */
export interface InductorDef {
  /** Inductor name (e.g., "L1"). */
  name: string;
  /** Positive node number. */
  node1: number;
  /** Negative node number. */
  node2: number;
  /** Inductance value in henries. */
  inductance: number;
}

/** Transformer model derived from coupled inductors. */
export interface TransformerModel {
  /** Primary inductance in henries. */
  primary: number;
  /** Secondary inductance in henries. */
  secondary: number;
  /** Coupling coefficient (0 to 1). */
  coupling: number;
  /** Turns ratio N1:N2 = sqrt(L1/L2). */
  turnsRatio: number;
  /** Mutual inductance M = k * sqrt(L1 * L2) in henries. */
  mutualInductance: number;
}

/** Result of computing mutual inductance parameters. */
export interface MutualInductanceResult {
  /** Mutual inductance M in henries. */
  M: number;
  /** Coupling coefficient k. */
  k: number;
  /** Primary inductance L1 in henries. */
  L1: number;
  /** Secondary inductance L2 in henries. */
  L2: number;
  /** Turns ratio sqrt(L1/L2). */
  turnsRatio: number;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a SPICE K element statement.
 *
 * Format: K<name> L<ref1> L<ref2> <coupling>
 * Examples:
 *   K1 L1 L2 0.99
 *   KXFMR LPRI LSEC 1
 *   K_couple La Lb 0.5
 *
 * @throws Error if the line cannot be parsed or has invalid values.
 */
export function parseKElement(line: string): KElementDef {
  const trimmed = line.trim();
  if (!trimmed) {
    throw new Error('K element line is empty');
  }

  // Split on whitespace
  const tokens = trimmed.split(/\s+/);

  if (tokens.length < 4) {
    throw new Error(
      `K element requires 4 fields (name, inductor1, inductor2, coupling), got ${String(tokens.length)}: "${trimmed}"`,
    );
  }

  const name = tokens[0];

  // Validate name starts with K (case-insensitive)
  if (!name.toUpperCase().startsWith('K')) {
    throw new Error(`K element name must start with 'K', got "${name}"`);
  }

  const inductor1 = tokens[1];
  const inductor2 = tokens[2];

  // Validate inductor references start with L (case-insensitive)
  if (!inductor1.toUpperCase().startsWith('L')) {
    throw new Error(`First inductor reference must start with 'L', got "${inductor1}"`);
  }
  if (!inductor2.toUpperCase().startsWith('L')) {
    throw new Error(`Second inductor reference must start with 'L', got "${inductor2}"`);
  }

  // Parse coupling coefficient
  const couplingStr = tokens[3];
  const coupling = Number(couplingStr);

  if (Number.isNaN(coupling)) {
    throw new Error(`Invalid coupling coefficient "${couplingStr}" — must be a number`);
  }

  if (coupling < 0) {
    throw new Error(`Coupling coefficient must be >= 0, got ${String(coupling)}`);
  }

  if (coupling > 1) {
    throw new Error(`Coupling coefficient must be <= 1, got ${String(coupling)}`);
  }

  return { name, inductor1, inductor2, coupling };
}

// ---------------------------------------------------------------------------
// Mutual Inductance Computation
// ---------------------------------------------------------------------------

/**
 * Compute the mutual inductance M = k * sqrt(L1 * L2).
 *
 * @param k — Coupling coefficient (0 to 1).
 * @param L1 — Primary inductance in henries.
 * @param L2 — Secondary inductance in henries.
 * @returns Mutual inductance M in henries.
 * @throws Error if inputs are invalid.
 */
export function computeMutualInductance(k: number, L1: number, L2: number): number {
  if (k < 0 || k > 1) {
    throw new Error(`Coupling coefficient k must be in [0, 1], got ${String(k)}`);
  }
  if (L1 < 0) {
    throw new Error(`Inductance L1 must be >= 0, got ${String(L1)}`);
  }
  if (L2 < 0) {
    throw new Error(`Inductance L2 must be >= 0, got ${String(L2)}`);
  }
  return k * Math.sqrt(L1 * L2);
}

/**
 * Compute the full set of mutual inductance parameters for a K element.
 */
export function computeMutualInductanceParams(
  kDef: KElementDef,
  inductors: Map<string, InductorDef>,
): MutualInductanceResult {
  const ind1 = inductors.get(kDef.inductor1.toUpperCase());
  const ind2 = inductors.get(kDef.inductor2.toUpperCase());

  if (!ind1) {
    throw new Error(`Inductor "${kDef.inductor1}" referenced by K element "${kDef.name}" not found`);
  }
  if (!ind2) {
    throw new Error(`Inductor "${kDef.inductor2}" referenced by K element "${kDef.name}" not found`);
  }

  const L1 = ind1.inductance;
  const L2 = ind2.inductance;
  const M = computeMutualInductance(kDef.coupling, L1, L2);

  // Turns ratio: N1/N2 = sqrt(L1/L2)
  const turnsRatio = L2 > 0 ? Math.sqrt(L1 / L2) : Infinity;

  return { M, k: kDef.coupling, L1, L2, turnsRatio };
}

// ---------------------------------------------------------------------------
// MNA Matrix Stamping
// ---------------------------------------------------------------------------

/**
 * Stamp mutual inductance into the MNA matrix for DC analysis.
 *
 * In DC steady state, inductors are short circuits (di/dt = 0), so mutual
 * inductance has no effect. This function is provided for API completeness
 * but is effectively a no-op for DC.
 *
 * For transient analysis with Backward Euler:
 *   The coupled inductor companion model at time step n+1 with step h:
 *     V_L1 = (L1/h) * I_L1(n+1) - (L1/h) * I_L1(n) + (M/h) * I_L2(n+1) - (M/h) * I_L2(n)
 *     V_L2 = (M/h) * I_L1(n+1) - (M/h) * I_L1(n) + (L2/h) * I_L2(n+1) - (L2/h) * I_L2(n)
 *
 *   The mutual inductance adds cross-coupling terms (M/h) to the inductor
 *   branch equations in the MNA matrix.
 *
 * @param G — MNA conductance matrix (modified in place).
 * @param b — MNA RHS vector (modified in place).
 * @param kDef — K element definition.
 * @param inductors — Map of inductor names (UPPERCASE) to their definitions.
 * @param vsIndexMap — Map of component ID to MNA branch variable index.
 * @param h — Time step for transient analysis. If undefined, DC analysis (no-op).
 * @param prevCurrents — Previous inductor currents for transient companion model.
 */
export function stampMutualInductance(
  G: number[][],
  b: number[],
  kDef: KElementDef,
  inductors: Map<string, InductorDef>,
  vsIndexMap: Map<string, number>,
  h?: number,
  prevCurrents?: Record<string, number>,
): void {
  // In DC analysis (no h), mutual inductance has no effect — inductors are shorts
  if (h === undefined || h <= 0) {
    return;
  }

  const ind1 = inductors.get(kDef.inductor1.toUpperCase());
  const ind2 = inductors.get(kDef.inductor2.toUpperCase());
  if (!ind1 || !ind2) {
    return;
  }

  const M = computeMutualInductance(kDef.coupling, ind1.inductance, ind2.inductance);
  if (M === 0) {
    return;
  }

  // Find the MNA branch indices for both inductors
  const idx1 = vsIndexMap.get(ind1.name);
  const idx2 = vsIndexMap.get(ind2.name);
  if (idx1 === undefined || idx2 === undefined) {
    return;
  }

  const Mh = M / h;

  // Cross-coupling: mutual inductance adds off-diagonal terms between
  // the two inductor branch equations.
  // V_L1 equation (row idx1): ... + (M/h) * I_L2
  // V_L2 equation (row idx2): ... + (M/h) * I_L1
  G[idx1][idx2] -= Mh;
  G[idx2][idx1] -= Mh;

  // Companion model history terms: -(M/h) * I_prev for cross-coupled currents
  if (prevCurrents) {
    const iPrev1 = prevCurrents[ind1.name] ?? 0;
    const iPrev2 = prevCurrents[ind2.name] ?? 0;

    // The RHS gets the history contribution from the cross-coupled inductor
    b[idx1] -= Mh * iPrev2;
    b[idx2] -= Mh * iPrev1;
  }
}

/**
 * Stamp mutual inductance for AC (frequency domain) analysis.
 *
 * In the frequency domain, the coupled inductor equations are:
 *   V_L1 = jωL1 * I_L1 + jωM * I_L2
 *   V_L2 = jωM * I_L1 + jωL2 * I_L2
 *
 * This adds the jωM cross terms to the MNA matrix (imaginary part).
 *
 * @param Gimag — Imaginary part of the MNA conductance matrix.
 * @param omega — Angular frequency (2πf) in rad/s.
 * @param kDef — K element definition.
 * @param inductors — Map of inductor names (UPPERCASE) to definitions.
 * @param vsIndexMap — Map of component ID to MNA branch variable index.
 */
export function stampMutualInductanceAC(
  Gimag: number[][],
  omega: number,
  kDef: KElementDef,
  inductors: Map<string, InductorDef>,
  vsIndexMap: Map<string, number>,
): void {
  const ind1 = inductors.get(kDef.inductor1.toUpperCase());
  const ind2 = inductors.get(kDef.inductor2.toUpperCase());
  if (!ind1 || !ind2) {
    return;
  }

  const M = computeMutualInductance(kDef.coupling, ind1.inductance, ind2.inductance);
  if (M === 0) {
    return;
  }

  const idx1 = vsIndexMap.get(ind1.name);
  const idx2 = vsIndexMap.get(ind2.name);
  if (idx1 === undefined || idx2 === undefined) {
    return;
  }

  // jωM cross-coupling in the imaginary MNA matrix
  const wM = omega * M;
  Gimag[idx1][idx2] -= wM;
  Gimag[idx2][idx1] -= wM;
}

// ---------------------------------------------------------------------------
// Transformer Model
// ---------------------------------------------------------------------------

/**
 * Create an ideal transformer model from primary and secondary inductances
 * with a given coupling coefficient.
 *
 * For a perfect transformer (k = 1):
 *   V1/V2 = N1/N2 = sqrt(L1/L2)
 *   I1 * N1 = I2 * N2  (power conservation)
 *
 * @param primary — Primary inductance in henries.
 * @param secondary — Secondary inductance in henries.
 * @param coupling — Coupling coefficient (0 to 1, default 1 for ideal).
 * @returns TransformerModel with computed parameters.
 * @throws Error if inputs are invalid.
 */
export function createTransformer(
  primary: number,
  secondary: number,
  coupling: number = 1,
): TransformerModel {
  if (primary <= 0) {
    throw new Error(`Primary inductance must be > 0, got ${String(primary)}`);
  }
  if (secondary <= 0) {
    throw new Error(`Secondary inductance must be > 0, got ${String(secondary)}`);
  }
  if (coupling < 0 || coupling > 1) {
    throw new Error(`Coupling coefficient must be in [0, 1], got ${String(coupling)}`);
  }

  const mutualInductance = coupling * Math.sqrt(primary * secondary);
  const turnsRatio = Math.sqrt(primary / secondary);

  return {
    primary,
    secondary,
    coupling,
    turnsRatio,
    mutualInductance,
  };
}

// ---------------------------------------------------------------------------
// Transformer Power Analysis
// ---------------------------------------------------------------------------

/**
 * Compute power transfer through a transformer given terminal voltages and currents.
 *
 * P_primary = V1 * I1
 * P_secondary = V2 * I2
 * Efficiency = P_secondary / P_primary (for k < 1, some power is lost to leakage)
 *
 * @returns Object with primary power, secondary power, efficiency, and leakage.
 */
export function computeTransformerPower(
  V1: number,
  I1: number,
  V2: number,
  I2: number,
): { primaryPower: number; secondaryPower: number; efficiency: number; leakagePower: number } {
  const primaryPower = Math.abs(V1 * I1);
  const secondaryPower = Math.abs(V2 * I2);
  const efficiency = primaryPower > 0 ? secondaryPower / primaryPower : 0;
  const leakagePower = Math.max(0, primaryPower - secondaryPower);

  return { primaryPower, secondaryPower, efficiency, leakagePower };
}

/**
 * For an ideal transformer (k ≈ 1), compute expected secondary voltage/current
 * from primary values and the turns ratio.
 *
 *   V2 = V1 / n     where n = N1/N2 = sqrt(L1/L2)
 *   I2 = I1 * n     (power conservation)
 */
export function idealTransformerRelations(
  model: TransformerModel,
  V1: number,
  I1: number,
): { V2: number; I2: number } {
  const n = model.turnsRatio;
  return {
    V2: n > 0 ? V1 / n : 0,
    I2: I1 * n,
  };
}

/**
 * Validate a K element against available inductors.
 * Returns an array of error messages (empty if valid).
 */
export function validateKElement(
  kDef: KElementDef,
  inductors: Map<string, InductorDef>,
): string[] {
  const errors: string[] = [];

  if (kDef.coupling < 0 || kDef.coupling > 1) {
    errors.push(`Coupling coefficient ${String(kDef.coupling)} is out of range [0, 1]`);
  }

  if (!inductors.has(kDef.inductor1.toUpperCase())) {
    errors.push(`Inductor "${kDef.inductor1}" not found`);
  }

  if (!inductors.has(kDef.inductor2.toUpperCase())) {
    errors.push(`Inductor "${kDef.inductor2}" not found`);
  }

  if (kDef.inductor1.toUpperCase() === kDef.inductor2.toUpperCase()) {
    errors.push(`K element couples an inductor to itself ("${kDef.inductor1}")`);
  }

  return errors;
}
