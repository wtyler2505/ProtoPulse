import { z } from 'zod';

import { ToolRegistry } from '../registry.js';

import type { ToolResult } from '../registry.js';
import type { RouterHooks } from '../route-types.js';
import type { DesignGraph } from '@protopulse/graph';

/**
 * The Router's 4 tools. Engines are DEPENDENCY-INJECTED (RouterHooks):
 * the app wires the real walkaround/shove/DRC stack in, tests pass
 * fakes. A refused route (blocked corridor, unshovable victim) is a
 * thrown domain error — the loop surfaces it as a tool_result error and
 * the model adapts (tries shove, another layer, or reports honestly).
 */

const MM = 1_000_000;

function mm(nm: number): string {
  return `${(nm / MM).toFixed(2)}mm`;
}

export const ROUTER_TOOLS = ['read_board', 'route_connection', 'run_drc', 'remove_trace'] as const;

function boardDigest(graph: DesignGraph, hooks: RouterHooks): {
  summary: string;
  data: Record<string, unknown>;
} {
  const placements = [...graph.pcb.placements.entries()]
    .map(([componentId, p]) => {
      const ref = graph.components.get(componentId)?.ref ?? componentId;
      return { ref, side: p.side, x: mm(p.at.x), y: mm(p.at.y), rotMilli: p.rotMilli };
    })
    .sort((a, b) => (a.ref < b.ref ? -1 : 1));
  const tracesByNet = new Map<string, number>();
  for (const t of graph.pcb.traces.values()) {
    tracesByNet.set(t.netId, (tracesByNet.get(t.netId) ?? 0) + 1);
  }
  const traces = [...tracesByNet.entries()]
    .map(([netId, count]) => ({ net: graph.nets.get(netId)?.name ?? netId, count }))
    .sort((a, b) => (a.net < b.net ? -1 : 1));
  const unrouted = hooks.ratsnest(graph).map((pair) => ({
    net: pair.netName,
    from: pair.a.label,
    to: pair.b.label,
    spanMm: (Math.hypot(pair.b.x - pair.a.x, pair.b.y - pair.a.y) / MM).toFixed(2),
  }));
  return {
    summary: `${String(placements.length)} footprint(s), ${String(graph.pcb.traces.size)} trace(s), ${String(graph.pcb.vias.size)} via(s); ${String(unrouted.length)} unrouted connection(s)`,
    data: { placements, traces, vias: graph.pcb.vias.size, unrouted },
  };
}

export function createRouterRegistry(hooks: RouterHooks): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register({
    name: 'read_board',
    description:
      'Read the board state: placed footprints (ref, side, position), routed traces by net, vias, and every unrouted connection (the ratsnest) with its endpoints and air-line length. Call this first, and again after routing to see what remains.',
    schema: z.object({}),
    destructive: false,
    costClass: 'cheap',
    execute: (_input, ctx): ToolResult => {
      const digest = boardDigest(ctx.graph, hooks);
      return { ops: [], data: digest.data, summary: digest.summary };
    },
    explain: () => 'read the board state and ratsnest',
  });

  registry.register({
    name: 'route_connection',
    description:
      'Route ONE unrouted connection of a net on the board. mode "walk" auto-detours around copper at deck clearance (preferred first); mode "shove" routes straight and pushes blocking traces aside (use when walk reports no corridor). Refusals come back as errors with the reason — adapt or report honestly.',
    schema: z.object({
      net: z.string().min(1).describe('Net name (e.g. "LED_A") or net id'),
      mode: z.enum(['walk', 'shove']).describe('walk = detour around copper; shove = push traces aside'),
      layerId: z.enum(['F.Cu', 'B.Cu']).optional().describe('Copper layer, default F.Cu'),
      widthMm: z.number().positive().optional().describe('Trace width in mm; default is the house width'),
    }),
    destructive: true,
    costClass: 'standard',
    execute: (input, ctx): ToolResult => {
      const net =
        [...ctx.graph.nets.values()].find((n) => n.name === input.net) ??
        ctx.graph.nets.get(input.net);
      if (!net) throw new Error(`no net named "${input.net}" — read_board lists net names`);
      const outcome = hooks.route(ctx.graph, {
        netId: net.id,
        mode: input.mode,
        layerId: input.layerId ?? 'F.Cu',
        ...(input.widthMm !== undefined ? { widthNm: Math.round(input.widthMm * MM) } : {}),
      });
      if (!outcome.ok) throw new Error(outcome.reason);
      return { ops: outcome.ops, summary: outcome.summary };
    },
    explain: (input) =>
      `route one ${input.net} connection (${input.mode}${input.layerId ? `, ${input.layerId}` : ''})`,
  });

  registry.register({
    name: 'run_drc',
    description:
      'Run the design-rule check against the rule deck. Returns findings (severity, code, message). Run this after routing — a board is not done until DRC says so.',
    schema: z.object({}),
    destructive: false,
    costClass: 'standard',
    execute: async (_input, ctx): Promise<ToolResult> => {
      const findings = await hooks.drc(ctx.graph);
      const errors = findings.filter((f) => f.severity === 'error').length;
      const warns = findings.filter((f) => f.severity === 'warn').length;
      return {
        ops: [],
        data: { findings },
        summary: `DRC: ${String(errors)} error(s), ${String(warns)} warning(s)`,
      };
    },
    explain: () => 'run DRC against the rule deck',
  });

  registry.register({
    name: 'remove_trace',
    description: 'Remove a routed trace by id (to undo a routing mistake before re-routing).',
    schema: z.object({ traceId: z.string().min(1).describe('Trace id from the board state') }),
    destructive: true,
    costClass: 'cheap',
    execute: (input, ctx): ToolResult => {
      if (!ctx.graph.pcb.traces.has(input.traceId)) {
        throw new Error(`no trace with id "${input.traceId}"`);
      }
      return {
        ops: [{ kind: 'remove_trace', id: input.traceId }],
        summary: `removed trace ${input.traceId}`,
      };
    },
    explain: (input) => `remove trace ${input.traceId}`,
  });

  return registry;
}
