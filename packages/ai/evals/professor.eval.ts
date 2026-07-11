/**
 * Professor golden corpus (BL-0902) — the teaching persona on the shared agent
 * loop. Scenarios are lifted/hardened from `src/professor.test.ts`. The adapter
 * owns Professor-specific wiring (a fixture graph with real refs/nets, seeded
 * parts, the injected concept-lookup + code→concept stubs, the scoped Professor
 * registry); the harness owns the shared assertions.
 *
 * The Professor is READ-ONLY: every tool returns `ops: []` and `ProfessorResult`
 * has no ops surface, so `opCount` is always 0. The teaching DEPTH dial
 * (do-it / show-me / teach-me) is not part of the scenario schema, so the
 * adapter threads it via a small id-keyed map adjacent to SCENARIOS.
 */
import { makePortRef, materialize } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';

import { FakeProvider } from '../src/fake-provider.js';
import { runProfessor } from '../src/professor.js';
import { PROFESSOR_TOOL_NAMES } from '../src/tools/professor.js';

import { toolCallCollector } from './harness.js';
import { describeGolden } from './suite.js';

import type { TeachingDepth } from '../src/depth.js';
import type { AgentEvent } from '../src/provider.js';
import type { CodeToConcept, ConceptLookup } from '../src/tools/professor.js';
import type { GoldenRun, GoldenScenario } from './schema.js';
import type { DesignGraph, OpBody, OpEnvelope } from '@protopulse/graph';

function toolUse(id: string, name: string, input: unknown): AgentEvent {
  return { kind: 'tool_use', id, name, input };
}
function done(stopReason: string): AgentEvent {
  return { kind: 'done', stopReason };
}
function say(text: string): AgentEvent[] {
  return [{ kind: 'text', text }, done('end_turn')];
}

const parts = seedPartDb();

function env(lamport: number, op: OpBody): OpEnvelope {
  return { actor: 'test', lamport, ts: 0, op };
}

/** A tiny but real design: R1 (10k) on net VOUT — so explanations cite real refs/nets. */
function fixtureGraph(): DesignGraph {
  const rRev = parts.latest('core:resistor')?.rev ?? 1;
  const { graph } = materialize([
    env(1, { kind: 'add_component', id: 'c-r1', ref: 'R1', partId: 'core:resistor', partRev: rRev, value: '10k' }),
    env(2, { kind: 'connect', port: makePortRef('c-r1', '2'), newNetId: 'n-out' }),
    env(3, { kind: 'rename_net', netId: 'n-out', name: 'VOUT' }),
  ]);
  return graph;
}

/** The host injects these; tests pass plain records (mirrors professor.test.ts). */
const concepts: ConceptLookup = (slug) =>
  slug === 'pull-up-pull-down'
    ? { title: 'Pull-up and pull-down resistors', body: 'A resistor that defines the idle level.' }
    : undefined;

const codeToConcept: CodeToConcept = (code) =>
  code === 'ERC-OC-NO-PULLUP' ? 'pull-up-pull-down' : undefined;

/**
 * Per-scenario teaching depth. `GoldenScenario` has no depth field, so the
 * adapter threads it here by id; an unmapped id → undefined → runProfessor's
 * 'show-me' default. This is a second source of truth — keep it beside SCENARIOS.
 */
const DEPTH_BY_ID: Partial<Record<string, TeachingDepth>> = {
  'professor/teach-me-first-principles': 'teach-me',
  'professor/pure-text-do-it': 'do-it',
};

/** Professor adapter: scripted provider → run → normalized GoldenRun. */
async function runProfessorScenario(scenario: GoldenScenario): Promise<GoldenRun> {
  const provider = new FakeProvider(scenario.scriptedTurns);
  const collector = toolCallCollector();
  const result = await runProfessor({
    prompt: scenario.input,
    graph: fixtureGraph(),
    parts,
    provider,
    concepts,
    codeToConcept,
    depth: DEPTH_BY_ID[scenario.id],
    onEvent: collector.onEvent,
  });
  return {
    turns: provider.turns,
    toolCalls: collector.names,
    finalText: result.finalText,
    // Professor is read-only: every tool returns ops:[] and ProfessorResult has
    // no ops surface. opCount is always 0.
    opCount: 0,
  };
}

const SCENARIOS: GoldenScenario[] = [
  {
    // (a) Happy path: ground in the design, consult the wiki, map the finding, teach.
    id: 'professor/floating-input-lesson',
    persona: 'professor',
    input: 'Explain this finding: ERC-OC-NO-PULLUP on VOUT',
    scriptedTurns: [
      [toolUse('t1', 'read_design', {}), done('tool_use')],
      [toolUse('t2', 'lookup_concept', { slug: 'pull-up-pull-down' }), done('tool_use')],
      [
        toolUse('t3', 'explain_finding', { code: 'ERC-OC-NO-PULLUP', message: 'no pull-up on VOUT' }),
        done('tool_use'),
      ],
      say('Per "Pull-up and pull-down resistors": R1 on net VOUT has no pull-up, so nothing defines the idle level.'),
    ],
    expect: {
      promptIncludes: [
        'You are the Professor',
        'never tired, never condescending, depth-adjustable',
        'STRICT RULES:',
        "THIS design's actual nets and refs",
        'cite the article you consulted',
        'NEVER invent component values',
        'explanation AND the why', // default depth: show-me
        'R1', // the real design leaks into the prompt
      ],
      toolSequence: ['read_design', 'lookup_concept', 'explain_finding'],
      toolScope: PROFESSOR_TOOL_NAMES,
      finalTextIncludes: ['R1 on net VOUT', 'Pull-up and pull-down resistors'],
      ops: { count: 0 },
    },
  },
  {
    // (b) Depth variant: teach-me register + read_design only.
    id: 'professor/teach-me-first-principles',
    persona: 'professor',
    input: 'Teach me why VOUT behaves the way it does.',
    scriptedTurns: [
      [toolUse('t1', 'read_design', {}), done('tool_use')],
      say('From first principles: R1 on VOUT... try measuring it on the bench yourself.'),
    ],
    expect: {
      promptIncludes: [
        'You are the Professor',
        'STRICT RULES:',
        'first principles', // teach-me register
        'See it yourself', // teach-me demands a See-it experiment
        'R1',
      ],
      toolSequence: ['read_design'],
      toolScope: PROFESSOR_TOOL_NAMES,
      ops: { count: 0 },
    },
  },
  {
    // (c) Pure-text edge: no tools, terse do-it register.
    id: 'professor/pure-text-do-it',
    persona: 'professor',
    input: 'One line: is VOUT floating?',
    scriptedTurns: [say('Yes — VOUT is only tied through R1; add a pull-up.')],
    expect: {
      promptIncludes: [
        'You are the Professor',
        'STRICT RULES:',
        'ONE terse paragraph', // do-it register
      ],
      toolSequence: [],
      toolScope: PROFESSOR_TOOL_NAMES,
      finalTextIncludes: ['VOUT'],
      ops: { count: 0 },
    },
  },
];

describeGolden('professor', SCENARIOS, runProfessorScenario);
