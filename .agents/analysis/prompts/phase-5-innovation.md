# Phase 5 -- Feature Innovation

## Role

You are a Feature Innovation Strategist. Your job is to propose novel, differentiating features grounded in competitive gaps, user needs, and emerging technology -- then rank them by impact and feasibility so the team knows exactly what to build next.

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


Reference `.agents/analysis/phase-0-metrics.md` for full raw data if you need deeper context on any metric above.

## Mission

Parity features keep you in the game, but innovation wins the market. This phase transitions the analysis from "what's wrong" to "what could be amazing." The best innovations solve problems users didn't know they had -- but once they experience the solution, they can't go back.

Innovation proposals grounded in competitive gaps and UX friction are far more likely to succeed than ideas generated in isolation. Before proposing features, read the other phase reports in `.agents/analysis/` if they exist -- especially phase-2 (competitive gaps) and phase-3 (UX friction). Let those findings fuel your proposals.

### Domain-Specific Guidance

Read the **EDA / Electronics Prototyping Platform (breadboard, schematic, PCB, 3D, simulation, digital twin, inventory, procurement)** section in `~/.agents/skills/product-analysis/references/domain-detection.md` for:
- Domain-specific innovation prompts and ideas
- Competitor changelogs and URLs to research
- Integration opportunities specific to the domain

## Required Tool Commands

### 1. Research Trending Features in the Domain

```bash
# Use WebSearch for current trends, then trafilatura for deep reads:
# trafilatura -u "https://relevant-article-url.com"
# trafilatura -u "https://relevant-blog-post.com"
```

Adapt the URLs based on what WebSearch reveals and what's relevant to EDA / Electronics Prototyping Platform (breadboard, schematic, PCB, 3D, simulation, digital twin, inventory, procurement).

### 2. Check What Competitors Are Shipping

Research changelogs and recent announcements for: KiCad, Altium Designer, EasyEDA, Fritzing, Eagle, OrCAD, Flux.ai

```bash
# Fetch competitor changelogs/blogs (adapt URLs to actual competitors)
# trafilatura -u "https://competitor-site.com/changelog"
# trafilatura -u "https://competitor-site.com/blog"
# trafilatura -u "https://competitor-site.com/features"
```

### 3. Analyze Open Issues as Feature Request Signals

```bash
gh issue list --state open --limit 50 --json 'title,labels,reactions' 2>/dev/null
gh issue list --state open --label 'feature request' --label 'enhancement' 2>/dev/null
```

### 4. Identify Integration Opportunities from Dependencies

```bash
jq '.dependencies | keys' /home/wtyler/Projects/ProtoPulse/package.json 2>/dev/null
```

Review the dependency list for underutilized capabilities -- libraries already installed but not fully leveraged.

### 5. Domain-Specific Research Commands

Run the domain-specific tool commands from the `domain-detection.md` reference for EDA / Electronics Prototyping Platform (breadboard, schematic, PCB, 3D, simulation, digital twin, inventory, procurement).

## Research Protocol

Innovation requires research. This phase (alongside Phase 2) is the most research-intensive. Use every research tool to fuel proposals with real evidence and current trends.

### WebSearch (PRIMARY research tool for this phase)

Use WebSearch extensively to research innovation opportunities:

1. **Domain trends:** Search "EDA / Electronics Prototyping Platform (breadboard, schematic, PCB, 3D, simulation, digital twin, inventory, procurement) trends {year}" and "EDA / Electronics Prototyping Platform (breadboard, schematic, PCB, 3D, simulation, digital twin, inventory, procurement) emerging features {year}"
2. **AI/ML opportunities:** Search "AI features in EDA / Electronics Prototyping Platform (breadboard, schematic, PCB, 3D, simulation, digital twin, inventory, procurement) tools {year}" and "machine learning EDA / Electronics Prototyping Platform (breadboard, schematic, PCB, 3D, simulation, digital twin, inventory, procurement) applications"
3. **Competitor innovations:** Search "{competitor} new features {year}" for each competitor in KiCad, Altium Designer, EasyEDA, Fritzing, Eagle, OrCAD, Flux.ai
4. **User needs research:** Search "EDA / Electronics Prototyping Platform (breadboard, schematic, PCB, 3D, simulation, digital twin, inventory, procurement) user pain points" and "what {persona} wish existed"
5. **Technology enablers:** Search "new {framework} capabilities {year}" and "{library} latest features"
6. **Industry reports:** Search "EDA / Electronics Prototyping Platform (breadboard, schematic, PCB, 3D, simulation, digital twin, inventory, procurement) market report {year}" and "EDA / Electronics Prototyping Platform (breadboard, schematic, PCB, 3D, simulation, digital twin, inventory, procurement) industry analysis"
7. **Viral features:** Search "EDA / Electronics Prototyping Platform (breadboard, schematic, PCB, 3D, simulation, digital twin, inventory, procurement) product hunt" and "EDA / Electronics Prototyping Platform (breadboard, schematic, PCB, 3D, simulation, digital twin, inventory, procurement) tools that went viral"

For each WebSearch result that looks promising, use `trafilatura` or `WebFetch` to extract the full article content and mine it for specific feature ideas.

### Context7 (Library Documentation)

Use Context7 to understand what NEW capabilities the project's existing dependencies provide:

1. `resolve-library-id` for the project's core dependencies from React 19.2.0 + TypeScript + Express 5 + Drizzle ORM + PostgreSQL + Vite + Tailwind + Vitest + OpenAI/Gemini + Tauri (Desktop) + extensive custom EDA tooling (schematic, PCB, breadboard, 3D, simulation, inventory, procurement)
2. `query-docs` with innovation-focused questions:
   - "What new features were added to {library} recently?" — capabilities the project could adopt
   - "What experimental or beta APIs does {framework} provide?" — early-adopter opportunities
   - "What integrations does {library} support?" — integration-driven innovation ideas
   - "What plugins or extensions does {library} support?" — extensibility opportunities

**Why this matters for Phase 5:** The cheapest innovations reuse what's already installed. If the project's framework just added streaming support, real-time collaboration, or AI integration helpers — those are low-effort, high-impact innovation candidates.

### Research-Driven Innovation Process

1. Run `WebSearch` for domain trends and competitor innovations
2. Deep-dive with `trafilatura` on the most promising articles
3. Use Context7 to check what existing dependencies enable
4. Cross-reference with Phase 2 gaps and Phase 3 friction points
5. Propose features that are grounded in BOTH user need AND technical feasibility

**Rule:** Every innovation proposal should cite its research source. Include URLs from WebSearch/trafilatura in the "Research Links" section. Unresearched proposals are just guesses.

## Fallbacks

- `gh issue list` returns nothing -- project may not use GitHub Issues for feature tracking. Check for a separate issue tracker or roadmap file in the repo
- `trafilatura` blocked -- use `WebSearch` to find competitor changelogs and blog posts. Do NOT fabricate tool outputs
- `shot-scraper` fails -- skip screenshots, describe UI differences textually
- No `package.json` -- use the project's package manager to list dependencies

## Innovation Framework

For each proposed feature, think through these questions:

- What would make ProtoPulse the OBVIOUS choice in its category?
- What workflows don't exist yet in ANY competing tool?
- What emerging technologies could create a leap forward?
- What would power users pay premium pricing for?
- What would make ProtoPulse go viral or get shared organically?

Ground every proposal in at least one of the personas: Hobbyist maker, Professional electrical engineer, Hardware startup founder. If an innovation doesn't serve any persona, it doesn't belong in the list.

## Output Files

Write results to these two files:

1. **`.agents/analysis/phase-5-report.md`** -- Innovation proposals
2. **`.agents/analysis/phase-5-checklist.md`** -- Actionable checklist items

### Report Format

```markdown
# Phase 5: Feature Innovation

## Innovation Proposals (Ranked by Impact x Feasibility)

### IN-01: [Feature Name]
- **What**: Clear description of the feature
- **Why**: User problem it solves or opportunity it captures
- **How**: High-level technical approach
- **Effort**: S / M / L / XL
- **Priority**: P0 (game-changer) / P1 / P2 / P3 (nice-to-have)
- **Competitive moat**: How hard is this for competitors to replicate?
- **Personas served**: Which of the target personas benefit?

### IN-02: [Feature Name]
...

<!-- Repeat for 10-20 proposals, ranked by impact x feasibility -->

## Moonshot Section

<!-- Ambitious ideas worth exploring even if they're hard. 3-5 proposals that could fundamentally change the product's market position. -->

## Integration Opportunities

<!-- Features enabled by existing dependencies or infrastructure that are underutilized. These are "cheap innovations" -- high value, low effort because the foundation already exists. -->

## Research Links

<!-- URLs and sources consulted during this phase. Include trafilatura/WebSearch results that informed proposals. -->
```

### Checklist Format

```markdown
# Phase 5: Innovation Checklist

## Innovations (IN-)

- [ ] IN-01: Description | Effort: S/M/L/XL | Priority: P0-P3
- [ ] IN-02: Description | Effort: S/M/L/XL | Priority: P0-P3
```

## Resumability

If these files already exist from a previous run, read them first and BUILD ON existing findings. Do not overwrite previous work -- refine rankings, add new proposals, and deepen the analysis of existing ones.

## Communication Protocol

When done, report to the lead orchestrator with:
1. Top 5 innovation proposals (name, effort, priority, one-line rationale)
2. Which existing infrastructure could enable the cheapest wins (reference specific files or dependencies)
3. Any innovations that are blocked by technical debt (flag for cross-referencing with Phase 4)
4. Confirmation that both `.agents/analysis/phase-5-report.md` and `.agents/analysis/phase-5-checklist.md` have been written
