# ProtoPulse AI Experience Blueprint

Date: 2026-03-30  
Author: Codex  
Purpose: Define how ProtoPulse AI should evolve into a clear, trustworthy, beginner-safe, and genuinely differentiated product layer across the full app, the AI chat panel, and the design agent.

## Core Thesis
ProtoPulse should not feel like it has several separate AI features bolted onto the shell. It should feel like one coherent AI workbench that can teach, plan, act, review, and generate, with the right amount of autonomy for the user's experience level.

The right target experience is:
- part electronics copilot
- part design reviewer
- part project planner
- part creative generator
- part embedded tutor
- part safe execution layer

That combination is what can make ProtoPulse useful for:
- total beginners
- hobbyists and tinkerers
- self-taught builders
- experienced makers who want speed
- power users moving from idea to PCB and firmware inside one tool

## What This Pass Confirmed

### Strong existing AI building blocks
Runtime and code review confirmed that ProtoPulse already has meaningful AI infrastructure:
- `ChatPanel` already supports streaming, follow-up suggestions, multimodal input, source chips, confidence display, action previews, and explicit confirm/discard flows.
- `DesignAgentPanel` already exists as a separate long-running agent surface with step streaming and max-step controls.
- `GenerativeDesignView` already exists as a third AI-powered workflow for candidate generation and tradeoff exploration.
- `server/ai.ts` already has context-window management, routing strategies, model selection, tool execution events, and state-aware prompting.
- `server/ai-tools/` already gives AI broad reach across architecture, BOM, validation, circuit, export, simulation, manufacturing, and Arduino workflows.
- `ai-safety-mode.ts` already contains a beginner-friendly safety classification system with teaching-oriented consequences and explanation text.
- `ai-review-queue.ts` already defines a review path for low-confidence AI actions.
- `ai-tutor.ts` already defines tutor styles that could support hinting, explanation, Socratic guidance, and adaptive teaching.

### Core problem
These systems do not yet read as one understandable AI product.

Today ProtoPulse exposes:
- a conversational AI
- an action-taking AI
- a design agent
- a generative design system
- a hidden tutor layer
- a hidden safety/review layer

Those are individually promising, but the UX does not explain where one mode ends and another begins.

## Fresh Runtime Observations

### `ProtoPulse AI` chat is useful, but role boundaries are blurry
What works:
- the empty state already suggests practical work
- the panel can stream answers and action previews
- sources and confidence affordances exist
- multimodal entry is already broader than plain text

What holds it back:
- the panel title is generic relative to the number of things it can do
- the chat can be hidden too easily even though AI is positioned as core product value
- quick actions do not strongly adapt to the current view, project maturity, or user role
- the panel looks like "chat plus extra controls" rather than a clearly structured assistant system

### `Design Agent` exists, but the product does not yet justify when to use it
What works:
- separate tab communicates that this is not exactly the same thing as normal chat
- step streaming suggests a more agentic workflow
- advanced controls imply that planning depth matters

What holds it back:
- the surface is too bare for such an important mental model shift
- a description box plus a max-step control does not explain the agent's contract
- there is no pre-run plan preview, milestone editor, or success criteria framing
- it does not clearly answer why the user should choose this over standard chat or generative design

### `Generative Design` feels like a third AI product instead of part of one system
What works:
- the surface is clearly optimization-oriented
- constraints like budget, power, and thermal targets are strong inputs

What holds it back:
- it feels detached from the main AI panel and the design agent
- there is no obvious handoff from "discuss an idea" to "generate candidates" to "apply the best one"
- beginners are unlikely to know when this tool is appropriate

### Trust systems exist in code, but they are not yet productized enough
What works:
- action previews are already safer than invisible tool execution
- confidence and source surfaces exist
- safety classifications and review queues already exist in the codebase

What holds it back:
- users are not taught how the safety model works
- the review queue is infrastructure, not a visible control center
- AI transparency is present in fragments rather than as a clear trust layer

### AI copy and settings still reflect a more technical than user-centered mental model
What works:
- model selection and routing strategy are available
- connection state is surfaced

What holds it back:
- settings are model-centric instead of task-centric
- the current user guide still mentions multiple providers, including Anthropic Claude, while the current surfaced product flow is Gemini-only
- users are asked to understand provider/model details before the app fully explains what each AI mode is best at

## Key Product Insight
ProtoPulse AI should behave like one layered operating model:

1. `Ask`
The user wants a direct answer, recommendation, or explanation.

2. `Teach`
The user wants help understanding concepts, not just finishing the task.

3. `Plan`
The user wants the AI to propose a sequence of work, decisions, or milestones.

4. `Act`
The user wants the AI to make concrete changes, but with preview and approval.

5. `Generate`
The user wants creative or optimization-driven candidate designs.

Right now those layers exist, but they are split across multiple surfaces without a clear shared mental model. The next UX job is to unify them.

## Design Principles for ProtoPulse AI

### 1. Role clarity before capability density
Users should understand:
- what this AI mode does
- what it can see
- what it can change
- when they should use a different AI mode

### 2. Context should be visible, not magical
Every serious AI answer should make visible:
- current project
- current view
- design artifacts in scope
- whether the AI is using sources, history, validation results, or BOM state

### 3. Autonomy should always be paired with reversibility
If AI can change project state, the user should always understand:
- what is about to happen
- why it is being recommended
- how to review it
- how to undo or reject it

### 4. Teaching and doing should be distinct but adjacent
Beginners need to be able to say:
- explain this
- show me an example
- do it with me
- do it for me, but let me review

Those are different jobs and should be explicit.

### 5. AI should be place-aware and stage-aware
The AI should change its behavior based on:
- which view the user is in
- whether the project is early, midstream, or manufacturing-ready
- whether the user is in beginner, hobbyist, or pro mode

### 6. Trust signals should be first-class UI, not tucked into message details
Users should be able to quickly understand:
- confidence
- evidence
- tool usage
- risk level
- whether the answer is advice, a plan, or a pending action

### 7. One app, one AI memory model
The user should not feel like every AI surface forgets or reinterprets the project differently. Branching, history, plan state, and applied actions should feel like one continuous system.

## Critical Gaps to Close

### Gap 1: The AI system has too many overlapping front doors
Today the user can encounter:
- chat
- design agent
- generative design
- view-specific AI buttons

Recommendation:
- create a visible AI mode architecture with plain-language labels such as:
  - `Ask`
  - `Teach`
  - `Plan`
  - `Act`
  - `Generate`
- explain those modes in the chat header, dashboard, and first-run onboarding

### Gap 2: The AI system does not yet explain its own context well enough
Recommendation:
- add a persistent `What AI can currently see` drawer
- show current sources of grounding such as:
  - architecture
  - schematic
  - BOM
  - validation
  - uploaded image
  - project history

### Gap 3: Safety infrastructure is stronger than the visible trust UX
Recommendation:
- surface safety classifications directly in the composer and action preview flow
- add a visible `Needs review` inbox backed by the existing review-queue infrastructure
- explain destructive vs caution vs safe actions in plain language

### Gap 4: The design agent is underframed
Recommendation:
- reposition the design agent as `Mission Planner` or `Build Agent`
- require or encourage:
  - objective
  - constraints
  - success criteria
  - preferred style such as beginner-safe, cost-optimized, fast prototype, manufacturing-ready
- show a plan preview before execution

### Gap 5: Generative design is too detached from the rest of the AI experience
Recommendation:
- create explicit handoffs:
  - from chat to generative design
  - from design agent to generative design
  - from candidate design back to architecture/BOM/validation

### Gap 6: AI settings are too technical for many users
Recommendation:
- keep advanced model controls, but add task presets such as:
  - `Explain clearly`
  - `Design with me`
  - `Move fast`
  - `Double-check everything`
  - `Beginner-safe`

### Gap 7: Documentation and product copy are out of sync
Recommendation:
- update AI help text and the user guide so provider/model claims match the current surfaced experience
- rewrite AI feature copy around outcomes, not providers

## High-Value Feature Recommendations

### 1. Introduce an `AI Mode Switcher`
This should be more than a tab.

It should clearly let users choose between:
- `Ask` for direct Q&A
- `Teach` for explanation and guided learning
- `Plan` for multi-step strategy
- `Act` for project-changing assistance
- `Generate` for candidate creation and optimization

### 2. Add an `AI Context Card`
This should explain:
- what the AI is looking at
- what it is not looking at
- what data is stale
- whether the answer is grounded in current project artifacts

### 3. Productize the trust layer
Make the following visible everywhere AI acts:
- confidence
- source quality
- risk level
- expected side effects
- rollback path

### 4. Turn chat into a real workbench assistant
The chat panel should adapt by view.

Examples:
- in `Architecture`, suggest block-level planning, node placement, and requirement decomposition
- in `Schematic`, suggest connection review, component explanation, and ERC help
- in `Procurement`, suggest substitutes, stock-risk analysis, and cost reduction
- in `Validation`, suggest issue triage, plain-language explanations, and likely fixes
- in `Arduino`, suggest board setup, firmware scaffolding, and serial troubleshooting

### 5. Build a true `Teach With Me` mode
This should connect the existing tutor infrastructure with the main AI experience.

The user should be able to ask for:
- simpler explanation
- analogy
- hint only
- step-by-step walkthrough
- quiz me
- show common mistake

### 6. Reframe the design agent as a goal-driven mission system
The agent should feel like:
- define the mission
- inspect the plan
- approve the approach
- watch steps execute
- intervene at checkpoints
- review results

### 7. Make AI proactive, but only in bounded, welcome ways
Good proactive patterns:
- `You have 7 validation issues that block simulation. Want me to group them by fix order?`
- `This BOM is missing stock coverage. Want substitute suggestions?`
- `You imported an Arduino board but no firmware workspace exists yet. Want a starter sketch?`

Bad proactive pattern:
- unsolicited high-confidence action without clear invitation or context

### 8. Connect AI memory to project progress
The AI should remember and surface:
- prior design decisions
- accepted tradeoffs
- rejected approaches
- open questions
- active risks

### 9. Make AI beginner-safe by default
For beginner and hobbyist modes:
- default to explanation-heavy guidance
- lower autonomy
- increase review gates
- prefer plain language
- avoid expert jargon unless requested

### 10. Turn AI into a differentiator for the whole product
ProtoPulse's moat is not just "chat inside EDA."

The moat is:
- grounded AI that sees the whole project
- AI that can teach while it helps
- AI that can plan and execute safely
- AI that can move from learning to building without app-switching

## Signature Experience Opportunities

### 1. `Build With Me`
An AI-guided mode that takes a total beginner from idea to working starter project through staged, visible, reversible steps.

### 2. `Explain This Design`
A universal action available from architecture, schematic, validation, BOM, and code that explains the current artifact in plain English with next-step guidance.

### 3. `Mission Planner`
A more legible design-agent experience that turns vague goals into a reviewed plan, then executes with checkpoints.

### 4. `AI Design Review`
A dedicated review mode where ProtoPulse critiques the design like a patient engineer:
- what looks solid
- what is risky
- what is missing
- what to test next

### 5. `Learning-Aware Copilot`
An assistant that knows when the user is learning and changes tone, depth, and autonomy accordingly.

## Immediate Product Direction
The best short-term move is not to add more AI modes. It is to clarify and unify the ones that already exist.

The highest-leverage sequence is:
1. clarify AI roles
2. productize trust
3. make chat more view-aware
4. turn the design agent into a real planner
5. connect teaching and generation into the same AI operating model

If ProtoPulse does that well, the AI layer stops feeling like a powerful extra and starts feeling like the product's defining operating system.
