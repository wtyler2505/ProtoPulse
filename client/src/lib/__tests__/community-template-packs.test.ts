import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  CommunityPackManager,
  BUILT_IN_PACKS,
  useTemplatePacks,
} from '../community-template-packs';
import type { TemplatePack, PackCategory } from '../community-template-packs';

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
// Helper
// ---------------------------------------------------------------------------

function makeCustomPack(overrides: Partial<TemplatePack> = {}): TemplatePack {
  return {
    id: overrides.id ?? 'custom-pack',
    name: overrides.name ?? 'Custom Pack',
    author: overrides.author ?? 'Test Author',
    description: overrides.description ?? 'A custom test pack.',
    category: overrides.category ?? 'beginner',
    tags: overrides.tags ?? ['custom', 'test'],
    templates: overrides.templates ?? [
      { id: 'tpl-1', name: 'Template One', type: 'circuit', data: { value: 1 } },
    ],
    downloads: overrides.downloads ?? 0,
    rating: overrides.rating ?? 4.0,
    createdAt: overrides.createdAt ?? Date.now(),
  };
}

// ---------------------------------------------------------------------------
// CommunityPackManager
// ---------------------------------------------------------------------------

describe('CommunityPackManager', () => {
  let manager: CommunityPackManager;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    CommunityPackManager.resetInstance();
    manager = CommunityPackManager.getInstance();
  });

  afterEach(() => {
    CommunityPackManager.resetInstance();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  it('returns the same instance on repeated calls', () => {
    const a = CommunityPackManager.getInstance();
    const b = CommunityPackManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetInstance', () => {
    manager.installPack('arduino-starter');
    CommunityPackManager.resetInstance();
    const fresh = CommunityPackManager.getInstance();
    // fresh instance loads from localStorage, so it should still have the install
    expect(fresh.isInstalled('arduino-starter')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Built-in packs
  // -----------------------------------------------------------------------

  it('includes all 5 built-in packs by default', () => {
    const packs = manager.getAllPacks();
    expect(packs).toHaveLength(5);
    expect(packs.map((p) => p.id)).toEqual([
      'arduino-starter',
      'sensor-hub',
      'power-supply',
      'led-matrix',
      'robot-arm',
    ]);
  });

  it('BUILT_IN_PACKS constant has 5 entries', () => {
    expect(BUILT_IN_PACKS).toHaveLength(5);
  });

  it('each built-in pack has at least one template', () => {
    for (const pack of BUILT_IN_PACKS) {
      expect(pack.templates.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('each built-in pack has unique IDs', () => {
    const ids = BUILT_IN_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each template within a pack has a unique ID', () => {
    for (const pack of BUILT_IN_PACKS) {
      const tids = pack.templates.map((t) => t.id);
      expect(new Set(tids).size).toBe(tids.length);
    }
  });

  // -----------------------------------------------------------------------
  // getPackById
  // -----------------------------------------------------------------------

  it('getPackById returns correct pack', () => {
    const pack = manager.getPackById('sensor-hub');
    expect(pack).toBeDefined();
    expect(pack!.name).toBe('Sensor Hub');
  });

  it('getPackById returns undefined for unknown ID', () => {
    expect(manager.getPackById('nonexistent')).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Install / Uninstall
  // -----------------------------------------------------------------------

  it('installs a pack', () => {
    const result = manager.installPack('arduino-starter');
    expect(result).toBe(true);
    expect(manager.isInstalled('arduino-starter')).toBe(true);
  });

  it('install increments download count', () => {
    const before = manager.getPackById('arduino-starter')!.downloads;
    manager.installPack('arduino-starter');
    const after = manager.getPackById('arduino-starter')!.downloads;
    expect(after).toBe(before + 1);
  });

  it('duplicate install is idempotent', () => {
    manager.installPack('arduino-starter');
    const downloadsBefore = manager.getPackById('arduino-starter')!.downloads;
    const result = manager.installPack('arduino-starter');
    expect(result).toBe(true);
    // Downloads should NOT increment again
    expect(manager.getPackById('arduino-starter')!.downloads).toBe(downloadsBefore);
    expect(manager.getInstalledCount()).toBe(1);
  });

  it('install returns false for unknown pack', () => {
    const result = manager.installPack('nonexistent');
    expect(result).toBe(false);
  });

  it('uninstalls a pack', () => {
    manager.installPack('arduino-starter');
    const result = manager.uninstallPack('arduino-starter');
    expect(result).toBe(true);
    expect(manager.isInstalled('arduino-starter')).toBe(false);
  });

  it('uninstall of non-installed pack is idempotent', () => {
    const result = manager.uninstallPack('sensor-hub');
    expect(result).toBe(true);
    expect(manager.isInstalled('sensor-hub')).toBe(false);
  });

  it('uninstall returns false for unknown pack', () => {
    const result = manager.uninstallPack('nonexistent');
    expect(result).toBe(false);
  });

  it('getInstalledPacks returns only installed packs', () => {
    manager.installPack('arduino-starter');
    manager.installPack('power-supply');
    const installed = manager.getInstalledPacks();
    expect(installed).toHaveLength(2);
    const ids = installed.map((p) => p.id);
    expect(ids).toContain('arduino-starter');
    expect(ids).toContain('power-supply');
  });

  it('getInstalledCount reflects installed count', () => {
    expect(manager.getInstalledCount()).toBe(0);
    manager.installPack('arduino-starter');
    expect(manager.getInstalledCount()).toBe(1);
    manager.installPack('sensor-hub');
    expect(manager.getInstalledCount()).toBe(2);
    manager.uninstallPack('arduino-starter');
    expect(manager.getInstalledCount()).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  it('searchPacks returns all packs for empty query', () => {
    const results = manager.searchPacks('');
    expect(results).toHaveLength(5);
  });

  it('searchPacks returns all packs for whitespace query', () => {
    const results = manager.searchPacks('   ');
    expect(results).toHaveLength(5);
  });

  it('searchPacks matches on name', () => {
    const results = manager.searchPacks('Arduino');
    expect(results.some((p) => p.id === 'arduino-starter')).toBe(true);
  });

  it('searchPacks is case-insensitive', () => {
    const results = manager.searchPacks('ROBOT ARM');
    expect(results.some((p) => p.id === 'robot-arm')).toBe(true);
  });

  it('searchPacks matches on description', () => {
    const results = manager.searchPacks('buck converter');
    expect(results.some((p) => p.id === 'power-supply')).toBe(true);
  });

  it('searchPacks matches on author', () => {
    const results = manager.searchPacks('ProtoPulse');
    expect(results).toHaveLength(5); // all built-in are by ProtoPulse
  });

  it('searchPacks matches on tags', () => {
    const results = manager.searchPacks('neopixel');
    expect(results.some((p) => p.id === 'led-matrix')).toBe(true);
  });

  it('searchPacks requires all tokens to match', () => {
    const results = manager.searchPacks('arduino beginner');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('arduino-starter');
  });

  it('searchPacks returns empty for no match', () => {
    const results = manager.searchPacks('quantum flux capacitor');
    expect(results).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Filter by category
  // -----------------------------------------------------------------------

  it('filterByCategory returns correct packs', () => {
    const results = manager.filterByCategory('power');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('power-supply');
  });

  it('filterByCategory returns empty for unmatched category', () => {
    const results = manager.filterByCategory('communication');
    expect(results).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Filter by tag
  // -----------------------------------------------------------------------

  it('filterByTag returns packs with matching tag', () => {
    const results = manager.filterByTag('i2c');
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const pack of results) {
      expect(pack.tags.some((t) => t.toLowerCase() === 'i2c')).toBe(true);
    }
  });

  it('filterByTag is case-insensitive', () => {
    const results = manager.filterByTag('I2C');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('filterByTag returns empty for unknown tag', () => {
    const results = manager.filterByTag('nonexistent-tag');
    expect(results).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Categories and tags
  // -----------------------------------------------------------------------

  it('getCategories returns unique categories', () => {
    const cats = manager.getCategories();
    expect(cats.length).toBeGreaterThanOrEqual(1);
    expect(new Set(cats).size).toBe(cats.length);
  });

  it('getAllTags returns sorted, unique, lowercase tags', () => {
    const tags = manager.getAllTags();
    expect(tags.length).toBeGreaterThanOrEqual(1);
    // All unique
    expect(new Set(tags).size).toBe(tags.length);
    // All lowercase
    for (const tag of tags) {
      expect(tag).toBe(tag.toLowerCase());
    }
    // Sorted
    const sorted = [...tags].sort();
    expect(tags).toEqual(sorted);
  });

  // -----------------------------------------------------------------------
  // Custom packs
  // -----------------------------------------------------------------------

  it('addPack adds a custom pack', () => {
    const custom = makeCustomPack();
    const result = manager.addPack(custom);
    expect(result).toBe(true);
    expect(manager.getAllPacks()).toHaveLength(6);
    expect(manager.getPackById('custom-pack')).toBeDefined();
  });

  it('addPack rejects duplicate ID', () => {
    const result = manager.addPack(makeCustomPack({ id: 'arduino-starter' }));
    expect(result).toBe(false);
    expect(manager.getAllPacks()).toHaveLength(5);
  });

  it('removePack removes a custom pack', () => {
    manager.addPack(makeCustomPack());
    const result = manager.removePack('custom-pack');
    expect(result).toBe(true);
    expect(manager.getAllPacks()).toHaveLength(5);
    expect(manager.getPackById('custom-pack')).toBeUndefined();
  });

  it('removePack uninstalls the pack as well', () => {
    manager.addPack(makeCustomPack());
    manager.installPack('custom-pack');
    expect(manager.isInstalled('custom-pack')).toBe(true);
    manager.removePack('custom-pack');
    expect(manager.isInstalled('custom-pack')).toBe(false);
  });

  it('removePack rejects removal of built-in pack', () => {
    const result = manager.removePack('arduino-starter');
    expect(result).toBe(false);
    expect(manager.getAllPacks()).toHaveLength(5);
  });

  it('removePack returns false for unknown pack', () => {
    const result = manager.removePack('nonexistent');
    expect(result).toBe(false);
  });

  // -----------------------------------------------------------------------
  // localStorage persistence
  // -----------------------------------------------------------------------

  it('persists installed IDs to localStorage on install', () => {
    manager.installPack('arduino-starter');
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'protopulse-installed-template-packs',
      expect.any(String),
    );
    const stored = JSON.parse(
      (mockStorage.setItem as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1] as string,
    ) as string[];
    expect(stored).toContain('arduino-starter');
  });

  it('persists to localStorage on uninstall', () => {
    manager.installPack('arduino-starter');
    vi.mocked(mockStorage.setItem).mockClear();
    manager.uninstallPack('arduino-starter');
    expect(mockStorage.setItem).toHaveBeenCalled();
  });

  it('loads installed IDs from localStorage on init', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(['sensor-hub', 'power-supply']));
    CommunityPackManager.resetInstance();
    const loaded = CommunityPackManager.getInstance();
    expect(loaded.isInstalled('sensor-hub')).toBe(true);
    expect(loaded.isInstalled('power-supply')).toBe(true);
    expect(loaded.isInstalled('arduino-starter')).toBe(false);
  });

  it('handles corrupt localStorage gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('not valid json{{{');
    CommunityPackManager.resetInstance();
    const loaded = CommunityPackManager.getInstance();
    expect(loaded.getInstalledCount()).toBe(0);
  });

  it('handles non-array localStorage data gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('{"key": "value"}');
    CommunityPackManager.resetInstance();
    const loaded = CommunityPackManager.getInstance();
    expect(loaded.getInstalledCount()).toBe(0);
  });

  it('filters out non-string entries from localStorage', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(['arduino-starter', 42, null, 'sensor-hub']));
    CommunityPackManager.resetInstance();
    const loaded = CommunityPackManager.getInstance();
    expect(loaded.isInstalled('arduino-starter')).toBe(true);
    expect(loaded.isInstalled('sensor-hub')).toBe(true);
    expect(loaded.getInstalledCount()).toBe(2);
  });

  // -----------------------------------------------------------------------
  // Subscribe / unsubscribe
  // -----------------------------------------------------------------------

  it('calls subscriber on install', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.installPack('arduino-starter');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on uninstall', () => {
    manager.installPack('arduino-starter');
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.uninstallPack('arduino-starter');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on addPack', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.addPack(makeCustomPack());
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on removePack', () => {
    manager.addPack(makeCustomPack());
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.removePack('custom-pack');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not call subscriber after unsubscribe', () => {
    const callback = vi.fn();
    const unsub = manager.subscribe(callback);
    unsub();
    manager.installPack('arduino-starter');
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not notify on duplicate install', () => {
    manager.installPack('arduino-starter');
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.installPack('arduino-starter'); // idempotent
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not notify on uninstall of non-installed pack', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.uninstallPack('sensor-hub'); // already not installed
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not notify on install of unknown pack', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.installPack('nonexistent');
    expect(callback).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

describe('useTemplatePacks', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    CommunityPackManager.resetInstance();
  });

  afterEach(() => {
    CommunityPackManager.resetInstance();
    vi.restoreAllMocks();
  });

  it('returns all 5 built-in packs', () => {
    const { result } = renderHook(() => useTemplatePacks());
    expect(result.current.packs).toHaveLength(5);
  });

  it('returns empty installed list initially', () => {
    const { result } = renderHook(() => useTemplatePacks());
    expect(result.current.installed).toHaveLength(0);
    expect(result.current.installedCount).toBe(0);
  });

  it('installs a pack via hook', () => {
    const { result } = renderHook(() => useTemplatePacks());
    act(() => {
      result.current.install('arduino-starter');
    });
    expect(result.current.installed).toHaveLength(1);
    expect(result.current.isInstalled('arduino-starter')).toBe(true);
    expect(result.current.installedCount).toBe(1);
  });

  it('uninstalls a pack via hook', () => {
    const { result } = renderHook(() => useTemplatePacks());
    act(() => {
      result.current.install('arduino-starter');
    });
    act(() => {
      result.current.uninstall('arduino-starter');
    });
    expect(result.current.installed).toHaveLength(0);
    expect(result.current.isInstalled('arduino-starter')).toBe(false);
  });

  it('search works via hook', () => {
    const { result } = renderHook(() => useTemplatePacks());
    const results = result.current.search('robot');
    expect(results.some((p) => p.id === 'robot-arm')).toBe(true);
  });

  it('filterByCategory works via hook', () => {
    const { result } = renderHook(() => useTemplatePacks());
    const results = result.current.filterByCategory('sensors');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('sensor-hub');
  });

  it('filterByTag works via hook', () => {
    const { result } = renderHook(() => useTemplatePacks());
    const results = result.current.filterByTag('servo');
    expect(results.some((p) => p.id === 'robot-arm')).toBe(true);
  });

  it('getPackById works via hook', () => {
    const { result } = renderHook(() => useTemplatePacks());
    const pack = result.current.getPackById('led-matrix');
    expect(pack).toBeDefined();
    expect(pack!.name).toBe('LED Matrix');
  });

  it('exposes categories and tags', () => {
    const { result } = renderHook(() => useTemplatePacks());
    expect(result.current.categories.length).toBeGreaterThanOrEqual(1);
    expect(result.current.tags.length).toBeGreaterThanOrEqual(1);
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useTemplatePacks());
    unmount();
    // Should not throw when manager notifies after unmount
    expect(() => {
      CommunityPackManager.getInstance().installPack('arduino-starter');
    }).not.toThrow();
  });
});
