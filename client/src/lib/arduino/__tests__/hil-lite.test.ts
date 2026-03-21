import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  HilLiteManager,
  getHilLiteManager,
  resetHilLiteManager,
  generateWaveformSample,
  formatSamples,
  SENSOR_PRESETS,
} from '../hil-lite';
import type {
  WaveformConfig,
  SensorChannel,
  GeneratedSample,
  HilSnapshot,
  OutputFormat,
} from '../hil-lite';

// ──────────────────────────────────────────────────────────────────
// Default waveform config helper
// ──────────────────────────────────────────────────────────────────

const defaultWaveform: WaveformConfig = {
  type: 'sine',
  offset: 0,
  amplitude: 1,
  frequency: 1,
  phase: 0,
  noiseStdDev: 0,
  min: -Infinity,
  max: Infinity,
  dutyCycle: 0.5,
  stepInterval: 1,
  stepSize: 1,
};

function wave(overrides: Partial<WaveformConfig> = {}): WaveformConfig {
  return { ...defaultWaveform, ...overrides };
}

// ──────────────────────────────────────────────────────────────────
// generateWaveformSample — Sine
// ──────────────────────────────────────────────────────────────────

describe('generateWaveformSample — sine', () => {
  it('generates 0 at t=0 with default config', () => {
    const v = generateWaveformSample(wave(), 0);
    expect(v).toBeCloseTo(0, 10);
  });

  it('generates amplitude at quarter period', () => {
    const v = generateWaveformSample(wave({ amplitude: 5 }), 0.25);
    expect(v).toBeCloseTo(5, 5);
  });

  it('applies offset', () => {
    const v = generateWaveformSample(wave({ offset: 10 }), 0);
    expect(v).toBeCloseTo(10, 10);
  });

  it('applies phase offset', () => {
    const v = generateWaveformSample(wave({ phase: Math.PI / 2 }), 0);
    expect(v).toBeCloseTo(1, 5);
  });

  it('respects frequency', () => {
    // frequency=2: period=0.5s, quarter period=0.125s
    const v = generateWaveformSample(wave({ frequency: 2, amplitude: 3 }), 0.125);
    expect(v).toBeCloseTo(3, 5);
  });
});

// ──────────────────────────────────────────────────────────────────
// generateWaveformSample — Square
// ──────────────────────────────────────────────────────────────────

describe('generateWaveformSample — square', () => {
  it('outputs +amplitude in first half', () => {
    const v = generateWaveformSample(wave({ type: 'square', amplitude: 5 }), 0.1);
    expect(v).toBe(5);
  });

  it('outputs -amplitude in second half', () => {
    const v = generateWaveformSample(wave({ type: 'square', amplitude: 5 }), 0.7);
    expect(v).toBe(-5);
  });

  it('respects duty cycle', () => {
    const config = wave({ type: 'square', amplitude: 1, dutyCycle: 0.8 });
    expect(generateWaveformSample(config, 0.3)).toBe(1);  // in first 80%
    expect(generateWaveformSample(config, 0.9)).toBe(-1); // in last 20%
  });
});

// ──────────────────────────────────────────────────────────────────
// generateWaveformSample — Triangle
// ──────────────────────────────────────────────────────────────────

describe('generateWaveformSample — triangle', () => {
  it('starts at -amplitude', () => {
    const v = generateWaveformSample(wave({ type: 'triangle', amplitude: 5 }), 0);
    expect(v).toBeCloseTo(-5, 5);
  });

  it('peaks at +amplitude at 0.25 period', () => {
    const v = generateWaveformSample(wave({ type: 'triangle', amplitude: 5 }), 0.25);
    expect(v).toBeCloseTo(5, 5);
  });

  it('returns to -amplitude at full period', () => {
    const v = generateWaveformSample(wave({ type: 'triangle', amplitude: 5 }), 1.0);
    expect(v).toBeCloseTo(-5, 5);
  });
});

// ──────────────────────────────────────────────────────────────────
// generateWaveformSample — Sawtooth
// ──────────────────────────────────────────────────────────────────

describe('generateWaveformSample — sawtooth', () => {
  it('starts at -amplitude', () => {
    const v = generateWaveformSample(wave({ type: 'sawtooth', amplitude: 3 }), 0);
    expect(v).toBeCloseTo(-3, 5);
  });

  it('ends near +amplitude before wrap', () => {
    const v = generateWaveformSample(wave({ type: 'sawtooth', amplitude: 3 }), 0.99);
    expect(v).toBeCloseTo(3 * (2 * 0.99 - 1), 1);
  });
});

// ──────────────────────────────────────────────────────────────────
// generateWaveformSample — Random
// ──────────────────────────────────────────────────────────────────

describe('generateWaveformSample — random', () => {
  it('generates value within amplitude range', () => {
    const rng = () => 0.5;
    const v = generateWaveformSample(wave({ type: 'random', amplitude: 10, offset: 5 }), 0, rng);
    expect(v).toBeCloseTo(5, 5); // 5 + 10 * (2*0.5 - 1) = 5 + 0 = 5
  });

  it('uses rng for randomness', () => {
    const rng = () => 1.0;
    const v = generateWaveformSample(wave({ type: 'random', amplitude: 10 }), 0, rng);
    expect(v).toBeCloseTo(10, 5); // 0 + 10 * (2*1 - 1) = 10
  });
});

// ──────────────────────────────────────────────────────────────────
// generateWaveformSample — Step
// ──────────────────────────────────────────────────────────────────

describe('generateWaveformSample — step', () => {
  it('starts at offset', () => {
    const v = generateWaveformSample(wave({ type: 'step', offset: 10, stepInterval: 2, stepSize: 5 }), 0);
    expect(v).toBe(10);
  });

  it('steps up at intervals', () => {
    const config = wave({ type: 'step', offset: 0, stepInterval: 1, stepSize: 3 });
    expect(generateWaveformSample(config, 0)).toBe(0);
    expect(generateWaveformSample(config, 1)).toBe(3);
    expect(generateWaveformSample(config, 2)).toBe(6);
    expect(generateWaveformSample(config, 3.5)).toBe(9);
  });
});

// ──────────────────────────────────────────────────────────────────
// generateWaveformSample — Ramp
// ──────────────────────────────────────────────────────────────────

describe('generateWaveformSample — ramp', () => {
  it('ramps linearly', () => {
    const config = wave({ type: 'ramp', offset: 5, amplitude: 2 });
    expect(generateWaveformSample(config, 0)).toBe(5);
    expect(generateWaveformSample(config, 1)).toBe(7);
    expect(generateWaveformSample(config, 10)).toBe(25);
  });
});

// ──────────────────────────────────────────────────────────────────
// generateWaveformSample — Constant
// ──────────────────────────────────────────────────────────────────

describe('generateWaveformSample — constant', () => {
  it('always returns offset', () => {
    const config = wave({ type: 'constant', offset: 42 });
    expect(generateWaveformSample(config, 0)).toBe(42);
    expect(generateWaveformSample(config, 100)).toBe(42);
    expect(generateWaveformSample(config, -5)).toBe(42);
  });
});

// ──────────────────────────────────────────────────────────────────
// generateWaveformSample — Clamping
// ──────────────────────────────────────────────────────────────────

describe('generateWaveformSample — clamping', () => {
  it('clamps to min', () => {
    const v = generateWaveformSample(wave({ type: 'sine', amplitude: 100, min: -10 }), 0.75);
    expect(v).toBeGreaterThanOrEqual(-10);
  });

  it('clamps to max', () => {
    const v = generateWaveformSample(wave({ type: 'sine', amplitude: 100, max: 50 }), 0.25);
    expect(v).toBe(50);
  });
});

// ──────────────────────────────────────────────────────────────────
// generateWaveformSample — Noise
// ──────────────────────────────────────────────────────────────────

describe('generateWaveformSample — noise', () => {
  it('adds Gaussian noise when stdDev > 0', () => {
    const rng = () => 0.5;
    const base = generateWaveformSample(wave({ type: 'constant', offset: 10 }), 0);
    const noisy = generateWaveformSample(wave({ type: 'constant', offset: 10, noiseStdDev: 1 }), 0, rng);
    // With rng=0.5, noise should be deterministic
    expect(typeof noisy).toBe('number');
    expect(Number.isFinite(noisy)).toBe(true);
    // Base is exactly 10, noisy may differ
    expect(base).toBe(10);
  });
});

// ──────────────────────────────────────────────────────────────────
// Sensor presets
// ──────────────────────────────────────────────────────────────────

describe('SENSOR_PRESETS', () => {
  it('has at least 10 presets', () => {
    expect(SENSOR_PRESETS.length).toBeGreaterThanOrEqual(10);
  });

  it('each preset has name, description, and channels', () => {
    for (const preset of SENSOR_PRESETS) {
      expect(typeof preset.name).toBe('string');
      expect(preset.name.length).toBeGreaterThan(0);
      expect(typeof preset.description).toBe('string');
      expect(preset.channels.length).toBeGreaterThan(0);
    }
  });

  it('DHT22 has temperature and humidity channels', () => {
    const dht = SENSOR_PRESETS.find((p) => p.name === 'DHT22');
    expect(dht).toBeDefined();
    expect(dht!.channels.length).toBe(2);
    expect(dht!.channels[0].name).toBe('temperature');
    expect(dht!.channels[1].name).toBe('humidity');
  });

  it('all channels have valid waveform configs', () => {
    for (const preset of SENSOR_PRESETS) {
      for (const ch of preset.channels) {
        expect(ch.waveform.type).toBeDefined();
        expect(typeof ch.waveform.offset).toBe('number');
        expect(typeof ch.waveform.amplitude).toBe('number');
      }
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// formatSamples
// ──────────────────────────────────────────────────────────────────

describe('formatSamples', () => {
  const samples: GeneratedSample[] = [
    { name: 'temp', value: 22.5, timestamp: 1000 },
    { name: 'hum', value: 65.3, timestamp: 1000 },
  ];

  it('returns empty string for no samples', () => {
    expect(formatSamples([], 'csv')).toBe('');
  });

  it('formats as CSV', () => {
    const result = formatSamples(samples, 'csv');
    expect(result).toBe('22.50,65.30');
  });

  it('formats as JSON', () => {
    const result = formatSamples(samples, 'json');
    const parsed = JSON.parse(result) as Record<string, number>;
    expect(parsed.temp).toBe(22.5);
    expect(parsed.hum).toBe(65.3);
  });

  it('formats as name=value', () => {
    const result = formatSamples(samples, 'name_value');
    expect(result).toBe('temp=22.50 hum=65.30');
  });
});

// ──────────────────────────────────────────────────────────────────
// HilLiteManager — Singleton
// ──────────────────────────────────────────────────────────────────

describe('HilLiteManager singleton', () => {
  beforeEach(() => {
    resetHilLiteManager();
  });

  it('returns same instance', () => {
    const a = getHilLiteManager();
    const b = getHilLiteManager();
    expect(a).toBe(b);
  });

  it('reset creates new instance', () => {
    const a = getHilLiteManager();
    resetHilLiteManager();
    const b = getHilLiteManager();
    expect(a).not.toBe(b);
  });
});

// ──────────────────────────────────────────────────────────────────
// HilLiteManager — Channel management
// ──────────────────────────────────────────────────────────────────

describe('HilLiteManager channel management', () => {
  let mgr: HilLiteManager;

  beforeEach(() => {
    mgr = new HilLiteManager(123);
  });

  it('addChannel adds new channel', () => {
    mgr.addChannel({
      name: 'temp',
      unit: '°C',
      waveform: wave({ offset: 22 }),
      enabled: true,
    });
    expect(mgr.getChannels().length).toBe(1);
    expect(mgr.getChannels()[0].name).toBe('temp');
  });

  it('addChannel replaces existing channel with same name', () => {
    mgr.addChannel({ name: 'temp', unit: '°C', waveform: wave({ offset: 22 }), enabled: true });
    mgr.addChannel({ name: 'temp', unit: '°F', waveform: wave({ offset: 72 }), enabled: true });
    expect(mgr.getChannels().length).toBe(1);
    expect(mgr.getChannels()[0].unit).toBe('°F');
  });

  it('removeChannel returns true for existing', () => {
    mgr.addChannel({ name: 'temp', unit: '°C', waveform: wave(), enabled: true });
    expect(mgr.removeChannel('temp')).toBe(true);
    expect(mgr.getChannels().length).toBe(0);
  });

  it('removeChannel returns false for non-existing', () => {
    expect(mgr.removeChannel('nope')).toBe(false);
  });

  it('enableChannel toggles enabled state', () => {
    mgr.addChannel({ name: 'temp', unit: '°C', waveform: wave(), enabled: true });
    mgr.enableChannel('temp', false);
    expect(mgr.getChannels()[0].enabled).toBe(false);
  });

  it('enableChannel returns false for unknown channel', () => {
    expect(mgr.enableChannel('nope', true)).toBe(false);
  });

  it('clearChannels removes all', () => {
    mgr.addChannel({ name: 'a', unit: '', waveform: wave(), enabled: true });
    mgr.addChannel({ name: 'b', unit: '', waveform: wave(), enabled: true });
    mgr.clearChannels();
    expect(mgr.getChannels().length).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// HilLiteManager — Preset loading
// ──────────────────────────────────────────────────────────────────

describe('HilLiteManager preset loading', () => {
  let mgr: HilLiteManager;

  beforeEach(() => {
    mgr = new HilLiteManager(42);
  });

  it('loads DHT22 preset', () => {
    expect(mgr.loadPreset('DHT22')).toBe(true);
    const channels = mgr.getChannels();
    expect(channels.length).toBe(2);
    expect(channels[0].name).toBe('temperature');
    expect(channels[1].name).toBe('humidity');
  });

  it('returns false for unknown preset', () => {
    expect(mgr.loadPreset('FakePreset')).toBe(false);
  });

  it('loads MPU6050 preset with 3 channels', () => {
    mgr.loadPreset('MPU6050');
    expect(mgr.getChannels().length).toBe(3);
  });

  it('loading multiple presets merges channels', () => {
    mgr.loadPreset('DHT22');
    mgr.loadPreset('LDR');
    expect(mgr.getChannels().length).toBe(3);
  });
});

// ──────────────────────────────────────────────────────────────────
// HilLiteManager — Configuration
// ──────────────────────────────────────────────────────────────────

describe('HilLiteManager configuration', () => {
  let mgr: HilLiteManager;

  beforeEach(() => {
    mgr = new HilLiteManager(42);
  });

  it('default sample rate is 10 Hz', () => {
    expect(mgr.getSampleRate()).toBe(10);
  });

  it('setSampleRate clamps to valid range', () => {
    mgr.setSampleRate(0.01);
    expect(mgr.getSampleRate()).toBe(0.1);
    mgr.setSampleRate(5000);
    expect(mgr.getSampleRate()).toBe(1000);
  });

  it('default output format is name_value', () => {
    expect(mgr.getOutputFormat()).toBe('name_value');
  });

  it('setOutputFormat changes format', () => {
    mgr.setOutputFormat('json');
    expect(mgr.getOutputFormat()).toBe('json');
  });
});

// ──────────────────────────────────────────────────────────────────
// HilLiteManager — Batch generation
// ──────────────────────────────────────────────────────────────────

describe('HilLiteManager batch generation', () => {
  let mgr: HilLiteManager;

  beforeEach(() => {
    mgr = new HilLiteManager(42);
  });

  it('generates samples for all enabled channels', () => {
    mgr.loadPreset('DHT22');
    const samples = mgr.generateBatch(0);
    expect(samples.length).toBe(2);
    expect(samples[0].name).toBe('temperature');
    expect(samples[1].name).toBe('humidity');
  });

  it('skips disabled channels', () => {
    mgr.loadPreset('DHT22');
    mgr.enableChannel('humidity', false);
    const samples = mgr.generateBatch(0);
    expect(samples.length).toBe(1);
    expect(samples[0].name).toBe('temperature');
  });

  it('generates empty batch when no channels', () => {
    expect(mgr.generateBatch(0).length).toBe(0);
  });

  it('increments total samples counter', () => {
    mgr.loadPreset('LDR');
    mgr.generateBatch(0);
    mgr.generateBatch(0.1);
    expect(mgr.getTotalSamples()).toBe(2);
  });

  it('generates values within configured range', () => {
    mgr.loadPreset('LDR');
    for (let t = 0; t < 10; t += 0.1) {
      const samples = mgr.generateBatch(t);
      for (const s of samples) {
        expect(s.value).toBeGreaterThanOrEqual(0);
        expect(s.value).toBeLessThanOrEqual(1023);
      }
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// HilLiteManager — Series generation
// ──────────────────────────────────────────────────────────────────

describe('HilLiteManager series generation', () => {
  let mgr: HilLiteManager;

  beforeEach(() => {
    mgr = new HilLiteManager(42);
    mgr.loadPreset('LDR');
  });

  it('generates correct number of batches', () => {
    const series = mgr.generateSeries(0, 1, 10);
    expect(series.length).toBe(10);
  });

  it('each batch has correct channel count', () => {
    const series = mgr.generateSeries(0, 0.5, 5);
    for (const batch of series) {
      expect(batch.length).toBe(1); // LDR has 1 channel
    }
  });

  it('uses custom sample rate', () => {
    const series = mgr.generateSeries(0, 2, 100);
    expect(series.length).toBe(200);
  });
});

// ──────────────────────────────────────────────────────────────────
// HilLiteManager — Format batch
// ──────────────────────────────────────────────────────────────────

describe('HilLiteManager formatBatch', () => {
  let mgr: HilLiteManager;

  beforeEach(() => {
    mgr = new HilLiteManager(42);
    mgr.loadPreset('DHT22');
  });

  it('formats with default output format', () => {
    const samples = mgr.generateBatch(0);
    const line = mgr.formatBatch(samples);
    expect(line).toContain('temperature=');
    expect(line).toContain('humidity=');
  });

  it('formats with override format', () => {
    const samples = mgr.generateBatch(0);
    const csv = mgr.formatBatch(samples, 'csv');
    expect(csv).toContain(',');
    expect(csv).not.toContain('temperature');
  });

  it('json format is valid JSON', () => {
    const samples = mgr.generateBatch(0);
    const json = mgr.formatBatch(samples, 'json');
    const parsed = JSON.parse(json) as Record<string, number>;
    expect(typeof parsed.temperature).toBe('number');
    expect(typeof parsed.humidity).toBe('number');
  });
});

// ──────────────────────────────────────────────────────────────────
// HilLiteManager — Subscribe
// ──────────────────────────────────────────────────────────────────

describe('HilLiteManager subscribe', () => {
  let mgr: HilLiteManager;

  beforeEach(() => {
    mgr = new HilLiteManager(42);
  });

  it('notifies on channel add', () => {
    let called = 0;
    mgr.subscribe(() => called++);
    mgr.addChannel({ name: 'x', unit: '', waveform: wave(), enabled: true });
    expect(called).toBe(1);
  });

  it('unsubscribe stops notifications', () => {
    let called = 0;
    const unsub = mgr.subscribe(() => called++);
    unsub();
    mgr.addChannel({ name: 'x', unit: '', waveform: wave(), enabled: true });
    expect(called).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// HilLiteManager — Playback (start/stop)
// ──────────────────────────────────────────────────────────────────

describe('HilLiteManager playback', () => {
  let mgr: HilLiteManager;

  beforeEach(() => {
    vi.useFakeTimers();
    mgr = new HilLiteManager(42);
    mgr.loadPreset('LDR');
    mgr.setSampleRate(10);
  });

  afterEach(() => {
    mgr.stop();
    vi.useRealTimers();
  });

  it('starts and stops', () => {
    expect(mgr.isRunning()).toBe(false);
    mgr.start();
    expect(mgr.isRunning()).toBe(true);
    mgr.stop();
    expect(mgr.isRunning()).toBe(false);
  });

  it('start is idempotent', () => {
    mgr.start();
    mgr.start(); // no-op
    expect(mgr.isRunning()).toBe(true);
  });

  it('calls sample callback on timer', () => {
    const lines: string[] = [];
    mgr.onSample((line) => lines.push(line));
    mgr.start();
    vi.advanceTimersByTime(300); // 3 samples at 10 Hz
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
});

// ──────────────────────────────────────────────────────────────────
// HilLiteManager — Snapshot
// ──────────────────────────────────────────────────────────────────

describe('HilLiteManager snapshot', () => {
  it('returns correct structure', () => {
    const mgr = new HilLiteManager(42);
    const snap: HilSnapshot = mgr.getSnapshot();
    expect(snap.channels).toEqual([]);
    expect(snap.running).toBe(false);
    expect(snap.sampleRate).toBe(10);
    expect(snap.totalSamples).toBe(0);
    expect(snap.outputFormat).toBe('name_value');
  });

  it('reflects loaded channels', () => {
    const mgr = new HilLiteManager(42);
    mgr.loadPreset('MPU6050');
    const snap = mgr.getSnapshot();
    expect(snap.channels.length).toBe(3);
  });
});

// ──────────────────────────────────────────────────────────────────
// HilLiteManager — Reset
// ──────────────────────────────────────────────────────────────────

describe('HilLiteManager reset', () => {
  it('clears all state', () => {
    const mgr = new HilLiteManager(42);
    mgr.loadPreset('DHT22');
    mgr.generateBatch(0);
    mgr.reset();
    expect(mgr.getChannels().length).toBe(0);
    expect(mgr.getTotalSamples()).toBe(0);
    expect(mgr.isRunning()).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// HilLiteManager — Deterministic with seed
// ──────────────────────────────────────────────────────────────────

describe('HilLiteManager determinism', () => {
  it('same seed produces same output', () => {
    const mgr1 = new HilLiteManager(999);
    const mgr2 = new HilLiteManager(999);
    mgr1.addChannel({ name: 'x', unit: '', waveform: wave({ type: 'random', amplitude: 10 }), enabled: true });
    mgr2.addChannel({ name: 'x', unit: '', waveform: wave({ type: 'random', amplitude: 10 }), enabled: true });

    const v1 = mgr1.generateBatch(0)[0].value;
    const v2 = mgr2.generateBatch(0)[0].value;
    expect(v1).toBe(v2);
  });
});

// ──────────────────────────────────────────────────────────────────
// Edge cases
// ──────────────────────────────────────────────────────────────────

describe('HilLiteManager edge cases', () => {
  it('handles zero frequency (DC)', () => {
    const v = generateWaveformSample(wave({ type: 'sine', frequency: 0, offset: 5 }), 100);
    expect(v).toBeCloseTo(5, 5);
  });

  it('handles negative time', () => {
    const v = generateWaveformSample(wave({ type: 'sine' }), -1);
    expect(Number.isFinite(v)).toBe(true);
  });

  it('step with zero interval returns offset', () => {
    const v = generateWaveformSample(wave({ type: 'step', stepInterval: 0, offset: 7 }), 5);
    expect(v).toBe(7);
  });
});
