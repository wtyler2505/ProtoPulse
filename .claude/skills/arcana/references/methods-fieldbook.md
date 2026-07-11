# ARCANA — CREATIVE METHODS FIELDBOOK

Title: Arcana Creative Methods Fieldbook  
Purpose: Give Arcana practical, repeatable procedures for diagnosing problems, generating non-obvious options, combining concepts, and challenging weak assumptions.  
Version: 1.0  
Last Updated: 2026-06-21  
Intended Uses: Product and service design, software and UI/UX, business strategy, marketing, operations, creative projects, hobbies, personal development, and facilitated workshops.  
Not Intended For: Method theater, replacing subject-matter expertise, inventing evidence, or forcing every request through every framework.  
Evidence Standard: Methods generate hypotheses and structured options. Their outputs require validation through observation, research, prototypes, or real-world tests.

---

## How Arcana Should Use This Fieldbook

A method is useful only when it changes the quality of the decision.

Arcana should:

1. Diagnose the current bottleneck before choosing a method.
2. Use the lightest method capable of improving the answer.
3. State the result of the method, not merely its name.
4. Translate abstract outputs into concrete design choices.
5. Separate generated possibilities from validated facts.
6. Stop using a method once it no longer produces meaningful distinctions.
7. Combine methods only when each performs a different job.

Do not perform a framework ceremonially. A short request may need one method and three sentences. A complex workshop may need several methods in sequence.

### Default Method Sequence

For ambiguous, consequential problems, use:

1. **Diagnose:** First Principles, Jobs to Be Done, or Journey Mapping
2. **Open:** Assumption Reversal, Analogy Transfer, SCAMPER, or TRIZ
3. **Structure:** Morphological Analysis or Concept Synthesis
4. **Challenge:** Pre-Mortem or Second-Order Effects
5. **Decide:** Pass promising concepts to Arcana's evaluation and experiment toolkit

---

# METHOD SELECTOR

## When the problem itself is unclear

Use:

- First-Principles Deconstruction
- Jobs to Be Done
- Five Whys and the Why-Why Map
- Journey Mapping
- Stakeholder Inversion

## When ideas feel predictable

Use:

- Assumption Audit and Reversal
- Analogy Transfer
- Oblique Prompts
- SCAMPER
- Ten-Times / One-Tenth

## When constraints appear contradictory

Use:

- TRIZ-Style Contradiction Solving
- Constraint Inversion
- Forced Subtraction
- First-Principles Deconstruction

## When the solution space is too large or chaotic

Use:

- Morphological Analysis
- Concept Synthesis
- Single-Variable Exploration
- Six Perspectives

## When the experience or workflow is broken

Use:

- Journey Mapping
- Service Blueprinting
- Friction and Flow Analysis
- Stakeholder Inversion

## When the idea looks exciting but risky

Use:

- Pre-Mortem
- Second-Order Effects
- Failure Boundary Mapping
- Reversible Prototype Design

---

# METHOD 01 — FIRST-PRINCIPLES DECONSTRUCTION

## Purpose

Reduce a problem to the few facts, needs, and physical or logical constraints that remain true when conventions are removed.

## Best For

- Problems framed as “this is how the industry works”
- Expensive systems with many inherited steps
- Product requests containing premature feature decisions
- Situations where existing solutions are being copied rather than questioned

## Avoid When

The issue is already simple, or the relevant rule is a genuine legal, safety, ethical, or physical constraint.

## Inputs

- Stated problem
- Desired outcome
- Current process or solution
- Known constraints
- Claims treated as facts

## Procedure

1. Write the desired outcome without naming the existing solution.
2. List everything currently believed to be required.
3. Label each item:
   - Physical fact
   - Legal or ethical requirement
   - Evidence-backed user need
   - Operational choice
   - Tradition or assumption
4. Remove traditions and choices temporarily.
5. Rebuild the smallest system capable of producing the outcome.
6. Reintroduce removed elements only when they earn their cost.
7. Identify the new leverage point.

## Output

- A solution-neutral problem statement
- A fact-versus-assumption map
- A minimal architecture
- One or more conventions worth testing

## Mini Example

Request: “We need an app so neighbors can lend tools.”

First-principles outcome: “A neighbor can discover, request, receive, and return a suitable tool with acceptable trust and effort.”

The app is not a fact. The minimum system might be a printed inventory, a weekly pickup window, and a named steward. Software becomes justified only if scale or coordination proves the need.

## Common Failure Modes

- Treating personal preference as a physical fact
- Ignoring social and emotional constraints because they are not technical
- Removing safeguards in the name of simplicity
- Rebuilding the same system with different vocabulary

## Strong Pairings

Jobs to Be Done, Forced Subtraction, Manual First, Pre-Mortem

---

# METHOD 02 — JOBS TO BE DONE

## Purpose

Identify the functional, emotional, and social progress a person is trying to make in a specific situation.

## Best For

- Feature requests
- Weak adoption or retention
- Confusing customer segments
- Products that are technically competent but feel irrelevant
- Situations where users rely on unexpected workarounds

## Avoid When

The requirement is explicit and non-negotiable, such as a compliance obligation or accessibility need.

## Inputs

- Triggering situation
- Current workaround
- Desired progress
- Anxieties
- Trade-offs
- Evidence of success

## Procedure

1. Complete the sentence:  
   “When ___ happens, I want to ___, so I can ___.”
2. Identify:
   - Functional job
   - Emotional job
   - Social job
3. Ask what the user currently “hires” instead.
4. Identify forces:
   - Push away from current state
   - Pull toward a new solution
   - Anxiety about changing
   - Habit preserving the status quo
5. Design for progress, not merely feature delivery.
6. Test whether the solution helps in the triggering situation.

## Output

- Job statement
- Motivation map
- Competitive alternatives, including non-products
- Outcome-focused design criteria

## Mini Example

A commuter asking for more podcast recommendations may not have a discovery problem. The job could be: “Help me reliably shift from work mode to home mode during a 25-minute drive.” A recurring short series may serve the job better than a larger catalog.

## Common Failure Modes

- Writing a demographic profile instead of a job
- Describing what the product does rather than the user's progress
- Assuming one job applies to every usage situation
- Inventing emotional motives without validation

## Strong Pairings

Journey Mapping, The Threshold lens, Analogy Transfer, Evidence Ladder

---

# METHOD 03 — FIVE WHYS AND THE WHY-WHY MAP

## Purpose

Move from a visible symptom toward plausible root causes without assuming there is only one linear cause.

## Best For

- Repeated operational failures
- Behavior that contradicts stated intentions
- Surface-level problem statements
- Teams treating the first explanation as final

## Avoid When

The problem is caused by interacting systems and the team insists on one simplistic root cause. Use a branching Why-Why Map rather than a single chain.

## Inputs

- Observable symptom
- Specific incident or pattern
- Available evidence
- People involved in the process

## Procedure

1. State the symptom in observable terms.
2. Ask why it occurred.
3. For every answer, ask:
   - What evidence supports this?
   - Is this a cause, correlation, or interpretation?
4. Branch when multiple causes are plausible.
5. Continue until reaching factors the team can influence.
6. Mark causes requiring additional evidence.
7. Select the smallest high-leverage cause to test.

## Output

- Branching causal hypotheses
- Evidence gaps
- Controllable leverage points
- A prioritized diagnostic test

## Mini Example

Symptom: Workshop registrations are high, but attendance is low.

Possible branches:

- People forget → reminders arrive too early
- People lose confidence → required skill is unclear
- Plans change → cancellation is inconvenient
- Registration is too easy to make casually → no meaningful commitment

Each branch implies a different intervention.

## Common Failure Modes

- Stopping at “people are lazy”
- Blaming an individual for a system failure
- Confusing repeated “why” questions with evidence
- Assuming the fifth answer is automatically the root cause

## Strong Pairings

Journey Mapping, Pre-Mortem, Friction and Flow Analysis

---

# METHOD 04 — ASSUMPTION AUDIT AND REVERSAL

## Purpose

Expose inherited beliefs and generate alternatives by reversing one assumption at a time.

## Best For

- Mature categories with conventional solutions
- Creative blocks
- “Everyone knows” statements
- Experiences that feel interchangeable

## Avoid When

The assumption protects safety, consent, accessibility, or legal rights.

## Inputs

- Current model
- Category conventions
- User expectations
- Constraints

## Procedure

1. List at least ten assumptions embedded in the current approach.
2. Classify each:
   - Necessary
   - Useful
   - Untested
   - Historical
3. Select one high-impact, low-certainty assumption.
4. Reverse it literally.
5. Explore consequences without judging them immediately.
6. Extract useful mechanisms from the reversal.
7. Return to reality and design a bounded version.

## Output

- Assumption inventory
- Reversed scenarios
- One or more practical reframes
- A testable alternative

## Mini Example

Assumption: “The expert should answer questions.”

Reversal: “The expert cannot answer questions.”

Useful mechanism: Participants first compare attempted answers and identify disagreement. The expert then teaches only where confusion remains.

## Common Failure Modes

- Reversing several assumptions at once
- Presenting the absurd reversal as the recommendation
- Treating novelty as proof of value
- Ignoring why the original convention exists

## Strong Pairings

SCAMPER, Constraint Inversion, Shadow Test

---

# METHOD 05 — CONSTRAINT INVERSION

## Purpose

Turn a limitation into a generative rule that shapes the solution rather than merely shrinking it.

## Best For

- Low budgets
- Limited materials
- Small spaces
- Short timelines
- No-technology or low-technology requirements
- Restrictions that cannot be negotiated away

## Avoid When

The “constraint” is optional, harmful, or created by poor planning. Remove artificial constraints before celebrating them.

## Inputs

- Fixed constraint
- Desired outcome
- Resources still available
- Costs the constraint creates

## Procedure

1. State the constraint precisely.
2. Identify what it prevents.
3. Ask what the absence makes easier, more focused, or more distinctive.
4. Derive a visible design rule.
5. Generate three concepts that use the rule differently.
6. Check whether hidden labor or risk has been shifted elsewhere.
7. Select a concept that users experience as intentional.

## Output

- Constraint-derived design principle
- Differentiated concepts
- Burden-shift check
- Testable implementation rule

## Mini Example

Constraint: A traveling exhibit cannot use electricity.

Inversion: Every interaction must be readable, tactile, mechanical, or facilitator-led. The exhibit becomes portable and usable in outdoor and low-resource settings rather than a compromised digital exhibit.

## Common Failure Modes

- Rebranding scarcity without improving the result
- Pretending a limitation is beneficial to everyone
- Ignoring accessibility consequences
- Adding expensive workarounds that violate the spirit of the constraint

## Strong Pairings

First Principles, Forced Subtraction, Borrow-Don't-Build

---

# METHOD 06 — SCAMPER

## Purpose

Systematically transform an existing concept through seven modification prompts.

## Best For

- Improving an existing product, process, event, or creative work
- Generating variants quickly
- Breaking attachment to one implementation
- Workshops requiring a common ideation structure

## Avoid When

The root problem is unclear. SCAMPER modifies what exists; it does not guarantee that the existing thing should exist.

## Prompts

- **Substitute:** Replace a component, role, material, channel, or rule
- **Combine:** Merge functions, moments, audiences, or resources
- **Adapt:** Borrow a mechanism from another context
- **Modify:** Change size, pace, intensity, form, or emphasis
- **Put to another use:** Reassign an output, asset, or byproduct
- **Eliminate:** Remove a step, feature, decision, or dependency
- **Reverse/Rearrange:** Change order, direction, ownership, or timing

## Procedure

1. Define the current concept and intended outcome.
2. Apply each prompt separately.
3. Produce at least two concrete changes per prompt.
4. Remove cosmetic variants.
5. Group ideas by underlying mechanism.
6. Combine only complementary mechanisms.
7. Select concepts that improve the outcome under real constraints.

## Output

- Structured variant set
- Mechanism clusters
- Candidate improvements
- Hybrid concepts

## Mini Example

For a local lecture series:

- Substitute speakers with participant demonstrations
- Combine lecture and neighborhood walk
- Adapt museum labels into pre-event reading cards
- Modify from 90 minutes to three 20-minute chapters
- Put recordings to use as newcomer orientation
- Eliminate formal introductions
- Reverse the order so questions come before the talk

## Common Failure Modes

- Producing trivial cosmetic changes
- Combining every idea into feature soup
- Using SCAMPER before understanding user needs
- Treating all seven prompts as equally valuable

## Strong Pairings

Jobs to Be Done, Concept Synthesis, Counterfactual Twin

---

# METHOD 07 — TRIZ-STYLE CONTRADICTION SOLVING

## Purpose

Resolve a tension where improving one desirable property appears to worsen another.

## Best For

- “We need more X without more Y”
- Product trade-offs
- Operational constraints
- Service designs balancing speed and care
- Systems stuck in compromise

## Avoid When

The trade-off is not real or the desired properties are poorly defined.

## Inputs

- Desired improvement
- Undesired consequence
- Current compromise
- Available resources and boundaries

## Procedure

1. Write the contradiction:
   “We need more ___, but that causes more/less ___.”
2. Ask whether the properties can be separated by:
   - Time
   - Place
   - User segment
   - Condition
   - Scale
   - Component
3. Explore mechanisms such as:
   - Pre-action
   - Segmentation
   - Self-service
   - Redundancy
   - Feedback
   - Modularity
   - Reversibility
4. Generate solutions that dissolve rather than average the trade-off.
5. Verify that the conflict has not merely moved elsewhere.

## Output

- Clear contradiction
- Separation strategies
- Non-compromise concepts
- Burden transfer check

## Mini Example

Contradiction: A museum tour should feel personalized without requiring more guides.

Separation by time and condition: Visitors choose one of three interest cards before the tour. The same guide route includes optional branches triggered by the group's cards.

## Common Failure Modes

- Treating “do both” as a solution
- Hiding additional labor
- Selecting an abstract principle without a concrete mechanism
- Solving the local contradiction while worsening the full system

## Strong Pairings

Morphological Analysis, Service Blueprinting, Pre-Mortem

---

# METHOD 08 — MORPHOLOGICAL ANALYSIS

## Purpose

Explore a complex solution space by separating a concept into dimensions and recombining options systematically.

## Best For

- Products or services with many design variables
- Business model exploration
- Event formats
- Naming or brand systems
- Situations where brainstorming repeats familiar combinations

## Avoid When

The problem has only one or two meaningful variables, or the dimensions are arbitrary.

## Inputs

- Clear outcome
- Three to seven independent dimensions
- Options for each dimension
- Constraints that eliminate impossible combinations

## Procedure

1. Define the decision.
2. Select meaningful dimensions, such as:
   - Audience
   - Delivery mode
   - Timing
   - Revenue source
   - Participation role
   - Setting
3. Generate three to six options per dimension.
4. Build a matrix.
5. Combine one option from each dimension.
6. Reject incompatible combinations with reasons.
7. Search deliberately for:
   - Lowest-friction combination
   - Highest-differentiation combination
   - Most resilient combination
8. Turn promising combinations into coherent concepts.

## Output

- Morphological matrix
- Novel combinations
- Constraint logic
- Candidate concepts

## Mini Example

For a reading program:

- Audience: children / adults / mixed
- Setting: café / park / home kit
- Role: listener / performer / curator
- Cadence: weekly / seasonal / one-day
- Artifact: card / map / shared anthology

One combination might be: adults + park + curator + seasonal + map.

## Common Failure Modes

- Choosing dimensions that overlap
- Treating random combinations as finished concepts
- Generating an unmanageable matrix
- Ignoring implementation compatibility

## Strong Pairings

SCAMPER, Concept Synthesis, Evaluation Matrix

---

# METHOD 09 — FORCED SUBTRACTION

## Purpose

Improve clarity, cost, speed, or usability by removing an element and redesigning around its absence.

## Best For

- Bloated products
- Overlong workflows
- Events with too many segments
- Creative projects suffering from excess
- Services that require repeated explanation

## Avoid When

The target element supports safety, accessibility, trust, or essential recovery.

## Procedure

1. List all components or steps.
2. Rank them by:
   - User value
   - Cost
   - Complexity
   - Failure risk
3. Select one high-cost or low-value component.
4. Remove it completely in a thought experiment.
5. Ask:
   - What essential function disappears?
   - Can another element absorb that function?
   - Can the need be prevented instead?
6. Build a stripped prototype.
7. Compare outcome quality, not merely simplicity.

## Output

- Removal candidate
- Essential-function map
- Simplified design
- Evidence needed before permanent removal

## Mini Example

Remove the dashboard from a project tool. Replace it with a daily message containing only exceptions, blocked items, and the next decision. The user may need awareness, not another destination.

## Common Failure Modes

- Removing visible interface while transferring complexity to staff
- Confusing fewer features with better design
- Cutting differentiation while preserving bureaucracy
- Refusing to restore an element when evidence shows it matters

## Strong Pairings

First Principles, Counterfactual Twin, Single Spine

---

# METHOD 10 — ANALOGY TRANSFER

## Purpose

Borrow a mechanism from another domain and translate it into a concrete design decision.

## Best For

- Stale category conventions
- Complex behavior or experience problems
- Teams needing an outside perspective
- Problems with useful analogues in logistics, theater, hospitality, nature, games, education, or ritual

## Avoid When

The analogy is based on surface resemblance, prestige, or metaphor rather than mechanism.

## Procedure

1. Define the target problem in functional terms.
2. Ask: “Where else is this problem solved under different conditions?”
3. Choose a source domain.
4. Extract the mechanism:
   - What changes behavior?
   - What coordinates action?
   - What creates trust?
   - What prevents failure?
5. Strip away domain-specific decoration.
6. Translate the mechanism into the target context.
7. Identify where the analogy breaks.
8. Test the translated mechanism.

## Output

- Source mechanism
- Translation bridge
- Concrete design implication
- Boundary conditions

## Mini Example

Source: Theater uses a visible call time and backstage cues to coordinate people who cannot constantly meet.

Transfer: A volunteer event uses role cards, cue points, and one stage manager rather than a long pre-event meeting.

## Common Failure Modes

- Saying “be like Apple” or “think like nature” without a mechanism
- Copying aesthetics instead of structure
- Ignoring differences in incentives and risk
- Treating the source example as proof

## Strong Pairings

Assumption Reversal, Journey Mapping, Shadow Test

---

# METHOD 11 — TEN-TIMES / ONE-TENTH

## Purpose

Use extreme scale to expose structural changes hidden by incremental thinking.

## Best For

- Capacity planning
- Pricing and business models
- Workflow design
- Creative projects that feel stuck at current scope
- Testing whether a concept depends on one scale

## Avoid When

The extremes are treated as forecasts rather than diagnostic provocations.

## Procedure

1. Describe the current model.
2. Imagine ten times the users, volume, speed, or impact.
3. List what breaks first.
4. Identify what must be standardized, delegated, automated, or removed.
5. Imagine one-tenth the users, budget, time, or materials.
6. Identify what can become personal, artisanal, or focused.
7. Import one structural insight from each extreme.
8. Design a present-scale hybrid.

## Output

- Scale failure map
- Structural alternatives
- Present-scale redesign
- New assumptions to test

## Mini Example

A 20-person class imagined for 200 reveals the need for peer feedback. Imagined for two reveals the value of individualized goals. The present design uses small peer pods with personalized goal cards.

## Common Failure Modes

- Saying “make it 10x better” without defining a variable
- Using fantasy scale to justify unnecessary technology
- Ignoring quality and human limits
- Bringing back incompatible insights

## Strong Pairings

Bottleneck Analysis, Host Rotation, Morphological Analysis

---

# METHOD 12 — STAKEHOLDER INVERSION

## Purpose

Redesign the problem from the perspective of a stakeholder who normally absorbs hidden cost or lacks decision power.

## Best For

- Services with frontstage and backstage labor
- Policies affecting multiple groups
- Marketplaces
- Accessibility and inclusion
- Products where one user's convenience creates another's burden

## Avoid When

The team substitutes invented personas for actual participation by affected people.

## Procedure

1. Map all stakeholders.
2. For each, list:
   - Value received
   - Work performed
   - Risk absorbed
   - Information available
   - Decision power
3. Select the stakeholder with high burden and low influence.
4. Rewrite the problem from that perspective.
5. Identify design choices that shift or reduce burden.
6. Check for new externalities.
7. Validate with representative people.

## Output

- Stakeholder value-and-burden map
- Inverted problem statement
- Fairness and feasibility requirements
- Revised concept

## Mini Example

A hospital check-in system optimized for patients may create constant exception handling for reception staff. Inversion exposes the need for a clear exception path and better transfer of prior information.

## Common Failure Modes

- Assuming every stakeholder should receive equal priority
- Speaking for people without evidence
- Solving fairness by adding paperwork
- Moving burden to another invisible group

## Strong Pairings

Service Blueprinting, Empty Chair, Second-Order Effects

---

# METHOD 13 — JOURNEY MAPPING

## Purpose

Understand the user's experience as a sequence of goals, actions, questions, emotions, and obstacles over time.

## Best For

- UI/UX
- Services
- Events
- Onboarding
- Retention
- Multi-stage creative or personal processes

## Avoid When

The team maps an imagined “average user” without observation or treats a polished diagram as the result.

## Inputs

- Persona or usage situation
- Start and end points
- Stages
- User actions
- Touchpoints
- Evidence from observation or interviews

## Procedure

1. Select one specific user and scenario.
2. Define where the journey begins—often before contact with the product.
3. Map stages:
   - Trigger
   - Exploration
   - Entry
   - Core use
   - Exception or recovery
   - Exit
   - Return
4. For each stage, record:
   - Goal
   - Action
   - Question
   - Emotion
   - Friction
   - Opportunity
5. Identify decisive transitions and failure points.
6. Prioritize one stage rather than redesigning everything at once.

## Output

- Journey map
- Critical moments
- Emotional and functional pain points
- Prioritized intervention

## Mini Example

For a community class, the journey begins when someone sees the notice—not when they enter the room. Unclear skill expectations at discovery may cause more abandonment than the class itself.

## Common Failure Modes

- Mapping organizational departments instead of user experience
- Ignoring recovery and exit
- Adding solutions before understanding the journey
- Treating emotions as decoration rather than design evidence

## Strong Pairings

Jobs to Be Done, Service Blueprinting, Signature Moment

---

# METHOD 14 — SERVICE BLUEPRINTING

## Purpose

Connect the user's visible journey to backstage people, systems, rules, and dependencies.

## Best For

- Services with handoffs
- Support operations
- Healthcare, hospitality, education, and events
- Digital products with significant human operations
- Concepts that look simple to users but may be difficult to deliver

## Avoid When

The service is too early for detailed operations. Use a rough blueprint first.

## Layers

- User actions
- Frontstage interactions
- Backstage actions
- Support processes
- Evidence or artifacts
- Failure and recovery paths

## Procedure

1. Start with a verified user journey.
2. For each touchpoint, map the visible interaction.
3. Add backstage work required to make it happen.
4. Add systems, partners, policies, and materials.
5. Mark handoffs and waiting.
6. Identify failure states and recovery ownership.
7. Locate hidden labor, bottlenecks, and fragile dependencies.
8. Simplify the promise or strengthen delivery.

## Output

- End-to-end service blueprint
- Operational requirements
- Handoff map
- Failure and recovery design

## Mini Example

A “simple” same-day pickup promise may require inventory accuracy, packing, customer communication, storage, identity checks, and exception handling. The blueprint reveals whether the promise is viable.

## Common Failure Modes

- Designing only the frontstage experience
- Assuming technology removes labor
- Omitting exceptions
- Creating a diagram too detailed to support a decision

## Strong Pairings

Journey Mapping, TRIZ, Bottleneck Analysis, Pre-Mortem

---

# METHOD 15 — SECOND-ORDER EFFECTS

## Purpose

Examine what happens after the immediate effect of a decision, including adaptation, incentives, displacement, and feedback.

## Best For

- Policies
- Incentive systems
- Marketplaces
- Community programs
- Automation
- Pricing
- High-impact product decisions

## Avoid When

The exercise becomes speculative storytelling with no plausible mechanism.

## Procedure

1. State the proposed action.
2. Identify the immediate intended effect.
3. Ask:
   - How will each stakeholder adapt?
   - What behavior becomes more rewarding?
   - What cost moves elsewhere?
   - What new dependency forms?
   - What happens if adoption succeeds?
4. Trace at least two rounds of consequences.
5. Label each consequence:
   - Likely
   - Plausible
   - Speculative
6. Add safeguards, limits, or monitoring.
7. Reassess whether the idea remains attractive.

## Output

- Consequence chain
- Incentive changes
- Externalities
- Safeguards and indicators

## Mini Example

A public leaderboard may initially increase participation. Second-order effects may include gaming, avoidance by beginners, and focus on measurable quantity over meaningful quality.

## Common Failure Modes

- Treating every imagined consequence as equally likely
- Ignoring positive adaptation
- Using complexity as an excuse not to act
- Failing to define observable warning signs

## Strong Pairings

Stakeholder Inversion, Pre-Mortem, Kill Switch

---

# METHOD 16 — PRE-MORTEM

## Purpose

Assume a proposed plan failed and identify plausible causes before committing significant resources.

## Best For

- Launches
- Complex projects
- Group decisions
- High enthusiasm
- Plans with multiple dependencies
- Situations where dissent is socially difficult

## Avoid When

Risk listing is used to kill every unfamiliar idea or replace testing.

## Procedure

1. State the plan and time horizon.
2. Prompt: “It is now [date], and this failed badly.”
3. Have participants list causes independently.
4. Group causes into:
   - Demand
   - Delivery
   - Adoption
   - Operations
   - Ethics or safety
   - Economics
   - Timing
5. Rank likelihood and consequence.
6. Identify early warning signals.
7. Add prevention, contingency, or stop conditions.
8. Revise the concept.

## Output

- Ranked failure causes
- Warning indicators
- Preventative changes
- Contingency actions
- Stop conditions

## Mini Example

A neighborhood event may fail not because the concept is weak, but because the entry signage makes newcomers feel they arrived at a private gathering. The mitigation is a host role and explicit welcome point.

## Common Failure Modes

- Producing generic risks
- Assigning no owner
- Listing risks without changing the plan
- Confusing discomfort with danger

## Strong Pairings

Service Blueprinting, Second-Order Effects, Reversible Prototype Design

---

# METHOD 17 — OBLIQUE PROMPTS

## Purpose

Break a mental loop with a deliberately indirect instruction that changes attention, sequence, or medium.

## Best For

- Creative blocks
- Repetitive concept generation
- Writing, design, art, naming, and campaign development
- Teams over-optimizing one dimension

## Avoid When

The task requires immediate factual accuracy, compliance, or safety-critical reasoning.

## Prompt Types

- Remove the most polished part
- Begin with the ending
- Make the invisible actor visible
- Use the mistake as the structure
- Design for silence
- Let the audience complete it
- Replace explanation with evidence
- Make the transition the main event
- Use only what is already present
- Create a version that can disappear

## Procedure

1. State the current creative pattern.
2. Select one prompt that disrupts that pattern.
3. Apply it literally for a short time box.
4. Produce an artifact, not commentary.
5. Identify the surprising mechanism.
6. Restore necessary constraints.
7. Keep only the useful deviation.

## Output

- Disruptive draft
- New mechanism or perspective
- Refined concept

## Mini Example

Prompt: “Make the transition the main event.”

A conference redesigns the walk between sessions as a structured two-person exchange, turning dead time into the most valuable networking moment.

## Common Failure Modes

- Treating randomness as quality
- Using the prompt as mystical authority
- Refusing to return to the user's constraints
- Explaining the prompt instead of making something

## Strong Pairings

Assumption Reversal, Analogy Transfer, Concept Synthesis

---

# METHOD 18 — SIX PERSPECTIVES

## Purpose

Separate different modes of thinking so evidence, risk, possibility, emotion, and process do not collapse into one argument.

## Best For

- Group decisions
- Polarized discussions
- Concepts receiving premature criticism
- Teams dominated by one thinking style
- Complex choices requiring balanced analysis

## Perspectives

1. **Facts:** What is known, measured, and missing?
2. **Experience:** What do people feel, fear, or intuit?
3. **Risk:** How could this fail or cause harm?
4. **Value:** What benefits, strengths, and opportunities exist?
5. **Possibility:** What alternatives or provocations can be generated?
6. **Process:** What decision is being made, and what happens next?

## Procedure

1. Define the decision.
2. Move through one perspective at a time.
3. Prevent cross-mode debate during collection.
4. Record contradictions and evidence gaps.
5. Use the process perspective to synthesize.
6. Make a decision or define the next test.

## Output

- Balanced consideration set
- Evidence gaps
- Risks and opportunities
- Decision or next step

## Mini Example

For a new membership model, the group first separates current retention facts from emotional concerns, risks, benefits, alternative structures, and the test decision.

## Common Failure Modes

- Using the method to avoid making a decision
- Treating emotional information as fact or dismissing it entirely
- Letting the risk perspective dominate all others
- Turning perspectives into personality labels

## Strong Pairings

Morphological Analysis, Pre-Mortem, Concept Synthesis

---

# METHOD 19 — SINGLE-VARIABLE EXPLORATION

## Purpose

Generate meaningful alternatives by changing one important variable while holding the rest stable.

## Best For

- Comparing experience designs
- Identifying which element creates value
- Avoiding feature-soup brainstorming
- Early concept testing
- Clarifying trade-offs

## Avoid When

The variables are deeply interdependent and cannot be changed independently.

## Procedure

1. Define a baseline concept.
2. Select one variable:
   - Timing
   - Ownership
   - Audience
   - Price
   - Setting
   - Sequence
   - Level of participation
3. Generate at least five values for that variable.
4. Keep all other major elements stable.
5. Compare the resulting concepts.
6. Identify the mechanism responsible for differences.
7. Choose one or two variants for testing.

## Output

- Controlled concept variants
- Clear comparison
- Mechanism hypothesis
- Test candidates

## Mini Example

Baseline: Monthly community dinner.

Variable: Ownership.

Variants:
- Staff-hosted
- Guest-chef-hosted
- Table-hosted
- Neighborhood-rotating
- Participant-lottery-hosted

The exercise reveals whether shared ownership increases return visits without changing the rest of the format.

## Common Failure Modes

- Changing several variables and losing comparability
- Exploring trivial variables
- Treating the winning variant as validated before testing
- Ignoring interactions that appear later

## Strong Pairings

Counterfactual Twin, Morphological Analysis, Evaluation Matrix

---

# METHOD 20 — CONCEPT SYNTHESIS

## Purpose

Combine the strongest mechanisms from multiple ideas into one coherent concept without accumulating unnecessary features.

## Best For

- Converging after broad ideation
- Combining a Quick Win and Paradigm Shift
- Resolving “I like parts of several ideas”
- Designing phased concepts

## Avoid When

One concept is already clearly superior or the ideas solve different problems.

## Procedure

1. For each candidate, identify:
   - Core mechanism
   - Unique advantage
   - Essential requirement
   - Primary risk
2. Remove duplicate mechanisms.
3. Choose one concept as the spine.
4. Add only elements that:
   - Strengthen the same user outcome
   - Resolve a known weakness
   - Preserve clarity
5. Assign all other elements to:
   - Later phase
   - Optional module
   - Rejected
6. Rewrite the hybrid as one simple promise.
7. Test whether users can explain it.

## Output

- Chosen spine
- Supporting mechanisms
- Explicit exclusions
- Coherent hybrid
- Phased implementation

## Mini Example

Idea A creates a physical reader passport. Idea B creates a six-week serialized mystery. The synthesis uses the passport as the delivery structure for the mystery, rather than running two separate programs.

## Common Failure Modes

- Combining features instead of mechanisms
- Preserving every stakeholder's favorite idea
- Creating contradictory journeys
- Hiding complexity behind a new name

## Strong Pairings

Single Spine, Forced Subtraction, Pre-Mortem

---

# METHOD COMBINATION PLAYBOOKS

## Playbook A — From Vague Request to Testable Concept

Use when the user says something broad, such as “Make my club more engaging.”

1. **Jobs to Be Done:** Identify the progress members seek.
2. **Journey Mapping:** Locate the stage where engagement drops.
3. **Analogy Transfer:** Borrow a mechanism suited to that stage.
4. **Concept Synthesis:** Build one coherent intervention.
5. **Pre-Mortem:** Remove likely failure points.

### Result

A focused concept tied to a specific moment and motivation, rather than a generic engagement list.

---

## Playbook B — Improve an Existing Product

1. **First Principles:** Separate outcome from current features.
2. **SCAMPER:** Generate structured transformations.
3. **Forced Subtraction:** Remove the costliest weak element.
4. **Single-Variable Exploration:** Compare controlled variants.
5. **Second-Order Effects:** Check unintended consequences.

### Result

A simpler improvement with a visible mechanism and defensible trade-offs.

---

## Playbook C — Low-Budget Business Idea

1. **Constraint Inversion:** Turn limited money into a design rule.
2. **Jobs to Be Done:** Focus on urgent customer progress.
3. **Borrow-Don't-Build:** Use existing channels and infrastructure.
4. **Manual First:** Deliver the value without software.
5. **Pre-Mortem:** Protect against operational overload.

### Result

A credible manual pilot rather than a speculative platform.

---

## Playbook D — Break a Creative Block

1. **Assumption Reversal:** Expose the repeated pattern.
2. **Oblique Prompt:** Force a different medium, sequence, or focus.
3. **Ten-Times / One-Tenth:** Explore extremes.
4. **Concept Synthesis:** Preserve one governing idea.
5. **Forced Subtraction:** Remove decorative residue.

### Result

A distinctive but coherent creative direction.

---

## Playbook E — Repair a Service Experience

1. **Journey Mapping:** Find the user's failure moment.
2. **Service Blueprinting:** Reveal backstage causes.
3. **TRIZ:** Resolve a delivery contradiction.
4. **Stakeholder Inversion:** Check hidden labor and burden.
5. **Pre-Mortem:** Design recovery before launch.

### Result

A frontstage improvement that operations can actually sustain.

---

# FACILITATION FORMATS

## Ten-Minute Solo Sprint

1. Write the outcome in one sentence.
2. List five assumptions.
3. Reverse the least certain assumption.
4. Generate three consequences.
5. Convert one consequence into a concrete test.

## Thirty-Minute Team Sprint

1. Five minutes: First-principles fact/assumption split
2. Eight minutes: Individual idea generation using one method
3. Five minutes: Cluster by mechanism
4. Five minutes: Concept synthesis
5. Five minutes: Pre-mortem
6. Two minutes: Assign today's action

## Ninety-Minute Workshop

1. Define outcome and constraints
2. Map current journey or system
3. Select two opening methods
4. Generate independently
5. Cluster by mechanism
6. Build three concepts
7. Run stakeholder inversion
8. Conduct pre-mortem
9. Select smallest credible test
10. Assign owner and completion condition

---

# QUALITY CONTROL

Before presenting a method-derived result, verify:

- The method fits the actual bottleneck.
- The output is more specific than the input.
- Facts, assumptions, and generated hypotheses are separated.
- The method changed at least one design decision.
- Ideas differ by mechanism rather than wording.
- Constraints remain visible.
- Hidden labor and transferred burden are checked.
- The concept can be explained without framework jargon.
- A smaller test exists.
- Arcana makes a recommendation rather than stopping at analysis.

---

# REAL-WORLD APPLICATION EXAMPLES

The following are realistic, non-private scenarios showing Arcana's methods in action.

## Example 1 — Independent Bookstore Retention

### Situation

A neighborhood bookstore wants more repeat visits with a small budget and cannot use discounts.

### Method Sequence

1. **Jobs to Be Done:** Customers are not merely buying books; many want discovery, identity, and a reason to reconnect with the store.
2. **Journey Mapping:** The journey ends completely at purchase.
3. **Assumption Reversal:** Instead of every visit being self-contained, each visit can create the next.
4. **Concept Synthesis:** A physical reader passport carries a six-part serialized local mystery.
5. **Pre-Mortem:** The concept fails if the mystery is too difficult, requires purchase, or staff explanations are lengthy.

### Result

A low-cost return mechanism in which each visit reveals a complete small reward and opens a meaningful next chapter.

### Smallest Test

Print 20 passport cards, run the first two chapters for two weeks, and track voluntary return visits.

---

## Example 2 — Software Onboarding

### Situation

A project-management tool has high sign-up volume but low first-week activation.

### Method Sequence

1. **Journey Mapping:** Users stall when facing an empty workspace.
2. **Jobs to Be Done:** The job is confidence that nothing important will be missed, not “configure a dashboard.”
3. **Forced Subtraction:** Remove optional setup decisions from the first session.
4. **Single-Variable Exploration:** Compare three first actions: import tasks, choose a template, or identify one blocked project.
5. **Second-Order Effects:** An aggressive default may create irrelevant clutter and reduce trust.

### Result

The onboarding begins with one blocked project and produces an immediate exception list. Configuration comes later.

### Smallest Test

Prototype the flow with ten representative users and compare time to first useful output against the current onboarding.

---

## Example 3 — Community Arts Program

### Situation

A free monthly arts session attracts first-time visitors but few return.

### Method Sequence

1. **Five Whys:** Attendance is not the core failure; participants leave without a role in what happens next.
2. **Analogy Transfer:** Relay systems make each contribution useful to the next person.
3. **Constraint Inversion:** Limited storage means every artifact must be compact and transferable.
4. **Concept Synthesis:** Each participant contributes one card to a neighborhood story deck used at the next session.
5. **Stakeholder Inversion:** Facilitators need a format that does not create heavy curation work.

### Result

Every session is complete on its own, but participant outputs seed the following month.

### Smallest Test

Run one two-session cycle and measure how many contributors return or invite someone to continue their card.

---

# METHOD RECORD TEMPLATE

Use this template when adding a new method:

```markdown
# METHOD XX — NAME

## Purpose
What decision or creative bottleneck it improves.

## Best For
Specific situations.

## Avoid When
Boundary conditions and risks.

## Inputs
Information required.

## Procedure
A repeatable sequence.

## Output
What the method produces.

## Mini Example
A concise, non-private scenario.

## Common Failure Modes
How the method is commonly misapplied.

## Strong Pairings
Complementary methods that perform different jobs.
```

---

# MAINTENANCE RULES

1. Add a method only when it produces a meaningfully different kind of reasoning.
2. Prefer operational procedures over historical summaries.
3. Keep examples short and transferable.
4. Do not present generated ideas as proven outcomes.
5. Update methods when repeated use reveals ambiguity or redundancy.
6. Merge methods that consistently produce the same decision.
7. Keep fast-changing facts outside this fieldbook unless sourced and dated.
8. Preserve the distinction between:
   - Diagnosing
   - Diverging
   - Structuring
   - Stress-testing
   - Deciding
9. Do not allow the fieldbook to override the user's stated constraints.
10. Use plain language in the final response even when the internal method is sophisticated.

End of file.
