---
description: Break down a validated specification into actionable implementation tasks
category: validation
allowed-tools: Read, Task, Write, TodoWrite, Bash(mkdir:*), Bash(cat:*), Bash(grep:*), Bash(echo:*), Bash(basename:*), Bash(date:*)
argument-hint: "<path-to-spec-file>"
---

# Decompose Specification into Tasks

Decompose the specification at: $ARGUMENTS

## Process Overview

This command takes a validated specification and breaks it down into:
1. Clear, actionable tasks with dependencies
2. Implementation phases and milestones
3. Testing and validation requirements
4. Documentation needs

**Task tracking**: TodoWrite is the primary task-management path in this project. (If the `stm` CLI happens to be installed — it is not, currently — you may mirror tasks into STM as well; otherwise ignore STM entirely.)

## Mandatory Plan Template

All implementation plans in this project MUST follow the house plan template, exemplified by `docs/plans/2026-03-05-pcb-layout-engine.md`. Required elements:
- Goal / Architecture / Tech Stack header
- Existing Infrastructure table
- Phased TDD tasks (failing test → run → implement → run → commit)
- `/agent-teams` prompts per phase with explicit file ownership
- Mandatory Context7 + WebSearch research steps per phase
- Team Execution Checklist

The task breakdown this command produces feeds that template — keep them structurally compatible.

## ⚠️ CRITICAL: Content Preservation Requirements

When creating tasks, you MUST copy ALL content from the spec into the task breakdown. Do NOT summarize or reference the spec — include the ACTUAL CODE and details. If you find yourself typing phrases like "as specified", "from spec", or "see specification" — STOP and copy the actual content instead. Each task must be a self-contained mini-specification.

## Instructions for Claude:

1. **Read and Validate Specification**:
   - Read the specified spec file
   - Verify it's a valid specification (has expected sections)
   - Extract implementation phases and technical details

2. **Analyze Specification Components**:
   - Identify major features and components
   - Extract technical requirements
   - Note dependencies between components
   - Identify testing requirements
   - Document success criteria

3. **Create Task Breakdown**:

   Break down the specification into concrete, actionable tasks.

   Key principles:
   - Each task should have a single, clear objective
   - **PRESERVE ALL CONTENT**: Copy implementation details, code blocks, and examples verbatim from the spec
   - Define clear acceptance criteria with specific test scenarios
   - Include tests as part of each task (failing test → implement → passing test, per the TDD plan template)
   - Document dependencies between tasks
     * Write meaningful tests that can fail to reveal real issues
     * Follow project principle: "When tests fail, fix the code, not the test"
   - Create foundation tasks first, then build features on top
   - Each task should be self-contained with all necessary details

   **CRITICAL REQUIREMENT**: When creating tasks, you MUST preserve:
   - Complete code examples (including full functions, not just snippets)
   - All technical requirements and specifications
   - Detailed implementation steps
   - Configuration examples
   - Error handling requirements
   - All acceptance criteria and test scenarios

4. **Generate Task Document**:

   Create a comprehensive task breakdown document:

   ```markdown
   # Task Breakdown: [Specification Name]
   Generated: [Date]
   Source: [spec-file]

   ## Overview
   [Brief summary of what's being built]

   ## Phase 1: Foundation

   ### Task 1.1: [Task Title]
   **Description**: One-line summary of what needs to be done
   **Size**: Small/Medium/Large
   **Priority**: High/Medium/Low
   **Dependencies**: None
   **Can run parallel with**: Task 1.2, 1.3

   **Technical Requirements**:
   - [All technical details from spec]
   - [Specific library versions]
   - [Code examples from spec]

   **Implementation Steps**:
   1. [Detailed step from spec]
   2. [Another step with specifics]
   3. [Continue with all steps]

   **Acceptance Criteria**:
   - [ ] [Specific criteria from spec]
   - [ ] Tests written and passing
   - [ ] [Additional criteria]

   ## Phase 2: Core Features
   [Continue pattern...]
   ```

5. **Create TodoWrite Entries**:

   Track every task in TodoWrite for the session:

   ```javascript
   [
     {
       id: "1",
       content: "Phase 1: Set up TypeScript project structure",
       status: "pending",
       priority: "high"
     },
     {
       id: "2",
       content: "Phase 1: Configure build system",
       status: "pending",
       priority: "high"
     },
     // ... additional tasks
   ]
   ```

   The saved task breakdown document (not the todo list) is the durable, detail-bearing artifact — TodoWrite entries point at sections of it.

   If `stm` is installed, you may additionally mirror the breakdown into STM tasks (one task per breakdown section, with full details copied into `--details`); otherwise skip this.

6. **Save Task Breakdown**:
   - Save the detailed task breakdown document to `specs/[spec-name]-tasks.md`
   - Create TodoWrite tasks for immediate tracking
   - Generate a summary report showing:
     - Total number of tasks
     - Breakdown by phase
     - Parallel execution opportunities

## Output Format

### Task Breakdown Document
The generated markdown file includes:
- Executive summary
- Phase-by-phase task breakdown
- Dependency graph
- Risk assessment
- Execution strategy

### Summary Report
Displays:
- Total tasks created
- Tasks per phase
- Critical path identification
- Recommended execution order

## Usage Examples

```bash
# Decompose a feature specification
/spec:decompose specs/feat-user-authentication.md

# Decompose a system enhancement spec
/spec:decompose specs/feat-api-rate-limiting.md
```

## Success Criteria

The decomposition is complete when:
- ✅ Task breakdown document is saved to specs directory
- ✅ All tasks are tracked in TodoWrite
- ✅ **Tasks preserve ALL implementation details from the spec** (complete code blocks, full technical requirements, step-by-step instructions, configuration examples, acceptance criteria with test scenarios)
- ✅ Foundation tasks are identified and prioritized
- ✅ Dependencies between tasks are clearly documented
- ✅ All tasks include testing requirements
- ✅ Parallel execution opportunities are identified
- ✅ **No summary phrases**: Tasks don't contain "as specified", "from spec", or similar references
- ✅ Breakdown structure is compatible with the mandatory plan template (`docs/plans/2026-03-05-pcb-layout-engine.md`)

## Integration with Other Commands

- **Prerequisites**: Run `/spec:validate` first to ensure spec quality
- **Next step**: Use `/spec:execute` to implement the decomposed tasks
- **Progress tracking**: Monitor TodoWrite task completion in session
- **Quality checks**: Run `/validate-and-fix` after implementation

## Best Practices

1. **Task Granularity**: Keep tasks focused on single objectives
2. **Dependencies**: Clearly identify blocking vs parallel work
3. **Testing**: Include test tasks for each component
4. **Documentation**: Add documentation tasks alongside implementation
5. **Phases**: Group related tasks into logical phases
