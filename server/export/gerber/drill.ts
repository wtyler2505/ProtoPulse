// =============================================================================
// Excellon Drill File Generator
// =============================================================================

import { mmToExcellon } from './coordinates';
import { resolveAllPads } from './pad-resolver';
import type { DrillHit, GerberInput } from './types';

/**
 * Generate an Excellon drill file for all through-hole pads.
 *
 * Format: FMAT,2 with METRIC,TZ (trailing zeros).
 * Coordinates are in integer micrometers (mm * 1000).
 */
export function generateDrillFile(input: GerberInput): string {
  const allPads = resolveAllPads(input.instances);
  const vias = input.vias ?? [];

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

  // Collect drill hits from vias
  for (let i = 0; i < vias.length; i++) {
    const via = vias[i];
    drillHits.push({
      x: via.x,
      y: via.y,
      diameter: via.drillDiameter,
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
  toolMap.forEach(function collectDiameterKeys(_hits, key) {
    toolDiameters.push(key);
  });
  toolDiameters.sort(function sortAscending(a, b) { return a - b; });

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
