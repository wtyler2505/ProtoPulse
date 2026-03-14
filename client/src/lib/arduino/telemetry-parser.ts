/**
 * TelemetryStore — Parses serial monitor lines into named channels of numeric
 * data and exposes a singleton+subscribe pattern for useSyncExternalStore.
 *
 * Supported serial line formats:
 *   CSV:        "1.23,4.56,7.89"         → ch0, ch1, ch2
 *   key=value:  "temp=22.5 hum=65"       → temp, hum
 *   JSON:       '{"temp":22.5,"hum":65}' → temp, hum
 *   Tab:        "1.23\t4.56\t7.89"       → ch0, ch1, ch2
 *   Labeled CSV: "temp:22.5,hum:65"      → temp, hum
 *
 * Each channel stores up to MAX_POINTS data points (default 1000).
 * Auto-detects channel names from the first parseable line.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

export interface TelemetryDataPoint {
  /** Monotonic index (0-based per channel). */
  index: number;
  /** Value at this sample. */
  value: number;
  /** Timestamp in ms (Date.now()). */
  timestamp: number;
}

export interface TelemetryChannelStats {
  current: number;
  min: number;
  max: number;
  avg: number;
  count: number;
}

export interface TelemetryChannel {
  name: string;
  data: TelemetryDataPoint[];
  stats: TelemetryChannelStats;
  color: string;
}

export interface TelemetrySnapshot {
  channels: TelemetryChannel[];
  paused: boolean;
  totalSamples: number;
}

export type ParseFormat = 'csv' | 'key_value' | 'json' | 'tab' | 'labeled_csv' | 'unknown';

export interface ParsedValues {
  format: ParseFormat;
  values: Map<string, number>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_POINTS = 1000;

/**
 * Distinct colors for up to 12 channels. Uses the project's neon cyan as
 * the first color, then a palette of easily distinguishable hues.
 */
const CHANNEL_COLORS: readonly string[] = [
  '#00F0FF', // cyan (project accent)
  '#FF6B6B', // red
  '#51CF66', // green
  '#FFD43B', // yellow
  '#CC5DE8', // purple
  '#FF922B', // orange
  '#20C997', // teal
  '#748FFC', // indigo
  '#F06595', // pink
  '#FCC419', // amber
  '#66D9E8', // light cyan
  '#C0EB75', // lime
];

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function isNumericish(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed === '') {
    return false;
  }
  return !Number.isNaN(Number(trimmed));
}

/**
 * Try to parse a serial line into named numeric values.
 * Returns null if the line cannot be parsed into any known format.
 */
export function parseLine(line: string): ParsedValues | null {
  const trimmed = line.trim();
  if (trimmed === '') {
    return null;
  }

  // 1. JSON — starts with { and parseable
  if (trimmed.startsWith('{')) {
    try {
      const obj: unknown = JSON.parse(trimmed);
      if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
        const values = new Map<string, number>();
        const entries = Object.entries(obj as Record<string, unknown>);
        for (const [key, val] of entries) {
          if (typeof val === 'number' && Number.isFinite(val)) {
            values.set(key, val);
          } else if (typeof val === 'string' && isNumericish(val)) {
            values.set(key, Number(val));
          }
        }
        if (values.size > 0) {
          return { format: 'json', values };
        }
      }
    } catch {
      // Not valid JSON, continue trying other formats
    }
  }

  // 2. key=value pairs — "temp=22.5 hum=65" or "temp=22.5, hum=65"
  const kvPairs = trimmed.split(/[,\s]+/).filter((s) => s.includes('='));
  if (kvPairs.length > 0) {
    const values = new Map<string, number>();
    for (const pair of kvPairs) {
      const eqIdx = pair.indexOf('=');
      const key = pair.slice(0, eqIdx).trim();
      const valStr = pair.slice(eqIdx + 1).trim();
      if (key && isNumericish(valStr)) {
        values.set(key, Number(valStr));
      }
    }
    if (values.size > 0 && values.size === kvPairs.length) {
      return { format: 'key_value', values };
    }
  }

  // 3. Labeled CSV — "temp:22.5,hum:65"
  const labeledParts = trimmed.split(',');
  if (labeledParts.length > 0 && labeledParts.every((p) => p.includes(':'))) {
    const values = new Map<string, number>();
    for (const part of labeledParts) {
      const colIdx = part.indexOf(':');
      const key = part.slice(0, colIdx).trim();
      const valStr = part.slice(colIdx + 1).trim();
      if (key && isNumericish(valStr)) {
        values.set(key, Number(valStr));
      }
    }
    if (values.size > 0 && values.size === labeledParts.length) {
      return { format: 'labeled_csv', values };
    }
  }

  // 4. Tab-separated numbers — "1.23\t4.56\t7.89"
  if (trimmed.includes('\t')) {
    const tabParts = trimmed.split('\t');
    if (tabParts.length > 0 && tabParts.every((p) => isNumericish(p))) {
      const values = new Map<string, number>();
      for (let i = 0; i < tabParts.length; i++) {
        values.set(`ch${String(i)}`, Number(tabParts[i].trim()));
      }
      return { format: 'tab', values };
    }
  }

  // 5. Plain CSV numbers — "1.23,4.56,7.89"
  const csvParts = trimmed.split(',');
  if (csvParts.length > 0 && csvParts.every((p) => isNumericish(p))) {
    const values = new Map<string, number>();
    for (let i = 0; i < csvParts.length; i++) {
      values.set(`ch${String(i)}`, Number(csvParts[i].trim()));
    }
    return { format: 'csv', values };
  }

  return null;
}

// ---------------------------------------------------------------------------
// TelemetryStore
// ---------------------------------------------------------------------------

export class TelemetryStore {
  private static _instance: TelemetryStore | null = null;

  private _listeners = new Set<Listener>();
  private _channels = new Map<string, { data: TelemetryDataPoint[]; nextIndex: number }>();
  private _channelOrder: string[] = [];
  private _paused = false;
  private _totalSamples = 0;
  private _snapshotCache: TelemetrySnapshot | null = null;

  private constructor() {}

  static getInstance(): TelemetryStore {
    if (!TelemetryStore._instance) {
      TelemetryStore._instance = new TelemetryStore();
    }
    return TelemetryStore._instance;
  }

  /** Factory — creates a fresh instance (testing-friendly, no global singleton). */
  static create(): TelemetryStore {
    return new TelemetryStore();
  }

  // -----------------------------------------------------------------------
  // Subscription (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  subscribe = (listener: Listener): (() => void) => {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  };

  getSnapshot = (): TelemetrySnapshot => {
    if (this._snapshotCache) {
      return this._snapshotCache;
    }
    this._snapshotCache = this._buildSnapshot();
    return this._snapshotCache;
  };

  private _invalidateCache(): void {
    this._snapshotCache = null;
  }

  private _notify(): void {
    this._invalidateCache();
    const listeners = Array.from(this._listeners);
    for (let i = 0; i < listeners.length; i++) {
      listeners[i]();
    }
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Ingest a raw serial line. If it can be parsed into numeric channels,
   * the values are stored. Non-parseable lines are silently ignored.
   */
  ingest(line: string): void {
    if (this._paused) {
      return;
    }

    const parsed = parseLine(line);
    if (!parsed) {
      return;
    }

    const now = Date.now();

    for (const [name, value] of parsed.values) {
      let channel = this._channels.get(name);
      if (!channel) {
        channel = { data: [], nextIndex: 0 };
        this._channels.set(name, channel);
        this._channelOrder.push(name);
      }

      const point: TelemetryDataPoint = {
        index: channel.nextIndex++,
        value,
        timestamp: now,
      };

      channel.data.push(point);

      // Evict oldest if over limit
      if (channel.data.length > MAX_POINTS) {
        channel.data.shift();
      }
    }

    this._totalSamples++;
    this._notify();
  }

  /** Pause ingestion — new lines are silently dropped. */
  pause(): void {
    if (this._paused) {
      return;
    }
    this._paused = true;
    this._notify();
  }

  /** Resume ingestion. */
  resume(): void {
    if (!this._paused) {
      return;
    }
    this._paused = false;
    this._notify();
  }

  /** Toggle pause/resume. */
  togglePause(): void {
    if (this._paused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  /** Whether ingestion is paused. */
  isPaused(): boolean {
    return this._paused;
  }

  /** Clear all channel data but keep channel names. */
  clear(): void {
    this._channels.clear();
    this._channelOrder = [];
    this._totalSamples = 0;
    this._notify();
  }

  /** Get the ordered list of channel names. */
  getChannelNames(): string[] {
    return [...this._channelOrder];
  }

  /** Get the number of channels currently tracked. */
  getChannelCount(): number {
    return this._channelOrder.length;
  }

  // -----------------------------------------------------------------------
  // Snapshot builder
  // -----------------------------------------------------------------------

  private _buildSnapshot(): TelemetrySnapshot {
    const channels: TelemetryChannel[] = this._channelOrder.map((name, idx) => {
      const channel = this._channels.get(name);
      const data = channel ? [...channel.data] : [];
      const stats = this._computeStats(data);
      return {
        name,
        data,
        stats,
        color: CHANNEL_COLORS[idx % CHANNEL_COLORS.length],
      };
    });

    return {
      channels,
      paused: this._paused,
      totalSamples: this._totalSamples,
    };
  }

  private _computeStats(data: TelemetryDataPoint[]): TelemetryChannelStats {
    if (data.length === 0) {
      return { current: 0, min: 0, max: 0, avg: 0, count: 0 };
    }

    let min = data[0].value;
    let max = data[0].value;
    let sum = 0;

    for (let i = 0; i < data.length; i++) {
      const v = data[i].value;
      if (v < min) {
        min = v;
      }
      if (v > max) {
        max = v;
      }
      sum += v;
    }

    return {
      current: data[data.length - 1].value,
      min,
      max,
      avg: sum / data.length,
      count: data.length,
    };
  }
}
