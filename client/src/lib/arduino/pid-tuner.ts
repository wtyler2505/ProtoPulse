/**
 * PID Tuner — Auto-tuning assistant for control loops (BL-0434)
 *
 * Analyzes step response data to extract performance metrics, then applies
 * classical tuning methods (Ziegler-Nichols, Cohen-Coon) to compute PID gains.
 * Includes an autoTune function that selects the best method, a suggest-improvements
 * helper, and Arduino code generation for quick deployment.
 *
 * Designed for makers tuning motor speed, temperature, or position controllers —
 * no control theory background required.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single time-domain data point. */
export interface TimePoint {
  /** Time in seconds. */
  t: number;
  /** Measured process variable (e.g. RPM, °C, position). */
  value: number;
}

/** Performance metrics extracted from a step response. */
export interface StepResponseMetrics {
  /** Time to reach 10% of final value (seconds). */
  riseTime10: number;
  /** Time to reach 90% of final value (seconds). */
  riseTime90: number;
  /** Rise time (10% → 90%) in seconds. */
  riseTime: number;
  /** Time to first reach the final (steady-state) value (seconds). */
  timeToTarget: number;
  /** Settling time — time after which value stays within ±2% of final value (seconds). */
  settlingTime: number;
  /** Overshoot percentage (0 = no overshoot, 100 = doubles the setpoint). */
  overshootPercent: number;
  /** Peak value reached. */
  peakValue: number;
  /** Steady-state (final) value. */
  steadyStateValue: number;
  /** Initial value before the step. */
  initialValue: number;
  /** Dead time — delay before the response first moves (seconds). */
  deadTime: number;
  /** Time constant — time to reach 63.2% of the step change (seconds). */
  timeConstant: number;
  /** Static gain — ratio of output change to input change. */
  staticGain: number;
  /** Whether the system is underdamped (has overshoot). */
  isUnderdamped: boolean;
}

/** PID gains. */
export interface PidGains {
  /** Proportional gain. */
  kp: number;
  /** Integral gain (1/s). */
  ki: number;
  /** Derivative gain (s). */
  kd: number;
}

/** Tuning method identifier. */
export type TuningMethod = 'ziegler-nichols' | 'cohen-coon';

/** Controller type for tuning. */
export type ControllerType = 'P' | 'PI' | 'PID';

/** Result of a tuning computation. */
export interface TuningResult {
  /** Computed PID gains. */
  gains: PidGains;
  /** Method used. */
  method: TuningMethod;
  /** Controller type. */
  controllerType: ControllerType;
  /** Human-readable description of the tuning. */
  description: string;
}

/** A suggestion for improving control loop performance. */
export interface Improvement {
  /** Category of improvement. */
  category: 'overshoot' | 'settling' | 'steady_state' | 'noise' | 'oscillation' | 'general';
  /** Human-readable suggestion. */
  message: string;
  /** Severity: how important this improvement is. */
  priority: 'high' | 'medium' | 'low';
}

/** Full auto-tune result. */
export interface AutoTuneResult {
  /** Step response metrics. */
  metrics: StepResponseMetrics;
  /** Best tuning result (primary recommendation). */
  recommended: TuningResult;
  /** All tuning results computed. */
  allResults: TuningResult[];
  /** Improvement suggestions. */
  improvements: Improvement[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Settling tolerance (±2% of steady-state). */
const SETTLING_TOLERANCE = 0.02;

/** Minimum dead time to avoid division issues. */
const MIN_DEAD_TIME = 1e-6;

/** Threshold for "movement" to detect dead time (0.5% of step change). */
const DEAD_TIME_MOVEMENT_THRESHOLD = 0.005;

// ---------------------------------------------------------------------------
// Step response analysis
// ---------------------------------------------------------------------------

/**
 * Analyze a step response to extract performance metrics.
 *
 * @param data - Time-domain step response data, sorted by time ascending.
 * @param stepMagnitude - Magnitude of the input step (default 1.0).
 *   Used to compute static gain = (output change) / stepMagnitude.
 */
export function analyzeStepResponse(data: TimePoint[], stepMagnitude = 1.0): StepResponseMetrics {
  if (data.length < 2) {
    throw new Error('Step response data must have at least 2 points');
  }

  const initialValue = data[0].value;

  // Find steady-state value (average of last 10% of data, or last 5 points minimum)
  const steadyCount = Math.max(5, Math.floor(data.length * 0.1));
  const steadySlice = data.slice(-steadyCount);
  let steadySum = 0;
  for (let i = 0; i < steadySlice.length; i++) {
    steadySum += steadySlice[i].value;
  }
  const steadyStateValue = steadySum / steadySlice.length;

  const stepChange = steadyStateValue - initialValue;
  const absStepChange = Math.abs(stepChange);

  if (absStepChange < 1e-12) {
    // No measurable response
    return {
      riseTime10: 0,
      riseTime90: 0,
      riseTime: 0,
      timeToTarget: 0,
      settlingTime: 0,
      overshootPercent: 0,
      peakValue: initialValue,
      steadyStateValue,
      initialValue,
      deadTime: 0,
      timeConstant: 0,
      staticGain: 0,
      isUnderdamped: false,
    };
  }

  const direction = stepChange > 0 ? 1 : -1;

  // Thresholds (in absolute value space relative to initial)
  const val10 = initialValue + stepChange * 0.1;
  const val63 = initialValue + stepChange * 0.632;
  const val90 = initialValue + stepChange * 0.9;

  // Find dead time: time before response moves beyond threshold
  let deadTime = 0;
  const movementThreshold = absStepChange * DEAD_TIME_MOVEMENT_THRESHOLD;
  for (let i = 1; i < data.length; i++) {
    if (Math.abs(data[i].value - initialValue) > movementThreshold) {
      // Interpolate between i-1 and i
      const t0 = data[i - 1].t;
      const t1 = data[i].t;
      const v0 = Math.abs(data[i - 1].value - initialValue);
      const v1 = Math.abs(data[i].value - initialValue);
      if (v1 > v0) {
        const frac = (movementThreshold - v0) / (v1 - v0);
        deadTime = t0 + frac * (t1 - t0);
      } else {
        deadTime = t0;
      }
      break;
    }
  }

  // Find rise times and time constant by scanning data
  let riseTime10 = data[data.length - 1].t;
  let riseTime90 = data[data.length - 1].t;
  let timeConstant = data[data.length - 1].t;
  let timeToTarget = data[data.length - 1].t;
  let found10 = false;
  let found63 = false;
  let found90 = false;
  let foundTarget = false;

  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1].value;
    const curr = data[i].value;

    if (!found10 && direction * (curr - val10) >= 0) {
      riseTime10 = interpolateTime(data[i - 1], data[i], val10);
      found10 = true;
    }
    if (!found63 && direction * (curr - val63) >= 0) {
      timeConstant = interpolateTime(data[i - 1], data[i], val63) - deadTime;
      found63 = true;
    }
    if (!found90 && direction * (curr - val90) >= 0) {
      riseTime90 = interpolateTime(data[i - 1], data[i], val90);
      found90 = true;
    }
    if (!foundTarget && direction * (curr - steadyStateValue) >= 0) {
      timeToTarget = interpolateTime(data[i - 1], data[i], steadyStateValue);
      foundTarget = true;
    }
  }

  if (timeConstant < 0) {
    timeConstant = 0;
  }

  // Find peak value
  let peakValue = data[0].value;
  for (let i = 1; i < data.length; i++) {
    if (direction > 0) {
      if (data[i].value > peakValue) {
        peakValue = data[i].value;
      }
    } else {
      if (data[i].value < peakValue) {
        peakValue = data[i].value;
      }
    }
  }

  // Overshoot
  const overshootAbs = direction * (peakValue - steadyStateValue);
  const overshootPercent = overshootAbs > 0 ? (overshootAbs / absStepChange) * 100 : 0;

  // Settling time (last time the signal exits the ±2% band)
  const settlingBand = absStepChange * SETTLING_TOLERANCE;
  let settlingTime = data[data.length - 1].t;
  for (let i = data.length - 1; i >= 0; i--) {
    if (Math.abs(data[i].value - steadyStateValue) > settlingBand) {
      settlingTime = i < data.length - 1 ? data[i + 1].t : data[i].t;
      break;
    }
  }

  // Static gain
  const staticGain = stepMagnitude !== 0 ? stepChange / stepMagnitude : 0;

  return {
    riseTime10,
    riseTime90,
    riseTime: riseTime90 - riseTime10,
    timeToTarget,
    settlingTime,
    overshootPercent,
    peakValue,
    steadyStateValue,
    initialValue,
    deadTime,
    timeConstant,
    staticGain,
    isUnderdamped: overshootPercent > 0,
  };
}

/** Linearly interpolate time at which `targetValue` is crossed. */
function interpolateTime(p0: TimePoint, p1: TimePoint, targetValue: number): number {
  const dv = p1.value - p0.value;
  if (Math.abs(dv) < 1e-15) {
    return p0.t;
  }
  const frac = (targetValue - p0.value) / dv;
  return p0.t + frac * (p1.t - p0.t);
}

// ---------------------------------------------------------------------------
// Ziegler-Nichols tuning (open-loop / reaction curve method)
// ---------------------------------------------------------------------------

/**
 * Compute PID gains using Ziegler-Nichols open-loop method.
 * Based on the process reaction curve parameters: K (gain), L (dead time), T (time constant).
 */
export function tuneZieglerNichols(
  metrics: StepResponseMetrics,
  controllerType: ControllerType = 'PID',
): TuningResult {
  const K = Math.abs(metrics.staticGain) || 1;
  const L = Math.max(metrics.deadTime, MIN_DEAD_TIME);
  const T = Math.max(metrics.timeConstant, MIN_DEAD_TIME);

  let kp: number;
  let ki: number;
  let kd: number;
  let description: string;

  switch (controllerType) {
    case 'P': {
      kp = T / (K * L);
      ki = 0;
      kd = 0;
      description = `Ziegler-Nichols P controller: Kp = T/(K*L) = ${kp.toFixed(4)}. Simple proportional control — fast but may have steady-state error.`;
      break;
    }
    case 'PI': {
      kp = 0.9 * T / (K * L);
      const ti = L / 0.3;
      ki = kp / ti;
      kd = 0;
      description = `Ziegler-Nichols PI controller: Kp = ${kp.toFixed(4)}, Ki = ${ki.toFixed(4)} (Ti = ${ti.toFixed(4)}s). Eliminates steady-state error but may overshoot.`;
      break;
    }
    case 'PID': {
      kp = 1.2 * T / (K * L);
      const tiPid = 2 * L;
      const tdPid = 0.5 * L;
      ki = kp / tiPid;
      kd = kp * tdPid;
      description = `Ziegler-Nichols PID controller: Kp = ${kp.toFixed(4)}, Ki = ${ki.toFixed(4)} (Ti = ${tiPid.toFixed(4)}s), Kd = ${kd.toFixed(4)} (Td = ${tdPid.toFixed(4)}s). Good starting point — typically needs fine-tuning to reduce overshoot.`;
      break;
    }
  }

  return {
    gains: { kp, ki, kd },
    method: 'ziegler-nichols',
    controllerType,
    description,
  };
}

// ---------------------------------------------------------------------------
// Cohen-Coon tuning
// ---------------------------------------------------------------------------

/**
 * Compute PID gains using Cohen-Coon method.
 * Better than Z-N for processes with large dead time relative to time constant.
 */
export function tuneCohenCoon(
  metrics: StepResponseMetrics,
  controllerType: ControllerType = 'PID',
): TuningResult {
  const K = Math.abs(metrics.staticGain) || 1;
  const L = Math.max(metrics.deadTime, MIN_DEAD_TIME);
  const T = Math.max(metrics.timeConstant, MIN_DEAD_TIME);
  const r = L / T; // dead-time ratio

  let kp: number;
  let ki: number;
  let kd: number;
  let description: string;

  switch (controllerType) {
    case 'P': {
      kp = (T / (K * L)) * (1 + r / 3);
      ki = 0;
      kd = 0;
      description = `Cohen-Coon P controller: Kp = ${kp.toFixed(4)}. Accounts for dead-time ratio (L/T = ${r.toFixed(3)}).`;
      break;
    }
    case 'PI': {
      kp = (T / (K * L)) * (0.9 + r / 12);
      const ti = L * (30 + 3 * r) / (9 + 20 * r);
      ki = kp / ti;
      kd = 0;
      description = `Cohen-Coon PI controller: Kp = ${kp.toFixed(4)}, Ki = ${ki.toFixed(4)} (Ti = ${ti.toFixed(4)}s). Reduced overshoot compared to Z-N for dead-time ratio ${r.toFixed(3)}.`;
      break;
    }
    case 'PID': {
      kp = (T / (K * L)) * (4 / 3 + r / 4);
      const tiPid = L * (32 + 6 * r) / (13 + 8 * r);
      const tdPid = L * 4 / (11 + 2 * r);
      ki = kp / tiPid;
      kd = kp * tdPid;
      description = `Cohen-Coon PID controller: Kp = ${kp.toFixed(4)}, Ki = ${ki.toFixed(4)} (Ti = ${tiPid.toFixed(4)}s), Kd = ${kd.toFixed(4)} (Td = ${tdPid.toFixed(4)}s). Better quarter-decay ratio for dead-time ratio ${r.toFixed(3)}.`;
      break;
    }
  }

  return {
    gains: { kp, ki, kd },
    method: 'cohen-coon',
    controllerType,
    description,
  };
}

// ---------------------------------------------------------------------------
// Auto-tune
// ---------------------------------------------------------------------------

/**
 * Automatically analyze step response data and select the best tuning method.
 *
 * @param data - Step response data points, time-ascending.
 * @param stepMagnitude - Magnitude of input step (default 1.0).
 * @param controllerType - Desired controller type (default 'PID').
 * @param preferredMethod - Force a specific method (optional).
 */
export function autoTune(
  data: TimePoint[],
  stepMagnitude = 1.0,
  controllerType: ControllerType = 'PID',
  preferredMethod?: TuningMethod,
): AutoTuneResult {
  const metrics = analyzeStepResponse(data, stepMagnitude);

  // Compute results for both methods
  const znResult = tuneZieglerNichols(metrics, controllerType);
  const ccResult = tuneCohenCoon(metrics, controllerType);
  const allResults = [znResult, ccResult];

  // Select best method
  let recommended: TuningResult;
  if (preferredMethod === 'ziegler-nichols') {
    recommended = znResult;
  } else if (preferredMethod === 'cohen-coon') {
    recommended = ccResult;
  } else {
    // Heuristic: Cohen-Coon is better when dead-time ratio L/T > 0.25
    const ratio = metrics.deadTime / Math.max(metrics.timeConstant, MIN_DEAD_TIME);
    recommended = ratio > 0.25 ? ccResult : znResult;
  }

  const improvements = suggestImprovements(metrics);

  return { metrics, recommended, allResults, improvements };
}

// ---------------------------------------------------------------------------
// Suggest improvements
// ---------------------------------------------------------------------------

/** Analyze step response metrics and suggest improvements. */
export function suggestImprovements(metrics: StepResponseMetrics): Improvement[] {
  const improvements: Improvement[] = [];

  // Overshoot
  if (metrics.overshootPercent > 30) {
    improvements.push({
      category: 'overshoot',
      message: `Overshoot is ${metrics.overshootPercent.toFixed(1)}% — this is very high. Reduce Kp by 20-30% or increase Kd. Consider switching to a PI controller if derivative action causes noise amplification.`,
      priority: 'high',
    });
  } else if (metrics.overshootPercent > 10) {
    improvements.push({
      category: 'overshoot',
      message: `Overshoot is ${metrics.overshootPercent.toFixed(1)}%. Slightly reduce Kp or increase Kd to bring it under 10%.`,
      priority: 'medium',
    });
  }

  // Settling time
  if (metrics.settlingTime > 10 * metrics.riseTime && metrics.riseTime > 0) {
    improvements.push({
      category: 'settling',
      message: `Settling time (${metrics.settlingTime.toFixed(2)}s) is more than 10x the rise time (${metrics.riseTime.toFixed(2)}s). The system is oscillating. Increase Kd or decrease Ki to add damping.`,
      priority: 'high',
    });
  } else if (metrics.settlingTime > 5 * metrics.riseTime && metrics.riseTime > 0) {
    improvements.push({
      category: 'settling',
      message: `Settling time (${metrics.settlingTime.toFixed(2)}s) is ${(metrics.settlingTime / metrics.riseTime).toFixed(1)}x the rise time. A small increase in Kd may help damp residual oscillations.`,
      priority: 'medium',
    });
  }

  // Dead time warning
  if (metrics.deadTime > 0 && metrics.timeConstant > 0) {
    const ratio = metrics.deadTime / metrics.timeConstant;
    if (ratio > 1) {
      improvements.push({
        category: 'general',
        message: `Dead time (${metrics.deadTime.toFixed(3)}s) exceeds the time constant (${metrics.timeConstant.toFixed(3)}s). This makes PID tuning difficult. Consider reducing sensor/actuator delays or using a Smith predictor.`,
        priority: 'high',
      });
    } else if (ratio > 0.5) {
      improvements.push({
        category: 'general',
        message: `Dead-time ratio L/T = ${ratio.toFixed(2)} is significant. Cohen-Coon tuning is recommended over Ziegler-Nichols for this process.`,
        priority: 'medium',
      });
    }
  }

  // No overshoot but slow
  if (metrics.overshootPercent === 0 && metrics.riseTime > 0 && metrics.settlingTime > 3 * metrics.riseTime) {
    improvements.push({
      category: 'steady_state',
      message: 'Response is overdamped (no overshoot but slow). Increase Kp to speed up the response, or add/increase Ki to eliminate steady-state error faster.',
      priority: 'medium',
    });
  }

  // Oscillation detection (underdamped with high overshoot)
  if (metrics.isUnderdamped && metrics.overshootPercent > 50) {
    improvements.push({
      category: 'oscillation',
      message: `System is highly underdamped with ${metrics.overshootPercent.toFixed(1)}% overshoot. Risk of sustained oscillation. Significantly reduce Kp (try 50% of current value) and increase Kd.`,
      priority: 'high',
    });
  }

  // Sort by priority
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  improvements.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return improvements;
}

// ---------------------------------------------------------------------------
// Arduino code generation
// ---------------------------------------------------------------------------

/**
 * Generate Arduino PID controller code for the given gains.
 *
 * @param gains - PID gains to embed.
 * @param options - Code generation options.
 */
export function generateArduinoCode(
  gains: PidGains,
  options: {
    /** Variable name for the setpoint (default "setpoint"). */
    setpointVar?: string;
    /** Analog input pin for feedback (default "A0"). */
    inputPin?: string;
    /** PWM output pin (default "9"). */
    outputPin?: string;
    /** Loop interval in milliseconds (default 10). */
    loopIntervalMs?: number;
    /** Include serial plotting output (default true). */
    serialPlot?: boolean;
    /** Output range min (default 0). */
    outputMin?: number;
    /** Output range max (default 255). */
    outputMax?: number;
  } = {},
): string {
  const {
    setpointVar = 'setpoint',
    inputPin = 'A0',
    outputPin = '9',
    loopIntervalMs = 10,
    serialPlot = true,
    outputMin = 0,
    outputMax = 255,
  } = options;

  const dtSec = (loopIntervalMs / 1000).toFixed(4);

  const lines: string[] = [
    '// PID Controller — Generated by ProtoPulse',
    `// Kp = ${gains.kp.toFixed(6)}, Ki = ${gains.ki.toFixed(6)}, Kd = ${gains.kd.toFixed(6)}`,
    '',
    `const double Kp = ${gains.kp.toFixed(6)};`,
    `const double Ki = ${gains.ki.toFixed(6)};`,
    `const double Kd = ${gains.kd.toFixed(6)};`,
    '',
    `const int INPUT_PIN = ${inputPin};`,
    `const int OUTPUT_PIN = ${outputPin};`,
    `const unsigned long LOOP_INTERVAL_MS = ${String(loopIntervalMs)};`,
    `const double DT = ${dtSec}; // seconds`,
    `const double OUTPUT_MIN = ${String(outputMin)}.0;`,
    `const double OUTPUT_MAX = ${String(outputMax)}.0;`,
    '',
    `double ${setpointVar} = 512.0; // Adjust to your target value`,
    'double integral = 0.0;',
    'double prevError = 0.0;',
    'unsigned long lastTime = 0;',
    '',
    'void setup() {',
    `  pinMode(OUTPUT_PIN, OUTPUT);`,
    '  Serial.begin(115200);',
    '  lastTime = millis();',
    '}',
    '',
    'void loop() {',
    '  unsigned long now = millis();',
    '  if (now - lastTime < LOOP_INTERVAL_MS) return;',
    '  lastTime = now;',
    '',
    '  // Read process variable',
    `  double input = analogRead(INPUT_PIN);`,
    '',
    '  // Compute error',
    `  double error = ${setpointVar} - input;`,
    '',
    '  // Proportional term',
    '  double pTerm = Kp * error;',
    '',
    '  // Integral term with anti-windup',
    '  integral += error * DT;',
    `  double iMax = (OUTPUT_MAX - OUTPUT_MIN) / (Ki > 0.0 ? Ki : 1.0);`,
    '  if (integral > iMax) integral = iMax;',
    '  if (integral < -iMax) integral = -iMax;',
    '  double iTerm = Ki * integral;',
    '',
    '  // Derivative term (on error)',
    '  double dError = (error - prevError) / DT;',
    '  double dTerm = Kd * dError;',
    '  prevError = error;',
    '',
    '  // Compute output and clamp',
    '  double output = pTerm + iTerm + dTerm;',
    '  if (output > OUTPUT_MAX) output = OUTPUT_MAX;',
    '  if (output < OUTPUT_MIN) output = OUTPUT_MIN;',
    '',
    '  // Write output',
    '  analogWrite(OUTPUT_PIN, (int)output);',
  ];

  if (serialPlot) {
    lines.push('');
    lines.push('  // Serial Plotter output');
    lines.push(`  Serial.print("setpoint:"); Serial.print(${setpointVar});`);
    lines.push('  Serial.print(",input:"); Serial.print(input);');
    lines.push('  Serial.print(",output:"); Serial.println(output);');
  }

  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

// Re-export constants for testing
export { SETTLING_TOLERANCE, MIN_DEAD_TIME, DEAD_TIME_MOVEMENT_THRESHOLD };
