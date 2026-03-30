// =============================================================================
// Gerber Copper Layer Generator
// =============================================================================

import { buildApertures, padApertureKey, traceApertureKey, viaApertureKey } from './apertures';
import { fmtCoord } from './coordinates';
import { filterPadsForCopper, filterWiresForSide } from './filters';
import { gerberApertureDefs, gerberFooter, gerberHeader } from './format';
import { resolveAllPads } from './pad-resolver';
import type { GerberInput } from './types';

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
