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
});
