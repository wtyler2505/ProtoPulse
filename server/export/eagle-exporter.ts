// =============================================================================
// Eagle (Autodesk Fusion Electronics) Exporter — Phase 12.8: FZPZ Integration
// Pure function library. No Express routes.
//
// Generates Eagle 9.6.2-compatible XML for schematic (.sch) and board (.brd)
// files from ProtoPulse circuit data.
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EagleInput {
  circuit: { id: number; name: string };
  instances: Array<{
    id: number;
    referenceDesignator: string;
    partId: number;
    schematicX: number;
    schematicY: number;
    schematicRotation: number;
    pcbX: number | null;
    pcbY: number | null;
    pcbRotation: number | null;
    pcbSide: string | null;
  }>;
  nets: Array<{
    name: string;
    netType: string;
    segments: Array<{
      fromInstanceId: number;
      fromPin: string;
      toInstanceId: number;
      toPin: string;
    }>;
  }>;
  wires: Array<{
    netId: number;
    view: string;
    points: Array<{ x: number; y: number }>;
    layer: string;
    width: number;
  }>;
  parts: Map<number, {
    meta: Record<string, unknown>;
    connectors: Array<{ id: string; name: string; padType?: string }>;
  }>;
  boardWidth?: number;
  boardHeight?: number;
}

export interface EagleOutput {
  schematic: string; // .sch XML content
  board: string;     // .brd XML content
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EAGLE_VERSION = '9.6.2';

/** Scale factor: ProtoPulse schematic coords (pixel-ish) to Eagle mm (2.54mm grid). */
const SCHEMATIC_SCALE = 0.1;

/** Default board dimensions in mm when not specified. */
const DEFAULT_BOARD_WIDTH = 50;
const DEFAULT_BOARD_HEIGHT = 40;

/** Default wire width for schematic nets (mm). */
const SCHEMATIC_WIRE_WIDTH = 0.1524;

/** Default trace width for PCB signals (mm). */
const PCB_TRACE_WIDTH = 0.25;

/** Pin length in mm for generated symbols. */
const PIN_LENGTH = 2.54;

/** Symbol body half-extent (mm) — used to size the generic rectangle. */
const SYMBOL_HALF_WIDTH = 5.08;

/** Vertical spacing between pins in generated symbols (mm). */
const PIN_SPACING = 2.54;

/** Pad diameter for THT pads (mm). */
const PAD_DIAMETER = 1.524;

/** Drill diameter for THT pads (mm). */
const PAD_DRILL = 0.8;

/** SMD pad width and height (mm). */
const SMD_PAD_WIDTH = 1.2;
const SMD_PAD_HEIGHT = 0.6;

// Eagle layer numbers
const LAYER_TOP = 1;
const LAYER_BOTTOM = 16;
const LAYER_DIMENSION = 20;
const LAYER_TPLACE = 21;
const LAYER_BPLACE = 22;
const LAYER_TNAMES = 25;
const LAYER_BNAMES = 26;
const LAYER_TVALUES = 27;
const LAYER_TSTOP = 29;
const LAYER_TCREAM = 31;
const LAYER_NETS = 91;
const LAYER_BUSSES = 92;
const LAYER_PINS = 93;
const LAYER_SYMBOLS = 94;
const LAYER_NAMES = 95;
const LAYER_VALUES = 96;

// ---------------------------------------------------------------------------
// XML Escaping
// ---------------------------------------------------------------------------

/**
 * Escapes a string for safe inclusion in XML attribute values and text content.
 * Handles the five predefined XML entities.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// Metadata Extraction Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a human-readable value string from part metadata.
 * Searches common EDA field names.
 */
function extractPartValue(meta: Record<string, unknown>): string {
  if (typeof meta['value'] === 'string' && meta['value']) return meta['value'];

  const props = meta['properties'];
  if (Array.isArray(props)) {
    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      if (p && typeof p === 'object' && 'key' in p && 'value' in p) {
        const k = String((p as { key: string }).key).toLowerCase();
        if (k === 'value' || k === 'resistance' || k === 'capacitance' || k === 'inductance') {
          const v = String((p as { value: string }).value);
          if (v) return v;
        }
      }
    }
  }

  return '';
}

/**
 * Extract a part title from metadata.
 */
function extractTitle(meta: Record<string, unknown>): string {
  if (typeof meta['title'] === 'string' && meta['title']) return meta['title'];
  if (typeof meta['family'] === 'string' && meta['family']) return meta['family'];
  return 'Unknown';
}

/**
 * Extract a package/footprint string from part metadata.
 */
function extractPackage(meta: Record<string, unknown>): string {
  if (typeof meta['packageType'] === 'string' && meta['packageType']) return meta['packageType'];
  if (typeof meta['package'] === 'string' && meta['package']) return meta['package'];
  if (typeof meta['footprint'] === 'string' && meta['footprint']) return meta['footprint'];
  return '';
}

/**
 * Derive a reference designator prefix (e.g., "R", "C", "U") from the refdes string.
 */
function refDesPrefix(refDes: string): string {
  return refDes.replace(/[0-9]+$/, '').toUpperCase();
}

/**
 * Generate a sanitised Eagle identifier from a string.
 * Eagle identifiers must be alphanumeric plus underscores/hyphens.
 */
function sanitizeId(str: string): string {
  return str.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

// ---------------------------------------------------------------------------
// Part Deduplication
// ---------------------------------------------------------------------------

/**
 * Internal representation of a unique part type for library generation.
 * Multiple instances may share the same EaglePart if they use the same partId.
 */
interface EaglePart {
  partId: number;
  deviceSetName: string;
  symbolName: string;
  packageName: string;
  prefix: string;
  connectors: Array<{ id: string; name: string; padType?: string }>;
  value: string;
  title: string;
  packageType: string;
}

/**
 * Builds a deduplicated map of unique parts from the input.
 * Each unique partId gets one EaglePart entry used for library generation.
 */
function buildPartLibrary(input: EagleInput): Map<number, EaglePart> {
  const library = new Map<number, EaglePart>();

  input.instances.forEach((inst) => {
    if (library.has(inst.partId)) return;

    const partData = input.parts.get(inst.partId);
    if (!partData) return;

    const title = extractTitle(partData.meta);
    const value = extractPartValue(partData.meta);
    const packageType = extractPackage(partData.meta);
    const prefix = refDesPrefix(inst.referenceDesignator);

    // Generate names that are unique per partId
    const baseName = sanitizeId(title || `PART_${inst.partId}`);
    const deviceSetName = baseName.toUpperCase();
    const symbolName = `SYM_${baseName.toUpperCase()}`;
    const packageName = packageType
      ? sanitizeId(packageType).toUpperCase()
      : `PKG_${baseName.toUpperCase()}`;

    library.set(inst.partId, {
      partId: inst.partId,
      deviceSetName,
      symbolName,
      packageName,
      prefix,
      connectors: partData.connectors,
      value,
      title,
      packageType,
    });
  });

  return library;
}

// ---------------------------------------------------------------------------
// Eagle Rotation String
// ---------------------------------------------------------------------------

/**
 * Converts a rotation angle (degrees) to Eagle's rotation string format.
 * Eagle uses R0, R90, R180, R270 for schematic; any angle for board.
 * Returns empty string for 0-degree rotation.
 */
function eagleRotation(degrees: number): string {
  // Normalise to [0, 360)
  const norm = ((degrees % 360) + 360) % 360;
  if (norm === 0) return '';
  return `R${norm}`;
}

/**
 * Formats an Eagle rotation attribute string.
 * Returns the attribute string including the space prefix, or empty string if no rotation.
 */
function rotAttr(degrees: number): string {
  const rot = eagleRotation(degrees);
  return rot ? ` rot="${rot}"` : '';
}

// ---------------------------------------------------------------------------
// Symbol Generator
// ---------------------------------------------------------------------------

/**
 * Generates an Eagle symbol XML element for a part.
 *
 * Creates a rectangular body with pins arranged on the left and right sides.
 * Pins are distributed evenly: odd-indexed on the left, even-indexed on the right.
 */
function generateSymbol(part: EaglePart): string {
  const lines: string[] = [];
  const connCount = part.connectors.length;

  // Split connectors into left and right groups
  const leftPins: Array<{ id: string; name: string; index: number }> = [];
  const rightPins: Array<{ id: string; name: string; index: number }> = [];

  part.connectors.forEach((conn, i) => {
    if (i % 2 === 0) {
      leftPins.push({ id: conn.id, name: conn.name, index: i });
    } else {
      rightPins.push({ id: conn.id, name: conn.name, index: i });
    }
  });

  const maxSidePins = Math.max(leftPins.length, rightPins.length, 1);
  const bodyHeight = maxSidePins * PIN_SPACING;
  const halfHeight = bodyHeight / 2;

  lines.push(`          <symbol name="${escapeXml(part.symbolName)}">`);

  // Body rectangle
  lines.push(
    `            <wire x1="${-SYMBOL_HALF_WIDTH}" y1="${-halfHeight}" ` +
    `x2="${SYMBOL_HALF_WIDTH}" y2="${-halfHeight}" width="0.254" layer="${LAYER_SYMBOLS}"/>`,
  );
  lines.push(
    `            <wire x1="${SYMBOL_HALF_WIDTH}" y1="${-halfHeight}" ` +
    `x2="${SYMBOL_HALF_WIDTH}" y2="${halfHeight}" width="0.254" layer="${LAYER_SYMBOLS}"/>`,
  );
  lines.push(
    `            <wire x1="${SYMBOL_HALF_WIDTH}" y1="${halfHeight}" ` +
    `x2="${-SYMBOL_HALF_WIDTH}" y2="${halfHeight}" width="0.254" layer="${LAYER_SYMBOLS}"/>`,
  );
  lines.push(
    `            <wire x1="${-SYMBOL_HALF_WIDTH}" y1="${halfHeight}" ` +
    `x2="${-SYMBOL_HALF_WIDTH}" y2="${-halfHeight}" width="0.254" layer="${LAYER_SYMBOLS}"/>`,
  );

  // Name and value labels
  lines.push(
    `            <text x="0" y="${halfHeight + 1.27}" size="1.27" layer="${LAYER_NAMES}" ` +
    `align="bottom-center">&gt;NAME</text>`,
  );
  lines.push(
    `            <text x="0" y="${-(halfHeight + 1.27)}" size="1.27" layer="${LAYER_VALUES}" ` +
    `align="top-center">&gt;VALUE</text>`,
  );

  // Left-side pins (pointing left, connected from the left)
  leftPins.forEach((pin, i) => {
    const y = halfHeight - (i + 0.5) * PIN_SPACING;
    // Lead-in wire from body edge to pin stub end
    lines.push(
      `            <wire x1="${-SYMBOL_HALF_WIDTH}" y1="${y}" ` +
      `x2="${-(SYMBOL_HALF_WIDTH + PIN_LENGTH)}" y2="${y}" width="0.254" layer="${LAYER_SYMBOLS}"/>`,
    );
    lines.push(
      `            <pin name="${escapeXml(pin.name)}" x="${-(SYMBOL_HALF_WIDTH + PIN_LENGTH + PIN_LENGTH)}" ` +
      `y="${y}" length="short"/>`,
    );
  });

  // Right-side pins (pointing right, connected from the right)
  rightPins.forEach((pin, i) => {
    const y = halfHeight - (i + 0.5) * PIN_SPACING;
    lines.push(
      `            <wire x1="${SYMBOL_HALF_WIDTH}" y1="${y}" ` +
      `x2="${SYMBOL_HALF_WIDTH + PIN_LENGTH}" y2="${y}" width="0.254" layer="${LAYER_SYMBOLS}"/>`,
    );
    lines.push(
      `            <pin name="${escapeXml(pin.name)}" x="${SYMBOL_HALF_WIDTH + PIN_LENGTH + PIN_LENGTH}" ` +
      `y="${y}" length="short" rot="R180"/>`,
    );
  });

  // If no connectors at all, add a single default pin so the symbol is valid
  if (connCount === 0) {
    lines.push(
      `            <pin name="1" x="${-(SYMBOL_HALF_WIDTH + PIN_LENGTH + PIN_LENGTH)}" ` +
      `y="0" length="short"/>`,
    );
  }

  lines.push('          </symbol>');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Package (Footprint) Generator
// ---------------------------------------------------------------------------

/**
 * Generates an Eagle package XML element for a part.
 *
 * Creates a rectangular silkscreen outline with pads arranged in a line.
 * THT connectors get through-hole pads; SMD connectors get SMD pads on the top layer.
 */
function generatePackage(part: EaglePart): string {
  const lines: string[] = [];
  const connCount = Math.max(part.connectors.length, 1);

  // Package body dimensions — scale with connector count
  const bodyWidth = Math.max(connCount * 1.27, 3.0);
  const bodyHeight = Math.max(connCount * 0.8, 2.0);
  const halfW = bodyWidth / 2;
  const halfH = bodyHeight / 2;

  lines.push(`          <package name="${escapeXml(part.packageName)}">`);

  // Silkscreen outline (tPlace layer)
  lines.push(
    `            <wire x1="${-halfW}" y1="${-halfH}" ` +
    `x2="${halfW}" y2="${-halfH}" width="0.127" layer="${LAYER_TPLACE}"/>`,
  );
  lines.push(
    `            <wire x1="${halfW}" y1="${-halfH}" ` +
    `x2="${halfW}" y2="${halfH}" width="0.127" layer="${LAYER_TPLACE}"/>`,
  );
  lines.push(
    `            <wire x1="${halfW}" y1="${halfH}" ` +
    `x2="${-halfW}" y2="${halfH}" width="0.127" layer="${LAYER_TPLACE}"/>`,
  );
  lines.push(
    `            <wire x1="${-halfW}" y1="${halfH}" ` +
    `x2="${-halfW}" y2="${-halfH}" width="0.127" layer="${LAYER_TPLACE}"/>`,
  );

  // Name and value text on silkscreen
  lines.push(
    `            <text x="0" y="${halfH + 0.5}" size="0.8" layer="${LAYER_TNAMES}" ` +
    `align="bottom-center">&gt;NAME</text>`,
  );
  lines.push(
    `            <text x="0" y="${-(halfH + 0.5)}" size="0.8" layer="${LAYER_TVALUES}" ` +
    `align="top-center">&gt;VALUE</text>`,
  );

  // Generate pads — arranged in a horizontal row centered on the package
  if (part.connectors.length > 0) {
    const padSpacing = bodyWidth / (part.connectors.length + 1);

    part.connectors.forEach((conn, i) => {
      const padX = -halfW + padSpacing * (i + 1);
      const padY = 0;
      const padName = escapeXml(conn.name || conn.id);

      if (conn.padType === 'smd') {
        lines.push(
          `            <smd name="${padName}" x="${padX.toFixed(3)}" y="${padY}" ` +
          `dx="${SMD_PAD_WIDTH}" dy="${SMD_PAD_HEIGHT}" layer="${LAYER_TOP}"/>`,
        );
      } else {
        // Default to THT pad
        lines.push(
          `            <pad name="${padName}" x="${padX.toFixed(3)}" y="${padY}" ` +
          `drill="${PAD_DRILL}" diameter="${PAD_DIAMETER}" shape="round"/>`,
        );
      }
    });
  } else {
    // Single default pad for empty parts
    lines.push(
      `            <pad name="1" x="0" y="0" drill="${PAD_DRILL}" diameter="${PAD_DIAMETER}" shape="round"/>`,
    );
  }

  // Pin 1 indicator dot on silkscreen
  lines.push(
    `            <circle x="${-halfW + 0.5}" y="${halfH - 0.5}" radius="0.2" ` +
    `width="0.127" layer="${LAYER_TPLACE}"/>`,
  );

  lines.push('          </package>');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Net Building Helpers
// ---------------------------------------------------------------------------

/** Composite key for a specific pin on a specific instance. */
type PinKey = string;

function makePinKey(instanceId: number, pin: string): PinKey {
  return `${instanceId}:${pin}`;
}

interface PinNetEntry {
  instanceId: number;
  pin: string;
  netName: string;
}

/**
 * Builds a lookup from (instanceId, pin) -> net name.
 * Resolves both connector id and connector name references via bidirectional aliasing.
 */
function buildPinNetMap(input: EagleInput): Map<PinKey, PinNetEntry> {
  const map = new Map<PinKey, PinNetEntry>();

  // Build per-instance bidirectional alias maps (connectorName <-> connectorId)
  const instanceAliases = new Map<number, Map<string, string>>();

  input.instances.forEach((inst) => {
    const part = input.parts.get(inst.partId);
    if (!part) return;
    const aliases = new Map<string, string>();
    part.connectors.forEach((conn) => {
      aliases.set(conn.name, conn.id);
      aliases.set(conn.id, conn.name);
    });
    instanceAliases.set(inst.id, aliases);
  });

  input.nets.forEach((net) => {
    net.segments.forEach((seg) => {
      registerPin(map, instanceAliases, seg.fromInstanceId, seg.fromPin, net.name);
      registerPin(map, instanceAliases, seg.toInstanceId, seg.toPin, net.name);
    });
  });

  return map;
}

function registerPin(
  map: Map<PinKey, PinNetEntry>,
  instanceAliases: Map<number, Map<string, string>>,
  instanceId: number,
  pin: string,
  netName: string,
): void {
  const entry: PinNetEntry = { instanceId, pin, netName };

  const primaryKey = makePinKey(instanceId, pin);
  if (!map.has(primaryKey)) {
    map.set(primaryKey, entry);
  }

  const aliases = instanceAliases.get(instanceId);
  if (aliases) {
    const alias = aliases.get(pin);
    if (alias) {
      const aliasKey = makePinKey(instanceId, alias);
      if (!map.has(aliasKey)) {
        map.set(aliasKey, entry);
      }
    }
  }
}

/**
 * Builds a map from instanceId -> refdes for quick lookup.
 */
function buildInstanceRefDesMap(input: EagleInput): Map<number, string> {
  const map = new Map<number, string>();
  input.instances.forEach((inst) => {
    map.set(inst.id, inst.referenceDesignator);
  });
  return map;
}

// ---------------------------------------------------------------------------
// Layer Mapping
// ---------------------------------------------------------------------------

/**
 * Maps a ProtoPulse wire layer string to an Eagle layer number.
 */
function mapWireLayer(layer: string, view: string): number {
  const normalized = layer.toLowerCase();

  if (view === 'schematic') {
    return LAYER_NETS;
  }

  switch (normalized) {
    case 'top':
    case 'front':
    case 'f.cu':
      return LAYER_TOP;
    case 'bottom':
    case 'back':
    case 'b.cu':
      return LAYER_BOTTOM;
    case 'dimension':
    case 'edge':
      return LAYER_DIMENSION;
    case 'silkscreen':
    case 'tsilk':
    case 'f.silks':
      return LAYER_TPLACE;
    default:
      // Default to top copper for PCB, nets layer for schematic
      return view === 'pcb' ? LAYER_TOP : LAYER_NETS;
  }
}

/**
 * Maps a ProtoPulse pcbSide string to an Eagle pcb layer.
 */
function mapPcbSide(side: string | null): number {
  if (!side) return LAYER_TOP;
  const normalized = side.toLowerCase();
  if (normalized === 'bottom' || normalized === 'back') return LAYER_BOTTOM;
  return LAYER_TOP;
}

// ---------------------------------------------------------------------------
// Schematic Layer Definitions
// ---------------------------------------------------------------------------

function schematicLayersXml(): string {
  return [
    '    <layers>',
    `      <layer number="${LAYER_NETS}" name="Nets" color="2" fill="1" visible="yes" active="yes"/>`,
    `      <layer number="${LAYER_BUSSES}" name="Busses" color="1" fill="1" visible="yes" active="yes"/>`,
    `      <layer number="${LAYER_PINS}" name="Pins" color="2" fill="1" visible="no" active="yes"/>`,
    `      <layer number="${LAYER_SYMBOLS}" name="Symbols" color="4" fill="1" visible="yes" active="yes"/>`,
    `      <layer number="${LAYER_NAMES}" name="Names" color="7" fill="1" visible="yes" active="yes"/>`,
    `      <layer number="${LAYER_VALUES}" name="Values" color="7" fill="1" visible="yes" active="yes"/>`,
    '    </layers>',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Board Layer Definitions
// ---------------------------------------------------------------------------

function boardLayersXml(): string {
  return [
    '    <layers>',
    `      <layer number="${LAYER_TOP}" name="Top" color="4" fill="1" visible="yes" active="yes"/>`,
    `      <layer number="${LAYER_BOTTOM}" name="Bottom" color="1" fill="1" visible="yes" active="yes"/>`,
    `      <layer number="${LAYER_DIMENSION}" name="Dimension" color="15" fill="1" visible="yes" active="yes"/>`,
    `      <layer number="${LAYER_TPLACE}" name="tPlace" color="7" fill="1" visible="yes" active="yes"/>`,
    `      <layer number="${LAYER_BPLACE}" name="bPlace" color="7" fill="1" visible="yes" active="yes"/>`,
    `      <layer number="${LAYER_TNAMES}" name="tNames" color="7" fill="1" visible="yes" active="yes"/>`,
    `      <layer number="${LAYER_BNAMES}" name="bNames" color="7" fill="1" visible="yes" active="yes"/>`,
    `      <layer number="${LAYER_TVALUES}" name="tValues" color="7" fill="1" visible="yes" active="yes"/>`,
    `      <layer number="${LAYER_TSTOP}" name="tStop" color="7" fill="3" visible="no" active="yes"/>`,
    `      <layer number="${LAYER_TCREAM}" name="tCream" color="7" fill="4" visible="no" active="yes"/>`,
    '    </layers>',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Library XML Generation (shared between schematic and board)
// ---------------------------------------------------------------------------

/**
 * Generates the <library name="protopulse"> XML block containing
 * all packages, symbols, and devicesets for the unique parts in the input.
 *
 * @param partLibrary - Deduplicated part map from buildPartLibrary()
 * @param includeSymbols - If true, include <symbols> and <devicesets> (for schematic).
 *                         Board files only need <packages>.
 */
function generateLibraryXml(
  partLibrary: Map<number, EaglePart>,
  includeSymbols: boolean,
): string {
  const lines: string[] = [];
  const parts = Array.from(partLibrary.values());

  lines.push('        <library name="protopulse">');

  // Packages
  lines.push('          <packages>');
  parts.forEach((part) => {
    lines.push(generatePackage(part));
  });
  lines.push('          </packages>');

  if (includeSymbols) {
    // Symbols
    lines.push('          <symbols>');
    parts.forEach((part) => {
      lines.push(generateSymbol(part));
    });
    lines.push('          </symbols>');

    // Device sets
    lines.push('          <devicesets>');
    parts.forEach((part) => {
      lines.push(generateDeviceSet(part));
    });
    lines.push('          </devicesets>');
  }

  lines.push('        </library>');
  return lines.join('\n');
}

/**
 * Generates a <deviceset> XML element that maps a symbol's pins to a package's pads.
 */
function generateDeviceSet(part: EaglePart): string {
  const lines: string[] = [];

  lines.push(
    `          <deviceset name="${escapeXml(part.deviceSetName)}" ` +
    `prefix="${escapeXml(part.prefix)}">`,
  );

  // Gate — maps a symbol to a gate name
  lines.push('            <gates>');
  lines.push(
    `              <gate name="G$1" symbol="${escapeXml(part.symbolName)}" x="0" y="0"/>`,
  );
  lines.push('            </gates>');

  // Device — maps gate pins to package pads
  lines.push('            <devices>');
  lines.push(`              <device name="" package="${escapeXml(part.packageName)}">`);
  lines.push('                <connects>');

  if (part.connectors.length > 0) {
    part.connectors.forEach((conn) => {
      const pinName = escapeXml(conn.name);
      const padName = escapeXml(conn.name || conn.id);
      lines.push(
        `                  <connect gate="G$1" pin="${pinName}" pad="${padName}"/>`,
      );
    });
  } else {
    // Default single-pin device
    lines.push('                  <connect gate="G$1" pin="1" pad="1"/>');
  }

  lines.push('                </connects>');
  lines.push('              </device>');
  lines.push('            </devices>');
  lines.push('          </deviceset>');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Schematic Generator
// ---------------------------------------------------------------------------

/**
 * Generates a complete Eagle schematic XML file (.sch).
 *
 * The schematic contains:
 * - Layer definitions for schematic editing
 * - A "protopulse" library with symbols, packages, and devicesets
 * - Part declarations referencing the library
 * - A single sheet with instance placements and net definitions
 *
 * ProtoPulse schematic coordinates are scaled by SCHEMATIC_SCALE (÷10)
 * to convert from pixel-ish units to Eagle's mm grid.
 */
export function generateEagleSchematic(input: EagleInput): string {
  const partLibrary = buildPartLibrary(input);
  const pinNetMap = buildPinNetMap(input);
  const instanceRefDes = buildInstanceRefDesMap(input);
  const lines: string[] = [];

  // XML declaration and DOCTYPE
  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push('<!DOCTYPE eagle SYSTEM "eagle.dtd">');
  lines.push(`<eagle version="${EAGLE_VERSION}">`);
  lines.push('  <drawing>');

  // Settings
  lines.push('    <settings>');
  lines.push('      <setting alwaysvectorfont="no"/>');
  lines.push('    </settings>');
  lines.push('    <grid distance="2.54" unitdist="mm" unit="mm" display="no"/>');

  // Layers
  lines.push(schematicLayersXml());

  // Schematic root
  lines.push('    <schematic>');

  // Libraries
  lines.push('      <libraries>');
  lines.push(generateLibraryXml(partLibrary, true));
  lines.push('      </libraries>');

  // Parts
  lines.push('      <parts>');
  input.instances.forEach((inst) => {
    const part = partLibrary.get(inst.partId);
    if (!part) {
      lines.push(`        <!-- WARNING: part ID ${inst.partId} not found for ${escapeXml(inst.referenceDesignator)} -->`);
      return;
    }
    const value = part.value || part.title;
    lines.push(
      `        <part name="${escapeXml(inst.referenceDesignator)}" library="protopulse" ` +
      `deviceset="${escapeXml(part.deviceSetName)}" device="" value="${escapeXml(value)}"/>`,
    );
  });
  lines.push('      </parts>');

  // Sheets — single sheet containing all instances and nets
  lines.push('      <sheets>');
  lines.push('        <sheet>');

  // Instances
  lines.push('          <instances>');
  input.instances.forEach((inst) => {
    const part = partLibrary.get(inst.partId);
    if (!part) return;

    const x = (inst.schematicX * SCHEMATIC_SCALE).toFixed(2);
    const y = (inst.schematicY * SCHEMATIC_SCALE).toFixed(2);
    const rot = rotAttr(inst.schematicRotation);

    lines.push(
      `            <instance part="${escapeXml(inst.referenceDesignator)}" ` +
      `gate="G$1" x="${x}" y="${y}"${rot}/>`,
    );
  });
  lines.push('          </instances>');

  // Nets
  lines.push('          <nets>');

  // Build net -> segments data structure
  // Each net contains pinref segments and optional wire geometry
  const netSegments = new Map<string, Array<{
    fromRef: string;
    fromPin: string;
    toRef: string;
    toPin: string;
  }>>();

  input.nets.forEach((net) => {
    if (!netSegments.has(net.name)) {
      netSegments.set(net.name, []);
    }
    const segments = netSegments.get(net.name)!;

    net.segments.forEach((seg) => {
      const fromRef = instanceRefDes.get(seg.fromInstanceId);
      const toRef = instanceRefDes.get(seg.toInstanceId);
      if (!fromRef || !toRef) return;

      // Resolve pin names — prefer connector name over connector id for Eagle
      const fromPinName = resolveConnectorName(input, seg.fromInstanceId, seg.fromPin);
      const toPinName = resolveConnectorName(input, seg.toInstanceId, seg.toPin);

      segments.push({
        fromRef,
        fromPin: fromPinName,
        toRef,
        toPin: toPinName,
      });
    });
  });

  // Collect schematic wires by net name for wire geometry
  const schematicWiresByNet = new Map<string, Array<{
    points: Array<{ x: number; y: number }>;
    width: number;
  }>>();

  input.wires.forEach((wire) => {
    if (wire.view !== 'schematic') return;

    // Find which net this wire belongs to by matching netId to net index
    let netName: string | null = null;
    for (let i = 0; i < input.nets.length; i++) {
      // netId is expected to correspond to the index or an external id;
      // we match by position in the array since we don't have a net.id field
      if (i === wire.netId || wire.netId === i) {
        netName = input.nets[i].name;
        break;
      }
    }
    if (!netName) return;

    if (!schematicWiresByNet.has(netName)) {
      schematicWiresByNet.set(netName, []);
    }
    schematicWiresByNet.get(netName)!.push({
      points: wire.points,
      width: wire.width,
    });
  });

  // Emit each net
  Array.from(netSegments.entries()).forEach(([netName, segments]) => {
    lines.push(`            <net name="${escapeXml(netName)}" class="0">`);

    // Each segment pair becomes its own <segment> with pinrefs
    segments.forEach((seg) => {
      lines.push('              <segment>');
      lines.push(
        `                <pinref part="${escapeXml(seg.fromRef)}" gate="G$1" pin="${escapeXml(seg.fromPin)}"/>`,
      );
      lines.push(
        `                <pinref part="${escapeXml(seg.toRef)}" gate="G$1" pin="${escapeXml(seg.toPin)}"/>`,
      );

      // Add wire geometry between the two endpoints if available from schematic wires
      const wires = schematicWiresByNet.get(netName);
      if (wires && wires.length > 0) {
        // Use the first available wire path for this segment
        const wire = wires.shift()!;
        for (let i = 0; i < wire.points.length - 1; i++) {
          const p1 = wire.points[i];
          const p2 = wire.points[i + 1];
          const x1 = (p1.x * SCHEMATIC_SCALE).toFixed(2);
          const y1 = (p1.y * SCHEMATIC_SCALE).toFixed(2);
          const x2 = (p2.x * SCHEMATIC_SCALE).toFixed(2);
          const y2 = (p2.y * SCHEMATIC_SCALE).toFixed(2);
          lines.push(
            `                <wire x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ` +
            `width="${SCHEMATIC_WIRE_WIDTH}" layer="${LAYER_NETS}"/>`,
          );
        }
      }

      lines.push('              </segment>');
    });

    lines.push('            </net>');
  });

  lines.push('          </nets>');
  lines.push('        </sheet>');
  lines.push('      </sheets>');
  lines.push('    </schematic>');
  lines.push('  </drawing>');
  lines.push('</eagle>');

  return lines.join('\n');
}

/**
 * Resolves a pin reference (which may be a connector id or connector name)
 * to the connector's human-readable name for Eagle output.
 */
function resolveConnectorName(
  input: EagleInput,
  instanceId: number,
  pinRef: string,
): string {
  const inst = input.instances.find((i) => i.id === instanceId);
  if (!inst) return pinRef;

  const partData = input.parts.get(inst.partId);
  if (!partData) return pinRef;

  // Try matching by id first
  const byId = partData.connectors.find((c) => c.id === pinRef);
  if (byId) return byId.name;

  // Try matching by name
  const byName = partData.connectors.find((c) => c.name === pinRef);
  if (byName) return byName.name;

  // Return the raw reference as fallback
  return pinRef;
}

// ---------------------------------------------------------------------------
// Board Generator
// ---------------------------------------------------------------------------

/**
 * Generates a complete Eagle board XML file (.brd).
 *
 * The board contains:
 * - Layer definitions for PCB editing
 * - Board outline on the Dimension layer
 * - A "protopulse" library with package footprints
 * - Element placements for each instance that has PCB coordinates
 * - Signal definitions with copper trace wires
 *
 * PCB coordinates are assumed to already be in mm and are used directly.
 * Instances without pcbX/pcbY are placed at the board origin (0,0) with
 * a warning comment.
 */
export function generateEagleBoard(input: EagleInput): string {
  const partLibrary = buildPartLibrary(input);
  const pinNetMap = buildPinNetMap(input);
  const instanceRefDes = buildInstanceRefDesMap(input);
  const lines: string[] = [];

  const boardW = input.boardWidth ?? DEFAULT_BOARD_WIDTH;
  const boardH = input.boardHeight ?? DEFAULT_BOARD_HEIGHT;

  // XML declaration and DOCTYPE
  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push('<!DOCTYPE eagle SYSTEM "eagle.dtd">');
  lines.push(`<eagle version="${EAGLE_VERSION}">`);
  lines.push('  <drawing>');

  // Layers
  lines.push(boardLayersXml());

  // Board root
  lines.push('    <board>');

  // Board outline
  lines.push('      <plain>');
  lines.push(
    `        <wire x1="0" y1="0" x2="${boardW}" y2="0" width="0.1" layer="${LAYER_DIMENSION}"/>`,
  );
  lines.push(
    `        <wire x1="${boardW}" y1="0" x2="${boardW}" y2="${boardH}" width="0.1" layer="${LAYER_DIMENSION}"/>`,
  );
  lines.push(
    `        <wire x1="${boardW}" y1="${boardH}" x2="0" y2="${boardH}" width="0.1" layer="${LAYER_DIMENSION}"/>`,
  );
  lines.push(
    `        <wire x1="0" y1="${boardH}" x2="0" y2="0" width="0.1" layer="${LAYER_DIMENSION}"/>`,
  );
  lines.push('      </plain>');

  // Libraries (packages only — no symbols/devicesets needed for board)
  lines.push('      <libraries>');
  lines.push(generateLibraryXml(partLibrary, false));
  lines.push('      </libraries>');

  // Elements (component placements)
  lines.push('      <elements>');
  input.instances.forEach((inst) => {
    const part = partLibrary.get(inst.partId);
    if (!part) {
      lines.push(
        `        <!-- WARNING: part ID ${inst.partId} not found for ${escapeXml(inst.referenceDesignator)} -->`,
      );
      return;
    }

    const value = part.value || part.title;
    const hasPcbCoords = inst.pcbX !== null && inst.pcbY !== null;
    const x = hasPcbCoords ? inst.pcbX!.toFixed(3) : '0';
    const y = hasPcbCoords ? inst.pcbY!.toFixed(3) : '0';
    const rot = inst.pcbRotation !== null ? rotAttr(inst.pcbRotation) : '';

    // Mirror attribute for bottom-side components
    const isMirrored = inst.pcbSide !== null &&
      (inst.pcbSide.toLowerCase() === 'bottom' || inst.pcbSide.toLowerCase() === 'back');
    const mirrorStr = isMirrored ? ' mirror="yes"' : '';

    if (!hasPcbCoords) {
      lines.push(
        `        <!-- WARNING: ${escapeXml(inst.referenceDesignator)} has no PCB coordinates, placed at origin -->`,
      );
    }

    lines.push(
      `        <element name="${escapeXml(inst.referenceDesignator)}" library="protopulse" ` +
      `package="${escapeXml(part.packageName)}" value="${escapeXml(value)}" ` +
      `x="${x}" y="${y}"${rot}${mirrorStr}/>`,
    );
  });
  lines.push('      </elements>');

  // Signals (copper traces)
  lines.push('      <signals>');

  // Build signal data: group wires by net name
  const signalWires = new Map<string, Array<{
    points: Array<{ x: number; y: number }>;
    layer: number;
    width: number;
  }>>();

  // Initialize with all net names
  input.nets.forEach((net) => {
    if (!signalWires.has(net.name)) {
      signalWires.set(net.name, []);
    }
  });

  // Add PCB wires
  input.wires.forEach((wire) => {
    if (wire.view !== 'pcb') return;

    // Match netId to net by index
    let netName: string | null = null;
    for (let i = 0; i < input.nets.length; i++) {
      if (i === wire.netId || wire.netId === i) {
        netName = input.nets[i].name;
        break;
      }
    }
    if (!netName) return;

    if (!signalWires.has(netName)) {
      signalWires.set(netName, []);
    }
    signalWires.get(netName)!.push({
      points: wire.points,
      layer: mapWireLayer(wire.layer, 'pcb'),
      width: wire.width || PCB_TRACE_WIDTH,
    });
  });

  // Emit each signal
  Array.from(signalWires.entries()).forEach(([netName, wires]) => {
    lines.push(`        <signal name="${escapeXml(netName)}">`);

    // Emit wire geometry
    wires.forEach((wire) => {
      for (let i = 0; i < wire.points.length - 1; i++) {
        const p1 = wire.points[i];
        const p2 = wire.points[i + 1];
        lines.push(
          `          <wire x1="${p1.x.toFixed(3)}" y1="${p1.y.toFixed(3)}" ` +
          `x2="${p2.x.toFixed(3)}" y2="${p2.y.toFixed(3)}" ` +
          `width="${wire.width}" layer="${wire.layer}"/>`,
        );
      }
    });

    // If no explicit wires, add contactref elements to indicate net connectivity
    if (wires.length === 0) {
      // Find all pins belonging to this net and emit contactrefs
      input.instances.forEach((inst) => {
        const partData = input.parts.get(inst.partId);
        if (!partData) return;

        partData.connectors.forEach((conn) => {
          const entry = pinNetMap.get(makePinKey(inst.id, conn.id));
          if (entry && entry.netName === netName) {
            lines.push(
              `          <contactref element="${escapeXml(inst.referenceDesignator)}" pad="${escapeXml(conn.name || conn.id)}"/>`,
            );
          }
        });
      });
    }

    lines.push('        </signal>');
  });

  lines.push('      </signals>');
  lines.push('    </board>');
  lines.push('  </drawing>');
  lines.push('</eagle>');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Unified Entry Point
// ---------------------------------------------------------------------------

/**
 * Generates a complete Eagle project with both schematic and board files.
 *
 * @param input - Circuit data including instances, nets, wires, and parts
 * @returns An object with `schematic` (.sch XML) and `board` (.brd XML) strings
 */
export function generateEagleProject(input: EagleInput): EagleOutput {
  return {
    schematic: generateEagleSchematic(input),
    board: generateEagleBoard(input),
  };
}
