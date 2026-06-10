import { MM, parsePortRef   } from '@protopulse/graph';

import type { Finding } from '@protopulse/erc';
import type {DesignGraph, OpEnvelope} from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

/**
 * Context assembler — budgeted sections, chars as a token proxy
 * (~4 chars/token). Output is deterministic: stable sort orders, explicit
 * truncation markers when a section hits its budget.
 */

const COMPONENTS_BUDGET = 8_000;
const NETS_BUDGET = 8_000;
const FINDINGS_BUDGET = 6_000;
const OPS_BUDGET = 6_000;

export const CONTEXT_BUDGETS = {
  components: COMPONENTS_BUDGET,
  nets: NETS_BUDGET,
  findings: FINDINGS_BUDGET,
  recentOps: OPS_BUDGET,
} as const;

/** Join lines until the char budget is hit; mark what was dropped. */
function capLines(lines: string[], budget: number): string {
  const out: string[] = [];
  let used = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    if (used + line.length + 1 > budget) {
      out.push(`… [${String(lines.length - i)} more truncated]`);
      return out.join('\n');
    }
    out.push(line);
    used += line.length + 1;
  }
  return out.join('\n');
}

function mm(nm: number): string {
  return (nm / MM).toFixed(1);
}

export function assembleContext(
  graph: DesignGraph,
  parts: PartDb,
  findings: Finding[],
  recentOps: OpEnvelope[],
  focusRefs?: string[],
): string {
  // ── Design digest: components ──
  const comps = [...graph.components.values()].sort((a, b) =>
    a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0,
  );
  const focus = new Set(focusRefs ?? []);
  if (focus.size > 0) {
    // Focused refs sort first, otherwise stable by ref.
    comps.sort((a, b) => {
      const fa = focus.has(a.ref) ? 0 : 1;
      const fb = focus.has(b.ref) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0;
    });
  }
  const componentLines = comps.map((c) => {
    const part = parts.get(c.partId, c.partRev);
    const placement = graph.schematic.placements.get(c.id);
    const where = placement ? `@ (${mm(placement.at.x)}, ${mm(placement.at.y)})mm` : '(unplaced)';
    return `${c.ref} ${c.value ?? ''} ${part?.name ?? c.partId} ${where}`.replace(/\s+/g, ' ');
  });

  // ── Design digest: nets ──
  const refOfComponent = new Map([...graph.components.values()].map((c) => [c.id, c.ref]));
  const nets = [...graph.nets.values()].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  const netLines = nets.map((n) => {
    const members = n.ports
      .map((p) => {
        const { componentId, pinKey } = parsePortRef(p);
        return `${refOfComponent.get(componentId) ?? componentId}:${pinKey}`;
      })
      .sort();
    return `${n.name}: ${members.join(', ')}`;
  });

  // ── Open ERC findings ──
  const findingLines = findings.map(
    (f) => `[${f.severity.toUpperCase()}] ${f.code}: ${f.message}`,
  );

  // ── Recent ops, latest first, with rationales ──
  const opLines = [...recentOps]
    .reverse()
    .map((env) => {
      const label = env.op.kind === 'batch' ? `batch "${env.op.label}"` : env.op.kind;
      const who = env.meta?.agent ? ` by ${env.meta.agent}` : '';
      const why = env.meta?.rationale ? ` — ${env.meta.rationale}` : '';
      return `${label}${who}${why}`;
    });

  const sections = [
    `## Design digest`,
    `${String(comps.length)} component(s), ${String(nets.length)} net(s).`,
    ``,
    `### Components`,
    componentLines.length > 0 ? capLines(componentLines, COMPONENTS_BUDGET) : '(none)',
    ``,
    `### Nets`,
    netLines.length > 0 ? capLines(netLines, NETS_BUDGET) : '(none)',
    ``,
    `## Open ERC findings`,
    findingLines.length > 0 ? capLines(findingLines, FINDINGS_BUDGET) : '(none)',
    ``,
    `## Recent operations (latest first)`,
    opLines.length > 0 ? capLines(opLines, OPS_BUDGET) : '(none)',
  ];
  return sections.join('\n');
}
