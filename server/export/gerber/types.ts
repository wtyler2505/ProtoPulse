// =============================================================================
// Gerber Types — Shared interfaces and constants for Gerber generation
// =============================================================================

// ---------------------------------------------------------------------------
// Public Interfaces
// ---------------------------------------------------------------------------

export interface GerberLayer {
  name: string;
  type: 'copper' | 'silkscreen' | 'soldermask' | 'paste' | 'outline';
  side: string; // 'front', 'back', or inner layer name (e.g. 'In1.Cu')
  content: string;
}

export interface GerberConnector {
  id: string;
  name: string;
  padType?: string;       // 'tht' | 'smd'
  padWidth?: number;      // mm
  padHeight?: number;     // mm
  padShape?: string;      // 'circle' | 'rect' | 'oblong' | 'square'
  drill?: number;         // mm — drill diameter for THT pads
  offsetX?: number;       // mm — offset from instance center
  offsetY?: number;       // mm — offset from instance center
}

export interface GerberInstance {
  id: number;
  referenceDesignator: string;
  pcbX: number;           // mm
  pcbY: number;           // mm
  pcbRotation: number;    // degrees
  pcbSide: string;        // 'front' | 'back'
  connectors: GerberConnector[];
  footprint: string;      // package name from meta (e.g. "DIP-8", "SOIC-16")
  bodyWidth?: number;     // mm — component body width (for silkscreen outline)
  bodyHeight?: number;    // mm — component body height
}

export interface GerberWire {
  layer: string;          // 'front' | 'back'
  points: Array<{ x: number; y: number }>; // mm
  width: number;          // mm
}

export interface GerberVia {
  x: number;              // mm — board position
  y: number;              // mm — board position
  drillDiameter: number;  // mm
  outerDiameter: number;  // mm (drill + 2 * annular ring)
  tented: boolean;        // if true, solder mask covers via (no mask opening)
}

export interface GerberInput {
  boardWidth: number;     // mm
  boardHeight: number;    // mm
  instances: GerberInstance[];
  wires: GerberWire[];
  vias?: GerberVia[];     // through-hole vias
  boardOutline?: Array<{ x: number; y: number }>; // custom outline polygon (mm)
  layerCount?: number;    // total copper layers (default: 2)
}

export interface GerberOutput {
  layers: GerberLayer[];
  drillFile: string;
}

export interface BuildGerberOptions {
  boardWidth: number;
  boardHeight: number;
  boardOutline?: Array<{ x: number; y: number }>;
  vias?: GerberVia[];
}

// ---------------------------------------------------------------------------
// Internal Interfaces (used across modules)
// ---------------------------------------------------------------------------

export interface ResolvedPad {
  x: number;          // absolute position in mm
  y: number;          // absolute position in mm
  width: number;      // mm
  height: number;     // mm
  padType: 'tht' | 'smd';
  padShape: 'circle' | 'rect' | 'oblong' | 'square';
  drill: number;      // mm (0 for SMD)
  side: 'front' | 'back';
  refDes: string;     // reference designator of the owning instance
  pinName: string;    // connector name
}

export interface ApertureDef {
  code: number;       // D-code (D10, D11, ...)
  shape: 'C' | 'R';  // C = circle, R = rectangle
  params: string;     // e.g. "0.254" or "1.600X1.600"
  key: string;        // deduplication key
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DrillHit {
  x: number;        // mm
  y: number;        // mm
  diameter: number;  // mm
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default pad dimensions when not specified on the connector */
export const DEFAULT_THT_PAD_WIDTH = 1.6;   // mm
export const DEFAULT_THT_PAD_HEIGHT = 1.6;  // mm
export const DEFAULT_SMD_PAD_WIDTH = 1.0;   // mm
export const DEFAULT_SMD_PAD_HEIGHT = 0.6;  // mm

/** Default drill diameter for THT pads */
export const DEFAULT_THT_DRILL = 0.8;       // mm

/** Soldermask clearance: added to each side of the pad */
export const SOLDERMASK_CLEARANCE = 0.1;    // mm

/** Outline aperture diameter */
export const OUTLINE_APERTURE = 0.1;        // mm

/** Silkscreen aperture diameter */
export const SILKSCREEN_APERTURE = 0.15;    // mm

/** Default component body size when not specified */
export const DEFAULT_BODY_WIDTH = 6.0;      // mm
export const DEFAULT_BODY_HEIGHT = 4.0;     // mm

/** Silkscreen offset from body edge */
export const SILKSCREEN_BODY_MARGIN = 0.2;  // mm

/** Conversion factor: mm to Gerber 3.6 integer format (micrometers) */
export const MM_TO_GERBER = 1_000_000;

/** Conversion factor: mm to Excellon format (integer micrometers) */
export const MM_TO_EXCELLON = 1_000;
