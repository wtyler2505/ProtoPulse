/**
 * HilLiteManager — Hardware-in-the-Loop Lite: mock sensors for offline testing (BL-0462).
 *
 * Generates realistic waveforms for sensor channels so firmware can be tested
 * without physical hardware. Supports 8 waveform types and 10+ sensor presets
 * with configurable noise, range clamping, and sample rate.
 *
 * Output formats: csv, json, name=value — matching common Serial.println patterns
 * that VariableWatchManager can parse.
 *
 * Singleton+subscribe pattern for useSyncExternalStore compatibility.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

export type WaveformType =
  | 'sine'
  | 'square'
  | 'triangle'
  | 'sawtooth'
  | 'random'
  | 'step'
  | 'ramp'
  | 'constant';

export type OutputFormat = 'csv' | 'json' | 'name_value';

export interface WaveformConfig {
  /** Waveform shape. */
  type: WaveformType;
  /** Center / DC offset. Default 0. */
  offset: number;
  /** Amplitude (peak-to-peak / 2). Default 1. */
  amplitude: number;
  /** Frequency in Hz. Default 1. */
  frequency: number;
  /** Phase offset in radians. Default 0. */
  phase: number;
  /** Gaussian noise standard deviation added to output. Default 0. */
  noiseStdDev: number;
  /** Minimum clamped output value. Default -Infinity. */
  min: number;
  /** Maximum clamped output value. Default Infinity. */
  max: number;
  /** Duty cycle for square wave (0-1). Default 0.5. */
  dutyCycle: number;
  /** Step interval in seconds for step waveform. Default 1. */
  stepInterval: number;
  /** Step size for step waveform. Default 1. */
  stepSize: number;
}

export interface SensorChannel {
  /** Unique channel name (e.g. "temperature"). */
  name: string;
  /** Unit of measurement. */
  unit: string;
  /** Waveform configuration. */
  waveform: WaveformConfig;
  /** Whether this channel is active. */
  enabled: boolean;
}

export interface SensorPreset {
  /** Preset name. */
  name: string;
  /** Description. */
  description: string;
  /** Channels in this preset. */
  channels: SensorChannel[];
}

export interface GeneratedSample {
  /** Channel name. */
  name: string;
  /** Generated value. */
  value: number;
  /** Timestamp in ms. */
  timestamp: number;
}

export interface HilSnapshot {
  /** Active channels. */
  channels: SensorChannel[];
  /** Whether generation is running. */
  running: boolean;
  /** Sample rate in Hz. */
  sampleRate: number;
  /** Total samples generated. */
  totalSamples: number;
  /** Output format. */
  outputFormat: OutputFormat;
}

// ---------------------------------------------------------------------------
// Default waveform config
// ---------------------------------------------------------------------------

const DEFAULT_WAVEFORM: WaveformConfig = {
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

// ---------------------------------------------------------------------------
// Waveform generators
// ---------------------------------------------------------------------------

/** Seeded pseudo-random for reproducible noise (mulberry32). */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller transform for Gaussian noise. */
function gaussianNoise(rng: () => number, stdDev: number): number {
  if (stdDev === 0) {
    return 0;
  }
  const u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
  return z * stdDev;
}

/**
 * Generate a single waveform sample at a given time.
 */
export function generateWaveformSample(
  config: WaveformConfig,
  timeSeconds: number,
  rng?: () => number,
): number {
  const { type, offset, amplitude, frequency, phase, noiseStdDev, min, max, dutyCycle, stepInterval, stepSize } =
    config;

  let raw: number;
  const t = timeSeconds;
  const period = frequency === 0 ? Infinity : 1 / frequency;
  const cyclePos = frequency === 0 ? 0 : ((t * frequency + phase / (2 * Math.PI)) % 1 + 1) % 1;

  switch (type) {
    case 'sine':
      raw = offset + amplitude * Math.sin(2 * Math.PI * frequency * t + phase);
      break;

    case 'square':
      raw = offset + amplitude * (cyclePos < dutyCycle ? 1 : -1);
      break;

    case 'triangle': {
      // Triangle: linear ramp up to 0.5, down from 0.5 to 1.0
      const tri = cyclePos < 0.5 ? 4 * cyclePos - 1 : 3 - 4 * cyclePos;
      raw = offset + amplitude * tri;
      break;
    }

    case 'sawtooth':
      raw = offset + amplitude * (2 * cyclePos - 1);
      break;

    case 'random': {
      const r = rng ? rng() : Math.random();
      raw = offset + amplitude * (2 * r - 1);
      break;
    }

    case 'step': {
      const stepCount = stepInterval > 0 ? Math.floor(t / stepInterval) : 0;
      raw = offset + stepSize * stepCount;
      break;
    }

    case 'ramp':
      raw = offset + amplitude * t;
      break;

    case 'constant':
      raw = offset;
      break;

    default:
      raw = offset;
  }

  // Add noise
  if (noiseStdDev > 0 && rng) {
    raw += gaussianNoise(rng, noiseStdDev);
  } else if (noiseStdDev > 0) {
    raw += gaussianNoise(Math.random, noiseStdDev);
  }

  // Clamp
  return Math.max(min, Math.min(max, raw));
}

// ---------------------------------------------------------------------------
// Sensor presets
// ---------------------------------------------------------------------------

export const SENSOR_PRESETS: SensorPreset[] = [
  {
    name: 'DHT22',
    description: 'Temperature & humidity sensor (digital)',
    channels: [
      {
        name: 'temperature',
        unit: '°C',
        waveform: { ...DEFAULT_WAVEFORM, offset: 22, amplitude: 3, frequency: 0.01, noiseStdDev: 0.2, min: -40, max: 80 },
        enabled: true,
      },
      {
        name: 'humidity',
        unit: '%',
        waveform: { ...DEFAULT_WAVEFORM, offset: 55, amplitude: 15, frequency: 0.005, noiseStdDev: 1, min: 0, max: 100 },
        enabled: true,
      },
    ],
  },
  {
    name: 'LDR',
    description: 'Light-dependent resistor (analog)',
    channels: [
      {
        name: 'light',
        unit: 'lux',
        waveform: { ...DEFAULT_WAVEFORM, offset: 512, amplitude: 400, frequency: 0.001, noiseStdDev: 10, min: 0, max: 1023 },
        enabled: true,
      },
    ],
  },
  {
    name: 'HC-SR04',
    description: 'Ultrasonic distance sensor',
    channels: [
      {
        name: 'distance',
        unit: 'cm',
        waveform: { ...DEFAULT_WAVEFORM, offset: 50, amplitude: 30, frequency: 0.1, noiseStdDev: 0.5, min: 2, max: 400 },
        enabled: true,
      },
    ],
  },
  {
    name: 'MPU6050',
    description: '6-axis accelerometer + gyroscope',
    channels: [
      {
        name: 'accelX',
        unit: 'g',
        waveform: { ...DEFAULT_WAVEFORM, offset: 0, amplitude: 0.1, frequency: 2, noiseStdDev: 0.02 },
        enabled: true,
      },
      {
        name: 'accelY',
        unit: 'g',
        waveform: { ...DEFAULT_WAVEFORM, offset: 0, amplitude: 0.1, frequency: 1.5, phase: Math.PI / 4, noiseStdDev: 0.02 },
        enabled: true,
      },
      {
        name: 'accelZ',
        unit: 'g',
        waveform: { ...DEFAULT_WAVEFORM, offset: 1, amplitude: 0.05, frequency: 0.5, noiseStdDev: 0.01 },
        enabled: true,
      },
    ],
  },
  {
    name: 'BMP280',
    description: 'Barometric pressure + temperature',
    channels: [
      {
        name: 'pressure',
        unit: 'hPa',
        waveform: { ...DEFAULT_WAVEFORM, offset: 1013.25, amplitude: 5, frequency: 0.001, noiseStdDev: 0.3, min: 300, max: 1100 },
        enabled: true,
      },
      {
        name: 'altitude',
        unit: 'm',
        waveform: { ...DEFAULT_WAVEFORM, offset: 100, amplitude: 2, frequency: 0.001, noiseStdDev: 0.1, min: -500, max: 9000 },
        enabled: true,
      },
    ],
  },
  {
    name: 'Potentiometer',
    description: 'Analog potentiometer (0–1023)',
    channels: [
      {
        name: 'potValue',
        unit: 'raw',
        waveform: { ...DEFAULT_WAVEFORM, type: 'triangle', offset: 512, amplitude: 512, frequency: 0.2, min: 0, max: 1023 },
        enabled: true,
      },
    ],
  },
  {
    name: 'IR-Remote',
    description: 'Infrared remote receiver',
    channels: [
      {
        name: 'irCode',
        unit: 'code',
        waveform: { ...DEFAULT_WAVEFORM, type: 'step', offset: 0, stepInterval: 2, stepSize: 1, min: 0, max: 255 },
        enabled: true,
      },
    ],
  },
  {
    name: 'Thermistor',
    description: 'NTC thermistor (analog temperature)',
    channels: [
      {
        name: 'thermTemp',
        unit: '°C',
        waveform: { ...DEFAULT_WAVEFORM, offset: 25, amplitude: 10, frequency: 0.005, noiseStdDev: 0.5, min: -20, max: 125 },
        enabled: true,
      },
    ],
  },
  {
    name: 'Current-Sensor',
    description: 'ACS712 current sensor',
    channels: [
      {
        name: 'current',
        unit: 'A',
        waveform: { ...DEFAULT_WAVEFORM, offset: 0.5, amplitude: 2, frequency: 50, noiseStdDev: 0.05, min: -5, max: 5 },
        enabled: true,
      },
    ],
  },
  {
    name: 'Encoder',
    description: 'Rotary encoder (position + velocity)',
    channels: [
      {
        name: 'position',
        unit: 'ticks',
        waveform: { ...DEFAULT_WAVEFORM, type: 'ramp', offset: 0, amplitude: 100, frequency: 1 },
        enabled: true,
      },
      {
        name: 'velocity',
        unit: 'ticks/s',
        waveform: { ...DEFAULT_WAVEFORM, offset: 100, amplitude: 20, frequency: 0.5, noiseStdDev: 5 },
        enabled: true,
      },
    ],
  },
  {
    name: 'Soil-Moisture',
    description: 'Capacitive soil moisture sensor',
    channels: [
      {
        name: 'moisture',
        unit: '%',
        waveform: { ...DEFAULT_WAVEFORM, offset: 45, amplitude: 20, frequency: 0.0001, noiseStdDev: 2, min: 0, max: 100 },
        enabled: true,
      },
    ],
  },
  {
    name: 'Load-Cell',
    description: 'HX711 load cell amplifier',
    channels: [
      {
        name: 'weight',
        unit: 'g',
        waveform: { ...DEFAULT_WAVEFORM, offset: 500, amplitude: 100, frequency: 0.05, noiseStdDev: 1, min: 0, max: 5000 },
        enabled: true,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

export function formatSamples(samples: GeneratedSample[], format: OutputFormat): string {
  if (samples.length === 0) {
    return '';
  }

  switch (format) {
    case 'csv':
      return samples.map((s) => s.value.toFixed(2)).join(',');

    case 'json': {
      const obj: Record<string, number> = {};
      for (const s of samples) {
        obj[s.name] = parseFloat(s.value.toFixed(2));
      }
      return JSON.stringify(obj);
    }

    case 'name_value':
      return samples.map((s) => `${s.name}=${s.value.toFixed(2)}`).join(' ');

    default:
      return samples.map((s) => `${s.name}=${s.value.toFixed(2)}`).join(' ');
  }
}

// ---------------------------------------------------------------------------
// HilLiteManager (singleton + subscribe)
// ---------------------------------------------------------------------------

export class HilLiteManager {
  private listeners: Set<Listener> = new Set();
  private channels: SensorChannel[] = [];
  private running = false;
  private sampleRate = 10; // Hz
  private outputFormat: OutputFormat = 'name_value';
  private totalSamples = 0;
  private startTime = 0;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private rng: () => number;
  private sampleCallback: ((line: string, samples: GeneratedSample[]) => void) | null = null;

  constructor(seed?: number) {
    this.rng = mulberry32(seed ?? 42);
  }

  // ── Subscribe ──────────────────────────────────────────────────────

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  // ── Channel management ─────────────────────────────────────────────

  addChannel(channel: SensorChannel): void {
    const existing = this.channels.findIndex((c) => c.name === channel.name);
    if (existing >= 0) {
      this.channels[existing] = channel;
    } else {
      this.channels.push(channel);
    }
    this.notify();
  }

  removeChannel(name: string): boolean {
    const idx = this.channels.findIndex((c) => c.name === name);
    if (idx < 0) {
      return false;
    }
    this.channels.splice(idx, 1);
    this.notify();
    return true;
  }

  getChannels(): SensorChannel[] {
    return [...this.channels];
  }

  enableChannel(name: string, enabled: boolean): boolean {
    const ch = this.channels.find((c) => c.name === name);
    if (!ch) {
      return false;
    }
    ch.enabled = enabled;
    this.notify();
    return true;
  }

  loadPreset(presetName: string): boolean {
    const preset = SENSOR_PRESETS.find((p) => p.name === presetName);
    if (!preset) {
      return false;
    }
    for (const ch of preset.channels) {
      this.addChannel({ ...ch, waveform: { ...ch.waveform } });
    }
    this.notify();
    return true;
  }

  clearChannels(): void {
    this.channels = [];
    this.notify();
  }

  // ── Configuration ──────────────────────────────────────────────────

  setSampleRate(hz: number): void {
    this.sampleRate = Math.max(0.1, Math.min(1000, hz));
    // Restart timer if running
    if (this.running) {
      this.stopTimer();
      this.startTimer();
    }
    this.notify();
  }

  getSampleRate(): number {
    return this.sampleRate;
  }

  setOutputFormat(format: OutputFormat): void {
    this.outputFormat = format;
    this.notify();
  }

  getOutputFormat(): OutputFormat {
    return this.outputFormat;
  }

  onSample(callback: ((line: string, samples: GeneratedSample[]) => void) | null): void {
    this.sampleCallback = callback;
  }

  // ── Generation ─────────────────────────────────────────────────────

  /**
   * Generate one batch of samples for all enabled channels at a given time.
   */
  generateBatch(timeSeconds: number, timestamp?: number): GeneratedSample[] {
    const ts = timestamp ?? Date.now();
    const samples: GeneratedSample[] = [];

    for (const ch of this.channels) {
      if (!ch.enabled) {
        continue;
      }
      const value = generateWaveformSample(ch.waveform, timeSeconds, this.rng);
      samples.push({ name: ch.name, value, timestamp: ts });
    }

    this.totalSamples += samples.length;
    return samples;
  }

  /**
   * Generate multiple batches over a time range.
   */
  generateSeries(
    startTime: number,
    durationSeconds: number,
    sampleRate?: number,
  ): GeneratedSample[][] {
    const rate = sampleRate ?? this.sampleRate;
    const count = Math.ceil(durationSeconds * rate);
    const dt = 1 / rate;
    const result: GeneratedSample[][] = [];

    for (let i = 0; i < count; i++) {
      const t = startTime + i * dt;
      result.push(this.generateBatch(t));
    }

    return result;
  }

  /**
   * Format a batch of samples as a serial output line.
   */
  formatBatch(samples: GeneratedSample[], format?: OutputFormat): string {
    return formatSamples(samples, format ?? this.outputFormat);
  }

  // ── Playback control ───────────────────────────────────────────────

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.startTime = Date.now();
    this.startTimer();
    this.notify();
  }

  stop(): void {
    if (!this.running) {
      return;
    }
    this.running = false;
    this.stopTimer();
    this.notify();
  }

  isRunning(): boolean {
    return this.running;
  }

  getTotalSamples(): number {
    return this.totalSamples;
  }

  private startTimer(): void {
    const intervalMs = 1000 / this.sampleRate;
    this.timerId = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000;
      const samples = this.generateBatch(elapsed);
      if (samples.length > 0 && this.sampleCallback) {
        const line = this.formatBatch(samples);
        this.sampleCallback(line, samples);
      }
      this.notify();
    }, intervalMs);
  }

  private stopTimer(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  // ── Snapshot ────────────────────────────────────────────────────────

  getSnapshot(): HilSnapshot {
    return {
      channels: [...this.channels],
      running: this.running,
      sampleRate: this.sampleRate,
      totalSamples: this.totalSamples,
      outputFormat: this.outputFormat,
    };
  }

  // ── Reset ──────────────────────────────────────────────────────────

  reset(): void {
    this.stop();
    this.channels = [];
    this.totalSamples = 0;
    this.sampleCallback = null;
    this.rng = mulberry32(42);
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: HilLiteManager | null = null;

export function getHilLiteManager(seed?: number): HilLiteManager {
  if (!instance) {
    instance = new HilLiteManager(seed);
  }
  return instance;
}

/** Reset singleton (for testing). */
export function resetHilLiteManager(): void {
  if (instance) {
    instance.reset();
  }
  instance = null;
}
