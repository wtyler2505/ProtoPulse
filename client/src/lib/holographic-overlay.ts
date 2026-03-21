/**
 * Holographic Data Overlay Engine
 *
 * Provides real-time visual overlays for circuit data: current density wire
 * coloring (cyan→yellow→red gradient), glow intensity based on power,
 * thermal hotspot highlighting, and animated pulse/flow effects.
 *
 * Usage:
 *   const engine = HolographicOverlayEngine.getInstance();
 *   engine.setWireCurrents([{ wireId: 'w1', currentAmps: 0.5, maxAmps: 2 }]);
 *   engine.getWireStyle('w1'); // { color, glowIntensity, opacity, pulseSpeed }
 *
 * React hook:
 *   const { wireStyles, hotspots, setWireCurrents, setAnimationMode } = useHolographicOverlay();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Current flow data for a single wire. */
export interface WireCurrentData {
  wireId: string;
  currentAmps: number;
  maxAmps: number;
  /** Optional net name for grouping. */
  netName?: string;
}

/** Thermal data for a component or region. */
export interface ThermalHotspot {
  id: string;
  x: number;
  y: number;
  /** Temperature in degrees Celsius. */
  temperatureC: number;
  /** Radius of influence in px. */
  radiusPx: number;
  /** Component label for tooltip. */
  label: string;
}

/** Visual style computed for a wire overlay. */
export interface WireOverlayStyle {
  /** CSS color string (hex). */
  color: string;
  /** Glow intensity 0..1 — maps to CSS filter blur/brightness. */
  glowIntensity: number;
  /** Wire opacity 0..1. */
  opacity: number;
  /** Pulse animation speed in Hz (0 = no pulse). */
  pulseSpeed: number;
  /** Flow direction indicator speed in px/s (0 = no flow). */
  flowSpeed: number;
  /** Dash pattern for animated flow [dash, gap] or null. */
  dashPattern: [number, number] | null;
}

/** Thermal overlay style for a hotspot. */
export interface ThermalOverlayStyle {
  /** Radial gradient center color. */
  centerColor: string;
  /** Radial gradient edge color (transparent). */
  edgeColor: string;
  /** Opacity 0..1. */
  opacity: number;
  /** Radius in px. */
  radius: number;
}

/** Animation mode for wire overlays. */
export type AnimationMode = 'static' | 'pulse' | 'flow';

/** Configuration for the overlay engine. */
export interface OverlayConfig {
  /** Animation mode. */
  animationMode: AnimationMode;
  /** Minimum glow intensity (0..1). */
  minGlow: number;
  /** Maximum glow intensity (0..1). */
  maxGlow: number;
  /** Pulse frequency in Hz when in pulse mode. */
  pulseFrequencyHz: number;
  /** Flow speed in px/s when in flow mode. */
  flowSpeedPxPerSec: number;
  /** Thermal overlay opacity multiplier. */
  thermalOpacity: number;
  /** Temperature threshold for "hot" (red) in degrees C. */
  hotThresholdC: number;
  /** Temperature threshold for "warm" (yellow) in degrees C. */
  warmThresholdC: number;
  /** Whether overlay is enabled. */
  enabled: boolean;
}

/** Full engine state exposed to subscribers. */
export interface HolographicState {
  wireStyles: Map<string, WireOverlayStyle>;
  thermalStyles: Map<string, ThermalOverlayStyle>;
  hotspots: ThermalHotspot[];
  config: OverlayConfig;
  /** Timestamp of last update. */
  lastUpdateMs: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: OverlayConfig = {
  animationMode: 'static',
  minGlow: 0.1,
  maxGlow: 1.0,
  pulseFrequencyHz: 1.5,
  flowSpeedPxPerSec: 60,
  thermalOpacity: 0.6,
  hotThresholdC: 85,
  warmThresholdC: 50,
  enabled: true,
};

/**
 * Current density color gradient stops.
 * Low current → cyan, medium → yellow, high → red.
 */
const GRADIENT_STOPS: readonly { ratio: number; r: number; g: number; b: number }[] = [
  { ratio: 0.0, r: 0, g: 240, b: 255 },   // #00F0FF — cyan
  { ratio: 0.3, r: 0, g: 255, b: 180 },    // #00FFB4 — cyan-green
  { ratio: 0.5, r: 200, g: 255, b: 0 },     // #C8FF00 — yellow-green
  { ratio: 0.7, r: 255, g: 220, b: 0 },     // #FFDC00 — yellow
  { ratio: 0.85, r: 255, g: 130, b: 0 },    // #FF8200 — orange
  { ratio: 1.0, r: 255, g: 50, b: 50 },     // #FF3232 — red
] as const;

/** Thermal color stops: cool → warm → hot. */
const THERMAL_STOPS: readonly { ratio: number; r: number; g: number; b: number }[] = [
  { ratio: 0.0, r: 50, g: 100, b: 255 },   // cool blue
  { ratio: 0.4, r: 100, g: 255, b: 100 },   // green
  { ratio: 0.6, r: 255, g: 255, b: 0 },     // yellow
  { ratio: 0.8, r: 255, g: 140, b: 0 },     // orange
  { ratio: 1.0, r: 255, g: 40, b: 40 },     // hot red
] as const;

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/** Clamp a number between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Linearly interpolate between two values. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolate a color along a gradient defined by stops. */
export function interpolateGradient(
  ratio: number,
  stops: readonly { ratio: number; r: number; g: number; b: number }[],
): { r: number; g: number; b: number } {
  const t = clamp(ratio, 0, 1);

  // Below first stop
  if (t <= stops[0].ratio) {
    return { r: stops[0].r, g: stops[0].g, b: stops[0].b };
  }
  // Above last stop
  if (t >= stops[stops.length - 1].ratio) {
    const last = stops[stops.length - 1];
    return { r: last.r, g: last.g, b: last.b };
  }

  // Find the two stops we're between
  for (let i = 0; i < stops.length - 1; i++) {
    const lo = stops[i];
    const hi = stops[i + 1];
    if (t >= lo.ratio && t <= hi.ratio) {
      const segT = (t - lo.ratio) / (hi.ratio - lo.ratio);
      return {
        r: Math.round(lerp(lo.r, hi.r, segT)),
        g: Math.round(lerp(lo.g, hi.g, segT)),
        b: Math.round(lerp(lo.b, hi.b, segT)),
      };
    }
  }

  // Fallback (should not reach)
  const last = stops[stops.length - 1];
  return { r: last.r, g: last.g, b: last.b };
}

/** Convert RGB to hex color string. */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Convert RGB to rgba CSS string. */
export function rgbToRgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${clamp(Math.round(r), 0, 255)}, ${clamp(Math.round(g), 0, 255)}, ${clamp(Math.round(b), 0, 255)}, ${clamp(a, 0, 1).toFixed(2)})`;
}

// ---------------------------------------------------------------------------
// HolographicOverlayEngine
// ---------------------------------------------------------------------------

/**
 * Centralized engine for computing holographic data overlays.
 * Singleton per application. Notifies subscribers on state changes.
 */
export class HolographicOverlayEngine {
  private static instance: HolographicOverlayEngine | null = null;

  private wireCurrents: Map<string, WireCurrentData>;
  private hotspots: ThermalHotspot[];
  private config: OverlayConfig;
  private wireStyleCache: Map<string, WireOverlayStyle>;
  private thermalStyleCache: Map<string, ThermalOverlayStyle>;
  private subscribers: Set<() => void>;
  private lastUpdateMs: number;
  private batchUpdating: boolean;

  constructor() {
    this.wireCurrents = new Map();
    this.hotspots = [];
    this.config = { ...DEFAULT_CONFIG };
    this.wireStyleCache = new Map();
    this.thermalStyleCache = new Map();
    this.subscribers = new Set();
    this.lastUpdateMs = 0;
    this.batchUpdating = false;
  }

  /** Get or create the singleton instance. */
  static getInstance(): HolographicOverlayEngine {
    if (!HolographicOverlayEngine.instance) {
      HolographicOverlayEngine.instance = new HolographicOverlayEngine();
    }
    return HolographicOverlayEngine.instance;
  }

  /** Reset the singleton (for testing). */
  static resetInstance(): void {
    HolographicOverlayEngine.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(): void {
    if (this.batchUpdating) {
      return;
    }
    this.lastUpdateMs = Date.now();
    this.subscribers.forEach((cb) => cb());
  }

  // -----------------------------------------------------------------------
  // Batch updates
  // -----------------------------------------------------------------------

  /** Begin a batch update — notifications are deferred until endBatch(). */
  beginBatch(): void {
    this.batchUpdating = true;
  }

  /** End a batch update and notify subscribers once. */
  endBatch(): void {
    this.batchUpdating = false;
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Wire current data
  // -----------------------------------------------------------------------

  /** Set current data for one or more wires. Recomputes styles. */
  setWireCurrents(data: WireCurrentData[]): void {
    for (const item of data) {
      this.wireCurrents.set(item.wireId, item);
    }
    this.recomputeWireStyles();
    this.notify();
  }

  /** Remove current data for specific wires. */
  removeWireCurrents(wireIds: string[]): void {
    for (const id of wireIds) {
      this.wireCurrents.delete(id);
      this.wireStyleCache.delete(id);
    }
    this.notify();
  }

  /** Clear all wire current data. */
  clearWireCurrents(): void {
    this.wireCurrents.clear();
    this.wireStyleCache.clear();
    this.notify();
  }

  /** Get raw current data for a wire. */
  getWireCurrent(wireId: string): WireCurrentData | undefined {
    return this.wireCurrents.get(wireId);
  }

  /** Get all wire IDs with current data. */
  getWireIds(): string[] {
    return Array.from(this.wireCurrents.keys());
  }

  // -----------------------------------------------------------------------
  // Wire style computation
  // -----------------------------------------------------------------------

  private recomputeWireStyles(): void {
    this.wireStyleCache.clear();
    this.wireCurrents.forEach((data, wireId) => {
      this.wireStyleCache.set(wireId, this.computeWireStyle(data));
    });
  }

  private computeWireStyle(data: WireCurrentData): WireOverlayStyle {
    const ratio = data.maxAmps > 0 ? clamp(data.currentAmps / data.maxAmps, 0, 1) : 0;
    const { r, g, b } = interpolateGradient(ratio, GRADIENT_STOPS);
    const color = rgbToHex(r, g, b);

    const glowIntensity = lerp(this.config.minGlow, this.config.maxGlow, ratio);
    const opacity = clamp(0.4 + ratio * 0.6, 0.4, 1.0);

    let pulseSpeed = 0;
    let flowSpeed = 0;
    let dashPattern: [number, number] | null = null;

    switch (this.config.animationMode) {
      case 'pulse':
        pulseSpeed = this.config.pulseFrequencyHz * (0.5 + ratio * 0.5);
        break;
      case 'flow':
        flowSpeed = this.config.flowSpeedPxPerSec * (0.3 + ratio * 0.7);
        dashPattern = [8, 4];
        break;
      case 'static':
      default:
        break;
    }

    return { color, glowIntensity, opacity, pulseSpeed, flowSpeed, dashPattern };
  }

  /** Get the computed overlay style for a wire. Returns null if no data. */
  getWireStyle(wireId: string): WireOverlayStyle | null {
    return this.wireStyleCache.get(wireId) ?? null;
  }

  /** Get all computed wire styles as a plain object (for serialization). */
  getAllWireStyles(): Record<string, WireOverlayStyle> {
    const result: Record<string, WireOverlayStyle> = {};
    this.wireStyleCache.forEach((style, id) => {
      result[id] = style;
    });
    return result;
  }

  // -----------------------------------------------------------------------
  // Thermal hotspots
  // -----------------------------------------------------------------------

  /** Set thermal hotspot data. Recomputes thermal styles. */
  setHotspots(hotspots: ThermalHotspot[]): void {
    this.hotspots = [...hotspots];
    this.recomputeThermalStyles();
    this.notify();
  }

  /** Add a single hotspot. */
  addHotspot(hotspot: ThermalHotspot): void {
    this.hotspots.push(hotspot);
    this.thermalStyleCache.set(hotspot.id, this.computeThermalStyle(hotspot));
    this.notify();
  }

  /** Remove a hotspot by ID. */
  removeHotspot(id: string): void {
    this.hotspots = this.hotspots.filter((h) => h.id !== id);
    this.thermalStyleCache.delete(id);
    this.notify();
  }

  /** Clear all hotspots. */
  clearHotspots(): void {
    this.hotspots = [];
    this.thermalStyleCache.clear();
    this.notify();
  }

  /** Get all hotspots. */
  getHotspots(): ThermalHotspot[] {
    return [...this.hotspots];
  }

  private recomputeThermalStyles(): void {
    this.thermalStyleCache.clear();
    for (const hotspot of this.hotspots) {
      this.thermalStyleCache.set(hotspot.id, this.computeThermalStyle(hotspot));
    }
  }

  private computeThermalStyle(hotspot: ThermalHotspot): ThermalOverlayStyle {
    const ratio = clamp(
      (hotspot.temperatureC - this.config.warmThresholdC) /
        (this.config.hotThresholdC - this.config.warmThresholdC),
      0,
      1,
    );
    const { r, g, b } = interpolateGradient(ratio, THERMAL_STOPS);

    return {
      centerColor: rgbToRgba(r, g, b, this.config.thermalOpacity),
      edgeColor: rgbToRgba(r, g, b, 0),
      opacity: clamp(0.3 + ratio * 0.7, 0.3, 1.0),
      radius: hotspot.radiusPx,
    };
  }

  /** Get thermal overlay style for a hotspot. */
  getThermalStyle(id: string): ThermalOverlayStyle | null {
    return this.thermalStyleCache.get(id) ?? null;
  }

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  /** Update overlay configuration. Recomputes all styles. */
  setConfig(partial: Partial<OverlayConfig>): void {
    this.config = { ...this.config, ...partial };
    this.recomputeWireStyles();
    this.recomputeThermalStyles();
    this.notify();
  }

  /** Get current configuration. */
  getConfig(): OverlayConfig {
    return { ...this.config };
  }

  /** Set animation mode shortcut. */
  setAnimationMode(mode: AnimationMode): void {
    this.setConfig({ animationMode: mode });
  }

  /** Toggle overlay enabled/disabled. */
  setEnabled(enabled: boolean): void {
    this.setConfig({ enabled });
  }

  /** Check if overlay is enabled. */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  // -----------------------------------------------------------------------
  // Full state snapshot
  // -----------------------------------------------------------------------

  /** Get complete state snapshot. */
  getState(): HolographicState {
    return {
      wireStyles: new Map(this.wireStyleCache),
      thermalStyles: new Map(this.thermalStyleCache),
      hotspots: [...this.hotspots],
      config: { ...this.config },
      lastUpdateMs: this.lastUpdateMs,
    };
  }

  /** Get summary stats for debugging/display. */
  getStats(): { wireCount: number; hotspotCount: number; animationMode: AnimationMode; enabled: boolean } {
    return {
      wireCount: this.wireCurrents.size,
      hotspotCount: this.hotspots.length,
      animationMode: this.config.animationMode,
      enabled: this.config.enabled,
    };
  }
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

/** React hook providing holographic overlay state and controls. */
export function useHolographicOverlay() {
  const [state, setState] = useState<HolographicState>(() => HolographicOverlayEngine.getInstance().getState());

  useEffect(() => {
    const engine = HolographicOverlayEngine.getInstance();
    setState(engine.getState());
    return engine.subscribe(() => {
      setState(engine.getState());
    });
  }, []);

  const setWireCurrents = useCallback((data: WireCurrentData[]) => {
    HolographicOverlayEngine.getInstance().setWireCurrents(data);
  }, []);

  const clearWireCurrents = useCallback(() => {
    HolographicOverlayEngine.getInstance().clearWireCurrents();
  }, []);

  const setHotspots = useCallback((hotspots: ThermalHotspot[]) => {
    HolographicOverlayEngine.getInstance().setHotspots(hotspots);
  }, []);

  const addHotspot = useCallback((hotspot: ThermalHotspot) => {
    HolographicOverlayEngine.getInstance().addHotspot(hotspot);
  }, []);

  const removeHotspot = useCallback((id: string) => {
    HolographicOverlayEngine.getInstance().removeHotspot(id);
  }, []);

  const clearHotspots = useCallback(() => {
    HolographicOverlayEngine.getInstance().clearHotspots();
  }, []);

  const setAnimationMode = useCallback((mode: AnimationMode) => {
    HolographicOverlayEngine.getInstance().setAnimationMode(mode);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    HolographicOverlayEngine.getInstance().setEnabled(enabled);
  }, []);

  const setConfig = useCallback((partial: Partial<OverlayConfig>) => {
    HolographicOverlayEngine.getInstance().setConfig(partial);
  }, []);

  const getWireStyle = useCallback((wireId: string) => {
    return HolographicOverlayEngine.getInstance().getWireStyle(wireId);
  }, []);

  const getThermalStyle = useCallback((id: string) => {
    return HolographicOverlayEngine.getInstance().getThermalStyle(id);
  }, []);

  return {
    wireStyles: state.wireStyles,
    thermalStyles: state.thermalStyles,
    hotspots: state.hotspots,
    config: state.config,
    lastUpdateMs: state.lastUpdateMs,
    setWireCurrents,
    clearWireCurrents,
    setHotspots,
    addHotspot,
    removeHotspot,
    clearHotspots,
    setAnimationMode,
    setEnabled,
    setConfig,
    getWireStyle,
    getThermalStyle,
  };
}
