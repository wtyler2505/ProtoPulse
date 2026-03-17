/**
 * Tablet Layout Manager
 *
 * Provides responsive layout management for tablet-sized viewports (768-1024px).
 * Determines the appropriate layout mode (split, overlay, or collapsed) based on
 * the current viewport width and returns configuration for sidebar/inspector sizing.
 *
 * Usage:
 *   const mode = getTabletLayoutMode(900);      // 'split'
 *   const show = shouldShowInspectorOverlay(800); // true
 *
 * React hook:
 *   const { mode, config } = useTabletLayout();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Breakpoint range defining tablet viewport boundaries (inclusive). */
export interface TabletBreakpoint {
  /** Minimum width in pixels (inclusive). */
  readonly min: number;
  /** Maximum width in pixels (inclusive). */
  readonly max: number;
}

/** Layout mode for the tablet viewport. */
export type TabletLayoutMode = 'split' | 'overlay' | 'collapsed';

/** Configuration values for a tablet layout, derived from the current mode. */
export interface TabletLayoutConfig {
  /** Sidebar width in pixels. */
  readonly sidebarWidth: number;
  /** Inspector panel width in pixels. */
  readonly inspectorWidth: number;
  /** Active layout mode. */
  readonly mode: TabletLayoutMode;
}

/** Complete state returned by the `useTabletLayout` hook. */
export interface TabletLayoutState {
  /** Current viewport width in pixels. */
  readonly width: number;
  /** Whether the viewport falls within the tablet breakpoint range. */
  readonly isTablet: boolean;
  /** Active layout mode. */
  readonly mode: TabletLayoutMode;
  /** Derived layout configuration. */
  readonly config: TabletLayoutConfig;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The standard tablet breakpoint range: 768px - 1024px (inclusive). */
export const TABLET_BREAKPOINT: TabletBreakpoint = {
  min: 768,
  max: 1024,
} as const;

/**
 * Width threshold within the tablet range that separates 'split' from 'overlay'.
 * Viewports >= this value use 'split' mode; below it, 'overlay'.
 */
export const SPLIT_MODE_THRESHOLD = 900;

/**
 * Width threshold below which the layout collapses entirely.
 * Viewports < this value (but still within the tablet range) use 'collapsed'.
 */
export const COLLAPSED_MODE_THRESHOLD = 800;

/** Default tablet layout configuration for the 'split' mode. */
export const DEFAULT_TABLET_CONFIG: TabletLayoutConfig = {
  sidebarWidth: 240,
  inspectorWidth: 280,
  mode: 'split',
} as const;

/** Layout configuration for overlay mode (narrower sidebar, no persistent inspector). */
const OVERLAY_CONFIG: TabletLayoutConfig = {
  sidebarWidth: 200,
  inspectorWidth: 260,
  mode: 'overlay',
} as const;

/** Layout configuration for collapsed mode (minimal sidebar, no inspector). */
const COLLAPSED_CONFIG: TabletLayoutConfig = {
  sidebarWidth: 56,
  inspectorWidth: 0,
  mode: 'collapsed',
} as const;

// ---------------------------------------------------------------------------
// Pure Functions
// ---------------------------------------------------------------------------

/**
 * Determine whether a given width falls within the tablet breakpoint range.
 *
 * @param width - Viewport width in pixels.
 * @returns `true` if width is within [TABLET_BREAKPOINT.min, TABLET_BREAKPOINT.max].
 */
export function isTabletWidth(width: number): boolean {
  return width >= TABLET_BREAKPOINT.min && width <= TABLET_BREAKPOINT.max;
}

/**
 * Determine the appropriate `TabletLayoutMode` for a given viewport width.
 *
 * - `width >= SPLIT_MODE_THRESHOLD` (900) => 'split'
 * - `width >= COLLAPSED_MODE_THRESHOLD` (800) and < 900 => 'overlay'
 * - `width < COLLAPSED_MODE_THRESHOLD` (800) => 'collapsed'
 *
 * This function works for any width, not just tablet-range widths.
 * When used outside the tablet range, it still returns a mode based on
 * the same thresholds.
 *
 * @param width - Viewport width in pixels.
 * @returns The layout mode for the given width.
 */
export function getTabletLayoutMode(width: number): TabletLayoutMode {
  if (width >= SPLIT_MODE_THRESHOLD) {
    return 'split';
  }
  if (width >= COLLAPSED_MODE_THRESHOLD) {
    return 'overlay';
  }
  return 'collapsed';
}

/**
 * Get the full layout configuration for a given viewport width.
 *
 * @param width - Viewport width in pixels.
 * @returns The `TabletLayoutConfig` matching the determined mode.
 */
export function getTabletLayoutConfig(width: number): TabletLayoutConfig {
  const mode = getTabletLayoutMode(width);
  switch (mode) {
    case 'split':
      return DEFAULT_TABLET_CONFIG;
    case 'overlay':
      return OVERLAY_CONFIG;
    case 'collapsed':
      return COLLAPSED_CONFIG;
  }
}

/**
 * Determine whether the inspector should render as an overlay at the given width.
 *
 * The inspector uses an overlay presentation when the viewport is too narrow
 * for a persistent side-by-side layout but still wide enough to show it at all.
 * Specifically, this returns `true` when the mode is 'overlay' (width is in the
 * range [COLLAPSED_MODE_THRESHOLD, SPLIT_MODE_THRESHOLD)).
 *
 * @param width - Viewport width in pixels.
 * @returns `true` when the inspector should be shown as an overlay.
 */
export function shouldShowInspectorOverlay(width: number): boolean {
  return width >= COLLAPSED_MODE_THRESHOLD && width < SPLIT_MODE_THRESHOLD;
}

/**
 * Compute the available content width after subtracting sidebar and inspector.
 *
 * @param viewportWidth - Total viewport width in pixels.
 * @param config - The active layout configuration.
 * @returns Remaining width for the main content area (minimum 0).
 */
export function getContentWidth(viewportWidth: number, config: TabletLayoutConfig): number {
  return Math.max(0, viewportWidth - config.sidebarWidth - config.inspectorWidth);
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

/**
 * React hook that tracks the window width and returns the current tablet
 * layout state, including mode, configuration, and whether the viewport
 * is within the tablet breakpoint range.
 *
 * Uses `matchMedia` listeners for efficient change detection rather than
 * polling or listening to every resize event.
 *
 * @returns `TabletLayoutState` that updates reactively on viewport changes.
 */
export function useTabletLayout(): TabletLayoutState {
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === 'undefined') {
      return 0;
    }
    return window.innerWidth;
  });

  const handleResize = useCallback(() => {
    setWidth(window.innerWidth);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // Set initial width in case SSR/test value differs
    setWidth(window.innerWidth);

    // Listen to the two critical breakpoints via matchMedia for efficient updates
    const mqlMin = window.matchMedia(`(min-width: ${TABLET_BREAKPOINT.min}px)`);
    const mqlMax = window.matchMedia(`(max-width: ${TABLET_BREAKPOINT.max}px)`);
    const mqlSplit = window.matchMedia(`(min-width: ${SPLIT_MODE_THRESHOLD}px)`);
    const mqlCollapsed = window.matchMedia(`(min-width: ${COLLAPSED_MODE_THRESHOLD}px)`);

    // Also listen to generic resize for continuous width tracking
    window.addEventListener('resize', handleResize);

    mqlMin.addEventListener('change', handleResize);
    mqlMax.addEventListener('change', handleResize);
    mqlSplit.addEventListener('change', handleResize);
    mqlCollapsed.addEventListener('change', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      mqlMin.removeEventListener('change', handleResize);
      mqlMax.removeEventListener('change', handleResize);
      mqlSplit.removeEventListener('change', handleResize);
      mqlCollapsed.removeEventListener('change', handleResize);
    };
  }, [handleResize]);

  const mode = getTabletLayoutMode(width);
  const config = getTabletLayoutConfig(width);
  const isTablet = isTabletWidth(width);

  return { width, isTablet, mode, config };
}
