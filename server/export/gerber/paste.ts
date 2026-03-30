// =============================================================================
// Gerber Solder Paste Layer Generator
// =============================================================================

import { buildApertures, padApertureKey } from './apertures';
import { fmtCoord } from './coordinates';
import { filterSmdPadsForSide } from './filters';
import { gerberApertureDefs, gerberFooter, gerberHeader } from './format';
import { resolveAllPads } from './pad-resolver';
import type { GerberInput } from './types';

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
