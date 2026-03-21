/**
 * EasyEDA Import Parser
 *
 * Parses EasyEDA JSON format (both Standard and Professional) and converts
 * to ProtoPulse's internal ImportedDesign format.
 *
 * EasyEDA coordinate system:
 *   - Units are in 10mil (0.254mm) increments
 *   - Y-axis is inverted (positive = down)
 *   - Rotation is in degrees, counterclockwise
 *
 * Supported EasyEDA JSON structure:
 *   - Schematic documents (docType: 1 / "1")
 *   - PCB documents (docType: 3 / "3")
 *   - Schematic symbols (docType: 2 / "2")
 *
 * @module easyeda-parser
 */

import type {
  ImportedComponent,
  ImportedDesign,
  ImportedNet,
  ImportedWire,
} from '@/lib/design-import';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** EasyEDA uses 10mil units; 1 unit = 0.254mm */
const EASYEDA_UNIT_MM = 0.254;

/** EasyEDA document types */
const DOC_TYPE_SCHEMATIC = 1;
const DOC_TYPE_SYMBOL = 2;
const DOC_TYPE_PCB = 3;

/** Pin electrical type mapping from EasyEDA type strings to ProtoPulse types */
const PIN_ELECTRICAL_TYPE_MAP: Record<string, ImportedComponent['pins'][0]['type']> = {
  '0': 'unspecified',
  '1': 'input',
  '2': 'output',
  '3': 'bidirectional',
  '4': 'power',
  input: 'input',
  output: 'output',
  bidirectional: 'bidirectional',
  'bi-directional': 'bidirectional',
  power: 'power',
  passive: 'passive',
  unspecified: 'unspecified',
  'open collector': 'output',
  'open emitter': 'output',
  'tri-state': 'bidirectional',
};

/** EasyEDA package name to standard package mapping */
const PACKAGE_NAME_MAP: Record<string, string> = {
  '0201': '0201',
  '0402': '0402',
  '0603': '0603',
  '0805': '0805',
  '1206': '1206',
  '1210': '1210',
  '2010': '2010',
  '2512': '2512',
  SOT23: 'SOT-23',
  'SOT-23': 'SOT-23',
  'SOT23-3': 'SOT-23-3',
  'SOT23-5': 'SOT-23-5',
  'SOT23-6': 'SOT-23-6',
  SOT223: 'SOT-223',
  'SOT-223': 'SOT-223',
  SOT89: 'SOT-89',
  'SOT-89': 'SOT-89',
  SOP8: 'SOIC-8',
  'SOP-8': 'SOIC-8',
  SOIC8: 'SOIC-8',
  'SOIC-8': 'SOIC-8',
  SOIC14: 'SOIC-14',
  'SOIC-14': 'SOIC-14',
  SOIC16: 'SOIC-16',
  'SOIC-16': 'SOIC-16',
  SOP16: 'SOIC-16',
  SSOP8: 'SSOP-8',
  'SSOP-8': 'SSOP-8',
  SSOP16: 'SSOP-16',
  'SSOP-16': 'SSOP-16',
  SSOP20: 'SSOP-20',
  'SSOP-20': 'SSOP-20',
  TSSOP8: 'TSSOP-8',
  'TSSOP-8': 'TSSOP-8',
  TSSOP14: 'TSSOP-14',
  'TSSOP-14': 'TSSOP-14',
  TSSOP16: 'TSSOP-16',
  'TSSOP-16': 'TSSOP-16',
  TSSOP20: 'TSSOP-20',
  'TSSOP-20': 'TSSOP-20',
  QFP32: 'QFP-32',
  QFP44: 'QFP-44',
  QFP48: 'QFP-48',
  QFP64: 'QFP-64',
  QFP100: 'QFP-100',
  LQFP32: 'LQFP-32',
  LQFP44: 'LQFP-44',
  LQFP48: 'LQFP-48',
  LQFP64: 'LQFP-64',
  LQFP100: 'LQFP-100',
  LQFP144: 'LQFP-144',
  QFN16: 'QFN-16',
  QFN20: 'QFN-20',
  QFN24: 'QFN-24',
  QFN32: 'QFN-32',
  QFN48: 'QFN-48',
  DIP8: 'DIP-8',
  'DIP-8': 'DIP-8',
  DIP14: 'DIP-14',
  'DIP-14': 'DIP-14',
  DIP16: 'DIP-16',
  'DIP-16': 'DIP-16',
  DIP18: 'DIP-18',
  'DIP-18': 'DIP-18',
  DIP20: 'DIP-20',
  'DIP-20': 'DIP-20',
  DIP24: 'DIP-24',
  'DIP-24': 'DIP-24',
  DIP28: 'DIP-28',
  'DIP-28': 'DIP-28',
  DIP40: 'DIP-40',
  'DIP-40': 'DIP-40',
  TO92: 'TO-92',
  'TO-92': 'TO-92',
  TO220: 'TO-220',
  'TO-220': 'TO-220',
  'TO-252': 'DPAK',
  DPAK: 'DPAK',
  'TO-263': 'D2PAK',
  D2PAK: 'D2PAK',
  BGA: 'BGA',
};

/** EasyEDA layer ID to standard layer name mapping */
const LAYER_MAP: Record<number, string> = {
  1: 'F.Cu',
  2: 'B.Cu',
  3: 'F.SilkS',
  4: 'B.SilkS',
  5: 'F.Paste',
  6: 'B.Paste',
  7: 'F.Mask',
  8: 'B.Mask',
  10: 'Edge.Cuts',
  11: 'Eco1.User',
  12: 'Eco2.User',
  13: 'F.Fab',
  14: 'B.Fab',
  15: 'Dwgs.User',
  21: 'In1.Cu',
  22: 'In2.Cu',
  23: 'In3.Cu',
  24: 'In4.Cu',
};

// ---------------------------------------------------------------------------
// Types — EasyEDA JSON structures
// ---------------------------------------------------------------------------

/** Shared shape in the EasyEDA JSON canvas array */
interface EasyEdaShape {
  type: string;
  [key: string]: unknown;
}

/** EasyEDA pin extracted from shape data */
interface EasyEdaPin {
  number: string;
  name: string;
  electricalType: string;
  x: number;
  y: number;
}

/** EasyEDA schematic component (LIB shape) */
interface EasyEdaLibComponent {
  refDes: string;
  name: string;
  value: string;
  packageName: string;
  x: number;
  y: number;
  rotation: number;
  pins: EasyEdaPin[];
  properties: Record<string, string>;
  id: string;
}

/** EasyEDA net junction (NETLABEL shape) */
interface EasyEdaNetLabel {
  name: string;
  x: number;
  y: number;
  netId: string;
}

/** EasyEDA wire segment */
interface EasyEdaWireSegment {
  points: Array<{ x: number; y: number }>;
  netId: string;
}

/** EasyEDA PCB component (footprint) */
interface EasyEdaPcbComponent {
  refDes: string;
  name: string;
  packageName: string;
  x: number;
  y: number;
  rotation: number;
  layer: number;
  pads: Array<{ number: string; x: number; y: number; net: string }>;
  properties: Record<string, string>;
  id: string;
}

/** EasyEDA PCB track segment */
interface EasyEdaTrack {
  points: Array<{ x: number; y: number }>;
  width: number;
  layer: number;
  net: string;
}

/** Top-level EasyEDA document JSON */
export interface EasyEdaDocument {
  docType?: string | number;
  title?: string;
  description?: string;
  version?: string;
  editorVersion?: string;
  canvas?: string;
  shape?: string[];
  layers?: Record<string, unknown>;
  BBox?: { x: number; y: number; width: number; height: number };
  head?: Record<string, unknown>;
  // Pro format fields
  schematic?: { sheets?: EasyEdaSheet[] };
  pcb?: { layers?: unknown[]; tracks?: unknown[]; footprints?: unknown[] };
}

/** EasyEDA Pro schematic sheet */
interface EasyEdaSheet {
  title?: string;
  symbols?: unknown[];
  wires?: unknown[];
  netLabels?: unknown[];
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface EasyEdaParseResult {
  design: ImportedDesign;
  boardOutline: Array<{ x: number; y: number }> | null;
  sourceDocType: 'schematic' | 'pcb' | 'symbol' | 'unknown';
}

// ---------------------------------------------------------------------------
// Coordinate conversion helpers
// ---------------------------------------------------------------------------

/**
 * Convert EasyEDA 10mil coordinate to millimeters.
 */
export function easyEdaToMm(value: number): number {
  return Math.round(value * EASYEDA_UNIT_MM * 1000) / 1000;
}

/**
 * Convert millimeters to EasyEDA 10mil coordinate.
 */
export function mmToEasyEda(mm: number): number {
  return Math.round(mm / EASYEDA_UNIT_MM);
}

/**
 * Convert EasyEDA coordinate pair to ProtoPulse coordinates (mm, Y-up).
 */
export function convertCoordinates(x: number, y: number): { x: number; y: number } {
  return {
    x: easyEdaToMm(x),
    y: -easyEdaToMm(y), // Invert Y axis
  };
}

// ---------------------------------------------------------------------------
// Package name normalization
// ---------------------------------------------------------------------------

/**
 * Normalize an EasyEDA package name to a standard ProtoPulse package name.
 * Falls through to the raw name if no mapping exists.
 */
export function normalizePackageName(easyEdaPackage: string): string {
  if (!easyEdaPackage) {
    return '';
  }

  // Try exact match first
  const exact = PACKAGE_NAME_MAP[easyEdaPackage];
  if (exact) {
    return exact;
  }

  // Try case-insensitive match
  const upper = easyEdaPackage.toUpperCase();
  const entries = Array.from(Object.entries(PACKAGE_NAME_MAP));
  for (const [key, value] of entries) {
    if (key.toUpperCase() === upper) {
      return value;
    }
  }

  // Try extracting standard package pattern from longer strings
  // e.g. "C0402_0402" → "0402", "R0805_0805" → "0805"
  const smdMatch = easyEdaPackage.match(/(?:^|[_-])(\d{4})(?:$|[_-])/);
  if (smdMatch && PACKAGE_NAME_MAP[smdMatch[1]]) {
    return PACKAGE_NAME_MAP[smdMatch[1]];
  }

  // Return original if no mapping found
  return easyEdaPackage;
}

// ---------------------------------------------------------------------------
// Shape string parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse an EasyEDA shape string like "LIB~...~...~" into structured data.
 * EasyEDA Standard edition encodes shapes as tilde-delimited strings.
 */
function parseShapeString(shape: string): EasyEdaShape {
  const parts = shape.split('~');
  const type = parts[0];
  return { type, raw: parts, parts };
}

/**
 * Extract components (LIB shapes) from schematic shape strings.
 */
function extractSchematicComponents(shapes: string[]): EasyEdaLibComponent[] {
  const components: EasyEdaLibComponent[] = [];

  shapes.forEach((shape) => {
    const parsed = parseShapeString(shape);
    if (parsed.type !== 'LIB') {
      return;
    }

    const parts = parsed.parts as string[];
    // LIB format: LIB~x~y~rotation~importFlag~id~packageName~...
    // Sub-shapes follow after a separator
    if (parts.length < 7) {
      return;
    }

    const x = parseFloat(parts[1]) || 0;
    const y = parseFloat(parts[2]) || 0;
    const rotation = parseFloat(parts[3]) || 0;
    const id = parts[5] || '';
    const packageName = parts[6] || '';

    // Extract component properties and pins from the nested data
    const properties: Record<string, string> = {};
    const pins: EasyEdaPin[] = [];
    let refDes = '';
    let name = '';
    let value = '';

    // Parse sub-shapes within the LIB (delimited by '#@$')
    const subContent = parts.slice(7).join('~');
    const subShapes = subContent.split('#@$');

    subShapes.forEach((sub) => {
      const subParts = sub.split('~');
      const subType = subParts[0];

      if (subType === 'P') {
        // Pin: P~show~x1~y1~x2~y2~color~number~name~...~electricalType
        const pinNumber = subParts[7] || '';
        const pinName = subParts[8] || '';
        const pinX = parseFloat(subParts[2]) || 0;
        const pinY = parseFloat(subParts[3]) || 0;
        const electricalType = subParts.length > 10 ? subParts[subParts.length - 1] : '0';

        if (pinNumber) {
          pins.push({
            number: pinNumber,
            name: pinName,
            electricalType,
            x: pinX,
            y: pinY,
          });
        }
      } else if (subType === 'T') {
        // Text attribute: T~text~x~y~...~key~value
        const textType = subParts[1] || '';
        const textVal = subParts[2] || '';
        if (textType === 'refDes' || textType === 'P') {
          refDes = textVal;
        } else if (textType === 'name' || textType === 'N') {
          name = textVal;
        } else if (textType === 'value' || textType === 'V') {
          value = textVal;
        }
      } else if (subType === 'A') {
        // Attribute: A~key~value
        const key = subParts[1] || '';
        const val = subParts[2] || '';
        if (key) {
          properties[key] = val;
          if (key === 'Ref' || key === 'refDes') {
            refDes = refDes || val;
          }
          if (key === 'Name' || key === 'name') {
            name = name || val;
          }
          if (key === 'Value' || key === 'value') {
            value = value || val;
          }
        }
      }
    });

    // Fallback: extract refDes from properties
    if (!refDes) {
      refDes = properties.Designator ?? properties.RefDes ?? properties.Ref ?? id;
    }
    if (!name) {
      name = properties.Name ?? properties.Component ?? packageName;
    }
    if (!value) {
      value = properties.Value ?? '';
    }

    components.push({
      refDes,
      name,
      value,
      packageName,
      x,
      y,
      rotation,
      pins,
      properties,
      id,
    });
  });

  return components;
}

/**
 * Extract net labels from schematic shape strings.
 */
function extractNetLabels(shapes: string[]): EasyEdaNetLabel[] {
  const labels: EasyEdaNetLabel[] = [];

  shapes.forEach((shape) => {
    const parsed = parseShapeString(shape);
    if (parsed.type !== 'N') {
      return;
    }

    const parts = parsed.parts as string[];
    // N~x~y~rotation~netName~netId~...
    if (parts.length < 5) {
      return;
    }

    labels.push({
      name: parts[4] || '',
      x: parseFloat(parts[1]) || 0,
      y: parseFloat(parts[2]) || 0,
      netId: parts[5] || '',
    });
  });

  return labels;
}

/**
 * Extract wire segments from schematic shape strings.
 */
function extractWireSegments(shapes: string[]): EasyEdaWireSegment[] {
  const wires: EasyEdaWireSegment[] = [];

  shapes.forEach((shape) => {
    const parsed = parseShapeString(shape);
    if (parsed.type !== 'W') {
      return;
    }

    const parts = parsed.parts as string[];
    // W~x1~y1~x2~y2~...~strokeColor~netId
    if (parts.length < 5) {
      return;
    }

    const points: Array<{ x: number; y: number }> = [];
    // Points come in pairs starting at index 1
    for (let i = 1; i < parts.length - 2; i += 2) {
      const px = parseFloat(parts[i]);
      const py = parseFloat(parts[i + 1]);
      if (!isNaN(px) && !isNaN(py)) {
        points.push({ x: px, y: py });
      }
    }

    const netId = parts[parts.length - 1] || '';

    if (points.length >= 2) {
      wires.push({ points, netId });
    }
  });

  return wires;
}

/**
 * Extract board outline from PCB shape strings (COPPERAREA or BOARD_OUTLINE).
 */
function extractBoardOutline(shapes: string[]): Array<{ x: number; y: number }> | null {
  for (const shape of shapes) {
    const parsed = parseShapeString(shape);
    if (parsed.type !== 'SOLIDREGION' && parsed.type !== 'BOARD_OUTLINE') {
      continue;
    }

    const parts = parsed.parts as string[];
    // Check for board outline type
    if (parsed.type === 'SOLIDREGION' && parts[1] !== 'board') {
      continue;
    }

    // Extract point string (SVG path-like format): M x1 y1 L x2 y2 L x3 y3 ... Z
    const pathStr = parts[2] || parts[3] || '';
    return parseSvgPath(pathStr);
  }

  return null;
}

/**
 * Parse a simplified SVG path string into coordinate points.
 * Supports M (moveto), L (lineto), Z (close) commands.
 */
function parseSvgPath(pathStr: string): Array<{ x: number; y: number }> | null {
  if (!pathStr) {
    return null;
  }

  const points: Array<{ x: number; y: number }> = [];
  // Match commands: M/L followed by coordinate pairs, or numbers separated by spaces/commas
  const tokens = pathStr.replace(/[MLZ]/gi, ' ').trim().split(/[\s,]+/);

  for (let i = 0; i < tokens.length - 1; i += 2) {
    const x = parseFloat(tokens[i]);
    const y = parseFloat(tokens[i + 1]);
    if (!isNaN(x) && !isNaN(y)) {
      points.push(convertCoordinates(x, y));
    }
  }

  return points.length >= 3 ? points : null;
}

/**
 * Extract PCB components (footprints) from PCB shape strings.
 */
function extractPcbComponents(shapes: string[]): EasyEdaPcbComponent[] {
  const components: EasyEdaPcbComponent[] = [];

  shapes.forEach((shape) => {
    const parsed = parseShapeString(shape);
    if (parsed.type !== 'LIB') {
      return;
    }

    const parts = parsed.parts as string[];
    if (parts.length < 7) {
      return;
    }

    const x = parseFloat(parts[1]) || 0;
    const y = parseFloat(parts[2]) || 0;
    const rotation = parseFloat(parts[3]) || 0;
    const layer = parseInt(parts[4], 10) || 1;
    const id = parts[5] || '';
    const packageName = parts[6] || '';

    const properties: Record<string, string> = {};
    const pads: Array<{ number: string; x: number; y: number; net: string }> = [];
    let refDes = '';
    let name = '';

    // Parse sub-shapes
    const subContent = parts.slice(7).join('~');
    const subShapes = subContent.split('#@$');

    subShapes.forEach((sub) => {
      const subParts = sub.split('~');
      const subType = subParts[0];

      if (subType === 'PAD') {
        // PAD~shape~x~y~width~height~layer~net~number~...
        const padNumber = subParts[8] || subParts[7] || '';
        const padX = parseFloat(subParts[2]) || 0;
        const padY = parseFloat(subParts[3]) || 0;
        const padNet = subParts[7] || '';

        if (padNumber) {
          pads.push({ number: padNumber, x: padX, y: padY, net: padNet });
        }
      } else if (subType === 'A' || subType === 'T') {
        const key = subParts[1] || '';
        const val = subParts[2] || '';
        if (key) {
          properties[key] = val;
        }
      }
    });

    refDes = properties.Designator ?? properties.RefDes ?? properties.Ref ?? id;
    name = properties.Name ?? properties.Component ?? packageName;

    components.push({
      refDes,
      name,
      packageName,
      x,
      y,
      rotation,
      layer,
      pads,
      properties,
      id,
    });
  });

  return components;
}

/**
 * Extract PCB tracks from shape strings.
 */
function extractPcbTracks(shapes: string[]): EasyEdaTrack[] {
  const tracks: EasyEdaTrack[] = [];

  shapes.forEach((shape) => {
    const parsed = parseShapeString(shape);
    if (parsed.type !== 'TRACK') {
      return;
    }

    const parts = parsed.parts as string[];
    // TRACK~width~layer~net~pointsString~id
    if (parts.length < 5) {
      return;
    }

    const width = parseFloat(parts[1]) || 0;
    const layer = parseInt(parts[2], 10) || 1;
    const net = parts[3] || '';
    const pointsStr = parts[4] || '';

    const coords = pointsStr.split(/[\s,]+/).map(Number);
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < coords.length - 1; i += 2) {
      if (!isNaN(coords[i]) && !isNaN(coords[i + 1])) {
        points.push({ x: coords[i], y: coords[i + 1] });
      }
    }

    if (points.length >= 2) {
      tracks.push({ points, width, layer, net });
    }
  });

  return tracks;
}

// ---------------------------------------------------------------------------
// Net building
// ---------------------------------------------------------------------------

/**
 * Build net connections from wire segments, net labels, and component pins.
 * Groups pins by net using proximity-based matching against wire endpoints.
 */
function buildNets(
  components: EasyEdaLibComponent[],
  wires: EasyEdaWireSegment[],
  netLabels: EasyEdaNetLabel[],
): ImportedNet[] {
  // Build net name map from labels
  const netIdToName = new Map<string, string>();
  netLabels.forEach((label) => {
    if (label.netId && label.name) {
      netIdToName.set(label.netId, label.name);
    }
  });

  // Group wire endpoints by net
  const netPins = new Map<string, Array<{ componentRef: string; pinNumber: string }>>();

  // Pin proximity threshold in EasyEDA units (5 units = ~1.27mm)
  const PROXIMITY = 5;

  // Build spatial index of component pins
  const pinIndex: Array<{
    refDes: string;
    pinNumber: string;
    x: number;
    y: number;
  }> = [];
  components.forEach((comp) => {
    comp.pins.forEach((pin) => {
      pinIndex.push({
        refDes: comp.refDes,
        pinNumber: pin.number,
        x: comp.x + pin.x,
        y: comp.y + pin.y,
      });
    });
  });

  // Match wire endpoints to component pins
  wires.forEach((wire) => {
    const netName = netIdToName.get(wire.netId) || wire.netId || `Net_${wires.indexOf(wire)}`;

    wire.points.forEach((point) => {
      pinIndex.forEach((pin) => {
        const dx = Math.abs(point.x - pin.x);
        const dy = Math.abs(point.y - pin.y);
        if (dx <= PROXIMITY && dy <= PROXIMITY) {
          if (!netPins.has(netName)) {
            netPins.set(netName, []);
          }
          const pins = netPins.get(netName)!;
          // Avoid duplicate pin entries
          const exists = pins.some(
            (p) => p.componentRef === pin.refDes && p.pinNumber === pin.pinNumber,
          );
          if (!exists) {
            pins.push({ componentRef: pin.refDes, pinNumber: pin.pinNumber });
          }
        }
      });
    });
  });

  // Convert to ImportedNet array
  const nets: ImportedNet[] = [];
  netPins.forEach((pins, name) => {
    if (pins.length > 0) {
      nets.push({ name, pins });
    }
  });

  return nets;
}

/**
 * Build nets from PCB components by grouping pads that share the same net name.
 */
function buildPcbNets(components: EasyEdaPcbComponent[]): ImportedNet[] {
  const netPins = new Map<string, Array<{ componentRef: string; pinNumber: string }>>();

  components.forEach((comp) => {
    comp.pads.forEach((pad) => {
      if (!pad.net) {
        return;
      }
      if (!netPins.has(pad.net)) {
        netPins.set(pad.net, []);
      }
      const pins = netPins.get(pad.net)!;
      const exists = pins.some(
        (p) => p.componentRef === comp.refDes && p.pinNumber === pad.number,
      );
      if (!exists) {
        pins.push({ componentRef: comp.refDes, pinNumber: pad.number });
      }
    });
  });

  const nets: ImportedNet[] = [];
  netPins.forEach((pins, name) => {
    if (pins.length > 0) {
      nets.push({ name, pins });
    }
  });

  return nets;
}

// ---------------------------------------------------------------------------
// Main parse functions
// ---------------------------------------------------------------------------

/**
 * Detect the document type from an EasyEDA JSON document.
 */
export function detectDocType(doc: EasyEdaDocument): 'schematic' | 'pcb' | 'symbol' | 'unknown' {
  const docType = typeof doc.docType === 'string' ? parseInt(doc.docType, 10) : doc.docType;

  if (docType === DOC_TYPE_SCHEMATIC) {
    return 'schematic';
  }
  if (docType === DOC_TYPE_PCB) {
    return 'pcb';
  }
  if (docType === DOC_TYPE_SYMBOL) {
    return 'symbol';
  }

  // Heuristic detection from content
  if (doc.schematic?.sheets) {
    return 'schematic';
  }
  if (doc.pcb?.tracks || doc.pcb?.footprints) {
    return 'pcb';
  }
  if (doc.shape) {
    // Check shapes for indicators
    const hasLIB = doc.shape.some((s) => s.startsWith('LIB'));
    const hasTRACK = doc.shape.some((s) => s.startsWith('TRACK'));
    const hasPAD = doc.shape.some((s) => s.includes('PAD'));

    if (hasTRACK || hasPAD) {
      return 'pcb';
    }
    if (hasLIB) {
      return 'schematic';
    }
  }

  return 'unknown';
}

/**
 * Validate that the input is a valid EasyEDA JSON document.
 */
export function isValidEasyEdaDocument(input: unknown): input is EasyEdaDocument {
  if (!input || typeof input !== 'object') {
    return false;
  }

  const doc = input as Record<string, unknown>;

  // Must have at least one of: docType, shape, schematic, pcb, head
  return (
    doc.docType !== undefined ||
    Array.isArray(doc.shape) ||
    doc.schematic !== undefined ||
    doc.pcb !== undefined ||
    doc.head !== undefined
  );
}

/**
 * Parse an EasyEDA schematic document into ProtoPulse format.
 */
function parseSchematic(doc: EasyEdaDocument, fileName: string): EasyEdaParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const shapes = doc.shape ?? [];

  if (shapes.length === 0 && !doc.schematic?.sheets) {
    warnings.push('Empty schematic document — no shapes found');
  }

  // Extract from standard format shapes
  const easyComponents = extractSchematicComponents(shapes);
  const easyNetLabels = extractNetLabels(shapes);
  const easyWires = extractWireSegments(shapes);

  // Convert components
  const components: ImportedComponent[] = easyComponents.map((comp) => ({
    refDes: comp.refDes,
    name: comp.name,
    value: comp.value,
    package: normalizePackageName(comp.packageName),
    library: 'EasyEDA',
    position: convertCoordinates(comp.x, comp.y),
    rotation: comp.rotation,
    properties: { ...comp.properties },
    pins: comp.pins.map((pin) => ({
      number: pin.number,
      name: pin.name,
      type: PIN_ELECTRICAL_TYPE_MAP[pin.electricalType] ?? 'unspecified',
      position: convertCoordinates(pin.x, pin.y),
    })),
  }));

  // Build nets
  const nets = buildNets(easyComponents, easyWires, easyNetLabels);

  // Convert wires
  const wires: ImportedWire[] = [];
  easyWires.forEach((w) => {
    for (let i = 0; i < w.points.length - 1; i++) {
      const start = convertCoordinates(w.points[i].x, w.points[i].y);
      const end = convertCoordinates(w.points[i + 1].x, w.points[i + 1].y);
      wires.push({
        start,
        end,
        net: w.netId || undefined,
      });
    }
  });

  // Check for issues
  if (easyComponents.length === 0) {
    warnings.push('No components found in schematic');
  }

  const duplicateRefs = findDuplicateRefDes(components);
  duplicateRefs.forEach((ref) => {
    warnings.push(`Duplicate reference designator: ${ref}`);
  });

  const design: ImportedDesign = {
    format: 'kicad-schematic', // Re-use closest existing ImportFormat — EasyEDA not in enum
    fileName,
    version: doc.editorVersion ?? doc.version,
    title: doc.title ?? undefined,
    components,
    nets,
    wires,
    metadata: {
      sourceFormat: 'easyeda-schematic',
      editorVersion: doc.editorVersion ?? '',
      docType: String(doc.docType ?? ''),
      componentCount: String(components.length),
      netCount: String(nets.length),
      wireCount: String(wires.length),
    },
    warnings,
    errors,
  };

  return { design, boardOutline: null, sourceDocType: 'schematic' };
}

/**
 * Parse an EasyEDA PCB document into ProtoPulse format.
 */
function parsePcb(doc: EasyEdaDocument, fileName: string): EasyEdaParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const shapes = doc.shape ?? [];

  // Extract PCB elements
  const easyComponents = extractPcbComponents(shapes);
  const easyTracks = extractPcbTracks(shapes);
  const boardOutline = extractBoardOutline(shapes);

  // Convert components
  const components: ImportedComponent[] = easyComponents.map((comp) => ({
    refDes: comp.refDes,
    name: comp.name,
    value: '',
    package: normalizePackageName(comp.packageName),
    library: 'EasyEDA',
    position: convertCoordinates(comp.x, comp.y),
    rotation: comp.rotation,
    layer: LAYER_MAP[comp.layer] ?? `Layer${comp.layer}`,
    properties: { ...comp.properties },
    pins: comp.pads.map((pad) => ({
      number: pad.number,
      name: pad.number,
      type: 'passive' as const,
      position: convertCoordinates(pad.x, pad.y),
    })),
  }));

  // Build nets from pad connectivity
  const nets = buildPcbNets(easyComponents);

  // Convert tracks to wires
  const wires: ImportedWire[] = [];
  easyTracks.forEach((track) => {
    for (let i = 0; i < track.points.length - 1; i++) {
      const start = convertCoordinates(track.points[i].x, track.points[i].y);
      const end = convertCoordinates(track.points[i + 1].x, track.points[i + 1].y);
      wires.push({
        start,
        end,
        net: track.net || undefined,
        width: easyEdaToMm(track.width),
        layer: LAYER_MAP[track.layer] ?? `Layer${track.layer}`,
      });
    }
  });

  if (easyComponents.length === 0) {
    warnings.push('No footprints found in PCB document');
  }
  if (!boardOutline) {
    warnings.push('No board outline found');
  }

  const design: ImportedDesign = {
    format: 'kicad-pcb',
    fileName,
    version: doc.editorVersion ?? doc.version,
    title: doc.title ?? undefined,
    components,
    nets,
    wires,
    metadata: {
      sourceFormat: 'easyeda-pcb',
      editorVersion: doc.editorVersion ?? '',
      docType: String(doc.docType ?? ''),
      componentCount: String(components.length),
      netCount: String(nets.length),
      trackCount: String(easyTracks.length),
      hasBoardOutline: String(boardOutline !== null),
    },
    warnings,
    errors,
  };

  return { design, boardOutline, sourceDocType: 'pcb' };
}

/**
 * Parse an EasyEDA symbol document.
 */
function parseSymbol(doc: EasyEdaDocument, fileName: string): EasyEdaParseResult {
  const warnings: string[] = [];
  const shapes = doc.shape ?? [];

  // Symbols are treated as single-component schematics
  const easyComponents = extractSchematicComponents(shapes);

  const components: ImportedComponent[] = easyComponents.map((comp) => ({
    refDes: comp.refDes || 'U?',
    name: comp.name,
    value: comp.value,
    package: normalizePackageName(comp.packageName),
    library: 'EasyEDA',
    position: convertCoordinates(comp.x, comp.y),
    rotation: comp.rotation,
    properties: { ...comp.properties },
    pins: comp.pins.map((pin) => ({
      number: pin.number,
      name: pin.name,
      type: PIN_ELECTRICAL_TYPE_MAP[pin.electricalType] ?? 'unspecified',
      position: convertCoordinates(pin.x, pin.y),
    })),
  }));

  if (components.length === 0) {
    warnings.push('No symbol data found');
  }

  const design: ImportedDesign = {
    format: 'kicad-symbol',
    fileName,
    version: doc.editorVersion ?? doc.version,
    title: doc.title ?? undefined,
    components,
    nets: [],
    wires: [],
    metadata: {
      sourceFormat: 'easyeda-symbol',
      editorVersion: doc.editorVersion ?? '',
      docType: String(doc.docType ?? ''),
    },
    warnings,
    errors: [],
  };

  return { design, boardOutline: null, sourceDocType: 'symbol' };
}

// ---------------------------------------------------------------------------
// Duplicate detection helpers
// ---------------------------------------------------------------------------

function findDuplicateRefDes(components: ImportedComponent[]): string[] {
  const seen = new Map<string, number>();
  components.forEach((comp) => {
    if (comp.refDes) {
      seen.set(comp.refDes, (seen.get(comp.refDes) ?? 0) + 1);
    }
  });

  const duplicates: string[] = [];
  seen.forEach((count, ref) => {
    if (count > 1) {
      duplicates.push(ref);
    }
  });

  return duplicates;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse an EasyEDA JSON string or object into ProtoPulse ImportedDesign format.
 *
 * @param input - JSON string or parsed EasyEDA document object
 * @param fileName - Original file name for metadata
 * @returns Parsed result with design, board outline, and source document type
 * @throws Error if input is not valid JSON or not an EasyEDA document
 */
export function parseEasyEdaDocument(
  input: string | EasyEdaDocument,
  fileName = 'untitled.json',
): EasyEdaParseResult {
  let doc: EasyEdaDocument;

  if (typeof input === 'string') {
    try {
      doc = JSON.parse(input) as EasyEdaDocument;
    } catch {
      throw new Error('Invalid JSON: failed to parse EasyEDA document');
    }
  } else {
    doc = input;
  }

  if (!isValidEasyEdaDocument(doc)) {
    throw new Error('Not a valid EasyEDA document: missing required fields (docType, shape, or head)');
  }

  const docType = detectDocType(doc);

  switch (docType) {
    case 'schematic':
      return parseSchematic(doc, fileName);
    case 'pcb':
      return parsePcb(doc, fileName);
    case 'symbol':
      return parseSymbol(doc, fileName);
    case 'unknown': {
      // Fall back to schematic parsing with a warning
      const result = parseSchematic(doc, fileName);
      result.design.warnings.push('Could not determine document type — treating as schematic');
      result.sourceDocType = 'unknown';
      return result;
    }
  }
}

/**
 * Get the list of EasyEDA file extensions this parser supports.
 */
export function getSupportedExtensions(): string[] {
  return ['.json', '.easyeda'];
}

/**
 * Check if a file name is likely an EasyEDA file.
 */
export function isLikelyEasyEdaFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.json') || lower.endsWith('.easyeda');
}

/**
 * Get a summary of the parsed EasyEDA design for display.
 */
export function getDesignSummary(result: EasyEdaParseResult): {
  docType: string;
  componentCount: number;
  netCount: number;
  wireCount: number;
  hasBoardOutline: boolean;
  warningCount: number;
  errorCount: number;
} {
  return {
    docType: result.sourceDocType,
    componentCount: result.design.components.length,
    netCount: result.design.nets.length,
    wireCount: result.design.wires.length,
    hasBoardOutline: result.boardOutline !== null,
    warningCount: result.design.warnings.length,
    errorCount: result.design.errors.length,
  };
}
