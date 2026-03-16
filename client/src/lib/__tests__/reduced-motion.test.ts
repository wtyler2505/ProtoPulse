import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  detectPrefersReducedMotion,
  ReducedMotionManager,
} from '../reduced-motion';
import type { ReducedMotionOverride } from '../reduced-motion';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-reduced-motion';

/** Create a mock MediaQueryList with controllable matches + change listener. */
function createMockMediaQueryList(matches: boolean) {
  let changeHandler: ((e: MediaQueryListEvent) => void) | null = null;
  const mql: MediaQueryList = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn((_event: string, handler: EventListenerOrEventListenerObject) => {
      changeHandler = handler as (e: MediaQueryListEvent) => void;
    }),
    removeEventListener: vi.fn((_event: string, _handler: EventListenerOrEventListenerObject) => {
      changeHandler = null;
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  };
  return {
    mql,
    /** Simulate OS preference changing at runtime. */
    simulateChange(newMatches: boolean) {
      (mql as { matches: boolean }).matches = newMatches;
      if (changeHandler) {
        changeHandler({ matches: newMatches } as MediaQueryListEvent);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  ReducedMotionManager.resetInstance();
  localStorage.clear();
  document.documentElement.classList.remove('reduced-motion');
});

afterEach(() => {
  ReducedMotionManager.resetInstance();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// detectPrefersReducedMotion
// ---------------------------------------------------------------------------

describe('detectPrefersReducedMotion', () => {
  it('returns true when OS prefers reduced motion', () => {
    const { mql } = createMockMediaQueryList(true);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    expect(detectPrefersReducedMotion()).toBe(true);
  });

  it('returns false when OS does not prefer reduced motion', () => {
    const { mql } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    expect(detectPrefersReducedMotion()).toBe(false);
  });

  it('returns false when matchMedia is unavailable', () => {
    const original = window.matchMedia;
    (window as unknown as Record<string, unknown>).matchMedia = undefined;
    expect(detectPrefersReducedMotion()).toBe(false);
    window.matchMedia = original;
  });
});

// ---------------------------------------------------------------------------
// ReducedMotionManager — Singleton
// ---------------------------------------------------------------------------

describe('ReducedMotionManager singleton', () => {
  it('returns same instance on multiple getInstance calls', () => {
    const { mql } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const a = ReducedMotionManager.getInstance();
    const b = ReducedMotionManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates new instance after resetInstance', () => {
    const { mql } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const a = ReducedMotionManager.getInstance();
    ReducedMotionManager.resetInstance();
    const b = ReducedMotionManager.getInstance();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// ReducedMotionManager — OS preference
// ---------------------------------------------------------------------------

describe('ReducedMotionManager OS preference', () => {
  it('reads OS preference on construction', () => {
    const { mql } = createMockMediaQueryList(true);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    expect(manager.getOsPreference()).toBe(true);
    expect(manager.isReducedMotion()).toBe(true);
  });

  it('defaults to false when OS does not prefer reduced motion', () => {
    const { mql } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    expect(manager.getOsPreference()).toBe(false);
    expect(manager.isReducedMotion()).toBe(false);
  });

  it('updates when OS preference changes at runtime', () => {
    const { mql, simulateChange } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    expect(manager.isReducedMotion()).toBe(false);

    simulateChange(true);
    expect(manager.getOsPreference()).toBe(true);
    expect(manager.isReducedMotion()).toBe(true);
  });

  it('notifies subscribers when OS preference changes', () => {
    const { mql, simulateChange } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    const cb = vi.fn();
    manager.subscribe(cb);

    simulateChange(true);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// ReducedMotionManager — Manual override
// ---------------------------------------------------------------------------

describe('ReducedMotionManager manual override', () => {
  it('override defaults to null (follow OS)', () => {
    const { mql } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    expect(manager.getOverride()).toBeNull();
  });

  it('setOverride(true) forces reduced motion on regardless of OS', () => {
    const { mql } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    manager.setOverride(true);
    expect(manager.isReducedMotion()).toBe(true);
    expect(manager.getOverride()).toBe(true);
  });

  it('setOverride(false) forces reduced motion off regardless of OS', () => {
    const { mql } = createMockMediaQueryList(true);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    expect(manager.isReducedMotion()).toBe(true);

    manager.setOverride(false);
    expect(manager.isReducedMotion()).toBe(false);
    expect(manager.getOverride()).toBe(false);
  });

  it('clearOverride reverts to OS preference', () => {
    const { mql } = createMockMediaQueryList(true);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    manager.setOverride(false);
    expect(manager.isReducedMotion()).toBe(false);

    manager.clearOverride();
    expect(manager.getOverride()).toBeNull();
    expect(manager.isReducedMotion()).toBe(true);
  });

  it('setOverride is idempotent (no notification on same value)', () => {
    const { mql } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    const cb = vi.fn();
    manager.subscribe(cb);

    manager.setOverride(true);
    manager.setOverride(true);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers when override changes', () => {
    const { mql } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    const cb = vi.fn();
    manager.subscribe(cb);

    manager.setOverride(true);
    expect(cb).toHaveBeenCalledTimes(1);

    manager.setOverride(false);
    expect(cb).toHaveBeenCalledTimes(2);

    manager.clearOverride();
    expect(cb).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// ReducedMotionManager — HTML class
// ---------------------------------------------------------------------------

describe('ReducedMotionManager HTML class', () => {
  it('adds .reduced-motion class when active', () => {
    const { mql } = createMockMediaQueryList(true);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    ReducedMotionManager.getInstance();
    expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);
  });

  it('does not add .reduced-motion class when inactive', () => {
    const { mql } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    ReducedMotionManager.getInstance();
    expect(document.documentElement.classList.contains('reduced-motion')).toBe(false);
  });

  it('adds class when override forces on', () => {
    const { mql } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    expect(document.documentElement.classList.contains('reduced-motion')).toBe(false);

    manager.setOverride(true);
    expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);
  });

  it('removes class when override forces off', () => {
    const { mql } = createMockMediaQueryList(true);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);

    manager.setOverride(false);
    expect(document.documentElement.classList.contains('reduced-motion')).toBe(false);
  });

  it('updates class when OS preference changes at runtime', () => {
    const { mql, simulateChange } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    ReducedMotionManager.getInstance();
    expect(document.documentElement.classList.contains('reduced-motion')).toBe(false);

    simulateChange(true);
    expect(document.documentElement.classList.contains('reduced-motion')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ReducedMotionManager — localStorage persistence
// ---------------------------------------------------------------------------

describe('ReducedMotionManager localStorage persistence', () => {
  it('persists override=true to localStorage', () => {
    const { mql } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    manager.setOverride(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('persists override=false to localStorage', () => {
    const { mql } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    manager.setOverride(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
  });

  it('removes localStorage key when override is cleared', () => {
    const { mql } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    manager.setOverride(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');

    manager.clearOverride();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('restores override from localStorage on construction', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const { mql } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    expect(manager.getOverride()).toBe(true);
    expect(manager.isReducedMotion()).toBe(true);
  });

  it('handles invalid localStorage data gracefully', () => {
    localStorage.setItem(STORAGE_KEY, '"not-a-boolean"');
    const { mql } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    expect(manager.getOverride()).toBeNull();
    // Invalid data should be cleaned up
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('handles corrupt JSON in localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, '{broken-json');
    const { mql } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    expect(manager.getOverride()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ReducedMotionManager — Subscription
// ---------------------------------------------------------------------------

describe('ReducedMotionManager subscription', () => {
  it('subscribe returns an unsubscribe function', () => {
    const { mql } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    const cb = vi.fn();
    const unsubscribe = manager.subscribe(cb);

    manager.setOverride(true);
    expect(cb).toHaveBeenCalledTimes(1);

    unsubscribe();
    manager.setOverride(false);
    expect(cb).toHaveBeenCalledTimes(1); // not called again
  });

  it('multiple subscribers are all notified', () => {
    const { mql } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    manager.subscribe(cb1);
    manager.subscribe(cb2);

    manager.setOverride(true);
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// ReducedMotionManager — destroy / cleanup
// ---------------------------------------------------------------------------

describe('ReducedMotionManager destroy', () => {
  it('removes media query listener on destroy', () => {
    const { mql, simulateChange } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    const cb = vi.fn();
    manager.subscribe(cb);

    manager.destroy();
    simulateChange(true);
    // Subscriber should NOT be called after destroy
    expect(cb).toHaveBeenCalledTimes(0);
  });

  it('resetInstance calls destroy on existing instance', () => {
    const { mql } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    const destroySpy = vi.spyOn(manager, 'destroy');
    ReducedMotionManager.resetInstance();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// ReducedMotionManager — Override interaction with OS changes
// ---------------------------------------------------------------------------

describe('ReducedMotionManager override vs OS interaction', () => {
  it('override takes precedence over OS change', () => {
    const { mql, simulateChange } = createMockMediaQueryList(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    manager.setOverride(true);

    // OS changes to false — but override should still win
    simulateChange(false);
    expect(manager.isReducedMotion()).toBe(true);

    // OS changes to true — override still wins
    simulateChange(true);
    expect(manager.isReducedMotion()).toBe(true);
  });

  it('clearing override with OS=true returns to true', () => {
    const { mql } = createMockMediaQueryList(true);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql);
    const manager = ReducedMotionManager.getInstance();
    manager.setOverride(false);
    expect(manager.isReducedMotion()).toBe(false);

    manager.clearOverride();
    expect(manager.isReducedMotion()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

describe('ReducedMotionOverride type', () => {
  it('accepts boolean or null values', () => {
    const values: ReducedMotionOverride[] = [true, false, null];
    expect(values).toEqual([true, false, null]);
  });
});
