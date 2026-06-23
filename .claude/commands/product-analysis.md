---
description: "Deep product analysis via Ralph loop   feature gaps, UX issues, tech debt, innovations   powered by 16 CLI tools"
allowed-tools: Read, Write, Edit, MultiEdit, Bash, Glob, Grep, Agent, WebFetch, WebSearch, AskUserQuestion, Skill, EnterPlanMode, ExitPlanMode, TaskCreate, TaskGet, TaskUpdate, TaskList, TodoWrite, NotebookEdit, ToolSearch, mcp__desktop-commander__*, mcp__chrome-devtools__*, mcp__claude-in-chrome__*, mcp__memory__*, mcp__context7__*, mcp__clear-thought__*, mcp__playwright__*
argument-hint: "[--iterations N] [--skip-interactive]"
---
# Product Analysis Command
Deep 5-phase product analysis using the Ralph Wiggum loop for iterative refinement. Works on ANY project   any language, framework, or domain. Produces two deliverables:
- `docs/product-analysis-report.md`   comprehensive report with quantitative evidence
- `docs/product-analysis-checklist.md`   actionable items with IDs, effort, and priority

## Skill Location
All templates, scripts, and references live in:
`~/.claude/skills/product-analysis/`
- `SKILL.md`                          Router + overview (read for phase details)
- `assets/report-template.md`         Ralph loop prompt template (with {{PLACEHOLDERS}})
- `references/`
  - `domain-detection.md`           Domain   competitor   persona mappings
  - `cross-phase-analysis.md`       Cross-referencing strategies for iteration 6+
  - `examples.md`                   Sample reports for different project types
- `scripts/`
  - `detect-project.sh`             Auto-detect project context   JSON
  - `fill-template.sh`              Replace {{PLACEHOLDERS}}   filled prompt
  - `baseline-metrics.sh`           Run scc/tokei/lizard/git   metrics table
  - `validate-report.sh`            Verify deliverables pass quality gates

## Step 1   Parse Arguments
Check `$ARGUMENTS` for flags:
- `--iterations N`   use N as loop count (each loop = 5 iterations), skip interactive question
- `--skip-interactive`   use default of 2 loops (10 iterations)
- No arguments   proceed to interactive question

## Step 2   Ask Iteration Count (unless skipped)
If no `--iterations` flag was provided and `--skip-interactive` was not set, ask the user:
Use `AskUserQuestion` with this exact configuration:
- **Question**: "How many full analysis loops? Each loop = 5 phases (inventory, gaps, UX, debt, innovation). More loops = deeper refinement."
- **Header**: "Depth"
- **Options**:
  1. Label: "1 loop (5 iterations)"
     Description: "Quick scan   covers all phases once"
  2. Label: "2 loops (10 iterations) (Recommended)"
     Description: "Standard depth   covers all phases with one refinement pass"
  3. Label: "3 loops (15 iterations)"
     Description: "Deep analysis   thorough multi-pass refinement"
  4. Label: "Custom"
     Description: "Up to 10 loops (50 iterations max)"

If user selects "Custom", ask a follow-up:
- **Question**: "How many loops? (1-10, each loop = 5 iterations)"
- **Header**: "Loops"
- **Options**:
  1. Label: "5 loops (25 iterations)"
     Description: "Extended analysis"
  2. Label: "7 loops (35 iterations)"
     Description: "Comprehensive deep dive"
  3. Label: "10 loops (50 iterations)"
     Description: "Maximum depth   exhaustive analysis"

Compute: `max_iterations = loops * 5`

## Step 3   Auto-Detect Project Context
Run the detection script to gather project information automatically:
```bash
bash ~/.claude/skills/product-analysis/scripts/detect-project.sh "$(pwd)"
```
This outputs a JSON object with: `project_name`, `tech_stack`, `domain`, `project_root`, `key_files`, `competitors`, `personas`, `date`, `baseline`.
Save the output to a temporary file:
```bash
bash ~/.claude/skills/product-analysis/scripts/detect-project.sh "$(pwd)" > /tmp/product-analysis-context.json
```
**If the script fails** (missing `jq`, `scc`, etc.), fall back to manual detection:
1. Read `CLAUDE.md` or `README.md` for project name and description
2. Read `package.json` / `Cargo.toml` / `pyproject.toml` / `go.mod` for stack
3. Infer domain from dependencies (read `~/.claude/skills/product-analysis/references/domain-detection.md` for signal tables)
4. Manually construct the JSON object and write it to `/tmp/product-analysis-context.json`

**Review the detection output.** If the project name or domain looks wrong, use your judgment to correct it before proceeding. The script reads `package.json` name field which may differ from the actual project name   check `CLAUDE.md` or the directory name.

## Step 4   Fill Template and Generate Prompt
Use the fill-template script to replace all `{{PLACEHOLDERS}}` in the template:
```bash
bash ~/.claude/skills/product-analysis/scripts/fill-template.sh   ~/.claude/skills/product-analysis/assets/report-template.md   /tmp/product-analysis-context.json   .claude/ralph-product-analysis.md
```
This reads `assets/report-template.md`, replaces `{{PROJECT_NAME}}`, `{{TECH_STACK}}`, `{{DOMAIN}}`, `{{PROJECT_ROOT}}`, `{{KEY_FILES}}`, `{{COMPETITORS}}`, `{{PERSONAS}}`, and `{{DATE}}` with values from the context JSON, and writes the filled prompt to `.claude/ralph-product-analysis.md` (project-local).

**If the script fails**, read `~/.claude/skills/product-analysis/assets/report-template.md` and manually replace placeholders using the context JSON values. Write the result to `.claude/ralph-product-analysis.md`.

**Verify**: Check that `.claude/ralph-product-analysis.md` exists and contains no `{{PLACEHOLDER}}` text (except in example/comment sections):
```bash
grep -c '{{[A-Z_]*}}' .claude/ralph-product-analysis.md
```
This should return 0 or a very small number (only from example text within the template).

## Step 5   Display Summary
Before launching the loop, display a summary to the user:
```
Product Analysis Configuration
==============================
Project:      [project_name from context]
Stack:        [tech_stack from context]
Domain:       [domain from context]
Competitors:  [competitors from context]
Personas:     [personas from context]
Iterations:   [max_iterations] ([loops] full loops)
Deliverables: docs/product-analysis-report.md
              docs/product-analysis-checklist.md
Prompt file:  .claude/ralph-product-analysis.md

CLI Tools Available:
  scc, tokei, lizard       Code statistics & complexity
  ast-grep, rg, fd         Structural search & discovery
  jq, yq                   Data processing
  trafilatura, shot-scraper, curl, pup, monolith   Competitive research
  gh                       GitHub intelligence
  tree, bat, ncdu          Filesystem analysis
```
Launching Ralph loop...

## Step 6   Launch Ralph Loop
Invoke the ralph-loop with the filled prompt:
`/ralph-wiggum:ralph-loop`
Read `[PROJECT_ROOT]/.claude/ralph-product-analysis.md` and follow its instructions exactly. `--max-iterations [MAX_ITERATIONS] --completion-promise 'ANALYSIS COMPLETE'`

Use the `Skill` tool to invoke `ralph-wiggum:ralph-loop` with the above as arguments (substituting actual values for `[PROJECT_ROOT]` and `[MAX_ITERATIONS]`).

## Step 7   Validate (after loop completes)
When the Ralph loop completes (or is cancelled), run the validation script:
```bash
bash ~/.claude/skills/product-analysis/scripts/validate-report.sh   docs/product-analysis-report.md   docs/product-analysis-checklist.md
```
This checks 13+ quality gates (phase content, tool output presence, checklist categories, effort/priority ratings, placeholder cleanup). Report the results to the user. If validation fails, inform the user which gates failed and suggest re-running with more iterations or manually addressing the gaps.

## Notes
- `.claude/ralph-product-analysis.md` is project-local and should be gitignored
- `docs/product-analysis-report.md` and `docs/product-analysis-checklist.md` ARE meant to be committed
- If `docs/` directory doesn't exist, the Ralph loop prompt instructs creation
- To cancel mid-analysis: `/ralph-wiggum:cancel-ralph`
- To resume: re-run `/product-analysis`   the prompt instructs building on existing files
- Phase 4 is the most tool-intensive   `lizard` output is a required quality gate
- For deep dives into specific aspects, read the reference files in `~/.claude/skills/product-analysis/references/`
