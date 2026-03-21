/**
 * AiPidAssistant — AI-driven auto-tuning PID assistant (BL-0705)
 *
 * Manages tuning sessions: feeds telemetry data, detects oscillations and
 * steady-state, applies 3 tuning strategies (Ziegler-Nichols relay,
 * model-based FOPDT, gradient descent), generates PID code injection,
 * and verifies before/after improvement.
 *
 * Uses singleton+subscribe pattern for useSyncExternalStore compatibility.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

/** Tuning strategy identifiers. */
export type TuningStrategy = 'relay' | 'model-based' | 'gradient-descent';

/** Session state machine states. */
export type SessionState = 'idle' | 'collecting' | 'analyzing' | 'tuning' | 'verifying' | 'complete' | 'error';

/** A single telemetry data point from the process. */
export interface TelemetryPoint {
  /** Timestamp in seconds. */
  t: number;
  /** Process variable (measured output). */
  pv: number;
  /** Setpoint (desired output). */
  sp: number;
  /** Control output (0–100% or raw). */
  co: number;
}

/** PID gains. */
export interface PidGains {
  kp: number;
  ki: number;
  kd: number;
}

/** First-Order Plus Dead Time model parameters. */
export interface FopdtModel {
  /** Process gain (K). */
  gain: number;
  /** Time constant (tau) in seconds. */
  timeConstant: number;
  /** Dead time (theta) in seconds. */
  deadTime: number;
}

/** Oscillation detection result. */
export interface OscillationResult {
  /** Whether oscillation is detected. */
  detected: boolean;
  /** Estimated oscillation period in seconds (0 if none). */
  period: number;
  /** Estimated oscillation amplitude. */
  amplitude: number;
  /** Number of zero crossings detected. */
  zeroCrossings: number;
}

/** Steady-state detection result. */
export interface SteadyStateResult {
  /** Whether steady state is reached. */
  reached: boolean;
  /** Steady-state value. */
  value: number;
  /** Standard deviation in the steady-state window. */
  standardDeviation: number;
  /** Steady-state error (pv - sp). */
  error: number;
}

/** Performance metrics for a tuning result. */
export interface PerformanceMetrics {
  /** Rise time to 90% of setpoint change (seconds). */
  riseTime: number;
  /** Settling time within 2% band (seconds). */
  settlingTime: number;
  /** Overshoot percentage. */
  overshootPercent: number;
  /** Integral of Absolute Error. */
  iae: number;
  /** Integral of Time-weighted Absolute Error. */
  itae: number;
  /** Steady-state error. */
  steadyStateError: number;
}

/** Tuning result from a strategy. */
export interface TuningResult {
  strategy: TuningStrategy;
  gains: PidGains;
  model?: FopdtModel;
  description: string;
  confidence: number; // 0–1
}

/** Improvement comparison between before/after tuning. */
export interface ImprovementReport {
  /** Metrics before tuning. */
  before: PerformanceMetrics;
  /** Metrics after tuning. */
  after: PerformanceMetrics;
  /** Overall improvement score (-1 to 1, positive = better). */
  overallScore: number;
  /** Per-metric improvement percentages. */
  improvements: Record<string, number>;
  /** Human-readable summary. */
  summary: string;
}

/** Full tuning session state. */
export interface TuningSession {
  /** Session ID. */
  id: string;
  /** Current session state. */
  state: SessionState;
  /** Collected telemetry data. */
  telemetry: TelemetryPoint[];
  /** Selected tuning strategy (null = auto). */
  strategy: TuningStrategy | null;
  /** Best tuning result. */
  bestResult: TuningResult | null;
  /** All tuning results. */
  allResults: TuningResult[];
  /** Oscillation detection. */
  oscillation: OscillationResult | null;
  /** Steady-state detection. */
  steadyState: SteadyStateResult | null;
  /** Before-tuning metrics. */
  beforeMetrics: PerformanceMetrics | null;
  /** After-tuning metrics. */
  afterMetrics: PerformanceMetrics | null;
  /** Improvement report. */
  improvementReport: ImprovementReport | null;
  /** Error message if state is 'error'. */
  errorMessage: string | null;
  /** Created timestamp. */
  createdAt: number;
}

/** Snapshot for useSyncExternalStore. */
export interface AiPidSnapshot {
  activeSession: TuningSession | null;
  sessionHistory: TuningSession[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_TELEMETRY_POINTS = 20;
const OSCILLATION_MIN_CROSSINGS = 4;
const STEADY_STATE_WINDOW_RATIO = 0.2; // last 20% of data
const STEADY_STATE_THRESHOLD = 0.02; // 2% of range
const SETTLING_TOLERANCE = 0.02;
const MAX_GRADIENT_ITERATIONS = 200;
const GRADIENT_LEARNING_RATE = 0.001;
const MAX_SESSION_HISTORY = 20;

// ---------------------------------------------------------------------------
// Analysis helpers (pure functions)
// ---------------------------------------------------------------------------

/**
 * Detect oscillation in the error signal (pv - sp).
 */
export function detectOscillation(telemetry: TelemetryPoint[]): OscillationResult {
  if (telemetry.length < MIN_TELEMETRY_POINTS) {
    return { detected: false, period: 0, amplitude: 0, zeroCrossings: 0 };
  }

  // Compute error signal
  const errors: number[] = [];
  for (let i = 0; i < telemetry.length; i++) {
    errors.push(telemetry[i].pv - telemetry[i].sp);
  }

  // Compute mean error
  let meanError = 0;
  for (let i = 0; i < errors.length; i++) {
    meanError += errors[i];
  }
  meanError /= errors.length;

  // Count zero crossings (relative to mean)
  const centered = errors.map((e) => e - meanError);
  const crossingTimes: number[] = [];
  for (let i = 1; i < centered.length; i++) {
    if ((centered[i - 1] < 0 && centered[i] >= 0) || (centered[i - 1] >= 0 && centered[i] < 0)) {
      // Interpolate crossing time
      const frac = Math.abs(centered[i - 1]) / (Math.abs(centered[i - 1]) + Math.abs(centered[i]));
      const t = telemetry[i - 1].t + frac * (telemetry[i].t - telemetry[i - 1].t);
      crossingTimes.push(t);
    }
  }

  if (crossingTimes.length < OSCILLATION_MIN_CROSSINGS) {
    return { detected: false, period: 0, amplitude: 0, zeroCrossings: crossingTimes.length };
  }

  // Estimate period from consecutive zero crossings (2 crossings = 1 period)
  const periods: number[] = [];
  for (let i = 2; i < crossingTimes.length; i += 2) {
    periods.push(crossingTimes[i] - crossingTimes[i - 2]);
  }

  let avgPeriod = 0;
  if (periods.length > 0) {
    for (let i = 0; i < periods.length; i++) {
      avgPeriod += periods[i];
    }
    avgPeriod /= periods.length;
  }

  // Compute amplitude (half peak-to-peak of centered error)
  let minErr = centered[0];
  let maxErr = centered[0];
  for (let i = 1; i < centered.length; i++) {
    if (centered[i] < minErr) {
      minErr = centered[i];
    }
    if (centered[i] > maxErr) {
      maxErr = centered[i];
    }
  }
  const amplitude = (maxErr - minErr) / 2;

  return {
    detected: true,
    period: avgPeriod,
    amplitude,
    zeroCrossings: crossingTimes.length,
  };
}

/**
 * Detect steady-state in the process variable.
 */
export function detectSteadyState(telemetry: TelemetryPoint[]): SteadyStateResult {
  if (telemetry.length < MIN_TELEMETRY_POINTS) {
    return { reached: false, value: 0, standardDeviation: 0, error: 0 };
  }

  // Examine last STEADY_STATE_WINDOW_RATIO of data
  const windowSize = Math.max(5, Math.floor(telemetry.length * STEADY_STATE_WINDOW_RATIO));
  const window = telemetry.slice(-windowSize);

  // Compute mean PV in the window
  let sum = 0;
  for (let i = 0; i < window.length; i++) {
    sum += window[i].pv;
  }
  const mean = sum / window.length;

  // Compute standard deviation
  let sqSum = 0;
  for (let i = 0; i < window.length; i++) {
    const diff = window[i].pv - mean;
    sqSum += diff * diff;
  }
  const stdDev = Math.sqrt(sqSum / window.length);

  // Compute the overall range of PV
  let pvMin = telemetry[0].pv;
  let pvMax = telemetry[0].pv;
  for (let i = 1; i < telemetry.length; i++) {
    if (telemetry[i].pv < pvMin) {
      pvMin = telemetry[i].pv;
    }
    if (telemetry[i].pv > pvMax) {
      pvMax = telemetry[i].pv;
    }
  }
  const range = pvMax - pvMin;

  // Steady state if std dev is within threshold of the range
  const threshold = range > 0 ? STEADY_STATE_THRESHOLD * range : 0.01;
  const reached = stdDev < threshold;

  // Steady-state error relative to last setpoint
  const lastSp = window[window.length - 1].sp;
  const error = mean - lastSp;

  return { reached, value: mean, standardDeviation: stdDev, error };
}

/**
 * Fit a First-Order Plus Dead Time (FOPDT) model to step response data.
 */
export function fitFopdtModel(telemetry: TelemetryPoint[]): FopdtModel {
  if (telemetry.length < MIN_TELEMETRY_POINTS) {
    throw new Error('Not enough telemetry data for FOPDT fitting');
  }

  const initialPv = telemetry[0].pv;
  const initialCo = telemetry[0].co;

  // Find steady-state PV (average of last 20%)
  const ssWindow = Math.max(5, Math.floor(telemetry.length * 0.2));
  let ssSum = 0;
  for (let i = telemetry.length - ssWindow; i < telemetry.length; i++) {
    ssSum += telemetry[i].pv;
  }
  const finalPv = ssSum / ssWindow;

  // Find steady-state CO
  let coSum = 0;
  for (let i = telemetry.length - ssWindow; i < telemetry.length; i++) {
    coSum += telemetry[i].co;
  }
  const finalCo = coSum / ssWindow;

  const pvChange = finalPv - initialPv;
  const coChange = finalCo - initialCo;

  // Process gain K
  const gain = coChange !== 0 ? pvChange / coChange : 1;

  // Dead time: time until PV moves 5% of total change
  const movementThreshold = Math.abs(pvChange) * 0.05;
  let deadTime = 0;
  for (let i = 1; i < telemetry.length; i++) {
    if (Math.abs(telemetry[i].pv - initialPv) > movementThreshold) {
      deadTime = telemetry[i].t - telemetry[0].t;
      break;
    }
  }

  // Time constant: time from dead time to reach 63.2% of total change
  const target632 = initialPv + pvChange * 0.632;
  let timeConstant = 0;
  const direction = pvChange > 0 ? 1 : -1;
  for (let i = 1; i < telemetry.length; i++) {
    if (direction * (telemetry[i].pv - target632) >= 0) {
      timeConstant = (telemetry[i].t - telemetry[0].t) - deadTime;
      break;
    }
  }

  if (timeConstant <= 0) {
    timeConstant = (telemetry[telemetry.length - 1].t - telemetry[0].t) * 0.3;
  }

  return { gain: Math.abs(gain), timeConstant: Math.max(timeConstant, 0.001), deadTime: Math.max(deadTime, 0) };
}

/**
 * Compute PID gains from a FOPDT model using IMC (Internal Model Control) tuning.
 */
export function tuneFromModel(model: FopdtModel): PidGains {
  const { gain, timeConstant, deadTime } = model;
  const lambda = Math.max(timeConstant * 0.5, deadTime * 1.5); // closed-loop time constant

  const kp = timeConstant / (gain * (lambda + deadTime));
  const ki = kp / timeConstant;
  const kd = kp * deadTime * 0.5;

  return { kp, ki, kd };
}

/**
 * Compute PID gains using Ziegler-Nichols relay method.
 * Requires oscillation data (ultimate gain and period).
 */
export function tuneRelayMethod(oscillation: OscillationResult, relayAmplitude: number): PidGains {
  if (!oscillation.detected || oscillation.period <= 0) {
    throw new Error('Cannot tune: no oscillation detected');
  }

  // Ultimate gain: Ku = 4d / (pi * a) where d = relay amplitude, a = oscillation amplitude
  const ku = (4 * relayAmplitude) / (Math.PI * Math.max(oscillation.amplitude, 0.001));
  const tu = oscillation.period;

  // Ziegler-Nichols PID from ultimate parameters
  const kp = 0.6 * ku;
  const ki = kp / (0.5 * tu);
  const kd = kp * 0.125 * tu;

  return { kp, ki, kd };
}

/**
 * Optimize PID gains using gradient descent on the ITAE cost function.
 * Simulates a first-order process response and minimizes ITAE.
 */
export function tuneGradientDescent(
  model: FopdtModel,
  initialGains: PidGains,
  dt = 0.01,
  simDuration = 10,
): PidGains {
  let gains = { ...initialGains };
  const steps = Math.floor(simDuration / dt);

  for (let iter = 0; iter < MAX_GRADIENT_ITERATIONS; iter++) {
    const baseItae = simulateItae(model, gains, dt, steps);

    // Partial derivatives via finite differences
    const delta = 0.01;
    const dKp = gains.kp * delta || 0.001;
    const dKi = gains.ki * delta || 0.001;
    const dKd = gains.kd * delta || 0.001;

    const itaeKp = simulateItae(model, { ...gains, kp: gains.kp + dKp }, dt, steps);
    const itaeKi = simulateItae(model, { ...gains, ki: gains.ki + dKi }, dt, steps);
    const itaeKd = simulateItae(model, { ...gains, kd: gains.kd + dKd }, dt, steps);

    const gradKp = (itaeKp - baseItae) / dKp;
    const gradKi = (itaeKi - baseItae) / dKi;
    const gradKd = (itaeKd - baseItae) / dKd;

    // Update gains
    gains = {
      kp: Math.max(0, gains.kp - GRADIENT_LEARNING_RATE * gradKp),
      ki: Math.max(0, gains.ki - GRADIENT_LEARNING_RATE * gradKi),
      kd: Math.max(0, gains.kd - GRADIENT_LEARNING_RATE * gradKd),
    };

    // Early exit if converged
    const newItae = simulateItae(model, gains, dt, steps);
    if (Math.abs(newItae - baseItae) < 1e-8) {
      break;
    }
  }

  return gains;
}

/**
 * Simulate a PID-controlled FOPDT process and return the ITAE cost.
 */
export function simulateItae(model: FopdtModel, gains: PidGains, dt: number, steps: number): number {
  let pv = 0;
  let integral = 0;
  let prevError = 0;
  let itae = 0;
  const sp = 1; // Unit step

  // Dead time buffer
  const delaySteps = Math.max(1, Math.round(model.deadTime / dt));
  const coBuffer = new Float64Array(delaySteps).fill(0);
  let bufIdx = 0;

  for (let i = 0; i < steps; i++) {
    const t = i * dt;
    const error = sp - pv;

    // PID output
    integral += error * dt;
    const derivative = (error - prevError) / dt;
    const co = gains.kp * error + gains.ki * integral + gains.kd * derivative;
    prevError = error;

    // Apply dead time
    const delayedCo = coBuffer[bufIdx];
    coBuffer[bufIdx] = co;
    bufIdx = (bufIdx + 1) % delaySteps;

    // FOPDT process: tau * dpv/dt + pv = K * co_delayed
    const dpv = (model.gain * delayedCo - pv) / model.timeConstant;
    pv += dpv * dt;

    // ITAE accumulation
    itae += t * Math.abs(error) * dt;
  }

  return itae;
}

/**
 * Compute performance metrics from telemetry data.
 */
export function computePerformanceMetrics(telemetry: TelemetryPoint[]): PerformanceMetrics {
  if (telemetry.length < 2) {
    return { riseTime: 0, settlingTime: 0, overshootPercent: 0, iae: 0, itae: 0, steadyStateError: 0 };
  }

  const initialPv = telemetry[0].pv;
  const sp = telemetry[telemetry.length - 1].sp;
  const pvChange = sp - initialPv;
  const absPvChange = Math.abs(pvChange);
  const direction = pvChange >= 0 ? 1 : -1;

  // Rise time (10% to 90%)
  const target90 = initialPv + pvChange * 0.9;
  const target10 = initialPv + pvChange * 0.1;
  let t10 = telemetry[telemetry.length - 1].t;
  let t90 = telemetry[telemetry.length - 1].t;
  let found10 = false;
  let found90 = false;

  for (let i = 1; i < telemetry.length; i++) {
    if (!found10 && direction * (telemetry[i].pv - target10) >= 0) {
      t10 = telemetry[i].t;
      found10 = true;
    }
    if (!found90 && direction * (telemetry[i].pv - target90) >= 0) {
      t90 = telemetry[i].t;
      found90 = true;
    }
  }
  const riseTime = t90 - t10;

  // Overshoot
  let peakPv = telemetry[0].pv;
  for (let i = 1; i < telemetry.length; i++) {
    if (direction > 0 && telemetry[i].pv > peakPv) {
      peakPv = telemetry[i].pv;
    } else if (direction < 0 && telemetry[i].pv < peakPv) {
      peakPv = telemetry[i].pv;
    }
  }
  const overshootAbs = direction * (peakPv - sp);
  const overshootPercent = absPvChange > 0 && overshootAbs > 0 ? (overshootAbs / absPvChange) * 100 : 0;

  // Settling time (2% band)
  const settlingBand = absPvChange > 0 ? absPvChange * SETTLING_TOLERANCE : 0.01;
  let settlingTime = telemetry[telemetry.length - 1].t;
  for (let i = telemetry.length - 1; i >= 0; i--) {
    if (Math.abs(telemetry[i].pv - sp) > settlingBand) {
      settlingTime = i < telemetry.length - 1 ? telemetry[i + 1].t : telemetry[i].t;
      break;
    }
  }

  // IAE and ITAE
  let iae = 0;
  let itae = 0;
  for (let i = 1; i < telemetry.length; i++) {
    const dt = telemetry[i].t - telemetry[i - 1].t;
    const absError = Math.abs(telemetry[i].pv - telemetry[i].sp);
    iae += absError * dt;
    itae += telemetry[i].t * absError * dt;
  }

  // Steady-state error (from last 10%)
  const ssCount = Math.max(3, Math.floor(telemetry.length * 0.1));
  let ssSum = 0;
  for (let i = telemetry.length - ssCount; i < telemetry.length; i++) {
    ssSum += telemetry[i].pv;
  }
  const ssMean = ssSum / ssCount;
  const steadyStateError = Math.abs(ssMean - sp);

  return { riseTime, settlingTime, overshootPercent, iae, itae, steadyStateError };
}

/**
 * Compare before/after performance and generate improvement report.
 */
export function comparePerformance(before: PerformanceMetrics, after: PerformanceMetrics): ImprovementReport {
  const improvements: Record<string, number> = {};

  // For each metric, positive improvement = better
  const metricPairs: Array<{ key: string; before: number; after: number; lowerIsBetter: boolean }> = [
    { key: 'riseTime', before: before.riseTime, after: after.riseTime, lowerIsBetter: true },
    { key: 'settlingTime', before: before.settlingTime, after: after.settlingTime, lowerIsBetter: true },
    { key: 'overshoot', before: before.overshootPercent, after: after.overshootPercent, lowerIsBetter: true },
    { key: 'iae', before: before.iae, after: after.iae, lowerIsBetter: true },
    { key: 'itae', before: before.itae, after: after.itae, lowerIsBetter: true },
    { key: 'steadyStateError', before: before.steadyStateError, after: after.steadyStateError, lowerIsBetter: true },
  ];

  let totalImprovement = 0;
  let validMetrics = 0;

  for (const m of metricPairs) {
    if (m.before > 0) {
      const change = ((m.before - m.after) / m.before) * 100;
      improvements[m.key] = m.lowerIsBetter ? change : -change;
      totalImprovement += improvements[m.key];
      validMetrics++;
    } else {
      improvements[m.key] = 0;
    }
  }

  const overallScore = validMetrics > 0 ? Math.max(-1, Math.min(1, totalImprovement / (validMetrics * 100))) : 0;

  // Generate summary
  const parts: string[] = [];
  if (improvements['riseTime'] > 5) {
    parts.push(`Rise time improved by ${improvements['riseTime'].toFixed(1)}%`);
  }
  if (improvements['settlingTime'] > 5) {
    parts.push(`Settling time improved by ${improvements['settlingTime'].toFixed(1)}%`);
  }
  if (improvements['overshoot'] > 5) {
    parts.push(`Overshoot reduced by ${improvements['overshoot'].toFixed(1)}%`);
  }
  if (improvements['iae'] > 5) {
    parts.push(`IAE improved by ${improvements['iae'].toFixed(1)}%`);
  }

  const summary = parts.length > 0
    ? `Tuning improved performance: ${parts.join('. ')}.`
    : overallScore > 0
      ? 'Marginal improvement detected.'
      : 'No significant improvement detected. Consider collecting more data or trying a different strategy.';

  return { before, after, overallScore, improvements, summary };
}

/**
 * Generate Arduino PID code with the given gains.
 */
export function generatePidCode(gains: PidGains, options: {
  inputPin?: string;
  outputPin?: string;
  setpoint?: number;
  loopMs?: number;
  includeSerial?: boolean;
} = {}): string {
  const {
    inputPin = 'A0',
    outputPin = '9',
    setpoint = 512,
    loopMs = 10,
    includeSerial = true,
  } = options;

  const dtSec = (loopMs / 1000).toFixed(4);

  const lines: string[] = [
    '// PID Controller — Auto-tuned by ProtoPulse AI PID Assistant',
    `// Kp = ${gains.kp.toFixed(6)}, Ki = ${gains.ki.toFixed(6)}, Kd = ${gains.kd.toFixed(6)}`,
    '',
    `double Kp = ${gains.kp.toFixed(6)};`,
    `double Ki = ${gains.ki.toFixed(6)};`,
    `double Kd = ${gains.kd.toFixed(6)};`,
    `double setpoint = ${String(setpoint)}.0;`,
    '',
    'double integral = 0.0;',
    'double prevError = 0.0;',
    'unsigned long lastTime = 0;',
    '',
    'void setup() {',
    `  pinMode(${outputPin}, OUTPUT);`,
  ];

  if (includeSerial) {
    lines.push('  Serial.begin(115200);');
  }

  lines.push('  lastTime = millis();');
  lines.push('}');
  lines.push('');
  lines.push('void loop() {');
  lines.push('  unsigned long now = millis();');
  lines.push(`  if (now - lastTime < ${String(loopMs)}) return;`);
  lines.push('  lastTime = now;');
  lines.push('');
  lines.push(`  double input = analogRead(${inputPin});`);
  lines.push('  double error = setpoint - input;');
  lines.push('');
  lines.push(`  integral += error * ${dtSec};`);
  lines.push('  double derivative = (error - prevError) / ' + dtSec + ';');
  lines.push('  prevError = error;');
  lines.push('');
  lines.push('  double output = Kp * error + Ki * integral + Kd * derivative;');
  lines.push('  output = constrain(output, 0, 255);');
  lines.push(`  analogWrite(${outputPin}, (int)output);`);

  if (includeSerial) {
    lines.push('');
    lines.push('  Serial.print("sp:"); Serial.print(setpoint);');
    lines.push('  Serial.print(",pv:"); Serial.print(input);');
    lines.push('  Serial.print(",co:"); Serial.println(output);');
  }

  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// AiPidAssistant
// ---------------------------------------------------------------------------

export class AiPidAssistant {
  private static _instance: AiPidAssistant | null = null;

  private _listeners = new Set<Listener>();
  private _snapshotCache: AiPidSnapshot | null = null;
  private _activeSession: TuningSession | null = null;
  private _sessionHistory: TuningSession[] = [];
  private _nextSessionId = 1;

  private constructor() {}

  static getInstance(): AiPidAssistant {
    if (!AiPidAssistant._instance) {
      AiPidAssistant._instance = new AiPidAssistant();
    }
    return AiPidAssistant._instance;
  }

  /** Create a fresh (non-singleton) instance. Useful for testing. */
  static create(): AiPidAssistant {
    return new AiPidAssistant();
  }

  // -----------------------------------------------------------------------
  // Subscription (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  subscribe = (listener: Listener): (() => void) => {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  };

  getSnapshot = (): AiPidSnapshot => {
    if (this._snapshotCache) {
      return this._snapshotCache;
    }
    this._snapshotCache = this._buildSnapshot();
    return this._snapshotCache;
  };

  private _invalidateCache(): void {
    this._snapshotCache = null;
  }

  private _notify(): void {
    this._invalidateCache();
    const listeners = Array.from(this._listeners);
    for (let i = 0; i < listeners.length; i++) {
      listeners[i]();
    }
  }

  // -----------------------------------------------------------------------
  // Session management
  // -----------------------------------------------------------------------

  /** Start a new tuning session. */
  startSession(strategy?: TuningStrategy): string {
    // Archive current session if exists
    if (this._activeSession) {
      this._archiveSession();
    }

    const id = `pid-session-${String(this._nextSessionId++)}`;
    this._activeSession = {
      id,
      state: 'collecting',
      telemetry: [],
      strategy: strategy ?? null,
      bestResult: null,
      allResults: [],
      oscillation: null,
      steadyState: null,
      beforeMetrics: null,
      afterMetrics: null,
      improvementReport: null,
      errorMessage: null,
      createdAt: Date.now(),
    };

    this._notify();
    return id;
  }

  /** Get the active session (null if none). */
  getActiveSession(): TuningSession | null {
    return this._activeSession ? { ...this._activeSession } : null;
  }

  /** Get the session history. */
  getSessionHistory(): TuningSession[] {
    return [...this._sessionHistory];
  }

  /** Cancel the active session. */
  cancelSession(): void {
    if (!this._activeSession) {
      return;
    }
    this._activeSession.state = 'idle';
    this._archiveSession();
    this._notify();
  }

  // -----------------------------------------------------------------------
  // Telemetry feeding
  // -----------------------------------------------------------------------

  /** Feed a telemetry data point to the active session. */
  feedTelemetry(point: TelemetryPoint): void {
    if (!this._activeSession || this._activeSession.state !== 'collecting') {
      return;
    }

    this._activeSession.telemetry.push(point);
    this._notify();
  }

  /** Feed multiple telemetry points at once. */
  feedTelemetryBatch(points: TelemetryPoint[]): void {
    if (!this._activeSession || this._activeSession.state !== 'collecting') {
      return;
    }

    for (let i = 0; i < points.length; i++) {
      this._activeSession.telemetry.push(points[i]);
    }
    this._notify();
  }

  /** Get the number of collected telemetry points. */
  getTelemetryCount(): number {
    return this._activeSession?.telemetry.length ?? 0;
  }

  // -----------------------------------------------------------------------
  // Analysis and tuning
  // -----------------------------------------------------------------------

  /** Analyze the collected telemetry and compute tuning results. */
  analyze(): void {
    if (!this._activeSession) {
      return;
    }

    if (this._activeSession.telemetry.length < MIN_TELEMETRY_POINTS) {
      this._activeSession.state = 'error';
      this._activeSession.errorMessage = `Need at least ${String(MIN_TELEMETRY_POINTS)} telemetry points, have ${String(this._activeSession.telemetry.length)}`;
      this._notify();
      return;
    }

    this._activeSession.state = 'analyzing';
    this._notify();

    try {
      const telemetry = this._activeSession.telemetry;

      // Detect oscillation and steady state
      this._activeSession.oscillation = detectOscillation(telemetry);
      this._activeSession.steadyState = detectSteadyState(telemetry);

      // Compute before-tuning metrics
      this._activeSession.beforeMetrics = computePerformanceMetrics(telemetry);

      // Apply tuning strategies
      this._activeSession.state = 'tuning';
      this._notify();

      const results: TuningResult[] = [];
      const strategy = this._activeSession.strategy;

      // Strategy 1: Model-based (FOPDT + IMC)
      if (!strategy || strategy === 'model-based') {
        try {
          const model = fitFopdtModel(telemetry);
          const gains = tuneFromModel(model);
          results.push({
            strategy: 'model-based',
            gains,
            model,
            description: `IMC tuning from FOPDT model: K=${model.gain.toFixed(3)}, τ=${model.timeConstant.toFixed(3)}s, θ=${model.deadTime.toFixed(3)}s`,
            confidence: 0.7,
          });
        } catch {
          // Model fitting may fail
        }
      }

      // Strategy 2: Relay method (if oscillation detected)
      if ((!strategy || strategy === 'relay') && this._activeSession.oscillation.detected) {
        try {
          // Estimate relay amplitude from CO range
          let coMin = telemetry[0].co;
          let coMax = telemetry[0].co;
          for (let i = 1; i < telemetry.length; i++) {
            if (telemetry[i].co < coMin) {
              coMin = telemetry[i].co;
            }
            if (telemetry[i].co > coMax) {
              coMax = telemetry[i].co;
            }
          }
          const relayAmplitude = (coMax - coMin) / 2;

          if (relayAmplitude > 0) {
            const gains = tuneRelayMethod(this._activeSession.oscillation, relayAmplitude);
            results.push({
              strategy: 'relay',
              gains,
              description: `Relay auto-tune: Tu=${this._activeSession.oscillation.period.toFixed(3)}s, amplitude=${this._activeSession.oscillation.amplitude.toFixed(3)}`,
              confidence: 0.8,
            });
          }
        } catch {
          // Relay method may fail
        }
      }

      // Strategy 3: Gradient descent optimization
      if (!strategy || strategy === 'gradient-descent') {
        try {
          const model = fitFopdtModel(telemetry);
          const initialGains = tuneFromModel(model);
          const optimizedGains = tuneGradientDescent(model, initialGains);
          results.push({
            strategy: 'gradient-descent',
            gains: optimizedGains,
            model,
            description: 'ITAE-optimized PID gains via gradient descent on FOPDT model',
            confidence: 0.85,
          });
        } catch {
          // Optimization may fail
        }
      }

      this._activeSession.allResults = results;

      // Select best result (highest confidence)
      if (results.length > 0) {
        let best = results[0];
        for (let i = 1; i < results.length; i++) {
          if (results[i].confidence > best.confidence) {
            best = results[i];
          }
        }
        this._activeSession.bestResult = best;
      }

      this._activeSession.state = 'complete';
    } catch (err) {
      this._activeSession.state = 'error';
      this._activeSession.errorMessage = err instanceof Error ? err.message : 'Unknown error during analysis';
    }

    this._notify();
  }

  /**
   * Feed verification telemetry (after applying tuned gains) and generate
   * an improvement report comparing before/after.
   */
  verify(afterTelemetry: TelemetryPoint[]): ImprovementReport | null {
    if (!this._activeSession || !this._activeSession.beforeMetrics) {
      return null;
    }

    this._activeSession.state = 'verifying';
    this._notify();

    const afterMetrics = computePerformanceMetrics(afterTelemetry);
    this._activeSession.afterMetrics = afterMetrics;

    const report = comparePerformance(this._activeSession.beforeMetrics, afterMetrics);
    this._activeSession.improvementReport = report;
    this._activeSession.state = 'complete';
    this._notify();

    return report;
  }

  // -----------------------------------------------------------------------
  // Code generation
  // -----------------------------------------------------------------------

  /** Generate Arduino code for the best tuned gains. */
  generateCode(options?: Parameters<typeof generatePidCode>[1]): string | null {
    if (!this._activeSession?.bestResult) {
      return null;
    }
    return generatePidCode(this._activeSession.bestResult.gains, options);
  }

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  /** Reset all state. */
  reset(): void {
    this._activeSession = null;
    this._sessionHistory = [];
    this._nextSessionId = 1;
    this._notify();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private _archiveSession(): void {
    if (this._activeSession) {
      this._sessionHistory.push(this._activeSession);
      if (this._sessionHistory.length > MAX_SESSION_HISTORY) {
        this._sessionHistory = this._sessionHistory.slice(-MAX_SESSION_HISTORY);
      }
      this._activeSession = null;
    }
  }

  private _buildSnapshot(): AiPidSnapshot {
    return {
      activeSession: this._activeSession ? { ...this._activeSession } : null,
      sessionHistory: [...this._sessionHistory],
    };
  }
}

// Re-export constants for testing
export {
  MIN_TELEMETRY_POINTS,
  OSCILLATION_MIN_CROSSINGS,
  STEADY_STATE_WINDOW_RATIO,
  STEADY_STATE_THRESHOLD,
  SETTLING_TOLERANCE,
  MAX_GRADIENT_ITERATIONS,
  GRADIENT_LEARNING_RATE,
  MAX_SESSION_HISTORY,
};
