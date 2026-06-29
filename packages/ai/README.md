# `@protopulse/ai` — the AI crew runtime

A **provider-agnostic agent runtime** over the canonical design graph: scoped
tool registries enforced at dispatch, a budgeted-and-deterministic context
assembler, a shared tool-calling loop, and the six-member crew —
**Draftsman, Analyst, Professor, Router, Architect, Buyer**. Every agent edits
the design *only* through typed tools that emit op-log envelopes; none of them
describe changes in prose. That single rule is what makes agent work
reviewable, blameable, and undoable like any other op.

This is engine code (`@protopulse/*`), not the legacy app. The shipping
product's AI backend still lives in `server/ai.ts` (genkit) and is **frozen** —
new AI work lands here. See [Relationship to `server/ai.ts`](#relationship-to-serveraits-frozen).

> Build status per milestone lives in [`ROADMAP.md`](../../ROADMAP.md), never here.

---

## The crew

Six personas, one loop. Each is a thin `run<Name>` entry point that builds a
persona system prompt, hands the agent a **scoped** tool registry (it can only
call its own slice), and runs the shared loop until the model stops calling
tools or the turn cap trips. Each persona reads before it writes and is
forbidden from inventing facts the tools didn't return.

| Persona | One-liner | Tools (scoped slice) | Turn cap | Source |
|---|---|---|---|---|
| **Draftsman** | Fast hands, tidy wires — edits the schematic | `add_component`, `connect`, `place_symbol`, `set_wire_geometry`, `rename_net`, `add_constraint`, `run_erc`, `batch` | 8 | `agent.ts`, `tools/draftsman.ts` |
| **Analyst** | Skeptical until it's plotted — verifies by simulating | `read_design`, `run_simulation`, `measure` | 8 | `analyst.ts`, `tools/analyst.ts` |
| **Professor** | Depth-adjustable teacher, concepts wiki at its elbow | `read_design`, `lookup_concept`, `explain_finding` | 8 | `professor.ts`, `tools/professor.ts` |
| **Architect** | Structure is the medium — buses & sheets | `read_structure`, `create_bus`, `create_sheet`, `move_components` | 12 | `architect.ts`, `tools/architect.ts` |
| **Router** | Copper is geometry, clearance is law | `read_board`, `route_connection`, `run_drc`, `remove_trace` | 12 | `router.ts`, `tools/router.ts` |
| **Buyer** | The BOM is the ledger — never invents prices/stock | `read_bom`, `find_offers`, `assign_sourcing`, `sourcing_report` | 12 | `buyer.ts`, `tools/buyer.ts` |

The **Professor** carries a teaching **depth dial** (`do-it` / `show-me` /
`teach-me`, see `depth.ts`) that adjusts register from a terse fix to a
first-principles walkthrough with a "see it yourself" experiment.

---

## Model pins

The runtime is provider-agnostic — every persona talks to an `LlmProvider`
(`provider.ts`), so the model is a swap, not a rewrite. The shipped Anthropic
adapter pins:

| Pin | Value | Where | Overridable |
|---|---|---|---|
| Provider | Anthropic Messages API (`@anthropic-ai/sdk ^0.104.1`) | `package.json` | swap the `LlmProvider` impl |
| Model | **`claude-sonnet-4-6`** | `anthropic.ts:28` (`opts.model ?? …`) | per-instantiation via `AnthropicProviderOptions.model` |
| `max_tokens` | **`8192`** | `anthropic.ts:29` (`opts.maxTokens ?? …`) | per-instantiation via `.maxTokens` |
| Browser exec | `dangerouslyAllowBrowser: true` | `anthropic.ts:26` | — runs in the Tauri/webview with the **user's own key** |

**To re-pin the default model**, change `anthropic.ts:28` and update this
table in the same change — the pin is a product decision, not an
implementation detail. Callers that need a different tier (e.g. Opus for a
hard Architect pass, Haiku for cheap Buyer lookups) pass `model` at
construction; the default is the M1 baseline.

> **No temperature / top-p / stop sequences are set** — the adapter sends
> `model`, `max_tokens`, `system`, `messages`, `tools` only, and takes API
> defaults for sampling. If sampling control becomes a product lever, it
> belongs in `AnthropicProviderOptions`, documented here.

---

## Cost, latency & token budget

What the package *does* bound, and — just as important — what it deliberately
leaves to the host layer.

**Context budget** (`context.ts`) — `assembleContext()` builds the design
digest under fixed per-section caps, chars as a ~4-chars/token proxy, with
deterministic sort order and explicit truncation markers:

| `CONTEXT_BUDGETS` key | Cap | Section |
|---|---|---|
| `components` | 8,000 chars | component list |
| `nets` | 8,000 chars | net connectivity |
| `findings` | 6,000 chars | ERC findings |
| `recentOps` | 6,000 chars | recent operations |

**Turn budget** — every persona caps tool-calling iterations (`maxTurns`,
overridable per run): Draftsman/Analyst/Professor **8**, Architect/Router/Buyer
**12**. The loop stops early when the model returns no tool calls.

**Cost classes** (`CostClass` = `cheap | standard | heavy`, `registry.ts:26`) —
every tool is tagged so a dispatcher/UI can reason about per-call expense.
`read_*` tools are `cheap`; mutating ops are `standard`; `run_simulation` is
`heavy`. Destructive tools additionally gate behind a `confirmDestructive`
hook before they execute.

**Not bounded here (host-layer concerns):** request timeouts, retry/backoff,
rate limiting, $-cost accounting, and token *counting* (the package uses char
budgets as a proxy, not a tokenizer). The host that constructs the provider
owns these.

---

## Architecture

```
run<Persona>(opts)
  ├─ build<Persona>SystemPrompt()    persona literal + STRICT RULES + assembleContext() digest
  ├─ create<Persona>Registry()       scoped tool slice (ToolRegistry)
  └─ runAgentLoop()                  provider.turn() ↔ tool dispatch, until done or maxTurns
        ├─ LlmProvider.turn()        AnthropicProvider | FakeProvider
        ├─ ToolRegistry.dispatch()   zod-validated args, CostClass, confirmDestructive gate
        └─ emits AgentEvent[]        text / tool_use / tool_result / op envelopes
```

- **`ToolRegistry`** (`registry.ts`) — registers `AiTool`s with zod arg
  schemas (`zodToJsonSchema` feeds the provider tool spec), enforces the
  persona's scoped slice at dispatch, returns `DispatchResult`.
- **Context assembler** (`context.ts`) — `assembleContext()` →
  deterministic, budgeted design digest. Shared `designDigest` / `digestSummary`
  (`tools/digest.ts`) back the Analyst and Professor.
- **Providers** — `AnthropicProvider` (thin Messages-API adapter, not
  network-unit-tested) and `FakeProvider` (scripted, deterministic — the
  substrate for scenario tests and the eval harness BL-0902 will formalize).
- **Pinned contracts** — `sim-types.ts` (`ModelTier`, `PinnedSimulateFn`,
  fidelity manifest) and `route-types.ts` (`PinnedRouteFn`, `RouterHooks`,
  DRC digest) keep the AI layer decoupled from the sim/route engines behind
  injected function pins.

---

## Prompts

Each persona's prompt is **colocated with its agent** in two pieces: a persona
template literal (the "You are the …" identity) and a `build<Persona>SystemPrompt()`
assembler that appends the STRICT RULES block and the live `assembleContext()`
digest. Locations: `agent.ts:172` (Draftsman), `analyst.ts:32`,
`architect.ts:38`, `professor.ts:38` (+ the `DEPTH_REGISTER`), `buyer.ts:40`,
`router.ts:40`.

Prompts are product behavior: a change to a STRICT RULES block changes what
the crew does. Treat edits as deliberate — review them like an API change, and
keep the persona tests (`*.test.ts`) that assert on prompt content green.
**(BL-0903 will extract these into versioned prompt modules so prompt changes
are tracked and diffable independently of agent logic; until then, the
colocated literals above are the source of truth.)**

---

## Usage

```ts
import { runDraftsman, AnthropicProvider } from '@protopulse/ai';

const provider = new AnthropicProvider({ apiKey: userKey }); // model/maxTokens default
const result = await runDraftsman({
  prompt: 'Add a 555 astable: 1kΩ to Vcc, 470kΩ + 10nF timing, output on pin 3',
  graph,                       // DesignGraph
  parts,                       // PartDb
  provider,
  onEvent: (e) => stream(e),   // AgentEvent stream: text, tool_use, op envelopes
  confirmDestructive: async (op) => askUser(op),
});
// result.ops / result.envelopes apply to the graph; result.transcript + finalText for the UI
```

Swap `new AnthropicProvider(...)` for `new FakeProvider(script)` to drive the
exact same loop deterministically in tests.

---

## Testing

```bash
npm run -w @protopulse/ai test          # vitest, this package
npm run test:packages                    # the whole engine gate
```

Every persona has a `*.test.ts` driving `run<Persona>` through `FakeProvider`
with scripted tool-call sequences — deterministic, no network, asserting on
emitted ops, transcript, and prompt content. These scenario tests are the
eval-adjacent baseline that **BL-0902** promotes into a named, gated regression
eval under `packages/ai/evals/`.

---

## Relationship to `server/ai.ts` (frozen)

The legacy app ships its AI backend in `server/ai.ts` (genkit + the Ars
Contexta vault injection). That code is **frozen** — bug-fix only, no new
features. All new AI capability is built here, on the provider-agnostic crew
runtime, and reaches the app through the migration milestone. If you're adding
an agent, a tool, or a provider, it goes in `@protopulse/ai`.
