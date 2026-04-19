# Frontend E2E Walkthrough — Master Implementation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement individual sub-plans in this directory. This master is an index and scheduler — it does NOT contain executable steps. Execute sub-plans `01-*.md` through `18-*.md` in the order specified in §5.

**Source of truth:** `docs/audits/2026-04-18-frontend-e2e-walkthrough.md` (2470 lines, 943 unique `E2E-XXX` findings across 14 sub-passes).

**Goal:** Systematically resolve every finding in the 2026-04-18 E2E walkthrough — P0/P1 bugs, UX friction, accessibility gaps, design-system inconsistencies, and selected competitive/innovation moonshots — through a coordinated set of sub-plans, each producing working, testable software on its own.

**Architecture:** Plan-of-plans. 18 sub-plans (01-p0-bugs through 18-innovation-roadmap) isolate concerns by subsystem and priority so each can be executed by its own agent team, shipped independently, and verified against a TDD checklist. Tabs with non-trivial audit volume get their own sub-plan; thin tabs are grouped; design-system and shell-nav concerns are extracted cross-cutting because fixing them per-tab would produce 14 contradictory fixes.

**Tech stack:** React 19 + Vite + TypeScript on client, Express 5 + Drizzle ORM on server, Vitest 4 + Playwright for tests, React Flow for canvases, shadcn/ui + Tailwind CSS for primitives, Electron shell (migrating to Tauri per project memory). Existing QA: `npm run check`, `npm test`, ESLint, Prettier — all must stay green after every sub-plan.

---

## 1. Sub-plan catalog

Each sub-plan file follows the project plan template (ref `docs/plans/2026-03-05-pcb-layout-engine.md`): Goal/Architecture/Tech Stack header → Existing Infrastructure table → phased TDD tasks (failing test → run → implement → run → commit) → `/agent-teams` prompts per phase with file ownership → mandatory Context7 + WebSearch research hooks → Team Execution Checklist. The only exception is `18-innovation-roadmap.md` (moonshots are prioritized design briefs, not TDD-shippable features).

| # | File | Scope | Target size | Agents |
|---|------|-------|-------------|--------|
| 00 | `00-master-index.md` | This file — index, coverage map, sequencing, reconciliation | ~600 lines | none |
| 01 | `01-p0-bugs.md` | Project scoping leak, 401 routes, DRC false positives on empty state, settings 404, light mode non-reactive, empty-state DOM leak | medium | 1 team, 2 waves |
| 02 | `02-p1-dead-buttons.md` | Coach popover, tool-analyze, community card click, board source-of-truth, spinbutton valuemax=0, PCB layer visibility, Add Component CTA, vestigial toolbar buttons | large | 1 team, 3 waves |
| 03 | `03-a11y-systemic.md` | role=button on divs, aria-labels on icon-only buttons, color-only indicators, focus-ring contrast, keyboard-nav test suite, tie-point aria-labels, empty-state heading leak, axe-core scan | large | 1 team, 4 waves |
| 04 | `04-dashboard.md` | Dashboard tab visual + flow (Pass 2 + cross-refs) | medium | 1 team, 2 waves |
| 05 | `05-architecture.md` | Architecture tab (Pass 7-9 deep dive) — 101 findings: pin handles, edge labels, auto-layout, net browser, multi-select, align, groups | large | 2 teams, 5 waves |
| 06 | `06-schematic.md` | Schematic tab (Pass 10-12B) — 123 findings: hotkey consistency, net-name autocomplete, live ERC, ref-designator auto-numbering, power symbols, populated-state corrections | large | 2 teams, 6 waves |
| 07 | `07-breadboard.md` | Breadboard tab (Pass 4-5-6 deep dive) — 180 findings: density collapse, wire snap/rubber-band/color, click-to-place, connectivity explainer, quick-wins (fixes E2E-571/572/573) | xlarge | 2 teams, 6 waves |
| 08 | `08-pcb-3d-order.md` | PCB editor, 3D View, Order PCB wizard — shared board-geometry fixes, layer stack consistency, wizard UX | large | 1 team, 4 waves |
| 09 | `09-component-editor.md` | Component Editor sub-tabs, trust strip, form grouping, pin table, SPICE | medium | 1 team, 2 waves |
| 10 | `10-procurement-suite.md` | BOM / Alternates (P0 included via 01) / Supply Chain / BOM Templates / My Parts / Live Pricing / Part Usage / Assembly Cost / Risk / Mfg Validator / PCB Tracking — 17 sub-tabs consolidated + grouped | xlarge | 2 teams, 5 waves |
| 11 | `11-validation-simulation.md` | System Validation (DRC fix partly in 01), Design Troubleshooter, Simulation Readiness, SPICE runner | large | 1 team, 4 waves |
| 12 | `12-arduino-serial-code.md` | Arduino tab, Circuit Code tab, Serial Monitor, preflight trust strips | medium | 1 team, 3 waves |
| 13 | `13-learning-surfaces.md` | Learn / Patterns / Starter Circuits / Labs / Vault cross-link + optional Learn Hub merge (E2E-487/455) | large | 1 team, 3 waves |
| 14 | `14-community-tasks-history.md` | Community marketplace, Tasks kanban, History snapshots, Audit Trail (project-scope fix in 01), Comments, Lifecycle | large | 1 team, 4 waves |
| 15 | `15-generative-digital-twin-exports.md` | Generative (GA optimizer), Digital Twin, Exports center | medium | 1 team, 3 waves |
| 16 | `16-design-system.md` | Pass 13 design system: tokens, typography, spacing, empty states, toasts, hover/active, animation, trust-receipt pattern, 3-zone canvas shell | xlarge | 2 teams, 6 waves |
| 17 | `17-shell-header-nav.md` | Toolbar overload, tab-strip overflow, sidebar groups, AI panel discoverability, hover-peek docks, mobile bottom nav, command palette (Ctrl+K), theme toggle, welcome/mode picker | large | 1 team, 5 waves |
| 18 | `18-innovation-roadmap.md` | 🚀 moonshots — de-duped competitive/innovation findings across passes. **Not TDD**; prioritized design briefs with kickoff specs. | large | none directly (feeds future plans) |

"Agents" refers to `/agent-teams` subteams per project feedback memory; each wave enforces file-ownership non-overlap.

## 2. Priority tiers (execution order)

Per Tyler's "fix everything before moving forward" rule, tiers are **hard gates** — no tier-N work starts until tier-(N−1) is complete and `npm run check` is clean.

1. **Tier A — Correctness** (must ship first; breaks production UX) → `01`, `02`
2. **Tier B — Accessibility** (compliance + keyboard users) → `03`
3. **Tier C — Foundation** (design system + shell) → `16`, `17` (can parallelize; different files)
4. **Tier D — Canvas tabs** (highest-traffic user workflows) → `07` (Breadboard), `06` (Schematic), `05` (Architecture), `08` (PCB/3D/Order)
5. **Tier E — Data tabs** → `10` (Procurement), `11` (Validation/Sim), `09` (Component Editor)
6. **Tier F — Utility tabs** → `12` (Arduino/Serial/Code), `15` (Generative/DT/Exports), `14` (Community/Tasks/History), `13` (Learning)
7. **Tier G — Polish** → `04` (Dashboard — absorbs Trust Receipt pattern + refactors to use foundation from Tier C)
8. **Tier H — Innovation** → `18` (briefs; convert to new plans as capacity allows)

Parallelization is permitted within a tier when sub-plans touch disjoint files (see §4 file-ownership map).

## 3. Complete finding → sub-plan coverage map

All 943 unique `E2E-XXX` IDs (1-1042 range with a documented 101-199 gap) are routed below. Ranges default-route by audit-pass section; explicit single-ID reroutes override. Each sub-plan's opening "Coverage" table MUST re-declare every ID it owns so this map can be diff-checked.

### 3.1 Default range routing

| ID range | Audit pass | Primary sub-plan | Reason |
|----------|------------|------------------|--------|
| E2E-001 → E2E-005 | Pass 1 (Vault) | 13-learning-surfaces | Vault lives under Learning hub |
| E2E-006 → E2E-010 | Pass 1 (Procurement) | 10-procurement-suite | |
| E2E-011 → E2E-014 | Pass 1 (Welcome) | 17-shell-header-nav | Mode picker / onboarding |
| E2E-015 → E2E-017 | Pass 1 (Dashboard) | 04-dashboard | |
| E2E-018 | Pass 1 (Dashboard) | 03-a11y-systemic | role=button pattern (cross-cut) |
| E2E-019 → E2E-025 | Pass 1 (Architecture) | 05-architecture | |
| E2E-026 → E2E-034 | Pass 1 (Schematic) | 06-schematic | |
| E2E-035 → E2E-043 | Pass 1 (Breadboard) | 07-breadboard | |
| E2E-040 | Pass 1 (Component Editor) | 09-component-editor | explicit — packed toolbar |
| E2E-044 → E2E-050 | Pass 1 (PCB) | 08-pcb-3d-order | |
| E2E-051 → E2E-053 | Pass 1 (Arduino/tab naming) | 12-arduino-serial-code + 17 | E2E-053 routes to 17 (systemic naming) |
| E2E-054 → E2E-067 | Pass 1 (misc) | per-tab (see §3.2) | |
| E2E-068 → E2E-070 | Pass 1 (workspace) | 03 (E2E-068), 17 (E2E-069), 04 (E2E-070) | |
| E2E-071 → E2E-074 | Pass 1 (popovers) | 17-shell-header-nav (E2E-074 → 02) | |
| E2E-074 | Pass 1 | **02-p1-dead-buttons** (explicit) | Coach popover dead — P1 |
| E2E-075 | Pass 1 | 03-a11y-systemic | aria-label gap on icon-only buttons |
| E2E-076 → E2E-088 | Pass 1 (Architecture extend) | 05-architecture | |
| E2E-078 | Pass 1 | **02-p1-dead-buttons** (explicit) | tool-analyze dead — P1 |
| E2E-089 → E2E-090 | Tab dynamism | 17-shell-header-nav | |
| E2E-091 → E2E-093 | Pass 1 (Validation/Dashboard) | **01-p0-bugs** (explicit) | DRC false positives + dashboard disagreement |
| E2E-094 → E2E-100 | Pass 1 (misc) | per-tab (see §3.2) | |
| E2E-200 → E2E-205 | Pass 1 extend | per-tab | |
| E2E-206 → E2E-260 | Pass 1 extend (mixed) | per-tab | |
| E2E-221 | Pass 1 (Schematic kbd) | 06-schematic | |
| E2E-225 | Pass 1 (Add Component) | **02-p1-dead-buttons** (explicit) | Empty-state CTA broken — P1 |
| E2E-228 / E2E-235 / E2E-270 | Board source-of-truth split | **02-p1-dead-buttons** (explicit) | P1 shared bug |
| E2E-233 | PCB layer visibility | **02-p1-dead-buttons** (explicit) | P1 |
| E2E-236 / E2E-271 / E2E-284 | Spinbutton valuemax=0 | **02-p1-dead-buttons** (explicit) | P1 systemic |
| E2E-261 / E2E-267 | Cards w/ role=button | 03-a11y-systemic | |
| E2E-266 | Community card dead | **02-p1-dead-buttons** (explicit) | P1 |
| E2E-276 | Route/heading naming | 17-shell-header-nav | |
| E2E-283 | Calc → BOM pattern | 16-design-system (pattern) + 10 | Closed-loop reference |
| E2E-286 | Patterns chevron affordance | 13-learning-surfaces | |
| E2E-298 | Audit trail project leak | **01-p0-bugs** (explicit) | P0 |
| E2E-303 | AI Generate w/o API key | 16-design-system (gating pattern) | systemic |
| E2E-312 / E2E-313 | 401 on parts/browse/* | **01-p0-bugs** (explicit) | P0 |
| E2E-314 → E2E-325 | Pass 2 Dashboard | 04-dashboard | |
| E2E-326 → E2E-333 | Pass 2 Architecture | 05-architecture | |
| E2E-334 → E2E-340 | Pass 2 Schematic | 06-schematic | |
| E2E-341 → E2E-348 | Pass 2 Arduino | 12-arduino-serial-code | |
| E2E-349 → E2E-356 | Pass 2 Breadboard | 07-breadboard | |
| E2E-357 → E2E-363 | Pass 2 PCB | 08-pcb-3d-order | |
| E2E-364 → E2E-369 | Pass 2 3D | 08-pcb-3d-order | |
| E2E-370 → E2E-376 | Pass 2 Component Editor | 09-component-editor | |
| E2E-377 → E2E-382 | Pass 2 Procurement | 10-procurement-suite | |
| E2E-383 → E2E-389 | Pass 2 Validation | 11-validation-simulation | |
| E2E-390 → E2E-395 | Pass 2 Simulation | 11-validation-simulation | |
| E2E-396 → E2E-402 | Pass 2 Vault | 13-learning-surfaces | |
| E2E-403 → E2E-409 | Pass 2 Community | 14-community-tasks-history | |
| E2E-410 → E2E-415 | Pass 2 Order PCB | 08-pcb-3d-order | |
| E2E-416 → E2E-420 | Pass 2 Tasks | 14-community-tasks-history | |
| E2E-421 → E2E-425 | Pass 2 Learn | 13-learning-surfaces | |
| E2E-426 → E2E-428 | Pass 2 Inventory | 10-procurement-suite | |
| E2E-429 → E2E-434 | Pass 2 Serial | 12-arduino-serial-code | |
| E2E-435 → E2E-440 | Pass 2 Calculators | 15-generative-digital-twin-exports | (Calculators lives under "utility tabs"; grouped here) |
| E2E-441 → E2E-445 | Pass 2 Patterns | 13-learning-surfaces | |
| E2E-446 → E2E-450 | Pass 2 Starter | 13-learning-surfaces | |
| E2E-451 → E2E-455 | Pass 2 Labs | 13-learning-surfaces | |
| E2E-456 → E2E-458 | Pass 2 History | 14-community-tasks-history | |
| E2E-459 → E2E-462 | Pass 2 Audit Trail | 14-community-tasks-history (E2E-460 → 01 P0) | |
| E2E-460 | Audit Trail project leak visual | **01-p0-bugs** | same bug as E2E-298 |
| E2E-463 → E2E-466 | Pass 2 Lifecycle | 14-community-tasks-history | |
| E2E-467 | Pass 2 Comments | 14-community-tasks-history | |
| E2E-468 → E2E-472 | Pass 2 Generative | 15-generative-digital-twin-exports | |
| E2E-473 → E2E-477 | Pass 2 Exports | 15-generative-digital-twin-exports | |
| E2E-478 → E2E-480 | Pass 2 Supply Chain / Templates / My Parts | 10-procurement-suite | |
| E2E-481 / E2E-482 | Alternates / Part Usage broken visuals | **01-p0-bugs** | P0 (401 root) |
| E2E-483 → E2E-496 | Pass 2 app-wide | distributed: 483 → 17, 484 → 17, 485 → 16, 486 → 16, 487 → 13, 488 → 02 (via 08), 489 → 16, 490 → 16, 491 → 16, 492 → 17, 493 → 17, 494 → 03, 495 → 17, 496 → 17 | |
| E2E-497 → E2E-501 | Projects list | 17-shell-header-nav | |
| E2E-502 → E2E-504 | Settings 404 | **01-p0-bugs** (E2E-502) + 17 (E2E-503/504) | P0 |
| E2E-505 → E2E-507 | Sidebar | 17-shell-header-nav | |
| E2E-508 → E2E-512 | AI panel | 17-shell-header-nav | |
| E2E-513 → E2E-514 | Mode picker | 17-shell-header-nav | |
| E2E-515 → E2E-516 | Hover-peek | 17-shell-header-nav | |
| E2E-517 → E2E-519 | Theme toggle | 17-shell-header-nav (E2E-517/519) + **01** (light mode broken is split across E2E-968/1037) | |
| E2E-520 → E2E-521 | Mobile nav | 17-shell-header-nav | |
| E2E-522 → E2E-545 | Pass 3 competitive | 18-innovation-roadmap (deduped against passes 5/6/8/9/11/12) | |
| E2E-546 → E2E-555 | Pass 3 build/expand | distributed: 546 → 01 (audit trail), 547 → 16 (confidence evaluator), 548 → 04+11 (dashboard/validation selector), 549 → 17 (tab strip), 550 → 17 (tutorial menu), 551 → 11 (DRC empty state), 552 → 03 (ESLint a11y rule), 553 → 02+08 (board source-of-truth), 554 → 03 (kbd nav test suite), 555 → 16 (star icons) | |
| E2E-556 → E2E-561 | Pass 3 workflow | distributed: 556 → 17 (tour), 557 → 04 (sample data bug), 558 → 17 (first-PCB wizard), 559 → 17 (cmd palette), 560 → 18 (git integration), 561 → 18 (API access) | |
| E2E-562 → E2E-610 | Pass 4 Breadboard deep | 07-breadboard (innovation items 586-600 → 18) | |
| E2E-611 → E2E-675 | Pass 5 Breadboard wiring/play | 07-breadboard (iterative 676+ covered separately; innovations 660-675 → 18) | |
| E2E-676 → E2E-708 | Pass 6 Breadboard iterate | 07-breadboard | |
| E2E-709 → E2E-742 | Pass 6 Breadboard innovate + packaging | 18-innovation-roadmap (packaging §C quick-wins E2E-packaging-item-*) → also pinned in 07 sequencing | |
| E2E-743 → E2E-778 | Pass 7 Architecture deep | 05-architecture (innovations 776-778 → 18) | |
| E2E-779 → E2E-818 | Pass 8 Architecture node/edge | 05-architecture (innovations 809-818 → 18) | |
| E2E-819 → E2E-844 | Pass 9 Architecture iterate | 05-architecture (innovations 832-844 → 18) | |
| E2E-845 → E2E-873 | Pass 10 Schematic deep | 06-schematic (strategic 870-873 → 18) | |
| E2E-874 → E2E-914 | Pass 11 Schematic wiring/play | 06-schematic (innovations 905-914 → 18) | |
| E2E-915 → E2E-941 | Pass 12 Schematic iterate | 06-schematic (innovations 927-941 → 18) | |
| E2E-942 → E2E-967 | Pass 12B Schematic populated | 06-schematic (corrections applied — see §4) | |
| E2E-968 → E2E-1042 | Pass 13 design system | 16-design-system (E2E-968/1037 light-mode → 01 P0) | |

### 3.2 Explicit per-finding assignments in Pass 1 "misc" range (E2E-054 → E2E-100, E2E-200 → E2E-260)

Sub-plans that own these ranges must re-read `docs/audits/2026-04-18-frontend-e2e-walkthrough.md` and add every owned ID to their coverage table. Default heuristic: each finding is filed under its tab or systemic concern per the section heading that precedes it in the audit. Sub-plan authors MUST grep the audit with `grep -nE "E2E-0(5[4-9]|[6-9][0-9]|100)|E2E-2[0-9][0-9]"` and build exhaustive tables.

## 4. Reconciliation — corrections, retractions, dedup

### 4.1 Pass 12B corrections (authoritative — supersede Pass 10-12 where noted)

| Original finding | Correction (Pass 12B) | Implication |
|------------------|----------------------|-------------|
| E2E-883 (drag-only broken) | E2E-964: drag WORKS via real pointer events; click-fallback is the only gap | In `06-schematic.md` treat drag-infrastructure as shipped; scope is click-fallback only |
| E2E-862 (no import button) | E2E-965: still missing on populated canvas | Stands — carry into plan |
| E2E-779 (handles too small) | E2E-967: Schematic handles are 10px (OK); Architecture handles still tiny | Split: 06-schematic fix handle size only if <10px; 05-architecture must raise handle size |
| E2E-950 | E2E-966: empty-state heading persists in DOM on populated canvas → a11y regression | Route to 03-a11y-systemic AND 06-schematic (both own a piece) |

### 4.2 Innovation dedup (collapsed in `18-innovation-roadmap.md`)

| Canonical item | Duplicate source findings |
|----------------|---------------------------|
| AR guided wiring (phone-over-breadboard) | E2E-542, E2E-600, E2E-711 (haptic variant) |
| Animated current flow on wires | E2E-591 (breadboard), E2E-696 (iteration), E2E-822 (arch edges), E2E-909 (schematic) |
| Hover-pin Vault tooltip | E2E-544, E2E-649, E2E-704, E2E-891, E2E-961 |
| Wire auto-color by net role | E2E-616, E2E-678, E2E-784, E2E-822 (all distinct implementations; consolidate into one shared hook) |
| Voltage probe overlay | E2E-655, E2E-694 |
| Time-travel scrubber | E2E-537, E2E-645, E2E-833, E2E-928 |
| Mistake catalog / proactive teaching | E2E-652, E2E-705, E2E-722, E2E-842, E2E-929 |
| Drag-to-trash | E2E-639, E2E-806 |
| Bench tray / stash slot | E2E-640, E2E-807 |
| Photo-to-digital reconstruction | E2E-594, E2E-730, E2E-907, E2E-839 |
| Multiplayer co-edit | E2E-522, E2E-599, E2E-674, E2E-817 |
| Skin packs / theme moods | E2E-738, E2E-939 |
| Voice input / voice wiring | E2E-511, E2E-541, E2E-719, E2E-906 (narration), E2E-940 (multi-modal) |
| AI architecture/schematic critique persona | E2E-720, E2E-814, E2E-927, E2E-933 |
| Real Arduino USB twin | E2E-586, E2E-726, E2E-934 |
| Self-correcting AI loop | E2E-534, E2E-722, E2E-842, E2E-929 |

Each collapsed item in `18-innovation-roadmap.md` lists ALL source IDs so no finding is silently dropped.

### 4.3 Cross-cutting items with multi-owner routing

| Finding | Primary owner | Secondary owner(s) | Coordination rule |
|---------|--------------|--------------------|-------------------|
| E2E-068, E2E-261, E2E-267 (role=button on div) | 03-a11y | 04, 13, 14 (tabs where pattern appears) | 03 ships the ESLint rule + shared component; tab plans consume it |
| E2E-228/235/270 (board source-of-truth) | 02-p1-dead-buttons | 08 (PCB/3D/Order consumes) | 02 ships `useProjectBoard()` hook + server endpoint; 08 refactors three tabs to consume |
| E2E-091/093/548 (validation ↔ dashboard) | 01-p0-bugs | 04-dashboard, 11-validation | 01 fixes DRC empty-state; 04 rewires dashboard summary; 11 refactors selector |
| E2E-485/547 (confidence contradictions) | 16-design-system | 11, 15, 12 | 16 ships ConfidenceEvaluator service + schema; consumers refactor |
| E2E-303 (API key gating) | 16-design-system | everywhere AI buttons exist | 16 ships `<GatedAIButton>` primitive; all AI-containing plans consume |
| E2E-487 (Learning surfaces merge) | 13-learning-surfaces | 17 (tab strip collapse) | 13 decides merge/keep; 17 adjusts tab inventory |
| E2E-298/460/546 (project-scope leak) | 01-p0-bugs | 14 (audit trail display) | 01 adds server middleware + test; 14 updates audit trail UI only if needed |

## 5. Execution sequence (definitive)

```
Wave 0 (prereqs — this turn):
  00-master-index.md written ← this file

Wave 1 (Tier A):
  01-p0-bugs.md           ──┐
  02-p1-dead-buttons.md   ──┴─ run sequentially; each must ship clean

Wave 2 (Tier B):
  03-a11y-systemic.md

Wave 3 (Tier C — parallelizable):
  16-design-system.md   ║   17-shell-header-nav.md

Wave 4 (Tier D — serialize; they modify React Flow wiring that conflicts):
  07-breadboard.md
  06-schematic.md
  05-architecture.md
  08-pcb-3d-order.md

Wave 5 (Tier E — parallelizable; disjoint files):
  10-procurement-suite.md ║ 11-validation-simulation.md ║ 09-component-editor.md

Wave 6 (Tier F — parallelizable):
  12-arduino-serial-code.md ║ 15-generative-digital-twin-exports.md
  14-community-tasks-history.md ║ 13-learning-surfaces.md

Wave 7 (Tier G):
  04-dashboard.md

Wave 8 (Tier H — brief phase):
  18-innovation-roadmap.md    (converts to future plans as capacity frees)
```

Within each sub-plan, sub-waves use `/agent-teams` per project memory rule (never background subagents for implementation; hard cap 6 concurrent agents).

## 6. Shared-infrastructure commitments (apply to every sub-plan)

These are NOT re-proven in each sub-plan. They are assumed truths of the codebase as of 2026-04-18:

- **Tests run with Vitest 4.** `npm test` is the universal command. Playwright e2e lives under `tests/e2e/`.
- **Type-check.** `npm run check` must stay green across every commit. TS strict mode is on.
- **Lint.** `npx eslint .` must stay green; `npx prettier --write .` is the canonical formatter.
- **Auto-commit hook** lives at `.claude/hooks/auto-commit-vault.sh`. Do NOT bypass.
- **Auto-push cron** pushes main branch every 15 min; NEVER push from feature branches automatically (project memory).
- **Drizzle block in Vitest** — tests touching `db/schema` need the Drizzle mock at `tests/setup/drizzle.ts` (project memory).
- **Barrel imports** — `@/components/ui` and `@/lib/*` are barrel-mapped; never import from deep paths.
- **Express 5 routing** — `PUBLIC_API_PATHS` in `server/request-routing.ts` is the auth-exempt allowlist. Relevant for E2E-312/313 in `01-p0-bugs`.

Every sub-plan's Existing Infrastructure table must include a row for each of these that it touches.

## 7. Research protocol (mandatory per sub-plan) — UPGRADED 2026-04-19

Per project memory "DO REAL RESEARCH ALWAYS. NO MVP." — and with Ars Contexta tooling now shipped (12 of 15 upgrade items complete per `docs/superpowers/plans/2026-04-18-arscontexta-upgrade-progress.md`), the research step is now concrete and mechanized.

### Sequence (mandatory before any edit)

1. **`/vault-prefetch`** — automatic on session start (via hook); refresh mid-session if you pivot. Gives Claude a digest of relevant MOCs + top notes for the current cwd/branch. Reduces downstream search volume.

2. **`/vault-suggest-for-plan <this-plan-file>`** — at the START of executing a sub-plan, run this once. It scans every Task description, batch-queries qmd, and emits a suggestion report (coverage per task: sufficient / thin / missing). Paste the report into the plan's Research log. This is the **single biggest time-saver**: 80% of vault integration mapped in one command.

3. **Per-task research loop**:
   - If the suggestion report says `sufficient` → cite the listed slugs directly in the task's code/tests, consume via `<VaultHoverCard slug="...">` / `<VaultExplainer slug="...">` where the UI benefits.
   - If `thin` or `missing` → invoke `/vault-gap "<topic>" --origin-plan <path> --origin-task <id>`. The skill auto-seeds an inbox stub, appends to `ops/queue/gap-stubs.md`, and returns a payload to paste.
   - Concurrently: continue the task with the best available coverage, flag the gap in the Research log, and check back after `/extract` processes the stub.

4. **Codebase grep** — ast-grep for the function/component being touched. Never assume API shape. (Unchanged.)

5. **Context7 MCP** — `resolve-library-id` + `query-docs` for third-party APIs (React 19, React Flow, shadcn, Drizzle, Vitest, Playwright). Max 3 resolves + 3 queries per question. (Unchanged.)

6. **WebSearch** — for industry/EDA standards (IEEE 315, IEC 60617, WCAG SC numbers, KiCad, Flux, Wokwi). Cite URL in the task.

7. **Vault-validate before citing** — when you intend to cite a vault slug in the plan's implementation, optionally run `/vault-validate <slug>` first. If schema errors exist, prefer a different source OR queue the fix.

8. **Advisor** — each sub-plan calls `advisor()` after the failing-test phase of its first task, and again before declaring done.

### Commit gate

When the sub-plan produces new knowledge notes (rare, but happens when plan execution generates domain insight), `/extract` MUST run `/vault-quality-gate` before committing. Notes that fail bounce to `inbox/review/` — they do NOT land in `knowledge/` until fixed.

### Pipeline discipline (reminder)

- **NEVER write directly to `knowledge/`.** Every note goes through `inbox/ → /extract → knowledge/`.
- Gap stubs are created via `/vault-gap`, user suggestions via `/vault-inbox`, migration needs via `/vault-validate`'s `migrate-v1-to-v2.py` — all land in `inbox/`.
- `/extract` is the only writer to `knowledge/`. Priority is ranked by `/vault-extract-priority` which reads the queue.

### Observability

- `/vault-health` runs weekly (cron) and emits a trend report in `ops/health/`. Tracks orphan count, backlink growth, schema-drift counts, demand-gap age.
- `/vault-index --rebuild` regenerates the plan↔vault↔code backlink DB at `ops/index/plan-vault-backlinks.json`. Pre-commit hook recommended for repos touching `knowledge/` or plans.

## 8. Quality gates (every sub-plan wraps with this checklist)

```
□ npm run check          ← zero errors
□ npm test              ← all tests green, including new ones
□ npx eslint .          ← zero warnings
□ npx prettier --write . ← no diff
□ Coverage table verified ← every claimed E2E-XXX appears in a commit message or test name
□ Playwright e2e ran (if UI change) ← new e2e asserts the finding
□ No agent exceeded 6-concurrent cap during execution
□ No stepping-on-teammates violations ← file-ownership honored
□ MASTER_BACKLOG.md updated with BL-XXXX entries for follow-ups
□ advisor() called before "done"
```

## 9. Sub-plan template (what each 01-18 file MUST contain)

```
# <Title> Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** <one sentence>
**Architecture:** <2-3 sentences>
**Tech Stack:** <key libs>
**Parent:** 00-master-index.md § <section>
**Tier:** A | B | C | D | E | F | G | H
**Depends on:** <previous sub-plan IDs>

## Coverage
| E2E ID | Severity | Finding summary | Task ID |
|--------|----------|-----------------|---------|
| ... every claimed ID listed ...

## Existing Infrastructure
| Concern | File(s) | Notes |

## Phase 1 — <name>
  Files: (Create | Modify | Test)
  /agent-teams prompt:
    Members: <N>, File ownership: <map>
  - [ ] Task 1.1 — write failing test
    code + exact rg/pytest command + expected FAIL
  - [ ] Task 1.2 — run test (expect fail)
  - [ ] Task 1.3 — implement (full code in plan, not "add logic")
  - [ ] Task 1.4 — run test (expect pass)
  - [ ] Task 1.5 — commit: <exact git command + message>

## Phase N — ...

## Team Execution Checklist
  (the §8 gates, restated)

## Research log
  - Context7: lib X @ version Y — "question" → answer summary
  - WebSearch: URL → relevant quote
  - Codebase: rg "pattern" at file:line
```

## 10. Verification of this index

Every finding accounted for (943 IDs):

```bash
# Run after all sub-plans are written:
for id in $(grep -oE 'E2E-[0-9]+' docs/audits/2026-04-18-frontend-e2e-walkthrough.md | sort -u); do
  hits=$(grep -rl "$id" docs/superpowers/plans/2026-04-18-e2e-walkthrough/ | wc -l)
  if [ "$hits" -eq 0 ]; then echo "MISSING: $id"; fi
done
# MUST output nothing.
```

The acceptance criterion for completing this master roadmap is that the above bash loop prints nothing.

## 11. Known audit-document caveats (do not re-litigate)

- Findings E2E-001 through E2E-200 were flagged by the audit author as "largely fast first-pass coverage sweep — not all individually click-verified." Anything tagged "GLANCED" in the audit requires a DevTools re-verify before action. Sub-plan authors: when owning a GLANCED finding, add a pre-implementation verification task (`Task N.0 — reproduce in DevTools, screenshot, attach`).
- Methodology discriminator: "a button works iff a real DevTools click produces user-visible state change." Playwright tests should use `page.getByRole(...).click()`, not `dispatchEvent`.

## 13. Vault integration commitment (added 2026-04-19 after tooling complete)

The 2026-04-14 Ars Contexta campaign shipped a production vault-consumption layer (683 notes, 54 MOCs, `useVaultSearch`/`useVaultNote` hooks, `/api/vault/search`, `server/ai.ts` auto-inject). **The 2026-04-18/19 upgrade campaign shipped 12 operational skills on top of that** — gap detection, schema validation, backlink indexing, suggestion mapping, provenance, health reporting, user-suggestion intake, quality gate, audience tiering, learn-paths, prefetch, priority ranking. Integration now has mechanized support end-to-end.

### Foundational primitives (ship in `16-design-system.md` Phase 8)

- `useVaultQuickFetch(slug)` — React Query wrapper with 10-min `staleTime`.
- `<VaultHoverCard slug|topic fallback>` — Radix HoverCard with title + 140-char summary + "Read more in Vault →" deep link. Loading + error states. 404 offers `<VaultInboxCta>` (see T8).
- `<VaultExplainer slug audience>` — inline expandable; reads T11 tier markers.
- `<VaultInboxCta topic>` — the 404 fallback that posts to `/api/vault/suggest` (T8 protocol).

### Consumption map per sub-plan

| Plan | Key vault insertion | Primary domain |
|------|--------------------|----------------|
| 02-p1-dead-buttons | Community card detail dialog tag MOCs (Phase 5.5b) | marketplace/licensing |
| 03-a11y-systemic | Wave 10 seeds `inbox/` stubs for WCAG/ARIA gaps (FOUR STUBS SEEDED 2026-04-19) | a11y/WCAG |
| 04-dashboard | Network preview edge tooltips; vault-verified sample data | protocols/starter circuits |
| 05-architecture | Asset Library part tooltips; AI-critique grounding via `buildVaultContext` | component selection/pinouts |
| 06-schematic | ERC rule `vaultSlug`; net-naming convention; pin alternate-function dialog | nets/pins/ERC |
| 07-breadboard | Deepened hover-pin tooltip; mistake catalog rule → vault slug | breadboard-intelligence |
| 08-pcb-3d-order | Layer material "?"; fab tradeoff matrix; trace width context | PCB materials/fabrication |
| 09-component-editor | Field-definition HoverCards (Family/Mounting/Package/MPN) | component-field-* |
| 10-procurement-suite | ESD explainer; alternate-selection reasoning | sourcing/lifecycle |
| 11-validation-simulation | Plain-English DC Operating Point; DRC rule explainers | simulation/DRC-rules |
| 12-arduino-serial-code | Verify pipeline note; baud-rate standards | arduino-build/serial |
| 13-learning-surfaces | Tightened: each article has vault MOC slug; graph view via T9 | all learning MOCs |
| 14-community-tasks-history | NRND reason lookup; license plain-English | lifecycle-*/license-* |
| 15-generative-digital-twin-exports | GA param derivation; calculator formula derivation | algorithms/electronics-math |
| 17-shell-header-nav | Welcome tour content; first-PCB wizard steps | onboarding/maker-ux |

### Execution workflow

Each sub-plan, during its own run:

1. Run `/vault-suggest-for-plan docs/superpowers/plans/2026-04-18-e2e-walkthrough/<plan>.md --json` → paste report into the plan's Research log.
2. For each `sufficient` task → consume via primitive in implementation.
3. For each `thin`/`missing` task → `/vault-gap "<topic>" --origin-plan <plan> --origin-task <id>` → stub lands in `inbox/`; status tracked in `ops/queue/gap-stubs.md`.
4. Concurrently, `/extract` drains the queue (priority-ordered by T15).
5. After `/extract` processes a stub, the resulting `knowledge/<slug>.md` gets `/vault-quality-gate`'d; on pass, the plan task's implementation gets updated to cite the new slug.
6. `/vault-health --compare auto` runs weekly to track orphan→consumed migration.

### Coverage TSV

`docs/superpowers/plans/2026-04-18-e2e-walkthrough/coverage/vault-integration.tsv` is the verification map. Grow it as each sub-plan executes.

## 12. Out-of-scope (explicitly)

Not covered by this master (track separately if desired):
- Tauri migration — `project_tauri_migration.md` memory — blocked on hardware POC
- Ars Contexta vault back-end improvements — separate campaign, already shipped
- BreadboardLab Wave 2+ audit — separate plan under `docs/plans/` (Wave 1 already merged per memory)
- Build pipeline / CI changes — handled by `github-actions-expert` agent if needed

---

**Next actions:**
1. Approve this index.
2. Begin writing `01-p0-bugs.md` (Tier A Wave 1) per §9 template.
3. Continue through sub-plans in §5 sequence.

*Index authored: 2026-04-18. Audit source: `docs/audits/2026-04-18-frontend-e2e-walkthrough.md` (2470 lines, 943 findings). Plan location: `docs/superpowers/plans/2026-04-18-e2e-walkthrough/`.*
