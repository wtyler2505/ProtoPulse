# ProtoPulse Educational and Hobbyist UX Blueprint

Date: 2026-03-30  
Author: Codex  
Purpose: Define how ProtoPulse should evolve into a genuinely beginner-friendly, hobbyist-friendly, learning-centered electronics workbench for people with little or no prior experience.

## Core Thesis
ProtoPulse should not merely contain learning features. It should behave like a patient workshop teacher that helps people make real things.

The right target experience is:
- part workbench
- part tutor
- part lab guide
- part project coach
- part community clubhouse

That combination is what can make the product usable for:
- total beginners
- hobbyists and tinkerers
- returning makers who are rusty
- students in classrooms or clubs
- self-taught builders working alone at home

## What This Pass Confirmed

### Strong existing educational building blocks
Runtime and code review confirmed that ProtoPulse already has meaningful learning-oriented assets:
- `Knowledge` has a real article hub with beginner/intermediate/advanced levels and category filtering.
- `Starter Circuits` has pre-built circuits, difficulty filtering, and direct Arduino launch behavior.
- `Labs` has guided exercises, prerequisites, time estimates, progress tracking, and grading criteria.
- `Calculators` covers common beginner electronics tasks with fast inputs and immediate answers.
- `TutorialMenu` and `TutorialOverlay` provide interactive walkthrough infrastructure.
- `panel-explainer.ts` already contains contextual "Explain this panel" content for many views.
- `beginner-mode.ts` already remaps technical labels into plainer language.
- `role-presets.ts` already defines `student`, `hobbyist`, and `pro` presets with different visible views and hidden features.
- `learning-path.ts` already defines a structured beginner-to-PCB curriculum.
- `ai-tutor.ts` already defines an adaptive tutor model with hint, explain, challenge, and Socratic styles.
- `classroom.ts` already defines teacher/assignment/submission/grading flows.

### Core problem
These pieces do not yet feel like one coherent educational product.

In the current UX they read as separate features inside an expert shell rather than as one visible beginner journey.

## Fresh Runtime Observations

### `Starter Circuits` is promising but isolated
What works:
- clear concept
- good filters
- immediate gratification framing

What holds it back:
- it still lives inside the full expert shell
- it does not clearly answer "what should I learn from this?"
- it does not visibly bridge into architecture, breadboard, validation, and code as one guided path
- the floating checklist competes with the page's own educational purpose

### `Knowledge` is one of the best foundations in the app
What works:
- articles are categorized and leveled
- search and filtering are straightforward
- article list is rich enough to feel credible

What holds it back:
- it behaves like a reference library, not a guided teaching system
- it is detached from the user's current project
- it does not explicitly say "you should read this because your project uses X"
- it does not visibly connect to labs, starter circuits, or current validation errors

### `Labs` already looks close to a real learning product
What works:
- structured exercises
- prerequisites
- time estimates
- progress tracking
- grading criteria

What holds it back:
- it still feels tucked into the same heavy shell as every other power feature
- it does not clearly distinguish self-guided hobby use from classroom/assignment use
- it does not yet feel like the main front door for new learners

### `Calculators` is useful but not yet teach-forward
What works:
- practical tools for common beginner questions
- quick results
- familiar formulas

What holds it back:
- the page is still calculator-first, not understanding-first
- there is little "why this formula matters" guidance
- it does not strongly connect results back into the user's current design

### The shell still teaches the wrong lesson
The workspace currently tells a beginner:
- there are many tabs
- many of them are advanced
- some are blank or under-explained
- some guidance is floating
- some guidance is hidden in icons
- you are expected to know where to go next

That is the opposite of what a beginner learning environment should communicate.

## Key Product Insight
ProtoPulse's educational advantage is not "we have docs" or "we have tutorials."

Its advantage is the possibility of a closed-loop learning system:
1. learn a concept
2. try it in a starter project
3. apply it in architecture or schematic
4. test it in simulation or validation
5. build it in breadboard/Arduino
6. ship it to PCB/output
7. understand what happened and why

That loop is already partially present in the codebase. The next UX job is to surface it deliberately.

## Design Principles for Educational ProtoPulse

### 1. Learn by building, not by reading alone
Knowledge should always connect to action.

Every explanation should have a nearby action such as:
- try a starter circuit
- place this part
- run this check
- open this calculator
- simulate this change

### 2. The app should explain both "what" and "why"
A beginner-friendly tool cannot stop at buttons and outputs.

Every major surface should help answer:
- what is this
- why does it matter
- what should I do next
- what happens if I ignore it

### 3. Difficulty must be progressive and visible
Beginners should not have to decode which parts of the app are safe for them.

The app should visibly label:
- beginner-safe
- good next step
- advanced
- unlocked later
- not relevant yet

### 4. Plain language should change workflow, not just labels
Renaming `BOM` to `Parts List` helps, but it is not enough.

A real beginner mode must also:
- reduce visible complexity
- change the order of tasks
- simplify validation language
- increase explanation density
- slow down premature exposure to advanced manufacturing/EDA concepts

### 5. The app should never make a beginner feel stupid
That means:
- no giant issue counts without explanation
- no blank advanced panels
- no jargon without translation
- no "you should already know this" energy
- no hidden critical controls behind icon literacy

## Critical Gaps to Close

### Gap 1: The beginner layer is not visible enough
Important educational systems are either buried or not mounted in the visible UI.

Examples:
- `RolePresetSelector.tsx` exists but is not currently wired into the client UI.
- `useLearningPath()` is defined but not referenced outside its module.
- `useTutor()` is defined but not referenced outside its module.
- tutorial access currently lives in a small header icon rather than as a major beginner entry point.

Recommendation:
- make `Beginner`, `Hobbyist`, and `Pro` visible as top-level modes during project creation and in the shell
- surface the learning path in the dashboard and sidebar
- integrate AI tutor responses into learning surfaces and validation

### Gap 2: Learning surfaces are disconnected from project state
Today the user must manually connect:
- article reading
- starter circuits
- labs
- calculators
- design work

Recommendation:
- add "Used in your project" tags in Knowledge
- add "Recommended next learning step" cards on Dashboard
- make validation findings link to Knowledge articles and calculators
- make Starter Circuits show what concepts they teach and which next view to open afterward

### Gap 3: Guidance is generic instead of pedagogical
The current checklist is a progress tracker, not a teacher.

Recommendation:
- replace the checklist with a coach panel that can do three jobs:
  - sequence next steps
  - explain why a step matters
  - offer a hint, example, or safe fallback when the user gets stuck

### Gap 4: Learning affordances are mixed with expert shell noise
A beginner can still see too many destinations too early.

Recommendation:
- promote presets from passive capability to active shell control
- use `student` and `hobbyist` presets as the default first-run modes
- delay or soften advanced tabs until the user opts in or project maturity warrants it

## High-Value Feature Recommendations

### 1. Introduce a real `Learn Mode`
This should be more than a tab.

`Learn Mode` should reshape the shell:
- fewer visible destinations
- stronger next-step guidance
- plainer language
- larger empty-state teaching blocks
- visible tutorial/lab/path progress
- AI tuned to teaching rather than only task completion

### 2. Replace the first-run checklist with a `Coach Card`
The new coach should answer:
- Where am I?
- What am I trying to learn or build?
- What is the next best step?
- Do I want a hint, a walkthrough, or an example?

States:
- `Mission`
- `Hint`
- `Show me`
- `I'm stuck`
- `Explain why`

### 3. Turn the project picker into an intent chooser
For beginners the first question is not "which file do you want."
It is "what are you trying to do."

Recommended top-level entry choices:
- Learn electronics basics
- Build a beginner project
- Start from a starter circuit
- Continue my project
- Teach a class / run a lab
- Open an existing design

### 4. Create a `Build Your First Thing` path
This should be the flagship novice journey.

Candidate starter journeys:
- Blink an LED
- Read a button
- Read a temperature sensor
- Drive a motor
- Build a simple sensor logger

Each journey should include:
- what you will build
- what you will learn
- parts needed
- estimated time
- difficulty
- what "success" looks like

### 5. Upgrade `Starter Circuits` into full teaching launchpads
Add:
- learning goals
- required parts
- photos or wiring previews
- what can go wrong
- how to test success
- recommended next projects
- one-click "open in architecture"
- one-click "open in breadboard"
- one-click "open in Arduino"

### 6. Upgrade `Knowledge` from library to live mentor reference
Add:
- glossary view
- concept maps
- "you are using this in your project" callouts
- links from validation issues to relevant articles
- "learn this before you continue" recommendations
- beginner analogies and visual explanations

### 7. Upgrade `Labs` into the heart of structured learning
Add:
- self-guided path vs classroom path toggle
- checkpoint prompts
- optional hints
- reflection prompts after each lab
- "show me a worked example"
- automatic project-state checks so lab progress is verified instead of self-reported when possible

### 8. Upgrade `Calculators` into teaching calculators
Each calculator should add:
- plain-English explanation
- common use cases
- example values
- visual unit help
- "apply result to my project"
- "why this matters in real circuits"

### 9. Turn `Validation` into a learning coach
For beginners, validation should explain:
- what the issue means in plain English
- why it matters
- what symptom it might cause in real hardware
- one safe next fix
- one deeper explanation if the user wants to learn more

Group issues by:
- unsafe now
- likely to break the project
- quality improvements
- advanced manufacturing advice

### 10. Productize the AI tutor
The existing AI tutor capability should become a visible mode, not hidden infrastructure.

Recommended tutor actions:
- Explain simply
- Ask me guiding questions
- Give me a hint
- Show the next step
- Explain like I'm brand new
- Translate this jargon
- What should I test first?

### 11. Productize the learning path
The existing learning-path engine should drive:
- dashboard mission cards
- progress chips
- lab recommendations
- tutorial suggestions
- milestone celebrations
- "you are ready for this now" unlocks

### 12. Add a real `Hobbyist Mode`
This mode should target the self-taught maker who wants help but not school.

Defaults:
- practical project emphasis
- lighter explanation than student mode
- strong starter-project surfacing
- more community inspiration
- more "weekend build" framing
- softer validation strictness than pro mode

### 13. Curate Community for beginner safety
Add shelves like:
- Beginner safe
- One-evening builds
- No soldering required
- Good first Arduino projects
- Cheap parts only
- Classroom-friendly
- Parent/kid projects

Add trust metadata:
- tools required
- estimated build time
- likely failure points
- skill prerequisites
- bill of materials cost range

### 14. Surface educator mode intentionally
`classroom.ts` suggests real classroom ambition.

Turn that into visible product value:
- assignment templates
- teacher dashboard
- printable rubrics
- student-safe views
- submission review
- club and makerspace facilitation

### 15. Build a `panic-reduction` UX layer
For complete beginners, electronics can feel intimidating.

Add support patterns like:
- "safe to ignore for now"
- "common beginner mistake"
- "this is optional"
- "you do not need to understand this yet"
- "here is the 20-second version"

## Recommended Educational Information Architecture

### New top-level mode model
- Learn
- Build
- Test
- Ship

### Learn mode sub-areas
- Path
- Starter Projects
- Labs
- Concepts
- Quick Math
- Ask Tutor

### Build mode sub-areas
- Architecture
- Schematic
- Breadboard
- Arduino

### Test mode sub-areas
- Validation
- Simulation
- Debug

### Ship mode sub-areas
- Parts
- PCB
- Output

## Suggested Personas

### Absolute beginner
"I have never built a circuit before."

Needs:
- plain language
- strong defaults
- safe starter projects
- fast wins
- zero-shame help

### Curious hobbyist
"I kind of know Arduino but I am shaky on electronics."

Needs:
- practical examples
- wiring help
- sourcing help
- validation explanations
- progression into PCB and better practices

### Returning maker
"I used to tinker, but I forgot a lot."

Needs:
- refresher paths
- concept links
- quick calculators
- confidence rebuilding

### Instructor or club leader
"I need this to teach others."

Needs:
- assignments
- rubrics
- safe beginner workflows
- progress visibility
- reusable starter material

## Ship Order for the Educational Layer

### Fastest high-impact moves
1. Surface role presets in the real UI.
2. Promote beginner and hobbyist as first-run choices.
3. Replace the floating checklist with a contextual coach card.
4. Add project-linked recommendations to Knowledge, Labs, and Starter Circuits.
5. Re-label the tutorial entry so it is visible and understandable.

### Medium moves
1. Dashboard mission briefing powered by learning-path logic.
2. Validation rewrite for beginner-safe language and fix sequencing.
3. Teaching calculators with examples and applied design links.
4. Community beginner shelves and trust metadata.

### Big swings
1. Full Learn Mode shell.
2. Build Your First Thing journeys.
3. AI tutor integration across views.
4. Educator / classroom mode productization.

## Bottom Line
ProtoPulse is already much closer to an educational electronics platform than it currently appears.

The next win is not inventing education features from scratch. It is surfacing, connecting, and choreographing the learning systems that are already here so the whole app feels like it was designed for human beings who are still learning, not just for people who already know the map.
