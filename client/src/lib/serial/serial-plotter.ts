/**
 * SerialPlotterManager — Manages live serial data plotting for sensor curves.
 *
 * Parses comma/tab/space-separated numeric values from serial lines,
 * stores data in per-channel ring buffers, and provides time-windowed
 * access for SVG chart rendering.
 *
 * Auto-color palette (6 colors visible on dark backgrounds):
 *   Channel 0: #00F0FF (cyan)    Channel 1: #FF6B6B (red)
 *   Channel 2: #4ECB71 (green)   Channel 3: #FFD93D (yellow)
 *   Channel 4: #6C5CE7 (purple)  Channel 5: #FF8A5C (orange)
 *
 * Singleton + subscribe pattern for useSyncExternalStore integration.
 * Pure module — no React/DOM dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DataPoint {
  timestamp: number;
  value: number;
}

export interface ChannelInfo {
  index: number;
  name: string;
  color: string;
  visible: boolean;
  data: DataPoint[];
}

export interface YRange {
  min: number;
  max: number;
}

export interface TimeRange {
  start: number;
  end: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default channel colors — 6 distinct colors for dark backgrounds. */
export const DEFAULT_CHANNEL_COLORS: readonly string[] = [
  '#00F0FF', // cyan
  '#FF6B6B', // red
  '#4ECB71', // green
  '#FFD93D', // yellow
  '#6C5CE7', // purple
  '#FF8A5C', // orange

];

/** Maximum data points per channel ring buffer. */
export const MAX_BUFFER_SIZE = 10000;

/** Default rolling time window in seconds. */
export const DEFAULT_TIME_WINDOW_SECONDS = 10;

/** Default maximum number of channels. */
export const DEFAULT_MAX_CHANNELS = 6;

/** Minimum allowed time window in seconds. */
export const MIN_TIME_WINDOW_SECONDS = 1;

/** Maximum allowed time window in seconds. */
export const MAX_TIME_WINDOW_SECONDS = 60;

/** Y-range padding factor (10% on each side). */
const Y_PADDING_FACTOR = 0.1;

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Ring buffer
// ---------------------------------------------------------------------------

class RingBuffer {
  private buffer: DataPoint[];
  private head = 0;
  private count = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array<DataPoint>(capacity);
  }

  push(point: DataPoint): void {
    this.buffer[this.head] = point;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  getAll(): DataPoint[] {
    if (this.count === 0) {
      return [];
    }
    const result: DataPoint[] = [];
    const start = this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.capacity;
      result.push(this.buffer[idx]);
    }
    return result;
  }

  getInTimeRange(startTime: number, endTime: number): DataPoint[] {
    const all = this.getAll();
    return all.filter((p) => p.timestamp >= startTime && p.timestamp <= endTime);
  }

  size(): number {
    return this.count;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
    this.buffer = new Array<DataPoint>(this.capacity);
  }

  latest(): DataPoint | null {
    if (this.count === 0) {
      return null;
    }
    const idx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[idx];
  }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a line of serial output into numeric values.
 *
 * Supports comma, tab, and space separators. Handles negative numbers
 * and scientific notation (e.g., "1.23e-4"). Returns null if the line
 * contains no valid numeric tokens.
 */
export function parseLine(line: string): number[] | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // Split by comma, tab, or whitespace
  const tokens = trimmed.split(/[,\t]+|\s+/);
  const values: number[] = [];
  let hasNumeric = false;

  for (const token of tokens) {
    if (token.length === 0) {
      continue;
    }
    const num = Number(token);
    if (!Number.isNaN(num) && token !== '') {
      values.push(num);
      hasNumeric = true;
    } else {
      // Non-numeric token — push NaN so column count is preserved
      values.push(NaN);
    }
  }

  if (!hasNumeric) {
    return null;
  }

  return values;
}

// ---------------------------------------------------------------------------
// SerialPlotterManager
// ---------------------------------------------------------------------------

export class SerialPlotterManager {
  private channels: Map<number, RingBuffer> = new Map();
  private channelNames: Map<number, string> = new Map();
  private channelColors: Map<number, string> = new Map();
  private channelVisibility: Map<number, boolean> = new Map();
  private timeWindowSeconds = DEFAULT_TIME_WINDOW_SECONDS;
  private maxChannels = DEFAULT_MAX_CHANNELS;
  private paused = false;
  private listeners = new Set<Listener>();
  private lastTimestamp = 0;

  private constructor() {}

  /** Factory — creates a fresh instance (testing-friendly, no global singleton). */
  static create(): SerialPlotterManager {
    return new SerialPlotterManager();
  }

  // -----------------------------------------------------------------------
  // Subscription (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    Array.from(this.listeners).forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Data ingestion
  // -----------------------------------------------------------------------

  /**
   * Add a set of parsed numeric values as a data point.
   *
   * Each value maps to a channel by index. Values beyond maxChannels
   * are ignored. If paused, data is silently discarded.
   */
  addDataPoint(values: number[], timestamp?: number): void {
    if (this.paused) {
      return;
    }

    const ts = timestamp ?? Date.now();
    this.lastTimestamp = ts;

    const count = Math.min(values.length, this.maxChannels);
    for (let i = 0; i < count; i++) {
      if (!this.channels.has(i)) {
        this.channels.set(i, new RingBuffer(MAX_BUFFER_SIZE));
        this.channelNames.set(i, `Channel ${String(i + 1)}`);
        this.channelColors.set(i, DEFAULT_CHANNEL_COLORS[i % DEFAULT_CHANNEL_COLORS.length]);
        this.channelVisibility.set(i, true);
      }

      const buffer = this.channels.get(i);
      if (buffer) {
        buffer.push({ timestamp: ts, value: values[i] });
      }
    }

    this.notify();
  }

  // -----------------------------------------------------------------------
  // Channel queries
  // -----------------------------------------------------------------------

  /** Get data points for a specific channel. */
  getChannelData(channelIndex: number): DataPoint[] {
    const buffer = this.channels.get(channelIndex);
    if (!buffer) {
      return [];
    }
    return buffer.getAll();
  }

  /** Get data points for a channel within the current visible time window. */
  getChannelDataInWindow(channelIndex: number): DataPoint[] {
    const buffer = this.channels.get(channelIndex);
    if (!buffer) {
      return [];
    }
    const range = this.getVisibleTimeRange();
    return buffer.getInTimeRange(range.start, range.end);
  }

  /** Get info for all active channels. */
  getAllChannels(): ChannelInfo[] {
    const result: ChannelInfo[] = [];
    const range = this.getVisibleTimeRange();

    for (const [index, buffer] of Array.from(this.channels.entries())) {
      result.push({
        index,
        name: this.channelNames.get(index) ?? `Channel ${String(index + 1)}`,
        color: this.channelColors.get(index) ?? DEFAULT_CHANNEL_COLORS[index % DEFAULT_CHANNEL_COLORS.length],
        visible: this.channelVisibility.get(index) ?? true,
        data: buffer.getInTimeRange(range.start, range.end),
      });
    }

    return result;
  }

  /** Get the number of active channels. */
  getChannelCount(): number {
    return this.channels.size;
  }

  /** Get the latest value for a specific channel (for legend display). */
  getLatestValue(channelIndex: number): number | null {
    const buffer = this.channels.get(channelIndex);
    if (!buffer) {
      return null;
    }
    const latest = buffer.latest();
    return latest ? latest.value : null;
  }

  // -----------------------------------------------------------------------
  // Channel configuration
  // -----------------------------------------------------------------------

  setChannelName(index: number, name: string): void {
    this.channelNames.set(index, name);
    this.notify();
  }

  getChannelName(index: number): string {
    return this.channelNames.get(index) ?? `Channel ${String(index + 1)}`;
  }

  setChannelColor(index: number, color: string): void {
    this.channelColors.set(index, color);
    this.notify();
  }

  getChannelColor(index: number): string {
    return this.channelColors.get(index) ?? DEFAULT_CHANNEL_COLORS[index % DEFAULT_CHANNEL_COLORS.length];
  }

  setChannelVisible(index: number, visible: boolean): void {
    this.channelVisibility.set(index, visible);
    this.notify();
  }

  isChannelVisible(index: number): boolean {
    return this.channelVisibility.get(index) ?? true;
  }

  // -----------------------------------------------------------------------
  // Time window
  // -----------------------------------------------------------------------

  setTimeWindow(seconds: number): void {
    this.timeWindowSeconds = Math.max(
      MIN_TIME_WINDOW_SECONDS,
      Math.min(MAX_TIME_WINDOW_SECONDS, seconds),
    );
    this.notify();
  }

  getTimeWindow(): number {
    return this.timeWindowSeconds;
  }

  /** Get the visible time range based on the latest timestamp and window size. */
  getVisibleTimeRange(): TimeRange {
    const now = this.lastTimestamp || Date.now();
    return {
      start: now - this.timeWindowSeconds * 1000,
      end: now,
    };
  }

  // -----------------------------------------------------------------------
  // Max channels
  // -----------------------------------------------------------------------

  setMaxChannels(n: number): void {
    this.maxChannels = Math.max(1, Math.min(n, DEFAULT_CHANNEL_COLORS.length));
    this.notify();
  }

  getMaxChannels(): number {
    return this.maxChannels;
  }

  // -----------------------------------------------------------------------
  // Pause / Resume
  // -----------------------------------------------------------------------

  pause(): void {
    this.paused = true;
    this.notify();
  }

  resume(): void {
    this.paused = false;
    this.notify();
  }

  isPaused(): boolean {
    return this.paused;
  }

  // -----------------------------------------------------------------------
  // Clear
  // -----------------------------------------------------------------------

  clear(): void {
    this.channels.clear();
    this.channelNames.clear();
    this.channelColors.clear();
    this.channelVisibility.clear();
    this.lastTimestamp = 0;
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Y-range computation
  // -----------------------------------------------------------------------

  /**
   * Compute the Y-axis range across all visible channels with 10% padding.
   * Returns null if no data is available.
   */
  getYRange(): YRange | null {
    let globalMin = Infinity;
    let globalMax = -Infinity;
    let hasData = false;

    const range = this.getVisibleTimeRange();

    for (const [index, buffer] of Array.from(this.channels.entries())) {
      if (!(this.channelVisibility.get(index) ?? true)) {
        continue;
      }

      const data = buffer.getInTimeRange(range.start, range.end);
      for (const point of data) {
        if (Number.isFinite(point.value)) {
          if (point.value < globalMin) {
            globalMin = point.value;
          }
          if (point.value > globalMax) {
            globalMax = point.value;
          }
          hasData = true;
        }
      }
    }

    if (!hasData) {
      return null;
    }

    // If all values are the same, create a range around that value
    if (globalMin === globalMax) {
      const v = globalMin;
      if (v === 0) {
        return { min: -1, max: 1 };
      }
      const pad = Math.abs(v) * Y_PADDING_FACTOR;
      return { min: v - pad, max: v + pad };
    }

    const span = globalMax - globalMin;
    const padding = span * Y_PADDING_FACTOR;
    return {
      min: globalMin - padding,
      max: globalMax + padding,
    };
  }

  // -----------------------------------------------------------------------
  // CSV export
  // -----------------------------------------------------------------------

  /**
   * Export all channel data as a CSV string.
   *
   * Header row: "timestamp,Channel 1,Channel 2,..."
   * Each row contains timestamp and values for all channels at that time.
   * Missing values are left empty.
   */
  exportCSV(): string {
    const channelIndices = Array.from(this.channels.keys()).sort((a, b) => a - b);
    if (channelIndices.length === 0) {
      return '';
    }

    // Build header
    const headers = ['timestamp'];
    for (const idx of channelIndices) {
      headers.push(this.channelNames.get(idx) ?? `Channel ${String(idx + 1)}`);
    }

    // Collect all timestamps across all channels
    const timestampMap = new Map<number, Map<number, number>>();
    for (const idx of channelIndices) {
      const buffer = this.channels.get(idx);
      if (!buffer) {
        continue;
      }
      for (const point of buffer.getAll()) {
        if (!timestampMap.has(point.timestamp)) {
          timestampMap.set(point.timestamp, new Map());
        }
        timestampMap.get(point.timestamp)?.set(idx, point.value);
      }
    }

    // Sort by timestamp
    const timestamps = Array.from(timestampMap.keys()).sort((a, b) => a - b);

    // Build rows
    const lines = [headers.join(',')];
    for (const ts of timestamps) {
      const values = timestampMap.get(ts);
      const row = [String(ts)];
      for (const idx of channelIndices) {
        const val = values?.get(idx);
        if (val !== undefined && Number.isFinite(val)) {
          row.push(String(val));
        } else {
          row.push('');
        }
      }
      lines.push(row.join(','));
    }

    return lines.join('\n');
  }

  // -----------------------------------------------------------------------
  // Total points (for diagnostics)
  // -----------------------------------------------------------------------

  getTotalPointCount(): number {
    let total = 0;
    for (const buffer of Array.from(this.channels.values())) {
      total += buffer.size();
    }
    return total;
  }
}

// ---------------------------------------------------------------------------
// App-wide singleton
// ---------------------------------------------------------------------------

let singleton: SerialPlotterManager | null = null;

/** Get (or create) the app-wide SerialPlotterManager singleton. */
export function getSerialPlotterManager(): SerialPlotterManager {
  if (!singleton) {
    singleton = SerialPlotterManager.create();
  }
  return singleton;
}

/** Reset the singleton (for testing only). */
export function resetSerialPlotterManager(): void {
  singleton = null;
}
