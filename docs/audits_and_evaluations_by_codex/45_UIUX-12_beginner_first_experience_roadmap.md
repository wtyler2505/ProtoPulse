# ProtoPulse Beginner-First Experience Roadmap

Date: 2026-03-30  
Author: Codex  
Purpose: Turn the educational and hobbyist UX blueprint into a practical ship order focused on making ProtoPulse welcoming, teachable, and easy for first-time builders.

## Outcome Target
Within a user's first hour, ProtoPulse should make it realistic for someone with no electronics background to:
- understand what the app is for
- choose a safe starting path
- complete a small success
- understand at least one core concept
- feel confident enough to keep going

## Current Reality
Today the app already contains:
- starter circuits
- labs
- knowledge articles
- calculators
- tutorials
- panel explainers
- role presets
- a learning-path engine
- an AI tutor engine

But a beginner still has to discover and stitch these together manually while navigating a shell that feels broader and more advanced than their confidence level.

## Phase 1: Surface the Hidden Beginner Layer
Goal: Make beginner help visible without rebuilding the entire app.

Ship:
1. Surface `Student`, `Hobbyist`, and `Pro` presets in project creation and workspace settings.
2. Default new users to `Hobbyist` or explicitly let them choose before entering the workspace.
3. Promote the tutorial entry from unlabeled icon behavior to an obvious, named control.
4. Show a dashboard `Start Here` card using the existing learning-path definitions.
5. Replace the current floating checklist with a docked `Coach` panel in beginner and hobbyist modes.

Why this matters:
- It productizes capabilities that already exist in the codebase.
- It reduces beginner confusion quickly without requiring a full shell rewrite first.

Success signals:
- more tutorial starts
- more beginner/hobbyist preset adoption
- less bounce after first project creation

## Phase 2: Make the First Success Feel Inevitable
Goal: Help a brand-new user accomplish something real, fast.

Ship:
1. Add a first-run intent chooser:
   - Learn basics
   - Build a simple project
   - Start from a starter circuit
   - Continue a project
   - Teach a lab
2. Create 3-5 flagship `Build Your First Thing` paths.
3. Add a beginner-safe dashboard mission card:
   - what you are building
   - what you will learn
   - time estimate
   - next step button
4. Add "what success looks like" framing to starter circuits and labs.
5. Add "I am stuck" help actions that route to tutorial, AI tutor, or a guided hint.

Why this matters:
- beginners need a win before they need breadth
- a real small success builds trust far more than a feature tour

Success signals:
- time to first starter project launch
- time to first architecture node
- percent of new users who complete one guided action

## Phase 3: Connect Learning to Real Design Work
Goal: Stop treating education as a separate tab.

Ship:
1. Add contextual links from validation issues to Knowledge articles and calculators.
2. Add `Used in your project` recommendations inside Knowledge.
3. Add concept tags to starter circuits:
   - PWM
   - pull-up resistor
   - voltage divider
   - motor driver
4. Add view-bridging CTAs:
   - open this in breadboard
   - open this in Arduino
   - test this in simulation
   - validate this design
5. Add plain-English explanations and examples to calculators.

Why this matters:
- learning sticks better when it is attached to the user's real work
- this is where ProtoPulse can outperform disconnected tutorials and separate tools

Success signals:
- more cross-view transitions from learning surfaces into design surfaces
- more article opens triggered from design/validation context
- more calculator usage tied to project actions

## Phase 4: Turn Validation and Guidance into Coaching
Goal: Reduce fear and increase comprehension when things go wrong.

Ship:
1. Rewrite beginner validation groups:
   - fix this now
   - likely to cause trouble
   - good improvement later
   - advanced manufacturing advice
2. Add plain-English issue explanations and real-world symptom framing.
3. Add one recommended fix path for each major validation cluster.
4. Add `Explain why` and `Teach me this` actions in validation, simulation, and procurement.
5. Use the AI tutor engine for adaptive hints based on user mode and repeated errors.

Why this matters:
- validation is currently one of the strongest intimidation sources in the product
- if ProtoPulse can teach through mistakes, it becomes much harder to abandon

Success signals:
- lower abandonment after opening validation
- more issue resolution after first validation run
- lower repeat exposure to the same beginner errors

## Phase 5: Build the Learn Mode Shell
Goal: Give education and hobbyist use cases a first-class home.

Ship:
1. Add a visible `Learn` mode shell with reduced complexity.
2. Reorganize learning destinations into:
   - Path
   - Starter Projects
   - Labs
   - Concepts
   - Quick Math
   - Ask Tutor
3. Add path progress, milestones, and safe unlocks.
4. Make advanced tabs clearly labeled as optional or later-stage.
5. Give the AI assistant explicit teaching personas:
   - tutor
   - coach
   - debugger
   - explain-like-I'm-new

Why this matters:
- at this point ProtoPulse stops being "expert tool plus docs" and becomes an actual learning workbench

Success signals:
- more repeated weekly usage by new users
- deeper progression from starter projects into architecture/schematic/Arduino
- better retention among beginner and hobbyist cohorts

## Phase 6: Hobbyist Delight and Community Growth
Goal: Make ProtoPulse feel like the place hobbyists want to keep coming back to.

Ship:
1. Add curated community shelves:
   - weekend projects
   - no-solder builds
   - first Arduino projects
   - parent/kid friendly
   - budget builds
2. Add build metadata:
   - cost range
   - tools needed
   - estimated time
   - skill prerequisites
   - risk level
3. Add "next project after this one" recommendations.
4. Add makerspace/classroom bundles and printable lab paths.
5. Celebrate milestones without getting gimmicky:
   - first successful validation
   - first simulated circuit
   - first Arduino upload
   - first export bundle

Why this matters:
- hobbyists do not just need help; they need momentum, inspiration, and project continuity

Success signals:
- more project creation from community entries
- more repeat project starts
- more multi-session learning path completion

## Specific Quick Wins Worth Doing Immediately
1. Mount `RolePresetSelector` in visible UI.
2. Replace the checklist title `Getting Started` with a more helpful coach framing.
3. Add labels to tutorial-related header buttons for accessibility and clarity.
4. Show recommended beginner-safe tabs first and collapse advanced ones in `student` mode.
5. Add learning goals and next-step CTA blocks to Starter Circuits.
6. Add beginner-friendly explanatory sidebars to Calculators and Validation.
7. Promote Labs and Starter Circuits much earlier in first-run flows.

## Implementation Strategy Recommendation
Start by productizing the hidden learning infrastructure before building new systems from scratch.

Best immediate leverage:
- `role-presets.ts`
- `beginner-mode.ts`
- `learning-path.ts`
- `ai-tutor.ts`
- `TutorialMenu`
- `panel-explainer.ts`
- `LabTemplatePanel`
- `StarterCircuitsPanel`
- `KnowledgeView`

This sequence is attractive because it creates visible beginner value using assets ProtoPulse already owns.

## What Not to Do
Do not:
- add even more floating guidance layers
- dump more tabs into the shell and call it education
- rely on label renaming alone as "beginner mode"
- bury tutorial and learning controls behind unlabeled icons
- flood beginners with full-strength validation or manufacturing detail before they are ready

## Success Metrics

### Beginner confidence
- percent of new users who complete one guided starter action
- time to first "I built something" moment
- time to first tutorial or lab start

### Learning progression
- percent of new users who move from starter circuit to architecture or schematic
- percent of beginner users who open Knowledge from contextual links
- percent of validation issues opened in explain mode

### Hobbyist retention
- weekly repeat usage for beginner/hobbyist cohorts
- number of projects started per user
- transition rate from beginner mode into hobbyist mode

### Teaching / classroom potential
- lab starts
- lab completions
- assignment creations
- rubric/grading usage once classroom mode is surfaced

## Bottom Line
The fastest path to making ProtoPulse radically more beginner-friendly is not a giant reinvention. It is a focused effort to surface the learning systems already in the product, simplify the first-run shell, sequence the first wins, and make the app teach through action instead of expecting the user to self-navigate an expert map.
