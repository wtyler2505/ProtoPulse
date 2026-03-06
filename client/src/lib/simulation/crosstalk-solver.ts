/**
 * Crosstalk Solver — Capacitive and inductive coupling analysis
 *
 * Analyzes near-end crosstalk (NEXT) and far-end crosstalk (FEXT) between
 * coupled PCB traces. Models mutual capacitance and inductance from trace
 * geometry, computes coupling coefficients, and determines critical coupling
 * length from signal rise time.
 *
 * Physics basis:
 *   - Mutual capacitance: Cm ~ eps0 * erEff * len / (pi * ln(1 + 2*s/w))
 *     (parallel-plate fringe-field approximation)
 *   - Mutual inductance: Lm ~ mu0 * len / (2*pi) * ln(1 + (w/(s+w))^2)
 *     (Neumann formula approximation for parallel conductors)
 *   - NEXT coefficient: Kb = (Cm/C0 + Lm/L0) / 4
 *   - FEXT coefficient: Kf = (Lm/L0 - Cm/C0) / 2
 *   - Critical length: Lc = v * tRise / 2
 *
 * References:
 *   - Howard Johnson, "High Speed Digital Design"
 *   - Eric Bogatin, "Signal and Power Integrity — Simplified"
 *
 * Usage:
 *   import { analyzeCoupling } from './crosstalk-solver';
 *   const result = analyzeCoupling({ spacing: 0.15, height: 0.1, width: 0.15, length: 50, er: 4.4 }, 0.5e-9);
 */

import { SPEED_OF_LIGHT, EPSILON_0, MU_0 } from './transmission-line';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoupledLineParams {
  spacing: number; // mm (edge-to-edge)
  height: number; // mm (dielectric thickness)
  width: number; // mm (trace width)
  length: number; // mm (coupled length)
  er: number; // dielectric constant
}

export interface CrosstalkResult {
  nextDb: number; // near-end crosstalk in dB
  fextDb: number; // far-end crosstalk in dB
  nextVoltage: number; // peak NEXT voltage (normalized to 1V aggressor)
  fextVoltage: number; // peak FEXT voltage
  coupledLength: number; // mm
  criticalLength: number; // mm (saturation length)
  isolationDb: number; // recommended isolation
}

export interface CouplingAnalysis extends CrosstalkResult {
  mutualCapacitance: number; // F
  mutualInductance: number; // H
  kbCoeff: number; // backward coupling coefficient
  kfCoeff: number; // forward coupling coefficient
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute self-capacitance per unit length of a microstrip (F/m).
 * C0 = eps0 * erEff / Z0 * v = eps0 * erEff * sqrt(erEff) / Z0 ... simplified
 * More accurately: C0 = 1 / (v * Z0) where v = c / sqrt(erEff)
 */
function selfCapacitancePerM(er: number, width: number, height: number, thickness: number): number {
  // Effective dielectric constant (Hammerstad-Jensen)
  const ratio = height / width;
  const erEff = (er + 1) / 2 + ((er - 1) / 2) * (1 / Math.sqrt(1 + 12 / (ratio > 0 ? ratio : 1e-12)));

  // Z0 from IPC-2141
  const arg = (5.98 * height) / (0.8 * width + thickness);
  const z0 = arg > 1 ? (87 / Math.sqrt(er + 1.41)) * Math.log(arg) : 50;

  // v = c / sqrt(erEff)
  const v = SPEED_OF_LIGHT / Math.sqrt(erEff);

  // C0 = 1 / (v * Z0)
  return 1 / (v * z0);
}

/**
 * Compute self-inductance per unit length of a microstrip (H/m).
 * L0 = Z0 / v = Z0 * sqrt(erEff) / c
 */
function selfInductancePerM(er: number, width: number, height: number, thickness: number): number {
  const ratio = height / width;
  const erEff = (er + 1) / 2 + ((er - 1) / 2) * (1 / Math.sqrt(1 + 12 / (ratio > 0 ? ratio : 1e-12)));

  const arg = (5.98 * height) / (0.8 * width + thickness);
  const z0 = arg > 1 ? (87 / Math.sqrt(er + 1.41)) * Math.log(arg) : 50;

  const v = SPEED_OF_LIGHT / Math.sqrt(erEff);

  // L0 = Z0 / v
  return z0 / v;
}

/**
 * Compute propagation velocity in m/s for a microstrip.
 */
function propagationVelocity(er: number, width: number, height: number): number {
  const ratio = height / width;
  const erEff = (er + 1) / 2 + ((er - 1) / 2) * (1 / Math.sqrt(1 + 12 / (ratio > 0 ? ratio : 1e-12)));
  return SPEED_OF_LIGHT / Math.sqrt(erEff);
}

// ---------------------------------------------------------------------------
// Mutual capacitance
// ---------------------------------------------------------------------------

/**
 * Calculate mutual capacitance between two coupled traces.
 *
 * Uses a fringe-field approximation for parallel microstrip lines:
 *   Cm_per_m = eps0 * erEff / (pi * ln(1 + 2*s/w))
 *
 * Mutual capacitance increases with:
 *   - Smaller spacing (s)
 *   - Wider traces (w)
 *   - Higher dielectric constant
 *   - Longer coupled length
 *
 * @param params - Coupled line geometry
 * @returns Mutual capacitance in Farads (total for the coupled length)
 */
export function calculateMutualCapacitance(params: CoupledLineParams): number {
  const { spacing, height, width, length, er } = params;

  // Effective dielectric constant
  const ratio = height / width;
  const erEff = (er + 1) / 2 + ((er - 1) / 2) * (1 / Math.sqrt(1 + 12 / (ratio > 0 ? ratio : 1e-12)));

  // Mutual capacitance per unit length (F/m)
  // Cm = eps0 * erEff / (pi * ln(1 + 2*s/w))
  const logArg = 1 + (2 * spacing) / width;
  const cmPerM = (EPSILON_0 * erEff) / (Math.PI * Math.log(logArg));

  // Total mutual capacitance over coupled length
  const lengthM = length * 1e-3;
  return cmPerM * lengthM;
}

// ---------------------------------------------------------------------------
// Mutual inductance
// ---------------------------------------------------------------------------

/**
 * Calculate mutual inductance between two coupled traces.
 *
 * Uses the Neumann formula approximation for parallel conductors:
 *   Lm_per_m = (mu0 / (2*pi)) * ln(1 + (w/(s+w))^2)
 *
 * @param params - Coupled line geometry
 * @returns Mutual inductance in Henries (total for the coupled length)
 */
export function calculateMutualInductance(params: CoupledLineParams): number {
  const { spacing, width, length } = params;

  // Mutual inductance per unit length (H/m)
  const ratio = width / (spacing + width);
  const lmPerM = (MU_0 / (2 * Math.PI)) * Math.log(1 + ratio * ratio);

  // Total over coupled length
  const lengthM = length * 1e-3;
  return lmPerM * lengthM;
}

// ---------------------------------------------------------------------------
// NEXT (near-end crosstalk)
// ---------------------------------------------------------------------------

/**
 * Calculate near-end crosstalk (NEXT).
 *
 * The backward coupling coefficient is:
 *   Kb = (Cm/C0 + Lm/L0) / 4
 *
 * For electrically short lines (length < critical length):
 *   NEXT_voltage = Kb * (2 * length / (v * tRise))
 *
 * For electrically long lines (length >= critical length):
 *   NEXT_voltage = Kb  (saturated)
 *
 * Critical length: Lc = v * tRise / 2
 *
 * @param params - Coupled line geometry
 * @param riseTime - Signal rise time in seconds (10-90%)
 * @returns Crosstalk result for NEXT
 */
export function calculateNEXT(
  params: CoupledLineParams,
  riseTime: number,
): Pick<CrosstalkResult, 'nextDb' | 'nextVoltage' | 'criticalLength'> {
  const { spacing, height, width, length, er } = params;

  // Self parameters per unit length
  const c0PerM = selfCapacitancePerM(er, width, height, 0.035);
  const l0PerM = selfInductancePerM(er, width, height, 0.035);

  // Mutual parameters per unit length
  const lengthM = length * 1e-3;
  const cmPerM = lengthM > 0 ? calculateMutualCapacitance(params) / lengthM : 0;
  const lmPerM = lengthM > 0 ? calculateMutualInductance(params) / lengthM : 0;

  // Backward coupling coefficient
  const kb = (cmPerM / c0PerM + lmPerM / l0PerM) / 4;

  // Propagation velocity
  const v = propagationVelocity(er, width, height); // m/s

  // Critical length (m) — beyond this, NEXT saturates
  const criticalLengthM = (v * riseTime) / 2;
  const criticalLengthMm = criticalLengthM * 1e3; // convert to mm

  // NEXT voltage (normalized to 1V aggressor)
  let nextVoltage: number;
  if (lengthM >= criticalLengthM) {
    // Saturated
    nextVoltage = kb;
  } else {
    // Short coupled region — scales linearly with length
    nextVoltage = kb * (2 * lengthM) / (v * riseTime);
  }

  // Clamp to [0, 1]
  nextVoltage = Math.max(0, Math.min(1, nextVoltage));

  // Convert to dB
  const nextDb = nextVoltage > 0 ? 20 * Math.log10(nextVoltage) : -200;

  return {
    nextDb,
    nextVoltage,
    criticalLength: criticalLengthMm,
  };
}

// ---------------------------------------------------------------------------
// FEXT (far-end crosstalk)
// ---------------------------------------------------------------------------

/**
 * Calculate far-end crosstalk (FEXT).
 *
 * The forward coupling coefficient is:
 *   Kf = (Lm/L0 - Cm/C0) / 2
 *
 * FEXT voltage (proportional to coupled length and rise time derivative):
 *   FEXT_voltage = Kf * length / (v * tRise)
 *
 * FEXT does NOT saturate — it increases linearly with coupled length.
 * In a homogeneous medium (stripline), Kf → 0 due to equal velocity modes.
 *
 * @param params - Coupled line geometry
 * @param riseTime - Signal rise time in seconds
 * @returns Crosstalk result for FEXT
 */
export function calculateFEXT(
  params: CoupledLineParams,
  riseTime: number,
): Pick<CrosstalkResult, 'fextDb' | 'fextVoltage'> {
  const { spacing, height, width, length, er } = params;

  const c0PerM = selfCapacitancePerM(er, width, height, 0.035);
  const l0PerM = selfInductancePerM(er, width, height, 0.035);

  const lengthM = length * 1e-3;
  const cmPerM = lengthM > 0 ? calculateMutualCapacitance(params) / lengthM : 0;
  const lmPerM = lengthM > 0 ? calculateMutualInductance(params) / lengthM : 0;

  // Forward coupling coefficient
  const kf = (lmPerM / l0PerM - cmPerM / c0PerM) / 2;

  // Propagation velocity
  const v = propagationVelocity(er, width, height);

  // FEXT voltage (normalized)
  let fextVoltage = kf * lengthM / (v * riseTime);

  // Clamp magnitude to [0, 1]
  fextVoltage = Math.max(-1, Math.min(1, fextVoltage));

  // Convert to dB (using magnitude)
  const fextMag = Math.abs(fextVoltage);
  const fextDb = fextMag > 0 ? 20 * Math.log10(fextMag) : -200;

  return {
    fextDb,
    fextVoltage,
  };
}

// ---------------------------------------------------------------------------
// Full coupling analysis
// ---------------------------------------------------------------------------

/**
 * Perform complete crosstalk analysis between two coupled traces.
 *
 * Combines NEXT and FEXT analysis with mutual parameter calculations
 * and provides an isolation recommendation.
 *
 * @param params - Coupled line geometry
 * @param riseTime - Signal rise time in seconds
 * @returns Complete crosstalk analysis result
 */
export function analyzeCoupling(
  params: CoupledLineParams,
  riseTime: number,
): CrosstalkResult {
  const nextResult = calculateNEXT(params, riseTime);
  const fextResult = calculateFEXT(params, riseTime);

  // Isolation recommendation: worst of NEXT and FEXT, rounded down to nearest 5 dB
  const worstCrosstalk = Math.max(nextResult.nextDb, fextResult.fextDb);
  // Add 6dB margin for safety
  const isolationDb = worstCrosstalk - 6;

  return {
    nextDb: nextResult.nextDb,
    fextDb: fextResult.fextDb,
    nextVoltage: nextResult.nextVoltage,
    fextVoltage: fextResult.fextVoltage,
    coupledLength: params.length,
    criticalLength: nextResult.criticalLength,
    isolationDb,
  };
}

// ---------------------------------------------------------------------------
// Guard trace effectiveness
// ---------------------------------------------------------------------------

/**
 * Calculate the crosstalk reduction factor from a grounded guard trace.
 *
 * A guard trace between aggressor and victim reduces coupling by providing
 * a low-impedance return path that intercepts fringe fields.
 *
 * The reduction factor (0 to 1) represents the fraction of crosstalk removed.
 * A factor of 0.5 means 50% crosstalk reduction.
 *
 * Model: reduction = 1 - exp(-k * guardWidth / spacing)
 * where k depends on the guard trace grounding quality.
 *
 * @param params - Original coupled line geometry (without guard)
 * @param guardWidth - Guard trace width in mm
 * @returns Reduction factor (0 = no reduction, 1 = complete elimination)
 */
export function guardTraceReduction(
  params: CoupledLineParams,
  guardWidth: number,
): number {
  const { spacing, height } = params;

  // Guard effectiveness depends on the guard-to-aggressor spacing ratio
  // and the guard width relative to the original spacing.
  // k factor: tighter original spacing means guard trace is more effective
  const k = 2.0 * (height / (spacing + height));

  // Exponential improvement with guard width
  const reduction = 1 - Math.exp(-k * guardWidth / spacing);

  return Math.max(0, Math.min(1, reduction));
}
