# ProtoPulse AI Blind Spots and Failure Modes

Date: 2026-03-30  
Author: Codex  
Purpose: Capture the high-leverage AI product, trust, and safety gaps that are easy to miss when focusing only on chat UX, model quality, or agent capabilities.

## Core Thesis
ProtoPulse already has a meaningful AI stack. The biggest remaining AI risks are no longer "can the model answer?" They are the less glamorous layers that decide whether users can trust the system:
- scope control
- confirmation enforcement
- memory boundaries
- degraded-mode behavior
- prompt hostility resistance
- hardware safety
- evaluation discipline
- honest product framing

This pass is intentionally about the stuff teams often forget until it causes user fear, silent corruption, or support pain.

## What This Pass Confirmed
The codebase already contains many strong AI-adjacent foundations:
- client-side safety classification in `client/src/lib/ai-safety-mode.ts`
- low-confidence review infrastructure in `client/src/lib/ai-review-queue.ts`
- rich AI error taxonomy in `shared/errors/catalog-ai.ts`
- context-aware routing and streaming in `server/ai.ts`
- persistent chat history and branching in `client/src/lib/contexts/chat-context.tsx`
- design-agent orchestration in `server/routes/agent.ts`

The problem is that several of the most important protections are either:
- only partial
- only local/UI-level
- not surfaced as product behavior
- or already called out by earlier backend audits as under-enforced

## Blind Spot 1: Ownership, Scope, and Context Isolation

### Evidence
- Earlier backend AI audits already flagged cross-project risk:
  - `19_BE-05_ai_core_orchestration_audit.md`
  - `20_BE-06_ai_tool_registry_executors_audit.md`
- Those audits found:
  - body-level project targeting in chat AI
  - AI tool executors trusting raw IDs
  - export/circuit operations resolving by ID without strong project scoping

### Why it matters
Nothing erodes trust faster than AI acting on the wrong project, reading the wrong circuit, or mutating a resource the user did not mean to expose.

### Recommendation
- Treat project and circuit scoping as a trust-layer requirement, not a backend detail.
- Make all AI flows explicitly project-scoped by route and execution context.
- Remove any path where AI can operate on caller-supplied raw IDs without ownership verification.
- Include project identity in dedupe, cache, and prompt-context keys.

## Blind Spot 2: Confirmation UX Exists, but Confirmation Enforcement Is Split

### Evidence
- `client/src/lib/ai-safety-mode.ts` provides meaningful client-side classifications and teaching explanations.
- `server/routes/agent.ts` and prior backend audits show the design agent and tool registry still need stronger execution-boundary enforcement.
- Earlier audits explicitly called out `requiresConfirmation` as under-enforced server-side.

### Why it matters
A good warning dialog is not enough if the backend can still execute risky tools without a hard confirmation contract.

### Recommendation
- Move confirmation from "helpful UI behavior" to "mandatory system boundary."
- Enforce confirmation server-side for destructive and hardware-sensitive tools.
- Emit review-needed states instead of silently proceeding.
- Treat client-side safety dialogs as education and clarity, not the only lock.

## Blind Spot 3: Review Queue Exists, but the Product Barely Uses It

### Evidence
- `client/src/lib/ai-review-queue.ts` defines a full queue manager, threshold logic, approval/reject flows, expiry, and stats.
- Search results in this pass did not show active UI adoption beyond the library itself.

### Why it matters
Low-confidence review is one of the best bridges between powerful AI and safe AI. If it stays hidden infrastructure, the product loses one of its highest-leverage trust patterns.

### Recommendation
- Productize the review queue as a visible inbox.
- Show:
  - why an action was queued
  - confidence score
  - affected artifact
  - before/after preview
  - approve/reject path
- Connect it to chat, mission planner, and future hardware workflows.

## Blind Spot 4: Memory Governance Is Undefined at the Product Level

### Evidence
- `docs/USER_GUIDE.md` says chat history persists between sessions.
- `client/src/lib/contexts/chat-context.tsx` persists chat messages per project and branch.
- No equivalent product-layer contract was found for:
  - what counts as memory
  - what is branch-local vs project-global
  - how users inspect, edit, summarize, or delete AI memory

### Why it matters
Users will assume the AI "remembers" more than it does, or fear it remembers more than it should. Either misunderstanding creates trust and usability problems.

### Recommendation
- Define visible AI memory scopes:
  - conversation history
  - branch memory
  - project memory
  - learned preferences
- Add inspect, clear, and forget controls.
- Never imply cross-project memory unless it is explicitly real and visible.

## Blind Spot 5: Degraded-Mode AI UX Is Underdefined

### Evidence
- `server/ai.ts` has explicit no-key and provider-error messages.
- `shared/errors/catalog-ai.ts` includes:
  - provider error
  - circuit breaker open
  - model unavailable
  - low confidence
  - stream interrupted
- `docs/USER_GUIDE.md` has basic error guidance, but not a true degraded-mode experience model.

### Why it matters
ProtoPulse is local-first. Users will hit:
- no API key
- expired key
- provider outage
- network instability
- stream interruption

If the app handles those only as error toasts, the AI layer will feel brittle.

### Recommendation
- Define a degraded-mode contract for every AI surface.
- Distinguish:
  - unavailable
  - unconfigured
  - low-confidence
  - partially grounded
  - offline but still usable in non-AI areas
- Preserve user intent and draft text wherever possible.

## Blind Spot 6: Prompt Injection and Hostile Input Defense Is Not Yet a Product Story

### Evidence
- Current AI flows already accept or are positioned to accept:
  - uploaded images
  - multimodal captures
  - datasheet-like content
  - imported design content
  - custom system instructions
  - RAG/document contexts
- In this pass, I did not find a dedicated prompt-injection policy, red-team doc, or visible hostile-input mitigation layer for the AI product.

### Why it matters
ProtoPulse's AI is grounded in user-supplied technical artifacts. That is exactly the kind of system that needs explicit hostile-input handling.

### Recommendation
- Add a dedicated AI input trust policy.
- Treat uploaded content as untrusted by default.
- Separate:
  - user goal
  - retrieved content
  - tool execution authority
- Build injection-specific eval cases before expanding autonomous tool use.

## Blind Spot 7: Hardware Safety Needs Its Own AI Rules

### Evidence
- ProtoPulse is explicitly positioned as a native desktop tool with real hardware access.
- The app already includes Arduino, serial, firmware, and physical-hardware ambitions across the product docs and codebase.
- The current AI safety layer is general, but not explicitly hardware-risk-tiered.

### Why it matters
Once AI can influence compile, upload, serial, GPIO, motor, or power-related workflows, the risk profile changes. The issue is no longer just "bad suggestion" or "wrong state mutation." It can become damaged hardware, unsafe physical behavior, or confusing real-world debugging.

### Recommendation
- Create hardware-specific AI autonomy rules before deeper AI hardware automation ships.
- Require stricter review gates for:
  - flashing/uploading
  - serial control actions
  - power or pin-state actions
  - anything that could energize or move physical hardware

## Blind Spot 8: AI Capability Drift Can Become a Silent Trust Break

### Evidence
- `docs/USER_GUIDE.md` still presents a multi-provider story, including Anthropic Claude.
- Current surfaced settings are Gemini-only.
- Earlier AI tool audits also found backend/frontend action mismatches that can produce silent no-op client actions.

### Why it matters
Users do not care whether drift comes from docs, routes, or handler mismatches. They just experience "the AI said it did something, but it didn't" or "the docs promised something different."

### Recommendation
- Treat AI capability drift as a trust bug.
- Keep product copy, settings UI, tool contracts, and action handlers aligned.
- Add contract tests for client-dispatched AI actions and surfaced provider/model stories.

## Blind Spot 9: There Is No Dedicated AI Evaluation Discipline Yet

### Evidence
- This pass did not uncover a current golden-prompt, red-team, or AI-regression suite as a first-class product asset.
- Existing AI tool tests are partial, and earlier roadmap/checklist work already notes incomplete AI tool coverage.

### Why it matters
Without an eval layer, AI quality degrades invisibly:
- prompts drift
- safety assumptions regress
- beginner clarity worsens
- agent plans get more brittle
- grounding quality silently changes

### Recommendation
- Build an AI eval stack before significantly increasing autonomy.
- Cover:
  - grounding accuracy
  - action safety
  - beginner clarity
  - plan quality
  - prompt-injection resistance
  - failure-recovery behavior

## Blind Spot 10: Trust Metrics Are Missing From the Product Story

### Evidence
- The current AI work emphasizes capabilities and routing more than product trust metrics.
- Existing review, safety, and error infrastructure implies valuable telemetry opportunities, but they are not yet clearly framed as product success measures.

### Why it matters
Message count is not an AI quality metric. Trust is visible in behavior:
- accept
- reject
- undo
- abandon
- retry
- ask for simpler explanation

### Recommendation
- Measure:
  - action acceptance rate
  - rejection rate
  - undo-after-AI rate
  - low-confidence queue volume
  - abandonment after agent runs
  - time to first useful answer
  - beginner success after AI guidance

## Blind Spot 11: Failure UX Is Still Too Error-Centric

### Evidence
- `shared/errors/catalog-ai.ts` is solid at the taxonomy level.
- `docs/USER_GUIDE.md` mostly frames AI problems as error messages and retries.
- Current UI already has some trust affordances, but not yet a fully mature "AI failed gracefully and still helped me" experience.

### Why it matters
AI products are judged by recovery behavior as much as raw success.

### Recommendation
- Design explicit fallback states:
  - "I can still explain, but not act"
  - "I need more project context before I can safely recommend a change"
  - "I lost the stream, but your request draft is preserved"
  - "I am low-confidence here; want a conservative option instead?"

## Most Important Blind Spots to Address First
1. scoped ownership and context isolation
2. server-enforced confirmation and autonomy boundaries
3. degraded-mode behavior
4. hardware-specific safety policy
5. AI eval and trust metrics

## Closing Read
ProtoPulse does not need more AI magic first. It needs stronger AI truthfulness, explicit boundaries, and safer operating contracts.

That is good news.

Most of the raw ingredients are already here. The missing work is productizing them into a system the user can actually trust.
