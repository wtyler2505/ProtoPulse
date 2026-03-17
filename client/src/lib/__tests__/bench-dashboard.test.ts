import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  BenchDashboardManager,
  BENCH_PRESETS,
  useBenchDashboard,
} from '../bench-dashboard';
import type { BenchLayout, BenchPanel } from '../bench-dashboard';

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

let mgr: BenchDashboardManager;
let mockStorage: Storage;

beforeEach(() => {
  mockStorage = createMockLocalStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
  BenchDashboardManager.resetForTesting();
  mgr = BenchDashboardManager.getInstance();
});

afterEach(() => {
  BenchDashboardManager.resetForTesting();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('BenchDashboardManager - Singleton', () => {
  it('returns the same instance on repeated calls', () => {
    const a = BenchDashboardManager.getInstance();
    const b = BenchDashboardManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetForTesting', () => {
    const first = BenchDashboardManager.getInstance();
    BenchDashboardManager.resetForTesting();
    const second = BenchDashboardManager.getInstance();
    expect(first).not.toBe(second);
  });
});

// ---------------------------------------------------------------------------
// Built-in Presets
// ---------------------------------------------------------------------------

describe('BenchDashboardManager - Built-in Presets', () => {
  it('has exactly 3 built-in presets', () => {
    expect(Object.keys(BENCH_PRESETS)).toHaveLength(3);
  });

  it('built-in presets have expected names', () => {
    const names = Object.keys(BENCH_PRESETS);
    expect(names).toContain('upload_monitor');
    expect(names).toContain('debug_session');
    expect(names).toContain('full_bench');
  });

  it('upload_monitor has firmware_upload and serial_monitor', () => {
    const preset = BENCH_PRESETS.upload_monitor;
    expect(preset.panels).toEqual(['firmware_upload', 'serial_monitor']);
    expect(preset.splitDirection).toBe('vertical');
    expect(preset.sizes).toEqual([50, 50]);
  });

  it('debug_session has serial_monitor, debug_log, and plotter', () => {
    const preset = BENCH_PRESETS.debug_session;
    expect(preset.panels).toEqual(['serial_monitor', 'debug_log', 'plotter']);
    expect(preset.splitDirection).toBe('horizontal');
    expect(preset.sizes).toEqual([40, 30, 30]);
  });

  it('full_bench has all 5 panels', () => {
    const preset = BENCH_PRESETS.full_bench;
    expect(preset.panels).toHaveLength(5);
    expect(preset.panels).toContain('serial_monitor');
    expect(preset.panels).toContain('compile_output');
    expect(preset.panels).toContain('plotter');
    expect(preset.panels).toContain('debug_log');
    expect(preset.panels).toContain('firmware_upload');
    expect(preset.splitDirection).toBe('horizontal');
    expect(preset.sizes).toHaveLength(5);
  });

  it('all built-in presets have sizes matching panel count', () => {
    for (const [, preset] of Object.entries(BENCH_PRESETS)) {
      expect(preset.sizes).toHaveLength(preset.panels.length);
    }
  });

  it('all built-in presets have valid panel types', () => {
    const validPanels: BenchPanel[] = ['serial_monitor', 'compile_output', 'plotter', 'debug_log', 'firmware_upload'];
    for (const [, preset] of Object.entries(BENCH_PRESETS)) {
      for (const panel of preset.panels) {
        expect(validPanels).toContain(panel);
      }
    }
  });

  it('getBuiltInPresetNames returns all preset names', () => {
    const names = mgr.getBuiltInPresetNames();
    expect(names).toHaveLength(3);
    expect(names).toContain('upload_monitor');
    expect(names).toContain('debug_session');
    expect(names).toContain('full_bench');
  });

  it('isBuiltIn returns true for built-in names', () => {
    expect(mgr.isBuiltIn('upload_monitor')).toBe(true);
    expect(mgr.isBuiltIn('debug_session')).toBe(true);
    expect(mgr.isBuiltIn('full_bench')).toBe(true);
  });

  it('isBuiltIn returns false for custom or unknown names', () => {
    expect(mgr.isBuiltIn('my_custom')).toBe(false);
    expect(mgr.isBuiltIn('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Layout Queries
// ---------------------------------------------------------------------------

describe('BenchDashboardManager - Queries', () => {
  it('getActiveLayout returns null initially', () => {
    expect(mgr.getActiveLayout()).toBeNull();
  });

  it('getActivePresetName returns null initially', () => {
    expect(mgr.getActivePresetName()).toBeNull();
  });

  it('getCustomLayoutNames returns empty array initially', () => {
    expect(mgr.getCustomLayoutNames()).toHaveLength(0);
  });

  it('getLayout returns a built-in layout by name', () => {
    const layout = mgr.getLayout('upload_monitor');
    expect(layout).not.toBeNull();
    expect(layout!.panels).toEqual(['firmware_upload', 'serial_monitor']);
  });

  it('getLayout returns null for unknown name', () => {
    expect(mgr.getLayout('nonexistent')).toBeNull();
  });

  it('getLayout returns a defensive copy', () => {
    const a = mgr.getLayout('upload_monitor');
    const b = mgr.getLayout('upload_monitor');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a!.panels).not.toBe(b!.panels);
  });

  it('getLayoutCount returns built-in count initially', () => {
    expect(mgr.getLayoutCount()).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Activate Preset
// ---------------------------------------------------------------------------

describe('BenchDashboardManager - Activate Preset', () => {
  it('activatePreset sets the active layout', () => {
    const result = mgr.activatePreset('upload_monitor');
    expect(result).not.toBeNull();
    expect(result!.panels).toEqual(['firmware_upload', 'serial_monitor']);
    expect(mgr.getActiveLayout()).toEqual(result);
  });

  it('activatePreset sets the active preset name', () => {
    mgr.activatePreset('debug_session');
    expect(mgr.getActivePresetName()).toBe('debug_session');
  });

  it('activatePreset returns null for unknown name', () => {
    const result = mgr.activatePreset('nonexistent');
    expect(result).toBeNull();
    expect(mgr.getActivePresetName()).toBeNull();
  });

  it('activatePreset returns a defensive copy', () => {
    const result = mgr.activatePreset('upload_monitor');
    const active = mgr.getActiveLayout();
    expect(result).toEqual(active);
    expect(result).not.toBe(active);
  });

  it('switching presets replaces the active layout', () => {
    mgr.activatePreset('upload_monitor');
    mgr.activatePreset('full_bench');
    expect(mgr.getActivePresetName()).toBe('full_bench');
    expect(mgr.getActiveLayout()!.panels).toHaveLength(5);
  });

  it('activatePreset persists to localStorage', () => {
    mgr.activatePreset('upload_monitor');
    expect(mockStorage.setItem).toHaveBeenCalled();
  });

  it('activatePreset works with custom layouts', () => {
    const custom: BenchLayout = {
      panels: ['plotter', 'debug_log'],
      splitDirection: 'vertical',
      sizes: [60, 40],
    };
    mgr.saveCustomLayout('my_layout', custom);
    const result = mgr.activatePreset('my_layout');
    expect(result).not.toBeNull();
    expect(result!.panels).toEqual(['plotter', 'debug_log']);
    expect(mgr.getActivePresetName()).toBe('my_layout');
  });

  it('clearActiveLayout resets to null', () => {
    mgr.activatePreset('upload_monitor');
    mgr.clearActiveLayout();
    expect(mgr.getActiveLayout()).toBeNull();
    expect(mgr.getActivePresetName()).toBeNull();
  });

  it('clearActiveLayout is a no-op when already null', () => {
    const spy = vi.fn();
    mgr.subscribe(spy);
    mgr.clearActiveLayout();
    expect(spy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Save Custom Layout
// ---------------------------------------------------------------------------

describe('BenchDashboardManager - Save Custom Layout', () => {
  const sampleLayout: BenchLayout = {
    panels: ['serial_monitor', 'plotter'],
    splitDirection: 'horizontal',
    sizes: [70, 30],
  };

  it('saves a custom layout', () => {
    mgr.saveCustomLayout('my_bench', sampleLayout);
    const names = mgr.getCustomLayoutNames();
    expect(names).toHaveLength(1);
    expect(names).toContain('my_bench');
  });

  it('saved custom layout is retrievable via getLayout', () => {
    mgr.saveCustomLayout('my_bench', sampleLayout);
    const layout = mgr.getLayout('my_bench');
    expect(layout).not.toBeNull();
    expect(layout!.panels).toEqual(['serial_monitor', 'plotter']);
    expect(layout!.splitDirection).toBe('horizontal');
    expect(layout!.sizes).toEqual([70, 30]);
  });

  it('overwrites an existing custom layout with the same name', () => {
    mgr.saveCustomLayout('my_bench', sampleLayout);
    const updated: BenchLayout = {
      panels: ['debug_log'],
      splitDirection: 'vertical',
      sizes: [100],
    };
    mgr.saveCustomLayout('my_bench', updated);
    const layout = mgr.getLayout('my_bench');
    expect(layout!.panels).toEqual(['debug_log']);
    expect(mgr.getCustomLayoutNames()).toHaveLength(1);
  });

  it('increments layout count after saving', () => {
    const before = mgr.getLayoutCount();
    mgr.saveCustomLayout('added', sampleLayout);
    expect(mgr.getLayoutCount()).toBe(before + 1);
  });

  it('custom layout prefers over built-in when same name is not possible', () => {
    // Built-in names cannot be used
    expect(() => mgr.saveCustomLayout('upload_monitor', sampleLayout)).toThrow(
      'Cannot overwrite a built-in preset',
    );
  });

  it('throws on empty name', () => {
    expect(() => mgr.saveCustomLayout('', sampleLayout)).toThrow('Layout name cannot be empty');
  });

  it('throws on whitespace-only name', () => {
    expect(() => mgr.saveCustomLayout('   ', sampleLayout)).toThrow('Layout name cannot be empty');
  });

  it('trims whitespace from name', () => {
    mgr.saveCustomLayout('  trimmed  ', sampleLayout);
    expect(mgr.getCustomLayoutNames()).toContain('trimmed');
  });

  it('throws when panels array is empty', () => {
    const bad: BenchLayout = { panels: [], splitDirection: 'horizontal', sizes: [] };
    expect(() => mgr.saveCustomLayout('bad', bad)).toThrow('Layout must have at least one panel');
  });

  it('throws when sizes array does not match panels length', () => {
    const bad: BenchLayout = {
      panels: ['serial_monitor', 'plotter'],
      splitDirection: 'horizontal',
      sizes: [100],
    };
    expect(() => mgr.saveCustomLayout('bad', bad)).toThrow('sizes array must match panels array length');
  });

  it('throws when panel type is invalid', () => {
    const bad: BenchLayout = {
      panels: ['serial_monitor', 'invalid_panel' as BenchPanel],
      splitDirection: 'horizontal',
      sizes: [50, 50],
    };
    expect(() => mgr.saveCustomLayout('bad', bad)).toThrow('Layout contains invalid panel types');
  });

  it('stores a defensive copy of the layout', () => {
    const panels: BenchPanel[] = ['serial_monitor', 'plotter'];
    const sizes = [50, 50];
    const layout: BenchLayout = { panels, splitDirection: 'horizontal', sizes };
    mgr.saveCustomLayout('copy_test', layout);
    panels.push('debug_log');
    sizes.push(0);
    const stored = mgr.getLayout('copy_test');
    expect(stored!.panels).toHaveLength(2);
    expect(stored!.sizes).toHaveLength(2);
  });

  it('persists to localStorage', () => {
    mgr.saveCustomLayout('persisted', sampleLayout);
    expect(mockStorage.setItem).toHaveBeenCalled();
  });

  it('multiple custom layouts can coexist', () => {
    mgr.saveCustomLayout('layout_a', sampleLayout);
    mgr.saveCustomLayout('layout_b', {
      panels: ['compile_output'],
      splitDirection: 'vertical',
      sizes: [100],
    });
    expect(mgr.getCustomLayoutNames()).toHaveLength(2);
    expect(mgr.getLayoutCount()).toBe(5); // 3 built-in + 2 custom
  });
});

// ---------------------------------------------------------------------------
// Delete Custom Layout
// ---------------------------------------------------------------------------

describe('BenchDashboardManager - Delete Custom Layout', () => {
  const sampleLayout: BenchLayout = {
    panels: ['serial_monitor'],
    splitDirection: 'vertical',
    sizes: [100],
  };

  it('deletes a custom layout and returns true', () => {
    mgr.saveCustomLayout('to_delete', sampleLayout);
    expect(mgr.deleteCustomLayout('to_delete')).toBe(true);
    expect(mgr.getCustomLayoutNames()).toHaveLength(0);
  });

  it('returns false for unknown name', () => {
    expect(mgr.deleteCustomLayout('nonexistent')).toBe(false);
  });

  it('returns false for built-in preset names', () => {
    expect(mgr.deleteCustomLayout('upload_monitor')).toBe(false);
    expect(mgr.deleteCustomLayout('debug_session')).toBe(false);
    expect(mgr.deleteCustomLayout('full_bench')).toBe(false);
  });

  it('clears active layout when deleting the active custom layout', () => {
    mgr.saveCustomLayout('active_custom', sampleLayout);
    mgr.activatePreset('active_custom');
    expect(mgr.getActivePresetName()).toBe('active_custom');
    mgr.deleteCustomLayout('active_custom');
    expect(mgr.getActivePresetName()).toBeNull();
    expect(mgr.getActiveLayout()).toBeNull();
  });

  it('does not affect active layout when deleting a different custom layout', () => {
    mgr.saveCustomLayout('keep', sampleLayout);
    mgr.saveCustomLayout('remove', sampleLayout);
    mgr.activatePreset('keep');
    mgr.deleteCustomLayout('remove');
    expect(mgr.getActivePresetName()).toBe('keep');
  });

  it('decrements layout count after deleting', () => {
    mgr.saveCustomLayout('temp', sampleLayout);
    const before = mgr.getLayoutCount();
    mgr.deleteCustomLayout('temp');
    expect(mgr.getLayoutCount()).toBe(before - 1);
  });
});

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

describe('BenchDashboardManager - Subscription', () => {
  const sampleLayout: BenchLayout = {
    panels: ['debug_log'],
    splitDirection: 'vertical',
    sizes: [100],
  };

  it('notifies subscribers on activatePreset', () => {
    const spy = vi.fn();
    mgr.subscribe(spy);
    mgr.activatePreset('upload_monitor');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on saveCustomLayout', () => {
    const spy = vi.fn();
    mgr.subscribe(spy);
    mgr.saveCustomLayout('custom', sampleLayout);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on deleteCustomLayout', () => {
    mgr.saveCustomLayout('to_del', sampleLayout);
    const spy = vi.fn();
    mgr.subscribe(spy);
    mgr.deleteCustomLayout('to_del');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on clearActiveLayout', () => {
    mgr.activatePreset('upload_monitor');
    const spy = vi.fn();
    mgr.subscribe(spy);
    mgr.clearActiveLayout();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes the listener', () => {
    const spy = vi.fn();
    const unsub = mgr.subscribe(spy);
    unsub();
    mgr.activatePreset('upload_monitor');
    expect(spy).not.toHaveBeenCalled();
  });

  it('multiple subscribers all receive notifications', () => {
    const spy1 = vi.fn();
    const spy2 = vi.fn();
    mgr.subscribe(spy1);
    mgr.subscribe(spy2);
    mgr.activatePreset('upload_monitor');
    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy2).toHaveBeenCalledTimes(1);
  });

  it('does not notify on failed activatePreset', () => {
    const spy = vi.fn();
    mgr.subscribe(spy);
    mgr.activatePreset('nonexistent');
    expect(spy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

describe('BenchDashboardManager - Persistence', () => {
  const sampleLayout: BenchLayout = {
    panels: ['compile_output', 'firmware_upload'],
    splitDirection: 'vertical',
    sizes: [60, 40],
  };

  it('persists custom layouts across resets', () => {
    mgr.saveCustomLayout('persisted', sampleLayout);
    BenchDashboardManager.resetForTesting();
    const fresh = BenchDashboardManager.getInstance();
    const names = fresh.getCustomLayoutNames();
    expect(names).toHaveLength(1);
    expect(names).toContain('persisted');
    const layout = fresh.getLayout('persisted');
    expect(layout!.panels).toEqual(['compile_output', 'firmware_upload']);
  });

  it('persists active preset name across resets', () => {
    mgr.activatePreset('debug_session');
    BenchDashboardManager.resetForTesting();
    const fresh = BenchDashboardManager.getInstance();
    expect(fresh.getActivePresetName()).toBe('debug_session');
  });

  it('persists active layout across resets', () => {
    mgr.activatePreset('full_bench');
    BenchDashboardManager.resetForTesting();
    const fresh = BenchDashboardManager.getInstance();
    const layout = fresh.getActiveLayout();
    expect(layout).not.toBeNull();
    expect(layout!.panels).toHaveLength(5);
  });

  it('handles corrupt localStorage gracefully', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('not valid json{{{');
    BenchDashboardManager.resetForTesting();
    const fresh = BenchDashboardManager.getInstance();
    expect(fresh.getActiveLayout()).toBeNull();
    expect(fresh.getCustomLayoutNames()).toHaveLength(0);
  });

  it('handles localStorage getItem returning non-object', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('"just a string"');
    BenchDashboardManager.resetForTesting();
    const fresh = BenchDashboardManager.getInstance();
    expect(fresh.getActiveLayout()).toBeNull();
  });

  it('filters out invalid custom layout entries from storage', () => {
    const badData = JSON.stringify({
      activePresetName: null,
      activeLayout: null,
      customLayouts: [
        ['valid', { panels: ['serial_monitor'], splitDirection: 'vertical', sizes: [100] }],
        ['missing_panels', { splitDirection: 'horizontal', sizes: [50] }],
        'not an array entry',
        null,
      ],
    });
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(badData);
    BenchDashboardManager.resetForTesting();
    const fresh = BenchDashboardManager.getInstance();
    expect(fresh.getCustomLayoutNames()).toHaveLength(1);
    expect(fresh.getCustomLayoutNames()).toContain('valid');
  });

  it('handles missing customLayouts in storage', () => {
    const data = JSON.stringify({ activePresetName: 'upload_monitor' });
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(data);
    BenchDashboardManager.resetForTesting();
    const fresh = BenchDashboardManager.getInstance();
    expect(fresh.getCustomLayoutNames()).toHaveLength(0);
    expect(fresh.getActivePresetName()).toBe('upload_monitor');
  });
});

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

describe('useBenchDashboard', () => {
  it('returns null active layout initially', () => {
    const { result } = renderHook(() => useBenchDashboard());
    expect(result.current.activeLayout).toBeNull();
    expect(result.current.activePresetName).toBeNull();
  });

  it('returns built-in preset names', () => {
    const { result } = renderHook(() => useBenchDashboard());
    expect(result.current.builtInPresetNames).toHaveLength(3);
    expect(result.current.builtInPresetNames).toContain('upload_monitor');
  });

  it('returns empty custom layout names initially', () => {
    const { result } = renderHook(() => useBenchDashboard());
    expect(result.current.customLayoutNames).toHaveLength(0);
  });

  it('activatePreset updates active layout', () => {
    const { result } = renderHook(() => useBenchDashboard());
    act(() => {
      result.current.activatePreset('upload_monitor');
    });
    expect(result.current.activePresetName).toBe('upload_monitor');
    expect(result.current.activeLayout).not.toBeNull();
    expect(result.current.activeLayout!.panels).toEqual(['firmware_upload', 'serial_monitor']);
  });

  it('saveCustomLayout adds a custom layout', () => {
    const { result } = renderHook(() => useBenchDashboard());
    act(() => {
      result.current.saveCustomLayout('hook_layout', {
        panels: ['plotter'],
        splitDirection: 'vertical',
        sizes: [100],
      });
    });
    expect(result.current.customLayoutNames).toContain('hook_layout');
    expect(result.current.layoutCount).toBe(4); // 3 built-in + 1 custom
  });

  it('deleteCustomLayout removes a custom layout', () => {
    const { result } = renderHook(() => useBenchDashboard());
    act(() => {
      result.current.saveCustomLayout('to_remove', {
        panels: ['debug_log'],
        splitDirection: 'horizontal',
        sizes: [100],
      });
    });
    act(() => {
      result.current.deleteCustomLayout('to_remove');
    });
    expect(result.current.customLayoutNames).toHaveLength(0);
  });

  it('clearActiveLayout resets to null', () => {
    const { result } = renderHook(() => useBenchDashboard());
    act(() => {
      result.current.activatePreset('debug_session');
    });
    expect(result.current.activePresetName).toBe('debug_session');
    act(() => {
      result.current.clearActiveLayout();
    });
    expect(result.current.activeLayout).toBeNull();
    expect(result.current.activePresetName).toBeNull();
  });

  it('isBuiltIn works via hook', () => {
    const { result } = renderHook(() => useBenchDashboard());
    expect(result.current.isBuiltIn('upload_monitor')).toBe(true);
    expect(result.current.isBuiltIn('my_custom')).toBe(false);
  });

  it('getLayout works via hook', () => {
    const { result } = renderHook(() => useBenchDashboard());
    const layout = result.current.getLayout('full_bench');
    expect(layout).not.toBeNull();
    expect(layout!.panels).toHaveLength(5);
  });
});
