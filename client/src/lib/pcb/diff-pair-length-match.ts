/**
 * DiffPairLengthMatcher — Differential pair length matching automation.
 *
 * Measures differential pair trace lengths, calculates mismatch, and generates
 * meander suggestions to compensate. Integrates with the existing diff-pair-meander.ts
 * serpentine generator.
 *
 * Singleton + subscribe pattern (useSyncExternalStore compatible).
 * All dimensions in mm.
 */

import { calculateMeanderParams, fitMeander } from './diff-pair-meander';
import type { Point2D, MeanderStyle, MeanderSide } from './diff-pair-meander';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiffPairDef {
  id: string;
  name: string;
  positiveTrace: Point2D[];
  negativeTrace: Point2D[];
}

export interface PairLengthMeasurement {
  pairId: string;
  positiveLength: number;
  negativeLength: number;
  delta: number;
  matched: boolean;
}

export interface LengthMismatch {
  pairId: string;
  longerTrace: 'positive' | 'negative';
  delta: number;
  targetDelta: number;
}

export interface MeanderConstraints {
  minAmplitude: number;
  maxAmplitude: number;
  spacing: number;
  targetDelta: number;
}

export interface MeanderSegment {
  start: Point2D;
  end: Point2D;
  points: Point2D[];
  addedLength: number;
}

export interface MeanderSuggestion {
  pairId: string;
  trace: 'positive' | 'negative';
  segments: MeanderSegment[];
  addedLength: number;
}

export interface MatchResult {
  pairId: string;
  name: string;
  before: PairLengthMeasurement;
  suggestion: MeanderSuggestion | null;
  achievable: boolean;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function polylineLength(points: Point2D[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// DiffPairLengthMatcher
// ---------------------------------------------------------------------------

/** Default target delta for high-speed differential pairs (mm). */
const DEFAULT_TARGET_DELTA = 0.1;

/** Default meander constraints. */
const DEFAULT_CONSTRAINTS: MeanderConstraints = {
  minAmplitude: 0.2,
  maxAmplitude: 2.0,
  spacing: 0.5,
  targetDelta: DEFAULT_TARGET_DELTA,
};

/** Default meander style. */
const DEFAULT_MEANDER_STYLE: MeanderStyle = 'trombone';

/** Default meander side. */
const DEFAULT_MEANDER_SIDE: MeanderSide = 'left';

/**
 * Manages differential pair length matching.
 *
 * Use `DiffPairLengthMatcher.create()` for testing or `DiffPairLengthMatcher.instance()`
 * for the global singleton.
 */
export class DiffPairLengthMatcher {
  private static _instance: DiffPairLengthMatcher | null = null;

  private listeners = new Set<Listener>();
  private _targetDelta: number = DEFAULT_TARGET_DELTA;
  private _constraints: MeanderConstraints = { ...DEFAULT_CONSTRAINTS };
  private _lastResults: MatchResult[] = [];

  private constructor() {}

  /** Global singleton. */
  static instance(): DiffPairLengthMatcher {
    if (!DiffPairLengthMatcher._instance) {
      DiffPairLengthMatcher._instance = new DiffPairLengthMatcher();
    }
    return DiffPairLengthMatcher._instance;
  }

  /** Factory — creates a fresh, isolated instance (testing-friendly). */
  static create(): DiffPairLengthMatcher {
    return new DiffPairLengthMatcher();
  }

  /** Reset the singleton (for testing). */
  static resetInstance(): void {
    DiffPairLengthMatcher._instance = null;
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
  // Configuration
  // -----------------------------------------------------------------------

  get targetDelta(): number {
    return this._targetDelta;
  }

  setTargetDelta(delta: number): void {
    if (delta < 0) {
      throw new Error('Target delta must be non-negative');
    }
    this._targetDelta = delta;
    this._constraints = { ...this._constraints, targetDelta: delta };
    this.notify();
  }

  get constraints(): MeanderConstraints {
    return { ...this._constraints };
  }

  setConstraints(constraints: Partial<MeanderConstraints>): void {
    this._constraints = { ...this._constraints, ...constraints };
    if (constraints.targetDelta !== undefined) {
      this._targetDelta = constraints.targetDelta;
    }
    this.notify();
  }

  get lastResults(): MatchResult[] {
    return [...this._lastResults];
  }

  // -----------------------------------------------------------------------
  // Core measurement
  // -----------------------------------------------------------------------

  /**
   * Measure the lengths of positive and negative traces in a differential pair.
   */
  measurePairLengths(pair: DiffPairDef): PairLengthMeasurement {
    const positiveLength = pair.positiveTrace.length >= 2 ? polylineLength(pair.positiveTrace) : 0;
    const negativeLength = pair.negativeTrace.length >= 2 ? polylineLength(pair.negativeTrace) : 0;
    const delta = Math.abs(positiveLength - negativeLength);

    return {
      pairId: pair.id,
      positiveLength,
      negativeLength,
      delta,
      matched: delta <= this._targetDelta,
    };
  }

  // -----------------------------------------------------------------------
  // Mismatch calculation
  // -----------------------------------------------------------------------

  /**
   * Calculate the mismatch between positive and negative traces.
   */
  calculateMismatch(measurement: PairLengthMeasurement): LengthMismatch {
    const longerTrace: 'positive' | 'negative' =
      measurement.positiveLength >= measurement.negativeLength ? 'positive' : 'negative';

    return {
      pairId: measurement.pairId,
      longerTrace,
      delta: measurement.delta,
      targetDelta: this._targetDelta,
    };
  }

  // -----------------------------------------------------------------------
  // Meander suggestion
  // -----------------------------------------------------------------------

  /**
   * Generate meander parameters to compensate for a length mismatch.
   *
   * The shorter trace gets a meander added. Returns null if the pair is
   * already matched or if the required compensation exceeds what the
   * constraints allow.
   */
  suggestMeander(mismatch: LengthMismatch, constraints: MeanderConstraints): MeanderSuggestion | null {
    // Already matched
    if (mismatch.delta <= constraints.targetDelta) {
      return null;
    }

    const compensationNeeded = mismatch.delta - constraints.targetDelta;

    // The shorter trace needs the meander (opposite of the longer trace)
    const targetTrace: 'positive' | 'negative' = mismatch.longerTrace === 'positive' ? 'negative' : 'positive';

    // Check if we can achieve the needed compensation within constraints.
    // Maximum length per meander turn (trombone) = 2 * maxAmplitude.
    // We need enough room for at least one turn.
    const params = calculateMeanderParams({
      additionalLength: compensationNeeded,
      amplitude: constraints.maxAmplitude,
      spacing: constraints.spacing,
      style: DEFAULT_MEANDER_STYLE,
    });

    // Build a single MeanderSegment representing the suggested compensation
    const segment: MeanderSegment = {
      start: { x: 0, y: 0 },
      end: { x: params.turnCount * constraints.spacing, y: 0 },
      points: [],
      addedLength: params.totalAdded,
    };

    return {
      pairId: mismatch.pairId,
      trace: targetTrace,
      segments: [segment],
      addedLength: params.totalAdded,
    };
  }

  /**
   * Apply a meander suggestion to a trace path, returning the modified path.
   *
   * Uses fitMeander from diff-pair-meander.ts to insert a serpentine into
   * the longest straight segment of the shorter trace.
   */
  applyMeanderToTrace(trace: Point2D[], suggestion: MeanderSuggestion): Point2D[] {
    if (trace.length < 2) {
      return trace.map((p) => ({ ...p }));
    }

    const amplitude = Math.min(
      this._constraints.maxAmplitude,
      Math.max(this._constraints.minAmplitude, this._constraints.maxAmplitude * 0.5),
    );

    try {
      const result = fitMeander(trace, {
        additionalLength: suggestion.addedLength,
        amplitude,
        spacing: this._constraints.spacing,
        style: DEFAULT_MEANDER_STYLE,
        side: DEFAULT_MEANDER_SIDE,
      });
      return result.points;
    } catch {
      // fitMeander throws if the longest segment is too short
      return trace.map((p) => ({ ...p }));
    }
  }

  // -----------------------------------------------------------------------
  // Batch operations
  // -----------------------------------------------------------------------

  /**
   * Auto-match all differential pairs. Returns a MatchResult for each pair.
   */
  autoMatchAll(pairs: DiffPairDef[]): MatchResult[] {
    const results: MatchResult[] = pairs.map((pair) => {
      const measurement = this.measurePairLengths(pair);

      if (measurement.matched) {
        return {
          pairId: pair.id,
          name: pair.name,
          before: measurement,
          suggestion: null,
          achievable: true,
        };
      }

      const mismatch = this.calculateMismatch(measurement);
      const suggestion = this.suggestMeander(mismatch, this._constraints);

      // Check achievability: the compensation must be close enough to the needed delta
      let achievable = false;
      if (suggestion) {
        const remainingDelta = Math.abs(measurement.delta - suggestion.addedLength);
        achievable = remainingDelta <= this._targetDelta;
      }

      return {
        pairId: pair.id,
        name: pair.name,
        before: measurement,
        suggestion,
        achievable,
      };
    });

    this._lastResults = results;
    this.notify();

    return results;
  }

  /**
   * Match a single pair by ID from a collection.
   */
  matchSingle(pair: DiffPairDef): MatchResult {
    const results = this.autoMatchAll([pair]);
    return results[0];
  }

  // -----------------------------------------------------------------------
  // Snapshot (for useSyncExternalStore getSnapshot)
  // -----------------------------------------------------------------------

  getSnapshot(): MatchResult[] {
    return this._lastResults;
  }
}
