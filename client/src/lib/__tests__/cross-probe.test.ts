import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { CrossProbeManager, useCrossProbe } from '../cross-probe';

describe('CrossProbeManager', () => {
  let manager: CrossProbeManager;

  beforeEach(() => {
    CrossProbeManager.resetInstance();
    manager = CrossProbeManager.getInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  it('returns the same instance on repeated calls', () => {
    const a = CrossProbeManager.getInstance();
    const b = CrossProbeManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetInstance', () => {
    const a = CrossProbeManager.getInstance();
    a.highlightNet('VCC', 'schematic');
    CrossProbeManager.resetInstance();
    const b = CrossProbeManager.getInstance();
    expect(b.isNetHighlighted('VCC')).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Net highlighting
  // -----------------------------------------------------------------------

  it('highlights a single net', () => {
    manager.highlightNet('VCC', 'schematic');
    expect(manager.isNetHighlighted('VCC')).toBe(true);
    expect(manager.getHighlightedNets()).toEqual(['VCC']);
  });

  it('highlights multiple nets', () => {
    manager.highlightNet('VCC', 'schematic');
    manager.highlightNet('GND', 'schematic');
    expect(manager.isNetHighlighted('VCC')).toBe(true);
    expect(manager.isNetHighlighted('GND')).toBe(true);
    expect(manager.getHighlightedNets()).toHaveLength(2);
  });

  it('does not duplicate a net when highlighted twice', () => {
    manager.highlightNet('VCC', 'schematic');
    manager.highlightNet('VCC', 'pcb');
    expect(manager.getHighlightedNets()).toEqual(['VCC']);
  });

  it('reports false for non-highlighted net', () => {
    expect(manager.isNetHighlighted('MISO')).toBe(false);
  });

  it('toggles net highlight on', () => {
    manager.toggleNet('VCC', 'schematic');
    expect(manager.isNetHighlighted('VCC')).toBe(true);
  });

  it('toggles net highlight off', () => {
    manager.highlightNet('VCC', 'schematic');
    manager.toggleNet('VCC', 'schematic');
    expect(manager.isNetHighlighted('VCC')).toBe(false);
  });

  it('supports multi-net selection via toggle', () => {
    manager.toggleNet('VCC', 'schematic');
    manager.toggleNet('GND', 'schematic');
    manager.toggleNet('SDA', 'schematic');
    expect(manager.getHighlightedNets()).toHaveLength(3);

    // Toggle one off
    manager.toggleNet('GND', 'schematic');
    expect(manager.getHighlightedNets()).toHaveLength(2);
    expect(manager.isNetHighlighted('GND')).toBe(false);
  });

  it('clears only nets', () => {
    manager.highlightNet('VCC', 'schematic');
    manager.highlightComponent('U1', 'schematic');
    manager.clearNets();
    expect(manager.getHighlightedNets()).toHaveLength(0);
    expect(manager.isComponentHighlighted('U1')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Component highlighting
  // -----------------------------------------------------------------------

  it('highlights a component', () => {
    manager.highlightComponent('U1', 'pcb');
    expect(manager.isComponentHighlighted('U1')).toBe(true);
    expect(manager.getHighlightedComponents()).toEqual(['U1']);
  });

  it('reports false for non-highlighted component', () => {
    expect(manager.isComponentHighlighted('R42')).toBe(false);
  });

  it('clears only components', () => {
    manager.highlightNet('VCC', 'schematic');
    manager.highlightComponent('U1', 'schematic');
    manager.clearComponents();
    expect(manager.getHighlightedComponents()).toHaveLength(0);
    expect(manager.isNetHighlighted('VCC')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Source view tracking
  // -----------------------------------------------------------------------

  it('tracks source view for net highlight', () => {
    manager.highlightNet('VCC', 'schematic');
    expect(manager.getSourceView()).toBe('schematic');
  });

  it('tracks source view for component highlight', () => {
    manager.highlightComponent('U1', 'pcb');
    expect(manager.getSourceView()).toBe('pcb');
  });

  it('updates source view on subsequent highlights', () => {
    manager.highlightNet('VCC', 'schematic');
    manager.highlightComponent('U1', 'pcb');
    expect(manager.getSourceView()).toBe('pcb');
  });

  it('returns null source view when nothing highlighted', () => {
    expect(manager.getSourceView()).toBeNull();
  });

  // -----------------------------------------------------------------------
  // clearAll
  // -----------------------------------------------------------------------

  it('clears all highlighting', () => {
    manager.highlightNet('VCC', 'schematic');
    manager.highlightNet('GND', 'schematic');
    manager.highlightComponent('U1', 'schematic');
    manager.clearAll();
    expect(manager.getHighlightedNets()).toHaveLength(0);
    expect(manager.getHighlightedComponents()).toHaveLength(0);
    expect(manager.getSourceView()).toBeNull();
  });

  it('clearAll is safe to call when already empty', () => {
    expect(() => {
      manager.clearAll();
    }).not.toThrow();
  });

  // -----------------------------------------------------------------------
  // Net color
  // -----------------------------------------------------------------------

  it('returns a deterministic color for a net ID', () => {
    const color1 = manager.getNetColor('VCC');
    const color2 = manager.getNetColor('VCC');
    expect(color1).toBe(color2);
  });

  it('returns different colors for different net IDs', () => {
    const color1 = manager.getNetColor('VCC');
    const color2 = manager.getNetColor('GND');
    // Different IDs should (very likely) produce different colors
    // This could theoretically collide but is extremely unlikely for these specific strings
    expect(color1).not.toBe(color2);
  });

  it('returns a valid CSS color string', () => {
    const color = manager.getNetColor('SDA');
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('returns colors from a palette of known values', () => {
    const knownColors = [
      '#FF4136', '#2ECC40', '#0074D9', '#FFDC00', '#FF851B', '#B10DC9',
      '#7FDBFF', '#F012BE', '#01FF70', '#39CCCC', '#85144b', '#FF6384',
    ];
    const color = manager.getNetColor('MOSI');
    expect(knownColors).toContain(color);
  });

  // -----------------------------------------------------------------------
  // Subscribe / unsubscribe
  // -----------------------------------------------------------------------

  it('calls subscriber on state change', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.highlightNet('VCC', 'schematic');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on toggle', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.toggleNet('VCC', 'schematic');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on clearAll', () => {
    manager.highlightNet('VCC', 'schematic');
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.clearAll();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not call subscriber after unsubscribe', () => {
    const callback = vi.fn();
    const unsub = manager.subscribe(callback);
    unsub();
    manager.highlightNet('VCC', 'schematic');
    expect(callback).not.toHaveBeenCalled();
  });

  it('supports multiple subscribers', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    manager.subscribe(cb1);
    manager.subscribe(cb2);
    manager.highlightNet('VCC', 'schematic');
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('does not notify on clearNets when no nets are highlighted', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.clearNets();
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not notify on clearComponents when no components are highlighted', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.clearComponents();
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not notify on clearAll when already empty', () => {
    const callback = vi.fn();
    manager.subscribe(callback);
    manager.clearAll();
    expect(callback).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

describe('useCrossProbe', () => {
  beforeEach(() => {
    CrossProbeManager.resetInstance();
  });

  it('returns initial empty state', () => {
    const { result } = renderHook(() => useCrossProbe());
    expect(result.current.highlightedNets).toEqual([]);
    expect(result.current.highlightedComponents).toEqual([]);
  });

  it('updates when a net is highlighted', () => {
    const { result } = renderHook(() => useCrossProbe());
    act(() => {
      result.current.highlightNet('VCC', 'schematic');
    });
    expect(result.current.highlightedNets).toContain('VCC');
    expect(result.current.isNetHighlighted('VCC')).toBe(true);
  });

  it('updates when a component is highlighted', () => {
    const { result } = renderHook(() => useCrossProbe());
    act(() => {
      result.current.highlightComponent('U1', 'pcb');
    });
    expect(result.current.highlightedComponents).toContain('U1');
    expect(result.current.isComponentHighlighted('U1')).toBe(true);
  });

  it('clears all via hook', () => {
    const { result } = renderHook(() => useCrossProbe());
    act(() => {
      result.current.highlightNet('VCC', 'schematic');
      result.current.highlightComponent('U1', 'schematic');
    });
    act(() => {
      result.current.clearAll();
    });
    expect(result.current.highlightedNets).toEqual([]);
    expect(result.current.highlightedComponents).toEqual([]);
  });

  it('provides getNetColor via hook', () => {
    const { result } = renderHook(() => useCrossProbe());
    const color = result.current.getNetColor('VCC');
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('toggles net via hook', () => {
    const { result } = renderHook(() => useCrossProbe());
    act(() => {
      result.current.toggleNet('VCC', 'schematic');
    });
    expect(result.current.isNetHighlighted('VCC')).toBe(true);
    act(() => {
      result.current.toggleNet('VCC', 'schematic');
    });
    expect(result.current.isNetHighlighted('VCC')).toBe(false);
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useCrossProbe());
    unmount();
    // Should not throw when manager notifies after unmount
    expect(() => {
      CrossProbeManager.getInstance().highlightNet('VCC', 'schematic');
    }).not.toThrow();
  });
});
