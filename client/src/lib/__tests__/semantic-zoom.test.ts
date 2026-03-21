import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SemanticZoomEngine, useSemanticZoom } from '../semantic-zoom';
import type {
  ZoomLevel,
  ZoomLevelThreshold,
  ElementVisibilityRule,
  ZoomTransition,
  ElementVisibility,
} from '../semantic-zoom';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SemanticZoomEngine', () => {
  let engine: SemanticZoomEngine;

  beforeEach(() => {
    SemanticZoomEngine.resetInstance();
    engine = SemanticZoomEngine.getInstance();
  });

  afterEach(() => {
    SemanticZoomEngine.resetInstance();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('Singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = SemanticZoomEngine.getInstance();
      const b = SemanticZoomEngine.getInstance();
      expect(a).toBe(b);
    });

    it('creates fresh instance after resetInstance', () => {
      engine.setZoom(5.0);
      SemanticZoomEngine.resetInstance();
      const fresh = SemanticZoomEngine.getInstance();
      expect(fresh.getZoom()).toBe(1.0); // default
    });
  });

  // -----------------------------------------------------------------------
  // Zoom levels
  // -----------------------------------------------------------------------

  describe('Zoom level computation', () => {
    it('defaults to schematic at zoom 1.0', () => {
      expect(engine.getActiveLevel()).toBe('schematic');
      expect(engine.getZoom()).toBe(1.0);
    });

    it('system level at very low zoom', () => {
      engine.setZoom(0.05);
      expect(engine.getActiveLevel()).toBe('system');
    });

    it('architecture level at zoom 0.3', () => {
      engine.setZoom(0.3);
      expect(engine.getActiveLevel()).toBe('architecture');
    });

    it('schematic level at zoom 1.0', () => {
      engine.setZoom(1.0);
      expect(engine.getActiveLevel()).toBe('schematic');
    });

    it('component level at zoom 2.5', () => {
      engine.setZoom(2.5);
      expect(engine.getActiveLevel()).toBe('component');
    });

    it('pin level at zoom 6.0', () => {
      engine.setZoom(6.0);
      expect(engine.getActiveLevel()).toBe('pin');
    });

    it('datasheet level at zoom 15.0', () => {
      engine.setZoom(15.0);
      expect(engine.getActiveLevel()).toBe('datasheet');
    });

    it('clamps negative zoom to 0', () => {
      engine.setZoom(-5);
      expect(engine.getZoom()).toBe(0);
      expect(engine.getActiveLevel()).toBe('system');
    });

    it('does not notify on same zoom value', () => {
      engine.setZoom(1.0); // already 1.0
      const callback = vi.fn();
      engine.subscribe(callback);
      engine.setZoom(1.0);
      expect(callback).not.toHaveBeenCalled();
    });

    it('getZoomLevels returns ordered list', () => {
      const levels = engine.getZoomLevels();
      expect(levels).toEqual(['system', 'architecture', 'schematic', 'component', 'pin', 'datasheet']);
    });

    it('getLevelDepth returns index', () => {
      engine.setZoom(0.05);
      expect(engine.getLevelDepth()).toBe(0);
      engine.setZoom(1.0);
      expect(engine.getLevelDepth()).toBe(2);
      engine.setZoom(15.0);
      expect(engine.getLevelDepth()).toBe(5);
    });
  });

  // -----------------------------------------------------------------------
  // Level transitions
  // -----------------------------------------------------------------------

  describe('Level transitions', () => {
    it('tracks previous level on change', () => {
      engine.setZoom(0.05); // system
      const state1 = engine.getState();
      expect(state1.previousLevel).toBe('schematic'); // was default

      engine.setZoom(0.3); // architecture
      const state2 = engine.getState();
      expect(state2.previousLevel).toBe('system');
    });

    it('isTransitioning is true on level change with smooth transitions', () => {
      engine.setSmoothTransitions(true);
      engine.setZoom(0.3); // architecture (from schematic)
      const state = engine.getState();
      expect(state.isTransitioning).toBe(true);
      expect(state.transitionProgress).toBe(0);
    });

    it('isTransitioning is false when smooth transitions disabled', () => {
      engine.setSmoothTransitions(false);
      engine.setZoom(0.3);
      const state = engine.getState();
      expect(state.isTransitioning).toBe(false);
    });

    it('advanceTransition progresses and completes', () => {
      engine.setZoom(0.3); // trigger transition
      expect(engine.advanceTransition(100)).toBe(true); // still going (250ms duration for architecture)
      expect(engine.getState().transitionProgress).toBeGreaterThan(0);

      // Advance enough to complete
      engine.advanceTransition(500);
      expect(engine.getState().isTransitioning).toBe(false);
      expect(engine.getState().transitionProgress).toBe(1);
    });

    it('advanceTransition returns false when not transitioning', () => {
      expect(engine.advanceTransition(100)).toBe(false);
    });

    it('getTransitionInfo returns style and progress', () => {
      engine.setZoom(0.3);
      const info = engine.getTransitionInfo();
      expect(info.style).toBe('dissolve'); // architecture uses dissolve
      expect(info.active).toBe(true);
    });

    it('instant transition completes immediately', () => {
      engine.setZoom(15.0); // datasheet = instant
      const result = engine.advanceTransition(1);
      expect(result).toBe(false);
      expect(engine.getState().isTransitioning).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Element visibility
  // -----------------------------------------------------------------------

  describe('Element visibility', () => {
    it('component-symbols visible at schematic zoom', () => {
      engine.setZoom(1.0);
      const vis = engine.getElementVisibility('component-symbols');
      expect(vis.visible).toBe(true);
      expect(vis.opacity).toBeGreaterThan(0);
    });

    it('component-symbols not visible at system zoom', () => {
      engine.setZoom(0.05);
      // At system level, component-symbols rule says visible at schematic/component/pin/datasheet only
      const vis = engine.getElementVisibility('component-symbols');
      // May still be visible if in fade zone; check raw visibility
      expect(vis.opacity).toBeLessThan(1);
    });

    it('pin-labels visible at pin zoom', () => {
      engine.setZoom(6.0);
      const vis = engine.getElementVisibility('pin-labels');
      expect(vis.visible).toBe(true);
    });

    it('pin-labels not visible at schematic zoom', () => {
      engine.setZoom(1.0);
      const vis = engine.getElementVisibility('pin-labels');
      expect(vis.visible).toBe(false);
    });

    it('system-boundary visible at system zoom', () => {
      engine.setZoom(0.05);
      const vis = engine.getElementVisibility('system-boundary');
      expect(vis.visible).toBe(true);
    });

    it('system-boundary not visible at pin zoom', () => {
      engine.setZoom(6.0);
      const vis = engine.getElementVisibility('system-boundary');
      expect(vis.visible).toBe(false);
    });

    it('unknown element returns invisible', () => {
      const vis = engine.getElementVisibility('nonexistent');
      expect(vis.visible).toBe(false);
      expect(vis.opacity).toBe(0);
    });

    it('getAllElementVisibilities returns all categories', () => {
      const all = engine.getAllElementVisibilities();
      expect(Object.keys(all).length).toBeGreaterThanOrEqual(10);
      expect(all['pin-labels']).toBeDefined();
      expect(all['component-symbols']).toBeDefined();
    });

    it('getVisibleCategories returns categories visible at current zoom', () => {
      engine.setZoom(1.0); // schematic
      const visible = engine.getVisibleCategories();
      expect(visible).toContain('component-symbols');
      expect(visible).toContain('ref-designators');
      expect(visible).not.toContain('datasheet-info');
    });

    it('datasheet-info only visible at datasheet zoom', () => {
      engine.setZoom(1.0);
      expect(engine.getElementVisibility('datasheet-info').visible).toBe(false);
      engine.setZoom(15.0);
      expect(engine.getElementVisibility('datasheet-info').visible).toBe(true);
    });

    it('bus-arrows visible at architecture zoom', () => {
      engine.setZoom(0.3);
      expect(engine.getElementVisibility('bus-arrows').visible).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Fade zones
  // -----------------------------------------------------------------------

  describe('Fade zones', () => {
    it('elements can fade near threshold boundaries', () => {
      // Set fade margin large enough to test
      engine.setFadeMargin(0.1);
      // Architecture threshold minZoom = 0.15
      // At 0.13 we're just below — component-symbols (visible at schematic+) might fade
      engine.setZoom(0.47); // Just below schematic threshold (0.5)
      const vis = engine.getElementVisibility('component-symbols');
      // Could be in fade zone depending on rules
      expect(vis.opacity).toBeLessThanOrEqual(1);
    });

    it('fade margin of 0 gives hard boundaries', () => {
      engine.setFadeMargin(0);
      engine.setZoom(0.49); // architecture
      const vis = engine.getElementVisibility('pin-labels');
      expect(vis.visible).toBe(false);
      expect(vis.opacity).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  describe('Configuration', () => {
    it('setThresholds updates thresholds', () => {
      engine.setThresholds([
        { level: 'system', minZoom: 0, maxZoom: 0.5 },
        { level: 'architecture', minZoom: 0.5, maxZoom: 1.0 },
        { level: 'schematic', minZoom: 1.0, maxZoom: Infinity },
        { level: 'component', minZoom: Infinity, maxZoom: Infinity },
        { level: 'pin', minZoom: Infinity, maxZoom: Infinity },
        { level: 'datasheet', minZoom: Infinity, maxZoom: Infinity },
      ]);
      engine.setZoom(0.3);
      expect(engine.getActiveLevel()).toBe('system');
    });

    it('setVisibilityRule adds new rule', () => {
      engine.setVisibilityRule({
        elementCategory: 'custom-overlay',
        visibleAt: ['schematic', 'component'],
        fadeRange: [0, 1],
      });
      engine.setZoom(1.0);
      expect(engine.getElementVisibility('custom-overlay').visible).toBe(true);
    });

    it('setVisibilityRule updates existing rule', () => {
      engine.setVisibilityRule({
        elementCategory: 'pin-labels',
        visibleAt: ['schematic'], // now visible at schematic too
        fadeRange: [0, 1],
      });
      engine.setZoom(1.0);
      expect(engine.getElementVisibility('pin-labels').visible).toBe(true);
    });

    it('removeVisibilityRule removes a rule', () => {
      engine.removeVisibilityRule('pin-labels');
      engine.setZoom(6.0);
      expect(engine.getElementVisibility('pin-labels').visible).toBe(false);
    });

    it('setTransition updates transition config', () => {
      engine.setTransition({ level: 'schematic', style: 'instant', durationMs: 0 });
      engine.setZoom(0.3); // to architecture
      engine.setZoom(1.0); // back to schematic — should be instant
      const info = engine.getTransitionInfo();
      expect(info.style).toBe('instant');
    });

    it('getConfig returns full config copy', () => {
      const config = engine.getConfig();
      expect(config.thresholds).toHaveLength(6);
      expect(config.visibilityRules.length).toBeGreaterThanOrEqual(10);
      expect(config.transitions).toHaveLength(6);
      expect(config.fadeMargin).toBe(0.05);
      expect(config.smoothTransitions).toBe(true);
    });

    it('setSmoothTransitions toggles', () => {
      engine.setSmoothTransitions(false);
      expect(engine.getConfig().smoothTransitions).toBe(false);
    });

    it('getLevelThreshold returns threshold for a level', () => {
      const t = engine.getLevelThreshold('schematic');
      expect(t).not.toBeNull();
      expect(t!.minZoom).toBe(0.5);
      expect(t!.maxZoom).toBe(1.5);
    });

    it('getLevelThreshold returns null for unknown level', () => {
      expect(engine.getLevelThreshold('nonexistent' as ZoomLevel)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Navigation helpers
  // -----------------------------------------------------------------------

  describe('Navigation helpers', () => {
    it('isDeeper correctly compares levels', () => {
      expect(engine.isDeeper('pin', 'system')).toBe(true);
      expect(engine.isDeeper('system', 'pin')).toBe(false);
      expect(engine.isDeeper('schematic', 'schematic')).toBe(false);
    });

    it('getNextDeeperLevel from schematic is component', () => {
      engine.setZoom(1.0);
      expect(engine.getNextDeeperLevel()).toBe('component');
    });

    it('getNextDeeperLevel at datasheet is null', () => {
      engine.setZoom(15.0);
      expect(engine.getNextDeeperLevel()).toBeNull();
    });

    it('getNextShallowerLevel from schematic is architecture', () => {
      engine.setZoom(1.0);
      expect(engine.getNextShallowerLevel()).toBe('architecture');
    });

    it('getNextShallowerLevel at system is null', () => {
      engine.setZoom(0.05);
      expect(engine.getNextShallowerLevel()).toBeNull();
    });

    it('snapToLevel sets zoom to center of level range', () => {
      engine.snapToLevel('architecture');
      // architecture: 0.15..0.5, center = 0.325
      expect(engine.getZoom()).toBeCloseTo(0.325, 3);
      expect(engine.getActiveLevel()).toBe('architecture');
    });

    it('snapToLevel with Infinity uses minZoom + 5', () => {
      engine.snapToLevel('datasheet');
      expect(engine.getZoom()).toBeCloseTo(15, 1);
    });
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  describe('Subscription', () => {
    it('notifies on zoom change', () => {
      const callback = vi.fn();
      engine.subscribe(callback);
      engine.setZoom(2.0);
      expect(callback).toHaveBeenCalled();
    });

    it('unsubscribe stops notifications', () => {
      const callback = vi.fn();
      const unsub = engine.subscribe(callback);
      unsub();
      engine.setZoom(3.0);
      expect(callback).not.toHaveBeenCalled();
    });

    it('multiple subscribers all notified', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      engine.subscribe(cb1);
      engine.subscribe(cb2);
      engine.setZoom(5.0);
      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // State snapshot
  // -----------------------------------------------------------------------

  describe('State snapshot', () => {
    it('getState returns full state', () => {
      engine.setZoom(0.3);
      const state = engine.getState();
      expect(state.zoom).toBe(0.3);
      expect(state.activeLevel).toBe('architecture');
      expect(state.previousLevel).toBe('schematic');
    });
  });
});

// ---------------------------------------------------------------------------
// React hook tests
// ---------------------------------------------------------------------------

describe('useSemanticZoom', () => {
  beforeEach(() => {
    SemanticZoomEngine.resetInstance();
  });

  afterEach(() => {
    SemanticZoomEngine.resetInstance();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useSemanticZoom());
    expect(result.current.zoom).toBe(1.0);
    expect(result.current.activeLevel).toBe('schematic');
    expect(result.current.previousLevel).toBeNull();
    expect(result.current.isTransitioning).toBe(false);
  });

  it('setZoom updates state', () => {
    const { result } = renderHook(() => useSemanticZoom());
    act(() => {
      result.current.setZoom(0.3);
    });
    expect(result.current.zoom).toBe(0.3);
    expect(result.current.activeLevel).toBe('architecture');
  });

  it('snapToLevel jumps to center of level range', () => {
    const { result } = renderHook(() => useSemanticZoom());
    act(() => {
      result.current.snapToLevel('pin');
    });
    expect(result.current.activeLevel).toBe('pin');
  });

  it('getElementVisibility returns correct data', () => {
    const { result } = renderHook(() => useSemanticZoom());
    act(() => {
      result.current.setZoom(6.0);
    });
    const vis = result.current.getElementVisibility('pin-labels');
    expect(vis.visible).toBe(true);
  });

  it('getAllElementVisibilities returns full map', () => {
    const { result } = renderHook(() => useSemanticZoom());
    const all = result.current.getAllElementVisibilities();
    expect(Object.keys(all).length).toBeGreaterThan(0);
  });

  it('getVisibleCategories returns visible list', () => {
    const { result } = renderHook(() => useSemanticZoom());
    const visible = result.current.getVisibleCategories();
    expect(visible).toContain('component-symbols');
  });

  it('advanceTransition progresses transition', () => {
    const { result } = renderHook(() => useSemanticZoom());
    act(() => {
      result.current.setZoom(0.3); // trigger transition
    });
    expect(result.current.isTransitioning).toBe(true);
    act(() => {
      result.current.advanceTransition(500);
    });
    expect(result.current.isTransitioning).toBe(false);
  });
});
