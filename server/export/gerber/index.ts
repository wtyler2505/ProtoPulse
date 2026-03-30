// =============================================================================
// Gerber Module Barrel — Re-exports all gerber sub-modules
// =============================================================================

// Types & constants
export type {
  ApertureDef,
  BuildGerberOptions,
  DrillHit,
  GerberConnector,
  GerberInput,
  GerberInstance,
  GerberLayer,
  GerberOutput,
  GerberVia,
  GerberWire,
  ResolvedPad,
  Segment,
} from './types';

export {
  DEFAULT_BODY_HEIGHT,
  DEFAULT_BODY_WIDTH,
  DEFAULT_SMD_PAD_HEIGHT,
  DEFAULT_SMD_PAD_WIDTH,
  DEFAULT_THT_DRILL,
  DEFAULT_THT_PAD_HEIGHT,
  DEFAULT_THT_PAD_WIDTH,
  MM_TO_EXCELLON,
  MM_TO_GERBER,
  OUTLINE_APERTURE,
  SILKSCREEN_APERTURE,
  SILKSCREEN_BODY_MARGIN,
  SOLDERMASK_CLEARANCE,
} from './types';

// Coordinates
export { fmtCoord, formatMm, mmToExcellon, mmToGerber, rotatePoint } from './coordinates';

// Pad resolver
export {
  calculateConnectorOffset,
  determinePadDimensions,
  determinePadShape,
  determinePadType,
  isSmallPitch,
  resolveAllPads,
  resolvePad,
} from './pad-resolver';

// Apertures
export { buildApertures, padApertureKey, traceApertureKey, viaApertureKey } from './apertures';

// Format (header/footer)
export { gerberApertureDefs, gerberFooter, gerberHeader } from './format';
export type { HeaderOptions } from './format';

// Stroke font
export { STROKE_FONT, textToStrokes } from './stroke-font';

// Filters
export {
  filterInstancesForSide,
  filterPadsForCopper,
  filterSmdPadsForSide,
  filterWiresForSide,
} from './filters';

// Layer generators
export { generateCopperLayer, generateInnerCopperLayer } from './copper';
export { generateSilkscreenLayer } from './silkscreen';
export { generateSoldermaskLayer } from './soldermask';
export { generatePasteLayer } from './paste';
export { generateBoardOutline } from './outline';
export { generateDrillFile } from './drill';
