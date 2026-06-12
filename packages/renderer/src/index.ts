/**
 * @protopulse/renderer — WebGL2 schematic/PCB renderer: retained scene
 * graph, SDF glyph atlas (crisp text at every zoom), dual picking (GPU
 * ID buffer for hover + flatbush R-tree for tolerance/marquee/snap).
 * Everything except gl/ is DOM-free and unit-tested in node.
 */
export {
  applyPlacement,
  boundsOfLines,
  CIRCLE_SEGMENTS,
  pinWorldPosition,
  symbolBounds,
  tessellateSymbol,
  tessellateWire,
  tessellationBounds,
  unionBounds,
  wireBounds,
  type Bounds,
  type Tessellation,
  type TessText,
} from './tessellate.js';
export {
  buildScene,
  buildSymbolNode,
  buildWireNode,
  SceneGraph,
  SYMBOL_COLOR,
  WIRE_COLOR,
  type RGBA,
  type SceneNode,
} from './scene.js';
export {
  applyPcbPlacement,
  buildFootprintNode,
  buildPcbScene,
  buildTraceNode,
  buildViaNode,
  circleFanTris,
  layerColor,
  padWorldPosition,
  PCB_LAYER_COLORS,
  pcbViewOf,
  quadTris,
  quarterTurnsOf,
  rebuildPcbScene,
  strokeSegmentTris,
  syncPcbScene,
  tessellateFootprint,
  tessellatePad,
  tessellatePadHoleTris,
  tessellatePadTris,
  tessellateTraceTris,
  VIA_COLOR,
  type PartWithFootprint,
  type PcbFootprintSpec,
  type PcbPadSpec,
  type PcbPlacementLike,
  type PcbTraceLike,
  type PcbViaLike,
  type PcbViewLike,
} from './scene-pcb.js';
export { applyDelta } from './sync.js';
export { PickIndex, type PickHit } from './pick.js';
export {
  Camera,
  GRID_LOD_PX_PER_MM,
  MAX_PX_PER_NM,
  MIN_PX_PER_NM,
  TEXT_LOD_PX_PER_MM,
  type CanvasSize,
  type ScreenPoint,
} from './camera.js';
export { WebGL2Renderer, type OverlayState } from './gl/renderer.js';
export { GlyphAtlas, type Glyph } from './gl/text.js';
export { edt, sdfFromAlpha } from './sdf.js';
export { MAX_PICK_INDEX, pickColor, pickIndexFromPixel } from './pick-encode.js';
