/**
 * Operation Duration Tracker
 *
 * Records how long various operations take, persists historical data to
 * localStorage, and produces time estimates with confidence levels.
 * Estimates blend historical median with a heuristic fallback based on
 * operation-specific defaults and an optional complexity multiplier.
 *
 * Usage:
 *   const tracker = DurationTracker.getInstance();
 *   tracker.recordDuration('compile', 4200);
 *   tracker.getEstimate('compile'); // { operation: 'compile', estimatedMs: 4200, confidence: 'high', basis: 'historical' }
 *
 * React hook:
 *   const { estimate, formatted } = useOperationDuration('compile');
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OperationType = 'export' | 'compile' | 'simulate' | 'drc' | 'import' | 'ai_chat' | 'autoroute';

export type Confidence = 'low' | 'medium' | 'high';

export type EstimateBasis = 'historical' | 'heuristic';

export interface DurationEstimate {
  operation: OperationType;
  estimatedMs: number;
  confidence: Confidence;
  basis: EstimateBasis;
}

/** A single recorded duration sample. */
export interface DurationRecord {
  ms: number;
  recordedAt: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default heuristic durations (ms) when no historical data exists. */
export const HEURISTIC_DURATIONS: Record<OperationType, number> = {
  export: 3000,
  compile: 15000,
  simulate: 8000,
  drc: 2000,
  import: 5000,
  ai_chat: 6000,
  autoroute: 12000,
};

const STORAGE_KEY = 'protopulse:op-durations';

/** Maximum number of historical samples to keep per operation. */
const MAX_SAMPLES = 50;

/** Number of historical samples required for high confidence. */
const HIGH_CONFIDENCE_THRESHOLD = 10;

/** Number of historical samples required for medium confidence. */
const MEDIUM_CONFIDENCE_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// DurationTracker
// ---------------------------------------------------------------------------

/**
 * Tracks operation durations with localStorage persistence.
 * Singleton per application. Notifies subscribers on state changes.
 */
export class DurationTracker {
  private static instance: DurationTracker | null = null;

  private records: Map<OperationType, DurationRecord[]>;
  private subscribers: Set<() => void>;

  constructor() {
    this.records = new Map();
    this.subscribers = new Set();
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): DurationTracker {
    if (!DurationTracker.instance) {
      DurationTracker.instance = new DurationTracker();
    }
    return DurationTracker.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    DurationTracker.instance = null;
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /**
   * Record a duration sample for an operation.
   * Negative or zero durations are ignored.
   * When over MAX_SAMPLES, the oldest sample is evicted.
   */
  recordDuration(operation: OperationType, ms: number): void {
    if (ms <= 0 || !Number.isFinite(ms)) {
      return;
    }

    const samples = this.records.get(operation) ?? [];
    samples.push({ ms, recordedAt: Date.now() });

    // Enforce cap by evicting oldest
    if (samples.length > MAX_SAMPLES) {
      samples.sort((a, b) => a.recordedAt - b.recordedAt);
      samples.splice(0, samples.length - MAX_SAMPLES);
    }

    this.records.set(operation, samples);
    this.save();
    this.notify();
  }

  /**
   * Clear all recorded durations for a specific operation.
   */
  clearOperation(operation: OperationType): void {
    if (!this.records.has(operation) || this.records.get(operation)!.length === 0) {
      return;
    }
    this.records.delete(operation);
    this.save();
    this.notify();
  }

  /**
   * Clear all recorded durations for all operations.
   */
  clearAll(): void {
    if (this.records.size === 0) {
      return;
    }
    this.records.clear();
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /**
   * Get a duration estimate for an operation.
   * When enough historical data exists, returns the median duration.
   * Otherwise falls back to the heuristic default.
   * An optional complexity multiplier (default 1) scales the estimate.
   */
  getEstimate(operation: OperationType, complexity?: number): DurationEstimate {
    const multiplier = complexity != null && Number.isFinite(complexity) && complexity > 0 ? complexity : 1;
    const samples = this.records.get(operation);

    if (!samples || samples.length === 0) {
      return {
        operation,
        estimatedMs: Math.round(HEURISTIC_DURATIONS[operation] * multiplier),
        confidence: 'low',
        basis: 'heuristic',
      };
    }

    const median = this.computeMedian(samples.map((s) => s.ms));
    const confidence = this.computeConfidence(samples.length);

    return {
      operation,
      estimatedMs: Math.round(median * multiplier),
      confidence,
      basis: 'historical',
    };
  }

  /**
   * Get the number of recorded samples for an operation.
   */
  getSampleCount(operation: OperationType): number {
    return this.records.get(operation)?.length ?? 0;
  }

  /**
   * Get all recorded samples for an operation (returns a copy).
   */
  getSamples(operation: OperationType): DurationRecord[] {
    return [...(this.records.get(operation) ?? [])];
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked whenever durations are recorded or cleared.
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  /** Persist records to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const serialized: Record<string, DurationRecord[]> = {};
      for (const [key, value] of Array.from(this.records.entries())) {
        serialized[key] = value;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load records from localStorage. */
  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return;
      }

      const obj = parsed as Record<string, unknown>;
      for (const [key, value] of Object.entries(obj)) {
        if (!isValidOperationType(key) || !Array.isArray(value)) {
          continue;
        }
        const validated = value.filter(
          (item: unknown): item is DurationRecord =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as DurationRecord).ms === 'number' &&
            typeof (item as DurationRecord).recordedAt === 'number',
        );
        if (validated.length > 0) {
          this.records.set(key, validated);
        }
      }
    } catch {
      // Corrupt data — start fresh
      this.records.clear();
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Compute the median of an array of numbers. */
  private computeMedian(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  /** Determine confidence level based on sample count. */
  private computeConfidence(count: number): Confidence {
    if (count >= HIGH_CONFIDENCE_THRESHOLD) {
      return 'high';
    }
    if (count >= MEDIUM_CONFIDENCE_THRESHOLD) {
      return 'medium';
    }
    return 'low';
  }

  /** Notify all subscribers of a state change. */
  private notify(): void {
    this.subscribers.forEach((cb) => {
      cb();
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_OPERATIONS: ReadonlySet<string> = new Set<OperationType>([
  'export',
  'compile',
  'simulate',
  'drc',
  'import',
  'ai_chat',
  'autoroute',
]);

function isValidOperationType(value: string): value is OperationType {
  return VALID_OPERATIONS.has(value);
}

/**
 * Format a duration in milliseconds to a human-friendly string.
 *
 * - < 1000ms  => "< 1s"
 * - 1-9.9s    => "~Ns"
 * - 10-59s    => "~Ns" (rounded to nearest 5)
 * - 60-119s   => "~1 min"
 * - 120s+     => "N-M min" (range)
 */
export function formatDuration(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) {
    return '< 1s';
  }

  const seconds = ms / 1000;

  if (seconds < 1) {
    return '< 1s';
  }

  if (seconds < 10) {
    return `~${Math.round(seconds)}s`;
  }

  if (seconds < 60) {
    const rounded = Math.round(seconds / 5) * 5;
    return `~${rounded}s`;
  }

  if (seconds < 120) {
    return '~1 min';
  }

  const minLow = Math.floor(seconds / 60);
  const minHigh = Math.ceil(seconds / 60);
  if (minLow === minHigh) {
    return `~${minLow} min`;
  }
  return `${minLow}-${minHigh} min`;
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing operation duration estimates in React components.
 * Subscribes to the DurationTracker and triggers re-renders on state changes.
 */
export function useOperationDuration(
  operation: OperationType,
  complexity?: number,
): {
  estimate: DurationEstimate;
  formatted: string;
  recordDuration: (ms: number) => void;
  sampleCount: number;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const tracker = DurationTracker.getInstance();
    const unsubscribe = tracker.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const recordDuration = useCallback(
    (ms: number) => {
      DurationTracker.getInstance().recordDuration(operation, ms);
    },
    [operation],
  );

  const tracker = DurationTracker.getInstance();
  const estimate = tracker.getEstimate(operation, complexity);
  const formatted = formatDuration(estimate.estimatedMs);
  const sampleCount = tracker.getSampleCount(operation);

  return {
    estimate,
    formatted,
    recordDuration,
    sampleCount,
  };
}
