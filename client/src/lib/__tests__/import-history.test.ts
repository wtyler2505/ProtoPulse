import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ImportHistoryManager } from '@/lib/import-history';
import type { NewImportHistoryEntry, ImportHistoryEntry } from '@/lib/import-history';
import type { ImportPreview } from '@/lib/import-preview';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePreview(overrides: Partial<ImportPreview> = {}): ImportPreview {
  return {
    addedNodes: 3,
    modifiedNodes: 0,
    removedNodes: 0,
    addedEdges: 2,
    addedComponents: 1,
    addedNets: 1,
    addedWires: 0,
    warnings: [],
    conflicts: [],
    ...overrides,
  };
}

function makeEntry(overrides: Partial<NewImportHistoryEntry> = {}): NewImportHistoryEntry {
  return {
    sourceFormat: 'kicad-schematic',
    fileName: 'circuit.kicad_sch',
    preview: makePreview(),
    snapshotData: { nodes: [], edges: [], bomItems: [] },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImportHistoryManager', () => {
  beforeEach(() => {
    ImportHistoryManager.resetInstance();
    localStorage.clear();
  });

  // -------------------------------------------------------------------------
  // Singleton
  // -------------------------------------------------------------------------

  it('returns the same instance via getInstance()', () => {
    const a = ImportHistoryManager.getInstance();
    const b = ImportHistoryManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a new instance after resetInstance()', () => {
    const a = ImportHistoryManager.getInstance();
    ImportHistoryManager.resetInstance();
    const b = ImportHistoryManager.getInstance();
    expect(a).not.toBe(b);
  });

  // -------------------------------------------------------------------------
  // addEntry
  // -------------------------------------------------------------------------

  it('adds an entry and assigns id + timestamp', () => {
    const mgr = ImportHistoryManager.getInstance();
    const entry = mgr.addEntry(makeEntry());
    expect(entry.id).toBeTruthy();
    expect(entry.timestamp).toBeTruthy();
    expect(entry.sourceFormat).toBe('kicad-schematic');
    expect(entry.fileName).toBe('circuit.kicad_sch');
    expect(mgr.getCount()).toBe(1);
  });

  it('preserves preview and snapshotData', () => {
    const mgr = ImportHistoryManager.getInstance();
    const snapshot = { nodes: [{ id: '1' }], edges: [], bomItems: [] };
    const preview = makePreview({ addedNodes: 5, warnings: ['test warning'] });
    const entry = mgr.addEntry(makeEntry({ preview, snapshotData: snapshot }));
    expect(entry.preview.addedNodes).toBe(5);
    expect(entry.preview.warnings).toEqual(['test warning']);
    expect(entry.snapshotData).toEqual(snapshot);
  });

  it('returns entries newest-first', () => {
    const mgr = ImportHistoryManager.getInstance();
    mgr.addEntry(makeEntry({ fileName: 'first.kicad_sch' }));
    mgr.addEntry(makeEntry({ fileName: 'second.kicad_sch' }));
    const entries = mgr.getEntries();
    expect(entries[0].fileName).toBe('second.kicad_sch');
    expect(entries[1].fileName).toBe('first.kicad_sch');
  });

  it('evicts the oldest entry when exceeding max (20)', () => {
    const mgr = ImportHistoryManager.getInstance();
    for (let i = 0; i < 21; i++) {
      mgr.addEntry(makeEntry({ fileName: `file-${String(i)}.sch` }));
    }
    expect(mgr.getCount()).toBe(20);
    // The very first entry should have been evicted
    const entries = mgr.getEntries();
    const fileNames = entries.map((e) => e.fileName);
    expect(fileNames).not.toContain('file-0.sch');
    expect(fileNames).toContain('file-20.sch');
  });

  // -------------------------------------------------------------------------
  // getEntry
  // -------------------------------------------------------------------------

  it('returns an entry by id', () => {
    const mgr = ImportHistoryManager.getInstance();
    const entry = mgr.addEntry(makeEntry({ fileName: 'target.sch' }));
    const found = mgr.getEntry(entry.id);
    expect(found).toBeDefined();
    expect(found?.fileName).toBe('target.sch');
  });

  it('returns undefined for unknown id', () => {
    const mgr = ImportHistoryManager.getInstance();
    expect(mgr.getEntry('nonexistent')).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // deleteEntry
  // -------------------------------------------------------------------------

  it('deletes an entry by id', () => {
    const mgr = ImportHistoryManager.getInstance();
    const entry = mgr.addEntry(makeEntry());
    expect(mgr.getCount()).toBe(1);
    mgr.deleteEntry(entry.id);
    expect(mgr.getCount()).toBe(0);
    expect(mgr.getEntry(entry.id)).toBeUndefined();
  });

  it('no-ops when deleting a nonexistent id', () => {
    const mgr = ImportHistoryManager.getInstance();
    mgr.addEntry(makeEntry());
    mgr.deleteEntry('nonexistent');
    expect(mgr.getCount()).toBe(1);
  });

  // -------------------------------------------------------------------------
  // clear
  // -------------------------------------------------------------------------

  it('clears all entries', () => {
    const mgr = ImportHistoryManager.getInstance();
    mgr.addEntry(makeEntry());
    mgr.addEntry(makeEntry());
    mgr.clear();
    expect(mgr.getCount()).toBe(0);
    expect(mgr.getEntries()).toEqual([]);
  });

  it('no-ops when clearing an already empty list', () => {
    const mgr = ImportHistoryManager.getInstance();
    const cb = vi.fn();
    mgr.subscribe(cb);
    mgr.clear();
    expect(cb).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------------------

  it('notifies subscribers on addEntry', () => {
    const mgr = ImportHistoryManager.getInstance();
    const cb = vi.fn();
    mgr.subscribe(cb);
    mgr.addEntry(makeEntry());
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on deleteEntry', () => {
    const mgr = ImportHistoryManager.getInstance();
    const entry = mgr.addEntry(makeEntry());
    const cb = vi.fn();
    mgr.subscribe(cb);
    mgr.deleteEntry(entry.id);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on clear', () => {
    const mgr = ImportHistoryManager.getInstance();
    mgr.addEntry(makeEntry());
    const cb = vi.fn();
    mgr.subscribe(cb);
    mgr.clear();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not notify after unsubscribe', () => {
    const mgr = ImportHistoryManager.getInstance();
    const cb = vi.fn();
    const unsub = mgr.subscribe(cb);
    unsub();
    mgr.addEntry(makeEntry());
    expect(cb).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  it('persists entries to localStorage', () => {
    const mgr = ImportHistoryManager.getInstance();
    mgr.addEntry(makeEntry());
    const raw = localStorage.getItem('protopulse-import-history');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as ImportHistoryEntry[];
    expect(parsed).toHaveLength(1);
  });

  it('restores entries from localStorage on new instance', () => {
    const mgr = ImportHistoryManager.getInstance();
    mgr.addEntry(makeEntry({ fileName: 'restored.sch' }));
    ImportHistoryManager.resetInstance();
    const mgr2 = ImportHistoryManager.getInstance();
    expect(mgr2.getCount()).toBe(1);
    expect(mgr2.getEntries()[0].fileName).toBe('restored.sch');
  });

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem('protopulse-import-history', 'not-json');
    const mgr = ImportHistoryManager.getInstance();
    expect(mgr.getCount()).toBe(0);
  });

  it('handles non-array localStorage data gracefully', () => {
    localStorage.setItem('protopulse-import-history', '{"not":"array"}');
    const mgr = ImportHistoryManager.getInstance();
    expect(mgr.getCount()).toBe(0);
  });

  it('filters out invalid entries from localStorage', () => {
    const validEntry: ImportHistoryEntry = {
      id: 'test-id',
      timestamp: new Date().toISOString(),
      sourceFormat: 'kicad-schematic',
      fileName: 'test.sch',
      preview: makePreview(),
      snapshotData: {},
    };
    const invalidEntry = { id: 'bad', missing: 'fields' };
    localStorage.setItem(
      'protopulse-import-history',
      JSON.stringify([validEntry, invalidEntry]),
    );
    const mgr = ImportHistoryManager.getInstance();
    expect(mgr.getCount()).toBe(1);
    expect(mgr.getEntries()[0].id).toBe('test-id');
  });

  it('removes entry from localStorage on delete', () => {
    const mgr = ImportHistoryManager.getInstance();
    const entry = mgr.addEntry(makeEntry());
    mgr.deleteEntry(entry.id);
    const raw = localStorage.getItem('protopulse-import-history');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as ImportHistoryEntry[];
    expect(parsed).toHaveLength(0);
  });

  it('clears localStorage on clear', () => {
    const mgr = ImportHistoryManager.getInstance();
    mgr.addEntry(makeEntry());
    mgr.clear();
    const raw = localStorage.getItem('protopulse-import-history');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as ImportHistoryEntry[];
    expect(parsed).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Multiple formats
  // -------------------------------------------------------------------------

  it('supports different import formats', () => {
    const mgr = ImportHistoryManager.getInstance();
    mgr.addEntry(makeEntry({ sourceFormat: 'kicad-schematic', fileName: 'a.kicad_sch' }));
    mgr.addEntry(makeEntry({ sourceFormat: 'eagle-schematic', fileName: 'b.sch' }));
    mgr.addEntry(makeEntry({ sourceFormat: 'altium-schematic', fileName: 'c.SchDoc' }));
    expect(mgr.getCount()).toBe(3);
    const formats = mgr.getEntries().map((e) => e.sourceFormat);
    expect(formats).toContain('kicad-schematic');
    expect(formats).toContain('eagle-schematic');
    expect(formats).toContain('altium-schematic');
  });

  // -------------------------------------------------------------------------
  // getEntries returns copies
  // -------------------------------------------------------------------------

  it('getEntries returns a copy, not a reference', () => {
    const mgr = ImportHistoryManager.getInstance();
    mgr.addEntry(makeEntry());
    const entries1 = mgr.getEntries();
    const entries2 = mgr.getEntries();
    expect(entries1).toEqual(entries2);
    expect(entries1).not.toBe(entries2);
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it('handles entries with complex snapshot data', () => {
    const mgr = ImportHistoryManager.getInstance();
    const complexSnapshot = {
      nodes: [{ id: '1', label: 'MCU' }, { id: '2', label: 'Sensor' }],
      edges: [{ source: '1', target: '2' }],
      bomItems: [{ partNumber: 'ATmega328P', quantity: 1 }],
      nested: { deep: { value: 42 } },
    };
    const entry = mgr.addEntry(makeEntry({ snapshotData: complexSnapshot }));
    expect(entry.snapshotData).toEqual(complexSnapshot);

    // Verify persistence round-trip
    ImportHistoryManager.resetInstance();
    const mgr2 = ImportHistoryManager.getInstance();
    const restored = mgr2.getEntry(entry.id);
    expect(restored?.snapshotData).toEqual(complexSnapshot);
  });

  it('uses crypto.randomUUID for unique IDs', () => {
    const mgr = ImportHistoryManager.getInstance();
    const ids = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const entry = mgr.addEntry(makeEntry({ fileName: `file-${String(i)}.sch` }));
      ids.add(entry.id);
    }
    expect(ids.size).toBe(5);
  });
});
