/**
 * Workspace Preset Manager
 *
 * Manages named workspace layout presets that control sidebar visibility,
 * chat panel visibility, sidebar width, active view, and panel sizes.
 * Built-in presets cover common workflows; custom presets are persisted
 * to localStorage.
 *
 * Usage:
 *   const mgr = WorkspacePresetManager.getInstance();
 *   mgr.applyPreset(BUILT_IN_PRESETS[0]);
 *   mgr.saveCurrentAsPreset('My Layout');
 *
 * React hook:
 *   const { presets, activePresetId, applyPreset, saveCurrentAsPreset, deletePreset } = useWorkspacePresets();
 */

import { useCallback, useEffect, useState } from 'react';
import type { ViewMode } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspacePreset {
  id: string;
  name: string;
  sidebarVisible: boolean;
  chatVisible: boolean;
  sidebarWidth: number;
  activeView: ViewMode;
  panelSizes: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Built-in presets
// ---------------------------------------------------------------------------

export const BUILT_IN_PRESETS: readonly WorkspacePreset[] = [
  {
    id: 'builtin-design-focus',
    name: 'Design Focus',
    sidebarVisible: true,
    chatVisible: true,
    sidebarWidth: 280,
    activeView: 'architecture',
    panelSizes: { sidebar: 280, chat: 360 },
  },
  {
    id: 'builtin-compact',
    name: 'Compact',
    sidebarVisible: true,
    chatVisible: false,
    sidebarWidth: 200,
    activeView: 'architecture',
    panelSizes: { sidebar: 200 },
  },
  {
    id: 'builtin-fullscreen',
    name: 'Fullscreen',
    sidebarVisible: false,
    chatVisible: false,
    sidebarWidth: 0,
    activeView: 'architecture',
    panelSizes: {},
  },
  {
    id: 'builtin-review',
    name: 'Review',
    sidebarVisible: true,
    chatVisible: false,
    sidebarWidth: 280,
    activeView: 'validation',
    panelSizes: { sidebar: 280 },
  },
] as const;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-workspace-presets';

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// WorkspacePresetManager
// ---------------------------------------------------------------------------

/**
 * Manages workspace layout presets with built-in defaults and custom
 * user-created presets. Singleton per application. Notifies subscribers
 * on state changes. Custom presets are persisted to localStorage.
 */
export class WorkspacePresetManager {
  private static instance: WorkspacePresetManager | null = null;

  private customPresets: WorkspacePreset[];
  private currentPresetId: string | null;
  private listeners = new Set<Listener>();

  constructor() {
    this.customPresets = [];
    this.currentPresetId = null;
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): WorkspacePresetManager {
    if (!WorkspacePresetManager.instance) {
      WorkspacePresetManager.instance = new WorkspacePresetManager();
    }
    return WorkspacePresetManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    WorkspacePresetManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked on any preset mutation.
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
  // Preset Queries
  // -----------------------------------------------------------------------

  /** Get all presets (built-in first, then custom) sorted by name within each group. */
  getAllPresets(): WorkspacePreset[] {
    const builtIn = [...BUILT_IN_PRESETS].sort((a, b) => a.name.localeCompare(b.name));
    const custom = [...this.customPresets].sort((a, b) => a.name.localeCompare(b.name));
    return [...builtIn, ...custom];
  }

  /** Get only built-in presets. */
  getBuiltInPresets(): WorkspacePreset[] {
    return [...BUILT_IN_PRESETS];
  }

  /** Get only custom (user-created) presets. */
  getCustomPresets(): WorkspacePreset[] {
    return [...this.customPresets];
  }

  /** Get a preset by ID. Returns null if not found. */
  getPreset(id: string): WorkspacePreset | null {
    const builtIn = BUILT_IN_PRESETS.find((p) => p.id === id);
    if (builtIn) {
      return { ...builtIn };
    }
    const custom = this.customPresets.find((p) => p.id === id);
    return custom ? { ...custom } : null;
  }

  /** Get the ID of the currently active preset, or null if none is active. */
  getActivePresetId(): string | null {
    return this.currentPresetId;
  }

  /** Check whether a preset ID refers to a built-in preset. */
  isBuiltIn(id: string): boolean {
    return BUILT_IN_PRESETS.some((p) => p.id === id);
  }

  // -----------------------------------------------------------------------
  // Preset Actions
  // -----------------------------------------------------------------------

  /**
   * Apply a preset, making it the active preset.
   * Returns the preset that was applied, or null if the preset was not found.
   */
  applyPreset(preset: WorkspacePreset): WorkspacePreset {
    this.currentPresetId = preset.id;
    this.save();
    this.notify();
    return { ...preset };
  }

  /**
   * Apply a preset by its ID.
   * Returns the preset that was applied, or null if the ID was not found.
   */
  applyPresetById(id: string): WorkspacePreset | null {
    const preset = this.getPreset(id);
    if (!preset) {
      return null;
    }
    return this.applyPreset(preset);
  }

  /**
   * Save the current workspace state as a custom preset.
   * Returns the ID of the new preset.
   */
  saveCurrentAsPreset(
    name: string,
    state: {
      sidebarVisible: boolean;
      chatVisible: boolean;
      sidebarWidth: number;
      activeView: ViewMode;
      panelSizes: Record<string, number>;
    },
  ): string {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Preset name cannot be empty');
    }

    const id = crypto.randomUUID();
    const preset: WorkspacePreset = {
      id,
      name: trimmedName,
      sidebarVisible: state.sidebarVisible,
      chatVisible: state.chatVisible,
      sidebarWidth: state.sidebarWidth,
      activeView: state.activeView,
      panelSizes: { ...state.panelSizes },
    };

    this.customPresets.push(preset);
    this.currentPresetId = id;
    this.save();
    this.notify();
    return id;
  }

  /**
   * Update an existing custom preset. Built-in presets cannot be updated.
   * Returns true if the preset was updated, false if not found or built-in.
   */
  updatePreset(id: string, updates: Partial<Omit<WorkspacePreset, 'id'>>): boolean {
    if (this.isBuiltIn(id)) {
      return false;
    }

    const preset = this.customPresets.find((p) => p.id === id);
    if (!preset) {
      return false;
    }

    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();
      if (!trimmedName) {
        return false;
      }
      preset.name = trimmedName;
    }
    if (updates.sidebarVisible !== undefined) {
      preset.sidebarVisible = updates.sidebarVisible;
    }
    if (updates.chatVisible !== undefined) {
      preset.chatVisible = updates.chatVisible;
    }
    if (updates.sidebarWidth !== undefined) {
      preset.sidebarWidth = updates.sidebarWidth;
    }
    if (updates.activeView !== undefined) {
      preset.activeView = updates.activeView;
    }
    if (updates.panelSizes !== undefined) {
      preset.panelSizes = { ...updates.panelSizes };
    }

    this.save();
    this.notify();
    return true;
  }

  /**
   * Delete a custom preset by ID. Built-in presets cannot be deleted.
   * Returns true if the preset was deleted, false if not found or built-in.
   */
  deletePreset(id: string): boolean {
    if (this.isBuiltIn(id)) {
      return false;
    }

    const index = this.customPresets.findIndex((p) => p.id === id);
    if (index === -1) {
      return false;
    }

    this.customPresets.splice(index, 1);

    if (this.currentPresetId === id) {
      this.currentPresetId = null;
    }

    this.save();
    this.notify();
    return true;
  }

  /**
   * Rename a custom preset. Built-in presets cannot be renamed.
   * Returns true if the preset was renamed, false if not found or built-in.
   */
  renamePreset(id: string, newName: string): boolean {
    return this.updatePreset(id, { name: newName });
  }

  /** Clear the active preset ID (no preset is considered active). */
  clearActivePreset(): void {
    if (this.currentPresetId !== null) {
      this.currentPresetId = null;
      this.save();
      this.notify();
    }
  }

  /** Get the total number of presets (built-in + custom). */
  getPresetCount(): number {
    return BUILT_IN_PRESETS.length + this.customPresets.length;
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const data = {
        customPresets: this.customPresets,
        currentPresetId: this.currentPresetId,
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

      // Load custom presets
      if (Array.isArray(data.customPresets)) {
        const validPresets = (data.customPresets as unknown[]).filter(
          (p: unknown): p is WorkspacePreset =>
            typeof p === 'object' &&
            p !== null &&
            typeof (p as Record<string, unknown>).id === 'string' &&
            typeof (p as Record<string, unknown>).name === 'string' &&
            typeof (p as Record<string, unknown>).sidebarVisible === 'boolean' &&
            typeof (p as Record<string, unknown>).chatVisible === 'boolean' &&
            typeof (p as Record<string, unknown>).sidebarWidth === 'number' &&
            typeof (p as Record<string, unknown>).activeView === 'string' &&
            typeof (p as Record<string, unknown>).panelSizes === 'object' &&
            (p as Record<string, unknown>).panelSizes !== null,
        );
        this.customPresets = validPresets;
      }

      // Load active preset ID
      if (typeof data.currentPresetId === 'string' || data.currentPresetId === null) {
        this.currentPresetId = data.currentPresetId as string | null;
      }
    } catch {
      // Corrupt data — start fresh
    }
  }
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

export interface UseWorkspacePresetsReturn {
  presets: WorkspacePreset[];
  customPresets: WorkspacePreset[];
  builtInPresets: WorkspacePreset[];
  activePresetId: string | null;
  presetCount: number;
  applyPreset: (preset: WorkspacePreset) => WorkspacePreset;
  applyPresetById: (id: string) => WorkspacePreset | null;
  saveCurrentAsPreset: (
    name: string,
    state: {
      sidebarVisible: boolean;
      chatVisible: boolean;
      sidebarWidth: number;
      activeView: ViewMode;
      panelSizes: Record<string, number>;
    },
  ) => string;
  deletePreset: (id: string) => boolean;
  renamePreset: (id: string, newName: string) => boolean;
  clearActivePreset: () => void;
  isBuiltIn: (id: string) => boolean;
}

/**
 * React hook that subscribes to workspace preset changes and re-renders
 * the component when presets are added, removed, or applied.
 */
export function useWorkspacePresets(): UseWorkspacePresetsReturn {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const mgr = WorkspacePresetManager.getInstance();
    const unsubscribe = mgr.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const mgr = WorkspacePresetManager.getInstance();

  const applyPreset = useCallback((preset: WorkspacePreset) => mgr.applyPreset(preset), [mgr]);
  const applyPresetById = useCallback((id: string) => mgr.applyPresetById(id), [mgr]);
  const saveCurrentAsPreset = useCallback(
    (
      name: string,
      state: {
        sidebarVisible: boolean;
        chatVisible: boolean;
        sidebarWidth: number;
        activeView: ViewMode;
        panelSizes: Record<string, number>;
      },
    ) => mgr.saveCurrentAsPreset(name, state),
    [mgr],
  );
  const deletePreset = useCallback((id: string) => mgr.deletePreset(id), [mgr]);
  const renamePreset = useCallback((id: string, newName: string) => mgr.renamePreset(id, newName), [mgr]);
  const clearActivePreset = useCallback(() => {
    mgr.clearActivePreset();
  }, [mgr]);
  const isBuiltIn = useCallback((id: string) => mgr.isBuiltIn(id), [mgr]);

  return {
    presets: mgr.getAllPresets(),
    customPresets: mgr.getCustomPresets(),
    builtInPresets: mgr.getBuiltInPresets(),
    activePresetId: mgr.getActivePresetId(),
    presetCount: mgr.getPresetCount(),
    applyPreset,
    applyPresetById,
    saveCurrentAsPreset,
    deletePreset,
    renamePreset,
    clearActivePreset,
    isBuiltIn,
  };
}
