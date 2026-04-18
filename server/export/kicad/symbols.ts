// =============================================================================
// KiCad Exporter — Schematic symbol library + placement emission
// =============================================================================

import crypto from 'crypto';
import {
  type ArchEdgeData,
  type ArchNodeData,
  type ExportResult,
  sanitizeFilename,
} from '../types';
import {
  deterministicUuid,
  esc,
  escapeKicad,
  ind,
  normalizeAngle,
  num,
  sanitizeSymbolName,
} from './sexpr';
import {
  extractDatasheet,
  extractFootprint,
  extractManufacturer,
  extractMpn,
  extractPartValue,
  extractTitle,
  guessPinType,
} from './meta';
import {
  FONT_SIZE,
  GENERATOR,
  MIN_SYMBOL_HALF_SIZE,
  PAPER_SIZE,
  PIN_LENGTH,
  SCHEMATIC_SCALE,
  SCHEMATIC_VERSION,
  type KicadInput,
} from './types';

// ---------------------------------------------------------------------------
// Pin layout
// ---------------------------------------------------------------------------

/** Direction-aware pin placement relative to a symbol origin. */
export interface PinPlacement {
  x: number;
  y: number;
  /** KiCad rotation (0=right, 90=up, 180=left, 270=down) */
  rotation: number;
}

/**
 * Distributes pins around the edges of a rectangular symbol body.
 *
 * Strategy:
 *   - Left side: pins 0 .. ceil(n/2)-1
 *   - Right side: pins ceil(n/2) .. n-1
 *
 * Pins are evenly spaced at 2.54 mm pitch. The rectangle body is sized
 * to fit all pins.
 */
export function layoutPins(
  pinCount: number,
): { placements: PinPlacement[]; bodyWidth: number; bodyHeight: number } {
  if (pinCount === 0) {
    return {
      placements: [],
      bodyWidth: MIN_SYMBOL_HALF_SIZE * 2,
      bodyHeight: MIN_SYMBOL_HALF_SIZE * 2,
    };
  }

  const leftCount = Math.ceil(pinCount / 2);
  const rightCount = pinCount - leftCount;

  const maxPerSide = Math.max(leftCount, rightCount);
  const bodyHeight = Math.max(maxPerSide * 2.54, MIN_SYMBOL_HALF_SIZE * 2);
  const bodyWidth = Math.max(5.08, MIN_SYMBOL_HALF_SIZE * 2);

  const halfW = bodyWidth / 2;
  const halfH = bodyHeight / 2;

  const placements: PinPlacement[] = [];

  for (let i = 0; i < leftCount; i++) {
    const yOffset = halfH - (i + 0.5) * (bodyHeight / leftCount);
    placements.push({ x: -halfW - PIN_LENGTH, y: yOffset, rotation: 0 });
  }

  for (let i = 0; i < rightCount; i++) {
    const yOffset = halfH - (i + 0.5) * (bodyHeight / rightCount);
    placements.push({ x: halfW + PIN_LENGTH, y: yOffset, rotation: 180 });
  }

  return { placements, bodyWidth, bodyHeight };
}

// ---------------------------------------------------------------------------
// lib_symbols section
// ---------------------------------------------------------------------------

/** Generates the lib_symbols section: one symbol definition per unique part. */
export function generateLibSymbols(input: KicadInput): string {
  const lines: string[] = [];
  lines.push(`${ind(1)}(lib_symbols`);

  const usedPartIds = new Set<number>();
  input.instances.forEach(function collectUsedPartIds(inst) {
    if (inst.partId != null) usedPartIds.add(inst.partId);
  });

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
    const symName = `PP:${sanitizeSymbolName(title)}_${partId}`;
    const pinCount = part.connectors.length;
    const { placements, bodyWidth, bodyHeight } = layoutPins(pinCount);

    const halfW = bodyWidth / 2;
    const halfH = bodyHeight / 2;

    lines.push(`${ind(2)}(symbol "${esc(symName)}" (pin_names (offset 0.254)) (in_bom yes) (on_board yes)`);

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

    // Sub-symbol unit 0: the body rectangle
    lines.push(`${ind(3)}(symbol "${esc(symName)}_0_1"`);
    lines.push(`${ind(4)}(rectangle (start ${num(-halfW)} ${num(halfH)}) (end ${num(halfW)} ${num(-halfH)}) (stroke (width 0) (type default)) (fill (type background)))`);
    lines.push(`${ind(3)})`);

    // Sub-symbol _1_1: the pins
    lines.push(`${ind(3)}(symbol "${esc(symName)}_1_1"`);
    part.connectors.forEach(function emitSymbolPin(conn, connIdx) {
      if (connIdx >= placements.length) return;
      const pl = placements[connIdx];
      const pinType = guessPinType(conn, part.meta);

      lines.push(
        `${ind(4)}(pin ${pinType} line (at ${num(pl.x)} ${num(pl.y)} ${pl.rotation}) (length ${num(PIN_LENGTH)})` +
        ` (name "${esc(conn.name)}" (effects (font (size ${FONT_SIZE} ${FONT_SIZE}))))` +
        ` (number "${esc(conn.id)}" (effects (font (size ${FONT_SIZE} ${FONT_SIZE})))))`,
      );
    });
    lines.push(`${ind(3)})`);

    lines.push(`${ind(2)})`);
  });

  lines.push(`${ind(1)})`);
  return lines.join('\n');
}

/** Generates the symbol instances section: one placed symbol per instance. */
export function generateSchematicSymbolInstances(input: KicadInput): string {
  const lines: string[] = [];

  input.instances.forEach(function emitSchematicSymbol(inst) {
    const part = inst.partId != null ? input.parts.get(inst.partId) : undefined;
    if (!part) return;

    const title = extractTitle(part.meta);
    const value = extractPartValue(part.meta);
    const footprint = extractFootprint(part.meta);
    const symName = `PP:${sanitizeSymbolName(title)}_${inst.partId}`;
    const uuid = deterministicUuid(input.circuit.id, inst.id);

    const x = inst.schematicX * SCHEMATIC_SCALE;
    const y = inst.schematicY * SCHEMATIC_SCALE;
    const rot = normalizeAngle(inst.schematicRotation);

    lines.push(`${ind(1)}(symbol (lib_id "${esc(symName)}") (at ${num(x)} ${num(y)} ${num(rot)})`);
    lines.push(`${ind(2)}(uuid "${uuid}")`);
    lines.push(`${ind(2)}(property "Reference" "${esc(inst.referenceDesignator)}" (at ${num(x)} ${num(y + 2)} 0) (effects (font (size ${FONT_SIZE} ${FONT_SIZE}))))`);
    lines.push(`${ind(2)}(property "Value" "${esc(value || title)}" (at ${num(x)} ${num(y - 2)} 0) (effects (font (size ${FONT_SIZE} ${FONT_SIZE}))))`);
    lines.push(`${ind(2)}(property "Footprint" "${esc(footprint)}" (at ${num(x)} ${num(y - 4)} 0) (effects (font (size ${FONT_SIZE} ${FONT_SIZE})) hide))`);

    lines.push(`${ind(2)}(instances`);
    lines.push(`${ind(3)}(project "${esc(input.circuit.name)}"`);
    lines.push(`${ind(4)}(path "/${uuid}" (reference "${esc(inst.referenceDesignator)}") (unit 1))`);
    lines.push(`${ind(3)})`);
    lines.push(`${ind(2)})`);

    lines.push(`${ind(1)})`);
  });

  return lines.join('\n');
}

/**
 * Generates schematic wire segments from the input wires array.
 * Only wires in the 'schematic' view are included.
 */
export function generateSchematicWires(input: KicadInput): string {
  const lines: string[] = [];

  input.wires.forEach(function emitSchematicWire(wire) {
    if (wire.view !== 'schematic') return;
    if (wire.points.length < 2) return;

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
        ` (uuid "${deterministicUuid(input.circuit.id, wire.netId, i)}"))`,
      );
    }
  });

  return lines.join('\n');
}

/** Generates the complete .kicad_sch file content. */
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

  lines.push(generateLibSymbols(input));
  lines.push('');

  lines.push(generateSchematicSymbolInstances(input));
  lines.push('');

  const wiresSection = generateSchematicWires(input);
  if (wiresSection) {
    lines.push(wiresSection);
    lines.push('');
  }

  lines.push(`${ind(1)}(sheet_instances`);
  lines.push(`${ind(2)}(path "/" (page "1"))`);
  lines.push(`${ind(1)})`);

  lines.push(')');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Legacy architecture-graph schematic (used by ai-tools + export-generators)
// ---------------------------------------------------------------------------

export function generateKicadSch(
  nodes: ArchNodeData[],
  edges: ArchEdgeData[],
  projectName: string,
): ExportResult {
  const uuid = () => crypto.randomUUID();
  const schUuid = uuid();

  // Scale factor: architecture positions are in logical units, KiCad uses mils
  const SCALE = 2.54; // 1 unit → 2.54 mm (100 mil grid)

  const nodePositions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    nodePositions.set(node.nodeId, {
      x: node.positionX * SCALE,
      y: node.positionY * SCALE,
    });
  }

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

  const wires = edges
    .map((edge) => {
      const src = nodePositions.get(edge.source);
      const tgt = nodePositions.get(edge.target);
      if (!src || !tgt) return null;
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
