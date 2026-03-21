/**
 * VariableWatchManager — Parses serial output lines to extract named variables
 * and maintains a rolling history per variable.
 *
 * Supported serial line formats:
 *   1. name=value       — "temp=22.5" or "temp=22.5 hum=65"
 *   2. name: value      — "temp: 22.5" or "temp: 22.5, hum: 65"
 *   3. CSV numbers       — "1.23,4.56,7.89" → var0, var1, var2
 *   4. JSON object       — '{"temp":22.5,"hum":65}'
 *   5. Tab-separated     — "1.23\t4.56" → var0, var1
 *
 * Each variable stores up to MAX_HISTORY_POINTS data points (default 500).
 * Uses singleton+subscribe pattern for useSyncExternalStore compatibility.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

export interface WatchDataPoint {
  /** Value at this sample. */
  value: number;
  /** Timestamp in ms (Date.now()). */
  timestamp: number;
  /** Sequential index. */
  index: number;
}

export interface WatchVariableStats {
  current: number;
  min: number;
  max: number;
  avg: number;
  count: number;
  rate: number; // samples per second (computed over last 10 samples)
}

export interface WatchVariable {
  name: string;
  data: WatchDataPoint[];
  stats: WatchVariableStats;
}

export interface WatchSnapshot {
  variables: WatchVariable[];
  paused: boolean;
  totalSamples: number;
  detectedFormat: ParsedFormat | null;
}

export type ParsedFormat = 'name_value' | 'name_colon' | 'csv' | 'json' | 'tab';

export interface ParsedLine {
  format: ParsedFormat;
  values: Map<string, number>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_HISTORY_POINTS = 500;

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function isNumeric(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed === '') {
    return false;
  }
  return !Number.isNaN(Number(trimmed));
}

/**
 * Parse a serial output line into named numeric values.
 * Tries each format in priority order and returns the first successful parse.
 * Returns null if the line cannot be parsed.
 */
export function parseWatchLine(line: string): ParsedLine | null {
  const trimmed = line.trim();
  if (trimmed === '') {
    return null;
  }

  // Format 4: JSON — starts with { and is valid JSON with numeric values
  if (trimmed.startsWith('{')) {
    const jsonResult = tryParseJson(trimmed);
    if (jsonResult) {
      return jsonResult;
    }
  }

  // Format 1: name=value pairs — "temp=22.5" or "temp=22.5 hum=65" or "temp=22.5,hum=65"
  const nvResult = tryParseNameValue(trimmed);
  if (nvResult) {
    return nvResult;
  }

  // Format 2: name: value — "temp: 22.5" or "temp: 22.5, hum: 65"
  const ncResult = tryParseNameColon(trimmed);
  if (ncResult) {
    return ncResult;
  }

  // Format 5: Tab-separated numbers — "1.23\t4.56\t7.89"
  if (trimmed.includes('\t')) {
    const tabResult = tryParseTab(trimmed);
    if (tabResult) {
      return tabResult;
    }
  }

  // Format 3: CSV numbers — "1.23,4.56,7.89"
  const csvResult = tryParseCsv(trimmed);
  if (csvResult) {
    return csvResult;
  }

  return null;
}

function tryParseJson(text: string): ParsedLine | null {
  try {
    const obj: unknown = JSON.parse(text);
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return null;
    }
    const values = new Map<string, number>();
    const entries = Object.entries(obj as Record<string, unknown>);
    for (const [key, val] of entries) {
      if (typeof val === 'number' && Number.isFinite(val)) {
        values.set(key, val);
      } else if (typeof val === 'string' && isNumeric(val)) {
        values.set(key, Number(val));
      }
    }
    if (values.size > 0) {
      return { format: 'json', values };
    }
  } catch {
    // Not valid JSON
  }
  return null;
}

function tryParseNameValue(text: string): ParsedLine | null {
  // Split by whitespace or comma, look for key=value pairs
  const tokens = text.split(/[,\s]+/).filter((s) => s.length > 0);
  const pairs = tokens.filter((t) => t.includes('='));
  if (pairs.length === 0) {
    return null;
  }

  const values = new Map<string, number>();
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    const key = pair.slice(0, eqIdx).trim();
    const valStr = pair.slice(eqIdx + 1).trim();
    if (key && isNumeric(valStr)) {
      values.set(key, Number(valStr));
    }
  }

  // Only valid if all pairs parsed successfully
  if (values.size > 0 && values.size === pairs.length) {
    return { format: 'name_value', values };
  }
  return null;
}

function tryParseNameColon(text: string): ParsedLine | null {
  // Split by comma first, then look for "name: value" within each segment
  const segments = text.split(',');
  const colonPattern = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*$/;

  const values = new Map<string, number>();
  let matchedSegments = 0;

  for (const seg of segments) {
    const m = colonPattern.exec(seg.trim());
    if (m) {
      values.set(m[1], Number(m[2]));
      matchedSegments++;
    }
  }

  if (matchedSegments > 0 && matchedSegments === segments.length) {
    return { format: 'name_colon', values };
  }
  return null;
}

function tryParseTab(text: string): ParsedLine | null {
  const parts = text.split('\t');
  if (parts.length < 1) {
    return null;
  }
  if (!parts.every((p) => isNumeric(p))) {
    return null;
  }

  const values = new Map<string, number>();
  for (let i = 0; i < parts.length; i++) {
    values.set(`var${String(i)}`, Number(parts[i].trim()));
  }
  return { format: 'tab', values };
}

function tryParseCsv(text: string): ParsedLine | null {
  const parts = text.split(',');
  if (parts.length < 1) {
    return null;
  }
  if (!parts.every((p) => isNumeric(p))) {
    return null;
  }

  const values = new Map<string, number>();
  for (let i = 0; i < parts.length; i++) {
    values.set(`var${String(i)}`, Number(parts[i].trim()));
  }
  return { format: 'csv', values };
}

// ---------------------------------------------------------------------------
// VariableWatchManager
// ---------------------------------------------------------------------------

interface InternalVariable {
  data: WatchDataPoint[];
  nextIndex: number;
}

export class VariableWatchManager {
  private static _instance: VariableWatchManager | null = null;

  private _listeners = new Set<Listener>();
  private _variables = new Map<string, InternalVariable>();
  private _variableOrder: string[] = [];
  private _paused = false;
  private _totalSamples = 0;
  private _detectedFormat: ParsedFormat | null = null;
  private _snapshotCache: WatchSnapshot | null = null;
  private _maxHistory: number;

  private constructor(maxHistory: number = MAX_HISTORY_POINTS) {
    this._maxHistory = maxHistory;
  }

  static getInstance(): VariableWatchManager {
    if (!VariableWatchManager._instance) {
      VariableWatchManager._instance = new VariableWatchManager();
    }
    return VariableWatchManager._instance;
  }

  /** Create a fresh (non-singleton) instance. Useful for testing. */
  static create(maxHistory: number = MAX_HISTORY_POINTS): VariableWatchManager {
    return new VariableWatchManager(maxHistory);
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

  getSnapshot = (): WatchSnapshot => {
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
   * Ingest a raw serial output line. If it can be parsed into named variables,
   * the values are stored. Non-parseable lines are silently ignored.
   */
  ingest(line: string): void {
    if (this._paused) {
      return;
    }

    const parsed = parseWatchLine(line);
    if (!parsed) {
      return;
    }

    this._detectedFormat = parsed.format;
    const now = Date.now();

    const entries = Array.from(parsed.values.entries());
    for (const [name, value] of entries) {
      let variable = this._variables.get(name);
      if (!variable) {
        variable = { data: [], nextIndex: 0 };
        this._variables.set(name, variable);
        this._variableOrder.push(name);
      }

      const point: WatchDataPoint = {
        value,
        timestamp: now,
        index: variable.nextIndex++,
      };

      variable.data.push(point);

      // Evict oldest if over limit
      if (variable.data.length > this._maxHistory) {
        variable.data.shift();
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

  /** Clear all variable data and reset state. */
  clear(): void {
    this._variables.clear();
    this._variableOrder = [];
    this._totalSamples = 0;
    this._detectedFormat = null;
    this._notify();
  }

  /** Get the ordered list of variable names. */
  getVariableNames(): string[] {
    return [...this._variableOrder];
  }

  /** Get the number of variables currently tracked. */
  getVariableCount(): number {
    return this._variableOrder.length;
  }

  /** Get the total number of ingested samples. */
  getTotalSamples(): number {
    return this._totalSamples;
  }

  /** Get the detected format of the most recent parsed line. */
  getDetectedFormat(): ParsedFormat | null {
    return this._detectedFormat;
  }

  /** Get the raw data points for a specific variable. */
  getVariableData(name: string): WatchDataPoint[] {
    const v = this._variables.get(name);
    return v ? [...v.data] : [];
  }

  /** Get the current (latest) value for a specific variable, or null if unknown. */
  getCurrentValue(name: string): number | null {
    const v = this._variables.get(name);
    if (!v || v.data.length === 0) {
      return null;
    }
    return v.data[v.data.length - 1].value;
  }

  /** Remove a specific variable from tracking. */
  removeVariable(name: string): void {
    this._variables.delete(name);
    this._variableOrder = this._variableOrder.filter((n) => n !== name);
    this._notify();
  }

  // -----------------------------------------------------------------------
  // Snapshot builder
  // -----------------------------------------------------------------------

  private _buildSnapshot(): WatchSnapshot {
    const variables: WatchVariable[] = this._variableOrder.map((name) => {
      const internal = this._variables.get(name);
      const data = internal ? [...internal.data] : [];
      const stats = this._computeStats(data);
      return { name, data, stats };
    });

    return {
      variables,
      paused: this._paused,
      totalSamples: this._totalSamples,
      detectedFormat: this._detectedFormat,
    };
  }

  private _computeStats(data: WatchDataPoint[]): WatchVariableStats {
    if (data.length === 0) {
      return { current: 0, min: 0, max: 0, avg: 0, count: 0, rate: 0 };
    }

    let minVal = data[0].value;
    let maxVal = data[0].value;
    let sum = 0;

    for (let i = 0; i < data.length; i++) {
      const v = data[i].value;
      if (v < minVal) {
        minVal = v;
      }
      if (v > maxVal) {
        maxVal = v;
      }
      sum += v;
    }

    // Calculate rate from last 10 samples
    let rate = 0;
    if (data.length >= 2) {
      const sampleCount = Math.min(10, data.length);
      const recentStart = data[data.length - sampleCount].timestamp;
      const recentEnd = data[data.length - 1].timestamp;
      const durationMs = recentEnd - recentStart;
      if (durationMs > 0) {
        rate = ((sampleCount - 1) / durationMs) * 1000; // samples/second
      }
    }

    return {
      current: data[data.length - 1].value,
      min: minVal,
      max: maxVal,
      avg: sum / data.length,
      count: data.length,
      rate,
    };
  }
}
