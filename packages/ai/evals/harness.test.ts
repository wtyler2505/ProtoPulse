/**
 * Unit tests for the golden-eval harness helpers (BL-0902). These exercise
 * the pure assertion/collection logic with no persona wiring — run under the
 * eval project alongside the golden scenarios.
 */
import { describe, expect, it } from 'vitest';

import { assertGolden, systemPromptOf, toolCallCollector } from './harness.js';

import type { LlmTurn } from '../src/provider.js';
import type { GoldenRun, GoldenScenario } from './schema.js';

function turn(system: string): LlmTurn {
  return { system, messages: [], tools: [] };
}

function baseRun(over: Partial<GoldenRun> = {}): GoldenRun {
  return {
    turns: [turn('You are the Draftsman.\nSTRICT RULES:\n- ALWAYS run run_erc')],
    toolCalls: ['add_component', 'run_erc'],
    finalText: 'Done.',
    opCount: 2,
    ...over,
  };
}

function baseScenario(over: Partial<GoldenScenario> = {}): GoldenScenario {
  return {
    id: 'draftsman/unit',
    persona: 'draftsman',
    input: 'Add an LED.',
    scriptedTurns: [],
    expect: {
      promptIncludes: ['You are the Draftsman', 'STRICT RULES'],
      toolSequence: ['add_component', 'run_erc'],
      toolScope: ['add_component', 'run_erc', 'connect'],
    },
    ...over,
  };
}

describe('toolCallCollector', () => {
  it('records tool_use names in order and ignores non-tool events', () => {
    const c = toolCallCollector();
    c.onEvent({ kind: 'text', text: 'thinking' });
    c.onEvent({ kind: 'tool_use', id: 't1', name: 'add_component', input: {} });
    c.onEvent({ kind: 'tool_use', id: 't2', name: 'run_erc', input: {} });
    c.onEvent({ kind: 'done', stopReason: 'end_turn' });
    expect(c.names).toEqual(['add_component', 'run_erc']);
  });
});

describe('systemPromptOf', () => {
  it('returns the requested turn system prompt, empty string when absent', () => {
    const turns = [turn('first'), turn('second')];
    expect(systemPromptOf(turns)).toBe('first');
    expect(systemPromptOf(turns, 1)).toBe('second');
    expect(systemPromptOf(turns, 9)).toBe('');
  });
});

describe('assertGolden', () => {
  it('passes a fully conforming run', () => {
    expect(() => assertGolden(baseScenario(), baseRun())).not.toThrow();
  });

  it('fails when a required prompt substring is missing', () => {
    const s = baseScenario({
      expect: { ...baseScenario().expect, promptIncludes: ['NOT PRESENT'] },
    });
    expect(() => assertGolden(s, baseRun())).toThrow(/system prompt.*missing/);
  });

  it('fails on a tool-sequence mismatch', () => {
    const run = baseRun({ toolCalls: ['run_erc', 'add_component'] });
    expect(() => assertGolden(baseScenario(), run)).toThrow(/tool sequence mismatch/);
  });

  it('fails when a tool is called outside the persona scope', () => {
    const run = baseRun({ toolCalls: ['add_component', 'route_connection'] });
    const s = baseScenario({
      expect: { ...baseScenario().expect, toolSequence: ['add_component', 'route_connection'] },
    });
    expect(() => assertGolden(s, run)).toThrow(/outside persona scope/);
  });

  it('enforces op-count bounds when specified', () => {
    const s = baseScenario({
      expect: { ...baseScenario().expect, ops: { minCount: 3 } },
    });
    expect(() => assertGolden(s, baseRun({ opCount: 2 }))).toThrow(/below minimum/);
  });
});
