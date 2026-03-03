/**
 * Frequency-Domain Analysis Engine — Bode Plot Generation
 *
 * Computes transfer functions H(jw) for common passive filter topologies.
 * Returns magnitude (dB) and phase (degrees) over a logarithmic frequency sweep.
 *
 * Supported topologies:
 *   - RC low-pass:  H(s) = 1 / (1 + sRC)
 *   - RC high-pass: H(s) = sRC / (1 + sRC)
 *   - RLC bandpass:  H(s) = sL / (R + sL + 1/sC)
 *   - RLC low-pass:  H(s) = (1/LC) / (s^2 + sR/L + 1/LC)
 *   - Generic 2nd order: H(s) = w0^2 / (s^2 + 2*zeta*w0*s + w0^2)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single frequency-domain data point. */
export interface FrequencyPoint {
  /** Frequency in Hz */
  frequency: number;
  /** Magnitude in dB: 20 * log10(|H(jw)|) */
  magnitudeDb: number;
  /** Phase in degrees, wrapped to [-180, +180] */
  phaseDegrees: number;
}

/** Available filter topologies for analysis. */
export type FilterTopology =
  | 'rc-lowpass'
  | 'rc-highpass'
  | 'rlc-bandpass'
  | 'rlc-lowpass'
  | 'generic-2nd-order';

/** Component values for a filter circuit. */
export interface FilterComponents {
  /** Resistance in Ohms */
  resistance?: number;
  /** Capacitance in Farads */
  capacitance?: number;
  /** Inductance in Henries */
  inductance?: number;
  /** Natural frequency in rad/s (for generic-2nd-order) */
  naturalFrequency?: number;
  /** Damping ratio zeta (for generic-2nd-order) */
  dampingRatio?: number;
}

/** Frequency sweep configuration. */
export interface FrequencySweepConfig {
  /** Minimum frequency in Hz (default: 1) */
  fMin?: number;
  /** Maximum frequency in Hz (default: 10e6) */
  fMax?: number;
  /** Number of points per decade (default: 50) */
  pointsPerDecade?: number;
}

/** Input to the frequency analysis function. */
export interface FrequencyAnalysisInput {
  topology: FilterTopology;
  components: FilterComponents;
  sweep?: FrequencySweepConfig;
}

/** Summary metrics extracted from a Bode plot. */
export interface BodeSummary {
  /** -3 dB cutoff frequency in Hz, or null if not found */
  cutoffFrequencyHz: number | null;
  /** DC gain in dB (gain at the lowest frequency) */
  dcGainDb: number;
  /** Phase margin in degrees, or null if not applicable */
  phaseMarginDegrees: number | null;
  /** Gain margin in dB, or null if not applicable */
  gainMarginDb: number | null;
  /** Resonant/center frequency in Hz for bandpass, or null */
  resonantFrequencyHz: number | null;
}

/** Complete result of a frequency analysis. */
export interface FrequencyAnalysisResult {
  /** Array of frequency-domain data points */
  data: FrequencyPoint[];
  /** Summary metrics */
  summary: BodeSummary;
  /** Topology that was analyzed */
  topology: FilterTopology;
}

// ---------------------------------------------------------------------------
// Complex number helpers (avoid external dependency)
// ---------------------------------------------------------------------------

interface Complex {
  re: number;
  im: number;
}

function complexFromPolar(mag: number, angleRad: number): Complex {
  return { re: mag * Math.cos(angleRad), im: mag * Math.sin(angleRad) };
}

function complexMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

function complexDiv(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  if (denom === 0) {
    return { re: 0, im: 0 };
  }
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
}

function complexAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function complexMag(c: Complex): number {
  return Math.sqrt(c.re * c.re + c.im * c.im);
}

function complexPhaseRad(c: Complex): number {
  return Math.atan2(c.im, c.re);
}

/** Convert radians to degrees. */
function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

// ---------------------------------------------------------------------------
// Transfer function evaluators
// ---------------------------------------------------------------------------

/**
 * Evaluate H(jw) for a given topology at angular frequency w (rad/s).
 * Returns the complex transfer function value.
 */
function evaluateTransferFunction(
  topology: FilterTopology,
  components: FilterComponents,
  omega: number,
): Complex {
  const jw: Complex = { re: 0, im: omega };

  switch (topology) {
    case 'rc-lowpass': {
      // H(s) = 1 / (1 + sRC)
      const R = components.resistance ?? 1000;
      const C = components.capacitance ?? 1e-6;
      const tau = R * C;
      const denom: Complex = { re: 1 + jw.re * tau, im: jw.im * tau };
      return complexDiv({ re: 1, im: 0 }, denom);
    }

    case 'rc-highpass': {
      // H(s) = sRC / (1 + sRC)
      const R = components.resistance ?? 1000;
      const C = components.capacitance ?? 1e-6;
      const tau = R * C;
      const sRC: Complex = { re: jw.re * tau, im: jw.im * tau };
      const denom: Complex = { re: 1 + sRC.re, im: sRC.im };
      return complexDiv(sRC, denom);
    }

    case 'rlc-bandpass': {
      // H(s) = sL / (R + sL + 1/(sC))
      // Numerator: sL = jw * L
      // Denominator: R + jwL + 1/(jwC)
      const R = components.resistance ?? 100;
      const L = components.inductance ?? 1e-3;
      const C = components.capacitance ?? 1e-6;

      const sL: Complex = { re: jw.re * L, im: jw.im * L };

      // 1/(jwC) = 1/(j * w * C) = -j/(wC)
      const oneOverSC: Complex =
        omega === 0
          ? { re: 1e15, im: 0 } // Open circuit at DC
          : complexDiv({ re: 1, im: 0 }, { re: jw.re * C, im: jw.im * C });

      const denom = complexAdd(complexAdd({ re: R, im: 0 }, sL), oneOverSC);
      return complexDiv(sL, denom);
    }

    case 'rlc-lowpass': {
      // H(s) = (1/LC) / (s^2 + sR/L + 1/LC)
      const R = components.resistance ?? 100;
      const L = components.inductance ?? 1e-3;
      const C = components.capacitance ?? 1e-6;

      const w0sq = 1 / (L * C);
      const alpha = R / L;

      // s^2 = (jw)^2 = -w^2
      const s2: Complex = { re: -omega * omega, im: 0 };
      // s * R/L = jw * R/L
      const sAlpha: Complex = { re: jw.re * alpha, im: jw.im * alpha };

      const denom = complexAdd(complexAdd(s2, sAlpha), { re: w0sq, im: 0 });
      return complexDiv({ re: w0sq, im: 0 }, denom);
    }

    case 'generic-2nd-order': {
      // H(s) = w0^2 / (s^2 + 2*zeta*w0*s + w0^2)
      const w0 = components.naturalFrequency ?? 2 * Math.PI * 1000;
      const zeta = components.dampingRatio ?? 0.707;

      const w0sq = w0 * w0;
      const twoZetaW0 = 2 * zeta * w0;

      const s2: Complex = { re: -omega * omega, im: 0 };
      const sTerm: Complex = { re: jw.re * twoZetaW0, im: jw.im * twoZetaW0 };

      const denom = complexAdd(complexAdd(s2, sTerm), { re: w0sq, im: 0 });
      return complexDiv({ re: w0sq, im: 0 }, denom);
    }
  }
}

// ---------------------------------------------------------------------------
// Logarithmic frequency sweep generator
// ---------------------------------------------------------------------------

/**
 * Generate logarithmically spaced frequency points from fMin to fMax.
 */
function generateLogFrequencies(
  fMin: number,
  fMax: number,
  pointsPerDecade: number,
): number[] {
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

// ---------------------------------------------------------------------------
// Wrap phase to [-180, +180]
// ---------------------------------------------------------------------------

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
// Summary extraction
// ---------------------------------------------------------------------------

function extractSummary(
  data: FrequencyPoint[],
  topology: FilterTopology,
  components: FilterComponents,
): BodeSummary {
  if (data.length === 0) {
    return {
      cutoffFrequencyHz: null,
      dcGainDb: 0,
      phaseMarginDegrees: null,
      gainMarginDb: null,
      resonantFrequencyHz: null,
    };
  }

  const dcGainDb = data[0].magnitudeDb;

  // Find -3 dB point (relative to DC gain for lowpass, or peak for bandpass)
  let referenceDb = dcGainDb;
  let peakIdx = 0;

  if (topology === 'rlc-bandpass') {
    // For bandpass, find peak magnitude
    for (let i = 1; i < data.length; i++) {
      if (data[i].magnitudeDb > data[peakIdx].magnitudeDb) {
        peakIdx = i;
      }
    }
    referenceDb = data[peakIdx].magnitudeDb;
  }

  const targetDb = referenceDb - 3;

  // Find cutoff: first crossing below -3 dB from the reference
  let cutoffFrequencyHz: number | null = null;
  const searchStart = topology === 'rlc-bandpass' ? peakIdx : 0;
  for (let i = searchStart + 1; i < data.length; i++) {
    if (data[i].magnitudeDb <= targetDb && data[i - 1].magnitudeDb > targetDb) {
      // Linear interpolation between the two points for better accuracy
      const ratio =
        (targetDb - data[i - 1].magnitudeDb) /
        (data[i].magnitudeDb - data[i - 1].magnitudeDb);
      const logF1 = Math.log10(data[i - 1].frequency);
      const logF2 = Math.log10(data[i].frequency);
      cutoffFrequencyHz = Math.pow(10, logF1 + ratio * (logF2 - logF1));
      break;
    }
  }

  // For high-pass, search from low frequency upward to find where gain rises to -3 dB
  if (topology === 'rc-highpass' && cutoffFrequencyHz === null) {
    // High-pass: reference is the high-frequency gain (last data point)
    const hfGainDb = data[data.length - 1].magnitudeDb;
    const hpTargetDb = hfGainDb - 3;
    for (let i = 1; i < data.length; i++) {
      if (data[i].magnitudeDb >= hpTargetDb && data[i - 1].magnitudeDb < hpTargetDb) {
        const ratio =
          (hpTargetDb - data[i - 1].magnitudeDb) /
          (data[i].magnitudeDb - data[i - 1].magnitudeDb);
        const logF1 = Math.log10(data[i - 1].frequency);
        const logF2 = Math.log10(data[i].frequency);
        cutoffFrequencyHz = Math.pow(10, logF1 + ratio * (logF2 - logF1));
        break;
      }
    }
  }

  // Phase margin: phase at 0 dB gain crossover + 180
  let phaseMarginDegrees: number | null = null;
  for (let i = 1; i < data.length; i++) {
    if (
      (data[i - 1].magnitudeDb >= 0 && data[i].magnitudeDb < 0) ||
      (data[i - 1].magnitudeDb < 0 && data[i].magnitudeDb >= 0)
    ) {
      // Interpolate phase at 0 dB crossover
      const ratio =
        (0 - data[i - 1].magnitudeDb) /
        (data[i].magnitudeDb - data[i - 1].magnitudeDb);
      const phaseAtCrossover =
        data[i - 1].phaseDegrees + ratio * (data[i].phaseDegrees - data[i - 1].phaseDegrees);
      phaseMarginDegrees = 180 + phaseAtCrossover;
      break;
    }
  }

  // Gain margin: gain at -180 phase crossover, expressed as positive margin
  let gainMarginDb: number | null = null;
  for (let i = 1; i < data.length; i++) {
    if (
      (data[i - 1].phaseDegrees > -180 && data[i].phaseDegrees <= -180) ||
      (data[i - 1].phaseDegrees <= -180 && data[i].phaseDegrees > -180)
    ) {
      const ratio =
        (-180 - data[i - 1].phaseDegrees) /
        (data[i].phaseDegrees - data[i - 1].phaseDegrees);
      const gainAtCrossover =
        data[i - 1].magnitudeDb + ratio * (data[i].magnitudeDb - data[i - 1].magnitudeDb);
      gainMarginDb = -gainAtCrossover;
      break;
    }
  }

  // Resonant frequency for bandpass or second-order filters
  let resonantFrequencyHz: number | null = null;
  if (topology === 'rlc-bandpass' || topology === 'rlc-lowpass' || topology === 'generic-2nd-order') {
    if (topology === 'rlc-bandpass' || topology === 'rlc-lowpass') {
      const L = components.inductance ?? 1e-3;
      const C = components.capacitance ?? 1e-6;
      resonantFrequencyHz = 1 / (2 * Math.PI * Math.sqrt(L * C));
    } else {
      const w0 = components.naturalFrequency ?? 2 * Math.PI * 1000;
      resonantFrequencyHz = w0 / (2 * Math.PI);
    }
  }

  return {
    cutoffFrequencyHz,
    dcGainDb,
    phaseMarginDegrees,
    gainMarginDb,
    resonantFrequencyHz,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateComponents(
  topology: FilterTopology,
  components: FilterComponents,
): string | null {
  switch (topology) {
    case 'rc-lowpass':
    case 'rc-highpass': {
      const R = components.resistance;
      const C = components.capacitance;
      if (R === undefined || R <= 0) {
        return 'Resistance must be a positive number';
      }
      if (C === undefined || C <= 0) {
        return 'Capacitance must be a positive number';
      }
      return null;
    }

    case 'rlc-bandpass':
    case 'rlc-lowpass': {
      const R = components.resistance;
      const L = components.inductance;
      const C = components.capacitance;
      if (R === undefined || R <= 0) {
        return 'Resistance must be a positive number';
      }
      if (L === undefined || L <= 0) {
        return 'Inductance must be a positive number';
      }
      if (C === undefined || C <= 0) {
        return 'Capacitance must be a positive number';
      }
      return null;
    }

    case 'generic-2nd-order': {
      const w0 = components.naturalFrequency;
      const zeta = components.dampingRatio;
      if (w0 === undefined || w0 <= 0) {
        return 'Natural frequency must be a positive number';
      }
      if (zeta === undefined || zeta <= 0) {
        return 'Damping ratio must be a positive number';
      }
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Auto-detect topology from component values
// ---------------------------------------------------------------------------

/**
 * Guess the most appropriate filter topology based on which component values
 * are provided. Returns null if unable to determine.
 */
export function autoDetectTopology(components: FilterComponents): FilterTopology | null {
  const hasR = components.resistance !== undefined && components.resistance > 0;
  const hasC = components.capacitance !== undefined && components.capacitance > 0;
  const hasL = components.inductance !== undefined && components.inductance > 0;
  const hasW0 = components.naturalFrequency !== undefined && components.naturalFrequency > 0;
  const hasZeta = components.dampingRatio !== undefined && components.dampingRatio > 0;

  if (hasW0 && hasZeta) {
    return 'generic-2nd-order';
  }

  if (hasR && hasL && hasC) {
    // RLC — default to lowpass (more common); user can override
    return 'rlc-lowpass';
  }

  if (hasR && hasC && !hasL) {
    // RC — default to lowpass; user can override
    return 'rc-lowpass';
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------

/**
 * Run frequency-domain analysis for the given filter topology and component values.
 *
 * @param input - Topology, component values, and optional sweep configuration
 * @returns FrequencyAnalysisResult with data points and summary metrics
 * @throws Error if component values are invalid
 */
export function analyzeFrequencyResponse(input: FrequencyAnalysisInput): FrequencyAnalysisResult {
  const { topology, components, sweep } = input;

  // Validate
  const validationError = validateComponents(topology, components);
  if (validationError) {
    throw new Error(validationError);
  }

  // Sweep config
  const fMin = sweep?.fMin ?? 1;
  const fMax = sweep?.fMax ?? 10e6;
  const pointsPerDecade = sweep?.pointsPerDecade ?? 50;

  if (fMin <= 0 || fMax <= 0 || fMin >= fMax) {
    throw new Error('Frequency range must have fMin > 0, fMax > 0, and fMin < fMax');
  }
  if (pointsPerDecade < 1 || pointsPerDecade > 1000) {
    throw new Error('Points per decade must be between 1 and 1000');
  }

  // Generate frequency sweep
  const frequencies = generateLogFrequencies(fMin, fMax, pointsPerDecade);

  // Evaluate transfer function at each frequency
  const data: FrequencyPoint[] = frequencies.map((freq) => {
    const omega = 2 * Math.PI * freq;
    const h = evaluateTransferFunction(topology, components, omega);
    const magnitude = complexMag(h);
    const magnitudeDb = magnitude > 0 ? 20 * Math.log10(magnitude) : -200;
    const phaseDeg = wrapPhase(radToDeg(complexPhaseRad(h)));

    return {
      frequency: freq,
      magnitudeDb,
      phaseDegrees: phaseDeg,
    };
  });

  // Extract summary metrics
  const summary = extractSummary(data, topology, components);

  return { data, summary, topology };
}

// ---------------------------------------------------------------------------
// Topology display metadata
// ---------------------------------------------------------------------------

export const TOPOLOGY_METADATA: Record<
  FilterTopology,
  { label: string; description: string; requiredComponents: string[] }
> = {
  'rc-lowpass': {
    label: 'RC Low-Pass',
    description: 'H(s) = 1 / (1 + sRC)',
    requiredComponents: ['resistance', 'capacitance'],
  },
  'rc-highpass': {
    label: 'RC High-Pass',
    description: 'H(s) = sRC / (1 + sRC)',
    requiredComponents: ['resistance', 'capacitance'],
  },
  'rlc-bandpass': {
    label: 'RLC Band-Pass',
    description: 'H(s) = sL / (R + sL + 1/sC)',
    requiredComponents: ['resistance', 'inductance', 'capacitance'],
  },
  'rlc-lowpass': {
    label: 'RLC Low-Pass',
    description: 'H(s) = (1/LC) / (s\u00B2 + sR/L + 1/LC)',
    requiredComponents: ['resistance', 'inductance', 'capacitance'],
  },
  'generic-2nd-order': {
    label: 'Generic 2nd Order',
    description: 'H(s) = \u03C9\u2080\u00B2 / (s\u00B2 + 2\u03B6\u03C9\u2080s + \u03C9\u2080\u00B2)',
    requiredComponents: ['naturalFrequency', 'dampingRatio'],
  },
};

// ---------------------------------------------------------------------------
// Utility: format frequency for display
// ---------------------------------------------------------------------------

/**
 * Format a frequency value for display (e.g., 1000 -> "1 kHz").
 */
export function formatFrequency(hz: number): string {
  if (hz >= 1e9) {
    return `${(hz / 1e9).toPrecision(4)} GHz`;
  }
  if (hz >= 1e6) {
    return `${(hz / 1e6).toPrecision(4)} MHz`;
  }
  if (hz >= 1e3) {
    return `${(hz / 1e3).toPrecision(4)} kHz`;
  }
  if (hz >= 1) {
    return `${hz.toPrecision(4)} Hz`;
  }
  if (hz >= 1e-3) {
    return `${(hz / 1e-3).toPrecision(4)} mHz`;
  }
  return `${hz.toExponential(3)} Hz`;
}
