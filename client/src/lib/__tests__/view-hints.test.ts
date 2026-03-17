/**
 * Tests for view-hints.ts (BL-0313) — per-view onboarding hints for first 3 uses.
 *
 * Tests the re-export layer and exercises the ViewHintManager (aliased from
 * ViewOnboardingManager) through the BL-0313 specified API surface:
 *   - ViewHint type, VIEW_HINTS data
 *   - ViewHintManager singleton + subscribe
 *   - getHintContent, shouldShowHint, markVisited, dismiss, isDismissed, getVisitCount, reset
 *   - useViewHints hook (auto-visit, dismiss, subscribe)
 *   - Persistence, corruption recovery, edge cases
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  ViewHintManager,
  MAX_HINT_VISITS,
  VIEW_HINTS,
  useViewHints,
} from '../view-hints';
import type { ViewHint, OnboardingState } from '../view-hints';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const storageMap = new Map<string, string>();

beforeEach(() => {
  storageMap.clear();
  ViewHintManager.resetInstance();

  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
    return storageMap.get(key) ?? null;
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
    storageMap.set(key, value);
  });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
    storageMap.delete(key);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Re-export verification
// ---------------------------------------------------------------------------

describe('view-hints re-exports', () => {
  it('exports ViewHintManager as a class with getInstance', () => {
    expect(typeof ViewHintManager.getInstance).toBe('function');
    const mgr = ViewHintManager.getInstance();
    expect(mgr).toBeDefined();
  });

  it('exports MAX_HINT_VISITS as 3', () => {
    expect(MAX_HINT_VISITS).toBe(3);
  });

  it('exports VIEW_HINTS as a non-empty record', () => {
    expect(Object.keys(VIEW_HINTS).length).toBeGreaterThan(10);
  });

  it('exports useViewHints as a function', () => {
    expect(typeof useViewHints).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// ViewHintManager — getHintsForView / getHintContent
// ---------------------------------------------------------------------------

describe('ViewHintManager.getHintContent', () => {
  it('returns hints for architecture view', () => {
    const mgr = ViewHintManager.getInstance();
    const hint = mgr.getHintContent('architecture');
    expect(hint).not.toBeNull();
    expect(hint!.title).toBeTruthy();
    expect(hint!.description).toBeTruthy();
  });

  it('returns hints for schematic view', () => {
    const mgr = ViewHintManager.getInstance();
    const hint = mgr.getHintContent('schematic');
    expect(hint).not.toBeNull();
    expect(hint!.title).toContain('Schematic');
  });

  it('returns hints for breadboard view', () => {
    const mgr = ViewHintManager.getInstance();
    const hint = mgr.getHintContent('breadboard');
    expect(hint).not.toBeNull();
    expect(hint!.title).toBeTruthy();
  });

  it('returns hints for pcb view', () => {
    const mgr = ViewHintManager.getInstance();
    const hint = mgr.getHintContent('pcb');
    expect(hint).not.toBeNull();
    expect(hint!.title).toContain('PCB');
  });

  it('returns hints for procurement view', () => {
    const mgr = ViewHintManager.getInstance();
    const hint = mgr.getHintContent('procurement');
    expect(hint).not.toBeNull();
  });

  it('returns hints for validation view', () => {
    const mgr = ViewHintManager.getInstance();
    const hint = mgr.getHintContent('validation');
    expect(hint).not.toBeNull();
    expect(hint!.title).toContain('Validation');
  });

  it('returns hints for simulation view', () => {
    const mgr = ViewHintManager.getInstance();
    const hint = mgr.getHintContent('simulation');
    expect(hint).not.toBeNull();
    expect(hint!.title).toContain('Simulation');
  });

  it('returns null for unknown view', () => {
    const mgr = ViewHintManager.getInstance();
    expect(mgr.getHintContent('totally_unknown_view')).toBeNull();
  });

  it('returns null for empty string view name', () => {
    const mgr = ViewHintManager.getInstance();
    expect(mgr.getHintContent('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ViewHintManager — shouldShowHint (returns hints only if visitCount < 3)
// ---------------------------------------------------------------------------

describe('ViewHintManager.shouldShowHint', () => {
  it('returns true on first visit (count=0)', () => {
    const mgr = ViewHintManager.getInstance();
    expect(mgr.shouldShowHint('architecture')).toBe(true);
  });

  it('returns true on second visit (count=1)', () => {
    const mgr = ViewHintManager.getInstance();
    mgr.markVisited('architecture');
    expect(mgr.shouldShowHint('architecture')).toBe(true);
  });

  it('returns true on third visit (count=2)', () => {
    const mgr = ViewHintManager.getInstance();
    mgr.markVisited('pcb');
    mgr.markVisited('pcb');
    expect(mgr.shouldShowHint('pcb')).toBe(true);
  });

  it('returns false after 3 visits', () => {
    const mgr = ViewHintManager.getInstance();
    mgr.markVisited('pcb');
    mgr.markVisited('pcb');
    mgr.markVisited('pcb');
    expect(mgr.shouldShowHint('pcb')).toBe(false);
  });

  it('returns false for dismissed view regardless of visit count', () => {
    const mgr = ViewHintManager.getInstance();
    mgr.dismiss('architecture');
    expect(mgr.shouldShowHint('architecture')).toBe(false);
  });

  it('returns false for unknown views', () => {
    const mgr = ViewHintManager.getInstance();
    expect(mgr.shouldShowHint('does_not_exist')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ViewHintManager — recordVisit / getVisitCount
// ---------------------------------------------------------------------------

describe('ViewHintManager.markVisited / getVisitCount', () => {
  it('starts at 0 for unvisited view', () => {
    const mgr = ViewHintManager.getInstance();
    expect(mgr.getVisitCount('schematic')).toBe(0);
  });

  it('increments count on each visit', () => {
    const mgr = ViewHintManager.getInstance();
    mgr.markVisited('schematic');
    expect(mgr.getVisitCount('schematic')).toBe(1);
    mgr.markVisited('schematic');
    expect(mgr.getVisitCount('schematic')).toBe(2);
    mgr.markVisited('schematic');
    expect(mgr.getVisitCount('schematic')).toBe(3);
  });

  it('caps count at MAX_HINT_VISITS to avoid unbounded growth', () => {
    const mgr = ViewHintManager.getInstance();
    for (let i = 0; i < 10; i++) {
      mgr.markVisited('breadboard');
    }
    expect(mgr.getVisitCount('breadboard')).toBe(MAX_HINT_VISITS);
  });

  it('returns 0 for unknown view names', () => {
    const mgr = ViewHintManager.getInstance();
    expect(mgr.getVisitCount('nonexistent_xyz')).toBe(0);
  });

  it('tracks multiple views independently', () => {
    const mgr = ViewHintManager.getInstance();
    mgr.markVisited('architecture');
    mgr.markVisited('architecture');
    mgr.markVisited('schematic');
    expect(mgr.getVisitCount('architecture')).toBe(2);
    expect(mgr.getVisitCount('schematic')).toBe(1);
    expect(mgr.getVisitCount('pcb')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ViewHintManager — dismiss
// ---------------------------------------------------------------------------

describe('ViewHintManager.dismiss / isDismissed', () => {
  it('dismisses a view permanently', () => {
    const mgr = ViewHintManager.getInstance();
    mgr.dismiss('simulation');
    expect(mgr.isDismissed('simulation')).toBe(true);
  });

  it('dismissed view no longer shows hints', () => {
    const mgr = ViewHintManager.getInstance();
    mgr.dismiss('pcb');
    expect(mgr.shouldShowHint('pcb')).toBe(false);
  });

  it('is idempotent', () => {
    const mgr = ViewHintManager.getInstance();
    mgr.dismiss('architecture');
    mgr.dismiss('architecture');
    const state = mgr.getState();
    expect(state.dismissed.filter((v) => v === 'architecture')).toHaveLength(1);
  });

  it('does not affect other views', () => {
    const mgr = ViewHintManager.getInstance();
    mgr.dismiss('validation');
    expect(mgr.shouldShowHint('architecture')).toBe(true);
    expect(mgr.shouldShowHint('pcb')).toBe(true);
  });

  it('isDismissed returns false for non-dismissed view', () => {
    const mgr = ViewHintManager.getInstance();
    expect(mgr.isDismissed('architecture')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ViewHintManager — reset
// ---------------------------------------------------------------------------

describe('ViewHintManager.reset', () => {
  it('clears all visit counts', () => {
    const mgr = ViewHintManager.getInstance();
    mgr.markVisited('architecture');
    mgr.markVisited('pcb');
    mgr.markVisited('schematic');
    mgr.reset();
    expect(mgr.getVisitCount('architecture')).toBe(0);
    expect(mgr.getVisitCount('pcb')).toBe(0);
    expect(mgr.getVisitCount('schematic')).toBe(0);
  });

  it('clears all dismissed views', () => {
    const mgr = ViewHintManager.getInstance();
    mgr.dismiss('architecture');
    mgr.dismiss('simulation');
    mgr.reset();
    expect(mgr.isDismissed('architecture')).toBe(false);
    expect(mgr.isDismissed('simulation')).toBe(false);
  });

  it('re-enables hints after reset', () => {
    const mgr = ViewHintManager.getInstance();
    for (let i = 0; i < MAX_HINT_VISITS; i++) {
      mgr.markVisited('pcb');
    }
    expect(mgr.shouldShowHint('pcb')).toBe(false);
    mgr.reset();
    expect(mgr.shouldShowHint('pcb')).toBe(true);
  });

  it('persists reset to localStorage', () => {
    const mgr = ViewHintManager.getInstance();
    mgr.markVisited('architecture');
    mgr.dismiss('pcb');
    mgr.reset();
    const raw = storageMap.get('protopulse:view-onboarding');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as OnboardingState;
    expect(parsed.visitCounts).toEqual({});
    expect(parsed.dismissed).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Persistence — localStorage
// ---------------------------------------------------------------------------

describe('localStorage persistence', () => {
  it('persists visit counts after markVisited', () => {
    const mgr = ViewHintManager.getInstance();
    mgr.markVisited('dashboard');
    const raw = storageMap.get('protopulse:view-onboarding');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as OnboardingState;
    expect(parsed.visitCounts.dashboard).toBe(1);
  });

  it('persists dismissed views', () => {
    const mgr = ViewHintManager.getInstance();
    mgr.dismiss('breadboard');
    const raw = storageMap.get('protopulse:view-onboarding');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as OnboardingState;
    expect(parsed.dismissed).toContain('breadboard');
  });

  it('restores state from localStorage on construction', () => {
    const existingState: OnboardingState = {
      visitCounts: { architecture: 2, simulation: 1 },
      dismissed: ['pcb'],
    };
    storageMap.set('protopulse:view-onboarding', JSON.stringify(existingState));

    ViewHintManager.resetInstance();
    const mgr = ViewHintManager.getInstance();

    expect(mgr.getVisitCount('architecture')).toBe(2);
    expect(mgr.getVisitCount('simulation')).toBe(1);
    expect(mgr.isDismissed('pcb')).toBe(true);
    expect(mgr.shouldShowHint('pcb')).toBe(false);
    expect(mgr.shouldShowHint('architecture')).toBe(true); // 2 < 3
  });

  it('recovers from corrupted JSON in localStorage', () => {
    storageMap.set('protopulse:view-onboarding', '{{{{not valid json!');
    ViewHintManager.resetInstance();
    const mgr = ViewHintManager.getInstance();
    expect(mgr.getVisitCount('architecture')).toBe(0);
    expect(mgr.getState().dismissed).toEqual([]);
  });

  it('recovers from null visitCounts in localStorage', () => {
    storageMap.set('protopulse:view-onboarding', JSON.stringify({ visitCounts: null, dismissed: [] }));
    ViewHintManager.resetInstance();
    const mgr = ViewHintManager.getInstance();
    expect(mgr.getVisitCount('architecture')).toBe(0);
  });

  it('recovers from non-array dismissed in localStorage', () => {
    storageMap.set('protopulse:view-onboarding', JSON.stringify({ visitCounts: {}, dismissed: 'not-array' }));
    ViewHintManager.resetInstance();
    const mgr = ViewHintManager.getInstance();
    expect(mgr.getState().dismissed).toEqual([]);
  });

  it('recovers from missing keys in localStorage', () => {
    storageMap.set('protopulse:view-onboarding', JSON.stringify({ something: 'else' }));
    ViewHintManager.resetInstance();
    const mgr = ViewHintManager.getInstance();
    expect(mgr.getVisitCount('architecture')).toBe(0);
  });

  it('handles localStorage setItem throwing (quota exceeded)', () => {
    const mgr = ViewHintManager.getInstance();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    // Should not throw
    expect(() => {
      mgr.markVisited('architecture');
    }).not.toThrow();
    expect(mgr.getVisitCount('architecture')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Subscribe / notify
// ---------------------------------------------------------------------------

describe('subscribe', () => {
  it('notifies on markVisited', () => {
    const mgr = ViewHintManager.getInstance();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.markVisited('architecture');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies on dismiss', () => {
    const mgr = ViewHintManager.getInstance();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.dismiss('architecture');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies on reset', () => {
    const mgr = ViewHintManager.getInstance();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.reset();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', () => {
    const mgr = ViewHintManager.getInstance();
    const listener = vi.fn();
    const unsub = mgr.subscribe(listener);
    unsub();
    mgr.markVisited('architecture');
    expect(listener).not.toHaveBeenCalled();
  });

  it('supports multiple concurrent subscribers', () => {
    const mgr = ViewHintManager.getInstance();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    mgr.subscribe(listener1);
    mgr.subscribe(listener2);
    mgr.markVisited('pcb');
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it('does not notify when markVisited is at cap', () => {
    const mgr = ViewHintManager.getInstance();
    for (let i = 0; i < MAX_HINT_VISITS; i++) {
      mgr.markVisited('architecture');
    }
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.markVisited('architecture');
    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// VIEW_HINTS data coverage
// ---------------------------------------------------------------------------

describe('VIEW_HINTS data', () => {
  it('has hints for all 7 task-specified views', () => {
    const required = ['architecture', 'schematic', 'breadboard', 'pcb', 'procurement', 'validation', 'simulation'];
    for (const view of required) {
      expect(VIEW_HINTS[view], `Missing hint for ${view}`).toBeDefined();
    }
  });

  it('every hint has non-empty title and description', () => {
    for (const [key, hint] of Object.entries(VIEW_HINTS)) {
      expect(hint.title.length, `${key} title`).toBeGreaterThan(0);
      expect(hint.description.length, `${key} description`).toBeGreaterThan(0);
    }
  });

  it('has at least 20 views defined', () => {
    expect(Object.keys(VIEW_HINTS).length).toBeGreaterThanOrEqual(20);
  });

  it('ViewHint type is compatible with VIEW_HINTS values', () => {
    const hint: ViewHint = VIEW_HINTS['architecture'];
    expect(hint.title).toBeTruthy();
    expect(hint.description).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// useViewHints hook
// ---------------------------------------------------------------------------

describe('useViewHints hook', () => {
  it('returns visible=true and hint on first visit', () => {
    const { result } = renderHook(() => useViewHints('architecture'));
    expect(result.current.visible).toBe(true);
    expect(result.current.hint).not.toBeNull();
    expect(result.current.hint!.title).toBeTruthy();
  });

  it('auto-records visit on mount (visitCount=1)', () => {
    const { result } = renderHook(() => useViewHints('pcb'));
    expect(result.current.visitCount).toBe(1);
    const mgr = ViewHintManager.getInstance();
    expect(mgr.getVisitCount('pcb')).toBe(1);
  });

  it('dismiss permanently hides hint', () => {
    const { result } = renderHook(() => useViewHints('schematic'));
    expect(result.current.visible).toBe(true);
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.visible).toBe(false);
  });

  it('returns visible=false for unknown views', () => {
    const { result } = renderHook(() => useViewHints('nonexistent_view'));
    expect(result.current.visible).toBe(false);
    expect(result.current.hint).toBeNull();
  });

  it('re-renders when external markVisited happens', () => {
    const { result } = renderHook(() => useViewHints('simulation'));
    expect(result.current.visitCount).toBe(1);
    act(() => {
      ViewHintManager.getInstance().markVisited('simulation');
    });
    expect(result.current.visitCount).toBe(2);
  });

  it('visible becomes false after 3 total visits', () => {
    // Pre-set 2 visits
    const mgr = ViewHintManager.getInstance();
    mgr.markVisited('breadboard');
    mgr.markVisited('breadboard');

    // Hook mount adds the 3rd visit
    const { result } = renderHook(() => useViewHints('breadboard'));
    expect(result.current.visitCount).toBe(3);
    expect(result.current.visible).toBe(false);
  });

  it('responds to external dismiss', () => {
    const { result } = renderHook(() => useViewHints('procurement'));
    expect(result.current.visible).toBe(true);
    act(() => {
      ViewHintManager.getInstance().dismiss('procurement');
    });
    expect(result.current.visible).toBe(false);
  });

  it('responds to external reset', () => {
    const mgr = ViewHintManager.getInstance();
    for (let i = 0; i < MAX_HINT_VISITS; i++) {
      mgr.markVisited('validation');
    }
    const { result } = renderHook(() => useViewHints('validation'));
    expect(result.current.visible).toBe(false);
    act(() => {
      ViewHintManager.getInstance().reset();
    });
    // After reset, visitCount is 0 and the hook re-records a visit (1)
    // visible should be true again
    expect(result.current.visible).toBe(true);
  });

  it('handles view name change via rerender', () => {
    const { result, rerender } = renderHook(
      ({ view }: { view: string }) => useViewHints(view),
      { initialProps: { view: 'architecture' } },
    );
    expect(result.current.hint!.title).toContain('Architecture');
    rerender({ view: 'pcb' });
    expect(result.current.hint!.title).toContain('PCB');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles rapid sequential visits', () => {
    const mgr = ViewHintManager.getInstance();
    for (let i = 0; i < 100; i++) {
      mgr.markVisited('architecture');
    }
    expect(mgr.getVisitCount('architecture')).toBe(MAX_HINT_VISITS);
    expect(mgr.shouldShowHint('architecture')).toBe(false);
  });

  it('handles visiting many different views', () => {
    const mgr = ViewHintManager.getInstance();
    const views = Object.keys(VIEW_HINTS);
    for (const view of views) {
      mgr.markVisited(view);
    }
    for (const view of views) {
      expect(mgr.getVisitCount(view)).toBe(1);
      expect(mgr.shouldShowHint(view)).toBe(true);
    }
  });

  it('dismiss + reset + revisit works correctly', () => {
    const mgr = ViewHintManager.getInstance();
    mgr.dismiss('pcb');
    expect(mgr.shouldShowHint('pcb')).toBe(false);
    mgr.reset();
    expect(mgr.shouldShowHint('pcb')).toBe(true);
    mgr.markVisited('pcb');
    expect(mgr.getVisitCount('pcb')).toBe(1);
    expect(mgr.shouldShowHint('pcb')).toBe(true);
  });

  it('state snapshot reflects current state', () => {
    const mgr = ViewHintManager.getInstance();
    mgr.markVisited('architecture');
    mgr.dismiss('pcb');
    const state = mgr.getState();
    expect(state.visitCounts.architecture).toBe(1);
    expect(state.dismissed).toContain('pcb');
  });
});
