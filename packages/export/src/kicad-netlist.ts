import type { DesignGraph } from '@protopulse/graph';
import { parsePortRef } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';
import { escapeKicad } from './sexpr.js';

/**
 * KiCad legacy-E S-expression netlist — the format pcbnew's
 * "Import Netlist" accepts. Shape mirrors the known-good legacy emitter,
 * with its two determinism sins fixed: the date is injected (never
 * `new Date()`), and emission order is sorted (components by natural
 * ref order, nets by name) so golden files are byte-exact.
 */
export interface KicadNetlistOpts {
  /** ISO timestamp recorded in the design block. */
  date: string;
  source?: string;
  tool?: string;
}

/** Natural ref sort: R2 before R10, U1 before U10. */
export function compareRefs(a: string, b: string): number {
  const re = /^([A-Za-z$_]*)(\d*)$/;
  const ma = re.exec(a);
  const mb = re.exec(b);
  const prefixA = ma?.[1] ?? a;
  const prefixB = mb?.[1] ?? b;
  if (prefixA !== prefixB) return prefixA < prefixB ? -1 : 1;
  const numA = ma?.[2] ? Number(ma[2]) : Number.NaN;
  const numB = mb?.[2] ? Number(mb[2]) : Number.NaN;
  if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) return numA - numB;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function exportKicadNetlist(
  graph: DesignGraph,
  parts: PartDb,
  opts: KicadNetlistOpts,
): string {
  const components = [...graph.components.values()]
    .filter((c) => !c.dnp)
    .sort((a, b) => compareRefs(a.ref, b.ref));

  const compBlocks = components.map((comp) => {
    const part = parts.get(comp.partId, comp.partRev);
    const value = comp.value ?? part?.name ?? comp.ref;
    const footprint = comp.fields['footprint'] ?? 'Unknown:Unknown';
    const datasheet = part?.datasheetUrl ?? '~';
    return `    (comp (ref "${escapeKicad(comp.ref)}")
      (value "${escapeKicad(value)}")
      (footprint "${escapeKicad(footprint)}")
      (datasheet "${escapeKicad(datasheet)}")
    )`;
  });

  const dnpIds = new Set(
    [...graph.components.values()].filter((c) => c.dnp).map((c) => c.id),
  );

  const nets = [...graph.nets.values()].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );

  const netBlocks: string[] = [];
  let code = 0;
  for (const net of nets) {
    const nodes: { ref: string; pin: string }[] = [];
    for (const port of net.ports) {
      const { componentId, pinKey } = parsePortRef(port);
      if (dnpIds.has(componentId)) continue;
      const comp = graph.components.get(componentId);
      if (!comp) continue;
      nodes.push({ ref: comp.ref, pin: pinKey });
    }
    if (nodes.length === 0) continue;
    code += 1;
    nodes.sort((a, b) => compareRefs(a.ref, b.ref) || (a.pin < b.pin ? -1 : a.pin > b.pin ? 1 : 0));
    const nodeLines = nodes.map(
      (n) => `      (node (ref "${escapeKicad(n.ref)}") (pin "${escapeKicad(n.pin)}"))`,
    );
    netBlocks.push(
      `    (net (code ${String(code)}) (name "${escapeKicad(net.name)}")
${nodeLines.join('\n')}
    )`,
    );
  }

  return `(export (version "E")
  (design
    (source "${escapeKicad(opts.source ?? 'ProtoPulse')}")
    (date "${escapeKicad(opts.date)}")
    (tool "${escapeKicad(opts.tool ?? 'ProtoPulse Export')}")
  )
  (components
${compBlocks.join('\n')}
  )
  (nets
    (net (code 0) (name ""))
${netBlocks.join('\n')}
  )
)
`;
}
