/**
 * scene-model — the SceneModel data contract (PP3D-3).
 *
 * `SceneModel` is the deterministic, three.js-free intermediate representation
 * that `buildSceneModel()` produces from raw project/circuit data and that the
 * declarative R3F scene (`BoardScene`) consumes. It is the "real scene bridge"
 * the upgrade plan (§4) describes — distinct from the metadata-only
 * `viewer-3d-bridge.ts`.
 *
 * Everything here is plain data (numbers, strings, arrays). No geometry objects,
 * no materials — those are derived in the R3F layer from `material` keys and the
 * geometry helpers in `geometry.ts`. This keeps the transform trivially
 * unit-testable in a non-WebGL environment.
 *
 * Coordinate convention (matches the substrate orientation):
 *   - x: board width axis (mm), centred on 0.
 *   - z: board depth/height axis (mm), centred on 0.
 *   - y: board thickness axis (mm); the board top face is at +thickness/2.
 *   Raw circuit data is in a top-left mm space (x right, y down); the builder
 *   recentres it to the board centre and maps circuit-y → scene-z.
 */

import type { LayerStack } from './layer-stack';

/** PBR material keys the R3F layer maps to concrete three.js materials. */
export type MaterialKey =
  | 'fr4'
  | 'soldermask'
  | 'silkscreen'
  | 'copper'
  | 'gold'
  | 'tin'
  | 'body-ic'
  | 'body-passive'
  | 'body-connector';

/** Board-level appearance & geometry resolved from the `boards` row. */
export interface SceneBoard {
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  cornerRadiusMm: number;
  layerCount: number;
  /** Solder-mask colour resolved to an sRGB hex string. */
  maskColor: string;
  /** Silkscreen colour resolved to an sRGB hex string. */
  silkColor: string;
  /** Surface finish (drives pad material: gold/tin/copper). */
  finish: string;
  /** Material key for exposed pad metal, derived from `finish`. */
  padMaterial: MaterialKey;
}

/** A placed component body (box, sized from footprint bbox + package height). */
export interface SceneComponent {
  /** Stable id derived from the source row (`circuit-instance-<id>`). */
  id: string;
  refDes: string;
  package: string;
  /** Component value (e.g. "10k", "0.1uF") from instance properties, if any. */
  value?: string;
  /** Datasheet URL from instance properties, if any (PP3D-5 inspector). */
  datasheetUrl?: string;
  /** Supplier / part-source label from instance properties, if any. */
  supplier?: string;
  /** Centre position in scene space (mm): x = width, z = depth. */
  x: number;
  z: number;
  /** Rotation about the board normal (y axis), degrees. */
  rotationDeg: number;
  side: 'top' | 'bottom';
  /** Body footprint extents (mm): w along x, d along z. */
  bodyW: number;
  bodyD: number;
  /** Body height above the board surface (mm). */
  bodyH: number;
  color: string;
  material: MaterialKey;
}

/** A pad/pin opening rendered as a small cylinder/annular ring. */
export interface ScenePad {
  id: string;
  /** Parent component id (for selection grouping). */
  componentId: string;
  /** Centre in scene space (mm). */
  x: number;
  z: number;
  /** Outer diameter (mm). */
  diameter: number;
  through: boolean;
  side: 'top' | 'bottom';
  material: MaterialKey;
}

/** A copper trace as a centreline ribbon. */
export interface SceneTrace {
  id: string;
  /** Centreline points in scene space (mm). */
  points: Array<{ x: number; z: number }>;
  /** Ribbon width (mm). */
  width: number;
  /** Copper side. */
  side: 'top' | 'bottom';
  /** y offset (mm) at which the ribbon sits (top or bottom copper plane). */
  y: number;
  material: MaterialKey;
  /** Net this trace belongs to, resolved from `circuit_nets` (PP3D-5). */
  netName?: string;
}

/** A via as a plated cylinder spanning the board (or a layer subset). */
export interface SceneVia {
  id: string;
  x: number;
  z: number;
  drillDiameter: number;
  outerDiameter: number;
  /** y range (mm) the via barrel spans. */
  yBottom: number;
  yTop: number;
  material: MaterialKey;
  /** Net this via belongs to, resolved from `circuit_nets` (PP3D-5). */
  netName?: string;
}

// ---------------------------------------------------------------------------
// Selection (PP3D-5)
// ---------------------------------------------------------------------------

/** Which family of scene element a selection points at. */
export type SelectionKind = 'component' | 'pad' | 'trace' | 'via';

/** A picked scene element: kind + the stable SceneModel id. */
export interface SceneSelection {
  kind: SelectionKind;
  id: string;
}

/** A non-plated mechanical/mounting drill hole. */
export interface SceneDrillHole {
  id: string;
  x: number;
  z: number;
  diameter: number;
  plated: boolean;
}

export interface SceneModel {
  board: SceneBoard;
  /** Full generative layer stack (positions/visibility/material seeds). */
  stack: LayerStack;
  components: SceneComponent[];
  pads: ScenePad[];
  traces: SceneTrace[];
  vias: SceneVia[];
  drillHoles: SceneDrillHole[];
  /** Quick flag: does the model carry any real geometry beyond the shell? */
  isEmpty: boolean;
}
