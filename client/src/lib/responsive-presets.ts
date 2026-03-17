/**
 * Responsive Layout Presets
 *
 * Provides device-aware layout configuration for ProtoPulse's 3-panel
 * workspace (Sidebar | Main Content | Chat Panel). Each device type maps to
 * a LayoutPreset that defines sidebar/chat widths, visibility, and grid
 * column count so the workspace can adapt fluidly.
 *
 * Usage:
 *   const preset = getLayoutPreset(window.innerWidth);
 *   // or inside a component:
 *   const { preset, deviceType } = useResponsiveLayout();
 */

import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Canonical device size categories. */
export type DeviceType = 'phone' | 'tablet' | 'laptop' | 'desktop' | 'ultrawide';

/** Layout configuration for a specific device type. */
export interface LayoutPreset {
  /** Which device class this preset targets. */
  device: DeviceType;
  /** Sidebar width in pixels (0 when hidden). */
  sidebarWidth: number;
  /** Chat panel width in pixels (0 when hidden). */
  chatPanelWidth: number;
  /** CSS flex value for the main content area. */
  mainContentFlex: number;
  /** Whether the sidebar should be visible by default. */
  showSidebar: boolean;
  /** Whether the chat panel should be visible by default. */
  showChat: boolean;
  /** Number of columns for grid-based content within the main area. */
  columnCount: number;
}

// ---------------------------------------------------------------------------
// Breakpoints (upper-bound exclusive)
// ---------------------------------------------------------------------------

/**
 * Width breakpoints (in px) for each device tier.
 *
 * phone:     0   – 479
 * tablet:    480 – 1023
 * laptop:    1024 – 1439
 * desktop:   1440 – 2559
 * ultrawide: 2560+
 */
export const BREAKPOINTS = {
  phone: 480,
  tablet: 1024,
  laptop: 1440,
  desktop: 2560,
} as const;

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/** Default layout presets for each device tier. */
export const LAYOUT_PRESETS: Record<DeviceType, LayoutPreset> = {
  phone: {
    device: 'phone',
    sidebarWidth: 0,
    chatPanelWidth: 0,
    mainContentFlex: 1,
    showSidebar: false,
    showChat: false,
    columnCount: 1,
  },
  tablet: {
    device: 'tablet',
    sidebarWidth: 200,
    chatPanelWidth: 0,
    mainContentFlex: 1,
    showSidebar: true,
    showChat: false,
    columnCount: 2,
  },
  laptop: {
    device: 'laptop',
    sidebarWidth: 240,
    chatPanelWidth: 320,
    mainContentFlex: 1,
    showSidebar: true,
    showChat: true,
    columnCount: 3,
  },
  desktop: {
    device: 'desktop',
    sidebarWidth: 280,
    chatPanelWidth: 380,
    mainContentFlex: 1,
    showSidebar: true,
    showChat: true,
    columnCount: 4,
  },
  ultrawide: {
    device: 'ultrawide',
    sidebarWidth: 320,
    chatPanelWidth: 420,
    mainContentFlex: 1,
    showSidebar: true,
    showChat: true,
    columnCount: 5,
  },
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Map a viewport width (px) to a DeviceType. */
export function detectDeviceType(width: number): DeviceType {
  if (width < BREAKPOINTS.phone) {
    return 'phone';
  }
  if (width < BREAKPOINTS.tablet) {
    return 'tablet';
  }
  if (width < BREAKPOINTS.laptop) {
    return 'laptop';
  }
  if (width < BREAKPOINTS.desktop) {
    return 'desktop';
  }
  return 'ultrawide';
}

/** Get the LayoutPreset for the given viewport width. */
export function getLayoutPreset(width: number): LayoutPreset {
  return LAYOUT_PRESETS[detectDeviceType(width)];
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/** Return value of {@link useResponsiveLayout}. */
export interface ResponsiveLayoutResult {
  /** The resolved layout preset for the current window width. */
  preset: LayoutPreset;
  /** The detected device type. */
  deviceType: DeviceType;
  /** Current window inner width in pixels. */
  width: number;
}

/**
 * React hook that tracks window width and returns the corresponding
 * LayoutPreset and DeviceType. Re-renders only when the device tier
 * actually changes (not on every pixel of resize).
 */
export function useResponsiveLayout(): ResponsiveLayoutResult {
  const [width, setWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : BREAKPOINTS.laptop,
  );

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    // Sync on mount in case SSR default differs from actual width
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const deviceType = detectDeviceType(width);
  const preset = LAYOUT_PRESETS[deviceType];

  return { preset, deviceType, width };
}
