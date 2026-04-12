import type { LucideIcon } from 'lucide-react';
import {
  Pencil,
  FlaskConical,
  Usb,
  Factory,
  Bot,
  BookOpen,
} from 'lucide-react';
import type { ViewMode } from '@/lib/project-context';
import type { NavItem } from '@/components/layout/sidebar/sidebar-constants';
import { navItems } from '@/components/layout/sidebar/sidebar-constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SidebarGroup {
  /** Stable key used for localStorage persistence and data-testid */
  id: string;
  /** Human-readable label */
  label: string;
  /** lucide-react icon rendered beside the group label */
  icon: LucideIcon;
  /** Ordered ViewModes that belong to this group */
  views: ViewMode[];
}

// ---------------------------------------------------------------------------
// Group definitions
// ---------------------------------------------------------------------------

export const SIDEBAR_GROUPS: readonly SidebarGroup[] = [
  {
    id: 'design',
    label: 'Design',
    icon: Pencil,
    views: [
      'dashboard',
      'architecture',
      'schematic',
      'breadboard',
      'pcb',
      'component_editor',
      'viewer_3d',
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis',
    icon: FlaskConical,
    views: [
      'validation',
      'simulation',
      'calculators',
      'generative_design',
    ],
  },
  {
    id: 'hardware',
    label: 'Hardware',
    icon: Usb,
    views: [
      'arduino',
      'circuit_code',
      'serial_monitor',
      'digital_twin',
    ],
  },
  {
    id: 'manufacturing',
    label: 'Manufacturing',
    icon: Factory,
    views: [
      'procurement',
      'storage',
      'ordering',
      'lifecycle',
      'output',
      'supply_chain',
      'bom_templates',
      'personal_inventory',
      'part_alternates',
      'part_usage',
    ],
  },
  {
    id: 'ai_code',
    label: 'AI & Code',
    icon: Bot,
    views: [
      'starter_circuits',
      'design_patterns',
      'kanban',
      'comments',
      'design_history',
      'audit_trail',
    ],
  },
  {
    id: 'documentation',
    label: 'Documentation',
    icon: BookOpen,
    views: [
      'knowledge',
      'community',
      'labs',
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Precomputed lookup: ViewMode → group id */
const viewToGroupId: ReadonlyMap<ViewMode, string> = (() => {
  const map = new Map<ViewMode, string>();
  for (const group of SIDEBAR_GROUPS) {
    for (const view of group.views) {
      map.set(view, group.id);
    }
  }
  return map;
})();

/**
 * Returns the group id that contains the given ViewMode, or `undefined`
 * if the view is not in any group (should not happen with valid ViewModes).
 */
export function getGroupForView(view: ViewMode): string | undefined {
  return viewToGroupId.get(view);
}

/**
 * Returns the NavItem entries for a given group, preserving the group's
 * view ordering. Filters against the canonical `navItems` array so that
 * only views with an icon/label definition are included.
 */
export function getNavItemsForGroup(group: SidebarGroup): NavItem[] {
  const navItemMap = new Map<ViewMode, NavItem>();
  for (const item of navItems) {
    navItemMap.set(item.view, item);
  }
  const result: NavItem[] = [];
  for (const view of group.views) {
    const item = navItemMap.get(view);
    if (item) {
      result.push(item);
    }
  }
  return result;
}

/**
 * Checks that every ViewMode present in `navItems` is assigned to exactly
 * one group. Returns an array of ViewModes that are missing from groups.
 * Intended for test/dev assertions.
 */
export function getUngroupedNavItems(): ViewMode[] {
  return navItems
    .filter((item) => !viewToGroupId.has(item.view))
    .map((item) => item.view);
}

/**
 * Returns the set of all ViewModes listed in groups but NOT present in
 * the navItems constant. Useful for catching stale group entries.
 */
export function getOrphanedGroupViews(): ViewMode[] {
  const navViewSet = new Set<ViewMode>(navItems.map((item) => item.view));
  const orphaned: ViewMode[] = [];
  for (const group of SIDEBAR_GROUPS) {
    for (const view of group.views) {
      if (!navViewSet.has(view)) {
        orphaned.push(view);
      }
    }
  }
  return orphaned;
}

// ---------------------------------------------------------------------------
// localStorage persistence for collapsed state
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse:sidebar-group-collapsed';

/**
 * Reads collapsed group state from localStorage.
 * Returns a record mapping group id → `true` if collapsed.
 */
export function loadCollapsedGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, boolean>;
      }
    }
  } catch {
    // Corrupted or unavailable — return defaults
  }
  return {};
}

/**
 * Persists collapsed group state to localStorage.
 */
export function saveCollapsedGroups(collapsed: Record<string, boolean>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}
