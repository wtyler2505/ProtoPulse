import { compareRefs } from './kicad-netlist.js';
import { formatDeg, formatMm } from './pcb-common.js';

import type { DesignGraph } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

/**
 * Pick-and-place CSV: one row per placed, non-DNP component, sorted by
 * natural ref order. Positions in mm (6dp, trailing zeros stripped),
 * rotation in degrees, side top/bottom. RFC 4180 quoting, CRLF rows —
 * same CSV conventions as the BOM exporter.
 */
function csvField(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportPickPlace(graph: DesignGraph, parts: PartDb): string {
  interface Row {
    ref: string;
    val: string;
    pkg: string;
    posX: string;
    posY: string;
    rot: string;
    side: string;
  }
  const rows: Row[] = [];

  for (const [componentId, placement] of graph.pcb.placements) {
    const comp = graph.components.get(componentId);
    if (!comp || comp.dnp) continue;
    const part = parts.get(comp.partId, comp.partRev);
    rows.push({
      ref: comp.ref,
      val: comp.value ?? '',
      pkg: part?.name ?? comp.partId,
      posX: formatMm(placement.at.x),
      posY: formatMm(placement.at.y),
      rot: formatDeg(placement.rotMilli),
      side: placement.side,
    });
  }

  rows.sort((a, b) => compareRefs(a.ref, b.ref));

  const lines = ['Ref,Val,Package,PosX,PosY,Rot,Side'];
  for (const r of rows) {
    lines.push(
      [csvField(r.ref), csvField(r.val), csvField(r.pkg), r.posX, r.posY, r.rot, r.side].join(','),
    );
  }
  return lines.join('\r\n') + '\r\n';
}
