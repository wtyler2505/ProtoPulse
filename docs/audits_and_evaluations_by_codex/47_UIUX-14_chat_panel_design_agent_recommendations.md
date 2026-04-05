# ProtoPulse AI Chat Panel and Design Agent Recommendations

Date: 2026-03-30  
Author: Codex  
Purpose: Provide a surface-by-surface AI UX audit plus concrete improvement ideas for the chat panel, the design agent, and the most important AI touchpoints across the app.

## Evidence Used
- `docs/audits_and_evaluations_by_codex/evidence/uiux-2026-03-30/15-chat-panel-ai-pass.png`
- `docs/audits_and_evaluations_by_codex/evidence/uiux-2026-03-30/16-design-agent-ai-pass.png`
- `docs/audits_and_evaluations_by_codex/evidence/uiux-2026-03-30/17-generative-design-ai-pass.png`
- `client/src/components/panels/ChatPanel.tsx`
- `client/src/components/panels/chat/DesignAgentPanel.tsx`
- `client/src/components/panels/chat/MessageInput.tsx`
- `client/src/components/panels/chat/SettingsPanel.tsx`
- `client/src/components/panels/chat/MessageBubble.tsx`
- `client/src/lib/ai-safety-mode.ts`
- `client/src/lib/ai-review-queue.ts`
- `server/ai.ts`
- `server/routes/agent.ts`

## Executive Read
The ProtoPulse AI chat panel already contains more serious product DNA than most embedded chat sidebars. It can stream grounded responses, accept multimodal input, preview actions, show sources, and work as a state-aware assistant instead of a generic chatbot.

The problem is not lack of capability. The problem is packaging. The current chat panel still reads like one crowded control strip containing several AI concepts at once, and the design agent still reads like a powerful but underexplained experimental tab. The result is that the AI feels impressive after inspection, but not yet self-evident or beginner-safe on first contact.

## Chat Panel

### What already works
- The empty state points users toward real work rather than generic prompting.
- Quick actions reduce prompt anxiety.
- Action previews are a strong trust pattern.
- Source chips and confidence affordances are solid foundations.
- Multimodal entry creates a strong "show, don't just tell" capability.
- Branching and export suggest that conversations can become real project artifacts.

### Primary friction points

#### 1) The panel does too many jobs without enough structural separation
The current surface contains:
- conversation
- quick actions
- multimodal upload
- voice input
- settings
- search
- export
- branches
- a separate design-agent tab

That makes the panel powerful, but also mentally dense.

#### 2) The title `ProtoPulse AI` is too generic for the number of roles involved
The user is not being told whether this panel is best for:
- asking questions
- changing the project
- planning work
- teaching concepts
- reviewing designs

#### 3) The composer is overloaded
The input row currently asks the user to interpret:
- upload
- multimodal menu
- voice input
- send
- quick actions

This works once learned, but it is high-friction for beginners.

#### 4) Quick actions are useful but not contextual enough
The current suggestions are broad and helpful, but they still feel global. They should be more aware of:
- active view
- current artifact
- project maturity
- role preset
- recent AI usage

#### 5) Strong trust features are present but visually secondary
The system already has:
- action previews
- sources
- confidence
- safety classifications

These should be more central to the visual identity of the AI product.

### Recommended chat-panel upgrades

#### Recommendation 1: Split the chat panel into clearer submodes
Keep one panel, but structure it as:
- `Ask`
- `Teach`
- `Act`
- `Review`

This reduces ambiguity without forcing users into totally separate products.

#### Recommendation 2: Simplify the composer into a clearer action model
Instead of one dense control strip, reshape the bottom area into:
- a prompt box
- a clear attach control
- an optional `Speak` control
- a visible mode label
- a small `What I can use` hint

#### Recommendation 3: Make quick actions view-aware
Examples:
- `Architecture`: "Turn this idea into a starter architecture"
- `Schematic`: "Explain this connection" or "Check likely wiring mistakes"
- `Validation`: "Group these issues by what to fix first"
- `Procurement`: "Find safer substitutes"
- `Arduino`: "Create a starter sketch for this board"

#### Recommendation 4: Add a visible `Context` drawer
Show:
- active project
- active view
- artifacts in scope
- uploaded media in scope
- whether recent validation/BOM/history are being used

This is one of the highest-leverage trust improvements available.

#### Recommendation 5: Promote trust receipts into the main reading flow
Every substantial AI answer should clearly signal:
- answer type: explanation, suggestion, plan, pending action
- confidence
- sources used
- risk level if action is involved

#### Recommendation 6: Make branches understandable
Conversation branching is powerful, but it currently risks reading as an advanced hidden feature.

Improve it with:
- clearer labels such as `Exploration`, `Safe Option`, `Aggressive Option`
- compare-branch affordances
- branch summaries

#### Recommendation 7: Reframe settings around task outcomes first
Instead of foregrounding routing and model details, offer presets such as:
- `Best explanations`
- `Fastest responses`
- `Most careful changes`
- `Lowest cost`
- `Beginner-safe`

Keep the advanced model controls under an expandable section.

## Design Agent

### What already works
- The separate tab correctly implies a different class of AI interaction.
- Step streaming implies a longer-running workflow.
- The presence of max-step control hints at bounded autonomy.

### Primary friction points

#### 1) The surface is too minimal for such a major promise
Right now the core setup is essentially:
- describe what you want
- optionally adjust max steps
- press run

That is not enough framing for a tool that can materially change project direction.

#### 2) The agent's contract is not legible
The user needs clearer answers to:
- what will this agent try to do
- what artifacts can it modify
- what kinds of checkpoints it will use
- how much review will be required
- when this is better than normal chat

#### 3) There is no plan-before-execution moment
This is the biggest UX gap.

The agent should not jump straight from natural-language objective to execution. It should usually show:
- mission summary
- proposed plan
- assumptions
- expected outputs
- risks

#### 4) There is no strong handoff to or from generative design
The design agent and generative design surface currently feel adjacent but disconnected.

#### 5) The current control language is agent-centric, not user-centric
`max steps` is a real technical control, but it is not the language most users think in.

### Recommended design-agent upgrades

#### Recommendation 1: Reframe the surface as `Mission Planner`
A stronger structure would be:
- `Goal`
- `Constraints`
- `Success criteria`
- `Preferred style`
- `Review level`

This makes the tool more legible for both beginners and advanced users.

#### Recommendation 2: Add a plan-preview stage
Before execution, show:
- what the agent intends to do
- which views/artifacts it expects to touch
- where approval checkpoints will occur
- likely outputs such as architecture, BOM, validation review, firmware scaffold

#### Recommendation 3: Replace or supplement `max steps` with human-language controls
Examples:
- `Quick pass`
- `Balanced`
- `Thorough`
- `Review every major change`

Keep `max steps` as an advanced override, not the primary framing.

#### Recommendation 4: Add mission templates
Examples:
- `Build a beginner starter project`
- `Create an architecture from a concept`
- `Review and clean up this design`
- `Prepare this project for procurement`
- `Get this project Arduino-ready`

Templates are especially important for prompt-shy users.

#### Recommendation 5: Add a live execution timeline
Instead of streaming plain steps only, present:
- current stage
- completed stages
- pending stages
- blocked stages
- review required

#### Recommendation 6: Add intervention points
Let the user pause to:
- clarify a constraint
- swap strategy
- approve or reject a plan branch
- request a simpler or safer approach

#### Recommendation 7: Connect the design agent to generative design
Allow flows like:
- chat discusses design idea
- mission planner defines objective
- generative design explores candidate options
- chosen option becomes architecture/BOM changes

## Generative Design

### What already works
- constraint-driven inputs are strong
- it feels meaningfully different from ordinary chat

### Primary friction points
- it does not clearly explain when to use it
- it does not feel connected to the main AI narrative
- it does not visibly teach tradeoffs for less experienced users

### Recommended upgrades
- add `When to use this` education block
- add `Explain these candidates like I'm learning` mode
- add explicit send-to-chat and send-to-mission-planner actions
- show why a candidate won or lost in plain language

## App-Wide AI Recommendations

### Dashboard
- Add an `AI Mission Card` that explains the best next AI-assisted step.
- Make the AI entry point obvious even when the chat panel is collapsed.

### Architecture
- Add a `Build this with me` action that turns rough intent into a guided architecture.
- Let AI explain each node, edge, and interface in beginner language.

### Schematic and Breadboard
- Add an `Explain this circuit` action.
- Let AI highlight likely wiring mistakes with educational commentary.

### Validation
- Turn AI into a triage coach:
  - what matters now
  - what can wait
  - what each warning actually means

### Procurement
- Add `Find substitutes`, `Explain why this part matters`, and `Reduce cost without breaking intent`.

### Arduino
- Add a setup-oriented AI launcher:
  - choose board
  - generate starter sketch
  - explain upload path
  - troubleshoot serial issues

### Knowledge and Labs
- Integrate the tutor system so AI can recommend articles, labs, and explanations that match the current project stage.

## Highest-Leverage Fixes
1. Clarify AI mode roles in the chat panel.
2. Add a visible context drawer.
3. Make quick actions view-aware and maturity-aware.
4. Turn the design agent into a plan-first workflow.
5. Connect generative design, chat, and design agent into one understandable system.
6. Productize safety, confidence, and review as the AI trust layer.
7. Rewrite AI settings and help copy around user goals instead of provider jargon.
