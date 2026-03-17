/**
 * Bench Dashboard Manager
 *
 * Manages configurable hardware-bench panel layouts for the serial monitor,
 * compile output, plotter, debug log, and firmware upload panels. Provides
 * built-in presets for common workflows and supports user-created custom
 * layouts persisted to localStorage.
 *
 * Usage:
 *   const mgr = BenchDashboardManager.getInstance();
 *   mgr.activatePreset('upload_monitor');
 *   const layout = mgr.getActiveLayout();
 *
 * React hook:
 *   const { activeLayout, activatePreset, saveCustomLayout, ... } = useBenchDashboard();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The five bench panel types available in the hardware workbench.
 */
export type BenchPanel =
  | 'serial_monitor'
  | 'compile_output'
  | 'plotter'
  | 'debug_log'
  | 'firmware_upload';

/**
 * A layout describes which panels are visible, how they are split,
 * and the relative size of each panel (percentages that sum to 100).
 */
export interface BenchLayout {
  panels: BenchPanel[];
  splitDirection: 'horizontal' | 'vertical';
  sizes: number[];
}

// ---------------------------------------------------------------------------
// Built-in presets
// ---------------------------------------------------------------------------

export const BENCH_PRESETS: Record<string, BenchLayout> = {
  upload_monitor: {
    panels: ['firmware_upload', 'serial_monitor'],
    splitDirection: 'vertical',
    sizes: [50, 50],
  },
  debug_session: {
    panels: ['serial_monitor', 'debug_log', 'plotter'],
    splitDirection: 'horizontal',
    sizes: [40, 30, 30],
  },
  full_bench: {
    panels: ['serial_monitor', 'compile_output', 'plotter', 'debug_log', 'firmware_upload'],
    splitDirection: 'horizontal',
    sizes: [25, 20, 20, 15, 20],
  },
} as const;

/**
 * All valid panel values for runtime validation.
 */
const VALID_PANELS: ReadonlySet<BenchPanel> = new Set<BenchPanel>([
  'serial_monitor',
  'compile_output',
  'plotter',
  'debug_log',
  'firmware_upload',
]);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-bench-dashboard';

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// BenchDashboardManager
// ---------------------------------------------------------------------------

/**
 * Manages bench panel layouts with built-in presets and user-created custom
 * layouts. Singleton per application. Notifies subscribers on state changes.
 * Custom layouts and active state are persisted to localStorage.
 */
export class BenchDashboardManager {
  private static instance: BenchDashboardManager | null = null;

  private activePresetName: string | null;
  private activeLayout: BenchLayout | null;
  private customLayouts: Map<string, BenchLayout>;
  private listeners = new Set<Listener>();

  constructor() {
    this.activePresetName = null;
    this.activeLayout = null;
    this.customLayouts = new Map();
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): BenchDashboardManager {
    if (!BenchDashboardManager.instance) {
      BenchDashboardManager.instance = new BenchDashboardManager();
    }
    return BenchDashboardManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    BenchDashboardManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked on any layout mutation.
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Layout Queries
  // -----------------------------------------------------------------------

  /** Get the currently active layout, or null if none is active. */
  getActiveLayout(): BenchLayout | null {
    if (!this.activeLayout) {
      return null;
    }
    return deepCopyLayout(this.activeLayout);
  }

  /** Get the name of the currently active preset, or null. */
  getActivePresetName(): string | null {
    return this.activePresetName;
  }

  /** Get all built-in preset names. */
  getBuiltInPresetNames(): string[] {
    return Object.keys(BENCH_PRESETS);
  }

  /** Get all custom layout names. */
  getCustomLayoutNames(): string[] {
    return Array.from(this.customLayouts.keys());
  }

  /** Get a specific layout by name (checks custom first, then built-in presets). */
  getLayout(name: string): BenchLayout | null {
    const custom = this.customLayouts.get(name);
    if (custom) {
      return deepCopyLayout(custom);
    }
    const builtin = BENCH_PRESETS[name] as BenchLayout | undefined;
    if (builtin) {
      return deepCopyLayout(builtin);
    }
    return null;
  }

  /** Check whether a name corresponds to a built-in preset. */
  isBuiltIn(name: string): boolean {
    return name in BENCH_PRESETS;
  }

  /** Get total count of available layouts (built-in + custom). */
  getLayoutCount(): number {
    return Object.keys(BENCH_PRESETS).length + this.customLayouts.size;
  }

  // -----------------------------------------------------------------------
  // Layout Actions
  // -----------------------------------------------------------------------

  /**
   * Activate a built-in or custom preset by name.
   * Returns the activated layout, or null if the name was not found.
   */
  activatePreset(name: string): BenchLayout | null {
    const layout = this.getLayout(name);
    if (!layout) {
      return null;
    }
    this.activePresetName = name;
    this.activeLayout = deepCopyLayout(layout);
    this.save();
    this.notify();
    return deepCopyLayout(layout);
  }

  /**
   * Save a custom layout under the given name.
   * Overwrites an existing custom layout with the same name.
   * Throws if name is empty, layout has no panels, or sizes don't match panels.
   * Built-in preset names cannot be used for custom layouts.
   */
  saveCustomLayout(name: string, layout: BenchLayout): void {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Layout name cannot be empty');
    }
    if (this.isBuiltIn(trimmedName)) {
      throw new Error('Cannot overwrite a built-in preset');
    }
    validateLayout(layout);

    const copy = deepCopyLayout(layout);
    this.customLayouts.set(trimmedName, copy);
    this.save();
    this.notify();
  }

  /**
   * Delete a custom layout by name. Built-in presets cannot be deleted.
   * Returns true if the layout was deleted, false if not found or built-in.
   */
  deleteCustomLayout(name: string): boolean {
    if (this.isBuiltIn(name)) {
      return false;
    }
    if (!this.customLayouts.has(name)) {
      return false;
    }
    this.customLayouts.delete(name);

    if (this.activePresetName === name) {
      this.activePresetName = null;
      this.activeLayout = null;
    }

    this.save();
    this.notify();
    return true;
  }

  /** Clear the active layout (no layout is considered active). */
  clearActiveLayout(): void {
    if (this.activePresetName !== null || this.activeLayout !== null) {
      this.activePresetName = null;
      this.activeLayout = null;
      this.save();
      this.notify();
    }
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const customEntries: Array<[string, BenchLayout]> = Array.from(this.customLayouts.entries());
      const data = {
        activePresetName: this.activePresetName,
        activeLayout: this.activeLayout,
        customLayouts: customEntries,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }

      const data = parsed as Record<string, unknown>;

      // Load active preset name
      if (typeof data.activePresetName === 'string' || data.activePresetName === null) {
        this.activePresetName = data.activePresetName as string | null;
      }

      // Load active layout
      if (isValidLayoutShape(data.activeLayout)) {
        this.activeLayout = deepCopyLayout(data.activeLayout);
      }

      // Load custom layouts
      if (Array.isArray(data.customLayouts)) {
        for (const entry of data.customLayouts as unknown[]) {
          if (
            Array.isArray(entry) &&
            entry.length === 2 &&
            typeof entry[0] === 'string' &&
            isValidLayoutShape(entry[1])
          ) {
            this.customLayouts.set(entry[0] as string, deepCopyLayout(entry[1] as BenchLayout));
          }
        }
      }
    } catch {
      // Corrupt data — start fresh
    }
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isValidPanel(value: unknown): value is BenchPanel {
  return typeof value === 'string' && VALID_PANELS.has(value as BenchPanel);
}

function isValidLayoutShape(value: unknown): value is BenchLayout {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.panels) || obj.panels.length === 0) {
    return false;
  }
  if (!obj.panels.every(isValidPanel)) {
    return false;
  }
  if (obj.splitDirection !== 'horizontal' && obj.splitDirection !== 'vertical') {
    return false;
  }
  if (!Array.isArray(obj.sizes) || obj.sizes.length !== obj.panels.length) {
    return false;
  }
  if (!obj.sizes.every((s: unknown) => typeof s === 'number' && s >= 0)) {
    return false;
  }
  return true;
}

function validateLayout(layout: BenchLayout): void {
  if (!Array.isArray(layout.panels) || layout.panels.length === 0) {
    throw new Error('Layout must have at least one panel');
  }
  if (!layout.panels.every(isValidPanel)) {
    throw new Error('Layout contains invalid panel types');
  }
  if (layout.splitDirection !== 'horizontal' && layout.splitDirection !== 'vertical') {
    throw new Error('splitDirection must be "horizontal" or "vertical"');
  }
  if (!Array.isArray(layout.sizes) || layout.sizes.length !== layout.panels.length) {
    throw new Error('sizes array must match panels array length');
  }
  if (!layout.sizes.every((s) => typeof s === 'number' && s >= 0)) {
    throw new Error('All sizes must be non-negative numbers');
  }
}

function deepCopyLayout(layout: BenchLayout): BenchLayout {
  return {
    panels: [...layout.panels],
    splitDirection: layout.splitDirection,
    sizes: [...layout.sizes],
  };
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

export interface UseBenchDashboardReturn {
  activeLayout: BenchLayout | null;
  activePresetName: string | null;
  builtInPresetNames: string[];
  customLayoutNames: string[];
  layoutCount: number;
  activatePreset: (name: string) => BenchLayout | null;
  saveCustomLayout: (name: string, layout: BenchLayout) => void;
  deleteCustomLayout: (name: string) => boolean;
  clearActiveLayout: () => void;
  getLayout: (name: string) => BenchLayout | null;
  isBuiltIn: (name: string) => boolean;
}

/**
 * React hook that subscribes to bench dashboard changes and re-renders
 * the component when layouts are activated, saved, or deleted.
 */
export function useBenchDashboard(): UseBenchDashboardReturn {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const mgr = BenchDashboardManager.getInstance();
    const unsubscribe = mgr.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const mgr = BenchDashboardManager.getInstance();

  const activatePreset = useCallback((name: string) => mgr.activatePreset(name), [mgr]);
  const saveCustomLayout = useCallback(
    (name: string, layout: BenchLayout) => mgr.saveCustomLayout(name, layout),
    [mgr],
  );
  const deleteCustomLayout = useCallback((name: string) => mgr.deleteCustomLayout(name), [mgr]);
  const clearActiveLayout = useCallback(() => {
    mgr.clearActiveLayout();
  }, [mgr]);
  const getLayout = useCallback((name: string) => mgr.getLayout(name), [mgr]);
  const isBuiltIn = useCallback((name: string) => mgr.isBuiltIn(name), [mgr]);

  return {
    activeLayout: mgr.getActiveLayout(),
    activePresetName: mgr.getActivePresetName(),
    builtInPresetNames: mgr.getBuiltInPresetNames(),
    customLayoutNames: mgr.getCustomLayoutNames(),
    layoutCount: mgr.getLayoutCount(),
    activatePreset,
    saveCustomLayout,
    deleteCustomLayout,
    clearActiveLayout,
    getLayout,
    isBuiltIn,
  };
}
