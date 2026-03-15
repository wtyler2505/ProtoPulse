/**
 * GPU Performance Detection — tier-based backdrop-blur gating for low-end devices.
 *
 * Uses WebGL renderer string heuristics to classify GPU capability.
 * Provides a React context + hook so components can conditionally apply
 * `backdrop-blur-*` classes (heavy compositing) or fall back to opaque backgrounds.
 *
 * BL-0275: backdrop-blur-xl GPU jank on low-end devices.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GpuTier = 'high' | 'mid' | 'low' | 'unknown';

export interface GpuPerformanceInfo {
  tier: GpuTier;
  renderer: string;
  vendor: string;
  /** Whether backdrop-blur should be applied (true for high/mid, false for low) */
  useBackdropBlur: boolean;
  /** User override — null means auto-detect */
  userOverride: boolean | null;
}

// ---------------------------------------------------------------------------
// Known GPU renderer patterns (case-insensitive substrings)
// ---------------------------------------------------------------------------

/** GPUs that are definitely low-end or software renderers */
const LOW_TIER_PATTERNS: RegExp[] = [
  /swiftshader/i,
  /llvmpipe/i,
  /softpipe/i,
  /software rasterizer/i,
  /mesa (software|swrast)/i,
  /microsoft basic render/i,
  /google swiftshader/i,
  /virtualbox/i,
  /vmware/i,
  /virgl/i,
  /intel (hd|uhd) graphics\s*$/i,           // bare "Intel HD Graphics" or "Intel UHD Graphics" (no model number)
  /intel\(r\) hd graphics\s*$/i,
  /intel gma/i,
  /mali-4\d\d/i,       // Mali-400 series
  /mali-t[67]\d\d/i,   // Mali-T600/T700 series
  /adreno\s*(?:\(TM\)\s*)?[23]\d\d/i,  // Adreno 2xx/3xx range (handles optional "(TM)")
  /powervr sgx/i,      // Old PowerVR
  /videocore/i,         // Raspberry Pi
];

/** GPUs that are high-end */
const HIGH_TIER_PATTERNS: RegExp[] = [
  /nvidia geforce (rtx|gtx\s*1[6-9]|gtx\s*[2-9]0)/i,
  /nvidia quadro rtx/i,
  /nvidia a\d{3,4}/i,       // Data center / pro GPUs
  /radeon rx [5-7]\d{3}/i,  // RX 5000+ series
  /radeon pro/i,
  /apple m[1-9]/i,          // Apple Silicon
  /apple gpu/i,
  /intel arc/i,             // Intel Arc discrete
  /intel iris xe/i,         // Modern Intel iGPU (good enough)
  /intel iris plus/i,       // 10th-gen Intel Iris Plus
  /mali-g[789]\d/i,         // Mali-G7x+ (modern ARM)
  /adreno\s*(?:\(TM\)\s*)?[67]\d\d/i,  // Adreno 6xx/7xx (handles optional "(TM)")
  /xclipse/i,               // Samsung Xclipse (RDNA2-based)
  /immortalis/i,            // Arm Immortalis
];

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Extracts the WebGL renderer and vendor strings via a throwaway canvas.
 * Returns empty strings if WebGL is unavailable.
 */
export function getWebGlRendererInfo(): { renderer: string; vendor: string } {
  if (typeof document === 'undefined') {
    return { renderer: '', vendor: '' };
  }

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    if (!gl) {
      return { renderer: '', vendor: '' };
    }

    const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugExt) {
      return {
        renderer: gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) as string ?? '',
        vendor: gl.getParameter(debugExt.UNMASKED_VENDOR_WEBGL) as string ?? '',
      };
    }

    // Fallback to masked (less useful but better than nothing)
    return {
      renderer: gl.getParameter(gl.RENDERER) as string ?? '',
      vendor: gl.getParameter(gl.VENDOR) as string ?? '',
    };
  } catch {
    return { renderer: '', vendor: '' };
  }
}

/**
 * Classify the GPU into a performance tier based on its renderer string.
 */
export function classifyGpuTier(renderer: string): GpuTier {
  if (!renderer) {
    return 'unknown';
  }

  // Check low-end first (software renderers, old integrated GPUs)
  for (const pattern of LOW_TIER_PATTERNS) {
    if (pattern.test(renderer)) {
      return 'low';
    }
  }

  // Check high-end
  for (const pattern of HIGH_TIER_PATTERNS) {
    if (pattern.test(renderer)) {
      return 'high';
    }
  }

  // Everything else (unrecognized discrete GPUs, mid-range integrated) → mid
  return 'mid';
}

/**
 * Full GPU tier detection: extracts WebGL info and classifies.
 */
export function detectGpuTier(): { tier: GpuTier; renderer: string; vendor: string } {
  const { renderer, vendor } = getWebGlRendererInfo();
  const tier = classifyGpuTier(renderer);
  return { tier, renderer, vendor };
}

/**
 * Determines whether backdrop-blur should be enabled.
 * Enabled for high/mid/unknown tiers, disabled for low.
 */
export function shouldUseBackdropBlur(tier: GpuTier, userOverride: boolean | null = null): boolean {
  if (userOverride !== null) {
    return userOverride;
  }
  return tier !== 'low';
}

// ---------------------------------------------------------------------------
// localStorage persistence for user override
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-gpu-blur-override';

function loadUserOverride(): boolean | null {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'true') { return true; }
    if (val === 'false') { return false; }
    return null;
  } catch {
    return null;
  }
}

function saveUserOverride(value: boolean | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, String(value));
    }
  } catch {
    // localStorage unavailable — ignore
  }
}

// ---------------------------------------------------------------------------
// React Context
// ---------------------------------------------------------------------------

interface GpuPerformanceContextValue {
  info: GpuPerformanceInfo;
  /** Force enable/disable backdrop-blur (null = auto-detect) */
  setBlurOverride: (value: boolean | null) => void;
  /** Convenience: returns the blur class if enabled, otherwise empty string */
  blurClass: (blurVariant?: string) => string;
}

const GpuPerformanceContext = createContext<GpuPerformanceContextValue | undefined>(undefined);

const REDUCE_BLUR_CLASS = 'reduce-blur';

/** Sync the `.reduce-blur` CSS class on `<html>` with the current blur state. */
function syncReduceBlurClass(useBlur: boolean): void {
  if (typeof document === 'undefined') { return; }
  const root = document.documentElement;
  if (useBlur) {
    root.classList.remove(REDUCE_BLUR_CLASS);
  } else {
    root.classList.add(REDUCE_BLUR_CLASS);
  }
}

export function GpuPerformanceProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<GpuPerformanceInfo>(() => {
    const userOverride = loadUserOverride();
    const { tier, renderer, vendor } = detectGpuTier();
    const useBlur = shouldUseBackdropBlur(tier, userOverride);
    // Apply CSS class eagerly during init
    syncReduceBlurClass(useBlur);
    return {
      tier,
      renderer,
      vendor,
      useBackdropBlur: useBlur,
      userOverride,
    };
  });

  // Keep CSS class in sync whenever useBackdropBlur changes
  useEffect(() => {
    syncReduceBlurClass(info.useBackdropBlur);
  }, [info.useBackdropBlur]);

  const setBlurOverride = useCallback((value: boolean | null) => {
    saveUserOverride(value);
    setInfo((prev) => ({
      ...prev,
      userOverride: value,
      useBackdropBlur: shouldUseBackdropBlur(prev.tier, value),
    }));
  }, []);

  const blurClass = useCallback((blurVariant = 'backdrop-blur-xl') => {
    return info.useBackdropBlur ? blurVariant : '';
  }, [info.useBackdropBlur]);

  return (
    <GpuPerformanceContext.Provider value={{ info, setBlurOverride, blurClass }}>
      {children}
    </GpuPerformanceContext.Provider>
  );
}

export function useGpuPerformance(): GpuPerformanceContextValue {
  const context = useContext(GpuPerformanceContext);
  if (!context) {
    throw new Error('useGpuPerformance must be used within GpuPerformanceProvider');
  }
  return context;
}

// ---------------------------------------------------------------------------
// Standalone utility for components that don't need the full context
// (e.g., deeply nested components where threading context is impractical)
// ---------------------------------------------------------------------------

let cachedTier: GpuTier | null = null;
let cachedOverride: boolean | null = null;

/**
 * Lightweight standalone blur check — no React context needed.
 * Caches the GPU tier on first call. Respects the localStorage override.
 */
export function isBackdropBlurEnabled(): boolean {
  if (cachedTier === null) {
    const { tier } = detectGpuTier();
    cachedTier = tier;
  }
  if (cachedOverride === null) {
    cachedOverride = loadUserOverride();
  }
  return shouldUseBackdropBlur(cachedTier, cachedOverride);
}

/**
 * Returns the blur class if blur is enabled, otherwise empty string.
 * Standalone version — no React context needed.
 */
export function conditionalBlur(blurVariant = 'backdrop-blur-xl'): string {
  return isBackdropBlurEnabled() ? blurVariant : '';
}

/** Reset cached values — for testing only */
export function _resetCache(): void {
  cachedTier = null;
  cachedOverride = null;
}
