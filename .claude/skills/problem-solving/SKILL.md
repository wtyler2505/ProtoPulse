---
name: problem-solving
description: Structured problem-solving framework for software engineering using first principles, root cause analysis, and specialized techniques. Use when facing complex problems, debugging issues, making design decisions, or feeling stuck. Triggers on "problem", "stuck", "can't figure out", "how to approach", "troubleshoot", "debug", "root cause", "first principles".
version: 1.1.0
allowed-tools: Read, Grep, Glob, Bash(git:*), mcp__clear-thought__sequentialthinking, mcp__clear-thought__mentalmodel, mcp__clear-thought__debuggingapproach, TodoWrite, Skill
---

# Problem-Solving

## Overview

Structured framework for approaching software engineering problems. Combines first-principles thinking, root cause analysis, and dispatch to specialized techniques based on problem type.

## Quick Reference

| Problem Type | Go To Skill |
|--------------|-------------|
| Complexity spiraling | `simplification-cascades` |
| Need innovation | `collision-zone-thinking` |
| Same issue everywhere | `meta-pattern-recognition` |
| Stuck on assumptions | `inversion-exercise` |
| Scale uncertainty | `scale-game` |
| Code broken | `systematic-debugging` |
| Root cause hidden | `root-cause-tracing` |
| Multiple independent issues | `dispatching-parallel-agents` |
| Don't know which | `when-stuck` |

## When to Use

- **Use when:** Facing any non-trivial problem, feeling stuck, debugging complex issues, making architectural decisions, evaluating trade-offs

## When NOT to Use

Do NOT use this skill when:
- **Simple tasks with obvious solutions** → Just do them directly
- **Routine work** → Standard procedures don't need problem-solving framework
- **Already solved** → Check if solution exists before analyzing
- **Time-critical emergencies** → Act first, analyze later (then use post-mortem)

## The Problem-Solving Framework

### Step 1: Define the Problem

Write a one-sentence problem statement:
- Measurable symptom
- System boundary
- Impact

**Bad:** "The app is slow"
**Good:** "Dashboard page load exceeds 3s p95 for users with >1000 records, causing 15% bounce rate"

### Step 2: Collect Facts

Gather objective data before theorizing:
- Logs, metrics, traces
- Recent changes (deploys, configs, data)
- Traffic patterns
- Error messages (exact text)

### Step 3: Root Cause Analysis

#### 5 Whys (Fast)
```
Symptom: API returns 500 errors
Why? → Database query times out
Why? → Query scans full table
Why? → Missing index on filter column
Why? → Index was removed in migration
Why? → Migration script had bug, no review caught it
ROOT CAUSE: Inadequate migration review process
```

Stop when you hit a fixable mechanism (not "human error").

#### Cause-and-Effect (Complex Systems)

Categorize potential causes:
- **Code:** Logic bugs, race conditions, memory leaks
- **Infrastructure:** Capacity, networking, dependencies
- **Data:** Corruption, volume, schema issues
- **Dependencies:** External APIs, libraries, services
- **Process:** Deployment, configuration, permissions

### Step 4: First Principles Thinking

Strip away assumptions:

1. **State the goal in system terms**
   - "Serve search results in <200ms p95 under 2x traffic"

2. **List hard constraints**
   - Data durability requirements
   - Consistency vs availability trade-offs
   - Cost ceilings, latency SLOs

3. **Decompose without frameworks**
   - "If I had only processes, memory, disk, network - how would I solve this?"

4. **Challenge assumptions**
   - "Must be microservices" - really?
   - "Needs real-time" - does it?
   - "Must use X database" - why?

### Step 5: Generate Options

Develop 2-3 solutions that explicitly trade off:
- Complexity
- Risk
- Performance
- Cost
- Time to implement

### Step 6: Select and Implement

- Choose based on data and constraints
- Implement in slices (feature flags, canary)
- Define success metrics BEFORE the change

### Step 7: Verify and Learn

- Compare metrics before/after
- If not improved, revisit hypotheses
- Document the decision (ADR or post-mortem)

## Common Rationalizations (Red Flags)

| You Think | Reality |
|-----------|---------|
| "I know the problem" | Do you? Verify with data |
| "Obvious solution" | Obvious to whom? Check assumptions |
| "Too complex to analyze" | Break it down smaller |
| "We've always done it this way" | First principles: should we? |
| "Senior person said so" | Authority ≠ correctness |
| "No time to investigate" | No time to fix wrong thing twice? |

## Problem Types and Techniques

### Technical Bugs
Use `systematic-debugging`:
1. Observe symptoms
2. Form hypothesis
3. Test hypothesis
4. Fix or revise

### Performance Issues
1. Profile first (don't guess)
2. Identify hotspots (usually <5% of code)
3. Measure before/after every change

### Design Problems
Use `architecture` skill:
1. Document current state
2. Identify forces and constraints
3. Evaluate alternatives with trade-off matrix
4. Decide and document in ADR

### Stuck/Blocked
Use `when-stuck` to dispatch to right technique based on how you're stuck.

## Error Handling

**If you can't define the problem clearly:**
- Talk to stakeholders
- Look at actual user behavior
- Review error logs and metrics

**If root cause analysis goes in circles:**
- You may have multiple problems
- Separate and tackle one at a time
- Use `dispatching-parallel-agents`

**If no solution seems good:**
- Constraints may be wrong
- Challenge the requirements
- Sometimes "don't solve it" is the answer

## Verification

Before claiming a problem is solved:
1. Define success metrics
2. Run verification (tests, metrics)
3. Confirm with evidence
4. Document for future reference

See `verification-before-completion` skill.

## Related Skills

- `when-stuck` - Dispatch based on stuck type
- `systematic-debugging` - Technical debugging
- `root-cause-tracing` - Deep cause analysis
- `simplification-cascades` - Reduce complexity
- `collision-zone-thinking` - Innovation/breakthrough

## Attribution

Framework derived from engineering problem-solving practices and Amplifier project agent patterns.

## Changelog

- **1.1.0** (2025-12-06): Added formal When NOT to Use section
- **1.0.0** (2024-12-06): Initial version with framework and dispatch
