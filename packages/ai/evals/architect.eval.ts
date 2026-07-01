/**
 * Architect golden corpus (BL-0902) — the fifth crew member on the shared
 * agent loop. Where the Draftsman draws, the Architect organizes: named buses
 * for related nets, hierarchical sheets for functional blocks. Its tools ARE
 * mutating (create_bus / create_sheet / move_components emit ops), so unlike a
 * read-only persona the op-count assertions carry weight here.
 *
 * Scenarios are lifted/hardened from `src/architect.test.ts`. The adapter owns
 * Architect-specific wiring — a small seeded PSU design (the tools resolve nets
 * and refs by NAME, so an empty graph would fail every call) and the persona's
 * own registry, which `runArchitect` builds internally. The harness owns the
 * shared assertions.
 */
import { applyOp, emptyGraph } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';

import { runArchitect } from '../src/architect.js';
import { FakeProvider } from '../src/fake-provider.js';
import { ARCHITECT_TOOLS } from '../src/tools/architect.js';

import { toolCallCollector } from './harness.js';
import { describeGolden } from './suite.js';

import type { AgentEvent } from '../src/provider.js';
import type { GoldenRun, GoldenScenario } from './schema.js';
import type { DesignGraph, OpBody } from '@protopulse/graph';

function use(id: string, name: string, input: unknown): AgentEvent {
  return { kind: 'tool_use', id, name, input };
}
function done(stopReason: string): AgentEvent {
  return { kind: 'done', stopReason };
}
function say(text: string): AgentEvent[] {
  return [{ kind: 'text', text }, done('end_turn')];
}

/**
 * Tiny PSU-ish design: R1/R2/C1, nets VCC / GND / SIG, no structure yet.
 * Mirrors `src/architect.test.ts` — the Architect's tools resolve net names
 * (VCC, GND) and component refs (R1, C1) against this graph, so the corpus
 * must run against a populated design, not `emptyGraph()`.
 */
function design(): DesignGraph {
  const g = emptyGraph();
  const ops: OpBody[] = [
    { kind: 'add_component', id: 'ra', ref: 'R1', partId: 'core:resistor', partRev: 1 },
    { kind: 'add_component', id: 'rb', ref: 'R2', partId: 'core:resistor', partRev: 1 },
    { kind: 'add_component', id: 'ca', ref: 'C1', partId: 'core:capacitor', partRev: 1 },
    { kind: 'connect', port: 'ra:1', newNetId: 'n-vcc' },
    { kind: 'connect', port: 'ca:1', netId: 'n-vcc' },
    { kind: 'rename_net', netId: 'n-vcc', name: 'VCC' },
    { kind: 'connect', port: 'ca:2', newNetId: 'n-gnd' },
    { kind: 'connect', port: 'rb:2', netId: 'n-gnd' },
    { kind: 'rename_net', netId: 'n-gnd', name: 'GND' },
    { kind: 'connect', port: 'ra:2', newNetId: 'n-sig' },
    { kind: 'connect', port: 'rb:1', netId: 'n-sig' },
    { kind: 'rename_net', netId: 'n-sig', name: 'SIG' },
  ];
  for (const op of ops) {
    const res = applyOp(g, op);
    if (!res.ok) throw new Error(res.error);
  }
  return g;
}

/** Architect adapter: scripted provider → run → normalized GoldenRun. */
async function runArchitectScenario(scenario: GoldenScenario): Promise<GoldenRun> {
  const provider = new FakeProvider(scenario.scriptedTurns);
  const collector = toolCallCollector();
  const result = await runArchitect({
    prompt: scenario.input,
    graph: design(),
    parts: seedPartDb(),
    provider,
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
    // Happy path: read → bus the power rails → sheet the PSU → read again.
    id: 'architect/bus-and-sheet-psu',
    persona: 'architect',
    input: 'Organize this design: bus the power rails and put the PSU on its own sheet.',
    scriptedTurns: [
      [use('t1', 'read_structure', {}), done('tool_use')],
      [
        use('t2', 'create_bus', { name: 'POWER', busKind: 'PWR', nets: ['VCC', 'GND'] }),
        done('tool_use'),
      ],
      [
        use('t3', 'create_sheet', {
          name: 'PSU',
          components: ['R1', 'C1'],
          interface: [{ name: 'VOUT', direction: 'out', net: 'VCC' }],
        }),
        done('tool_use'),
      ],
      [use('t4', 'read_structure', {}), done('tool_use')],
      say('Organized: POWER bus over VCC+GND, PSU sheet with R1 and C1.'),
    ],
    expect: {
      promptIncludes: [
        'You are the Architect',
        'STRICT RULES:',
        'Call read_structure BEFORE reorganizing anything',
        'Buses group RELATED nets',
        'Design right now: 3 component(s), 3 net(s), 0 bus(es), 0 sheet(s).',
      ],
      toolSequence: ['read_structure', 'create_bus', 'create_sheet', 'read_structure'],
      toolScope: ARCHITECT_TOOLS,
      finalTextIncludes: ['POWER bus', 'PSU sheet'],
      ops: { minCount: 1 },
    },
  },
  {
    // Scope edge: exercises move_components — the fourth tool, absent from the
    // happy path — proving the full Architect slice is in-scope. create_sheet
    // lands in the working copy first, so move_components can target it by name.
    id: 'architect/move-onto-new-sheet',
    persona: 'architect',
    input: 'Make an MCU sheet and move the second resistor onto it.',
    scriptedTurns: [
      [use('t1', 'read_structure', {}), done('tool_use')],
      [
        use('t2', 'create_sheet', { name: 'MCU', components: ['R1'] }),
        done('tool_use'),
      ],
      [use('t3', 'move_components', { components: ['R2'], sheet: 'MCU' }), done('tool_use')],
      say('Moved R2 onto the MCU sheet.'),
    ],
    expect: {
      promptIncludes: [
        'You are the Architect',
        'STRICT RULES:',
        'A sheet is a functional block',
      ],
      toolSequence: ['read_structure', 'create_sheet', 'move_components'],
      toolScope: ARCHITECT_TOOLS,
      finalTextIncludes: ['MCU sheet'],
      ops: { minCount: 1 },
    },
  },
  {
    // Read-only / no-op edge: the design is small and already flat, so the
    // Architect reads the structure and declines to invent structure it does
    // not need. Zero ops land.
    id: 'architect/read-only-already-flat',
    persona: 'architect',
    input: 'Should this design be reorganized?',
    scriptedTurns: [
      [use('t1', 'read_structure', {}), done('tool_use')],
      say('This design is too small to reorganize — it is already flat and clear.'),
    ],
    expect: {
      promptIncludes: [
        'You are the Architect',
        'STRICT RULES:',
        'never invent',
      ],
      toolSequence: ['read_structure'],
      toolScope: ARCHITECT_TOOLS,
      finalTextIncludes: ['too small to reorganize'],
      ops: { count: 0 },
    },
  },
];

describeGolden('architect', SCENARIOS, runArchitectScenario);
