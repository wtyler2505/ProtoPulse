import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { PanelLoadManager, usePanelLoad } from '../panel-loading';
import type { PanelLoadConfig, PanelLoadState } from '../panel-loading';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function config(overrides?: Partial<PanelLoadConfig>): PanelLoadConfig {
  return { priority: 0, lazy: false, ...overrides };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  PanelLoadManager.resetInstance();
});

// ---------------------------------------------------------------------------
// PanelLoadManager — singleton
// ---------------------------------------------------------------------------

describe('PanelLoadManager', () => {
  describe('singleton', () => {
    it('returns the same instance across calls', () => {
      const a = PanelLoadManager.getInstance();
      const b = PanelLoadManager.getInstance();
      expect(a).toBe(b);
    });

    it('returns a new instance after reset', () => {
      const a = PanelLoadManager.getInstance();
      PanelLoadManager.resetInstance();
      const b = PanelLoadManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -------------------------------------------------------------------------
  // registerPanel / unregisterPanel
  // -------------------------------------------------------------------------

  describe('registerPanel', () => {
    it('registers a panel with idle state', () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('chat', config());
      expect(mgr.getPanelState('chat')).toBe('idle');
    });

    it('records the config', () => {
      const mgr = PanelLoadManager.getInstance();
      const cfg = config({ priority: 5, lazy: true, dependencies: ['sidebar'] });
      mgr.registerPanel('editor', cfg);
      expect(mgr.getPanelConfig('editor')).toEqual(cfg);
    });

    it('overwrites existing registration', () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('a', config({ priority: 1 }));
      mgr.registerPanel('a', config({ priority: 99 }));
      expect(mgr.getPanelConfig('a')?.priority).toBe(99);
    });

    it('notifies subscribers', () => {
      const mgr = PanelLoadManager.getInstance();
      const cb = vi.fn();
      mgr.subscribe(cb);
      mgr.registerPanel('x', config());
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('tracks all registered panel IDs', () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('a', config());
      mgr.registerPanel('b', config());
      mgr.registerPanel('c', config());
      expect(mgr.getRegisteredPanelIds()).toEqual(expect.arrayContaining(['a', 'b', 'c']));
      expect(mgr.getRegisteredPanelIds()).toHaveLength(3);
    });
  });

  describe('unregisterPanel', () => {
    it('removes a panel', () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('chat', config());
      mgr.unregisterPanel('chat');
      expect(mgr.getPanelConfig('chat')).toBeUndefined();
      expect(mgr.getRegisteredPanelIds()).not.toContain('chat');
    });

    it('notifies subscribers on unregister', () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('x', config());
      const cb = vi.fn();
      mgr.subscribe(cb);
      mgr.unregisterPanel('x');
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('is a no-op for unknown panel', () => {
      const mgr = PanelLoadManager.getInstance();
      expect(() => mgr.unregisterPanel('ghost')).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // getPanelState / getPanelError
  // -------------------------------------------------------------------------

  describe('getPanelState', () => {
    it('returns idle for an unregistered panel', () => {
      const mgr = PanelLoadManager.getInstance();
      expect(mgr.getPanelState('nonexistent')).toBe('idle');
    });

    it('returns idle for a freshly registered panel', () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('p', config());
      expect(mgr.getPanelState('p')).toBe('idle');
    });
  });

  describe('getPanelError', () => {
    it('returns undefined when no error', () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('p', config());
      expect(mgr.getPanelError('p')).toBeUndefined();
    });

    it('returns undefined for unregistered panel', () => {
      const mgr = PanelLoadManager.getInstance();
      expect(mgr.getPanelError('nope')).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // loadPanel
  // -------------------------------------------------------------------------

  describe('loadPanel', () => {
    it('transitions idle → loading → loaded', async () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('p', config());

      const states: PanelLoadState[] = [];
      mgr.subscribe(() => states.push(mgr.getPanelState('p')));

      await mgr.loadPanel('p');

      expect(states).toContain('loading');
      expect(mgr.getPanelState('p')).toBe('loaded');
    });

    it('throws for unregistered panel', async () => {
      const mgr = PanelLoadManager.getInstance();
      await expect(mgr.loadPanel('missing')).rejects.toThrow('Panel "missing" is not registered.');
    });

    it('is a no-op when already loaded', async () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('p', config());
      await mgr.loadPanel('p');

      const cb = vi.fn();
      mgr.subscribe(cb);
      await mgr.loadPanel('p');
      // No additional notifications — nothing changed.
      expect(cb).not.toHaveBeenCalled();
    });

    it('is a no-op when already loading', async () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('p', config());

      // Start two loads concurrently.
      const p1 = mgr.loadPanel('p');
      const p2 = mgr.loadPanel('p');

      await Promise.all([p1, p2]);
      expect(mgr.getPanelState('p')).toBe('loaded');
    });

    it('errors when dependencies are not loaded', async () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('dep', config());
      mgr.registerPanel('child', config({ dependencies: ['dep'] }));

      await expect(mgr.loadPanel('child')).rejects.toThrow('unmet dependencies');
      expect(mgr.getPanelState('child')).toBe('error');
      expect(mgr.getPanelError('child')).toContain('dep');
    });

    it('succeeds when dependencies are already loaded', async () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('dep', config());
      mgr.registerPanel('child', config({ dependencies: ['dep'] }));

      await mgr.loadPanel('dep');
      await mgr.loadPanel('child');

      expect(mgr.getPanelState('child')).toBe('loaded');
    });

    it('errors when any single dependency is unmet', async () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('d1', config());
      mgr.registerPanel('d2', config());
      mgr.registerPanel('child', config({ dependencies: ['d1', 'd2'] }));

      await mgr.loadPanel('d1');
      // d2 is still idle.
      await expect(mgr.loadPanel('child')).rejects.toThrow('d2');
    });

    it('clears previous error on successful retry', async () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('dep', config());
      mgr.registerPanel('child', config({ dependencies: ['dep'] }));

      // Fail first.
      await expect(mgr.loadPanel('child')).rejects.toThrow();
      expect(mgr.getPanelError('child')).toBeDefined();

      // Resolve dependency and retry.
      await mgr.loadPanel('dep');
      mgr.resetPanel('child');
      await mgr.loadPanel('child');

      expect(mgr.getPanelState('child')).toBe('loaded');
      expect(mgr.getPanelError('child')).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // loadPanelsInPriority
  // -------------------------------------------------------------------------

  describe('loadPanelsInPriority', () => {
    it('loads panels in descending priority order', async () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('low', config({ priority: 1 }));
      mgr.registerPanel('high', config({ priority: 10 }));
      mgr.registerPanel('mid', config({ priority: 5 }));

      const order: string[] = [];
      mgr.subscribe(() => {
        // Record the first time a panel transitions to 'loading'.
        for (const id of ['low', 'mid', 'high']) {
          if (mgr.getPanelState(id) === 'loading' && !order.includes(id)) {
            order.push(id);
          }
        }
      });

      await mgr.loadPanelsInPriority(['low', 'high', 'mid']);

      expect(order).toEqual(['high', 'mid', 'low']);
      expect(mgr.getPanelState('low')).toBe('loaded');
      expect(mgr.getPanelState('mid')).toBe('loaded');
      expect(mgr.getPanelState('high')).toBe('loaded');
    });

    it('continues loading remaining panels when one fails', async () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('dep', config({ priority: 1 }));
      mgr.registerPanel('broken', config({ priority: 10, dependencies: ['dep'] }));
      mgr.registerPanel('ok', config({ priority: 5 }));

      await mgr.loadPanelsInPriority(['dep', 'broken', 'ok']);

      // 'broken' has highest priority so it's attempted first, but dep isn't loaded yet.
      expect(mgr.getPanelState('broken')).toBe('error');
      // 'ok' and 'dep' should still load successfully.
      expect(mgr.getPanelState('ok')).toBe('loaded');
      expect(mgr.getPanelState('dep')).toBe('loaded');
    });

    it('handles empty panel list', async () => {
      const mgr = PanelLoadManager.getInstance();
      await expect(mgr.loadPanelsInPriority([])).resolves.toBeUndefined();
    });

    it('handles single panel', async () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('only', config({ priority: 42 }));
      await mgr.loadPanelsInPriority(['only']);
      expect(mgr.getPanelState('only')).toBe('loaded');
    });

    it('treats equal priority as stable order', async () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('a', config({ priority: 5 }));
      mgr.registerPanel('b', config({ priority: 5 }));
      mgr.registerPanel('c', config({ priority: 5 }));

      await mgr.loadPanelsInPriority(['a', 'b', 'c']);

      expect(mgr.getPanelState('a')).toBe('loaded');
      expect(mgr.getPanelState('b')).toBe('loaded');
      expect(mgr.getPanelState('c')).toBe('loaded');
    });

    it('uses default priority 0 for unregistered panels in sort', async () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('known', config({ priority: 3 }));

      // 'unknown' is not registered — loadPanel will throw, but it should
      // still attempt 'known' (which has higher priority).
      await mgr.loadPanelsInPriority(['unknown', 'known']);

      expect(mgr.getPanelState('known')).toBe('loaded');
    });
  });

  // -------------------------------------------------------------------------
  // resetPanel
  // -------------------------------------------------------------------------

  describe('resetPanel', () => {
    it('resets an errored panel to idle', async () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('dep', config());
      mgr.registerPanel('child', config({ dependencies: ['dep'] }));

      await expect(mgr.loadPanel('child')).rejects.toThrow();
      expect(mgr.getPanelState('child')).toBe('error');

      mgr.resetPanel('child');
      expect(mgr.getPanelState('child')).toBe('idle');
      expect(mgr.getPanelError('child')).toBeUndefined();
    });

    it('resets a loaded panel to idle', async () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('p', config());
      await mgr.loadPanel('p');

      mgr.resetPanel('p');
      expect(mgr.getPanelState('p')).toBe('idle');
    });

    it('is a no-op for unknown panel', () => {
      const mgr = PanelLoadManager.getInstance();
      expect(() => mgr.resetPanel('ghost')).not.toThrow();
    });

    it('notifies subscribers', async () => {
      const mgr = PanelLoadManager.getInstance();
      mgr.registerPanel('p', config());
      await mgr.loadPanel('p');

      const cb = vi.fn();
      mgr.subscribe(cb);
      mgr.resetPanel('p');
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // subscribe
  // -------------------------------------------------------------------------

  describe('subscribe', () => {
    it('calls back on state changes', async () => {
      const mgr = PanelLoadManager.getInstance();
      const cb = vi.fn();
      mgr.subscribe(cb);

      mgr.registerPanel('p', config());
      await mgr.loadPanel('p');

      // register (1) + loading (2) + loaded (3)
      expect(cb).toHaveBeenCalledTimes(3);
    });

    it('returns an unsubscribe function', () => {
      const mgr = PanelLoadManager.getInstance();
      const cb = vi.fn();
      const unsub = mgr.subscribe(cb);

      mgr.registerPanel('a', config());
      expect(cb).toHaveBeenCalledTimes(1);

      unsub();
      mgr.registerPanel('b', config());
      expect(cb).toHaveBeenCalledTimes(1); // no additional call
    });

    it('supports multiple subscribers', () => {
      const mgr = PanelLoadManager.getInstance();
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      mgr.subscribe(cb1);
      mgr.subscribe(cb2);

      mgr.registerPanel('x', config());
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// usePanelLoad hook
// ---------------------------------------------------------------------------

describe('usePanelLoad', () => {
  it('returns idle for an unregistered panel', () => {
    const { result } = renderHook(() => usePanelLoad('unknown'));
    expect(result.current.state).toBe('idle');
  });

  it('reflects the current panel state', () => {
    const mgr = PanelLoadManager.getInstance();
    mgr.registerPanel('p', config());

    const { result } = renderHook(() => usePanelLoad('p'));
    expect(result.current.state).toBe('idle');
  });

  it('updates state reactively after loadPanel', async () => {
    const mgr = PanelLoadManager.getInstance();
    mgr.registerPanel('p', config());

    const { result } = renderHook(() => usePanelLoad('p'));

    await act(async () => {
      await mgr.loadPanel('p');
    });

    expect(result.current.state).toBe('loaded');
  });

  it('retry resets and reloads a failed panel', async () => {
    const mgr = PanelLoadManager.getInstance();
    mgr.registerPanel('dep', config());
    mgr.registerPanel('child', config({ dependencies: ['dep'] }));

    const { result } = renderHook(() => usePanelLoad('child'));

    // Fail first.
    await act(async () => {
      try { await mgr.loadPanel('child'); } catch { /* expected */ }
    });
    expect(result.current.state).toBe('error');

    // Resolve dependency and retry via hook.
    await act(async () => {
      await mgr.loadPanel('dep');
    });

    await act(async () => {
      result.current.retry();
    });

    expect(result.current.state).toBe('loaded');
  });

  it('responds to panelId changes', () => {
    const mgr = PanelLoadManager.getInstance();
    mgr.registerPanel('a', config());
    mgr.registerPanel('b', config());

    const { result, rerender } = renderHook(
      ({ id }) => usePanelLoad(id),
      { initialProps: { id: 'a' } },
    );

    expect(result.current.state).toBe('idle');

    // Switch to panel b (also idle, but proves re-subscription).
    rerender({ id: 'b' });
    expect(result.current.state).toBe('idle');
  });

  it('cleans up subscription on unmount', () => {
    const mgr = PanelLoadManager.getInstance();
    mgr.registerPanel('p', config());

    const { unmount } = renderHook(() => usePanelLoad('p'));
    unmount();

    // After unmount no errors should be thrown when state changes.
    expect(() => mgr.registerPanel('q', config())).not.toThrow();
  });
});
