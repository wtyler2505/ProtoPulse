/**
 * Analyst golden corpus (BL-0902) — the Lab persona (Vol III). Scenarios are
 * lifted/hardened from `src/analyst.test.ts`. The adapter owns Analyst-specific
 * wiring: a fixture design-under-test graph, the seeded parts, and the
 * dependency-injected `simulate` fake (the Analyst never imports @protopulse/sim;
 * the host wires a real ngspice-WASM engine, tests pass a fake). The Analyst is
 * read-only — every tool returns zero ops — so `opCount` is always 0.
 */
import { makePortRef, materialize } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';

import { runAnalyst } from '../src/analyst.js';
import { FakeProvider } from '../src/fake-provider.js';
import { ANALYST_TOOL_NAMES } from '../src/tools/analyst.js';

import { toolCallCollector } from './harness.js';
import { describeGolden } from './suite.js';

import type { AgentEvent } from '../src/provider.js';
import type { Analysis, PinnedSimulateFn, SimResultWithManifest } from '../src/sim-types.js';
import type { DesignGraph, OpBody, OpEnvelope } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';
import type { GoldenRun, GoldenScenario } from './schema.js';

function use(id: string, name: string, input: unknown): AgentEvent {
  return { kind: 'tool_use', id, name, input };
}
function done(stopReason: string): AgentEvent {
  return { kind: 'done', stopReason };
}
function say(text: string): AgentEvent[] {
  return [{ kind: 'text', text }, done('end_turn')];
}

const parts: PartDb = seedPartDb();

/** A single-resistor design-under-test with a named output net (VOUT). */
function fixtureGraph(): DesignGraph {
  const rRev = parts.latest('core:resistor')?.rev ?? 1;
  const env = (lamport: number, op: OpBody): OpEnvelope => ({ actor: 'test', lamport, ts: 0, op });
  const result = materialize([
    env(1, {
      kind: 'add_component',
      id: 'c-r1',
      ref: 'R1',
      partId: 'core:resistor',
      partRev: rRev,
      value: '10k',
    }),
    env(2, { kind: 'connect', port: makePortRef('c-r1', '2'), newNetId: 'n-out' }),
    env(3, { kind: 'rename_net', netId: 'n-out', name: 'VOUT' }),
  ]);
  return result.graph;
}

/** A spice-tier transient result over a trivial ramp — the injected engine fake. */
function fakeSimulate(): PinnedSimulateFn {
  return (_graph, _parts, analysis: Analysis) => {
    const result: SimResultWithManifest = {
      analysis,
      variables: ['time', 'v(out)'],
      points: 5,
      vectors: [
        { name: 'time', values: [0, 1, 2, 3, 4] },
        { name: 'v(out)', values: [0, 1, 2, 3, 4] },
      ],
      manifest: [{ ref: 'R1', partId: 'core:resistor', tier: 'spice' }],
    };
    return Promise.resolve(result);
  };
}

/** Analyst adapter: fixture graph + injected simulate → run → normalized GoldenRun. */
async function runAnalystScenario(scenario: GoldenScenario): Promise<GoldenRun> {
  const provider = new FakeProvider(scenario.scriptedTurns);
  const collector = toolCallCollector();
  const result = await runAnalyst({
    prompt: scenario.input,
    graph: fixtureGraph(),
    parts,
    provider,
    simulate: fakeSimulate(),
    onEvent: collector.onEvent,
  });
  return {
    turns: provider.turns,
    toolCalls: collector.names,
    finalText: result.finalText,
    // The Analyst never edits the design — all three tools propose zero ops.
    opCount: 0,
  };
}

const TRAN: Analysis = { kind: 'tran', stepS: 1e-6, stopS: 4e-6 };

const SCENARIOS: GoldenScenario[] = [
  {
    // (a) Happy path: read the design, simulate, then measure a number.
    id: 'analyst/rc-settle',
    persona: 'analyst',
    input: 'What does the output settle to?',
    scriptedTurns: [
      [use('t1', 'read_design', {}), done('tool_use')],
      [use('t2', 'run_simulation', { analysis: TRAN }), done('tool_use')],
      [use('t3', 'measure', { vector: 'v(out)', metric: 'final' }), done('tool_use')],
      say('v(out) settles at 4V. Fidelity: 1 spice — numbers are trustworthy.'),
    ],
    expect: {
      promptIncludes: [
        "You are the Analyst — skeptical of everything until it's plotted.",
        'STRICT RULES:',
        '- Call read_design BEFORE your first simulation so you know what you are measuring.',
        'ALWAYS state the fidelity manifest when reporting simulation results.',
        'NEVER claim precision beyond the model tier.',
      ],
      toolSequence: ['read_design', 'run_simulation', 'measure'],
      toolScope: ANALYST_TOOL_NAMES,
      finalTextIncludes: ['settles at 4V', 'Fidelity'],
      ops: { count: 0 },
    },
  },
  {
    // (b) Scope/stop edge: measure before run_simulation surfaces as a tool
    // error; the loop recovers by simulating, then stops. No tool leaves scope.
    id: 'analyst/measure-first-recovers',
    persona: 'analyst',
    input: 'measure first by mistake',
    scriptedTurns: [
      [use('t1', 'measure', { vector: 'v(out)', metric: 'rms' }), done('tool_use')],
      [use('t2', 'run_simulation', { analysis: TRAN }), done('tool_use')],
      say('Ran it properly this time.'),
    ],
    expect: {
      promptIncludes: [
        "You are the Analyst — skeptical of everything until it's plotted.",
        'STRICT RULES:',
        'Use measure for numbers (min/max/rms/final) instead of eyeballing; include units.',
      ],
      toolSequence: ['measure', 'run_simulation'],
      toolScope: ANALYST_TOOL_NAMES,
      finalTextIncludes: ['properly'],
      ops: { count: 0 },
    },
  },
  {
    // (c) No-op / budget edge: a single done turn with no tool calls.
    id: 'analyst/no-op-greeting',
    persona: 'analyst',
    input: 'hello',
    scriptedTurns: [say('Nothing to analyze yet — point me at a design and I will plot it.')],
    expect: {
      promptIncludes: [
        "You are the Analyst — skeptical of everything until it's plotted.",
        'STRICT RULES:',
        'Design under test:',
      ],
      toolSequence: [],
      toolScope: ANALYST_TOOL_NAMES,
      finalTextIncludes: ['Nothing to analyze yet'],
      ops: { count: 0 },
    },
  },
];

describeGolden('analyst', SCENARIOS, runAnalystScenario);
