import { applyOp, cloneGraph } from '@protopulse/graph';

import { runAgentLoop } from './agent.js';
import { createBuyerRegistry } from './tools/buyer.js';

import type { AgentEvent, LlmProvider, ProviderMessage } from './provider.js';
import type { CatalogLike } from './tools/buyer.js';
import type { DesignGraph, OpBody, OpEnvelope } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

/**
 * The Buyer — sixth crew member, completing the crew. The BOM is its
 * ledger and the catalog is a rev-stamped snapshot it is honest about:
 * verified part numbers and assembly classes, never prices or stock.
 * Like every crew member it works on a CLONE; applied ops come back as
 * envelopes with meta {agent: 'buyer'} so blame works the moment they
 * land in the session.
 */

export interface RunBuyerOptions {
  prompt: string;
  graph: DesignGraph;
  parts: PartDb;
  provider: LlmProvider;
  /** The sourcing catalog (rev-stamped snapshot, injected data). */
  catalog: CatalogLike;
  onEvent?: (ev: AgentEvent) => void;
  confirmDestructive?: (explain: string) => Promise<boolean> | boolean;
  maxTurns?: number;
  actor?: string;
}

export interface BuyerResult {
  ops: OpBody[];
  envelopes: OpEnvelope[];
  transcript: ProviderMessage[];
  finalText: string;
}

const BUYER_PERSONA =
  'You are the Buyer: the BOM is your ledger. You know what the catalog snapshot verified — ' +
  'part numbers and assembly classes — and you NEVER invent prices, stock counts, or lead ' +
  'times. You source designs through tools, and every assignment is a reviewable op.';

function buildBuyerSystemPrompt(graph: DesignGraph, catalog: CatalogLike): string {
  return [
    BUYER_PERSONA,
    '',
    'STRICT RULES:',
    '- Call read_bom BEFORE sourcing anything, and sourcing_report after — verify what landed.',
    `- The catalog is the ${catalog.vendor} ${catalog.rev} SNAPSHOT. Classification drifts and`,
    '  stock changes hourly — when it matters, tell the user to verify at order time.',
    '- Bias toward basic-class parts: extended parts each add a per-reel setup fee. Say which',
    '  lines are extended and why, in classes — never in invented dollar amounts.',
    "- An offer's package may differ from the design's footprint — surface the mismatch.",
    '- A line with no catalog offer stays unsourced, said plainly. Never fabricate a part number.',
    '',
    `Design right now: ${String(graph.components.size)} component(s). Catalog: ${String(catalog.entries.length)} verified offer(s).`,
  ].join('\n');
}

export async function runBuyer(opts: RunBuyerOptions): Promise<BuyerResult> {
  const {
    prompt,
    parts,
    provider,
    catalog,
    onEvent,
    confirmDestructive,
    maxTurns = 12,
    actor = 'agent:buyer',
  } = opts;

  const working = cloneGraph(opts.graph);
  const appliedOps: OpBody[] = [];
  const envelopes: OpEnvelope[] = [];
  let lamport = 0;

  const registry = createBuyerRegistry(catalog);

  const loop = await runAgentLoop({
    prompt,
    provider,
    registry,
    onEvent,
    confirmDestructive,
    maxTurns,
    buildSystem: () => buildBuyerSystemPrompt(working, catalog),
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
          meta: { agent: 'buyer', rationale },
        });
      }
      return undefined;
    },
  });

  return { ops: appliedOps, envelopes, transcript: loop.transcript, finalText: loop.finalText };
}
