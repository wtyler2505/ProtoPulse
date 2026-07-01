/**
 * Buyer golden corpus (BL-0902) — sourcing over a rev-stamped catalog SNAPSHOT.
 * Scenarios are lifted/hardened from `src/buyer.test.ts`. The adapter owns
 * Buyer-specific wiring: a real design graph to source (empty graphs have no
 * BOM) and the injected catalog snapshot the Buyer reads. The harness owns the
 * shared assertions (prompt substrings, exact tool sequence, scope guard, ops).
 */
import { applyOp, emptyGraph } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';

import { runBuyer } from '../src/buyer.js';
import { FakeProvider } from '../src/fake-provider.js';
import { BUYER_TOOLS } from '../src/tools/buyer.js';

import { toolCallCollector } from './harness.js';
import { describeGolden } from './suite.js';

import type { AgentEvent } from '../src/provider.js';
import type { CatalogLike } from '../src/tools/buyer.js';
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

const parts = seedPartDb();

/** The injected catalog snapshot the Buyer sources against (from buyer.test.ts). */
const CATALOG: CatalogLike = {
  rev: '2026-06',
  vendor: 'jlcpcb',
  note: 'test snapshot — classes drift, verify at order time',
  entries: [
    { partId: 'core:resistor', value: '10k', lcsc: 'C25804', mpn: '0603WAF1002T5E', mfr: 'UNI-ROYAL', package: '0603', class: 'basic', description: '10k 1%' },
    { partId: 'core:resistor', value: '1k', lcsc: 'C21190', mpn: '0603WAF1001T5E', mfr: 'UNI-ROYAL', package: '0603', class: 'basic', description: '1k 1%' },
    { partId: 'core:ne555', lcsc: 'C7593', mpn: 'NE555DR', mfr: 'TI', package: 'SOIC-8', class: 'extended', description: '555 timer' },
  ],
};

/** Two 10k resistors (case differs, value agrees), one valueless resistor, one 555. */
function design(): DesignGraph {
  const g = emptyGraph();
  const ops: OpBody[] = [
    { kind: 'add_component', id: 'ra', ref: 'R1', partId: 'core:resistor', partRev: 1 },
    { kind: 'set_component_props', id: 'ra', props: { value: '10k' } },
    { kind: 'add_component', id: 'rb', ref: 'R2', partId: 'core:resistor', partRev: 1 },
    { kind: 'set_component_props', id: 'rb', props: { value: '10K' } },
    { kind: 'add_component', id: 'rc', ref: 'R3', partId: 'core:resistor', partRev: 1 },
    { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 },
  ];
  for (const op of ops) {
    const res = applyOp(g, op);
    if (!res.ok) throw new Error(res.error);
  }
  return g;
}

/** Buyer adapter: scripted provider + real design + catalog → normalized GoldenRun. */
async function runBuyerScenario(scenario: GoldenScenario): Promise<GoldenRun> {
  const provider = new FakeProvider(scenario.scriptedTurns);
  const collector = toolCallCollector();
  const result = await runBuyer({
    prompt: scenario.input,
    graph: design(),
    parts,
    provider,
    catalog: CATALOG,
    onEvent: collector.onEvent,
  });
  return {
    turns: provider.turns,
    toolCalls: collector.names,
    finalText: result.finalText,
    opCount: result.ops.length,
    opKinds: result.ops.map((o) => o.kind),
  };
}

const SCENARIOS: GoldenScenario[] = [
  // (a) Happy path — read the BOM, find offers, assign, verify with a report.
  {
    id: 'buyer/source-resistors',
    persona: 'buyer',
    input: 'Source this design.',
    scriptedTurns: [
      [use('t1', 'read_bom', {}), done('tool_use')],
      [use('t2', 'find_offers', { ref: 'R1' }), done('tool_use')],
      [use('t3', 'assign_sourcing', { refs: ['R1', 'R2'], lcsc: 'C25804' }), done('tool_use')],
      [use('t4', 'sourcing_report', {}), done('tool_use')],
      say('Sourced the 10k resistors as C25804 (basic). R3 has no value; U1 is still unsourced.'),
    ],
    expect: {
      promptIncludes: [
        'You are the Buyer',
        'STRICT RULES:',
        'Call read_bom BEFORE sourcing',
        'NEVER invent prices, stock counts, or lead times.',
        'The catalog is the jlcpcb 2026-06 SNAPSHOT.',
      ],
      toolSequence: ['read_bom', 'find_offers', 'assign_sourcing', 'sourcing_report'],
      toolScope: BUYER_TOOLS,
      finalTextIncludes: ['C25804', 'basic'],
      ops: { count: 2, kinds: ['set_component_props'] },
    },
  },

  // (b) Scope / stop edge — full basic+extended sourcing, every tool in-slice.
  {
    id: 'buyer/source-basic-and-extended',
    persona: 'buyer',
    input: 'Source everything you can, resistors and the 555.',
    scriptedTurns: [
      [use('t1', 'read_bom', {}), done('tool_use')],
      [use('t2', 'find_offers', { ref: 'R1' }), done('tool_use')],
      [use('t3', 'assign_sourcing', { refs: ['R1', 'R2'], lcsc: 'C25804' }), done('tool_use')],
      [use('t4', 'find_offers', { ref: 'U1' }), done('tool_use')],
      [use('t5', 'assign_sourcing', { refs: ['U1'], lcsc: 'C7593' }), done('tool_use')],
      [use('t6', 'sourcing_report', {}), done('tool_use')],
      say('R1/R2 sourced C25804 (basic), U1 sourced C7593 (extended, per-reel setup fee). R3 unsourced — no value.'),
    ],
    expect: {
      promptIncludes: [
        'You are the Buyer',
        'STRICT RULES:',
        'Bias toward basic-class parts',
        'Catalog: 3 verified offer(s).',
      ],
      toolSequence: ['read_bom', 'find_offers', 'assign_sourcing', 'find_offers', 'assign_sourcing', 'sourcing_report'],
      toolScope: BUYER_TOOLS,
      finalTextIncludes: ['extended'],
      ops: { count: 3, kinds: ['set_component_props'] },
    },
  },

  // (c) No-op / read edge — a line with no catalog offer stays unsourced, no ops.
  {
    id: 'buyer/no-offer-stays-unsourced',
    persona: 'buyer',
    input: 'Can we source a 47k resistor?',
    scriptedTurns: [
      [use('t1', 'read_bom', {}), done('tool_use')],
      [use('t2', 'find_offers', { partId: 'core:resistor', value: '47k' }), done('tool_use')],
      [use('t3', 'sourcing_report', {}), done('tool_use')],
      say('No jlcpcb offer for a 47k resistor in the 2026-06 snapshot — that line stays unsourced.'),
    ],
    expect: {
      promptIncludes: [
        'You are the Buyer',
        'STRICT RULES:',
        'Never fabricate a part number.',
      ],
      toolSequence: ['read_bom', 'find_offers', 'sourcing_report'],
      toolScope: BUYER_TOOLS,
      finalTextIncludes: ['unsourced'],
      ops: { count: 0 },
    },
  },
];

describeGolden('buyer', SCENARIOS, runBuyerScenario);
