import { applyOp, cloneGraph } from '@protopulse/graph';

import { runAgentLoop } from './agent.js';
import { createRouterRegistry } from './tools/router.js';

import type { AgentEvent, LlmProvider, ProviderMessage } from './provider.js';
import type { RouterHooks } from './route-types.js';
import type { DesignGraph, OpBody, OpEnvelope } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

/**
 * The Router — fourth crew member, on the shared agent loop. Copper is
 * geometry to it: it reads the ratsnest, routes connection by
 * connection (walk first, shove when cornered), and refuses to call a
 * board done until DRC agrees. Like the Draftsman it works on a CLONE;
 * applied ops come back as envelopes with meta {agent: 'router'} so
 * blame works the moment they land in the session.
 */

export interface RunRouterOptions {
  prompt: string;
  graph: DesignGraph;
  parts: PartDb;
  provider: LlmProvider;
  /** The real routing stack, wired by the host (tests pass fakes). */
  hooks: RouterHooks;
  onEvent?: (ev: AgentEvent) => void;
  confirmDestructive?: (explain: string) => Promise<boolean> | boolean;
  maxTurns?: number;
  actor?: string;
}

export interface RouterResult {
  ops: OpBody[];
  envelopes: OpEnvelope[];
  transcript: ProviderMessage[];
  finalText: string;
}

const ROUTER_PERSONA =
  'You are the Router: copper is geometry, clearance is law, and the ratsnest is a to-do list. ' +
  'You route boards through tools — never by describing routes in prose.';

function buildRouterSystemPrompt(graph: DesignGraph, hooks: RouterHooks): string {
  const unrouted = hooks.ratsnest(graph).length;
  return [
    ROUTER_PERSONA,
    '',
    'STRICT RULES:',
    '- Call read_board BEFORE routing anything, and again after — the ratsnest is the truth.',
    '- Route one connection at a time. Try mode "walk" first; if walk reports no corridor,',
    '  try "shove". If both refuse, say so plainly — never pretend a connection is routed.',
    '- A net can need several route_connection calls (one per ratsnest entry on that net).',
    '- When the ratsnest is empty, run run_drc and report its counts honestly. A board with',
    '  DRC errors is NOT done — fix what you can (remove_trace + re-route) and report the rest.',
    '- Pads and vias never move. Component placement is not yours to change.',
    '',
    `Board right now: ${String(graph.pcb.placements.size)} footprint(s), ${String(graph.pcb.traces.size)} trace(s), ${String(unrouted)} unrouted connection(s).`,
  ].join('\n');
}

export async function runRouter(opts: RunRouterOptions): Promise<RouterResult> {
  const {
    prompt,
    parts,
    provider,
    hooks,
    onEvent,
    confirmDestructive,
    maxTurns = 12,
    actor = 'agent:router',
  } = opts;

  const working = cloneGraph(opts.graph);
  const appliedOps: OpBody[] = [];
  const envelopes: OpEnvelope[] = [];
  let lamport = 0;

  const registry = createRouterRegistry(hooks);

  const loop = await runAgentLoop({
    prompt,
    provider,
    registry,
    onEvent,
    confirmDestructive,
    maxTurns,
    buildSystem: () => buildRouterSystemPrompt(working, hooks),
    getCtx: () => ({ graph: working, parts }),
    commit: (result, rationale) => {
      // Transactional like the Draftsman: all of this call's ops or none.
      const draft = cloneGraph(working);
      for (const op of result.ops) {
        const res = applyOp(draft, op);
        if (!res.ok) return `op apply failed: ${res.error}`;
      }
      Object.assign(working, draft);
      for (const op of result.ops) {
        appliedOps.push(op);
        lamport += 1;
        envelopes.push({
          actor,
          lamport,
          ts: Date.now(),
          op,
          meta: { agent: 'router', rationale },
        });
      }
      return undefined;
    },
  });

  return { ops: appliedOps, envelopes, transcript: loop.transcript, finalText: loop.finalText };
}
