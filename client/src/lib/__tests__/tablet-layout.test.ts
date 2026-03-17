import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  TABLET_BREAKPOINT,
  SPLIT_MODE_THRESHOLD,
  COLLAPSED_MODE_THRESHOLD,
  DEFAULT_TABLET_CONFIG,
  isTabletWidth,
  getTabletLayoutMode,
  getTabletLayoutConfig,
  shouldShowInspectorOverlay,
  getContentWidth,
  useTabletLayout,
} from '../tablet-layout';
import type { TabletLayoutConfig, TabletLayoutMode } from '../tablet-layout';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simulate a viewport resize by setting innerWidth and firing the event. */
function simulateResize(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    writable: true,
    configurable: true,
  });
  window.dispatchEvent(new Event('resize'));
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('TabletBreakpoint', () => {
  it('defines min as 768', () => {
    expect(TABLET_BREAKPOINT.min).toBe(768);
  });

  it('defines max as 1024', () => {
    expect(TABLET_BREAKPOINT.max).toBe(1024);
  });

  it('has min less than max', () => {
    expect(TABLET_BREAKPOINT.min).toBeLessThan(TABLET_BREAKPOINT.max);
  });
});

describe('DEFAULT_TABLET_CONFIG', () => {
  it('has sidebarWidth of 240', () => {
    expect(DEFAULT_TABLET_CONFIG.sidebarWidth).toBe(240);
  });

  it('has inspectorWidth of 280', () => {
    expect(DEFAULT_TABLET_CONFIG.inspectorWidth).toBe(280);
  });

  it('has mode set to split', () => {
    expect(DEFAULT_TABLET_CONFIG.mode).toBe('split');
  });
});

// ---------------------------------------------------------------------------
// isTabletWidth
// ---------------------------------------------------------------------------

describe('isTabletWidth', () => {
  it('returns false for width below tablet range', () => {
    expect(isTabletWidth(767)).toBe(false);
  });

  it('returns true at the minimum boundary (768)', () => {
    expect(isTabletWidth(768)).toBe(true);
  });

  it('returns true for a mid-range tablet width (900)', () => {
    expect(isTabletWidth(900)).toBe(true);
  });

  it('returns true at the maximum boundary (1024)', () => {
    expect(isTabletWidth(1024)).toBe(true);
  });

  it('returns false for width above tablet range', () => {
    expect(isTabletWidth(1025)).toBe(false);
  });

  it('returns false for zero width', () => {
    expect(isTabletWidth(0)).toBe(false);
  });

  it('returns false for negative width', () => {
    expect(isTabletWidth(-100)).toBe(false);
  });

  it('returns false for very large width', () => {
    expect(isTabletWidth(2560)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getTabletLayoutMode
// ---------------------------------------------------------------------------

describe('getTabletLayoutMode', () => {
  it('returns collapsed for width below COLLAPSED_MODE_THRESHOLD', () => {
    expect(getTabletLayoutMode(799)).toBe('collapsed');
  });

  it('returns overlay at exactly COLLAPSED_MODE_THRESHOLD (800)', () => {
    expect(getTabletLayoutMode(800)).toBe('overlay');
  });

  it('returns overlay for width between collapsed and split thresholds', () => {
    expect(getTabletLayoutMode(850)).toBe('overlay');
  });

  it('returns overlay at 899 (just below split threshold)', () => {
    expect(getTabletLayoutMode(899)).toBe('overlay');
  });

  it('returns split at exactly SPLIT_MODE_THRESHOLD (900)', () => {
    expect(getTabletLayoutMode(900)).toBe('split');
  });

  it('returns split for width above split threshold', () => {
    expect(getTabletLayoutMode(1024)).toBe('split');
  });

  it('returns collapsed for zero width', () => {
    expect(getTabletLayoutMode(0)).toBe('collapsed');
  });

  it('returns split for desktop-class width', () => {
    expect(getTabletLayoutMode(1920)).toBe('split');
  });

  it('returns collapsed for mobile width', () => {
    expect(getTabletLayoutMode(375)).toBe('collapsed');
  });
});

// ---------------------------------------------------------------------------
// getTabletLayoutConfig
// ---------------------------------------------------------------------------

describe('getTabletLayoutConfig', () => {
  it('returns split config for width >= 900', () => {
    const config = getTabletLayoutConfig(950);
    expect(config.mode).toBe('split');
    expect(config.sidebarWidth).toBe(240);
    expect(config.inspectorWidth).toBe(280);
  });

  it('returns overlay config for width in [800, 900)', () => {
    const config = getTabletLayoutConfig(850);
    expect(config.mode).toBe('overlay');
    expect(config.sidebarWidth).toBe(200);
    expect(config.inspectorWidth).toBe(260);
  });

  it('returns collapsed config for width < 800', () => {
    const config = getTabletLayoutConfig(750);
    expect(config.mode).toBe('collapsed');
    expect(config.sidebarWidth).toBe(56);
    expect(config.inspectorWidth).toBe(0);
  });

  it('overlay config has narrower sidebar than split config', () => {
    const split = getTabletLayoutConfig(900);
    const overlay = getTabletLayoutConfig(850);
    expect(overlay.sidebarWidth).toBeLessThan(split.sidebarWidth);
  });

  it('collapsed config has zero inspector width', () => {
    const config = getTabletLayoutConfig(700);
    expect(config.inspectorWidth).toBe(0);
  });

  it('collapsed config has minimal sidebar width', () => {
    const config = getTabletLayoutConfig(700);
    expect(config.sidebarWidth).toBeLessThan(100);
  });

  it('returns consistent config at exact threshold boundaries', () => {
    const atCollapsed = getTabletLayoutConfig(COLLAPSED_MODE_THRESHOLD);
    expect(atCollapsed.mode).toBe('overlay');

    const atSplit = getTabletLayoutConfig(SPLIT_MODE_THRESHOLD);
    expect(atSplit.mode).toBe('split');
  });
});

// ---------------------------------------------------------------------------
// shouldShowInspectorOverlay
// ---------------------------------------------------------------------------

describe('shouldShowInspectorOverlay', () => {
  it('returns false below COLLAPSED_MODE_THRESHOLD', () => {
    expect(shouldShowInspectorOverlay(799)).toBe(false);
  });

  it('returns true at exactly COLLAPSED_MODE_THRESHOLD (800)', () => {
    expect(shouldShowInspectorOverlay(800)).toBe(true);
  });

  it('returns true for mid-overlay range (850)', () => {
    expect(shouldShowInspectorOverlay(850)).toBe(true);
  });

  it('returns true at 899 (just below split threshold)', () => {
    expect(shouldShowInspectorOverlay(899)).toBe(true);
  });

  it('returns false at exactly SPLIT_MODE_THRESHOLD (900)', () => {
    expect(shouldShowInspectorOverlay(900)).toBe(false);
  });

  it('returns false for desktop width', () => {
    expect(shouldShowInspectorOverlay(1440)).toBe(false);
  });

  it('returns false for mobile width', () => {
    expect(shouldShowInspectorOverlay(375)).toBe(false);
  });

  it('returns false for zero width', () => {
    expect(shouldShowInspectorOverlay(0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getContentWidth
// ---------------------------------------------------------------------------

describe('getContentWidth', () => {
  it('computes remaining width after sidebar and inspector', () => {
    const config: TabletLayoutConfig = { sidebarWidth: 240, inspectorWidth: 280, mode: 'split' };
    expect(getContentWidth(1024, config)).toBe(504);
  });

  it('returns zero when sidebar + inspector exceed viewport', () => {
    const config: TabletLayoutConfig = { sidebarWidth: 400, inspectorWidth: 400, mode: 'split' };
    expect(getContentWidth(500, config)).toBe(0);
  });

  it('never returns a negative value', () => {
    const config: TabletLayoutConfig = { sidebarWidth: 240, inspectorWidth: 280, mode: 'split' };
    expect(getContentWidth(100, config)).toBe(0);
  });

  it('handles collapsed config (zero inspector)', () => {
    const config: TabletLayoutConfig = { sidebarWidth: 56, inspectorWidth: 0, mode: 'collapsed' };
    expect(getContentWidth(768, config)).toBe(712);
  });

  it('handles overlay config', () => {
    const config: TabletLayoutConfig = { sidebarWidth: 200, inspectorWidth: 260, mode: 'overlay' };
    expect(getContentWidth(850, config)).toBe(390);
  });

  it('handles zero viewport width', () => {
    const config: TabletLayoutConfig = { sidebarWidth: 240, inspectorWidth: 280, mode: 'split' };
    expect(getContentWidth(0, config)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// useTabletLayout hook
// ---------------------------------------------------------------------------

describe('useTabletLayout', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    simulateResize(900);
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    });
  });

  it('returns the current window width', () => {
    simulateResize(950);
    const { result } = renderHook(() => useTabletLayout());
    expect(result.current.width).toBe(950);
  });

  it('returns isTablet true when within tablet range', () => {
    simulateResize(900);
    const { result } = renderHook(() => useTabletLayout());
    expect(result.current.isTablet).toBe(true);
  });

  it('returns isTablet false when below tablet range', () => {
    simulateResize(500);
    const { result } = renderHook(() => useTabletLayout());
    expect(result.current.isTablet).toBe(false);
  });

  it('returns isTablet false when above tablet range', () => {
    simulateResize(1440);
    const { result } = renderHook(() => useTabletLayout());
    expect(result.current.isTablet).toBe(false);
  });

  it('returns split mode for width >= 900', () => {
    simulateResize(1000);
    const { result } = renderHook(() => useTabletLayout());
    expect(result.current.mode).toBe('split');
  });

  it('returns overlay mode for width in [800, 900)', () => {
    simulateResize(850);
    const { result } = renderHook(() => useTabletLayout());
    expect(result.current.mode).toBe('overlay');
  });

  it('returns collapsed mode for width < 800', () => {
    simulateResize(750);
    const { result } = renderHook(() => useTabletLayout());
    expect(result.current.mode).toBe('collapsed');
  });

  it('returns config matching the current mode', () => {
    simulateResize(850);
    const { result } = renderHook(() => useTabletLayout());
    expect(result.current.config.mode).toBe('overlay');
    expect(result.current.config.sidebarWidth).toBe(200);
    expect(result.current.config.inspectorWidth).toBe(260);
  });

  it('updates mode when window resizes from split to overlay', () => {
    simulateResize(950);
    const { result } = renderHook(() => useTabletLayout());
    expect(result.current.mode).toBe('split');

    act(() => {
      simulateResize(850);
    });
    expect(result.current.mode).toBe('overlay');
  });

  it('updates mode when window resizes from overlay to collapsed', () => {
    simulateResize(850);
    const { result } = renderHook(() => useTabletLayout());
    expect(result.current.mode).toBe('overlay');

    act(() => {
      simulateResize(750);
    });
    expect(result.current.mode).toBe('collapsed');
  });

  it('updates width on resize', () => {
    simulateResize(900);
    const { result } = renderHook(() => useTabletLayout());
    expect(result.current.width).toBe(900);

    act(() => {
      simulateResize(1024);
    });
    expect(result.current.width).toBe(1024);
  });

  it('config updates when crossing the split threshold', () => {
    simulateResize(901);
    const { result } = renderHook(() => useTabletLayout());
    expect(result.current.config.sidebarWidth).toBe(240);

    act(() => {
      simulateResize(899);
    });
    expect(result.current.config.sidebarWidth).toBe(200);
  });

  it('cleans up event listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useTabletLayout());

    const resizeAddCalls = addSpy.mock.calls.filter(([event]) => event === 'resize');
    expect(resizeAddCalls.length).toBeGreaterThan(0);

    unmount();

    const resizeRemoveCalls = removeSpy.mock.calls.filter(([event]) => event === 'resize');
    expect(resizeRemoveCalls.length).toBeGreaterThan(0);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Integration: mode consistency across all functions
// ---------------------------------------------------------------------------

describe('mode consistency', () => {
  const testWidths = [375, 600, 768, 799, 800, 850, 899, 900, 950, 1024, 1025, 1440];

  it.each(testWidths)('getTabletLayoutConfig(%i).mode matches getTabletLayoutMode(%i)', (width) => {
    const mode = getTabletLayoutMode(width);
    const config = getTabletLayoutConfig(width);
    expect(config.mode).toBe(mode);
  });

  it.each(testWidths)(
    'shouldShowInspectorOverlay(%i) is true only when mode is overlay',
    (width) => {
      const mode = getTabletLayoutMode(width);
      const overlay = shouldShowInspectorOverlay(width);
      expect(overlay).toBe(mode === 'overlay');
    },
  );

  it('all three modes are reachable', () => {
    const modes = new Set<TabletLayoutMode>();
    for (const w of testWidths) {
      modes.add(getTabletLayoutMode(w));
    }
    expect(modes.has('split')).toBe(true);
    expect(modes.has('overlay')).toBe(true);
    expect(modes.has('collapsed')).toBe(true);
  });
});
