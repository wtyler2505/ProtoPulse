/**
 * Motion Language — Unified Transition & Animation System
 *
 * Provides a consistent, accessible motion system for ProtoPulse UI.
 * Transitions are described declaratively via TransitionType + MotionConfig,
 * then compiled to CSS transition strings. Reduced-motion is respected
 * automatically via the prefers-reduced-motion media query.
 *
 * Usage:
 *   getTransitionCSS('enter');                     // uses 'standard' preset
 *   getTransitionCSS('fade', 'emphasized');         // uses named preset
 *   getTransitionCSS('move', { duration: 400, easing: EASING.spring });
 *
 *   // React hook:
 *   const prefersReduced = useMotionPreference();
 */

import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Transition intent categories. */
export type TransitionType = 'enter' | 'exit' | 'move' | 'resize' | 'fade' | 'scale';

/** Full configuration for a single transition. */
export interface MotionConfig {
  /** Duration in milliseconds (>0). */
  duration: number;
  /** CSS easing function string. */
  easing: string;
  /** Optional delay in milliseconds (>=0). */
  delay?: number;
  /** Fallback config used when prefers-reduced-motion is active. */
  reducedMotion?: ReducedMotionFallback;
}

/** Reduced-motion fallback strategy. */
export interface ReducedMotionFallback {
  /** Duration override (typically 0 or very short). */
  duration: number;
  /** Easing override (typically 'linear'). */
  easing: string;
  /** Delay override. */
  delay?: number;
}

// ---------------------------------------------------------------------------
// Easing Constants
// ---------------------------------------------------------------------------

/**
 * Curated easing functions.
 *
 * - easeOut: Standard deceleration — good for enters & reveals.
 * - easeIn: Standard acceleration — good for exits.
 * - easeInOut: Symmetric ease — good for moves & resizes.
 * - spring: Slight overshoot for playful, physical feel.
 * - bounce: Pronounced overshoot with settle — use sparingly.
 * - linear: No easing — for opacity fades or reduced-motion fallback.
 */
export const EASING = {
  easeOut: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0.0, 1, 1)',
  easeInOut: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  linear: 'linear',
} as const;

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/** Default reduced-motion fallback: instant with no animation. */
const DEFAULT_REDUCED_MOTION: ReducedMotionFallback = {
  duration: 0,
  easing: EASING.linear,
  delay: 0,
};

/** Named motion presets from subtle (micro-interactions) to dramatic (page transitions). */
export const MOTION_PRESETS: Record<string, MotionConfig> = {
  subtle: {
    duration: 150,
    easing: EASING.easeOut,
    reducedMotion: DEFAULT_REDUCED_MOTION,
  },
  standard: {
    duration: 200,
    easing: EASING.easeOut,
    reducedMotion: DEFAULT_REDUCED_MOTION,
  },
  emphasized: {
    duration: 300,
    easing: EASING.spring,
    reducedMotion: DEFAULT_REDUCED_MOTION,
  },
  dramatic: {
    duration: 500,
    easing: EASING.bounce,
    reducedMotion: DEFAULT_REDUCED_MOTION,
  },
};

// ---------------------------------------------------------------------------
// CSS property mapping per TransitionType
// ---------------------------------------------------------------------------

/**
 * Maps each TransitionType to the CSS properties it should animate.
 * This allows `getTransitionCSS` to produce targeted, performant transitions.
 */
const TRANSITION_PROPERTIES: Record<TransitionType, readonly string[]> = {
  enter: ['opacity', 'transform'],
  exit: ['opacity', 'transform'],
  move: ['transform'],
  resize: ['width', 'height'],
  fade: ['opacity'],
  scale: ['transform'],
};

// ---------------------------------------------------------------------------
// Reduced-motion detection
// ---------------------------------------------------------------------------

/**
 * Checks the `prefers-reduced-motion: reduce` media query.
 *
 * Returns `true` when the user has requested reduced motion at the OS level.
 * Falls back to `false` when `matchMedia` is unavailable (e.g., SSR / tests).
 */
export function shouldReduceMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---------------------------------------------------------------------------
// CSS transition builder
// ---------------------------------------------------------------------------

/**
 * Resolve a preset name or inline MotionConfig to a concrete MotionConfig.
 *
 * - If `preset` is omitted, defaults to `'standard'`.
 * - If `preset` is a string, looks up `MOTION_PRESETS[preset]`.
 * - If `preset` is a MotionConfig object, uses it directly.
 *
 * Throws if a string preset name is not found in `MOTION_PRESETS`.
 */
export function resolveMotionConfig(preset?: string | MotionConfig): MotionConfig {
  if (preset === undefined) {
    return MOTION_PRESETS['standard'];
  }
  if (typeof preset === 'string') {
    const config = MOTION_PRESETS[preset];
    if (!config) {
      throw new Error(`Unknown motion preset: "${preset}". Available: ${Object.keys(MOTION_PRESETS).join(', ')}`);
    }
    return config;
  }
  return preset;
}

/**
 * Build a CSS `transition` shorthand string for the given TransitionType.
 *
 * @param type      The semantic transition intent (enter, exit, fade, etc.).
 * @param preset    A preset name ('subtle', 'standard', 'emphasized', 'dramatic')
 *                  or an inline MotionConfig. Defaults to 'standard'.
 * @returns         A CSS transition string, e.g. `"opacity 200ms cubic-bezier(...) 0ms, transform 200ms ..."`.
 *
 * When `prefers-reduced-motion: reduce` is active, the returned string uses
 * the `reducedMotion` fallback from the config (or instant/0ms by default).
 */
export function getTransitionCSS(type: TransitionType, preset?: string | MotionConfig): string {
  const config = resolveMotionConfig(preset);

  const reduced = shouldReduceMotion();
  const duration = reduced ? (config.reducedMotion?.duration ?? 0) : config.duration;
  const easing = reduced ? (config.reducedMotion?.easing ?? EASING.linear) : config.easing;
  const delay = reduced ? (config.reducedMotion?.delay ?? 0) : (config.delay ?? 0);

  const properties = TRANSITION_PROPERTIES[type];

  return properties.map((prop) => `${prop} ${duration}ms ${easing} ${delay}ms`).join(', ');
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

/**
 * React hook that reactively tracks the user's `prefers-reduced-motion` setting.
 *
 * Re-renders when the preference changes (e.g., the user toggles it in system
 * settings while the app is open).
 *
 * @returns `true` when reduced motion is preferred, `false` otherwise.
 */
export function useMotionPreference(): boolean {
  const [prefersReduced, setPrefersReduced] = useState<boolean>(shouldReduceMotion);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches);
    };

    // Sync initial value in case it changed between render and effect.
    setPrefersReduced(mql.matches);

    mql.addEventListener('change', handler);
    return () => {
      mql.removeEventListener('change', handler);
    };
  }, []);

  return prefersReduced;
}
