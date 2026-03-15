/**
 * Role Presets — BL-0310
 *
 * Three built-in role presets (Student, Hobbyist, Pro) that tune UI density,
 * visible views, hidden features, and tooltip verbosity. Persists the active
 * role to localStorage. Exposes a singleton manager with subscribe/notify
 * pattern and a React hook for components.
 *
 * Usage:
 *   const manager = RolePresetManager.getInstance();
 *   manager.setActiveRole('student');
 *   manager.isViewVisible('pcb'); // false for student
 *
 * React hook:
 *   const { activeRole, preset, setActiveRole, isViewVisible } = useRolePreset();
 */

import { useCallback, useEffect, useState } from 'react';
import type { ViewMode } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RoleId = 'student' | 'hobbyist' | 'pro';

export type UiDensity = 'comfortable' | 'standard' | 'compact';

export type TooltipLevel = 'verbose' | 'standard' | 'minimal';

export interface RolePreset {
  id: RoleId;
  label: string;
  description: string;
  /** Views visible in sidebar navigation */
  visibleViews: ReadonlySet<ViewMode>;
  /** Feature keys hidden for this role (e.g. 'gerber_export', 'net_classes') */
  hiddenFeatures: ReadonlySet<string>;
  /** Controls spacing/padding in the UI */
  uiDensity: UiDensity;
  /** Controls tooltip verbosity */
  tooltipLevel: TooltipLevel;
}

// ---------------------------------------------------------------------------
// Built-in presets
// ---------------------------------------------------------------------------

/** Minimal set of views for learners — focus on fundamentals */
const STUDENT_VIEWS: ReadonlySet<ViewMode> = new Set<ViewMode>([
  'dashboard',
  'architecture',
  'schematic',
  'breadboard',
  'arduino',
  'starter_circuits',
  'simulation',
  'calculators',
  'knowledge',
  'validation',
  'output',
]);

/** Features hidden from students — too advanced for beginners */
const STUDENT_HIDDEN_FEATURES: ReadonlySet<string> = new Set([
  'gerber_export',
  'net_classes',
  'dfm_checks',
  'push_shove_routing',
  'differential_pairs',
  'signal_integrity',
  'generative_design',
  'copper_pour',
  'impedance_control',
  'flex_zones',
  'board_stackup',
  'assembly_cost',
  'lcsc_mapping',
  'standards_compliance',
  'custom_drc_scripts',
]);

/** Standard set — everything except highly specialized views */
const HOBBYIST_VIEWS: ReadonlySet<ViewMode> = new Set<ViewMode>([
  'dashboard',
  'architecture',
  'schematic',
  'breadboard',
  'pcb',
  'component_editor',
  'viewer_3d',
  'arduino',
  'circuit_code',
  'serial_monitor',
  'digital_twin',
  'starter_circuits',
  'simulation',
  'calculators',
  'generative_design',
  'procurement',
  'storage',
  'ordering',
  'lifecycle',
  'output',
  'design_patterns',
  'kanban',
  'comments',
  'design_history',
  'knowledge',
  'community',
  'validation',
]);

/** Features hidden from hobbyists — highly specialized pro features */
const HOBBYIST_HIDDEN_FEATURES: ReadonlySet<string> = new Set([
  'differential_pairs',
  'signal_integrity',
  'impedance_control',
  'flex_zones',
  'board_stackup',
  'standards_compliance',
  'custom_drc_scripts',
]);

/** All views, no hidden features, compact density */
const ALL_VIEWS: ReadonlySet<ViewMode> = new Set<ViewMode>([
  'dashboard',
  'architecture',
  'schematic',
  'breadboard',
  'pcb',
  'component_editor',
  'viewer_3d',
  'arduino',
  'circuit_code',
  'serial_monitor',
  'digital_twin',
  'starter_circuits',
  'simulation',
  'calculators',
  'generative_design',
  'procurement',
  'storage',
  'ordering',
  'lifecycle',
  'output',
  'design_patterns',
  'kanban',
  'comments',
  'design_history',
  'knowledge',
  'community',
  'validation',
]);

const PRO_HIDDEN_FEATURES: ReadonlySet<string> = new Set<string>();

// ---------------------------------------------------------------------------
// Preset definitions
// ---------------------------------------------------------------------------

export const ROLE_PRESETS: ReadonlyMap<RoleId, RolePreset> = new Map<RoleId, RolePreset>([
  [
    'student',
    {
      id: 'student',
      label: 'Student',
      description: 'Simplified interface focused on learning fundamentals. Verbose tooltips, fewer panels.',
      visibleViews: STUDENT_VIEWS,
      hiddenFeatures: STUDENT_HIDDEN_FEATURES,
      uiDensity: 'comfortable',
      tooltipLevel: 'verbose',
    },
  ],
  [
    'hobbyist',
    {
      id: 'hobbyist',
      label: 'Hobbyist',
      description: 'Standard layout for makers and tinkerers. Balanced tooltips, most panels visible.',
      visibleViews: HOBBYIST_VIEWS,
      hiddenFeatures: HOBBYIST_HIDDEN_FEATURES,
      uiDensity: 'standard',
      tooltipLevel: 'standard',
    },
  ],
  [
    'pro',
    {
      id: 'pro',
      label: 'Pro',
      description: 'Full access to every feature. Compact density, minimal tooltips.',
      visibleViews: ALL_VIEWS,
      hiddenFeatures: PRO_HIDDEN_FEATURES,
      uiDensity: 'compact',
      tooltipLevel: 'minimal',
    },
  ],
]);

export const ROLE_IDS: readonly RoleId[] = ['student', 'hobbyist', 'pro'] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getRolePreset(id: RoleId): RolePreset {
  const preset = ROLE_PRESETS.get(id);
  if (!preset) {
    throw new Error(`Unknown role preset: ${id}`);
  }
  return preset;
}

export function isValidRoleId(value: unknown): value is RoleId {
  return typeof value === 'string' && ROLE_IDS.includes(value as RoleId);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse:role-preset';
const DEFAULT_ROLE: RoleId = 'hobbyist';

// ---------------------------------------------------------------------------
// RolePresetManager — singleton + subscribe pattern
// ---------------------------------------------------------------------------

export class RolePresetManager {
  private static instance: RolePresetManager | null = null;

  private activeRoleId: RoleId;
  private subscribers: Set<() => void>;

  constructor() {
    this.activeRoleId = DEFAULT_ROLE;
    this.subscribers = new Set();
    this.load();
  }

  static getInstance(): RolePresetManager {
    if (!RolePresetManager.instance) {
      RolePresetManager.instance = new RolePresetManager();
    }
    return RolePresetManager.instance;
  }

  /** Reset singleton — for testing only */
  static resetInstance(): void {
    RolePresetManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Accessors
  // -----------------------------------------------------------------------

  getActiveRoleId(): RoleId {
    return this.activeRoleId;
  }

  getActivePreset(): RolePreset {
    return getRolePreset(this.activeRoleId);
  }

  setActiveRole(id: RoleId): void {
    if (!isValidRoleId(id)) {
      throw new Error(`Invalid role id: ${String(id)}`);
    }
    if (this.activeRoleId === id) {
      return;
    }
    this.activeRoleId = id;
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Query helpers
  // -----------------------------------------------------------------------

  isViewVisible(view: ViewMode): boolean {
    return this.getActivePreset().visibleViews.has(view);
  }

  isFeatureHidden(featureKey: string): boolean {
    return this.getActivePreset().hiddenFeatures.has(featureKey);
  }

  isFeatureVisible(featureKey: string): boolean {
    return !this.isFeatureHidden(featureKey);
  }

  getVisibleViews(): ViewMode[] {
    return Array.from(this.getActivePreset().visibleViews);
  }

  getHiddenFeatures(): string[] {
    return Array.from(this.getActivePreset().hiddenFeatures);
  }

  getUiDensity(): UiDensity {
    return this.getActivePreset().uiDensity;
  }

  getTooltipLevel(): TooltipLevel {
    return this.getActivePreset().tooltipLevel;
  }

  // -----------------------------------------------------------------------
  // Subscribe/notify
  // -----------------------------------------------------------------------

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(): void {
    for (const cb of Array.from(this.subscribers)) {
      cb();
    }
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && isValidRoleId(raw)) {
        this.activeRoleId = raw;
      }
    } catch {
      // localStorage unavailable — keep default
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, this.activeRoleId);
    } catch {
      // localStorage full or unavailable — silently ignore
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseRolePresetReturn {
  activeRole: RoleId;
  preset: RolePreset;
  setActiveRole: (id: RoleId) => void;
  isViewVisible: (view: ViewMode) => boolean;
  isFeatureHidden: (featureKey: string) => boolean;
  isFeatureVisible: (featureKey: string) => boolean;
  uiDensity: UiDensity;
  tooltipLevel: TooltipLevel;
}

export function useRolePreset(): UseRolePresetReturn {
  const manager = RolePresetManager.getInstance();
  const [activeRole, setActiveRoleState] = useState<RoleId>(manager.getActiveRoleId());

  useEffect(() => {
    // Sync state when manager notifies (e.g. from another component)
    const unsubscribe = manager.subscribe(() => {
      setActiveRoleState(manager.getActiveRoleId());
    });
    return unsubscribe;
  }, [manager]);

  const setActiveRole = useCallback(
    (id: RoleId) => {
      manager.setActiveRole(id);
    },
    [manager],
  );

  const isViewVisible = useCallback(
    (view: ViewMode) => manager.isViewVisible(view),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeRole],
  );

  const isFeatureHidden = useCallback(
    (featureKey: string) => manager.isFeatureHidden(featureKey),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeRole],
  );

  const isFeatureVisible = useCallback(
    (featureKey: string) => manager.isFeatureVisible(featureKey),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeRole],
  );

  const preset = manager.getActivePreset();

  return {
    activeRole,
    preset,
    setActiveRole,
    isViewVisible,
    isFeatureHidden,
    isFeatureVisible,
    uiDensity: preset.uiDensity,
    tooltipLevel: preset.tooltipLevel,
  };
}
