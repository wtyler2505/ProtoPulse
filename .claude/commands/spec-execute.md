---
description: Implement a validated specification by orchestrating concurrent agents
category: validation
allowed-tools: Task, Read, TodoWrite, Grep, Glob, Bash(git:*), Bash(jq:*)
argument-hint: "<path-to-spec-file>"
---
# Implement Specification

Implement the specification at: $ARGUMENTS

## Pre-Execution Checks
1. **Task Management**:
   - TodoWrite is the task-tracking system. Load the task breakdown from `specs/[spec-name]-tasks.md` (created by `/spec:decompose`) into TodoWrite.
   - (If the `stm` CLI is installed   it is not, currently   you may read tasks from STM instead; otherwise ignore STM.)
2. **Verify Specification**:
   - Confirm spec file exists and is complete
   - Check that required tools are available
   - Stop if anything is missing or unclear

## House Rules for Parallel Work
- **Parallel implementation goes through `/agent-teams`**   never background subagents for implementation work. Two teammates NEVER edit the same file (file ownership is non-negotiable).
- **Hard cap: 6 concurrent agents.** Count running agents before dispatching; if at cap, queue the work instead.
- Sequential single-agent implementation via the Task tool is fine for non-parallel tasks (tests, review, focused fixes).

## Implementation Process

### 1. Analyze Specification
Read the specification to understand:
- What components need to be built
- Dependencies between components
- Testing requirements
- Success criteria

### 2. Load Tasks
Load the decomposed task breakdown into TodoWrite   one todo per task, referencing the breakdown section that holds the full details.

### 3. Implementation Workflow
For each task, follow this cycle:

#### Step 1: Implement
Launch the appropriate specialist agent (or `/agent-teams` teammate for parallel batches):
Task tool:
- description: "Implement [component name]"
- subagent_type: [choose specialist that matches the task]
- prompt: |
     Read the task details in specs/[spec-name]-tasks.md, section [Task X.Y].
     Then implement the component based on those requirements.
     Follow project code style and add error handling.
     Report back when complete.

#### Step 2: Write Tests
Launch testing expert:
Task tool:
- description: "Write tests for [component]"
- subagent_type: testing-expert [or jest/vitest-testing-expert]
- prompt: |
     Read the task details in specs/[spec-name]-tasks.md, section [Task X.Y].
     Write comprehensive tests for the implemented component.
     Cover edge cases and aim for >80% coverage.
     Report back when complete.
Then run tests to verify they pass.

#### Step 3: Code Review (Required)
**Important:** Always run code review to verify both quality AND completeness. Task cannot be marked done without passing both.
Task tool:
- description: "Review [component]"
- subagent_type: code-review-expert
- prompt: |
     Read the task details in specs/[spec-name]-tasks.md, section [Task X.Y].
     Review implementation for BOTH:
     1. COMPLETENESS - Are all requirements from the task fully implemented?
     2. QUALITY - Code quality, security, error handling, test coverage
     Categorize any issues as: CRITICAL, IMPORTANT, or MINOR.
     Report if implementation is COMPLETE or INCOMPLETE.
     Report back with findings.

#### Step 4: Fix Issues & Complete Implementation
If code review found the implementation INCOMPLETE or has CRITICAL issues:
1. Launch a specialist to complete/fix (same pattern as Step 1, listing the missing requirements and critical issues)
2. Re-run tests to verify fixes
3. Re-review to confirm both COMPLETE and quality standards met
4. Only when implementation is COMPLETE and all critical issues fixed: mark the TodoWrite task as completed

#### Step 5: Commit Changes
Create an atomic commit following project conventions (see `/git:commit`   including the `Co-Authored-By: Claude <noreply@anthropic.com>` footer):
```bash
git add [files]
git commit -m "[follow project's commit convention]"
```

### 4. Track Progress
Monitor implementation progress in TodoWrite   keep statuses current (pending / in_progress / completed) as each task moves through the cycle.

### 5. Complete Implementation
Implementation is complete when:
- All tasks are COMPLETE (all requirements implemented)
- All tasks pass quality review (no critical issues)
- All tests passing
- Documentation updated

## If Issues Arise
If any agent encounters problems:
1. Identify the specific issue
2. Launch appropriate specialist to resolve
3. Or request user assistance if blocked
