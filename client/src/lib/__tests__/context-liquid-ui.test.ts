import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ContextLiquidManager, useContextLiquid } from '../context-liquid-ui';
import type {
  FocusContext,
  PanelStyle,
  PanelContextRule,
  TransitionState,
  ContextLiquidState,
} from '../context-liquid-ui';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ContextLiquidManager', () => {
  let manager: ContextLiquidManager;

  beforeEach(() => {
    ContextLiquidManager.resetInstance();
    manager = ContextLiquidManager.getInstance();
  });

  afterEach(() => {
    ContextLiquidManager.resetInstance();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('Singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = ContextLiquidManager.getInstance();
      const b = ContextLiquidManager.getInstance();
      expect(a).toBe(b);
    });

    it('creates fresh instance after resetInstance', () => {
      manager.setFocusContext('code');
      ContextLiquidManager.resetInstance();
      const fresh = ContextLiquidManager.getInstance();
      expect(fresh.getFocusContext()).toBe('neutral');
    });
  });

  // -----------------------------------------------------------------------
  // Focus context
  // -----------------------------------------------------------------------

  describe('Focus context', () => {
    it('defaults to neutral', () => {
      expect(manager.getFocusContext()).toBe('neutral');
    });

    it('sets focus context', () => {
      manager.setFocusContext('schematic');
      expect(manager.getFocusContext()).toBe('schematic');
    });

    it('tracks previous context', () => {
      manager.setFocusContext('code');
      manager.setFocusContext('pcb');
      expect(manager.getPreviousContext()).toBe('code');
    });

    it('does not notify on same context', () => {
      manager.setFocusContext('chat');
      const callback = vi.fn();
      manager.subscribe(callback);
      manager.setFocusContext('chat');
      expect(callback).not.toHaveBeenCalled();
    });

    it('getAllContexts returns all 8 contexts', () => {
      const contexts = manager.getAllContexts();
      expect(contexts).toHaveLength(8);
      expect(contexts).toContain('code');
      expect(contexts).toContain('schematic');
      expect(contexts).toContain('pcb');
      expect(contexts).toContain('bom');
      expect(contexts).toContain('chat');
      expect(contexts).toContain('serial');
      expect(contexts).toContain('simulation');
      expect(contexts).toContain('neutral');
    });
  });

  // -----------------------------------------------------------------------
  // Panel styles — neutral context
  // -----------------------------------------------------------------------

  describe('Panel styles in neutral context', () => {
    it('all panels are fully opaque in neutral', () => {
      const style = manager.getPanelStyle('canvas');
      expect(style.opacity).toBe(1.0);
      expect(style.blur).toBe(0);
      expect(style.scale).toBe(1.0);
      expect(style.compact).toBe(false);
    });

    it('sidebar is full opacity in neutral', () => {
      expect(manager.getPanelStyle('sidebar').opacity).toBe(1.0);
    });

    it('chat is full opacity in neutral', () => {
      expect(manager.getPanelStyle('chat').opacity).toBe(1.0);
    });
  });

  // -----------------------------------------------------------------------
  // Panel styles — focused contexts
  // -----------------------------------------------------------------------

  describe('Panel styles in focused contexts', () => {
    it('chat panel is primary in chat context', () => {
      manager.setFocusContext('chat');
      manager.advanceTransition(1000); // complete transition
      const style = manager.getPanelStyle('chat');
      expect(style.opacity).toBe(1.0);
      expect(style.blur).toBe(0);
      expect(style.compact).toBe(false);
    });

    it('chat panel is background in schematic context', () => {
      manager.setFocusContext('schematic');
      manager.advanceTransition(1000);
      const style = manager.getPanelStyle('chat');
      expect(style.opacity).toBeLessThan(1.0);
      expect(style.blur).toBeGreaterThan(0);
      expect(style.compact).toBe(true);
    });

    it('canvas is primary in schematic context', () => {
      manager.setFocusContext('schematic');
      manager.advanceTransition(1000);
      const style = manager.getPanelStyle('canvas');
      expect(style.opacity).toBe(1.0);
    });

    it('output is primary in serial context', () => {
      manager.setFocusContext('serial');
      manager.advanceTransition(1000);
      const style = manager.getPanelStyle('output');
      expect(style.opacity).toBe(1.0);
    });

    it('properties is related in schematic context', () => {
      manager.setFocusContext('schematic');
      manager.advanceTransition(1000);
      const style = manager.getPanelStyle('properties');
      expect(style.opacity).toBe(0.75);
    });

    it('minimap is background in code context', () => {
      manager.setFocusContext('code');
      manager.advanceTransition(1000);
      const style = manager.getPanelStyle('minimap');
      expect(style.opacity).toBe(0.4);
      expect(style.blur).toBe(2);
      expect(style.scale).toBe(0.95);
    });

    it('explorer is related in code context', () => {
      manager.setFocusContext('code');
      manager.advanceTransition(1000);
      const style = manager.getPanelStyle('explorer');
      expect(style.opacity).toBe(0.75);
    });

    it('sidebar is related in pcb context', () => {
      manager.setFocusContext('pcb');
      manager.advanceTransition(1000);
      const style = manager.getPanelStyle('sidebar');
      expect(style.opacity).toBe(0.75);
    });

    it('canvas is primary in simulation context', () => {
      manager.setFocusContext('simulation');
      manager.advanceTransition(1000);
      const style = manager.getPanelStyle('canvas');
      expect(style.opacity).toBe(1.0);
    });

    it('sidebar is primary in bom context', () => {
      manager.setFocusContext('bom');
      manager.advanceTransition(1000);
      const style = manager.getPanelStyle('sidebar');
      expect(style.opacity).toBe(1.0);
    });
  });

  // -----------------------------------------------------------------------
  // Content hints
  // -----------------------------------------------------------------------

  describe('Content hints', () => {
    it('chat has circuit-suggestions hint in schematic context', () => {
      manager.setFocusContext('schematic');
      expect(manager.getContentHint('chat')).toBe('circuit-suggestions');
    });

    it('chat has layout-tips hint in pcb context', () => {
      manager.setFocusContext('pcb');
      expect(manager.getContentHint('chat')).toBe('layout-tips');
    });

    it('chat has sim-analysis hint in simulation context', () => {
      manager.setFocusContext('simulation');
      expect(manager.getContentHint('chat')).toBe('sim-analysis');
    });

    it('properties has part-details hint in bom context', () => {
      manager.setFocusContext('bom');
      expect(manager.getContentHint('properties')).toBe('part-details');
    });

    it('sidebar has port-list hint in serial context', () => {
      manager.setFocusContext('serial');
      expect(manager.getContentHint('sidebar')).toBe('port-list');
    });

    it('output has build-output hint in code context', () => {
      manager.setFocusContext('code');
      expect(manager.getContentHint('output')).toBe('build-output');
    });

    it('output has waveform-viewer hint in simulation context', () => {
      manager.setFocusContext('simulation');
      expect(manager.getContentHint('output')).toBe('waveform-viewer');
    });

    it('unknown panel returns null content hint', () => {
      expect(manager.getContentHint('nonexistent')).toBeNull();
    });

    it('getPanelsWithContentHints returns map for context', () => {
      manager.setFocusContext('code');
      const hints = manager.getPanelsWithContentHints();
      expect(hints['output']).toBe('build-output');
      expect(hints['explorer']).toBe('file-tree');
    });
  });

  // -----------------------------------------------------------------------
  // Transitions
  // -----------------------------------------------------------------------

  describe('Transitions', () => {
    it('starts transition on context change', () => {
      manager.setFocusContext('code');
      expect(manager.isTransitioning()).toBe(true);
      const state = manager.getTransitionState();
      expect(state.from).toBe('neutral');
      expect(state.to).toBe('code');
      expect(state.progress).toBe(0);
    });

    it('advanceTransition progresses toward completion', () => {
      manager.setFocusContext('code');
      const still = manager.advanceTransition(100);
      expect(still).toBe(true);
      expect(manager.getTransitionState().progress).toBeGreaterThan(0);
    });

    it('advanceTransition completes transition', () => {
      manager.setFocusContext('code');
      manager.advanceTransition(500); // exceed 200ms duration
      expect(manager.isTransitioning()).toBe(false);
      expect(manager.getTransitionState().progress).toBe(1);
    });

    it('advanceTransition returns false when not transitioning', () => {
      expect(manager.advanceTransition(100)).toBe(false);
    });

    it('panel style interpolates during transition', () => {
      manager.setFocusContext('code'); // chat goes from primary (neutral) to background
      // Don't advance — progress is 0, should still be close to neutral style
      const style = manager.getPanelStyle('chat');
      // At progress 0, easeInOutCubic(0)=0, so style = from (neutral) values
      expect(style.opacity).toBe(1.0);
    });

    it('panel style reaches target after transition completes', () => {
      manager.setFocusContext('code');
      manager.advanceTransition(500);
      const style = manager.getPanelStyle('chat');
      expect(style.opacity).toBe(0.4);
      expect(style.blur).toBe(2);
    });

    it('transitions disabled gives instant changes', () => {
      manager.setTransitionsEnabled(false);
      manager.setFocusContext('code');
      expect(manager.isTransitioning()).toBe(false);
      const style = manager.getPanelStyle('chat');
      expect(style.opacity).toBe(0.4);
    });

    it('setTransitionDuration changes duration', () => {
      manager.setTransitionDuration(500);
      manager.setFocusContext('code');
      manager.advanceTransition(200); // not yet done at 500ms
      expect(manager.isTransitioning()).toBe(true);
      manager.advanceTransition(400);
      expect(manager.isTransitioning()).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // CSS style conversion
  // -----------------------------------------------------------------------

  describe('CSS style conversion', () => {
    it('toCssStyle produces correct properties', () => {
      const style: PanelStyle = { opacity: 0.5, blur: 3, scale: 0.9, compact: true, contentHint: null };
      const css = manager.toCssStyle(style);
      expect(css.opacity).toBe('0.5');
      expect(css.transform).toBe('scale(0.9)');
      expect(css.filter).toBe('blur(3px)');
      expect(css.transition).toContain('ease');
    });

    it('toCssStyle omits filter when blur is 0', () => {
      const style: PanelStyle = { opacity: 1, blur: 0, scale: 1, compact: false, contentHint: null };
      const css = manager.toCssStyle(style);
      expect(css.filter).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  describe('Configuration', () => {
    it('setRule adds a new rule', () => {
      manager.setRule({
        panelId: 'custom-panel',
        context: 'code',
        opacity: 0.8,
        blur: 1,
        scale: 0.98,
        compact: false,
        contentHint: 'custom-hint',
      });
      manager.setFocusContext('code');
      manager.advanceTransition(500);
      const style = manager.getPanelStyle('custom-panel');
      expect(style.opacity).toBe(0.8);
    });

    it('setRule overwrites existing rule', () => {
      manager.setRule({
        panelId: 'chat',
        context: 'schematic',
        opacity: 0.9,
        blur: 0,
        scale: 1.0,
        compact: false,
        contentHint: 'new-hint',
      });
      manager.setFocusContext('schematic');
      manager.advanceTransition(500);
      const style = manager.getPanelStyle('chat');
      expect(style.opacity).toBe(0.9);
      expect(manager.getContentHint('chat')).toBe('new-hint');
    });

    it('removeRule removes a rule', () => {
      manager.removeRule('chat', 'schematic');
      manager.setFocusContext('schematic');
      manager.advanceTransition(500);
      // Falls back to default style
      const style = manager.getPanelStyle('chat');
      expect(style.opacity).toBe(1.0);
    });

    it('getRulesForPanel returns rules for a panel', () => {
      const rules = manager.getRulesForPanel('chat');
      expect(rules.length).toBeGreaterThanOrEqual(8); // one per context
    });

    it('getRulesForContext returns rules for a context', () => {
      const rules = manager.getRulesForContext('code');
      expect(rules.length).toBeGreaterThanOrEqual(8); // one per panel
    });

    it('setEnabled toggles system', () => {
      manager.setEnabled(false);
      expect(manager.isEnabled()).toBe(false);
      // When disabled, all panels get default style
      manager.setFocusContext('code');
      const style = manager.getPanelStyle('chat');
      expect(style.opacity).toBe(1.0);
    });

    it('getConfig returns full config copy', () => {
      const config = manager.getConfig();
      expect(config.rules.length).toBeGreaterThan(0);
      expect(config.transitionDurationMs).toBe(200);
      expect(config.transitionsEnabled).toBe(true);
      expect(config.enabled).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  describe('Subscription', () => {
    it('notifies on context change', () => {
      const callback = vi.fn();
      manager.subscribe(callback);
      manager.setFocusContext('pcb');
      expect(callback).toHaveBeenCalled();
    });

    it('unsubscribe stops notifications', () => {
      const callback = vi.fn();
      const unsub = manager.subscribe(callback);
      unsub();
      manager.setFocusContext('bom');
      expect(callback).not.toHaveBeenCalled();
    });

    it('notifies on transition advance', () => {
      manager.setFocusContext('code');
      const callback = vi.fn();
      manager.subscribe(callback);
      manager.advanceTransition(50);
      expect(callback).toHaveBeenCalled();
    });

    it('notifies on config change', () => {
      const callback = vi.fn();
      manager.subscribe(callback);
      manager.setTransitionDuration(500);
      expect(callback).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Default style fallback
  // -----------------------------------------------------------------------

  describe('Default style fallback', () => {
    it('unknown panel returns default style', () => {
      manager.setFocusContext('code');
      manager.advanceTransition(500);
      const style = manager.getPanelStyle('some-unknown-panel');
      expect(style.opacity).toBe(1.0);
      expect(style.blur).toBe(0);
      expect(style.scale).toBe(1.0);
    });
  });

  // -----------------------------------------------------------------------
  // State snapshot
  // -----------------------------------------------------------------------

  describe('State snapshot', () => {
    it('getState returns full state', () => {
      manager.setFocusContext('serial');
      const state = manager.getState();
      expect(state.focusContext).toBe('serial');
      expect(state.previousContext).toBe('neutral');
      expect(state.transition.to).toBe('serial');
      expect(state.lastChangeMs).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // getAllPanelStyles
  // -----------------------------------------------------------------------

  describe('getAllPanelStyles', () => {
    it('returns styles for all known panels', () => {
      const styles = manager.getAllPanelStyles();
      expect(Object.keys(styles)).toContain('sidebar');
      expect(Object.keys(styles)).toContain('chat');
      expect(Object.keys(styles)).toContain('canvas');
      expect(Object.keys(styles)).toContain('toolbar');
    });

    it('each style has required fields', () => {
      const styles = manager.getAllPanelStyles();
      for (const [_id, style] of Object.entries(styles)) {
        expect(typeof style.opacity).toBe('number');
        expect(typeof style.blur).toBe('number');
        expect(typeof style.scale).toBe('number');
        expect(typeof style.compact).toBe('boolean');
      }
    });
  });
});

// ---------------------------------------------------------------------------
// React hook tests
// ---------------------------------------------------------------------------

describe('useContextLiquid', () => {
  beforeEach(() => {
    ContextLiquidManager.resetInstance();
  });

  afterEach(() => {
    ContextLiquidManager.resetInstance();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useContextLiquid());
    expect(result.current.focusContext).toBe('neutral');
    expect(result.current.previousContext).toBeNull();
  });

  it('setFocusContext updates state', () => {
    const { result } = renderHook(() => useContextLiquid());
    act(() => {
      result.current.setFocusContext('pcb');
    });
    expect(result.current.focusContext).toBe('pcb');
    expect(result.current.previousContext).toBe('neutral');
  });

  it('getPanelStyle returns style object', () => {
    const { result } = renderHook(() => useContextLiquid());
    const style = result.current.getPanelStyle('canvas');
    expect(style.opacity).toBe(1.0);
  });

  it('getAllPanelStyles returns full map', () => {
    const { result } = renderHook(() => useContextLiquid());
    const styles = result.current.getAllPanelStyles();
    expect(Object.keys(styles).length).toBeGreaterThan(0);
  });

  it('toCssStyle converts to CSS', () => {
    const { result } = renderHook(() => useContextLiquid());
    const style: PanelStyle = { opacity: 0.6, blur: 1, scale: 0.95, compact: false, contentHint: null };
    const css = result.current.toCssStyle(style);
    expect(css.opacity).toBe('0.6');
  });

  it('getContentHint works via hook', () => {
    const { result } = renderHook(() => useContextLiquid());
    act(() => {
      result.current.setFocusContext('schematic');
    });
    expect(result.current.getContentHint('chat')).toBe('circuit-suggestions');
  });

  it('setEnabled toggles via hook', () => {
    const { result } = renderHook(() => useContextLiquid());
    act(() => {
      result.current.setEnabled(false);
    });
    // All panels get default style when disabled
    const style = result.current.getPanelStyle('chat');
    expect(style.opacity).toBe(1.0);
  });

  it('advanceTransition via hook', () => {
    const { result } = renderHook(() => useContextLiquid());
    act(() => {
      result.current.setFocusContext('code');
    });
    expect(result.current.transition.active).toBe(true);
    act(() => {
      result.current.advanceTransition(500);
    });
    expect(result.current.transition.active).toBe(false);
  });

  it('transition state exposed correctly', () => {
    const { result } = renderHook(() => useContextLiquid());
    act(() => {
      result.current.setFocusContext('serial');
    });
    expect(result.current.transition.from).toBe('neutral');
    expect(result.current.transition.to).toBe('serial');
  });
});
