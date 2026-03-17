/**
 * Mobile Bottom Navigation
 *
 * Provides the data model and helper functions for a mobile-friendly bottom
 * navigation bar. Designed for small screens where the full sidebar is hidden
 * and users need quick access to the 5 most important actions.
 *
 * Types:
 *   BottomNavItem — a single navigation entry (id, icon name, label, viewMode, optional badge)
 *   BottomNavConfig — the resolved state of the bottom nav (visibility, active item, badge counts)
 *
 * Constants:
 *   BOTTOM_NAV_ITEMS — the 5 core actions (Design, Validate, Build, Chat, More)
 *   DEFAULT_BREAKPOINT — the screen width threshold (768px, matching useMobile)
 *
 * Helpers:
 *   shouldShowBottomNav(screenWidth, breakpoint?) — pure function for visibility
 *   getNavItemForView(viewMode) — maps any ViewMode to its closest BottomNavItem
 *
 * Hook:
 *   useBottomNav(activeView) — returns the full BottomNavConfig for the current view
 */

import { useMemo } from 'react';

import type { ViewMode } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Icon name from lucide-react (string identifier, not the component itself). */
export type IconName = string;

/** A single item in the bottom navigation bar. */
export interface BottomNavItem {
  /** Unique stable identifier for data-testid and keying. */
  id: string;
  /** lucide-react icon name (e.g. 'Pencil', 'ShieldCheck'). */
  icon: IconName;
  /** Human-readable label rendered below the icon. */
  label: string;
  /** The ViewMode this item navigates to. */
  viewMode: ViewMode;
  /** Optional numeric badge (e.g. validation issue count). `undefined` or 0 = hidden. */
  badge?: number;
}

/** The resolved runtime state of the bottom navigation bar. */
export interface BottomNavConfig {
  /** Whether the bottom nav should be visible at the current screen width. */
  visible: boolean;
  /** The id of the currently active BottomNavItem (or `null` if no match). */
  activeItem: string | null;
  /** Map from BottomNavItem id to its current badge count. */
  badgeCounts: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default breakpoint in CSS pixels — matches the MOBILE_BREAKPOINT in use-mobile.tsx. */
export const DEFAULT_BREAKPOINT = 768;

/**
 * The 5 core bottom-nav actions. Order matters — it defines left-to-right
 * rendering order in the bar.
 */
export const BOTTOM_NAV_ITEMS: readonly BottomNavItem[] = Object.freeze([
  Object.freeze({
    id: 'design',
    icon: 'Pencil',
    label: 'Design',
    viewMode: 'architecture',
  } as BottomNavItem),
  Object.freeze({
    id: 'validate',
    icon: 'ShieldCheck',
    label: 'Validate',
    viewMode: 'validation',
  } as BottomNavItem),
  Object.freeze({
    id: 'build',
    icon: 'Hammer',
    label: 'Build',
    viewMode: 'pcb',
  } as BottomNavItem),
  Object.freeze({
    id: 'chat',
    icon: 'MessageSquare',
    label: 'Chat',
    viewMode: 'dashboard',
  } as BottomNavItem),
  Object.freeze({
    id: 'more',
    icon: 'MoreHorizontal',
    label: 'More',
    viewMode: 'project_explorer',
  } as BottomNavItem),
]);

// ---------------------------------------------------------------------------
// Internal lookup tables (built once at module load)
// ---------------------------------------------------------------------------

/** Maps a BottomNavItem id to the item itself. */
const itemById: ReadonlyMap<string, BottomNavItem> = new Map(
  BOTTOM_NAV_ITEMS.map((item) => [item.id, item]),
);

/**
 * Maps every ViewMode to the BottomNavItem id it should highlight.
 * ViewModes that are the direct target of a nav item get exact matches.
 * Remaining ViewModes are bucketed to the closest conceptual category.
 */
const viewToNavId: ReadonlyMap<ViewMode, string> = (() => {
  const map = new Map<ViewMode, string>();

  // Exact matches (each item's own viewMode)
  for (const item of BOTTOM_NAV_ITEMS) {
    map.set(item.viewMode, item.id);
  }

  // Design bucket — architecture, schematic, breadboard, component editor, etc.
  const designViews: ViewMode[] = [
    'architecture',
    'schematic',
    'breadboard',
    'component_editor',
    'viewer_3d',
    'design_patterns',
    'circuit_code',
    'generative_design',
    'starter_circuits',
  ];
  for (const v of designViews) {
    if (!map.has(v)) {
      map.set(v, 'design');
    }
  }

  // Validate bucket — validation, simulation, calculators
  const validateViews: ViewMode[] = [
    'validation',
    'simulation',
    'calculators',
  ];
  for (const v of validateViews) {
    if (!map.has(v)) {
      map.set(v, 'validate');
    }
  }

  // Build bucket — PCB, procurement, ordering, storage, lifecycle, output, serial
  const buildViews: ViewMode[] = [
    'pcb',
    'procurement',
    'ordering',
    'storage',
    'lifecycle',
    'output',
    'serial_monitor',
    'arduino',
    'digital_twin',
  ];
  for (const v of buildViews) {
    if (!map.has(v)) {
      map.set(v, 'build');
    }
  }

  // Chat bucket — dashboard, comments
  const chatViews: ViewMode[] = [
    'dashboard',
    'comments',
  ];
  for (const v of chatViews) {
    if (!map.has(v)) {
      map.set(v, 'chat');
    }
  }

  // More bucket — everything else
  const moreViews: ViewMode[] = [
    'project_explorer',
    'design_history',
    'kanban',
    'knowledge',
    'community',
    'audit_trail',
    'labs',
  ];
  for (const v of moreViews) {
    if (!map.has(v)) {
      map.set(v, 'more');
    }
  }

  return map;
})();

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the bottom nav should be visible.
 *
 * @param screenWidth - Current viewport width in CSS pixels.
 * @param breakpoint - Max width at which the nav is shown (exclusive). Defaults to 768.
 */
export function shouldShowBottomNav(
  screenWidth: number,
  breakpoint: number = DEFAULT_BREAKPOINT,
): boolean {
  if (!Number.isFinite(screenWidth) || screenWidth < 0) {
    return false;
  }
  if (!Number.isFinite(breakpoint) || breakpoint < 0) {
    return false;
  }
  return screenWidth < breakpoint;
}

/**
 * Maps any ViewMode to the BottomNavItem that should be highlighted.
 * Returns `undefined` if the view has no mapping (should not happen for valid ViewModes).
 */
export function getNavItemForView(viewMode: ViewMode): BottomNavItem | undefined {
  const navId = viewToNavId.get(viewMode);
  if (navId === undefined) {
    return undefined;
  }
  return itemById.get(navId);
}

/**
 * Returns the BottomNavItem with the given id, or `undefined`.
 */
export function getNavItemById(id: string): BottomNavItem | undefined {
  return itemById.get(id);
}

/**
 * Returns all ViewModes that map to the given BottomNavItem id.
 */
export function getViewModesForNavItem(navItemId: string): ViewMode[] {
  const result: ViewMode[] = [];
  for (const [viewMode, id] of Array.from(viewToNavId.entries())) {
    if (id === navItemId) {
      result.push(viewMode);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook that derives the full BottomNavConfig for the current active view.
 *
 * @param activeView - The currently active ViewMode from project context.
 * @param badgeCounts - Optional external badge counts keyed by BottomNavItem id.
 * @returns The resolved BottomNavConfig.
 *
 * Note: Visibility is always `true` in the hook return — actual screen width
 * gating should be done by the consuming component using `shouldShowBottomNav`
 * (or the `useIsMobile` hook). The hook focuses on deriving `activeItem` and
 * merging badge counts.
 */
export function useBottomNav(
  activeView: ViewMode,
  badgeCounts?: Record<string, number>,
): BottomNavConfig {
  return useMemo(() => {
    const navItem = getNavItemForView(activeView);
    const activeItem = navItem?.id ?? null;

    // Build the badge count record, defaulting every item to 0
    const resolvedBadges: Record<string, number> = {};
    for (const item of BOTTOM_NAV_ITEMS) {
      const externalCount = badgeCounts?.[item.id];
      resolvedBadges[item.id] = typeof externalCount === 'number' && externalCount > 0
        ? Math.floor(externalCount)
        : 0;
    }

    return {
      visible: true,
      activeItem,
      badgeCounts: resolvedBadges,
    };
  }, [activeView, badgeCounts]);
}
