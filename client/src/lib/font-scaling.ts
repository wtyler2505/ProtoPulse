/**
 * Font Scaling Manager
 *
 * Provides user-adjustable font size, line height, and spacing scales.
 * Four predefined scales: compact, default, large, extra-large.
 * Persists preference to localStorage and applies CSS custom properties
 * on document.documentElement.
 *
 * Usage:
 *   const manager = FontScaleManager.getInstance();
 *   manager.setScale('large');
 *   manager.getScale(); // 'large'
 *
 * React hook:
 *   const { scale, setScale, config } = useFontScale();
 *
 * BL-0329: Font scaling and spacing options.
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FontScale = 'compact' | 'default' | 'large' | 'extra-large';

export interface FontScaleConfig {
  /** CSS rem multiplier for base font size */
  fontSize: string;
  /** CSS unitless line-height multiplier */
  lineHeight: string;
  /** CSS rem multiplier for spacing */
  spacing: string;
  /** Human-readable label */
  label: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STORAGE_KEY = 'protopulse-font-scale';

export const FONT_SCALES: Record<FontScale, FontScaleConfig> = {
  compact: {
    fontSize: '0.8125rem',
    lineHeight: '1.35',
    spacing: '0.75rem',
    label: 'Compact',
  },
  default: {
    fontSize: '0.875rem',
    lineHeight: '1.5',
    spacing: '1rem',
    label: 'Default',
  },
  large: {
    fontSize: '1rem',
    lineHeight: '1.6',
    spacing: '1.25rem',
    label: 'Large',
  },
  'extra-large': {
    fontSize: '1.125rem',
    lineHeight: '1.75',
    spacing: '1.5rem',
    label: 'Extra Large',
  },
};

export const VALID_SCALES: readonly FontScale[] = ['compact', 'default', 'large', 'extra-large'] as const;

const CSS_VAR_FONT_SIZE = '--app-font-size';
const CSS_VAR_LINE_HEIGHT = '--app-line-height';
const CSS_VAR_SPACING = '--app-spacing';

// ---------------------------------------------------------------------------
// FontScaleManager
// ---------------------------------------------------------------------------

/**
 * Manages font scale preference with localStorage persistence.
 * Singleton per application. Notifies subscribers on state changes.
 * Applies CSS custom properties on document.documentElement.
 */
export class FontScaleManager {
  private static instance: FontScaleManager | null = null;

  private scale: FontScale;
  private subscribers: Set<() => void>;

  constructor() {
    this.scale = 'default';
    this.subscribers = new Set();
    this.load();
    this.applyToDOM();
  }

  /** Get or create the singleton instance. */
  static getInstance(): FontScaleManager {
    if (!FontScaleManager.instance) {
      FontScaleManager.instance = new FontScaleManager();
    }
    return FontScaleManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    FontScaleManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Get the current font scale. */
  getScale(): FontScale {
    return this.scale;
  }

  /** Get the config object for the current scale. */
  getConfig(): FontScaleConfig {
    return FONT_SCALES[this.scale];
  }

  /** Get the config for a specific scale. */
  getConfigFor(scale: FontScale): FontScaleConfig {
    return FONT_SCALES[scale];
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /** Set the font scale. No-op if the same scale is already active. */
  setScale(newScale: FontScale): void {
    if (!isValidScale(newScale)) {
      return;
    }
    if (this.scale === newScale) {
      return;
    }
    this.scale = newScale;
    this.applyToDOM();
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked whenever the scale changes.
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // DOM application
  // -----------------------------------------------------------------------

  /** Apply the current scale's CSS custom properties to documentElement. */
  private applyToDOM(): void {
    if (typeof document === 'undefined') {
      return;
    }
    const config = FONT_SCALES[this.scale];
    const root = document.documentElement;
    root.style.setProperty(CSS_VAR_FONT_SIZE, config.fontSize);
    root.style.setProperty(CSS_VAR_LINE_HEIGHT, config.lineHeight);
    root.style.setProperty(CSS_VAR_SPACING, config.spacing);
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  /** Persist scale to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      localStorage.setItem(STORAGE_KEY, this.scale);
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load scale from localStorage. */
  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && isValidScale(raw)) {
        this.scale = raw;
      }
    } catch {
      // Corrupt data — use default
      this.scale = 'default';
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Notify all subscribers of a state change. */
  private notify(): void {
    this.subscribers.forEach((cb) => {
      cb();
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Type guard: check whether a string is a valid FontScale. */
export function isValidScale(value: string): value is FontScale {
  return (VALID_SCALES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing font scale in React components.
 * Subscribes to the FontScaleManager and triggers re-renders on state changes.
 * Safe for SSR (checks typeof window).
 */
export function useFontScale(): {
  scale: FontScale;
  setScale: (scale: FontScale) => void;
  config: FontScaleConfig;
  allScales: readonly FontScale[];
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const manager = FontScaleManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const setScale = useCallback((newScale: FontScale) => {
    FontScaleManager.getInstance().setScale(newScale);
  }, []);

  const manager = typeof window !== 'undefined' ? FontScaleManager.getInstance() : null;

  return {
    scale: manager?.getScale() ?? 'default',
    setScale,
    config: manager?.getConfig() ?? FONT_SCALES['default'],
    allScales: VALID_SCALES,
  };
}
