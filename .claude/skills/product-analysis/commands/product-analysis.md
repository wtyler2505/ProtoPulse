---
name: product-analysis
description: "Team-based deep product analysis with 7 specialized agents working in parallel"
allowed-tools:
  - Agent
  - TeamCreate
  - TeamDelete
  - SendMessage
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - WebSearch
  - WebFetch
  - AskUserQuestion
---

# Product Analysis -- Team Orchestration

You are the **lead orchestrator** for a deep product analysis. Follow every step below in order. Do not skip steps. Do not improvise the flow.

## Step 1: Parse Arguments & Select Depth

Check if `--iterations N` or `--skip-interactive` was provided as an argument.

If `--skip-interactive` was NOT provided, ask the user:

> How deep should the analysis go?
>
> 1. **Quick** (1 pass) -- Single parallel pass, no refinement. ~10 min.
> 2. **Recommended** (2 passes) -- One refinement round with cross-phase insights. ~20 min.
> 3. **Deep** (3 passes) -- Two refinement rounds for thorough coverage. ~30 min.
> 4. **Extended** (5 passes) -- Three refinement rounds + meta-analysis. ~45 min.

Map the selection to `REFINEMENT_ROUNDS`:

| Selection | REFINEMENT_ROUNDS | Meta-analysis? |
|-----------|-------------------|----------------|
| Quick     | 0                 | No             |
| Recommended | 1               | No             |
| Deep      | 2                 | No             |
| Extended  | 3                 | Yes            |

If `--iterations N` was provided, set `REFINEMENT_ROUNDS = N - 2` (minimum 0). Enable meta-analysis if N >= 5.

Store the chosen depth for reporting later.

---

## Step 2: Detect Project

Run the project detection script against the current working directory:

```bash
bash ~/.claude/skills/product-analysis/scripts/detect-project.sh "$(pwd)"
```

Create the working directory and save the output:

```bash
mkdir -p .claude/analysis
```

Write the JSON output to `.claude/analysis/project-context.json`.

Read back the JSON and extract these variables for use in later steps:
- `PROJECT_NAME`, `TECH_STACK`, `DOMAIN`, `PROJECT_ROOT`
- `KEY_FILES`, `COMPETITORS`, `PERSONAS`, `DATE`

**Error handling:** If the script fails or returns empty JSON, fall back to manual detection:
1. Read `package.json`, `Cargo.toml`, `pyproject.toml`, or `go.mod` for the project name.
2. Inspect the directory structure for stack clues.
3. Default domain to `"Unknown"` and competitors/personas to generic lists.
4. Write the manually assembled JSON to `.claude/analysis/project-context.json`.

---

## Step 3: Run Baseline Metrics

Run the baseline metrics script:

```bash
bash ~/.claude/skills/product-analysis/scripts/baseline-metrics.sh "$(pwd)"
```

Write the output to `.claude/analysis/phase-0-metrics.md`.

Read the file and store its full content as `BASELINE_METRICS` -- this will be injected into phase agent prompts.

**Error handling:** If `scc`, `tokei`, or `lizard` are not installed, the script produces `N/A` values. That is acceptable -- agents will note `[TOOL_FAILED]` for metrics they cannot collect.

---

## Step 4: Fill Prompt Templates

Create the prompts directory:

```bash
mkdir -p .claude/analysis/prompts
```

Fill each of the 7 agent prompt templates with project context:

```bash
SKILL_DIR=~/.claude/skills/product-analysis
CONTEXT=.claude/analysis/project-context.json

for template in baseline phase-1-inventory phase-2-competitive phase-3-ux phase-4-debt phase-5-innovation synthesis; do
  bash "$SKILL_DIR/scripts/fill-template.sh" \
    "$SKILL_DIR/assets/agent-prompts/${template}.md" \
    "$CONTEXT" \
    ".claude/analysis/prompts/${template}.md"
done
```

After filling, read each prompt file (except `baseline.md` and `synthesis.md`) and replace the literal string `{{BASELINE_METRICS}}` with the actual content of `.claude/analysis/phase-0-metrics.md`. Write the updated content back to each file.

**Why baseline and synthesis are excluded:** The baseline agent produces the metrics (it does not consume them). The synthesis agent reads `phase-0-metrics.md` directly from disk.

**Resumability:** If `.claude/analysis/phase-*-report.md` files already exist from a previous run, agents will detect and build on them per their built-in resumability instructions. No special handling needed here.

---

## Step 5: Create Team

```
TeamCreate {
  team_name: "product-analysis",
  description: "Deep product analysis with specialized phase agents"
}
```

---

## Step 6: Create Tasks

Create 8 tasks with dependency chains:

| # | Task Description | Assignee | Blocked By |
|---|-----------------|----------|------------|
| 1 | Run baseline metrics collection | baseline-agent | -- |
| 2 | Analyze current state inventory | inventory-agent | Task 1 |
| 3 | Perform competitive gap analysis | competitive-agent | Task 1 |
| 4 | Evaluate UX and workflows | ux-agent | Task 1 |
| 5 | Audit technical debt and architecture | techdebt-agent | Task 1 |
| 6 | Research feature innovations | innovation-agent | Task 1 |
| 7 | Synthesize findings into final deliverables | synthesis-agent | Tasks 2-6 |
| 8 | Validate final report | lead (you) | Task 7 |

---

## Step 7: Spawn Baseline Agent (blocking)

Spawn the baseline agent and **wait for it to finish** (do NOT run in background):

```
Agent {
  name: "baseline-agent",
  subagent_type: "general-purpose",
  team_name: "product-analysis",
  prompt: <contents of .claude/analysis/prompts/baseline.md>,
  run_in_background: false
}
```

When it completes:
1. Read `.claude/analysis/phase-0-metrics.md` and store as `BASELINE_METRICS`.
2. Update Task 1 status to `completed`.

**Error handling:** If the baseline agent fails or produces an empty file, run the baseline metrics script directly yourself (Step 3 fallback) and continue. The analysis can proceed with partial metrics.

---

## Step 8: Spawn 5 Phase Agents (parallel)

Read each filled prompt from `.claude/analysis/prompts/`. For the 5 phase prompts, verify that `{{BASELINE_METRICS}}` has been replaced with actual content. If any still contain the literal placeholder, replace it now with the `BASELINE_METRICS` content from Step 7.

Spawn ALL 5 agents simultaneously with `run_in_background: true`:

```
Agent { name: "inventory-agent",    subagent_type: "general-purpose", team_name: "product-analysis", prompt: <filled phase-1-inventory.md>, run_in_background: true }
Agent { name: "competitive-agent",  subagent_type: "general-purpose", team_name: "product-analysis", prompt: <filled phase-2-competitive.md>, run_in_background: true }
Agent { name: "ux-agent",           subagent_type: "general-purpose", team_name: "product-analysis", prompt: <filled phase-3-ux.md>,          run_in_background: true }
Agent { name: "techdebt-agent",     subagent_type: "general-purpose", team_name: "product-analysis", prompt: <filled phase-4-debt.md>,         run_in_background: true }
Agent { name: "innovation-agent",   subagent_type: "general-purpose", team_name: "product-analysis", prompt: <filled phase-5-innovation.md>,   run_in_background: true }
```

**Wait for ALL 5 agents to finish.** They will send idle notifications as they complete. Update Tasks 2-6 to `completed` as each agent finishes.

**File ownership (non-negotiable):**

| Agent | Writes to | Never touches |
|-------|-----------|---------------|
| inventory-agent | `phase-1-report.md`, `phase-1-checklist.md` | phase-2 through phase-5 files |
| competitive-agent | `phase-2-report.md`, `phase-2-checklist.md` | phase-1, phase-3 through phase-5 files |
| ux-agent | `phase-3-report.md`, `phase-3-checklist.md` | phase-1, phase-2, phase-4, phase-5 files |
| techdebt-agent | `phase-4-report.md`, `phase-4-checklist.md` | phase-1 through phase-3, phase-5 files |
| innovation-agent | `phase-5-report.md`, `phase-5-checklist.md` | phase-1 through phase-4 files |

**Error handling:**
- If an agent fails mid-execution, its partial output files still persist in `.claude/analysis/`. Note the failure and continue with available output.
- Phase 4 (techdebt-agent) is most at risk of context exhaustion because it runs the most tool commands. If it fails, check for partial `phase-4-report.md` and use whatever was written.

---

## Step 9: Cross-Phase Analysis & Refinement Rounds

**Skip this step entirely if `REFINEMENT_ROUNDS == 0` (Quick mode).**

### For each refinement round (1 through REFINEMENT_ROUNDS):

#### 9a. Read all phase outputs

Read every output file from `.claude/analysis/`:
- `phase-1-report.md` through `phase-5-report.md`
- `phase-1-checklist.md` through `phase-5-checklist.md`
- `cross-phase-notes.md` (if it exists from a prior round)

#### 9b. Cross-reference findings

Apply the 10 cross-phase connections from `~/.claude/skills/product-analysis/references/cross-phase-analysis.md`:

1. **State to Gaps** -- Partial features that competitors implement fully
2. **State to UX** -- Orphaned features with no UI path
3. **State to Debt** -- Architecture vs reality discrepancies
4. **State to Innovation** -- Untapped infrastructure capabilities
5. **Gaps to UX** -- Competitive UX patterns we should adopt
6. **Gaps to Debt** -- Feature gaps blocked by high-complexity code
7. **Gaps to Innovation** -- Opportunities to leapfrog rather than copy competitors
8. **UX to Debt** -- Performance-caused UX friction
9. **UX to Innovation** -- Repetitive workflows ripe for automation
10. **Debt to Innovation** -- Architecture that enables or blocks proposed innovations

#### 9c. Write cross-phase notes

Write findings to `.claude/analysis/cross-phase-notes.md`:
- Connections found (reference specific item IDs like `TD-03` and `FG-07`)
- Impact chains identified (cause to effect across phases)
- Priority recalibration suggestions (items that should be promoted or demoted)
- Targeted questions for specific agents

#### 9d. Send refinement messages to agents

For each of the 5 phase agents, send a targeted message containing ONLY findings relevant to their phase. Do not dump all cross-phase notes -- curate per agent.

Example message to `techdebt-agent`:

> **Refinement round 1:** Phase 3 found UX friction in the auth flow (UI-05). Your phase-4 report shows the auth module has CCN=18. Cross-reference: is the complexity causing the UX issue? Also, phase-2 identified 3 feature gaps requiring storage layer changes -- check if current complexity in storage.ts blocks these. Update your report and checklist.

Example message to `ux-agent`:

> **Refinement round 1:** Phase 4 identified 4 components with CCN>15. Check if any of these cause the interaction friction you found. Phase 2 found that competitor X uses a 2-step wizard for onboarding vs our 5-step flow -- investigate if adopting their pattern resolves UI-02. Update your report.

**Wait for ALL 5 agents to finish refining** before starting the next round or proceeding.

#### 9e. Meta-analysis (Extended mode only)

If `REFINEMENT_ROUNDS >= 3`, perform meta-analysis after the final refinement round:

1. **Impact chains** -- Identify 3-5 chains that trace from a technical root cause through multiple phases to a user-facing or business impact. Document them in narrative form.
2. **Risk heatmap** -- Create a table combining: complexity (Phase 4 CCN scores), change frequency (Phase 1 git log data), and user exposure (Phase 3 persona coverage). Flag modules that are high in all three.
3. **Priority recalibration** -- Re-examine all checklist items with the full cross-phase picture. Promote items that appear in 3+ cross-references to P0. Demote innovations that require XL refactoring with no user demand to P3.
4. **Bundled implementation groups** -- Group related items across categories that should be implemented together (e.g., `TD-03` refactor + `FG-02` feature in the same module = single sprint).

Write the meta-analysis to `.claude/analysis/cross-phase-notes.md` (append to existing content).

---

## Step 10: Spawn Synthesis Agent (blocking)

Spawn the synthesis agent and **wait for it to finish**:

```
Agent {
  name: "synthesis-agent",
  subagent_type: "general-purpose",
  team_name: "product-analysis",
  prompt: <contents of .claude/analysis/prompts/synthesis.md>,
  run_in_background: false
}
```

When it completes:
1. Verify that `docs/product-analysis-report.md` and `docs/product-analysis-checklist.md` exist.
2. Update Task 7 to `completed`.

**Error handling:** If the synthesis agent fails, read all phase outputs yourself and assemble the report manually by concatenating phase reports and writing the Executive Summary. The deliverables must exist before proceeding.

---

## Step 11: Validate

Run the validation script:

```bash
bash ~/.claude/skills/product-analysis/scripts/validate-report.sh docs/product-analysis-report.md docs/product-analysis-checklist.md
```

### If validation PASSES:
Update Task 8 to `completed`. Proceed to Step 12.

### If validation FAILS:
Execute a retry loop (maximum 3 attempts):

1. Read the specific failed gates from the validation output.
2. Send targeted fix instructions to `synthesis-agent`:

   > Validation failed on these gates: [list each failed gate]. Specific fixes needed:
   > - [Gate X]: [what exactly is missing or wrong]
   > - [Gate Y]: [what exactly is missing or wrong]
   > Please update the report and checklist to pass these gates.

3. Wait for `synthesis-agent` to finish.
4. Re-run the validation script.
5. If it passes, update Task 8 to `completed`. If it still fails, repeat from sub-step 1.

After 3 failed retries, update Task 8 to `partial` and note the remaining failed gates. The analysis is still valuable even with imperfect validation. Proceed to Step 12.

---

## Step 12: Shutdown & Report

### 12a. Shut down all agents

Send shutdown requests to every agent. Wait for confirmations before cleanup.

```
SendMessage { type: "shutdown_request", recipient: "baseline-agent" }
SendMessage { type: "shutdown_request", recipient: "inventory-agent" }
SendMessage { type: "shutdown_request", recipient: "competitive-agent" }
SendMessage { type: "shutdown_request", recipient: "ux-agent" }
SendMessage { type: "shutdown_request", recipient: "techdebt-agent" }
SendMessage { type: "shutdown_request", recipient: "innovation-agent" }
SendMessage { type: "shutdown_request", recipient: "synthesis-agent" }
```

### 12b. Clean up team

```
TeamDelete { team_name: "product-analysis" }
```

### 12c. Report to user

Print the final summary:

> **Product analysis complete.**
>
> **Deliverables:**
> - `docs/product-analysis-report.md` -- Full analysis report
> - `docs/product-analysis-checklist.md` -- Actionable checklist with IDs, effort, and priority
>
> **Working files preserved in `.claude/analysis/`:**
> - `project-context.json` -- Detected project context
> - `phase-0-metrics.md` -- Baseline metrics
> - `phase-1-report.md` through `phase-5-report.md` -- Individual phase reports
> - `phase-1-checklist.md` through `phase-5-checklist.md` -- Individual phase checklists
> - `cross-phase-notes.md` -- Cross-phase analysis (if refinement rounds were run)
>
> **Analysis depth:** [Quick/Recommended/Deep/Extended] ([N] refinement rounds)
> **Validation:** [PASS -- all gates clear / PARTIAL -- N of M gates passed]
>
> To re-run with deeper analysis: `/product-analysis --iterations 5`

---

## Edge Cases & Error Handling Reference

| Situation | Action |
|-----------|--------|
| Agent finishes early while others are still running | Wait for ALL agents before refinement. Do not start cross-phase analysis prematurely. |
| Agent fails or crashes mid-execution | Note the failure. Use any partial output files that were written. Continue with available data. |
| Tool command returns nothing or errors | Agent marks the finding as `[TOOL_FAILED]`. During cross-phase analysis, flag these gaps and ask the relevant agent to retry or use an alternative approach. |
| User aborts mid-analysis (`Ctrl+C` / `Escape`) | Send shutdown to all active agents. Partial results persist in `.claude/analysis/`. Report what was completed. |
| Context exhaustion (agent hits token limit) | Most likely in Phase 4 (techdebt-agent). The agent writes incrementally to disk, so partial files exist. Use what was written and note gaps. |
| Validation fails after 3 retries | Accept partial validation. The report is still valuable. Note which gates failed in the final report to user. |
| Project detection returns "Unknown" domain | Analysis proceeds with generic competitors and personas. Quality will be lower but the structural/technical analysis is still valid. |
| No git repository | Git-based metrics (`commits_30d`, `contributors`) show `N/A`. All other analysis proceeds normally. |
| Previous run exists (`.claude/analysis/` has files) | Agents have built-in resumability. They will read existing outputs and deepen rather than restart. No special handling needed from the lead. |
