import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  classifyGpuTier,
  shouldUseBackdropBlur,
  detectGpuTier,
  getWebGlRendererInfo,
  GpuPerformanceProvider,
  useGpuPerformance,
  conditionalBlur,
  isBackdropBlurEnabled,
  _resetCache,
  useOptimizedBlur,
  BLUR_FALLBACK_CLASS,
} from '../gpu-performance';
import type { GpuTier } from '../gpu-performance';

// ---------------------------------------------------------------------------
// classifyGpuTier
// ---------------------------------------------------------------------------

describe('classifyGpuTier', () => {
  it('returns "unknown" for empty renderer string', () => {
    expect(classifyGpuTier('')).toBe('unknown');
  });

  it.each([
    ['Google SwiftShader', 'low'],
    ['llvmpipe (LLVM 14.0.0, 256 bits)', 'low'],
    ['Mesa Software Rasterizer', 'low'],
    ['Microsoft Basic Render Driver', 'low'],
    ['VirtualBox Graphics Adapter', 'low'],
    ['VMware SVGA 3D', 'low'],
    ['Intel(R) HD Graphics', 'low'],
    ['Intel GMA 3150', 'low'],
    ['Mali-400 MP', 'low'],
    ['Mali-T720', 'low'],
    ['Adreno (TM) 320', 'low'],
    ['PowerVR SGX 544', 'low'],
    ['VideoCore IV', 'low'],
    ['virgl', 'low'],
  ] as [string, GpuTier][])('classifies "%s" as %s', (renderer, expected) => {
    expect(classifyGpuTier(renderer)).toBe(expected);
  });

  it.each([
    ['NVIDIA GeForce RTX 4090', 'high'],
    ['NVIDIA GeForce GTX 1660 Ti', 'high'],
    ['NVIDIA Quadro RTX 5000', 'high'],
    ['AMD Radeon RX 7900 XTX', 'high'],
    ['Radeon Pro W6800', 'high'],
    ['Apple M2 GPU', 'high'],
    ['Apple GPU', 'high'],
    ['Intel Arc A770', 'high'],
    ['Intel Iris Xe Graphics', 'high'],
    ['Intel Iris Plus Graphics', 'high'],
    ['Mali-G78', 'high'],
    ['Adreno (TM) 730', 'high'],
    ['Samsung Xclipse 920', 'high'],
    ['Arm Immortalis-G715', 'high'],
  ] as [string, GpuTier][])('classifies "%s" as %s', (renderer, expected) => {
    expect(classifyGpuTier(renderer)).toBe(expected);
  });

  it.each([
    ['NVIDIA GeForce GTX 1050', 'mid'],
    ['AMD Radeon RX 580', 'mid'],
    ['Some Unknown GPU', 'mid'],
    ['Intel UHD Graphics 750', 'mid'],
  ] as [string, GpuTier][])('classifies "%s" as mid tier', (renderer, expected) => {
    expect(classifyGpuTier(renderer)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// shouldUseBackdropBlur
// ---------------------------------------------------------------------------

describe('shouldUseBackdropBlur', () => {
  it('returns true for high tier', () => {
    expect(shouldUseBackdropBlur('high')).toBe(true);
  });

  it('returns true for mid tier', () => {
    expect(shouldUseBackdropBlur('mid')).toBe(true);
  });

  it('returns false for low tier', () => {
    expect(shouldUseBackdropBlur('low')).toBe(false);
  });

  it('returns true for unknown tier', () => {
    expect(shouldUseBackdropBlur('unknown')).toBe(true);
  });

  it('respects user override true even on low tier', () => {
    expect(shouldUseBackdropBlur('low', true)).toBe(true);
  });

  it('respects user override false even on high tier', () => {
    expect(shouldUseBackdropBlur('high', false)).toBe(false);
  });

  it('uses auto-detect when override is null', () => {
    expect(shouldUseBackdropBlur('low', null)).toBe(false);
    expect(shouldUseBackdropBlur('high', null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getWebGlRendererInfo — non-browser fallback
// ---------------------------------------------------------------------------

describe('getWebGlRendererInfo', () => {
  it('returns empty strings when document.createElement throws', () => {
    const origCreate = document.createElement;
    document.createElement = vi.fn(() => {
      throw new Error('no canvas');
    });
    const result = getWebGlRendererInfo();
    expect(result).toEqual({ renderer: '', vendor: '' });
    document.createElement = origCreate;
  });

  it('returns empty strings when getContext returns null', () => {
    const origCreate = document.createElement;
    document.createElement = vi.fn(() => ({
      getContext: () => null,
    })) as unknown as typeof document.createElement;
    const result = getWebGlRendererInfo();
    expect(result).toEqual({ renderer: '', vendor: '' });
    document.createElement = origCreate;
  });

  it('returns unmasked renderer when debug extension is available', () => {
    const mockExt = {
      UNMASKED_RENDERER_WEBGL: 0x9246,
      UNMASKED_VENDOR_WEBGL: 0x9245,
    };
    const mockGl = {
      getExtension: vi.fn((name: string) => (name === 'WEBGL_debug_renderer_info' ? mockExt : null)),
      getParameter: vi.fn((param: number) => {
        if (param === 0x9246) { return 'NVIDIA GeForce RTX 4090'; }
        if (param === 0x9245) { return 'NVIDIA Corporation'; }
        return '';
      }),
      RENDERER: 0x1f01,
      VENDOR: 0x1f00,
    };
    const origCreate = document.createElement;
    document.createElement = vi.fn(() => ({
      getContext: () => mockGl,
    })) as unknown as typeof document.createElement;

    const result = getWebGlRendererInfo();
    expect(result.renderer).toBe('NVIDIA GeForce RTX 4090');
    expect(result.vendor).toBe('NVIDIA Corporation');

    document.createElement = origCreate;
  });

  it('falls back to masked renderer when debug extension is unavailable', () => {
    const mockGl = {
      getExtension: vi.fn(() => null),
      getParameter: vi.fn((param: number) => {
        if (param === 0x1f01) { return 'WebKit WebGL'; }
        if (param === 0x1f00) { return 'WebKit'; }
        return '';
      }),
      RENDERER: 0x1f01,
      VENDOR: 0x1f00,
    };
    const origCreate = document.createElement;
    document.createElement = vi.fn(() => ({
      getContext: () => mockGl,
    })) as unknown as typeof document.createElement;

    const result = getWebGlRendererInfo();
    expect(result.renderer).toBe('WebKit WebGL');
    expect(result.vendor).toBe('WebKit');

    document.createElement = origCreate;
  });
});

// ---------------------------------------------------------------------------
// detectGpuTier — integration of getWebGlRendererInfo + classifyGpuTier
// ---------------------------------------------------------------------------

describe('detectGpuTier', () => {
  it('returns tier with renderer and vendor', () => {
    const mockGl = {
      getExtension: vi.fn(() => ({
        UNMASKED_RENDERER_WEBGL: 0x9246,
        UNMASKED_VENDOR_WEBGL: 0x9245,
      })),
      getParameter: vi.fn((param: number) => {
        if (param === 0x9246) { return 'Google SwiftShader'; }
        if (param === 0x9245) { return 'Google Inc.'; }
        return '';
      }),
      RENDERER: 0x1f01,
      VENDOR: 0x1f00,
    };
    const origCreate = document.createElement;
    document.createElement = vi.fn(() => ({
      getContext: () => mockGl,
    })) as unknown as typeof document.createElement;

    const result = detectGpuTier();
    expect(result.tier).toBe('low');
    expect(result.renderer).toBe('Google SwiftShader');
    expect(result.vendor).toBe('Google Inc.');

    document.createElement = origCreate;
  });
});

// ---------------------------------------------------------------------------
// conditionalBlur / isBackdropBlurEnabled (standalone utils)
// ---------------------------------------------------------------------------

describe('conditionalBlur', () => {
  beforeEach(() => {
    _resetCache();
    localStorage.removeItem('protopulse-gpu-blur-override');
  });

  afterEach(() => {
    _resetCache();
  });

  it('returns blur class when GPU is not low-end', () => {
    // Mock a mid-tier GPU (default when canvas context is null in happy-dom)
    const result = conditionalBlur('backdrop-blur-xl');
    // In happy-dom, getContext('webgl') returns null → renderer '' → unknown → blur enabled
    expect(result).toBe('backdrop-blur-xl');
  });

  it('returns empty string when user override is false', () => {
    localStorage.setItem('protopulse-gpu-blur-override', 'false');
    _resetCache();
    const result = conditionalBlur();
    expect(result).toBe('');
  });

  it('uses default variant when none specified', () => {
    const result = conditionalBlur();
    expect(result).toBe('backdrop-blur-xl');
  });
});

// ---------------------------------------------------------------------------
// GpuPerformanceProvider + useGpuPerformance hook
// ---------------------------------------------------------------------------

function TestConsumer() {
  const { info, setBlurOverride, blurClass } = useGpuPerformance();
  return (
    <div>
      <span data-testid="tier">{info.tier}</span>
      <span data-testid="blur-enabled">{String(info.useBackdropBlur)}</span>
      <span data-testid="blur-class">{blurClass('backdrop-blur-sm')}</span>
      <span data-testid="override">{String(info.userOverride)}</span>
      <button data-testid="disable-blur" onClick={() => setBlurOverride(false)}>Disable</button>
      <button data-testid="enable-blur" onClick={() => setBlurOverride(true)}>Enable</button>
      <button data-testid="reset-blur" onClick={() => setBlurOverride(null)}>Reset</button>
    </div>
  );
}

describe('GpuPerformanceProvider + useGpuPerformance', () => {
  beforeEach(() => {
    localStorage.removeItem('protopulse-gpu-blur-override');
  });

  it('provides GPU tier info to consumers', () => {
    render(
      <GpuPerformanceProvider>
        <TestConsumer />
      </GpuPerformanceProvider>,
    );
    // In happy-dom, WebGL is unavailable → renderer '' → unknown tier
    expect(screen.getByTestId('tier').textContent).toBe('unknown');
    expect(screen.getByTestId('blur-enabled').textContent).toBe('true');
  });

  it('blurClass returns the variant when blur is enabled', () => {
    render(
      <GpuPerformanceProvider>
        <TestConsumer />
      </GpuPerformanceProvider>,
    );
    expect(screen.getByTestId('blur-class').textContent).toBe('backdrop-blur-sm');
  });

  it('allows user to disable blur via override', async () => {
    const user = userEvent.setup();
    render(
      <GpuPerformanceProvider>
        <TestConsumer />
      </GpuPerformanceProvider>,
    );

    expect(screen.getByTestId('blur-enabled').textContent).toBe('true');

    await act(async () => {
      await user.click(screen.getByTestId('disable-blur'));
    });

    expect(screen.getByTestId('blur-enabled').textContent).toBe('false');
    expect(screen.getByTestId('override').textContent).toBe('false');
    expect(screen.getByTestId('blur-class').textContent).toBe('');
    expect(localStorage.getItem('protopulse-gpu-blur-override')).toBe('false');
  });

  it('allows user to re-enable blur via override', async () => {
    const user = userEvent.setup();
    render(
      <GpuPerformanceProvider>
        <TestConsumer />
      </GpuPerformanceProvider>,
    );

    await act(async () => {
      await user.click(screen.getByTestId('disable-blur'));
    });
    expect(screen.getByTestId('blur-enabled').textContent).toBe('false');

    await act(async () => {
      await user.click(screen.getByTestId('enable-blur'));
    });
    expect(screen.getByTestId('blur-enabled').textContent).toBe('true');
    expect(localStorage.getItem('protopulse-gpu-blur-override')).toBe('true');
  });

  it('allows user to reset to auto-detect', async () => {
    const user = userEvent.setup();
    render(
      <GpuPerformanceProvider>
        <TestConsumer />
      </GpuPerformanceProvider>,
    );

    await act(async () => {
      await user.click(screen.getByTestId('disable-blur'));
    });

    await act(async () => {
      await user.click(screen.getByTestId('reset-blur'));
    });
    expect(screen.getByTestId('override').textContent).toBe('null');
    expect(screen.getByTestId('blur-enabled').textContent).toBe('true');
    expect(localStorage.getItem('protopulse-gpu-blur-override')).toBeNull();
  });

  it('loads persisted override from localStorage on mount', () => {
    localStorage.setItem('protopulse-gpu-blur-override', 'false');
    render(
      <GpuPerformanceProvider>
        <TestConsumer />
      </GpuPerformanceProvider>,
    );
    expect(screen.getByTestId('blur-enabled').textContent).toBe('false');
    expect(screen.getByTestId('override').textContent).toBe('false');
  });

  it('throws when useGpuPerformance is used outside provider', () => {
    // Suppress React error boundary console noise
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow('useGpuPerformance must be used within GpuPerformanceProvider');
    spy.mockRestore();
  });

  it('adds reduce-blur CSS class to documentElement when blur is disabled', async () => {
    const user = userEvent.setup();
    document.documentElement.classList.remove('reduce-blur');

    render(
      <GpuPerformanceProvider>
        <TestConsumer />
      </GpuPerformanceProvider>,
    );

    // Initially blur enabled → no reduce-blur class
    expect(document.documentElement.classList.contains('reduce-blur')).toBe(false);

    await act(async () => {
      await user.click(screen.getByTestId('disable-blur'));
    });

    // After disabling → reduce-blur class added
    expect(document.documentElement.classList.contains('reduce-blur')).toBe(true);
  });

  it('removes reduce-blur CSS class when blur is re-enabled', async () => {
    const user = userEvent.setup();
    document.documentElement.classList.remove('reduce-blur');

    render(
      <GpuPerformanceProvider>
        <TestConsumer />
      </GpuPerformanceProvider>,
    );

    await act(async () => {
      await user.click(screen.getByTestId('disable-blur'));
    });
    expect(document.documentElement.classList.contains('reduce-blur')).toBe(true);

    await act(async () => {
      await user.click(screen.getByTestId('enable-blur'));
    });
    expect(document.documentElement.classList.contains('reduce-blur')).toBe(false);
  });

  it('applies reduce-blur class eagerly when localStorage override is false', () => {
    document.documentElement.classList.remove('reduce-blur');
    localStorage.setItem('protopulse-gpu-blur-override', 'false');

    render(
      <GpuPerformanceProvider>
        <TestConsumer />
      </GpuPerformanceProvider>,
    );

    expect(document.documentElement.classList.contains('reduce-blur')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BLUR_FALLBACK_CLASS constant
// ---------------------------------------------------------------------------

describe('BLUR_FALLBACK_CLASS', () => {
  it('is a non-empty string', () => {
    expect(typeof BLUR_FALLBACK_CLASS).toBe('string');
    expect(BLUR_FALLBACK_CLASS.length).toBeGreaterThan(0);
  });

  it('is bg-black/90', () => {
    expect(BLUR_FALLBACK_CLASS).toBe('bg-black/90');
  });

  it('does not contain backdrop-blur', () => {
    expect(BLUR_FALLBACK_CLASS).not.toContain('backdrop-blur');
  });
});

// ---------------------------------------------------------------------------
// useOptimizedBlur hook
// ---------------------------------------------------------------------------

/** Test consumer for useOptimizedBlur with configurable params */
function BlurConsumer({
  blurClass,
  fallbackClass,
}: {
  blurClass?: string;
  fallbackClass?: string;
}) {
  const result = useOptimizedBlur(blurClass, fallbackClass);
  return (
    <div>
      <span data-testid="opt-class">{result.className}</span>
      <span data-testid="opt-enabled">{String(result.isBlurEnabled)}</span>
      <span data-testid="opt-reason">{result.reason ?? 'none'}</span>
    </div>
  );
}

describe('useOptimizedBlur', () => {
  let origMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    _resetCache();
    localStorage.removeItem('protopulse-gpu-blur-override');
    document.documentElement.classList.remove('reduced-motion');
    document.documentElement.classList.remove('reduce-blur');
    origMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    _resetCache();
    document.documentElement.classList.remove('reduced-motion');
    document.documentElement.classList.remove('reduce-blur');
    window.matchMedia = origMatchMedia;
  });

  // ---- Within GpuPerformanceProvider (capable GPU) ----

  it('returns blur class when inside provider and GPU is capable', () => {
    // In happy-dom: WebGL unavailable → unknown tier → blur enabled
    render(
      <GpuPerformanceProvider>
        <BlurConsumer />
      </GpuPerformanceProvider>,
    );
    expect(screen.getByTestId('opt-enabled').textContent).toBe('true');
    expect(screen.getByTestId('opt-class').textContent).toContain('backdrop-blur-xl');
    expect(screen.getByTestId('opt-class').textContent).toContain('blur-optimized');
    expect(screen.getByTestId('opt-reason').textContent).toBe('none');
  });

  it('includes blur-optimized performance class when blur is enabled', () => {
    render(
      <GpuPerformanceProvider>
        <BlurConsumer />
      </GpuPerformanceProvider>,
    );
    const className = screen.getByTestId('opt-class').textContent ?? '';
    expect(className).toContain('blur-optimized');
  });

  it('uses custom blur class when provided', () => {
    render(
      <GpuPerformanceProvider>
        <BlurConsumer blurClass="backdrop-blur-sm" />
      </GpuPerformanceProvider>,
    );
    expect(screen.getByTestId('opt-class').textContent).toContain('backdrop-blur-sm');
    expect(screen.getByTestId('opt-class').textContent).not.toContain('backdrop-blur-xl');
  });

  it('returns fallback when user override disables blur', async () => {
    localStorage.setItem('protopulse-gpu-blur-override', 'false');
    render(
      <GpuPerformanceProvider>
        <BlurConsumer />
      </GpuPerformanceProvider>,
    );
    expect(screen.getByTestId('opt-enabled').textContent).toBe('false');
    expect(screen.getByTestId('opt-class').textContent).toBe(BLUR_FALLBACK_CLASS);
    expect(screen.getByTestId('opt-reason').textContent).toBe('user-override');
  });

  it('uses custom fallback class when provided', () => {
    localStorage.setItem('protopulse-gpu-blur-override', 'false');
    render(
      <GpuPerformanceProvider>
        <BlurConsumer fallbackClass="bg-gray-900/95" />
      </GpuPerformanceProvider>,
    );
    expect(screen.getByTestId('opt-class').textContent).toBe('bg-gray-900/95');
  });

  // ---- Reduced motion ----

  it('returns fallback when prefers-reduced-motion matches', () => {
    // Mock matchMedia to return true for reduced motion
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
      onchange: null,
    })) as unknown as typeof window.matchMedia;

    render(
      <GpuPerformanceProvider>
        <BlurConsumer />
      </GpuPerformanceProvider>,
    );

    expect(screen.getByTestId('opt-enabled').textContent).toBe('false');
    expect(screen.getByTestId('opt-class').textContent).toBe(BLUR_FALLBACK_CLASS);
    expect(screen.getByTestId('opt-reason').textContent).toBe('reduced-motion');
  });

  it('returns fallback when .reduced-motion class is on <html>', () => {
    document.documentElement.classList.add('reduced-motion');

    render(
      <GpuPerformanceProvider>
        <BlurConsumer />
      </GpuPerformanceProvider>,
    );

    expect(screen.getByTestId('opt-enabled').textContent).toBe('false');
    expect(screen.getByTestId('opt-reason').textContent).toBe('reduced-motion');
  });

  it('reduced motion takes priority over GPU capability', () => {
    // Even though GPU is capable (unknown tier = blur enabled),
    // reduced motion should win
    document.documentElement.classList.add('reduced-motion');

    render(
      <GpuPerformanceProvider>
        <BlurConsumer />
      </GpuPerformanceProvider>,
    );

    expect(screen.getByTestId('opt-enabled').textContent).toBe('false');
    expect(screen.getByTestId('opt-reason').textContent).toBe('reduced-motion');
  });

  it('reduced motion takes priority over user override true', () => {
    localStorage.setItem('protopulse-gpu-blur-override', 'true');
    document.documentElement.classList.add('reduced-motion');

    render(
      <GpuPerformanceProvider>
        <BlurConsumer />
      </GpuPerformanceProvider>,
    );

    expect(screen.getByTestId('opt-enabled').textContent).toBe('false');
    expect(screen.getByTestId('opt-reason').textContent).toBe('reduced-motion');
  });

  // ---- Outside GpuPerformanceProvider (standalone mode) ----

  it('works outside GpuPerformanceProvider using standalone detection', () => {
    // No provider → falls back to isBackdropBlurEnabled()
    // In happy-dom, WebGL unavailable → unknown tier → blur enabled
    render(<BlurConsumer />);

    expect(screen.getByTestId('opt-enabled').textContent).toBe('true');
    expect(screen.getByTestId('opt-class').textContent).toContain('backdrop-blur-xl');
    expect(screen.getByTestId('opt-class').textContent).toContain('blur-optimized');
    expect(screen.getByTestId('opt-reason').textContent).toBe('none');
  });

  it('standalone mode returns fallback when localStorage override is false', () => {
    localStorage.setItem('protopulse-gpu-blur-override', 'false');
    _resetCache();
    render(<BlurConsumer />);

    expect(screen.getByTestId('opt-enabled').textContent).toBe('false');
    expect(screen.getByTestId('opt-class').textContent).toBe(BLUR_FALLBACK_CLASS);
    expect(screen.getByTestId('opt-reason').textContent).toBe('low-gpu');
  });

  it('standalone mode respects reduced motion', () => {
    document.documentElement.classList.add('reduced-motion');
    render(<BlurConsumer />);

    expect(screen.getByTestId('opt-enabled').textContent).toBe('false');
    expect(screen.getByTestId('opt-reason').textContent).toBe('reduced-motion');
  });

  // ---- Default parameter values ----

  it('defaults blurClass to backdrop-blur-xl', () => {
    render(
      <GpuPerformanceProvider>
        <BlurConsumer />
      </GpuPerformanceProvider>,
    );
    expect(screen.getByTestId('opt-class').textContent).toContain('backdrop-blur-xl');
  });

  it('defaults fallbackClass to BLUR_FALLBACK_CLASS', () => {
    localStorage.setItem('protopulse-gpu-blur-override', 'false');
    render(
      <GpuPerformanceProvider>
        <BlurConsumer />
      </GpuPerformanceProvider>,
    );
    expect(screen.getByTestId('opt-class').textContent).toBe(BLUR_FALLBACK_CLASS);
  });

  // ---- reason field correctness ----

  it('reason is null when blur is enabled', () => {
    render(
      <GpuPerformanceProvider>
        <BlurConsumer />
      </GpuPerformanceProvider>,
    );
    expect(screen.getByTestId('opt-reason').textContent).toBe('none');
  });

  it('reason is "user-override" when user disabled blur via override', () => {
    localStorage.setItem('protopulse-gpu-blur-override', 'false');
    render(
      <GpuPerformanceProvider>
        <BlurConsumer />
      </GpuPerformanceProvider>,
    );
    expect(screen.getByTestId('opt-reason').textContent).toBe('user-override');
  });

  it('reason is "reduced-motion" when motion is reduced', () => {
    document.documentElement.classList.add('reduced-motion');
    render(
      <GpuPerformanceProvider>
        <BlurConsumer />
      </GpuPerformanceProvider>,
    );
    expect(screen.getByTestId('opt-reason').textContent).toBe('reduced-motion');
  });

  // ---- Dynamic state changes ----

  it('responds to user disabling blur via provider', async () => {
    const user = userEvent.setup();

    function Combined() {
      const { setBlurOverride } = useGpuPerformance();
      const { isBlurEnabled, reason } = useOptimizedBlur();
      return (
        <div>
          <span data-testid="dyn-enabled">{String(isBlurEnabled)}</span>
          <span data-testid="dyn-reason">{reason ?? 'none'}</span>
          <button data-testid="dyn-disable" onClick={() => setBlurOverride(false)}>Off</button>
        </div>
      );
    }

    render(
      <GpuPerformanceProvider>
        <Combined />
      </GpuPerformanceProvider>,
    );

    expect(screen.getByTestId('dyn-enabled').textContent).toBe('true');

    await act(async () => {
      await user.click(screen.getByTestId('dyn-disable'));
    });

    expect(screen.getByTestId('dyn-enabled').textContent).toBe('false');
    expect(screen.getByTestId('dyn-reason').textContent).toBe('user-override');
  });

  it('responds to user re-enabling blur via provider', async () => {
    const user = userEvent.setup();
    localStorage.setItem('protopulse-gpu-blur-override', 'false');

    function Combined() {
      const { setBlurOverride } = useGpuPerformance();
      const { isBlurEnabled } = useOptimizedBlur();
      return (
        <div>
          <span data-testid="dyn2-enabled">{String(isBlurEnabled)}</span>
          <button data-testid="dyn2-enable" onClick={() => setBlurOverride(true)}>On</button>
        </div>
      );
    }

    render(
      <GpuPerformanceProvider>
        <Combined />
      </GpuPerformanceProvider>,
    );

    expect(screen.getByTestId('dyn2-enabled').textContent).toBe('false');

    await act(async () => {
      await user.click(screen.getByTestId('dyn2-enable'));
    });

    expect(screen.getByTestId('dyn2-enabled').textContent).toBe('true');
  });

  // ---- Edge cases ----

  it('handles matchMedia not available gracefully', () => {
    const orig = window.matchMedia;
    (window as unknown as Record<string, unknown>).matchMedia = undefined;

    render(
      <GpuPerformanceProvider>
        <BlurConsumer />
      </GpuPerformanceProvider>,
    );

    // Should still work — fallback to not reduced motion → blur enabled
    expect(screen.getByTestId('opt-enabled').textContent).toBe('true');
    window.matchMedia = orig;
  });

  it('handles both reduced-motion class and matchMedia false gracefully', () => {
    window.matchMedia = vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
      onchange: null,
    })) as unknown as typeof window.matchMedia;

    document.documentElement.classList.add('reduced-motion');

    render(
      <GpuPerformanceProvider>
        <BlurConsumer />
      </GpuPerformanceProvider>,
    );

    // .reduced-motion class should still trigger the fallback
    expect(screen.getByTestId('opt-enabled').textContent).toBe('false');
    expect(screen.getByTestId('opt-reason').textContent).toBe('reduced-motion');
  });

  it('fallback class does not include blur-optimized', () => {
    localStorage.setItem('protopulse-gpu-blur-override', 'false');
    render(
      <GpuPerformanceProvider>
        <BlurConsumer />
      </GpuPerformanceProvider>,
    );
    expect(screen.getByTestId('opt-class').textContent).not.toContain('blur-optimized');
  });

  it('enabled class includes both blur variant and blur-optimized', () => {
    render(
      <GpuPerformanceProvider>
        <BlurConsumer blurClass="backdrop-blur-md" />
      </GpuPerformanceProvider>,
    );
    const cls = screen.getByTestId('opt-class').textContent ?? '';
    expect(cls).toContain('backdrop-blur-md');
    expect(cls).toContain('blur-optimized');
  });

  it('isBlurEnabled is boolean true when blur active', () => {
    render(
      <GpuPerformanceProvider>
        <BlurConsumer />
      </GpuPerformanceProvider>,
    );
    expect(screen.getByTestId('opt-enabled').textContent).toBe('true');
  });

  it('isBlurEnabled is boolean false when blur inactive', () => {
    document.documentElement.classList.add('reduced-motion');
    render(
      <GpuPerformanceProvider>
        <BlurConsumer />
      </GpuPerformanceProvider>,
    );
    expect(screen.getByTestId('opt-enabled').textContent).toBe('false');
  });

  it('does not crash when MutationObserver is unavailable', () => {
    const origMO = globalThis.MutationObserver;
    (globalThis as unknown as Record<string, unknown>).MutationObserver = undefined;

    render(
      <GpuPerformanceProvider>
        <BlurConsumer />
      </GpuPerformanceProvider>,
    );

    // Should render without error
    expect(screen.getByTestId('opt-enabled').textContent).toBe('true');
    globalThis.MutationObserver = origMO;
  });
});
