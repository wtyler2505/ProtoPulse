import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { RecentProjectsManager, useRecentProjects } from '../recent-projects';
import type { RecentProjectEntry, RecentProjectsData, RecentSortMode } from '../recent-projects';

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
// Setup
// ---------------------------------------------------------------------------

let mgr: RecentProjectsManager;
let mockStorage: Storage;

beforeEach(() => {
  mockStorage = createMockLocalStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
  RecentProjectsManager.resetForTesting();
  mgr = RecentProjectsManager.getInstance();
});

afterEach(() => {
  RecentProjectsManager.resetForTesting();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('RecentProjectsManager - Singleton', () => {
  it('returns the same instance on repeated calls', () => {
    const a = RecentProjectsManager.getInstance();
    const b = RecentProjectsManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetForTesting', () => {
    const first = RecentProjectsManager.getInstance();
    RecentProjectsManager.resetForTesting();
    const second = RecentProjectsManager.getInstance();
    expect(first).not.toBe(second);
  });
});

// ---------------------------------------------------------------------------
// recordAccess
// ---------------------------------------------------------------------------

describe('RecentProjectsManager - recordAccess', () => {
  it('adds a new entry', () => {
    mgr.recordAccess({ id: 1, name: 'Project A' });
    expect(mgr.getCount()).toBe(1);
    const entry = mgr.findEntry(1);
    expect(entry).toBeDefined();
    expect(entry!.name).toBe('Project A');
    expect(entry!.pinned).toBe(false);
  });

  it('updates name and description on re-access', () => {
    mgr.recordAccess({ id: 1, name: 'Old Name', description: 'Old desc' });
    mgr.recordAccess({ id: 1, name: 'New Name', description: 'New desc' });
    expect(mgr.getCount()).toBe(1);
    const entry = mgr.findEntry(1);
    expect(entry!.name).toBe('New Name');
    expect(entry!.description).toBe('New desc');
  });

  it('bumps lastAccessedAt on re-access', () => {
    mgr.recordAccess({ id: 1, name: 'P1' });
    const first = mgr.findEntry(1)!.lastAccessedAt;

    // Advance time slightly
    vi.spyOn(Date, 'now').mockReturnValue(first + 1000);
    mgr.recordAccess({ id: 1, name: 'P1' });
    const second = mgr.findEntry(1)!.lastAccessedAt;
    expect(second).toBeGreaterThan(first);
  });

  it('handles null description', () => {
    mgr.recordAccess({ id: 1, name: 'P1', description: null });
    expect(mgr.findEntry(1)!.description).toBeUndefined();
  });

  it('persists to localStorage on recordAccess', () => {
    mgr.recordAccess({ id: 1, name: 'P1' });
    expect(mockStorage.setItem).toHaveBeenCalled();
  });

  it('notifies listeners on recordAccess', () => {
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.recordAccess({ id: 1, name: 'P1' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Eviction (MAX_ENTRIES = 50)
// ---------------------------------------------------------------------------

describe('RecentProjectsManager - Eviction', () => {
  it('evicts oldest unpinned entry when at max', () => {
    // Fill to 50
    for (let i = 1; i <= 50; i++) {
      vi.spyOn(Date, 'now').mockReturnValue(1000 + i);
      mgr.recordAccess({ id: i, name: `Project ${String(i)}` });
      vi.restoreAllMocks();
    }
    expect(mgr.getCount()).toBe(50);

    // Add 51st — should evict id=1 (oldest unpinned)
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    mgr.recordAccess({ id: 51, name: 'Project 51' });
    expect(mgr.getCount()).toBe(50);
    expect(mgr.findEntry(1)).toBeUndefined();
    expect(mgr.findEntry(51)).toBeDefined();
  });

  it('evicts unpinned before pinned', () => {
    // Add 3 entries
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    mgr.recordAccess({ id: 1, name: 'P1' });
    vi.restoreAllMocks();

    vi.spyOn(Date, 'now').mockReturnValue(2000);
    mgr.recordAccess({ id: 2, name: 'P2' });
    vi.restoreAllMocks();

    vi.spyOn(Date, 'now').mockReturnValue(3000);
    mgr.recordAccess({ id: 3, name: 'P3' });
    vi.restoreAllMocks();

    // Pin the oldest one
    mgr.togglePin(1);

    // Fill remaining to 50
    for (let i = 4; i <= 50; i++) {
      vi.spyOn(Date, 'now').mockReturnValue(3000 + i);
      mgr.recordAccess({ id: i, name: `P${String(i)}` });
      vi.restoreAllMocks();
    }

    // Add 51st — should evict id=2 (oldest unpinned), not id=1 (pinned)
    vi.spyOn(Date, 'now').mockReturnValue(5000);
    mgr.recordAccess({ id: 51, name: 'P51' });
    expect(mgr.findEntry(1)).toBeDefined(); // pinned, survives
    expect(mgr.findEntry(2)).toBeUndefined(); // oldest unpinned, evicted
    expect(mgr.findEntry(51)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Pin / Unpin
// ---------------------------------------------------------------------------

describe('RecentProjectsManager - Pin/Unpin', () => {
  it('togglePin pins an unpinned entry', () => {
    mgr.recordAccess({ id: 1, name: 'P1' });
    const result = mgr.togglePin(1);
    expect(result).toBe(true);
    expect(mgr.findEntry(1)!.pinned).toBe(true);
  });

  it('togglePin unpins a pinned entry', () => {
    mgr.recordAccess({ id: 1, name: 'P1' });
    mgr.togglePin(1);
    const result = mgr.togglePin(1);
    expect(result).toBe(false);
    expect(mgr.findEntry(1)!.pinned).toBe(false);
  });

  it('togglePin returns null for unknown project', () => {
    expect(mgr.togglePin(999)).toBeNull();
  });

  it('setPin explicitly sets pinned state', () => {
    mgr.recordAccess({ id: 1, name: 'P1' });
    mgr.setPin(1, true);
    expect(mgr.findEntry(1)!.pinned).toBe(true);
    mgr.setPin(1, false);
    expect(mgr.findEntry(1)!.pinned).toBe(false);
  });

  it('setPin returns false for unknown project', () => {
    expect(mgr.setPin(999, true)).toBe(false);
  });

  it('pin notifies listeners', () => {
    mgr.recordAccess({ id: 1, name: 'P1' });
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.togglePin(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Remove / Clear
// ---------------------------------------------------------------------------

describe('RecentProjectsManager - Remove/Clear', () => {
  it('removes an entry by ID', () => {
    mgr.recordAccess({ id: 1, name: 'P1' });
    mgr.recordAccess({ id: 2, name: 'P2' });
    expect(mgr.removeEntry(1)).toBe(true);
    expect(mgr.getCount()).toBe(1);
    expect(mgr.findEntry(1)).toBeUndefined();
  });

  it('returns false when removing nonexistent entry', () => {
    expect(mgr.removeEntry(999)).toBe(false);
  });

  it('clearAll removes everything', () => {
    mgr.recordAccess({ id: 1, name: 'P1' });
    mgr.recordAccess({ id: 2, name: 'P2' });
    mgr.clearAll();
    expect(mgr.getCount()).toBe(0);
    expect(mgr.getEntries()).toEqual([]);
  });

  it('clearAll notifies listeners', () => {
    mgr.recordAccess({ id: 1, name: 'P1' });
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.clearAll();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

describe('RecentProjectsManager - Search', () => {
  beforeEach(() => {
    mgr.recordAccess({ id: 1, name: 'Arduino Rover', description: 'Motor controller' });
    mgr.recordAccess({ id: 2, name: 'LED Strip Controller' });
    mgr.recordAccess({ id: 3, name: 'Power Supply', description: 'Buck converter' });
  });

  it('returns all entries for empty query', () => {
    expect(mgr.search('')).toHaveLength(3);
  });

  it('matches by name case-insensitively', () => {
    const results = mgr.search('arduino');
    expect(results).toHaveLength(1);
    expect(results[0].projectId).toBe(1);
  });

  it('matches by description', () => {
    const results = mgr.search('buck');
    expect(results).toHaveLength(1);
    expect(results[0].projectId).toBe(3);
  });

  it('matches partial strings', () => {
    const results = mgr.search('con');
    // 'LED Strip Controller' and 'Power Supply (Buck converter)'
    expect(results).toHaveLength(2);
  });

  it('returns empty array for no matches', () => {
    expect(mgr.search('zzzzz')).toHaveLength(0);
  });

  it('trims whitespace', () => {
    const results = mgr.search('  arduino  ');
    expect(results).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

describe('RecentProjectsManager - Sorting', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    mgr.recordAccess({ id: 1, name: 'Zebra' });
    vi.restoreAllMocks();

    vi.spyOn(Date, 'now').mockReturnValue(3000);
    mgr.recordAccess({ id: 2, name: 'Apple' });
    vi.restoreAllMocks();

    vi.spyOn(Date, 'now').mockReturnValue(2000);
    mgr.recordAccess({ id: 3, name: 'Mango' });
    vi.restoreAllMocks();
  });

  it('sorts by recent (newest first)', () => {
    const sorted = mgr.sorted('recent');
    expect(sorted[0].projectId).toBe(2); // 3000
    expect(sorted[1].projectId).toBe(3); // 2000
    expect(sorted[2].projectId).toBe(1); // 1000
  });

  it('sorts by name alphabetically', () => {
    const sorted = mgr.sorted('name');
    expect(sorted[0].name).toBe('Apple');
    expect(sorted[1].name).toBe('Mango');
    expect(sorted[2].name).toBe('Zebra');
  });

  it('sorts by pinned-first, then recent within groups', () => {
    mgr.togglePin(1); // Pin Zebra (oldest)
    const sorted = mgr.sorted('pinned');
    expect(sorted[0].projectId).toBe(1); // pinned
    expect(sorted[1].projectId).toBe(2); // unpinned, most recent
    expect(sorted[2].projectId).toBe(3); // unpinned, older
  });

  it('pinned sort with multiple pinned entries orders by recent within pinned group', () => {
    mgr.togglePin(1); // Pin Zebra (oldest, 1000)
    mgr.togglePin(3); // Pin Mango (2000)
    const sorted = mgr.sorted('pinned');
    // Both pinned: Mango (2000) before Zebra (1000)
    expect(sorted[0].projectId).toBe(3);
    expect(sorted[1].projectId).toBe(1);
    // Unpinned: Apple
    expect(sorted[2].projectId).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Combined Query (search + sort)
// ---------------------------------------------------------------------------

describe('RecentProjectsManager - query()', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    mgr.recordAccess({ id: 1, name: 'Rover Alpha', description: 'Main rover' });
    vi.restoreAllMocks();

    vi.spyOn(Date, 'now').mockReturnValue(2000);
    mgr.recordAccess({ id: 2, name: 'Rover Beta' });
    vi.restoreAllMocks();

    vi.spyOn(Date, 'now').mockReturnValue(3000);
    mgr.recordAccess({ id: 3, name: 'LED Panel' });
    vi.restoreAllMocks();
  });

  it('filters and sorts by recent', () => {
    const results = mgr.query('rover', 'recent');
    expect(results).toHaveLength(2);
    expect(results[0].projectId).toBe(2); // more recent
    expect(results[1].projectId).toBe(1);
  });

  it('filters and sorts by name', () => {
    const results = mgr.query('rover', 'name');
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('Rover Alpha');
    expect(results[1].name).toBe('Rover Beta');
  });

  it('filters and sorts by pinned', () => {
    mgr.togglePin(1); // Pin Rover Alpha (older)
    const results = mgr.query('rover', 'pinned');
    expect(results).toHaveLength(2);
    expect(results[0].projectId).toBe(1); // pinned
    expect(results[1].projectId).toBe(2); // unpinned
  });

  it('returns all sorted when query is empty', () => {
    const results = mgr.query('', 'name');
    expect(results).toHaveLength(3);
    expect(results[0].name).toBe('LED Panel');
  });
});

// ---------------------------------------------------------------------------
// Subscribe / Unsubscribe
// ---------------------------------------------------------------------------

describe('RecentProjectsManager - Subscribe', () => {
  it('listener receives notifications', () => {
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.recordAccess({ id: 1, name: 'P1' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications', () => {
    const listener = vi.fn();
    const unsub = mgr.subscribe(listener);
    unsub();
    mgr.recordAccess({ id: 1, name: 'P1' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('multiple listeners all receive notifications', () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    mgr.subscribe(l1);
    mgr.subscribe(l2);
    mgr.recordAccess({ id: 1, name: 'P1' });
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Persistence (load from localStorage)
// ---------------------------------------------------------------------------

describe('RecentProjectsManager - Persistence', () => {
  it('loads entries from localStorage on construction', () => {
    const data: RecentProjectsData = {
      entries: [
        { projectId: 1, name: 'Saved', lastAccessedAt: 1000, pinned: true },
      ],
    };
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(data));
    RecentProjectsManager.resetForTesting();
    const fresh = RecentProjectsManager.getInstance();
    expect(fresh.getCount()).toBe(1);
    expect(fresh.findEntry(1)!.pinned).toBe(true);
  });

  it('handles corrupt localStorage gracefully', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('not-json');
    RecentProjectsManager.resetForTesting();
    const fresh = RecentProjectsManager.getInstance();
    expect(fresh.getCount()).toBe(0);
  });

  it('handles missing entries array gracefully', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('{}');
    RecentProjectsManager.resetForTesting();
    const fresh = RecentProjectsManager.getInstance();
    expect(fresh.getCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Import / Export
// ---------------------------------------------------------------------------

describe('RecentProjectsManager - Import/Export', () => {
  it('exportData returns a copy of entries', () => {
    mgr.recordAccess({ id: 1, name: 'P1' });
    const exported = mgr.exportData();
    expect(exported.entries).toHaveLength(1);
    // Mutating export shouldn't affect internal state
    exported.entries[0].name = 'Modified';
    expect(mgr.findEntry(1)!.name).toBe('P1');
  });

  it('importData replaces entries', () => {
    mgr.recordAccess({ id: 1, name: 'P1' });
    const data: RecentProjectsData = {
      entries: [
        { projectId: 10, name: 'Imported', lastAccessedAt: 5000, pinned: false },
        { projectId: 20, name: 'Also Imported', lastAccessedAt: 6000, pinned: true },
      ],
    };
    mgr.importData(data);
    expect(mgr.getCount()).toBe(2);
    expect(mgr.findEntry(1)).toBeUndefined();
    expect(mgr.findEntry(10)).toBeDefined();
  });

  it('importData ignores invalid data', () => {
    mgr.recordAccess({ id: 1, name: 'P1' });
    mgr.importData({ entries: 'not-an-array' } as unknown as RecentProjectsData);
    // Should not have changed
    expect(mgr.getCount()).toBe(1);
  });

  it('importData notifies listeners', () => {
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.importData({ entries: [{ projectId: 1, name: 'P', lastAccessedAt: 1, pinned: false }] });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getPinnedEntries
// ---------------------------------------------------------------------------

describe('RecentProjectsManager - getPinnedEntries', () => {
  it('returns only pinned entries', () => {
    mgr.recordAccess({ id: 1, name: 'P1' });
    mgr.recordAccess({ id: 2, name: 'P2' });
    mgr.recordAccess({ id: 3, name: 'P3' });
    mgr.togglePin(1);
    mgr.togglePin(3);
    const pinned = mgr.getPinnedEntries();
    expect(pinned).toHaveLength(2);
    expect(pinned.map((e) => e.projectId).sort()).toEqual([1, 3]);
  });

  it('returns empty when nothing is pinned', () => {
    mgr.recordAccess({ id: 1, name: 'P1' });
    expect(mgr.getPinnedEntries()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Returns copies (immutability)
// ---------------------------------------------------------------------------

describe('RecentProjectsManager - Immutability', () => {
  it('getEntries returns copies', () => {
    mgr.recordAccess({ id: 1, name: 'P1' });
    const entries = mgr.getEntries();
    entries[0].name = 'Modified';
    expect(mgr.findEntry(1)!.name).toBe('P1');
  });

  it('findEntry returns a copy', () => {
    mgr.recordAccess({ id: 1, name: 'P1' });
    const entry = mgr.findEntry(1)!;
    entry.name = 'Modified';
    expect(mgr.findEntry(1)!.name).toBe('P1');
  });

  it('sorted returns copies', () => {
    mgr.recordAccess({ id: 1, name: 'P1' });
    const sorted = mgr.sorted('recent');
    sorted[0].name = 'Modified';
    expect(mgr.findEntry(1)!.name).toBe('P1');
  });
});

// ---------------------------------------------------------------------------
// useRecentProjects hook
// ---------------------------------------------------------------------------

describe('useRecentProjects', () => {
  it('returns entries from the manager', () => {
    mgr.recordAccess({ id: 1, name: 'P1' });
    mgr.recordAccess({ id: 2, name: 'P2' });
    const { result } = renderHook(() => useRecentProjects());
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.count).toBe(2);
  });

  it('recordAccess updates entries', () => {
    const { result } = renderHook(() => useRecentProjects());
    expect(result.current.entries).toHaveLength(0);
    act(() => {
      result.current.recordAccess({ id: 1, name: 'New Project' });
    });
    expect(result.current.entries).toHaveLength(1);
  });

  it('togglePin updates state', () => {
    mgr.recordAccess({ id: 1, name: 'P1' });
    const { result } = renderHook(() => useRecentProjects());
    act(() => {
      result.current.togglePin(1);
    });
    expect(result.current.pinnedEntries).toHaveLength(1);
  });

  it('clearAll empties entries', () => {
    mgr.recordAccess({ id: 1, name: 'P1' });
    const { result } = renderHook(() => useRecentProjects());
    act(() => {
      result.current.clearAll();
    });
    expect(result.current.entries).toHaveLength(0);
    expect(result.current.count).toBe(0);
  });

  it('search filters entries', () => {
    mgr.recordAccess({ id: 1, name: 'Arduino Rover' });
    mgr.recordAccess({ id: 2, name: 'LED Panel' });
    const { result } = renderHook(() => useRecentProjects());
    const found = result.current.search('arduino');
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe('Arduino Rover');
  });

  it('sorted returns ordered entries', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    mgr.recordAccess({ id: 1, name: 'Zebra' });
    vi.restoreAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    mgr.recordAccess({ id: 2, name: 'Apple' });
    vi.restoreAllMocks();

    const { result } = renderHook(() => useRecentProjects());
    const byName = result.current.sorted('name');
    expect(byName[0].name).toBe('Apple');
    expect(byName[1].name).toBe('Zebra');
  });

  it('query combines search and sort', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    mgr.recordAccess({ id: 1, name: 'Rover Alpha' });
    vi.restoreAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    mgr.recordAccess({ id: 2, name: 'Rover Beta' });
    vi.restoreAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(3000);
    mgr.recordAccess({ id: 3, name: 'LED Panel' });
    vi.restoreAllMocks();

    const { result } = renderHook(() => useRecentProjects());
    const results = result.current.query('rover', 'name');
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('Rover Alpha');
    expect(results[1].name).toBe('Rover Beta');
  });
});
