import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  MIN_TAP_TARGET_PX,
  DEFAULT_SPACING_PX,
  DEFAULT_CONFIG,
  isTouchDevice,
  getTouchSafeClasses,
  validateTapTargets,
  useCompactMode,
} from '../touch-safe-controls';
import type {
  TouchSafeConfig,
  TouchSafeElement,
  TapTargetAudit,
} from '../touch-safe-controls';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    get length() {
      return store.size;
    },
    key: vi.fn((_index: number) => null),
  };
}

// ---------------------------------------------------------------------------
// Helper: create a container with mock elements and bounding rects
// ---------------------------------------------------------------------------

interface MockElementOpts {
  tag: string;
  width: number;
  height: number;
  role?: string;
  href?: string;
  tabIndex?: number;
}

function createMockContainer(elements: MockElementOpts[]): Element {
  const container = document.createElement('div');

  for (const opts of elements) {
    const el = document.createElement(opts.tag);

    if (opts.href !== undefined) {
      el.setAttribute('href', opts.href);
    }
    if (opts.role !== undefined) {
      el.setAttribute('role', opts.role);
    }
    if (opts.tabIndex !== undefined) {
      el.setAttribute('tabindex', String(opts.tabIndex));
    }

    // Override getBoundingClientRect for this element
    el.getBoundingClientRect = () =>
      ({
        width: opts.width,
        height: opts.height,
        top: 0,
        left: 0,
        bottom: opts.height,
        right: opts.width,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    container.appendChild(el);
  }

  return container;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('Constants', () => {
  it('MIN_TAP_TARGET_PX is 44 per WCAG 2.5.8', () => {
    expect(MIN_TAP_TARGET_PX).toBe(44);
  });

  it('DEFAULT_SPACING_PX is 8', () => {
    expect(DEFAULT_SPACING_PX).toBe(8);
  });

  it('DEFAULT_CONFIG has correct values', () => {
    expect(DEFAULT_CONFIG.minTapTarget).toBe(44);
    expect(DEFAULT_CONFIG.spacing).toBe(8);
    expect(DEFAULT_CONFIG.compactMultiplier).toBe(0.75);
  });

  it('DEFAULT_CONFIG is frozen (readonly)', () => {
    expect(Object.isFrozen(DEFAULT_CONFIG)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isTouchDevice
// ---------------------------------------------------------------------------

describe('isTouchDevice', () => {
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;

  afterEach(() => {
    // Restore originals
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  it('returns true when maxTouchPoints > 0', () => {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
    });
    expect(isTouchDevice()).toBe(true);
  });

  it('returns true when ontouchstart is in window', () => {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 0,
      configurable: true,
    });
    Object.defineProperty(window, 'ontouchstart', {
      value: null,
      configurable: true,
    });
    expect(isTouchDevice()).toBe(true);
  });

  it('returns true when pointer: coarse media query matches', () => {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 0,
      configurable: true,
    });
    // Remove ontouchstart if present
    if ('ontouchstart' in window) {
      delete (window as Record<string, unknown>)['ontouchstart'];
    }
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    expect(isTouchDevice()).toBe(true);
    window.matchMedia = originalMatchMedia;
  });

  it('returns false when no touch indicators are present', () => {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 0,
      configurable: true,
    });
    if ('ontouchstart' in window) {
      delete (window as Record<string, unknown>)['ontouchstart'];
    }
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    expect(isTouchDevice()).toBe(false);
    window.matchMedia = originalMatchMedia;
  });
});

// ---------------------------------------------------------------------------
// getTouchSafeClasses
// ---------------------------------------------------------------------------

describe('getTouchSafeClasses', () => {
  it('returns classes for button with default config', () => {
    const classes = getTouchSafeClasses('button');
    expect(classes).toContain('min-w-[44px]');
    expect(classes).toContain('min-h-[44px]');
    expect(classes).toContain('gap-[8px]');
    expect(classes).toContain('touch-manipulation');
    expect(classes).toContain('inline-flex');
    expect(classes).toContain('items-center');
    expect(classes).toContain('justify-center');
    expect(classes).toContain('px-3');
    expect(classes).toContain('py-2');
  });

  it('returns classes for input', () => {
    const classes = getTouchSafeClasses('input');
    expect(classes).toContain('min-w-[44px]');
    expect(classes).toContain('min-h-[44px]');
    expect(classes).toContain('px-3');
    expect(classes).toContain('py-2');
    expect(classes).toContain('touch-manipulation');
    // input should NOT have inline-flex
    expect(classes).not.toContain('inline-flex');
  });

  it('returns classes for link', () => {
    const classes = getTouchSafeClasses('link');
    expect(classes).toContain('min-w-[44px]');
    expect(classes).toContain('min-h-[44px]');
    expect(classes).toContain('underline-offset-4');
    expect(classes).toContain('inline-flex');
    expect(classes).toContain('touch-manipulation');
  });

  it('returns classes for icon', () => {
    const classes = getTouchSafeClasses('icon');
    expect(classes).toContain('min-w-[44px]');
    expect(classes).toContain('min-h-[44px]');
    expect(classes).toContain('p-2');
    expect(classes).toContain('inline-flex');
    expect(classes).toContain('justify-center');
    expect(classes).toContain('touch-manipulation');
  });

  it('applies compact multiplier when compact is true', () => {
    const classes = getTouchSafeClasses('button', { compact: true });
    // 44 * 0.75 = 33
    expect(classes).toContain('min-w-[33px]');
    expect(classes).toContain('min-h-[33px]');
  });

  it('uses custom config values', () => {
    const classes = getTouchSafeClasses('button', {
      config: { minTapTarget: 48, spacing: 12 },
    });
    expect(classes).toContain('min-w-[48px]');
    expect(classes).toContain('min-h-[48px]');
    expect(classes).toContain('gap-[12px]');
  });

  it('applies custom compact multiplier', () => {
    const classes = getTouchSafeClasses('icon', {
      compact: true,
      config: { compactMultiplier: 0.5, minTapTarget: 48 },
    });
    // 48 * 0.5 = 24
    expect(classes).toContain('min-w-[24px]');
    expect(classes).toContain('min-h-[24px]');
  });

  it('rounds to nearest pixel when multiplier produces fractional value', () => {
    const classes = getTouchSafeClasses('button', {
      compact: true,
      config: { compactMultiplier: 0.3, minTapTarget: 44 },
    });
    // 44 * 0.3 = 13.2 → 13
    expect(classes).toContain('min-w-[13px]');
    expect(classes).toContain('min-h-[13px]');
  });

  it('does not apply multiplier when compact is false', () => {
    const classes = getTouchSafeClasses('button', { compact: false });
    expect(classes).toContain('min-w-[44px]');
    expect(classes).toContain('min-h-[44px]');
  });

  it('does not apply multiplier when compact is undefined', () => {
    const classes = getTouchSafeClasses('button', {});
    expect(classes).toContain('min-w-[44px]');
    expect(classes).toContain('min-h-[44px]');
  });
});

// ---------------------------------------------------------------------------
// validateTapTargets
// ---------------------------------------------------------------------------

describe('validateTapTargets', () => {
  it('returns zero violations for compliant container', () => {
    const container = createMockContainer([
      { tag: 'button', width: 44, height: 44 },
      { tag: 'a', width: 100, height: 50, href: '/page' },
    ]);

    const result: TapTargetAudit = validateTapTargets(container);
    expect(result.violations).toHaveLength(0);
    expect(result.passes).toBe(2);
    expect(result.total).toBe(2);
  });

  it('detects undersized button (width)', () => {
    const container = createMockContainer([
      { tag: 'button', width: 30, height: 44 },
    ]);

    const result = validateTapTargets(container);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].width).toBe(30);
    expect(result.violations[0].reason).toContain('width 30px < 44px');
  });

  it('detects undersized button (height)', () => {
    const container = createMockContainer([
      { tag: 'button', width: 44, height: 20 },
    ]);

    const result = validateTapTargets(container);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].height).toBe(20);
    expect(result.violations[0].reason).toContain('height 20px < 44px');
  });

  it('reports both width and height violations in a single element', () => {
    const container = createMockContainer([
      { tag: 'button', width: 20, height: 20 },
    ]);

    const result = validateTapTargets(container);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].reason).toContain('width 20px < 44px');
    expect(result.violations[0].reason).toContain('height 20px < 44px');
  });

  it('skips invisible elements (zero dimensions)', () => {
    const container = createMockContainer([
      { tag: 'button', width: 0, height: 0 },
    ]);

    const result = validateTapTargets(container);
    expect(result.violations).toHaveLength(0);
    expect(result.passes).toBe(0);
    expect(result.total).toBe(0);
  });

  it('audits role="button" elements', () => {
    const container = createMockContainer([
      { tag: 'div', width: 20, height: 20, role: 'button' },
    ]);

    const result = validateTapTargets(container);
    expect(result.violations).toHaveLength(1);
  });

  it('audits role="checkbox" elements', () => {
    const container = createMockContainer([
      { tag: 'div', width: 16, height: 16, role: 'checkbox' },
    ]);

    const result = validateTapTargets(container);
    expect(result.violations).toHaveLength(1);
  });

  it('audits role="radio" elements', () => {
    const container = createMockContainer([
      { tag: 'span', width: 12, height: 12, role: 'radio' },
    ]);

    const result = validateTapTargets(container);
    expect(result.violations).toHaveLength(1);
  });

  it('audits role="tab" elements', () => {
    const container = createMockContainer([
      { tag: 'div', width: 80, height: 30, role: 'tab' },
    ]);

    const result = validateTapTargets(container);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].reason).toContain('height 30px < 44px');
  });

  it('audits tabindex elements (excluding tabindex=-1)', () => {
    const container = createMockContainer([
      { tag: 'div', width: 20, height: 20, tabIndex: 0 },
    ]);

    const result = validateTapTargets(container);
    expect(result.violations).toHaveLength(1);
  });

  it('ignores non-interactive elements', () => {
    const container = createMockContainer([
      { tag: 'div', width: 10, height: 10 },
      { tag: 'span', width: 10, height: 10 },
      { tag: 'p', width: 10, height: 10 },
    ]);

    const result = validateTapTargets(container);
    expect(result.total).toBe(0);
  });

  it('audits input elements', () => {
    const container = createMockContainer([
      { tag: 'input', width: 200, height: 30 },
    ]);

    const result = validateTapTargets(container);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].reason).toContain('height 30px < 44px');
  });

  it('audits select elements', () => {
    const container = createMockContainer([
      { tag: 'select', width: 100, height: 44 },
    ]);

    const result = validateTapTargets(container);
    expect(result.passes).toBe(1);
    expect(result.violations).toHaveLength(0);
  });

  it('audits textarea elements', () => {
    const container = createMockContainer([
      { tag: 'textarea', width: 200, height: 100 },
    ]);

    const result = validateTapTargets(container);
    expect(result.passes).toBe(1);
  });

  it('uses custom minTapTarget when provided', () => {
    const container = createMockContainer([
      { tag: 'button', width: 44, height: 44 },
    ]);

    // With a 48px requirement, 44px buttons should fail
    const result = validateTapTargets(container, { minTapTarget: 48 });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].reason).toContain('width 44px < 48px');
  });

  it('handles mixed passing and failing elements', () => {
    const container = createMockContainer([
      { tag: 'button', width: 50, height: 50 },
      { tag: 'button', width: 30, height: 30 },
      { tag: 'a', width: 100, height: 44, href: '/ok' },
      { tag: 'input', width: 200, height: 20 },
    ]);

    const result = validateTapTargets(container);
    expect(result.passes).toBe(2);
    expect(result.violations).toHaveLength(2);
    expect(result.total).toBe(4);
  });

  it('preserves element reference in violation', () => {
    const container = createMockContainer([
      { tag: 'button', width: 10, height: 10 },
    ]);

    const result = validateTapTargets(container);
    expect(result.violations[0].element).toBeInstanceOf(HTMLButtonElement);
  });

  it('handles empty container', () => {
    const container = document.createElement('div');
    const result = validateTapTargets(container);
    expect(result.violations).toHaveLength(0);
    expect(result.passes).toBe(0);
    expect(result.total).toBe(0);
  });

  it('audits role="link" elements', () => {
    const container = createMockContainer([
      { tag: 'span', width: 40, height: 40, role: 'link' },
    ]);

    const result = validateTapTargets(container);
    expect(result.violations).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// useCompactMode
// ---------------------------------------------------------------------------

describe('useCompactMode', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  });

  it('defaults to false when localStorage is empty', () => {
    const { result } = renderHook(() => useCompactMode());
    expect(result.current.compactMode).toBe(false);
  });

  it('reads initial value from localStorage', () => {
    mockStorage.setItem('protopulse-compact-mode', 'true');
    const { result } = renderHook(() => useCompactMode());
    expect(result.current.compactMode).toBe(true);
  });

  it('toggleCompactMode flips the value', () => {
    const { result } = renderHook(() => useCompactMode());
    expect(result.current.compactMode).toBe(false);

    act(() => {
      result.current.toggleCompactMode();
    });
    expect(result.current.compactMode).toBe(true);

    act(() => {
      result.current.toggleCompactMode();
    });
    expect(result.current.compactMode).toBe(false);
  });

  it('setCompactMode sets explicit value', () => {
    const { result } = renderHook(() => useCompactMode());

    act(() => {
      result.current.setCompactMode(true);
    });
    expect(result.current.compactMode).toBe(true);

    act(() => {
      result.current.setCompactMode(false);
    });
    expect(result.current.compactMode).toBe(false);
  });

  it('persists to localStorage on change', () => {
    const { result } = renderHook(() => useCompactMode());

    act(() => {
      result.current.toggleCompactMode();
    });

    expect(mockStorage.setItem).toHaveBeenCalledWith('protopulse-compact-mode', 'true');
  });

  it('responds to cross-tab storage events', () => {
    const { result } = renderHook(() => useCompactMode());
    expect(result.current.compactMode).toBe(false);

    act(() => {
      const event = new StorageEvent('storage', {
        key: 'protopulse-compact-mode',
        newValue: 'true',
      });
      window.dispatchEvent(event);
    });

    expect(result.current.compactMode).toBe(true);
  });

  it('ignores storage events for other keys', () => {
    const { result } = renderHook(() => useCompactMode());

    act(() => {
      const event = new StorageEvent('storage', {
        key: 'some-other-key',
        newValue: 'true',
      });
      window.dispatchEvent(event);
    });

    expect(result.current.compactMode).toBe(false);
  });

  it('handles localStorage getItem throwing', () => {
    const throwingStorage = {
      ...createMockLocalStorage(),
      getItem: vi.fn(() => {
        throw new Error('SecurityError');
      }),
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: throwingStorage,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useCompactMode());
    expect(result.current.compactMode).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Type exports (compile-time verification)
// ---------------------------------------------------------------------------

describe('Type exports', () => {
  it('TouchSafeConfig type is usable', () => {
    const config: TouchSafeConfig = {
      minTapTarget: 44,
      spacing: 8,
      compactMultiplier: 0.75,
    };
    expect(config.minTapTarget).toBe(44);
  });

  it('TouchSafeElement accepts all valid values', () => {
    const elements: TouchSafeElement[] = ['button', 'input', 'link', 'icon'];
    expect(elements).toHaveLength(4);
    // Ensure each produces valid classes
    for (const el of elements) {
      expect(getTouchSafeClasses(el)).toContain('touch-manipulation');
    }
  });

  it('TapTargetAudit structure is correct', () => {
    const audit: TapTargetAudit = {
      violations: [],
      passes: 5,
      total: 5,
    };
    expect(audit.total).toBe(audit.passes + audit.violations.length);
  });
});
