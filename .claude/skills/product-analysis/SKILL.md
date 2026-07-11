---
name: product-analysis
description: "Deep team-based product analysis — feature gap analysis, competitive comparison, UX evaluation, tech debt audit (lizard/scc complexity), innovation proposals. Use when: product analysis, competitive analysis, codebase audit, product health check, product teardown, feature prioritization, tech debt assessment, 'what should we build next', 'how does this compare to competitors', 'what is our tech debt', 'audit the product', 'product review', 'what features are we missing'. Works on ANY project — any language, any framework, any domain. Powered by 16 CLI tools (scc, tokei, lizard, ast-grep, rg, fd, jq, yq, gh, trafilatura, shot-scraper, tree, bat, ncdu, curl, pup)."
---

# Product Analysis Skill

Deep 5-phase product analysis via team-based parallel execution with lead-managed iteration. Produces two deliverables:
- `docs/product-analysis-report.md` — comprehensive report with quantitative evidence
- `docs/product-analysis-checklist.md` — actionable items with IDs, effort, and priority

The `/product-analysis` command handles auto-detection, template filling, team orchestration, and quality validation. This skill provides the templates, agent prompts, and reference materials.

## Skill Structure

```
product-analysis/
├── SKILL.md                    ← You are here (router + overview)
├── assets/
│   ├── report-template.md      ← Master reference template
│   └── agent-prompts/          ← Team agent prompt templates (7 files)
│       ├── baseline.md         ← Phase 0: metrics collection
│       ├── phase-1-inventory.md
│       ├── phase-2-competitive.md
│       ├── phase-3-ux.md
│       ├── phase-4-debt.md
│       ├── phase-5-innovation.md
│       └── synthesis.md        ← Final merge + quality gates
├── commands/
│   └── product-analysis.md     ← Team orchestration command
├── references/
│   ├── domain-detection.md
│   ├── cross-phase-analysis.md
│   └── examples.md
└── scripts/
    ├── detect-project.sh
    ├── fill-template.sh
    ├── baseline-metrics.sh
    ├── merge-phases.sh          ← Merge phase checklists into final deliverables
    └── validate-report.sh
```

## How It Works

1. `/product-analysis` command asks user for depth (iteration count)
2. `scripts/detect-project.sh` auto-detects project context → JSON
3. `scripts/baseline-metrics.sh` collects baseline metrics
4. `scripts/fill-template.sh` fills all 7 agent prompt templates
5. Team is created with 7 specialized agents
6. Baseline agent runs first → writes `phase-0-metrics.md`
7. 5 phase agents run IN PARALLEL → each writes report + checklist to `.claude/analysis/`
8. Lead performs cross-phase analysis and sends refinement messages
9. Refinement rounds repeat based on depth selection
10. Synthesis agent merges all findings into final deliverables
11. `scripts/validate-report.sh` verifies quality gates
12. Team shutdown and cleanup

## Team Architecture

```
Lead (orchestrator)
  ├── baseline-agent     → Phase 0: metrics collection (scc/tokei/lizard/git/gh)
  ├── inventory-agent    → Phase 1: Current State Inventory
  ├── competitive-agent  → Phase 2: Competitive Gap Analysis
  ├── ux-agent           → Phase 3: UX & Workflow Evaluation
  ├── techdebt-agent     → Phase 4: Tech Debt & Architecture (most intensive)
  ├── innovation-agent   → Phase 5: Feature Innovation
  └── synthesis-agent    → Merges all phases into final deliverables
```

| Agent | Role |
|-------|------|
| **baseline-agent** | Runs all quantitative CLI tools (`scc`, `tokei`, `lizard`, `git log`, `gh`) and produces the metrics foundation that every other agent reads. |
| **inventory-agent** | Maps all features, entry points, integrations, and developer intent markers. Establishes what the product currently is. |
| **competitive-agent** | Researches competitors via web scraping (`trafilatura`, `shot-scraper`, `pup`) and compares feature sets, UX patterns, and market positioning. |
| **ux-agent** | Traces workflows through each persona, evaluates accessibility, navigation patterns, and friction points in the user experience. |
| **techdebt-agent** | The most tool-intensive agent. Runs `lizard` for cyclomatic complexity, `ast-grep` for anti-patterns, and produces the deepest quantitative analysis. |
| **innovation-agent** | Proposes 10-20 novel features informed by competitive gaps, trend research, and GitHub issue signals. Combines web research with codebase understanding. |
| **synthesis-agent** | Merges all phase outputs into the two final deliverables, writes the Executive Summary, and ensures cross-phase coherence. |

## Lead-Managed Iteration

### Why not individual Ralph loops per agent?

The Ralph loop state file (`.claude/ralph-loop.local.md`) is a **singleton per project directory**. Five concurrent loops would clobber each other's state. Even if the state file were namespaced, isolated loops cannot share discoveries — an inventory finding that changes the competitive analysis would be invisible until after both loops complete.

### How it works instead

The lead manages iterations externally by reading all agent outputs between rounds and sending targeted messages to each agent. This is **superior to isolated loops** because:

- The lead can inject **cross-phase findings** — impossible when agents loop in isolation
- Phase 2 (competitive) discoveries can immediately inform Phase 5 (innovation) in the next round
- Phase 4 (tech debt) complexity hotspots can refine Phase 3 (UX) friction analysis
- The lead maintains a global view of analysis coherence that no individual agent possesses

## File Ownership

Non-negotiable. Two agents NEVER write to the same file.

| Agent | Writes To | Reads |
|-------|-----------|-------|
| baseline-agent | `.claude/analysis/phase-0-metrics.md` | codebase |
| inventory-agent | `.claude/analysis/phase-1-report.md`, `phase-1-checklist.md` | codebase, phase-0 |
| competitive-agent | `.claude/analysis/phase-2-report.md`, `phase-2-checklist.md` | web, phase-0 |
| ux-agent | `.claude/analysis/phase-3-report.md`, `phase-3-checklist.md` | codebase, phase-0 |
| techdebt-agent | `.claude/analysis/phase-4-report.md`, `phase-4-checklist.md` | codebase, phase-0 |
| innovation-agent | `.claude/analysis/phase-5-report.md`, `phase-5-checklist.md` | web, codebase, phase-0 |
| synthesis-agent | `docs/product-analysis-report.md`, `docs/product-analysis-checklist.md` | all phase files |
| lead | `.claude/analysis/cross-phase-notes.md` (optional) | all phase files |

## Lifecycle

```
T0  Lead: parse args, detect project, run baseline-metrics.sh
T1  Create team, create tasks, spawn baseline-agent
T2  Read phase-0, fill prompts, spawn 5 phase agents IN PARALLEL
T3  All 5 agents work simultaneously
T4  ITERATION GATE: Lead reads all outputs, cross-references findings
T5  Lead sends targeted refinement messages to each agent
T6  Agents refine → idle. Repeat T4-T6 for N rounds
T7  Spawn synthesis-agent, writes final deliverables
T8  Validate, shutdown, report
```

## Cross-Phase Communication

After each round, the lead performs cross-phase analysis:

1. **Read** all 10 phase files (5 reports + 5 checklists)
2. **Cross-reference** using connections from `references/cross-phase-analysis.md` to identify insights that span phases
3. **Send targeted messages** to each agent containing:
   - Cross-phase findings relevant to their specific phase
   - Gaps identified by comparing their output against other phases
   - Questions raised by other phases that their expertise can answer
4. **Agents refine** their reports based on the feedback, then idle

This creates a feedback loop where each refinement round produces tighter, more coherent analysis across all phases.

## Tool Arsenal

16 CLI tools + 2 research tools across 5 phases. Each agent prompt has exact commands.

### CLI Tools

| Tool | Purpose | Primary Phase |
|------|---------|---------------|
| `scc` | LOC, languages, complexity, COCOMO | Phase 0, 1, 4 |
| `tokei` | Fast language breakdown | Phase 0, 1 |
| `lizard` | Cyclomatic complexity per function | Phase 4 (critical) |
| `ast-grep` | Structural code search (patterns) | Phase 1, 3, 4 |
| `rg` | Fast text search | Phase 1, 3, 4 |
| `fd` | File finding by pattern | Phase 0, 1, 3, 4 |
| `tree` | Directory structure visualization | Phase 0, 1 |
| `jq` | JSON parsing (package.json, etc.) | Phase 0, 1, 4 |
| `yq` | YAML/TOML parsing (CI configs) | Phase 0, 1 |
| `gh` | GitHub issues, PRs, CI, releases | Phase 0, 1, 4, 5 |
| `trafilatura` | Extract text from web pages | Phase 2, 5 |
| `shot-scraper` | Screenshot web pages | Phase 2 |
| `curl` | HTTP requests | Phase 2 |
| `pup` | HTML parsing (jq for HTML) | Phase 2 |
| `monolith` | Save full web pages offline | Phase 2 |
| `ncdu` | Disk usage analysis | Phase 4 |

### Research Tools

| Tool | Purpose | Primary Phase |
|------|---------|---------------|
| **Context7** | Look up current library documentation — verify capabilities, best practices, deprecated APIs, security considerations | All phases |
| **WebSearch** | Research competitors, trends, benchmarks, best practices, security advisories | Phase 2, 5 (heavy), all phases (contextual) |

Every agent prompt includes a **Research Protocol** section with phase-specific guidance on WHAT to research and HOW to use Context7 and WebSearch effectively. Research supplements CLI tool output — it never replaces it.

## The 5 Phases

Each phase is handled by a dedicated agent with a specialized prompt template (`assets/agent-prompts/`). The master reference template (`assets/report-template.md`) contains the full detail for all phases including exact tool commands, deliverables, and fallback instructions.

### Phase 0 — Baseline Metrics (baseline-agent)
Run `scripts/baseline-metrics.sh` to generate the metrics table. This runs first and its output is read by all other agents as foundational data.

### Phase 1 — Current State Inventory (inventory-agent)
Map all features, entry points, integrations. Use `ast-grep` for structural discovery, `fd` for file categorization, `rg` for developer intent markers (TODO/FIXME).

**Why:** You can't improve what you don't understand. Prevents proposing features that already exist.

### Phase 2 — Competitive Gap Analysis (competitive-agent)
Compare against detected competitors. Use `trafilatura` for feature pages, `shot-scraper` for UI screenshots, `gh api` for open-source repo stats.

**Why:** Without competitive context, you're designing in a vacuum. Users constantly compare tools.

Read `references/domain-detection.md` for competitor URLs and domain-specific research guidance.

### Phase 3 — UX & Workflow Evaluation (ux-agent)
Trace workflows through each persona. Use `ast-grep` for navigation patterns, `rg` for accessibility attributes (aria/role/tabIndex).

**Why:** Features alone don't make a great product. UX reveals invisible friction that causes churn.

### Phase 4 — Technical Debt & Architecture (techdebt-agent, most tool-intensive)
Run ALL `lizard`, `scc`, `ast-grep`, `rg` commands. This phase produces the most quantitative data.

**Why:** Complexity > 15 correlates with bug density. Functions with high cyclomatic complexity are nearly impossible to unit test and are the source of most production incidents.

### Phase 5 — Feature Innovation (innovation-agent)
Propose 10-20 novel features. Use `gh issue list` for feature request signals, `trafilatura` for trend research.

**Why:** Parity keeps you in the game; innovation wins the market.

Read `references/domain-detection.md` for domain-specific innovation prompts.

## Cross-Iteration Strategy

| User Selection | Parallel Passes | Refinement Rounds | Cross-Phase Rounds |
|----------------|-----------------|-------------------|--------------------|
| 1 loop (quick) | 1 | 0 | 0 |
| 2 loops (recommended) | 1 | 1 | 1 |
| 3 loops (deep) | 1 | 2 | 1 |
| 5 loops (extended) | 1 | 3 | 1 + meta-analysis |

- **Parallel pass** = all 5 phase agents execute simultaneously (always exactly 1)
- **Refinement round** = lead reads all outputs, identifies cross-phase insights, sends targeted messages to each agent, agents refine their reports
- **Cross-phase round** = a refinement round specifically focused on inter-phase connections
- **Meta-analysis** = lead specifically looks for impact chains (debt → UX friction → churn), risk heatmaps (which areas compound multiple issue types), and priority recalibration (adjusting P0-P3 ratings based on holistic view)

## Placeholder Reference

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{{PROJECT_NAME}}` | `detect-project.sh` → name | ProtoPulse |
| `{{TECH_STACK}}` | `detect-project.sh` → stack | React 19 + Express 5 + PostgreSQL |
| `{{DOMAIN}}` | `detect-project.sh` → domain | EDA / Electronic Design Automation |
| `{{PROJECT_ROOT}}` | `detect-project.sh` → root | /home/user/Projects/ProtoPulse |
| `{{KEY_FILES}}` | `detect-project.sh` → key_files | server/routes.ts, client/src/App.tsx |
| `{{COMPETITORS}}` | `detect-project.sh` → competitors | KiCad, Altium, EasyEDA, Fritzing |
| `{{PERSONAS}}` | `detect-project.sh` → personas | Hobbyist maker, Professional EE, Startup founder |
| `{{DATE}}` | `detect-project.sh` → date | 2026-02-28 |

## Quality Gates

Run `scripts/validate-report.sh` to verify. All must pass before completion promise:

- Report has substantive content in ALL 5 phases
- Checklist has items in ALL 5 categories (FG-, UI-, TD-, EN-, IN-)
- Every checklist item has: ID, description, effort (S/M/L/XL), priority (P0-P3)
- Executive Summary reflects the full analysis
- Phase 4 includes actual `lizard` output (complexity hotspots)
- Phase 4 includes actual `scc` output (codebase statistics)
- Baseline Metrics table is filled
- Appendix C has raw tool outputs

## Reference Files

| File | Read When |
|------|-----------|
| `references/domain-detection.md` | Detecting domain, looking up competitors/personas, finding research URLs |
| `references/cross-phase-analysis.md` | During refinement rounds to identify cross-phase connections and insights |
| `references/examples.md` | Need to see what a filled template or final report looks like |
