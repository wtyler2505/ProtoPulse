import { makePortRef, materialize } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { FakeProvider } from './fake-provider.js';
import { runProfessor } from './professor.js';

import type { AgentEvent, ProviderContentBlock } from './provider.js';
import type { CodeToConcept, ConceptLookup } from './tools/professor.js';
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

const concepts: ConceptLookup = (slug) =>
  slug === 'pull-up-pull-down'
    ? { title: 'Pull-up and pull-down resistors', body: 'A resistor that defines the idle level.' }
    : undefined;

const codeToConcept: CodeToConcept = (code) =>
  code === 'ERC-OC-NO-PULLUP' ? 'pull-up-pull-down' : undefined;

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

function run(provider: FakeProvider, opts: Partial<Parameters<typeof runProfessor>[0]> = {}) {
  return runProfessor({
    prompt: 'Explain this finding: ERC-OC-NO-PULLUP on VOUT',
    graph: fixtureGraph(),
    parts,
    provider,
    concepts,
    codeToConcept,
    ...opts,
  });
}

describe('runProfessor end-to-end (FakeProvider — no network)', () => {
  it('read_design → explain_finding → lookup is fed back and the lesson lands', async () => {
    const provider = new FakeProvider([
      [use('t1', 'read_design', {}), { kind: 'done', stopReason: 'tool_use' }],
      [
        use('t2', 'explain_finding', { code: 'ERC-OC-NO-PULLUP', message: 'no pull-up on VOUT' }),
        { kind: 'done', stopReason: 'tool_use' },
      ],
      doneTurn(
        'Per "Pull-up and pull-down resistors": R1 on VOUT needs a pull-up because nothing defines the idle level.',
      ),
    ]);

    const result = await run(provider);

    expect(result.finalText).toMatch(/R1 on VOUT/);
    expect(result.depth).toBe('show-me'); // the default

    // Turn 2 saw the design digest.
    const digest = lastToolResults(provider, 1)[0];
    expect(digest).toMatchObject({ type: 'tool_result', tool_use_id: 't1' });
    if (digest?.type === 'tool_result') {
      expect(digest.content).toContain('R1 10k Resistor');
      expect(digest.content).toContain('VOUT');
    }

    // Turn 3 saw the mapped concept + article as pure data.
    const mapped = lastToolResults(provider, 2)[0];
    expect(mapped).toMatchObject({ type: 'tool_result', tool_use_id: 't2' });
    if (mapped?.type === 'tool_result') {
      expect(mapped.content).toContain('"conceptSlug":"pull-up-pull-down"');
      expect(mapped.content).toContain('Pull-up and pull-down resistors');
    }
  });

  it('system prompt carries the persona and the grounding rules', async () => {
    const provider = new FakeProvider([doneTurn('Hello.')]);
    await run(provider);
    const system = provider.turns[0]?.system ?? '';
    expect(system).toContain('never tired, never condescending, depth-adjustable');
    expect(system).toContain("THIS design's actual nets and refs");
    expect(system).toContain('cite the article you consulted');
    expect(system).toContain('NEVER invent component values');
    expect(system).toContain('R1'); // the real design leaks into the prompt
  });

  it.each([
    ['do-it', 'ONE terse paragraph'],
    ['show-me', 'explanation AND the why'],
    ['teach-me', 'first principles'],
  ] as const)('depth %s sets its register in the system prompt', async (depth, marker) => {
    const provider = new FakeProvider([doneTurn('ok')]);
    const result = await run(provider, { depth });
    expect(provider.turns[0]?.system).toContain(marker);
    expect(result.depth).toBe(depth);
  });

  it('teach-me register demands a See-it experiment', async () => {
    const provider = new FakeProvider([doneTurn('ok')]);
    await run(provider, { depth: 'teach-me' });
    expect(provider.turns[0]?.system).toContain('See it yourself');
  });

  it('exposes exactly the professor tools to the provider', async () => {
    const provider = new FakeProvider([doneTurn('ok')]);
    await run(provider);
    const names = provider.turns[0]?.tools.map((t) => t.name).sort();
    expect(names).toEqual(['explain_finding', 'lookup_concept', 'read_design']);
  });

  it('an unknown concept lookup surfaces as is_error and the loop recovers', async () => {
    const provider = new FakeProvider([
      [use('t1', 'lookup_concept', { slug: 'nope' }), { kind: 'done', stopReason: 'tool_use' }],
      doneTurn('That article is not written yet, but here is the gist.'),
    ]);
    const result = await run(provider);
    const errored = lastToolResults(provider, 1)[0];
    expect(errored).toMatchObject({ type: 'tool_result', tool_use_id: 't1', is_error: true });
    expect(result.finalText).toMatch(/not written yet/);
  });

  it('emits tool_use events through onEvent and respects maxTurns', async () => {
    const provider = new FakeProvider([
      [use('t1', 'read_design', {}), { kind: 'done', stopReason: 'tool_use' }],
      [use('t2', 'read_design', {}), { kind: 'done', stopReason: 'tool_use' }],
      [use('t3', 'read_design', {}), { kind: 'done', stopReason: 'tool_use' }],
    ]);
    const seen: string[] = [];
    await run(provider, {
      maxTurns: 2,
      onEvent: (ev) => {
        if (ev.kind === 'tool_use') seen.push(ev.name);
      },
    });
    expect(seen).toEqual(['read_design', 'read_design']);
    expect(provider.turns).toHaveLength(2);
  });
});
