import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  ActivityFeedManager,
  getActivityFeedManager,
  resetActivityFeedManager,
  useActivityFeed,
} from '../activity-feed';
import type {
  ActivityEntry,
  ActivityAction,
  ActivityEntityType,
  ActivityFilter,
} from '../activity-feed';

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

function makeEntryParams(overrides: Partial<Omit<ActivityEntry, 'id' | 'timestamp'>> = {}) {
  return {
    action: overrides.action ?? ('created' as ActivityAction),
    entityType: overrides.entityType ?? ('architecture_node' as ActivityEntityType),
    entityId: overrides.entityId ?? 'node-1',
    entityLabel: overrides.entityLabel ?? 'Arduino Mega',
    userId: overrides.userId,
    userName: overrides.userName,
    details: overrides.details,
  };
}

// ---------------------------------------------------------------------------
// ActivityFeedManager — core tests
// ---------------------------------------------------------------------------

describe('ActivityFeedManager', () => {
  let manager: ActivityFeedManager;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    resetActivityFeedManager();
    manager = ActivityFeedManager.create(1);
  });

  afterEach(() => {
    resetActivityFeedManager();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Construction / factory
  // -----------------------------------------------------------------------

  it('creates a manager with zero entries for a fresh project', () => {
    expect(manager.count).toBe(0);
    expect(manager.getAllEntries()).toEqual([]);
  });

  it('exposes the projectId', () => {
    expect(manager.projectId).toBe(1);
  });

  it('creates separate instances via create()', () => {
    const a = ActivityFeedManager.create(1);
    const b = ActivityFeedManager.create(2);
    expect(a).not.toBe(b);
  });

  // -----------------------------------------------------------------------
  // addEntry
  // -----------------------------------------------------------------------

  it('adds an entry and returns it with id and timestamp', () => {
    const entry = manager.addEntry(makeEntryParams());
    expect(entry.id).toBeDefined();
    expect(typeof entry.id).toBe('string');
    expect(entry.timestamp).toBeGreaterThan(0);
    expect(entry.action).toBe('created');
    expect(entry.entityType).toBe('architecture_node');
    expect(entry.entityId).toBe('node-1');
    expect(entry.entityLabel).toBe('Arduino Mega');
    expect(manager.count).toBe(1);
  });

  it('prepends new entries (newest first)', () => {
    manager.addEntry(makeEntryParams({ entityId: 'a', entityLabel: 'First' }));
    manager.addEntry(makeEntryParams({ entityId: 'b', entityLabel: 'Second' }));
    const entries = manager.getAllEntries();
    expect(entries[0].entityLabel).toBe('Second');
    expect(entries[1].entityLabel).toBe('First');
  });

  it('stores optional userId and userName', () => {
    const entry = manager.addEntry(
      makeEntryParams({ userId: 'user-42', userName: 'Tyler' }),
    );
    expect(entry.userId).toBe('user-42');
    expect(entry.userName).toBe('Tyler');
  });

  it('stores optional details', () => {
    const entry = manager.addEntry(
      makeEntryParams({ details: 'Added via AI assistant' }),
    );
    expect(entry.details).toBe('Added via AI assistant');
  });

  it('trims to MAX_ENTRIES (200) when overfilled', () => {
    for (let i = 0; i < 210; i++) {
      manager.addEntry(makeEntryParams({ entityId: `node-${i}`, entityLabel: `Node ${i}` }));
    }
    expect(manager.count).toBe(200);
    // Newest should be the last added
    expect(manager.getAllEntries()[0].entityLabel).toBe('Node 209');
  });

  // -----------------------------------------------------------------------
  // removeEntry
  // -----------------------------------------------------------------------

  it('removes an entry by ID', () => {
    const entry = manager.addEntry(makeEntryParams());
    expect(manager.removeEntry(entry.id)).toBe(true);
    expect(manager.count).toBe(0);
  });

  it('returns false when removing a non-existent entry', () => {
    expect(manager.removeEntry('nonexistent-id')).toBe(false);
  });

  it('does not notify when removing a non-existent entry', () => {
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.removeEntry('nonexistent-id');
    expect(listener).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // clearAll
  // -----------------------------------------------------------------------

  it('clears all entries', () => {
    manager.addEntry(makeEntryParams());
    manager.addEntry(makeEntryParams({ entityId: 'node-2' }));
    manager.clearAll();
    expect(manager.count).toBe(0);
    expect(manager.getAllEntries()).toEqual([]);
  });

  it('does not notify when clearing an already-empty feed', () => {
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.clearAll();
    expect(listener).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Filtering
  // -----------------------------------------------------------------------

  it('filters by action', () => {
    manager.addEntry(makeEntryParams({ action: 'created' }));
    manager.addEntry(makeEntryParams({ action: 'deleted' }));
    manager.addEntry(makeEntryParams({ action: 'created' }));
    const result = manager.getFilteredEntries({ action: 'created' });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.action === 'created')).toBe(true);
  });

  it('filters by entityType', () => {
    manager.addEntry(makeEntryParams({ entityType: 'bom_item' }));
    manager.addEntry(makeEntryParams({ entityType: 'architecture_node' }));
    const result = manager.getFilteredEntries({ entityType: 'bom_item' });
    expect(result).toHaveLength(1);
    expect(result[0].entityType).toBe('bom_item');
  });

  it('filters by userId', () => {
    manager.addEntry(makeEntryParams({ userId: 'user-1' }));
    manager.addEntry(makeEntryParams({ userId: 'user-2' }));
    manager.addEntry(makeEntryParams({ userId: 'user-1' }));
    const result = manager.getFilteredEntries({ userId: 'user-1' });
    expect(result).toHaveLength(2);
  });

  it('filters by search (case-insensitive, matches label)', () => {
    manager.addEntry(makeEntryParams({ entityLabel: 'Arduino Mega 2560' }));
    manager.addEntry(makeEntryParams({ entityLabel: 'ESP32 DevKit' }));
    const result = manager.getFilteredEntries({ search: 'arduino' });
    expect(result).toHaveLength(1);
    expect(result[0].entityLabel).toBe('Arduino Mega 2560');
  });

  it('filters by search matching details', () => {
    manager.addEntry(makeEntryParams({ details: 'Exported to KiCad format' }));
    manager.addEntry(makeEntryParams({ details: 'Added via drag-and-drop' }));
    const result = manager.getFilteredEntries({ search: 'kicad' });
    expect(result).toHaveLength(1);
  });

  it('filters by search matching userName', () => {
    manager.addEntry(makeEntryParams({ userName: 'Tyler' }));
    manager.addEntry(makeEntryParams({ userName: 'Alice' }));
    const result = manager.getFilteredEntries({ search: 'tyler' });
    expect(result).toHaveLength(1);
  });

  it('filters by search matching action name', () => {
    manager.addEntry(makeEntryParams({ action: 'exported' }));
    manager.addEntry(makeEntryParams({ action: 'created' }));
    const result = manager.getFilteredEntries({ search: 'exported' });
    expect(result).toHaveLength(1);
  });

  it('applies multiple filters simultaneously', () => {
    manager.addEntry(makeEntryParams({ action: 'created', entityType: 'bom_item', userId: 'user-1' }));
    manager.addEntry(makeEntryParams({ action: 'created', entityType: 'architecture_node', userId: 'user-1' }));
    manager.addEntry(makeEntryParams({ action: 'deleted', entityType: 'bom_item', userId: 'user-1' }));
    const result = manager.getFilteredEntries({ action: 'created', entityType: 'bom_item' });
    expect(result).toHaveLength(1);
  });

  it('returns empty array when no entries match filter', () => {
    manager.addEntry(makeEntryParams({ action: 'created' }));
    const result = manager.getFilteredEntries({ action: 'validated' });
    expect(result).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // getDistinctUsers
  // -----------------------------------------------------------------------

  it('returns distinct users from entries', () => {
    manager.addEntry(makeEntryParams({ userId: 'user-1', userName: 'Tyler' }));
    manager.addEntry(makeEntryParams({ userId: 'user-2', userName: 'Alice' }));
    manager.addEntry(makeEntryParams({ userId: 'user-1', userName: 'Tyler' }));
    const users = manager.getDistinctUsers();
    expect(users).toHaveLength(2);
    expect(users).toEqual(
      expect.arrayContaining([
        { userId: 'user-1', userName: 'Tyler' },
        { userId: 'user-2', userName: 'Alice' },
      ]),
    );
  });

  it('excludes entries without userId from distinct users', () => {
    manager.addEntry(makeEntryParams()); // No userId
    manager.addEntry(makeEntryParams({ userId: 'user-1' }));
    const users = manager.getDistinctUsers();
    expect(users).toHaveLength(1);
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  it('notifies subscribers on addEntry', () => {
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.addEntry(makeEntryParams());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on removeEntry', () => {
    const entry = manager.addEntry(makeEntryParams());
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.removeEntry(entry.id);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on clearAll', () => {
    manager.addEntry(makeEntryParams());
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.clearAll();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsub = manager.subscribe(listener);
    unsub();
    manager.addEntry(makeEntryParams());
    expect(listener).not.toHaveBeenCalled();
  });

  it('increments version on each mutation', () => {
    const v0 = manager.getSnapshot().version;
    manager.addEntry(makeEntryParams());
    const v1 = manager.getSnapshot().version;
    manager.addEntry(makeEntryParams({ entityId: 'x' }));
    const v2 = manager.getSnapshot().version;
    expect(v1).toBe(v0 + 1);
    expect(v2).toBe(v1 + 1);
  });

  it('getSnapshot returns current entries', () => {
    manager.addEntry(makeEntryParams({ entityLabel: 'Snap' }));
    const snap = manager.getSnapshot();
    expect(snap.entries).toHaveLength(1);
    expect(snap.entries[0].entityLabel).toBe('Snap');
  });

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  it('persists entries to localStorage', () => {
    manager.addEntry(makeEntryParams());
    expect(mockStorage.setItem).toHaveBeenCalled();
    const key = (mockStorage.setItem as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(key).toBe('protopulse-activity-feed-1');
  });

  it('loads entries from localStorage on construction', () => {
    manager.addEntry(makeEntryParams({ entityLabel: 'Persisted Node' }));
    // Create a new manager for the same project — should load from storage
    const manager2 = ActivityFeedManager.create(1);
    expect(manager2.count).toBe(1);
    expect(manager2.getAllEntries()[0].entityLabel).toBe('Persisted Node');
  });

  it('handles corrupted localStorage data gracefully', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('not-valid-json');
    const m = ActivityFeedManager.create(99);
    expect(m.count).toBe(0);
  });

  it('handles localStorage.setItem failure gracefully', () => {
    (mockStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    // Should not throw
    expect(() => manager.addEntry(makeEntryParams())).not.toThrow();
    expect(manager.count).toBe(1);
  });

  it('validates entries on load — ignores invalid action types', () => {
    const invalid = [{ id: 'x', timestamp: 1, action: 'INVALID', entityType: 'bom_item', entityId: 'a', entityLabel: 'A' }];
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(invalid));
    const m = ActivityFeedManager.create(50);
    expect(m.count).toBe(0);
  });

  it('validates entries on load — ignores invalid entityType', () => {
    const invalid = [{ id: 'x', timestamp: 1, action: 'created', entityType: 'BOGUS', entityId: 'a', entityLabel: 'A' }];
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(invalid));
    const m = ActivityFeedManager.create(51);
    expect(m.count).toBe(0);
  });

  it('validates entries on load — ignores entries missing required fields', () => {
    const invalid = [{ id: 'x', action: 'created' }]; // missing entityType, entityId, entityLabel, timestamp
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(invalid));
    const m = ActivityFeedManager.create(52);
    expect(m.count).toBe(0);
  });

  it('persists after removeEntry', () => {
    const entry = manager.addEntry(makeEntryParams());
    (mockStorage.setItem as ReturnType<typeof vi.fn>).mockClear();
    manager.removeEntry(entry.id);
    expect(mockStorage.setItem).toHaveBeenCalled();
  });

  it('persists after clearAll', () => {
    manager.addEntry(makeEntryParams());
    (mockStorage.setItem as ReturnType<typeof vi.fn>).mockClear();
    manager.clearAll();
    expect(mockStorage.setItem).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('getActivityFeedManager / resetActivityFeedManager', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    resetActivityFeedManager();
  });

  afterEach(() => {
    resetActivityFeedManager();
    vi.restoreAllMocks();
  });

  it('returns the same instance for the same projectId', () => {
    const a = getActivityFeedManager(1);
    const b = getActivityFeedManager(1);
    expect(a).toBe(b);
  });

  it('returns a new instance when projectId changes', () => {
    const a = getActivityFeedManager(1);
    const b = getActivityFeedManager(2);
    expect(a).not.toBe(b);
  });

  it('returns a new instance after resetActivityFeedManager', () => {
    const a = getActivityFeedManager(1);
    resetActivityFeedManager();
    const b = getActivityFeedManager(1);
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// All action types
// ---------------------------------------------------------------------------

describe('ActivityFeedManager — action types', () => {
  let manager: ActivityFeedManager;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    manager = ActivityFeedManager.create(1);
  });

  const actions: ActivityAction[] = ['created', 'updated', 'deleted', 'commented', 'exported', 'imported', 'validated'];

  for (const action of actions) {
    it(`accepts action "${action}"`, () => {
      const entry = manager.addEntry(makeEntryParams({ action }));
      expect(entry.action).toBe(action);
    });
  }
});

// ---------------------------------------------------------------------------
// All entity types
// ---------------------------------------------------------------------------

describe('ActivityFeedManager — entity types', () => {
  let manager: ActivityFeedManager;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    manager = ActivityFeedManager.create(1);
  });

  const entityTypes: ActivityEntityType[] = [
    'project', 'architecture_node', 'architecture_edge', 'bom_item',
    'circuit_design', 'circuit_instance', 'circuit_wire', 'circuit_net',
    'component', 'validation', 'comment', 'export', 'simulation',
  ];

  for (const entityType of entityTypes) {
    it(`accepts entityType "${entityType}"`, () => {
      const entry = manager.addEntry(makeEntryParams({ entityType }));
      expect(entry.entityType).toBe(entityType);
    });
  }
});

// ---------------------------------------------------------------------------
// useActivityFeed hook
// ---------------------------------------------------------------------------

describe('useActivityFeed', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    resetActivityFeedManager();
  });

  afterEach(() => {
    resetActivityFeedManager();
    vi.restoreAllMocks();
  });

  it('provides entries and count', () => {
    const { result } = renderHook(() => useActivityFeed(1));
    expect(result.current.entries).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it('addEntry adds to the feed and re-renders', () => {
    const { result } = renderHook(() => useActivityFeed(1));
    act(() => {
      result.current.addEntry(makeEntryParams({ entityLabel: 'Hook Test' }));
    });
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].entityLabel).toBe('Hook Test');
    expect(result.current.count).toBe(1);
  });

  it('removeEntry removes from the feed', () => {
    const { result } = renderHook(() => useActivityFeed(1));
    let id = '';
    act(() => {
      const entry = result.current.addEntry(makeEntryParams());
      id = entry.id;
    });
    act(() => {
      result.current.removeEntry(id);
    });
    expect(result.current.entries).toHaveLength(0);
  });

  it('clearAll empties the feed', () => {
    const { result } = renderHook(() => useActivityFeed(1));
    act(() => {
      result.current.addEntry(makeEntryParams());
      result.current.addEntry(makeEntryParams({ entityId: 'x' }));
    });
    act(() => {
      result.current.clearAll();
    });
    expect(result.current.entries).toHaveLength(0);
  });

  it('setFilter updates filteredEntries', () => {
    const { result } = renderHook(() => useActivityFeed(1));
    act(() => {
      result.current.addEntry(makeEntryParams({ action: 'created' }));
      result.current.addEntry(makeEntryParams({ action: 'deleted' }));
    });
    act(() => {
      result.current.setFilter({ action: 'created' });
    });
    expect(result.current.filteredEntries).toHaveLength(1);
    expect(result.current.filteredEntries[0].action).toBe('created');
  });

  it('distinctUsers is available', () => {
    const { result } = renderHook(() => useActivityFeed(1));
    act(() => {
      result.current.addEntry(makeEntryParams({ userId: 'u1', userName: 'Tyler' }));
    });
    expect(result.current.distinctUsers).toEqual([{ userId: 'u1', userName: 'Tyler' }]);
  });

  it('filteredEntries returns all entries when filter is empty', () => {
    const { result } = renderHook(() => useActivityFeed(1));
    act(() => {
      result.current.addEntry(makeEntryParams({ action: 'created' }));
      result.current.addEntry(makeEntryParams({ action: 'deleted' }));
    });
    // Default filter is {}
    expect(result.current.filteredEntries).toHaveLength(2);
  });
});
