import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  EASING,
  MOTION_PRESETS,
  getTransitionCSS,
  shouldReduceMotion,
  useMotionPreference,
  resolveMotionConfig,
} from '../motion-language';
import type { TransitionType, MotionConfig } from '../motion-language';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Install a mock matchMedia that reports the given preference. */
function mockMatchMedia(prefersReducedMotion: boolean): {
  triggerChange: (matches: boolean) => void;
} {
  let currentListener: ((event: MediaQueryListEvent) => void) | null = null;

  const mql: MediaQueryList = {
    matches: prefersReducedMotion,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn((_event: string, cb: (event: MediaQueryListEvent) => void) => {
      currentListener = cb;
    }),
    removeEventListener: vi.fn((_event: string, _cb: (event: MediaQueryListEvent) => void) => {
      currentListener = null;
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  };

  window.matchMedia = vi.fn(() => mql);

  return {
    triggerChange(matches: boolean) {
      (mql as { matches: boolean }).matches = matches;
      if (currentListener) {
        currentListener({ matches } as MediaQueryListEvent);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EASING constants', () => {
  it('exposes all documented easing names', () => {
    expect(Object.keys(EASING)).toEqual(
      expect.arrayContaining(['easeOut', 'easeIn', 'easeInOut', 'spring', 'bounce', 'linear']),
    );
  });

  it('easeOut is a cubic-bezier string', () => {
    expect(EASING.easeOut).toMatch(/^cubic-bezier\(/);
  });

  it('easeIn is a cubic-bezier string', () => {
    expect(EASING.easeIn).toMatch(/^cubic-bezier\(/);
  });

  it('easeInOut is a cubic-bezier string', () => {
    expect(EASING.easeInOut).toMatch(/^cubic-bezier\(/);
  });

  it('spring has overshoot (last control point > 1)', () => {
    // cubic-bezier(0.175, 0.885, 0.32, 1.275) — y2 > 1 means overshoot
    const match = EASING.spring.match(/cubic-bezier\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1])).toBeGreaterThan(1);
  });

  it('bounce has overshoot', () => {
    const match = EASING.bounce.match(/cubic-bezier\(\s*[\d.]+\s*,\s*([\d.]+)\s*,\s*[\d.]+\s*,\s*[\d.]+\s*\)/);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1])).toBeGreaterThan(1);
  });

  it('linear is the string "linear"', () => {
    expect(EASING.linear).toBe('linear');
  });
});

describe('MOTION_PRESETS', () => {
  it('contains all four standard presets', () => {
    expect(Object.keys(MOTION_PRESETS)).toEqual(expect.arrayContaining(['subtle', 'standard', 'emphasized', 'dramatic']));
  });

  it('subtle has duration 150ms', () => {
    expect(MOTION_PRESETS['subtle'].duration).toBe(150);
  });

  it('standard has duration 200ms', () => {
    expect(MOTION_PRESETS['standard'].duration).toBe(200);
  });

  it('emphasized has duration 300ms', () => {
    expect(MOTION_PRESETS['emphasized'].duration).toBe(300);
  });

  it('dramatic has duration 500ms', () => {
    expect(MOTION_PRESETS['dramatic'].duration).toBe(500);
  });

  it('all presets have a reducedMotion fallback', () => {
    for (const [name, config] of Object.entries(MOTION_PRESETS)) {
      expect(config.reducedMotion).toBeDefined();
      expect(config.reducedMotion!.duration).toBe(0);
      expect(config.reducedMotion!.easing).toBe(EASING.linear);
    }
  });

  it('presets have increasing durations from subtle to dramatic', () => {
    const durations = ['subtle', 'standard', 'emphasized', 'dramatic'].map((k) => MOTION_PRESETS[k].duration);
    for (let i = 1; i < durations.length; i++) {
      expect(durations[i]).toBeGreaterThan(durations[i - 1]);
    }
  });

  it('each preset has a valid easing string', () => {
    for (const config of Object.values(MOTION_PRESETS)) {
      expect(typeof config.easing).toBe('string');
      expect(config.easing.length).toBeGreaterThan(0);
    }
  });
});

describe('resolveMotionConfig', () => {
  it('defaults to standard preset when called with no argument', () => {
    const config = resolveMotionConfig();
    expect(config).toEqual(MOTION_PRESETS['standard']);
  });

  it('defaults to standard preset when called with undefined', () => {
    const config = resolveMotionConfig(undefined);
    expect(config).toEqual(MOTION_PRESETS['standard']);
  });

  it('resolves a named preset string', () => {
    const config = resolveMotionConfig('emphasized');
    expect(config).toEqual(MOTION_PRESETS['emphasized']);
  });

  it('passes through an inline MotionConfig object', () => {
    const custom: MotionConfig = { duration: 999, easing: 'ease' };
    const config = resolveMotionConfig(custom);
    expect(config).toBe(custom);
  });

  it('throws for an unknown preset name', () => {
    expect(() => resolveMotionConfig('nonexistent')).toThrow(/Unknown motion preset.*nonexistent/);
  });

  it('error message lists available presets', () => {
    try {
      resolveMotionConfig('bogus');
    } catch (e: unknown) {
      const msg = (e as Error).message;
      expect(msg).toContain('subtle');
      expect(msg).toContain('standard');
      expect(msg).toContain('emphasized');
      expect(msg).toContain('dramatic');
    }
  });
});

describe('shouldReduceMotion', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('returns false when matchMedia reports no preference', () => {
    mockMatchMedia(false);
    expect(shouldReduceMotion()).toBe(false);
  });

  it('returns true when matchMedia reports reduced motion', () => {
    mockMatchMedia(true);
    expect(shouldReduceMotion()).toBe(true);
  });

  it('returns false when matchMedia is undefined', () => {
    // Simulate an environment without matchMedia (SSR).
    const descriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    Object.defineProperty(window, 'matchMedia', { value: undefined, writable: true, configurable: true });
    expect(shouldReduceMotion()).toBe(false);
    if (descriptor) {
      Object.defineProperty(window, 'matchMedia', descriptor);
    } else {
      window.matchMedia = originalMatchMedia;
    }
  });
});

describe('getTransitionCSS', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // Default: no reduced motion
    mockMatchMedia(false);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  // -----------------------------------------------------------------------
  // Basic output format
  // -----------------------------------------------------------------------

  it('returns a non-empty string', () => {
    const css = getTransitionCSS('enter');
    expect(css.length).toBeGreaterThan(0);
  });

  it('defaults to standard preset when no preset argument', () => {
    const css = getTransitionCSS('fade');
    expect(css).toContain(`${MOTION_PRESETS['standard'].duration}ms`);
    expect(css).toContain(MOTION_PRESETS['standard'].easing);
  });

  // -----------------------------------------------------------------------
  // TransitionType → property mapping
  // -----------------------------------------------------------------------

  it('enter transitions opacity and transform', () => {
    const css = getTransitionCSS('enter');
    expect(css).toContain('opacity');
    expect(css).toContain('transform');
  });

  it('exit transitions opacity and transform', () => {
    const css = getTransitionCSS('exit');
    expect(css).toContain('opacity');
    expect(css).toContain('transform');
  });

  it('move transitions only transform', () => {
    const css = getTransitionCSS('move');
    expect(css).toContain('transform');
    expect(css).not.toContain('opacity');
  });

  it('resize transitions width and height', () => {
    const css = getTransitionCSS('resize');
    expect(css).toContain('width');
    expect(css).toContain('height');
    expect(css).not.toContain('transform');
  });

  it('fade transitions only opacity', () => {
    const css = getTransitionCSS('fade');
    expect(css).toContain('opacity');
    expect(css).not.toContain('transform');
  });

  it('scale transitions only transform', () => {
    const css = getTransitionCSS('scale');
    expect(css).toContain('transform');
    expect(css).not.toContain('opacity');
  });

  // -----------------------------------------------------------------------
  // Preset selection
  // -----------------------------------------------------------------------

  it('uses subtle preset when requested', () => {
    const css = getTransitionCSS('fade', 'subtle');
    expect(css).toContain('150ms');
    expect(css).toContain(EASING.easeOut);
  });

  it('uses emphasized preset when requested', () => {
    const css = getTransitionCSS('enter', 'emphasized');
    expect(css).toContain('300ms');
    expect(css).toContain(EASING.spring);
  });

  it('uses dramatic preset when requested', () => {
    const css = getTransitionCSS('scale', 'dramatic');
    expect(css).toContain('500ms');
    expect(css).toContain(EASING.bounce);
  });

  // -----------------------------------------------------------------------
  // Inline MotionConfig
  // -----------------------------------------------------------------------

  it('accepts an inline MotionConfig object', () => {
    const css = getTransitionCSS('fade', { duration: 750, easing: 'ease-in-out' });
    expect(css).toContain('750ms');
    expect(css).toContain('ease-in-out');
  });

  it('includes delay from inline config', () => {
    const css = getTransitionCSS('move', { duration: 200, easing: EASING.easeOut, delay: 100 });
    expect(css).toContain('100ms');
  });

  it('defaults delay to 0ms when not specified', () => {
    const css = getTransitionCSS('fade', 'standard');
    expect(css).toContain('0ms');
  });

  // -----------------------------------------------------------------------
  // Reduced motion
  // -----------------------------------------------------------------------

  it('uses reduced-motion fallback when preference is active', () => {
    mockMatchMedia(true);
    const css = getTransitionCSS('enter', 'standard');
    // Should use 0ms duration and linear easing
    expect(css).toContain('0ms');
    expect(css).toContain(EASING.linear);
  });

  it('uses inline reducedMotion override', () => {
    mockMatchMedia(true);
    const css = getTransitionCSS('fade', {
      duration: 300,
      easing: EASING.spring,
      reducedMotion: { duration: 50, easing: 'ease' },
    });
    expect(css).toContain('50ms');
    expect(css).toContain('ease');
    expect(css).not.toContain('300ms');
  });

  it('falls back to 0ms/linear when inline config has no reducedMotion and preference is active', () => {
    mockMatchMedia(true);
    const css = getTransitionCSS('move', { duration: 400, easing: EASING.spring });
    expect(css).toContain('0ms');
    expect(css).toContain(EASING.linear);
  });

  // -----------------------------------------------------------------------
  // Error cases
  // -----------------------------------------------------------------------

  it('throws for unknown preset name', () => {
    expect(() => getTransitionCSS('fade', 'nonexistent')).toThrow(/Unknown motion preset/);
  });
});

describe('useMotionPreference', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('returns false when reduced motion is not preferred', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useMotionPreference());
    expect(result.current).toBe(false);
  });

  it('returns true when reduced motion is preferred', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMotionPreference());
    expect(result.current).toBe(true);
  });

  it('updates when the media query changes', () => {
    const { triggerChange } = mockMatchMedia(false);
    const { result } = renderHook(() => useMotionPreference());
    expect(result.current).toBe(false);

    act(() => {
      triggerChange(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      triggerChange(false);
    });
    expect(result.current).toBe(false);
  });

  it('cleans up the event listener on unmount', () => {
    mockMatchMedia(false);
    const { unmount } = renderHook(() => useMotionPreference());

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
