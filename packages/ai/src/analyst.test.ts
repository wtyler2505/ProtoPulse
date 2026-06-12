import { makePortRef, materialize } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { runAnalyst } from './analyst.js';
import { FakeProvider } from './fake-provider.js';

import type { AgentEvent, ProviderContentBlock } from './provider.js';
import type { Analysis, PinnedSimulateFn, SimResultWithManifest } from './sim-types.js';
import type { DesignGraph, OpBody, OpEnvelope } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

const parts: PartDb = seedPartDb();

function env(lamport: number, op: OpBody): OpEnvelope {
  return { actor: 'test', lamport, ts: 0, op };
}

function fixtureGraph(): DesignGraph {
  const rRev = parts.latest('core:resistor')?.rev ?? 1;
  const result = materialize([
    env(1, { kind: 'add_component', id: 'c-r1', ref: 'R1', partId: 'core:resistor', partRev: rRev, value: '10k' }),
    env(2, { kind: 'connect', port: makePortRef('c-r1', '2'), newNetId: 'n-out' }),
    env(3, { kind: 'rename_net', netId: 'n-out', name: 'VOUT' }),
  ]);
  expect(result.warnings).toEqual([]);
  return result.graph;
}

const TRAN: Analysis = { kind: 'tran', stepS: 1e-6, stopS: 4e-6 };

function fakeSimulate(): { fn: PinnedSimulateFn; calls: Analysis[] } {
  const calls: Analysis[] = [];
  const fn: PinnedSimulateFn = (_graph, _parts, analysis) => {
    calls.push(analysis);
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
  return { fn, calls };
}

function use(id: string, name: string, input: unknown): AgentEvent {
  return { kind: 'tool_use', id, name, input };
}

function doneTurn(text: string): AgentEvent[] {
  return [{ kind: 'text', text }, { kind: 'done', stopReason: 'end_turn' }];
}

function lastToolResults(provider: FakeProvider, turn: number): ProviderContentBlock[] {
  const req = provider.turns[turn];
  const last = req?.messages[req.messages.length - 1];
  return Array.isArray(last?.content) ? last.content : [];
}

describe('runAnalyst end-to-end (FakeProvider + fake simulate — no network, no WASM)', () => {
  it('read_design → run_simulation → measure → verdict', async () => {
    const provider = new FakeProvider([
      [use('t1', 'read_design', {}), { kind: 'done', stopReason: 'tool_use' }],
      [use('t2', 'run_simulation', { analysis: TRAN }), { kind: 'done', stopReason: 'tool_use' }],
      [
        use('t3', 'measure', { vector: 'v(out)', metric: 'final' }),
        { kind: 'done', stopReason: 'tool_use' },
      ],
      doneTurn('v(out) settles at 4V. Fidelity: 1 spice — numbers are trustworthy.'),
    ]);
    const { fn, calls } = fakeSimulate();

    const result = await runAnalyst({
      prompt: 'What does the output settle to?',
      graph: fixtureGraph(),
      parts,
      provider,
      simulate: fn,
    });

    expect(result.finalText).toMatch(/settles at 4V/);
    expect(calls).toEqual([TRAN]);

    // Turn 2 saw the read_design digest fed back as a tool_result.
    const digest = lastToolResults(provider, 1)[0];
    expect(digest).toMatchObject({ type: 'tool_result', tool_use_id: 't1' });
    if (digest?.type === 'tool_result') {
      expect(digest.content).toContain('R1 10k Resistor');
      expect(digest.content).toContain('VOUT');
    }

    // Turn 3 saw the simulation stats + manifest.
    const simResult = lastToolResults(provider, 2)[0];
    if (simResult?.type === 'tool_result') {
      expect(simResult.is_error).toBeUndefined();
      expect(simResult.content).toContain('"points":5');
      expect(simResult.content).toContain('spice');
    }

    // Turn 4 saw the measured number.
    const measured = lastToolResults(provider, 3)[0];
    if (measured?.type === 'tool_result') {
      expect(measured.content).toContain('"value":4');
    }
  });

  it('system prompt carries the persona and the fidelity rules', async () => {
    const provider = new FakeProvider([doneTurn('Nothing to do.')]);
    await runAnalyst({
      prompt: 'hello',
      graph: fixtureGraph(),
      parts,
      provider,
      simulate: fakeSimulate().fn,
    });
    const system = provider.turns[0]?.system ?? '';
    expect(system).toContain("skeptical of everything until it's plotted");
    expect(system).toContain('fidelity manifest');
    expect(system).toContain('read_design BEFORE your first simulation');
    expect(system).toContain('time-constants');
    expect(system).toContain('NEVER claim precision beyond the model tier');
  });

  it('exposes exactly the analyst tools to the provider', async () => {
    const provider = new FakeProvider([doneTurn('ok')]);
    await runAnalyst({
      prompt: 'hi',
      graph: fixtureGraph(),
      parts,
      provider,
      simulate: fakeSimulate().fn,
    });
    const names = provider.turns[0]?.tools.map((t) => t.name).sort();
    expect(names).toEqual(['measure', 'read_design', 'run_simulation']);
  });

  it('measure before run_simulation surfaces as is_error and the loop recovers', async () => {
    const provider = new FakeProvider([
      [
        use('t1', 'measure', { vector: 'v(out)', metric: 'rms' }),
        { kind: 'done', stopReason: 'tool_use' },
      ],
      [use('t2', 'run_simulation', { analysis: TRAN }), { kind: 'done', stopReason: 'tool_use' }],
      doneTurn('Ran it properly this time.'),
    ]);

    const result = await runAnalyst({
      prompt: 'measure first by mistake',
      graph: fixtureGraph(),
      parts,
      provider,
      simulate: fakeSimulate().fn,
    });

    const errored = lastToolResults(provider, 1)[0];
    expect(errored).toMatchObject({ type: 'tool_result', tool_use_id: 't1', is_error: true });
    if (errored?.type === 'tool_result') {
      expect(errored.content).toMatch(/run_simulation first/);
    }
    expect(result.finalText).toBe('Ran it properly this time.');
  });

  it('a rejecting simulate becomes a tool error, never a thrown run', async () => {
    const provider = new FakeProvider([
      [use('t1', 'run_simulation', { analysis: TRAN }), { kind: 'done', stopReason: 'tool_use' }],
      doneTurn('The matrix is singular — check for a floating node.'),
    ]);

    const result = await runAnalyst({
      prompt: 'simulate',
      graph: fixtureGraph(),
      parts,
      provider,
      simulate: () => Promise.reject(new Error('singular matrix')),
    });

    const errored = lastToolResults(provider, 1)[0];
    expect(errored).toMatchObject({ type: 'tool_result', is_error: true, content: 'singular matrix' });
    expect(result.finalText).toMatch(/floating node/);
  });

  it('emits tool_use events through onEvent and respects maxTurns', async () => {
    const provider = new FakeProvider([
      [use('t1', 'read_design', {}), { kind: 'done', stopReason: 'tool_use' }],
      [use('t2', 'read_design', {}), { kind: 'done', stopReason: 'tool_use' }],
      [use('t3', 'read_design', {}), { kind: 'done', stopReason: 'tool_use' }],
    ]);
    const seen: string[] = [];
    await runAnalyst({
      prompt: 'loop forever',
      graph: fixtureGraph(),
      parts,
      provider,
      simulate: fakeSimulate().fn,
      maxTurns: 2,
      onEvent: (ev) => {
        if (ev.kind === 'tool_use') seen.push(ev.name);
      },
    });
    expect(seen).toEqual(['read_design', 'read_design']);
    expect(provider.turns).toHaveLength(2);
  });
});
