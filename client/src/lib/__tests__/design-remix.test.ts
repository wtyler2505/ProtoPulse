import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DesignRemixManager, useDesignRemix } from '../design-remix';
import type { RemixSource, RemixOptions, RemixInputData, RemixableItem } from '../design-remix';

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSource(overrides: Partial<Omit<RemixSource, 'id' | 'remixedAt'>> = {}) {
  return {
    originalProjectId: overrides.originalProjectId ?? 'proj-original-1',
    originalName: overrides.originalName ?? 'My LED Blinker',
    author: overrides.author ?? 'Tyler',
  };
}

function makeOptions(overrides: Partial<RemixOptions> = {}): RemixOptions {
  return {
    keepArchitecture: overrides.keepArchitecture ?? true,
    keepBom: overrides.keepBom ?? true,
    keepCircuit: overrides.keepCircuit ?? true,
    keepNotes: overrides.keepNotes ?? true,
    newName: overrides.newName ?? 'Remixed Design',
  };
}

function makeData(overrides: Partial<RemixInputData> = {}): RemixInputData {
  return {
    architecture: overrides.architecture ?? [
      { id: 'arch-1', label: 'MCU', type: 'microcontroller' },
      { id: 'arch-2', label: 'Sensor', type: 'input', parentId: 'arch-1' },
    ],
    bom: overrides.bom ?? [
      { id: 'bom-1', name: 'ATmega328P', quantity: 1 },
      { id: 'bom-2', name: '10K Resistor', quantity: 4 },
    ],
    circuit: overrides.circuit ?? [
      { id: 'cir-1', type: 'resistor', value: '10K' },
      { id: 'cir-2', type: 'capacitor', value: '100nF', connectedTo: 'cir-1' },
    ],
    notes: overrides.notes ?? [{ id: 'note-1', text: 'Remember to check power supply' }],
  };
}

// ---------------------------------------------------------------------------
// DesignRemixManager
// ---------------------------------------------------------------------------

describe('DesignRemixManager', () => {
  let manager: DesignRemixManager;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    DesignRemixManager.resetInstance();
    manager = DesignRemixManager.getInstance();
  });

  afterEach(() => {
    DesignRemixManager.resetInstance();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  it('returns the same instance on repeated calls', () => {
    const a = DesignRemixManager.getInstance();
    const b = DesignRemixManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetInstance', () => {
    manager.createRemix(makeSource(), makeOptions(), makeData());
    DesignRemixManager.resetInstance();
    const fresh = DesignRemixManager.getInstance();
    // fresh instance loads from localStorage, so it should still have the entry
    expect(fresh.getHistorySize()).toBe(1);
  });

  // -----------------------------------------------------------------------
  // createRemix — basic
  // -----------------------------------------------------------------------

  it('creates a remix with auto-generated IDs and timestamp', () => {
    const result = manager.createRemix(makeSource(), makeOptions(), makeData());
    expect(result.remixId).toBeTruthy();
    expect(typeof result.remixId).toBe('string');
    expect(result.newProjectId).toBeTruthy();
    expect(typeof result.newProjectId).toBe('string');
    expect(result.remixId).not.toBe(result.newProjectId);
    expect(result.source.remixedAt).toBeGreaterThan(0);
    expect(result.source.originalProjectId).toBe('proj-original-1');
    expect(result.source.originalName).toBe('My LED Blinker');
    expect(result.source.author).toBe('Tyler');
  });

  it('returns remapped data with new UUIDs', () => {
    const data = makeData();
    const result = manager.createRemix(makeSource(), makeOptions(), data);

    expect(result.data.architecture).toHaveLength(2);
    expect(result.data.bom).toHaveLength(2);
    expect(result.data.circuit).toHaveLength(2);
    expect(result.data.notes).toHaveLength(1);

    // IDs should be different from originals
    expect(result.data.architecture![0].id).not.toBe('arch-1');
    expect(result.data.architecture![1].id).not.toBe('arch-2');
    expect(result.data.bom![0].id).not.toBe('bom-1');
    expect(result.data.circuit![0].id).not.toBe('cir-1');
    expect(result.data.notes![0].id).not.toBe('note-1');
  });

  it('preserves non-ID fields in remapped data', () => {
    const data = makeData();
    const result = manager.createRemix(makeSource(), makeOptions(), data);

    expect(result.data.architecture![0].label).toBe('MCU');
    expect(result.data.architecture![0].type).toBe('microcontroller');
    expect(result.data.bom![0].name).toBe('ATmega328P');
    expect(result.data.bom![0].quantity).toBe(1);
    expect(result.data.circuit![0].value).toBe('10K');
    expect(result.data.notes![0].text).toBe('Remember to check power supply');
  });

  it('provides an idMap of old to new IDs', () => {
    const data = makeData();
    const result = manager.createRemix(makeSource(), makeOptions(), data);

    expect(result.idMap.size).toBeGreaterThan(0);
    expect(result.idMap.get('arch-1')).toBe(result.data.architecture![0].id);
    expect(result.idMap.get('arch-2')).toBe(result.data.architecture![1].id);
    expect(result.idMap.get('bom-1')).toBe(result.data.bom![0].id);
    expect(result.idMap.get('cir-1')).toBe(result.data.circuit![0].id);
  });

  // -----------------------------------------------------------------------
  // createRemix — selective data keeping
  // -----------------------------------------------------------------------

  it('keeps only architecture when other options are false', () => {
    const data = makeData();
    const options = makeOptions({
      keepArchitecture: true,
      keepBom: false,
      keepCircuit: false,
      keepNotes: false,
    });
    const result = manager.createRemix(makeSource(), options, data);

    expect(result.data.architecture).toHaveLength(2);
    expect(result.data.bom).toBeUndefined();
    expect(result.data.circuit).toBeUndefined();
    expect(result.data.notes).toBeUndefined();
  });

  it('keeps only BOM when other options are false', () => {
    const data = makeData();
    const options = makeOptions({
      keepArchitecture: false,
      keepBom: true,
      keepCircuit: false,
      keepNotes: false,
    });
    const result = manager.createRemix(makeSource(), options, data);

    expect(result.data.architecture).toBeUndefined();
    expect(result.data.bom).toHaveLength(2);
    expect(result.data.circuit).toBeUndefined();
    expect(result.data.notes).toBeUndefined();
  });

  it('keeps only circuit when other options are false', () => {
    const data = makeData();
    const options = makeOptions({
      keepArchitecture: false,
      keepBom: false,
      keepCircuit: true,
      keepNotes: false,
    });
    const result = manager.createRemix(makeSource(), options, data);

    expect(result.data.architecture).toBeUndefined();
    expect(result.data.bom).toBeUndefined();
    expect(result.data.circuit).toHaveLength(2);
    expect(result.data.notes).toBeUndefined();
  });

  it('keeps only notes when other options are false', () => {
    const data = makeData();
    const options = makeOptions({
      keepArchitecture: false,
      keepBom: false,
      keepCircuit: false,
      keepNotes: true,
    });
    const result = manager.createRemix(makeSource(), options, data);

    expect(result.data.architecture).toBeUndefined();
    expect(result.data.bom).toBeUndefined();
    expect(result.data.circuit).toBeUndefined();
    expect(result.data.notes).toHaveLength(1);
  });

  it('returns empty data when all options are false', () => {
    const data = makeData();
    const options = makeOptions({
      keepArchitecture: false,
      keepBom: false,
      keepCircuit: false,
      keepNotes: false,
    });
    const result = manager.createRemix(makeSource(), options, data);

    expect(result.data.architecture).toBeUndefined();
    expect(result.data.bom).toBeUndefined();
    expect(result.data.circuit).toBeUndefined();
    expect(result.data.notes).toBeUndefined();
  });

  it('handles missing data sections gracefully', () => {
    const result = manager.createRemix(makeSource(), makeOptions(), {});
    expect(result.data.architecture).toBeUndefined();
    expect(result.data.bom).toBeUndefined();
    expect(result.data.circuit).toBeUndefined();
    expect(result.data.notes).toBeUndefined();
  });

  it('handles createRemix with no data argument', () => {
    const result = manager.createRemix(makeSource(), makeOptions());
    expect(result.data.architecture).toBeUndefined();
    expect(result.data.bom).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // remapIds — cross-references
  // -----------------------------------------------------------------------

  it('remaps cross-reference string fields to new IDs', () => {
    const data = makeData();
    const result = manager.createRemix(makeSource(), makeOptions(), data);

    // circuit item cir-2 has connectedTo: 'cir-1' — should be remapped
    const remappedCircuit = result.data.circuit!;
    const newCir1Id = result.idMap.get('cir-1')!;
    expect(remappedCircuit[1].connectedTo).toBe(newCir1Id);
  });

  it('remaps parentId references in architecture data', () => {
    const data = makeData();
    const result = manager.createRemix(makeSource(), makeOptions(), data);

    const newArch1Id = result.idMap.get('arch-1')!;
    expect(result.data.architecture![1].parentId).toBe(newArch1Id);
  });

  it('leaves non-ID strings unchanged', () => {
    const items: RemixableItem[] = [
      { id: 'item-1', name: 'Regular string', type: 'passive' },
    ];
    const idMap = new Map<string, string>();
    const remapped = manager.remapIds(items, idMap);

    expect(remapped[0].name).toBe('Regular string');
    expect(remapped[0].type).toBe('passive');
  });

  it('remaps IDs inside nested objects', () => {
    const items: RemixableItem[] = [
      { id: 'item-1', label: 'Node' },
      { id: 'item-2', config: { targetId: 'item-1', value: 42 } },
    ];
    const idMap = new Map<string, string>();
    const remapped = manager.remapIds(items, idMap);

    const newItem1Id = idMap.get('item-1')!;
    const config = remapped[1].config as Record<string, unknown>;
    expect(config.targetId).toBe(newItem1Id);
    expect(config.value).toBe(42);
  });

  it('remaps IDs inside arrays within items', () => {
    const items: RemixableItem[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', connections: ['a', 'b', 'unknown-ref'] },
    ];
    const idMap = new Map<string, string>();
    const remapped = manager.remapIds(items, idMap);

    const newA = idMap.get('a')!;
    const newB = idMap.get('b')!;
    const connections = remapped[2].connections as string[];
    expect(connections[0]).toBe(newA);
    expect(connections[1]).toBe(newB);
    expect(connections[2]).toBe('unknown-ref'); // not in idMap, unchanged
  });

  it('preserves null and undefined values during remapping', () => {
    const items: RemixableItem[] = [
      { id: 'item-1', description: null, meta: undefined },
    ];
    const idMap = new Map<string, string>();
    const remapped = manager.remapIds(items, idMap);

    expect(remapped[0].description).toBeNull();
    expect(remapped[0].meta).toBeUndefined();
  });

  it('preserves boolean and number values during remapping', () => {
    const items: RemixableItem[] = [
      { id: 'item-1', active: true, count: 42, ratio: 3.14 },
    ];
    const idMap = new Map<string, string>();
    const remapped = manager.remapIds(items, idMap);

    expect(remapped[0].active).toBe(true);
    expect(remapped[0].count).toBe(42);
    expect(remapped[0].ratio).toBe(3.14);
  });

  it('does not mutate original items', () => {
    const items: RemixableItem[] = [
      { id: 'orig-1', label: 'Original' },
    ];
    const idMap = new Map<string, string>();
    manager.remapIds(items, idMap);

    expect(items[0].id).toBe('orig-1');
    expect(items[0].label).toBe('Original');
  });

  it('uses provided idMap and extends it', () => {
    const existingMap = new Map<string, string>();
    existingMap.set('pre-existing', 'pre-mapped');

    const items: RemixableItem[] = [
      { id: 'new-1', ref: 'pre-existing' },
    ];
    const remapped = manager.remapIds(items, existingMap);

    // pre-existing mapping should be used for cross-reference
    expect(remapped[0].ref).toBe('pre-mapped');
    // new-1 should have a new mapping
    expect(existingMap.has('new-1')).toBe(true);
    expect(existingMap.size).toBe(2);
  });

  // -----------------------------------------------------------------------
  // getRemixHistory
  // -----------------------------------------------------------------------

  it('returns empty array for project with no remixes', () => {
    expect(manager.getRemixHistory('nonexistent')).toEqual([]);
  });

  it('returns all remixes for a given original project', () => {
    manager.createRemix(makeSource({ originalProjectId: 'proj-A' }), makeOptions());
    manager.createRemix(makeSource({ originalProjectId: 'proj-A' }), makeOptions());
    manager.createRemix(makeSource({ originalProjectId: 'proj-B' }), makeOptions());

    const historyA = manager.getRemixHistory('proj-A');
    expect(historyA).toHaveLength(2);
    expect(historyA.every((s) => s.originalProjectId === 'proj-A')).toBe(true);

    const historyB = manager.getRemixHistory('proj-B');
    expect(historyB).toHaveLength(1);
  });

  it('returns remix history sorted by remixedAt descending', () => {
    const dateSpy = vi.spyOn(Date, 'now');
    dateSpy.mockReturnValue(1000);
    manager.createRemix(makeSource({ originalProjectId: 'proj-A' }), makeOptions());
    dateSpy.mockReturnValue(3000);
    manager.createRemix(makeSource({ originalProjectId: 'proj-A' }), makeOptions());
    dateSpy.mockReturnValue(2000);
    manager.createRemix(makeSource({ originalProjectId: 'proj-A' }), makeOptions());

    const history = manager.getRemixHistory('proj-A');
    expect(history[0].remixedAt).toBe(3000);
    expect(history[1].remixedAt).toBe(2000);
    expect(history[2].remixedAt).toBe(1000);
  });

  // -----------------------------------------------------------------------
  // isRemix / getOriginalSource
  // -----------------------------------------------------------------------

  it('isRemix returns false for non-remixed project', () => {
    expect(manager.isRemix('random-id')).toBe(false);
  });

  it('isRemix returns true for a remixed project', () => {
    const result = manager.createRemix(makeSource(), makeOptions());
    expect(manager.isRemix(result.newProjectId)).toBe(true);
  });

  it('getOriginalSource returns null for non-remixed project', () => {
    expect(manager.getOriginalSource('random-id')).toBeNull();
  });

  it('getOriginalSource returns the source for a remixed project', () => {
    const result = manager.createRemix(makeSource(), makeOptions());
    const source = manager.getOriginalSource(result.newProjectId);
    expect(source).not.toBeNull();
    expect(source!.originalProjectId).toBe('proj-original-1');
    expect(source!.originalName).toBe('My LED Blinker');
    expect(source!.author).toBe('Tyler');
    expect(source!.id).toBe(result.remixId);
  });

  // -----------------------------------------------------------------------
  // removeFromHistory / clearHistory
  // -----------------------------------------------------------------------

  it('removeFromHistory removes a single entry', () => {
    const result = manager.createRemix(makeSource(), makeOptions());
    expect(manager.isRemix(result.newProjectId)).toBe(true);

    const removed = manager.removeFromHistory(result.newProjectId);
    expect(removed).toBe(true);
    expect(manager.isRemix(result.newProjectId)).toBe(false);
    expect(manager.getHistorySize()).toBe(0);
  });

  it('removeFromHistory returns false for non-existent entry', () => {
    expect(manager.removeFromHistory('nonexistent')).toBe(false);
  });

  it('clearHistory removes all entries', () => {
    manager.createRemix(makeSource(), makeOptions());
    manager.createRemix(makeSource(), makeOptions());
    expect(manager.getHistorySize()).toBe(2);

    manager.clearHistory();
    expect(manager.getHistorySize()).toBe(0);
  });

  it('clearHistory is safe when already empty', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.clearHistory();
    expect(callback).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // History limit (max 100)
  // -----------------------------------------------------------------------

  it('enforces max 100 entries by evicting oldest', () => {
    const dateSpy = vi.spyOn(Date, 'now');

    for (let i = 0; i < 101; i++) {
      dateSpy.mockReturnValue(1000 + i);
      manager.createRemix(
        makeSource({ originalProjectId: `proj-${i}` }),
        makeOptions(),
      );
    }

    expect(manager.getHistorySize()).toBe(100);
    // The oldest (proj-0) should have been evicted
    const allHistory = manager.getRemixHistory('proj-0');
    expect(allHistory).toHaveLength(0);
    // The newest should still exist
    const newest = manager.getRemixHistory('proj-100');
    expect(newest).toHaveLength(1);
  });

  // -----------------------------------------------------------------------
  // localStorage persistence
  // -----------------------------------------------------------------------

  it('persists to localStorage on createRemix', () => {
    manager.createRemix(makeSource(), makeOptions());
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'protopulse-design-remix-history',
      expect.any(String),
    );
  });

  it('persists to localStorage on removeFromHistory', () => {
    const result = manager.createRemix(makeSource(), makeOptions());
    vi.mocked(mockStorage.setItem).mockClear();
    manager.removeFromHistory(result.newProjectId);
    expect(mockStorage.setItem).toHaveBeenCalled();
  });

  it('loads entries from localStorage on init', () => {
    const entries: [string, RemixSource][] = [
      [
        'proj-new-1',
        {
          id: 'remix-1',
          originalProjectId: 'proj-orig',
          originalName: 'Test Project',
          author: 'Tyler',
          remixedAt: 1000,
        },
      ],
    ];
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(entries));

    DesignRemixManager.resetInstance();
    const loaded = DesignRemixManager.getInstance();
    expect(loaded.getHistorySize()).toBe(1);
    expect(loaded.isRemix('proj-new-1')).toBe(true);
    expect(loaded.getOriginalSource('proj-new-1')!.originalName).toBe('Test Project');
  });

  it('handles corrupt localStorage gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('not valid json{{{');
    DesignRemixManager.resetInstance();
    const loaded = DesignRemixManager.getInstance();
    expect(loaded.getHistorySize()).toBe(0);
  });

  it('handles non-array localStorage data gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('"just a string"');
    DesignRemixManager.resetInstance();
    const loaded = DesignRemixManager.getInstance();
    expect(loaded.getHistorySize()).toBe(0);
  });

  it('filters out invalid entries from localStorage', () => {
    const entries = [
      [
        'valid-key',
        {
          id: 'remix-1',
          originalProjectId: 'proj-1',
          originalName: 'Valid',
          author: 'Tyler',
          remixedAt: 1000,
        },
      ],
      ['bad-key', { missing: 'required fields' }],
      'not-even-an-array',
      [
        'valid-key-2',
        {
          id: 'remix-2',
          originalProjectId: 'proj-2',
          originalName: 'Also Valid',
          author: 'Tyler',
          remixedAt: 2000,
        },
      ],
    ];
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(entries));
    DesignRemixManager.resetInstance();
    const loaded = DesignRemixManager.getInstance();
    expect(loaded.getHistorySize()).toBe(2);
  });

  // -----------------------------------------------------------------------
  // Subscribe / unsubscribe
  // -----------------------------------------------------------------------

  it('calls subscriber on createRemix', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.createRemix(makeSource(), makeOptions());
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on removeFromHistory', () => {
    const result = manager.createRemix(makeSource(), makeOptions());
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.removeFromHistory(result.newProjectId);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on clearHistory', () => {
    manager.createRemix(makeSource(), makeOptions());
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.clearHistory();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not call subscriber after unsubscribe', () => {
    const callback = vi.fn();
    const unsub = manager.subscribe(callback);
    unsub();
    manager.createRemix(makeSource(), makeOptions());
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not call subscriber on removeFromHistory when not found', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.removeFromHistory('nonexistent');
    expect(callback).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

describe('useDesignRemix', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    DesignRemixManager.resetInstance();
  });

  afterEach(() => {
    DesignRemixManager.resetInstance();
    vi.restoreAllMocks();
  });

  it('returns initial empty state', () => {
    const { result } = renderHook(() => useDesignRemix());
    expect(result.current.historySize).toBe(0);
    expect(result.current.isRemix('any-id')).toBe(false);
    expect(result.current.getOriginalSource('any-id')).toBeNull();
    expect(result.current.getRemixHistory('any-id')).toEqual([]);
  });

  it('creates a remix via hook and re-renders', () => {
    const { result } = renderHook(() => useDesignRemix());
    let remixResult: ReturnType<typeof result.current.createRemix> | undefined;

    act(() => {
      remixResult = result.current.createRemix(makeSource(), makeOptions(), makeData());
    });

    expect(remixResult).toBeDefined();
    expect(result.current.historySize).toBe(1);
    expect(result.current.isRemix(remixResult!.newProjectId)).toBe(true);
  });

  it('getRemixHistory returns entries via hook', () => {
    const { result } = renderHook(() => useDesignRemix());

    act(() => {
      result.current.createRemix(
        makeSource({ originalProjectId: 'proj-X' }),
        makeOptions(),
      );
    });

    const history = result.current.getRemixHistory('proj-X');
    expect(history).toHaveLength(1);
    expect(history[0].originalProjectId).toBe('proj-X');
  });

  it('removeFromHistory works via hook', () => {
    const { result } = renderHook(() => useDesignRemix());
    let projectId = '';

    act(() => {
      const res = result.current.createRemix(makeSource(), makeOptions());
      projectId = res.newProjectId;
    });

    expect(result.current.historySize).toBe(1);

    act(() => {
      result.current.removeFromHistory(projectId);
    });

    expect(result.current.historySize).toBe(0);
  });

  it('clearHistory works via hook', () => {
    const { result } = renderHook(() => useDesignRemix());

    act(() => {
      result.current.createRemix(makeSource(), makeOptions());
      result.current.createRemix(makeSource(), makeOptions());
    });

    expect(result.current.historySize).toBe(2);

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.historySize).toBe(0);
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useDesignRemix());
    unmount();
    // Should not throw when manager notifies after unmount
    expect(() => {
      DesignRemixManager.getInstance().createRemix(makeSource(), makeOptions());
    }).not.toThrow();
  });
});
