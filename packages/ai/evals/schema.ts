/**
 * Golden-regression eval schema (BL-0902). A scenario is data; a per-persona
 * adapter runs it against a scripted `FakeProvider` and returns a normalized
 * `GoldenRun` that `assertGolden` checks. Deterministic — the provider is
 * scripted, so there is nothing to judge: every observable is code.
 *
 * See ./README.md for the authoring guide + the migration seam to a live
 * (real-provider, judge-scored) tier if one is ever wanted.
 */
import type { AgentEvent, LlmTurn } from '../src/provider.js';

export type Persona =
  | 'draftsman'
  | 'analyst'
  | 'professor'
  | 'architect'
  | 'buyer'
  | 'router';

/** Normalized result of running one scenario — the surfaces we assert on. */
export interface GoldenRun {
  /** Every LlmTurn the loop sent; `.system` is the assembled system prompt. */
  turns: LlmTurn[];
  /** `tool_use` names in dispatch order (collected via the loop's onEvent). */
  toolCalls: string[];
  /** The persona's final assistant text. */
  finalText: string;
  /** Count of applied ops (0 for read-only personas). */
  opCount: number;
  /** Applied op type tags, if the adapter chooses to surface them. */
  opKinds?: string[];
}

/** Deterministic expectations for one scenario. */
export interface GoldenExpect {
  /** Substrings that MUST appear in the assembled system prompt. */
  promptIncludes: string[];
  /** Exact `tool_use` name sequence the loop must emit, in order. */
  toolSequence: string[];
  /** Every called tool name must be a member of this scope set (slice guard). */
  toolScope: readonly string[];
  /** Optional: substrings the final text must contain. */
  finalTextIncludes?: string[];
  /** Optional: op-count / op-kind assertions. */
  ops?: { count?: number; minCount?: number; kinds?: string[] };
  /** Which turn carries the system prompt to check (default 0). */
  promptTurn?: number;
}

export interface GoldenScenario {
  /** Stable id, e.g. "draftsman/led-limiter" — used in failure messages. */
  id: string;
  persona: Persona;
  /** Human prompt handed to the persona's `run<Persona>`. */
  input: string;
  /** Scripted model turns the FakeProvider replays (the gold trajectory). */
  scriptedTurns: AgentEvent[][];
  expect: GoldenExpect;
}

/**
 * A persona adapter owns the (necessarily persona-specific) wiring:
 * build the scoped registry + fixtures, run `run<Persona>` with a scripted
 * provider, and normalize the result into a `GoldenRun`. Phase-2 per-persona
 * eval files each supply one.
 */
export type PersonaAdapter = (scenario: GoldenScenario) => Promise<GoldenRun>;
