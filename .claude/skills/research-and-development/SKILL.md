---
name: research-and-development
description: Systematic approach for exploring, prototyping, and integrating new technologies, patterns, and solutions. Use when evaluating new tech, exploring solutions to novel problems, prototyping features, or validating approaches before full implementation. Triggers on "R&D", "research and development", "evaluate technology", "prototype", "proof of concept", "explore solutions", "validate approach", "technology evaluation".
version: 1.1.0
allowed-tools: Read, Write, Edit, Bash, WebSearch, WebFetch, mcp__perplexity__search, mcp__perplexity__reason, mcp__context7__resolve-library-id, mcp__context7__get-library-docs
---

# Research & Development Workflow

## Overview

R&D is not hacking around until something works. It's systematic exploration with clear hypotheses, validation criteria, and decision points.

**Core principle:** Research informs decisions, prototypes validate hypotheses, documentation captures learnings.

## When to Use R&D Workflow

**Trigger R&D when:**
- Evaluating new technology or framework
- Solving novel problem with no established pattern
- Choosing between multiple competing approaches
- Need proof-of-concept before committing resources
- Validating performance/feasibility claims
- Exploring integration strategies

**Skip R&D when:**
- Problem has well-established solutions (use existing patterns)
- Requirements are clear and implementation is straightforward
- Time constraints don't allow exploration
- Decision is already made (just implement)

## When NOT to Use

Do NOT use this skill when:
- **Known solution exists** → Just implement, don't research what's already solved
- **Simple bug fix** → Use `systematic-debugging` instead
- **User requests specific implementation** → Use `executing-plans` to implement
- **Tight deadline** → Skip exploration, make pragmatic choice
- **Already decided on approach** → Proceed directly to implementation

## The R&D Cycle

### Phase 1: Research (Gather Context)

**Goal:** Understand landscape before coding anything.

**Steps:**

1. **Define the Question**
   - What are we trying to learn?
   - What decision will this research inform?
   - What does success look like?

2. **Search Existing Solutions**
   - Official documentation
   - GitHub repositories (sort by stars/recent activity)
   - Stack Overflow patterns
   - Blog posts from credible sources
   - Similar projects' approaches

3. **Map the Landscape**
   ```markdown
   ## Landscape: [Technology/Problem]

   **Options Identified:**
   1. [Option A] - Pros: [...] Cons: [...] Maturity: [...]
   2. [Option B] - Pros: [...] Cons: [...] Maturity: [...]

   **Common Patterns:**
   - Pattern 1: [When used, trade-offs]
   - Pattern 2: [When used, trade-offs]

   **Red Flags Found:**
   - [Issue 1: Source, severity]
   - [Issue 2: Source, severity]
   ```

4. **Form Hypotheses**
   ```markdown
   ## Hypotheses

   **H1:** [Approach X] will solve [Problem] because [Reasoning]
   - **Validation criteria:** [How we'll know if true]
   - **Falsification criteria:** [What would prove this wrong]

   **H2:** [Alternative approach] might work better if [Condition]
   - **Validation criteria:** [...]
   - **Falsification criteria:** [...]
   ```

**Research Output:** Document with landscape map + hypotheses + validation plan.

### Phase 2: Prototype (Validate Hypotheses)

**Goal:** Build minimal code to test hypotheses, not production-ready features.

**Prototype Rules:**

1. **Keep it Isolated**
   - Separate directory/branch
   - Mock external dependencies
   - Focus on the unknown, not polish

2. **Build for Learning, Not Shipping**
   - Ugly code is fine
   - Hardcode test data
   - Skip error handling initially
   - Document surprises as you go

3. **Test Specific Questions**
   ```markdown
   ## Prototype: [Name]

   **Testing:** [Hypothesis being validated]
   **Approach:** [What we're building]
   **Success Metrics:** [Measurable outcomes]
   **Time Box:** [Max time before re-evaluating]
   ```

4. **Track Discoveries**
   Keep a `LEARNINGS.md` in prototype directory:
   ```markdown
   ## Learnings: [Date]

   **Discovered:**
   - [Finding 1]: [What we learned]
   - [Finding 2]: [What we learned]

   **Hypothesis Status:**
   - H1: [Validated/Falsified/Inconclusive] because [evidence]
   - H2: [Validated/Falsified/Inconclusive] because [evidence]

   **Surprises:**
   - [Unexpected behavior/limitation]

   **New Questions:**
   - [Question raised by prototype]
   ```

**Prototype Output:** Working code + LEARNINGS.md documenting what we learned.

### Phase 3: Validation (Measure Reality)

**Goal:** Prove/disprove hypotheses with data, not opinions.

**Validation Strategies:**

1. **Performance Validation**
   ```bash
   # Benchmark against requirements
   # Compare to baseline
   # Test edge cases
   ```

   Document results:
   ```markdown
   ## Performance Results

   **Requirement:** [What we needed]
   **Achieved:** [What we got]
   **Method:** [How we measured]
   **Conclusion:** [Pass/Fail + why]
   ```

2. **Integration Validation**
   - Can it work with existing systems?
   - What dependencies does it add?
   - What changes would existing code need?

3. **Maintenance Validation**
   - How complex is it really?
   - Do we have expertise to maintain it?
   - What's the learning curve for team?

4. **Risk Assessment**
   ```markdown
   ## Risk Analysis

   **Technical Risks:**
   - [Risk 1]: Likelihood [H/M/L], Impact [H/M/L], Mitigation: [...]

   **Operational Risks:**
   - [Risk 1]: Likelihood [H/M/L], Impact [H/M/L], Mitigation: [...]

   **Go/No-Go Factors:**
   - Must have: [...]
   - Deal breakers: [...]
   ```

**Validation Output:** Data-driven assessment of each hypothesis.

### Phase 4: Decision (Choose Path Forward)

**Goal:** Make explicit decision with clear reasoning.

**Decision Format:**

```markdown
## R&D Decision: [Technology/Approach]

**Date:** [Date]
**Decision:** [Proceed/Defer/Abandon]

### What We Learned
- [Key learning 1]
- [Key learning 2]

### Hypotheses Results
- H1: [Status + evidence]
- H2: [Status + evidence]

### Decision Reasoning
[Why we chose this path]

### If Proceeding
**Integration Plan:**
1. [Step 1]
2. [Step 2]

**Risks Accepted:**
- [Risk + mitigation]

**Success Metrics:**
- [How we'll know it's working]

### If Abandoning
**Why Not:**
[Clear explanation]

**Alternative:**
[What we'll do instead]

**Preserved Learnings:**
[What to remember if we reconsider later]
```

**Decision Output:** Documented decision with full context for future reference.

### Phase 5: Integration (If Proceeding)

**Goal:** Bring validated approach into production codebase properly.

**Integration Checklist:**

- [ ] Extract reusable patterns from prototype
- [ ] Add proper error handling
- [ ] Write production-quality tests
- [ ] Add documentation
- [ ] Handle edge cases discovered in R&D
- [ ] Code review with team
- [ ] Performance testing in real environment
- [ ] Rollback plan

**Don't just copy/paste prototype code!**

Prototype taught you what works. Now build it right.

## R&D Anti-Patterns

**Avoid these:**

1. **Research Paralysis**
   - Reading everything before trying anything
   - Waiting for "complete" understanding
   - **Fix:** Time-box research, then prototype

2. **Prototype Promotion**
   - Shipping prototype code to production
   - Skipping proper implementation
   - **Fix:** Always rewrite with production standards

3. **Hypothesis-Free Exploration**
   - "Let's just see what happens"
   - No clear success criteria
   - **Fix:** Define what you're testing before coding

4. **Sunk Cost Continuation**
   - Continuing after hypothesis falsified
   - "But we've invested so much time!"
   - **Fix:** Kill failed R&D quickly, learn and move on

5. **Undocumented Learnings**
   - Losing knowledge when prototype deleted
   - Making same mistakes later
   - **Fix:** LEARNINGS.md is mandatory

## R&D Documentation Structure

**Standard R&D directory:**
```
research/[topic-name]/
├── README.md              # Overview, hypotheses, status
├── LEARNINGS.md           # Discoveries as you go
├── DECISION.md            # Final decision (when done)
├── prototype/             # Throwaway code
│   └── [experiment files]
└── references/            # Links, papers, examples
    └── notes.md
```

**Keep R&D separate from main codebase!**

## When to Stop R&D

**Stop when:**
- ✅ Hypothesis validated/falsified with evidence
- ✅ Decision can be made with current data
- ⏰ Time box expired (decide with what you have)
- 🔴 Blocking issue discovered (pivot or abandon)
- 📈 Diminishing returns (more research won't help)

**Don't stop just because:**
- ❌ Prototype isn't working yet (might be fixable)
- ❌ It's harder than expected (might still be worth it)
- ❌ Someone has an opinion (need data, not opinions)

## Examples

### Good R&D
**Question:** "Can we use GraphQL instead of REST?"

**Research:** Compared both, identified trade-offs
**Prototype:** Built sample endpoint each way
**Validation:** Measured performance, developer experience
**Decision:** Stick with REST because team expertise + existing tooling outweigh GraphQL benefits for our scale
**Documentation:** Decision recorded with reasoning

### Bad R&D
**Question:** "Let's try GraphQL!"

**"Research":** Read one blog post
**"Prototype":** Built entire API in GraphQL
**"Validation":** "It works!"
**"Decision":** Shipped it
**Problems:** Team doesn't know it, debugging tools missing, can't maintain it

## Remember

- **Research before coding** - Understand landscape first
- **Prototype to learn** - Not to ship
- **Validate with data** - Not opinions
- **Document everything** - Future you needs context
- **Decide explicitly** - No implied decisions
- **Kill failures fast** - Failed R&D is valuable learning

R&D is where you earn the right to be confident in your decisions.

## Related Skills

- `brainstorming` - For idea development before formal R&D
- `writing-plans` - Creates plans after R&D validates an approach
- `executing-plans` - Implements the validated approach
- `comprehensive-documentation` - Documents R&D findings
- `collision-zone-thinking` - For breakthrough innovation during R&D

## Changelog

- v1.1.0 (2025-01): Added "When NOT to Use" section, related skills, changelog
- v1.0.0 (2024-12): Initial comprehensive R&D workflow with 5-phase cycle
