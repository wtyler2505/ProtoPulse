/**
 * Router golden corpus (BL-0902) — mirrors the Draftsman reference. Scenarios
 * are lifted/hardened from `src/router.test.ts`. The adapter owns Router-specific
 * wiring: a small placed board (two resistors, one unrouted SIG net) plus the
 * DEPENDENCY-INJECTED routing stack (RouterHooks: ratsnest/route/drc). The fake
 * stack refuses "walk" and succeeds on "shove", exactly like the unit test, so
 * the scripted trajectories replay a real routing story deterministically.
 */
import { applyOp, emptyGraph, MM } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';

import { FakeProvider } from '../src/fake-provider.js';
import { runRouter } from '../src/router.js';
import { ROUTER_TOOLS } from '../src/tools/router.js';

import { toolCallCollector } from './harness.js';
import { describeGolden } from './suite.js';

import type { AgentEvent } from '../src/provider.js';
import type { PinnedRouteRequest, RouterHooks } from '../src/route-types.js';
import type { DesignGraph, OpBody } from '@protopulse/graph';
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

/** A placed board: R1 + R2 on one net (SIG), positioned but not yet routed. */
function board(): DesignGraph {
  const g = emptyGraph();
  const ops: OpBody[] = [
    { kind: 'add_component', id: 'ra', ref: 'R1', partId: 'core:resistor', partRev: 1 },
    { kind: 'add_component', id: 'rb', ref: 'R2', partId: 'core:resistor', partRev: 1 },
    { kind: 'connect', port: 'ra:2', newNetId: 'na' },
    { kind: 'connect', port: 'rb:1', netId: 'na' },
    { kind: 'rename_net', netId: 'na', name: 'SIG' },
    { kind: 'place_footprint', componentId: 'ra', at: { x: 0, y: 0 }, rotMilli: 0, side: 'top', locked: false },
    { kind: 'place_footprint', componentId: 'rb', at: { x: 10 * MM, y: 0 }, rotMilli: 0, side: 'top', locked: false },
  ];
  for (const op of ops) {
    const res = applyOp(g, op);
    if (!res.ok) throw new Error(res.error);
  }
  return g;
}

const SIG_TRACE: OpBody = {
  kind: 'route_trace',
  id: 't-sig',
  netId: 'na',
  layerId: 'F.Cu',
  widthNm: 200_000,
  path: [
    { x: 950_000, y: 0 },
    { x: 9_050_000, y: 0 },
  ],
};

/**
 * Fake routing stack (RouterHooks): one unrouted SIG pair until a SIG trace
 * exists; walk always refuses, shove always succeeds; DRC clean once routed.
 * Copied from src/router.test.ts — the injected engines the Router requires.
 */
function fakeHooks(log: PinnedRouteRequest[] = []): RouterHooks {
  return {
    ratsnest: (graph) =>
      [...graph.pcb.traces.values()].some((t) => t.netId === 'na')
        ? []
        : [
            {
              netId: 'na',
              netName: 'SIG',
              a: { x: 950_000, y: 0, label: 'R1:2' },
              b: { x: 9_050_000, y: 0, label: 'R2:1' },
            },
          ],
    route: (_graph, req) => {
      log.push(req);
      if (req.mode === 'walk') {
        return { ok: false, reason: 'Walkaround found no clear corridor' };
      }
      return { ok: true, ops: [SIG_TRACE], summary: 'routed SIG R1:2→R2:1 (shove, 0 victims)' };
    },
    drc: (graph) =>
      Promise.resolve(
        graph.pcb.traces.size > 0
          ? []
          : [{ severity: 'error' as const, code: 'DRC-UNROUTED', message: 'SIG unrouted' }],
      ),
  };
}

/** Router adapter: scripted provider + fixtures + injected hooks → GoldenRun. */
async function runRouterScenario(scenario: GoldenScenario): Promise<GoldenRun> {
  const provider = new FakeProvider(scenario.scriptedTurns);
  const collector = toolCallCollector();
  const result = await runRouter({
    prompt: scenario.input,
    graph: board(),
    parts: seedPartDb(),
    provider,
    hooks: fakeHooks(),
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
    // (a) Happy path: read → walk refused → shove lands → DRC clean.
    id: 'router/walk-refused-shove-lands',
    persona: 'router',
    input: 'Route the board.',
    scriptedTurns: [
      [use('t1', 'read_board', {}), done('tool_use')],
      [use('t2', 'route_connection', { net: 'SIG', mode: 'walk' }), done('tool_use')],
      [use('t3', 'route_connection', { net: 'SIG', mode: 'shove' }), done('tool_use')],
      [use('t4', 'run_drc', {}), done('tool_use')],
      say('SIG landed via shove after walk refused. DRC: 0 errors.'),
    ],
    expect: {
      promptIncludes: [
        'You are the Router: copper is geometry, clearance is law',
        'STRICT RULES:',
        'Call read_board BEFORE routing anything',
        'Route one connection at a time.',
        'Board right now: 2 footprint(s), 0 trace(s), 1 unrouted connection(s).',
      ],
      toolSequence: ['read_board', 'route_connection', 'route_connection', 'run_drc'],
      toolScope: ROUTER_TOOLS,
      finalTextIncludes: ['shove', 'DRC: 0 errors'],
      // Only the shove trace lands; the walk refusal and read/DRC emit no ops.
      ops: { count: 1 },
    },
  },
  {
    // (b) Scope/undo edge: exercises all four tools, incl. remove_trace, on the
    // "fix what you can — remove_trace + re-route" STRICT RULE path.
    id: 'router/undo-and-reroute',
    persona: 'router',
    input: 'Route SIG, then rip it up and route it again.',
    scriptedTurns: [
      [use('t1', 'read_board', {}), done('tool_use')],
      [use('t2', 'route_connection', { net: 'SIG', mode: 'shove' }), done('tool_use')],
      [use('t3', 'remove_trace', { traceId: 't-sig' }), done('tool_use')],
      [use('t4', 'route_connection', { net: 'SIG', mode: 'shove' }), done('tool_use')],
      [use('t5', 'run_drc', {}), done('tool_use')],
      say('Ripped up SIG and re-routed it; DRC clean.'),
    ],
    expect: {
      promptIncludes: [
        'You are the Router',
        'STRICT RULES:',
        'remove_trace + re-route',
        'Pads and vias never move.',
      ],
      toolSequence: ['read_board', 'route_connection', 'remove_trace', 'route_connection', 'run_drc'],
      toolScope: ROUTER_TOOLS,
      finalTextIncludes: ['re-routed'],
      // shove (1) + remove_trace (1) + shove (1) = 3 applied ops.
      ops: { count: 3 },
    },
  },
  {
    // (c) Read-only / no-op edge: reads the board, routes nothing.
    id: 'router/read-only-no-ops',
    persona: 'router',
    input: 'What still needs routing?',
    scriptedTurns: [
      [use('t1', 'read_board', {}), done('tool_use')],
      say('One connection left: SIG (R1:2→R2:1). Nothing routed yet.'),
    ],
    expect: {
      promptIncludes: [
        'You are the Router',
        'STRICT RULES:',
        'the ratsnest is the truth',
      ],
      toolSequence: ['read_board'],
      toolScope: ROUTER_TOOLS,
      finalTextIncludes: ['SIG'],
      ops: { count: 0 },
    },
  },
];

describeGolden('router', SCENARIOS, runRouterScenario);
