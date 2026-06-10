import { runAgentLoop } from './agent.js';
import { createAnalystRegistry } from './tools/analyst.js';

import type { AgentEvent, LlmProvider, ProviderMessage } from './provider.js';
import type { PinnedSimulateFn } from './sim-types.js';
import type { DesignGraph } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

/**
 * The Analyst — Vol III's Lab persona, on the shared agent loop. It
 * never edits the design (its tools propose zero ops); it interrogates
 * it: read_design → run_simulation → measure → report, always stating
 * the fidelity manifest. simulate is injected by the host.
 */

export interface RunAnalystOptions {
  prompt: string;
  graph: DesignGraph;
  parts: PartDb;
  provider: LlmProvider;
  /** The pinned @protopulse/sim simulate(), wired by the host. */
  simulate: PinnedSimulateFn;
  onEvent?: (ev: AgentEvent) => void;
  maxTurns?: number;
}

export interface AnalystResult {
  transcript: ProviderMessage[];
  finalText: string;
}

const ANALYST_PERSONA =
  "You are the Analyst — skeptical of everything until it's plotted. " +
  'You verify circuit behavior by simulating and measuring, never by assuming.';

function buildAnalystSystemPrompt(graph: DesignGraph): string {
  const refs = [...graph.components.values()]
    .map((c) => c.ref)
    .sort()
    .join(', ');
  return [
    ANALYST_PERSONA,
    '',
    'STRICT RULES:',
    '- Call read_design BEFORE your first simulation so you know what you are measuring.',
    '- ALWAYS state the fidelity manifest when reporting simulation results. If any model is a',
    '  stub or behavioral, say so up front — simulations never lie about what they are.',
    "- Propose analysis windows from the circuit's physics: e.g. run ~5 time-constants for an RC",
    '  step, a few periods for an oscillator. Justify your stepS/stopS choices.',
    '- NEVER claim precision beyond the model tier. A stub model proves topology, not numbers;',
    '  behavioral models give trends; only spice-tier models earn quantitative claims.',
    '- Use measure for numbers (min/max/rms/final) instead of eyeballing; include units.',
    '',
    `Design under test: ${String(graph.components.size)} component(s) [${refs || 'none'}], ${String(graph.nets.size)} net(s). Use read_design for the full digest.`,
  ].join('\n');
}

export async function runAnalyst(opts: RunAnalystOptions): Promise<AnalystResult> {
  const { prompt, graph, parts, provider, simulate, onEvent, maxTurns = 8 } = opts;
  const registry = createAnalystRegistry(simulate);

  const loop = await runAgentLoop({
    prompt,
    provider,
    registry,
    onEvent,
    maxTurns,
    buildSystem: () => buildAnalystSystemPrompt(graph),
    getCtx: () => ({ graph, parts }),
  });

  return { transcript: loop.transcript, finalText: loop.finalText };
}
