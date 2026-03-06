// =============================================================================
// Gerber RS-274X Generator — Phase 12.4: Manufacturing Output
// =============================================================================
//
// Generates Gerber RS-274X format files from PCB layout data. Pure function
// library — no Express routes, no database access, no side effects.
//
// Format reference: IPC-2581 / Ucamco "The Gerber Layer Format Specification"
// Coordinate format: FSLAX36Y36 (3 integer digits, 6 decimal digits = micrometers)
// Units: millimeters (MOMM)
//
// Excellon drill format: FMAT,2 with METRIC,TZ (trailing zeros)
// =============================================================================

import {
  type CircuitInstanceData,
  type CircuitWireData,
  type ComponentPartData,
  type ExportResult,
  sanitizeFilename,
} from './types';

// ---------------------------------------------------------------------------
// Types
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default pad dimensions when not specified on the connector */
const DEFAULT_THT_PAD_WIDTH = 1.6;   // mm
const DEFAULT_THT_PAD_HEIGHT = 1.6;  // mm
const DEFAULT_SMD_PAD_WIDTH = 1.0;   // mm
const DEFAULT_SMD_PAD_HEIGHT = 0.6;  // mm

/** Default drill diameter for THT pads */
const DEFAULT_THT_DRILL = 0.8;       // mm

/** Soldermask clearance: added to each side of the pad */
const SOLDERMASK_CLEARANCE = 0.1;    // mm

/** Outline aperture diameter */
const OUTLINE_APERTURE = 0.1;        // mm

/** Silkscreen aperture diameter */
const SILKSCREEN_APERTURE = 0.15;    // mm

/** Default component body size when not specified */
const DEFAULT_BODY_WIDTH = 6.0;      // mm
const DEFAULT_BODY_HEIGHT = 4.0;     // mm

/** Silkscreen offset from body edge */
const SILKSCREEN_BODY_MARGIN = 0.2;  // mm

/** Conversion factor: mm to Gerber 3.6 integer format (micrometers) */
const MM_TO_GERBER = 1_000_000;

/** Conversion factor: mm to Excellon format (integer micrometers) */
const MM_TO_EXCELLON = 1_000;

// ---------------------------------------------------------------------------
// Coordinate Helpers
// ---------------------------------------------------------------------------

/**
 * Convert millimeters to Gerber 3.6 format integer.
 * 1mm = 1,000,000 in 3.6 format (effectively micrometers in the integer representation).
 */
function mmToGerber(mm: number): number {
  return Math.round(mm * MM_TO_GERBER);
}

/**
 * Convert millimeters to Excellon drill format integer (micrometers).
 */
function mmToExcellon(mm: number): number {
  return Math.round(mm * MM_TO_EXCELLON);
}

/**
 * Format a Gerber coordinate as the integer string (no decimal point).
 * Gerber readers interpret this based on the %FSLAX36Y36*% header.
 */
function fmtCoord(mm: number): string {
  const val = mmToGerber(mm);
  // Gerber spec with "leading zeros omitted" (LA) means we just output the integer
  return String(val);
}

/**
 * Rotate a point (px, py) around an origin (cx, cy) by the given angle in degrees.
 * Returns the new (x, y) position.
 */
function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angleDeg: number,
): { x: number; y: number } {
  if (angleDeg === 0) return { x: px, y: py };
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

// ---------------------------------------------------------------------------
// Pad Geometry Resolution
// ---------------------------------------------------------------------------

interface ResolvedPad {
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

/**
 * Determine whether a connector is THT based on explicit padType
 * or footprint heuristic.
 */
function determinePadType(connector: GerberConnector, footprint: string): 'tht' | 'smd' {
  if (connector.padType === 'tht') return 'tht';
  if (connector.padType === 'smd') return 'smd';
  // No explicit type: infer from footprint
  return isSmallPitch(footprint) ? 'smd' : 'tht';
}

/**
 * Determine pad dimensions (width, height, drill) based on pad type
 * and any explicit connector overrides.
 */
function determinePadDimensions(
  connector: GerberConnector,
  padType: 'tht' | 'smd',
): { width: number; height: number; drill: number } {
  const isTht = padType === 'tht';
  return {
    width: connector.padWidth ?? (isTht ? DEFAULT_THT_PAD_WIDTH : DEFAULT_SMD_PAD_WIDTH),
    height: connector.padHeight ?? (isTht ? DEFAULT_THT_PAD_HEIGHT : DEFAULT_SMD_PAD_HEIGHT),
    drill: isTht ? (connector.drill ?? DEFAULT_THT_DRILL) : 0,
  };
}

/**
 * Determine pad shape. Explicit padShape takes priority. Otherwise:
 * - THT pin 1 → square, other THT → circle
 * - SMD → rect
 */
function determinePadShape(
  connector: GerberConnector,
  padType: 'tht' | 'smd',
  connectorIndex: number,
): 'circle' | 'rect' | 'oblong' | 'square' {
  if (connector.padShape) {
    return connector.padShape as 'circle' | 'rect' | 'oblong' | 'square';
  }
  if (padType === 'tht') {
    return connectorIndex === 0 ? 'square' : 'circle';
  }
  return 'rect';
}

/**
 * Calculate the local (pre-rotation) offset of a connector relative
 * to its instance center. Uses explicit offsets when provided, otherwise
 * auto-distributes connectors in a DIP-like layout.
 */
function calculateConnectorOffset(
  connector: GerberConnector,
  connectorIndex: number,
  totalConnectors: number,
  bodyWidth: number,
  bodyHeight: number,
): { x: number; y: number } {
  if (connector.offsetX !== undefined && connector.offsetY !== undefined) {
    return { x: connector.offsetX, y: connector.offsetY };
  }

  // Auto-layout: distribute connectors evenly.
  // For DIP-like packages, split connectors between two sides.
  const half = Math.ceil(totalConnectors / 2);

  if (connectorIndex < half) {
    // Left side / top row
    const step = half > 1 ? bodyHeight / (half - 1) : 0;
    return {
      x: -bodyWidth / 2,
      y: -bodyHeight / 2 + step * connectorIndex,
    };
  }

  // Right side / bottom row
  const idx = connectorIndex - half;
  const rightCount = totalConnectors - half;
  const step = rightCount > 1 ? bodyHeight / (rightCount - 1) : 0;
  return {
    x: bodyWidth / 2,
    y: bodyHeight / 2 - step * idx,
  };
}

/**
 * Resolve a connector to its absolute pad position and dimensions,
 * accounting for instance position, rotation, and side.
 */
function resolvePad(
  instance: GerberInstance,
  connector: GerberConnector,
  connectorIndex: number,
  totalConnectors: number,
): ResolvedPad {
  const padType = determinePadType(connector, instance.footprint);
  const { width, height, drill } = determinePadDimensions(connector, padType);
  const padShape = determinePadShape(connector, padType, connectorIndex);

  const bodyW = instance.bodyWidth ?? DEFAULT_BODY_WIDTH;
  const bodyH = instance.bodyHeight ?? DEFAULT_BODY_HEIGHT;
  const local = calculateConnectorOffset(connector, connectorIndex, totalConnectors, bodyW, bodyH);

  // Apply instance rotation
  const rotated = rotatePoint(local.x, local.y, 0, 0, instance.pcbRotation);

  // Apply instance position
  const absX = instance.pcbX + rotated.x;
  const absY = instance.pcbY + rotated.y;

  const side: 'front' | 'back' = instance.pcbSide === 'back' ? 'back' : 'front';

  return {
    x: absX,
    y: absY,
    width,
    height,
    padType,
    padShape,
    drill,
    side,
    refDes: instance.referenceDesignator,
    pinName: connector.name,
  };
}

/**
 * Heuristic: footprints with "SMD" in the name or small-pitch packages
 * are assumed to have SMD pads by default.
 */
function isSmallPitch(footprint: string): boolean {
  const fp = footprint.toUpperCase();
  return (
    fp.includes('SMD') ||
    fp.includes('SOIC') ||
    fp.includes('QFP') ||
    fp.includes('QFN') ||
    fp.includes('BGA') ||
    fp.includes('SOT') ||
    fp.includes('0402') ||
    fp.includes('0603') ||
    fp.includes('0805') ||
    fp.includes('1206') ||
    fp.includes('1210') ||
    fp.includes('2512')
  );
}

/**
 * Resolve all pads from all instances.
 */
function resolveAllPads(instances: GerberInstance[]): ResolvedPad[] {
  const pads: ResolvedPad[] = [];
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    const connectors = inst.connectors;
    for (let j = 0; j < connectors.length; j++) {
      pads.push(resolvePad(inst, connectors[j], j, connectors.length));
    }
  }
  return pads;
}

// ---------------------------------------------------------------------------
// Aperture Management
// ---------------------------------------------------------------------------

interface ApertureDef {
  code: number;       // D-code (D10, D11, ...)
  shape: 'C' | 'R';  // C = circle, R = rectangle
  params: string;     // e.g. "0.254" or "1.600X1.600"
  key: string;        // deduplication key
}

/**
 * Builds a unique set of aperture definitions from pads and traces.
 * Returns the definitions and a lookup map from aperture key to D-code.
 */
function buildApertures(
  pads: ResolvedPad[],
  wires: GerberWire[],
  side: 'front' | 'back',
  extra?: { clearance?: number; vias?: GerberVia[]; tentedFilter?: boolean },
): { defs: ApertureDef[]; lookup: Map<string, number> } {
  const clearance = extra?.clearance ?? 0;
  const vias = extra?.vias ?? [];
  const tentedFilter = extra?.tentedFilter ?? false;
  const seen = new Map<string, number>();
  const defs: ApertureDef[] = [];
  let nextCode = 10; // D10 is the first user aperture per Gerber convention

  function addAperture(shape: 'C' | 'R', params: string): number {
    const key = `${shape}:${params}`;
    const existing = seen.get(key);
    if (existing !== undefined) return existing;
    const code = nextCode++;
    seen.set(key, code);
    defs.push({ code, shape, params, key });
    return code;
  }

  // Trace apertures
  for (let i = 0; i < wires.length; i++) {
    const wire = wires[i];
    if (wire.layer !== side) continue;
    const w = wire.width + clearance * 2;
    addAperture('C', formatMm(w));
  }

  // Pad apertures
  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i];
    // THT pads appear on both layers; SMD pads only on their side
    if (pad.padType === 'smd' && pad.side !== side) continue;

    const pw = pad.width + clearance * 2;
    const ph = pad.height + clearance * 2;

    if (pad.padShape === 'circle') {
      addAperture('C', formatMm(pw));
    } else {
      // rect, square, oblong all rendered as rectangles
      addAperture('R', `${formatMm(pw)}X${formatMm(ph)}`);
    }
  }

  // Via apertures — vias are circular pads on both copper layers
  for (let i = 0; i < vias.length; i++) {
    const via = vias[i];
    // When tentedFilter is true, skip tented vias (used for soldermask)
    if (tentedFilter && via.tented) continue;
    const d = via.outerDiameter + clearance * 2;
    addAperture('C', formatMm(d));
  }

  return { defs, lookup: seen };
}

/**
 * Format a dimension in mm with enough decimal places for Gerber aperture definitions.
 * Gerber apertures use decimal mm notation (e.g. "1.600").
 */
function formatMm(mm: number): string {
  return mm.toFixed(3);
}

/**
 * Look up the D-code for a given pad's aperture.
 */
function padApertureKey(pad: ResolvedPad, clearance: number): string {
  const pw = pad.width + clearance * 2;
  const ph = pad.height + clearance * 2;
  if (pad.padShape === 'circle') {
    return `C:${formatMm(pw)}`;
  }
  return `R:${formatMm(pw)}X${formatMm(ph)}`;
}

/**
 * Look up the D-code for a trace aperture.
 */
function traceApertureKey(width: number, clearance: number): string {
  return `C:${formatMm(width + clearance * 2)}`;
}

/**
 * Look up the D-code for a via pad aperture.
 */
function viaApertureKey(via: GerberVia, clearance: number): string {
  return `C:${formatMm(via.outerDiameter + clearance * 2)}`;
}

// ---------------------------------------------------------------------------
// Gerber File Header & Footer
// ---------------------------------------------------------------------------

interface HeaderOptions {
  comment: string;
  fileFunction: string;
}

function gerberHeader(opts: HeaderOptions): string {
  const lines: string[] = [];
  lines.push(`G04 ProtoPulse EDA - ${opts.comment}*`);
  lines.push('%FSLAX36Y36*%');
  lines.push('%MOMM*%');
  lines.push('%TF.GenerationSoftware,ProtoPulse,EDA,1.0*%');
  lines.push(`%TF.FileFunction,${opts.fileFunction}*%`);
  lines.push('%TF.FilePolarity,Positive*%');
  return lines.join('\n');
}

function gerberApertureDefs(defs: ApertureDef[]): string {
  const lines: string[] = [];
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    lines.push(`%ADD${d.code}${d.shape},${d.params}*%`);
  }
  return lines.join('\n');
}

function gerberFooter(): string {
  return 'M02*';
}

// ---------------------------------------------------------------------------
// Reference Designator Text Rendering (for Silkscreen)
// ---------------------------------------------------------------------------

/**
 * Approximate text as simple line segments for Gerber silkscreen.
 * Each character is rendered as a set of strokes within a fixed-width cell.
 * This is a simplified vector font — sufficient for manufacturing reference.
 *
 * Character cell: 1.0mm wide x 1.4mm tall (scalable).
 * Returns an array of line segments: [{x1,y1,x2,y2}, ...] in mm, relative to origin (0,0).
 */
interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Simple stroke font definition. Each character maps to an array of
 * line segments in a normalized 0-1 coordinate space (width x height).
 * We only define the alphanumeric characters commonly found in reference designators.
 */
const STROKE_FONT: Record<string, Array<[number, number, number, number]>> = {
  // Uppercase letters — normalized segments [x1, y1, x2, y2] in 0..1 space
  'A': [[0,1,0.5,0],[0.5,0,1,1],[0.2,0.6,0.8,0.6]],
  'B': [[0,0,0,1],[0,0,0.7,0],[0.7,0,0.8,0.15],[0.8,0.15,0.8,0.35],[0.8,0.35,0.7,0.5],[0.7,0.5,0,0.5],[0.7,0.5,0.8,0.65],[0.8,0.65,0.8,0.85],[0.8,0.85,0.7,1],[0.7,1,0,1]],
  'C': [[1,0,0.2,0],[0.2,0,0,0.2],[0,0.2,0,0.8],[0,0.8,0.2,1],[0.2,1,1,1]],
  'D': [[0,0,0,1],[0,0,0.6,0],[0.6,0,1,0.3],[1,0.3,1,0.7],[1,0.7,0.6,1],[0.6,1,0,1]],
  'E': [[1,0,0,0],[0,0,0,1],[0,1,1,1],[0,0.5,0.7,0.5]],
  'F': [[1,0,0,0],[0,0,0,1],[0,0.5,0.7,0.5]],
  'G': [[1,0,0.2,0],[0.2,0,0,0.2],[0,0.2,0,0.8],[0,0.8,0.2,1],[0.2,1,1,1],[1,1,1,0.5],[1,0.5,0.5,0.5]],
  'H': [[0,0,0,1],[1,0,1,1],[0,0.5,1,0.5]],
  'I': [[0.2,0,0.8,0],[0.5,0,0.5,1],[0.2,1,0.8,1]],
  'J': [[0.2,0,1,0],[0.7,0,0.7,0.8],[0.7,0.8,0.5,1],[0.5,1,0.2,0.8],[0.2,0.8,0,0.6]],
  'K': [[0,0,0,1],[1,0,0,0.5],[0,0.5,1,1]],
  'L': [[0,0,0,1],[0,1,1,1]],
  'M': [[0,1,0,0],[0,0,0.5,0.5],[0.5,0.5,1,0],[1,0,1,1]],
  'N': [[0,1,0,0],[0,0,1,1],[1,1,1,0]],
  'O': [[0.2,0,0.8,0],[0.8,0,1,0.2],[1,0.2,1,0.8],[1,0.8,0.8,1],[0.8,1,0.2,1],[0.2,1,0,0.8],[0,0.8,0,0.2],[0,0.2,0.2,0]],
  'P': [[0,0,0,1],[0,0,0.7,0],[0.7,0,0.8,0.15],[0.8,0.15,0.8,0.35],[0.8,0.35,0.7,0.5],[0.7,0.5,0,0.5]],
  'Q': [[0.2,0,0.8,0],[0.8,0,1,0.2],[1,0.2,1,0.8],[1,0.8,0.8,1],[0.8,1,0.2,1],[0.2,1,0,0.8],[0,0.8,0,0.2],[0,0.2,0.2,0],[0.6,0.7,1,1]],
  'R': [[0,0,0,1],[0,0,0.7,0],[0.7,0,0.8,0.15],[0.8,0.15,0.8,0.35],[0.8,0.35,0.7,0.5],[0.7,0.5,0,0.5],[0.5,0.5,1,1]],
  'S': [[1,0.1,0.8,0],[0.8,0,0.2,0],[0.2,0,0,0.1],[0,0.1,0,0.4],[0,0.4,0.2,0.5],[0.2,0.5,0.8,0.5],[0.8,0.5,1,0.6],[1,0.6,1,0.9],[1,0.9,0.8,1],[0.8,1,0.2,1],[0.2,1,0,0.9]],
  'T': [[0,0,1,0],[0.5,0,0.5,1]],
  'U': [[0,0,0,0.8],[0,0.8,0.2,1],[0.2,1,0.8,1],[0.8,1,1,0.8],[1,0.8,1,0]],
  'V': [[0,0,0.5,1],[0.5,1,1,0]],
  'W': [[0,0,0.25,1],[0.25,1,0.5,0.5],[0.5,0.5,0.75,1],[0.75,1,1,0]],
  'X': [[0,0,1,1],[1,0,0,1]],
  'Y': [[0,0,0.5,0.5],[1,0,0.5,0.5],[0.5,0.5,0.5,1]],
  'Z': [[0,0,1,0],[1,0,0,1],[0,1,1,1]],
  // Digits
  '0': [[0.2,0,0.8,0],[0.8,0,1,0.2],[1,0.2,1,0.8],[1,0.8,0.8,1],[0.8,1,0.2,1],[0.2,1,0,0.8],[0,0.8,0,0.2],[0,0.2,0.2,0],[0,1,1,0]],
  '1': [[0.3,0.2,0.5,0],[0.5,0,0.5,1],[0.2,1,0.8,1]],
  '2': [[0,0.2,0.2,0],[0.2,0,0.8,0],[0.8,0,1,0.2],[1,0.2,1,0.4],[1,0.4,0,1],[0,1,1,1]],
  '3': [[0,0.2,0.2,0],[0.2,0,0.8,0],[0.8,0,1,0.2],[1,0.2,1,0.4],[1,0.4,0.8,0.5],[0.8,0.5,0.4,0.5],[0.8,0.5,1,0.6],[1,0.6,1,0.8],[1,0.8,0.8,1],[0.8,1,0.2,1],[0.2,1,0,0.8]],
  '4': [[0,0,0,0.5],[0,0.5,1,0.5],[0.7,0,0.7,1]],
  '5': [[1,0,0,0],[0,0,0,0.5],[0,0.5,0.8,0.5],[0.8,0.5,1,0.6],[1,0.6,1,0.8],[1,0.8,0.8,1],[0.8,1,0.2,1],[0.2,1,0,0.8]],
  '6': [[0.8,0,0.2,0],[0.2,0,0,0.2],[0,0.2,0,0.8],[0,0.8,0.2,1],[0.2,1,0.8,1],[0.8,1,1,0.8],[1,0.8,1,0.6],[1,0.6,0.8,0.5],[0.8,0.5,0,0.5]],
  '7': [[0,0,1,0],[1,0,0.3,1]],
  '8': [[0.2,0,0.8,0],[0.8,0,1,0.1],[1,0.1,1,0.4],[1,0.4,0.8,0.5],[0.8,0.5,0.2,0.5],[0.2,0.5,0,0.4],[0,0.4,0,0.1],[0,0.1,0.2,0],[0.2,0.5,0,0.6],[0,0.6,0,0.9],[0,0.9,0.2,1],[0.2,1,0.8,1],[0.8,1,1,0.9],[1,0.9,1,0.6],[1,0.6,0.8,0.5]],
  '9': [[0.2,1,0.8,1],[0.8,1,1,0.8],[1,0.8,1,0.2],[1,0.2,0.8,0],[0.8,0,0.2,0],[0.2,0,0,0.2],[0,0.2,0,0.4],[0,0.4,0.2,0.5],[0.2,0.5,1,0.5]],
};

/**
 * Generate stroke segments for a text string at a given position.
 * charWidth and charHeight define the character cell size in mm.
 * spacing is the gap between characters in mm.
 */
function textToStrokes(
  text: string,
  originX: number,
  originY: number,
  charWidth: number,
  charHeight: number,
  spacing: number,
): Segment[] {
  const segments: Segment[] = [];
  let cursorX = originX;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i].toUpperCase();
    const glyph = STROKE_FONT[ch];
    if (glyph) {
      for (let j = 0; j < glyph.length; j++) {
        const [nx1, ny1, nx2, ny2] = glyph[j];
        segments.push({
          x1: cursorX + nx1 * charWidth,
          y1: originY + ny1 * charHeight,
          x2: cursorX + nx2 * charWidth,
          y2: originY + ny2 * charHeight,
        });
      }
    }
    cursorX += charWidth + spacing;
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Copper Layer Generator
// ---------------------------------------------------------------------------

/**
 * Generate a single copper layer (front or back) in Gerber RS-274X format.
 *
 * Contents:
 * - Trace segments from PCB wires on this layer
 * - Pad flashes for components on this side (THT pads on both sides)
 */
export function generateCopperLayer(input: GerberInput, side: 'front' | 'back'): string {
  const allPads = resolveAllPads(input.instances);
  const sidePads = filterPadsForCopper(allPads, side);
  const sideWires = filterWiresForSide(input.wires, side);
  const vias = input.vias ?? [];

  const { defs, lookup } = buildApertures(sidePads, sideWires, side, { vias });

  const layerNum = side === 'front' ? 'L1' : 'L2';
  const layerPos = side === 'front' ? 'Top' : 'Bot';

  const lines: string[] = [];

  // Header
  lines.push(gerberHeader({
    comment: `${side === 'front' ? 'Front' : 'Back'} Copper`,
    fileFunction: `Copper,${layerNum},${layerPos}`,
  }));

  // Aperture definitions
  lines.push(gerberApertureDefs(defs));

  // Set linear interpolation mode
  lines.push('G01*');

  // Draw traces
  for (let i = 0; i < sideWires.length; i++) {
    const wire = sideWires[i];
    if (wire.points.length < 2) continue;

    const aKey = traceApertureKey(wire.width, 0);
    const dCode = lookup.get(aKey);
    if (dCode === undefined) continue;

    lines.push(`D${dCode}*`);

    // Move to first point (pen up)
    const p0 = wire.points[0];
    lines.push(`X${fmtCoord(p0.x)}Y${fmtCoord(p0.y)}D02*`);

    // Draw to subsequent points (pen down)
    for (let j = 1; j < wire.points.length; j++) {
      const p = wire.points[j];
      lines.push(`X${fmtCoord(p.x)}Y${fmtCoord(p.y)}D01*`);
    }
  }

  // Flash pads
  for (let i = 0; i < sidePads.length; i++) {
    const pad = sidePads[i];
    const aKey = padApertureKey(pad, 0);
    const dCode = lookup.get(aKey);
    if (dCode === undefined) continue;

    lines.push(`D${dCode}*`);
    lines.push(`X${fmtCoord(pad.x)}Y${fmtCoord(pad.y)}D03*`);
  }

  // Flash via pads — vias are through-hole, appear on both copper layers
  for (let i = 0; i < vias.length; i++) {
    const via = vias[i];
    const aKey = viaApertureKey(via, 0);
    const dCode = lookup.get(aKey);
    if (dCode === undefined) continue;

    lines.push(`D${dCode}*`);
    lines.push(`X${fmtCoord(via.x)}Y${fmtCoord(via.y)}D03*`);
  }

  // Footer
  lines.push(gerberFooter());

  return lines.join('\n');
}

/**
 * Filter pads for a copper layer.
 * THT pads appear on both front and back. SMD pads only on their side.
 */
function filterPadsForCopper(pads: ResolvedPad[], side: 'front' | 'back'): ResolvedPad[] {
  const result: ResolvedPad[] = [];
  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i];
    if (pad.padType === 'tht' || pad.side === side) {
      result.push(pad);
    }
  }
  return result;
}

/**
 * Filter wires for a specific PCB side/layer.
 * Matches by exact layer name (e.g. 'front', 'back', 'In1.Cu', 'F.Cu').
 */
function filterWiresForSide(wires: GerberWire[], side: string): GerberWire[] {
  const result: GerberWire[] = [];
  for (let i = 0; i < wires.length; i++) {
    if (wires[i].layer === side) {
      result.push(wires[i]);
    }
  }
  return result;
}

/**
 * Generate an inner copper layer in Gerber RS-274X format.
 *
 * Inner layers contain only traces (wires routed on that layer) and
 * through-hole via pads. SMD pads and component pads do not appear on inner layers.
 *
 * @param input - Full Gerber input data
 * @param layerName - Standard layer name (e.g. 'In1.Cu', 'In2.Cu')
 * @param layerIndex - 1-based inner layer index (In1.Cu = 1, In2.Cu = 2, etc.)
 */
export function generateInnerCopperLayer(
  input: GerberInput,
  layerName: string,
  layerIndex: number,
): string {
  const layerWires = filterWiresForSide(input.wires, layerName);
  const vias = input.vias ?? [];
  const allPads = resolveAllPads(input.instances);

  // Inner layers only get THT pads (through-hole pads span all layers)
  const thtPads = allPads.filter((pad) => pad.padType === 'tht');

  // Build apertures for inner layer traces, THT pads, and vias
  // Pass 'front' as side param since buildApertures filters by side for SMD —
  // THT pads have no side filter, and inner layer wires are already filtered
  const { defs, lookup } = buildApertures(thtPads, layerWires, 'front', { vias });

  const layerNum = `L${String(layerIndex + 1)}`; // L2 for In1.Cu, L3 for In2.Cu, etc.

  const lines: string[] = [];

  // Header
  lines.push(gerberHeader({
    comment: `Inner Copper ${String(layerIndex)} (${layerName})`,
    fileFunction: `Copper,${layerNum},Inr`,
  }));

  // Aperture definitions
  lines.push(gerberApertureDefs(defs));

  // Set linear interpolation mode
  lines.push('G01*');

  // Draw traces
  for (let i = 0; i < layerWires.length; i++) {
    const wire = layerWires[i];
    if (wire.points.length < 2) { continue; }

    const aKey = traceApertureKey(wire.width, 0);
    const dCode = lookup.get(aKey);
    if (dCode === undefined) { continue; }

    lines.push(`D${dCode}*`);

    // Move to first point (pen up)
    const p0 = wire.points[0];
    lines.push(`X${fmtCoord(p0.x)}Y${fmtCoord(p0.y)}D02*`);

    // Draw to subsequent points (pen down)
    for (let j = 1; j < wire.points.length; j++) {
      const p = wire.points[j];
      lines.push(`X${fmtCoord(p.x)}Y${fmtCoord(p.y)}D01*`);
    }
  }

  // Flash THT pads (through-hole pads span all copper layers)
  for (let i = 0; i < thtPads.length; i++) {
    const pad = thtPads[i];
    const aKey = padApertureKey(pad, 0);
    const dCode = lookup.get(aKey);
    if (dCode === undefined) { continue; }

    lines.push(`D${dCode}*`);
    lines.push(`X${fmtCoord(pad.x)}Y${fmtCoord(pad.y)}D03*`);
  }

  // Flash via pads — through vias appear on all copper layers
  for (let i = 0; i < vias.length; i++) {
    const via = vias[i];
    const aKey = viaApertureKey(via, 0);
    const dCode = lookup.get(aKey);
    if (dCode === undefined) { continue; }

    lines.push(`D${dCode}*`);
    lines.push(`X${fmtCoord(via.x)}Y${fmtCoord(via.y)}D03*`);
  }

  // Footer
  lines.push(gerberFooter());

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Silkscreen Layer Generator
// ---------------------------------------------------------------------------

/**
 * Generate a silkscreen layer for a given side.
 *
 * Contents:
 * - Component body outlines (simplified rectangles)
 * - Reference designator text
 */
export function generateSilkscreenLayer(input: GerberInput, side: 'front' | 'back'): string {
  const sideInstances = filterInstancesForSide(input.instances, side);

  const lines: string[] = [];

  // Header
  const layerPos = side === 'front' ? 'Top' : 'Bot';
  lines.push(gerberHeader({
    comment: `${side === 'front' ? 'Front' : 'Back'} Silkscreen`,
    fileFunction: `Legend,${layerPos}`,
  }));

  // Aperture for silkscreen lines
  lines.push(`%ADD10C,${formatMm(SILKSCREEN_APERTURE)}*%`);

  // Set linear interpolation mode
  lines.push('G01*');
  lines.push('D10*');

  for (let i = 0; i < sideInstances.length; i++) {
    const inst = sideInstances[i];
    const bw = (inst.bodyWidth ?? DEFAULT_BODY_WIDTH) + SILKSCREEN_BODY_MARGIN * 2;
    const bh = (inst.bodyHeight ?? DEFAULT_BODY_HEIGHT) + SILKSCREEN_BODY_MARGIN * 2;

    // Compute body outline corners (before rotation)
    const halfW = bw / 2;
    const halfH = bh / 2;
    const corners = [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH },
    ];

    // Rotate corners around instance center
    const rotatedCorners = [];
    for (let c = 0; c < corners.length; c++) {
      const rot = rotatePoint(corners[c].x, corners[c].y, 0, 0, inst.pcbRotation);
      rotatedCorners.push({
        x: inst.pcbX + rot.x,
        y: inst.pcbY + rot.y,
      });
    }

    // Draw body outline (closed rectangle)
    lines.push(`X${fmtCoord(rotatedCorners[0].x)}Y${fmtCoord(rotatedCorners[0].y)}D02*`);
    for (let c = 1; c < rotatedCorners.length; c++) {
      lines.push(`X${fmtCoord(rotatedCorners[c].x)}Y${fmtCoord(rotatedCorners[c].y)}D01*`);
    }
    // Close the rectangle
    lines.push(`X${fmtCoord(rotatedCorners[0].x)}Y${fmtCoord(rotatedCorners[0].y)}D01*`);

    // Draw pin-1 marker (small dash at corner 0 → midpoint of edge 0-1)
    const midX = (rotatedCorners[0].x + rotatedCorners[1].x) / 2;
    const midY = (rotatedCorners[0].y + rotatedCorners[1].y) / 2;
    const markerX = (rotatedCorners[0].x + midX) / 2;
    const markerY = (rotatedCorners[0].y + midY) / 2;
    lines.push(`X${fmtCoord(rotatedCorners[0].x)}Y${fmtCoord(rotatedCorners[0].y)}D02*`);
    lines.push(`X${fmtCoord(markerX)}Y${fmtCoord(markerY)}D01*`);

    // Draw reference designator text
    // Position text above the component body
    const textOriginX = inst.pcbX - (inst.referenceDesignator.length * 0.6);
    const textOriginY = inst.pcbY - halfH - SILKSCREEN_BODY_MARGIN - 0.8;

    const charWidth = 0.8;
    const charHeight = 1.0;
    const charSpacing = 0.2;

    const strokes = textToStrokes(
      inst.referenceDesignator,
      textOriginX,
      textOriginY,
      charWidth,
      charHeight,
      charSpacing,
    );

    for (let s = 0; s < strokes.length; s++) {
      const seg = strokes[s];
      lines.push(`X${fmtCoord(seg.x1)}Y${fmtCoord(seg.y1)}D02*`);
      lines.push(`X${fmtCoord(seg.x2)}Y${fmtCoord(seg.y2)}D01*`);
    }
  }

  // Footer
  lines.push(gerberFooter());

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Soldermask Layer Generator
// ---------------------------------------------------------------------------

/**
 * Generate a soldermask layer for a given side.
 *
 * The soldermask file represents the mask itself. Areas where solder mask
 * is removed (pad openings) use clear polarity (%LPC*%) and are drawn
 * slightly larger than the pads by the soldermask clearance.
 */
export function generateSoldermaskLayer(input: GerberInput, side: 'front' | 'back'): string {
  const allPads = resolveAllPads(input.instances);
  const sidePads = filterPadsForCopper(allPads, side);
  const vias = input.vias ?? [];

  // Build apertures with soldermask clearance expansion
  // tentedFilter: true means tented vias are excluded from aperture list
  const { defs, lookup } = buildApertures(sidePads, [], side, {
    clearance: SOLDERMASK_CLEARANCE,
    vias,
    tentedFilter: true,
  });

  const lines: string[] = [];

  // Header
  const layerPos = side === 'front' ? 'Top' : 'Bot';
  lines.push(gerberHeader({
    comment: `${side === 'front' ? 'Front' : 'Back'} Soldermask`,
    fileFunction: `Soldermask,${layerPos}`,
  }));

  // Aperture definitions (with clearance-expanded sizes)
  lines.push(gerberApertureDefs(defs));

  // The soldermask Gerber is "positive" — drawn regions are where mask is REMOVED.
  // (Some manufacturers expect the inverse, but positive polarity with pad openings
  //  is the dominant convention for RS-274X.)
  //
  // We draw all pad openings:
  lines.push('%LPD*%');

  for (let i = 0; i < sidePads.length; i++) {
    const pad = sidePads[i];
    const aKey = padApertureKey(pad, SOLDERMASK_CLEARANCE);
    const dCode = lookup.get(aKey);
    if (dCode === undefined) continue;

    lines.push(`D${dCode}*`);
    lines.push(`X${fmtCoord(pad.x)}Y${fmtCoord(pad.y)}D03*`);
  }

  // Via mask openings — non-tented vias need soldermask removed
  for (let i = 0; i < vias.length; i++) {
    const via = vias[i];
    if (via.tented) continue; // tented vias keep mask coverage
    const aKey = viaApertureKey(via, SOLDERMASK_CLEARANCE);
    const dCode = lookup.get(aKey);
    if (dCode === undefined) continue;

    lines.push(`D${dCode}*`);
    lines.push(`X${fmtCoord(via.x)}Y${fmtCoord(via.y)}D03*`);
  }

  // Footer
  lines.push(gerberFooter());

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Paste Layer Generator
// ---------------------------------------------------------------------------

/**
 * Generate a solder paste layer for a given side.
 *
 * Only includes SMD pads — through-hole pads do not get paste.
 */
export function generatePasteLayer(input: GerberInput, side: 'front' | 'back'): string {
  const allPads = resolveAllPads(input.instances);
  const smdPads = filterSmdPadsForSide(allPads, side);

  // Build apertures for SMD pads only (no clearance expansion for paste)
  const { defs, lookup } = buildApertures(smdPads, [], side);

  const lines: string[] = [];

  // Header
  const layerPos = side === 'front' ? 'Top' : 'Bot';
  lines.push(gerberHeader({
    comment: `${side === 'front' ? 'Front' : 'Back'} Paste`,
    fileFunction: `Paste,${layerPos}`,
  }));

  // Aperture definitions
  lines.push(gerberApertureDefs(defs));

  // Flash paste openings at SMD pad locations
  for (let i = 0; i < smdPads.length; i++) {
    const pad = smdPads[i];
    const aKey = padApertureKey(pad, 0);
    const dCode = lookup.get(aKey);
    if (dCode === undefined) continue;

    lines.push(`D${dCode}*`);
    lines.push(`X${fmtCoord(pad.x)}Y${fmtCoord(pad.y)}D03*`);
  }

  // Footer
  lines.push(gerberFooter());

  return lines.join('\n');
}

/**
 * Filter for only SMD pads on a given side.
 */
function filterSmdPadsForSide(pads: ResolvedPad[], side: 'front' | 'back'): ResolvedPad[] {
  const result: ResolvedPad[] = [];
  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i];
    if (pad.padType === 'smd' && pad.side === side) {
      result.push(pad);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Board Outline Generator
// ---------------------------------------------------------------------------

/**
 * Generate the board outline (Edge.Cuts) Gerber layer.
 *
 * If a custom outline polygon is provided, uses that.
 * Otherwise, generates a rectangle from boardWidth x boardHeight.
 */
export function generateBoardOutline(input: GerberInput): string {
  const lines: string[] = [];

  // Header
  lines.push(gerberHeader({
    comment: 'Board Outline',
    fileFunction: 'Profile,NP',
  }));

  // Thin outline aperture
  lines.push(`%ADD10C,${formatMm(OUTLINE_APERTURE)}*%`);

  // Set linear interpolation mode
  lines.push('G01*');
  lines.push('D10*');

  if (input.boardOutline && input.boardOutline.length >= 3) {
    // Custom outline polygon
    const outline = input.boardOutline;
    lines.push(`X${fmtCoord(outline[0].x)}Y${fmtCoord(outline[0].y)}D02*`);
    for (let i = 1; i < outline.length; i++) {
      lines.push(`X${fmtCoord(outline[i].x)}Y${fmtCoord(outline[i].y)}D01*`);
    }
    // Close the polygon
    lines.push(`X${fmtCoord(outline[0].x)}Y${fmtCoord(outline[0].y)}D01*`);
  } else {
    // Default rectangle
    const w = input.boardWidth;
    const h = input.boardHeight;

    lines.push(`X${fmtCoord(0)}Y${fmtCoord(0)}D02*`);
    lines.push(`X${fmtCoord(w)}Y${fmtCoord(0)}D01*`);
    lines.push(`X${fmtCoord(w)}Y${fmtCoord(h)}D01*`);
    lines.push(`X${fmtCoord(0)}Y${fmtCoord(h)}D01*`);
    lines.push(`X${fmtCoord(0)}Y${fmtCoord(0)}D01*`);
  }

  // Footer
  lines.push(gerberFooter());

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Excellon Drill File Generator
// ---------------------------------------------------------------------------

interface DrillHit {
  x: number;        // mm
  y: number;        // mm
  diameter: number;  // mm
}

/**
 * Generate an Excellon drill file for all through-hole pads.
 *
 * Format: FMAT,2 with METRIC,TZ (trailing zeros).
 * Coordinates are in integer micrometers (mm * 1000).
 */
function generateDrillFile(input: GerberInput): string {
  const allPads = resolveAllPads(input.instances);
  const vias = input.vias ?? [];

  // Collect drill hits from THT pads
  const drillHits: DrillHit[] = [];
  for (let i = 0; i < allPads.length; i++) {
    const pad = allPads[i];
    if (pad.padType !== 'tht' || pad.drill <= 0) continue;
    drillHits.push({
      x: pad.x,
      y: pad.y,
      diameter: pad.drill,
    });
  }

  // Collect drill hits from vias
  for (let i = 0; i < vias.length; i++) {
    const via = vias[i];
    drillHits.push({
      x: via.x,
      y: via.y,
      diameter: via.drillDiameter,
    });
  }

  if (drillHits.length === 0) {
    // Return a valid but empty drill file
    return [
      'M48',
      'FMAT,2',
      'METRIC,TZ',
      '%',
      'M30',
    ].join('\n');
  }

  // Group drill hits by diameter → tool assignments
  const toolMap = new Map<number, DrillHit[]>();
  for (let i = 0; i < drillHits.length; i++) {
    const hit = drillHits[i];
    const key = Math.round(hit.diameter * 10000); // avoid floating-point key issues
    const existing = toolMap.get(key);
    if (existing) {
      existing.push(hit);
    } else {
      toolMap.set(key, [hit]);
    }
  }

  // Sort tool diameters ascending and assign tool numbers
  const toolDiameters: number[] = [];
  toolMap.forEach(function collectDiameterKeys(_hits, key) {
    toolDiameters.push(key);
  });
  toolDiameters.sort(function sortAscending(a, b) { return a - b; });

  const lines: string[] = [];

  // Header
  lines.push('M48');
  lines.push('FMAT,2');
  lines.push('METRIC,TZ');

  // Tool definitions
  for (let t = 0; t < toolDiameters.length; t++) {
    const diamKey = toolDiameters[t];
    const diam = diamKey / 10000;
    lines.push(`T${t + 1}C${diam.toFixed(3)}`);
  }

  // End header
  lines.push('%');

  // Drill hits grouped by tool
  for (let t = 0; t < toolDiameters.length; t++) {
    const diamKey = toolDiameters[t];
    const hits = toolMap.get(diamKey);
    if (!hits) continue;

    lines.push(`T${t + 1}`);

    for (let h = 0; h < hits.length; h++) {
      const hit = hits[h];
      lines.push(`X${mmToExcellon(hit.x)}Y${mmToExcellon(hit.y)}`);
    }
  }

  // End of program
  lines.push('M30');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Instance / Side Filtering
// ---------------------------------------------------------------------------

function filterInstancesForSide(instances: GerberInstance[], side: 'front' | 'back'): GerberInstance[] {
  const result: GerberInstance[] = [];
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    const instSide = inst.pcbSide === 'back' ? 'back' : 'front';
    if (instSide === side) {
      result.push(inst);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Generate a complete set of Gerber manufacturing files from PCB layout data.
 *
 * Returns:
 * - Copper layers: front + inner (if layerCount > 2) + back
 * - Silkscreen, soldermask, paste for front/back
 * - Board outline
 * - 1 Excellon drill file
 *
 * All coordinates in the input are in millimeters.
 * Output uses Gerber RS-274X format (FSLAX36Y36, MOMM) and Excellon FMAT,2 METRIC.
 */
export function generateGerber(input: GerberInput): GerberOutput {
  const layerCount = input.layerCount ?? 2;

  const layers: GerberLayer[] = [
    // Front copper layer
    {
      name: 'F.Cu',
      type: 'copper',
      side: 'front',
      content: generateCopperLayer(input, 'front'),
    },
  ];

  // Inner copper layers (In1.Cu, In2.Cu, ..., InN.Cu)
  for (let i = 1; i < layerCount - 1; i++) {
    const layerName = `In${String(i)}.Cu`;
    layers.push({
      name: layerName,
      type: 'copper',
      side: layerName,
      content: generateInnerCopperLayer(input, layerName, i),
    });
  }

  // Back copper layer
  layers.push({
    name: 'B.Cu',
    type: 'copper',
    side: 'back',
    content: generateCopperLayer(input, 'back'),
  });

  // Non-copper layers
  layers.push(

    // Silkscreen layers
    {
      name: 'F.SilkS',
      type: 'silkscreen',
      side: 'front',
      content: generateSilkscreenLayer(input, 'front'),
    },
    {
      name: 'B.SilkS',
      type: 'silkscreen',
      side: 'back',
      content: generateSilkscreenLayer(input, 'back'),
    },

    // Soldermask layers
    {
      name: 'F.Mask',
      type: 'soldermask',
      side: 'front',
      content: generateSoldermaskLayer(input, 'front'),
    },
    {
      name: 'B.Mask',
      type: 'soldermask',
      side: 'back',
      content: generateSoldermaskLayer(input, 'back'),
    },

    // Paste layers
    {
      name: 'F.Paste',
      type: 'paste',
      side: 'front',
      content: generatePasteLayer(input, 'front'),
    },
    {
      name: 'B.Paste',
      type: 'paste',
      side: 'back',
      content: generatePasteLayer(input, 'back'),
    },

    // Board outline
    {
      name: 'Edge.Cuts',
      type: 'outline',
      side: 'front', // outline has no meaningful side; 'front' is conventional
      content: generateBoardOutline(input),
    },
  );

  const drillFile = generateDrillFile(input);

  return { layers, drillFile };
}

// ---------------------------------------------------------------------------
// Bridge: DB types → GerberInput
// ---------------------------------------------------------------------------

export interface BuildGerberOptions {
  boardWidth: number;
  boardHeight: number;
  boardOutline?: Array<{ x: number; y: number }>;
  vias?: GerberVia[];
}

/**
 * Convert raw database types (CircuitInstanceData, CircuitWireData, ComponentPartData)
 * into a typed GerberInput for the pure Gerber generation pipeline.
 *
 * - Filters wires to only PCB-view wires
 * - Maps part connectors to GerberConnector format
 * - Extracts footprint from part meta
 * - Handles null pcbX/pcbY/pcbRotation/pcbSide with sensible defaults
 */
export function buildGerberInput(
  instances: CircuitInstanceData[],
  wires: CircuitWireData[],
  parts: ComponentPartData[],
  options: BuildGerberOptions,
): GerberInput {
  // Build a part lookup map
  const partMap = new Map<number, ComponentPartData>();
  for (let i = 0; i < parts.length; i++) {
    partMap.set(parts[i].id, parts[i]);
  }

  // Convert instances
  const gerberInstances: GerberInstance[] = [];
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    const part = inst.partId != null ? partMap.get(inst.partId) : undefined;
    const meta = (part?.meta ?? {}) as Record<string, unknown>;
    const rawConnectors = (part?.connectors ?? []) as Array<Record<string, unknown>>;

    const connectors: GerberConnector[] = [];
    for (let j = 0; j < rawConnectors.length; j++) {
      const c = rawConnectors[j];
      connectors.push({
        id: String(c.id ?? `pin${j}`),
        name: String(c.name ?? `PIN${j + 1}`),
        padType: typeof c.padType === 'string' ? c.padType : undefined,
        padWidth: typeof c.padWidth === 'number' ? c.padWidth : undefined,
        padHeight: typeof c.padHeight === 'number' ? c.padHeight : undefined,
        padShape: typeof c.padShape === 'string' ? c.padShape : undefined,
        drill: typeof c.drill === 'number' ? c.drill : undefined,
        offsetX: typeof c.offsetX === 'number' ? c.offsetX : undefined,
        offsetY: typeof c.offsetY === 'number' ? c.offsetY : undefined,
      });
    }

    gerberInstances.push({
      id: inst.id,
      referenceDesignator: inst.referenceDesignator,
      pcbX: inst.pcbX ?? 0,
      pcbY: inst.pcbY ?? 0,
      pcbRotation: inst.pcbRotation ?? 0,
      pcbSide: inst.pcbSide ?? 'front',
      connectors,
      footprint: (typeof meta.package === 'string' ? meta.package : ''),
      bodyWidth: typeof meta.bodyWidth === 'number' ? meta.bodyWidth : undefined,
      bodyHeight: typeof meta.bodyHeight === 'number' ? meta.bodyHeight : undefined,
    });
  }

  // Convert wires — filter to PCB view only
  const gerberWires: GerberWire[] = [];
  for (let i = 0; i < wires.length; i++) {
    const wire = wires[i];
    if (wire.view !== 'pcb') continue;

    const rawPoints = Array.isArray(wire.points) ? wire.points : [];
    const points: Array<{ x: number; y: number }> = [];
    for (let j = 0; j < rawPoints.length; j++) {
      const pt = rawPoints[j];
      if (pt && typeof pt === 'object') {
        const p = pt as Record<string, unknown>;
        if (typeof p.x === 'number' && typeof p.y === 'number') {
          points.push({ x: p.x, y: p.y });
        }
      }
    }

    gerberWires.push({
      layer: wire.layer ?? 'front',
      points,
      width: wire.width,
    });
  }

  return {
    boardWidth: options.boardWidth,
    boardHeight: options.boardHeight,
    instances: gerberInstances,
    wires: gerberWires,
    vias: options.vias,
    boardOutline: options.boardOutline,
  };
}

// ---------------------------------------------------------------------------
// Legacy API — original export-generators.ts signature used by ai-tools.ts
// ---------------------------------------------------------------------------

export function generateLegacyGerber(
  instances: CircuitInstanceData[],
  wires: CircuitWireData[],
  parts: ComponentPartData[],
  projectName: string,
): ExportResult {
  const partMap = new Map<number, ComponentPartData>();
  for (const part of parts) {
    partMap.set(part.id, part);
  }

  // Collect all PCB coordinates to compute board outline
  const allX: number[] = [];
  const allY: number[] = [];

  for (const inst of instances) {
    if (inst.pcbX !== null && inst.pcbY !== null) {
      allX.push(inst.pcbX);
      allY.push(inst.pcbY);
    }
  }

  for (const wire of wires) {
    if (Array.isArray(wire.points)) {
      for (const pt of wire.points) {
        if (pt && typeof pt === 'object') {
          const p = pt as Record<string, unknown>;
          if (typeof p.x === 'number' && typeof p.y === 'number') {
            allX.push(p.x);
            allY.push(p.y);
          }
        }
      }
    }
  }

  // Default board if no coordinates
  const MARGIN = 5; // mm
  const minX = allX.length > 0 ? Math.min(...allX) - MARGIN : 0;
  const minY = allY.length > 0 ? Math.min(...allY) - MARGIN : 0;
  const maxX = allX.length > 0 ? Math.max(...allX) + MARGIN : 100;
  const maxY = allY.length > 0 ? Math.max(...allY) + MARGIN : 100;

  // Convert mm to Gerber integer coords (format 4.6 → multiply by 1e6)
  const g = (mm: number) => Math.round(mm * 1e6);

  // ========================================
  // Layer 1: Board Outline (Edge.Cuts)
  // ========================================
  const outlineLines = [
    `G04 Board Outline - ${projectName}*`,
    '%FSLAX46Y46*%',
    '%MOIN*%',
    '%ADD10C,0.150000*%',
    'D10*',
    `X${g(minX)}Y${g(minY)}D02*`,
    `X${g(maxX)}Y${g(minY)}D01*`,
    `X${g(maxX)}Y${g(maxY)}D01*`,
    `X${g(minX)}Y${g(maxY)}D01*`,
    `X${g(minX)}Y${g(minY)}D01*`,
    'M02*',
  ];

  // ========================================
  // Layer 2: Front Copper (F.Cu)
  // ========================================
  const copperLines = [
    `G04 Front Copper Layer - ${projectName}*`,
    '%FSLAX46Y46*%',
    '%MOIN*%',
    '%ADD11C,0.800000*%', // Round pad aperture
    '%ADD12R,1.600000X1.600000*%', // Rectangular pad aperture
    '%ADD13C,0.254000*%', // Trace aperture
  ];

  // Component pads
  copperLines.push('D11*');
  for (const inst of instances) {
    if (inst.pcbX === null || inst.pcbY === null) continue;

    const part = inst.partId != null ? partMap.get(inst.partId) : undefined;
    const connectorCount = part ? part.connectors.length : 2;
    const padCount = Math.max(connectorCount, 2);

    // Place pads in a row centered on the component position
    const padSpacing = 2.54; // mm, standard 100-mil spacing
    const startOffset = -((padCount - 1) * padSpacing) / 2;

    for (let p = 0; p < padCount; p++) {
      const padX = inst.pcbX + startOffset + p * padSpacing;
      const padY = inst.pcbY;
      copperLines.push(`X${g(padX)}Y${g(padY)}D03*`);
    }
  }

  // PCB traces from wires
  const pcbWires = wires.filter((w) => w.view === 'pcb');
  if (pcbWires.length > 0) {
    copperLines.push('D13*');
    for (const wire of pcbWires) {
      if (!Array.isArray(wire.points) || wire.points.length < 2) continue;
      const pts = wire.points as Array<Record<string, unknown>>;

      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        if (typeof pt.x !== 'number' || typeof pt.y !== 'number') continue;
        const dCode = i === 0 ? 'D02' : 'D01';
        copperLines.push(`X${g(pt.x as number)}Y${g(pt.y as number)}${dCode}*`);
      }
    }
  }

  copperLines.push('M02*');

  // ========================================
  // Layer 3: Drill File (Excellon)
  // ========================================
  const drillLines = [
    `; Drill File - ${projectName}`,
    '; Generated by ProtoPulse',
    'M48',
    ';FORMAT={-:-/ absolute / metric / decimal}',
    'FMAT,2',
    'METRIC,TZ',
    'T01C0.800',
    '%',
    'T01',
  ];

  for (const inst of instances) {
    if (inst.pcbX === null || inst.pcbY === null) continue;

    const part = inst.partId != null ? partMap.get(inst.partId) : undefined;
    const connectorCount = part ? part.connectors.length : 2;
    const padCount = Math.max(connectorCount, 2);
    const padSpacing = 2.54;
    const startOffset = -((padCount - 1) * padSpacing) / 2;

    for (let p = 0; p < padCount; p++) {
      const drillX = inst.pcbX + startOffset + p * padSpacing;
      const drillY = inst.pcbY;
      drillLines.push(`X${drillX.toFixed(3)}Y${drillY.toFixed(3)}`);
    }
  }

  drillLines.push('M30');

  // Concatenate all layers with separator comments
  const content = [
    'G04 === BOARD OUTLINE (Edge.Cuts) ===*',
    ...outlineLines,
    '',
    'G04 === FRONT COPPER (F.Cu) ===*',
    ...copperLines,
    '',
    'G04 === DRILL FILE (Excellon) ===*',
    ...drillLines,
  ].join('\n');

  return {
    content,
    encoding: 'utf8',
    mimeType: 'application/x-gerber',
    filename: `${sanitizeFilename(projectName)}_gerber.gbr`,
  };
}
