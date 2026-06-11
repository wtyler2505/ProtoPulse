# Phase 1 -- Current State Inventory

## Role

You are a Current State Inventory Analyst. Your job is to map every user-facing feature, internal capability, and integration point in the project, producing a thorough inventory that grounds all subsequent analysis phases.

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

**Why this phase matters:** You can't improve what you don't understand. A thorough inventory prevents the common mistake of proposing features that already exist (embarrassing) or missing critical infrastructure that constrains future decisions. The inventory also establishes the vocabulary used in all subsequent phases.

Read the codebase thoroughly. Map every user-facing feature, internal capability, and integration point. Every finding must be backed by evidence from tool output -- do not guess or assume.

## Required Tool Commands

Run ALL of the following. Adapt paths as needed for the actual project structure.

```bash
# 1. Find all entry points and exports
ast-grep --pattern 'export default $COMPONENT' --lang typescript /home/wtyler/Projects/ProtoPulse
ast-grep --pattern 'export function $NAME($$$)' --lang typescript /home/wtyler/Projects/ProtoPulse
ast-grep --pattern 'app.get($$$)' --lang typescript /home/wtyler/Projects/ProtoPulse       # Express routes
ast-grep --pattern 'app.post($$$)' --lang typescript /home/wtyler/Projects/ProtoPulse      # Express routes
ast-grep --pattern 'router.$METHOD($$$)' --lang typescript /home/wtyler/Projects/ProtoPulse

# 2. Find all React components (for web apps)
fd -e tsx /home/wtyler/Projects/ProtoPulse -g '!node_modules' -g '!dist' -x grep -l 'export' | head -50

# 3. Find all configuration files
fd -g '*.config.*' -g '.env*' -g '*.json' --max-depth 2 /home/wtyler/Projects/ProtoPulse

# 4. Count and categorize source files
echo "=== Source files ===" && fd -e ts -e tsx -e js -e jsx /home/wtyler/Projects/ProtoPulse -g '!node_modules' -g '!dist' 2>/dev/null | wc -l
echo "=== Test files ===" && fd -g '*test*' -g '*spec*' /home/wtyler/Projects/ProtoPulse --type f -g '!node_modules' 2>/dev/null | wc -l
echo "=== Style files ===" && fd -e css -e scss -e less /home/wtyler/Projects/ProtoPulse -g '!node_modules' 2>/dev/null | wc -l
echo "=== Doc files ===" && fd -e md -e mdx /home/wtyler/Projects/ProtoPulse -g '!node_modules' 2>/dev/null | wc -l

# 5. Map all TODO/FIXME/HACK markers (developer intent signals)
rg 'TODO|FIXME|HACK|XXX|TEMP|DEPRECATED' /home/wtyler/Projects/ProtoPulse --stats -g '!node_modules' -g '!dist'

# 6. Dependency analysis
jq '.dependencies | to_entries | sort_by(.key) | .[] | "\(.key): \(.value)"' /home/wtyler/Projects/ProtoPulse/package.json 2>/dev/null
jq '.devDependencies | keys | length' /home/wtyler/Projects/ProtoPulse/package.json 2>/dev/null
```

### Fallbacks

- No `package.json` -- check `Cargo.toml`, `pyproject.toml`, `go.mod` instead
- `ast-grep` returns no results -- the project may not be TypeScript. Adjust `--lang` to match the actual stack
- `fd` not finding `src/` -- try `lib/`, `app/`, `pkg/`, or glob for `**/*.{ext}`
- `gh` fails -- project may not be on GitHub or auth is missing. Skip GitHub commands and note in report

## Research Protocol

Enhance your inventory with documentation-driven understanding of what's possible vs what's implemented.

### Context7 (Library Documentation)

Use Context7 to look up docs for the project's key dependencies. This is critical for Phase 1 because you need to know what the installed libraries CAN do to assess feature maturity accurately.

1. `resolve-library-id` for the project's top 3-5 dependencies from the stack: React 19.2.0 + TypeScript + Express 5 + Drizzle ORM + PostgreSQL + Vite + Tailwind + Vitest + OpenAI/Gemini + Tauri (Desktop) + extensive custom EDA tooling (schematic, PCB, breadboard, 3D, simulation, inventory, procurement)
2. `query-docs` with specific questions like:
   - "What features does {library} provide?" — compare against what the project actually uses
   - "What is the full API surface of {library}?" — identify capabilities installed but not utilized
   - "What are the built-in integrations for {framework}?" — find integration opportunities

**Why this matters for Phase 1:** If a project has `@xyflow/react` installed but only uses `ReactFlow` component and not `useReactFlow`, `useNodesState`, minimap, or controls — that's a "Partial" maturity rating, not "Mature". Context7 tells you what "Mature" looks like.

### WebSearch

Use WebSearch to understand what's standard in this domain:

- Search "EDA / Electronics Prototyping Platform (breadboard, schematic, PCB, 3D, simulation, digital twin, inventory, procurement) application feature set standard" — what features do users expect?
- Search "React 19.2.0 + TypeScript + Express 5 + Drizzle ORM + PostgreSQL + Vite + Tailwind + Vitest + OpenAI/Gemini + Tauri (Desktop) + extensive custom EDA tooling (schematic, PCB, breadboard, 3D, simulation, inventory, procurement) application architecture patterns" — is this project following standard patterns?
- Search for the project itself (by name) to find any public documentation, user feedback, or community discussions

**Rule:** Run ALL tool commands first. Use research to CONTEXTUALIZE the inventory — comparing what exists against what's possible and what's expected.

## Deliverables

- Complete feature inventory (what exists today) -- backed by `ast-grep` exports/routes data
- Feature maturity rating for each feature: **Mature** / **Functional** / **Partial** / **Stub** / **Missing**
- Data flow map (how state moves through the system)
- Integration points (APIs, external services, databases)
- User-facing entry points and navigation structure
- Quantitative summary: file counts, LOC per module, dependency count

## Output Files

Write your findings to these exact paths:

1. **`.agents/analysis/phase-1-report.md`** -- Full inventory report
2. **`.agents/analysis/phase-1-checklist.md`** -- Actionable enhancement items

### Report Format

```markdown
# Phase 1: Current State Inventory -- ProtoPulse

> Generated: 2026-05-18

## Feature Inventory

| Feature | Maturity | Evidence | Notes |
|---------|----------|----------|-------|
| (feature name) | Mature/Functional/Partial/Stub | (file path, route, component) | |

## Data Flow Map

<!-- How state moves through the system: user action -> component -> context/store -> API -> database -->

## Integration Points

| Integration | Type | Status | Location |
|-------------|------|--------|----------|
| (service name) | API/Database/External | Active/Configured/Stub | (file path) |

## Navigation & Entry Points

<!-- All user-facing screens/views/pages and how they connect -->

## Module Breakdown

| Module | Files | LOC | Purpose |
|--------|-------|-----|---------|
| (module name) | | | |

## Developer Intent Signals

<!-- TODO/FIXME/HACK markers and what they reveal about planned work -->
```

### Checklist Format

```markdown
# Phase 1 Checklist -- Enhancements (EN-)

> Priority: P0 (critical) -> P3 (nice-to-have)
> Effort: S (hours) / M (days) / L (weeks) / XL (months)

- [ ] EN-01: Description | Effort: S/M/L/XL | Priority: P0-P3
- [ ] EN-02: Description | Effort: S/M/L/XL | Priority: P0-P3
```

All checklist items use the `EN-` (Enhancement) prefix with sequential numbering.

## Resumability

If `.agents/analysis/phase-1-report.md` or `.agents/analysis/phase-1-checklist.md` already exist, READ THEM FIRST. Build on existing findings rather than overwriting. Add new discoveries, refine maturity ratings, and append new checklist items with the next available ID number.

## Communication Protocol

When done, report to the lead orchestrator with:
1. Top 3-5 most significant findings (e.g., "53 action types in AI system", "zero test coverage for storage layer")
2. Cross-phase connections -- observations that are relevant to other phases (e.g., "the monolithic context pattern will matter for Phase 4 tech debt", "missing keyboard shortcuts will matter for Phase 3 UX")
3. Confirmation that both output files have been written
