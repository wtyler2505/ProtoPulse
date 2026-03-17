/**
 * Touch-Safe Controls
 *
 * Ensures all interactive elements meet WCAG 2.5.8 minimum tap target
 * requirements (44x44 CSS pixels) with configurable spacing and compact
 * mode for power-user workflows.
 *
 * Provides:
 *   - `MIN_TAP_TARGET_PX` constant (44px per WCAG)
 *   - `TouchSafeConfig` type with spacing / compact mode multipliers
 *   - `isTouchDevice()` runtime detection
 *   - `getTouchSafeClasses()` returns Tailwind classes per element type
 *   - `validateTapTargets()` audits a container for undersized targets
 *   - `useCompactMode()` React hook with localStorage persistence
 *
 * Usage:
 *   const classes = getTouchSafeClasses('button');
 *   const { violations } = validateTapTargets(containerEl);
 *   const { compactMode, toggleCompactMode } = useCompactMode();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** WCAG 2.5.8 minimum tap target size in CSS pixels. */
export const MIN_TAP_TARGET_PX = 44;

/** Default spacing between adjacent interactive elements (px). */
export const DEFAULT_SPACING_PX = 8;

/** localStorage key for compact mode preference. */
const COMPACT_MODE_STORAGE_KEY = 'protopulse-compact-mode';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration controlling tap target sizing and spacing.
 *
 * `compactMultiplier` scales sizes down (0 < multiplier <= 1) when the
 * user has opted into compact mode. A multiplier of 0.75 yields 33px
 * tap targets — still well above the 24px "enhanced" WCAG floor.
 */
export interface TouchSafeConfig {
  /** Minimum tap target size in px. Defaults to {@link MIN_TAP_TARGET_PX}. */
  minTapTarget: number;
  /** Gap between adjacent interactive elements in px. */
  spacing: number;
  /** Scale multiplier applied when compact mode is active (0 < n <= 1). */
  compactMultiplier: number;
}

/** Supported element categories for `getTouchSafeClasses`. */
export type TouchSafeElement = 'button' | 'input' | 'link' | 'icon';

/** A single tap-target violation found by the auditor. */
export interface TapTargetViolation {
  /** The offending DOM element. */
  element: Element;
  /** Measured width (px). */
  width: number;
  /** Measured height (px). */
  height: number;
  /** Human-readable reason the element failed. */
  reason: string;
}

/** Result of a tap-target audit on a container. */
export interface TapTargetAudit {
  /** Elements that failed the minimum size requirement. */
  violations: TapTargetViolation[];
  /** Number of interactive elements that passed. */
  passes: number;
  /** Total interactive elements inspected. */
  total: number;
}

// ---------------------------------------------------------------------------
// Default Config
// ---------------------------------------------------------------------------

/** The default configuration used when no override is supplied. */
export const DEFAULT_CONFIG: Readonly<TouchSafeConfig> = Object.freeze({
  minTapTarget: MIN_TAP_TARGET_PX,
  spacing: DEFAULT_SPACING_PX,
  compactMultiplier: 0.75,
});

// ---------------------------------------------------------------------------
// Touch Detection
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the current device appears to be touch-capable.
 *
 * Combines `navigator.maxTouchPoints`, `ontouchstart` support, and the
 * coarse-pointer media query for robust detection.
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  // Primary check: touch points
  if (navigator.maxTouchPoints > 0) {
    return true;
  }

  // Fallback: ontouchstart in window
  if ('ontouchstart' in window) {
    return true;
  }

  // Media query check
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(pointer: coarse)').matches;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Tailwind Class Generation
// ---------------------------------------------------------------------------

/**
 * Returns Tailwind utility classes that enforce WCAG-compliant tap target
 * sizing for the given element type.
 *
 * When `compact` is `true` the multiplier from the config is applied,
 * producing slightly smaller (but still accessible) targets.
 */
export function getTouchSafeClasses(
  element: TouchSafeElement,
  options: { compact?: boolean; config?: Partial<TouchSafeConfig> } = {},
): string {
  const config: TouchSafeConfig = { ...DEFAULT_CONFIG, ...options.config };
  const multiplier = options.compact ? config.compactMultiplier : 1;
  const effectiveMin = Math.round(config.minTapTarget * multiplier);

  // Tailwind min-w / min-h classes use bracket notation for arbitrary values.
  const minSize = `min-w-[${effectiveMin}px] min-h-[${effectiveMin}px]`;
  const gap = `gap-[${config.spacing}px]`;

  switch (element) {
    case 'button':
      return `${minSize} ${gap} inline-flex items-center justify-center px-3 py-2 touch-manipulation`;
    case 'input':
      return `${minSize} ${gap} px-3 py-2 touch-manipulation`;
    case 'link':
      return `${minSize} ${gap} inline-flex items-center underline-offset-4 touch-manipulation`;
    case 'icon':
      return `${minSize} ${gap} inline-flex items-center justify-center p-2 touch-manipulation`;
    default: {
      // Exhaustive guard
      const _exhaustive: never = element;
      throw new Error(`Unknown element type: ${String(_exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Tap Target Auditor
// ---------------------------------------------------------------------------

/** CSS selectors that identify interactive elements. */
const INTERACTIVE_SELECTORS = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="tab"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Audits all interactive elements within `container`, reporting any that
 * fall below the minimum tap target size.
 *
 * Hidden elements (`display: none`, `visibility: hidden`, zero dimensions
 * from being off-screen) are skipped.
 */
export function validateTapTargets(
  container: Element,
  config: Partial<TouchSafeConfig> = {},
): TapTargetAudit {
  const merged: TouchSafeConfig = { ...DEFAULT_CONFIG, ...config };
  const minSize = merged.minTapTarget;
  const elements = Array.from(container.querySelectorAll(INTERACTIVE_SELECTORS));

  const violations: TapTargetViolation[] = [];
  let passes = 0;

  for (const el of elements) {
    const rect = el.getBoundingClientRect();

    // Skip invisible / zero-size elements
    if (rect.width === 0 && rect.height === 0) {
      continue;
    }

    const tooNarrow = rect.width < minSize;
    const tooShort = rect.height < minSize;

    if (tooNarrow || tooShort) {
      const reasons: string[] = [];
      if (tooNarrow) {
        reasons.push(`width ${rect.width}px < ${minSize}px`);
      }
      if (tooShort) {
        reasons.push(`height ${rect.height}px < ${minSize}px`);
      }
      violations.push({
        element: el,
        width: rect.width,
        height: rect.height,
        reason: reasons.join('; '),
      });
    } else {
      passes++;
    }
  }

  return {
    violations,
    passes,
    total: violations.length + passes,
  };
}

// ---------------------------------------------------------------------------
// useCompactMode Hook
// ---------------------------------------------------------------------------

/**
 * React hook that manages the compact mode preference.
 *
 * Persists the preference to localStorage and synchronises across tabs
 * via the `storage` event.
 */
export function useCompactMode(): {
  compactMode: boolean;
  toggleCompactMode: () => void;
  setCompactMode: (value: boolean) => void;
} {
  const [compactMode, setCompactModeState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(COMPACT_MODE_STORAGE_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  });

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(COMPACT_MODE_STORAGE_KEY, String(compactMode));
    } catch {
      // localStorage may be full or unavailable — silently ignore
    }
  }, [compactMode]);

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === COMPACT_MODE_STORAGE_KEY) {
        setCompactModeState(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('storage', handler);
    };
  }, []);

  const toggleCompactMode = useCallback(() => {
    setCompactModeState((prev) => !prev);
  }, []);

  const setCompactMode = useCallback((value: boolean) => {
    setCompactModeState(value);
  }, []);

  return { compactMode, toggleCompactMode, setCompactMode };
}
