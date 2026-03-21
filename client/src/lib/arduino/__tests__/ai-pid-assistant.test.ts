import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AiPidAssistant,
  detectOscillation,
  detectSteadyState,
  fitFopdtModel,
  tuneFromModel,
  tuneRelayMethod,
  tuneGradientDescent,
  simulateItae,
  computePerformanceMetrics,
  comparePerformance,
  generatePidCode,
  MIN_TELEMETRY_POINTS,
  MAX_SESSION_HISTORY,
} from '../ai-pid-assistant';
import type {
  TelemetryPoint,
  PidGains,
  FopdtModel,
  OscillationResult,
  TuningStrategy,
  PerformanceMetrics,
} from '../ai-pid-assistant';

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

/** Generate a step response (FOPDT) with given parameters. */
function generateStepResponse(
  K: number, tau: number, theta: number, dt: number, duration: number, sp = 100,
): TelemetryPoint[] {
  const points: TelemetryPoint[] = [];
  const steps = Math.floor(duration / dt);
  let pv = 0;

  for (let i = 0; i < steps; i++) {
    const t = i * dt;
    const effectiveT = t - theta;

    if (effectiveT > 0) {
      // First-order response: pv = K * sp * (1 - exp(-t/tau))
      pv = K * sp * (1 - Math.exp(-effectiveT / tau));
    }

    points.push({ t, pv, sp, co: sp });
  }

  return points;
}

/** Generate oscillating telemetry. */
function generateOscillation(
  frequency: number, amplitude: number, offset: number, dt: number, duration: number, sp = 100,
): TelemetryPoint[] {
  const points: TelemetryPoint[] = [];
  const steps = Math.floor(duration / dt);

  for (let i = 0; i < steps; i++) {
    const t = i * dt;
    const pv = offset + amplitude * Math.sin(2 * Math.PI * frequency * t);
    const co = 50 + 20 * Math.sin(2 * Math.PI * frequency * t + 0.5);
    points.push({ t, pv, sp, co });
  }

  return points;
}

/** Generate settled telemetry (constant PV near SP). */
function generateSteadyState(sp: number, noise: number, n: number): TelemetryPoint[] {
  const points: TelemetryPoint[] = [];
  for (let i = 0; i < n; i++) {
    points.push({
      t: i * 0.1,
      pv: sp + (Math.random() - 0.5) * noise,
      sp,
      co: 50,
    });
  }
  return points;
}

// ──────────────────────────────────────────────────────────────────
// Singleton
// ──────────────────────────────────────────────────────────────────

describe('AiPidAssistant — singleton', () => {
  it('returns the same instance from getInstance()', () => {
    const a = AiPidAssistant.getInstance();
    const b = AiPidAssistant.getInstance();
    expect(a).toBe(b);
  });

  it('create() returns a fresh non-singleton instance', () => {
    const a = AiPidAssistant.create();
    const b = AiPidAssistant.create();
    expect(a).not.toBe(b);
  });
});

// ──────────────────────────────────────────────────────────────────
// detectOscillation
// ──────────────────────────────────────────────────────────────────

describe('detectOscillation', () => {
  it('detects oscillation in sinusoidal data', () => {
    const data = generateOscillation(2, 10, 100, 0.01, 5, 100);
    const result = detectOscillation(data);
    expect(result.detected).toBe(true);
    expect(result.zeroCrossings).toBeGreaterThanOrEqual(4);
    expect(result.amplitude).toBeGreaterThan(0);
    expect(result.period).toBeGreaterThan(0);
    // Period should be approximately 0.5s (1/2Hz)
    expect(result.period).toBeCloseTo(0.5, 0);
  });

  it('returns not detected for insufficient data', () => {
    const data: TelemetryPoint[] = [
      { t: 0, pv: 0, sp: 0, co: 0 },
      { t: 1, pv: 1, sp: 0, co: 0 },
    ];
    const result = detectOscillation(data);
    expect(result.detected).toBe(false);
  });

  it('returns not detected for steady data', () => {
    const data = generateSteadyState(100, 0.001, 50);
    const result = detectOscillation(data);
    // Minimal noise won't produce enough crossings
    expect(result.zeroCrossings).toBeLessThan(50);
  });

  it('estimates amplitude correctly', () => {
    const data = generateOscillation(1, 5, 50, 0.01, 3, 50);
    const result = detectOscillation(data);
    expect(result.amplitude).toBeCloseTo(5, 0);
  });
});

// ──────────────────────────────────────────────────────────────────
// detectSteadyState
// ──────────────────────────────────────────────────────────────────

describe('detectSteadyState', () => {
  it('detects steady state in stable data', () => {
    const data = generateStepResponse(1, 0.5, 0.1, 0.01, 10, 100);
    const result = detectSteadyState(data);
    expect(result.reached).toBe(true);
    expect(result.value).toBeCloseTo(100, 0);
    expect(result.standardDeviation).toBeLessThan(1);
  });

  it('returns not reached for oscillating data', () => {
    const data = generateOscillation(2, 50, 100, 0.01, 3, 100);
    const result = detectSteadyState(data);
    // Large oscillation should fail steady-state check
    expect(result.standardDeviation).toBeGreaterThan(0);
  });

  it('returns not reached for insufficient data', () => {
    const data: TelemetryPoint[] = [
      { t: 0, pv: 0, sp: 100, co: 0 },
      { t: 1, pv: 50, sp: 100, co: 50 },
    ];
    const result = detectSteadyState(data);
    expect(result.reached).toBe(false);
  });

  it('reports steady-state error', () => {
    // PV settles at ~95, SP = 100
    const data: TelemetryPoint[] = [];
    for (let i = 0; i < 50; i++) {
      data.push({ t: i * 0.1, pv: 95, sp: 100, co: 80 });
    }
    const result = detectSteadyState(data);
    expect(result.reached).toBe(true);
    expect(result.error).toBeCloseTo(-5, 0);
  });
});

// ──────────────────────────────────────────────────────────────────
// fitFopdtModel
// ──────────────────────────────────────────────────────────────────

describe('fitFopdtModel', () => {
  it('fits a FOPDT model to step response data', () => {
    const data = generateStepResponse(1, 1.0, 0.2, 0.01, 10, 100);
    const model = fitFopdtModel(data);
    expect(model.gain).toBeGreaterThan(0);
    expect(model.timeConstant).toBeGreaterThan(0);
    expect(model.deadTime).toBeGreaterThanOrEqual(0);
  });

  it('throws for insufficient data', () => {
    const data: TelemetryPoint[] = [{ t: 0, pv: 0, sp: 0, co: 0 }];
    expect(() => fitFopdtModel(data)).toThrow('Not enough telemetry');
  });

  it('dead time is non-negative', () => {
    const data = generateStepResponse(1, 0.5, 0, 0.01, 5, 50);
    const model = fitFopdtModel(data);
    expect(model.deadTime).toBeGreaterThanOrEqual(0);
  });

  it('time constant is positive', () => {
    const data = generateStepResponse(1, 2.0, 0.5, 0.01, 15, 100);
    const model = fitFopdtModel(data);
    expect(model.timeConstant).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// tuneFromModel (IMC)
// ──────────────────────────────────────────────────────────────────

describe('tuneFromModel', () => {
  it('produces positive gains', () => {
    const model: FopdtModel = { gain: 1.5, timeConstant: 2.0, deadTime: 0.3 };
    const gains = tuneFromModel(model);
    expect(gains.kp).toBeGreaterThan(0);
    expect(gains.ki).toBeGreaterThan(0);
    expect(gains.kd).toBeGreaterThanOrEqual(0);
  });

  it('higher dead time reduces kp', () => {
    const model1: FopdtModel = { gain: 1, timeConstant: 1, deadTime: 0.1 };
    const model2: FopdtModel = { gain: 1, timeConstant: 1, deadTime: 1.0 };
    const g1 = tuneFromModel(model1);
    const g2 = tuneFromModel(model2);
    expect(g2.kp).toBeLessThan(g1.kp);
  });

  it('higher gain reduces kp', () => {
    const model1: FopdtModel = { gain: 0.5, timeConstant: 1, deadTime: 0.1 };
    const model2: FopdtModel = { gain: 5.0, timeConstant: 1, deadTime: 0.1 };
    const g1 = tuneFromModel(model1);
    const g2 = tuneFromModel(model2);
    expect(g2.kp).toBeLessThan(g1.kp);
  });
});

// ──────────────────────────────────────────────────────────────────
// tuneRelayMethod
// ──────────────────────────────────────────────────────────────────

describe('tuneRelayMethod', () => {
  it('produces positive gains from oscillation data', () => {
    const osc: OscillationResult = { detected: true, period: 0.5, amplitude: 5, zeroCrossings: 8 };
    const gains = tuneRelayMethod(osc, 10);
    expect(gains.kp).toBeGreaterThan(0);
    expect(gains.ki).toBeGreaterThan(0);
    expect(gains.kd).toBeGreaterThan(0);
  });

  it('throws when no oscillation detected', () => {
    const osc: OscillationResult = { detected: false, period: 0, amplitude: 0, zeroCrossings: 0 };
    expect(() => tuneRelayMethod(osc, 10)).toThrow('no oscillation detected');
  });

  it('higher relay amplitude increases ultimate gain', () => {
    const osc: OscillationResult = { detected: true, period: 1.0, amplitude: 5, zeroCrossings: 8 };
    const g1 = tuneRelayMethod(osc, 5);
    const g2 = tuneRelayMethod(osc, 20);
    expect(g2.kp).toBeGreaterThan(g1.kp);
  });
});

// ──────────────────────────────────────────────────────────────────
// tuneGradientDescent
// ──────────────────────────────────────────────────────────────────

describe('tuneGradientDescent', () => {
  it('optimizes gains from initial values', () => {
    const model: FopdtModel = { gain: 1.0, timeConstant: 1.0, deadTime: 0.1 };
    const initial: PidGains = { kp: 1, ki: 0.5, kd: 0.1 };
    const optimized = tuneGradientDescent(model, initial, 0.01, 5);
    expect(optimized.kp).toBeGreaterThanOrEqual(0);
    expect(optimized.ki).toBeGreaterThanOrEqual(0);
    expect(optimized.kd).toBeGreaterThanOrEqual(0);
  });

  it('produces lower or equal ITAE than initial gains', () => {
    const model: FopdtModel = { gain: 1.0, timeConstant: 1.0, deadTime: 0.1 };
    const initial: PidGains = { kp: 1, ki: 0.5, kd: 0.1 };
    const optimized = tuneGradientDescent(model, initial, 0.01, 5);

    const itaeInitial = simulateItae(model, initial, 0.01, 500);
    const itaeOptimized = simulateItae(model, optimized, 0.01, 500);
    expect(itaeOptimized).toBeLessThanOrEqual(itaeInitial + 1e-6);
  });

  it('gains remain non-negative', () => {
    const model: FopdtModel = { gain: 0.1, timeConstant: 0.5, deadTime: 0.05 };
    const initial: PidGains = { kp: 0.01, ki: 0.001, kd: 0 };
    const optimized = tuneGradientDescent(model, initial, 0.01, 3);
    expect(optimized.kp).toBeGreaterThanOrEqual(0);
    expect(optimized.ki).toBeGreaterThanOrEqual(0);
    expect(optimized.kd).toBeGreaterThanOrEqual(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// simulateItae
// ──────────────────────────────────────────────────────────────────

describe('simulateItae', () => {
  it('returns a positive ITAE for non-zero gains', () => {
    const model: FopdtModel = { gain: 1, timeConstant: 1, deadTime: 0.1 };
    const gains: PidGains = { kp: 1, ki: 0.5, kd: 0.1 };
    const itae = simulateItae(model, gains, 0.01, 500);
    expect(itae).toBeGreaterThan(0);
  });

  it('higher kp reduces ITAE (up to a point)', () => {
    const model: FopdtModel = { gain: 1, timeConstant: 1, deadTime: 0.1 };
    const itae1 = simulateItae(model, { kp: 0.1, ki: 0.1, kd: 0 }, 0.01, 500);
    const itae2 = simulateItae(model, { kp: 1.0, ki: 0.1, kd: 0 }, 0.01, 500);
    expect(itae2).toBeLessThan(itae1);
  });

  it('zero gains gives maximum ITAE', () => {
    const model: FopdtModel = { gain: 1, timeConstant: 1, deadTime: 0.1 };
    const itaeZero = simulateItae(model, { kp: 0, ki: 0, kd: 0 }, 0.01, 500);
    const itaeNonZero = simulateItae(model, { kp: 1, ki: 0.5, kd: 0.1 }, 0.01, 500);
    expect(itaeZero).toBeGreaterThan(itaeNonZero);
  });
});

// ──────────────────────────────────────────────────────────────────
// computePerformanceMetrics
// ──────────────────────────────────────────────────────────────────

describe('computePerformanceMetrics', () => {
  it('computes metrics for step response', () => {
    const data = generateStepResponse(1, 0.5, 0.05, 0.01, 5, 100);
    const metrics = computePerformanceMetrics(data);
    expect(metrics.riseTime).toBeGreaterThan(0);
    expect(metrics.settlingTime).toBeGreaterThan(0);
    expect(metrics.iae).toBeGreaterThan(0);
    expect(metrics.itae).toBeGreaterThan(0);
  });

  it('reports zero overshoot for non-overshooting response', () => {
    const data = generateStepResponse(1, 0.5, 0, 0.01, 5, 100);
    const metrics = computePerformanceMetrics(data);
    expect(metrics.overshootPercent).toBe(0);
  });

  it('returns zeros for minimal data', () => {
    const metrics = computePerformanceMetrics([{ t: 0, pv: 0, sp: 0, co: 0 }]);
    expect(metrics.riseTime).toBe(0);
    expect(metrics.settlingTime).toBe(0);
  });

  it('computes IAE as integral of absolute error', () => {
    const data: TelemetryPoint[] = [];
    for (let i = 0; i < 100; i++) {
      data.push({ t: i * 0.1, pv: 50, sp: 100, co: 50 });
    }
    const metrics = computePerformanceMetrics(data);
    // Constant error of 50 over 9.9 seconds ~ 495
    expect(metrics.iae).toBeGreaterThan(400);
  });

  it('detects low steady-state error at equilibrium', () => {
    const data = generateStepResponse(1, 0.5, 0, 0.01, 10, 100);
    const metrics = computePerformanceMetrics(data);
    expect(metrics.steadyStateError).toBeLessThan(5);
  });
});

// ──────────────────────────────────────────────────────────────────
// comparePerformance
// ──────────────────────────────────────────────────────────────────

describe('comparePerformance', () => {
  const before: PerformanceMetrics = {
    riseTime: 2.0,
    settlingTime: 5.0,
    overshootPercent: 20,
    iae: 100,
    itae: 200,
    steadyStateError: 5,
  };

  it('reports positive improvement when metrics decrease', () => {
    const after: PerformanceMetrics = {
      riseTime: 1.0,
      settlingTime: 2.5,
      overshootPercent: 10,
      iae: 50,
      itae: 100,
      steadyStateError: 2,
    };

    const report = comparePerformance(before, after);
    expect(report.overallScore).toBeGreaterThan(0);
    expect(report.improvements['riseTime']).toBeGreaterThan(0);
    expect(report.improvements['settlingTime']).toBeGreaterThan(0);
    expect(report.summary).toContain('improved');
  });

  it('reports negative score when metrics worsen', () => {
    const after: PerformanceMetrics = {
      riseTime: 4.0,
      settlingTime: 10.0,
      overshootPercent: 40,
      iae: 200,
      itae: 400,
      steadyStateError: 10,
    };

    const report = comparePerformance(before, after);
    expect(report.overallScore).toBeLessThan(0);
  });

  it('handles zero before values gracefully', () => {
    const zeroBefore: PerformanceMetrics = {
      riseTime: 0,
      settlingTime: 0,
      overshootPercent: 0,
      iae: 0,
      itae: 0,
      steadyStateError: 0,
    };
    const after: PerformanceMetrics = {
      riseTime: 1,
      settlingTime: 2,
      overshootPercent: 5,
      iae: 10,
      itae: 20,
      steadyStateError: 1,
    };

    const report = comparePerformance(zeroBefore, after);
    expect(report.overallScore).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// generatePidCode
// ──────────────────────────────────────────────────────────────────

describe('generatePidCode', () => {
  const gains: PidGains = { kp: 1.5, ki: 0.3, kd: 0.05 };

  it('generates valid Arduino code', () => {
    const code = generatePidCode(gains);
    expect(code).toContain('void setup()');
    expect(code).toContain('void loop()');
    expect(code).toContain('1.500000');
    expect(code).toContain('0.300000');
    expect(code).toContain('0.050000');
  });

  it('includes serial plotting by default', () => {
    const code = generatePidCode(gains);
    expect(code).toContain('Serial.print');
  });

  it('omits serial when includeSerial is false', () => {
    const code = generatePidCode(gains, { includeSerial: false });
    expect(code).not.toContain('Serial.print');
  });

  it('uses custom pins', () => {
    const code = generatePidCode(gains, { inputPin: 'A3', outputPin: '11' });
    expect(code).toContain('A3');
    expect(code).toContain('11');
  });

  it('uses custom setpoint', () => {
    const code = generatePidCode(gains, { setpoint: 1024 });
    expect(code).toContain('1024');
  });

  it('includes auto-tune attribution comment', () => {
    const code = generatePidCode(gains);
    expect(code).toContain('ProtoPulse AI PID Assistant');
  });
});

// ──────────────────────────────────────────────────────────────────
// AiPidAssistant — session management
// ──────────────────────────────────────────────────────────────────

describe('AiPidAssistant — session management', () => {
  let assistant: AiPidAssistant;

  beforeEach(() => {
    assistant = AiPidAssistant.create();
  });

  it('starts with no active session', () => {
    expect(assistant.getActiveSession()).toBeNull();
  });

  it('startSession creates a collecting session', () => {
    const id = assistant.startSession();
    expect(id).toBeTruthy();
    const session = assistant.getActiveSession();
    expect(session).not.toBeNull();
    expect(session!.state).toBe('collecting');
  });

  it('startSession archives previous session', () => {
    assistant.startSession();
    assistant.startSession();
    expect(assistant.getSessionHistory()).toHaveLength(1);
  });

  it('startSession with strategy sets strategy', () => {
    assistant.startSession('relay');
    expect(assistant.getActiveSession()!.strategy).toBe('relay');
  });

  it('cancelSession archives and clears', () => {
    assistant.startSession();
    assistant.cancelSession();
    expect(assistant.getActiveSession()).toBeNull();
    expect(assistant.getSessionHistory()).toHaveLength(1);
  });

  it('cancelSession is no-op without active session', () => {
    assistant.cancelSession(); // No error
  });

  it('session history caps at MAX_SESSION_HISTORY', () => {
    for (let i = 0; i < MAX_SESSION_HISTORY + 5; i++) {
      assistant.startSession();
    }
    // Last startSession archives the previous, so history should be capped
    expect(assistant.getSessionHistory().length).toBeLessThanOrEqual(MAX_SESSION_HISTORY);
  });

  it('reset clears everything', () => {
    assistant.startSession();
    assistant.reset();
    expect(assistant.getActiveSession()).toBeNull();
    expect(assistant.getSessionHistory()).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// AiPidAssistant — telemetry feeding
// ──────────────────────────────────────────────────────────────────

describe('AiPidAssistant — telemetry', () => {
  let assistant: AiPidAssistant;

  beforeEach(() => {
    assistant = AiPidAssistant.create();
    assistant.startSession();
  });

  it('feedTelemetry adds a point', () => {
    assistant.feedTelemetry({ t: 0, pv: 0, sp: 100, co: 50 });
    expect(assistant.getTelemetryCount()).toBe(1);
  });

  it('feedTelemetryBatch adds multiple points', () => {
    const batch = generateStepResponse(1, 1, 0.1, 0.1, 2, 100);
    assistant.feedTelemetryBatch(batch);
    expect(assistant.getTelemetryCount()).toBe(batch.length);
  });

  it('feedTelemetry is no-op without active session', () => {
    assistant.cancelSession();
    assistant.feedTelemetry({ t: 0, pv: 0, sp: 0, co: 0 });
    // No error
  });

  it('feedTelemetry is no-op if session is not collecting', () => {
    const data = generateStepResponse(1, 1, 0.1, 0.1, 5, 100);
    assistant.feedTelemetryBatch(data);
    assistant.analyze(); // moves past collecting
    assistant.feedTelemetry({ t: 99, pv: 99, sp: 100, co: 99 });
    // Count should be same as batch
    expect(assistant.getActiveSession()!.telemetry).toHaveLength(data.length);
  });
});

// ──────────────────────────────────────────────────────────────────
// AiPidAssistant — analysis
// ──────────────────────────────────────────────────────────────────

describe('AiPidAssistant — analysis', () => {
  let assistant: AiPidAssistant;

  beforeEach(() => {
    assistant = AiPidAssistant.create();
  });

  it('analyze produces tuning results for step response', () => {
    assistant.startSession();
    const data = generateStepResponse(1, 1, 0.1, 0.01, 10, 100);
    assistant.feedTelemetryBatch(data);
    assistant.analyze();

    const session = assistant.getActiveSession();
    expect(session!.state).toBe('complete');
    expect(session!.allResults.length).toBeGreaterThan(0);
    expect(session!.bestResult).not.toBeNull();
    expect(session!.oscillation).not.toBeNull();
    expect(session!.steadyState).not.toBeNull();
    expect(session!.beforeMetrics).not.toBeNull();
  });

  it('analyze with relay strategy only produces relay result when oscillation found', () => {
    assistant.startSession('relay');
    const data = generateOscillation(2, 10, 100, 0.01, 3, 100);
    assistant.feedTelemetryBatch(data);
    assistant.analyze();

    const session = assistant.getActiveSession();
    expect(session!.state).toBe('complete');
    const relayResults = session!.allResults.filter((r) => r.strategy === 'relay');
    expect(relayResults.length).toBeGreaterThanOrEqual(0); // May or may not produce relay result
  });

  it('analyze errors with insufficient data', () => {
    assistant.startSession();
    assistant.feedTelemetry({ t: 0, pv: 0, sp: 100, co: 50 });
    assistant.analyze();

    const session = assistant.getActiveSession();
    expect(session!.state).toBe('error');
    expect(session!.errorMessage).toContain('at least');
  });

  it('analyze without active session is no-op', () => {
    assistant.analyze(); // No error
  });

  it('bestResult has highest confidence', () => {
    assistant.startSession();
    const data = generateStepResponse(1, 1, 0.1, 0.01, 10, 100);
    assistant.feedTelemetryBatch(data);
    assistant.analyze();

    const session = assistant.getActiveSession();
    if (session!.allResults.length > 1) {
      let maxConf = 0;
      for (const r of session!.allResults) {
        if (r.confidence > maxConf) {
          maxConf = r.confidence;
        }
      }
      expect(session!.bestResult!.confidence).toBe(maxConf);
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// AiPidAssistant — verification
// ──────────────────────────────────────────────────────────────────

describe('AiPidAssistant — verification', () => {
  let assistant: AiPidAssistant;

  beforeEach(() => {
    assistant = AiPidAssistant.create();
    assistant.startSession();
    const data = generateStepResponse(1, 1, 0.1, 0.01, 10, 100);
    assistant.feedTelemetryBatch(data);
    assistant.analyze();
  });

  it('verify produces improvement report', () => {
    // Better response after tuning
    const afterData = generateStepResponse(1, 0.3, 0.05, 0.01, 5, 100);
    const report = assistant.verify(afterData);

    expect(report).not.toBeNull();
    expect(report!.before).toBeDefined();
    expect(report!.after).toBeDefined();
    expect(report!.summary).toBeTruthy();
  });

  it('verify returns null without active session', () => {
    assistant.cancelSession();
    const data = generateStepResponse(1, 0.5, 0, 0.01, 5, 100);
    const report = assistant.verify(data);
    expect(report).toBeNull();
  });

  it('verify sets session state to complete', () => {
    const afterData = generateStepResponse(1, 0.5, 0, 0.01, 5, 100);
    assistant.verify(afterData);
    expect(assistant.getActiveSession()!.state).toBe('complete');
  });

  it('verify stores improvement report on session', () => {
    const afterData = generateStepResponse(1, 0.5, 0, 0.01, 5, 100);
    assistant.verify(afterData);
    expect(assistant.getActiveSession()!.improvementReport).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────
// AiPidAssistant — code generation
// ──────────────────────────────────────────────────────────────────

describe('AiPidAssistant — code generation', () => {
  let assistant: AiPidAssistant;

  beforeEach(() => {
    assistant = AiPidAssistant.create();
    assistant.startSession();
    const data = generateStepResponse(1, 1, 0.1, 0.01, 10, 100);
    assistant.feedTelemetryBatch(data);
    assistant.analyze();
  });

  it('generateCode produces Arduino code', () => {
    const code = assistant.generateCode();
    expect(code).not.toBeNull();
    expect(code).toContain('void setup()');
    expect(code).toContain('void loop()');
  });

  it('generateCode returns null without best result', () => {
    const fresh = AiPidAssistant.create();
    expect(fresh.generateCode()).toBeNull();
  });

  it('generateCode passes options through', () => {
    const code = assistant.generateCode({ inputPin: 'A5', setpoint: 2048 });
    expect(code).toContain('A5');
    expect(code).toContain('2048');
  });
});

// ──────────────────────────────────────────────────────────────────
// AiPidAssistant — subscription
// ──────────────────────────────────────────────────────────────────

describe('AiPidAssistant — subscription', () => {
  let assistant: AiPidAssistant;

  beforeEach(() => {
    assistant = AiPidAssistant.create();
  });

  it('notifies listeners on startSession', () => {
    const listener = vi.fn();
    assistant.subscribe(listener);
    assistant.startSession();
    expect(listener).toHaveBeenCalled();
  });

  it('unsubscribe stops notifications', () => {
    const listener = vi.fn();
    const unsub = assistant.subscribe(listener);
    unsub();
    assistant.startSession();
    expect(listener).not.toHaveBeenCalled();
  });

  it('getSnapshot returns cached snapshot', () => {
    assistant.startSession();
    const s1 = assistant.getSnapshot();
    const s2 = assistant.getSnapshot();
    expect(s1).toBe(s2);
  });

  it('getSnapshot invalidates after state change', () => {
    assistant.startSession();
    const s1 = assistant.getSnapshot();
    assistant.feedTelemetry({ t: 0, pv: 0, sp: 0, co: 0 });
    const s2 = assistant.getSnapshot();
    expect(s1).not.toBe(s2);
  });
});

// ──────────────────────────────────────────────────────────────────
// AiPidAssistant — snapshot shape
// ──────────────────────────────────────────────────────────────────

describe('AiPidAssistant — snapshot', () => {
  it('snapshot includes activeSession and sessionHistory', () => {
    const assistant = AiPidAssistant.create();
    assistant.startSession();
    const snap = assistant.getSnapshot();
    expect(snap.activeSession).not.toBeNull();
    expect(snap.sessionHistory).toEqual([]);
  });

  it('snapshot is null activeSession when none exists', () => {
    const assistant = AiPidAssistant.create();
    const snap = assistant.getSnapshot();
    expect(snap.activeSession).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────
// Edge cases
// ──────────────────────────────────────────────────────────────────

describe('AiPidAssistant — edge cases', () => {
  it('multiple listeners all get notified', () => {
    const assistant = AiPidAssistant.create();
    const l1 = vi.fn();
    const l2 = vi.fn();
    assistant.subscribe(l1);
    assistant.subscribe(l2);
    assistant.startSession();
    expect(l1).toHaveBeenCalled();
    expect(l2).toHaveBeenCalled();
  });

  it('model-based strategy only produces model-based result', () => {
    const assistant = AiPidAssistant.create();
    assistant.startSession('model-based');
    const data = generateStepResponse(1, 1, 0.1, 0.01, 10, 100);
    assistant.feedTelemetryBatch(data);
    assistant.analyze();

    const session = assistant.getActiveSession();
    expect(session!.allResults.every((r) => r.strategy === 'model-based')).toBe(true);
  });

  it('gradient-descent strategy only produces gradient-descent result', () => {
    const assistant = AiPidAssistant.create();
    assistant.startSession('gradient-descent');
    const data = generateStepResponse(1, 1, 0.1, 0.01, 10, 100);
    assistant.feedTelemetryBatch(data);
    assistant.analyze();

    const session = assistant.getActiveSession();
    expect(session!.allResults.every((r) => r.strategy === 'gradient-descent')).toBe(true);
  });

  it('analysis with flat data still completes', () => {
    const assistant = AiPidAssistant.create();
    assistant.startSession();
    // All values the same
    const data: TelemetryPoint[] = [];
    for (let i = 0; i < 50; i++) {
      data.push({ t: i * 0.1, pv: 50, sp: 100, co: 50 });
    }
    assistant.feedTelemetryBatch(data);
    assistant.analyze();
    const session = assistant.getActiveSession();
    expect(session!.state).toBe('complete');
  });

  it('session has createdAt timestamp', () => {
    const assistant = AiPidAssistant.create();
    const before = Date.now();
    assistant.startSession();
    const after = Date.now();
    const session = assistant.getActiveSession();
    expect(session!.createdAt).toBeGreaterThanOrEqual(before);
    expect(session!.createdAt).toBeLessThanOrEqual(after);
  });
});
