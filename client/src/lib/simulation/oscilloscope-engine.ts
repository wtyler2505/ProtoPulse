/**
 * OscilloscopeEngine — virtual oscilloscope instrument for live simulation
 * waveform display (BL-0624).
 *
 * Features:
 *   - Circular waveform buffer with configurable depth
 *   - Adjustable timebase (1us to 1s/div) and voltage scale
 *   - Rising/falling edge trigger with configurable level
 *   - Up to 4 channels with independent probe connections
 *   - Cursor measurements (voltage, time, delta)
 *   - Auto-scale voltage to fit waveform
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TriggerEdge = 'rising' | 'falling';

export type TimebaseValue =
  | '1us' | '2us' | '5us' | '10us' | '20us' | '50us'
  | '100us' | '200us' | '500us'
  | '1ms' | '2ms' | '5ms' | '10ms' | '20ms' | '50ms'
  | '100ms' | '200ms' | '500ms'
  | '1s';

export interface OscilloscopeChannel {
  /** Channel index (0-3). */
  index: number;
  /** Whether this channel is enabled. */
  enabled: boolean;
  /** Net/node ID the probe is connected to, or null if disconnected. */
  probeNodeId: string | null;
  /** Display color (CSS color string). */
  color: string;
  /** Voltage per division. */
  voltsPerDiv: number;
  /** Vertical offset in volts. */
  offset: number;
  /** Waveform sample buffer (circular). */
  samples: Float64Array;
  /** Write index into the circular buffer. */
  writeIndex: number;
  /** Number of valid samples in the buffer (up to capacity). */
  sampleCount: number;
}

export interface TriggerConfig {
  /** Which channel to trigger on (index). */
  channelIndex: number;
  /** Trigger edge type. */
  edge: TriggerEdge;
  /** Trigger voltage level. */
  level: number;
  /** Whether trigger is enabled. */
  enabled: boolean;
}

export interface CursorPosition {
  /** Time offset in seconds from trigger point. */
  time: number;
  /** Voltage reading at cursor for each enabled channel. */
  voltages: Record<number, number>;
}

export interface OscilloscopeState {
  channels: OscilloscopeChannel[];
  trigger: TriggerConfig;
  timebase: TimebaseValue;
  /** Whether the oscilloscope is running (capturing). */
  running: boolean;
  /** Cursor A position (null if not placed). */
  cursorA: CursorPosition | null;
  /** Cursor B position (null if not placed). */
  cursorB: CursorPosition | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default buffer capacity per channel (10000 samples). */
const DEFAULT_BUFFER_CAPACITY = 10000;

/** Number of horizontal divisions on the scope screen. */
export const HORIZONTAL_DIVS = 10;

/** Number of vertical divisions on the scope screen. */
export const VERTICAL_DIVS = 8;

const CHANNEL_COLORS = ['#00F0FF', '#22c55e', '#eab308', '#ef4444'];

const DEFAULT_VOLTS_PER_DIV = [1, 1, 1, 1];

/** Map timebase string to seconds per division. */
export const TIMEBASE_TO_SECONDS: Record<TimebaseValue, number> = {
  '1us': 1e-6,
  '2us': 2e-6,
  '5us': 5e-6,
  '10us': 10e-6,
  '20us': 20e-6,
  '50us': 50e-6,
  '100us': 100e-6,
  '200us': 200e-6,
  '500us': 500e-6,
  '1ms': 1e-3,
  '2ms': 2e-3,
  '5ms': 5e-3,
  '10ms': 10e-3,
  '20ms': 20e-3,
  '50ms': 50e-3,
  '100ms': 100e-3,
  '200ms': 200e-3,
  '500ms': 500e-3,
  '1s': 1,
};

/** Ordered timebase values for stepping up/down. */
export const TIMEBASE_VALUES: TimebaseValue[] = [
  '1us', '2us', '5us', '10us', '20us', '50us',
  '100us', '200us', '500us',
  '1ms', '2ms', '5ms', '10ms', '20ms', '50ms',
  '100ms', '200ms', '500ms',
  '1s',
];

/** Standard volts/div values for stepping. */
export const VOLTS_PER_DIV_VALUES = [
  0.001, 0.002, 0.005, 0.01, 0.02, 0.05,
  0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100,
];

// ---------------------------------------------------------------------------
// OscilloscopeEngine
// ---------------------------------------------------------------------------

type Listener = () => void;

export class OscilloscopeEngine {
  private state: OscilloscopeState;
  private bufferCapacity: number;
  private listeners = new Set<Listener>();
  /** Timestamp of the most recent sample (for timebase alignment). */
  private lastSampleTime = 0;
  /** Sample rate in Hz (inferred from push intervals). */
  private sampleRate = 1000;

  constructor(capacity: number = DEFAULT_BUFFER_CAPACITY) {
    this.bufferCapacity = capacity;
    this.state = {
      channels: Array.from({ length: 4 }, (_, i) => this.createChannel(i)),
      trigger: {
        channelIndex: 0,
        edge: 'rising',
        level: 0,
        enabled: true,
      },
      timebase: '1ms',
      running: true,
      cursorA: null,
      cursorB: null,
    };
  }

  private createChannel(index: number): OscilloscopeChannel {
    return {
      index,
      enabled: index === 0,
      probeNodeId: null,
      color: CHANNEL_COLORS[index] ?? '#ffffff',
      voltsPerDiv: DEFAULT_VOLTS_PER_DIV[index] ?? 1,
      offset: 0,
      samples: new Float64Array(this.bufferCapacity),
      writeIndex: 0,
      sampleCount: 0,
    };
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

  getState(): Readonly<OscilloscopeState> {
    return this.state;
  }

  getChannel(index: number): Readonly<OscilloscopeChannel> | undefined {
    return this.state.channels[index];
  }

  getBufferCapacity(): number {
    return this.bufferCapacity;
  }

  getSampleRate(): number {
    return this.sampleRate;
  }

  // -------------------------------------------------------------------------
  // Sample ingestion
  // -------------------------------------------------------------------------

  /**
   * Push voltage samples for all channels at a given timestamp.
   * `voltages` is keyed by channel index.
   */
  pushSamples(timestamp: number, voltages: Record<number, number>): void {
    if (!this.state.running) { return; }

    // Infer sample rate from timestamp deltas
    if (this.lastSampleTime > 0 && timestamp > this.lastSampleTime) {
      const dt = timestamp - this.lastSampleTime;
      if (dt > 0) {
        this.sampleRate = 1 / dt;
      }
    }
    this.lastSampleTime = timestamp;

    this.state.channels.forEach((ch) => {
      if (!ch.enabled || ch.probeNodeId === null) { return; }
      const v = voltages[ch.index];
      if (v === undefined) { return; }

      ch.samples[ch.writeIndex] = v;
      ch.writeIndex = (ch.writeIndex + 1) % this.bufferCapacity;
      if (ch.sampleCount < this.bufferCapacity) {
        ch.sampleCount++;
      }
    });

    this.notify();
  }

  // -------------------------------------------------------------------------
  // Channel control
  // -------------------------------------------------------------------------

  setChannelEnabled(index: number, enabled: boolean): void {
    const ch = this.state.channels[index];
    if (!ch) { return; }
    ch.enabled = enabled;
    this.notify();
  }

  setProbeConnection(channelIndex: number, nodeId: string | null): void {
    const ch = this.state.channels[channelIndex];
    if (!ch) { return; }
    ch.probeNodeId = nodeId;
    // Clear buffer on probe change
    ch.samples = new Float64Array(this.bufferCapacity);
    ch.writeIndex = 0;
    ch.sampleCount = 0;
    this.notify();
  }

  setVoltsPerDiv(channelIndex: number, voltsPerDiv: number): void {
    const ch = this.state.channels[channelIndex];
    if (!ch) { return; }
    ch.voltsPerDiv = Math.max(0.001, voltsPerDiv);
    this.notify();
  }

  setOffset(channelIndex: number, offset: number): void {
    const ch = this.state.channels[channelIndex];
    if (!ch) { return; }
    ch.offset = offset;
    this.notify();
  }

  // -------------------------------------------------------------------------
  // Timebase control
  // -------------------------------------------------------------------------

  setTimebase(timebase: TimebaseValue): void {
    this.state.timebase = timebase;
    this.notify();
  }

  /** Step timebase one notch faster (fewer seconds/div). */
  timebaseFaster(): void {
    const idx = TIMEBASE_VALUES.indexOf(this.state.timebase);
    if (idx > 0) {
      this.state.timebase = TIMEBASE_VALUES[idx - 1] as TimebaseValue;
      this.notify();
    }
  }

  /** Step timebase one notch slower (more seconds/div). */
  timebaseSlower(): void {
    const idx = TIMEBASE_VALUES.indexOf(this.state.timebase);
    if (idx < TIMEBASE_VALUES.length - 1) {
      this.state.timebase = TIMEBASE_VALUES[idx + 1] as TimebaseValue;
      this.notify();
    }
  }

  // -------------------------------------------------------------------------
  // Trigger
  // -------------------------------------------------------------------------

  setTrigger(config: Partial<TriggerConfig>): void {
    this.state.trigger = { ...this.state.trigger, ...config };
    this.notify();
  }

  /**
   * Find the trigger point index in the given channel's buffer.
   * Returns the buffer index where the trigger condition is met,
   * or -1 if no trigger found.
   */
  findTriggerIndex(channelIndex: number): number {
    const ch = this.state.channels[channelIndex];
    if (!ch || ch.sampleCount < 2) { return -1; }
    if (!this.state.trigger.enabled) { return 0; }

    const { edge, level } = this.state.trigger;
    const count = ch.sampleCount;
    const cap = this.bufferCapacity;

    // Search backwards from the most recent sample for the latest trigger point
    const startIdx = (ch.writeIndex - 1 + cap) % cap;

    for (let i = 1; i < count; i++) {
      const curIdx = (startIdx - i + cap) % cap;
      const prevIdx = (curIdx - 1 + cap) % cap;

      if (i >= count) { break; }

      const prev = ch.samples[prevIdx] ?? 0;
      const cur = ch.samples[curIdx] ?? 0;

      if (edge === 'rising' && prev < level && cur >= level) {
        return curIdx;
      }
      if (edge === 'falling' && prev > level && cur <= level) {
        return curIdx;
      }
    }

    return -1;
  }

  // -------------------------------------------------------------------------
  // Waveform extraction for rendering
  // -------------------------------------------------------------------------

  /**
   * Extract display-ready waveform data for a channel. Returns an array of
   * {time, voltage} points spanning the current timebase window.
   */
  getDisplaySamples(channelIndex: number): Array<{ time: number; voltage: number }> {
    const ch = this.state.channels[channelIndex];
    if (!ch || ch.sampleCount === 0) { return []; }

    const timePerDiv = TIMEBASE_TO_SECONDS[this.state.timebase] ?? 0.001;
    const totalTime = timePerDiv * HORIZONTAL_DIVS;
    const totalSamplesNeeded = Math.min(
      Math.ceil(totalTime * this.sampleRate),
      ch.sampleCount,
    );

    if (totalSamplesNeeded === 0) { return []; }

    const result: Array<{ time: number; voltage: number }> = [];
    const cap = this.bufferCapacity;

    // Try to align to trigger
    let startIdx: number;
    if (this.state.trigger.enabled && this.state.trigger.channelIndex === channelIndex) {
      const trigIdx = this.findTriggerIndex(channelIndex);
      if (trigIdx >= 0) {
        // Center trigger at ~20% from left (standard oscilloscope behavior)
        const preTriggSamples = Math.floor(totalSamplesNeeded * 0.2);
        startIdx = (trigIdx - preTriggSamples + cap) % cap;
      } else {
        // No trigger found — show most recent samples
        startIdx = (ch.writeIndex - totalSamplesNeeded + cap) % cap;
      }
    } else {
      startIdx = (ch.writeIndex - totalSamplesNeeded + cap) % cap;
    }

    const dt = totalTime / totalSamplesNeeded;

    for (let i = 0; i < totalSamplesNeeded; i++) {
      const bufIdx = (startIdx + i) % cap;
      result.push({
        time: i * dt,
        voltage: ch.samples[bufIdx] ?? 0,
      });
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Auto-scale
  // -------------------------------------------------------------------------

  /**
   * Auto-scale voltage per division for a channel to fit the current waveform.
   * Picks the smallest standard V/div that fits the signal peak-to-peak within
   * the vertical divisions.
   */
  autoScaleVoltage(channelIndex: number): void {
    const ch = this.state.channels[channelIndex];
    if (!ch || ch.sampleCount === 0) { return; }

    let min = Infinity;
    let max = -Infinity;
    const count = ch.sampleCount;
    const cap = this.bufferCapacity;
    const start = (ch.writeIndex - count + cap) % cap;

    for (let i = 0; i < count; i++) {
      const v = ch.samples[(start + i) % cap] ?? 0;
      if (v < min) { min = v; }
      if (v > max) { max = v; }
    }

    const range = max - min;
    if (range === 0) {
      ch.voltsPerDiv = 1;
      ch.offset = -min;
      this.notify();
      return;
    }

    // Find smallest V/div that fits
    const targetVPerDiv = range / (VERTICAL_DIVS - 2); // leave margin
    let bestVPerDiv = VOLTS_PER_DIV_VALUES[VOLTS_PER_DIV_VALUES.length - 1] ?? 100;
    for (const vd of VOLTS_PER_DIV_VALUES) {
      if (vd >= targetVPerDiv) {
        bestVPerDiv = vd;
        break;
      }
    }

    ch.voltsPerDiv = bestVPerDiv;
    // Center the waveform vertically
    const mid = (max + min) / 2;
    ch.offset = -mid;

    this.notify();
  }

  // -------------------------------------------------------------------------
  // Cursor measurements
  // -------------------------------------------------------------------------

  setCursor(cursor: 'A' | 'B', time: number): void {
    const voltages: Record<number, number> = {};

    this.state.channels.forEach((ch) => {
      if (!ch.enabled || ch.sampleCount === 0) { return; }

      const timePerDiv = TIMEBASE_TO_SECONDS[this.state.timebase] ?? 0.001;
      const totalTime = timePerDiv * HORIZONTAL_DIVS;
      const sampleIndex = Math.round((time / totalTime) * ch.sampleCount);
      const cap = this.bufferCapacity;
      const readStart = (ch.writeIndex - ch.sampleCount + cap) % cap;
      const idx = (readStart + Math.max(0, Math.min(sampleIndex, ch.sampleCount - 1))) % cap;
      voltages[ch.index] = ch.samples[idx] ?? 0;
    });

    const pos: CursorPosition = { time, voltages };

    if (cursor === 'A') {
      this.state.cursorA = pos;
    } else {
      this.state.cursorB = pos;
    }

    this.notify();
  }

  clearCursors(): void {
    this.state.cursorA = null;
    this.state.cursorB = null;
    this.notify();
  }

  /**
   * Get measurement between cursors A and B.
   */
  getCursorMeasurement(): { deltaTime: number; deltaVoltages: Record<number, number> } | null {
    if (!this.state.cursorA || !this.state.cursorB) { return null; }

    const deltaTime = this.state.cursorB.time - this.state.cursorA.time;
    const deltaVoltages: Record<number, number> = {};

    this.state.channels.forEach((ch) => {
      if (!ch.enabled) { return; }
      const vA = this.state.cursorA?.voltages[ch.index] ?? 0;
      const vB = this.state.cursorB?.voltages[ch.index] ?? 0;
      deltaVoltages[ch.index] = vB - vA;
    });

    return { deltaTime, deltaVoltages };
  }

  // -------------------------------------------------------------------------
  // Run control
  // -------------------------------------------------------------------------

  setRunning(running: boolean): void {
    this.state.running = running;
    this.notify();
  }

  /** Clear all channel buffers. */
  clearBuffers(): void {
    this.state.channels.forEach((ch) => {
      ch.samples = new Float64Array(this.bufferCapacity);
      ch.writeIndex = 0;
      ch.sampleCount = 0;
    });
    this.state.cursorA = null;
    this.state.cursorB = null;
    this.notify();
  }
}
