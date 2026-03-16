import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  FontScaleManager,
  useFontScale,
  isValidScale,
  FONT_SCALES,
  STORAGE_KEY,
  VALID_SCALES,
} from '../font-scaling';
import type { FontScale } from '../font-scaling';

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

describe('FontScaleManager', () => {
  let manager: FontScaleManager;
  let mockStorage: Storage;
  let setPropertySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty');

    FontScaleManager.resetInstance();
    manager = FontScaleManager.getInstance();
  });

  afterEach(() => {
    FontScaleManager.resetInstance();
    setPropertySpy.mockRestore();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  it('returns the same instance on repeated calls', () => {
    const a = FontScaleManager.getInstance();
    const b = FontScaleManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetInstance', () => {
    manager.setScale('large');
    FontScaleManager.resetInstance();
    const fresh = FontScaleManager.getInstance();
    expect(fresh).not.toBe(manager);
  });

  // -----------------------------------------------------------------------
  // Default state
  // -----------------------------------------------------------------------

  it('defaults to "default" scale when no localStorage value exists', () => {
    expect(manager.getScale()).toBe('default');
  });

  it('applies default CSS properties on construction', () => {
    expect(setPropertySpy).toHaveBeenCalledWith('--app-font-size', FONT_SCALES['default'].fontSize);
    expect(setPropertySpy).toHaveBeenCalledWith('--app-line-height', FONT_SCALES['default'].lineHeight);
    expect(setPropertySpy).toHaveBeenCalledWith('--app-spacing', FONT_SCALES['default'].spacing);
  });

  // -----------------------------------------------------------------------
  // setScale
  // -----------------------------------------------------------------------

  it('changes scale and applies CSS custom properties', () => {
    manager.setScale('large');
    expect(manager.getScale()).toBe('large');
    expect(setPropertySpy).toHaveBeenCalledWith('--app-font-size', FONT_SCALES['large'].fontSize);
    expect(setPropertySpy).toHaveBeenCalledWith('--app-line-height', FONT_SCALES['large'].lineHeight);
    expect(setPropertySpy).toHaveBeenCalledWith('--app-spacing', FONT_SCALES['large'].spacing);
  });

  it('persists scale to localStorage on setScale', () => {
    manager.setScale('compact');
    expect(mockStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'compact');
  });

  it('is a no-op when setting the same scale', () => {
    const subscriber = vi.fn();
    manager.subscribe(subscriber);
    manager.setScale('default');
    expect(subscriber).not.toHaveBeenCalled();
  });

  it('ignores invalid scale values', () => {
    manager.setScale('invalid-scale' as FontScale);
    expect(manager.getScale()).toBe('default');
  });

  it('sets compact scale correctly', () => {
    manager.setScale('compact');
    expect(manager.getScale()).toBe('compact');
    expect(manager.getConfig()).toEqual(FONT_SCALES['compact']);
  });

  it('sets extra-large scale correctly', () => {
    manager.setScale('extra-large');
    expect(manager.getScale()).toBe('extra-large');
    expect(manager.getConfig()).toEqual(FONT_SCALES['extra-large']);
  });

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  it('getConfig returns the config for the current scale', () => {
    manager.setScale('large');
    expect(manager.getConfig()).toEqual(FONT_SCALES['large']);
  });

  it('getConfigFor returns config for a specific scale', () => {
    expect(manager.getConfigFor('compact')).toEqual(FONT_SCALES['compact']);
    expect(manager.getConfigFor('extra-large')).toEqual(FONT_SCALES['extra-large']);
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  it('notifies subscribers when scale changes', () => {
    const subscriber = vi.fn();
    manager.subscribe(subscriber);
    manager.setScale('large');
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it('does not notify subscribers for same-scale no-op', () => {
    const subscriber = vi.fn();
    manager.subscribe(subscriber);
    manager.setScale('default');
    expect(subscriber).not.toHaveBeenCalled();
  });

  it('unsubscribe prevents further notifications', () => {
    const subscriber = vi.fn();
    const unsubscribe = manager.subscribe(subscriber);
    unsubscribe();
    manager.setScale('large');
    expect(subscriber).not.toHaveBeenCalled();
  });

  it('supports multiple subscribers', () => {
    const sub1 = vi.fn();
    const sub2 = vi.fn();
    manager.subscribe(sub1);
    manager.subscribe(sub2);
    manager.setScale('compact');
    expect(sub1).toHaveBeenCalledTimes(1);
    expect(sub2).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  it('restores scale from localStorage on construction', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('large');
    FontScaleManager.resetInstance();
    const restored = FontScaleManager.getInstance();
    expect(restored.getScale()).toBe('large');
  });

  it('ignores invalid localStorage values and defaults to "default"', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('bogus');
    FontScaleManager.resetInstance();
    const restored = FontScaleManager.getInstance();
    expect(restored.getScale()).toBe('default');
  });

  it('handles localStorage.getItem throwing', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('denied');
    });
    FontScaleManager.resetInstance();
    const restored = FontScaleManager.getInstance();
    expect(restored.getScale()).toBe('default');
  });

  it('handles localStorage.setItem throwing gracefully', () => {
    (mockStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => {
      manager.setScale('large');
    }).not.toThrow();
    expect(manager.getScale()).toBe('large');
  });
});

// ---------------------------------------------------------------------------
// isValidScale
// ---------------------------------------------------------------------------

describe('isValidScale', () => {
  it('returns true for all valid scales', () => {
    expect(isValidScale('compact')).toBe(true);
    expect(isValidScale('default')).toBe(true);
    expect(isValidScale('large')).toBe(true);
    expect(isValidScale('extra-large')).toBe(true);
  });

  it('returns false for invalid strings', () => {
    expect(isValidScale('small')).toBe(false);
    expect(isValidScale('')).toBe(false);
    expect(isValidScale('huge')).toBe(false);
    expect(isValidScale('DEFAULT')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FONT_SCALES config integrity
// ---------------------------------------------------------------------------

describe('FONT_SCALES', () => {
  it('has exactly 4 scales', () => {
    expect(Object.keys(FONT_SCALES)).toHaveLength(4);
  });

  it('every scale has all required fields', () => {
    for (const scale of VALID_SCALES) {
      const config = FONT_SCALES[scale];
      expect(config.fontSize).toBeDefined();
      expect(config.lineHeight).toBeDefined();
      expect(config.spacing).toBeDefined();
      expect(config.label).toBeDefined();
      expect(typeof config.fontSize).toBe('string');
      expect(typeof config.lineHeight).toBe('string');
      expect(typeof config.spacing).toBe('string');
      expect(typeof config.label).toBe('string');
    }
  });

  it('font sizes increase from compact to extra-large', () => {
    const sizes = VALID_SCALES.map((s) => parseFloat(FONT_SCALES[s].fontSize));
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
    }
  });

  it('line heights increase from compact to extra-large', () => {
    const heights = VALID_SCALES.map((s) => parseFloat(FONT_SCALES[s].lineHeight));
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]).toBeGreaterThan(heights[i - 1]);
    }
  });

  it('spacing increases from compact to extra-large', () => {
    const spacing = VALID_SCALES.map((s) => parseFloat(FONT_SCALES[s].spacing));
    for (let i = 1; i < spacing.length; i++) {
      expect(spacing[i]).toBeGreaterThan(spacing[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// useFontScale hook
// ---------------------------------------------------------------------------

describe('useFontScale', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    FontScaleManager.resetInstance();
  });

  afterEach(() => {
    FontScaleManager.resetInstance();
  });

  it('returns the current scale', () => {
    const { result } = renderHook(() => useFontScale());
    expect(result.current.scale).toBe('default');
  });

  it('returns the current config', () => {
    const { result } = renderHook(() => useFontScale());
    expect(result.current.config).toEqual(FONT_SCALES['default']);
  });

  it('returns all available scales', () => {
    const { result } = renderHook(() => useFontScale());
    expect(result.current.allScales).toEqual(VALID_SCALES);
  });

  it('updates when setScale is called', () => {
    const { result } = renderHook(() => useFontScale());
    act(() => {
      result.current.setScale('large');
    });
    expect(result.current.scale).toBe('large');
    expect(result.current.config).toEqual(FONT_SCALES['large']);
  });

  it('re-renders when manager scale changes externally', () => {
    const { result } = renderHook(() => useFontScale());
    act(() => {
      FontScaleManager.getInstance().setScale('compact');
    });
    expect(result.current.scale).toBe('compact');
  });
});
