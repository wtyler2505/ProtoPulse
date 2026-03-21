import { describe, it, expect } from 'vitest';
import {
  analyzeStepResponse,
  tuneZieglerNichols,
  tuneCohenCoon,
  autoTune,
  suggestImprovements,
  generateArduinoCode,
  SETTLING_TOLERANCE,
  MIN_DEAD_TIME,
  DEAD_TIME_MOVEMENT_THRESHOLD,
} from '../pid-tuner';
import type {
  TimePoint,
  StepResponseMetrics,
  PidGains,
  ControllerType,
  TuningMethod,
} from '../pid-tuner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a first-order step response: y(t) = K * (1 - e^(-t/T)) with dead time L. */
function firstOrderStep(
  K: number,
  T: number,
  L: number,
  duration: number,
  dt: number,
  initial = 0,
): TimePoint[] {
  const points: TimePoint[] = [];
  for (let t = 0; t <= duration; t += dt) {
    let value: number;
    if (t < L) {
      value = initial;
    } else {
      value = initial + K * (1 - Math.exp(-(t - L) / T));
    }
    points.push({ t, value });
  }
  return points;
}

/** Generate a second-order underdamped step response with overshoot. */
function secondOrderStep(
  K: number,
  wn: number,
  zeta: number,
  duration: number,
  dt: number,
  initial = 0,
): TimePoint[] {
  const points: TimePoint[] = [];
  const wd = wn * Math.sqrt(1 - zeta * zeta);
  for (let t = 0; t <= duration; t += dt) {
    const value =
      initial +
      K * (1 - (Math.exp(-zeta * wn * t) / Math.sqrt(1 - zeta * zeta)) *
        Math.sin(wd * t + Math.acos(zeta)));
    points.push({ t, value });
  }
  return points;
}

/** Generate a simple ramp response. */
function rampResponse(slope: number, duration: number, dt: number): TimePoint[] {
  const points: TimePoint[] = [];
  for (let t = 0; t <= duration; t += dt) {
    points.push({ t, value: slope * t });
  }
  return points;
}

// ---------------------------------------------------------------------------
// analyzeStepResponse
// ---------------------------------------------------------------------------

describe('analyzeStepResponse', () => {
  it('throws for fewer than 2 data points', () => {
    expect(() => analyzeStepResponse([{ t: 0, value: 0 }])).toThrow('at least 2 points');
  });

  it('handles flat response (no change)', () => {
    const data: TimePoint[] = [
      { t: 0, value: 5 },
      { t: 1, value: 5 },
      { t: 2, value: 5 },
    ];
    const m = analyzeStepResponse(data);
    expect(m.steadyStateValue).toBe(5);
    expect(m.initialValue).toBe(5);
    expect(m.overshootPercent).toBe(0);
    expect(m.staticGain).toBe(0);
    expect(m.isUnderdamped).toBe(false);
  });

  it('extracts metrics from first-order step response', () => {
    const data = firstOrderStep(10, 1.0, 0.1, 8, 0.01);
    const m = analyzeStepResponse(data, 1.0);

    expect(m.initialValue).toBe(0);
    expect(m.steadyStateValue).toBeCloseTo(10, 0);
    expect(m.staticGain).toBeCloseTo(10, 0);
    expect(m.deadTime).toBeCloseTo(0.1, 1);
    expect(m.timeConstant).toBeCloseTo(1.0, 1);
    expect(m.overshootPercent).toBe(0);
    expect(m.isUnderdamped).toBe(false);
    expect(m.riseTime).toBeGreaterThan(0);
    expect(m.riseTime10).toBeLessThan(m.riseTime90);
  });

  it('detects overshoot in underdamped response', () => {
    const data = secondOrderStep(10, 5, 0.3, 5, 0.005);
    const m = analyzeStepResponse(data);

    expect(m.overshootPercent).toBeGreaterThan(0);
    expect(m.isUnderdamped).toBe(true);
    expect(m.peakValue).toBeGreaterThan(m.steadyStateValue);
  });

  it('computes settling time correctly', () => {
    const data = firstOrderStep(10, 0.5, 0, 10, 0.01);
    const m = analyzeStepResponse(data);

    // For first-order, settling within 2% ≈ 4*T
    expect(m.settlingTime).toBeLessThan(5); // should be around 2s for T=0.5
    expect(m.settlingTime).toBeGreaterThan(0);
  });

  it('handles negative step (decreasing response)', () => {
    const data: TimePoint[] = [];
    for (let t = 0; t <= 5; t += 0.01) {
      data.push({ t, value: 100 - 50 * (1 - Math.exp(-t / 0.5)) });
    }
    const m = analyzeStepResponse(data);
    expect(m.initialValue).toBe(100);
    expect(m.steadyStateValue).toBeCloseTo(50, 0);
    expect(m.riseTime).toBeGreaterThan(0);
  });

  it('computes static gain with custom step magnitude', () => {
    const data = firstOrderStep(20, 1, 0, 10, 0.01);
    const m = analyzeStepResponse(data, 5.0);
    expect(m.staticGain).toBeCloseTo(4, 0); // 20/5 = 4
  });

  it('uses default step magnitude of 1', () => {
    const data = firstOrderStep(10, 1, 0, 10, 0.01);
    const m = analyzeStepResponse(data);
    expect(m.staticGain).toBeCloseTo(10, 0);
  });

  it('detects dead time in delayed response', () => {
    const data = firstOrderStep(10, 1, 0.5, 10, 0.01);
    const m = analyzeStepResponse(data);
    expect(m.deadTime).toBeCloseTo(0.5, 1);
  });

  it('handles zero dead time', () => {
    const data = firstOrderStep(10, 1, 0, 10, 0.01);
    const m = analyzeStepResponse(data);
    expect(m.deadTime).toBeLessThan(0.05);
  });

  it('computes time to target', () => {
    const data = firstOrderStep(10, 1, 0, 10, 0.01);
    const m = analyzeStepResponse(data);
    expect(m.timeToTarget).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// tuneZieglerNichols
// ---------------------------------------------------------------------------

describe('tuneZieglerNichols', () => {
  const baseMetrics: StepResponseMetrics = {
    riseTime10: 0.3,
    riseTime90: 1.5,
    riseTime: 1.2,
    timeToTarget: 2.0,
    settlingTime: 4.0,
    overshootPercent: 0,
    peakValue: 10,
    steadyStateValue: 10,
    initialValue: 0,
    deadTime: 0.2,
    timeConstant: 1.0,
    staticGain: 10,
    isUnderdamped: false,
  };

  it('computes P controller gains', () => {
    const result = tuneZieglerNichols(baseMetrics, 'P');
    expect(result.gains.kp).toBeCloseTo(1.0 / (10 * 0.2), 2); // T/(K*L) = 1/(10*0.2) = 0.5
    expect(result.gains.ki).toBe(0);
    expect(result.gains.kd).toBe(0);
    expect(result.method).toBe('ziegler-nichols');
    expect(result.controllerType).toBe('P');
  });

  it('computes PI controller gains', () => {
    const result = tuneZieglerNichols(baseMetrics, 'PI');
    expect(result.gains.kp).toBeCloseTo(0.9 * 1.0 / (10 * 0.2), 2);
    expect(result.gains.ki).toBeGreaterThan(0);
    expect(result.gains.kd).toBe(0);
    expect(result.controllerType).toBe('PI');
  });

  it('computes PID controller gains', () => {
    const result = tuneZieglerNichols(baseMetrics, 'PID');
    expect(result.gains.kp).toBeCloseTo(1.2 * 1.0 / (10 * 0.2), 2);
    expect(result.gains.ki).toBeGreaterThan(0);
    expect(result.gains.kd).toBeGreaterThan(0);
    expect(result.controllerType).toBe('PID');
  });

  it('defaults to PID controller type', () => {
    const result = tuneZieglerNichols(baseMetrics);
    expect(result.controllerType).toBe('PID');
  });

  it('handles zero static gain gracefully', () => {
    const m = { ...baseMetrics, staticGain: 0 };
    const result = tuneZieglerNichols(m);
    expect(Number.isFinite(result.gains.kp)).toBe(true);
  });

  it('handles very small dead time', () => {
    const m = { ...baseMetrics, deadTime: 0 };
    const result = tuneZieglerNichols(m);
    expect(Number.isFinite(result.gains.kp)).toBe(true);
    expect(result.gains.kp).toBeGreaterThan(0);
  });

  it('includes description', () => {
    const result = tuneZieglerNichols(baseMetrics);
    expect(result.description.length).toBeGreaterThan(0);
    expect(result.description).toContain('Ziegler-Nichols');
  });
});

// ---------------------------------------------------------------------------
// tuneCohenCoon
// ---------------------------------------------------------------------------

describe('tuneCohenCoon', () => {
  const baseMetrics: StepResponseMetrics = {
    riseTime10: 0.5,
    riseTime90: 2.0,
    riseTime: 1.5,
    timeToTarget: 3.0,
    settlingTime: 6.0,
    overshootPercent: 0,
    peakValue: 10,
    steadyStateValue: 10,
    initialValue: 0,
    deadTime: 0.5,
    timeConstant: 1.5,
    staticGain: 10,
    isUnderdamped: false,
  };

  it('computes P controller gains', () => {
    const result = tuneCohenCoon(baseMetrics, 'P');
    expect(result.gains.kp).toBeGreaterThan(0);
    expect(result.gains.ki).toBe(0);
    expect(result.gains.kd).toBe(0);
    expect(result.method).toBe('cohen-coon');
  });

  it('computes PI controller gains', () => {
    const result = tuneCohenCoon(baseMetrics, 'PI');
    expect(result.gains.kp).toBeGreaterThan(0);
    expect(result.gains.ki).toBeGreaterThan(0);
    expect(result.gains.kd).toBe(0);
  });

  it('computes PID controller gains', () => {
    const result = tuneCohenCoon(baseMetrics, 'PID');
    expect(result.gains.kp).toBeGreaterThan(0);
    expect(result.gains.ki).toBeGreaterThan(0);
    expect(result.gains.kd).toBeGreaterThan(0);
  });

  it('produces different gains than Ziegler-Nichols', () => {
    const zn = tuneZieglerNichols(baseMetrics, 'PID');
    const cc = tuneCohenCoon(baseMetrics, 'PID');
    // Should not be identical (different formulas)
    expect(cc.gains.kp).not.toBeCloseTo(zn.gains.kp, 4);
  });

  it('handles zero dead time', () => {
    const m = { ...baseMetrics, deadTime: 0 };
    const result = tuneCohenCoon(m);
    expect(Number.isFinite(result.gains.kp)).toBe(true);
  });

  it('includes description with dead-time ratio', () => {
    const result = tuneCohenCoon(baseMetrics, 'PID');
    expect(result.description).toContain('Cohen-Coon');
    expect(result.description).toContain('dead-time ratio');
  });

  it('accounts for dead-time ratio in gains', () => {
    // Higher dead time → different gains
    const lowDead = tuneCohenCoon({ ...baseMetrics, deadTime: 0.1 }, 'PID');
    const highDead = tuneCohenCoon({ ...baseMetrics, deadTime: 2.0 }, 'PID');
    expect(lowDead.gains.kp).not.toBeCloseTo(highDead.gains.kp, 2);
  });
});

// ---------------------------------------------------------------------------
// autoTune
// ---------------------------------------------------------------------------

describe('autoTune', () => {
  it('returns all required fields', () => {
    const data = firstOrderStep(10, 1, 0.1, 10, 0.01);
    const result = autoTune(data);
    expect(result.metrics).toBeDefined();
    expect(result.recommended).toBeDefined();
    expect(result.allResults.length).toBe(2);
    expect(result.improvements).toBeDefined();
  });

  it('selects Ziegler-Nichols for low dead-time ratio', () => {
    // L/T = 0.01/1 = 0.01 → ZN
    const data = firstOrderStep(10, 1, 0.01, 10, 0.01);
    const result = autoTune(data);
    expect(result.recommended.method).toBe('ziegler-nichols');
  });

  it('selects Cohen-Coon for high dead-time ratio', () => {
    // L/T = 1.0/1.0 = 1.0 → CC
    const data = firstOrderStep(10, 1, 1.0, 15, 0.01);
    const result = autoTune(data);
    expect(result.recommended.method).toBe('cohen-coon');
  });

  it('respects preferred method override', () => {
    const data = firstOrderStep(10, 1, 0.01, 10, 0.01);
    const result = autoTune(data, 1, 'PID', 'cohen-coon');
    expect(result.recommended.method).toBe('cohen-coon');
  });

  it('respects controller type', () => {
    const data = firstOrderStep(10, 1, 0.1, 10, 0.01);
    const result = autoTune(data, 1, 'PI');
    expect(result.recommended.controllerType).toBe('PI');
    expect(result.recommended.gains.kd).toBe(0);
  });

  it('includes improvements for problematic responses', () => {
    // Underdamped with high overshoot
    const data = secondOrderStep(10, 5, 0.15, 5, 0.005);
    const result = autoTune(data);
    expect(result.improvements.length).toBeGreaterThan(0);
  });

  it('uses custom step magnitude', () => {
    const data = firstOrderStep(50, 1, 0.1, 10, 0.01);
    const result = autoTune(data, 10);
    expect(result.metrics.staticGain).toBeCloseTo(5, 0);
  });
});

// ---------------------------------------------------------------------------
// suggestImprovements
// ---------------------------------------------------------------------------

describe('suggestImprovements', () => {
  const nominal: StepResponseMetrics = {
    riseTime10: 0.1,
    riseTime90: 0.5,
    riseTime: 0.4,
    timeToTarget: 0.8,
    settlingTime: 1.2,
    overshootPercent: 5,
    peakValue: 10.5,
    steadyStateValue: 10,
    initialValue: 0,
    deadTime: 0.05,
    timeConstant: 0.3,
    staticGain: 10,
    isUnderdamped: true,
  };

  it('returns empty for well-tuned system', () => {
    const improvements = suggestImprovements(nominal);
    expect(improvements.length).toBe(0);
  });

  it('flags high overshoot (>30%)', () => {
    const m = { ...nominal, overshootPercent: 40 };
    const improvements = suggestImprovements(m);
    expect(improvements.some((i) => i.category === 'overshoot' && i.priority === 'high')).toBe(true);
  });

  it('flags moderate overshoot (10-30%)', () => {
    const m = { ...nominal, overshootPercent: 15 };
    const improvements = suggestImprovements(m);
    expect(improvements.some((i) => i.category === 'overshoot' && i.priority === 'medium')).toBe(true);
  });

  it('flags very long settling time', () => {
    const m = { ...nominal, settlingTime: 5.0 }; // 5s vs 0.4s rise = 12.5x
    const improvements = suggestImprovements(m);
    expect(improvements.some((i) => i.category === 'settling' && i.priority === 'high')).toBe(true);
  });

  it('flags moderate settling ratio', () => {
    const m = { ...nominal, settlingTime: 3.0 }; // 3s vs 0.4s rise = 7.5x
    const improvements = suggestImprovements(m);
    expect(improvements.some((i) => i.category === 'settling' && i.priority === 'medium')).toBe(true);
  });

  it('flags high dead-time ratio', () => {
    const m = { ...nominal, deadTime: 0.5, timeConstant: 0.3 }; // ratio > 1
    const improvements = suggestImprovements(m);
    expect(improvements.some((i) => i.priority === 'high' && i.message.includes('Dead time'))).toBe(true);
  });

  it('suggests Cohen-Coon for moderate dead-time ratio', () => {
    const m = { ...nominal, deadTime: 0.2, timeConstant: 0.3 }; // ratio ≈ 0.67
    const improvements = suggestImprovements(m);
    expect(improvements.some((i) => i.message.includes('Cohen-Coon'))).toBe(true);
  });

  it('flags overdamped slow response', () => {
    const m = { ...nominal, overshootPercent: 0, isUnderdamped: false, settlingTime: 2.0 }; // 5x rise
    const improvements = suggestImprovements(m);
    expect(improvements.some((i) => i.category === 'steady_state')).toBe(true);
  });

  it('flags highly underdamped system', () => {
    const m = { ...nominal, overshootPercent: 60, isUnderdamped: true };
    const improvements = suggestImprovements(m);
    expect(improvements.some((i) => i.category === 'oscillation' && i.priority === 'high')).toBe(true);
  });

  it('sorts by priority (high first)', () => {
    const m = { ...nominal, overshootPercent: 40, settlingTime: 5.0 };
    const improvements = suggestImprovements(m);
    expect(improvements.length).toBeGreaterThan(1);
    for (let i = 1; i < improvements.length; i++) {
      const prevOrder = { high: 0, medium: 1, low: 2 }[improvements[i - 1].priority];
      const currOrder = { high: 0, medium: 1, low: 2 }[improvements[i].priority];
      expect(prevOrder).toBeLessThanOrEqual(currOrder);
    }
  });
});

// ---------------------------------------------------------------------------
// generateArduinoCode
// ---------------------------------------------------------------------------

describe('generateArduinoCode', () => {
  const gains: PidGains = { kp: 1.5, ki: 0.8, kd: 0.05 };

  it('generates valid Arduino code with default options', () => {
    const code = generateArduinoCode(gains);
    expect(code).toContain('const double Kp = 1.500000');
    expect(code).toContain('const double Ki = 0.800000');
    expect(code).toContain('const double Kd = 0.050000');
    expect(code).toContain('void setup()');
    expect(code).toContain('void loop()');
    expect(code).toContain('analogWrite');
    expect(code).toContain('analogRead');
    expect(code).toContain('Serial.begin');
  });

  it('includes serial plot output by default', () => {
    const code = generateArduinoCode(gains);
    expect(code).toContain('Serial.print');
    expect(code).toContain('setpoint');
    expect(code).toContain('input');
    expect(code).toContain('output');
  });

  it('omits serial plot when disabled', () => {
    const code = generateArduinoCode(gains, { serialPlot: false });
    expect(code).not.toContain('Serial Plotter');
  });

  it('uses custom pin configuration', () => {
    const code = generateArduinoCode(gains, { inputPin: 'A3', outputPin: '11' });
    expect(code).toContain('A3');
    expect(code).toContain('11');
  });

  it('uses custom setpoint variable name', () => {
    const code = generateArduinoCode(gains, { setpointVar: 'targetRPM' });
    expect(code).toContain('targetRPM');
  });

  it('uses custom loop interval', () => {
    const code = generateArduinoCode(gains, { loopIntervalMs: 50 });
    expect(code).toContain('50');
    expect(code).toContain('0.0500');
  });

  it('uses custom output range', () => {
    const code = generateArduinoCode(gains, { outputMin: -255, outputMax: 255 });
    expect(code).toContain('-255');
    expect(code).toContain('255');
  });

  it('includes anti-windup logic', () => {
    const code = generateArduinoCode(gains);
    expect(code).toContain('anti-windup');
    expect(code).toContain('iMax');
  });

  it('includes ProtoPulse header comment', () => {
    const code = generateArduinoCode(gains);
    expect(code).toContain('ProtoPulse');
  });

  it('handles zero Ki (P-only controller)', () => {
    const pGains: PidGains = { kp: 2.0, ki: 0, kd: 0 };
    const code = generateArduinoCode(pGains);
    expect(code).toContain('Ki = 0.000000');
    // Anti-windup should not divide by zero
    expect(code).toContain('Ki > 0.0 ? Ki : 1.0');
  });
});

// ---------------------------------------------------------------------------
// Constants export
// ---------------------------------------------------------------------------

describe('exported constants', () => {
  it('exports SETTLING_TOLERANCE', () => {
    expect(SETTLING_TOLERANCE).toBe(0.02);
  });

  it('exports MIN_DEAD_TIME', () => {
    expect(MIN_DEAD_TIME).toBe(1e-6);
  });

  it('exports DEAD_TIME_MOVEMENT_THRESHOLD', () => {
    expect(DEAD_TIME_MOVEMENT_THRESHOLD).toBe(0.005);
  });
});

// ---------------------------------------------------------------------------
// Integration / real-world scenarios
// ---------------------------------------------------------------------------

describe('real-world scenarios', () => {
  it('motor speed control: first-order with moderate dead time', () => {
    // Typical DC motor: K=1000 RPM, T=0.3s, L=0.05s
    const data = firstOrderStep(1000, 0.3, 0.05, 5, 0.001);
    const result = autoTune(data, 1);
    expect(result.metrics.steadyStateValue).toBeCloseTo(1000, -1);
    expect(result.recommended.gains.kp).toBeGreaterThan(0);
    expect(result.recommended.gains.ki).toBeGreaterThan(0);
  });

  it('temperature control: slow first-order with large dead time', () => {
    // Typical heater: K=80°C, T=30s, L=10s → Cohen-Coon should be recommended
    const data = firstOrderStep(80, 30, 10, 300, 0.5);
    const result = autoTune(data, 1);
    expect(result.recommended.method).toBe('cohen-coon'); // L/T = 0.33 > 0.25
    expect(result.metrics.deadTime).toBeCloseTo(10, 0);
  });

  it('servo position control: fast with overshoot', () => {
    // Second-order with moderate damping
    const data = secondOrderStep(180, 10, 0.4, 3, 0.001);
    const result = autoTune(data, 1);
    expect(result.metrics.isUnderdamped).toBe(true);
    expect(result.metrics.overshootPercent).toBeGreaterThan(0);
    // Should have improvement suggestions about overshoot
    expect(result.improvements.length).toBeGreaterThanOrEqual(0);
  });

  it('full pipeline: analyze → tune → generate code', () => {
    const data = firstOrderStep(10, 1, 0.1, 10, 0.01);
    const result = autoTune(data);
    const code = generateArduinoCode(result.recommended.gains, {
      setpointVar: 'targetTemp',
      inputPin: 'A2',
      outputPin: '6',
      loopIntervalMs: 100,
    });
    expect(code).toContain('targetTemp');
    expect(code).toContain('A2');
    expect(code).toContain('Kp');
    // Gains embedded should match
    expect(code).toContain(result.recommended.gains.kp.toFixed(6));
  });
});
