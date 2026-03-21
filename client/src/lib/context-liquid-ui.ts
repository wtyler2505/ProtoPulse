/**
 * Context-Liquid UI Manager
 *
 * Dynamically adjusts panel appearance (opacity, blur, scale) based on the
 * user's current focus context.  When the user is focused on, e.g., the
 * schematic editor, non-essential panels fade/blur to reduce visual noise
 * while still remaining accessible.  Switching focus context smoothly
 * transitions all panels to their new states.
 *
 * Supports 8 focus contexts with per-panel rules, content swapping hints,
 * and smooth interpolation between states.
 *
 * Usage:
 *   const manager = ContextLiquidManager.getInstance();
 *   manager.setFocusContext('schematic');
 *   manager.getPanelStyle('chat'); // { opacity: 0.4, blur: 2, scale: 0.95 }
 *
 * React hook:
 *   const { focusContext, getPanelStyle, setFocusContext } = useContextLiquid();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Focus contexts representing major user activity modes. */
export type FocusContext =
  | 'code'
  | 'schematic'
  | 'pcb'
  | 'bom'
  | 'chat'
  | 'serial'
  | 'simulation'
  | 'neutral';

/** Visual style adjustments for a panel. */
export interface PanelStyle {
  /** Opacity 0..1 (1 = fully opaque). */
  opacity: number;
  /** Gaussian blur radius in px (0 = none). */
  blur: number;
  /** CSS scale factor (1 = no scale). */
  scale: number;
  /** Whether the panel should show its compact/minimal variant. */
  compact: boolean;
  /** Suggested content swap — what to prioritize in this panel. */
  contentHint: string | null;
}

/** Rule defining how a panel behaves in a given focus context. */
export interface PanelContextRule {
  /** Panel identifier (e.g., 'sidebar', 'chat', 'properties'). */
  panelId: string;
  /** Focus context this rule applies to. */
  context: FocusContext;
  /** Target opacity. */
  opacity: number;
  /** Target blur. */
  blur: number;
  /** Target scale. */
  scale: number;
  /** Whether to show compact variant. */
  compact: boolean;
  /** Content hint for this context. */
  contentHint: string | null;
}

/** Transition state for smooth interpolation. */
export interface TransitionState {
  /** Whether a transition is in progress. */
  active: boolean;
  /** Source context. */
  from: FocusContext;
  /** Target context. */
  to: FocusContext;
  /** Progress 0..1. */
  progress: number;
  /** Duration in ms. */
  durationMs: number;
  /** Start timestamp. */
  startMs: number;
}

/** Full state exposed to subscribers. */
export interface ContextLiquidState {
  /** Current focus context. */
  focusContext: FocusContext;
  /** Previous focus context. */
  previousContext: FocusContext | null;
  /** Transition state. */
  transition: TransitionState;
  /** Timestamp of last change. */
  lastChangeMs: number;
}

/** Manager configuration. */
export interface ContextLiquidConfig {
  /** Per-panel, per-context rules. */
  rules: PanelContextRule[];
  /** Default transition duration in ms. */
  transitionDurationMs: number;
  /** Whether transitions are enabled. */
  transitionsEnabled: boolean;
  /** Default style for panels without a matching rule. */
  defaultStyle: PanelStyle;
  /** Whether the system is enabled. */
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_CONTEXTS: readonly FocusContext[] = [
  'code',
  'schematic',
  'pcb',
  'bom',
  'chat',
  'serial',
  'simulation',
  'neutral',
] as const;

/** Known panel identifiers. */
const KNOWN_PANELS = [
  'sidebar',
  'chat',
  'properties',
  'toolbar',
  'canvas',
  'output',
  'explorer',
  'minimap',
] as const;

type KnownPanel = (typeof KNOWN_PANELS)[number];

/** Default rules: in each focus context, the primary panel is full opacity,
 *  related panels are slightly faded, and unrelated panels are more faded. */
function buildDefaultRules(): PanelContextRule[] {
  const rules: PanelContextRule[] = [];

  // Helper: for a given context, define which panels are primary, related, background
  const contextPanelMap: Record<FocusContext, { primary: KnownPanel[]; related: KnownPanel[]; background: KnownPanel[] }> = {
    code: {
      primary: ['canvas'],
      related: ['output', 'explorer', 'toolbar'],
      background: ['chat', 'properties', 'sidebar', 'minimap'],
    },
    schematic: {
      primary: ['canvas', 'toolbar'],
      related: ['properties', 'sidebar', 'minimap'],
      background: ['chat', 'output', 'explorer'],
    },
    pcb: {
      primary: ['canvas', 'toolbar'],
      related: ['properties', 'minimap', 'sidebar'],
      background: ['chat', 'output', 'explorer'],
    },
    bom: {
      primary: ['canvas', 'sidebar'],
      related: ['properties', 'toolbar'],
      background: ['chat', 'output', 'explorer', 'minimap'],
    },
    chat: {
      primary: ['chat'],
      related: ['canvas', 'sidebar'],
      background: ['properties', 'toolbar', 'output', 'explorer', 'minimap'],
    },
    serial: {
      primary: ['output', 'toolbar'],
      related: ['canvas', 'sidebar'],
      background: ['chat', 'properties', 'explorer', 'minimap'],
    },
    simulation: {
      primary: ['canvas', 'output'],
      related: ['properties', 'toolbar', 'sidebar'],
      background: ['chat', 'explorer', 'minimap'],
    },
    neutral: {
      primary: ['canvas', 'sidebar', 'chat', 'toolbar', 'properties', 'output', 'explorer', 'minimap'],
      related: [],
      background: [],
    },
  };

  for (const context of ALL_CONTEXTS) {
    const map = contextPanelMap[context];
    for (const panel of map.primary) {
      rules.push({
        panelId: panel,
        context,
        opacity: 1.0,
        blur: 0,
        scale: 1.0,
        compact: false,
        contentHint: null,
      });
    }
    for (const panel of map.related) {
      rules.push({
        panelId: panel,
        context,
        opacity: 0.75,
        blur: 0,
        scale: 1.0,
        compact: false,
        contentHint: null,
      });
    }
    for (const panel of map.background) {
      rules.push({
        panelId: panel,
        context,
        opacity: 0.4,
        blur: 2,
        scale: 0.95,
        compact: true,
        contentHint: null,
      });
    }
  }

  // Special content hints
  const chatSchematic = rules.find((r) => r.panelId === 'chat' && r.context === 'schematic');
  if (chatSchematic) {
    chatSchematic.contentHint = 'circuit-suggestions';
  }
  const chatPcb = rules.find((r) => r.panelId === 'chat' && r.context === 'pcb');
  if (chatPcb) {
    chatPcb.contentHint = 'layout-tips';
  }
  const chatSimulation = rules.find((r) => r.panelId === 'chat' && r.context === 'simulation');
  if (chatSimulation) {
    chatSimulation.contentHint = 'sim-analysis';
  }
  const propertiesBom = rules.find((r) => r.panelId === 'properties' && r.context === 'bom');
  if (propertiesBom) {
    propertiesBom.contentHint = 'part-details';
  }
  const sidebarSerial = rules.find((r) => r.panelId === 'sidebar' && r.context === 'serial');
  if (sidebarSerial) {
    sidebarSerial.contentHint = 'port-list';
  }
  const outputCode = rules.find((r) => r.panelId === 'output' && r.context === 'code');
  if (outputCode) {
    outputCode.contentHint = 'build-output';
  }
  const explorerCode = rules.find((r) => r.panelId === 'explorer' && r.context === 'code');
  if (explorerCode) {
    explorerCode.contentHint = 'file-tree';
  }
  const outputSimulation = rules.find((r) => r.panelId === 'output' && r.context === 'simulation');
  if (outputSimulation) {
    outputSimulation.contentHint = 'waveform-viewer';
  }

  return rules;
}

const DEFAULT_STYLE: PanelStyle = {
  opacity: 1.0,
  blur: 0,
  scale: 1.0,
  compact: false,
  contentHint: null,
};

const DEFAULT_TRANSITION_DURATION_MS = 200;

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Clamp value between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Linearly interpolate between two values. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Ease-in-out cubic for smooth transitions. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Interpolate between two panel styles. */
function interpolateStyle(from: PanelStyle, to: PanelStyle, t: number): PanelStyle {
  const easedT = easeInOutCubic(clamp(t, 0, 1));
  return {
    opacity: lerp(from.opacity, to.opacity, easedT),
    blur: lerp(from.blur, to.blur, easedT),
    scale: lerp(from.scale, to.scale, easedT),
    compact: easedT >= 0.5 ? to.compact : from.compact,
    contentHint: easedT >= 0.5 ? to.contentHint : from.contentHint,
  };
}

// ---------------------------------------------------------------------------
// ContextLiquidManager
// ---------------------------------------------------------------------------

/**
 * Manages focus-context–dependent panel styling.
 * Singleton per application. Notifies subscribers on state changes.
 */
export class ContextLiquidManager {
  private static instance: ContextLiquidManager | null = null;

  private focusContext: FocusContext;
  private previousContext: FocusContext | null;
  private transition: TransitionState;
  private config: ContextLiquidConfig;
  private subscribers: Set<() => void>;
  private lastChangeMs: number;
  /** Cache of resolved styles per panel for current (or transitioning) state. */
  private styleCache: Map<string, PanelStyle>;
  private styleCacheDirty: boolean;

  constructor() {
    this.focusContext = 'neutral';
    this.previousContext = null;
    this.transition = {
      active: false,
      from: 'neutral',
      to: 'neutral',
      progress: 1,
      durationMs: 0,
      startMs: 0,
    };
    this.config = {
      rules: buildDefaultRules(),
      transitionDurationMs: DEFAULT_TRANSITION_DURATION_MS,
      transitionsEnabled: true,
      defaultStyle: { ...DEFAULT_STYLE },
      enabled: true,
    };
    this.subscribers = new Set();
    this.lastChangeMs = 0;
    this.styleCache = new Map();
    this.styleCacheDirty = true;
  }

  /** Get or create the singleton instance. */
  static getInstance(): ContextLiquidManager {
    if (!ContextLiquidManager.instance) {
      ContextLiquidManager.instance = new ContextLiquidManager();
    }
    return ContextLiquidManager.instance;
  }

  /** Reset the singleton (for testing). */
  static resetInstance(): void {
    ContextLiquidManager.instance = null;
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
    this.styleCacheDirty = true;
    this.lastChangeMs = Date.now();
    this.subscribers.forEach((cb) => cb());
  }

  // -----------------------------------------------------------------------
  // Focus context
  // -----------------------------------------------------------------------

  /** Set the current focus context. Initiates transition if changed. */
  setFocusContext(context: FocusContext): void {
    if (context === this.focusContext) {
      return;
    }
    this.previousContext = this.focusContext;
    const from = this.focusContext;
    this.focusContext = context;

    if (this.config.transitionsEnabled && this.config.transitionDurationMs > 0) {
      this.transition = {
        active: true,
        from,
        to: context,
        progress: 0,
        durationMs: this.config.transitionDurationMs,
        startMs: Date.now(),
      };
    } else {
      this.transition = {
        active: false,
        from,
        to: context,
        progress: 1,
        durationMs: 0,
        startMs: Date.now(),
      };
    }

    this.notify();
  }

  /** Get the current focus context. */
  getFocusContext(): FocusContext {
    return this.focusContext;
  }

  /** Get the previous focus context. */
  getPreviousContext(): FocusContext | null {
    return this.previousContext;
  }

  /** Get all available focus contexts. */
  getAllContexts(): readonly FocusContext[] {
    return ALL_CONTEXTS;
  }

  // -----------------------------------------------------------------------
  // Panel styles
  // -----------------------------------------------------------------------

  /** Get the rule for a panel in a specific context. */
  private findRule(panelId: string, context: FocusContext): PanelContextRule | undefined {
    return this.config.rules.find((r) => r.panelId === panelId && r.context === context);
  }

  /** Resolve the target style for a panel in a context (no transition). */
  private resolveTargetStyle(panelId: string, context: FocusContext): PanelStyle {
    if (!this.config.enabled) {
      return { ...this.config.defaultStyle };
    }

    const rule = this.findRule(panelId, context);
    if (!rule) {
      return { ...this.config.defaultStyle };
    }

    return {
      opacity: rule.opacity,
      blur: rule.blur,
      scale: rule.scale,
      compact: rule.compact,
      contentHint: rule.contentHint,
    };
  }

  /** Get the current style for a panel, accounting for transitions. */
  getPanelStyle(panelId: string): PanelStyle {
    if (!this.config.enabled) {
      return { ...this.config.defaultStyle };
    }

    // Check cache
    if (!this.styleCacheDirty) {
      const cached = this.styleCache.get(panelId);
      if (cached) {
        return { ...cached };
      }
    }

    let style: PanelStyle;
    if (this.transition.active && this.transition.progress < 1) {
      const fromStyle = this.resolveTargetStyle(panelId, this.transition.from);
      const toStyle = this.resolveTargetStyle(panelId, this.transition.to);
      style = interpolateStyle(fromStyle, toStyle, this.transition.progress);
    } else {
      style = this.resolveTargetStyle(panelId, this.focusContext);
    }

    this.styleCache.set(panelId, style);
    return { ...style };
  }

  /** Get styles for all known panels. */
  getAllPanelStyles(): Record<string, PanelStyle> {
    const result: Record<string, PanelStyle> = {};
    const panelIds = new Set<string>();
    for (const rule of this.config.rules) {
      panelIds.add(rule.panelId);
    }
    panelIds.forEach((id) => {
      result[id] = this.getPanelStyle(id);
    });
    this.styleCacheDirty = false;
    return result;
  }

  /** Convert a PanelStyle to a CSS style object. */
  toCssStyle(style: PanelStyle): Record<string, string> {
    const css: Record<string, string> = {
      opacity: String(style.opacity),
      transform: `scale(${style.scale})`,
    };
    if (style.blur > 0) {
      css.filter = `blur(${style.blur}px)`;
    }
    css.transition = `opacity ${this.config.transitionDurationMs}ms ease, transform ${this.config.transitionDurationMs}ms ease, filter ${this.config.transitionDurationMs}ms ease`;
    return css;
  }

  // -----------------------------------------------------------------------
  // Transition management
  // -----------------------------------------------------------------------

  /** Advance transition progress. Returns true if still transitioning. */
  advanceTransition(deltaMs: number): boolean {
    if (!this.transition.active) {
      return false;
    }

    this.transition.progress = clamp(
      this.transition.progress + deltaMs / this.transition.durationMs,
      0,
      1,
    );

    if (this.transition.progress >= 1) {
      this.transition.active = false;
      this.transition.progress = 1;
    }

    this.notify();
    return this.transition.active;
  }

  /** Get current transition state. */
  getTransitionState(): TransitionState {
    return { ...this.transition };
  }

  /** Check if currently transitioning. */
  isTransitioning(): boolean {
    return this.transition.active;
  }

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  /** Set a rule for a panel in a context. Overwrites existing. */
  setRule(rule: PanelContextRule): void {
    const idx = this.config.rules.findIndex((r) => r.panelId === rule.panelId && r.context === rule.context);
    if (idx >= 0) {
      this.config.rules[idx] = { ...rule };
    } else {
      this.config.rules.push({ ...rule });
    }
    this.notify();
  }

  /** Remove a rule. */
  removeRule(panelId: string, context: FocusContext): void {
    this.config.rules = this.config.rules.filter(
      (r) => !(r.panelId === panelId && r.context === context),
    );
    this.notify();
  }

  /** Get all rules for a specific panel. */
  getRulesForPanel(panelId: string): PanelContextRule[] {
    return this.config.rules.filter((r) => r.panelId === panelId);
  }

  /** Get all rules for a specific context. */
  getRulesForContext(context: FocusContext): PanelContextRule[] {
    return this.config.rules.filter((r) => r.context === context);
  }

  /** Set transition duration. */
  setTransitionDuration(ms: number): void {
    this.config.transitionDurationMs = Math.max(0, ms);
    this.notify();
  }

  /** Toggle transitions. */
  setTransitionsEnabled(enabled: boolean): void {
    this.config.transitionsEnabled = enabled;
    this.notify();
  }

  /** Toggle the entire system. */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.notify();
  }

  /** Check if enabled. */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /** Get full config. */
  getConfig(): ContextLiquidConfig {
    return {
      rules: this.config.rules.map((r) => ({ ...r })),
      transitionDurationMs: this.config.transitionDurationMs,
      transitionsEnabled: this.config.transitionsEnabled,
      defaultStyle: { ...this.config.defaultStyle },
      enabled: this.config.enabled,
    };
  }

  // -----------------------------------------------------------------------
  // Full state
  // -----------------------------------------------------------------------

  /** Get complete state snapshot. */
  getState(): ContextLiquidState {
    return {
      focusContext: this.focusContext,
      previousContext: this.previousContext,
      transition: { ...this.transition },
      lastChangeMs: this.lastChangeMs,
    };
  }

  /** Get content hint for a panel in the current context. */
  getContentHint(panelId: string): string | null {
    const rule = this.findRule(panelId, this.focusContext);
    return rule?.contentHint ?? null;
  }

  /** Get all panels that have content hints in the current context. */
  getPanelsWithContentHints(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const rule of this.config.rules) {
      if (rule.context === this.focusContext && rule.contentHint) {
        result[rule.panelId] = rule.contentHint;
      }
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

/** React hook providing context-liquid UI state and controls. */
export function useContextLiquid() {
  const [state, setState] = useState<ContextLiquidState>(() => ContextLiquidManager.getInstance().getState());

  useEffect(() => {
    const manager = ContextLiquidManager.getInstance();
    setState(manager.getState());
    return manager.subscribe(() => {
      setState(manager.getState());
    });
  }, []);

  const setFocusContext = useCallback((context: FocusContext) => {
    ContextLiquidManager.getInstance().setFocusContext(context);
  }, []);

  const getPanelStyle = useCallback((panelId: string) => {
    return ContextLiquidManager.getInstance().getPanelStyle(panelId);
  }, []);

  const getAllPanelStyles = useCallback(() => {
    return ContextLiquidManager.getInstance().getAllPanelStyles();
  }, []);

  const toCssStyle = useCallback((style: PanelStyle) => {
    return ContextLiquidManager.getInstance().toCssStyle(style);
  }, []);

  const getContentHint = useCallback((panelId: string) => {
    return ContextLiquidManager.getInstance().getContentHint(panelId);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    ContextLiquidManager.getInstance().setEnabled(enabled);
  }, []);

  const advanceTransition = useCallback((deltaMs: number) => {
    return ContextLiquidManager.getInstance().advanceTransition(deltaMs);
  }, []);

  return {
    focusContext: state.focusContext,
    previousContext: state.previousContext,
    transition: state.transition,
    lastChangeMs: state.lastChangeMs,
    setFocusContext,
    getPanelStyle,
    getAllPanelStyles,
    toCssStyle,
    getContentHint,
    setEnabled,
    advanceTransition,
  };
}
