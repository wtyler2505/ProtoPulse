// =============================================================================
// Gerber Soldermask Layer Generator
// =============================================================================

import { buildApertures, padApertureKey, viaApertureKey } from './apertures';
import { fmtCoord } from './coordinates';
import { filterPadsForCopper } from './filters';
import { gerberApertureDefs, gerberFooter, gerberHeader } from './format';
import { resolveAllPads } from './pad-resolver';
import type { GerberInput } from './types';
import { SOLDERMASK_CLEARANCE } from './types';

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
