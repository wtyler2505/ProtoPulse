/**
 * LayerManager — Layer types, color palettes, and layer visibility logic
 * for the PCB layout canvas.
 *
 * Pure data and functions — no React, no side effects.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Copper layer identifiers. */
export type ActiveLayer = 'front' | 'back';

/** Available PCB interaction tools. */
export type PcbTool = 'select' | 'trace' | 'delete';

// ---------------------------------------------------------------------------
// Color palettes
// ---------------------------------------------------------------------------

/** Trace colors per copper layer. */
export const TRACE_COLORS: Record<ActiveLayer, string> = {
  front: '#e74c3c',
  back: '#3498db',
};

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
  return layer === 'front' ? 'F.Cu (Front)' : 'B.Cu (Back)';
}

/** Toggle to the opposite layer. */
export function toggleLayer(current: ActiveLayer): ActiveLayer {
  return current === 'front' ? 'back' : 'front';
}

/**
 * Compute opacity for a wire/trace based on whether it belongs
 * to the currently-active copper layer.
 */
export function wireOpacity(wireLayer: string | null, activeLayer: ActiveLayer): number {
  if (wireLayer === activeLayer) {
    return 0.9;
  }
  return 0.3;
}

/**
 * CSS classes for the layer-toggle button based on active layer.
 */
export function layerToggleClasses(layer: ActiveLayer): string {
  if (layer === 'front') {
    return 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30';
  }
  return 'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30';
}

// ---------------------------------------------------------------------------
// Standard trace width presets (mm)
// ---------------------------------------------------------------------------

export const TRACE_WIDTH_PRESETS = [0.15, 0.25, 0.5, 1.0, 2.0] as const;

/** Default trace width in mm. */
export const DEFAULT_TRACE_WIDTH = 2.0;
