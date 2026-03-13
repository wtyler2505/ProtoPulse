import { describe, it, expect, beforeEach } from 'vitest';
import {
  FunctionGenerator,
  getFunctionGenerator,
  resetFunctionGenerator,
  formatFrequency,
  formatAmplitude,
} from '../function-generator';
import type { WaveformType, FunctionGeneratorState } from '../function-generator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect samples over one full period. */
function sampleOnePeriod(gen: FunctionGenerator, numSamples = 1000): number[] {
  const state = gen.getState();
  const period = state.frequency > 0 ? 1 / state.frequency : 1;
  const dt = period / numSamples;
  const samples: number[] = [];
  for (let i = 0; i < numSamples; i++) {
    samples.push(gen.getSample(i * dt));
  }
  return samples;
}

describe('FunctionGenerator', () => {
  let gen: FunctionGenerator;

  beforeEach(() => {
    resetFunctionGenerator();
    gen = new FunctionGenerator();
  });

  // -------------------------------------------------------------------------
  // Default state
  // -------------------------------------------------------------------------

  describe('default state', () => {
    it('initialises with sensible defaults', () => {
      const state = gen.getState();
      expect(state.waveform).toBe('SINE');
      expect(state.frequency).toBe(1000);
      expect(state.amplitude).toBe(1);
      expect(state.dcOffset).toBe(0);
      expect(state.dutyCycle).toBe(0.5);
      expect(state.connectedNet).toBeNull();
      expect(state.enabled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // SINE waveform
  // -------------------------------------------------------------------------

  describe('SINE waveform', () => {
    it('peaks at +amplitude and -amplitude', () => {
      gen.setAmplitude(2);
      const samples = sampleOnePeriod(gen, 10000);
      const max = Math.max(...samples);
      const min = Math.min(...samples);
      expect(max).toBeCloseTo(2, 2);
      expect(min).toBeCloseTo(-2, 2);
    });

    it('starts at 0 when offset is 0', () => {
      expect(gen.getSample(0)).toBeCloseTo(0, 10);
    });

    it('reaches +amplitude at quarter period', () => {
      const period = 1 / gen.getState().frequency;
      expect(gen.getSample(period / 4)).toBeCloseTo(1, 5);
    });

    it('returns to ~0 at half period', () => {
      const period = 1 / gen.getState().frequency;
      expect(gen.getSample(period / 2)).toBeCloseTo(0, 5);
    });
  });

  // -------------------------------------------------------------------------
  // SQUARE waveform
  // -------------------------------------------------------------------------

  describe('SQUARE waveform', () => {
    beforeEach(() => {
      gen.setWaveform('SQUARE');
    });

    it('toggles between +amplitude and -amplitude', () => {
      const samples = sampleOnePeriod(gen, 100);
      const unique = new Set(samples.map((v) => Math.round(v * 1000) / 1000));
      expect(unique.size).toBe(2);
      expect(unique.has(1)).toBe(true);
      expect(unique.has(-1)).toBe(true);
    });

    it('respects duty cycle', () => {
      gen.setDutyCycle(0.25);
      const samples = sampleOnePeriod(gen, 1000);
      const highCount = samples.filter((v) => v > 0).length;
      // ~25% should be high
      expect(highCount).toBeGreaterThan(200);
      expect(highCount).toBeLessThan(300);
    });

    it('duty cycle 1.0 produces all +amplitude', () => {
      gen.setDutyCycle(1.0);
      const samples = sampleOnePeriod(gen, 100);
      for (const s of samples) {
        expect(s).toBe(1);
      }
    });

    it('duty cycle 0.0 produces all -amplitude', () => {
      gen.setDutyCycle(0.0);
      const samples = sampleOnePeriod(gen, 100);
      for (const s of samples) {
        expect(s).toBe(-1);
      }
    });
  });

  // -------------------------------------------------------------------------
  // TRIANGLE waveform
  // -------------------------------------------------------------------------

  describe('TRIANGLE waveform', () => {
    beforeEach(() => {
      gen.setWaveform('TRIANGLE');
    });

    it('is linear — ramps up then down', () => {
      const samples = sampleOnePeriod(gen, 100);
      // First quarter: rising from -1 toward +1
      expect(samples[0]).toBeCloseTo(-1, 2);
      expect(samples[25]!).toBeCloseTo(0, 1);
      expect(samples[49]!).toBeCloseTo(1, 1);
      // Second half: falling from +1 toward -1
      expect(samples[75]!).toBeCloseTo(0, 1);
    });

    it('min and max equal amplitude bounds', () => {
      gen.setAmplitude(3);
      const samples = sampleOnePeriod(gen, 10000);
      expect(Math.max(...samples)).toBeCloseTo(3, 1);
      expect(Math.min(...samples)).toBeCloseTo(-3, 1);
    });
  });

  // -------------------------------------------------------------------------
  // SAWTOOTH waveform
  // -------------------------------------------------------------------------

  describe('SAWTOOTH waveform', () => {
    beforeEach(() => {
      gen.setWaveform('SAWTOOTH');
    });

    it('ramps linearly from -amplitude to +amplitude', () => {
      const samples = sampleOnePeriod(gen, 100);
      expect(samples[0]).toBeCloseTo(-1, 1);
      expect(samples[50]!).toBeCloseTo(0, 1);
      expect(samples[99]!).toBeCloseTo(1, 1);
    });

    it('each successive sample is >= previous (monotonic increasing)', () => {
      const samples = sampleOnePeriod(gen, 1000);
      for (let i = 1; i < samples.length; i++) {
        expect(samples[i]!).toBeGreaterThanOrEqual(samples[i - 1]! - 1e-10);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Frequency accuracy
  // -------------------------------------------------------------------------

  describe('frequency accuracy', () => {
    it('period equals 1/frequency for SINE', () => {
      gen.setFrequency(440);
      const period = 1 / 440;
      // Sample should repeat after exactly one period
      const v0 = gen.getSample(0);
      const vPeriod = gen.getSample(period);
      expect(vPeriod).toBeCloseTo(v0, 8);
    });

    it('period equals 1/frequency for SQUARE', () => {
      gen.setWaveform('SQUARE');
      gen.setFrequency(1000);
      const period = 1 / 1000;
      // High at start, high again after full period
      expect(gen.getSample(0)).toBe(1);
      expect(gen.getSample(period)).toBe(1);
    });

    it('works at high frequency (1 MHz)', () => {
      gen.setFrequency(1e6);
      const period = 1e-6;
      const vQuarter = gen.getSample(period / 4);
      expect(vQuarter).toBeCloseTo(1, 5);
    });
  });

  // -------------------------------------------------------------------------
  // DC offset
  // -------------------------------------------------------------------------

  describe('DC offset', () => {
    it('shifts entire waveform up', () => {
      gen.setDcOffset(2);
      const samples = sampleOnePeriod(gen, 1000);
      const max = Math.max(...samples);
      const min = Math.min(...samples);
      expect(max).toBeCloseTo(3, 2);
      expect(min).toBeCloseTo(1, 2);
    });

    it('shifts entire waveform down with negative offset', () => {
      gen.setDcOffset(-5);
      gen.setAmplitude(1);
      const samples = sampleOnePeriod(gen, 1000);
      const max = Math.max(...samples);
      const min = Math.min(...samples);
      expect(max).toBeCloseTo(-4, 2);
      expect(min).toBeCloseTo(-6, 2);
    });

    it('average of SINE with offset equals the offset', () => {
      gen.setDcOffset(3.5);
      const samples = sampleOnePeriod(gen, 10000);
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      expect(avg).toBeCloseTo(3.5, 1);
    });
  });

  // -------------------------------------------------------------------------
  // Duty cycle
  // -------------------------------------------------------------------------

  describe('duty cycle', () => {
    it('is clamped to [0, 1]', () => {
      gen.setDutyCycle(-0.5);
      expect(gen.getState().dutyCycle).toBe(0);
      gen.setDutyCycle(1.5);
      expect(gen.getState().dutyCycle).toBe(1);
    });

    it('only affects SQUARE waveform', () => {
      gen.setWaveform('SINE');
      gen.setDutyCycle(0.8);
      // SINE ignores duty cycle — samples should match a normal sine
      const period = 1 / gen.getState().frequency;
      expect(gen.getSample(period / 4)).toBeCloseTo(1, 5);
    });
  });

  // -------------------------------------------------------------------------
  // Net connection
  // -------------------------------------------------------------------------

  describe('net connection', () => {
    it('connects to a net', () => {
      gen.connect('NET_VCC');
      expect(gen.getState().connectedNet).toBe('NET_VCC');
    });

    it('disconnects from a net', () => {
      gen.connect('NET_VCC');
      gen.disconnect();
      expect(gen.getState().connectedNet).toBeNull();
    });

    it('can switch nets directly', () => {
      gen.connect('NET_A');
      gen.connect('NET_B');
      expect(gen.getState().connectedNet).toBe('NET_B');
    });
  });

  // -------------------------------------------------------------------------
  // Enable / disable
  // -------------------------------------------------------------------------

  describe('enable / disable', () => {
    it('when disabled, outputs only DC offset', () => {
      gen.setAmplitude(5);
      gen.setDcOffset(2);
      gen.setEnabled(false);
      expect(gen.getSample(0)).toBe(2);
      expect(gen.getSample(0.001)).toBe(2);
    });

    it('when re-enabled, outputs waveform again', () => {
      gen.setEnabled(false);
      gen.setEnabled(true);
      const period = 1 / gen.getState().frequency;
      expect(gen.getSample(period / 4)).toBeCloseTo(1, 5);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('0 Hz returns only DC offset', () => {
      gen.setFrequency(0);
      gen.setDcOffset(3.3);
      expect(gen.getSample(0)).toBe(3.3);
      expect(gen.getSample(999)).toBe(3.3);
    });

    it('0 amplitude produces flat line at DC offset', () => {
      gen.setAmplitude(0);
      gen.setDcOffset(1.5);
      const samples = sampleOnePeriod(gen, 100);
      for (const s of samples) {
        expect(s).toBe(1.5);
      }
    });

    it('very high frequency (10 MHz) still produces valid output', () => {
      gen.setFrequency(10e6);
      const v = gen.getSample(1e-8); // 10ns
      expect(Number.isFinite(v)).toBe(true);
    });

    it('negative time values produce valid output', () => {
      const v = gen.getSample(-0.001);
      expect(Number.isFinite(v)).toBe(true);
    });

    it('amplitude is clamped to >= 0', () => {
      gen.setAmplitude(-5);
      expect(gen.getState().amplitude).toBe(0);
    });

    it('frequency is clamped to >= 0', () => {
      gen.setFrequency(-100);
      expect(gen.getState().frequency).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Subscribe / notify
  // -------------------------------------------------------------------------

  describe('subscribe / notify', () => {
    it('calls listener on state change', () => {
      let called = 0;
      gen.subscribe(() => { called++; });
      gen.setFrequency(500);
      expect(called).toBe(1);
    });

    it('unsubscribe stops notifications', () => {
      let called = 0;
      const unsub = gen.subscribe(() => { called++; });
      unsub();
      gen.setFrequency(500);
      expect(called).toBe(0);
    });

    it('does not notify when setting same value', () => {
      let called = 0;
      gen.subscribe(() => { called++; });
      gen.setWaveform('SINE'); // already SINE
      gen.setFrequency(1000); // already 1000
      gen.setAmplitude(1); // already 1
      gen.setDcOffset(0); // already 0
      gen.setDutyCycle(0.5); // already 0.5
      gen.setEnabled(true); // already true
      expect(called).toBe(0);
    });

    it('multiple listeners all receive notifications', () => {
      let a = 0;
      let b = 0;
      gen.subscribe(() => { a++; });
      gen.subscribe(() => { b++; });
      gen.setFrequency(2000);
      expect(a).toBe(1);
      expect(b).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Singleton
  // -------------------------------------------------------------------------

  describe('singleton', () => {
    it('getFunctionGenerator returns same instance', () => {
      const a = getFunctionGenerator();
      const b = getFunctionGenerator();
      expect(a).toBe(b);
    });

    it('resetFunctionGenerator creates new instance', () => {
      const a = getFunctionGenerator();
      resetFunctionGenerator();
      const b = getFunctionGenerator();
      expect(a).not.toBe(b);
    });
  });

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  describe('reset', () => {
    it('restores default state', () => {
      gen.setWaveform('SAWTOOTH');
      gen.setFrequency(5000);
      gen.setAmplitude(3);
      gen.setDcOffset(2);
      gen.setDutyCycle(0.8);
      gen.connect('NET_X');
      gen.setEnabled(false);
      gen.reset();

      const state = gen.getState();
      expect(state.waveform).toBe('SINE');
      expect(state.frequency).toBe(1000);
      expect(state.amplitude).toBe(1);
      expect(state.dcOffset).toBe(0);
      expect(state.dutyCycle).toBe(0.5);
      expect(state.connectedNet).toBeNull();
      expect(state.enabled).toBe(true);
    });

    it('notifies listeners on reset', () => {
      let called = 0;
      gen.subscribe(() => { called++; });
      gen.reset();
      expect(called).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Auto-range formatting
  // -------------------------------------------------------------------------

  describe('formatFrequency', () => {
    it('formats Hz', () => {
      expect(formatFrequency(50)).toEqual({ value: 50, unit: 'Hz' });
    });

    it('formats kHz', () => {
      expect(formatFrequency(2500)).toEqual({ value: 2.5, unit: 'kHz' });
    });

    it('formats MHz', () => {
      expect(formatFrequency(1e6)).toEqual({ value: 1, unit: 'MHz' });
    });

    it('formats 0 Hz', () => {
      expect(formatFrequency(0)).toEqual({ value: 0, unit: 'Hz' });
    });

    it('formats fractional Hz', () => {
      const result = formatFrequency(0.5);
      expect(result.unit).toBe('Hz');
      expect(result.value).toBeCloseTo(0.5);
    });
  });

  describe('formatAmplitude', () => {
    it('formats volts', () => {
      expect(formatAmplitude(3.3)).toEqual({ value: 3.3, unit: 'V' });
    });

    it('formats millivolts', () => {
      expect(formatAmplitude(0.1)).toEqual({ value: 100, unit: 'mV' });
    });

    it('formats microvolts', () => {
      const result = formatAmplitude(0.0005);
      expect(result.unit).toBe('mV');
      expect(result.value).toBeCloseTo(0.5);
    });

    it('formats 0 V', () => {
      const result = formatAmplitude(0);
      expect(result.unit).toBe('\u00B5V');
      expect(result.value).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Setters return new state references (immutability)
  // -------------------------------------------------------------------------

  describe('immutability', () => {
    it('getState returns a new reference after mutation', () => {
      const before = gen.getState();
      gen.setFrequency(5000);
      const after = gen.getState();
      expect(before).not.toBe(after);
      expect(before.frequency).toBe(1000);
      expect(after.frequency).toBe(5000);
    });
  });
});
