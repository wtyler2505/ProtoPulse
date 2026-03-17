import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  generateBundle,
  formatBundleAsText,
  formatBundleAsJson,
  getBundleSummary,
  IncidentBundleManager,
  useIncidentBundles,
} from '../incident-bundle';
import type { IncidentData, IncidentBundle } from '../incident-bundle';

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

function makeData(overrides?: Partial<IncidentData>): IncidentData {
  return {
    timestamp: Date.now(),
    serialLog: [],
    compileErrors: [],
    configSnapshot: {},
    ...overrides,
  };
}

function makeBundle(projectId: string, overrides?: Partial<IncidentBundle>): IncidentBundle {
  return {
    id: crypto.randomUUID(),
    projectId,
    createdAt: new Date().toISOString(),
    data: makeData(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// generateBundle
// ---------------------------------------------------------------------------

describe('generateBundle', () => {
  it('creates a bundle with a UUID id', () => {
    const data = makeData();
    const bundle = generateBundle(data, 'proj-1');
    expect(bundle.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('sets projectId from argument', () => {
    const bundle = generateBundle(makeData(), 'my-proj');
    expect(bundle.projectId).toBe('my-proj');
  });

  it('sets createdAt to an ISO-8601 string', () => {
    const bundle = generateBundle(makeData(), 'proj-1');
    expect(() => new Date(bundle.createdAt)).not.toThrow();
    expect(new Date(bundle.createdAt).toISOString()).toBe(bundle.createdAt);
  });

  it('includes notes when provided', () => {
    const bundle = generateBundle(makeData(), 'proj-1', 'motor stalled');
    expect(bundle.notes).toBe('motor stalled');
  });

  it('omits notes when not provided', () => {
    const bundle = generateBundle(makeData(), 'proj-1');
    expect(bundle.notes).toBeUndefined();
  });

  it('preserves all IncidentData fields', () => {
    const data = makeData({
      board: 'Arduino Mega',
      serialLog: ['line1', 'line2'],
      compileErrors: ['err1'],
      firmwareVersion: '2.0.0',
      ramUsage: 1024,
      flashUsage: 32768,
      configSnapshot: { baudRate: 9600 },
    });
    const bundle = generateBundle(data, 'proj-1');
    expect(bundle.data.board).toBe('Arduino Mega');
    expect(bundle.data.serialLog).toEqual(['line1', 'line2']);
    expect(bundle.data.compileErrors).toEqual(['err1']);
    expect(bundle.data.firmwareVersion).toBe('2.0.0');
    expect(bundle.data.ramUsage).toBe(1024);
    expect(bundle.data.flashUsage).toBe(32768);
    expect(bundle.data.configSnapshot).toEqual({ baudRate: 9600 });
  });
});

// ---------------------------------------------------------------------------
// formatBundleAsText
// ---------------------------------------------------------------------------

describe('formatBundleAsText', () => {
  it('includes the bundle ID in the report', () => {
    const bundle = makeBundle('proj-1');
    const text = formatBundleAsText(bundle);
    expect(text).toContain(bundle.id);
  });

  it('includes the project ID', () => {
    const bundle = makeBundle('proj-42');
    const text = formatBundleAsText(bundle);
    expect(text).toContain('proj-42');
  });

  it('includes serial log lines', () => {
    const bundle = makeBundle('proj-1', {
      data: makeData({ serialLog: ['[INFO] Boot OK', '[ERR] Watchdog timeout'] }),
    });
    const text = formatBundleAsText(bundle);
    expect(text).toContain('--- Serial Log ---');
    expect(text).toContain('[INFO] Boot OK');
    expect(text).toContain('[ERR] Watchdog timeout');
  });

  it('includes compile errors', () => {
    const bundle = makeBundle('proj-1', {
      data: makeData({ compileErrors: ['main.ino:12: undefined reference'] }),
    });
    const text = formatBundleAsText(bundle);
    expect(text).toContain('--- Compile Errors ---');
    expect(text).toContain('main.ino:12: undefined reference');
  });

  it('includes optional fields when present', () => {
    const bundle = makeBundle('proj-1', {
      data: makeData({ board: 'ESP32', firmwareVersion: '1.0.0', ramUsage: 512, flashUsage: 8192 }),
      notes: 'test note',
    });
    const text = formatBundleAsText(bundle);
    expect(text).toContain('Board:     ESP32');
    expect(text).toContain('Firmware:  1.0.0');
    expect(text).toContain('RAM:       512 bytes');
    expect(text).toContain('Flash:     8192 bytes');
    expect(text).toContain('Notes:     test note');
  });

  it('omits sections that are empty', () => {
    const bundle = makeBundle('proj-1', { data: makeData() });
    const text = formatBundleAsText(bundle);
    expect(text).not.toContain('--- Serial Log ---');
    expect(text).not.toContain('--- Compile Errors ---');
    expect(text).not.toContain('Board:');
  });

  it('includes config snapshot as JSON', () => {
    const bundle = makeBundle('proj-1', {
      data: makeData({ configSnapshot: { baud: 115200 } }),
    });
    const text = formatBundleAsText(bundle);
    expect(text).toContain('--- Config Snapshot ---');
    expect(text).toContain('"baud": 115200');
  });
});

// ---------------------------------------------------------------------------
// formatBundleAsJson
// ---------------------------------------------------------------------------

describe('formatBundleAsJson', () => {
  it('returns valid JSON', () => {
    const bundle = makeBundle('proj-1');
    const json = formatBundleAsJson(bundle);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('round-trips the bundle', () => {
    const bundle = makeBundle('proj-1', {
      data: makeData({ board: 'Nano', serialLog: ['hello'] }),
      notes: 'some notes',
    });
    const json = formatBundleAsJson(bundle);
    const parsed = JSON.parse(json) as IncidentBundle;
    expect(parsed.id).toBe(bundle.id);
    expect(parsed.data.board).toBe('Nano');
    expect(parsed.notes).toBe('some notes');
  });

  it('is pretty-printed (indented)', () => {
    const bundle = makeBundle('proj-1');
    const json = formatBundleAsJson(bundle);
    expect(json).toContain('\n');
    expect(json).toContain('  ');
  });
});

// ---------------------------------------------------------------------------
// getBundleSummary
// ---------------------------------------------------------------------------

describe('getBundleSummary', () => {
  it('starts with an abbreviated ID', () => {
    const bundle = makeBundle('proj-1');
    const summary = getBundleSummary(bundle);
    expect(summary).toContain(`[${bundle.id.slice(0, 8)}]`);
  });

  it('includes the board when present', () => {
    const bundle = makeBundle('proj-1', { data: makeData({ board: 'Mega 2560' }) });
    const summary = getBundleSummary(bundle);
    expect(summary).toContain('Mega 2560');
  });

  it('includes error count (singular)', () => {
    const bundle = makeBundle('proj-1', { data: makeData({ compileErrors: ['e1'] }) });
    const summary = getBundleSummary(bundle);
    expect(summary).toContain('1 error');
    expect(summary).not.toContain('1 errors');
  });

  it('includes error count (plural)', () => {
    const bundle = makeBundle('proj-1', { data: makeData({ compileErrors: ['e1', 'e2', 'e3'] }) });
    const summary = getBundleSummary(bundle);
    expect(summary).toContain('3 errors');
  });

  it('includes log line count', () => {
    const bundle = makeBundle('proj-1', { data: makeData({ serialLog: ['l1', 'l2'] }) });
    const summary = getBundleSummary(bundle);
    expect(summary).toContain('2 log lines');
  });

  it('includes notes in quotes', () => {
    const bundle = makeBundle('proj-1', { notes: 'motor jammed' });
    const summary = getBundleSummary(bundle);
    expect(summary).toContain('"motor jammed"');
  });

  it('uses pipe separators', () => {
    const bundle = makeBundle('proj-1', { data: makeData({ board: 'UNO' }) });
    const summary = getBundleSummary(bundle);
    expect(summary).toContain(' | ');
  });
});

// ---------------------------------------------------------------------------
// IncidentBundleManager
// ---------------------------------------------------------------------------

describe('IncidentBundleManager', () => {
  let manager: IncidentBundleManager;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    IncidentBundleManager.resetInstance();
    manager = IncidentBundleManager.getInstance();
  });

  afterEach(() => {
    IncidentBundleManager.resetInstance();
  });

  // -- Singleton -----------------------------------------------------------

  it('returns the same instance on repeated calls', () => {
    const a = IncidentBundleManager.getInstance();
    const b = IncidentBundleManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetInstance', () => {
    const a = IncidentBundleManager.getInstance();
    IncidentBundleManager.resetInstance();
    const b = IncidentBundleManager.getInstance();
    expect(a).not.toBe(b);
  });

  // -- addBundle / getBundles / getCount -----------------------------------

  it('adds a bundle and retrieves it', () => {
    const bundle = makeBundle('proj-1');
    manager.addBundle('proj-1', bundle);
    expect(manager.getCount('proj-1')).toBe(1);
    const bundles = manager.getBundles('proj-1');
    expect(bundles[0].id).toBe(bundle.id);
  });

  it('returns bundles sorted newest-first', () => {
    const older = makeBundle('proj-1', { createdAt: '2026-01-01T00:00:00.000Z' });
    const newer = makeBundle('proj-1', { createdAt: '2026-06-01T00:00:00.000Z' });
    manager.addBundle('proj-1', older);
    manager.addBundle('proj-1', newer);
    const bundles = manager.getBundles('proj-1');
    expect(bundles[0].id).toBe(newer.id);
    expect(bundles[1].id).toBe(older.id);
  });

  it('deduplicates by bundle ID', () => {
    const bundle = makeBundle('proj-1');
    manager.addBundle('proj-1', bundle);
    manager.addBundle('proj-1', bundle);
    expect(manager.getCount('proj-1')).toBe(1);
  });

  it('enforces max 20 bundles per project by evicting oldest', () => {
    const baseDate = new Date('2026-01-01T00:00:00.000Z').getTime();
    for (let i = 0; i < 20; i++) {
      const bundle = makeBundle('proj-1', {
        createdAt: new Date(baseDate + i * 60_000).toISOString(),
      });
      manager.addBundle('proj-1', bundle);
    }
    expect(manager.getCount('proj-1')).toBe(20);

    // Adding the 21st should evict the oldest
    const oldestId = manager.getBundles('proj-1')[19].id; // last in newest-first = oldest
    const extra = makeBundle('proj-1', {
      createdAt: new Date(baseDate + 20 * 60_000).toISOString(),
    });
    manager.addBundle('proj-1', extra);
    expect(manager.getCount('proj-1')).toBe(20);
    expect(manager.getBundle('proj-1', oldestId)).toBeUndefined();
    expect(manager.getBundle('proj-1', extra.id)).toBeDefined();
  });

  // -- getBundle -----------------------------------------------------------

  it('getBundle returns undefined for non-existent ID', () => {
    expect(manager.getBundle('proj-1', 'no-such-id')).toBeUndefined();
  });

  // -- removeBundle --------------------------------------------------------

  it('removes a bundle by ID', () => {
    const bundle = makeBundle('proj-1');
    manager.addBundle('proj-1', bundle);
    manager.removeBundle('proj-1', bundle.id);
    expect(manager.getCount('proj-1')).toBe(0);
  });

  it('removeBundle is safe for non-existent ID', () => {
    expect(() => {
      manager.removeBundle('proj-1', 'nonexistent');
    }).not.toThrow();
  });

  // -- clearAll ------------------------------------------------------------

  it('clearAll removes all bundles for a project', () => {
    manager.addBundle('proj-1', makeBundle('proj-1'));
    manager.addBundle('proj-1', makeBundle('proj-1'));
    manager.clearAll('proj-1');
    expect(manager.getCount('proj-1')).toBe(0);
  });

  it('clearAll does not affect other projects', () => {
    manager.addBundle('proj-1', makeBundle('proj-1'));
    manager.addBundle('proj-2', makeBundle('proj-2'));
    manager.clearAll('proj-1');
    expect(manager.getCount('proj-1')).toBe(0);
    expect(manager.getCount('proj-2')).toBe(1);
  });

  it('clearAll is safe when already empty', () => {
    expect(() => {
      manager.clearAll('proj-1');
    }).not.toThrow();
  });

  // -- Persistence ---------------------------------------------------------

  it('persists to localStorage on add', () => {
    manager.addBundle('proj-1', makeBundle('proj-1'));
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'protopulse-incident-bundles:proj-1',
      expect.any(String),
    );
  });

  it('loads from localStorage on first access', () => {
    const bundle = makeBundle('proj-X');
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify([bundle]));
    IncidentBundleManager.resetInstance();
    const fresh = IncidentBundleManager.getInstance();
    expect(fresh.getCount('proj-X')).toBe(1);
    expect(fresh.getBundle('proj-X', bundle.id)?.id).toBe(bundle.id);
  });

  it('handles corrupt localStorage gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('totally-broken{{{');
    IncidentBundleManager.resetInstance();
    const fresh = IncidentBundleManager.getInstance();
    expect(fresh.getCount('proj-1')).toBe(0);
  });

  it('handles non-array localStorage data gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('{"not": "array"}');
    IncidentBundleManager.resetInstance();
    const fresh = IncidentBundleManager.getInstance();
    expect(fresh.getCount('proj-1')).toBe(0);
  });

  it('filters out invalid entries from localStorage', () => {
    const valid = makeBundle('proj-1');
    const data = [valid, { broken: true }, { id: 'no-data', projectId: 'proj-1' }];
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(data));
    IncidentBundleManager.resetInstance();
    const fresh = IncidentBundleManager.getInstance();
    expect(fresh.getCount('proj-1')).toBe(1);
  });

  // -- Subscribe -----------------------------------------------------------

  it('notifies subscriber on add', () => {
    const cb = vi.fn();
    manager.subscribe(cb);
    manager.addBundle('proj-1', makeBundle('proj-1'));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('notifies subscriber on remove', () => {
    const bundle = makeBundle('proj-1');
    manager.addBundle('proj-1', bundle);
    const cb = vi.fn();
    manager.subscribe(cb);
    manager.removeBundle('proj-1', bundle.id);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('notifies subscriber on clearAll', () => {
    manager.addBundle('proj-1', makeBundle('proj-1'));
    const cb = vi.fn();
    manager.subscribe(cb);
    manager.clearAll('proj-1');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not notify after unsubscribe', () => {
    const cb = vi.fn();
    const unsub = manager.subscribe(cb);
    unsub();
    manager.addBundle('proj-1', makeBundle('proj-1'));
    expect(cb).not.toHaveBeenCalled();
  });

  it('does not notify on duplicate add', () => {
    const bundle = makeBundle('proj-1');
    manager.addBundle('proj-1', bundle);
    const cb = vi.fn();
    manager.subscribe(cb);
    manager.addBundle('proj-1', bundle);
    expect(cb).not.toHaveBeenCalled();
  });

  it('does not notify on remove of non-existent', () => {
    const cb = vi.fn();
    manager.subscribe(cb);
    manager.removeBundle('proj-1', 'ghost');
    expect(cb).not.toHaveBeenCalled();
  });

  it('does not notify on clearAll when already empty', () => {
    const cb = vi.fn();
    manager.subscribe(cb);
    manager.clearAll('proj-1');
    expect(cb).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useIncidentBundles hook
// ---------------------------------------------------------------------------

describe('useIncidentBundles', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    IncidentBundleManager.resetInstance();
  });

  afterEach(() => {
    IncidentBundleManager.resetInstance();
  });

  it('returns initial empty state', () => {
    const { result } = renderHook(() => useIncidentBundles('proj-1'));
    expect(result.current.bundles).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it('adds a bundle via hook', () => {
    const { result } = renderHook(() => useIncidentBundles('proj-1'));
    const bundle = makeBundle('proj-1');
    act(() => {
      result.current.addBundle(bundle);
    });
    expect(result.current.bundles).toHaveLength(1);
    expect(result.current.count).toBe(1);
  });

  it('removes a bundle via hook', () => {
    const { result } = renderHook(() => useIncidentBundles('proj-1'));
    const bundle = makeBundle('proj-1');
    act(() => {
      result.current.addBundle(bundle);
    });
    act(() => {
      result.current.removeBundle(bundle.id);
    });
    expect(result.current.bundles).toHaveLength(0);
    expect(result.current.count).toBe(0);
  });

  it('clears all via hook', () => {
    const { result } = renderHook(() => useIncidentBundles('proj-1'));
    act(() => {
      result.current.addBundle(makeBundle('proj-1'));
      result.current.addBundle(makeBundle('proj-1'));
    });
    act(() => {
      result.current.clearAll();
    });
    expect(result.current.bundles).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it('getBundle returns a bundle by ID', () => {
    const { result } = renderHook(() => useIncidentBundles('proj-1'));
    const bundle = makeBundle('proj-1');
    act(() => {
      result.current.addBundle(bundle);
    });
    expect(result.current.getBundle(bundle.id)?.id).toBe(bundle.id);
  });

  it('getBundle returns undefined for non-existent', () => {
    const { result } = renderHook(() => useIncidentBundles('proj-1'));
    expect(result.current.getBundle('nope')).toBeUndefined();
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useIncidentBundles('proj-1'));
    unmount();
    expect(() => {
      IncidentBundleManager.getInstance().addBundle('proj-1', makeBundle('proj-1'));
    }).not.toThrow();
  });
});
