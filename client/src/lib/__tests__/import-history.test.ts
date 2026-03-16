import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { ImportHistoryManager, useImportHistory } from '../import-history';
import type { ImportHistoryEntry, NewImportHistoryEntry } from '../import-history';
import type { ImportPreview } from '../import-preview';
import type { ImportFormat } from '../design-import';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePreview(overrides: Partial<ImportPreview> = {}): ImportPreview {
  return {
    addedNodes: 5,
    modifiedNodes: 0,
    removedNodes: 0,
    addedEdges: 3,
    addedComponents: 8,
    addedNets: 4,
    addedWires: 6,
    warnings: [],
    conflicts: [],
    ...overrides,
  };
}

function makeEntry(overrides: Partial<NewImportHistoryEntry> = {}): NewImportHistoryEntry {
  return {
    sourceFormat: 'kicad-schematic' as ImportFormat,
    fileName: 'test-circuit.kicad_sch',
    preview: makePreview(),
    snapshotData: { nodes: [], edges: [] },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  ImportHistoryManager.resetInstance();
});

afterEach(() => {
  ImportHistoryManager.resetInstance();
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

    it('returns a new instance after resetInstance', () => {
      const a = ImportHistoryManager.getInstance();
      ImportHistoryManager.resetInstance();
      const b = ImportHistoryManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe('addEntry', () => {
    it('adds entry with generated UUID', () => {
      const mgr = ImportHistoryManager.getInstance();
      const result = mgr.addEntry(makeEntry());
      expect(result.id).toBeTruthy();
      expect(typeof result.id).toBe('string');
      // UUID format: 8-4-4-4-12 hex
      expect(result.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('adds entry with ISO timestamp', () => {
      const mgr = ImportHistoryManager.getInstance();
      const before = new Date().toISOString();
      const result = mgr.addEntry(makeEntry());
      const after = new Date().toISOString();
      expect(result.timestamp >= before).toBe(true);
      expect(result.timestamp <= after).toBe(true);
    });

    it('preserves all entry fields', () => {
      const mgr = ImportHistoryManager.getInstance();
      const preview = makePreview({ addedComponents: 42, addedNets: 17 });
      const entry = makeEntry({
        fileName: 'board.eagle',
        sourceFormat: 'eagle-schematic',
        preview,
        snapshotData: { test: true },
      });
      const result = mgr.addEntry(entry);
      expect(result.fileName).toBe('board.eagle');
      expect(result.sourceFormat).toBe('eagle-schematic');
      expect(result.preview.addedComponents).toBe(42);
      expect(result.preview.addedNets).toBe(17);
      expect(result.snapshotData).toEqual({ test: true });
    });

    it('stores multiple entries', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.addEntry(makeEntry({ fileName: 'a.kicad_sch' }));
      mgr.addEntry(makeEntry({ fileName: 'b.kicad_sch' }));
      mgr.addEntry(makeEntry({ fileName: 'c.kicad_sch' }));
      expect(mgr.getEntries()).toHaveLength(3);
    });

    it('returns the created entry', () => {
      const mgr = ImportHistoryManager.getInstance();
      const result = mgr.addEntry(makeEntry({ fileName: 'returned.sch' }));
      expect(result.fileName).toBe('returned.sch');
      expect(result.id).toBeTruthy();
      expect(result.timestamp).toBeTruthy();
    });
  });

  describe('getEntries', () => {
    it('returns entries sorted by timestamp descending (newest first)', () => {
      const mgr = ImportHistoryManager.getInstance();
      // Add entries with slight time gaps
      mgr.addEntry(makeEntry({ fileName: 'first.sch' }));
      // Small delay to ensure different timestamps
      const entry2 = mgr.addEntry(makeEntry({ fileName: 'second.sch' }));
      const entry3 = mgr.addEntry(makeEntry({ fileName: 'third.sch' }));
      const entries = mgr.getEntries();
      // Since they're added in rapid succession, the newest should be last added
      // but getEntries sorts by timestamp descending
      expect(entries).toHaveLength(3);
      // The most recently added entries should appear first after sort
      expect(new Date(entries[0].timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(entries[entries.length - 1].timestamp).getTime(),
      );
    });

    it('returns empty array when no entries', () => {
      const mgr = ImportHistoryManager.getInstance();
      expect(mgr.getEntries()).toEqual([]);
    });

    it('returns copies (not internal references)', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.addEntry(makeEntry());
      const a = mgr.getEntries();
      const b = mgr.getEntries();
      expect(a).not.toBe(b);
    });
  });

  describe('getEntry', () => {
    it('returns entry by id', () => {
      const mgr = ImportHistoryManager.getInstance();
      const created = mgr.addEntry(makeEntry({ fileName: 'target.sch' }));
      const result = mgr.getEntry(created.id);
      expect(result).toBeDefined();
      expect(result!.fileName).toBe('target.sch');
    });

    it('returns undefined for unknown id', () => {
      const mgr = ImportHistoryManager.getInstance();
      expect(mgr.getEntry('nonexistent-id')).toBeUndefined();
    });
  });

  describe('getCount', () => {
    it('returns 0 for empty history', () => {
      const mgr = ImportHistoryManager.getInstance();
      expect(mgr.getCount()).toBe(0);
    });

    it('returns correct count after additions', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.addEntry(makeEntry());
      mgr.addEntry(makeEntry());
      expect(mgr.getCount()).toBe(2);
    });
  });

  describe('deleteEntry', () => {
    it('removes a specific entry by id', () => {
      const mgr = ImportHistoryManager.getInstance();
      const keep = mgr.addEntry(makeEntry({ fileName: 'keep.sch' }));
      const remove = mgr.addEntry(makeEntry({ fileName: 'remove.sch' }));
      mgr.deleteEntry(remove.id);
      const entries = mgr.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].fileName).toBe('keep.sch');
    });

    it('is a no-op for unknown id', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.addEntry(makeEntry());
      mgr.deleteEntry('nonexistent');
      expect(mgr.getCount()).toBe(1);
    });
  });

  describe('clear', () => {
    it('removes all entries', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.addEntry(makeEntry());
      mgr.addEntry(makeEntry());
      mgr.addEntry(makeEntry());
      mgr.clear();
      expect(mgr.getCount()).toBe(0);
      expect(mgr.getEntries()).toEqual([]);
    });

    it('is a no-op when already empty', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.clear(); // should not throw
      expect(mgr.getCount()).toBe(0);
    });
  });

  describe('FIFO eviction', () => {
    it('evicts oldest entry when exceeding 20', () => {
      const mgr = ImportHistoryManager.getInstance();
      const ids: string[] = [];
      for (let i = 0; i < 20; i++) {
        const entry = mgr.addEntry(makeEntry({ fileName: `file-${i}.sch` }));
        ids.push(entry.id);
      }
      expect(mgr.getCount()).toBe(20);

      // Add 21st — oldest should be evicted
      mgr.addEntry(makeEntry({ fileName: 'file-20.sch' }));
      expect(mgr.getCount()).toBe(20);
      // The first entry (oldest) should have been evicted
      expect(mgr.getEntry(ids[0])).toBeUndefined();
      // The newest should be present
      const entries = mgr.getEntries();
      expect(entries.some((e) => e.fileName === 'file-20.sch')).toBe(true);
    });

    it('keeps exactly MAX_ENTRIES after many additions', () => {
      const mgr = ImportHistoryManager.getInstance();
      for (let i = 0; i < 30; i++) {
        mgr.addEntry(makeEntry({ fileName: `file-${i}.sch` }));
      }
      expect(mgr.getCount()).toBe(20);
    });
  });

  describe('localStorage persistence', () => {
    it('saves to localStorage after addEntry', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.addEntry(makeEntry());
      const stored = localStorage.getItem('protopulse-import-history');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
    });

    it('saves to localStorage after deleteEntry', () => {
      const mgr = ImportHistoryManager.getInstance();
      const entry = mgr.addEntry(makeEntry());
      mgr.deleteEntry(entry.id);
      const stored = JSON.parse(localStorage.getItem('protopulse-import-history')!);
      expect(stored).toHaveLength(0);
    });

    it('saves to localStorage after clear', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.addEntry(makeEntry());
      mgr.clear();
      const stored = JSON.parse(localStorage.getItem('protopulse-import-history')!);
      expect(stored).toHaveLength(0);
    });

    it('loads entries from localStorage on construction', () => {
      const entry: ImportHistoryEntry = {
        id: 'test-uuid-1234',
        timestamp: new Date('2026-01-01').toISOString(),
        sourceFormat: 'kicad-schematic',
        fileName: 'persisted.sch',
        preview: makePreview(),
        snapshotData: null,
      };
      localStorage.setItem(
        'protopulse-import-history',
        JSON.stringify([entry]),
      );
      ImportHistoryManager.resetInstance();
      const mgr = ImportHistoryManager.getInstance();
      const entries = mgr.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].fileName).toBe('persisted.sch');
      expect(entries[0].id).toBe('test-uuid-1234');
    });

    it('recovers gracefully from corrupt localStorage', () => {
      localStorage.setItem('protopulse-import-history', '{{not json}}');
      ImportHistoryManager.resetInstance();
      const mgr = ImportHistoryManager.getInstance();
      expect(mgr.getEntries()).toEqual([]);
    });

    it('recovers from localStorage with non-array data', () => {
      localStorage.setItem('protopulse-import-history', JSON.stringify({ foo: 'bar' }));
      ImportHistoryManager.resetInstance();
      const mgr = ImportHistoryManager.getInstance();
      expect(mgr.getEntries()).toEqual([]);
    });

    it('recovers from null localStorage value', () => {
      localStorage.removeItem('protopulse-import-history');
      ImportHistoryManager.resetInstance();
      const mgr = ImportHistoryManager.getInstance();
      expect(mgr.getEntries()).toEqual([]);
    });

    it('filters out invalid entries from localStorage', () => {
      const validEntry: ImportHistoryEntry = {
        id: 'valid-uuid',
        timestamp: new Date().toISOString(),
        sourceFormat: 'kicad-schematic',
        fileName: 'valid.sch',
        preview: makePreview(),
        snapshotData: null,
      };
      const invalidEntry = { id: 123, fileName: null }; // wrong types
      localStorage.setItem(
        'protopulse-import-history',
        JSON.stringify([validEntry, invalidEntry]),
      );
      ImportHistoryManager.resetInstance();
      const mgr = ImportHistoryManager.getInstance();
      expect(mgr.getCount()).toBe(1);
      expect(mgr.getEntries()[0].fileName).toBe('valid.sch');
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('notifies subscribers on addEntry', () => {
      const mgr = ImportHistoryManager.getInstance();
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.addEntry(makeEntry());
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers on deleteEntry', () => {
      const mgr = ImportHistoryManager.getInstance();
      const entry = mgr.addEntry(makeEntry());
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.deleteEntry(entry.id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers on clear', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.addEntry(makeEntry());
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.clear();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not notify when deleteEntry finds no match', () => {
      const mgr = ImportHistoryManager.getInstance();
      mgr.addEntry(makeEntry());
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.deleteEntry('nonexistent');
      expect(listener).not.toHaveBeenCalled();
    });

    it('does not notify when clear is called on empty history', () => {
      const mgr = ImportHistoryManager.getInstance();
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.clear();
      expect(listener).not.toHaveBeenCalled();
    });

    it('stops notifying after unsubscribe', () => {
      const mgr = ImportHistoryManager.getInstance();
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);
      mgr.addEntry(makeEntry());
      expect(listener).toHaveBeenCalledTimes(1);
      unsub();
      mgr.addEntry(makeEntry());
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('supports multiple simultaneous subscribers', () => {
      const mgr = ImportHistoryManager.getInstance();
      const a = vi.fn();
      const b = vi.fn();
      mgr.subscribe(a);
      mgr.subscribe(b);
      mgr.addEntry(makeEntry());
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// useImportHistory hook
// ---------------------------------------------------------------------------

describe('useImportHistory', () => {
  it('returns empty entries for empty history', () => {
    const { result } = renderHook(() => useImportHistory());
    expect(result.current.entries).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it('returns all entries', () => {
    const mgr = ImportHistoryManager.getInstance();
    mgr.addEntry(makeEntry({ fileName: 'a.sch' }));
    mgr.addEntry(makeEntry({ fileName: 'b.sch' }));

    const { result } = renderHook(() => useImportHistory());
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.count).toBe(2);
  });

  it('re-renders on addEntry', () => {
    const { result } = renderHook(() => useImportHistory());
    expect(result.current.entries).toHaveLength(0);

    act(() => {
      result.current.addEntry(makeEntry({ fileName: 'new.sch' }));
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].fileName).toBe('new.sch');
  });

  it('re-renders on deleteEntry', () => {
    const mgr = ImportHistoryManager.getInstance();
    const entry = mgr.addEntry(makeEntry());

    const { result } = renderHook(() => useImportHistory());
    expect(result.current.entries).toHaveLength(1);

    act(() => {
      result.current.deleteEntry(entry.id);
    });

    expect(result.current.entries).toHaveLength(0);
  });

  it('re-renders on clear', () => {
    const mgr = ImportHistoryManager.getInstance();
    mgr.addEntry(makeEntry());
    mgr.addEntry(makeEntry());

    const { result } = renderHook(() => useImportHistory());
    expect(result.current.entries).toHaveLength(2);

    act(() => {
      result.current.clear();
    });

    expect(result.current.entries).toHaveLength(0);
  });

  it('getEntry retrieves by id', () => {
    const mgr = ImportHistoryManager.getInstance();
    const created = mgr.addEntry(makeEntry({ fileName: 'findme.sch' }));

    const { result } = renderHook(() => useImportHistory());
    const found = result.current.getEntry(created.id);
    expect(found).toBeDefined();
    expect(found!.fileName).toBe('findme.sch');
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useImportHistory());
    unmount();
    const mgr = ImportHistoryManager.getInstance();
    expect(() => {
      mgr.addEntry(makeEntry());
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles empty history gracefully', () => {
    const mgr = ImportHistoryManager.getInstance();
    expect(mgr.getEntries()).toEqual([]);
    expect(mgr.getEntry('anything')).toBeUndefined();
    expect(mgr.getCount()).toBe(0);
    mgr.deleteEntry('nonexistent');
    mgr.clear();
    // No errors thrown
  });

  it('handles single entry correctly', () => {
    const mgr = ImportHistoryManager.getInstance();
    const entry = mgr.addEntry(makeEntry({ fileName: 'only.sch' }));
    const entries = mgr.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].fileName).toBe('only.sch');
    expect(entries[0].id).toBe(entry.id);
  });

  it('handles max capacity exactly at 20', () => {
    const mgr = ImportHistoryManager.getInstance();
    for (let i = 0; i < 20; i++) {
      mgr.addEntry(makeEntry({ fileName: `file-${i}.sch` }));
    }
    expect(mgr.getCount()).toBe(20);
  });

  it('entries have unique IDs', () => {
    const mgr = ImportHistoryManager.getInstance();
    const created: ImportHistoryEntry[] = [];
    for (let i = 0; i < 10; i++) {
      created.push(mgr.addEntry(makeEntry({ fileName: `file-${i}.sch` })));
    }
    const ids = created.map((e) => e.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('preserves preview warnings and conflicts', () => {
    const mgr = ImportHistoryManager.getInstance();
    const preview = makePreview({
      warnings: ['Missing footprint for U1', 'Unknown pin type'],
      conflicts: ['Net name collision: VCC'],
    });
    const entry = mgr.addEntry(makeEntry({ preview }));
    const retrieved = mgr.getEntry(entry.id);
    expect(retrieved!.preview.warnings).toHaveLength(2);
    expect(retrieved!.preview.conflicts).toHaveLength(1);
  });

  it('preserves snapshot data', () => {
    const mgr = ImportHistoryManager.getInstance();
    const snapshotData = {
      nodes: [{ id: 'n1', label: 'MCU' }],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    };
    const entry = mgr.addEntry(makeEntry({ snapshotData }));
    const retrieved = mgr.getEntry(entry.id);
    expect(retrieved!.snapshotData).toEqual(snapshotData);
  });

  it('handles all supported import formats', () => {
    const mgr = ImportHistoryManager.getInstance();
    const formats: ImportFormat[] = [
      'kicad-schematic',
      'kicad-pcb',
      'kicad-symbol',
      'eagle-schematic',
      'eagle-board',
      'eagle-library',
      'altium-schematic',
      'altium-pcb',
      'geda-schematic',
      'ltspice-schematic',
      'proteus-schematic',
      'orcad-schematic',
    ];
    for (const fmt of formats) {
      mgr.addEntry(makeEntry({ sourceFormat: fmt }));
    }
    expect(mgr.getCount()).toBe(12);
    const entries = mgr.getEntries();
    const storedFormats = entries.map((e) => e.sourceFormat);
    for (const fmt of formats) {
      expect(storedFormats).toContain(fmt);
    }
  });
});
