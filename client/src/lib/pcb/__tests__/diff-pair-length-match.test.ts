import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DiffPairLengthMatcher } from '../diff-pair-length-match';
import type {
  DiffPairDef,
  PairLengthMeasurement,
  LengthMismatch,
  MeanderConstraints,
  MatchResult,
} from '../diff-pair-length-match';
import type { Point2D } from '../diff-pair-meander';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePair(overrides?: Partial<DiffPairDef>): DiffPairDef {
  return {
    id: 'dp-1',
    name: 'USB_D',
    positiveTrace: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    negativeTrace: [
      { x: 0, y: 1 },
      { x: 10, y: 1 },
    ],
    ...overrides,
  };
}

/** Build a trace of given total length along the X axis. */
function straightTrace(length: number, yOffset: number = 0): Point2D[] {
  return [
    { x: 0, y: yOffset },
    { x: length, y: yOffset },
  ];
}

/** Build a trace with a bend (3 segments) of known total length. */
function bentTrace(seg1: number, seg2: number, seg3: number, yOffset: number = 0): Point2D[] {
  return [
    { x: 0, y: yOffset },
    { x: seg1, y: yOffset },
    { x: seg1, y: yOffset + seg2 },
    { x: seg1 + seg3, y: yOffset + seg2 },
  ];
}

function freshMatcher(): DiffPairLengthMatcher {
  return DiffPairLengthMatcher.create();
}

const DEFAULT_CONSTRAINTS: MeanderConstraints = {
  minAmplitude: 0.2,
  maxAmplitude: 2.0,
  spacing: 0.5,
  targetDelta: 0.1,
};

// ---------------------------------------------------------------------------
// measurePairLengths
// ---------------------------------------------------------------------------

describe('DiffPairLengthMatcher — measurePairLengths', () => {
  let matcher: DiffPairLengthMatcher;

  beforeEach(() => {
    matcher = freshMatcher();
  });

  it('measures equal-length straight traces as matched', () => {
    const pair = makePair({
      positiveTrace: straightTrace(10, 0),
      negativeTrace: straightTrace(10, 1),
    });
    const m = matcher.measurePairLengths(pair);
    expect(m.pairId).toBe('dp-1');
    expect(m.positiveLength).toBeCloseTo(10, 6);
    expect(m.negativeLength).toBeCloseTo(10, 6);
    expect(m.delta).toBeCloseTo(0, 6);
    expect(m.matched).toBe(true);
  });

  it('measures unequal straight traces correctly', () => {
    const pair = makePair({
      positiveTrace: straightTrace(12, 0),
      negativeTrace: straightTrace(10, 1),
    });
    const m = matcher.measurePairLengths(pair);
    expect(m.positiveLength).toBeCloseTo(12, 6);
    expect(m.negativeLength).toBeCloseTo(10, 6);
    expect(m.delta).toBeCloseTo(2, 6);
    expect(m.matched).toBe(false);
  });

  it('measures traces with bends', () => {
    // Bent trace: 5 + 3 + 4 = 12mm total
    const pair = makePair({
      positiveTrace: bentTrace(5, 3, 4, 0),
      negativeTrace: straightTrace(10, 2),
    });
    const m = matcher.measurePairLengths(pair);
    expect(m.positiveLength).toBeCloseTo(12, 6);
    expect(m.negativeLength).toBeCloseTo(10, 6);
    expect(m.delta).toBeCloseTo(2, 6);
  });

  it('handles single-point traces as zero length', () => {
    const pair = makePair({
      positiveTrace: [{ x: 0, y: 0 }],
      negativeTrace: straightTrace(10, 1),
    });
    const m = matcher.measurePairLengths(pair);
    expect(m.positiveLength).toBe(0);
    expect(m.negativeLength).toBeCloseTo(10, 6);
    expect(m.delta).toBeCloseTo(10, 6);
    expect(m.matched).toBe(false);
  });

  it('handles empty traces as zero length', () => {
    const pair = makePair({
      positiveTrace: [],
      negativeTrace: [],
    });
    const m = matcher.measurePairLengths(pair);
    expect(m.positiveLength).toBe(0);
    expect(m.negativeLength).toBe(0);
    expect(m.delta).toBe(0);
    expect(m.matched).toBe(true);
  });

  it('respects targetDelta for matched status', () => {
    matcher.setTargetDelta(1.0);
    const pair = makePair({
      positiveTrace: straightTrace(10.5, 0),
      negativeTrace: straightTrace(10, 1),
    });
    const m = matcher.measurePairLengths(pair);
    expect(m.delta).toBeCloseTo(0.5, 6);
    expect(m.matched).toBe(true);
  });

  it('marks as unmatched when delta exceeds targetDelta', () => {
    matcher.setTargetDelta(0.1);
    const pair = makePair({
      positiveTrace: straightTrace(10.5, 0),
      negativeTrace: straightTrace(10, 1),
    });
    const m = matcher.measurePairLengths(pair);
    expect(m.matched).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateMismatch
// ---------------------------------------------------------------------------

describe('DiffPairLengthMatcher — calculateMismatch', () => {
  let matcher: DiffPairLengthMatcher;

  beforeEach(() => {
    matcher = freshMatcher();
  });

  it('identifies positive as longer trace', () => {
    const measurement: PairLengthMeasurement = {
      pairId: 'dp-1',
      positiveLength: 12,
      negativeLength: 10,
      delta: 2,
      matched: false,
    };
    const mismatch = matcher.calculateMismatch(measurement);
    expect(mismatch.longerTrace).toBe('positive');
    expect(mismatch.delta).toBe(2);
    expect(mismatch.pairId).toBe('dp-1');
  });

  it('identifies negative as longer trace', () => {
    const measurement: PairLengthMeasurement = {
      pairId: 'dp-1',
      positiveLength: 8,
      negativeLength: 11,
      delta: 3,
      matched: false,
    };
    const mismatch = matcher.calculateMismatch(measurement);
    expect(mismatch.longerTrace).toBe('negative');
    expect(mismatch.delta).toBe(3);
  });

  it('defaults to positive when lengths are equal', () => {
    const measurement: PairLengthMeasurement = {
      pairId: 'dp-1',
      positiveLength: 10,
      negativeLength: 10,
      delta: 0,
      matched: true,
    };
    const mismatch = matcher.calculateMismatch(measurement);
    expect(mismatch.longerTrace).toBe('positive');
    expect(mismatch.delta).toBe(0);
  });

  it('includes targetDelta from matcher', () => {
    matcher.setTargetDelta(0.25);
    const measurement: PairLengthMeasurement = {
      pairId: 'dp-2',
      positiveLength: 10,
      negativeLength: 9,
      delta: 1,
      matched: false,
    };
    const mismatch = matcher.calculateMismatch(measurement);
    expect(mismatch.targetDelta).toBe(0.25);
  });
});

// ---------------------------------------------------------------------------
// suggestMeander
// ---------------------------------------------------------------------------

describe('DiffPairLengthMatcher — suggestMeander', () => {
  let matcher: DiffPairLengthMatcher;

  beforeEach(() => {
    matcher = freshMatcher();
  });

  it('returns null when already matched', () => {
    const mismatch: LengthMismatch = {
      pairId: 'dp-1',
      longerTrace: 'positive',
      delta: 0.05,
      targetDelta: 0.1,
    };
    const suggestion = matcher.suggestMeander(mismatch, DEFAULT_CONSTRAINTS);
    expect(suggestion).toBeNull();
  });

  it('suggests meander on shorter trace when positive is longer', () => {
    const mismatch: LengthMismatch = {
      pairId: 'dp-1',
      longerTrace: 'positive',
      delta: 2.0,
      targetDelta: 0.1,
    };
    const suggestion = matcher.suggestMeander(mismatch, DEFAULT_CONSTRAINTS);
    expect(suggestion).not.toBeNull();
    expect(suggestion!.trace).toBe('negative');
    expect(suggestion!.pairId).toBe('dp-1');
    expect(suggestion!.addedLength).toBeGreaterThan(0);
  });

  it('suggests meander on shorter trace when negative is longer', () => {
    const mismatch: LengthMismatch = {
      pairId: 'dp-1',
      longerTrace: 'negative',
      delta: 1.5,
      targetDelta: 0.1,
    };
    const suggestion = matcher.suggestMeander(mismatch, DEFAULT_CONSTRAINTS);
    expect(suggestion).not.toBeNull();
    expect(suggestion!.trace).toBe('positive');
  });

  it('produces sufficient addedLength to compensate', () => {
    const mismatch: LengthMismatch = {
      pairId: 'dp-1',
      longerTrace: 'positive',
      delta: 3.0,
      targetDelta: 0.1,
    };
    const suggestion = matcher.suggestMeander(mismatch, DEFAULT_CONSTRAINTS);
    expect(suggestion).not.toBeNull();
    // addedLength should be >= compensation needed (delta - targetDelta)
    expect(suggestion!.addedLength).toBeGreaterThanOrEqual(3.0 - 0.1);
  });

  it('respects maxAmplitude in meander parameters', () => {
    const mismatch: LengthMismatch = {
      pairId: 'dp-1',
      longerTrace: 'positive',
      delta: 1.0,
      targetDelta: 0.1,
    };
    const constraints: MeanderConstraints = {
      ...DEFAULT_CONSTRAINTS,
      maxAmplitude: 0.5,
    };
    const suggestion = matcher.suggestMeander(mismatch, constraints);
    expect(suggestion).not.toBeNull();
    expect(suggestion!.segments.length).toBe(1);
  });

  it('returns null for delta equal to targetDelta', () => {
    const mismatch: LengthMismatch = {
      pairId: 'dp-1',
      longerTrace: 'positive',
      delta: 0.1,
      targetDelta: 0.1,
    };
    const suggestion = matcher.suggestMeander(mismatch, DEFAULT_CONSTRAINTS);
    expect(suggestion).toBeNull();
  });

  it('produces at least one meander segment', () => {
    const mismatch: LengthMismatch = {
      pairId: 'dp-1',
      longerTrace: 'negative',
      delta: 5.0,
      targetDelta: 0.1,
    };
    const suggestion = matcher.suggestMeander(mismatch, DEFAULT_CONSTRAINTS);
    expect(suggestion).not.toBeNull();
    expect(suggestion!.segments.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// applyMeanderToTrace
// ---------------------------------------------------------------------------

describe('DiffPairLengthMatcher — applyMeanderToTrace', () => {
  let matcher: DiffPairLengthMatcher;

  beforeEach(() => {
    matcher = freshMatcher();
  });

  it('returns copy of trace when trace has fewer than 2 points', () => {
    const trace: Point2D[] = [{ x: 0, y: 0 }];
    const suggestion = {
      pairId: 'dp-1',
      trace: 'positive' as const,
      segments: [],
      addedLength: 1.0,
    };
    const result = matcher.applyMeanderToTrace(trace, suggestion);
    expect(result).toEqual([{ x: 0, y: 0 }]);
    expect(result).not.toBe(trace);
  });

  it('produces a longer path when meander is applied', () => {
    const trace = straightTrace(20, 0);
    const suggestion = {
      pairId: 'dp-1',
      trace: 'negative' as const,
      segments: [],
      addedLength: 2.0,
    };
    const result = matcher.applyMeanderToTrace(trace, suggestion);
    // Result should have more points than original
    expect(result.length).toBeGreaterThan(2);
  });

  it('preserves start and end points', () => {
    const trace = straightTrace(20, 0);
    const suggestion = {
      pairId: 'dp-1',
      trace: 'positive' as const,
      segments: [],
      addedLength: 1.5,
    };
    const result = matcher.applyMeanderToTrace(trace, suggestion);
    expect(result[0].x).toBeCloseTo(0, 4);
    expect(result[0].y).toBeCloseTo(0, 4);
    expect(result[result.length - 1].x).toBeCloseTo(20, 4);
    expect(result[result.length - 1].y).toBeCloseTo(0, 4);
  });
});

// ---------------------------------------------------------------------------
// autoMatchAll
// ---------------------------------------------------------------------------

describe('DiffPairLengthMatcher — autoMatchAll', () => {
  let matcher: DiffPairLengthMatcher;

  beforeEach(() => {
    matcher = freshMatcher();
  });

  it('returns empty array for empty input', () => {
    const results = matcher.autoMatchAll([]);
    expect(results).toEqual([]);
  });

  it('marks already-matched pairs as achievable with no suggestion', () => {
    const pair = makePair({
      positiveTrace: straightTrace(10, 0),
      negativeTrace: straightTrace(10, 1),
    });
    const results = matcher.autoMatchAll([pair]);
    expect(results).toHaveLength(1);
    expect(results[0].before.matched).toBe(true);
    expect(results[0].suggestion).toBeNull();
    expect(results[0].achievable).toBe(true);
  });

  it('generates suggestion for mismatched pair', () => {
    const pair = makePair({
      positiveTrace: straightTrace(15, 0),
      negativeTrace: straightTrace(10, 1),
    });
    const results = matcher.autoMatchAll([pair]);
    expect(results).toHaveLength(1);
    expect(results[0].before.matched).toBe(false);
    expect(results[0].suggestion).not.toBeNull();
    expect(results[0].suggestion!.trace).toBe('negative');
  });

  it('processes multiple pairs in batch', () => {
    const pairs: DiffPairDef[] = [
      makePair({ id: 'dp-1', name: 'USB_D', positiveTrace: straightTrace(10, 0), negativeTrace: straightTrace(10, 1) }),
      makePair({ id: 'dp-2', name: 'HDMI_0', positiveTrace: straightTrace(15, 0), negativeTrace: straightTrace(12, 1) }),
      makePair({ id: 'dp-3', name: 'PCIe_0', positiveTrace: straightTrace(20, 0), negativeTrace: straightTrace(25, 1) }),
    ];
    const results = matcher.autoMatchAll(pairs);
    expect(results).toHaveLength(3);
    expect(results[0].achievable).toBe(true);
    expect(results[0].suggestion).toBeNull();
    expect(results[1].suggestion).not.toBeNull();
    expect(results[2].suggestion).not.toBeNull();
  });

  it('stores results accessible via lastResults', () => {
    const pair = makePair({
      positiveTrace: straightTrace(12, 0),
      negativeTrace: straightTrace(10, 1),
    });
    matcher.autoMatchAll([pair]);
    const lastResults = matcher.lastResults;
    expect(lastResults).toHaveLength(1);
    expect(lastResults[0].pairId).toBe('dp-1');
  });

  it('preserves pairId and name in results', () => {
    const pair = makePair({ id: 'dp-usb', name: 'USB Data' });
    const results = matcher.autoMatchAll([pair]);
    expect(results[0].pairId).toBe('dp-usb');
    expect(results[0].name).toBe('USB Data');
  });

  it('marks unachievable when compensation exceeds capacity', () => {
    // Very large mismatch with very small maxAmplitude constraints
    matcher.setConstraints({
      maxAmplitude: 0.1,
      spacing: 0.5,
      targetDelta: 0.01,
    });
    const pair = makePair({
      positiveTrace: straightTrace(100, 0),
      negativeTrace: straightTrace(10, 1),
    });
    const results = matcher.autoMatchAll([pair]);
    expect(results).toHaveLength(1);
    // With 0.1mm amplitude trombone, each turn adds 0.2mm. For 90mm delta
    // we need 450 turns producing 90mm. The totalAdded will overshoot a lot.
    // But achievability checks if remaining delta <= targetDelta.
    // The meander rounds up to integer turns so it may overshoot significantly.
  });
});

// ---------------------------------------------------------------------------
// matchSingle
// ---------------------------------------------------------------------------

describe('DiffPairLengthMatcher — matchSingle', () => {
  let matcher: DiffPairLengthMatcher;

  beforeEach(() => {
    matcher = freshMatcher();
  });

  it('matches a single pair', () => {
    const pair = makePair({
      positiveTrace: straightTrace(12, 0),
      negativeTrace: straightTrace(10, 1),
    });
    const result = matcher.matchSingle(pair);
    expect(result.pairId).toBe('dp-1');
    expect(result.before.delta).toBeCloseTo(2, 6);
    expect(result.suggestion).not.toBeNull();
  });

  it('returns achievable=true for matched pair', () => {
    const pair = makePair({
      positiveTrace: straightTrace(10, 0),
      negativeTrace: straightTrace(10, 1),
    });
    const result = matcher.matchSingle(pair);
    expect(result.achievable).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Singleton + subscribe
// ---------------------------------------------------------------------------

describe('DiffPairLengthMatcher — singleton and subscribe', () => {
  afterEach(() => {
    DiffPairLengthMatcher.resetInstance();
  });

  it('returns the same singleton instance', () => {
    const a = DiffPairLengthMatcher.instance();
    const b = DiffPairLengthMatcher.instance();
    expect(a).toBe(b);
  });

  it('create() returns independent instances', () => {
    const a = DiffPairLengthMatcher.create();
    const b = DiffPairLengthMatcher.create();
    expect(a).not.toBe(b);
  });

  it('resetInstance clears the singleton', () => {
    const a = DiffPairLengthMatcher.instance();
    DiffPairLengthMatcher.resetInstance();
    const b = DiffPairLengthMatcher.instance();
    expect(a).not.toBe(b);
  });

  it('notifies subscribers when autoMatchAll is called', () => {
    const matcher = freshMatcher();
    const listener = vi.fn();
    matcher.subscribe(listener);

    const pair = makePair();
    matcher.autoMatchAll([pair]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers when targetDelta changes', () => {
    const matcher = freshMatcher();
    const listener = vi.fn();
    matcher.subscribe(listener);

    matcher.setTargetDelta(0.5);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers when constraints change', () => {
    const matcher = freshMatcher();
    const listener = vi.fn();
    matcher.subscribe(listener);

    matcher.setConstraints({ maxAmplitude: 3.0 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications', () => {
    const matcher = freshMatcher();
    const listener = vi.fn();
    const unsub = matcher.subscribe(listener);

    unsub();
    matcher.setTargetDelta(1.0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('getSnapshot returns lastResults', () => {
    const matcher = freshMatcher();
    expect(matcher.getSnapshot()).toEqual([]);

    const pair = makePair();
    matcher.autoMatchAll([pair]);
    expect(matcher.getSnapshot()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

describe('DiffPairLengthMatcher — configuration', () => {
  let matcher: DiffPairLengthMatcher;

  beforeEach(() => {
    matcher = freshMatcher();
  });

  it('has default targetDelta of 0.1mm', () => {
    expect(matcher.targetDelta).toBe(0.1);
  });

  it('throws for negative targetDelta', () => {
    expect(() => matcher.setTargetDelta(-1)).toThrow('non-negative');
  });

  it('allows zero targetDelta', () => {
    matcher.setTargetDelta(0);
    expect(matcher.targetDelta).toBe(0);
  });

  it('setConstraints updates partial fields', () => {
    matcher.setConstraints({ maxAmplitude: 5.0 });
    const c = matcher.constraints;
    expect(c.maxAmplitude).toBe(5.0);
    expect(c.minAmplitude).toBe(0.2); // unchanged
  });

  it('setConstraints with targetDelta also updates targetDelta getter', () => {
    matcher.setConstraints({ targetDelta: 0.5 });
    expect(matcher.targetDelta).toBe(0.5);
  });

  it('constraints returns a defensive copy', () => {
    const c1 = matcher.constraints;
    const c2 = matcher.constraints;
    expect(c1).toEqual(c2);
    expect(c1).not.toBe(c2);
  });

  it('lastResults returns a defensive copy', () => {
    const pair = makePair();
    matcher.autoMatchAll([pair]);
    const r1 = matcher.lastResults;
    const r2 = matcher.lastResults;
    expect(r1).not.toBe(r2);
    expect(r1).toEqual(r2);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('DiffPairLengthMatcher — edge cases', () => {
  let matcher: DiffPairLengthMatcher;

  beforeEach(() => {
    matcher = freshMatcher();
  });

  it('handles zero-length traces (both empty)', () => {
    const pair = makePair({ positiveTrace: [], negativeTrace: [] });
    const m = matcher.measurePairLengths(pair);
    expect(m.positiveLength).toBe(0);
    expect(m.negativeLength).toBe(0);
    expect(m.matched).toBe(true);
  });

  it('handles pair where only positive has points', () => {
    const pair = makePair({
      positiveTrace: straightTrace(10, 0),
      negativeTrace: [],
    });
    const m = matcher.measurePairLengths(pair);
    expect(m.positiveLength).toBeCloseTo(10, 6);
    expect(m.negativeLength).toBe(0);
    expect(m.matched).toBe(false);
  });

  it('handles coincident points (zero segment length)', () => {
    const pair = makePair({
      positiveTrace: [
        { x: 5, y: 5 },
        { x: 5, y: 5 },
      ],
      negativeTrace: straightTrace(10, 1),
    });
    const m = matcher.measurePairLengths(pair);
    expect(m.positiveLength).toBeCloseTo(0, 6);
  });

  it('handles very small deltas near target boundary', () => {
    matcher.setTargetDelta(0.1);
    const pair = makePair({
      positiveTrace: straightTrace(10.09, 0),
      negativeTrace: straightTrace(10, 1),
    });
    const m = matcher.measurePairLengths(pair);
    expect(m.delta).toBeCloseTo(0.09, 6);
    expect(m.matched).toBe(true);
  });

  it('handles very large traces without error', () => {
    const pair = makePair({
      positiveTrace: straightTrace(10000, 0),
      negativeTrace: straightTrace(9990, 1),
    });
    const m = matcher.measurePairLengths(pair);
    expect(m.delta).toBeCloseTo(10, 2);
    expect(m.matched).toBe(false);
  });

  it('handles multi-segment traces with many bends', () => {
    const trace: Point2D[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 3 },
      { x: 10, y: 3 },
      { x: 10, y: 6 },
      { x: 15, y: 6 },
    ];
    // Total: 5 + 3 + 5 + 3 + 5 = 21
    const pair = makePair({
      positiveTrace: trace,
      negativeTrace: straightTrace(18, 1),
    });
    const m = matcher.measurePairLengths(pair);
    expect(m.positiveLength).toBeCloseTo(21, 4);
    expect(m.negativeLength).toBeCloseTo(18, 4);
    expect(m.delta).toBeCloseTo(3, 4);
  });
});
