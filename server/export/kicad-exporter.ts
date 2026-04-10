// =============================================================================
// KiCad Project Exporter — Phase 12.7: FZPZ Integration
//
// Generates KiCad 7+ compatible project files:
//   .kicad_sch  — Schematic (S-expression format, version 20230121)
//   .kicad_pcb  — PCB layout (S-expression format, version 20221018)
//   .kicad_pro  — Project settings (JSON)
//
// Pure function library. No Express routes, no side effects.
// =============================================================================

import crypto from 'crypto';
import {
  type ArchNodeData,
  type ArchEdgeData,
  type CircuitInstanceData,
  type CircuitNetData,
  type ComponentPartData,
  type ExportResult,
  metaStr,
  sanitizeFilename,
} from './types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface KicadInput {
  circuit: { id: number; name: string };
  instances: Array<{
    id: number;
    referenceDesignator: string;
    partId: number | null;
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

export interface KicadOutput {
  schematic: string;   // .kicad_sch content
  pcb: string;         // .kicad_pcb content
  project: string;     // .kicad_pro content (JSON)
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** KiCad schematic file format version (KiCad 7+) */
const SCHEMATIC_VERSION = 20230121;

/** KiCad PCB file format version (KiCad 7+) */
const PCB_VERSION = 20221018;

/** Generator tag embedded in output files */
const GENERATOR = 'ProtoPulse';

/**
 * Scale factor: ProtoPulse schematic coordinates (pixels) -> KiCad mm.
 * Dividing by 10 gives a reasonable spacing on a KiCad schematic sheet.
 */
const SCHEMATIC_SCALE = 0.1;

/** Default paper size for schematics */
const PAPER_SIZE = 'A3';

/** Default board thickness in mm */
const DEFAULT_BOARD_THICKNESS = 1.6;

/** Default trace width in mm */
const DEFAULT_TRACE_WIDTH = 0.25;

/** Default board dimensions in mm (when not specified) */
const DEFAULT_BOARD_WIDTH = 100;
const DEFAULT_BOARD_HEIGHT = 100;

/** Board outline stroke width in mm */
const EDGE_CUTS_WIDTH = 0.1;

/** Default pad sizes in mm */
const DEFAULT_THT_PAD_SIZE = 1.6;
const DEFAULT_THT_DRILL = 0.8;
const DEFAULT_SMD_PAD_WIDTH = 1.2;
const DEFAULT_SMD_PAD_HEIGHT = 0.6;

/** KiCad standard font size for property text */
const FONT_SIZE = 1.27;

/** Pin length in mm */
const PIN_LENGTH = 2.54;

/**
 * The minimum rectangle body half-size. Symbols with few pins will still
 * get a visible body at least this big (in mm).
 */
const MIN_SYMBOL_HALF_SIZE = 2.54;

// ---------------------------------------------------------------------------
// Deterministic UUID generation
// ---------------------------------------------------------------------------

/**
 * Generates a unique UUID for KiCad file references.
 *
 * Uses `crypto.randomUUID()` for guaranteed uniqueness — the previous
 * FNV-1a-inspired hash was prone to collisions in large projects where
 * different input ID combinations could produce the same 128-bit output.
 */
function deterministicUuid(..._ids: number[]): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// S-expression helpers
// ---------------------------------------------------------------------------

/**
 * Escape a string for use inside an S-expression quoted value.
 * Backslashes and double quotes must be escaped.
 */
function esc(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Returns an indentation string for the given nesting depth.
 */
function ind(level: number): string {
  return '  '.repeat(level);
}

/**
 * Formats a number to at most 4 decimal places, stripping trailing zeros.
 * Keeps output compact while maintaining sub-micron precision.
 */
function num(value: number): string {
  // Round to 4 decimal places
  const rounded = Math.round(value * 10000) / 10000;
  // Use toFixed to avoid scientific notation, then strip trailing zeros
  const fixed = rounded.toFixed(4);
  // Remove trailing zeros after decimal point, and the point itself if empty
  return fixed.replace(/\.?0+$/, '') || '0';
}

// ---------------------------------------------------------------------------
// Part metadata extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract a human-readable value string from a part's meta.
 * Tries common field names: value, then walks the properties array.
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
 * Extract a footprint / package string from the part's meta.
 */
function extractFootprint(meta: Record<string, unknown>): string {
  if (typeof meta['packageType'] === 'string' && meta['packageType']) return meta['packageType'];
  if (typeof meta['package'] === 'string' && meta['package']) return meta['package'];
  if (typeof meta['footprint'] === 'string' && meta['footprint']) return meta['footprint'];
  return '';
}

/**
 * Extract a part title / model name from meta.
 */
function extractTitle(meta: Record<string, unknown>): string {
  if (typeof meta['title'] === 'string' && meta['title']) return meta['title'];
  if (typeof meta['family'] === 'string' && meta['family']) return meta['family'];
  return 'Unknown';
}

/**
 * Extract the manufacturer from the part's meta.
 */
function extractManufacturer(meta: Record<string, unknown>): string {
  if (typeof meta['manufacturer'] === 'string' && meta['manufacturer']) return meta['manufacturer'];
  return '';
}

/**
 * Extract the manufacturer part number from the part's meta.
 */
function extractMpn(meta: Record<string, unknown>): string {
  if (typeof meta['mpn'] === 'string' && meta['mpn']) return meta['mpn'];
  return '';
}

/**
 * Extract the mounting type: 'tht' | 'smd' | 'other' | '' .
 */
function extractMountingType(meta: Record<string, unknown>): string {
  if (typeof meta['mountingType'] === 'string') return meta['mountingType'];
  return '';
}

/**
 * Extract the datasheet URL from the part's meta.
 */
function extractDatasheet(meta: Record<string, unknown>): string {
  if (typeof meta['datasheetUrl'] === 'string' && meta['datasheetUrl']) return meta['datasheetUrl'];
  return '';
}

// ---------------------------------------------------------------------------
// Net indexing helpers
// ---------------------------------------------------------------------------

/**
 * Composite key for a pin on an instance: "instanceId:pinIdentifier".
 */
type PinKey = string;

function makePinKey(instanceId: number, pin: string): PinKey {
  return `${instanceId}:${pin}`;
}

interface NetInfo {
  name: string;
  code: number; // 1-based net code (0 = unconnected)
}

/**
 * Builds a global index of net names -> net codes, and a pin-to-net lookup.
 *
 * Net code 0 is reserved for the unconnected net (KiCad convention).
 * Real nets start at code 1.
 */
function buildNetIndex(input: KicadInput): {
  netList: Array<{ name: string; code: number }>;
  pinToNet: Map<PinKey, NetInfo>;
} {
  // Deduplicate net names while preserving order of first appearance
  const netNameOrder: string[] = [];
  const netNameSet = new Set<string>();

  input.nets.forEach(function collectUniqueNetNames(net) {
    if (!netNameSet.has(net.name)) {
      netNameSet.add(net.name);
      netNameOrder.push(net.name);
    }
  });

  // Assign 1-based net codes
  const netCodeMap = new Map<string, number>();
  const netList: Array<{ name: string; code: number }> = [];
  netNameOrder.forEach(function assignNetCode(name, idx) {
    const code = idx + 1;
    netCodeMap.set(name, code);
    netList.push({ name, code });
  });

  // Build per-instance connector alias maps for bidirectional pin resolution
  const instanceAliases = new Map<number, Map<string, string>>();
  input.instances.forEach(function buildInstanceAliases(inst) {
    const part = inst.partId != null ? input.parts.get(inst.partId) : undefined;
    if (!part) return;
    const aliases = new Map<string, string>();
    part.connectors.forEach(function mapConnectorAlias(conn) {
      aliases.set(conn.name, conn.id);
      aliases.set(conn.id, conn.name);
    });
    instanceAliases.set(inst.id, aliases);
  });

  // Build pin -> net lookup
  const pinToNet = new Map<PinKey, NetInfo>();

  function registerPin(instanceId: number, pin: string, netName: string): void {
    const code = netCodeMap.get(netName);
    if (code === undefined) return;
    const info: NetInfo = { name: netName, code };

    const primaryKey = makePinKey(instanceId, pin);
    if (!pinToNet.has(primaryKey)) {
      pinToNet.set(primaryKey, info);
    }

    // Also register the alias
    const aliases = instanceAliases.get(instanceId);
    if (aliases) {
      const alias = aliases.get(pin);
      if (alias) {
        const aliasKey = makePinKey(instanceId, alias);
        if (!pinToNet.has(aliasKey)) {
          pinToNet.set(aliasKey, info);
        }
      }
    }
  }

  input.nets.forEach(function registerNetPins(net) {
    net.segments.forEach(function registerSegmentPins(seg) {
      registerPin(seg.fromInstanceId, seg.fromPin, net.name);
      registerPin(seg.toInstanceId, seg.toPin, net.name);
    });
  });

  return { netList, pinToNet };
}

// ---------------------------------------------------------------------------
// Rotation helpers
// ---------------------------------------------------------------------------

/**
 * Normalizes an angle to the [0, 360) range.
 */
function normalizeAngle(deg: number): number {
  let n = deg % 360;
  if (n < 0) n += 360;
  return n;
}

// ---------------------------------------------------------------------------
// KiCad layer mapping
// ---------------------------------------------------------------------------

/**
 * Maps a ProtoPulse side string ('front'/'back') to the KiCad copper
 * layer name.
 */
function mapCopperLayer(side: string | null): string {
  if (!side) return 'F.Cu';
  switch (side.toLowerCase()) {
    case 'back':
    case 'bottom':
      return 'B.Cu';
    case 'front':
    case 'top':
    default:
      return 'F.Cu';
  }
}

/**
 * Maps a ProtoPulse side to the KiCad silkscreen layer.
 */
function mapSilkLayer(side: string | null): string {
  if (!side) return 'F.SilkS';
  switch (side.toLowerCase()) {
    case 'back':
    case 'bottom':
      return 'B.SilkS';
    default:
      return 'F.SilkS';
  }
}

/**
 * Maps a ProtoPulse wire layer name to a KiCad PCB layer name.
 * Falls back to F.Cu for unknown layers.
 */
function mapWireLayer(layer: string): string {
  switch (layer.toLowerCase()) {
    case 'back':
    case 'bottom':
    case 'b.cu':
      return 'B.Cu';
    case 'front':
    case 'top':
    case 'f.cu':
      return 'F.Cu';
    default:
      return 'F.Cu';
  }
}

// ---------------------------------------------------------------------------
// Pin position calculation for symbols
// ---------------------------------------------------------------------------

/**
 * Direction a pin points: up, down, left, right.
 * KiCad pins are placed at the symbol body edge and extend outward.
 */
type PinDirection = 'L' | 'R' | 'U' | 'D';

interface PinPlacement {
  /** Pin body-edge position relative to symbol origin (0,0) */
  x: number;
  y: number;
  /** KiCad rotation for the pin (0=right, 90=up, 180=left, 270=down) */
  rotation: number;
}

/**
 * Distributes pins around the edges of a rectangular symbol body.
 *
 * Strategy:
 *   - Left side: pins 0 .. floor(n/2)-1
 *   - Right side: pins floor(n/2) .. n-1
 *
 * Pins are evenly spaced at 2.54 mm pitch. The rectangle body is sized
 * to fit all pins.
 *
 * Returns the pin placements and the body rectangle dimensions.
 */
function layoutPins(
  pinCount: number,
): {
  placements: PinPlacement[];
  bodyWidth: number;
  bodyHeight: number;
} {
  if (pinCount === 0) {
    return {
      placements: [],
      bodyWidth: MIN_SYMBOL_HALF_SIZE * 2,
      bodyHeight: MIN_SYMBOL_HALF_SIZE * 2,
    };
  }

  const leftCount = Math.ceil(pinCount / 2);
  const rightCount = pinCount - leftCount;

  // Vertical space needed: max of left/right pin counts * 2.54mm pitch
  const maxPerSide = Math.max(leftCount, rightCount);
  const bodyHeight = Math.max(maxPerSide * 2.54, MIN_SYMBOL_HALF_SIZE * 2);
  const bodyWidth = Math.max(5.08, MIN_SYMBOL_HALF_SIZE * 2); // minimum width

  const halfW = bodyWidth / 2;
  const halfH = bodyHeight / 2;

  const placements: PinPlacement[] = [];

  // Left-side pins: pointing left (KiCad rotation 0 means pointing right,
  // 180 means pointing left). Left-side pins point LEFT so the pin extends
  // leftward from the body edge.
  for (let i = 0; i < leftCount; i++) {
    const yOffset = halfH - (i + 0.5) * (bodyHeight / leftCount);
    placements.push({
      x: -halfW - PIN_LENGTH,
      y: yOffset,
      rotation: 0, // pin graphic points right, toward the body
    });
  }

  // Right-side pins: pointing right (rotation 180 = pin graphic points left,
  // toward the body).
  for (let i = 0; i < rightCount; i++) {
    const yOffset = halfH - (i + 0.5) * (bodyHeight / rightCount);
    placements.push({
      x: halfW + PIN_LENGTH,
      y: yOffset,
      rotation: 180,
    });
  }

  return { placements, bodyWidth, bodyHeight };
}

// ---------------------------------------------------------------------------
// Schematic generation (.kicad_sch)
// ---------------------------------------------------------------------------

/**
 * Generates the lib_symbols section: one symbol definition per unique part.
 */
function generateLibSymbols(input: KicadInput): string {
  const lines: string[] = [];
  lines.push(`${ind(1)}(lib_symbols`);

  // Collect unique parts that are actually used
  const usedPartIds = new Set<number>();
  input.instances.forEach(function collectUsedPartIds(inst) {
    if (inst.partId != null) usedPartIds.add(inst.partId);
  });

  // Generate one symbol per unique part. Use Array.from to iterate the Set.
  const partIdArray = Array.from(usedPartIds);
  partIdArray.forEach(function emitLibSymbol(partId) {
    const part = input.parts.get(partId);
    if (!part) return;

    const title = extractTitle(part.meta);
    const value = extractPartValue(part.meta);
    const footprint = extractFootprint(part.meta);
    const datasheet = extractDatasheet(part.meta);
    const manufacturer = extractManufacturer(part.meta);
    const mpn = extractMpn(part.meta);
    // Use a sanitized version of the title as the library symbol name
    const symName = `PP:${sanitizeSymbolName(title)}_${partId}`;
    const pinCount = part.connectors.length;
    const { placements, bodyWidth, bodyHeight } = layoutPins(pinCount);

    const halfW = bodyWidth / 2;
    const halfH = bodyHeight / 2;

    lines.push(`${ind(2)}(symbol "${esc(symName)}" (pin_names (offset 0.254)) (in_bom yes) (on_board yes)`);

    // Properties: Reference, Value, Footprint, Datasheet, ki_description, Manufacturer, MPN
    lines.push(`${ind(3)}(property "Reference" "U" (at 0 ${num(halfH + 2)} 0) (effects (font (size ${FONT_SIZE} ${FONT_SIZE}))))`);
    lines.push(`${ind(3)}(property "Value" "${esc(value || title)}" (at 0 ${num(-halfH - 2)} 0) (effects (font (size ${FONT_SIZE} ${FONT_SIZE}))))`);
    lines.push(`${ind(3)}(property "Footprint" "${esc(footprint)}" (at 0 ${num(-halfH - 4)} 0) (effects (font (size ${FONT_SIZE} ${FONT_SIZE})) hide))`);
    lines.push(`${ind(3)}(property "Datasheet" "${esc(datasheet)}" (at 0 ${num(-halfH - 6)} 0) (effects (font (size ${FONT_SIZE} ${FONT_SIZE})) hide))`);
    if (manufacturer) {
      lines.push(`${ind(3)}(property "Manufacturer" "${esc(manufacturer)}" (at 0 ${num(-halfH - 8)} 0) (effects (font (size ${FONT_SIZE} ${FONT_SIZE})) hide))`);
    }
    if (mpn) {
      lines.push(`${ind(3)}(property "MPN" "${esc(mpn)}" (at 0 ${num(-halfH - 10)} 0) (effects (font (size ${FONT_SIZE} ${FONT_SIZE})) hide))`);
    }

    // Sub-symbol unit 0: the body rectangle + pins
    lines.push(`${ind(3)}(symbol "${esc(symName)}_0_1"`);

    // Rectangle body
    lines.push(`${ind(4)}(rectangle (start ${num(-halfW)} ${num(halfH)}) (end ${num(halfW)} ${num(-halfH)}) (stroke (width 0) (type default)) (fill (type background)))`);

    lines.push(`${ind(3)})`); // end sub-symbol _0_1

    // Pins (in their own sub-symbol _1_1 per KiCad convention)
    lines.push(`${ind(3)}(symbol "${esc(symName)}_1_1"`);
    part.connectors.forEach(function emitSymbolPin(conn, connIdx) {
      if (connIdx >= placements.length) return;
      const pl = placements[connIdx];
      const pinType = guessPinType(conn, part.meta);

      lines.push(
        `${ind(4)}(pin ${pinType} line (at ${num(pl.x)} ${num(pl.y)} ${pl.rotation}) (length ${num(PIN_LENGTH)})` +
        ` (name "${esc(conn.name)}" (effects (font (size ${FONT_SIZE} ${FONT_SIZE}))))` +
        ` (number "${esc(conn.id)}" (effects (font (size ${FONT_SIZE} ${FONT_SIZE})))))`
      );
    });
    lines.push(`${ind(3)})`); // end sub-symbol _1_1

    lines.push(`${ind(2)})`); // end symbol
  });

  lines.push(`${ind(1)})`); // end lib_symbols
  return lines.join('\n');
}

/**
 * Guesses the KiCad pin electrical type from the connector and part metadata.
 *
 * KiCad pin types: input, output, bidirectional, tri_state, passive,
 * free, unspecified, power_in, power_out, open_collector, open_emitter,
 * no_connect.
 */
function guessPinType(
  connector: { id: string; name: string; padType?: string },
  meta: Record<string, unknown>,
): string {
  const nameLC = connector.name.toLowerCase();

  // Power pins
  if (nameLC === 'vcc' || nameLC === 'vdd' || nameLC === 'vin' ||
      nameLC === '3v3' || nameLC === '5v' || nameLC === 'v+') {
    return 'power_in';
  }
  if (nameLC === 'gnd' || nameLC === 'vss' || nameLC === 'agnd' || nameLC === 'dgnd') {
    return 'power_in';
  }
  if (nameLC === 'vout' || nameLC === 'v-') {
    return 'power_out';
  }

  // Passive components (resistors, capacitors, inductors)
  const family = typeof meta['family'] === 'string' ? meta['family'].toLowerCase() : '';
  if (family === 'resistor' || family === 'capacitor' || family === 'inductor' ||
      family === 'fuse' || family === 'crystal') {
    return 'passive';
  }

  // Default to unspecified
  return 'unspecified';
}

/**
 * Sanitizes a string for use as a KiCad symbol name.
 * Replaces any character that is not alphanumeric or underscore with '_'.
 */
function sanitizeSymbolName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Generates the symbol instances section: one placed symbol per instance.
 */
function generateSchematicSymbolInstances(input: KicadInput): string {
  const lines: string[] = [];

  input.instances.forEach(function emitSchematicSymbol(inst) {
    const part = inst.partId != null ? input.parts.get(inst.partId) : undefined;
    if (!part) return;

    const title = extractTitle(part.meta);
    const value = extractPartValue(part.meta);
    const footprint = extractFootprint(part.meta);
    const symName = `PP:${sanitizeSymbolName(title)}_${inst.partId}`;
    const uuid = deterministicUuid(input.circuit.id, inst.id);

    // Scale schematic coordinates from ProtoPulse pixels to KiCad mm
    const x = inst.schematicX * SCHEMATIC_SCALE;
    const y = inst.schematicY * SCHEMATIC_SCALE;
    const rot = normalizeAngle(inst.schematicRotation);

    lines.push(`${ind(1)}(symbol (lib_id "${esc(symName)}") (at ${num(x)} ${num(y)} ${num(rot)})`);
    lines.push(`${ind(2)}(uuid "${uuid}")`);
    lines.push(`${ind(2)}(property "Reference" "${esc(inst.referenceDesignator)}" (at ${num(x)} ${num(y + 2)} 0) (effects (font (size ${FONT_SIZE} ${FONT_SIZE}))))`);
    lines.push(`${ind(2)}(property "Value" "${esc(value || title)}" (at ${num(x)} ${num(y - 2)} 0) (effects (font (size ${FONT_SIZE} ${FONT_SIZE}))))`);
    lines.push(`${ind(2)}(property "Footprint" "${esc(footprint)}" (at ${num(x)} ${num(y - 4)} 0) (effects (font (size ${FONT_SIZE} ${FONT_SIZE})) hide))`);

    // Pin instance mappings — required by KiCad 7+ for each pin
    lines.push(`${ind(2)}(instances`);
    lines.push(`${ind(3)}(project "${esc(input.circuit.name)}"`);
    lines.push(`${ind(4)}(path "/${uuid}" (reference "${esc(inst.referenceDesignator)}") (unit 1))`)
    lines.push(`${ind(3)})`);
    lines.push(`${ind(2)})`);

    lines.push(`${ind(1)})`); // end symbol
  });

  return lines.join('\n');
}

/**
 * Generates schematic wire segments from the input wires array.
 * Only wires in the 'schematic' view are included.
 */
function generateSchematicWires(input: KicadInput): string {
  const lines: string[] = [];

  // Build netId -> net name lookup
  const netIdToName = new Map<number, string>();
  input.nets.forEach(function indexNetByPosition(net, idx) {
    // netId in the wires references the original DB row ID.
    // We need to match wires to nets. The wires array uses netId which
    // corresponds to the net's position in the nets array (0-based).
    // However, the actual matching uses the numeric ID from the database.
    // Since we don't have DB IDs for nets in the interface, we use the
    // array index as a proxy. The caller is responsible for ensuring
    // wire.netId lines up with the net's position in the array.
    netIdToName.set(idx, net.name);
  });

  input.wires.forEach(function emitSchematicWire(wire) {
    // Only schematic-view wires
    if (wire.view !== 'schematic') return;
    if (wire.points.length < 2) return;

    // Emit one wire segment per consecutive pair of points
    for (let i = 0; i < wire.points.length - 1; i++) {
      const p1 = wire.points[i];
      const p2 = wire.points[i + 1];
      const x1 = p1.x * SCHEMATIC_SCALE;
      const y1 = p1.y * SCHEMATIC_SCALE;
      const x2 = p2.x * SCHEMATIC_SCALE;
      const y2 = p2.y * SCHEMATIC_SCALE;

      lines.push(
        `${ind(1)}(wire (pts (xy ${num(x1)} ${num(y1)}) (xy ${num(x2)} ${num(y2)}))` +
        ` (stroke (width 0) (type default))` +
        ` (uuid "${deterministicUuid(input.circuit.id, wire.netId, i)}"))`
      );
    }
  });

  return lines.join('\n');
}

/**
 * Generates the complete .kicad_sch file content.
 */
export function generateKicadSchematic(input: KicadInput): string {
  const lines: string[] = [];
  const rootUuid = deterministicUuid(input.circuit.id, 0);

  lines.push(`(kicad_sch (version ${SCHEMATIC_VERSION}) (generator "${GENERATOR}")`);
  lines.push(`${ind(1)}(uuid "${rootUuid}")`);
  lines.push(`${ind(1)}(paper "${PAPER_SIZE}")`);
  lines.push('');

  // Title block
  lines.push(`${ind(1)}(title_block`);
  lines.push(`${ind(2)}(title "${esc(input.circuit.name)}")`);
  lines.push(`${ind(2)}(comment 1 "Generated by ProtoPulse EDA")`);
  lines.push(`${ind(2)}(comment 2 "https://protopulse.io")`);
  lines.push(`${ind(1)})`);
  lines.push('');

  // Library symbols
  lines.push(generateLibSymbols(input));
  lines.push('');

  // Placed symbol instances
  lines.push(generateSchematicSymbolInstances(input));
  lines.push('');

  // Wires
  const wiresSection = generateSchematicWires(input);
  if (wiresSection) {
    lines.push(wiresSection);
    lines.push('');
  }

  // Sheet instances (required by KiCad 7+)
  lines.push(`${ind(1)}(sheet_instances`);
  lines.push(`${ind(2)}(path "/" (page "1"))`);
  lines.push(`${ind(1)})`);

  lines.push(')'); // end kicad_sch
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// PCB generation (.kicad_pcb)
// ---------------------------------------------------------------------------

/**
 * Generates the layers section of the PCB file.
 * KiCad 7 uses a fixed set of layer IDs.
 */
function generatePcbLayers(): string {
  const lines: string[] = [];
  lines.push(`${ind(1)}(layers`);
  lines.push(`${ind(2)}(0 "F.Cu" signal)`);
  lines.push(`${ind(2)}(31 "B.Cu" signal)`);
  lines.push(`${ind(2)}(32 "B.Adhes" user "B.Adhesive")`);
  lines.push(`${ind(2)}(33 "F.Adhes" user "F.Adhesive")`);
  lines.push(`${ind(2)}(34 "B.Paste" user)`);
  lines.push(`${ind(2)}(35 "F.Paste" user)`);
  lines.push(`${ind(2)}(36 "B.SilkS" user "B.Silkscreen")`);
  lines.push(`${ind(2)}(37 "F.SilkS" user "F.Silkscreen")`);
  lines.push(`${ind(2)}(38 "B.Mask" user)`);
  lines.push(`${ind(2)}(39 "F.Mask" user)`);
  lines.push(`${ind(2)}(40 "Dwgs.User" user "User.Drawings")`);
  lines.push(`${ind(2)}(41 "Cmts.User" user "User.Comments")`);
  lines.push(`${ind(2)}(42 "Eco1.User" user "User.Eco1")`);
  lines.push(`${ind(2)}(43 "Eco2.User" user "User.Eco2")`);
  lines.push(`${ind(2)}(44 "Edge.Cuts" user)`);
  lines.push(`${ind(2)}(45 "Margin" user)`);
  lines.push(`${ind(2)}(46 "B.CrtYd" user "B.Courtyard")`);
  lines.push(`${ind(2)}(47 "F.CrtYd" user "F.Courtyard")`);
  lines.push(`${ind(2)}(48 "B.Fab" user)`);
  lines.push(`${ind(2)}(49 "F.Fab" user)`);
  lines.push(`${ind(1)})`);
  return lines.join('\n');
}

/**
 * Generates the PCB setup section with basic defaults.
 */
function generatePcbSetup(): string {
  const lines: string[] = [];
  lines.push(`${ind(1)}(setup`);
  lines.push(`${ind(2)}(stackup`);
  lines.push(`${ind(3)}(layer "F.SilkS" (type "Top Silk Screen"))`);
  lines.push(`${ind(3)}(layer "F.Paste" (type "Top Solder Paste"))`);
  lines.push(`${ind(3)}(layer "F.Mask" (type "Top Solder Mask") (thickness 0.01))`);
  lines.push(`${ind(3)}(layer "F.Cu" (type "copper") (thickness 0.035))`);
  lines.push(`${ind(3)}(layer "dielectric 1" (type "core") (thickness 1.51) (material "FR4") (epsilon_r 4.5) (loss_tangent 0.02))`);
  lines.push(`${ind(3)}(layer "B.Cu" (type "copper") (thickness 0.035))`);
  lines.push(`${ind(3)}(layer "B.Mask" (type "Bottom Solder Mask") (thickness 0.01))`);
  lines.push(`${ind(3)}(layer "B.Paste" (type "Bottom Solder Paste"))`);
  lines.push(`${ind(3)}(layer "B.SilkS" (type "Bottom Silk Screen"))`);
  lines.push(`${ind(2)})`);
  lines.push(`${ind(2)}(pad_to_mask_clearance 0.051)`);
  lines.push(`${ind(2)}(pcbplotparams`);
  lines.push(`${ind(3)}(layerselection 0x00010fc_ffffffff)`);
  lines.push(`${ind(3)}(outputformat 1)`);
  lines.push(`${ind(3)}(mirror false)`);
  lines.push(`${ind(3)}(drillshape 1)`);
  lines.push(`${ind(3)}(scaleselection 1)`);
  lines.push(`${ind(3)}(outputdirectory "")`);
  lines.push(`${ind(2)})`);
  lines.push(`${ind(1)})`);
  return lines.join('\n');
}

/**
 * Generates the net declarations section of the PCB.
 */
function generatePcbNets(netList: Array<{ name: string; code: number }>): string {
  const lines: string[] = [];

  // Net 0 = unconnected (KiCad standard)
  lines.push(`${ind(1)}(net 0 "")`);

  netList.forEach(function emitNetDeclaration(net) {
    lines.push(`${ind(1)}(net ${net.code} "${esc(net.name)}")`);
  });

  return lines.join('\n');
}

/**
 * Generates a single footprint for a component instance on the PCB.
 *
 * Produces a minimal footprint with:
 *   - Reference and value text on the silkscreen layer
 *   - A courtyard rectangle around the component
 *   - Pads for each connector (THT pads for tht connectors, SMD pads for smd)
 *   - Fabrication layer outline
 */
function generatePcbFootprint(
  inst: KicadInput['instances'][number],
  part: { meta: Record<string, unknown>; connectors: Array<{ id: string; name: string; padType?: string }> },
  pinToNet: Map<PinKey, NetInfo>,
  input: KicadInput,
): string {
  const lines: string[] = [];

  const pcbX = inst.pcbX ?? 50;
  const pcbY = inst.pcbY ?? 50;
  const pcbRot = normalizeAngle(inst.pcbRotation ?? 0);
  const side = inst.pcbSide ?? 'front';
  const copperLayer = mapCopperLayer(side);
  const silkLayer = mapSilkLayer(side);
  const title = extractTitle(part.meta);
  const value = extractPartValue(part.meta) || title;
  const footprint = extractFootprint(part.meta) || 'Custom';
  const mounting = extractMountingType(part.meta);
  const uuid = deterministicUuid(input.circuit.id, inst.id, 99);

  const fpName = `PP:${sanitizeSymbolName(footprint)}_${inst.partId}`;

  lines.push(`${ind(1)}(footprint "${esc(fpName)}" (layer "${copperLayer}") (at ${num(pcbX)} ${num(pcbY)} ${num(pcbRot)})`);
  lines.push(`${ind(2)}(uuid "${uuid}")`);

  // Reference text
  lines.push(`${ind(2)}(fp_text reference "${esc(inst.referenceDesignator)}" (at 0 -3) (layer "${silkLayer}")`);
  lines.push(`${ind(3)}(effects (font (size 1 1) (thickness 0.15)))`);
  lines.push(`${ind(2)})`);

  // Value text
  lines.push(`${ind(2)}(fp_text value "${esc(value)}" (at 0 3) (layer "${silkLayer}")`);
  lines.push(`${ind(3)}(effects (font (size 1 1) (thickness 0.15)))`);
  lines.push(`${ind(2)})`);

  // Calculate footprint body extents based on pad positions
  const pinCount = part.connectors.length;
  const padPitch = 2.54; // mm between pads
  const fpWidth = Math.max(pinCount * padPitch * 0.5, 4);
  const fpHeight = Math.max(pinCount > 2 ? padPitch * Math.ceil(pinCount / 2) : padPitch * 2, 4);
  const halfW = fpWidth / 2;
  const halfH = fpHeight / 2;

  // Courtyard rectangle
  const courtyardLayer = side.toLowerCase() === 'back' ? 'B.CrtYd' : 'F.CrtYd';
  lines.push(`${ind(2)}(fp_rect (start ${num(-halfW - 0.5)} ${num(-halfH - 0.5)}) (end ${num(halfW + 0.5)} ${num(halfH + 0.5)}) (stroke (width 0.05) (type default)) (fill none) (layer "${courtyardLayer}"))`);

  // Fabrication layer outline
  const fabLayer = side.toLowerCase() === 'back' ? 'B.Fab' : 'F.Fab';
  lines.push(`${ind(2)}(fp_rect (start ${num(-halfW)} ${num(-halfH)}) (end ${num(halfW)} ${num(halfH)}) (stroke (width 0.1) (type default)) (fill none) (layer "${fabLayer}"))`);

  // Generate pads
  if (pinCount <= 2) {
    // Two-terminal component (resistor, cap, diode, etc): pads at ends
    part.connectors.forEach(function emitTwoTerminalPad(conn, connIdx) {
      const isSmd = mounting === 'smd' || conn.padType === 'smd';
      const padX = connIdx === 0 ? -halfW + 0.5 : halfW - 0.5;
      const padY = 0;

      const netInfo = pinToNet.get(makePinKey(inst.id, conn.id));
      const netStr = netInfo ? ` (net ${netInfo.code} "${esc(netInfo.name)}")` : '';

      if (isSmd) {
        lines.push(
          `${ind(2)}(pad "${esc(conn.id)}" smd rect (at ${num(padX)} ${num(padY)})` +
          ` (size ${DEFAULT_SMD_PAD_WIDTH} ${DEFAULT_SMD_PAD_HEIGHT})` +
          ` (layers "${copperLayer}" "${copperLayer === 'F.Cu' ? 'F.Paste' : 'B.Paste'}" "${copperLayer === 'F.Cu' ? 'F.Mask' : 'B.Mask'}")` +
          `${netStr})`
        );
      } else {
        // First pad gets rect shape (pin 1 indicator), rest get circle
        const padShape = connIdx === 0 ? 'rect' : 'circle';
        lines.push(
          `${ind(2)}(pad "${esc(conn.id)}" thru_hole ${padShape} (at ${num(padX)} ${num(padY)})` +
          ` (size ${DEFAULT_THT_PAD_SIZE} ${DEFAULT_THT_PAD_SIZE}) (drill ${DEFAULT_THT_DRILL})` +
          ` (layers "*.Cu" "*.Mask")` +
          `${netStr})`
        );
      }
    });
  } else {
    // Multi-pin component: DIP-like dual-row layout
    const leftCount = Math.ceil(pinCount / 2);
    const rightCount = pinCount - leftCount;

    // Left column
    part.connectors.forEach(function emitDipPad(conn, connIdx) {
      const isSmd = mounting === 'smd' || conn.padType === 'smd';
      let padX: number;
      let padY: number;

      if (connIdx < leftCount) {
        // Left column
        padX = -halfW + 0.5;
        padY = -halfH + 0.5 + connIdx * padPitch;
      } else {
        // Right column (mirrored order, like DIP)
        const rightIdx = connIdx - leftCount;
        padX = halfW - 0.5;
        padY = halfH - 0.5 - rightIdx * padPitch;
      }

      const netInfo = pinToNet.get(makePinKey(inst.id, conn.id));
      const netStr = netInfo ? ` (net ${netInfo.code} "${esc(netInfo.name)}")` : '';

      if (isSmd) {
        lines.push(
          `${ind(2)}(pad "${esc(conn.id)}" smd rect (at ${num(padX)} ${num(padY)})` +
          ` (size ${DEFAULT_SMD_PAD_WIDTH} ${DEFAULT_SMD_PAD_HEIGHT})` +
          ` (layers "${copperLayer}" "${copperLayer === 'F.Cu' ? 'F.Paste' : 'B.Paste'}" "${copperLayer === 'F.Cu' ? 'F.Mask' : 'B.Mask'}")` +
          `${netStr})`
        );
      } else {
        const padShape = connIdx === 0 ? 'rect' : 'circle';
        lines.push(
          `${ind(2)}(pad "${esc(conn.id)}" thru_hole ${padShape} (at ${num(padX)} ${num(padY)})` +
          ` (size ${DEFAULT_THT_PAD_SIZE} ${DEFAULT_THT_PAD_SIZE}) (drill ${DEFAULT_THT_DRILL})` +
          ` (layers "*.Cu" "*.Mask")` +
          `${netStr})`
        );
      }
    });
  }

  lines.push(`${ind(1)})`); // end footprint
  return lines.join('\n');
}

/**
 * Generates PCB traces from the wires array.
 * Only wires in the 'pcb' view are included.
 */
function generatePcbTraces(
  input: KicadInput,
  netList: Array<{ name: string; code: number }>,
): string {
  const lines: string[] = [];

  // Build a netId (array index) -> net code lookup
  const netCodeByIndex = new Map<number, number>();
  input.nets.forEach(function indexNetCode(_net, idx) {
    if (idx < netList.length) {
      netCodeByIndex.set(idx, netList[idx].code);
    }
  });

  input.wires.forEach(function emitPcbTrace(wire) {
    // Only PCB-view wires become traces
    if (wire.view !== 'pcb') return;
    if (wire.points.length < 2) return;

    const layer = mapWireLayer(wire.layer);
    const width = wire.width > 0 ? wire.width : DEFAULT_TRACE_WIDTH;
    const netCode = netCodeByIndex.get(wire.netId) ?? 0;

    // Emit one segment per consecutive pair of points
    for (let i = 0; i < wire.points.length - 1; i++) {
      const p1 = wire.points[i];
      const p2 = wire.points[i + 1];

      lines.push(
        `${ind(1)}(segment (start ${num(p1.x)} ${num(p1.y)}) (end ${num(p2.x)} ${num(p2.y)})` +
        ` (width ${num(width)}) (layer "${layer}") (net ${netCode})` +
        ` (uuid "${deterministicUuid(input.circuit.id, wire.netId, 200 + i)}"))`
      );
    }
  });

  return lines.join('\n');
}

/**
 * Generates the board outline on the Edge.Cuts layer as four gr_line segments.
 */
function generateBoardOutline(width: number, height: number): string {
  const lines: string[] = [];

  // Rectangle outline: (0,0) -> (width,0) -> (width,height) -> (0,height) -> (0,0)
  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];

  for (let i = 0; i < corners.length; i++) {
    const start = corners[i];
    const end = corners[(i + 1) % corners.length];
    lines.push(
      `${ind(1)}(gr_line (start ${num(start.x)} ${num(start.y)}) (end ${num(end.x)} ${num(end.y)})` +
      ` (stroke (width ${num(EDGE_CUTS_WIDTH)}) (type default)) (layer "Edge.Cuts"))`
    );
  }

  return lines.join('\n');
}

/**
 * Generates the complete .kicad_pcb file content.
 */
export function generateKicadPcb(input: KicadInput): string {
  const { netList, pinToNet } = buildNetIndex(input);
  const lines: string[] = [];

  const boardW = input.boardWidth ?? DEFAULT_BOARD_WIDTH;
  const boardH = input.boardHeight ?? DEFAULT_BOARD_HEIGHT;

  lines.push(`(kicad_pcb (version ${PCB_VERSION}) (generator "${GENERATOR}")`);
  lines.push('');

  // General section
  lines.push(`${ind(1)}(general`);
  lines.push(`${ind(2)}(thickness ${DEFAULT_BOARD_THICKNESS})`);
  lines.push(`${ind(1)})`);
  lines.push('');

  // Layers
  lines.push(generatePcbLayers());
  lines.push('');

  // Setup
  lines.push(generatePcbSetup());
  lines.push('');

  // Net declarations
  lines.push(generatePcbNets(netList));
  lines.push('');

  // Footprints
  input.instances.forEach(function emitPcbFootprint(inst) {
    const part = inst.partId != null ? input.parts.get(inst.partId) : undefined;
    if (!part) return;
    lines.push(generatePcbFootprint(inst, part, pinToNet, input));
    lines.push('');
  });

  // Traces (segments)
  const traces = generatePcbTraces(input, netList);
  if (traces) {
    lines.push(traces);
    lines.push('');
  }

  // Board outline
  lines.push(generateBoardOutline(boardW, boardH));

  lines.push(')'); // end kicad_pcb
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Project file generation (.kicad_pro)
// ---------------------------------------------------------------------------

/**
 * Generates the .kicad_pro file content (JSON format).
 *
 * This is a minimal but valid project file that KiCad 7+ will accept.
 * It tells KiCad to look for the schematic and board files with the
 * same base name in the same directory.
 */
export function generateKicadProjectFile(input: KicadInput): string {
  const safeName = sanitizeSymbolName(input.circuit.name) || 'circuit';

  const project = {
    board: {
      design_settings: {
        defaults: {
          board_outline_line_width: EDGE_CUTS_WIDTH,
          copper_line_width: DEFAULT_TRACE_WIDTH,
          copper_text_size_h: 1.5,
          copper_text_size_v: 1.5,
          copper_text_thickness: 0.3,
          other_line_width: 0.15,
          silk_line_width: 0.15,
          silk_text_size_h: 1.0,
          silk_text_size_v: 1.0,
          silk_text_thickness: 0.15,
        },
        diff_pair_dimensions: [],
        drc_exclusions: [],
        rules: {
          min_clearance: 0.2,
          min_track_width: 0.2,
          min_via_annular_width: 0.13,
          min_via_diameter: 0.5,
        },
        track_widths: [0, 0.25, 0.5, 1.0],
        via_dimensions: [],
      },
    },
    libraries: {
      pinned_footprint_libs: [],
      pinned_symbol_libs: [],
    },
    meta: {
      filename: `${safeName}.kicad_pro`,
      version: 1,
    },
    net_settings: {
      classes: [
        {
          bus_width: 12,
          clearance: 0.2,
          diff_pair_gap: 0.25,
          diff_pair_via_gap: 0.25,
          diff_pair_width: 0.2,
          line_style: 0,
          microvia_diameter: 0.3,
          microvia_drill: 0.1,
          name: 'Default',
          pcb_color: 'rgba(0, 0, 0, 0.000)',
          schematic_color: 'rgba(0, 0, 0, 0.000)',
          track_width: 0.25,
          via_diameter: 0.6,
          via_drill: 0.3,
          wire_width: 6,
        },
      ],
      meta: {
        version: 3,
      },
      net_colors: null,
      netclass_assignments: null,
      netclass_patterns: [],
    },
    pcbnew: {
      last_paths: {
        gencad: '',
        idf: '',
        netlist: '',
        specctra_dsn: '',
        step: '',
        vrml: '',
      },
      page_layout_descr_file: '',
    },
    schematic: {
      drawing: {
        default_bus_thickness: 12,
        default_line_thickness: 6,
        default_text_size: 50,
        default_wire_thickness: 6,
      },
      legacy_lib_dir: '',
      legacy_lib_list: [],
    },
    sheets: [
      ['', ''],
    ],
    text_variables: {},
  };

  return JSON.stringify(project, null, 2);
}

// ---------------------------------------------------------------------------
// Unified entry point
// ---------------------------------------------------------------------------

/**
 * Generates a complete KiCad 7+ project from ProtoPulse circuit data.
 *
 * Returns three strings that should be saved as:
 *   - `<name>.kicad_sch`  — the schematic file
 *   - `<name>.kicad_pcb`  — the PCB layout file
 *   - `<name>.kicad_pro`  — the project settings file
 *
 * The files are self-contained: component symbols are embedded in the
 * schematic (lib_symbols section) and footprints are embedded inline
 * in the PCB. No external library files are needed.
 *
 * @param input  Circuit data assembled from the ProtoPulse database
 * @returns      The three KiCad file contents
 */
export function generateKicadProject(input: KicadInput): KicadOutput {
  return {
    schematic: generateKicadSchematic(input),
    pcb: generateKicadPcb(input),
    project: generateKicadProjectFile(input),
  };
}

// ---------------------------------------------------------------------------
// Legacy API — original export-generators.ts signatures used by ai-tools.ts
// ---------------------------------------------------------------------------

/** Escape a string for use inside a KiCad S-expression quoted value. */
function escapeKicad(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Extract pin-to-component connections from a net's segments. */
function extractNetPinNodes(
  net: CircuitNetData,
  instances: CircuitInstanceData[],
): Array<{ ref: string; pin: string }> {
  const results: Array<{ ref: string; pin: string }> = [];

  if (Array.isArray(net.segments)) {
    for (const seg of net.segments) {
      if (seg && typeof seg === 'object') {
        const s = seg as Record<string, unknown>;
        if (typeof s.instanceId === 'number' && typeof s.pinId === 'string') {
          const inst = instances.find((i) => i.id === s.instanceId);
          if (inst) {
            results.push({ ref: inst.referenceDesignator, pin: s.pinId as string });
          }
        }
      }
    }
  }

  return results;
}

export function generateKicadSch(
  nodes: ArchNodeData[],
  edges: ArchEdgeData[],
  projectName: string,
): ExportResult {
  const uuid = () => crypto.randomUUID();
  const schUuid = uuid();

  // Scale factor: architecture positions are in logical units, KiCad uses mils
  const SCALE = 2.54; // 1 unit → 2.54 mm (100 mil grid)

  // Build node position lookup for wiring
  const nodePositions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    nodePositions.set(node.nodeId, {
      x: node.positionX * SCALE,
      y: node.positionY * SCALE,
    });
  }

  // --- lib_symbols section ---
  const libSymbols = nodes.map((node) => {
    const libId = `protopulse:${node.label.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    return `    (symbol "${libId}"
      (in_bom yes) (on_board yes)
      (property "Reference" "U" (at 0 2.54 0) (effects (font (size 1.27 1.27))))
      (property "Value" "${escapeKicad(node.label)}" (at 0 -2.54 0) (effects (font (size 1.27 1.27))))
      (property "Footprint" "" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
      (property "Datasheet" "" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
      (symbol "${libId}_0_1"
        (rectangle (start -5.08 5.08) (end 5.08 -5.08) (stroke (width 0.254) (type default)) (fill (type background)))
      )
    )`;
  });

  // --- symbol instances on the sheet ---
  const symbols = nodes.map((node, i) => {
    const pos = nodePositions.get(node.nodeId)!;
    const libId = `protopulse:${node.label.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const refDes = `U${i + 1}`;
    const desc =
      node.data && typeof node.data.description === 'string'
        ? node.data.description
        : '';

    return `  (symbol (lib_id "${libId}") (at ${pos.x.toFixed(2)} ${pos.y.toFixed(2)} 0) (unit 1)
    (in_bom yes) (on_board yes) (dnp no)
    (uuid "${uuid()}")
    (property "Reference" "${refDes}" (at ${pos.x.toFixed(2)} ${(pos.y - 5.08).toFixed(2)} 0)
      (effects (font (size 1.27 1.27))))
    (property "Value" "${escapeKicad(node.label)}" (at ${pos.x.toFixed(2)} ${(pos.y + 5.08).toFixed(2)} 0)
      (effects (font (size 1.27 1.27))))
    (property "Footprint" "" (at ${pos.x.toFixed(2)} ${pos.y.toFixed(2)} 0)
      (effects (font (size 1.27 1.27)) hide))
    (property "Datasheet" "" (at ${pos.x.toFixed(2)} ${pos.y.toFixed(2)} 0)
      (effects (font (size 1.27 1.27)) hide))
    (property "Description" "${escapeKicad(desc)}" (at ${pos.x.toFixed(2)} ${pos.y.toFixed(2)} 0)
      (effects (font (size 1.27 1.27)) hide))
  )`;
  });

  // --- wires ---
  const wires = edges
    .map((edge) => {
      const src = nodePositions.get(edge.source);
      const tgt = nodePositions.get(edge.target);
      if (!src || !tgt) return null;
      // Offset wire endpoints to the edge of the symbol rectangle (5.08mm half-width)
      const srcX = src.x + 5.08;
      const tgtX = tgt.x - 5.08;
      return `  (wire (pts (xy ${srcX.toFixed(2)} ${src.y.toFixed(2)}) (xy ${tgtX.toFixed(2)} ${tgt.y.toFixed(2)}))
    (stroke (width 0) (type default))
    (uuid "${uuid()}")
  )`;
    })
    .filter(Boolean);

  const content = `(kicad_sch (version 20230121) (generator "protopulse") (generator_version "1.0")

  (uuid "${schUuid}")

  (paper "A4")

  (lib_symbols
${libSymbols.join('\n')}
  )

${symbols.join('\n\n')}

${wires.join('\n\n')}

)
`;

  return {
    content,
    encoding: 'utf8',
    mimeType: 'application/x-kicad-schematic',
    filename: `${sanitizeFilename(projectName)}.kicad_sch`,
  };
}

export function generateKicadNetlist(
  instances: CircuitInstanceData[],
  nets: CircuitNetData[],
  parts: ComponentPartData[],
): ExportResult {
  // Build partId → part lookup
  const partMap = new Map<number, ComponentPartData>();
  for (const part of parts) {
    partMap.set(part.id, part);
  }

  // --- components ---
  const components = instances.map((inst) => {
    const part = inst.partId != null ? partMap.get(inst.partId) : undefined;
    const meta = part?.meta ?? {};
    const value = metaStr(meta, 'title', inst.referenceDesignator);
    const footprint = metaStr(meta, 'footprint', 'Unknown:Unknown');
    const datasheet = metaStr(meta, 'datasheet', '~');

    return `    (comp (ref "${escapeKicad(inst.referenceDesignator)}")
      (value "${escapeKicad(value)}")
      (footprint "${escapeKicad(footprint)}")
      (datasheet "${escapeKicad(datasheet)}")
    )`;
  });

  // --- nets ---
  const netEntries = nets.map((net, i) => {
    const code = i + 1;
    const pinNodes = extractNetPinNodes(net, instances);

    const nodeLines = pinNodes.map(
      (pn) => `      (node (ref "${escapeKicad(pn.ref)}") (pin "${pn.pin}"))`,
    );

    return `    (net (code ${code}) (name "${escapeKicad(net.name)}")
${nodeLines.join('\n')}
    )`;
  });

  const content = `(export (version "E")
  (design
    (source "ProtoPulse")
    (date "${new Date().toISOString()}")
    (tool "ProtoPulse Export")
  )
  (components
${components.join('\n')}
  )
  (nets
    (net (code 0) (name ""))
${netEntries.join('\n')}
  )
)
`;

  return {
    content,
    encoding: 'utf8',
    mimeType: 'application/x-kicad-netlist',
    filename: 'netlist.net',
  };
}
