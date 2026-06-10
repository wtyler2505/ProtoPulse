import { runAgentLoop } from './agent.js';
import { createProfessorRegistry } from './tools/professor.js';

import type { TeachingDepth } from './depth.js';
import type { AgentEvent, LlmProvider, ProviderMessage } from './provider.js';
import type { CodeToConcept, ConceptLookup } from './tools/professor.js';
import type { DesignGraph } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

/**
 * The Professor — never tired, never condescending, depth-adjustable.
 * Vol III's teaching persona on the shared agent loop. It never edits
 * the design (its tools propose zero ops); it explains it: read_design
 * → explain_finding / lookup_concept → grounded prose. The depth dial
 * sets the register, not the truth.
 */

export interface RunProfessorOptions {
  prompt: string;
  graph: DesignGraph;
  parts: PartDb;
  provider: LlmProvider;
  /** Slug → article, wired by the host (the app's glob loader). */
  concepts: ConceptLookup;
  /** Finding code → concept slug (ERC map + the host's REV map). */
  codeToConcept: CodeToConcept;
  depth?: TeachingDepth;
  onEvent?: (ev: AgentEvent) => void;
  maxTurns?: number;
}

export interface ProfessorResult {
  transcript: ProviderMessage[];
  finalText: string;
  depth: TeachingDepth;
}

const PROFESSOR_PERSONA =
  'You are the Professor — never tired, never condescending, depth-adjustable. ' +
  'You teach electronics through THIS design, with the concepts wiki at your elbow.';

const DEPTH_REGISTER: Record<TeachingDepth, string> = {
  'do-it':
    "Depth dial: DO-IT. Answer in ONE terse paragraph — the conclusion and the immediate fix, nothing more. No lecture, no detours.",
  'show-me':
    'Depth dial: SHOW-ME. Give the explanation AND the why: what is happening in this circuit and the reason it matters. A few short paragraphs at most.',
  'teach-me':
    'Depth dial: TEACH-ME. Teach from first principles: start at the underlying physics/convention, build up to this circuit, and END with a concrete "See it yourself" experiment the user can run (a simulation to try or a bench measurement to take).',
};

function buildProfessorSystemPrompt(graph: DesignGraph, depth: TeachingDepth): string {
  const refs = [...graph.components.values()]
    .map((c) => c.ref)
    .sort()
    .join(', ');
  return [
    PROFESSOR_PERSONA,
    '',
    'STRICT RULES:',
    "- Ground EVERY explanation in THIS design's actual nets and refs — call read_design first",
    '  and name the real parts (e.g. "R3 on net VOUT"), never a hypothetical circuit.',
    '- Consult the concepts wiki via explain_finding / lookup_concept BEFORE explaining, and',
    '  cite the article you consulted by title in your answer.',
    '- Adjust your register to the depth dial (below). The depth changes how much you say,',
    '  never whether what you say is true.',
    '- NEVER invent component values, ratings, or specs. If the design or the wiki does not',
    '  state a number, say you do not know it.',
    '',
    DEPTH_REGISTER[depth],
    '',
    `Design under discussion: ${String(graph.components.size)} component(s) [${refs || 'none'}], ${String(graph.nets.size)} net(s). Use read_design for the full digest.`,
  ].join('\n');
}

export async function runProfessor(opts: RunProfessorOptions): Promise<ProfessorResult> {
  const {
    prompt,
    graph,
    parts,
    provider,
    concepts,
    codeToConcept,
    depth = 'show-me',
    onEvent,
    maxTurns = 8,
  } = opts;
  const registry = createProfessorRegistry(concepts, codeToConcept);

  const loop = await runAgentLoop({
    prompt,
    provider,
    registry,
    onEvent,
    maxTurns,
    buildSystem: () => buildProfessorSystemPrompt(graph, depth),
    getCtx: () => ({ graph, parts }),
  });

  return { transcript: loop.transcript, finalText: loop.finalText, depth };
}
