import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  detectDeviceType,
  getLayoutPreset,
  useResponsiveLayout,
  LAYOUT_PRESETS,
  BREAKPOINTS,
} from '../responsive-presets';
import type { DeviceType, LayoutPreset } from '../responsive-presets';

// ---------------------------------------------------------------------------
// detectDeviceType
// ---------------------------------------------------------------------------

describe('detectDeviceType', () => {
  it('returns "phone" for width 0', () => {
    expect(detectDeviceType(0)).toBe('phone');
  });

  it('returns "phone" for width 320', () => {
    expect(detectDeviceType(320)).toBe('phone');
  });

  it('returns "phone" for width 479 (just below tablet breakpoint)', () => {
    expect(detectDeviceType(479)).toBe('phone');
  });

  it('returns "tablet" at exactly 480', () => {
    expect(detectDeviceType(480)).toBe('tablet');
  });

  it('returns "tablet" for width 768', () => {
    expect(detectDeviceType(768)).toBe('tablet');
  });

  it('returns "tablet" for width 1023 (just below laptop breakpoint)', () => {
    expect(detectDeviceType(1023)).toBe('tablet');
  });

  it('returns "laptop" at exactly 1024', () => {
    expect(detectDeviceType(1024)).toBe('laptop');
  });

  it('returns "laptop" for width 1366', () => {
    expect(detectDeviceType(1366)).toBe('laptop');
  });

  it('returns "laptop" for width 1439 (just below desktop breakpoint)', () => {
    expect(detectDeviceType(1439)).toBe('laptop');
  });

  it('returns "desktop" at exactly 1440', () => {
    expect(detectDeviceType(1440)).toBe('desktop');
  });

  it('returns "desktop" for width 1920', () => {
    expect(detectDeviceType(1920)).toBe('desktop');
  });

  it('returns "desktop" for width 2559 (just below ultrawide breakpoint)', () => {
    expect(detectDeviceType(2559)).toBe('desktop');
  });

  it('returns "ultrawide" at exactly 2560', () => {
    expect(detectDeviceType(2560)).toBe('ultrawide');
  });

  it('returns "ultrawide" for width 3840 (4K)', () => {
    expect(detectDeviceType(3840)).toBe('ultrawide');
  });

  it('returns "ultrawide" for very large widths', () => {
    expect(detectDeviceType(7680)).toBe('ultrawide');
  });
});

// ---------------------------------------------------------------------------
// LAYOUT_PRESETS structure
// ---------------------------------------------------------------------------

describe('LAYOUT_PRESETS', () => {
  const allDevices: DeviceType[] = ['phone', 'tablet', 'laptop', 'desktop', 'ultrawide'];

  it('contains a preset for every DeviceType', () => {
    for (const device of allDevices) {
      expect(LAYOUT_PRESETS[device]).toBeDefined();
      expect(LAYOUT_PRESETS[device].device).toBe(device);
    }
  });

  it('phone preset hides both sidebar and chat', () => {
    const p = LAYOUT_PRESETS.phone;
    expect(p.showSidebar).toBe(false);
    expect(p.showChat).toBe(false);
    expect(p.sidebarWidth).toBe(0);
    expect(p.chatPanelWidth).toBe(0);
    expect(p.columnCount).toBe(1);
  });

  it('tablet preset shows sidebar but hides chat', () => {
    const p = LAYOUT_PRESETS.tablet;
    expect(p.showSidebar).toBe(true);
    expect(p.showChat).toBe(false);
    expect(p.sidebarWidth).toBeGreaterThan(0);
    expect(p.chatPanelWidth).toBe(0);
    expect(p.columnCount).toBe(2);
  });

  it('laptop preset shows both sidebar and chat', () => {
    const p = LAYOUT_PRESETS.laptop;
    expect(p.showSidebar).toBe(true);
    expect(p.showChat).toBe(true);
    expect(p.sidebarWidth).toBeGreaterThan(0);
    expect(p.chatPanelWidth).toBeGreaterThan(0);
    expect(p.columnCount).toBe(3);
  });

  it('desktop preset has wider panels than laptop', () => {
    const laptop = LAYOUT_PRESETS.laptop;
    const desktop = LAYOUT_PRESETS.desktop;
    expect(desktop.sidebarWidth).toBeGreaterThan(laptop.sidebarWidth);
    expect(desktop.chatPanelWidth).toBeGreaterThan(laptop.chatPanelWidth);
    expect(desktop.columnCount).toBeGreaterThan(laptop.columnCount);
  });

  it('ultrawide preset has the widest panels', () => {
    const desktop = LAYOUT_PRESETS.desktop;
    const ultrawide = LAYOUT_PRESETS.ultrawide;
    expect(ultrawide.sidebarWidth).toBeGreaterThan(desktop.sidebarWidth);
    expect(ultrawide.chatPanelWidth).toBeGreaterThan(desktop.chatPanelWidth);
    expect(ultrawide.columnCount).toBeGreaterThan(desktop.columnCount);
  });

  it('sidebar width increases monotonically across tiers that show it', () => {
    const widths = allDevices.map((d) => LAYOUT_PRESETS[d].sidebarWidth);
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThanOrEqual(widths[i - 1]);
    }
  });

  it('chat panel width increases monotonically across tiers that show it', () => {
    const widths = allDevices.map((d) => LAYOUT_PRESETS[d].chatPanelWidth);
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThanOrEqual(widths[i - 1]);
    }
  });

  it('column count increases monotonically', () => {
    const counts = allDevices.map((d) => LAYOUT_PRESETS[d].columnCount);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    }
  });

  it('every preset has mainContentFlex >= 1', () => {
    for (const device of allDevices) {
      expect(LAYOUT_PRESETS[device].mainContentFlex).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// BREAKPOINTS
// ---------------------------------------------------------------------------

describe('BREAKPOINTS', () => {
  it('phone < tablet < laptop < desktop', () => {
    expect(BREAKPOINTS.phone).toBeLessThan(BREAKPOINTS.tablet);
    expect(BREAKPOINTS.tablet).toBeLessThan(BREAKPOINTS.laptop);
    expect(BREAKPOINTS.laptop).toBeLessThan(BREAKPOINTS.desktop);
  });

  it('has expected values', () => {
    expect(BREAKPOINTS.phone).toBe(480);
    expect(BREAKPOINTS.tablet).toBe(1024);
    expect(BREAKPOINTS.laptop).toBe(1440);
    expect(BREAKPOINTS.desktop).toBe(2560);
  });
});

// ---------------------------------------------------------------------------
// getLayoutPreset
// ---------------------------------------------------------------------------

describe('getLayoutPreset', () => {
  it('returns the phone preset for narrow widths', () => {
    const preset = getLayoutPreset(375);
    expect(preset.device).toBe('phone');
    expect(preset).toEqual(LAYOUT_PRESETS.phone);
  });

  it('returns the tablet preset for mid-range widths', () => {
    const preset = getLayoutPreset(768);
    expect(preset.device).toBe('tablet');
    expect(preset).toEqual(LAYOUT_PRESETS.tablet);
  });

  it('returns the laptop preset for common laptop widths', () => {
    const preset = getLayoutPreset(1366);
    expect(preset.device).toBe('laptop');
    expect(preset).toEqual(LAYOUT_PRESETS.laptop);
  });

  it('returns the desktop preset for 1920px', () => {
    const preset = getLayoutPreset(1920);
    expect(preset.device).toBe('desktop');
    expect(preset).toEqual(LAYOUT_PRESETS.desktop);
  });

  it('returns the ultrawide preset for 3440px', () => {
    const preset = getLayoutPreset(3440);
    expect(preset.device).toBe('ultrawide');
    expect(preset).toEqual(LAYOUT_PRESETS.ultrawide);
  });

  it('returns a valid LayoutPreset shape for any positive width', () => {
    const widths = [1, 100, 480, 1024, 1440, 2560, 5000];
    for (const w of widths) {
      const preset: LayoutPreset = getLayoutPreset(w);
      expect(preset.device).toBeTruthy();
      expect(typeof preset.sidebarWidth).toBe('number');
      expect(typeof preset.chatPanelWidth).toBe('number');
      expect(typeof preset.mainContentFlex).toBe('number');
      expect(typeof preset.showSidebar).toBe('boolean');
      expect(typeof preset.showChat).toBe('boolean');
      expect(typeof preset.columnCount).toBe('number');
    }
  });
});

// ---------------------------------------------------------------------------
// useResponsiveLayout hook
// ---------------------------------------------------------------------------

describe('useResponsiveLayout', () => {
  let originalInnerWidth: number;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  function setWindowWidth(width: number): void {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
  }

  it('returns the correct preset for the initial window width', () => {
    setWindowWidth(1920);
    const { result } = renderHook(() => useResponsiveLayout());
    expect(result.current.deviceType).toBe('desktop');
    expect(result.current.preset).toEqual(LAYOUT_PRESETS.desktop);
    expect(result.current.width).toBe(1920);
  });

  it('returns phone preset for narrow initial width', () => {
    setWindowWidth(375);
    const { result } = renderHook(() => useResponsiveLayout());
    expect(result.current.deviceType).toBe('phone');
    expect(result.current.preset.showSidebar).toBe(false);
    expect(result.current.preset.showChat).toBe(false);
  });

  it('updates when window is resized', () => {
    setWindowWidth(1920);
    const { result } = renderHook(() => useResponsiveLayout());
    expect(result.current.deviceType).toBe('desktop');

    act(() => {
      setWindowWidth(375);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.deviceType).toBe('phone');
    expect(result.current.width).toBe(375);
  });

  it('transitions through multiple device tiers on resize', () => {
    setWindowWidth(375);
    const { result } = renderHook(() => useResponsiveLayout());
    expect(result.current.deviceType).toBe('phone');

    act(() => {
      setWindowWidth(768);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.deviceType).toBe('tablet');

    act(() => {
      setWindowWidth(1366);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.deviceType).toBe('laptop');

    act(() => {
      setWindowWidth(2560);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.deviceType).toBe('ultrawide');
  });

  it('cleans up resize listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    setWindowWidth(1024);
    const { unmount } = renderHook(() => useResponsiveLayout());

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('exposes the raw width value', () => {
    setWindowWidth(1234);
    const { result } = renderHook(() => useResponsiveLayout());
    expect(result.current.width).toBe(1234);
  });
});
