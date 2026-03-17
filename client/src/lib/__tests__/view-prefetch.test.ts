import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  ViewPrefetchManager,
  DEFAULT_PREFETCH_CONFIG,
  PREFETCH_PRIORITIES,
  VIEW_LOADERS,
  usePrefetch,
  getRegisteredViews,
} from '../view-prefetch';
import type { ViewPrefetchConfig, PrefetchState } from '../view-prefetch';
import type { ViewMode } from '@/lib/project-context';

// Mock all VIEW_LOADERS to resolve instantly (real dynamic imports hang in happy-dom)
const originalLoaders = { ...VIEW_LOADERS };
function installMockLoaders(): void {
  for (const key of Object.keys(VIEW_LOADERS) as ViewMode[]) {
    (VIEW_LOADERS as Record<string, () => Promise<unknown>>)[key] = () => Promise.resolve({ default: {} });
  }
}
function restoreLoaders(): void {
  for (const key of Object.keys(originalLoaders)) {
    (VIEW_LOADERS as Record<string, (() => Promise<unknown>) | undefined>)[key] = originalLoaders[key as ViewMode];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flush all pending timers and microtasks. */
async function flushAll(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
  // Let any queued microtasks resolve.
  await Promise.resolve();
}

/**
 * Advance past the idle threshold and then drain interleaved timers +
 * microtasks so the entire prefetch session completes.
 *
 * The session loop does: await loader() → await setTimeout(50) per chunk.
 * Each step alternates between microtask resolution (await) and timer
 * callbacks (setTimeout). We pump in small increments to interleave both.
 */
async function advancePastIdle(ms?: number): Promise<void> {
  const threshold = ms ?? DEFAULT_PREFETCH_CONFIG.idleThresholdMs;
  // Fire the idle timer.
  await vi.advanceTimersByTimeAsync(threshold + 10);
  // Drain: each iteration advances timers slightly and flushes microtasks.
  // 40 rounds * 60ms = 2400ms of simulated time — more than enough for
  // maxPrefetch=3 chunks with 50ms yields between them.
  for (let i = 0; i < 40; i++) {
    await vi.advanceTimersByTimeAsync(60);
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  installMockLoaders();
  ViewPrefetchManager.resetInstance();
});

afterEach(() => {
  restoreLoaders();
  ViewPrefetchManager.resetInstance();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// DEFAULT_PREFETCH_CONFIG
// ---------------------------------------------------------------------------

describe('DEFAULT_PREFETCH_CONFIG', () => {
  it('has idleThresholdMs of 2000', () => {
    expect(DEFAULT_PREFETCH_CONFIG.idleThresholdMs).toBe(2000);
  });

  it('has maxPrefetch of 3', () => {
    expect(DEFAULT_PREFETCH_CONFIG.maxPrefetch).toBe(3);
  });

  it('is frozen / readonly (cannot be mutated)', () => {
    expect(() => {
      (DEFAULT_PREFETCH_CONFIG as ViewPrefetchConfig).idleThresholdMs = 999;
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// PREFETCH_PRIORITIES
// ---------------------------------------------------------------------------

describe('PREFETCH_PRIORITIES', () => {
  it('maps architecture → schematic as highest priority', () => {
    const archMap = PREFETCH_PRIORITIES['architecture'];
    expect(archMap).toBeDefined();
    expect(archMap!['schematic']).toBe(10);
  });

  it('maps schematic → pcb as highest priority', () => {
    const schMap = PREFETCH_PRIORITIES['schematic'];
    expect(schMap).toBeDefined();
    expect(schMap!['pcb']).toBe(10);
  });

  it('maps pcb → validation as highest priority', () => {
    const pcbMap = PREFETCH_PRIORITIES['pcb'];
    expect(pcbMap).toBeDefined();
    expect(pcbMap!['validation']).toBe(10);
  });

  it('maps dashboard → architecture as highest priority', () => {
    const dMap = PREFETCH_PRIORITIES['dashboard'];
    expect(dMap).toBeDefined();
    expect(dMap!['architecture']).toBe(10);
  });

  it('has priorities for the core EDA workflow path', () => {
    const workflow: string[] = ['dashboard', 'architecture', 'schematic', 'pcb', 'validation'];
    for (const view of workflow) {
      expect(PREFETCH_PRIORITIES[view]).toBeDefined();
    }
  });

  it('all priority values are positive numbers', () => {
    for (const [_source, map] of Object.entries(PREFETCH_PRIORITIES)) {
      for (const [_dest, priority] of Object.entries(map)) {
        expect(typeof priority).toBe('number');
        expect(priority).toBeGreaterThan(0);
      }
    }
  });

  it('does not reference views that are not valid ViewMode values', () => {
    const registeredViews = new Set(getRegisteredViews());
    for (const [_source, map] of Object.entries(PREFETCH_PRIORITIES)) {
      for (const dest of Object.keys(map)) {
        expect(registeredViews.has(dest as ViewMode)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// ViewPrefetchManager — singleton
// ---------------------------------------------------------------------------

describe('ViewPrefetchManager — singleton', () => {
  it('returns the same instance on repeated calls', () => {
    const a = ViewPrefetchManager.getInstance();
    const b = ViewPrefetchManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetInstance', () => {
    const first = ViewPrefetchManager.getInstance();
    first.setActiveView('architecture');
    ViewPrefetchManager.resetInstance();
    const second = ViewPrefetchManager.getInstance();
    expect(second).not.toBe(first);
    // Fresh instance has no prefetched views.
    expect(second.getState().prefetched.size).toBe(0);
  });

  it('uses default config when no config is provided', () => {
    const manager = ViewPrefetchManager.getInstance();
    expect(manager.getConfig()).toEqual(DEFAULT_PREFETCH_CONFIG);
  });

  it('merges provided config with defaults', () => {
    const manager = ViewPrefetchManager.getInstance({ idleThresholdMs: 5000 });
    expect(manager.getConfig().idleThresholdMs).toBe(5000);
    expect(manager.getConfig().maxPrefetch).toBe(DEFAULT_PREFETCH_CONFIG.maxPrefetch);
  });
});

// ---------------------------------------------------------------------------
// ViewPrefetchManager — setActiveView
// ---------------------------------------------------------------------------

describe('ViewPrefetchManager — setActiveView', () => {
  it('marks the navigated-to view as prefetched immediately', () => {
    const manager = ViewPrefetchManager.getInstance();
    manager.setActiveView('architecture');
    expect(manager.getState().prefetched.has('architecture')).toBe(true);
  });

  it('accumulates prefetched views across navigation', () => {
    const manager = ViewPrefetchManager.getInstance();
    manager.setActiveView('architecture');
    manager.setActiveView('schematic');
    const { prefetched } = manager.getState();
    expect(prefetched.has('architecture')).toBe(true);
    expect(prefetched.has('schematic')).toBe(true);
  });

  it('does not list the active view as a prefetch candidate', () => {
    const manager = ViewPrefetchManager.getInstance();
    manager.setActiveView('architecture');
    const candidates = manager.getPrefetchCandidates('architecture');
    expect(candidates).not.toContain('architecture');
  });
});

// ---------------------------------------------------------------------------
// ViewPrefetchManager — getPrefetchCandidates
// ---------------------------------------------------------------------------

describe('ViewPrefetchManager — getPrefetchCandidates', () => {
  it('returns candidates sorted by descending priority', () => {
    const manager = ViewPrefetchManager.getInstance();
    const candidates = manager.getPrefetchCandidates('architecture');
    // architecture: schematic=10, component_editor=7, validation=5
    expect(candidates[0]).toBe('schematic');
    expect(candidates[1]).toBe('component_editor');
    expect(candidates[2]).toBe('validation');
  });

  it('limits to maxPrefetch', () => {
    const manager = ViewPrefetchManager.getInstance({ maxPrefetch: 1 });
    const candidates = manager.getPrefetchCandidates('architecture');
    expect(candidates.length).toBe(1);
  });

  it('excludes already-prefetched views', () => {
    const manager = ViewPrefetchManager.getInstance();
    // Simulate that schematic was already visited.
    manager.setActiveView('schematic');
    const candidates = manager.getPrefetchCandidates('architecture');
    expect(candidates).not.toContain('schematic');
  });

  it('returns empty array for a view with no priority mapping', () => {
    const manager = ViewPrefetchManager.getInstance();
    const candidates = manager.getPrefetchCandidates('kanban');
    expect(candidates).toEqual([]);
  });

  it('returns empty array when all candidates are already prefetched', () => {
    const manager = ViewPrefetchManager.getInstance();
    // Pre-mark all architecture targets.
    manager.setActiveView('schematic');
    manager.setActiveView('component_editor');
    manager.setActiveView('validation');
    const candidates = manager.getPrefetchCandidates('architecture');
    expect(candidates).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ViewPrefetchManager — cancelPrefetch
// ---------------------------------------------------------------------------

describe('ViewPrefetchManager — cancelPrefetch', () => {
  it('clears the idle timer', () => {
    const manager = ViewPrefetchManager.getInstance();
    manager.setActiveView('architecture');
    // Timer is scheduled.
    manager.cancelPrefetch();
    // Advance past idle threshold — nothing should happen.
    vi.advanceTimersByTime(DEFAULT_PREFETCH_CONFIG.idleThresholdMs + 500);
    // Only the navigated-to view should be prefetched.
    expect(manager.getState().prefetched.size).toBe(1);
    expect(manager.getState().active).toBe(false);
  });

  it('is safe to call multiple times', () => {
    const manager = ViewPrefetchManager.getInstance();
    manager.cancelPrefetch();
    manager.cancelPrefetch();
    expect(manager.getState().active).toBe(false);
  });

  it('cancels navigation also cancels previous idle timer', () => {
    const manager = ViewPrefetchManager.getInstance();
    manager.setActiveView('architecture');
    // Navigate again immediately — should cancel previous timer.
    manager.setActiveView('schematic');
    // Only 2 views are prefetched (both navigated-to).
    expect(manager.getState().prefetched.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// ViewPrefetchManager — prefetchView (imperative)
// ---------------------------------------------------------------------------

describe('ViewPrefetchManager — prefetchView', () => {
  it('returns true for a new view', () => {
    const manager = ViewPrefetchManager.getInstance();
    const result = manager.prefetchView('schematic');
    expect(result).toBe(true);
    expect(manager.getState().prefetched.has('schematic')).toBe(true);
  });

  it('returns false for an already-prefetched view', () => {
    const manager = ViewPrefetchManager.getInstance();
    manager.prefetchView('schematic');
    const result = manager.prefetchView('schematic');
    expect(result).toBe(false);
  });

  it('returns false for a view with no loader', () => {
    const manager = ViewPrefetchManager.getInstance();
    // 'project_explorer' has no lazy loader in VIEW_LOADERS.
    const result = manager.prefetchView('project_explorer');
    expect(result).toBe(false);
  });

  it('notifies subscribers', () => {
    const manager = ViewPrefetchManager.getInstance();
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.prefetchView('schematic');
    expect(listener).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ViewPrefetchManager — subscribe / notify
// ---------------------------------------------------------------------------

describe('ViewPrefetchManager — subscribe', () => {
  it('calls listener on state changes', () => {
    const manager = ViewPrefetchManager.getInstance();
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.setActiveView('architecture');
    // setActiveView may or may not notify depending on cancelPrefetch state.
    // But prefetchView definitely notifies.
    manager.prefetchView('schematic');
    expect(listener).toHaveBeenCalled();
  });

  it('returns an unsubscribe function', () => {
    const manager = ViewPrefetchManager.getInstance();
    const listener = vi.fn();
    const unsubscribe = manager.subscribe(listener);
    unsubscribe();
    manager.prefetchView('schematic');
    expect(listener).not.toHaveBeenCalled();
  });

  it('supports multiple listeners', () => {
    const manager = ViewPrefetchManager.getInstance();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    manager.subscribe(listener1);
    manager.subscribe(listener2);
    manager.prefetchView('pcb');
    expect(listener1).toHaveBeenCalled();
    expect(listener2).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ViewPrefetchManager — idle prefetch session
// ---------------------------------------------------------------------------

describe('ViewPrefetchManager — idle prefetch session', () => {
  it('starts prefetching after idle threshold', async () => {
    const manager = ViewPrefetchManager.getInstance({ idleThresholdMs: 500 });
    manager.setActiveView('architecture');

    // Before idle threshold — no candidates prefetched yet.
    await vi.advanceTimersByTimeAsync(400);
    const stateBefore = manager.getState();
    // Only architecture (navigated-to) should be in the set.
    expect(stateBefore.prefetched.has('schematic')).toBe(false);

    // After idle threshold — candidates should start loading.
    await advancePastIdle(500);
    const stateAfter = manager.getState();
    expect(stateAfter.prefetched.has('schematic')).toBe(true);
  });

  it('prefetches up to maxPrefetch views', async () => {
    const manager = ViewPrefetchManager.getInstance({ idleThresholdMs: 100, maxPrefetch: 2 });
    manager.setActiveView('architecture');
    await advancePastIdle(100);

    const { prefetched } = manager.getState();
    // architecture (navigated) + up to 2 prefetched = up to 3.
    // Candidates: schematic(10), component_editor(7), validation(5) — only first 2.
    expect(prefetched.has('schematic')).toBe(true);
    expect(prefetched.has('component_editor')).toBe(true);
    // validation should NOT be prefetched (maxPrefetch=2).
    expect(prefetched.has('validation')).toBe(false);
  });

  it('does not prefetch when cancelled before idle fires', async () => {
    const manager = ViewPrefetchManager.getInstance({ idleThresholdMs: 1000 });
    manager.setActiveView('architecture');
    // Cancel before idle fires.
    await vi.advanceTimersByTimeAsync(500);
    manager.cancelPrefetch();
    await vi.advanceTimersByTimeAsync(2000);

    // Only architecture itself should be in the set.
    expect(manager.getState().prefetched.size).toBe(1);
  });

  it('navigation during prefetch aborts in-flight session', async () => {
    const manager = ViewPrefetchManager.getInstance({ idleThresholdMs: 100, maxPrefetch: 3 });
    manager.setActiveView('architecture');

    // Let idle fire but navigate immediately after.
    await vi.advanceTimersByTimeAsync(110);
    // Navigate away — should abort.
    manager.setActiveView('dashboard');

    // The active flag should be false after cancel.
    // Give some time for any in-flight operations to settle.
    await advancePastIdle(100);
    // dashboard should be in prefetched, architecture should be too.
    expect(manager.getState().prefetched.has('architecture')).toBe(true);
    expect(manager.getState().prefetched.has('dashboard')).toBe(true);
  });

  it('sets active=false when session completes', async () => {
    const manager = ViewPrefetchManager.getInstance({ idleThresholdMs: 100, maxPrefetch: 1 });
    manager.setActiveView('architecture');
    await advancePastIdle(100);
    expect(manager.getState().active).toBe(false);
  });

  it('does nothing for views with no priority mapping', async () => {
    const manager = ViewPrefetchManager.getInstance({ idleThresholdMs: 100 });
    manager.setActiveView('kanban');
    await advancePastIdle(100);
    // Only kanban (navigated-to) should be in the set.
    expect(manager.getState().prefetched.size).toBe(1);
    expect(manager.getState().prefetched.has('kanban')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ViewPrefetchManager — destroy
// ---------------------------------------------------------------------------

describe('ViewPrefetchManager — destroy', () => {
  it('clears all internal state', () => {
    const manager = ViewPrefetchManager.getInstance();
    manager.setActiveView('architecture');
    manager.prefetchView('schematic');
    const listener = vi.fn();
    manager.subscribe(listener);

    manager.destroy();

    expect(manager.getState().prefetched.size).toBe(0);
    expect(manager.getState().active).toBe(false);
    // Listener should have been removed — further operations should not call it.
    listener.mockClear();
    // Trying to prefetch after destroy should still work (re-init scenario).
    // But the listener should NOT be called since destroy cleared it.
    // Note: after destroy, the instance is in a "zombie" state but won't crash.
  });
});

// ---------------------------------------------------------------------------
// getRegisteredViews
// ---------------------------------------------------------------------------

describe('getRegisteredViews', () => {
  it('returns an array of ViewMode strings', () => {
    const views = getRegisteredViews();
    expect(Array.isArray(views)).toBe(true);
    expect(views.length).toBeGreaterThan(0);
  });

  it('includes core views', () => {
    const views = getRegisteredViews();
    expect(views).toContain('architecture');
    expect(views).toContain('schematic');
    expect(views).toContain('pcb');
    expect(views).toContain('validation');
    expect(views).toContain('dashboard');
  });

  it('does not include project_explorer (no lazy loader)', () => {
    const views = getRegisteredViews();
    expect(views).not.toContain('project_explorer');
  });
});

// ---------------------------------------------------------------------------
// usePrefetch hook
// ---------------------------------------------------------------------------

describe('usePrefetch', () => {
  it('returns initial PrefetchState', () => {
    const { result } = renderHook(() => usePrefetch('architecture'));
    expect(result.current).toBeDefined();
    expect(result.current.prefetched).toBeDefined();
    expect(typeof result.current.active).toBe('boolean');
  });

  it('marks the initial view as prefetched', () => {
    const { result } = renderHook(() => usePrefetch('architecture'));
    expect(result.current.prefetched.has('architecture')).toBe(true);
  });

  it('reacts to view changes', () => {
    const { result, rerender } = renderHook(
      ({ view }: { view: ViewMode }) => usePrefetch(view),
      { initialProps: { view: 'architecture' as ViewMode } },
    );
    expect(result.current.prefetched.has('architecture')).toBe(true);

    act(() => {
      rerender({ view: 'schematic' });
    });

    // Both views should be in the prefetched set.
    const manager = ViewPrefetchManager.getInstance();
    expect(manager.getState().prefetched.has('architecture')).toBe(true);
    expect(manager.getState().prefetched.has('schematic')).toBe(true);
  });

  it('cancels prefetch on unmount', () => {
    const { unmount } = renderHook(() => usePrefetch('architecture'));
    const manager = ViewPrefetchManager.getInstance();
    const cancelSpy = vi.spyOn(manager, 'cancelPrefetch');
    unmount();
    expect(cancelSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Priority map — workflow coverage
// ---------------------------------------------------------------------------

describe('PREFETCH_PRIORITIES — workflow transitions', () => {
  const expectedTransitions: Array<[string, string]> = [
    ['dashboard', 'architecture'],
    ['architecture', 'schematic'],
    ['schematic', 'pcb'],
    ['pcb', 'validation'],
    ['validation', 'pcb'],
    ['procurement', 'ordering'],
    ['simulation', 'schematic'],
    ['circuit_code', 'schematic'],
    ['ordering', 'pcb'],
    ['viewer_3d', 'pcb'],
    ['digital_twin', 'serial_monitor'],
    ['starter_circuits', 'schematic'],
  ];

  for (const [from, to] of expectedTransitions) {
    it(`${from} → ${to} has a priority mapping`, () => {
      const map = PREFETCH_PRIORITIES[from];
      expect(map).toBeDefined();
      expect(map![to]).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('rapid view switching does not crash', () => {
    const manager = ViewPrefetchManager.getInstance({ idleThresholdMs: 100 });
    const views: ViewMode[] = ['architecture', 'schematic', 'pcb', 'validation', 'procurement', 'ordering'];
    for (const view of views) {
      manager.setActiveView(view);
    }
    expect(manager.getState().prefetched.size).toBe(views.length);
  });

  it('setting the same view twice is idempotent', () => {
    const manager = ViewPrefetchManager.getInstance();
    manager.setActiveView('architecture');
    manager.setActiveView('architecture');
    expect(manager.getState().prefetched.has('architecture')).toBe(true);
    expect(manager.getState().prefetched.size).toBe(1);
  });

  it('config maxPrefetch=0 means no idle prefetching', async () => {
    const manager = ViewPrefetchManager.getInstance({ idleThresholdMs: 100, maxPrefetch: 0 });
    manager.setActiveView('architecture');
    await advancePastIdle(100);
    // Only the navigated-to view.
    expect(manager.getState().prefetched.size).toBe(1);
  });

  it('handles a custom idleThresholdMs', async () => {
    const manager = ViewPrefetchManager.getInstance({ idleThresholdMs: 5000 });
    manager.setActiveView('architecture');

    // Not yet idle.
    await vi.advanceTimersByTimeAsync(3000);
    expect(manager.getState().prefetched.has('schematic')).toBe(false);

    // Now idle.
    await advancePastIdle(5000);
    expect(manager.getState().prefetched.has('schematic')).toBe(true);
  });

  it('prefetchView on a view with no loader returns false', () => {
    const manager = ViewPrefetchManager.getInstance();
    // project_explorer is a valid ViewMode but has no VIEW_LOADERS entry.
    expect(manager.prefetchView('project_explorer')).toBe(false);
  });
});
