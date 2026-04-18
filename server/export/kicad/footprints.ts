// =============================================================================
// KiCad Exporter — PCB footprint + placement emission
// =============================================================================

import { deterministicUuid, esc, ind, normalizeAngle, num, sanitizeSymbolName } from './sexpr';
import {
  extractFootprint,
  extractMountingType,
  extractPartValue,
  extractTitle,
  mapCopperLayer,
  mapSilkLayer,
} from './meta';
import { makePinKey, type NetInfo, type PinKey } from './netlist';
import {
  DEFAULT_SMD_PAD_HEIGHT,
  DEFAULT_SMD_PAD_WIDTH,
  DEFAULT_THT_DRILL,
  DEFAULT_THT_PAD_SIZE,
  type KicadInput,
} from './types';

/**
 * Generates a single footprint for a component instance on the PCB.
 *
 * Produces a minimal footprint with:
 *   - Reference and value text on the silkscreen layer
 *   - A courtyard rectangle around the component
 *   - Pads for each connector (THT pads for tht, SMD pads for smd)
 *   - Fabrication layer outline
 *
 * Placement (pcbX/pcbY/pcbRotation/pcbSide) is applied at the footprint's
 * origin; pads are laid out relative to that origin.
 */
export function generatePcbFootprint(
  inst: KicadInput['instances'][number],
  part: {
    meta: Record<string, unknown>;
    connectors: Array<{ id: string; name: string; padType?: string }>;
  },
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
  const padPitch = 2.54;
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
    // Two-terminal component: pads at ends
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
          `${netStr})`,
        );
      } else {
        const padShape = connIdx === 0 ? 'rect' : 'circle';
        lines.push(
          `${ind(2)}(pad "${esc(conn.id)}" thru_hole ${padShape} (at ${num(padX)} ${num(padY)})` +
          ` (size ${DEFAULT_THT_PAD_SIZE} ${DEFAULT_THT_PAD_SIZE}) (drill ${DEFAULT_THT_DRILL})` +
          ` (layers "*.Cu" "*.Mask")` +
          `${netStr})`,
        );
      }
    });
  } else {
    // Multi-pin component: DIP-like dual-row layout
    const leftCount = Math.ceil(pinCount / 2);

    part.connectors.forEach(function emitDipPad(conn, connIdx) {
      const isSmd = mounting === 'smd' || conn.padType === 'smd';
      let padX: number;
      let padY: number;

      if (connIdx < leftCount) {
        padX = -halfW + 0.5;
        padY = -halfH + 0.5 + connIdx * padPitch;
      } else {
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
          `${netStr})`,
        );
      } else {
        const padShape = connIdx === 0 ? 'rect' : 'circle';
        lines.push(
          `${ind(2)}(pad "${esc(conn.id)}" thru_hole ${padShape} (at ${num(padX)} ${num(padY)})` +
          ` (size ${DEFAULT_THT_PAD_SIZE} ${DEFAULT_THT_PAD_SIZE}) (drill ${DEFAULT_THT_DRILL})` +
          ` (layers "*.Cu" "*.Mask")` +
          `${netStr})`,
        );
      }
    });
  }

  lines.push(`${ind(1)})`);
  return lines.join('\n');
}
