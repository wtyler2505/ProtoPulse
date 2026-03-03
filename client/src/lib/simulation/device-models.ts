/**
 * Nonlinear Semiconductor Device Models (FG-23)
 *
 * Implements physics-based device models for SPICE-style circuit simulation:
 *   - Diode: Shockley equation with series resistance, breakdown, temperature
 *   - BJT: Ebers-Moll simplified model with Early voltage, NPN/PNP
 *   - MOSFET: Level 1 Shichman-Hodges model with channel-length modulation
 *
 * Each model provides:
 *   - I-V evaluation: large-signal current as a function of terminal voltages
 *   - Small-signal parameters: gm, gds, gpi, etc. for AC analysis linearization
 *   - Newton-Raphson companion model: linearized equivalent for iterative DC solving
 *
 * The companion model approach replaces each nonlinear device with a parallel
 * combination of a conductance Geq and current source Ieq, derived from
 * linearization around the current operating point. This is stamped into the
 * MNA matrix on each Newton-Raphson iteration until convergence.
 *
 * References:
 *   - Sedra & Smith, "Microelectronic Circuits"
 *   - Razavi, "Design of Analog CMOS Integrated Circuits"
 *   - Nagel & Pederson, "SPICE (Simulation Program with IC Emphasis)"
 *   - Vladimirescu, "The SPICE Book"
 */

// ---------------------------------------------------------------------------
// Physical constants
// ---------------------------------------------------------------------------

/** Boltzmann constant in J/K. */
export const K_B = 1.380649e-23;

/** Elementary charge in Coulombs. */
export const Q_ELECTRON = 1.602176634e-19;

/** Default temperature in Kelvin (27 degrees C). */
export const T_DEFAULT = 300;

/** Thermal voltage at default temperature: V_T = k_B * T / q. */
export const V_T_DEFAULT = K_B * T_DEFAULT / Q_ELECTRON;

/**
 * Compute thermal voltage at a given temperature.
 * V_T = k_B * T / q
 */
export function thermalVoltage(T: number = T_DEFAULT): number {
  return K_B * T / Q_ELECTRON;
}

// ---------------------------------------------------------------------------
// Diode Model (Shockley)
// ---------------------------------------------------------------------------

/** Parameters for the Shockley diode model. */
export interface DiodeParams {
  /** Saturation current in amps (default 1e-14 A). */
  Is: number;
  /** Ideality factor (default 1.0). */
  n: number;
  /** Temperature in Kelvin (default 300 K). */
  T?: number;
  /** Reverse breakdown voltage in volts (optional, positive value). */
  Vbr?: number;
  /** Series resistance in ohms (optional). */
  Rs?: number;
}

/** Result of diode I-V evaluation. */
export interface DiodeResult {
  /** Diode current in amps (positive = forward). */
  I: number;
  /** Derivative dI/dV (conductance) for Newton-Raphson. */
  dIdV: number;
}

/** Default diode parameters (general-purpose silicon diode). */
export const DIODE_DEFAULTS: Readonly<DiodeParams> = {
  Is: 1e-14,
  n: 1,
  T: T_DEFAULT,
};

/**
 * Compute temperature-adjusted saturation current.
 *
 * Is(T) = Is(Tnom) * (T/Tnom)^3 * exp(Eg/Vt_nom - Eg/Vt)
 *
 * where Eg = 1.12 eV (silicon bandgap energy).
 * This models the strong temperature dependence of Is, which approximately
 * doubles every 10K near room temperature.
 *
 * @param Is_nom - Saturation current at nominal temperature
 * @param T - Operating temperature in Kelvin
 * @param T_nom - Nominal temperature in Kelvin (default 300K)
 * @returns Temperature-adjusted saturation current
 */
export function adjustIsForTemperature(Is_nom: number, T: number, T_nom: number = T_DEFAULT): number {
  if (T === T_nom) {
    return Is_nom;
  }
  const EG = 1.12; // Silicon bandgap energy in eV
  const Vt_nom = thermalVoltage(T_nom);
  const Vt_T = thermalVoltage(T);
  const ratio = T / T_nom;
  return Is_nom * ratio * ratio * ratio * Math.exp(EG / Vt_nom - EG / Vt_T);
}

/**
 * Evaluate the Shockley diode equation at a given voltage.
 *
 * I = Is(T) * (exp(V / (n * V_T)) - 1)
 *
 * Is is adjusted for temperature using the bandgap model when T differs
 * from the default 300K.
 *
 * For large forward voltages, the exponential is clamped to prevent overflow.
 * For breakdown, a reverse exponential models avalanche behavior.
 *
 * @param V - Voltage across the diode (anode - cathode), in volts
 * @param params - Diode model parameters
 * @returns Current and derivative (conductance)
 */
export function evaluateDiode(V: number, params: DiodeParams): DiodeResult {
  const T = params.T ?? T_DEFAULT;
  const Is = adjustIsForTemperature(params.Is, T);
  const n = params.n;
  const Vt = thermalVoltage(T);
  const nVt = n * Vt;

  // Clamp the exponent argument to prevent numerical overflow.
  // exp(80) ~ 5.5e34, which is safe for float64.
  const MAX_EXP_ARG = 80;

  let I: number;
  let dIdV: number;

  if (V >= 0 || params.Vbr === undefined) {
    // Forward bias or no-breakdown reverse bias
    const expArg = V / nVt;

    if (expArg > MAX_EXP_ARG) {
      // Linear extrapolation beyond the clamp point to prevent overflow
      // while maintaining continuity and monotonicity.
      const expMax = Math.exp(MAX_EXP_ARG);
      const I_at_max = Is * (expMax - 1);
      const dIdV_at_max = Is * expMax / nVt;
      const V_at_max = MAX_EXP_ARG * nVt;
      I = I_at_max + dIdV_at_max * (V - V_at_max);
      dIdV = dIdV_at_max;
    } else {
      const expVal = Math.exp(expArg);
      I = Is * (expVal - 1);
      dIdV = Is * expVal / nVt;
    }
  } else {
    // Reverse bias with breakdown model
    const Vbr = params.Vbr;

    if (V >= -Vbr) {
      // Normal reverse bias (no breakdown yet)
      const expVal = Math.exp(V / nVt);
      I = Is * (expVal - 1);
      dIdV = Is * expVal / nVt;
    } else {
      // Beyond breakdown: sharp exponential increase in reverse current
      // I_breakdown = -Is * exp(-(V + Vbr) / nVt)
      const expArg = -(V + Vbr) / nVt;
      const clampedArg = Math.min(expArg, MAX_EXP_ARG);
      const expVal = Math.exp(clampedArg);
      I = -Is * expVal;
      dIdV = Is * expVal / nVt;
    }
  }

  // Apply series resistance if specified.
  // With Rs: V_diode_junction = V - I * Rs
  // This requires an implicit equation; we use a single correction step
  // (adequate for Newton-Raphson outer loop).
  if (params.Rs !== undefined && params.Rs > 0) {
    // dI/dV_external = dI/dV_junction / (1 + Rs * dI/dV_junction)
    const Rs = params.Rs;
    dIdV = dIdV / (1 + Rs * dIdV);
    // Note: I remains the same for the current iteration estimate.
    // The NR outer loop will converge the Rs voltage drop.
  }

  return { I, dIdV };
}

// ---------------------------------------------------------------------------
// BJT Model (Ebers-Moll simplified)
// ---------------------------------------------------------------------------

/** Parameters for the Ebers-Moll BJT model. */
export interface BJTParams {
  /** Device polarity. */
  type: 'npn' | 'pnp';
  /** Saturation current in amps (default 1e-15 A). */
  Is: number;
  /** Forward current gain (default 100). */
  betaF: number;
  /** Reverse current gain (default 1). */
  betaR: number;
  /** Early voltage in volts (optional, for output resistance). */
  Vaf?: number;
  /** Temperature in Kelvin (default 300 K). */
  T?: number;
}

/** Result of BJT I-V evaluation. */
export interface BJTResult {
  /** Collector current in amps. */
  Ic: number;
  /** Base current in amps. */
  Ib: number;
  /** Emitter current in amps. */
  Ie: number;
  /** Transconductance gm = dIc/dVbe in siemens. */
  gm: number;
  /** Input conductance gpi = gm / betaF = 1/rpi in siemens. */
  gpi: number;
  /** Output conductance go = Ic / Vaf in siemens (0 if no Early voltage). */
  go: number;
  /** Operating region. */
  region: 'cutoff' | 'active' | 'saturation';
}

/** Default BJT parameters (general-purpose NPN). */
export const BJT_DEFAULTS: Readonly<BJTParams> = {
  type: 'npn',
  Is: 1e-15,
  betaF: 100,
  betaR: 1,
  T: T_DEFAULT,
};

/**
 * Evaluate the Ebers-Moll BJT model.
 *
 * The transport form of the Ebers-Moll model:
 *   I_F = Is * (exp(Vbe / Vt) - 1)  (forward transport current)
 *   I_R = Is * (exp(Vbc / Vt) - 1)  (reverse transport current)
 *   Ic = I_F - I_R / betaR           (collector current)
 *   Ib = I_F / betaF + I_R / betaR   (base current)
 *   Ie = -(Ic + Ib)                  (emitter current, KCL)
 *
 * With Early effect: Ic *= (1 + Vce / Vaf) in active region.
 *
 * For PNP: all voltages are negated (Vbe -> Veb, Vce -> Vec).
 *
 * @param Vbe - Base-emitter voltage in volts
 * @param Vce - Collector-emitter voltage in volts
 * @param params - BJT model parameters
 * @returns Currents, small-signal parameters, and operating region
 */
export function evaluateBJT(Vbe: number, Vce: number, params: BJTParams): BJTResult {
  const T = params.T ?? T_DEFAULT;
  const Vt = thermalVoltage(T);
  const Is = params.Is;
  const betaF = params.betaF;
  const betaR = params.betaR;

  // For PNP: negate all terminal voltages to use NPN equations,
  // then negate all currents at the end.
  const sign = params.type === 'pnp' ? -1 : 1;
  const vbe = sign * Vbe;
  const vce = sign * Vce;
  const vbc = vbe - vce;

  // Clamp exponential arguments
  const MAX_EXP_ARG = 80;
  const expVbe = Math.exp(Math.min(vbe / Vt, MAX_EXP_ARG));
  const expVbc = Math.exp(Math.min(vbc / Vt, MAX_EXP_ARG));

  // Transport currents
  const If = Is * (expVbe - 1);
  const Ir = Is * (expVbc - 1);

  // Collector and base currents (Ebers-Moll transport model)
  let Ic = If - Ir * (1 + 1 / betaR);
  // Ib from KCL: total base current = forward base + reverse base
  let Ib = If / betaF + Ir / betaR;

  // Determine operating region based on junction biases
  let region: 'cutoff' | 'active' | 'saturation';
  const VBE_ON = 0.5; // Approximate turn-on voltage

  if (vbe < VBE_ON) {
    region = 'cutoff';
  } else if (vbc >= VBE_ON) {
    // Both junctions forward biased -> saturation
    region = 'saturation';
  } else {
    // BE forward biased, BC reverse biased -> active
    region = 'active';
  }

  // Early effect (output resistance) in active region
  let earlyFactor = 1;
  if (params.Vaf !== undefined && params.Vaf > 0 && region === 'active') {
    earlyFactor = 1 + vce / params.Vaf;
    Ic *= earlyFactor;
  }

  // Emitter current from KCL
  const Ie = -(Ic + Ib);

  // Small-signal parameters (computed at the operating point)
  // gm = dIc/dVbe = Ic / Vt (in active region)
  const Ic_abs = Math.abs(Ic);
  const gm = Ic_abs > 0 ? Ic_abs / Vt : 0;

  // gpi = gm / betaF
  const gpi = betaF > 0 ? gm / betaF : 0;

  // go = Ic / Vaf (output conductance due to Early effect)
  const go = (params.Vaf !== undefined && params.Vaf > 0) ? Ic_abs / params.Vaf : 0;

  // Apply PNP sign convention: currents reverse direction
  return {
    Ic: sign * Ic,
    Ib: sign * Ib,
    Ie: sign * Ie,
    gm,
    gpi,
    go,
    region,
  };
}

// ---------------------------------------------------------------------------
// MOSFET Model (Level 1 — Shichman-Hodges)
// ---------------------------------------------------------------------------

/** Parameters for the Level 1 MOSFET model. */
export interface MOSFETParams {
  /** Device polarity. */
  type: 'nmos' | 'pmos';
  /** Threshold voltage in volts (default 0.7V for NMOS, -0.7V for PMOS). */
  Vth: number;
  /** Transconductance parameter Kp = mu * Cox * W/L in A/V^2 (default 1e-4). */
  Kp: number;
  /** Channel-length modulation parameter in 1/V (default 0.01). */
  lambda: number;
  /** Channel width in meters (optional, folded into Kp if not set). */
  W?: number;
  /** Channel length in meters (optional, folded into Kp if not set). */
  L?: number;
}

/** Result of MOSFET I-V evaluation. */
export interface MOSFETResult {
  /** Drain current in amps. */
  Id: number;
  /** Transconductance gm = dId/dVgs in siemens. */
  gm: number;
  /** Output conductance gds = dId/dVds in siemens. */
  gds: number;
  /** Operating region. */
  region: 'cutoff' | 'linear' | 'saturation';
}

/** Default NMOS parameters. */
export const NMOS_DEFAULTS: Readonly<MOSFETParams> = {
  type: 'nmos',
  Vth: 0.7,
  Kp: 1e-4,
  lambda: 0.01,
};

/** Default PMOS parameters. */
export const PMOS_DEFAULTS: Readonly<MOSFETParams> = {
  type: 'pmos',
  Vth: -0.7,
  Kp: 5e-5,
  lambda: 0.01,
};

/**
 * Evaluate the Level 1 MOSFET model (Shichman-Hodges).
 *
 * For NMOS:
 *   Cutoff:     Vgs < Vth                    -> Id = 0
 *   Linear:     Vgs >= Vth, Vds < Vgs - Vth  -> Id = Kp * [(Vgs-Vth)*Vds - Vds^2/2] * (1 + lambda*Vds)
 *   Saturation: Vgs >= Vth, Vds >= Vgs - Vth -> Id = Kp/2 * (Vgs-Vth)^2 * (1 + lambda*Vds)
 *
 * For PMOS: voltages and currents are negated to use the NMOS equations.
 *
 * If W and L are specified, Kp is scaled by W/L.
 *
 * @param Vgs - Gate-source voltage in volts
 * @param Vds - Drain-source voltage in volts
 * @param params - MOSFET model parameters
 * @returns Drain current, small-signal parameters, and operating region
 */
export function evaluateMOSFET(Vgs: number, Vds: number, params: MOSFETParams): MOSFETResult {
  // For PMOS: negate voltages, compute with NMOS equations, negate current
  const isPMOS = params.type === 'pmos';
  const vgs = isPMOS ? -Vgs : Vgs;
  const vds = isPMOS ? -Vds : Vds;
  const Vth = isPMOS ? -params.Vth : params.Vth;

  // Scale Kp by W/L if both are provided
  let Kp = params.Kp;
  if (params.W !== undefined && params.L !== undefined && params.L > 0) {
    Kp = Kp * params.W / params.L;
  }

  const lambda = params.lambda;
  const Vov = vgs - Vth; // Overdrive voltage

  let Id: number;
  let gm: number;
  let gds: number;
  let region: 'cutoff' | 'linear' | 'saturation';

  if (Vov <= 0) {
    // Cutoff region: gate voltage below threshold
    Id = 0;
    gm = 0;
    gds = 0;
    region = 'cutoff';
  } else if (vds < Vov) {
    // Linear (triode) region
    // Id = Kp * [(Vgs-Vth)*Vds - Vds^2/2] * (1 + lambda*Vds)
    const channelModulation = 1 + lambda * vds;
    Id = Kp * (Vov * vds - vds * vds / 2) * channelModulation;

    // gm = dId/dVgs = Kp * Vds * (1 + lambda*Vds)
    gm = Kp * vds * channelModulation;

    // gds = dId/dVds (partial derivative)
    // dId/dVds = Kp * (Vov - Vds) * (1 + lambda*Vds) + Kp * (Vov*Vds - Vds^2/2) * lambda
    gds = Kp * (Vov - vds) * channelModulation + Kp * (Vov * vds - vds * vds / 2) * lambda;

    region = 'linear';
  } else {
    // Saturation region
    // Id = Kp/2 * (Vgs-Vth)^2 * (1 + lambda*Vds)
    const channelModulation = 1 + lambda * vds;
    Id = (Kp / 2) * Vov * Vov * channelModulation;

    // gm = dId/dVgs = Kp * (Vgs-Vth) * (1 + lambda*Vds)
    gm = Kp * Vov * channelModulation;

    // gds = dId/dVds = Kp/2 * (Vgs-Vth)^2 * lambda
    gds = (Kp / 2) * Vov * Vov * lambda;

    region = 'saturation';
  }

  // For PMOS: current flows in opposite direction
  if (isPMOS) {
    // Use (Id || 0) to avoid -0 in cutoff
    Id = Id === 0 ? 0 : -Id;
  }

  return { Id, gm, gds, region };
}

// ---------------------------------------------------------------------------
// Newton-Raphson companion model
// ---------------------------------------------------------------------------

/**
 * Companion model for Newton-Raphson iteration.
 * Represents a nonlinear device as a linear equivalent:
 *   I = Geq * V + Ieq
 * which can be stamped into the MNA matrix as a conductance Geq
 * in parallel with a current source Ieq.
 */
export interface CompanionModel {
  /** Equivalent conductance in siemens. */
  Geq: number;
  /** Equivalent current source in amps. */
  Ieq: number;
}

/**
 * Create a diode companion model for Newton-Raphson iteration.
 *
 * Linearizes the diode I-V characteristic around the previous operating point V_prev:
 *   I(V) ≈ I(V0) + dI/dV(V0) * (V - V0)
 *   I(V) = dI/dV(V0) * V + [I(V0) - dI/dV(V0) * V0]
 *   I(V) = Geq * V + Ieq
 *
 * where:
 *   Geq = dI/dV(V0)
 *   Ieq = I(V0) - Geq * V0
 *
 * @param V_prev - Previous iteration voltage across the diode
 * @param params - Diode model parameters
 * @returns Companion model {Geq, Ieq} for MNA stamping
 */
export function diodeCompanion(V_prev: number, params: DiodeParams): CompanionModel {
  const { I, dIdV } = evaluateDiode(V_prev, params);

  // Ensure minimum conductance to prevent singular matrix
  const G_MIN = 1e-12;
  const Geq = Math.max(dIdV, G_MIN);
  const Ieq = I - Geq * V_prev;

  return { Geq, Ieq };
}

// ---------------------------------------------------------------------------
// Newton-Raphson nonlinear solver
// ---------------------------------------------------------------------------

/** Result of Newton-Raphson nonlinear convergence. */
export interface NonlinearSolveResult {
  /** Whether the solver converged within tolerance. */
  converged: boolean;
  /** Number of iterations taken. */
  iterations: number;
  /** Final diode voltage in volts. */
  Vd: number;
  /** Final diode current in amps. */
  Id: number;
}

/**
 * Solve a simple diode + resistor circuit using Newton-Raphson iteration.
 *
 * Circuit: V_source -> R -> Diode -> GND
 *
 * KVL: Vs = I*R + Vd
 * Diode: I = Is * (exp(Vd / nVt) - 1)
 *
 * This is a proof-of-concept for the companion model approach.
 * The full nonlinear MNA solver would generalize this to arbitrary circuits.
 *
 * @param Vs - Source voltage in volts
 * @param R - Series resistance in ohms
 * @param diodeParams - Diode model parameters
 * @param maxIterations - Maximum iterations (default 50)
 * @param tolerance - Convergence tolerance on voltage change (default 1e-9)
 * @returns Converged solution with diode voltage and current
 */
export function solveNonlinear(
  Vs: number,
  R: number,
  diodeParams: DiodeParams,
  maxIterations: number = 50,
  tolerance: number = 1e-9,
): NonlinearSolveResult {
  const T = diodeParams.T ?? T_DEFAULT;
  const Vt = thermalVoltage(T);

  // Initial guess using a linear approximation.
  // Assume Vd ~ 0.7V for forward bias, then iterate.
  let Vd: number;
  if (Vs > 0.7) {
    Vd = 0.7;
  } else if (Vs > 0) {
    Vd = Vs * 0.5;
  } else {
    Vd = 0;
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    // Evaluate diode at current operating point
    const { I: Id, dIdV: Gd } = evaluateDiode(Vd, diodeParams);

    // KVL: Vs = Id * R + Vd
    // Residual: f(Vd) = Id * R + Vd - Vs = 0
    // Newton: Vd_new = Vd - f(Vd) / f'(Vd)
    // f'(Vd) = Gd * R + 1
    const f = Id * R + Vd - Vs;
    const fPrime = Gd * R + 1;

    if (Math.abs(fPrime) < 1e-30) {
      // Avoid division by zero
      return { converged: false, iterations: iter + 1, Vd, Id };
    }

    let deltaV = f / fPrime;

    // Voltage limiting: clamp the Newton step to prevent overshooting.
    // This is the standard SPICE technique — limit changes to a few Vt
    // to keep the exponential well-behaved.
    const MAX_STEP = 5 * Vt; // ~130mV at 300K
    if (deltaV > MAX_STEP) {
      deltaV = MAX_STEP;
    } else if (deltaV < -MAX_STEP) {
      deltaV = -MAX_STEP;
    }

    Vd -= deltaV;

    // Check convergence
    if (Math.abs(deltaV) < tolerance) {
      const finalDiode = evaluateDiode(Vd, diodeParams);
      return {
        converged: true,
        iterations: iter + 1,
        Vd,
        Id: finalDiode.I,
      };
    }
  }

  // Did not converge
  const finalDiode = evaluateDiode(Vd, diodeParams);
  return {
    converged: false,
    iterations: maxIterations,
    Vd,
    Id: finalDiode.I,
  };
}
