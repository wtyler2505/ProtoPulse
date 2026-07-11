/**
 * Draftsman golden corpus (BL-0902) — the reference persona that proves the
 * harness end-to-end. Scenarios are lifted/hardened from `src/agent.test.ts`.
 * The adapter owns Draftsman-specific wiring (empty graph, seeded parts, the
 * scoped Draftsman registry); the harness owns the shared assertions.
 */
import { emptyGraph } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';

import { runDraftsman } from '../src/agent.js';
import { FakeProvider } from '../src/fake-provider.js';
import { DRAFTSMAN_TOOL_NAMES, createDraftsmanRegistry } from '../src/tools/draftsman.js';

import { toolCallCollector } from './harness.js';
import { describeGolden } from './suite.js';

import type { AgentEvent } from '../src/provider.js';
import type { GoldenRun, GoldenScenario } from './schema.js';

function toolUse(id: string, name: string, input: unknown): AgentEvent {
  return { kind: 'tool_use', id, name, input };
}
function done(stopReason: string): AgentEvent {
  return { kind: 'done', stopReason };
}
function say(text: string): AgentEvent[] {
  return [{ kind: 'text', text }, done('end_turn')];
}

/** Draftsman adapter: scripted provider → run → normalized GoldenRun. */
async function runDraftsmanScenario(scenario: GoldenScenario): Promise<GoldenRun> {
  const provider = new FakeProvider(scenario.scriptedTurns);
  const collector = toolCallCollector();
  const result = await runDraftsman({
    prompt: scenario.input,
    graph: emptyGraph(),
    parts: seedPartDb(),
    provider,
    registry: createDraftsmanRegistry(),
    onEvent: collector.onEvent,
  });
  return {
    turns: provider.turns,
    toolCalls: collector.names,
    finalText: result.finalText,
    opCount: result.ops.length,
  };
}

const SCENARIOS: GoldenScenario[] = [
  {
    id: 'draftsman/led-limiter',
    persona: 'draftsman',
    input: 'Add an LED with a current-limiting resistor.',
    scriptedTurns: [
      [
        toolUse('t1', 'add_component', { part_id: 'core:led' }),
        toolUse('t2', 'add_component', { part_id: 'core:resistor', value: '330' }),
        done('tool_use'),
      ],
      [toolUse('t3', 'connect', { from_port: 'R1:2', to_port: 'D1:A' }), done('tool_use')],
      [toolUse('t4', 'run_erc', {}), done('tool_use')],
      say('Wired the LED through a 330Ω limiter.'),
    ],
    expect: {
      promptIncludes: [
        'You are the Draftsman',
        'STRICT RULES:',
        'ALWAYS run run_erc',
        'core:led',
      ],
      toolSequence: ['add_component', 'add_component', 'connect', 'run_erc'],
      toolScope: DRAFTSMAN_TOOL_NAMES,
      finalTextIncludes: ['330Ω limiter'],
      ops: { minCount: 3 },
    },
  },
  {
    id: 'draftsman/erc-only-read-no-ops',
    persona: 'draftsman',
    input: 'Check the design.',
    scriptedTurns: [[toolUse('t1', 'run_erc', {}), done('tool_use')], say('All clear.')],
    expect: {
      promptIncludes: ['You are the Draftsman', 'STRICT RULES:'],
      toolSequence: ['run_erc'],
      toolScope: DRAFTSMAN_TOOL_NAMES,
      finalTextIncludes: ['clear'],
      ops: { count: 0 },
    },
  },
];

describeGolden('draftsman', SCENARIOS, runDraftsmanScenario);
