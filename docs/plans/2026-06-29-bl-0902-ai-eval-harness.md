# BL-0902: Golden-set regression eval harness for `@protopulse/ai`

> **For Claude:** REQUIRED SUB-SKILL — use `superpowers:executing-plans` to implement task-by-task. Follows the mandatory plan template ([docs/plans/2026-03-05-pcb-layout-engine.md](2026-03-05-pcb-layout-engine.md)).

**Goal:** Promote the existing `FakeProvider` scenario tests scattered across `packages/ai/src/*.test.ts` into a **first-class, named, CI-gated golden-regression eval** under `packages/ai/evals/` — representative per-persona cases with expected/acceptable outputs and a one-command runner wired into `packages-ci.yml`, so a change to a STRICT RULES block, the agent loop, or a tool's dispatch **cannot silently regress crew behavior**. This is the backlog's self-identified "single highest-value Axis-B gap." Engine-only; the frozen `server/ai.ts` is never touched.

**Architecture:** A thin, deterministic golden-eval layer built on the *existing* `FakeProvider` substrate — **not** an LLM-as-judge framework (the provider is scripted, so scoring is fully deterministic: code, not a judge). Each golden scenario asserts on two surfaces the scripted provider exposes for free: **(a)** the *assembled system prompt* (`FakeProvider.turns[i].system` — catches persona/STRICT-RULES/digest drift), and **(b)** the *agent-produced output* (op envelopes + normalized tool-call sequence + stop reason — catches loop/tool drift). Scenarios live as data; one `runGoldenScenario` helper drives them; a dedicated Vitest project keeps the eval a **separate gated runner** from unit tests. A documented migration seam lets a future *live-model* eval adopt `vitest-evals` ([§ADR-style decision](#decision-hand-roll-now-migration-seam-to-vitest-evals)) without rewriting the case corpus.

**Tech Stack:** TypeScript 5.6 + Vitest 4 (existing) + the existing `@protopulse/ai` `FakeProvider`/`runAgentLoop` + a new `vitest.eval.config.ts` project. **No new runtime dependencies.**

---

## Context

`@protopulse/ai` already has deterministic, eval-adjacent scenario tests: 7 `*.test.ts` files construct `new FakeProvider([...scriptedTurns])`, drive a `run<Persona>` entry point, and assert on emitted ops/transcript. They are not, however, a *named, gated regression eval* — they're interleaved with unit tests, have no shared case schema, no per-persona golden corpus, and nothing in CI flags "the Draftsman's tool-selection trajectory changed."

The audit (`docs/audits/2026-06-28-ai-first-assessment.md`) opened BL-0902 to close that Axis-B gap. This plan turns the scattered scenarios into a first-class corpus.

### Why deterministic (no LLM judge)

`FakeProvider` ([packages/ai/src/fake-provider.ts](../../packages/ai/src/fake-provider.ts)) returns pre-baked `AgentEvent[][]` turns and records every request in `.turns`. The model is *scripted*, so every observable is deterministic — there is nothing to "judge." Per the eval-harness literature, schema conformance, tool-call recall/precision, forbidden-tool checks, and token/turn budgets are **code, not LLM calls** ([Confident AI](https://www.confident-ai.com/blog/llm-agent-evaluation-complete-guide), [Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/evals)). This harness is the deterministic-scoring subset: pure golden assertions, no flake, no 3×-median needed.

### What a golden scenario catches

| Change | Caught via |
|---|---|
| Persona literal / STRICT RULES edit | assert on `provider.turns[0].system` content |
| `assembleContext()` budget/format drift | assert on digest section markers in the assembled prompt |
| Agent-loop change (turn handling, stop conditions) | assert on op-envelope sequence + stop reason |
| Tool dispatch / arg-schema change | assert on normalized `toolCalls` names + args |
| Scoped-slice leak (persona calls a tool outside its slice) | assert tool names ⊆ persona's `*_TOOL_NAMES` |

---

## Existing Infrastructure Summary

| Module | File | Status |
|---|---|---|
| Scripted provider | [packages/ai/src/fake-provider.ts](../../packages/ai/src/fake-provider.ts) | `FakeProvider(scripted: AgentEvent[][])`; records `.turns` (requests incl. `.system`). READ; do not modify in this wave. |
| Agent loop | [packages/ai/src/agent.ts](../../packages/ai/src/agent.ts) | `runAgentLoop` / `runDraftsman`; `maxTurns` 8. Emits `AgentEvent[]`. |
| Per-persona entry points | `analyst.ts`, `architect.ts`, `professor.ts`, `buyer.ts`, `router.ts` | `run<Persona>(opts)` → ops/envelopes/transcript/finalText. |
| Existing scenario tests (the seed corpus) | `agent.test.ts` (~12), `router/architect/professor/analyst/buyer.test.ts` | Source material — lift representative cases, do NOT delete the unit tests. |
| Tool-name constants (scope sets) | `DRAFTSMAN_TOOL_NAMES`, `ANALYST_TOOL_NAMES`, `PROFESSOR_TOOL_NAMES`, `ARCHITECT_TOOLS`, `BUYER_TOOLS`, `ROUTER_TOOLS` | Already exported from `index.ts` — use for scoped-slice assertions. |
| Package README | [packages/ai/README.md](../../packages/ai/README.md) | Documents the crew + the eval intent (BL-0903). Update its Testing §. |
| Packages CI | [.github/workflows/packages-ci.yml](../../.github/workflows/packages-ci.yml) | Single `packages` job; add a named eval step after `test:packages`. |
| Eval framework (evaluated, NOT adopted) | `vitest-evals` (`/getsentry/vitest-evals`) | Vitest-native, built-in tool-call scorers + LLM judges. Headline value (judges) unused in a deterministic suite — see decision below. |

---

## Decision: hand-roll now, migration seam to `vitest-evals`

**Status:** Decided (plan-stage; advisor-reviewed). **Date:** 2026-06-29.

**Context.** `vitest-evals` ([getsentry](https://github.com/getsentry/vitest-evals)) is a Vitest-native eval framework: `describeEval(name, {harness, judges, judgeThreshold}, define)`, an `it.for([...cases])` table, `toolCalls(session)` normalization, and auto-running LLM-as-judge scorers gated by `judgeThreshold`. It is built for **live-model** output that needs judging.

**Decision.** Hand-roll a thin deterministic golden-eval layer on the existing `FakeProvider`; do **not** add `vitest-evals` now. Keep the scenario schema shaped so a future live-model eval can adopt `vitest-evals`'s harness/`toolCalls` interface mechanically.

**Rationale.**
1. **The provider is scripted → judges are dead weight.** `vitest-evals`'s core value (judges, `judgeThreshold`, scorer adapters) evaluates non-deterministic output. Our output is deterministic; we'd disable judges entirely (`judgeThreshold: null`) and use only `it.for` + `toolCalls` — a thin slice we replicate in ~30 lines.
2. **Adoption doesn't remove work.** `vitest-evals` needs a *harness adapter* mapping `run<Persona>` + `FakeProvider` into its `EvalHarnessRun` (`.output`/`.session`) shape. We'd write that adapter regardless — so adopting *adds* a dependency + integration surface without deleting the work it claims to save.
3. **The redesign values lean deps.** `@protopulse/ai` ships 5 deps; the engine prizes minimal surface. A golden-regression suite over a fake provider needs no framework.
4. **Reversible by design.** A `GoldenScenario` type + `runGoldenScenario` helper + a `toolNamesOf(events)` normalizer give the same authoring ergonomics; the migration seam (a `Harness` interface mirroring `vitest-evals`) makes a later switch mechanical **if/when** ProtoPulse wants real-Anthropic, judge-scored evals.

**Revisit when:** a live-model (real `AnthropicProvider`) eval is wanted, or judge-based scoring of free-text crew explanations becomes a requirement. At that point adopt `vitest-evals` behind the `Harness` seam and keep the deterministic corpus as the regression tier.

---

## Phase Overview

| Phase | Description | Concurrency | Output |
|---|---|---|---|
| **Phase 0** | Pre-phase research + golden-scenario schema design | Lead only | `packages/ai/evals/README.md` + `schema.ts` (types) |
| **Phase 1** | Eval engine — `runGoldenScenario` + normalizers + the separate Vitest project | Lead only (single owner, foundational) | `packages/ai/evals/harness.ts`, `vitest.eval.config.ts`, npm script |
| **Phase 2** | Per-persona golden corpora — lift + harden representative cases | `/agent-teams` ≤5 teammates, file-isolated per persona | `packages/ai/evals/<persona>.eval.ts` ×6 |
| **Phase 3** | CI wiring + runner + docs + backlog closeout | Lead only | `packages-ci.yml` step, README Testing §, BL-0902 → DONE |

> **Agent cap (per [feedback_agent_count_cap.md](../../.claude/memory/feedback_agent_count_cap.md)):** Phase 2 = ≤5 teammates + lead = ≤6. No other background agents/`codex exec` during Phase 2.

---

## Phase 0 — Research & schema design (lead only)

### Task 0.1 — Pre-phase research (mandatory, per [feedback_research_before_each_phase.md](../../.claude/memory/feedback_research_before_each_phase.md))
- **Context7 — Vitest 4 multiple projects / `test.projects`:** how to declare a *separate* eval project so `npm run test:packages` (unit) and the eval runner are distinct gates. Query `/vitest-dev/vitest` "define a separate test project that runs independently, custom include glob, run via --project".
- **Context7 — Vitest `it.for` / `test.for` table tests + `expect().toMatchObject`:** the table-case ergonomics for the corpus.
- **WebSearch (done 2026-06-29, re-confirm deltas):** golden-trace regression patterns, deterministic tool-call precision scoring, CI threshold gating ([Motom](https://www.motomtech.com/blog-post/agentic-ai-eval-harness-golden-tests/), [DeepEval](https://deepeval.com/blog/what-is-an-eval-harness), [Confident AI](https://www.confident-ai.com/blog/llm-agent-evaluation-complete-guide)).
- Re-read `vitest-evals` `toolCalls`/`describeEval` shape so the `Harness` seam mirrors it ([README](https://github.com/getsentry/vitest-evals/blob/main/packages/vitest-evals/README.md)).

### Task 0.2 — Golden-scenario schema (`packages/ai/evals/schema.ts`)
Design the data shape every persona case uses. Proposed:

```ts
export interface GoldenScenario<Meta = unknown> {
  /** Stable id, e.g. "draftsman/555-astable". Used in snapshots + CI output. */
  id: string;
  persona: 'draftsman' | 'analyst' | 'professor' | 'architect' | 'buyer' | 'router';
  /** Human prompt handed to run<Persona>. */
  input: string;
  /** Scripted model turns the FakeProvider replays (the "gold trajectory"). */
  scriptedTurns: AgentEvent[][];
  /** Fixture design the scenario runs against (graph + parts builder). */
  fixture: () => ScenarioFixture;
  /** Deterministic expectations. */
  expect: {
    /** Substrings that MUST appear in the assembled system prompt (turn 0). */
    promptIncludes: string[];
    /** Exact normalized tool-call name sequence the loop must emit. */
    toolSequence: string[];
    /** Tool names must be a subset of this scope set (scoped-slice guard). */
    toolScope: readonly string[];
    /** Stop reason / turn-count bound. */
    stop: { reason: string; maxTurns: number };
    /** Optional op-envelope assertions (count, kinds). */
    ops?: { count?: number; kinds?: string[] };
  };
  meta?: Meta;
}
```

**Output:** `packages/ai/evals/schema.ts` + `packages/ai/evals/README.md` (how to author a case; the deterministic-not-judge rationale; the migration seam).

---

## Phase 1 — Eval engine (lead only — single owner, foundational)

### Task 1.1 — Normalizers (`packages/ai/evals/normalize.ts`)
TDD. Pure helpers over `AgentEvent[]` / `FakeProvider`:
- `toolNamesOf(events: AgentEvent[]): string[]` — extract `tool_use` names in order.
- `assembledSystemPrompt(provider: FakeProvider, turn = 0): string` — `provider.turns[turn].system`.
- `opEnvelopesOf(result): OpEnvelope[]` — pull envelopes from a `run<Persona>` result.
RED: `normalize.test.ts` asserts each over a hand-built event array → GREEN.

### Task 1.2 — `runGoldenScenario` (`packages/ai/evals/harness.ts`)
TDD. The driver:
```ts
export async function runGoldenScenario(s: GoldenScenario): Promise<GoldenResult> {
  const provider = new FakeProvider(s.scriptedTurns);
  const { graph, parts } = s.fixture();
  const result = await runPersona(s.persona, { prompt: s.input, graph, parts, provider });
  return {
    system: assembledSystemPrompt(provider),
    toolCalls: toolNamesOf(result /* or provider-recorded events */),
    ops: opEnvelopesOf(result),
    stop: result.stopReason, turns: provider.turns.length,
  };
}
```
Plus `assertGolden(scenario, result)` applying every `expect` clause with precise failure messages (which clause, scenario id). RED: `harness.test.ts` with one trivial draftsman scenario fails → implement → GREEN.

### Task 1.3 — Separate Vitest project + runner script
- `packages/ai/vitest.eval.config.ts` — `include: ['evals/**/*.eval.ts']`, distinct from unit `include`.
- Root script: `"eval:ai": "vitest run --project ai-evals"` (or `npm run -w @protopulse/ai eval`), confirmed against the Context7 Vitest `projects` API from Task 0.1.
- Verify `npm run test:packages` does **not** pick up `*.eval.ts` (and vice-versa) — the two gates stay separate.

**Critical:** Phase 1 is a single owner (foundational; Phase 2 depends on the schema + harness being stable). Do not parallelize.

---

## Phase 2 — Per-persona golden corpora (`/agent-teams`, ≤5 teammates)

Each teammate owns ONE persona's `*.eval.ts` (Draftsman folded into Analyst's owner or taken by the lead to stay ≤5). Lift representative scenarios from the existing `*.test.ts`, harden them into `GoldenScenario`s with full `expect` clauses (prompt substrings from the real persona STRICT RULES, exact tool sequences, scope set = the persona's `*_TOOL_NAMES`).

**File ownership (non-negotiable, [feedback_no_stepping_on_teammates.md](../../.claude/memory/feedback_no_stepping_on_teammates.md)):**

| Teammate | Owns | Source seed | Scope set |
|---|---|---|---|
| 1 `eval-draftsman` | `evals/draftsman.eval.ts` | `agent.test.ts` | `DRAFTSMAN_TOOL_NAMES` |
| 2 `eval-analyst` | `evals/analyst.eval.ts` | `analyst.test.ts` | `ANALYST_TOOL_NAMES` |
| 3 `eval-professor` | `evals/professor.eval.ts` | `professor.test.ts` | `PROFESSOR_TOOL_NAMES` |
| 4 `eval-architect` | `evals/architect.eval.ts` | `architect.test.ts` | `ARCHITECT_TOOLS` |
| 5 `eval-buyer-router` | `evals/buyer.eval.ts` + `evals/router.eval.ts` | `buyer.test.ts`, `router.test.ts` | `BUYER_TOOLS`, `ROUTER_TOOLS` |

Per-persona target: **≥3 representative scenarios** (happy path + one scope-edge + one stop/budget edge). Each `*.eval.ts` runs the corpus through `runGoldenScenario` + `assertGolden`. Per-file commit. `npm run eval:ai` green before commit.

**Pre-flight for every teammate:** read `evals/README.md` + `evals/schema.ts` + `evals/harness.ts`; read the persona's real `build<Persona>SystemPrompt` so `promptIncludes` substrings are *real* STRICT RULES, not invented; Context7-verify any Vitest API before use. Do NOT modify `fake-provider.ts`, the `run<Persona>` sources, or another teammate's file.

---

## Phase 3 — CI wiring + docs + closeout (lead only)

### Task 3.1 — `packages-ci.yml`
Add, after the `test:packages` step:
```yaml
      - name: AI crew regression eval (golden, deterministic)
        run: npm run eval:ai
```
Named, gated (non-zero exit fails the build). No secrets — fully offline (scripted provider).

### Task 3.2 — Docs
- Update [packages/ai/README.md](../../packages/ai/README.md) Testing § to point at `evals/` + `npm run eval:ai` and state the gate.
- `evals/README.md` finalized (authoring guide + migration seam).

### Task 3.3 — Backlog closeout
- BL-0902 → **DONE** (Wave/commit refs); note corpus size + CI step.
- Quick Stats: P1 open 3→2, done 74→75; Total open 5→4, done 509→510.
- If the eval surfaces a real behavioral bug in a persona, open a new BL — do not paper over it.

---

## Verification (end-to-end)

1. `npm run check:packages` — zero errors (engine typecheck; mind the emu OOM trap — eval work is `@protopulse/ai`-local, so `cd packages/ai && npx tsc --noEmit` is the fast check).
2. `npm run eval:ai` — full golden corpus green; intentionally break one STRICT RULES substring locally and confirm the matching scenario **fails** (proves the gate bites), then revert.
3. `npm run test:packages` — unit tests still green AND do not run `*.eval.ts` (gates are separate).
4. Confirm the new CI step appears in a PR run (or `act`/dry-read the workflow) and is gating.

---

## Dependencies & downstream

```
Phase 0 (schema + research) → Phase 1 (engine, single owner) → Phase 2 (≤5 teammates, file-isolated) → Phase 3 (CI + closeout)
```
- **Unblocks:** the Axis-B regression-safety story the audit flagged; gives BL-0903's descoped prompt-versioning its *behavioral* guarantee (prompt edits now caught by `promptIncludes` assertions). Future live-model evals adopt the `Harness` seam.

## Out of scope (explicitly deferred)
- **`vitest-evals` adoption / LLM-as-judge scoring** — deferred behind the migration seam (see decision). Revisit when live-model evals are wanted.
- **Real `AnthropicProvider` (network) evals** — this harness is offline/deterministic by design.
- **Deleting or refactoring the existing `*.test.ts` unit tests** — they stay; the eval corpus is additive.
- **`server/ai.ts`** — frozen.

## Critical files (quick reference)
| File | Role |
|---|---|
| [packages/ai/src/fake-provider.ts](../../packages/ai/src/fake-provider.ts) | Scripted substrate (READ; do not modify) |
| `packages/ai/evals/schema.ts` | Phase 0 — `GoldenScenario` type |
| `packages/ai/evals/harness.ts` | Phase 1 — `runGoldenScenario` + `assertGolden` |
| `packages/ai/evals/normalize.ts` | Phase 1 — event/prompt normalizers |
| `packages/ai/vitest.eval.config.ts` | Phase 1 — separate eval project |
| `packages/ai/evals/<persona>.eval.ts` | Phase 2 — golden corpora (×6) |
| [.github/workflows/packages-ci.yml](../../.github/workflows/packages-ci.yml) | Phase 3 — gated CI step |
| [docs/MASTER_BACKLOG.md](../../docs/MASTER_BACKLOG.md) | Phase 3 — BL-0902 closeout |
