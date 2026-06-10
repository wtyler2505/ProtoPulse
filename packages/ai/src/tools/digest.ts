import { parsePortRef } from '@protopulse/graph';

import type { ToolCtx } from '../registry.js';
import type { DesignGraph } from '@protopulse/graph';

/**
 * The cheap read_design digest, shared by every persona whose first move
 * is "look at the design" (the Analyst and the Professor both expose a
 * read_design tool over it). One implementation, one shape.
 */

export interface DesignDigest {
  components: string[];
  nets: string[];
  constraints: string[];
}

export function designDigest(ctx: ToolCtx): DesignDigest {
  const graph: DesignGraph = ctx.graph;
  const refOf = new Map([...graph.components.values()].map((c) => [c.id, c.ref]));

  const components = [...graph.components.values()]
    .sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0))
    .map((c) => {
      const part = ctx.parts.get(c.partId, c.partRev);
      return `${c.ref} ${c.value ?? ''} ${part?.name ?? c.partId}${c.dnp ? ' (DNP)' : ''}`.replace(/\s+/g, ' ');
    });

  const nets = [...graph.nets.values()]
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((n) => {
      const members = n.ports
        .map((p) => {
          const { componentId, pinKey } = parsePortRef(p);
          return `${refOf.get(componentId) ?? componentId}:${pinKey}`;
        })
        .sort();
      return `${n.name}: ${members.join(', ')}`;
    });

  const constraints = [...graph.constraints.values()].map((c) => {
    const body = c.body;
    const why = c.rationale ? ` — ${c.rationale}` : '';
    if (body.kind === 'current_max') {
      const netName = graph.nets.get(body.netId)?.name ?? body.netId;
      return `current_max on ${netName}: ${String(body.amps)}A${why}`;
    }
    return `${body.kind}${why}`;
  });

  return { components, nets, constraints };
}

/** One-line summary used by read_design tool results. */
export function digestSummary(digest: DesignDigest): string {
  return `${String(digest.components.length)} component(s), ${String(digest.nets.length)} net(s), ${String(digest.constraints.length)} constraint(s)`;
}
