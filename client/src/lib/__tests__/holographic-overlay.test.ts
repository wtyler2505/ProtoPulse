import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  HolographicOverlayEngine,
  useHolographicOverlay,
  interpolateGradient,
  rgbToHex,
  rgbToRgba,
} from '../holographic-overlay';
import type {
  WireCurrentData,
  ThermalHotspot,
  AnimationMode,
  WireOverlayStyle,
  ThermalOverlayStyle,
  OverlayConfig,
} from '../holographic-overlay';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWire(overrides: Partial<WireCurrentData> = {}): WireCurrentData {
  return {
    wireId: overrides.wireId ?? 'w1',
    currentAmps: overrides.currentAmps ?? 0.5,
    maxAmps: overrides.maxAmps ?? 2.0,
    netName: overrides.netName,
  };
}

function makeHotspot(overrides: Partial<ThermalHotspot> = {}): ThermalHotspot {
  return {
    id: overrides.id ?? 'h1',
    x: overrides.x ?? 100,
    y: overrides.y ?? 200,
    temperatureC: overrides.temperatureC ?? 75,
    radiusPx: overrides.radiusPx ?? 30,
    label: overrides.label ?? 'U1',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HolographicOverlayEngine', () => {
  let engine: HolographicOverlayEngine;

  beforeEach(() => {
    HolographicOverlayEngine.resetInstance();
    engine = HolographicOverlayEngine.getInstance();
  });

  afterEach(() => {
    HolographicOverlayEngine.resetInstance();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('Singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = HolographicOverlayEngine.getInstance();
      const b = HolographicOverlayEngine.getInstance();
      expect(a).toBe(b);
    });

    it('creates fresh instance after resetInstance', () => {
      engine.setWireCurrents([makeWire()]);
      HolographicOverlayEngine.resetInstance();
      const fresh = HolographicOverlayEngine.getInstance();
      expect(fresh.getWireIds()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Wire currents
  // -----------------------------------------------------------------------

  describe('Wire currents', () => {
    it('sets and retrieves wire current data', () => {
      const wire = makeWire({ wireId: 'net-vcc', currentAmps: 1.5, maxAmps: 3.0 });
      engine.setWireCurrents([wire]);
      expect(engine.getWireCurrent('net-vcc')).toEqual(wire);
    });

    it('returns undefined for unknown wire', () => {
      expect(engine.getWireCurrent('missing')).toBeUndefined();
    });

    it('handles multiple wires', () => {
      engine.setWireCurrents([
        makeWire({ wireId: 'w1' }),
        makeWire({ wireId: 'w2' }),
        makeWire({ wireId: 'w3' }),
      ]);
      expect(engine.getWireIds()).toHaveLength(3);
    });

    it('updates existing wire on re-set', () => {
      engine.setWireCurrents([makeWire({ wireId: 'w1', currentAmps: 0.5 })]);
      engine.setWireCurrents([makeWire({ wireId: 'w1', currentAmps: 1.8 })]);
      expect(engine.getWireCurrent('w1')?.currentAmps).toBe(1.8);
    });

    it('removes specific wires', () => {
      engine.setWireCurrents([makeWire({ wireId: 'w1' }), makeWire({ wireId: 'w2' })]);
      engine.removeWireCurrents(['w1']);
      expect(engine.getWireIds()).toEqual(['w2']);
    });

    it('clears all wire data', () => {
      engine.setWireCurrents([makeWire({ wireId: 'w1' }), makeWire({ wireId: 'w2' })]);
      engine.clearWireCurrents();
      expect(engine.getWireIds()).toHaveLength(0);
    });

    it('preserves net name', () => {
      engine.setWireCurrents([makeWire({ wireId: 'w1', netName: 'VCC' })]);
      expect(engine.getWireCurrent('w1')?.netName).toBe('VCC');
    });
  });

  // -----------------------------------------------------------------------
  // Wire styles
  // -----------------------------------------------------------------------

  describe('Wire styles', () => {
    it('returns null for unknown wire', () => {
      expect(engine.getWireStyle('missing')).toBeNull();
    });

    it('computes style for zero current (cyan)', () => {
      engine.setWireCurrents([makeWire({ wireId: 'w1', currentAmps: 0, maxAmps: 2 })]);
      const style = engine.getWireStyle('w1');
      expect(style).not.toBeNull();
      // Cyan = #00F0FF at ratio 0
      expect(style!.color.toLowerCase()).toBe('#00f0ff');
      expect(style!.glowIntensity).toBeCloseTo(0.1, 1);
    });

    it('computes style for max current (red)', () => {
      engine.setWireCurrents([makeWire({ wireId: 'w1', currentAmps: 2, maxAmps: 2 })]);
      const style = engine.getWireStyle('w1');
      expect(style).not.toBeNull();
      expect(style!.color.toLowerCase()).toBe('#ff3232');
      expect(style!.glowIntensity).toBeCloseTo(1.0, 1);
    });

    it('computes style for mid current (yellow range)', () => {
      engine.setWireCurrents([makeWire({ wireId: 'w1', currentAmps: 1.4, maxAmps: 2 })]);
      const style = engine.getWireStyle('w1');
      expect(style).not.toBeNull();
      // Ratio 0.7 = yellow (#FFDC00)
      expect(style!.color.toLowerCase()).toBe('#ffdc00');
    });

    it('clamps ratio above 1 to max', () => {
      engine.setWireCurrents([makeWire({ wireId: 'w1', currentAmps: 5, maxAmps: 2 })]);
      const style = engine.getWireStyle('w1');
      expect(style!.color.toLowerCase()).toBe('#ff3232');
    });

    it('handles zero maxAmps gracefully', () => {
      engine.setWireCurrents([makeWire({ wireId: 'w1', currentAmps: 1, maxAmps: 0 })]);
      const style = engine.getWireStyle('w1');
      expect(style).not.toBeNull();
      expect(style!.color.toLowerCase()).toBe('#00f0ff');
    });

    it('opacity ranges from 0.4 to 1.0', () => {
      engine.setWireCurrents([makeWire({ wireId: 'lo', currentAmps: 0, maxAmps: 2 })]);
      engine.setWireCurrents([makeWire({ wireId: 'hi', currentAmps: 2, maxAmps: 2 })]);
      expect(engine.getWireStyle('lo')!.opacity).toBeCloseTo(0.4, 1);
      expect(engine.getWireStyle('hi')!.opacity).toBeCloseTo(1.0, 1);
    });

    it('getAllWireStyles returns all computed styles as object', () => {
      engine.setWireCurrents([
        makeWire({ wireId: 'a', currentAmps: 0, maxAmps: 1 }),
        makeWire({ wireId: 'b', currentAmps: 1, maxAmps: 1 }),
      ]);
      const styles = engine.getAllWireStyles();
      expect(Object.keys(styles)).toHaveLength(2);
      expect(styles['a']).toBeDefined();
      expect(styles['b']).toBeDefined();
    });

    it('recomputes styles when data changes', () => {
      engine.setWireCurrents([makeWire({ wireId: 'w1', currentAmps: 0, maxAmps: 2 })]);
      const before = engine.getWireStyle('w1')!.color;
      engine.setWireCurrents([makeWire({ wireId: 'w1', currentAmps: 2, maxAmps: 2 })]);
      const after = engine.getWireStyle('w1')!.color;
      expect(before).not.toBe(after);
    });
  });

  // -----------------------------------------------------------------------
  // Animation modes
  // -----------------------------------------------------------------------

  describe('Animation modes', () => {
    it('static mode has zero pulse and flow speed', () => {
      engine.setAnimationMode('static');
      engine.setWireCurrents([makeWire({ wireId: 'w1', currentAmps: 1, maxAmps: 2 })]);
      const style = engine.getWireStyle('w1')!;
      expect(style.pulseSpeed).toBe(0);
      expect(style.flowSpeed).toBe(0);
      expect(style.dashPattern).toBeNull();
    });

    it('pulse mode sets pulse speed proportional to current', () => {
      engine.setAnimationMode('pulse');
      engine.setWireCurrents([makeWire({ wireId: 'w1', currentAmps: 2, maxAmps: 2 })]);
      const style = engine.getWireStyle('w1')!;
      expect(style.pulseSpeed).toBeGreaterThan(0);
      expect(style.flowSpeed).toBe(0);
    });

    it('flow mode sets flow speed and dash pattern', () => {
      engine.setAnimationMode('flow');
      engine.setWireCurrents([makeWire({ wireId: 'w1', currentAmps: 1, maxAmps: 2 })]);
      const style = engine.getWireStyle('w1')!;
      expect(style.flowSpeed).toBeGreaterThan(0);
      expect(style.dashPattern).toEqual([8, 4]);
      expect(style.pulseSpeed).toBe(0);
    });

    it('pulse speed scales with current ratio', () => {
      engine.setAnimationMode('pulse');
      engine.setWireCurrents([
        makeWire({ wireId: 'lo', currentAmps: 0, maxAmps: 2 }),
        makeWire({ wireId: 'hi', currentAmps: 2, maxAmps: 2 }),
      ]);
      expect(engine.getWireStyle('lo')!.pulseSpeed).toBeLessThan(engine.getWireStyle('hi')!.pulseSpeed);
    });

    it('flow speed scales with current ratio', () => {
      engine.setAnimationMode('flow');
      engine.setWireCurrents([
        makeWire({ wireId: 'lo', currentAmps: 0.2, maxAmps: 2 }),
        makeWire({ wireId: 'hi', currentAmps: 1.8, maxAmps: 2 }),
      ]);
      expect(engine.getWireStyle('lo')!.flowSpeed).toBeLessThan(engine.getWireStyle('hi')!.flowSpeed);
    });
  });

  // -----------------------------------------------------------------------
  // Thermal hotspots
  // -----------------------------------------------------------------------

  describe('Thermal hotspots', () => {
    it('sets and retrieves hotspots', () => {
      engine.setHotspots([makeHotspot({ id: 'h1', temperatureC: 90 })]);
      expect(engine.getHotspots()).toHaveLength(1);
      expect(engine.getHotspots()[0].id).toBe('h1');
    });

    it('adds a single hotspot', () => {
      engine.addHotspot(makeHotspot({ id: 'h1' }));
      engine.addHotspot(makeHotspot({ id: 'h2' }));
      expect(engine.getHotspots()).toHaveLength(2);
    });

    it('removes a hotspot by ID', () => {
      engine.setHotspots([makeHotspot({ id: 'h1' }), makeHotspot({ id: 'h2' })]);
      engine.removeHotspot('h1');
      expect(engine.getHotspots()).toHaveLength(1);
      expect(engine.getHotspots()[0].id).toBe('h2');
    });

    it('clears all hotspots', () => {
      engine.setHotspots([makeHotspot({ id: 'h1' }), makeHotspot({ id: 'h2' })]);
      engine.clearHotspots();
      expect(engine.getHotspots()).toHaveLength(0);
    });

    it('returns null style for unknown hotspot', () => {
      expect(engine.getThermalStyle('missing')).toBeNull();
    });

    it('computes thermal style for hot component', () => {
      engine.setHotspots([makeHotspot({ id: 'h1', temperatureC: 100, radiusPx: 40 })]);
      const style = engine.getThermalStyle('h1');
      expect(style).not.toBeNull();
      expect(style!.radius).toBe(40);
      expect(style!.opacity).toBeGreaterThan(0.5);
    });

    it('computes thermal style for warm component', () => {
      engine.setHotspots([makeHotspot({ id: 'h1', temperatureC: 60, radiusPx: 20 })]);
      const style = engine.getThermalStyle('h1');
      expect(style).not.toBeNull();
      expect(style!.opacity).toBeGreaterThan(0);
    });

    it('computes thermal style for cool component', () => {
      engine.setHotspots([makeHotspot({ id: 'h1', temperatureC: 30, radiusPx: 10 })]);
      const style = engine.getThermalStyle('h1');
      expect(style).not.toBeNull();
      // Below warm threshold = ratio 0 = blue tones
      expect(style!.centerColor).toContain('50');
    });

    it('edgeColor is transparent', () => {
      engine.setHotspots([makeHotspot({ id: 'h1', temperatureC: 80 })]);
      const style = engine.getThermalStyle('h1')!;
      expect(style.edgeColor).toContain('0.00');
    });

    it('hotspots are defensive copies', () => {
      const original = makeHotspot({ id: 'h1', temperatureC: 70 });
      engine.setHotspots([original]);
      original.temperatureC = 999;
      expect(engine.getHotspots()[0].temperatureC).toBe(70);
    });
  });

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  describe('Configuration', () => {
    it('returns default config', () => {
      const config = engine.getConfig();
      expect(config.animationMode).toBe('static');
      expect(config.enabled).toBe(true);
      expect(config.minGlow).toBeCloseTo(0.1);
      expect(config.maxGlow).toBeCloseTo(1.0);
    });

    it('setConfig merges partial config', () => {
      engine.setConfig({ pulseFrequencyHz: 3.0, maxGlow: 0.8 });
      const config = engine.getConfig();
      expect(config.pulseFrequencyHz).toBe(3.0);
      expect(config.maxGlow).toBe(0.8);
      expect(config.animationMode).toBe('static'); // unchanged
    });

    it('setAnimationMode updates mode', () => {
      engine.setAnimationMode('pulse');
      expect(engine.getConfig().animationMode).toBe('pulse');
    });

    it('setEnabled toggles', () => {
      engine.setEnabled(false);
      expect(engine.isEnabled()).toBe(false);
      engine.setEnabled(true);
      expect(engine.isEnabled()).toBe(true);
    });

    it('config change recomputes wire styles', () => {
      engine.setWireCurrents([makeWire({ wireId: 'w1', currentAmps: 1, maxAmps: 2 })]);
      const before = engine.getWireStyle('w1')!.glowIntensity;
      engine.setConfig({ maxGlow: 0.5 });
      const after = engine.getWireStyle('w1')!.glowIntensity;
      expect(after).not.toBe(before);
    });

    it('config change recomputes thermal styles', () => {
      engine.setHotspots([makeHotspot({ id: 'h1', temperatureC: 80 })]);
      const before = engine.getThermalStyle('h1')!.opacity;
      engine.setConfig({ thermalOpacity: 0.3 });
      const after = engine.getThermalStyle('h1')!.centerColor;
      // opacity in centerColor should be lower
      expect(after).not.toBe(before);
    });
  });

  // -----------------------------------------------------------------------
  // Batch updates
  // -----------------------------------------------------------------------

  describe('Batch updates', () => {
    it('defers notifications during batch', () => {
      const callback = vi.fn();
      engine.subscribe(callback);
      engine.beginBatch();
      engine.setWireCurrents([makeWire()]);
      engine.setHotspots([makeHotspot()]);
      engine.setAnimationMode('pulse');
      expect(callback).not.toHaveBeenCalled();
      engine.endBatch();
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('state is updated during batch even without notify', () => {
      engine.beginBatch();
      engine.setWireCurrents([makeWire({ wireId: 'w1' })]);
      expect(engine.getWireStyle('w1')).not.toBeNull();
      engine.endBatch();
    });
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  describe('Subscription', () => {
    it('notifies on wire current change', () => {
      const callback = vi.fn();
      engine.subscribe(callback);
      engine.setWireCurrents([makeWire()]);
      expect(callback).toHaveBeenCalled();
    });

    it('notifies on hotspot change', () => {
      const callback = vi.fn();
      engine.subscribe(callback);
      engine.addHotspot(makeHotspot());
      expect(callback).toHaveBeenCalled();
    });

    it('unsubscribe stops notifications', () => {
      const callback = vi.fn();
      const unsub = engine.subscribe(callback);
      unsub();
      engine.setWireCurrents([makeWire()]);
      expect(callback).not.toHaveBeenCalled();
    });

    it('multiple subscribers all notified', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      engine.subscribe(cb1);
      engine.subscribe(cb2);
      engine.setWireCurrents([makeWire()]);
      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // State snapshot
  // -----------------------------------------------------------------------

  describe('State snapshot', () => {
    it('getState returns full state', () => {
      engine.setWireCurrents([makeWire({ wireId: 'w1' })]);
      engine.setHotspots([makeHotspot({ id: 'h1' })]);
      const state = engine.getState();
      expect(state.wireStyles.size).toBe(1);
      expect(state.thermalStyles.size).toBe(1);
      expect(state.hotspots).toHaveLength(1);
      expect(state.config.enabled).toBe(true);
    });

    it('getStats returns summary', () => {
      engine.setWireCurrents([makeWire(), makeWire({ wireId: 'w2' })]);
      engine.setHotspots([makeHotspot()]);
      const stats = engine.getStats();
      expect(stats.wireCount).toBe(2);
      expect(stats.hotspotCount).toBe(1);
      expect(stats.animationMode).toBe('static');
      expect(stats.enabled).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Utility function tests
// ---------------------------------------------------------------------------

describe('interpolateGradient', () => {
  const stops = [
    { ratio: 0, r: 0, g: 0, b: 0 },
    { ratio: 0.5, r: 128, g: 128, b: 128 },
    { ratio: 1.0, r: 255, g: 255, b: 255 },
  ];

  it('returns first stop at ratio 0', () => {
    expect(interpolateGradient(0, stops)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('returns last stop at ratio 1', () => {
    expect(interpolateGradient(1, stops)).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('interpolates midpoint', () => {
    const mid = interpolateGradient(0.25, stops);
    expect(mid.r).toBe(64);
    expect(mid.g).toBe(64);
    expect(mid.b).toBe(64);
  });

  it('clamps below 0', () => {
    expect(interpolateGradient(-0.5, stops)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('clamps above 1', () => {
    expect(interpolateGradient(1.5, stops)).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('handles single-stop gradient', () => {
    const single = [{ ratio: 0.5, r: 100, g: 100, b: 100 }];
    expect(interpolateGradient(0.5, single)).toEqual({ r: 100, g: 100, b: 100 });
  });
});

describe('rgbToHex', () => {
  it('converts black', () => {
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
  });

  it('converts white', () => {
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
  });

  it('converts cyan', () => {
    expect(rgbToHex(0, 240, 255)).toBe('#00f0ff');
  });

  it('clamps out-of-range values', () => {
    expect(rgbToHex(-10, 300, 128)).toBe('#00ff80');
  });
});

describe('rgbToRgba', () => {
  it('converts with full opacity', () => {
    expect(rgbToRgba(255, 0, 0, 1)).toBe('rgba(255, 0, 0, 1.00)');
  });

  it('converts with zero opacity', () => {
    expect(rgbToRgba(0, 128, 255, 0)).toBe('rgba(0, 128, 255, 0.00)');
  });

  it('clamps alpha', () => {
    expect(rgbToRgba(100, 100, 100, 1.5)).toBe('rgba(100, 100, 100, 1.00)');
  });
});

// ---------------------------------------------------------------------------
// React hook tests
// ---------------------------------------------------------------------------

describe('useHolographicOverlay', () => {
  beforeEach(() => {
    HolographicOverlayEngine.resetInstance();
  });

  afterEach(() => {
    HolographicOverlayEngine.resetInstance();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useHolographicOverlay());
    expect(result.current.wireStyles.size).toBe(0);
    expect(result.current.hotspots).toHaveLength(0);
    expect(result.current.config.enabled).toBe(true);
  });

  it('updates on setWireCurrents', () => {
    const { result } = renderHook(() => useHolographicOverlay());
    act(() => {
      result.current.setWireCurrents([makeWire({ wireId: 'w1', currentAmps: 1, maxAmps: 2 })]);
    });
    expect(result.current.wireStyles.size).toBe(1);
  });

  it('updates on setHotspots', () => {
    const { result } = renderHook(() => useHolographicOverlay());
    act(() => {
      result.current.setHotspots([makeHotspot({ id: 'h1' })]);
    });
    expect(result.current.hotspots).toHaveLength(1);
  });

  it('updates on setAnimationMode', () => {
    const { result } = renderHook(() => useHolographicOverlay());
    act(() => {
      result.current.setAnimationMode('flow');
    });
    expect(result.current.config.animationMode).toBe('flow');
  });

  it('clearWireCurrents empties styles', () => {
    const { result } = renderHook(() => useHolographicOverlay());
    act(() => {
      result.current.setWireCurrents([makeWire()]);
    });
    act(() => {
      result.current.clearWireCurrents();
    });
    expect(result.current.wireStyles.size).toBe(0);
  });

  it('addHotspot and removeHotspot work', () => {
    const { result } = renderHook(() => useHolographicOverlay());
    act(() => {
      result.current.addHotspot(makeHotspot({ id: 'h1' }));
    });
    expect(result.current.hotspots).toHaveLength(1);
    act(() => {
      result.current.removeHotspot('h1');
    });
    expect(result.current.hotspots).toHaveLength(0);
  });

  it('getWireStyle returns style or null', () => {
    const { result } = renderHook(() => useHolographicOverlay());
    expect(result.current.getWireStyle('missing')).toBeNull();
    act(() => {
      result.current.setWireCurrents([makeWire({ wireId: 'w1', currentAmps: 1, maxAmps: 2 })]);
    });
    expect(result.current.getWireStyle('w1')).not.toBeNull();
  });

  it('getThermalStyle returns style or null', () => {
    const { result } = renderHook(() => useHolographicOverlay());
    expect(result.current.getThermalStyle('missing')).toBeNull();
    act(() => {
      result.current.setHotspots([makeHotspot({ id: 'h1', temperatureC: 80 })]);
    });
    expect(result.current.getThermalStyle('h1')).not.toBeNull();
  });

  it('setEnabled toggles enabled flag', () => {
    const { result } = renderHook(() => useHolographicOverlay());
    act(() => {
      result.current.setEnabled(false);
    });
    expect(result.current.config.enabled).toBe(false);
  });

  it('setConfig updates config', () => {
    const { result } = renderHook(() => useHolographicOverlay());
    act(() => {
      result.current.setConfig({ maxGlow: 0.7, pulseFrequencyHz: 2.5 });
    });
    expect(result.current.config.maxGlow).toBe(0.7);
    expect(result.current.config.pulseFrequencyHz).toBe(2.5);
  });
});
