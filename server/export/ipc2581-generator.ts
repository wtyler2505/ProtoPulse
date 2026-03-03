// =============================================================================
// IPC-2581B Generator — Wave 29: FG-09
// =============================================================================
//
// Generates IPC-2581B format XML from PCB layout data. IPC-2581 is an open
// standard for printed board and assembly manufacturing description data.
// It is the successor to IPC-D-356 and a competitor to ODB++.
//
// Sections generated:
//   Content       — Layer stack, padstack definitions, line/arc descriptions
//   LogicalNet    — Netlist from circuit nets
//   PhysicalNet   — Component placement, pin locations
//   Bom           — Bill of materials
//   Ecad          — Design metadata
//
// Output: A single XML string conforming to IPC-2581B schema.
//
// Pure function library — no Express routes, no database access, no side effects.
// =============================================================================

import {
  type BomItemData,
  type CircuitInstanceData,
  type CircuitNetData,
  type CircuitWireData,
  escapeXml,
  metaStr,
  sanitizeFilename,
} from './types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface Ipc2581Input {
  projectName: string;
  instances: CircuitInstanceData[];
  nets: CircuitNetData[];
  wires: CircuitWireData[];
  parts: Map<number, {
    meta: Record<string, unknown>;
    connectors: Array<{ id: string; name: string; padType?: string }>;
  }>;
  bom: BomItemData[];
  boardWidth?: number;
  boardHeight?: number;
}

export interface Ipc2581Output {
  /** Complete IPC-2581B XML content */
  xml: string;
  /** Number of nets in the output */
  netCount: number;
  /** Number of components in the output */
  componentCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GENERATOR = 'ProtoPulse';
const IPC_VERSION = 'B';
const IPC_REVISION = '1';
const UNITS = 'MILLIMETER';
const DEFAULT_BOARD_WIDTH = 50;
const DEFAULT_BOARD_HEIGHT = 40;
const DEFAULT_TRACE_WIDTH = 0.25;
const DEFAULT_THT_PAD_DIAMETER = 1.6;
const DEFAULT_THT_DRILL = 0.8;
const DEFAULT_SMD_PAD_WIDTH = 1.2;
const DEFAULT_SMD_PAD_HEIGHT = 0.6;

// ---------------------------------------------------------------------------
// XML helper
// ---------------------------------------------------------------------------

/** Indent helper: create N levels of indentation (2 spaces per level) */
function indent(level: number): string {
  return '  '.repeat(level);
}

/** Format a coordinate to 4 decimal places */
function fmtCoord(val: number): string {
  return val.toFixed(4);
}

// ---------------------------------------------------------------------------
// Section generators
// ---------------------------------------------------------------------------

/** Generate the XML header and IPC-2581 root opening */
function generateHeader(projectName: string): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<IPC-2581 revision="${IPC_VERSION}" xmlns="http://webstds.ipc.org/2581">`);
  lines.push('');
  return lines.join('\n');
}

/** Generate the Content section (layer stack, padstack defs, line descriptions) */
function generateContentSection(
  instances: Ipc2581Input['instances'],
  parts: Ipc2581Input['parts'],
  boardWidth: number,
  boardHeight: number,
): string {
  const lines: string[] = [];
  lines.push(`${indent(1)}<Content>`);

  // Function mode (fabrication + assembly)
  lines.push(`${indent(2)}<FunctionMode mode="FABRICATION"/>`);

  // Step reference
  lines.push(`${indent(2)}<StepRef name="pcb"/>`);

  // Layer stack definition
  lines.push(`${indent(2)}<LayerRef name="TOP"/>`);
  lines.push(`${indent(2)}<LayerRef name="BOTTOM"/>`);
  lines.push(`${indent(2)}<LayerRef name="SOLDER_MASK_TOP"/>`);
  lines.push(`${indent(2)}<LayerRef name="SOLDER_MASK_BOTTOM"/>`);
  lines.push(`${indent(2)}<LayerRef name="SILK_SCREEN_TOP"/>`);
  lines.push(`${indent(2)}<LayerRef name="SILK_SCREEN_BOTTOM"/>`);
  lines.push(`${indent(2)}<LayerRef name="SOLDER_PASTE_TOP"/>`);
  lines.push(`${indent(2)}<LayerRef name="SOLDER_PASTE_BOTTOM"/>`);
  lines.push(`${indent(2)}<LayerRef name="DRILL"/>`);

  // Dictionary of padstack definitions
  lines.push(`${indent(2)}<DictionaryStandard>`);

  // Standard THT padstack
  lines.push(`${indent(3)}<EntryStandard id="PAD_THT">`);
  lines.push(`${indent(4)}<PadstackDef name="PAD_THT">`);
  lines.push(`${indent(5)}<PadstackPadDef layerRef="TOP" padUse="REGULAR">`);
  lines.push(`${indent(6)}<Pad>`);
  lines.push(`${indent(7)}<Circle diameter="${fmtCoord(DEFAULT_THT_PAD_DIAMETER)}"/>`);
  lines.push(`${indent(6)}</Pad>`);
  lines.push(`${indent(5)}</PadstackPadDef>`);
  lines.push(`${indent(5)}<PadstackPadDef layerRef="BOTTOM" padUse="REGULAR">`);
  lines.push(`${indent(6)}<Pad>`);
  lines.push(`${indent(7)}<Circle diameter="${fmtCoord(DEFAULT_THT_PAD_DIAMETER)}"/>`);
  lines.push(`${indent(6)}</Pad>`);
  lines.push(`${indent(5)}</PadstackPadDef>`);
  lines.push(`${indent(5)}<PadstackHoleDef name="DRILL" diameter="${fmtCoord(DEFAULT_THT_DRILL)}" platingStatus="PLATED" plusTol="0.05" minusTol="0.05"/>`);
  lines.push(`${indent(4)}</PadstackDef>`);
  lines.push(`${indent(3)}</EntryStandard>`);

  // Standard SMD padstack
  lines.push(`${indent(3)}<EntryStandard id="PAD_SMD">`);
  lines.push(`${indent(4)}<PadstackDef name="PAD_SMD">`);
  lines.push(`${indent(5)}<PadstackPadDef layerRef="TOP" padUse="REGULAR">`);
  lines.push(`${indent(6)}<Pad>`);
  lines.push(`${indent(7)}<RectCenter width="${fmtCoord(DEFAULT_SMD_PAD_WIDTH)}" height="${fmtCoord(DEFAULT_SMD_PAD_HEIGHT)}"/>`);
  lines.push(`${indent(6)}</Pad>`);
  lines.push(`${indent(5)}</PadstackPadDef>`);
  lines.push(`${indent(4)}</PadstackDef>`);
  lines.push(`${indent(3)}</EntryStandard>`);

  // Line description for traces
  lines.push(`${indent(3)}<EntryStandard id="LINE_DEFAULT">`);
  lines.push(`${indent(4)}<LineDesc lineWidth="${fmtCoord(DEFAULT_TRACE_WIDTH)}" lineEnd="ROUND"/>`);
  lines.push(`${indent(3)}</EntryStandard>`);

  lines.push(`${indent(2)}</DictionaryStandard>`);

  // Board profile
  lines.push(`${indent(2)}<Profile>`);
  lines.push(`${indent(3)}<Polygon>`);
  lines.push(`${indent(4)}<PolyBegin x="${fmtCoord(0)}" y="${fmtCoord(0)}"/>`);
  lines.push(`${indent(4)}<PolyStepSegment x="${fmtCoord(boardWidth)}" y="${fmtCoord(0)}"/>`);
  lines.push(`${indent(4)}<PolyStepSegment x="${fmtCoord(boardWidth)}" y="${fmtCoord(boardHeight)}"/>`);
  lines.push(`${indent(4)}<PolyStepSegment x="${fmtCoord(0)}" y="${fmtCoord(boardHeight)}"/>`);
  lines.push(`${indent(4)}<PolyStepSegment x="${fmtCoord(0)}" y="${fmtCoord(0)}"/>`);
  lines.push(`${indent(3)}</Polygon>`);
  lines.push(`${indent(2)}</Profile>`);

  lines.push(`${indent(1)}</Content>`);
  lines.push('');
  return lines.join('\n');
}

/** Generate the LogicalNet section (netlist) */
function generateLogicalNetSection(
  nets: Ipc2581Input['nets'],
  instances: Ipc2581Input['instances'],
): string {
  const lines: string[] = [];
  lines.push(`${indent(1)}<LogicalNet>`);

  for (const net of nets) {
    lines.push(`${indent(2)}<Net name="${escapeXml(net.name)}" type="${escapeXml(net.netType)}">`);

    const segments = (net.segments ?? []) as Array<{
      fromInstanceId: number;
      fromPin: string;
      toInstanceId: number;
      toPin: string;
    }>;

    // Collect unique pin references
    const pinRefs = new Map<string, { component: string; pin: string }>();
    for (const seg of segments) {
      const fromInst = instances.find(i => i.id === seg.fromInstanceId);
      const toInst = instances.find(i => i.id === seg.toInstanceId);
      if (fromInst) {
        const key = `${fromInst.referenceDesignator}-${seg.fromPin}`;
        pinRefs.set(key, { component: fromInst.referenceDesignator, pin: seg.fromPin });
      }
      if (toInst) {
        const key = `${toInst.referenceDesignator}-${seg.toPin}`;
        pinRefs.set(key, { component: toInst.referenceDesignator, pin: seg.toPin });
      }
    }

    pinRefs.forEach((ref) => {
      lines.push(`${indent(3)}<PinRef componentRef="${escapeXml(ref.component)}" pin="${escapeXml(ref.pin)}"/>`);
    });

    lines.push(`${indent(2)}</Net>`);
  }

  lines.push(`${indent(1)}</LogicalNet>`);
  lines.push('');
  return lines.join('\n');
}

/** Generate the PhysicalNet section (component placement, pin locations) */
function generatePhysicalNetSection(
  instances: Ipc2581Input['instances'],
  parts: Ipc2581Input['parts'],
  wires: Ipc2581Input['wires'],
): string {
  const lines: string[] = [];
  lines.push(`${indent(1)}<PhysicalNet>`);

  // Component placement
  for (const inst of instances) {
    const part = inst.partId != null ? parts.get(inst.partId) : undefined;
    const meta = (part?.meta ?? {}) as Record<string, unknown>;
    const pkgName = metaStr(meta, 'package', metaStr(meta, 'packageType', 'UNKNOWN'));
    const partName = metaStr(meta, 'title', inst.referenceDesignator);
    const side = (inst.pcbSide ?? 'front') === 'back' ? 'BOTTOM' : 'TOP';
    const x = inst.pcbX ?? 0;
    const y = inst.pcbY ?? 0;
    const rotation = inst.pcbRotation ?? 0;

    lines.push(`${indent(2)}<Component refDes="${escapeXml(inst.referenceDesignator)}" packageRef="${escapeXml(pkgName)}" layerRef="${side}">`);
    lines.push(`${indent(3)}<Location x="${fmtCoord(x)}" y="${fmtCoord(y)}" rotation="${rotation.toFixed(1)}"/>`);

    // Pin locations
    const connectors = part?.connectors ?? [];
    for (let ci = 0; ci < connectors.length; ci++) {
      const conn = connectors[ci];
      const isSmd = conn.padType === 'smd';
      const padRef = isSmd ? 'PAD_SMD' : 'PAD_THT';
      const pinX = x + ci * 2.54;
      const pinY = y;
      lines.push(`${indent(3)}<Pin name="${escapeXml(conn.name)}" padstackRef="${padRef}">`);
      lines.push(`${indent(4)}<Location x="${fmtCoord(pinX)}" y="${fmtCoord(pinY)}"/>`);
      lines.push(`${indent(3)}</Pin>`);
    }

    lines.push(`${indent(2)}</Component>`);
  }

  // Wire / trace data
  const pcbWires = wires.filter(w => w.view === 'pcb');
  if (pcbWires.length > 0) {
    lines.push(`${indent(2)}<Traces>`);
    for (const wire of pcbWires) {
      const layer = (wire.layer ?? 'front') === 'back' ? 'BOTTOM' : 'TOP';
      const pts = (wire.points ?? []) as Array<{ x: number; y: number }>;
      if (pts.length >= 2) {
        lines.push(`${indent(3)}<Trace layerRef="${layer}" lineDescRef="LINE_DEFAULT">`);
        for (let pi = 0; pi < pts.length; pi++) {
          if (pi === 0) {
            lines.push(`${indent(4)}<PolyBegin x="${fmtCoord(pts[pi].x)}" y="${fmtCoord(pts[pi].y)}"/>`);
          } else {
            lines.push(`${indent(4)}<PolyStepSegment x="${fmtCoord(pts[pi].x)}" y="${fmtCoord(pts[pi].y)}"/>`);
          }
        }
        lines.push(`${indent(3)}</Trace>`);
      }
    }
    lines.push(`${indent(2)}</Traces>`);
  }

  lines.push(`${indent(1)}</PhysicalNet>`);
  lines.push('');
  return lines.join('\n');
}

/** Generate the Bom section */
function generateBomSection(bom: BomItemData[]): string {
  const lines: string[] = [];
  lines.push(`${indent(1)}<Bom>`);

  if (bom.length === 0) {
    lines.push(`${indent(2)}<!-- No BOM items -->`);
  }

  for (const item of bom) {
    lines.push(`${indent(2)}<BomItem>`);
    lines.push(`${indent(3)}<PartNumber>${escapeXml(item.partNumber)}</PartNumber>`);
    lines.push(`${indent(3)}<Manufacturer>${escapeXml(item.manufacturer)}</Manufacturer>`);
    lines.push(`${indent(3)}<Description>${escapeXml(item.description)}</Description>`);
    lines.push(`${indent(3)}<Quantity>${item.quantity}</Quantity>`);
    lines.push(`${indent(3)}<UnitPrice>${escapeXml(item.unitPrice)}</UnitPrice>`);
    lines.push(`${indent(3)}<TotalPrice>${escapeXml(item.totalPrice)}</TotalPrice>`);
    if (item.supplier) {
      lines.push(`${indent(3)}<Supplier>${escapeXml(item.supplier)}</Supplier>`);
    }
    if (item.status) {
      lines.push(`${indent(3)}<Status>${escapeXml(item.status)}</Status>`);
    }
    lines.push(`${indent(2)}</BomItem>`);
  }

  lines.push(`${indent(1)}</Bom>`);
  lines.push('');
  return lines.join('\n');
}

/** Generate the Ecad section (design metadata) */
function generateEcadSection(projectName: string): string {
  const lines: string[] = [];
  lines.push(`${indent(1)}<Ecad name="${escapeXml(sanitizeFilename(projectName))}">`);
  lines.push(`${indent(2)}<CadHeader units="${UNITS}"/>`);
  lines.push(`${indent(2)}<CadData>`);
  lines.push(`${indent(3)}<Step name="pcb"/>`);
  lines.push(`${indent(2)}</CadData>`);
  lines.push(`${indent(1)}</Ecad>`);
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate IPC-2581B XML from project data.
 *
 * Returns the complete XML string and summary statistics.
 */
export function generateIpc2581(input: Ipc2581Input): Ipc2581Output {
  const boardWidth = input.boardWidth ?? DEFAULT_BOARD_WIDTH;
  const boardHeight = input.boardHeight ?? DEFAULT_BOARD_HEIGHT;

  const parts: string[] = [];
  parts.push(generateHeader(input.projectName));
  parts.push(generateEcadSection(input.projectName));
  parts.push(generateContentSection(input.instances, input.parts, boardWidth, boardHeight));
  parts.push(generateLogicalNetSection(input.nets, input.instances));
  parts.push(generatePhysicalNetSection(input.instances, input.parts, input.wires));
  parts.push(generateBomSection(input.bom));
  parts.push('</IPC-2581>');
  parts.push('');

  return {
    xml: parts.join('\n'),
    netCount: input.nets.length,
    componentCount: input.instances.length,
  };
}
