/**
 * Reduced Motion Manager
 *
 * Respects the OS-level `prefers-reduced-motion` media query and provides
 * a manual toggle override persisted to localStorage.
 *
 * Three-state logic:
 *   - null (default) → follow OS preference via matchMedia
 *   - true  → force reduced motion ON regardless of OS
 *   - false → force reduced motion OFF regardless of OS
 *
 * When reduced motion is active, the manager adds `.reduced-motion` to <html>.
 * CSS rules in index.css use that class to disable animations/transitions.
 *
 * Usage:
 *   const manager = ReducedMotionManager.getInstance();
 *   manager.isReducedMotion(); // true/false
 *   manager.setOverride(true); // force ON
 *
 * React hook:
 *   const { reducedMotion, override, setOverride, clearOverride } = useReducedMotion();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-reduced-motion';
const HTML_CLASS = 'reduced-motion';
const MEDIA_QUERY = '(prefers-reduced-motion: reduce)';

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Detect whether the OS/browser prefers reduced motion.
 * Returns false if `matchMedia` is unavailable (SSR, test environments).
 */
export function detectPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(MEDIA_QUERY).matches;
}

// ---------------------------------------------------------------------------
// ReducedMotionManager
// ---------------------------------------------------------------------------

/** Manual override state: null = follow OS, true = force on, false = force off. */
export type ReducedMotionOverride = boolean | null;

/**
 * Manages reduced-motion preference with OS detection + manual override.
 * Singleton per application. Notifies subscribers on state changes.
 */
export class ReducedMotionManager {
  private static instance: ReducedMotionManager | null = null;

  private override: ReducedMotionOverride;
  private osPreference: boolean;
  private subscribers: Set<() => void>;
  private mediaQueryList: MediaQueryList | null;
  private mediaHandler: ((e: MediaQueryListEvent) => void) | null;

  constructor() {
    this.subscribers = new Set();
    this.override = null;
    this.osPreference = false;
    this.mediaQueryList = null;
    this.mediaHandler = null;
    this.loadOverride();
    this.initMediaQuery();
    this.applyClass();
  }

  /** Get or create the singleton instance. */
  static getInstance(): ReducedMotionManager {
    if (!ReducedMotionManager.instance) {
      ReducedMotionManager.instance = new ReducedMotionManager();
    }
    return ReducedMotionManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    if (ReducedMotionManager.instance) {
      ReducedMotionManager.instance.destroy();
    }
    ReducedMotionManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /**
   * Whether reduced motion is currently active.
   * If override is set, returns the override value.
   * Otherwise, returns the OS preference.
   */
  isReducedMotion(): boolean {
    if (this.override !== null) {
      return this.override;
    }
    return this.osPreference;
  }

  /** Get the current manual override value (null = follow OS). */
  getOverride(): ReducedMotionOverride {
    return this.override;
  }

  /** Get the current OS-level preference. */
  getOsPreference(): boolean {
    return this.osPreference;
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /**
   * Set a manual override. Pass true to force reduced motion on,
   * false to force it off, or null to clear and follow OS.
   */
  setOverride(value: ReducedMotionOverride): void {
    if (this.override === value) {
      return;
    }
    this.override = value;
    this.saveOverride();
    this.applyClass();
    this.notify();
  }

  /** Clear the manual override and follow the OS preference. */
  clearOverride(): void {
    this.setOverride(null);
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked whenever the effective reduced-motion state changes.
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /** Clean up media query listener. */
  destroy(): void {
    if (this.mediaQueryList && this.mediaHandler) {
      this.mediaQueryList.removeEventListener('change', this.mediaHandler);
    }
    this.mediaQueryList = null;
    this.mediaHandler = null;
    this.subscribers.clear();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Set up matchMedia listener for OS preference changes. */
  private initMediaQuery(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    this.mediaQueryList = window.matchMedia(MEDIA_QUERY);
    this.osPreference = this.mediaQueryList.matches;

    this.mediaHandler = (e: MediaQueryListEvent) => {
      this.osPreference = e.matches;
      this.applyClass();
      this.notify();
    };
    this.mediaQueryList.addEventListener('change', this.mediaHandler);
  }

  /** Add or remove the `.reduced-motion` class on <html>. */
  private applyClass(): void {
    if (typeof document === 'undefined') {
      return;
    }
    const active = this.isReducedMotion();
    if (active) {
      document.documentElement.classList.add(HTML_CLASS);
    } else {
      document.documentElement.classList.remove(HTML_CLASS);
    }
  }

  /** Persist override to localStorage. */
  private saveOverride(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      if (this.override === null) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.override));
      }
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load override from localStorage. */
  private loadOverride(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        this.override = null;
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'boolean') {
        this.override = parsed;
      } else {
        // Invalid data — clear it
        this.override = null;
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      this.override = null;
    }
  }

  /** Notify all subscribers of a state change. */
  private notify(): void {
    this.subscribers.forEach((cb) => {
      cb();
    });
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing reduced-motion state in React components.
 * Subscribes to the ReducedMotionManager and triggers re-renders on state changes.
 */
export function useReducedMotion(): {
  /** Whether reduced motion is currently active (considering override + OS). */
  reducedMotion: boolean;
  /** Current manual override: null = follow OS, true = force on, false = force off. */
  override: ReducedMotionOverride;
  /** The OS-level preference (read-only). */
  osPreference: boolean;
  /** Set a manual override value. */
  setOverride: (value: ReducedMotionOverride) => void;
  /** Clear manual override and follow OS preference. */
  clearOverride: () => void;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const manager = ReducedMotionManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const setOverride = useCallback((value: ReducedMotionOverride) => {
    ReducedMotionManager.getInstance().setOverride(value);
  }, []);

  const clearOverride = useCallback(() => {
    ReducedMotionManager.getInstance().clearOverride();
  }, []);

  if (typeof window === 'undefined') {
    return {
      reducedMotion: false,
      override: null,
      osPreference: false,
      setOverride,
      clearOverride,
    };
  }

  const manager = ReducedMotionManager.getInstance();

  return {
    reducedMotion: manager.isReducedMotion(),
    override: manager.getOverride(),
    osPreference: manager.getOsPreference(),
    setOverride,
    clearOverride,
  };
}
