import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { FavoritesManager, useFavorites } from '../component-favorites';
import type { FavoriteEntry } from '../component-favorites';

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

describe('FavoritesManager', () => {
  let manager: FavoritesManager;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    FavoritesManager.resetInstance();
    manager = FavoritesManager.getInstance();
  });

  afterEach(() => {
    FavoritesManager.resetInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  it('returns the same instance on repeated calls', () => {
    const a = FavoritesManager.getInstance();
    const b = FavoritesManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetInstance', () => {
    manager.addFavorite('R1', { name: '10K Resistor' });
    FavoritesManager.resetInstance();
    const fresh = FavoritesManager.getInstance();
    // fresh instance will load from localStorage, so it should still have R1
    expect(fresh.isFavorite('R1')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Add / Remove / Toggle
  // -----------------------------------------------------------------------

  it('adds a favorite', () => {
    manager.addFavorite('R1', { name: '10K Resistor', family: 'Resistors' });
    expect(manager.isFavorite('R1')).toBe(true);
    expect(manager.getCount()).toBe(1);
  });

  it('removes a favorite', () => {
    manager.addFavorite('R1', { name: '10K Resistor' });
    manager.removeFavorite('R1');
    expect(manager.isFavorite('R1')).toBe(false);
    expect(manager.getCount()).toBe(0);
  });

  it('toggles a favorite on', () => {
    manager.toggleFavorite('R1', { name: '10K Resistor' });
    expect(manager.isFavorite('R1')).toBe(true);
  });

  it('toggles a favorite off', () => {
    manager.addFavorite('R1', { name: '10K Resistor' });
    manager.toggleFavorite('R1', { name: '10K Resistor' });
    expect(manager.isFavorite('R1')).toBe(false);
  });

  it('duplicate add is idempotent', () => {
    manager.addFavorite('R1', { name: '10K Resistor' });
    manager.addFavorite('R1', { name: '10K Resistor' });
    expect(manager.getCount()).toBe(1);
  });

  it('removeFavorite is safe for non-existent ID', () => {
    expect(() => {
      manager.removeFavorite('nonexistent');
    }).not.toThrow();
    expect(manager.getCount()).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  it('isFavorite returns correct boolean', () => {
    manager.addFavorite('R1', { name: '10K Resistor' });
    expect(manager.isFavorite('R1')).toBe(true);
    expect(manager.isFavorite('C1')).toBe(false);
  });

  it('getFavorites returns sorted by newest first', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(now - 2000) // oldest
      .mockReturnValueOnce(now - 1000) // middle
      .mockReturnValueOnce(now);       // newest

    manager.addFavorite('R1', { name: '10K Resistor' });
    manager.addFavorite('C1', { name: '100nF Cap' });
    manager.addFavorite('U1', { name: 'ATmega328P' });

    const favorites = manager.getFavorites();
    expect(favorites[0].componentId).toBe('U1');
    expect(favorites[1].componentId).toBe('C1');
    expect(favorites[2].componentId).toBe('R1');

    vi.restoreAllMocks();
  });

  it('stores metadata correctly', () => {
    manager.addFavorite('R1', {
      name: '10K Resistor',
      family: 'Resistors',
      packageType: '0805',
    });
    const favorites = manager.getFavorites();
    expect(favorites[0].name).toBe('10K Resistor');
    expect(favorites[0].family).toBe('Resistors');
    expect(favorites[0].packageType).toBe('0805');
  });

  // -----------------------------------------------------------------------
  // Max limit
  // -----------------------------------------------------------------------

  it('enforces max 50 favorites by evicting oldest', () => {
    const baseTime = Date.now();
    const dateSpy = vi.spyOn(Date, 'now');

    // Add 50 favorites
    for (let i = 0; i < 50; i++) {
      dateSpy.mockReturnValueOnce(baseTime + i);
      manager.addFavorite(`comp-${i}`, { name: `Component ${i}` });
    }
    expect(manager.getCount()).toBe(50);

    // Add the 51st — should evict the oldest (comp-0, addedAt = baseTime + 0)
    dateSpy.mockReturnValueOnce(baseTime + 50);
    manager.addFavorite('comp-50', { name: 'Component 50' });
    expect(manager.getCount()).toBe(50);
    expect(manager.isFavorite('comp-0')).toBe(false);
    expect(manager.isFavorite('comp-50')).toBe(true);

    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // clearAll
  // -----------------------------------------------------------------------

  it('clearAll empties the list', () => {
    manager.addFavorite('R1', { name: '10K Resistor' });
    manager.addFavorite('C1', { name: '100nF Cap' });
    manager.clearAll();
    expect(manager.getCount()).toBe(0);
    expect(manager.getFavorites()).toEqual([]);
  });

  it('clearAll is safe when already empty', () => {
    expect(() => {
      manager.clearAll();
    }).not.toThrow();
  });

  // -----------------------------------------------------------------------
  // localStorage persistence
  // -----------------------------------------------------------------------

  it('persists to localStorage on add', () => {
    manager.addFavorite('R1', { name: '10K Resistor' });
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'protopulse-component-favorites',
      expect.any(String),
    );
  });

  it('persists to localStorage on remove', () => {
    manager.addFavorite('R1', { name: '10K Resistor' });
    vi.mocked(mockStorage.setItem).mockClear();
    manager.removeFavorite('R1');
    expect(mockStorage.setItem).toHaveBeenCalled();
  });

  it('loads from localStorage on init', () => {
    const entries: FavoriteEntry[] = [
      { componentId: 'R1', name: '10K Resistor', addedAt: Date.now() },
    ];
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(entries));

    FavoritesManager.resetInstance();
    const loaded = FavoritesManager.getInstance();
    expect(loaded.isFavorite('R1')).toBe(true);
  });

  it('handles corrupt localStorage gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('not valid json{{{');
    FavoritesManager.resetInstance();
    const loaded = FavoritesManager.getInstance();
    expect(loaded.getCount()).toBe(0);
    expect(loaded.getFavorites()).toEqual([]);
  });

  it('handles non-array localStorage data gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('{"key": "value"}');
    FavoritesManager.resetInstance();
    const loaded = FavoritesManager.getInstance();
    expect(loaded.getCount()).toBe(0);
  });

  it('filters out invalid entries from localStorage', () => {
    const data = [
      { componentId: 'R1', name: '10K Resistor', addedAt: 123456 },
      { invalid: true }, // missing required fields
      { componentId: 'C1', name: 'Cap', addedAt: 123457 },
    ];
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(data));
    FavoritesManager.resetInstance();
    const loaded = FavoritesManager.getInstance();
    expect(loaded.getCount()).toBe(2);
    expect(loaded.isFavorite('R1')).toBe(true);
    expect(loaded.isFavorite('C1')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Subscribe / unsubscribe
  // -----------------------------------------------------------------------

  it('calls subscriber on add', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.addFavorite('R1', { name: '10K Resistor' });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on remove', () => {
    manager.addFavorite('R1', { name: '10K Resistor' });
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.removeFavorite('R1');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on clearAll', () => {
    manager.addFavorite('R1', { name: '10K Resistor' });
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.clearAll();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not call subscriber after unsubscribe', () => {
    const callback = vi.fn();
    const unsub = manager.subscribe(callback);
    unsub();
    manager.addFavorite('R1', { name: '10K Resistor' });
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not notify on duplicate add', () => {
    manager.addFavorite('R1', { name: '10K Resistor' });
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.addFavorite('R1', { name: '10K Resistor' }); // idempotent
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not notify on remove of non-existent', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.removeFavorite('nonexistent');
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not notify on clearAll when already empty', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.clearAll();
    expect(callback).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

describe('useFavorites', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    FavoritesManager.resetInstance();
  });

  afterEach(() => {
    FavoritesManager.resetInstance();
  });

  it('returns initial empty state', () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it('adds a favorite via hook', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => {
      result.current.addFavorite('R1', { name: '10K Resistor' });
    });
    expect(result.current.favorites).toHaveLength(1);
    expect(result.current.isFavorite('R1')).toBe(true);
    expect(result.current.count).toBe(1);
  });

  it('removes a favorite via hook', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => {
      result.current.addFavorite('R1', { name: '10K Resistor' });
    });
    act(() => {
      result.current.removeFavorite('R1');
    });
    expect(result.current.favorites).toHaveLength(0);
    expect(result.current.isFavorite('R1')).toBe(false);
  });

  it('toggles a favorite via hook', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => {
      result.current.toggleFavorite('R1', { name: '10K Resistor' });
    });
    expect(result.current.isFavorite('R1')).toBe(true);
    act(() => {
      result.current.toggleFavorite('R1', { name: '10K Resistor' });
    });
    expect(result.current.isFavorite('R1')).toBe(false);
  });

  it('clears all via hook', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => {
      result.current.addFavorite('R1', { name: '10K Resistor' });
      result.current.addFavorite('C1', { name: '100nF Cap' });
    });
    act(() => {
      result.current.clearAll();
    });
    expect(result.current.favorites).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useFavorites());
    unmount();
    // Should not throw when manager notifies after unmount
    expect(() => {
      FavoritesManager.getInstance().addFavorite('R1', { name: '10K Resistor' });
    }).not.toThrow();
  });
});
