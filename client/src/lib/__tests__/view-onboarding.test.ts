/**
 * Tests for ViewOnboardingManager — per-view onboarding hints.
 *
 * Covers: singleton, visit counting, hint visibility, dismiss,
 * persistence, reset, edge cases, and the React hook.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  ViewOnboardingManager,
  MAX_HINT_VISITS,
  VIEW_HINTS,
  useViewOnboarding,
} from '../view-onboarding';
import type { OnboardingState } from '../view-onboarding';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const storageMap = new Map<string, string>();

beforeEach(() => {
  storageMap.clear();
  ViewOnboardingManager.resetInstance();

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
// Singleton
// ---------------------------------------------------------------------------

describe('ViewOnboardingManager singleton', () => {
  it('returns the same instance on repeated calls', () => {
    const a = ViewOnboardingManager.getInstance();
    const b = ViewOnboardingManager.getInstance();
    expect(a).toBe(b);
  });

  it('returns a fresh instance after resetInstance()', () => {
    const a = ViewOnboardingManager.getInstance();
    ViewOnboardingManager.resetInstance();
    const b = ViewOnboardingManager.getInstance();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Visit counting
// ---------------------------------------------------------------------------

describe('markVisited / getVisitCount', () => {
  it('starts at 0 visits for an unvisited view', () => {
    const mgr = ViewOnboardingManager.getInstance();
    expect(mgr.getVisitCount('architecture')).toBe(0);
  });

  it('increments the visit count', () => {
    const mgr = ViewOnboardingManager.getInstance();
    mgr.markVisited('architecture');
    expect(mgr.getVisitCount('architecture')).toBe(1);
    mgr.markVisited('architecture');
    expect(mgr.getVisitCount('architecture')).toBe(2);
  });

  it('caps visit count at MAX_HINT_VISITS', () => {
    const mgr = ViewOnboardingManager.getInstance();
    for (let i = 0; i < MAX_HINT_VISITS + 5; i++) {
      mgr.markVisited('schematic');
    }
    expect(mgr.getVisitCount('schematic')).toBe(MAX_HINT_VISITS);
  });

  it('tracks different views independently', () => {
    const mgr = ViewOnboardingManager.getInstance();
    mgr.markVisited('architecture');
    mgr.markVisited('architecture');
    mgr.markVisited('pcb');
    expect(mgr.getVisitCount('architecture')).toBe(2);
    expect(mgr.getVisitCount('pcb')).toBe(1);
    expect(mgr.getVisitCount('simulation')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// shouldShowHint
// ---------------------------------------------------------------------------

describe('shouldShowHint', () => {
  it('returns true for a known view with 0 visits', () => {
    const mgr = ViewOnboardingManager.getInstance();
    expect(mgr.shouldShowHint('architecture')).toBe(true);
  });

  it('returns true while visits < MAX_HINT_VISITS', () => {
    const mgr = ViewOnboardingManager.getInstance();
    for (let i = 0; i < MAX_HINT_VISITS - 1; i++) {
      mgr.markVisited('pcb');
    }
    expect(mgr.shouldShowHint('pcb')).toBe(true);
  });

  it('returns false after MAX_HINT_VISITS visits', () => {
    const mgr = ViewOnboardingManager.getInstance();
    for (let i = 0; i < MAX_HINT_VISITS; i++) {
      mgr.markVisited('pcb');
    }
    expect(mgr.shouldShowHint('pcb')).toBe(false);
  });

  it('returns false for unknown view names', () => {
    const mgr = ViewOnboardingManager.getInstance();
    expect(mgr.shouldShowHint('nonexistent_view')).toBe(false);
  });

  it('returns false for a dismissed view even with 0 visits', () => {
    const mgr = ViewOnboardingManager.getInstance();
    mgr.dismiss('architecture');
    expect(mgr.shouldShowHint('architecture')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Dismiss
// ---------------------------------------------------------------------------

describe('dismiss', () => {
  it('marks a view as dismissed', () => {
    const mgr = ViewOnboardingManager.getInstance();
    mgr.dismiss('simulation');
    expect(mgr.isDismissed('simulation')).toBe(true);
    expect(mgr.shouldShowHint('simulation')).toBe(false);
  });

  it('is idempotent — dismissing twice does not duplicate', () => {
    const mgr = ViewOnboardingManager.getInstance();
    mgr.dismiss('pcb');
    mgr.dismiss('pcb');
    const state = mgr.getState();
    expect(state.dismissed.filter((v) => v === 'pcb')).toHaveLength(1);
  });

  it('does not affect other views', () => {
    const mgr = ViewOnboardingManager.getInstance();
    mgr.dismiss('pcb');
    expect(mgr.shouldShowHint('architecture')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getHintContent
// ---------------------------------------------------------------------------

describe('getHintContent', () => {
  it('returns hint content for a known view', () => {
    const mgr = ViewOnboardingManager.getInstance();
    const content = mgr.getHintContent('architecture');
    expect(content).not.toBeNull();
    expect(content?.title).toBe('Architecture Block Diagrams');
    expect(content?.description).toBeTruthy();
  });

  it('returns null for an unknown view', () => {
    const mgr = ViewOnboardingManager.getInstance();
    expect(mgr.getHintContent('nonexistent')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

describe('persistence', () => {
  it('persists visit counts to localStorage', () => {
    const mgr = ViewOnboardingManager.getInstance();
    mgr.markVisited('dashboard');
    const raw = storageMap.get('protopulse:view-onboarding');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as OnboardingState;
    expect(parsed.visitCounts.dashboard).toBe(1);
  });

  it('persists dismissed views to localStorage', () => {
    const mgr = ViewOnboardingManager.getInstance();
    mgr.dismiss('breadboard');
    const raw = storageMap.get('protopulse:view-onboarding');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as OnboardingState;
    expect(parsed.dismissed).toContain('breadboard');
  });

  it('restores state from localStorage on construction', () => {
    const existingState: OnboardingState = {
      visitCounts: { architecture: 2, pcb: 1 },
      dismissed: ['simulation'],
    };
    storageMap.set('protopulse:view-onboarding', JSON.stringify(existingState));

    ViewOnboardingManager.resetInstance();
    const mgr = ViewOnboardingManager.getInstance();

    expect(mgr.getVisitCount('architecture')).toBe(2);
    expect(mgr.getVisitCount('pcb')).toBe(1);
    expect(mgr.isDismissed('simulation')).toBe(true);
    expect(mgr.shouldShowHint('simulation')).toBe(false);
  });

  it('handles corrupted localStorage gracefully', () => {
    storageMap.set('protopulse:view-onboarding', '{invalid json');
    ViewOnboardingManager.resetInstance();
    const mgr = ViewOnboardingManager.getInstance();
    expect(mgr.getVisitCount('architecture')).toBe(0);
    expect(mgr.getState().dismissed).toEqual([]);
  });

  it('handles partial/malformed localStorage data', () => {
    storageMap.set('protopulse:view-onboarding', JSON.stringify({ visitCounts: null, dismissed: 'not-array' }));
    ViewOnboardingManager.resetInstance();
    const mgr = ViewOnboardingManager.getInstance();
    expect(mgr.getVisitCount('anything')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

describe('reset', () => {
  it('clears all visit counts and dismissed views', () => {
    const mgr = ViewOnboardingManager.getInstance();
    mgr.markVisited('architecture');
    mgr.markVisited('pcb');
    mgr.dismiss('simulation');
    mgr.reset();

    expect(mgr.getVisitCount('architecture')).toBe(0);
    expect(mgr.getVisitCount('pcb')).toBe(0);
    expect(mgr.isDismissed('simulation')).toBe(false);
    expect(mgr.shouldShowHint('architecture')).toBe(true);
  });

  it('persists the reset to localStorage', () => {
    const mgr = ViewOnboardingManager.getInstance();
    mgr.markVisited('architecture');
    mgr.reset();
    const raw = storageMap.get('protopulse:view-onboarding');
    const parsed = JSON.parse(raw!) as OnboardingState;
    expect(parsed.visitCounts).toEqual({});
    expect(parsed.dismissed).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Subscribe / notify
// ---------------------------------------------------------------------------

describe('subscribe', () => {
  it('notifies listeners on markVisited', () => {
    const mgr = ViewOnboardingManager.getInstance();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.markVisited('pcb');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies listeners on dismiss', () => {
    const mgr = ViewOnboardingManager.getInstance();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.dismiss('pcb');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies listeners on reset', () => {
    const mgr = ViewOnboardingManager.getInstance();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.reset();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', () => {
    const mgr = ViewOnboardingManager.getInstance();
    const listener = vi.fn();
    const unsub = mgr.subscribe(listener);
    unsub();
    mgr.markVisited('pcb');
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not notify when markVisited is at cap', () => {
    const mgr = ViewOnboardingManager.getInstance();
    for (let i = 0; i < MAX_HINT_VISITS; i++) {
      mgr.markVisited('architecture');
    }
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.markVisited('architecture'); // already at cap
    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// VIEW_HINTS coverage
// ---------------------------------------------------------------------------

describe('VIEW_HINTS', () => {
  it('has hint content for all major views', () => {
    const expectedViews = [
      'dashboard', 'architecture', 'schematic', 'pcb', 'breadboard',
      'simulation', 'procurement', 'validation', 'output', 'calculators',
    ];
    for (const view of expectedViews) {
      expect(VIEW_HINTS[view]).toBeDefined();
      expect(VIEW_HINTS[view].title).toBeTruthy();
      expect(VIEW_HINTS[view].description).toBeTruthy();
    }
  });

  it('every hint has non-empty title and description', () => {
    for (const [key, hint] of Object.entries(VIEW_HINTS)) {
      expect(hint.title.length, `${key} title should be non-empty`).toBeGreaterThan(0);
      expect(hint.description.length, `${key} description should be non-empty`).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// React hook: useViewOnboarding
// ---------------------------------------------------------------------------

describe('useViewOnboarding hook', () => {
  it('returns visible=true and hint content on first visit', () => {
    const { result } = renderHook(() => useViewOnboarding('architecture'));
    expect(result.current.visible).toBe(true);
    expect(result.current.hint).not.toBeNull();
    expect(result.current.hint?.title).toBe('Architecture Block Diagrams');
  });

  it('records a visit on mount', () => {
    renderHook(() => useViewOnboarding('pcb'));
    const mgr = ViewOnboardingManager.getInstance();
    expect(mgr.getVisitCount('pcb')).toBe(1);
  });

  it('dismiss() hides the hint', () => {
    const { result } = renderHook(() => useViewOnboarding('pcb'));
    expect(result.current.visible).toBe(true);

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.visible).toBe(false);
  });

  it('returns visible=false for unknown views', () => {
    const { result } = renderHook(() => useViewOnboarding('nonexistent'));
    expect(result.current.visible).toBe(false);
    expect(result.current.hint).toBeNull();
  });

  it('returns updated visitCount after external markVisited', () => {
    const { result } = renderHook(() => useViewOnboarding('simulation'));
    // Hook itself marks 1 visit on mount
    expect(result.current.visitCount).toBe(1);

    act(() => {
      ViewOnboardingManager.getInstance().markVisited('simulation');
    });

    expect(result.current.visitCount).toBe(2);
  });
});
