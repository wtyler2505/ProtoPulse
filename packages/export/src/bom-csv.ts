import { compareRefs } from './kicad-netlist.js';

import type { DesignGraph } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

/**
 * CSV BOM, grouped by (partId, value). RFC 4180 quoting; deterministic
 * row order (group refs sorted naturally, groups by first ref).
 */
function csvField(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportBomCsv(graph: DesignGraph, parts: PartDb): string {
  interface Group {
    refs: string[];
    value: string;
    partName: string;
    mpn: string;
    dnp: boolean;
  }
  const groups = new Map<string, Group>();

  for (const comp of graph.components.values()) {
    const part = parts.get(comp.partId, comp.partRev);
    const value = comp.value ?? '';
    const key = `${comp.partId}@${String(comp.partRev)}|${value}|${String(comp.dnp)}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        refs: [],
        value,
        partName: part?.name ?? comp.partId,
        mpn: part?.mpn ?? '',
        dnp: comp.dnp,
      };
      groups.set(key, group);
    }
    group.refs.push(comp.ref);
  }

  const rows = [...groups.values()];
  for (const g of rows) g.refs.sort(compareRefs);
  rows.sort((a, b) => compareRefs(a.refs[0] ?? '', b.refs[0] ?? ''));

  const lines = ['Refs,Qty,Value,Part,MPN,DNP'];
  for (const g of rows) {
    lines.push(
      [
        csvField(g.refs.join(' ')),
        String(g.refs.length),
        csvField(g.value),
        csvField(g.partName),
        csvField(g.mpn),
        g.dnp ? 'DNP' : '',
      ].join(','),
    );
  }
  return lines.join('\r\n') + '\r\n';
}
