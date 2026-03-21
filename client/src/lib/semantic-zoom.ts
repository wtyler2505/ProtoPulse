/**
 * Semantic Zoom Engine
 *
 * Manages zoom-level–dependent content rendering.  As the user zooms in/out,
 * different levels of detail are shown: at the outermost zoom level the entire
 * system is visible as a single block; zooming in progressively reveals
 * architecture blocks, schematic symbols, individual component details, pin
 * names, and finally datasheet-level info.
 *
 * Each zoom level defines which element categories are visible, how they
 * transition (dissolve/reveal with configurable fade range), and what content
 * is swapped in.  Thresholds are fully configurable.
 *
 * Usage:
 *   const engine = SemanticZoomEngine.getInstance();
 *   engine.setZoom(0.8);
 *   engine.getActiveLevel();          // 'architecture'
 *   engine.getElementVisibility('pin-labels');  // { visible: false, opacity: 0 }
 *
 * React hook:
 *   const { activeLevel, zoom, getElementVisibility, setZoom } = useSemanticZoom();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Named semantic zoom levels, ordered outermost → innermost. */
export type ZoomLevel = 'system' | 'architecture' | 'schematic' | 'component' | 'pin' | 'datasheet';

/** Threshold configuration for a single zoom level. */
export interface ZoomLevelThreshold {
  /** Level name. */
  level: ZoomLevel;
  /** Zoom factor at which this level begins (exclusive lower bound). */
  minZoom: number;
  /** Zoom factor at which this level ends (inclusive upper bound). */
  maxZoom: number;
}

/** Visibility rule for an element category at a given zoom level. */
export interface ElementVisibilityRule {
  /** Element category identifier (e.g., 'pin-labels', 'bus-arrows'). */
  elementCategory: string;
  /** Zoom levels at which this category is visible. */
  visibleAt: ZoomLevel[];
  /** Fade-in range: [startOpacity, endOpacity] during transition. */
  fadeRange: [number, number];
}

/** Transition style between zoom levels. */
export type TransitionStyle = 'dissolve' | 'reveal' | 'instant';

/** Transition configuration for entering a zoom level. */
export interface ZoomTransition {
  /** Level being transitioned into. */
  level: ZoomLevel;
  /** Transition style. */
  style: TransitionStyle;
  /** Duration in ms. */
  durationMs: number;
}

/** Computed visibility for a single element category. */
export interface ElementVisibility {
  /** Whether the element is currently visible (opacity > 0). */
  visible: boolean;
  /** Current opacity 0..1. */
  opacity: number;
  /** Whether the element is in a transition zone. */
  transitioning: boolean;
}

/** Full engine state exposed to subscribers. */
export interface SemanticZoomState {
  /** Current continuous zoom factor. */
  zoom: number;
  /** Active semantic level derived from zoom. */
  activeLevel: ZoomLevel;
  /** Previous level (for transition tracking). */
  previousLevel: ZoomLevel | null;
  /** Whether currently transitioning between levels. */
  isTransitioning: boolean;
  /** Transition progress 0..1 (0 when not transitioning). */
  transitionProgress: number;
}

/** Engine configuration. */
export interface SemanticZoomConfig {
  /** Zoom level thresholds. */
  thresholds: ZoomLevelThreshold[];
  /** Element visibility rules. */
  visibilityRules: ElementVisibilityRule[];
  /** Transition styles per level. */
  transitions: ZoomTransition[];
  /** Fade margin — zoom units before/after threshold where fading occurs. */
  fadeMargin: number;
  /** Whether smooth transitions are enabled. */
  smoothTransitions: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ZOOM_LEVELS_ORDERED: readonly ZoomLevel[] = [
  'system',
  'architecture',
  'schematic',
  'component',
  'pin',
  'datasheet',
] as const;

const DEFAULT_THRESHOLDS: ZoomLevelThreshold[] = [
  { level: 'system', minZoom: 0, maxZoom: 0.15 },
  { level: 'architecture', minZoom: 0.15, maxZoom: 0.5 },
  { level: 'schematic', minZoom: 0.5, maxZoom: 1.5 },
  { level: 'component', minZoom: 1.5, maxZoom: 4.0 },
  { level: 'pin', minZoom: 4.0, maxZoom: 10.0 },
  { level: 'datasheet', minZoom: 10.0, maxZoom: Infinity },
];

const DEFAULT_VISIBILITY_RULES: ElementVisibilityRule[] = [
  { elementCategory: 'system-boundary', visibleAt: ['system', 'architecture'], fadeRange: [0, 1] },
  { elementCategory: 'subsystem-blocks', visibleAt: ['system', 'architecture', 'schematic'], fadeRange: [0, 1] },
  { elementCategory: 'connection-arrows', visibleAt: ['architecture', 'schematic'], fadeRange: [0, 1] },
  { elementCategory: 'component-symbols', visibleAt: ['schematic', 'component', 'pin', 'datasheet'], fadeRange: [0, 1] },
  { elementCategory: 'component-values', visibleAt: ['component', 'pin', 'datasheet'], fadeRange: [0, 1] },
  { elementCategory: 'ref-designators', visibleAt: ['schematic', 'component', 'pin', 'datasheet'], fadeRange: [0.2, 1] },
  { elementCategory: 'pin-labels', visibleAt: ['pin', 'datasheet'], fadeRange: [0, 1] },
  { elementCategory: 'pin-numbers', visibleAt: ['pin', 'datasheet'], fadeRange: [0.3, 1] },
  { elementCategory: 'net-labels', visibleAt: ['schematic', 'component', 'pin'], fadeRange: [0, 1] },
  { elementCategory: 'bus-arrows', visibleAt: ['architecture', 'schematic'], fadeRange: [0.2, 0.8] },
  { elementCategory: 'datasheet-info', visibleAt: ['datasheet'], fadeRange: [0, 1] },
  { elementCategory: 'power-rails', visibleAt: ['architecture', 'schematic', 'component', 'pin'], fadeRange: [0, 1] },
];

const DEFAULT_TRANSITIONS: ZoomTransition[] = [
  { level: 'system', style: 'dissolve', durationMs: 300 },
  { level: 'architecture', style: 'dissolve', durationMs: 250 },
  { level: 'schematic', style: 'reveal', durationMs: 200 },
  { level: 'component', style: 'reveal', durationMs: 200 },
  { level: 'pin', style: 'dissolve', durationMs: 150 },
  { level: 'datasheet', style: 'instant', durationMs: 0 },
];

const DEFAULT_FADE_MARGIN = 0.05;

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Clamp a number between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// SemanticZoomEngine
// ---------------------------------------------------------------------------

/**
 * Computes element visibility based on continuous zoom level.
 * Singleton per application. Notifies subscribers on state changes.
 */
export class SemanticZoomEngine {
  private static instance: SemanticZoomEngine | null = null;

  private zoom: number;
  private activeLevel: ZoomLevel;
  private previousLevel: ZoomLevel | null;
  private isTransitioning: boolean;
  private transitionProgress: number;
  private config: SemanticZoomConfig;
  private subscribers: Set<() => void>;

  constructor() {
    this.zoom = 1.0;
    this.activeLevel = 'schematic';
    this.previousLevel = null;
    this.isTransitioning = false;
    this.transitionProgress = 0;
    this.config = {
      thresholds: [...DEFAULT_THRESHOLDS],
      visibilityRules: [...DEFAULT_VISIBILITY_RULES],
      transitions: [...DEFAULT_TRANSITIONS],
      fadeMargin: DEFAULT_FADE_MARGIN,
      smoothTransitions: true,
    };
    this.subscribers = new Set();
  }

  /** Get or create the singleton instance. */
  static getInstance(): SemanticZoomEngine {
    if (!SemanticZoomEngine.instance) {
      SemanticZoomEngine.instance = new SemanticZoomEngine();
    }
    return SemanticZoomEngine.instance;
  }

  /** Reset the singleton (for testing). */
  static resetInstance(): void {
    SemanticZoomEngine.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /** Subscribe to state changes. Returns unsubscribe function. */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(): void {
    this.subscribers.forEach((cb) => cb());
  }

  // -----------------------------------------------------------------------
  // Zoom control
  // -----------------------------------------------------------------------

  /** Set the current zoom factor. Recomputes active level and notifies. */
  setZoom(zoom: number): void {
    const newZoom = Math.max(0, zoom);
    if (newZoom === this.zoom) {
      return;
    }
    this.zoom = newZoom;
    const newLevel = this.computeActiveLevel(newZoom);
    if (newLevel !== this.activeLevel) {
      this.previousLevel = this.activeLevel;
      this.activeLevel = newLevel;
      this.isTransitioning = this.config.smoothTransitions;
      this.transitionProgress = this.config.smoothTransitions ? 0 : 1;
    }
    this.notify();
  }

  /** Get the current zoom factor. */
  getZoom(): number {
    return this.zoom;
  }

  /** Get the current active zoom level. */
  getActiveLevel(): ZoomLevel {
    return this.activeLevel;
  }

  /** Get the ordered list of all zoom levels. */
  getZoomLevels(): readonly ZoomLevel[] {
    return ZOOM_LEVELS_ORDERED;
  }

  /** Get the index (depth) of the current level (0 = outermost). */
  getLevelDepth(): number {
    return ZOOM_LEVELS_ORDERED.indexOf(this.activeLevel);
  }

  // -----------------------------------------------------------------------
  // Level computation
  // -----------------------------------------------------------------------

  private computeActiveLevel(zoom: number): ZoomLevel {
    for (const threshold of this.config.thresholds) {
      if (zoom >= threshold.minZoom && zoom < threshold.maxZoom) {
        return threshold.level;
      }
    }
    // Edge case: zoom exactly at maxZoom of last finite threshold
    const lastFinite = this.config.thresholds.filter((t) => t.maxZoom !== Infinity);
    if (lastFinite.length > 0 && zoom >= lastFinite[lastFinite.length - 1].maxZoom) {
      return this.config.thresholds[this.config.thresholds.length - 1].level;
    }
    return 'schematic'; // safe fallback
  }

  /** Get the threshold config for a specific level. */
  getLevelThreshold(level: ZoomLevel): ZoomLevelThreshold | null {
    return this.config.thresholds.find((t) => t.level === level) ?? null;
  }

  // -----------------------------------------------------------------------
  // Element visibility
  // -----------------------------------------------------------------------

  /** Compute visibility for a single element category at current zoom. */
  getElementVisibility(elementCategory: string): ElementVisibility {
    const rule = this.config.visibilityRules.find((r) => r.elementCategory === elementCategory);
    if (!rule) {
      return { visible: false, opacity: 0, transitioning: false };
    }

    const isVisibleAtLevel = rule.visibleAt.includes(this.activeLevel);
    if (!isVisibleAtLevel) {
      // Check if we're in a fade-out zone near a threshold
      const fadeOpacity = this.computeFadeOpacity(rule);
      if (fadeOpacity > 0) {
        return { visible: true, opacity: fadeOpacity, transitioning: true };
      }
      return { visible: false, opacity: 0, transitioning: false };
    }

    // Visible — check if we're in a fade-in zone
    const fadeOpacity = this.computeFadeInOpacity(rule);
    const opacity = clamp(fadeOpacity, rule.fadeRange[0], rule.fadeRange[1]);
    return {
      visible: opacity > 0,
      opacity,
      transitioning: opacity < rule.fadeRange[1],
    };
  }

  /** Compute visibility for all registered element categories. */
  getAllElementVisibilities(): Record<string, ElementVisibility> {
    const result: Record<string, ElementVisibility> = {};
    for (const rule of this.config.visibilityRules) {
      result[rule.elementCategory] = this.getElementVisibility(rule.elementCategory);
    }
    return result;
  }

  /** Get categories visible at the current zoom level. */
  getVisibleCategories(): string[] {
    return this.config.visibilityRules
      .filter((rule) => {
        const vis = this.getElementVisibility(rule.elementCategory);
        return vis.visible;
      })
      .map((rule) => rule.elementCategory);
  }

  private computeFadeOpacity(rule: ElementVisibilityRule): number {
    // Find the nearest visible level threshold
    for (const visibleLevel of rule.visibleAt) {
      const threshold = this.config.thresholds.find((t) => t.level === visibleLevel);
      if (!threshold) {
        continue;
      }

      const fadeMargin = this.config.fadeMargin;
      // Check if zoom is just below the level's minZoom
      if (this.zoom >= threshold.minZoom - fadeMargin && this.zoom < threshold.minZoom) {
        const progress = (this.zoom - (threshold.minZoom - fadeMargin)) / fadeMargin;
        return clamp(progress * rule.fadeRange[1], 0, rule.fadeRange[1]);
      }
      // Check if zoom is just above the level's maxZoom
      if (threshold.maxZoom !== Infinity && this.zoom >= threshold.maxZoom && this.zoom < threshold.maxZoom + fadeMargin) {
        const progress = 1 - (this.zoom - threshold.maxZoom) / fadeMargin;
        return clamp(progress * rule.fadeRange[1], 0, rule.fadeRange[1]);
      }
    }
    return 0;
  }

  private computeFadeInOpacity(rule: ElementVisibilityRule): number {
    const threshold = this.config.thresholds.find((t) => t.level === this.activeLevel);
    if (!threshold) {
      return rule.fadeRange[1];
    }

    const fadeMargin = this.config.fadeMargin;
    // Fade in from bottom of level range
    if (this.zoom < threshold.minZoom + fadeMargin && threshold.minZoom > 0) {
      const progress = (this.zoom - threshold.minZoom) / fadeMargin;
      return clamp(
        rule.fadeRange[0] + progress * (rule.fadeRange[1] - rule.fadeRange[0]),
        rule.fadeRange[0],
        rule.fadeRange[1],
      );
    }

    return rule.fadeRange[1];
  }

  // -----------------------------------------------------------------------
  // Transition management
  // -----------------------------------------------------------------------

  /** Advance transition progress (call from animation frame). Returns true if still transitioning. */
  advanceTransition(deltaMs: number): boolean {
    if (!this.isTransitioning) {
      return false;
    }

    const transition = this.config.transitions.find((t) => t.level === this.activeLevel);
    if (!transition || transition.durationMs <= 0 || transition.style === 'instant') {
      this.isTransitioning = false;
      this.transitionProgress = 1;
      this.notify();
      return false;
    }

    this.transitionProgress = clamp(this.transitionProgress + deltaMs / transition.durationMs, 0, 1);
    if (this.transitionProgress >= 1) {
      this.isTransitioning = false;
      this.transitionProgress = 1;
    }

    this.notify();
    return this.isTransitioning;
  }

  /** Get current transition info. */
  getTransitionInfo(): { style: TransitionStyle; progress: number; active: boolean } {
    const transition = this.config.transitions.find((t) => t.level === this.activeLevel);
    return {
      style: transition?.style ?? 'instant',
      progress: this.transitionProgress,
      active: this.isTransitioning,
    };
  }

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  /** Update thresholds. */
  setThresholds(thresholds: ZoomLevelThreshold[]): void {
    this.config.thresholds = [...thresholds];
    // Recompute active level at current zoom
    const newLevel = this.computeActiveLevel(this.zoom);
    if (newLevel !== this.activeLevel) {
      this.previousLevel = this.activeLevel;
      this.activeLevel = newLevel;
    }
    this.notify();
  }

  /** Add or update a visibility rule. */
  setVisibilityRule(rule: ElementVisibilityRule): void {
    const idx = this.config.visibilityRules.findIndex((r) => r.elementCategory === rule.elementCategory);
    if (idx >= 0) {
      this.config.visibilityRules[idx] = { ...rule };
    } else {
      this.config.visibilityRules.push({ ...rule });
    }
    this.notify();
  }

  /** Remove a visibility rule by category. */
  removeVisibilityRule(elementCategory: string): void {
    this.config.visibilityRules = this.config.visibilityRules.filter((r) => r.elementCategory !== elementCategory);
    this.notify();
  }

  /** Set transition config for a level. */
  setTransition(transition: ZoomTransition): void {
    const idx = this.config.transitions.findIndex((t) => t.level === transition.level);
    if (idx >= 0) {
      this.config.transitions[idx] = { ...transition };
    } else {
      this.config.transitions.push({ ...transition });
    }
    this.notify();
  }

  /** Set fade margin. */
  setFadeMargin(margin: number): void {
    this.config.fadeMargin = Math.max(0, margin);
    this.notify();
  }

  /** Toggle smooth transitions. */
  setSmoothTransitions(enabled: boolean): void {
    this.config.smoothTransitions = enabled;
    this.notify();
  }

  /** Get full config. */
  getConfig(): SemanticZoomConfig {
    return {
      thresholds: [...this.config.thresholds],
      visibilityRules: [...this.config.visibilityRules],
      transitions: [...this.config.transitions],
      fadeMargin: this.config.fadeMargin,
      smoothTransitions: this.config.smoothTransitions,
    };
  }

  // -----------------------------------------------------------------------
  // Full state snapshot
  // -----------------------------------------------------------------------

  /** Get complete state snapshot. */
  getState(): SemanticZoomState {
    return {
      zoom: this.zoom,
      activeLevel: this.activeLevel,
      previousLevel: this.previousLevel,
      isTransitioning: this.isTransitioning,
      transitionProgress: this.transitionProgress,
    };
  }

  /** Check if a zoom level is deeper (more zoomed in) than another. */
  isDeeper(a: ZoomLevel, b: ZoomLevel): boolean {
    return ZOOM_LEVELS_ORDERED.indexOf(a) > ZOOM_LEVELS_ORDERED.indexOf(b);
  }

  /** Get the next deeper level, or null if already at deepest. */
  getNextDeeperLevel(): ZoomLevel | null {
    const idx = ZOOM_LEVELS_ORDERED.indexOf(this.activeLevel);
    return idx < ZOOM_LEVELS_ORDERED.length - 1 ? ZOOM_LEVELS_ORDERED[idx + 1] : null;
  }

  /** Get the next shallower level, or null if already at shallowest. */
  getNextShallowerLevel(): ZoomLevel | null {
    const idx = ZOOM_LEVELS_ORDERED.indexOf(this.activeLevel);
    return idx > 0 ? ZOOM_LEVELS_ORDERED[idx - 1] : null;
  }

  /** Snap zoom to the center of a given level. */
  snapToLevel(level: ZoomLevel): void {
    const threshold = this.config.thresholds.find((t) => t.level === level);
    if (!threshold) {
      return;
    }
    const center = threshold.maxZoom === Infinity
      ? threshold.minZoom + 5
      : (threshold.minZoom + threshold.maxZoom) / 2;
    this.setZoom(center);
  }
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

/** React hook providing semantic zoom state and controls. */
export function useSemanticZoom() {
  const [state, setState] = useState<SemanticZoomState>(() => SemanticZoomEngine.getInstance().getState());

  useEffect(() => {
    const engine = SemanticZoomEngine.getInstance();
    setState(engine.getState());
    return engine.subscribe(() => {
      setState(engine.getState());
    });
  }, []);

  const setZoom = useCallback((zoom: number) => {
    SemanticZoomEngine.getInstance().setZoom(zoom);
  }, []);

  const snapToLevel = useCallback((level: ZoomLevel) => {
    SemanticZoomEngine.getInstance().snapToLevel(level);
  }, []);

  const getElementVisibility = useCallback((category: string) => {
    return SemanticZoomEngine.getInstance().getElementVisibility(category);
  }, []);

  const getAllElementVisibilities = useCallback(() => {
    return SemanticZoomEngine.getInstance().getAllElementVisibilities();
  }, []);

  const getVisibleCategories = useCallback(() => {
    return SemanticZoomEngine.getInstance().getVisibleCategories();
  }, []);

  const advanceTransition = useCallback((deltaMs: number) => {
    return SemanticZoomEngine.getInstance().advanceTransition(deltaMs);
  }, []);

  return {
    zoom: state.zoom,
    activeLevel: state.activeLevel,
    previousLevel: state.previousLevel,
    isTransitioning: state.isTransitioning,
    transitionProgress: state.transitionProgress,
    setZoom,
    snapToLevel,
    getElementVisibility,
    getAllElementVisibilities,
    getVisibleCategories,
    advanceTransition,
  };
}
