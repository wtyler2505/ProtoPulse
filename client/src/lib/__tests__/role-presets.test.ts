import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  RolePresetManager,
  getRolePreset,
  isValidRoleId,
  ROLE_PRESETS,
  ROLE_IDS,
  useRolePreset,
} from '../role-presets';
import type { RoleId, RolePreset, UiDensity, TooltipLevel } from '../role-presets';
import type { ViewMode } from '@/lib/project-context';

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

describe('RolePresetManager', () => {
  let manager: RolePresetManager;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    RolePresetManager.resetInstance();
    manager = RolePresetManager.getInstance();
  });

  afterEach(() => {
    RolePresetManager.resetInstance();
  });

  // -------------------------------------------------------------------------
  // Singleton
  // -------------------------------------------------------------------------

  it('returns the same instance on repeated calls', () => {
    const a = RolePresetManager.getInstance();
    const b = RolePresetManager.getInstance();
    expect(a).toBe(b);
  });

  it('returns a new instance after resetInstance()', () => {
    const a = RolePresetManager.getInstance();
    RolePresetManager.resetInstance();
    const b = RolePresetManager.getInstance();
    expect(a).not.toBe(b);
  });

  // -------------------------------------------------------------------------
  // Default role
  // -------------------------------------------------------------------------

  it('defaults to hobbyist when localStorage is empty', () => {
    expect(manager.getActiveRoleId()).toBe('hobbyist');
  });

  it('returns the hobbyist preset by default', () => {
    const preset = manager.getActivePreset();
    expect(preset.id).toBe('hobbyist');
    expect(preset.uiDensity).toBe('standard');
    expect(preset.tooltipLevel).toBe('standard');
  });

  // -------------------------------------------------------------------------
  // setActiveRole
  // -------------------------------------------------------------------------

  it('switches to student role', () => {
    manager.setActiveRole('student');
    expect(manager.getActiveRoleId()).toBe('student');
    expect(manager.getActivePreset().uiDensity).toBe('comfortable');
    expect(manager.getActivePreset().tooltipLevel).toBe('verbose');
  });

  it('switches to pro role', () => {
    manager.setActiveRole('pro');
    expect(manager.getActiveRoleId()).toBe('pro');
    expect(manager.getActivePreset().uiDensity).toBe('compact');
    expect(manager.getActivePreset().tooltipLevel).toBe('minimal');
  });

  it('throws on invalid role id', () => {
    expect(() => manager.setActiveRole('wizard' as RoleId)).toThrow('Invalid role id: wizard');
  });

  it('does not notify when setting the same role', () => {
    const spy = vi.fn();
    manager.subscribe(spy);
    manager.setActiveRole('hobbyist'); // already hobbyist
    expect(spy).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  it('persists active role to localStorage', () => {
    manager.setActiveRole('pro');
    expect(mockStorage.setItem).toHaveBeenCalledWith('protopulse:role-preset', 'pro');
  });

  it('loads persisted role from localStorage', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('student');
    RolePresetManager.resetInstance();
    const loaded = RolePresetManager.getInstance();
    expect(loaded.getActiveRoleId()).toBe('student');
  });

  it('falls back to default on invalid persisted value', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('invalid_role');
    RolePresetManager.resetInstance();
    const loaded = RolePresetManager.getInstance();
    expect(loaded.getActiveRoleId()).toBe('hobbyist');
  });

  it('falls back to default when localStorage throws', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('storage error');
    });
    RolePresetManager.resetInstance();
    const loaded = RolePresetManager.getInstance();
    expect(loaded.getActiveRoleId()).toBe('hobbyist');
  });

  // -------------------------------------------------------------------------
  // View visibility
  // -------------------------------------------------------------------------

  it('student sees only student views', () => {
    manager.setActiveRole('student');
    expect(manager.isViewVisible('dashboard')).toBe(true);
    expect(manager.isViewVisible('architecture')).toBe(true);
    expect(manager.isViewVisible('schematic')).toBe(true);
    expect(manager.isViewVisible('breadboard')).toBe(true);
    expect(manager.isViewVisible('arduino')).toBe(true);
    expect(manager.isViewVisible('starter_circuits')).toBe(true);
    expect(manager.isViewVisible('knowledge')).toBe(true);
    // Not visible for student
    expect(manager.isViewVisible('pcb')).toBe(false);
    expect(manager.isViewVisible('component_editor')).toBe(false);
    expect(manager.isViewVisible('generative_design')).toBe(false);
    expect(manager.isViewVisible('digital_twin')).toBe(false);
  });

  it('hobbyist sees most views but not all', () => {
    expect(manager.isViewVisible('pcb')).toBe(true);
    expect(manager.isViewVisible('component_editor')).toBe(true);
    expect(manager.isViewVisible('serial_monitor')).toBe(true);
    expect(manager.isViewVisible('digital_twin')).toBe(true);
  });

  it('pro sees all views', () => {
    manager.setActiveRole('pro');
    const proPreset = manager.getActivePreset();
    // Every view in hobbyist should also be in pro
    const hobbyistPreset = getRolePreset('hobbyist');
    for (const view of Array.from(hobbyistPreset.visibleViews)) {
      expect(proPreset.visibleViews.has(view)).toBe(true);
    }
  });

  it('getVisibleViews returns array of visible views', () => {
    manager.setActiveRole('student');
    const views = manager.getVisibleViews();
    expect(Array.isArray(views)).toBe(true);
    expect(views).toContain('dashboard');
    expect(views).not.toContain('pcb');
  });

  // -------------------------------------------------------------------------
  // Feature visibility
  // -------------------------------------------------------------------------

  it('student hides advanced features', () => {
    manager.setActiveRole('student');
    expect(manager.isFeatureHidden('gerber_export')).toBe(true);
    expect(manager.isFeatureHidden('net_classes')).toBe(true);
    expect(manager.isFeatureHidden('differential_pairs')).toBe(true);
    expect(manager.isFeatureVisible('gerber_export')).toBe(false);
  });

  it('hobbyist hides some pro features', () => {
    expect(manager.isFeatureHidden('differential_pairs')).toBe(true);
    expect(manager.isFeatureHidden('signal_integrity')).toBe(true);
    // But not basic features
    expect(manager.isFeatureHidden('gerber_export')).toBe(false);
  });

  it('pro hides nothing', () => {
    manager.setActiveRole('pro');
    expect(manager.isFeatureHidden('gerber_export')).toBe(false);
    expect(manager.isFeatureHidden('differential_pairs')).toBe(false);
    expect(manager.isFeatureHidden('signal_integrity')).toBe(false);
    expect(manager.getHiddenFeatures()).toHaveLength(0);
  });

  it('getHiddenFeatures returns array', () => {
    manager.setActiveRole('student');
    const hidden = manager.getHiddenFeatures();
    expect(Array.isArray(hidden)).toBe(true);
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden).toContain('gerber_export');
  });

  // -------------------------------------------------------------------------
  // UI density and tooltip level
  // -------------------------------------------------------------------------

  it('returns correct density per role', () => {
    const expected: Record<RoleId, UiDensity> = {
      student: 'comfortable',
      hobbyist: 'standard',
      pro: 'compact',
    };
    for (const [role, density] of Object.entries(expected)) {
      manager.setActiveRole(role as RoleId);
      expect(manager.getUiDensity()).toBe(density);
    }
  });

  it('returns correct tooltip level per role', () => {
    const expected: Record<RoleId, TooltipLevel> = {
      student: 'verbose',
      hobbyist: 'standard',
      pro: 'minimal',
    };
    for (const [role, level] of Object.entries(expected)) {
      manager.setActiveRole(role as RoleId);
      expect(manager.getTooltipLevel()).toBe(level);
    }
  });

  // -------------------------------------------------------------------------
  // Subscribe / notify
  // -------------------------------------------------------------------------

  it('notifies subscribers on role change', () => {
    const spy = vi.fn();
    manager.subscribe(spy);
    manager.setActiveRole('pro');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications', () => {
    const spy = vi.fn();
    const unsub = manager.subscribe(spy);
    unsub();
    manager.setActiveRole('pro');
    expect(spy).not.toHaveBeenCalled();
  });

  it('multiple subscribers all receive notifications', () => {
    const spy1 = vi.fn();
    const spy2 = vi.fn();
    manager.subscribe(spy1);
    manager.subscribe(spy2);
    manager.setActiveRole('student');
    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy2).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Static helpers
// ---------------------------------------------------------------------------

describe('getRolePreset', () => {
  it('returns a valid preset for each role id', () => {
    for (const id of ROLE_IDS) {
      const preset = getRolePreset(id);
      expect(preset.id).toBe(id);
      expect(preset.label).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.visibleViews.size).toBeGreaterThan(0);
    }
  });

  it('throws for unknown role id', () => {
    expect(() => getRolePreset('wizard' as RoleId)).toThrow('Unknown role preset: wizard');
  });
});

describe('isValidRoleId', () => {
  it('returns true for valid role ids', () => {
    expect(isValidRoleId('student')).toBe(true);
    expect(isValidRoleId('hobbyist')).toBe(true);
    expect(isValidRoleId('pro')).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isValidRoleId('wizard')).toBe(false);
    expect(isValidRoleId(42)).toBe(false);
    expect(isValidRoleId(null)).toBe(false);
    expect(isValidRoleId(undefined)).toBe(false);
    expect(isValidRoleId('')).toBe(false);
  });
});

describe('ROLE_PRESETS', () => {
  it('has exactly 3 presets', () => {
    expect(ROLE_PRESETS.size).toBe(3);
  });

  it('student is a strict subset of hobbyist views', () => {
    const studentViews = getRolePreset('student').visibleViews;
    const hobbyistViews = getRolePreset('hobbyist').visibleViews;
    for (const view of Array.from(studentViews)) {
      expect(hobbyistViews.has(view)).toBe(true);
    }
  });

  it('hobbyist is a strict subset of pro views', () => {
    const hobbyistViews = getRolePreset('hobbyist').visibleViews;
    const proViews = getRolePreset('pro').visibleViews;
    for (const view of Array.from(hobbyistViews)) {
      expect(proViews.has(view)).toBe(true);
    }
  });

  it('student has more hidden features than hobbyist', () => {
    const studentHidden = getRolePreset('student').hiddenFeatures.size;
    const hobbyistHidden = getRolePreset('hobbyist').hiddenFeatures.size;
    expect(studentHidden).toBeGreaterThan(hobbyistHidden);
  });

  it('pro has zero hidden features', () => {
    expect(getRolePreset('pro').hiddenFeatures.size).toBe(0);
  });

  it('each preset has all required fields', () => {
    for (const [, preset] of Array.from(ROLE_PRESETS.entries())) {
      expect(preset).toHaveProperty('id');
      expect(preset).toHaveProperty('label');
      expect(preset).toHaveProperty('description');
      expect(preset).toHaveProperty('visibleViews');
      expect(preset).toHaveProperty('hiddenFeatures');
      expect(preset).toHaveProperty('uiDensity');
      expect(preset).toHaveProperty('tooltipLevel');
    }
  });
});

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

describe('useRolePreset', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    RolePresetManager.resetInstance();
  });

  afterEach(() => {
    RolePresetManager.resetInstance();
  });

  it('returns the default role on mount', () => {
    const { result } = renderHook(() => useRolePreset());
    expect(result.current.activeRole).toBe('hobbyist');
  });

  it('returns the active preset', () => {
    const { result } = renderHook(() => useRolePreset());
    expect(result.current.preset.id).toBe('hobbyist');
    expect(result.current.uiDensity).toBe('standard');
    expect(result.current.tooltipLevel).toBe('standard');
  });

  it('setActiveRole updates the hook state', () => {
    const { result } = renderHook(() => useRolePreset());
    act(() => {
      result.current.setActiveRole('pro');
    });
    expect(result.current.activeRole).toBe('pro');
    expect(result.current.uiDensity).toBe('compact');
    expect(result.current.tooltipLevel).toBe('minimal');
  });

  it('isViewVisible reflects the active role', () => {
    const { result } = renderHook(() => useRolePreset());
    act(() => {
      result.current.setActiveRole('student');
    });
    expect(result.current.isViewVisible('dashboard')).toBe(true);
    expect(result.current.isViewVisible('pcb')).toBe(false);
  });

  it('isFeatureHidden reflects the active role', () => {
    const { result } = renderHook(() => useRolePreset());
    act(() => {
      result.current.setActiveRole('student');
    });
    expect(result.current.isFeatureHidden('gerber_export')).toBe(true);
    expect(result.current.isFeatureVisible('gerber_export')).toBe(false);
  });

  it('persists role change through hook', () => {
    const { result } = renderHook(() => useRolePreset());
    act(() => {
      result.current.setActiveRole('pro');
    });
    expect(mockStorage.setItem).toHaveBeenCalledWith('protopulse:role-preset', 'pro');
  });
});
