/**
 * Transmission Line Models — Frequency-dependent impedance and loss
 *
 * Provides analytical models for microstrip, stripline, and differential pair
 * transmission lines. Includes conductor loss (skin effect), dielectric loss,
 * insertion loss (S21), return loss (S11), and impedance-vs-frequency sweeps.
 *
 * All geometries use mm for lengths. Internal calculations convert to SI (meters)
 * as needed. Loss results are in dB.
 *
 * Physics references:
 *   - IPC-2141: Controlled Impedance Circuit Boards and High Speed Logic Design
 *   - Wadell, "Transmission Line Design Handbook"
 *   - Pozar, "Microwave Engineering" (4th ed.)
 *
 * Usage:
 *   import { microstripZ0, insertionLoss } from './transmission-line';
 *   const z = microstripZ0({ width: 0.2, height: 0.1, thickness: 0.035, er: 4.4, tanD: 0.02, length: 50 });
 */

// ---------------------------------------------------------------------------
// Physical constants (exported for tests / external use)
// ---------------------------------------------------------------------------

/** Speed of light in vacuum (m/s). */
export const SPEED_OF_LIGHT = 299792458;

/** Conductivity of copper (S/m). */
export const COPPER_CONDUCTIVITY = 5.8e7;

/** Permeability of free space (H/m). */
export const MU_0 = 4 * Math.PI * 1e-7;

/** Permittivity of free space (F/m). */
export const EPSILON_0 = 8.854e-12;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransmissionLineParams {
  width: number; // mm (trace width)
  height: number; // mm (dielectric thickness to reference plane)
  thickness: number; // mm (copper thickness, typically 0.035 for 1oz)
  er: number; // relative permittivity
  tanD: number; // loss tangent
  length: number; // mm (trace length)
}

export interface TransmissionLineResult {
  z0: number; // characteristic impedance (ohms)
  erEff: number; // effective dielectric constant
  delay: number; // propagation delay (ps/mm)
  velocity: number; // propagation velocity (mm/ps)
}

export interface LossResult {
  conductorLoss: number; // dB
  dielectricLoss: number; // dB
  totalLoss: number; // dB
  lossPerMm: number; // dB/mm
}

export interface ImpedancePoint {
  frequency: number; // Hz
  z0: number; // ohms (characteristic impedance at this frequency)
  loss: number; // dB total insertion loss at this frequency
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateParams(params: TransmissionLineParams): void {
  if (params.width <= 0) {
    throw new Error('Trace width must be greater than zero');
  }
  if (params.height <= 0) {
    throw new Error('Dielectric height must be greater than zero');
  }
  if (params.thickness < 0) {
    throw new Error('Copper thickness must be non-negative');
  }
  if (params.er < 1) {
    throw new Error('Relative permittivity (er) must be >= 1');
  }
}

// ---------------------------------------------------------------------------
// Microstrip impedance — IPC-2141 formula
// ---------------------------------------------------------------------------

/**
 * Calculate microstrip characteristic impedance.
 *
 * Formula (IPC-2141):
 *   Z0 = 87 / sqrt(er + 1.41) * ln(5.98 * h / (0.8 * w + t))
 *
 * Also computes effective dielectric constant (Hammerstad-Jensen):
 *   erEff = (er+1)/2 + (er-1)/2 * 1/sqrt(1 + 12*h/w)
 *
 * @param params - Transmission line geometry and material
 * @returns Impedance, effective er, delay, and velocity
 */
export function microstripZ0(params: TransmissionLineParams): TransmissionLineResult {
  validateParams(params);

  const { width, height, thickness, er } = params;

  // IPC-2141 impedance formula
  const arg = (5.98 * height) / (0.8 * width + thickness);
  if (arg <= 1) {
    // Log argument must be > 1 for positive impedance
    throw new Error('Geometry produces non-physical impedance — trace too wide or dielectric too thin');
  }

  const z0 = (87 / Math.sqrt(er + 1.41)) * Math.log(arg);

  // Hammerstad-Jensen effective dielectric constant
  const ratio = height / width;
  const erEff = (er + 1) / 2 + ((er - 1) / 2) * (1 / Math.sqrt(1 + 12 / (ratio > 0 ? ratio : 1e-12)));

  // Propagation velocity: v = c / sqrt(erEff)
  // velocity in mm/ps: c_mm_per_ps = c * 1e-9 (since 1 ps = 1e-12 s, and 1 mm = 1e-3 m)
  const cMmPerPs = SPEED_OF_LIGHT * 1e-9; // mm/ps
  const velocity = cMmPerPs / Math.sqrt(erEff);

  // Propagation delay: delay = 1/velocity (ps/mm)
  const delay = 1 / velocity;

  return { z0, erEff, delay, velocity };
}

// ---------------------------------------------------------------------------
// Stripline impedance
// ---------------------------------------------------------------------------

/**
 * Calculate stripline characteristic impedance.
 *
 * Formula:
 *   Z0 = 60 / sqrt(er) * ln(4 * b / (0.67 * pi * (0.8 * w + t)))
 *
 * where b = 2 * height (total dielectric thickness between both reference planes).
 *
 * For stripline, erEff = er (fully embedded in dielectric).
 *
 * @param params - Transmission line geometry and material
 * @returns Impedance, effective er, delay, and velocity
 */
export function striplineZ0(params: TransmissionLineParams): TransmissionLineResult {
  validateParams(params);

  const { width, height, thickness, er } = params;
  const b = 2 * height; // total thickness between reference planes

  const arg = (4 * b) / (0.67 * Math.PI * (0.8 * width + thickness));
  if (arg <= 1) {
    throw new Error('Geometry produces non-physical impedance — trace too wide or dielectric too thin');
  }

  const z0 = (60 / Math.sqrt(er)) * Math.log(arg);

  // Stripline effective er equals the bulk dielectric constant
  const erEff = er;

  const cMmPerPs = SPEED_OF_LIGHT * 1e-9;
  const velocity = cMmPerPs / Math.sqrt(erEff);
  const delay = 1 / velocity;

  return { z0, erEff, delay, velocity };
}

// ---------------------------------------------------------------------------
// Differential impedance — coupled microstrips
// ---------------------------------------------------------------------------

/**
 * Calculate differential impedance from coupled microstrips.
 *
 * Uses the odd-mode impedance approximation:
 *   Zdiff = 2 * Z0_single * (1 - 0.48 * exp(-0.96 * s/h))
 *
 * where s = edge-to-edge spacing (mm).
 *
 * @param params - Transmission line geometry (single trace)
 * @param spacing - Edge-to-edge spacing between the two traces (mm)
 * @returns Differential impedance result
 */
export function differentialZ0(
  params: TransmissionLineParams,
  spacing: number,
): TransmissionLineResult {
  const single = microstripZ0(params);

  // Coupling factor: approaches 1 for very wide spacing (uncoupled)
  const couplingFactor = 1 - 0.48 * Math.exp(-0.96 * (spacing / params.height));
  const zDiff = 2 * single.z0 * couplingFactor;

  return {
    z0: zDiff,
    erEff: single.erEff,
    delay: single.delay,
    velocity: single.velocity,
  };
}

// ---------------------------------------------------------------------------
// Conductor loss (skin effect)
// ---------------------------------------------------------------------------

/**
 * Calculate conductor loss due to skin effect at a given frequency.
 *
 * Physics:
 *   Skin depth: delta = 1 / sqrt(pi * f * mu0 * sigma)
 *   Surface resistance: Rs = 1 / (sigma * delta)
 *   Loss per unit length (Np/m): alpha_c = Rs / (w * Z0) (simplified for microstrip)
 *   We use a width-based model: alpha_c = Rs / (w_m) where w_m is trace width in meters.
 *
 * @param frequency - Frequency in Hz
 * @param width - Trace width in mm
 * @param thickness - Copper thickness in mm
 * @param length - Trace length in mm
 * @returns Conductor loss in dB (positive)
 */
export function skinEffectLoss(
  frequency: number,
  width: number,
  thickness: number,
  length: number,
): number {
  if (frequency <= 0) {
    return 0;
  }
  if (width <= 0 || length <= 0) {
    return 0;
  }

  // Skin depth in meters
  const delta = 1 / Math.sqrt(Math.PI * frequency * MU_0 * COPPER_CONDUCTIVITY);

  // Surface resistance (ohms/square)
  const rs = 1 / (COPPER_CONDUCTIVITY * delta);

  // Effective conducting width: use trace width in meters
  const widthM = width * 1e-3;
  const thicknessM = thickness * 1e-3;

  // For a microstrip, current flows on both surfaces of the conductor.
  // Effective perimeter for current: ~ 2*(width + thickness) for a rectangular conductor.
  // At high freq, current concentrates in skin depth on the surfaces.
  const effectivePerimeter = 2 * (widthM + thicknessM);

  // Resistance per unit length (ohms/m)
  const rPerM = rs / effectivePerimeter;

  // Loss in dB over the trace length
  // P_loss = I^2 * R; for a matched line, alpha = R/(2*Z0) Np/m
  // But for a simpler, Z0-independent model: loss_dB = 8.686 * rPerM * length_m / Z0_typical
  // We use a Z0-agnostic approach: attenuation = Rs * length / (width * some_normalizer)
  // More accurately: alpha_c (dB/m) = 8.686 * Rs / (2 * width_m) for surface-current model
  const lengthM = length * 1e-3;
  const alphaDbPerM = 8.686 * rs / (effectivePerimeter);
  const totalLossDb = alphaDbPerM * lengthM;

  return totalLossDb;
}

// ---------------------------------------------------------------------------
// Dielectric loss
// ---------------------------------------------------------------------------

/**
 * Calculate dielectric loss.
 *
 * Formula:
 *   alpha_d = (pi * f * sqrt(erEff) * tanD) / c   [Np/m]
 *   Loss in dB = 8.686 * alpha_d * length
 *
 * @param frequency - Frequency in Hz
 * @param erEff - Effective dielectric constant
 * @param tanD - Loss tangent
 * @param length - Trace length in mm
 * @returns Dielectric loss in dB (positive)
 */
export function dielectricLoss(
  frequency: number,
  erEff: number,
  tanD: number,
  length: number,
): number {
  if (frequency <= 0 || tanD <= 0 || length <= 0) {
    return 0;
  }

  // Attenuation constant in Np/m
  const alphaNpPerM = (Math.PI * frequency * Math.sqrt(erEff) * tanD) / SPEED_OF_LIGHT;

  // Convert to dB and multiply by trace length in meters
  const lengthM = length * 1e-3;
  return 8.686 * alphaNpPerM * lengthM;
}

// ---------------------------------------------------------------------------
// Total insertion loss (S21)
// ---------------------------------------------------------------------------

/**
 * Calculate total insertion loss at a given frequency.
 *
 * Combines conductor loss (skin effect) and dielectric loss.
 *
 * @param frequency - Frequency in Hz
 * @param params - Transmission line parameters
 * @returns Loss breakdown: conductor, dielectric, total, and loss per mm
 */
export function insertionLoss(
  frequency: number,
  params: TransmissionLineParams,
): LossResult {
  const { erEff } = microstripZ0(params);

  const cLoss = skinEffectLoss(frequency, params.width, params.thickness, params.length);
  const dLoss = dielectricLoss(frequency, erEff, params.tanD, params.length);
  const total = cLoss + dLoss;

  return {
    conductorLoss: cLoss,
    dielectricLoss: dLoss,
    totalLoss: total,
    lossPerMm: params.length > 0 ? total / params.length : 0,
  };
}

// ---------------------------------------------------------------------------
// Return loss (S11)
// ---------------------------------------------------------------------------

/**
 * Calculate return loss from impedance mismatch.
 *
 * Formula:
 *   Gamma = (ZL - Z0) / (ZL + Z0)
 *   S11 = 20 * log10(|Gamma|)
 *
 * @param z0 - Characteristic impedance (ohms)
 * @param zLoad - Load impedance (ohms)
 * @returns Return loss in dB (negative for good match, 0 dB for total reflection)
 */
export function returnLoss(z0: number, zLoad: number): number {
  if (z0 <= 0) {
    return 0;
  }

  const gamma = Math.abs((zLoad - z0) / (zLoad + z0));

  if (gamma < 1e-15) {
    return -200; // essentially perfect match
  }

  return 20 * Math.log10(gamma);
}

// ---------------------------------------------------------------------------
// Impedance vs frequency sweep
// ---------------------------------------------------------------------------

/**
 * Sweep impedance and loss across a frequency range.
 *
 * Generates logarithmically spaced frequency points and computes the
 * characteristic impedance and total insertion loss at each point.
 *
 * Note: For a lossless line, Z0 is frequency-independent. In practice,
 * dispersion (frequency-dependent er) causes slight Z0 variation.
 * This model includes Djordjevic-Sarkar dispersion for erEff.
 *
 * @param params - Transmission line geometry and material
 * @param fStart - Start frequency in Hz
 * @param fStop - Stop frequency in Hz
 * @param points - Number of frequency points
 * @returns Array of impedance points
 */
export function impedanceVsFrequency(
  params: TransmissionLineParams,
  fStart: number,
  fStop: number,
  points: number,
): ImpedancePoint[] {
  const result: ImpedancePoint[] = [];
  const logStart = Math.log10(fStart);
  const logStop = Math.log10(fStop);

  for (let i = 0; i < points; i++) {
    const logF = logStart + (i / Math.max(1, points - 1)) * (logStop - logStart);
    const freq = Math.pow(10, logF);

    // Djordjevic-Sarkar frequency-dependent er model (simplified)
    // erEff(f) = erEff_static * (1 + tanD * ln(f/f_ref) / pi) approximately
    // For simplicity, we use a slight dispersion correction
    const base = microstripZ0(params);
    const fRef = 1e9; // 1 GHz reference
    const dispersionCorrection = 1 + (params.tanD * Math.log(Math.max(freq, 1) / fRef)) / (2 * Math.PI);
    const erEffAtFreq = base.erEff * Math.max(0.9, Math.min(1.1, dispersionCorrection));

    // Recompute Z0 with dispersive erEff (Z0 ~ 1/sqrt(erEff))
    const z0AtFreq = base.z0 * Math.sqrt(base.erEff / erEffAtFreq);

    // Total loss at this frequency
    const cLoss = skinEffectLoss(freq, params.width, params.thickness, params.length);
    const dLoss = dielectricLoss(freq, erEffAtFreq, params.tanD, params.length);

    result.push({
      frequency: freq,
      z0: z0AtFreq,
      loss: cLoss + dLoss,
    });
  }

  return result;
}
