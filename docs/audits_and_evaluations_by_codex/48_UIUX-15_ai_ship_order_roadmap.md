# ProtoPulse AI Ship Order Roadmap

Date: 2026-03-30  
Author: Codex  
Purpose: Recommend the highest-leverage order for improving ProtoPulse AI across the app, the chat panel, and the design agent without creating more role confusion.

## Roadmap Goal
Turn ProtoPulse AI from a powerful but somewhat fragmented set of surfaces into one coherent, trustworthy, beginner-safe AI operating layer for the full product.

## Guiding Rule
Do not add more AI surface area until the current surfaces are easier to understand.

The first win is clarity. The second win is trust. The third win is deeper capability.

## Wave 1: Clarify the AI Product

### Goal
Make the existing AI system legible before expanding it.

### Ship in this wave
- Define and surface the AI role model:
  - `Ask`
  - `Teach`
  - `Plan`
  - `Act`
  - `Generate`
- Update chat header and empty states to explain what each mode is for.
- Add a persistent `What AI can see` summary.
- Rewrite AI settings around user goals first, advanced model controls second.
- Update stale AI docs and in-app copy so provider claims match the live product.

### Why this comes first
- It improves every AI interaction immediately.
- It lowers beginner confusion without needing deep backend changes.
- It creates the vocabulary needed for later roadmap waves.

## Wave 2: Build the AI Trust Layer

### Goal
Make AI behavior feel inspectable, safe, and reversible.

### Ship in this wave
- Promote safety classifications into the main chat flow.
- Add a visible `Needs review` inbox backed by the existing review-queue logic.
- Standardize answer receipts:
  - answer type
  - confidence
  - source summary
  - risk level
  - action consequences
- Add clearer rollback and undo language for AI-applied changes.

### Why this comes second
- ProtoPulse AI is already action-capable.
- The product needs stronger trust UX before increasing autonomy or making AI more proactive.

## Wave 3: Turn Chat Into a View-Aware Copilot

### Goal
Make the chat panel feel like a native assistant for the current task, not a generic sidebar.

### Ship in this wave
- Make quick actions adapt by active view and project maturity.
- Add contextual prompts for architecture, schematic, procurement, validation, Arduino, and output.
- Add a compact context drawer showing active design artifacts in scope.
- Improve branch visibility and branch comparison.
- Add beginner-safe explanation actions in high-friction views.

### Why this comes third
- Once users understand the AI and trust it, the next leverage point is relevance.
- View-aware assistance is where ProtoPulse AI becomes distinctly better than general-purpose chat.

## Wave 4: Rebuild the Design Agent as a Mission Planner

### Goal
Turn the design agent from a bare prompt box into a clear plan-first orchestration workflow.

### Ship in this wave
- Rename or reposition the surface as `Mission Planner` or `Build Agent`.
- Add mission templates.
- Add structured fields:
  - objective
  - constraints
  - success criteria
  - preferred style
  - review level
- Add a plan-preview stage before execution.
- Add a live execution timeline with pause and checkpoint controls.
- Replace `max steps` as the primary control with human-language depth settings.

### Why this comes fourth
- The design agent has big upside, but it needs the shared role and trust language from earlier waves to land well.

## Wave 5: Connect Generation, Teaching, and Execution

### Goal
Make all AI surfaces feel like parts of one system.

### Ship in this wave
- Add handoffs between chat, mission planner, and generative design.
- Integrate tutor behaviors into mainstream AI flows.
- Add `Explain this design` actions across core views.
- Let generative-design candidates flow back into architecture, BOM, and validation review.
- Add project-memory summaries that track decisions, tradeoffs, risks, and unresolved questions.

### Why this comes fifth
- This is where ProtoPulse AI becomes a genuinely differentiated operating system for electronics work.
- It also depends on earlier clarity and trust work.

## Beginner-First AI Extensions
These can overlap with Waves 3 through 5, but should follow the same sequencing discipline.

### Priority additions
- `Teach With Me` mode that favors explanation, hints, analogies, and step-by-step guidance
- beginner-safe autonomy defaults
- project-stage-aware AI suggestions
- validation explanations that translate engineering language into plain English
- Arduino setup guidance that behaves like a coach, not just a code generator

## Metrics That Matter
Do not measure AI success only by message count.

Measure:
- time to first useful answer
- action acceptance rate
- action rejection rate
- undo rate after AI-applied changes
- validation issue resolution rate after AI guidance
- beginner task completion rate
- time from new project to first successful design artifact
- user trust signals such as repeated use after first AI action

## Quick Wins
1. Rename and explain AI modes in the panel header and empty state.
2. Add a visible context summary.
3. Update stale AI documentation and help copy.
4. Make quick actions more view-aware.
5. Add clearer trust receipts to AI responses.

## Medium Lifts
1. Add a review inbox for low-confidence or risky AI actions.
2. Rebuild the design-agent input flow around mission structure.
3. Add branch summaries and comparison.
4. Connect chat and generative design with explicit handoffs.

## Big Swings
1. Build an AI operating system layer that spans Ask, Teach, Plan, Act, and Generate.
2. Make ProtoPulse AI adaptive by user role, project stage, and current view.
3. Turn the design agent into a genuinely differentiated mission planner for electronics and embedded workflows.

## Recommended First Three Moves
1. Clarify the AI role architecture in the current chat panel.
2. Productize the AI trust layer using the safety and review infrastructure that already exists.
3. Rebuild the design agent as a plan-first mission workflow instead of a bare prompt-plus-steps surface.
