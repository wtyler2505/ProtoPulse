import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { ImportHistoryManager, useImportHistory } from '../import-history';
import type { ImportHistoryEntry } from '../import-history';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<ImportHistoryEntry> = {}): Omit<ImportHistoryEntry, 'id'> {
  return {
    projectId: 1,
    fileName: 'test-circuit.kicad_sch',
    format: 'KiCad',
    timestamp: Date.now(),
    componentCount: 10,
    netCount: 5,
    wireCount: 8,
    warningCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  ImportHistoryManager.resetForTesting();
});

afterEach(() => {
  ImportHistoryManager.resetForTesting();
});

// ---------------------------------------------------------------------------
// ImportHistoryManager
// ---------------------------------------------------------------------------

describe('ImportHistoryManager', () => {
  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = ImportHistoryManager.getInstance();
      const b = ImportHistoryManager.getInstance();
      expect(a).toBe(b);
    });

    it('returns a new instance after resetForTesting', () => {
      const a = ImportHistoryManager.getInstance();
      ImportHistoryManager.resetForTesting();
      const b = ImportHistoryManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe('recordImport', () => {
    it('adds entry with generated UUID', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.recordImport(makeEntry());
      const history = mgr.getHistory(1);
      expect(history).toHaveLength(1);
      expect(history[0].id).toBeTruthy();
      expect(typeof history[0].id).toBe('string');
      // UUID format: 8-4-4-4-12 hex
      expect(history[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('preserves all entry fields', () => {
      const mgr = ImportHistoryManager.getInstance();
      const entry = makeEntry({
        fileName: 'board.eagle',
        format: 'Eagle',
        componentCount: 42,
        netCount: 17,
        wireCount: 30,
        warningCount: 3,
      });
      mgr.recordImport(entry);
      const [result] = mgr.getHistory(1);
      expect(result.fileName).toBe('board.eagle');
      expect(result.format).toBe('Eagle');
      expect(result.componentCount).toBe(42);
      expect(result.netCount).toBe(17);
      expect(result.wireCount).toBe(30);
      expect(result.warningCount).toBe(3);
    });

    it('stores multiple entries', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.recordImport(makeEntry({ fileName: 'a.kicad_sch' }));
      mgr.recordImport(makeEntry({ fileName: 'b.kicad_sch' }));
      mgr.recordImport(makeEntry({ fileName: 'c.kicad_sch' }));
      expect(mgr.getHistory(1)).toHaveLength(3);
    });
  });

  describe('getHistory', () => {
    it('returns entries sorted by timestamp descending (newest first)', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.recordImport(makeEntry({ fileName: 'oldest.sch', timestamp: 1000 }));
      mgr.recordImport(makeEntry({ fileName: 'newest.sch', timestamp: 3000 }));
      mgr.recordImport(makeEntry({ fileName: 'middle.sch', timestamp: 2000 }));
      const history = mgr.getHistory(1);
      expect(history[0].fileName).toBe('newest.sch');
      expect(history[1].fileName).toBe('middle.sch');
      expect(history[2].fileName).toBe('oldest.sch');
    });

    it('filters by projectId', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.recordImport(makeEntry({ projectId: 1, fileName: 'proj1.sch' }));
      mgr.recordImport(makeEntry({ projectId: 2, fileName: 'proj2.sch' }));
      mgr.recordImport(makeEntry({ projectId: 1, fileName: 'proj1b.sch' }));

      const p1 = mgr.getHistory(1);
      expect(p1).toHaveLength(2);
      expect(p1.every((e) => e.projectId === 1)).toBe(true);

      const p2 = mgr.getHistory(2);
      expect(p2).toHaveLength(1);
      expect(p2[0].fileName).toBe('proj2.sch');
    });

    it('returns empty array for unknown project', () => {
      const mgr = ImportHistoryManager.getInstance();
      expect(mgr.getHistory(999)).toEqual([]);
    });

    it('returns defensive copies', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.recordImport(makeEntry());
      const a = mgr.getHistory(1);
      const b = mgr.getHistory(1);
      expect(a).not.toBe(b);
      expect(a[0]).not.toBe(b[0]);
    });
  });

  describe('getEntry', () => {
    it('returns entry by id', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.recordImport(makeEntry({ fileName: 'target.sch' }));
      const [entry] = mgr.getHistory(1);
      const result = mgr.getEntry(entry.id);
      expect(result).toBeDefined();
      expect(result!.fileName).toBe('target.sch');
    });

    it('returns undefined for unknown id', () => {
      const mgr = ImportHistoryManager.getInstance();
      expect(mgr.getEntry('nonexistent-id')).toBeUndefined();
    });
  });

  describe('removeEntry', () => {
    it('removes a specific entry by id', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.recordImport(makeEntry({ fileName: 'keep.sch' }));
      mgr.recordImport(makeEntry({ fileName: 'remove.sch' }));
      const history = mgr.getHistory(1);
      const toRemove = history.find((e) => e.fileName === 'remove.sch')!;
      mgr.removeEntry(toRemove.id);
      const after = mgr.getHistory(1);
      expect(after).toHaveLength(1);
      expect(after[0].fileName).toBe('keep.sch');
    });

    it('is a no-op for unknown id', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.recordImport(makeEntry());
      mgr.removeEntry('nonexistent');
      expect(mgr.getHistory(1)).toHaveLength(1);
    });
  });

  describe('clearHistory', () => {
    it('removes all entries for specified project', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.recordImport(makeEntry({ projectId: 1 }));
      mgr.recordImport(makeEntry({ projectId: 1 }));
      mgr.recordImport(makeEntry({ projectId: 2 }));
      mgr.clearHistory(1);
      expect(mgr.getHistory(1)).toHaveLength(0);
      expect(mgr.getHistory(2)).toHaveLength(1);
    });

    it('is a no-op for project with no history', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.recordImport(makeEntry({ projectId: 1 }));
      mgr.clearHistory(999);
      expect(mgr.getHistory(1)).toHaveLength(1);
    });
  });

  describe('FIFO eviction', () => {
    it('evicts oldest entry when exceeding 20 per project', () => {
      const mgr = ImportHistoryManager.getInstance();
      for (let i = 0; i < 20; i++) {
        mgr.recordImport(makeEntry({ fileName: `file-${i}.sch`, timestamp: 1000 + i }));
      }
      expect(mgr.getHistory(1)).toHaveLength(20);

      // Add 21st — oldest (timestamp 1000) should be evicted
      mgr.recordImport(makeEntry({ fileName: 'file-20.sch', timestamp: 1020 }));
      const history = mgr.getHistory(1);
      expect(history).toHaveLength(20);
      expect(history.find((e) => e.fileName === 'file-0.sch')).toBeUndefined();
      expect(history.find((e) => e.fileName === 'file-20.sch')).toBeDefined();
    });

    it('eviction is per-project — other projects unaffected', () => {
      const mgr = ImportHistoryManager.getInstance();
      for (let i = 0; i < 20; i++) {
        mgr.recordImport(makeEntry({ projectId: 1, fileName: `p1-${i}.sch`, timestamp: 1000 + i }));
      }
      mgr.recordImport(makeEntry({ projectId: 2, fileName: 'p2.sch' }));

      // Add 21st to project 1
      mgr.recordImport(makeEntry({ projectId: 1, fileName: 'p1-20.sch', timestamp: 1020 }));
      expect(mgr.getHistory(1)).toHaveLength(20);
      expect(mgr.getHistory(2)).toHaveLength(1);
    });
  });

  describe('localStorage persistence', () => {
    it('saves to localStorage after recordImport', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.recordImport(makeEntry());
      const stored = localStorage.getItem('protopulse-import-history');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.entries).toHaveLength(1);
    });

    it('saves to localStorage after removeEntry', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.recordImport(makeEntry());
      const [entry] = mgr.getHistory(1);
      mgr.removeEntry(entry.id);
      const stored = JSON.parse(localStorage.getItem('protopulse-import-history')!);
      expect(stored.entries).toHaveLength(0);
    });

    it('saves to localStorage after clearHistory', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.recordImport(makeEntry());
      mgr.clearHistory(1);
      const stored = JSON.parse(localStorage.getItem('protopulse-import-history')!);
      expect(stored.entries).toHaveLength(0);
    });

    it('loads entries from localStorage on construction', () => {
      const entry: ImportHistoryEntry = {
        id: 'test-uuid-1234',
        projectId: 1,
        fileName: 'persisted.sch',
        format: 'KiCad',
        timestamp: 5000,
        componentCount: 3,
        netCount: 2,
        wireCount: 1,
        warningCount: 0,
      };
      localStorage.setItem(
        'protopulse-import-history',
        JSON.stringify({ entries: [entry] }),
      );
      ImportHistoryManager.resetForTesting();
      const mgr = ImportHistoryManager.getInstance();
      const history = mgr.getHistory(1);
      expect(history).toHaveLength(1);
      expect(history[0].fileName).toBe('persisted.sch');
      expect(history[0].id).toBe('test-uuid-1234');
    });

    it('recovers gracefully from corrupt localStorage', () => {
      localStorage.setItem('protopulse-import-history', '{{not json}}');
      ImportHistoryManager.resetForTesting();
      const mgr = ImportHistoryManager.getInstance();
      expect(mgr.getHistory(1)).toEqual([]);
    });

    it('recovers from localStorage with missing entries array', () => {
      localStorage.setItem('protopulse-import-history', JSON.stringify({ foo: 'bar' }));
      ImportHistoryManager.resetForTesting();
      const mgr = ImportHistoryManager.getInstance();
      expect(mgr.getHistory(1)).toEqual([]);
    });

    it('recovers from null localStorage value', () => {
      localStorage.removeItem('protopulse-import-history');
      ImportHistoryManager.resetForTesting();
      const mgr = ImportHistoryManager.getInstance();
      expect(mgr.getHistory(1)).toEqual([]);
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('notifies subscribers on recordImport', () => {
      const mgr = ImportHistoryManager.getInstance();
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.recordImport(makeEntry());
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers on removeEntry', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.recordImport(makeEntry());
      const listener = vi.fn();
      mgr.subscribe(listener);
      const [entry] = mgr.getHistory(1);
      mgr.removeEntry(entry.id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers on clearHistory', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.recordImport(makeEntry());
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.clearHistory(1);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stops notifying after unsubscribe', () => {
      const mgr = ImportHistoryManager.getInstance();
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);
      mgr.recordImport(makeEntry());
      expect(listener).toHaveBeenCalledTimes(1);
      unsub();
      mgr.recordImport(makeEntry());
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('supports multiple simultaneous subscribers', () => {
      const mgr = ImportHistoryManager.getInstance();
      const a = vi.fn();
      const b = vi.fn();
      mgr.subscribe(a);
      mgr.subscribe(b);
      mgr.recordImport(makeEntry());
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// useImportHistory hook
// ---------------------------------------------------------------------------

describe('useImportHistory', () => {
  it('returns empty history for project with no imports', () => {
    const { result } = renderHook(() => useImportHistory(1));
    expect(result.current.history).toEqual([]);
  });

  it('returns history for given projectId', () => {
    const mgr = ImportHistoryManager.getInstance();
    mgr.recordImport(makeEntry({ projectId: 1, fileName: 'p1.sch' }));
    mgr.recordImport(makeEntry({ projectId: 2, fileName: 'p2.sch' }));

    const { result } = renderHook(() => useImportHistory(1));
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].fileName).toBe('p1.sch');
  });

  it('re-renders on recordImport', () => {
    const { result } = renderHook(() => useImportHistory(1));
    expect(result.current.history).toHaveLength(0);

    act(() => {
      result.current.recordImport(makeEntry({ fileName: 'new.sch' }));
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].fileName).toBe('new.sch');
  });

  it('re-renders on removeEntry', () => {
    const mgr = ImportHistoryManager.getInstance();
    mgr.recordImport(makeEntry());

    const { result } = renderHook(() => useImportHistory(1));
    expect(result.current.history).toHaveLength(1);

    act(() => {
      result.current.removeEntry(result.current.history[0].id);
    });

    expect(result.current.history).toHaveLength(0);
  });

  it('re-renders on clearHistory', () => {
    const mgr = ImportHistoryManager.getInstance();
    mgr.recordImport(makeEntry());
    mgr.recordImport(makeEntry());

    const { result } = renderHook(() => useImportHistory(1));
    expect(result.current.history).toHaveLength(2);

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.history).toHaveLength(0);
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useImportHistory(1));
    // Should not throw after unmount when manager notifies
    unmount();
    const mgr = ImportHistoryManager.getInstance();
    expect(() => {
      mgr.recordImport(makeEntry());
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles empty history gracefully', () => {
    const mgr = ImportHistoryManager.getInstance();
    expect(mgr.getHistory(1)).toEqual([]);
    expect(mgr.getEntry('anything')).toBeUndefined();
    mgr.removeEntry('nonexistent');
    mgr.clearHistory(1);
    // No errors thrown
  });

  it('handles single entry correctly', () => {
    const mgr = ImportHistoryManager.getInstance();
    mgr.recordImport(makeEntry({ fileName: 'only.sch', timestamp: 100 }));
    const history = mgr.getHistory(1);
    expect(history).toHaveLength(1);
    expect(history[0].fileName).toBe('only.sch');
  });

  it('handles max capacity exactly at 20', () => {
    const mgr = ImportHistoryManager.getInstance();
    for (let i = 0; i < 20; i++) {
      mgr.recordImport(makeEntry({ fileName: `file-${i}.sch`, timestamp: 1000 + i }));
    }
    expect(mgr.getHistory(1)).toHaveLength(20);
    // All 20 should be present
    const fileNames = mgr.getHistory(1).map((e) => e.fileName);
    for (let i = 0; i < 20; i++) {
      expect(fileNames).toContain(`file-${i}.sch`);
    }
  });

  it('handles mixed projects at capacity', () => {
    const mgr = ImportHistoryManager.getInstance();
    // 20 for project 1
    for (let i = 0; i < 20; i++) {
      mgr.recordImport(makeEntry({ projectId: 1, fileName: `p1-${i}.sch`, timestamp: 1000 + i }));
    }
    // 20 for project 2
    for (let i = 0; i < 20; i++) {
      mgr.recordImport(makeEntry({ projectId: 2, fileName: `p2-${i}.sch`, timestamp: 2000 + i }));
    }
    expect(mgr.getHistory(1)).toHaveLength(20);
    expect(mgr.getHistory(2)).toHaveLength(20);

    // Add one more to project 1 — should evict oldest of project 1 only
    mgr.recordImport(makeEntry({ projectId: 1, fileName: 'p1-extra.sch', timestamp: 3000 }));
    expect(mgr.getHistory(1)).toHaveLength(20);
    expect(mgr.getHistory(2)).toHaveLength(20);
  });

  it('entries have unique IDs', () => {
    const mgr = ImportHistoryManager.getInstance();
    for (let i = 0; i < 10; i++) {
      mgr.recordImport(makeEntry({ fileName: `file-${i}.sch` }));
    }
    const ids = mgr.getHistory(1).map((e) => e.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('handles zero counts', () => {
    const mgr = ImportHistoryManager.getInstance();
    mgr.recordImport(makeEntry({
      componentCount: 0,
      netCount: 0,
      wireCount: 0,
      warningCount: 0,
    }));
    const [entry] = mgr.getHistory(1);
    expect(entry.componentCount).toBe(0);
    expect(entry.netCount).toBe(0);
    expect(entry.wireCount).toBe(0);
    expect(entry.warningCount).toBe(0);
  });
});
