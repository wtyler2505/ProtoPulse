import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  WorkspacePresetManager,
  BUILT_IN_PRESETS,
  useWorkspacePresets,
} from '../workspace-presets';
import type { WorkspacePreset } from '../workspace-presets';

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

let mgr: WorkspacePresetManager;
let mockStorage: Storage;

beforeEach(() => {
  mockStorage = createMockLocalStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
  WorkspacePresetManager.resetForTesting();
  mgr = WorkspacePresetManager.getInstance();
});

afterEach(() => {
  WorkspacePresetManager.resetForTesting();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('WorkspacePresetManager - Singleton', () => {
  it('returns the same instance on repeated calls', () => {
    const a = WorkspacePresetManager.getInstance();
    const b = WorkspacePresetManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetForTesting', () => {
    const first = WorkspacePresetManager.getInstance();
    WorkspacePresetManager.resetForTesting();
    const second = WorkspacePresetManager.getInstance();
    expect(first).not.toBe(second);
  });
});

// ---------------------------------------------------------------------------
// Built-in Presets
// ---------------------------------------------------------------------------

describe('WorkspacePresetManager - Built-in Presets', () => {
  it('has exactly 4 built-in presets', () => {
    expect(BUILT_IN_PRESETS).toHaveLength(4);
  });

  it('built-in presets have expected IDs', () => {
    const ids = BUILT_IN_PRESETS.map((p) => p.id);
    expect(ids).toContain('builtin-design-focus');
    expect(ids).toContain('builtin-compact');
    expect(ids).toContain('builtin-fullscreen');
    expect(ids).toContain('builtin-review');
  });

  it('Design Focus preset has sidebar and chat visible', () => {
    const designFocus = BUILT_IN_PRESETS.find((p) => p.id === 'builtin-design-focus');
    expect(designFocus).toBeDefined();
    expect(designFocus!.sidebarVisible).toBe(true);
    expect(designFocus!.chatVisible).toBe(true);
  });

  it('Compact preset has sidebar only with narrow width', () => {
    const compact = BUILT_IN_PRESETS.find((p) => p.id === 'builtin-compact');
    expect(compact).toBeDefined();
    expect(compact!.sidebarVisible).toBe(true);
    expect(compact!.chatVisible).toBe(false);
    expect(compact!.sidebarWidth).toBe(200);
  });

  it('Fullscreen preset hides all panels', () => {
    const fullscreen = BUILT_IN_PRESETS.find((p) => p.id === 'builtin-fullscreen');
    expect(fullscreen).toBeDefined();
    expect(fullscreen!.sidebarVisible).toBe(false);
    expect(fullscreen!.chatVisible).toBe(false);
    expect(fullscreen!.sidebarWidth).toBe(0);
  });

  it('Review preset uses validation view with sidebar', () => {
    const review = BUILT_IN_PRESETS.find((p) => p.id === 'builtin-review');
    expect(review).toBeDefined();
    expect(review!.sidebarVisible).toBe(true);
    expect(review!.activeView).toBe('validation');
    expect(review!.chatVisible).toBe(false);
  });

  it('all built-in presets have a non-empty name', () => {
    for (const preset of BUILT_IN_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
    }
  });

  it('all built-in presets have panelSizes as an object', () => {
    for (const preset of BUILT_IN_PRESETS) {
      expect(typeof preset.panelSizes).toBe('object');
      expect(preset.panelSizes).not.toBeNull();
    }
  });

  it('getBuiltInPresets returns copies of built-in presets', () => {
    const presets = mgr.getBuiltInPresets();
    expect(presets).toHaveLength(BUILT_IN_PRESETS.length);
    // Verify they are copies (not the same array reference)
    expect(presets).not.toBe(BUILT_IN_PRESETS);
  });
});

// ---------------------------------------------------------------------------
// Preset Queries
// ---------------------------------------------------------------------------

describe('WorkspacePresetManager - Queries', () => {
  it('getAllPresets returns all built-in presets when no custom exist', () => {
    const all = mgr.getAllPresets();
    expect(all).toHaveLength(BUILT_IN_PRESETS.length);
  });

  it('getCustomPresets returns empty array initially', () => {
    expect(mgr.getCustomPresets()).toHaveLength(0);
  });

  it('getPreset returns a built-in preset by ID', () => {
    const preset = mgr.getPreset('builtin-design-focus');
    expect(preset).not.toBeNull();
    expect(preset!.name).toBe('Design Focus');
  });

  it('getPreset returns null for unknown ID', () => {
    expect(mgr.getPreset('nonexistent')).toBeNull();
  });

  it('getPreset returns a copy, not the original', () => {
    const a = mgr.getPreset('builtin-design-focus');
    const b = mgr.getPreset('builtin-design-focus');
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('getActivePresetId returns null initially', () => {
    expect(mgr.getActivePresetId()).toBeNull();
  });

  it('isBuiltIn returns true for built-in IDs', () => {
    expect(mgr.isBuiltIn('builtin-design-focus')).toBe(true);
    expect(mgr.isBuiltIn('builtin-compact')).toBe(true);
    expect(mgr.isBuiltIn('builtin-fullscreen')).toBe(true);
    expect(mgr.isBuiltIn('builtin-review')).toBe(true);
  });

  it('isBuiltIn returns false for custom or unknown IDs', () => {
    expect(mgr.isBuiltIn('custom-id')).toBe(false);
    expect(mgr.isBuiltIn('')).toBe(false);
  });

  it('getPresetCount returns built-in count initially', () => {
    expect(mgr.getPresetCount()).toBe(BUILT_IN_PRESETS.length);
  });
});

// ---------------------------------------------------------------------------
// Apply Preset
// ---------------------------------------------------------------------------

describe('WorkspacePresetManager - Apply Preset', () => {
  it('applyPreset sets the active preset ID', () => {
    const preset = BUILT_IN_PRESETS[0];
    mgr.applyPreset(preset);
    expect(mgr.getActivePresetId()).toBe(preset.id);
  });

  it('applyPreset returns a copy of the applied preset', () => {
    const preset = BUILT_IN_PRESETS[0];
    const result = mgr.applyPreset(preset);
    expect(result).toEqual(preset);
    expect(result).not.toBe(preset);
  });

  it('applyPreset persists to localStorage', () => {
    mgr.applyPreset(BUILT_IN_PRESETS[0]);
    expect(mockStorage.setItem).toHaveBeenCalled();
  });

  it('applyPresetById works for built-in IDs', () => {
    const result = mgr.applyPresetById('builtin-compact');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Compact');
    expect(mgr.getActivePresetId()).toBe('builtin-compact');
  });

  it('applyPresetById returns null for unknown IDs', () => {
    const result = mgr.applyPresetById('nonexistent');
    expect(result).toBeNull();
    expect(mgr.getActivePresetId()).toBeNull();
  });

  it('applying a different preset replaces the active ID', () => {
    mgr.applyPreset(BUILT_IN_PRESETS[0]);
    mgr.applyPreset(BUILT_IN_PRESETS[1]);
    expect(mgr.getActivePresetId()).toBe(BUILT_IN_PRESETS[1].id);
  });

  it('clearActivePreset sets active to null', () => {
    mgr.applyPreset(BUILT_IN_PRESETS[0]);
    mgr.clearActivePreset();
    expect(mgr.getActivePresetId()).toBeNull();
  });

  it('clearActivePreset is a no-op when already null', () => {
    const spy = vi.fn();
    mgr.subscribe(spy);
    mgr.clearActivePreset();
    expect(spy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Save Current As Preset
// ---------------------------------------------------------------------------

describe('WorkspacePresetManager - Save Custom Preset', () => {
  const sampleState = {
    sidebarVisible: true,
    chatVisible: false,
    sidebarWidth: 320,
    activeView: 'schematic' as const,
    panelSizes: { sidebar: 320, inspector: 200 },
  };

  it('saves a custom preset and returns its ID', () => {
    const id = mgr.saveCurrentAsPreset('My Layout', sampleState);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('saved preset appears in custom presets', () => {
    mgr.saveCurrentAsPreset('My Layout', sampleState);
    const custom = mgr.getCustomPresets();
    expect(custom).toHaveLength(1);
    expect(custom[0].name).toBe('My Layout');
  });

  it('saved preset appears in all presets', () => {
    mgr.saveCurrentAsPreset('My Layout', sampleState);
    const all = mgr.getAllPresets();
    expect(all).toHaveLength(BUILT_IN_PRESETS.length + 1);
  });

  it('saved preset stores all state correctly', () => {
    mgr.saveCurrentAsPreset('My Layout', sampleState);
    const custom = mgr.getCustomPresets();
    const preset = custom[0];
    expect(preset.sidebarVisible).toBe(true);
    expect(preset.chatVisible).toBe(false);
    expect(preset.sidebarWidth).toBe(320);
    expect(preset.activeView).toBe('schematic');
    expect(preset.panelSizes).toEqual({ sidebar: 320, inspector: 200 });
  });

  it('saved preset sets the active preset ID', () => {
    const id = mgr.saveCurrentAsPreset('My Layout', sampleState);
    expect(mgr.getActivePresetId()).toBe(id);
  });

  it('saved preset is not built-in', () => {
    const id = mgr.saveCurrentAsPreset('My Layout', sampleState);
    expect(mgr.isBuiltIn(id)).toBe(false);
  });

  it('throws on empty name', () => {
    expect(() => mgr.saveCurrentAsPreset('', sampleState)).toThrow('Preset name cannot be empty');
  });

  it('throws on whitespace-only name', () => {
    expect(() => mgr.saveCurrentAsPreset('   ', sampleState)).toThrow('Preset name cannot be empty');
  });

  it('trims whitespace from name', () => {
    mgr.saveCurrentAsPreset('  Trimmed Name  ', sampleState);
    const custom = mgr.getCustomPresets();
    expect(custom[0].name).toBe('Trimmed Name');
  });

  it('panelSizes is a defensive copy', () => {
    const panelSizes = { sidebar: 100 };
    mgr.saveCurrentAsPreset('Copy Test', { ...sampleState, panelSizes });
    panelSizes.sidebar = 999;
    const custom = mgr.getCustomPresets();
    expect(custom[0].panelSizes.sidebar).toBe(100);
  });

  it('increments preset count after saving', () => {
    const before = mgr.getPresetCount();
    mgr.saveCurrentAsPreset('Added', sampleState);
    expect(mgr.getPresetCount()).toBe(before + 1);
  });

  it('multiple custom presets can be saved', () => {
    mgr.saveCurrentAsPreset('Layout A', sampleState);
    mgr.saveCurrentAsPreset('Layout B', { ...sampleState, chatVisible: true });
    expect(mgr.getCustomPresets()).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Delete Preset
// ---------------------------------------------------------------------------

describe('WorkspacePresetManager - Delete Preset', () => {
  const sampleState = {
    sidebarVisible: true,
    chatVisible: true,
    sidebarWidth: 280,
    activeView: 'architecture' as const,
    panelSizes: { sidebar: 280 },
  };

  it('deletes a custom preset and returns true', () => {
    const id = mgr.saveCurrentAsPreset('To Delete', sampleState);
    expect(mgr.deletePreset(id)).toBe(true);
    expect(mgr.getCustomPresets()).toHaveLength(0);
  });

  it('returns false for unknown ID', () => {
    expect(mgr.deletePreset('nonexistent')).toBe(false);
  });

  it('returns false for built-in preset IDs', () => {
    expect(mgr.deletePreset('builtin-design-focus')).toBe(false);
    expect(mgr.deletePreset('builtin-compact')).toBe(false);
  });

  it('clears active preset ID when deleting the active preset', () => {
    const id = mgr.saveCurrentAsPreset('Active', sampleState);
    expect(mgr.getActivePresetId()).toBe(id);
    mgr.deletePreset(id);
    expect(mgr.getActivePresetId()).toBeNull();
  });

  it('does not change active preset ID when deleting a different preset', () => {
    const idA = mgr.saveCurrentAsPreset('Preset A', sampleState);
    mgr.saveCurrentAsPreset('Preset B', sampleState);
    // Active is now Preset B
    mgr.deletePreset(idA);
    expect(mgr.getActivePresetId()).not.toBeNull();
  });

  it('decrements preset count after deleting', () => {
    const id = mgr.saveCurrentAsPreset('Temp', sampleState);
    const before = mgr.getPresetCount();
    mgr.deletePreset(id);
    expect(mgr.getPresetCount()).toBe(before - 1);
  });
});

// ---------------------------------------------------------------------------
// Update / Rename Preset
// ---------------------------------------------------------------------------

describe('WorkspacePresetManager - Update Preset', () => {
  const sampleState = {
    sidebarVisible: false,
    chatVisible: false,
    sidebarWidth: 0,
    activeView: 'pcb' as const,
    panelSizes: {},
  };

  it('updates a custom preset name', () => {
    const id = mgr.saveCurrentAsPreset('Original', sampleState);
    expect(mgr.updatePreset(id, { name: 'Renamed' })).toBe(true);
    expect(mgr.getPreset(id)!.name).toBe('Renamed');
  });

  it('updates multiple fields at once', () => {
    const id = mgr.saveCurrentAsPreset('Multi', sampleState);
    mgr.updatePreset(id, { sidebarVisible: true, sidebarWidth: 300, chatVisible: true });
    const updated = mgr.getPreset(id)!;
    expect(updated.sidebarVisible).toBe(true);
    expect(updated.sidebarWidth).toBe(300);
    expect(updated.chatVisible).toBe(true);
  });

  it('returns false for built-in presets', () => {
    expect(mgr.updatePreset('builtin-design-focus', { name: 'Hacked' })).toBe(false);
  });

  it('returns false for unknown ID', () => {
    expect(mgr.updatePreset('nonexistent', { name: 'Nope' })).toBe(false);
  });

  it('returns false when name is whitespace-only', () => {
    const id = mgr.saveCurrentAsPreset('Valid', sampleState);
    expect(mgr.updatePreset(id, { name: '   ' })).toBe(false);
  });

  it('renamePreset is a convenience for updatePreset', () => {
    const id = mgr.saveCurrentAsPreset('Before', sampleState);
    expect(mgr.renamePreset(id, 'After')).toBe(true);
    expect(mgr.getPreset(id)!.name).toBe('After');
  });

  it('renamePreset returns false for built-in', () => {
    expect(mgr.renamePreset('builtin-fullscreen', 'My Fullscreen')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

describe('WorkspacePresetManager - Subscription', () => {
  it('notifies subscribers on applyPreset', () => {
    const spy = vi.fn();
    mgr.subscribe(spy);
    mgr.applyPreset(BUILT_IN_PRESETS[0]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on saveCurrentAsPreset', () => {
    const spy = vi.fn();
    mgr.subscribe(spy);
    mgr.saveCurrentAsPreset('New', {
      sidebarVisible: true,
      chatVisible: true,
      sidebarWidth: 280,
      activeView: 'architecture',
      panelSizes: {},
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on deletePreset', () => {
    const id = mgr.saveCurrentAsPreset('Del', {
      sidebarVisible: true,
      chatVisible: true,
      sidebarWidth: 280,
      activeView: 'architecture',
      panelSizes: {},
    });
    const spy = vi.fn();
    mgr.subscribe(spy);
    mgr.deletePreset(id);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on updatePreset', () => {
    const id = mgr.saveCurrentAsPreset('Upd', {
      sidebarVisible: true,
      chatVisible: true,
      sidebarWidth: 280,
      activeView: 'architecture',
      panelSizes: {},
    });
    const spy = vi.fn();
    mgr.subscribe(spy);
    mgr.updatePreset(id, { name: 'Updated' });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes the listener', () => {
    const spy = vi.fn();
    const unsub = mgr.subscribe(spy);
    unsub();
    mgr.applyPreset(BUILT_IN_PRESETS[0]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('multiple subscribers all receive notifications', () => {
    const spy1 = vi.fn();
    const spy2 = vi.fn();
    mgr.subscribe(spy1);
    mgr.subscribe(spy2);
    mgr.applyPreset(BUILT_IN_PRESETS[0]);
    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy2).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

describe('WorkspacePresetManager - Persistence', () => {
  const sampleState = {
    sidebarVisible: true,
    chatVisible: false,
    sidebarWidth: 250,
    activeView: 'procurement' as const,
    panelSizes: { sidebar: 250, chat: 0 },
  };

  it('persists custom presets across resets', () => {
    mgr.saveCurrentAsPreset('Persisted', sampleState);
    WorkspacePresetManager.resetForTesting();
    const fresh = WorkspacePresetManager.getInstance();
    expect(fresh.getCustomPresets()).toHaveLength(1);
    expect(fresh.getCustomPresets()[0].name).toBe('Persisted');
  });

  it('persists active preset ID across resets', () => {
    mgr.applyPreset(BUILT_IN_PRESETS[2]);
    WorkspacePresetManager.resetForTesting();
    const fresh = WorkspacePresetManager.getInstance();
    expect(fresh.getActivePresetId()).toBe(BUILT_IN_PRESETS[2].id);
  });

  it('handles corrupt localStorage gracefully', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('not valid json{{{');
    WorkspacePresetManager.resetForTesting();
    const fresh = WorkspacePresetManager.getInstance();
    expect(fresh.getCustomPresets()).toHaveLength(0);
    expect(fresh.getActivePresetId()).toBeNull();
  });

  it('handles localStorage getItem returning non-object', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('"just a string"');
    WorkspacePresetManager.resetForTesting();
    const fresh = WorkspacePresetManager.getInstance();
    expect(fresh.getCustomPresets()).toHaveLength(0);
  });

  it('filters out invalid preset entries from storage', () => {
    const badData = JSON.stringify({
      customPresets: [
        { id: 'valid', name: 'Valid', sidebarVisible: true, chatVisible: false, sidebarWidth: 200, activeView: 'pcb', panelSizes: {} },
        { id: 'missing-name', sidebarVisible: true },
        'not an object',
        null,
      ],
      currentPresetId: 'valid',
    });
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(badData);
    WorkspacePresetManager.resetForTesting();
    const fresh = WorkspacePresetManager.getInstance();
    expect(fresh.getCustomPresets()).toHaveLength(1);
    expect(fresh.getCustomPresets()[0].id).toBe('valid');
  });

  it('handles missing customPresets array in storage', () => {
    const data = JSON.stringify({ currentPresetId: 'builtin-review' });
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(data);
    WorkspacePresetManager.resetForTesting();
    const fresh = WorkspacePresetManager.getInstance();
    expect(fresh.getCustomPresets()).toHaveLength(0);
    expect(fresh.getActivePresetId()).toBe('builtin-review');
  });
});

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

describe('useWorkspacePresets', () => {
  it('returns all presets initially', () => {
    const { result } = renderHook(() => useWorkspacePresets());
    expect(result.current.presets.length).toBeGreaterThanOrEqual(BUILT_IN_PRESETS.length);
  });

  it('returns built-in and custom presets separately', () => {
    const { result } = renderHook(() => useWorkspacePresets());
    expect(result.current.builtInPresets).toHaveLength(BUILT_IN_PRESETS.length);
    expect(result.current.customPresets).toHaveLength(0);
  });

  it('activePresetId is null initially', () => {
    const { result } = renderHook(() => useWorkspacePresets());
    expect(result.current.activePresetId).toBeNull();
  });

  it('applyPreset updates active preset ID', () => {
    const { result } = renderHook(() => useWorkspacePresets());
    act(() => {
      result.current.applyPreset(BUILT_IN_PRESETS[0]);
    });
    expect(result.current.activePresetId).toBe(BUILT_IN_PRESETS[0].id);
  });

  it('saveCurrentAsPreset adds a custom preset', () => {
    const { result } = renderHook(() => useWorkspacePresets());
    act(() => {
      result.current.saveCurrentAsPreset('Hook Test', {
        sidebarVisible: true,
        chatVisible: false,
        sidebarWidth: 300,
        activeView: 'dashboard',
        panelSizes: { sidebar: 300 },
      });
    });
    expect(result.current.customPresets).toHaveLength(1);
    expect(result.current.presetCount).toBe(BUILT_IN_PRESETS.length + 1);
  });

  it('deletePreset removes a custom preset', () => {
    const { result } = renderHook(() => useWorkspacePresets());
    let id: string;
    act(() => {
      id = result.current.saveCurrentAsPreset('To Remove', {
        sidebarVisible: true,
        chatVisible: true,
        sidebarWidth: 280,
        activeView: 'architecture',
        panelSizes: {},
      });
    });
    act(() => {
      result.current.deletePreset(id!);
    });
    expect(result.current.customPresets).toHaveLength(0);
  });

  it('isBuiltIn works via hook', () => {
    const { result } = renderHook(() => useWorkspacePresets());
    expect(result.current.isBuiltIn('builtin-design-focus')).toBe(true);
    expect(result.current.isBuiltIn('some-custom-id')).toBe(false);
  });

  it('clearActivePreset sets activePresetId to null', () => {
    const { result } = renderHook(() => useWorkspacePresets());
    act(() => {
      result.current.applyPreset(BUILT_IN_PRESETS[1]);
    });
    expect(result.current.activePresetId).toBe(BUILT_IN_PRESETS[1].id);
    act(() => {
      result.current.clearActivePreset();
    });
    expect(result.current.activePresetId).toBeNull();
  });

  it('renamePreset updates the name via hook', () => {
    const { result } = renderHook(() => useWorkspacePresets());
    let id: string;
    act(() => {
      id = result.current.saveCurrentAsPreset('Original Name', {
        sidebarVisible: false,
        chatVisible: false,
        sidebarWidth: 0,
        activeView: 'pcb',
        panelSizes: {},
      });
    });
    act(() => {
      result.current.renamePreset(id!, 'New Name');
    });
    const renamed = result.current.customPresets.find((p) => p.id === id!);
    expect(renamed).toBeDefined();
    expect(renamed!.name).toBe('New Name');
  });
});
