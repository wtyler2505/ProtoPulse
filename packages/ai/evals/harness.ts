/**
 * Golden-eval harness (BL-0902) — the three reusable pieces every persona
 * adapter shares: collect the tool-call trajectory, read the assembled system
 * prompt, and assert a GoldenRun against a scenario's expectations. No Vitest
 * dependency: `assertGolden` throws a plain Error (which fails the enclosing
 * `it(...)`), so the harness stays unit-testable on its own.
 */
import type { AgentEvent, LlmTurn } from '../src/provider.js';
import type { GoldenRun, GoldenScenario } from './schema.js';

/**
 * An onEvent sink that records `tool_use` names in dispatch order. Pass
 * `.onEvent` to `run<Persona>({ onEvent })`; read `.names` after.
 */
export function toolCallCollector(): {
  onEvent: (ev: AgentEvent) => void;
  names: string[];
} {
  const names: string[] = [];
  return {
    names,
    onEvent: (ev) => {
      if (ev.kind === 'tool_use') names.push(ev.name);
    },
  };
}

/** The assembled system prompt for a given turn (default the first). */
export function systemPromptOf(turns: LlmTurn[], turn = 0): string {
  return turns[turn]?.system ?? '';
}

/**
 * Assert a run satisfies a scenario. Throws a plain Error tagged with the
 * scenario id on the first failed clause — deterministic, no LLM judge.
 */
export function assertGolden(scenario: GoldenScenario, run: GoldenRun): void {
  const { id, expect: e } = scenario;

  // (a) Assembled system prompt — catches persona/STRICT-RULES/digest drift.
  const system = systemPromptOf(run.turns, e.promptTurn ?? 0);
  for (const sub of e.promptIncludes) {
    if (!system.includes(sub)) {
      throw new Error(
        `[${id}] system prompt (turn ${e.promptTurn ?? 0}) is missing required substring: ${JSON.stringify(sub)}`,
      );
    }
  }

  // (b) Tool-call trajectory — exact sequence, catches loop/tool drift.
  if (!arrayEq(run.toolCalls, e.toolSequence)) {
    throw new Error(
      `[${id}] tool sequence mismatch\n  expected: ${JSON.stringify(e.toolSequence)}\n  actual:   ${JSON.stringify(run.toolCalls)}`,
    );
  }

  // (c) Scoped-slice guard — no tool outside the persona's own slice.
  const scope = new Set(e.toolScope);
  const leaks = [...new Set(run.toolCalls.filter((n) => !scope.has(n)))];
  if (leaks.length > 0) {
    throw new Error(
      `[${id}] called tools outside persona scope: ${JSON.stringify(leaks)} (allowed: ${JSON.stringify([...scope])})`,
    );
  }

  // Optional: final text.
  for (const sub of e.finalTextIncludes ?? []) {
    if (!run.finalText.includes(sub)) {
      throw new Error(`[${id}] finalText is missing required substring: ${JSON.stringify(sub)}`);
    }
  }

  // Optional: op assertions.
  if (e.ops?.count !== undefined && run.opCount !== e.ops.count) {
    throw new Error(`[${id}] op count expected ${e.ops.count}, got ${run.opCount}`);
  }
  if (e.ops?.minCount !== undefined && run.opCount < e.ops.minCount) {
    throw new Error(`[${id}] op count ${run.opCount} is below minimum ${e.ops.minCount}`);
  }
  if (e.ops?.kinds) {
    const kinds = new Set(run.opKinds ?? []);
    const missing = e.ops.kinds.filter((k) => !kinds.has(k));
    if (missing.length > 0) {
      throw new Error(`[${id}] op kinds missing: ${JSON.stringify(missing)} (got ${JSON.stringify(run.opKinds ?? [])})`);
    }
  }
}

function arrayEq(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
