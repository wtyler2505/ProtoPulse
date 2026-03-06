/**
 * Layer addressing utilities for multi-layer PCB support.
 * Supports up to 32 copper layers following KiCad/industry naming conventions.
 *
 * Pure functions — no React, no side effects.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Standard copper layer names following KiCad/industry convention (max 32 layers). */
export const STANDARD_LAYER_NAMES = [
  'F.Cu',    // Front copper (index 0)
  'In1.Cu',
  'In2.Cu',
  'In3.Cu',
  'In4.Cu',
  'In5.Cu',
  'In6.Cu',
  'In7.Cu',
  'In8.Cu',
  'In9.Cu',
  'In10.Cu',
  'In11.Cu',
  'In12.Cu',
  'In13.Cu',
  'In14.Cu',
  'In15.Cu',
  'In16.Cu',
  'In17.Cu',
  'In18.Cu',
  'In19.Cu',
  'In20.Cu',
  'In21.Cu',
  'In22.Cu',
  'In23.Cu',
  'In24.Cu',
  'In25.Cu',
  'In26.Cu',
  'In27.Cu',
  'In28.Cu',
  'In29.Cu',
  'In30.Cu',
  'B.Cu',    // Back copper (last index)
] as const;

/** Default layer count for new boards. */
export const DEFAULT_LAYER_COUNT = 2;

/** Maximum supported copper layer count. */
export const MAX_LAYER_COUNT = 32;

// ---------------------------------------------------------------------------
// Layer name normalization
// ---------------------------------------------------------------------------

/**
 * Map legacy 'front'/'back'/'Top'/'Bottom' names to standard KiCad names.
 * Unknown names pass through unchanged.
 */
export function normalizeLegacyLayer(layer: string): string {
  if (layer === 'front') { return 'F.Cu'; }
  if (layer === 'back') { return 'B.Cu'; }
  if (layer === 'Top') { return 'F.Cu'; }
  if (layer === 'Bottom') { return 'B.Cu'; }
  return layer;
}

// ---------------------------------------------------------------------------
// Layer index <-> name mapping
// ---------------------------------------------------------------------------

/**
 * Get the 0-based layer index from a layer name, given the total copper layer count.
 *
 * - 'F.Cu' / 'front' -> 0
 * - 'B.Cu' / 'back' -> layerCount - 1
 * - 'In1.Cu' -> 1, 'In2.Cu' -> 2, etc.
 *
 * Returns 0 as fallback for unrecognized names.
 */
export function getLayerIndex(layerName: string, layerCount: number): number {
  const normalized = normalizeLegacyLayer(layerName);
  if (normalized === 'F.Cu') { return 0; }
  if (normalized === 'B.Cu') { return layerCount - 1; }
  const match = /^In(\d+)\.Cu$/.exec(normalized);
  if (match) {
    const idx = parseInt(match[1], 10);
    // Validate the index is within bounds
    if (idx >= 1 && idx < layerCount - 1) {
      return idx;
    }
    return 0; // out of bounds fallback
  }
  return 0; // unrecognized fallback
}

/**
 * Get the standard layer name for a given 0-based index and total layer count.
 *
 * - Index 0 -> 'F.Cu'
 * - Index layerCount-1 -> 'B.Cu'
 * - Other indices -> 'In{index}.Cu'
 */
export function getLayerName(index: number, layerCount: number): string {
  if (index === 0) { return 'F.Cu'; }
  if (index === layerCount - 1) { return 'B.Cu'; }
  return `In${String(index)}.Cu`;
}

// ---------------------------------------------------------------------------
// Layer queries
// ---------------------------------------------------------------------------

/**
 * Check if a layer is an outer layer (front or back copper).
 */
export function isOuterLayer(layerName: string, layerCount: number): boolean {
  const idx = getLayerIndex(layerName, layerCount);
  return idx === 0 || idx === layerCount - 1;
}

/**
 * Check if a layer is an inner layer (not front or back).
 */
export function isInnerLayer(layerName: string, layerCount: number): boolean {
  return !isOuterLayer(layerName, layerCount);
}

/**
 * Generate an ordered array of copper layer names for an N-layer board.
 *
 * getCopperLayers(2) -> ['F.Cu', 'B.Cu']
 * getCopperLayers(4) -> ['F.Cu', 'In1.Cu', 'In2.Cu', 'B.Cu']
 */
export function getCopperLayers(layerCount: number): string[] {
  const effective = Math.max(2, Math.min(MAX_LAYER_COUNT, layerCount));
  const layers: string[] = ['F.Cu'];
  for (let i = 1; i < effective - 1; i++) {
    layers.push(`In${String(i)}.Cu`);
  }
  layers.push('B.Cu');
  return layers;
}

// ---------------------------------------------------------------------------
// Layer colors
// ---------------------------------------------------------------------------

/**
 * Generate distinct colors for N copper layers.
 *
 * F.Cu is always red, B.Cu is always blue. Inner layers get evenly distributed
 * hues in the yellow-green-cyan range to avoid confusion with outer layers.
 *
 * Includes legacy 'front'/'back' aliases in the returned record.
 */
export function generateLayerColors(layerCount: number): Record<string, string> {
  const layers = getCopperLayers(layerCount);
  const colors: Record<string, string> = {};

  colors['F.Cu'] = '#e74c3c';  // red (front) — matches TRACE_COLORS
  colors['B.Cu'] = '#3498db';  // blue (back) — matches TRACE_COLORS

  const innerCount = layerCount - 2;
  for (let i = 0; i < innerCount; i++) {
    const hue = 60 + (i / Math.max(innerCount, 1)) * 240; // yellow -> green -> cyan
    colors[layers[i + 1]] = `hsl(${String(Math.round(hue))}, 70%, 50%)`;
  }

  // Legacy aliases
  colors['front'] = colors['F.Cu'];
  colors['back'] = colors['B.Cu'];

  return colors;
}

// ---------------------------------------------------------------------------
// Layer adjacency
// ---------------------------------------------------------------------------

/**
 * Get the number of copper layers spanned between two layer names.
 * Includes both endpoints. E.g. F.Cu to B.Cu on a 4-layer board = 4 layers spanned.
 */
export function getLayerSpan(fromLayer: string, toLayer: string, layerCount: number): number {
  const fromIdx = getLayerIndex(fromLayer, layerCount);
  const toIdx = getLayerIndex(toLayer, layerCount);
  return Math.abs(toIdx - fromIdx) + 1;
}

/**
 * Check if two layers are adjacent (exactly 1 layer apart in the stackup).
 */
export function areLayersAdjacent(layerA: string, layerB: string, layerCount: number): boolean {
  const idxA = getLayerIndex(layerA, layerCount);
  const idxB = getLayerIndex(layerB, layerCount);
  return Math.abs(idxA - idxB) === 1;
}
