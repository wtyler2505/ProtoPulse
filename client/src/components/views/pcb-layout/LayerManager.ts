/**
 * LayerManager — Layer types, color palettes, and layer visibility logic
 * for the PCB layout canvas.
 *
 * Pure data and functions — no React, no side effects.
 */

import {
  normalizeLegacyLayer,
  generateLayerColors,
  getLayerIndex,
  getLayerName,
} from '@/lib/pcb/layer-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Active copper layer for routing/editing.
 * Accepts standard names (F.Cu, In1.Cu, B.Cu) or legacy (front, back).
 */
export type ActiveLayer = string;

/** Available PCB interaction tools. */
export type PcbTool = 'select' | 'trace' | 'delete' | 'via' | 'pour' | 'keepout' | 'keepin' | 'comment' | 'cutout';

// ---------------------------------------------------------------------------
// Color palettes
// ---------------------------------------------------------------------------

/**
 * Trace colors for the default 2-layer board.
 * For multi-layer boards, use getTraceColor() with a layerCount parameter.
 */
export const TRACE_COLORS: Record<string, string> = {
  front: '#e74c3c',
  back: '#3498db',
  'F.Cu': '#e74c3c',
  'B.Cu': '#3498db',
};

/**
 * Get the trace color for a layer, supporting multi-layer boards.
 *
 * @param layer - Layer name (legacy or standard)
 * @param layerCount - Total copper layer count (default: 2)
 * @returns CSS color string
 */
export function getTraceColor(layer: ActiveLayer, layerCount: number = 2): string {
  const colors = generateLayerColors(layerCount);
  const normalized = normalizeLegacyLayer(layer);
  return colors[normalized] ?? colors[layer] ?? '#888888';
}

/** Color palette for ratsnest net lines — 10 visually distinct colors. */
export const WIRE_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#e91e63', '#00bcd4',
] as const;

// ---------------------------------------------------------------------------
// Layer display helpers
// ---------------------------------------------------------------------------

/** Human-readable label for a copper layer. */
export function layerLabel(layer: ActiveLayer): string {
  if (layer === 'front' || layer === 'F.Cu') { return 'F.Cu (Front)'; }
  if (layer === 'back' || layer === 'B.Cu') { return 'B.Cu (Back)'; }
  return layer;
}

/** Toggle to the opposite layer (2-layer toggle). */
export function toggleLayer(current: ActiveLayer): ActiveLayer {
  if (current === 'front' || current === 'F.Cu') { return 'B.Cu'; }
  return 'F.Cu';
}

/** Cycle to the next layer for N-layer boards. */
export function nextLayer(current: ActiveLayer, layerCount: number): ActiveLayer {
  const idx = getLayerIndex(current, layerCount);
  const nextIdx = (idx + 1) % layerCount;
  return getLayerName(nextIdx, layerCount);
}

/**
 * Compute opacity for a wire/trace based on whether it belongs
 * to the currently-active copper layer.
 */
export function wireOpacity(wireLayer: string | null, activeLayer: ActiveLayer): number {
  if (wireLayer === activeLayer) {
    return 0.9;
  }
  // Also match normalized names
  if (wireLayer !== null && normalizeLegacyLayer(wireLayer) === normalizeLegacyLayer(activeLayer)) {
    return 0.9;
  }
  return 0.3;
}

/**
 * CSS classes for the layer-toggle button based on active layer.
 */
export function layerToggleClasses(layer: ActiveLayer): string {
  if (layer === 'front' || layer === 'F.Cu') {
    return 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30';
  }
  if (layer === 'back' || layer === 'B.Cu') {
    return 'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30';
  }
  // Inner layers get a generic accent style
  return 'bg-green-500/20 text-green-400 border-green-500/40 hover:bg-green-500/30';
}

// ---------------------------------------------------------------------------
// Standard trace width presets (mm)
// ---------------------------------------------------------------------------

export const TRACE_WIDTH_PRESETS = [0.15, 0.25, 0.5, 1.0, 2.0] as const;

/** Default trace width in mm. */
export const DEFAULT_TRACE_WIDTH = 2.0;
