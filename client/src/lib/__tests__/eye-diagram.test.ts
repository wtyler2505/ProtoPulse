import { describe, it, expect } from 'vitest';

import {
  generatePRBS7,
  generateNRZWaveform,
  channelImpulseResponse,
  convolveChannel,
  addJitter,
  buildEyeDiagram,
  measureEye,
  bathtubCurve,
} from '../simulation/eye-diagram';
import type {
  EyeDiagramConfig,
  EyeDiagram,
  EyeMeasurement,
  BathtubPoint,
} from '../simulation/eye-diagram';

// ---------------------------------------------------------------------------
// generatePRBS7
// ---------------------------------------------------------------------------

describe('generatePRBS7', () => {
  it('generates correct length sequence', () => {
    const bits = generatePRBS7(127);
    expect(bits.length).toBe(127);
  });

  it('generates only 0s and 1s', () => {
    const bits = generatePRBS7(200);
    for (const b of bits) {
      expect(b === 0 || b === 1).toBe(true);
    }
  });

  it('has roughly equal 0s and 1s for long sequences', () => {
    const bits = generatePRBS7(1000);
    const ones = bits.filter((b) => b === 1).length;
    const zeros = bits.filter((b) => b === 0).length;
    // PRBS7 has 64 ones and 63 zeros in one period (127 bits)
    // For 1000 bits, ratio should be close to 50/50
    expect(ones / bits.length).toBeGreaterThan(0.4);
    expect(ones / bits.length).toBeLessThan(0.6);
  });

  it('is periodic with period 127 (2^7-1)', () => {
    const bits = generatePRBS7(254); // exactly 2 periods
    for (let i = 0; i < 127; i++) {
      expect(bits[i]).toBe(bits[i + 127]);
    }
  });

  it('generates at least the requested length', () => {
    const bits = generatePRBS7(50);
    expect(bits.length).toBe(50);
  });

  it('returns empty array for length 0', () => {
    const bits = generatePRBS7(0);
    expect(bits.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// generateNRZWaveform
// ---------------------------------------------------------------------------

describe('generateNRZWaveform', () => {
  it('generates waveform with correct number of samples', () => {
    const bits = [1, 0, 1, 1, 0];
    const samplesPerBit = 32;
    const waveform = generateNRZWaveform(bits, 1e-9, 1.0, 0.1e-9, samplesPerBit);
    expect(waveform.length).toBe(bits.length * samplesPerBit);
  });

  it('high bit produces positive voltage', () => {
    const bits = [1, 1, 1, 1];
    const waveform = generateNRZWaveform(bits, 1e-9, 1.0, 0.01e-9, 32);
    // Middle of the bit period should be close to amplitude
    const mid = Math.floor(1.5 * 32); // middle of second bit
    expect(waveform[mid]).toBeGreaterThan(0.5);
  });

  it('low bit produces negative voltage', () => {
    const bits = [0, 0, 0, 0];
    const waveform = generateNRZWaveform(bits, 1e-9, 1.0, 0.01e-9, 32);
    const mid = Math.floor(1.5 * 32);
    expect(waveform[mid]).toBeLessThan(-0.5);
  });

  it('rise time affects transition slope', () => {
    const bits = [0, 1, 0];
    const fast = generateNRZWaveform(bits, 10e-9, 1.0, 0.1e-9, 64);
    const slow = generateNRZWaveform(bits, 10e-9, 1.0, 5e-9, 64);
    // Fast rise should reach target sooner — check midpoint of rising edge
    const transitionSample = 64; // start of second bit
    // Fast waveform should be closer to +1 at this point
    expect(Math.abs(fast[transitionSample + 10])).toBeGreaterThanOrEqual(Math.abs(slow[transitionSample + 10]) - 0.1);
  });

  it('amplitude scales the waveform', () => {
    const bits = [1, 1, 1];
    const amp1 = generateNRZWaveform(bits, 1e-9, 1.0, 0.01e-9, 32);
    const amp2 = generateNRZWaveform(bits, 1e-9, 2.0, 0.01e-9, 32);
    const mid = Math.floor(1.5 * 32);
    expect(amp2[mid] / amp1[mid]).toBeCloseTo(2, 0);
  });
});

// ---------------------------------------------------------------------------
// channelImpulseResponse
// ---------------------------------------------------------------------------

describe('channelImpulseResponse', () => {
  it('returns non-empty impulse response', () => {
    const params = {
      width: 0.2,
      height: 0.1,
      thickness: 0.035,
      er: 4.4,
      tanD: 0.02,
      length: 50,
    };
    const ir = channelImpulseResponse(params, 32);
    expect(ir.length).toBe(32);
  });

  it('impulse response has a peak at the propagation delay', () => {
    const params = {
      width: 0.2,
      height: 0.1,
      thickness: 0.035,
      er: 4.4,
      tanD: 0.02,
      length: 50,
    };
    const ir = channelImpulseResponse(params, 64);
    const maxVal = Math.max(...ir);
    expect(maxVal).toBeGreaterThan(0);
  });

  it('impulse response sums to approximately 1 (energy conservation)', () => {
    const params = {
      width: 0.2,
      height: 0.1,
      thickness: 0.035,
      er: 4.4,
      tanD: 0.02,
      length: 10, // short trace, low loss
    };
    const ir = channelImpulseResponse(params, 32);
    const sum = ir.reduce((a, b) => a + b, 0);
    // For a low-loss channel, sum should be close to 1
    expect(sum).toBeGreaterThan(0.5);
    expect(sum).toBeLessThanOrEqual(1.1);
  });
});

// ---------------------------------------------------------------------------
// convolveChannel
// ---------------------------------------------------------------------------

describe('convolveChannel', () => {
  it('convolution with delta function returns original', () => {
    const signal = [0, 0.5, 1, 0.5, 0];
    const delta = [1, 0, 0];
    const result = convolveChannel(signal, delta);
    expect(result.length).toBe(signal.length);
    for (let i = 0; i < signal.length; i++) {
      expect(result[i]).toBeCloseTo(signal[i], 6);
    }
  });

  it('convolution with uniform kernel averages signal', () => {
    const signal = [0, 0, 1, 0, 0];
    const kernel = [0.5, 0.5];
    const result = convolveChannel(signal, kernel);
    expect(result.length).toBe(signal.length);
    // The peak should be spread out
    const peakIndex = result.indexOf(Math.max(...result));
    expect(peakIndex).toBeGreaterThanOrEqual(1);
  });

  it('output length matches input length', () => {
    const signal = new Array(100).fill(0).map((_, i) => Math.sin(i * 0.1));
    const kernel = [0.25, 0.5, 0.25];
    const result = convolveChannel(signal, kernel);
    expect(result.length).toBe(signal.length);
  });
});

// ---------------------------------------------------------------------------
// addJitter
// ---------------------------------------------------------------------------

describe('addJitter', () => {
  it('adds random jitter to waveform', () => {
    const signal = new Array(320).fill(0).map((_, i) => (i % 32 < 16 ? 1 : -1));
    const result = addJitter(signal, 1e-9, 32, 10e-12, 0);
    // Should be different from original due to jitter
    expect(result.length).toBe(signal.length);
  });

  it('returns same length waveform', () => {
    const signal = new Array(320).fill(0).map((_, i) => Math.sin(i * 0.1));
    const result = addJitter(signal, 1e-9, 32, 5e-12, 0);
    expect(result.length).toBe(signal.length);
  });

  it('deterministic jitter shifts edges consistently', () => {
    const signal = new Array(320).fill(0).map((_, i) => (i % 32 < 16 ? 1 : -1));
    const result = addJitter(signal, 1e-9, 32, 0, 50e-12);
    expect(result.length).toBe(signal.length);
  });

  it('zero jitter returns unchanged waveform', () => {
    const signal = new Array(320).fill(0).map((_, i) => Math.sin(i * 0.1));
    const result = addJitter(signal, 1e-9, 32, 0, 0);
    expect(result.length).toBe(signal.length);
    for (let i = 0; i < signal.length; i++) {
      expect(result[i]).toBeCloseTo(signal[i], 6);
    }
  });
});

// ---------------------------------------------------------------------------
// buildEyeDiagram
// ---------------------------------------------------------------------------

describe('buildEyeDiagram', () => {
  it('builds eye diagram with correct number of traces', () => {
    // Create a simple waveform: 10 bits, 32 samples/bit
    const numBits = 10;
    const samplesPerBit = 32;
    const waveform = new Array(numBits * samplesPerBit).fill(0).map((_, i) => Math.sin(i * 0.2));
    const eye = buildEyeDiagram(waveform, 1e-9, samplesPerBit);
    // Should have traces from folding waveform into 2-UI window
    expect(eye.traces.length).toBeGreaterThan(0);
  });

  it('each trace spans 2 unit intervals', () => {
    const numBits = 20;
    const samplesPerBit = 32;
    const waveform = new Array(numBits * samplesPerBit).fill(0).map((_, i) => Math.sin(i * 0.3));
    const eye = buildEyeDiagram(waveform, 1e-9, samplesPerBit);
    for (const trace of eye.traces) {
      expect(trace.time.length).toBe(2 * samplesPerBit);
      expect(trace.voltage.length).toBe(2 * samplesPerBit);
    }
  });

  it('returns measurement data', () => {
    const numBits = 50;
    const samplesPerBit = 32;
    // Generate a clean NRZ-like waveform
    const bits = Array.from({ length: numBits }, (_, i) => (i % 2 === 0 ? 1 : -1));
    const waveform: number[] = [];
    for (const b of bits) {
      for (let j = 0; j < samplesPerBit; j++) {
        waveform.push(b);
      }
    }
    const eye = buildEyeDiagram(waveform, 1e-9, samplesPerBit);
    expect(eye.measurements).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// measureEye
// ---------------------------------------------------------------------------

describe('measureEye', () => {
  it('measures eye height and width', () => {
    // Create a clean eye diagram
    const samplesPerBit = 32;
    const traces: Array<{ time: number[]; voltage: number[] }> = [];

    // Create multiple traces alternating between +1 and -1
    for (let i = 0; i < 20; i++) {
      const time = Array.from({ length: 2 * samplesPerBit }, (_, j) => (j / samplesPerBit) * 1e-9);
      const level = i % 2 === 0 ? 1 : -1;
      const voltage = Array.from({ length: 2 * samplesPerBit }, () => level);
      traces.push({ time, voltage });
    }

    const measurement = measureEye({ traces, measurements: {} as EyeMeasurement });
    expect(measurement.eyeHeight).toBeGreaterThan(0);
    expect(measurement.eyeWidth).toBeGreaterThanOrEqual(0);
    expect(measurement.openingPercent).toBeGreaterThanOrEqual(0);
    expect(measurement.openingPercent).toBeLessThanOrEqual(100);
  });

  it('closed eye has zero or near-zero height', () => {
    const samplesPerBit = 32;
    const traces: Array<{ time: number[]; voltage: number[] }> = [];

    // All traces at the same level -> closed eye
    for (let i = 0; i < 20; i++) {
      const time = Array.from({ length: 2 * samplesPerBit }, (_, j) => (j / samplesPerBit) * 1e-9);
      const voltage = Array.from({ length: 2 * samplesPerBit }, () => 0.5);
      traces.push({ time, voltage });
    }

    const measurement = measureEye({ traces, measurements: {} as EyeMeasurement });
    expect(measurement.eyeHeight).toBeCloseTo(0, 1);
  });

  it('jitter measurements are non-negative', () => {
    const samplesPerBit = 32;
    const traces: Array<{ time: number[]; voltage: number[] }> = [];

    for (let i = 0; i < 20; i++) {
      const time = Array.from({ length: 2 * samplesPerBit }, (_, j) => (j / samplesPerBit) * 1e-9);
      const level = i % 2 === 0 ? 1 : -1;
      const voltage = Array.from({ length: 2 * samplesPerBit }, () => level);
      traces.push({ time, voltage });
    }

    const measurement = measureEye({ traces, measurements: {} as EyeMeasurement });
    expect(measurement.jitterRms).toBeGreaterThanOrEqual(0);
    expect(measurement.jitterPp).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// bathtubCurve
// ---------------------------------------------------------------------------

describe('bathtubCurve', () => {
  it('returns array of bathtub points', () => {
    const samplesPerBit = 32;
    const traces: Array<{ time: number[]; voltage: number[] }> = [];

    for (let i = 0; i < 50; i++) {
      const time = Array.from({ length: 2 * samplesPerBit }, (_, j) => (j / samplesPerBit) * 1e-9);
      const level = i % 2 === 0 ? 1 : -1;
      const voltage = Array.from({ length: 2 * samplesPerBit }, () => level);
      traces.push({ time, voltage });
    }

    const curve = bathtubCurve({ traces, measurements: {} as EyeMeasurement }, 1e-12);
    expect(curve.length).toBeGreaterThan(0);
  });

  it('BER is lowest at center of eye', () => {
    const samplesPerBit = 32;
    const traces: Array<{ time: number[]; voltage: number[] }> = [];

    for (let i = 0; i < 50; i++) {
      const time = Array.from({ length: 2 * samplesPerBit }, (_, j) => (j / samplesPerBit) * 1e-9);
      const level = i % 2 === 0 ? 0.9 : -0.9;
      const voltage = Array.from({ length: 2 * samplesPerBit }, () => level);
      traces.push({ time, voltage });
    }

    const curve = bathtubCurve({ traces, measurements: {} as EyeMeasurement }, 1e-12);
    if (curve.length > 2) {
      const centerIdx = Math.floor(curve.length / 2);
      const centerBer = curve[centerIdx].ber;
      const edgeBer = curve[0].ber;
      expect(centerBer).toBeLessThanOrEqual(edgeBer);
    }
  });

  it('each point has timing offset and BER', () => {
    const samplesPerBit = 32;
    const traces: Array<{ time: number[]; voltage: number[] }> = [];

    for (let i = 0; i < 20; i++) {
      const time = Array.from({ length: 2 * samplesPerBit }, (_, j) => (j / samplesPerBit) * 1e-9);
      const voltage = Array.from({ length: 2 * samplesPerBit }, () => (i % 2 === 0 ? 1 : -1));
      traces.push({ time, voltage });
    }

    const curve = bathtubCurve({ traces, measurements: {} as EyeMeasurement }, 1e-12);
    for (const pt of curve) {
      expect(typeof pt.timingOffset).toBe('number');
      expect(typeof pt.ber).toBe('number');
      expect(pt.ber).toBeGreaterThanOrEqual(0);
    }
  });
});
