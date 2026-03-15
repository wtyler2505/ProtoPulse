import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  SmartHintManager,
  useSmartHints,
  BUILT_IN_PATTERNS,
} from '../smart-hints';
import type { MistakePattern, ActiveHint } from '../smart-hints';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    get length() {
      return store.size;
    },
    key: vi.fn((_index: number) => null),
  };
}

describe('SmartHintManager', () => {
  let manager: SmartHintManager;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    SmartHintManager.resetInstance();
    manager = SmartHintManager.getInstance();
  });

  afterEach(() => {
    SmartHintManager.resetInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  it('returns the same instance on repeated calls', () => {
    const a = SmartHintManager.getInstance();
    const b = SmartHintManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetInstance', () => {
    manager.trackMistake('drc-repeated-violations');
    SmartHintManager.resetInstance();
    const fresh = SmartHintManager.getInstance();
    // fresh instance loads from localStorage
    const record = fresh.getRecord('drc-repeated-violations');
    expect(record).toBeDefined();
    expect(record?.count).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Built-in patterns
  // -----------------------------------------------------------------------

  it('registers all built-in patterns', () => {
    const patterns = manager.getAllPatterns();
    expect(patterns.length).toBeGreaterThanOrEqual(10);
    for (const bp of BUILT_IN_PATTERNS) {
      expect(manager.getPattern(bp.id)).toBeDefined();
    }
  });

  it('each built-in pattern has required fields', () => {
    for (const pattern of BUILT_IN_PATTERNS) {
      expect(pattern.id).toBeTruthy();
      expect(pattern.label).toBeTruthy();
      expect(pattern.threshold).toBeGreaterThan(0);
      expect(pattern.hint).toBeTruthy();
      expect(['info', 'warning', 'tip']).toContain(pattern.severity);
      expect(pattern.cooldownMs).toBeGreaterThan(0);
    }
  });

  // -----------------------------------------------------------------------
  // Tracking
  // -----------------------------------------------------------------------

  it('tracks a mistake and creates a record', () => {
    manager.trackMistake('drc-repeated-violations');
    const record = manager.getRecord('drc-repeated-violations');
    expect(record).toBeDefined();
    expect(record?.count).toBe(1);
    expect(record?.firstSeen).toBeGreaterThan(0);
    expect(record?.lastSeen).toBeGreaterThan(0);
  });

  it('increments count on repeated tracking', () => {
    manager.trackMistake('drc-repeated-violations');
    manager.trackMistake('drc-repeated-violations');
    manager.trackMistake('drc-repeated-violations');
    const record = manager.getRecord('drc-repeated-violations');
    expect(record?.count).toBe(3);
  });

  it('updates lastSeen on repeated tracking', () => {
    vi.useFakeTimers();
    const t1 = Date.now();
    manager.trackMistake('drc-repeated-violations');
    const record1 = manager.getRecord('drc-repeated-violations');
    expect(record1?.firstSeen).toBe(t1);

    vi.advanceTimersByTime(5000);
    manager.trackMistake('drc-repeated-violations');
    const record2 = manager.getRecord('drc-repeated-violations');
    expect(record2?.lastSeen).toBe(t1 + 5000);
    expect(record2?.firstSeen).toBe(t1);

    vi.useRealTimers();
  });

  it('silently ignores unknown pattern IDs', () => {
    manager.trackMistake('nonexistent-pattern');
    expect(manager.getRecord('nonexistent-pattern')).toBeUndefined();
    expect(manager.getAllRecords()).toHaveLength(0);
  });

  it('tracks multiple patterns independently', () => {
    manager.trackMistake('drc-repeated-violations');
    manager.trackMistake('drc-repeated-violations');
    manager.trackMistake('export-without-validation');
    expect(manager.getRecord('drc-repeated-violations')?.count).toBe(2);
    expect(manager.getRecord('export-without-validation')?.count).toBe(1);
  });

  it('getAllRecords returns all tracked records', () => {
    manager.trackMistake('drc-repeated-violations');
    manager.trackMistake('bom-missing-mpn');
    const records = manager.getAllRecords();
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.patternId)).toContain('drc-repeated-violations');
    expect(records.map((r) => r.patternId)).toContain('bom-missing-mpn');
  });

  // -----------------------------------------------------------------------
  // Active hints
  // -----------------------------------------------------------------------

  it('does not activate hint below threshold', () => {
    // drc-repeated-violations has threshold 3
    manager.trackMistake('drc-repeated-violations');
    manager.trackMistake('drc-repeated-violations');
    expect(manager.getActiveHints()).toHaveLength(0);
    expect(manager.isHintActive('drc-repeated-violations')).toBe(false);
  });

  it('activates hint at threshold', () => {
    manager.trackMistake('drc-repeated-violations');
    manager.trackMistake('drc-repeated-violations');
    manager.trackMistake('drc-repeated-violations');
    const hints = manager.getActiveHints();
    expect(hints).toHaveLength(1);
    expect(hints[0].patternId).toBe('drc-repeated-violations');
    expect(hints[0].severity).toBe('warning');
    expect(hints[0].hint).toContain('DRC violations');
    expect(manager.isHintActive('drc-repeated-violations')).toBe(true);
  });

  it('activates hint above threshold', () => {
    for (let i = 0; i < 5; i++) {
      manager.trackMistake('drc-repeated-violations');
    }
    expect(manager.getActiveHints()).toHaveLength(1);
  });

  it('activates multiple hints from different patterns', () => {
    // drc-repeated-violations: threshold 3
    for (let i = 0; i < 3; i++) {
      manager.trackMistake('drc-repeated-violations');
    }
    // export-without-validation: threshold 2
    for (let i = 0; i < 2; i++) {
      manager.trackMistake('export-without-validation');
    }
    const hints = manager.getActiveHints();
    expect(hints).toHaveLength(2);
    const ids = hints.map((h) => h.patternId);
    expect(ids).toContain('drc-repeated-violations');
    expect(ids).toContain('export-without-validation');
  });

  it('sorts active hints by most recent activation first', () => {
    vi.useFakeTimers();

    // Trigger first pattern
    for (let i = 0; i < 2; i++) {
      manager.trackMistake('export-without-validation');
    }

    vi.advanceTimersByTime(10000);

    // Trigger second pattern later
    for (let i = 0; i < 3; i++) {
      manager.trackMistake('drc-repeated-violations');
    }

    const hints = manager.getActiveHints();
    expect(hints[0].patternId).toBe('drc-repeated-violations');
    expect(hints[1].patternId).toBe('export-without-validation');

    vi.useRealTimers();
  });

  it('includes pattern metadata in active hints', () => {
    for (let i = 0; i < 3; i++) {
      manager.trackMistake('drc-repeated-violations');
    }
    const hint = manager.getActiveHints()[0];
    expect(hint.label).toBe('Repeated DRC Violations');
    expect(hint.category).toBe('validation');
    expect(hint.activatedAt).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // Dismissal
  // -----------------------------------------------------------------------

  it('dismisses an active hint', () => {
    for (let i = 0; i < 3; i++) {
      manager.trackMistake('drc-repeated-violations');
    }
    expect(manager.getActiveHints()).toHaveLength(1);

    manager.dismissHint('drc-repeated-violations');
    expect(manager.getActiveHints()).toHaveLength(0);
    expect(manager.isHintActive('drc-repeated-violations')).toBe(false);
  });

  it('resets count on dismissal', () => {
    for (let i = 0; i < 3; i++) {
      manager.trackMistake('drc-repeated-violations');
    }
    manager.dismissHint('drc-repeated-violations');
    expect(manager.getRecord('drc-repeated-violations')).toBeUndefined();
  });

  it('isDismissed returns true during cooldown', () => {
    vi.useFakeTimers();
    for (let i = 0; i < 3; i++) {
      manager.trackMistake('drc-repeated-violations');
    }
    manager.dismissHint('drc-repeated-violations');
    expect(manager.isDismissed('drc-repeated-violations')).toBe(true);
    vi.useRealTimers();
  });

  it('cooldown expires and hint can re-activate', () => {
    vi.useFakeTimers();
    const pattern = manager.getPattern('drc-repeated-violations')!;

    // Trigger and dismiss
    for (let i = 0; i < 3; i++) {
      manager.trackMistake('drc-repeated-violations');
    }
    manager.dismissHint('drc-repeated-violations');
    expect(manager.getActiveHints()).toHaveLength(0);

    // Advance past cooldown
    vi.advanceTimersByTime(pattern.cooldownMs + 1);
    expect(manager.isDismissed('drc-repeated-violations')).toBe(false);

    // Re-track to threshold
    for (let i = 0; i < 3; i++) {
      manager.trackMistake('drc-repeated-violations');
    }
    expect(manager.getActiveHints()).toHaveLength(1);

    vi.useRealTimers();
  });

  it('hint stays suppressed during cooldown even if re-tracked', () => {
    vi.useFakeTimers();
    const pattern = manager.getPattern('drc-repeated-violations')!;

    for (let i = 0; i < 3; i++) {
      manager.trackMistake('drc-repeated-violations');
    }
    manager.dismissHint('drc-repeated-violations');

    // Re-track within cooldown
    vi.advanceTimersByTime(pattern.cooldownMs / 2);
    for (let i = 0; i < 5; i++) {
      manager.trackMistake('drc-repeated-violations');
    }
    // Still suppressed because cooldown hasn't expired
    expect(manager.getActiveHints()).toHaveLength(0);

    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Reset & Clear
  // -----------------------------------------------------------------------

  it('resetPattern removes a specific pattern record', () => {
    manager.trackMistake('drc-repeated-violations');
    manager.trackMistake('export-without-validation');
    manager.resetPattern('drc-repeated-violations');
    expect(manager.getRecord('drc-repeated-violations')).toBeUndefined();
    expect(manager.getRecord('export-without-validation')).toBeDefined();
  });

  it('resetPattern is a no-op for non-existent records', () => {
    const spy = vi.fn();
    manager.subscribe(spy);
    manager.resetPattern('nonexistent');
    expect(spy).not.toHaveBeenCalled();
  });

  it('clearAll removes all records and dismissals', () => {
    for (let i = 0; i < 3; i++) {
      manager.trackMistake('drc-repeated-violations');
    }
    manager.dismissHint('drc-repeated-violations');
    manager.trackMistake('export-without-validation');

    manager.clearAll();
    expect(manager.getAllRecords()).toHaveLength(0);
    expect(manager.getActiveHints()).toHaveLength(0);
    expect(manager.isDismissed('drc-repeated-violations')).toBe(false);
  });

  it('clearAll is a no-op when already empty', () => {
    const spy = vi.fn();
    manager.subscribe(spy);
    manager.clearAll();
    expect(spy).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Custom patterns
  // -----------------------------------------------------------------------

  it('registers a custom pattern', () => {
    const custom: MistakePattern = {
      id: 'custom-test-pattern',
      label: 'Custom Test',
      threshold: 1,
      hint: 'This is a custom hint.',
      severity: 'info',
      cooldownMs: 5000,
    };
    manager.registerPattern(custom);
    expect(manager.getPattern('custom-test-pattern')).toEqual(custom);
  });

  it('custom pattern activates at its threshold', () => {
    manager.registerPattern({
      id: 'custom-low-threshold',
      label: 'Low Threshold',
      threshold: 1,
      hint: 'Triggered after 1 occurrence.',
      severity: 'tip',
      cooldownMs: 5000,
    });
    manager.trackMistake('custom-low-threshold');
    const hints = manager.getActiveHints();
    expect(hints).toHaveLength(1);
    expect(hints[0].patternId).toBe('custom-low-threshold');
  });

  it('overwrites existing pattern when registering with same ID', () => {
    const original = manager.getPattern('drc-repeated-violations')!;
    expect(original.threshold).toBe(3);

    manager.registerPattern({
      ...original,
      threshold: 10,
    });
    expect(manager.getPattern('drc-repeated-violations')?.threshold).toBe(10);
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  it('notifies subscribers on trackMistake', () => {
    const spy = vi.fn();
    manager.subscribe(spy);
    manager.trackMistake('drc-repeated-violations');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on dismissHint', () => {
    const spy = vi.fn();
    for (let i = 0; i < 3; i++) {
      manager.trackMistake('drc-repeated-violations');
    }
    manager.subscribe(spy);
    manager.dismissHint('drc-repeated-violations');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on clearAll', () => {
    manager.trackMistake('drc-repeated-violations');
    const spy = vi.fn();
    manager.subscribe(spy);
    manager.clearAll();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications', () => {
    const spy = vi.fn();
    const unsubscribe = manager.subscribe(spy);
    manager.trackMistake('drc-repeated-violations');
    expect(spy).toHaveBeenCalledTimes(1);

    unsubscribe();
    manager.trackMistake('drc-repeated-violations');
    expect(spy).toHaveBeenCalledTimes(1); // No additional call
  });

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  it('persists records to localStorage on track', () => {
    manager.trackMistake('drc-repeated-violations');
    expect(mockStorage.setItem).toHaveBeenCalled();
    const stored = JSON.parse(
      (mockStorage.setItem as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string,
    );
    expect(stored.records).toHaveLength(1);
    expect(stored.records[0].patternId).toBe('drc-repeated-violations');
  });

  it('persists dismissed state to localStorage', () => {
    for (let i = 0; i < 3; i++) {
      manager.trackMistake('drc-repeated-violations');
    }
    manager.dismissHint('drc-repeated-violations');
    const stored = JSON.parse(
      (mockStorage.setItem as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as string,
    );
    expect(stored.dismissed).toHaveLength(1);
    expect(stored.dismissed[0].patternId).toBe('drc-repeated-violations');
  });

  it('loads persisted state on construction', () => {
    // Track some mistakes
    for (let i = 0; i < 3; i++) {
      manager.trackMistake('drc-repeated-violations');
    }

    // Create new instance (loads from localStorage)
    SmartHintManager.resetInstance();
    const fresh = SmartHintManager.getInstance();
    expect(fresh.getRecord('drc-repeated-violations')?.count).toBe(3);
    expect(fresh.getActiveHints()).toHaveLength(1);
  });

  it('handles corrupt localStorage data gracefully', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('not-json{{{');
    SmartHintManager.resetInstance();
    const fresh = SmartHintManager.getInstance();
    expect(fresh.getAllRecords()).toHaveLength(0);
  });

  it('handles non-object localStorage data gracefully', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('"just a string"');
    SmartHintManager.resetInstance();
    const fresh = SmartHintManager.getInstance();
    expect(fresh.getAllRecords()).toHaveLength(0);
  });

  it('handles localStorage with invalid records gracefully', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      JSON.stringify({
        records: [{ patternId: 123, count: 'not-a-number' }, null, 'bad'],
        dismissed: [null, { patternId: 456 }],
      }),
    );
    SmartHintManager.resetInstance();
    const fresh = SmartHintManager.getInstance();
    expect(fresh.getAllRecords()).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it('handles dismissing a non-tracked pattern', () => {
    // Should not throw
    manager.dismissHint('never-tracked');
    expect(manager.getActiveHints()).toHaveLength(0);
  });

  it('getPattern returns undefined for unknown ID', () => {
    expect(manager.getPattern('nonexistent')).toBeUndefined();
  });

  it('isHintActive returns false for unknown pattern', () => {
    expect(manager.isHintActive('nonexistent')).toBe(false);
  });

  it('isDismissed returns false for unknown pattern', () => {
    expect(manager.isDismissed('nonexistent')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// useSmartHints hook
// ---------------------------------------------------------------------------

describe('useSmartHints', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    SmartHintManager.resetInstance();
  });

  afterEach(() => {
    SmartHintManager.resetInstance();
  });

  it('returns empty active hints initially', () => {
    const { result } = renderHook(() => useSmartHints());
    expect(result.current.activeHints).toHaveLength(0);
  });

  it('tracks a mistake and updates active hints', () => {
    const { result } = renderHook(() => useSmartHints());

    // Track below threshold — no hint yet
    act(() => {
      result.current.trackMistake('export-without-validation');
    });
    expect(result.current.activeHints).toHaveLength(0);

    // Reach threshold (2 for export-without-validation)
    act(() => {
      result.current.trackMistake('export-without-validation');
    });
    expect(result.current.activeHints).toHaveLength(1);
    expect(result.current.activeHints[0].patternId).toBe('export-without-validation');
  });

  it('dismisses a hint', () => {
    const { result } = renderHook(() => useSmartHints());

    // Activate hint
    act(() => {
      for (let i = 0; i < 3; i++) {
        result.current.trackMistake('drc-repeated-violations');
      }
    });
    expect(result.current.activeHints).toHaveLength(1);

    // Dismiss
    act(() => {
      result.current.dismissHint('drc-repeated-violations');
    });
    expect(result.current.activeHints).toHaveLength(0);
  });

  it('isHintActive works through the hook', () => {
    const { result } = renderHook(() => useSmartHints());

    act(() => {
      for (let i = 0; i < 3; i++) {
        result.current.trackMistake('drc-repeated-violations');
      }
    });
    expect(result.current.isHintActive('drc-repeated-violations')).toBe(true);
    expect(result.current.isHintActive('export-without-validation')).toBe(false);
  });

  it('clearAll clears all hints', () => {
    const { result } = renderHook(() => useSmartHints());

    act(() => {
      for (let i = 0; i < 3; i++) {
        result.current.trackMistake('drc-repeated-violations');
      }
      for (let i = 0; i < 2; i++) {
        result.current.trackMistake('export-without-validation');
      }
    });
    expect(result.current.activeHints).toHaveLength(2);

    act(() => {
      result.current.clearAll();
    });
    expect(result.current.activeHints).toHaveLength(0);
  });
});
