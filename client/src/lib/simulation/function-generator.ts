/**
 * FunctionGenerator — virtual function generator instrument for circuit simulation
 * (BL-0626).
 *
 * Features:
 *   - 4 waveform types: SINE, SQUARE, TRIANGLE, SAWTOOTH
 *   - Configurable frequency (Hz-MHz), amplitude (mV-V), DC offset, duty cycle
 *   - getSample(time) returns instantaneous voltage at a given time
 *   - Net connection / disconnection
 *   - Auto-ranging display helpers (formatFrequency, formatAmplitude)
 *   - Singleton+subscribe pattern for state management
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Available waveform shapes. */
export type WaveformType = 'SINE' | 'SQUARE' | 'TRIANGLE' | 'SAWTOOTH';

/** Full function generator state. */
export interface FunctionGeneratorState {
  /** Active waveform shape. */
  waveform: WaveformType;
  /** Frequency in Hz. */
  frequency: number;
  /** Peak amplitude in volts. */
  amplitude: number;
  /** DC offset in volts. */
  dcOffset: number;
  /** Duty cycle for SQUARE waveform, 0-1 (default 0.5). */
  dutyCycle: number;
  /** Connected net ID, or null if disconnected. */
  connectedNet: string | null;
  /** Whether the generator is actively outputting. */
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Display formatting helpers
// ---------------------------------------------------------------------------

/** SI-prefix frequency ranges for auto-ranging display. */
const FREQUENCY_RANGES: { threshold: number; divisor: number; unit: string }[] = [
  { threshold: 1e6, divisor: 1e6, unit: 'MHz' },
  { threshold: 1e3, divisor: 1e3, unit: 'kHz' },
  { threshold: 0, divisor: 1, unit: 'Hz' },
];

/** SI-prefix amplitude ranges for auto-ranging display. */
const AMPLITUDE_RANGES: { threshold: number; divisor: number; unit: string }[] = [
  { threshold: 1, divisor: 1, unit: 'V' },
  { threshold: 1e-3, divisor: 1e-3, unit: 'mV' },
  { threshold: 0, divisor: 1e-6, unit: '\u00B5V' },
];

/**
 * Format a frequency value with appropriate SI prefix.
 * Returns `{ value: number; unit: string }`.
 */
export function formatFrequency(hz: number): { value: number; unit: string } {
  const abs = Math.abs(hz);
  for (const range of FREQUENCY_RANGES) {
    if (abs >= range.threshold) {
      return { value: hz / range.divisor, unit: range.unit };
    }
  }
  return { value: hz, unit: 'Hz' };
}

/**
 * Format an amplitude value with appropriate SI prefix.
 * Returns `{ value: number; unit: string }`.
 */
export function formatAmplitude(volts: number): { value: number; unit: string } {
  const abs = Math.abs(volts);
  for (const range of AMPLITUDE_RANGES) {
    if (abs >= range.threshold) {
      return { value: volts / range.divisor, unit: range.unit };
    }
  }
  return { value: volts / 1e-6, unit: '\u00B5V' };
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

function createDefaultState(): FunctionGeneratorState {
  return {
    waveform: 'SINE',
    frequency: 1000,
    amplitude: 1,
    dcOffset: 0,
    dutyCycle: 0.5,
    connectedNet: null,
    enabled: true,
  };
}

// ---------------------------------------------------------------------------
// FunctionGenerator class (singleton+subscribe)
// ---------------------------------------------------------------------------

type Listener = () => void;

export class FunctionGenerator {
  private state: FunctionGeneratorState;
  private listeners = new Set<Listener>();

  constructor() {
    this.state = createDefaultState();
  }

  // -------------------------------------------------------------------------
  // Subscribe
  // -------------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    Array.from(this.listeners).forEach((fn) => {
      fn();
    });
  }

  // -------------------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------------------

  getState(): Readonly<FunctionGeneratorState> {
    return this.state;
  }

  // -------------------------------------------------------------------------
  // Waveform computation
  // -------------------------------------------------------------------------

  /**
   * Return the instantaneous voltage at a given time (in seconds).
   *
   * The output is: `waveform(t) * amplitude + dcOffset`.
   *
   * When frequency is 0, the output is a constant `dcOffset`.
   */
  getSample(time: number): number {
    const { waveform, frequency, amplitude, dcOffset, dutyCycle, enabled } = this.state;

    if (!enabled) {
      return dcOffset;
    }

    if (frequency === 0) {
      return dcOffset;
    }

    const period = 1 / frequency;
    // Normalised phase in [0, 1)
    const phase = ((time % period) + period) % period / period;

    let value: number;

    switch (waveform) {
      case 'SINE':
        value = Math.sin(2 * Math.PI * phase);
        break;
      case 'SQUARE':
        value = phase < dutyCycle ? 1 : -1;
        break;
      case 'TRIANGLE': {
        // Rising from -1 to +1 over first half, falling from +1 to -1 over second half
        if (phase < 0.5) {
          value = -1 + 4 * phase;
        } else {
          value = 3 - 4 * phase;
        }
        break;
      }
      case 'SAWTOOTH':
        // Ramps from -1 to +1 linearly over one period
        value = 2 * phase - 1;
        break;
    }

    return value * amplitude + dcOffset;
  }

  // -------------------------------------------------------------------------
  // Setters
  // -------------------------------------------------------------------------

  setWaveform(waveform: WaveformType): void {
    if (this.state.waveform === waveform) {
      return;
    }
    this.state = { ...this.state, waveform };
    this.notify();
  }

  setFrequency(hz: number): void {
    const clamped = Math.max(0, hz);
    if (this.state.frequency === clamped) {
      return;
    }
    this.state = { ...this.state, frequency: clamped };
    this.notify();
  }

  setAmplitude(volts: number): void {
    const clamped = Math.max(0, volts);
    if (this.state.amplitude === clamped) {
      return;
    }
    this.state = { ...this.state, amplitude: clamped };
    this.notify();
  }

  setDcOffset(volts: number): void {
    if (this.state.dcOffset === volts) {
      return;
    }
    this.state = { ...this.state, dcOffset: volts };
    this.notify();
  }

  setDutyCycle(ratio: number): void {
    const clamped = Math.max(0, Math.min(1, ratio));
    if (this.state.dutyCycle === clamped) {
      return;
    }
    this.state = { ...this.state, dutyCycle: clamped };
    this.notify();
  }

  setEnabled(enabled: boolean): void {
    if (this.state.enabled === enabled) {
      return;
    }
    this.state = { ...this.state, enabled };
    this.notify();
  }

  // -------------------------------------------------------------------------
  // Net connection
  // -------------------------------------------------------------------------

  connect(netId: string): void {
    this.state = { ...this.state, connectedNet: netId };
    this.notify();
  }

  disconnect(): void {
    this.state = { ...this.state, connectedNet: null };
    this.notify();
  }

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  reset(): void {
    this.state = createDefaultState();
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

let _instance: FunctionGenerator | null = null;

export function getFunctionGenerator(): FunctionGenerator {
  if (!_instance) {
    _instance = new FunctionGenerator();
  }
  return _instance;
}

/** Reset the singleton (primarily for testing). */
export function resetFunctionGenerator(): void {
  _instance = null;
}
