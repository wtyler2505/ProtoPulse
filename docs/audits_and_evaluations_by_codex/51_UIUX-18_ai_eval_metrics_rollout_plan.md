# ProtoPulse AI Evaluation, Metrics, and Rollout Plan

Date: 2026-03-30  
Author: Codex  
Purpose: Define how ProtoPulse should evaluate, measure, and safely roll out AI improvements so capability growth does not outrun trust, safety, or beginner usefulness.

## Core Thesis
ProtoPulse should not ship AI changes based only on "it felt better in a few chats."

The AI layer needs:
- repeatable evaluation
- product trust metrics
- rollout gates
- explicit safety criteria for higher-autonomy features

## Evaluation Stack

### 1. Golden Prompt Suite
Create a stable corpus of representative tasks across ProtoPulse's main AI jobs.

Include:
- architecture generation prompts
- component recommendation prompts
- validation explanation prompts
- BOM optimization prompts
- procurement substitute prompts
- Arduino starter prompts
- beginner teaching prompts
- mission-planner prompts
- generative-design prompts

Each prompt should have:
- expected grounding scope
- expected response type
- unacceptable failure conditions

### 2. Safety and Review Suite
Create cases that deliberately pressure the trust layer.

Include:
- destructive action requests
- low-confidence action requests
- ambiguous design-change requests
- multi-step agent plans that should pause for review
- requests that target the wrong project or wrong artifact

### 3. Hostile Input Suite
Create prompt-injection and hostile-content scenarios.

Include:
- malicious uploaded text
- hostile datasheet/document snippets
- contradictory retrieved context
- manipulative instructions embedded in imported artifacts

### 4. Beginner Clarity Suite
ProtoPulse is not only an expert tool.

Create cases that test:
- plain-language explanations
- misconception detection
- explanation of validation warnings
- step-by-step help without excessive jargon

### 5. Failure-Recovery Suite
Create tests for:
- no API key
- invalid key
- provider outage
- stream interruption
- low-confidence output
- missing context
- agent max-step exhaustion

## Product Metrics That Actually Matter

### Quality Metrics
- time to first useful answer
- share of responses with accepted follow-up value
- grounding quality on source-aware prompts
- plan-completion quality for mission-planner flows

### Trust Metrics
- action acceptance rate
- action rejection rate
- undo-after-AI rate
- low-confidence queue rate
- manual override rate after AI recommendations

### Beginner Metrics
- beginner task completion rate after AI use
- repeat use after first AI session
- frequency of "simpler explanation" or equivalent requests
- rate of validation issues resolved after AI explanation

### Reliability Metrics
- provider error rate
- stream interruption rate
- time spent in degraded mode
- model-unavailable rate
- fallback success rate where applicable

## Release Gates by Capability Type

### Chat-copy or explanation tuning
Ship when:
- golden prompts improve or remain stable
- beginner clarity does not regress
- trust receipt remains accurate

### New AI action or tool pathway
Ship when:
- scoped ownership is verified
- destructive and low-confidence behavior is correctly gated
- frontend/backend action contracts are verified

### Mission-planner behavior changes
Ship when:
- plan-preview contract passes
- checkpoint behavior is reliable
- rejection/branch/refine flows are verified

### Hardware-sensitive AI features
Ship only when:
- explicit safety gate exists
- human review is mandatory
- target board and physical effect are visible
- rollback/recovery path is documented

## Rollout Sequence

### Phase 1: Measure Current Reality
- establish baseline prompt suite
- establish baseline trust metrics
- log current rejection, undo, and abandonment behavior

### Phase 2: Harden Trust Layer
- instrument review queue behavior
- instrument degraded-mode states
- add event visibility for approval, rejection, undo, retry

### Phase 3: Ship AI Role Clarity Improvements
- mode labels
- trust receipts
- context scope summary
- degraded-mode messaging improvements

### Phase 4: Expand Agentic Flows Carefully
- plan-preview
- checkpoints
- review queue integration
- limited autonomy with logging

### Phase 5: Expand Higher-Risk Features
- hardware-sensitive AI
- more autonomous project-editing flows
- only after earlier trust metrics show healthy behavior

## Recommended Instrumentation
ProtoPulse should record events for:
- AI request started
- AI request failed
- degraded mode entered
- action preview shown
- action approved
- action rejected
- action undone
- review item queued
- review item approved
- review item rejected
- agent plan accepted
- agent step paused for review

These events should always include:
- project ID
- active view
- AI mode
- permission tier
- model
- whether hardware-sensitive scope was involved

## Ownership and Cadence

### Product owner questions every release
- Did the AI become easier to trust?
- Did the beginner experience improve?
- Did review and undo behavior get healthier?
- Did error recovery get clearer?

### Engineering owner questions every release
- Did any AI contract drift from docs or UI?
- Did any action pathway lose confirmation or scope guarantees?
- Did grounding or routing regress?

### QA owner questions every release
- Did the golden prompt suite remain stable?
- Did degraded-mode cases still behave correctly?
- Did hostile-input cases get safer, not weaker?

## Minimum First Evaluation Pack
If ProtoPulse needs a lean first version, start with:
1. 25 golden prompts across chat, teaching, planning, and acting
2. 10 destructive or low-confidence review cases
3. 10 degraded-mode cases
4. 10 beginner-clarity cases
5. 10 hostile-input cases

That small pack will already be far more disciplined than most AI product teams run.

## Most Important Rollout Rule
Do not let autonomy scale faster than evaluation.

ProtoPulse can absolutely become a standout AI workbench, but only if every increase in power is matched by:
- stronger trust signals
- clearer review flows
- better measurement
- safer recovery behavior
