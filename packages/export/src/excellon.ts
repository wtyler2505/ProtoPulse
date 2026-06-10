import { compareRefs } from './kicad-netlist.js';
import { applyPcbPlacement, formatMm3 } from './pcb-common.js';

import type { DesignGraph, Vec } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

/**
 * Standard Excellon drill file: M48 header, METRIC, tool table deduped
 * and sorted by diameter (T1C0.300 …), coordinates in mm 3.3 fixed
 * format, M30 end. Holes come from through-hole pad drills and via
 * drills; hit order within a tool is sorted by (type, entity ref/id,
 * pad index) so output is byte-deterministic. The date is injected.
 */

export interface ExcellonOpts {
  /** ISO timestamp recorded in the header comment. */
  date: string;
}

interface Hit {
  type: 0 | 1; // 0 = through-hole pad, 1 = via
  entity: string; // component ref / via id
  index: number; // pad index within the footprint; 0 for vias
  drillNm: number;
  at: Vec;
}

export function exportExcellon(graph: DesignGraph, parts: PartDb, opts: ExcellonOpts): string {
  const hits: Hit[] = [];

  // Through-hole pads. Holes are drilled whether or not the part is
  // populated, so DNP does not filter here.
  for (const [componentId, placement] of graph.pcb.placements) {
    const comp = graph.components.get(componentId);
    if (!comp) continue;
    const footprint = parts.get(comp.partId, comp.partRev)?.footprint;
    if (!footprint) continue;
    footprint.pads.forEach((pad, index) => {
      if (pad.drillNm === undefined) return;
      hits.push({
        type: 0,
        entity: comp.ref,
        index,
        drillNm: pad.drillNm,
        at: applyPcbPlacement(pad.at, placement),
      });
    });
  }

  for (const via of graph.pcb.vias.values()) {
    hits.push({ type: 1, entity: via.id, index: 0, drillNm: via.drillNm, at: via.at });
  }

  hits.sort((a, b) => a.type - b.type || compareRefs(a.entity, b.entity) || a.index - b.index);

  // Tool table: unique diameters, ascending.
  const diameters = [...new Set(hits.map((h) => h.drillNm))].sort((a, b) => a - b);
  const toolOf = new Map<number, number>();
  diameters.forEach((d, i) => toolOf.set(d, i + 1));

  const lines: string[] = [
    'M48',
    '; ProtoPulse drill file',
    `; Created: ${opts.date}`,
    'METRIC',
  ];
  for (const d of diameters) {
    lines.push(`T${String(toolOf.get(d))}C${formatMm3(d)}`);
  }
  lines.push('%', 'G90', 'G05');
  for (const d of diameters) {
    lines.push(`T${String(toolOf.get(d))}`);
    for (const hit of hits) {
      if (hit.drillNm !== d) continue;
      lines.push(`X${formatMm3(hit.at.x)}Y${formatMm3(hit.at.y)}`);
    }
  }
  lines.push('M30');
  return lines.join('\n') + '\n';
}
