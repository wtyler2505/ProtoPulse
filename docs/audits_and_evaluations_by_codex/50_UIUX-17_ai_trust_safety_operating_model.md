# ProtoPulse AI Trust and Safety Operating Model

Date: 2026-03-30  
Author: Codex  
Purpose: Define the target operating model for how ProtoPulse AI should behave across chat, mission-planner workflows, and generative design so trust and safety are enforced consistently rather than ad hoc.

## Core Principle
ProtoPulse AI should be helpful by default, safe by default, and legible by default.

That means the user should always understand:
- what the AI is doing
- what it can see
- what it can change
- what risk level applies
- what review path exists

## Safety Posture
The default posture should be:
- read-heavy
- preview-first
- reversible when possible
- conservative around destructive changes
- stricter around physical hardware operations

AI should never feel like it is "secretly in charge."

## Permission Tiers
ProtoPulse should expose four user-understandable AI permission tiers.

### 1. `Explain Only`
Behavior:
- answer questions
- explain current design
- suggest next steps in text
- no design mutations
- no executable tool actions

Best for:
- first-time users
- classroom demos
- untrusted or shared environments

### 2. `Suggest Changes`
Behavior:
- propose actions
- generate previews
- create plans and candidate edits
- user must explicitly approve any project mutation

Best for:
- beginners
- most learning workflows
- users who want AI help without direct action

### 3. `Apply With Review`
Behavior:
- AI may perform bounded project changes
- every meaningful mutation gets previewed or checkpointed
- destructive or low-confidence actions always pause for review

Best for:
- default hobbyist workflow
- most current ProtoPulse AI action-taking flows

### 4. `High Autonomy`
Behavior:
- AI may execute multi-step plans within a bounded scope
- still blocked on destructive and hardware-sensitive actions
- full trace, receipts, and rollback path required

Best for:
- advanced users
- future mission-planner workflows

This should never be the default for beginners.

## Default AI Behavior by User Mode

### Beginner
- default tier: `Suggest Changes`
- explanation density: high
- autonomy: low
- confidence threshold for action: strict
- teaching: always available and visually prominent

### Hobbyist
- default tier: `Apply With Review`
- explanation density: medium
- autonomy: medium
- warnings: plain-language and consequence-oriented

### Pro
- default tier: `Apply With Review`
- optional upgrade: `High Autonomy`
- explanation density: medium-low by default, expandable

## Trust Receipt Requirements
Every substantial AI response should include a compact trust receipt.

Required fields:
- response type:
  - explanation
  - recommendation
  - plan
  - pending action
  - generated candidate
- context scope:
  - what project/view/artifacts were used
- evidence/source summary
- confidence level
- risk level
- next step:
  - approve
  - reject
  - refine
  - compare
  - learn more

This should become a consistent product language across all AI surfaces.

## Surface Contracts

### Chat Panel
Chat should support four visible working modes:
- `Ask`
- `Teach`
- `Act`
- `Review`

Rules:
- `Ask` and `Teach` are read-dominant.
- `Act` can prepare and preview changes.
- `Review` is where low-confidence, risky, or queued items live.
- Chat should never execute destructive or hardware-sensitive actions without an enforced confirmation contract.

### Mission Planner / Design Agent
The design agent should operate as a plan-first system, not a prompt-first black box.

Rules:
- always show a pre-run plan
- always show intended scope
- always show checkpoints
- always expose current stage and remaining stage count
- always require review for destructive, broad, or hardware-sensitive steps

### Generative Design
Generative design should be treated as candidate generation, not automatic application.

Rules:
- candidate generation is read-only until the user selects an apply path
- every candidate should explain why it scored well or poorly
- candidate application should route through the same trust receipt and permission model as other AI changes

## Review Queue Contract
The existing review queue should become a first-class product surface.

Each queued item should show:
- action summary
- why it was queued
- confidence score
- affected artifact
- age
- compare view or preview
- approve
- reject
- optional rejection reason

Items that should always queue:
- low-confidence actions
- destructive actions
- broad multi-entity changes
- hardware-sensitive actions
- actions based on incomplete context

## Degraded-Mode Contract

### No API key
- explain clearly that AI action features are unavailable
- preserve access to non-AI local features
- give a direct path to settings
- avoid presenting the app as broken

### Invalid key
- explain failure simply
- preserve unsent prompt draft
- let the user retry after correction

### Provider unavailable or circuit breaker open
- preserve conversation state
- offer retry
- offer a conservative non-acting fallback if possible

### Stream interrupted
- preserve typed prompt and partial answer if available
- show resumable or retryable state

### Low confidence
- do not present the AI as decisive
- route to review or a conservative alternative

### Missing context
- say what is missing
- offer actions like:
  - open the relevant view
  - attach an image
  - run validation first
  - select a circuit/sheet

## Memory Governance Contract
ProtoPulse should make AI memory legible.

The user should be able to see:
- current conversation history
- active branch context
- project-level remembered decisions
- saved preferences affecting AI behavior

The user should be able to:
- clear conversation history
- fork branches
- remove or reset remembered preferences
- understand that memory is project-scoped unless explicitly stated otherwise

ProtoPulse should not imply hidden cross-project memory.

## Hardware-Sensitive AI Policy
Any AI behavior that may affect real hardware gets a stricter policy tier.

Always require explicit human review for:
- compile/upload/flash actions
- serial commands that may actuate devices
- GPIO or power-state control actions
- actions that could energize motors, relays, or external circuits

Additional safeguards should include:
- target board visibility
- explicit port visibility
- preflight warning about physical effects
- conservative defaults

## Product Honesty Rules
ProtoPulse AI should never:
- claim a provider/model path that is not actually surfaced
- imply an action completed when the frontend handler is missing or it was queued instead
- present low-confidence output as if it were authoritative
- imply safe hardware behavior without explicit guardrails

## Implementation Implications
The eventual implementation should introduce visible product controls for:
- AI permission tier
- current AI mode
- current context scope
- trust receipt
- review inbox
- memory controls
- degraded-mode state
- hardware-risk gating

## Closing Read
ProtoPulse already has parts of a strong AI trust model. What it lacks is one unified operating contract.

Once this operating model is visible and enforced, the AI layer becomes dramatically easier to trust, teach with, and expand safely.
