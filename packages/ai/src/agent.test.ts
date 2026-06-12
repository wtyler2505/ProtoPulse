import { applyOp, emptyGraph  } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { runDraftsman } from './agent.js';
import { FakeProvider } from './fake-provider.js';
import { createDraftsmanRegistry } from './tools/draftsman.js';

import type { AgentEvent } from './provider.js';
import type {DesignGraph} from '@protopulse/graph';

const parts = seedPartDb();

function use(id: string, name: string, input: unknown): AgentEvent {
  return { kind: 'tool_use', id, name, input };
}

function doneTurn(text: string): AgentEvent[] {
  return [{ kind: 'text', text }, { kind: 'done', stopReason: 'end_turn' }];
}

describe('runDraftsman end-to-end (scripted FakeProvider)', () => {
  it('add led + resistor, connect, run_erc → applied ops replay onto a fresh graph', async () => {
    const provider = new FakeProvider([
      [
        use('t1', 'add_component', { part_id: 'core:led' }),
        use('t2', 'add_component', { part_id: 'core:resistor', value: '330' }),
        { kind: 'done', stopReason: 'tool_use' },
      ],
      [
        use('t3', 'connect', { from_port: 'R1:2', to_port: 'D1:A' }),
        { kind: 'done', stopReason: 'tool_use' },
      ],
      [use('t4', 'run_erc', {}), { kind: 'done', stopReason: 'tool_use' }],
      doneTurn('Wired the LED through a 330Ω limiter.'),
    ]);

    const result = await runDraftsman({
      prompt: 'Add an LED with a current-limiting resistor.',
      graph: emptyGraph(),
      parts,
      provider,
      registry: createDraftsmanRegistry(),
    });

    // run_erc proposes no ops; the three mutating calls do.
    expect(result.ops.length).toBeGreaterThanOrEqual(3);
    expect(result.finalText).toBe('Wired the LED through a 330Ω limiter.');

    // Returned ops apply cleanly, in order, to a fresh graph.
    const replay: DesignGraph = emptyGraph();
    for (const op of result.ops) {
      const res = applyOp(replay, op);
      expect(res.ok, res.ok ? '' : res.error).toBe(true);
    }
    const refs = [...replay.components.values()].map((c) => c.ref).sort();
    expect(refs).toEqual(['D1', 'R1']);
    expect(replay.nets.size).toBe(1);
    expect([...replay.nets.values()][0]?.ports).toHaveLength(2);
    expect(replay.schematic.placements.size).toBe(2);
  });

  it('feeds tool results back to the provider as the next user message', async () => {
    const provider = new FakeProvider([
      [use('t1', 'run_erc', {}), { kind: 'done', stopReason: 'tool_use' }],
      doneTurn('All clear.'),
    ]);
    const result = await runDraftsman({
      prompt: 'Check the design.',
      graph: emptyGraph(),
      parts,
      provider,
      registry: createDraftsmanRegistry(),
    });

    // Second turn's last message must be the tool_result for t1.
    const secondTurn = provider.turns[1];
    const lastMsg = secondTurn?.messages[secondTurn.messages.length - 1];
    expect(lastMsg?.role).toBe('user');
    const blocks = lastMsg?.content;
    expect(Array.isArray(blocks)).toBe(true);
    if (Array.isArray(blocks)) {
      expect(blocks[0]).toMatchObject({ type: 'tool_result', tool_use_id: 't1' });
      expect(blocks[0]?.type === 'tool_result' ? blocks[0].content : '').toMatch(/ERC clean/);
    }
    expect(result.transcript.length).toBeGreaterThanOrEqual(4);
  });

  it('destructive gate: declined confirm → no ops applied, tool_result says "user declined"', async () => {
    const provider = new FakeProvider([
      [
        use('t1', 'add_component', { part_id: 'core:led' }),
        { kind: 'done', stopReason: 'tool_use' },
      ],
      doneTurn('Okay, leaving the design untouched.'),
    ]);
    const asked: string[] = [];
    const result = await runDraftsman({
      prompt: 'Add an LED.',
      graph: emptyGraph(),
      parts,
      provider,
      registry: createDraftsmanRegistry(),
      confirmDestructive: (explain) => {
        asked.push(explain);
        return false;
      },
    });

    expect(result.ops).toEqual([]);
    expect(result.envelopes).toEqual([]);
    expect(asked).toEqual(['Place a core:led']);
    const secondTurn = provider.turns[1];
    const lastMsg = secondTurn?.messages[secondTurn.messages.length - 1];
    const blocks = Array.isArray(lastMsg?.content) ? lastMsg.content : [];
    expect(blocks[0]).toMatchObject({ type: 'tool_result', is_error: true, content: 'user declined' });
  });

  it('destructive gate does NOT fire for run_erc', async () => {
    const provider = new FakeProvider([
      [use('t1', 'run_erc', {}), { kind: 'done', stopReason: 'tool_use' }],
      doneTurn('done'),
    ]);
    let confirms = 0;
    await runDraftsman({
      prompt: 'Check it.',
      graph: emptyGraph(),
      parts,
      provider,
      registry: createDraftsmanRegistry(),
      confirmDestructive: () => {
        confirms += 1;
        return true;
      },
    });
    expect(confirms).toBe(0);
  });

  it('writes explain() strings into envelope meta.rationale with agent:draftsman', async () => {
    const provider = new FakeProvider([
      [
        use('t1', 'add_component', { part_id: 'core:resistor', value: '10k', ref: 'R7' }),
        { kind: 'done', stopReason: 'tool_use' },
      ],
      doneTurn('Placed R7.'),
    ]);
    const result = await runDraftsman({
      prompt: 'Add a 10k resistor.',
      graph: emptyGraph(),
      parts,
      provider,
      registry: createDraftsmanRegistry(),
    });
    expect(result.envelopes.length).toBeGreaterThan(0);
    for (const env of result.envelopes) {
      expect(env.meta?.agent).toBe('draftsman');
      expect(env.meta?.rationale).toBe('Place a core:resistor "10k" as R7');
    }
    // Lamport advances monotonically.
    const lamports = result.envelopes.map((e) => e.lamport);
    expect(lamports).toEqual([...lamports].sort((a, b) => a - b));
  });

  it('surfaces zod validation errors as tool_result errors and keeps looping', async () => {
    const provider = new FakeProvider([
      [
        use('t1', 'connect', { from_port: 'R1:1' }), // missing to_port
        { kind: 'done', stopReason: 'tool_use' },
      ],
      doneTurn('That call was malformed.'),
    ]);
    const result = await runDraftsman({
      prompt: 'Connect things.',
      graph: emptyGraph(),
      parts,
      provider,
      registry: createDraftsmanRegistry(),
    });
    expect(result.ops).toEqual([]);
    const secondTurn = provider.turns[1];
    const lastContent = secondTurn?.messages.at(-1)?.content;
    const blocks = Array.isArray(lastContent)
      ? (lastContent as { type: string; content?: string; is_error?: boolean }[])
      : [];
    expect(blocks[0]?.is_error).toBe(true);
    expect(blocks[0]?.content).toMatch(/invalid input for connect/);
    expect(result.finalText).toBe('That call was malformed.');
  });

  it('rejects out-of-scope tools at dispatch (scoped registry)', async () => {
    const scoped = createDraftsmanRegistry().scoped(['run_erc']);
    const provider = new FakeProvider([
      [
        use('t1', 'add_component', { part_id: 'core:led' }),
        { kind: 'done', stopReason: 'tool_use' },
      ],
      doneTurn('Cannot add components with my current scope.'),
    ]);
    const result = await runDraftsman({
      prompt: 'Add an LED.',
      graph: emptyGraph(),
      parts,
      provider,
      registry: scoped,
    });
    expect(result.ops).toEqual([]);
    const blocks = provider.turns[1]?.messages.at(-1)?.content;
    if (Array.isArray(blocks)) {
      expect(blocks[0]).toMatchObject({ type: 'tool_result', is_error: true });
      expect(blocks[0]?.type === 'tool_result' ? blocks[0].content : '').toMatch(
        /unknown or out-of-scope/,
      );
    }
  });

  it('stops at maxTurns even if the provider keeps calling tools', async () => {
    const endless = Array.from({ length: 20 }, (_, i): AgentEvent[] => [
      use(`t${String(i)}`, 'run_erc', {}),
      { kind: 'done', stopReason: 'tool_use' },
    ]);
    const provider = new FakeProvider(endless);
    await runDraftsman({
      prompt: 'Loop forever.',
      graph: emptyGraph(),
      parts,
      provider,
      registry: createDraftsmanRegistry(),
      maxTurns: 3,
    });
    expect(provider.turns).toHaveLength(3);
  });

  it('system prompt carries the persona, strict rules, and real part ids', async () => {
    const provider = new FakeProvider([doneTurn('hi')]);
    await runDraftsman({
      prompt: 'Hello.',
      graph: emptyGraph(),
      parts,
      provider,
      registry: createDraftsmanRegistry(),
    });
    const system = provider.turns[0]?.system ?? '';
    expect(system).toMatch(/fast hands, tidy wires, opinionated about decoupling/);
    expect(system).toMatch(/ALWAYS run run_erc/);
    expect(system).toMatch(/batch/);
    expect(system).toMatch(/millimeters/);
    expect(system).toMatch(/core:resistor/);
    expect(system).toMatch(/core:ne555/);
    expect(system).toMatch(/NEVER invent part ids/);
  });

  it('emits onEvent for every provider event', async () => {
    const provider = new FakeProvider([
      [use('t1', 'run_erc', {}), { kind: 'done', stopReason: 'tool_use' }],
      doneTurn('done'),
    ]);
    const seen: AgentEvent[] = [];
    await runDraftsman({
      prompt: 'Check.',
      graph: emptyGraph(),
      parts,
      provider,
      registry: createDraftsmanRegistry(),
      onEvent: (ev) => seen.push(ev),
    });
    expect(seen.filter((e) => e.kind === 'tool_use')).toHaveLength(1);
    expect(seen.filter((e) => e.kind === 'done')).toHaveLength(2);
    expect(seen.filter((e) => e.kind === 'text')).toHaveLength(1);
  });

  it('does not mutate the caller graph — ops are for the host to apply', async () => {
    const graph = emptyGraph();
    const provider = new FakeProvider([
      [use('t1', 'add_component', { part_id: 'core:led' }), { kind: 'done', stopReason: 'tool_use' }],
      doneTurn('Added.'),
    ]);
    const result = await runDraftsman({
      prompt: 'Add an LED.',
      graph,
      parts,
      provider,
      registry: createDraftsmanRegistry(),
    });
    expect(result.ops.length).toBeGreaterThan(0);
    expect(graph.components.size).toBe(0); // untouched — host dispatches for real
  });
});
