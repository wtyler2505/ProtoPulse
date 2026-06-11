import { applyOp, cloneGraph } from '@protopulse/graph';

import { runAgentLoop } from './agent.js';
import { createArchitectRegistry } from './tools/architect.js';

import type { AgentEvent, LlmProvider, ProviderMessage } from './provider.js';
import type { DesignGraph, OpBody, OpEnvelope } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

/**
 * The Architect — fifth crew member, on the shared agent loop. Where the
 * Draftsman draws and the Router lays copper, the Architect organizes:
 * buses for related nets, hierarchical sheets for functional blocks,
 * explicit interfaces between them. Its tools need NO host hooks — buses
 * and sheets are graph entities, so the loop's working copy is the whole
 * substrate. Applied ops come back as envelopes with meta
 * {agent: 'architect'} so blame works the moment they land.
 */

export interface RunArchitectOptions {
  prompt: string;
  graph: DesignGraph;
  parts: PartDb;
  provider: LlmProvider;
  onEvent?: (ev: AgentEvent) => void;
  confirmDestructive?: (explain: string) => Promise<boolean> | boolean;
  maxTurns?: number;
  actor?: string;
}

export interface ArchitectResult {
  ops: OpBody[];
  envelopes: OpEnvelope[];
  transcript: ProviderMessage[];
  finalText: string;
}

const ARCHITECT_PERSONA =
  'You are the Architect: structure is your medium. Related nets belong on named buses; ' +
  'functional blocks belong on sheets with explicit interfaces. You organize designs ' +
  'through tools — never by describing structure in prose.';

function buildArchitectSystemPrompt(graph: DesignGraph): string {
  return [
    ARCHITECT_PERSONA,
    '',
    'STRICT RULES:',
    '- Call read_structure BEFORE reorganizing anything, and again after — verify what landed.',
    '- Buses group RELATED nets: power rails on a PWR bus, SPI signals on an SPI bus, and so',
    '  on. Never lump unrelated nets together just to empty the unbussed list.',
    '- A sheet is a functional block (power supply, MCU core, sensor frontend). Its interface',
    '  ports are the nets that cross its boundary — declare them with honest directions.',
    '- Use exact net names and component refs from read_structure. Unknown names fail the call.',
    '- If the design is too small or already organized, say so plainly — never invent',
    '  structure a design does not need.',
    '',
    `Design right now: ${String(graph.components.size)} component(s), ${String(graph.nets.size)} net(s), ${String(graph.buses.size)} bus(es), ${String(graph.sheets.size)} sheet(s).`,
  ].join('\n');
}

export async function runArchitect(opts: RunArchitectOptions): Promise<ArchitectResult> {
  const {
    prompt,
    parts,
    provider,
    onEvent,
    confirmDestructive,
    maxTurns = 12,
    actor = 'agent:architect',
  } = opts;

  const working = cloneGraph(opts.graph);
  const appliedOps: OpBody[] = [];
  const envelopes: OpEnvelope[] = [];
  let lamport = 0;

  const registry = createArchitectRegistry();

  const loop = await runAgentLoop({
    prompt,
    provider,
    registry,
    onEvent,
    confirmDestructive,
    maxTurns,
    buildSystem: () => buildArchitectSystemPrompt(working),
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
          meta: { agent: 'architect', rationale },
        });
      }
      return undefined;
    },
  });

  return { ops: appliedOps, envelopes, transcript: loop.transcript, finalText: loop.finalText };
}
