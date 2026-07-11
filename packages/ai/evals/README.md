# `@protopulse/ai` golden-regression eval (BL-0902)

A **deterministic** golden-regression harness over the crew runtime. It is not
an LLM-as-judge framework: every persona runs against a **scripted**
`FakeProvider`, so every observable is code, not a judgment. Each scenario
asserts on the two surfaces the scripted provider exposes for free:

1. **the assembled system prompt** (`provider.turns[i].system`) — catches
   persona / STRICT-RULES / `assembleContext` digest drift;
2. **the agent-produced trajectory** (tool-call sequence + scope + op count) —
   catches agent-loop / tool-dispatch / scoped-slice drift.

## Run it

```bash
npm run eval:ai          # from the repo root — the gated runner
npm run -w @protopulse/ai eval
```

This is a **separate gate** from the unit suite: `npm run test:packages` runs
`src/**` unit tests and never these; `eval:ai` runs `evals/**` and only these.
Both are wired into `.github/workflows/packages-ci.yml`.

## Anatomy

| File | Role |
|---|---|
| `schema.ts` | `GoldenScenario` (data) + `GoldenRun` (normalized result) + `GoldenExpect` |
| `harness.ts` | The reusable core — `toolCallCollector`, `systemPromptOf`, `assertGolden`. Vitest-free, unit-tested in `harness.test.ts`. |
| `suite.ts` | `describeGolden(persona, scenarios, adapter)` — the Vitest binding |
| `<persona>.eval.ts` | One per persona: the **adapter** (persona-specific wiring) + the golden scenario corpus |

## Authoring a scenario

Each persona wires its own registry + fixtures, so each `*.eval.ts` supplies a
small **adapter** `(scenario) => GoldenRun` and a list of `GoldenScenario`s,
then calls `describeGolden`. See `draftsman.eval.ts` as the reference:

```ts
async function runDraftsmanScenario(scenario: GoldenScenario): Promise<GoldenRun> {
  const provider = new FakeProvider(scenario.scriptedTurns);
  const collector = toolCallCollector();
  const result = await runDraftsman({
    prompt: scenario.input,
    graph: emptyGraph(), parts: seedPartDb(),
    provider, registry: createDraftsmanRegistry(),
    onEvent: collector.onEvent,          // <- captures the tool-call trajectory
  });
  return { turns: provider.turns, toolCalls: collector.names,
           finalText: result.finalText, opCount: result.ops.length };
}

describeGolden('draftsman', SCENARIOS, runDraftsmanScenario);
```

Rules for good scenarios:
- **`promptIncludes` must be REAL substrings** of the persona's actual
  `build<Persona>SystemPrompt` STRICT RULES — not invented. Read the source.
- **`toolScope` = the persona's exported `*_TOOL_NAMES` / `*_TOOLS` constant**,
  so a scope leak (calling a tool outside the slice) fails the eval.
- Cover, per persona, at least: one happy path, one scope/stop edge, one
  budget/no-op edge.
- Scenario `id`s are `"<persona>/<slug>"` and appear in failure messages.

## Why deterministic (no judge)

The provider is scripted, so tool-call recall/precision, prompt-substring
presence, scope conformance, and op counts are all **code** — the deterministic
subset of the eval-harness literature. No flake, no 3×-median, no LLM judge.

## Migration seam (live-model tier — not built)

If a *live-model* eval is ever wanted (real `AnthropicProvider`, judge-scored
free-text), adopt `vitest-evals` (getsentry) behind the same scenario corpus:
its `describeEval` / `toolCalls(session)` map onto our `GoldenScenario` /
`toolCalls`, and its `judges`/`judgeThreshold` add the scoring this
deterministic tier deliberately omits. This tier stays as the regression floor.
Rationale + decision: `docs/plans/2026-06-29-bl-0902-ai-eval-harness.md`.
