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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GerberLayer {
  name: string;
  type: 'copper' | 'silkscreen' | 'soldermask' | 'paste' | 'outline';
  side: 'front' | 'back';
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

export interface GerberInput {
  boardWidth: number;     // mm
  boardHeight: number;    // mm
  instances: GerberInstance[];
  wires: GerberWire[];
  boardOutline?: Array<{ x: number; y: number }>; // custom outline polygon (mm)
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
 * Resolve a connector to its absolute pad position and dimensions,
 * accounting for instance position, rotation, and side.
 */
function resolvePad(
  instance: GerberInstance,
  connector: GerberConnector,
  connectorIndex: number,
  totalConnectors: number,
): ResolvedPad {
  const isTht = connector.padType === 'tht' || (!connector.padType && !isSmallPitch(instance.footprint));
  const padType: 'tht' | 'smd' = isTht ? 'tht' : 'smd';

  const width = connector.padWidth ?? (isTht ? DEFAULT_THT_PAD_WIDTH : DEFAULT_SMD_PAD_WIDTH);
  const height = connector.padHeight ?? (isTht ? DEFAULT_THT_PAD_HEIGHT : DEFAULT_SMD_PAD_HEIGHT);
  const drill = isTht ? (connector.drill ?? DEFAULT_THT_DRILL) : 0;

  let padShape: 'circle' | 'rect' | 'oblong' | 'square';
  if (connector.padShape) {
    padShape = connector.padShape as 'circle' | 'rect' | 'oblong' | 'square';
  } else if (isTht) {
    // Pin 1 of THT is typically square; others circular
    padShape = connectorIndex === 0 ? 'square' : 'circle';
  } else {
    padShape = 'rect';
  }

  // Calculate offset position for connector relative to instance center.
  // If explicit offsets are provided, use them. Otherwise, estimate from
  // footprint geometry (evenly spaced along the component body).
  let localX: number;
  let localY: number;

  if (connector.offsetX !== undefined && connector.offsetY !== undefined) {
    localX = connector.offsetX;
    localY = connector.offsetY;
  } else {
    // Auto-layout: distribute connectors evenly.
    // For DIP-like packages, split connectors between two sides.
    const bodyW = instance.bodyWidth ?? DEFAULT_BODY_WIDTH;
    const bodyH = instance.bodyHeight ?? DEFAULT_BODY_HEIGHT;
    const half = Math.ceil(totalConnectors / 2);

    if (connectorIndex < half) {
      // Left side / top row
      const step = half > 1 ? bodyH / (half - 1) : 0;
      localX = -bodyW / 2;
      localY = -bodyH / 2 + step * connectorIndex;
    } else {
      // Right side / bottom row
      const idx = connectorIndex - half;
      const rightCount = totalConnectors - half;
      const step = rightCount > 1 ? bodyH / (rightCount - 1) : 0;
      localX = bodyW / 2;
      localY = bodyH / 2 - step * idx;
    }
  }

  // Apply instance rotation
  const rotated = rotatePoint(localX, localY, 0, 0, instance.pcbRotation);

  // Apply instance position
  const absX = instance.pcbX + rotated.x;
  const absY = instance.pcbY + rotated.y;

  const side = (instance.pcbSide === 'back' ? 'back' : 'front') as 'front' | 'back';

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
  extra?: { clearance?: number },
): { defs: ApertureDef[]; lookup: Map<string, number> } {
  const clearance = extra?.clearance ?? 0;
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

  const { defs, lookup } = buildApertures(sidePads, sideWires, side);

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
 */
function filterWiresForSide(wires: GerberWire[], side: 'front' | 'back'): GerberWire[] {
  const result: GerberWire[] = [];
  for (let i = 0; i < wires.length; i++) {
    if (wires[i].layer === side) {
      result.push(wires[i]);
    }
  }
  return result;
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

  // Build apertures with soldermask clearance expansion
  const { defs, lookup } = buildApertures(sidePads, [], side, { clearance: SOLDERMASK_CLEARANCE });

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
  toolMap.forEach((_hits, key) => {
    toolDiameters.push(key);
  });
  toolDiameters.sort((a, b) => a - b);

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
 * - 9 Gerber layers: front/back copper, silkscreen, soldermask, paste + board outline
 * - 1 Excellon drill file
 *
 * All coordinates in the input are in millimeters.
 * Output uses Gerber RS-274X format (FSLAX36Y36, MOMM) and Excellon FMAT,2 METRIC.
 */
export function generateGerber(input: GerberInput): GerberOutput {
  const layers: GerberLayer[] = [
    // Copper layers
    {
      name: 'F.Cu',
      type: 'copper',
      side: 'front',
      content: generateCopperLayer(input, 'front'),
    },
    {
      name: 'B.Cu',
      type: 'copper',
      side: 'back',
      content: generateCopperLayer(input, 'back'),
    },

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
  ];

  const drillFile = generateDrillFile(input);

  return { layers, drillFile };
}
