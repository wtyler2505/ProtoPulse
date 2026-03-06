/**
 * pcb-layout — Barrel re-export for all PCB layout canvas modules.
 *
 * Module breakdown:
 *   PCBCoordinateSystem  — screen↔board transforms, grid snapping, zoom math
 *   LayerManager         — layer types, colors, visibility logic
 *   ComponentPlacer      — ratsnest construction, placement validation
 *   PCBInteractionManager — mouse/keyboard event handler factories
 *   PCBBoardRenderer     — SVG board grid, footprints, overlay panels
 *   TraceRenderer        — trace/wire SVG rendering + in-progress preview
 */

export {
  GRID_STEP,
  DEFAULT_BOARD,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_WHEEL_STEP,
  ZOOM_BUTTON_STEP,
  DEFAULT_PAN,
  DEFAULT_ZOOM,
  screenToBoardCoords,
  snapValue,
  snapToGrid,
  clampZoom,
  computeWheelZoom,
  roundForDisplay,
  svgUnitsToMm,
  mmToSvgUnits,
} from './PCBCoordinateSystem';

export {
  TRACE_COLORS,
  WIRE_COLORS,
  TRACE_WIDTH_PRESETS,
  DEFAULT_TRACE_WIDTH,
  getTraceColor,
  layerLabel,
  toggleLayer,
  nextLayer,
  wireOpacity,
  layerToggleClasses,
} from './LayerManager';
export type { ActiveLayer, PcbTool } from './LayerManager';

export {
  buildRatsnestNets,
  isInstancePlaced,
  countPlacedInstances,
  getFootprintBoundingBox,
  checkCourtyardCollision,
  footprintFill,
  footprintStroke,
  footprintStrokeWidth,
} from './ComponentPlacer';
export type { NetSegment, NetRecord } from './ComponentPlacer';

export {
  handleCanvasClick,
  handleDoubleClick,
  handleKeyDown,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleWheel,
} from './PCBInteractionManager';
export type {
  Point,
  PanState,
  CanvasCallbacks,
  TraceFinishParams,
  DeleteParams,
} from './PCBInteractionManager';

export {
  BoardGrid,
  ComponentFootprints,
  LayerLegend,
  CoordinateReadout,
  EmptyGuidance,
  DrcConstraintOverlay,
  DrcConstraintToggle,
} from './PCBBoardRenderer';
export type { DrcConstraintOverlayProps, ClearanceRule } from './PCBBoardRenderer';

export { PadRenderer } from './PadRenderer';
export type { PadRendererProps } from './PadRenderer';

export { ViaRenderer, ViaOverlay } from './ViaRenderer';
export type { ViaRendererProps, ViaOverlayProps } from './ViaRenderer';

export { LayerStackPanel } from './LayerStackPanel';
export type { LayerStackPanelProps } from './LayerStackPanel';

export {
  BackLayerTraces,
  FrontLayerTraces,
  TraceInProgress,
} from './TraceRenderer';
