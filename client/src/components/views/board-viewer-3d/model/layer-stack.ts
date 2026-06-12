/**
 * layer-stack — generative N-layer PCB stack model (PP3D-3, fixes TD-3D-07).
 *
 * The pre-existing stacks were FIXED arrays:
 *   - `DEFAULT_LAYER_STACK` in `client/src/lib/board-viewer-3d.ts` had 7 entries
 *     and could not represent boards with more than 2 copper layers.
 *   - `LAYER_PRESETS` in the dead `client/src/lib/pcb/webgl-viewer.ts` hard-coded
 *     exactly two inner-copper layers (`In1.Cu`, `In2.Cu`).
 *
 * This module instead GENERATES the stack from the board's `layers` count
 * (1..32, per `shared/schema.ts`): outer copper on top & bottom, plus
 * `layers - 2` inner-copper planes distributed evenly through the substrate.
 *
 * Thickness/material constants are harvested from the dead engine (the only
 * place they were datasheet-derived) so the dead file can be deleted later
 * without losing them (TD-3D-01). NOTE: we deliberately do NOT import
 * `webgl-viewer.ts` — the constants are copied here, by value, on purpose.
 *
 * Pure module: no three.js, no React, deterministic. Z is the board-thickness
 * axis; the board spans z ∈ [0, thickness], bottom face at z=0.
 */

// ---------------------------------------------------------------------------
// Physical constants (mm) — harvested from webgl-viewer.ts, NOT imported.
// ---------------------------------------------------------------------------

/** 1 oz copper plating thickness. */
export const COPPER_THICKNESS_MM = 0.035;
/** Solder-mask film thickness. */
export const SOLDER_MASK_THICKNESS_MM = 0.02;
/** Silkscreen ink thickness. */
export const SILKSCREEN_THICKNESS_MM = 0.01;

// ---------------------------------------------------------------------------
// Layer model
// ---------------------------------------------------------------------------

export type LayerRole =
  | 'silkscreen'
  | 'soldermask'
  | 'copper'
  | 'substrate';

export type LayerSide = 'top' | 'bottom' | 'inner';

export interface StackLayer {
  /** Stable, unique id (e.g. `copper-top`, `copper-inner-1`, `substrate`). */
  id: string;
  role: LayerRole;
  side: LayerSide;
  /** Human label (`Top Copper`, `Inner Copper 1`, `FR4 Substrate`, ...). */
  label: string;
  /** Bottom of this layer along the board-thickness (z) axis, mm. */
  zBottom: number;
  /** Top of this layer along the board-thickness (z) axis, mm. */
  zTop: number;
  /** Convenience: `zTop - zBottom`. */
  thickness: number;
  /** Default sRGB hex colour for the layer (data only; materials live in R3F). */
  color: string;
  /** Whether the layer is selectable for picking (copper is, films aren't). */
  selectable: boolean;
  /** Default visibility (inner copper hidden by default to reduce clutter). */
  visibleByDefault: boolean;
  /** For inner copper, its 0-based index among inner planes; else undefined. */
  innerIndex?: number;
}

export interface LayerStack {
  /** Configured copper-layer count (clamped to [1, 32]). */
  layerCount: number;
  /** Total board thickness used to position layers (mm). */
  thicknessMm: number;
  /** All layers, ordered bottom→top by zBottom. */
  layers: StackLayer[];
}

export const MIN_LAYERS = 1;
export const MAX_LAYERS = 32;

const COLOR_SILK = '#f5f5f5';
const COLOR_MASK_GREEN = '#1a6b1a';
const COLOR_COPPER = '#b87333';
const COLOR_SUBSTRATE = '#2d5016';
/** Distinct hues for inner copper so adjacent planes read apart when exploded. */
const INNER_COPPER_COLORS = ['#d65a5a', '#5ad65a', '#5a8ad6', '#d6c75a', '#b05ad6', '#5ad6c7'];

function clampLayerCount(n: number): number {
  if (!Number.isFinite(n)) {
    return 2;
  }
  return Math.max(MIN_LAYERS, Math.min(MAX_LAYERS, Math.round(n)));
}

/**
 * Build a complete, generative layer stack for a board.
 *
 * The substrate fills the bulk of the thickness; copper/mask/silk films sit on
 * each outer face; `layerCount - 2` inner copper planes are spread evenly
 * through the substrate interior. For a 1-layer board only the bottom outer
 * stack-up is emitted (single-sided).
 *
 * @param layerCount   Copper-layer count from `board.layers` (1..32).
 * @param thicknessMm  Board thickness (mm), default 1.6.
 * @param maskColor    Solder-mask hex colour (default FR4 green).
 */
export function buildLayerStack(
  layerCount: number,
  thicknessMm = 1.6,
  maskColor: string = COLOR_MASK_GREEN,
): LayerStack {
  const count = clampLayerCount(layerCount);
  const thickness = Number.isFinite(thicknessMm) && thicknessMm > 0 ? thicknessMm : 1.6;
  const singleSided = count === 1;

  const layers: StackLayer[] = [];

  // Substrate occupies the full z-range; films/copper are rendered as thin
  // shells on the faces (slightly inset/proud) so they never z-fight the bulk.
  layers.push({
    id: 'substrate',
    role: 'substrate',
    side: 'inner',
    label: 'FR4 Substrate',
    zBottom: 0,
    zTop: thickness,
    thickness,
    color: COLOR_SUBSTRATE,
    selectable: false,
    visibleByDefault: true,
  });

  // --- Bottom face stack-up (always present) ---
  layers.push(makeFilm('silk-bottom', 'silkscreen', 'bottom', 'Bottom Silkscreen', -SILKSCREEN_THICKNESS_MM - SOLDER_MASK_THICKNESS_MM, COLOR_SILK, false, true));
  layers.push(makeFilm('mask-bottom', 'soldermask', 'bottom', 'Bottom Solder Mask', -SOLDER_MASK_THICKNESS_MM, maskColor, false, true));
  layers.push(makeCopper('copper-bottom', 'bottom', 'Bottom Copper', 0, COLOR_COPPER, true, true));

  // --- Inner copper planes (count - 2, evenly distributed) ---
  const innerCount = Math.max(0, count - 2);
  for (let i = 0; i < innerCount; i += 1) {
    // Even fractional positions strictly inside (0, thickness).
    const frac = (i + 1) / (innerCount + 1);
    const z = frac * thickness;
    layers.push({
      id: `copper-inner-${i + 1}`,
      role: 'copper',
      side: 'inner',
      label: `Inner Copper ${i + 1}`,
      zBottom: z - COPPER_THICKNESS_MM / 2,
      zTop: z + COPPER_THICKNESS_MM / 2,
      thickness: COPPER_THICKNESS_MM,
      color: INNER_COPPER_COLORS[i % INNER_COPPER_COLORS.length],
      selectable: true,
      visibleByDefault: false,
      innerIndex: i,
    });
  }

  // --- Top face stack-up (present for 2+ layer boards) ---
  if (!singleSided) {
    layers.push(makeCopper('copper-top', 'top', 'Top Copper', thickness, COLOR_COPPER, true, true));
    layers.push(makeFilm('mask-top', 'soldermask', 'top', 'Top Solder Mask', thickness + SOLDER_MASK_THICKNESS_MM, maskColor, false, true));
    layers.push(makeFilm('silk-top', 'silkscreen', 'top', 'Top Silkscreen', thickness + SOLDER_MASK_THICKNESS_MM + SILKSCREEN_THICKNESS_MM, COLOR_SILK, false, true));
  }

  layers.sort((a, b) => a.zBottom - b.zBottom);
  return { layerCount: count, thicknessMm: thickness, layers };
}

/** A copper shell centred on `zCenter` (mm). */
function makeCopper(
  id: string,
  side: LayerSide,
  label: string,
  zCenter: number,
  color: string,
  selectable: boolean,
  visibleByDefault: boolean,
): StackLayer {
  return {
    id,
    role: 'copper',
    side,
    label,
    zBottom: zCenter - COPPER_THICKNESS_MM / 2,
    zTop: zCenter + COPPER_THICKNESS_MM / 2,
    thickness: COPPER_THICKNESS_MM,
    color,
    selectable,
    visibleByDefault,
  };
}

/** A thin film (mask/silk) whose TOP sits at `zTop` (mm). */
function makeFilm(
  id: string,
  role: LayerRole,
  side: LayerSide,
  label: string,
  zTop: number,
  color: string,
  selectable: boolean,
  visibleByDefault: boolean,
): StackLayer {
  const t = role === 'silkscreen' ? SILKSCREEN_THICKNESS_MM : SOLDER_MASK_THICKNESS_MM;
  return {
    id,
    role,
    side,
    label,
    zBottom: zTop - t,
    zTop,
    thickness: t,
    color,
    selectable,
    visibleByDefault,
  };
}

/** Count of copper layers actually present in a stack (outer + inner). */
export function copperLayerCount(stack: LayerStack): number {
  return stack.layers.filter((l) => l.role === 'copper').length;
}
