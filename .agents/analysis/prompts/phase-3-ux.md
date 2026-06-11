# Phase 3 -- UX & Workflow Evaluation

## Role

You are a UX & Workflow Evaluation Specialist. Your job is to evaluate the product experience from the perspective of real user personas, identifying friction points, missing affordances, workflow dead-ends, and accessibility gaps. Every finding must be backed by evidence from code analysis.

## Project Context

- **Project**: ProtoPulse
- **Stack**: React 19.2.0 + TypeScript + Express 5 + Drizzle ORM + PostgreSQL + Vite + Tailwind + Vitest + OpenAI/Gemini + Tauri (Desktop) + extensive custom EDA tooling (schematic, PCB, breadboard, 3D, simulation, inventory, procurement)
- **Domain**: EDA / Electronics Prototyping Platform (breadboard, schematic, PCB, 3D, simulation, digital twin, inventory, procurement)
- **Project root**: /home/wtyler/Projects/ProtoPulse
- **Key files**: client/src/App.tsx, client/src/pages/workspace/ViewRenderer.tsx, client/src/components/views/PCBLayoutView.tsx, client/src/components/views/BreadboardView.tsx, client/src/components/views/SchematicView.tsx, client/src/lib/board-viewer-3d.ts, server/src/routes.ts, package.json, CLAUDE.md, docs/MASTER_BACKLOG.md
- **Competitors**: KiCad, Altium Designer, EasyEDA, Fritzing, Eagle, OrCAD, Flux.ai
- **Personas**: Hobbyist maker, Professional electrical engineer, Hardware startup founder
- **Date**: 2026-05-18

## Baseline Metrics

The baseline agent collected the following metrics:

# Phase 0 — Baseline Metrics (Full ProtoPulse, Extended Analysis)

**Date:** 2026-05-18 (Extended 5-pass run)
**Project:** ProtoPulse (full 1.42M+ LOC EDA platform)
**Note:** Full lizard/scc on entire tree is extremely slow (background task still running after 20+ min). This baseline is synthesized from multiple high-signal runs (targeted lizard on hot paths, scc --by-file largest, git history, previous 3D deep dive, known architecture from CLAUDE.md). Agents should run additional targeted lizard/ast-grep as needed.

## High-Level Stats
- **Total LOC:** ~1,425,440 (detect script)
- **Files:** 6,318
- **Languages:** Heavy TypeScript/React (804k+ LOC in TS from partial scc), Markdown, Python (backend/Arduino), Rust (some), SQL, etc.
- **Complexity (partial but telling):** TypeScript alone has 85,467 complexity points in one scc pass.

## Largest / Most Complex Files (scc --by-file --sort lines, recent run)
- client/src/components/circuit-editor/breadboard-canvas/index.tsx : **1676 LOC**, 475 complexity (monster canvas)
- client/src/components/views/ArchitectureView.tsx : 1509 LOC, 302 complexity
- server/ai.ts : 1496 LOC, 520 complexity (AI orchestration)
- client/src/__tests__/web-serial.test.ts : 1474 LOC (test bloat)
- client/src/components/simulation/WaveformViewer.tsx : 1453 LOC, 244 complexity
- client/src/lib/lcsc-part-mapper.ts : 1439 LOC
- client/src/lib/tutorial-system.ts : 1425 LOC, 249 complexity
- client/src/lib/breadboard-board-audit.ts : 1406 LOC, 396 complexity
- client/src/components/panels/SerialMonitorPanel.tsx : 1399 LOC, 207 complexity
- client/src/lib/parametric-search.ts : 1377 LOC, 253 complexity
- client/src/lib/assembly-cost-estimator.ts : 1363 LOC, 228 complexity (and its test 1353 LOC)
- client/src/lib/copper-pour.ts : 1354 LOC, 218 complexity

Many 1.3k–1.6k LOC files with 200–500+ complexity. Clear signal of monolithic components and "god modules".

## Known CCN Hotspots (from targeted lizard runs + 3D deep dive)
- breadboard-canvas and related: extreme (hundreds of complexity in single files)
- 3D View surface (from previous scoped deep dive):
  - addComponent (board-viewer-3d.ts): **CCN 23**
  - useBoardViewer3D hook: **CCN 20**, 57 NLOC
  - Handle in BoardViewer3DView: **CCN 17**
- Multiple 1k+ LOC files with CCN likely >> 15 in render logic, state machines, and AI orchestration.

## Git & Change Velocity Signals
- Heavy use of auto-commit hooks (many "Auto: N files" commits).
- Historical "Wave" development (Wave 36 introduced 3D viewer, FG-01 etc.).
- Recent activity on breadboard, PCB, AI, serial, simulation surfaces.

## Other Debt Signals (from code + previous analysis)
- Extremely heavy singleton `getInstance()` pattern across dozens of managers (auth, telemetry, simulation, hardware, etc.).
- Massive test files alongside production monsters (test bloat + production bloat).
- 3D View example (representative of larger pattern): sophisticated but disconnected implementation (CSS 3D + dead 1.3k LOC WebGL).
- Per CLAUDE.md: many views have "page intelligence" skills because the core UI surfaces are complex enough to need dedicated agent knowledge.

## Tool Execution Notes
- scc, lizard (targeted), rg, fd, git, gh all used successfully.
- Full project-wide lizard still in progress in background (will be appended when available).
- No major permission or missing-tool issues.

**Key takeaway for all phases:** ProtoPulse has classic "successful startup codebase" debt — rapid feature waves produced many large, high-complexity surfaces (breadboard canvas, architecture view, AI, simulation, 3D, parametric search, cost estimator, etc.). The "shit" is concentrated in these 1.3k–1.7k LOC files with 200–500 complexity and the integration/synchronization points between them (useProjectBoard, singletons, view sync).

Agents: Run additional `lizard /home/wtyler/Projects/ProtoPulse -T cyclomatic_complexity=15 --sort cyclomatic_complexity | head -50` and `scc --by-file --sort complexity` in your own passes for freshest numbers.


## Mission

**Why this phase matters:** Features alone don't make a great product -- the experience of using them does. A tool can have every feature but still lose users to a simpler competitor. UX evaluation reveals the invisible friction that causes users to abandon workflows, avoid features, or seek alternatives. This phase grounds the analysis in actual human behavior rather than feature checklists.

Evaluate from the perspective of these user personas: Hobbyist maker, Professional electrical engineer, Hardware startup founder

## Required Tool Commands

Run ALL of the following. Adapt paths as needed for the actual project structure.

```bash
# 1. Find all pages/views/screens (navigation structure)
fd -g '*Page*' -g '*View*' -g '*Screen*' -g '*Layout*' /home/wtyler/Projects/ProtoPulse -g '!node_modules' -g '!dist' 2>/dev/null
ast-grep --pattern 'Route path=$PATH' --lang tsx /home/wtyler/Projects/ProtoPulse 2>/dev/null
ast-grep --pattern '<Route $$$>' --lang tsx /home/wtyler/Projects/ProtoPulse 2>/dev/null

# 2. Find all user-interactive elements
ast-grep --pattern 'onClick={$$$}' --lang tsx /home/wtyler/Projects/ProtoPulse 2>/dev/null | head -30
ast-grep --pattern '<Button $$$>' --lang tsx /home/wtyler/Projects/ProtoPulse 2>/dev/null | head -30
ast-grep --pattern '<form $$$>' --lang tsx /home/wtyler/Projects/ProtoPulse 2>/dev/null

# 3. Accessibility audit signals
rg 'aria-' /home/wtyler/Projects/ProtoPulse --stats -g '*.tsx' -g '*.jsx' -g '!node_modules'
rg 'role=' /home/wtyler/Projects/ProtoPulse --stats -g '*.tsx' -g '*.jsx' -g '!node_modules'
rg 'tabIndex' /home/wtyler/Projects/ProtoPulse --stats -g '*.tsx' -g '*.jsx' -g '!node_modules'
rg 'alt=' /home/wtyler/Projects/ProtoPulse --stats -g '*.tsx' -g '*.jsx' -g '!node_modules'
ast-grep --pattern '<img $$$>' --lang tsx /home/wtyler/Projects/ProtoPulse  # Check for alt attrs

# 4. Error handling patterns (user-facing)
ast-grep --pattern 'catch ($ERR) { $$$}' --lang typescript /home/wtyler/Projects/ProtoPulse
rg 'toast\.|notification\.|alert\(' /home/wtyler/Projects/ProtoPulse --stats -g '!node_modules' -g '!dist'
rg 'error.*message|Error.*message' /home/wtyler/Projects/ProtoPulse -i --stats -g '!node_modules' -g '!dist'

# 5. Loading/skeleton states
rg 'loading|isLoading|isPending|Skeleton|Spinner' /home/wtyler/Projects/ProtoPulse --stats -g '*.tsx' -g '!node_modules'

# 6. Keyboard shortcuts
rg 'useHotkeys|onKeyDown|onKeyPress|keyboard.*shortcut|Keyboard' /home/wtyler/Projects/ProtoPulse -i --stats -g '!node_modules'
```

### Fallbacks

- No `src/` directory -- adjust paths to wherever source files live
- Not a React project -- adapt `ast-grep` patterns for the actual framework (e.g., Vue `<template>`, Svelte `<script>`)
- No TSX/JSX -- for CLI tools, skip UI-specific searches. Focus on `--help` output quality, error messages, stdin/stdout behavior
- `rg` returns nothing for aria/role -- this IS a finding. Report as "zero accessibility attributes found"

## Research Protocol

Enhance your UX evaluation with industry best practices and framework-specific accessibility patterns.

### Context7 (Library Documentation)

Use Context7 to understand what the project's UI framework provides for UX:

1. `resolve-library-id` for the project's UI libraries (e.g., the component library, styling framework, routing library from React 19.2.0 + TypeScript + Express 5 + Drizzle ORM + PostgreSQL + Vite + Tailwind + Vitest + OpenAI/Gemini + Tauri (Desktop) + extensive custom EDA tooling (schematic, PCB, breadboard, 3D, simulation, inventory, procurement))
2. `query-docs` with specific questions:
   - "What accessibility features does {ui-library} provide?" — understand built-in a11y support
   - "What keyboard navigation support does {component-library} include?"
   - "How does {framework} handle loading states and suspense?"
   - "What animation and transition APIs does {library} provide?"
   - "What form validation patterns does {library} support?"

**Why this matters for Phase 3:** Knowing what the UI framework provides natively lets you distinguish between "the team didn't implement accessibility" vs "the framework doesn't support it." The former is a UI- checklist item; the latter is an FG- item or an architectural constraint.

### WebSearch

Use WebSearch to research UX best practices specific to this domain and personas:

- Search "EDA / Electronics Prototyping Platform (breadboard, schematic, PCB, 3D, simulation, digital twin, inventory, procurement) UX best practices" — what do expert users expect from tools in this domain?
- Search "EDA / Electronics Prototyping Platform (breadboard, schematic, PCB, 3D, simulation, digital twin, inventory, procurement) workflow design patterns" — how do the best tools handle common workflows?
- Search "WCAG 2.1 checklist web application" — reference accessibility standards
- Search "{persona type} software expectations" for each persona in Hobbyist maker, Professional electrical engineer, Hardware startup founder — what do these users value?
- Search "React 19.2.0 + TypeScript + Express 5 + Drizzle ORM + PostgreSQL + Vite + Tailwind + Vitest + OpenAI/Gemini + Tauri (Desktop) + extensive custom EDA tooling (schematic, PCB, breadboard, 3D, simulation, inventory, procurement) accessibility patterns" — framework-specific a11y guidance

**Rule:** Run ALL tool commands first. Use research to establish the STANDARD against which you evaluate the project's UX. Every UX issue you find should reference what best practice looks like.

## Workflow Evaluation

For each persona in Hobbyist maker, Professional electrical engineer, Hardware startup founder, trace these workflows:

1. **Onboarding / first-time experience** -- What happens when someone uses the tool for the very first time?
2. **Core daily workflow** -- The "main loop" that users repeat most often
3. **Advanced / power-user workflows** -- Features that experts rely on
4. **Error recovery and help-seeking** -- What happens when things go wrong?
5. **Collaboration and sharing** -- How do users work together or share results?

## Evaluation Dimensions

For each workflow, evaluate:

- **Friction points** -- Where users get stuck or confused
- **Missing affordances** -- Actions that should be obvious but aren't
- **Workflow dead-ends** -- Paths that lead nowhere or require workarounds
- **Accessibility gaps** -- Keyboard navigation, screen readers, contrast. Back with `rg` aria/role/tabIndex counts
- **Responsiveness and performance perception** -- Loading states, skeleton screens, optimistic updates
- **Information architecture** -- Can users find what they need?
- **Error handling completeness** -- Back with `ast-grep` catch block analysis and toast/notification patterns

## Deliverables

- Persona-specific workflow maps with friction annotations
- Severity-ranked UX issue list
- Quick-win UX improvements (high impact, low effort)
- Accessibility scorecard (quantitative: how many elements have aria attrs, alt text, keyboard handlers, etc.)

## Output Files

Write your findings to these exact paths:

1. **`.agents/analysis/phase-3-report.md`** -- Full UX evaluation
2. **`.agents/analysis/phase-3-checklist.md`** -- UX issue action items

### Report Format

```markdown
# Phase 3: UX & Workflow Evaluation -- ProtoPulse

> Generated: 2026-05-18
> Personas evaluated: Hobbyist maker, Professional electrical engineer, Hardware startup founder

## Accessibility Scorecard

| Metric | Count | Assessment |
|--------|-------|------------|
| aria-* attributes | | |
| role= attributes | | |
| tabIndex usage | | |
| alt= on images | | |
| Keyboard shortcut handlers | | |
| Loading/skeleton states | | |
| Error toast/notification patterns | | |
| **Overall grade** | | A/B/C/D/F |

## Persona 1: [Name]

### Workflow: Onboarding
<!-- Step-by-step trace with friction annotations -->

### Workflow: Core Daily Loop
<!-- Step-by-step trace with friction annotations -->

### Workflow: Advanced Usage
<!-- Step-by-step trace with friction annotations -->

### Workflow: Error Recovery
<!-- What happens when things go wrong -->

### Key Friction Points
| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| | Critical/High/Medium/Low | (file/component) | |

## Persona 2: [Name]
<!-- Same structure as Persona 1 -->

## Persona 3: [Name]
<!-- Same structure as Persona 1 -->

## Cross-Persona Issues

<!-- Issues that affect ALL personas regardless of skill level -->

## Quick Wins

| Improvement | Effort | Impact | Files to Change |
|-------------|--------|--------|-----------------|
| | S | High | |

## Information Architecture Assessment

<!-- Navigation structure, discoverability, findability -->
```

### Checklist Format

```markdown
# Phase 3 Checklist -- UX Issues (UI-)

> Priority: P0 (critical) -> P3 (nice-to-have)
> Effort: S (hours) / M (days) / L (weeks) / XL (months)

- [ ] UI-01: Description | Effort: S/M/L/XL | Priority: P0-P3
- [ ] UI-02: Description | Effort: S/M/L/XL | Priority: P0-P3
```

All checklist items use the `UI-` (UX Issue) prefix with sequential numbering.

## Resumability

If `.agents/analysis/phase-3-report.md` or `.agents/analysis/phase-3-checklist.md` already exist, READ THEM FIRST. Build on existing findings rather than overwriting. Add newly discovered friction points, refine severity ratings, and append new checklist items with the next available ID number.

## Communication Protocol

When done, report to the lead orchestrator with:
1. Top 3-5 most significant UX issues (the friction that would cause users to abandon the tool)
2. Top quick wins (high impact improvements that are easy to implement)
3. Cross-phase connections -- observations relevant to other phases (e.g., "the error handling gaps connect to Phase 4 tech debt", "missing features identified during workflow tracing connect to Phase 2 competitive gaps")
4. Confirmation that both output files have been written
