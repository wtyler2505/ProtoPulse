# ProtoPulse -- Product Analysis Report

> Generated: 2026-02-28
> Stack: React 19.2.0, Express 5, Drizzle ORM, PostgreSQL, Vite 7, Tailwind v4, Vitest, Anthropic Claude, Google Gemini
> Domain: EDA (Electronic Design Automation)
> Analysis: 5-phase quantitative product analysis with cross-phase synthesis

## Baseline Metrics

| Metric | Value |
| -------- |------- |
| Total files | 414 (250 TypeScript source) |
| Total LOC (code) | 57,265 |
| Total LOC (with blanks/comments) | 68,748 |
| Client-side LOC | ~39,163 |
| Server-side LOC | ~18,750 |
| Shared LOC | ~1,064 |
| Languages | TypeScript, CSS |
| Database tables | 17 |
| REST API endpoints | 115 |
| AI-callable tools | 78 |
| Export generators | 12 (monolith) + 11 (modular) |
| React components | 55 |
| React contexts | 8 |
| Test files | 75 (35.2% test:source ratio) |
| Production dependencies | 74 |
| Dev dependencies | 22 |
| Workspace views | 10 |
| Total cyclomatic complexity | 9,667 |
| God files (>1000 LOC) | 12 |
| Git commits (30d) | 146 |
| Contributors | 2 |
| COCOMO cost estimate | $1,893,995 |
| COCOMO schedule estimate | 17.53 months |

---

## Executive Summary

ProtoPulse is a browser-based, AI-first Electronic Design Automation platform that occupies an uncontested niche: **architecture-first circuit design with 78 AI-callable tools**, dual AI providers (Claude + Gemini), integrated DRC/ERC/simulation, and 12+ export formats. No other EDA tool starts from system-level block diagrams. This architecture-first workflow, combined with the deepest AI integration in the market (6x more action types than Flux.ai's Copilot), positions ProtoPulse as a genuinely novel approach to hardware design.

**Top 3 Strengths:**

1. **78 AI action types** with native tool use, audit logging, and multi-model routing -- the broadest AI integration in any EDA tool
2. **Architecture-first design** -- the only EDA platform that starts from system-level block diagrams, bridging the gap between design intent and circuit implementation
3. **Self-hosted and free** -- Flux.ai charges $20-$158/month per editor; ProtoPulse's zero-cost model is decisive for cost-sensitive teams, education, and indie makers

**Top 3 Critical Issues:**

1. **PCBLayoutView CCN=135** (9x the danger threshold) -- the PCB layout component is virtually untouchable, blocking ALL PCB feature development including autorouting, trace editing, and DRC visualization
2. **PROJECT_ID=1 hardcoded** -- every user shares the same project; blocks multi-project support, collaboration, proper auth, data isolation, and any viable business model
3. **ALL procurement data is AI-simulated** -- pricing, stock levels, and lead times shown in the BOM are entirely fabricated by the AI; users making purchasing decisions on this data would get wrong prices, wrong availability, and wrong lead times

**Highest-Impact Opportunity:** The **AI Design Agent** (IN-01) -- rather than copying KiCad's manual PCB workflow, ProtoPulse should leverage its 78-action AI system to offer natural-language circuit generation that chains architecture creation, BOM population, validation, and DFM checking in a single flow. This leapfrogs competitors rather than playing catch-up on traditional EDA features.

**Primary Competitive Threat:** **Flux.ai** occupies the exact same niche (browser-based, AI-first) with a more mature PCB layout, 750K+ component library, real-time collaboration for 20 editors, KiCad/Altium/Cadence import, and live supplier data. ProtoPulse leads on AI breadth, architecture diagrams, simulation, and pricing -- but Flux.ai leads on everything else an engineer needs to ship a board.

**30/60/90 Day Roadmap:**

- **Days 1-30 (Foundation):** Remove PROJECT_ID=1, implement database migrations, add CI/CD pipeline, name anonymous functions for debuggability
- **Days 31-60 (Complexity Bombs):** Decompose PCBLayoutView (CCN=135), ShapeCanvas (CCN=381), parseLocalIntent (CCN=102); split ProjectProvider context
- **Days 61-90 (AI System + Professional Workflow):** Split action executor and AI tool registry; optimize AI prompt; integrate real supplier APIs; add design import (KiCad/Eagle); build unified export panel; add onboarding flow

---

## Phase 1: Current State Inventory

### Feature Summary

ProtoPulse comprises 250 TypeScript source files across 10 workspace views with comprehensive feature coverage:

**Mature Features:**

- Architecture block diagram editor (ReactFlow with custom nodes, minimap, controls, auto-layout)
- 78-action AI chat system with SSE streaming, dual providers (Claude + Gemini), native tool use
- BOM management with full CRUD, inline editing, drag-drop reorder, 4 supplier-specific export formats
- Authentication with scrypt hashing, AES-256-GCM encrypted API keys, session management
- 40+ shadcn/ui design system primitives with dark theme

**Functional Features:**

- Schematic capture with net drawing, ERC, multi-sheet support, hierarchical sheets
- Component editor with SVG shapes, DRC, constraint solver, AI-powered generation/modification
- SPICE simulation with browser-side MNA solver and server-side ngspice fallback
- 12+ export generators (Gerber, KiCad, Eagle, SPICE, BOM CSV, pick-and-place, drill files, PDF, design report)
- Breadboard view with grid model and AI-assisted wiring
- Validation system with DRC engine, DFM check, power budget analysis

**Partial/Stub Features:**

- PCB layout (component placement exists but CCN=135 blocks development)
- PCB auto-router (AI tool registered but no routing engine)
- All procurement data (pricing, stock, lead times) is AI-simulated with zero real supplier APIs
- Local AI mode parser (CCN=102) is unmaintainable
- Undo/redo is fragmented per-view with no unified stack

**Missing Features:**

- Real-time collaboration (no WebSocket/CRDT infrastructure)
- Multi-project support (PROJECT_ID=1 hardcoded)
- ECAD file import (KiCad, Eagle, Altium -- export only)
- 3D board viewer
- Standard component/symbol library (74xx, passives, connectors)
- PWA/offline support, i18n

### God File Map

12 files exceed 1,000 lines, indicating monolithic components that resist safe modification:

| File | LOC | Risk |
| ------ | ----- | ------ |
| `server/circuit-routes.ts` | 1,757 | HIGH -- 46 circuit REST endpoints |
| `server/ai-tools.ts` | 1,677 | HIGH -- all 78 AI tool definitions |
| `WaveformViewer.tsx` | 1,453 | MEDIUM -- specialized, low churn |
| `server/routes.ts` | 1,329 | HIGH -- most-changed server file |
| `useActionExecutor.ts` | 1,299 | HIGH -- 48+ action type handlers |
| `ShapeCanvas.tsx` | 1,275 | CRITICAL -- CCN=381 aggregate |
| `kicad-exporter.ts` | 1,247 | MEDIUM -- specialized export |
| `export-generators.ts` | 1,209 | HIGH -- legacy monolith still imported |
| `eagle-exporter.ts` | 1,150 | MEDIUM -- specialized export |
| `gerber-generator.ts` | 1,085 | MEDIUM -- specialized export |
| `server/ai.ts` | 1,083 | HIGH -- O(n) prompt scaling |
| `server/storage.ts` | 1,062 | MEDIUM -- stable but large |

### Dual Export System

A critical architectural finding: the export system exists as **two parallel implementations** with active overlap. The legacy monolith (`export-generators.ts`, 1,209 LOC) is imported by `ai-tools.ts` for AI tool execution. The modular system (`server/export/`, 11 files, ~3,200 LOC) is imported by `circuit-routes.ts` for REST endpoints. Seven generators overlap between both systems with different function signatures. Both are active -- the monolith is NOT dead code.

### Data Flow

```
User Interaction → React Components → React Contexts (8 domains)
    → TanStack React Query → apiRequest() → Express 5 Server
    → routes.ts (69 endpoints) / circuit-routes.ts (46 endpoints)
    → storage.ts (PostgreSQL/Drizzle) / ai.ts (Anthropic/Gemini)
    → Response → Query Invalidation → UI Re-render
```

AI Chat Flow: User message → SSE stream → system prompt with full project state → model selection via routeToModel → multi-turn tool loop (up to 10 turns) → streamed events (text, tool calls, results) → client action executor → context updates → user confirmation for destructive actions.

---

## Phase 2: Competitive Gap Analysis

### Competitors Analyzed

KiCad, Altium Designer, EasyEDA, Fritzing, Eagle/Fusion Electronics, OrCAD, Flux.ai

### Market Positioning

| Segment | Leader | ProtoPulse Position |
| --------- | -------- | ------------------- |
| Enterprise / high-reliability | Altium, OrCAD | Not competitive (missing PCB, signal integrity) |
| Professional / mid-market | KiCad, Altium | Not competitive yet (missing PCB, 3D viewer) |
| Browser-based / cloud | EasyEDA, Flux.ai | Competitive on AI; weak on PCB and import |
| Education / maker | Fritzing, KiCad | Strong potential (breadboard + AI + free) |
| AI-assisted design | Flux.ai | Direct competitor; stronger on AI breadth, weaker on PCB maturity |
| Architecture-first design | **Nobody** | **Uncontested leader** |

### Competitive Advantages

| Advantage | Moat Durability |
| ----------- | ----------------- |
| 78-action AI chat with native tool use (6x Flux.ai) | High |
| Architecture-first design workflow (unique) | High |
| Multi-model AI routing (5 strategies, Claude + Gemini) | Medium |
| Supplier-specific BOM export (4 formats) | Medium (undermined by simulated data) |
| AI action audit log (compliance/traceability) | Medium |
| Breadboard view + schematic + PCB (only Fritzing otherwise) | Medium |
| Self-hosted/free vs Flux.ai $20-$158/month | High (pricing moat) |

### Flux.ai -- Primary Competitive Threat

Flux.ai occupies the exact same niche (browser-based + AI-first). Key comparisons:

- **AI breadth**: ProtoPulse 78 actions vs Flux.ai ~12 capabilities -- ProtoPulse leads 6x
- **PCB maturity**: Flux.ai has full routing + DRC; ProtoPulse has a stub -- Flux.ai leads
- **Component library**: Flux.ai 750K+ parts vs ProtoPulse user-created only -- Flux.ai leads
- **Collaboration**: Flux.ai 20 editors real-time vs single-user -- Flux.ai leads
- **Design import**: Flux.ai KiCad/Altium/Cadence vs FZPZ only -- Flux.ai leads
- **Pricing data**: Flux.ai live APIs vs AI-simulated -- Flux.ai leads
- **Architecture diagrams**: ProtoPulse first-class canvas vs Flux.ai Mermaid docs -- ProtoPulse leads
- **Simulation**: ProtoPulse MNA + ngspice vs Flux.ai minimal -- ProtoPulse leads
- **Price**: ProtoPulse free/self-hosted vs Flux.ai $20-$158/month -- ProtoPulse leads

**Strategic assessment:** Flux.ai is a complete EDA tool that also has AI. ProtoPulse is an AI-first tool that lacks essential EDA features. If ProtoPulse only improves AI while neglecting core EDA, Flux.ai will eventually match the AI capabilities while already having the EDA foundation.

### Top 10 Missing Features

| Rank | Feature | Impact | Blocked By |
|------|---------|--------|------------|
| 1 | Production-quality PCB layout | Critical | TD-01 (CCN=135) |
| 2 | 3D board viewer | High | None |
| 3 | Autorouter / interactive router | High | FG-01 |
| 4 | Design import (KiCad/Altium/Eagle) | Critical | None |
| 5 | Real supplier APIs for BOM | Critical | None |
| 6 | Multi-project support | High | None |
| 7 | Real-time collaboration | High | TD-02 + TD-03 + TD-07 |
| 8 | One-click PCB ordering | Medium-High | FG-01 |
| 9 | ODB++/IPC-2581 export | Medium-High | TD-10 |
| 10 | Component library 10K+ parts | High | TD-09 |

---

## Phase 3: UX & Workflow Evaluation

### Personas Evaluated

1. **Hobbyist Maker** -- Weekend builder, Arduino/RPi projects, familiar with Fritzing/Tinkercad
2. **Professional Electrical Engineer** -- KiCad/Altium daily user, keyboard-driven, high precision standards
3. **Hardware Startup Founder** -- Small team manager, needs cost tracking, procurement, collaboration

### Accessibility Scorecard: C+

| Metric | Count | Assessment |
|--------|-------|------------|
| aria-* attributes | 120 across 41 files | Moderate (mostly from shadcn/ui) |
| role= attributes | 35 across 20 files | Low |
| tabIndex usage | 13 across 10 files | Very low |
| Keyboard shortcut handlers | 62 across 23 files | Good |
| data-testid coverage | 587 across 67 files | Excellent |
| `<form>` elements | **0** | Zero -- all input is imperative |
| `<label>` associations | 43 across 12 files | Low |
| Skip links | 2 | Present |

### Cross-Persona Critical Issues

1. **No onboarding/welcome flow** -- every persona lands on a pre-existing project (PROJECT_ID=1) with no introduction, no project creation, no tutorial. The `start_tutorial` AI action is registered but unimplemented.
2. **Hardcoded single-project** -- no project list, no project creation UI, invalid IDs redirect to `/projects/1`
3. **No collaboration** -- auth exists server-side but no user-facing login UI, no sharing, no commenting
4. **Manufacturing exports only via AI chat** -- all 12 export formats require typing AI commands; no export panel/button. This is compounded by the dual export backend.
5. **Zero `<form>` elements** -- no native form validation, no browser autofill, no assistive technology form mode. `@hookform/resolvers` is installed but unused; `cmdk` is also installed but unused.
6. **API key management is fragile** -- stored in React component state, lost on refresh, not persisted

### Orphaned Features

Features that exist in code but have no user-facing path:

| Feature | Where It Exists | What's Missing |
|---------|----------------|----------------|
| FZPZ import | Server-side endpoint | No file picker or import button |
| Clipboard operations | `copy_architecture_json` AI tools | No native Ctrl+C/V |
| Tutorial system | `start_tutorial` action registered | Handler unimplemented |
| 12 export generators | Server-side only | Only accessible via AI chat |

### Performance-Caused Friction

Several UX friction points are symptoms of architectural problems documented in Phase 4:

| UX Symptom | Root Cause | Debt Ref |
|------------|-----------|----------|
| Tab switching feels sluggish | ProjectProvider monolith triggers full re-render | TD-07 |
| AI actions cause visible jank | Same re-render storm | TD-07 |
| PCB has no DRC feedback | PCBLayoutView CCN=135 blocks features | TD-01 |
| Local mode is confusing | parseLocalIntent CCN=102 | TD-05 |
| AI actions fail silently | useActionExecutor 1,299-line monolith | TD-06 |

---

## Phase 4: Technical Debt & Architecture

### Complexity Hotspots -- Critical (CCN > 50)

| Rank | Function | File | CCN | NLOC |
|------|----------|------|-----|------|
| 1 | (anonymous) | PCBLayoutView.tsx:156 | **135** | 389 |
| 2 | (anonymous) | ShapeCanvas.tsx:927 | **107** | 209 |
| 3 | parseLocalIntent | parseLocalIntent.ts:54 | **102** | 208 |
| 4 | (anonymous) | ShapeCanvas.tsx:765 | **67** | 54 |
| 5 | (anonymous) | component-ai.ts | **56** | -- |
| 6 | (anonymous) | ShapeCanvas.tsx:688 | **55** | 76 |
| 7 | renderAssetCard | AssetGrid.tsx:116 | **51** | 267 |

ShapeCanvas.tsx contains **6 separate functions with CCN > 20**, accumulating to **CCN 381 aggregate** -- the highest complexity of any file in the codebase.

### Code Smell Summary

| Smell | Count | Severity |
|-------|-------|----------|
| `any` type usage | 74 | Medium |
| `as any` assertions | 19 | High |
| `@ts-ignore` / `@ts-expect-error` | 0 | Clean |
| `console.log/warn/error` | 17 | Low |
| `TODO/FIXME/HACK/XXX` | 1 | Clean |

### Security Findings

| Finding | Count | Severity |
|---------|-------|----------|
| `eval()` usage | 0 | Clean |
| `dangerouslySetInnerHTML` | 1 | Medium -- audit required |
| `.innerHTML` assignment | 1 | Medium -- audit required |
| `http://` URLs | 8 | Low -- likely dev URLs |
| Hardcoded secrets | 0 | Clean |

**Overall Security Posture: GOOD** -- No critical vulnerabilities. Auth uses scrypt + AES-256-GCM.

### Test Health

| Metric | Value | Assessment |
|--------|-------|------------|
| Source files | 213 | -- |
| Test files | 75 | -- |
| Test:Source ratio | 35.2% | Below 80% industry standard |
| E2E tests | **0** | Missing -- critical flows untested |
| Skipped tests | 6 | Low |

### Dependency Health

- **96 total** (74 production + 22 dev)
- **8 possibly unused**: `@hookform/resolvers` (zero forms), `framer-motion` (only Suspense fades), dual animation packages (`tailwindcss-animate` + `tw-animate-css`), `@google/generative-ai` (may be dynamic import)
- **3 major outdated**: `@hookform/resolvers` 3->5, `drizzle-orm` 0.39->0.45, `date-fns` 3->4

### Architecture Gaps

1. **Monolithic ProjectProvider** -- 40+ state values in one context; ANY state change triggers re-renders in ALL consumers. Partially refactored into 8 contexts, but `architecture-context` alone has 27+ values with 6 useState hooks. The re-render problem was distributed, not eliminated.

2. **AI Prompt O(n) Scaling** -- Full project state rebuilt on every AI request. A 100-node project sends ~50KB context per request, causing linear token cost scaling and potential silent truncation on large projects.

3. **PROJECT_ID=1** -- Single most referenced debt item across all 5 phases. Blocks multi-project, collaboration, auth, data isolation, production deployment.

4. **No Database Migrations** -- Using `db:push` (destructive schema sync). First production schema change will be catastrophic.

5. **Dual Export System** -- Legacy monolith and new modules both active. Bug fixes need to be applied to both. Developer confusion about which is canonical.

### Ticking Time Bombs

1. **PCBLayoutView CCN=135** -- 9x danger threshold. Statistically certain to contain undetected bugs. Blocks all PCB feature work.
2. **PROJECT_ID=1** -- Cannot launch to production.
3. **No DB migrations** -- First production schema change will lose data.
4. **useActionExecutor monolith** -- 53 action types in 1,299 lines; merge conflicts near-certain in multi-developer environment.
5. **AI prompt scaling** -- Will hit token limits on real engineering projects, causing silent quality degradation.

---

## Phase 5: Feature Innovation

### Strategic Context

The $15.89B EDA market is growing at 9% CAGR toward $34.71B by 2035. Browser-based EDA is proven viable (Flux.ai, EasyEDA). AI-assisted circuit design is entering its second wave. ProtoPulse has the foundation to capitalize -- but several high-impact innovations are blocked by architectural prerequisites.

### Zero-Cost Quick Wins (No prerequisites, immediate value)

| Innovation | Cost | Impact |
|------------|------|--------|
| **cmdk Command Palette** -- already installed, 0 forms exist, this IS the input paradigm | 1-2 days | Critical -- fills the missing input mechanism |
| **Anthropic Extended Thinking** -- 1-2 lines in ai.ts | Hours | High -- dramatic quality for complex circuits |
| **DRC Rule Templates** per manufacturer (JLCPCB, PCBWay) | 1-2 days | Medium -- prevents DFM surprises |
| **BOM Cross-Highlighting** -- click BOM item, highlight on canvas | 1-2 days | Medium -- addresses existing TODO |

### Top Innovation Proposals

| Rank | Innovation | Priority | Prerequisites | Effort |
|------|-----------|----------|---------------|--------|
| 1 | **AI Design Agent** -- natural language to complete circuit | P0 | TD-06 (action executor split) | XL |
| 2 | **Real-Time Collaboration** (Yjs CRDTs) | P1 (demoted from P0) | TD-02 + TD-03 + TD-07 | XL |
| 3 | **WASM SPICE Simulation** (ngspice in browser) | P1 | TD-24 (code splitting) | M |
| 4 | **Intelligent Component Suggestions** | P1 | TD-09 (split ai-tools) | M |
| 5 | **One-Click PCB Ordering** (JLCPCB API) | P1 | None | L |
| 6 | **Visual Diff / Version History** | P1 | TD-03 (migrations) | M |
| 7 | **Multi-Model AI Routing** (design-phase aware) | P1 | TD-11 (prompt optimization) | L |
| 8 | **Command Palette** (cmdk already installed) | P0 | None | S |

### Implementation Bundles (Innovation + Prerequisites)

| Bundle | Prerequisites | Innovation | Why Together |
|--------|-------------|------------|-------------|
| **PCB Unblock** | TD-01 (refactor PCBLayoutView) | FG-01 + EN-09 + UI-11 | Clean code before features |
| **Multi-Project** | TD-02 + FG-02 + UI-02 | UI-08 | Full multi-project experience |
| **Action System** | TD-06 -> TD-09 | IN-01 + IN-04 | Composable actions for AI agent |
| **AI Optimization** | TD-11 + EN-17 | IN-07 | Prompt optimization enables routing |
| **Export Cleanup** | TD-10 | UI-06 + FG-07/08/09 | Unified backend, then UI |
| **Schema Safety** | TD-03 | IN-06 | Migrations enable version history |
| **Component Library** | TD-09 | FG-05 + IN-04 | Split tools, then scale them |
| **Collaboration** | TD-02 + TD-03 + TD-07 | IN-02 | Foundation before CRDTs |

### Integration Opportunities (Unused Installed Dependencies)

| Package | Status | Recommendation |
|---------|--------|---------------|
| `cmdk` | Installed, zero usage | Activate immediately (P0) |
| `framer-motion` | Installed, only Suspense fades | Commit fully or remove (37KB gzipped) |
| `@hookform/resolvers` | Installed, zero forms | Remove |
| `@dnd-kit` | Installed, minimal usage | Expand to component drag-drop from sidebar |

---

## Cross-Phase Analysis

### Impact Chains

**Chain 1: PCB Complexity -> Feature Paralysis -> Competitive Gap**

```
PCBLayoutView CCN=135 (TD-01)
  -> Developers cannot safely modify PCB code
  -> PCB auto-router stays as stub (FG-01 blocked)
  -> Manual trace routing stays AI-only
  -> Users can't do basic PCB design
  -> ProtoPulse rated "Missing" for PCB vs every competitor
  -> Professional engineers reject the tool
```

**Chain 2: PROJECT_ID=1 -> Single-User -> No Business Model**

```
PROJECT_ID=1 hardcoded (TD-02)
  -> No multi-project support (FG-02 blocked)
  -> No user isolation (security risk)
  -> No collaboration possible (FG-06 blocked, IN-02 blocked)
  -> Cannot onboard multiple users
  -> No viable business model
```

**Chain 3: Monolithic Context -> Re-render Storm -> UI Jank**

```
ProjectProvider has 40+ state values (TD-07)
  -> Any state change triggers all consumers to re-render
  -> AI actions cause visible UI freeze
  -> Tab switching feels sluggish
  -> Users perceive the app as slow
```

**Chain 4: No Migrations -> Schema Fragility -> Feature Velocity**

```
db:push instead of migrations (TD-03)
  -> Schema changes are destructive and one-way
  -> Developers fear changing the schema
  -> Version history (IN-06) impossible without schema versioning
  -> Cannot safely deploy to production with real user data
```

**Chain 5: AI Prompt O(n) -> Token Cost Explosion -> Model Routing Impossible**

```
Full project state in every AI request (TD-11)
  -> Token cost scales linearly with project size
  -> Large projects hit token limits, causing silent truncation
  -> Multi-model routing (IN-07) wastes tokens on every model
  -> Cannot use cheaper models for simple tasks
```

### Risk Heatmap

| Module | Complexity | Change Freq (90d) | User Exposure | Risk |
|--------|-----------|-------------------|---------------|------|
| PCBLayoutView | **EXTREME (135)** | Low (0) | All personas | **CRITICAL** |
| ShapeCanvas | **EXTREME (381 agg)** | High (11) | Comp editor users | **CRITICAL** |
| routes.ts | High (1,329 lines) | **Very High (31)** | All personas | **HIGH** |
| ChatPanel.tsx | Medium | **Very High (28)** | All personas | **HIGH** |
| project-context.tsx | High (40+ values) | **High (22)** | All personas | **HIGH** |
| parseLocalIntent | **EXTREME (102)** | Low | AI users | HIGH |
| useActionExecutor | High (1,299 lines) | Medium | AI users | HIGH |
| storage.ts | Medium (1,062 lines) | Medium (15) | All (data layer) | MEDIUM |
| schema.ts | Low | Medium (14) | All (data model) | **MEDIUM-HIGH** (no migrations) |
| ai-tools.ts | High (1,677 lines) | Low | AI users | MEDIUM |

### Priority Recalibrations

**Promotions (cross-phase evidence):**

| Item | Original | New | Reason |
|------|----------|-----|--------|
| FG-22 (design import) | P2 | **P1** | Phase 3: "Critical dead-end" for professional engineers |
| FG-23 (real supplier APIs) | P2 | **P1** | Phase 1: ALL procurement data is AI-fabricated |
| TD-01 (PCBLayoutView) | -- | **P0** | CCN=135 blocks ALL PCB work (Chain 1) |
| TD-04 (ShapeCanvas) | -- | **P0** | CCN=381 aggregate, 6 functions >CCN 20 |
| INT-01/IN-12 (command palette) | P1 | **P0** | 0 forms + cmdk already installed = missing input paradigm |

**Demotions (cross-phase evidence):**

| Item | Original | New | Reason |
|------|----------|-----|--------|
| IN-02 (real-time collab) | P0 | **P1** | Blocked by TD-02, TD-03, TD-07 -- three XL prerequisites |
| IN-13 (offline PWA) | P2 | **P3** | XL effort, no user demand signal |

### Recurring Themes (3+ phases agree)

| Theme | Phases |
|-------|--------|
| PROJECT_ID=1 must die | All 5 |
| Collaboration is table-stakes | 1, 2, 3, 4, 5 |
| Component library too thin | 1, 2, 3, 4 |
| Export UX is scattered | 1, 2, 3, 4, 5 |
| AI is the moat -- lean in | All 5 |
| Onboarding doesn't exist | 1, 2, 3, 5 |
| PCB is the weakest domain | 1, 2, 3, 4, 5 |
| No real supplier data | 1, 2, 3, 5 |
| Testing coverage thin | 1, 4 |
| God files resist change | 1, 4 |

### Bundled Work (implement together)

| Bundle | Items | Why Together |
|--------|-------|-------------|
| **PCB Unblock** | TD-01 -> FG-01 + EN-09 + UI-11 | Refactor, then add features to clean code |
| **Multi-Project** | TD-02 + FG-02 + UI-02 + UI-08 | Remove hardcoded ID + add project routing + auth UI |
| **Export Cleanup** | TD-10 -> UI-06 + FG-07/08/09 | Complete decomposition, then build export UI |
| **AI Optimization** | TD-11 + EN-17 + EN-19 -> IN-07 | Optimize prompt, then enable model routing |
| **Action System** | TD-06 -> TD-09 -> IN-01 | Split executor, split registry, build AI agent |
| **Schema Safety** | TD-03 -> IN-06 | Add migrations, then build version history |
| **Component Library** | TD-09 -> FG-05 + UI-05 + IN-04 | Split tool file, add library, add suggestions |

---

## Appendix A: Methodology

5-phase product analysis using quantitative CLI tooling (`scc`, `lizard`, `ast-grep`, `rg`, `fd`) combined with competitive research (`WebSearch`) and structural code analysis. Analysis performed by specialized agents (inventory, competitive, UX, tech-debt, innovation) with 6 rounds of cross-phase refinement and final synthesis.

**Phases:**

1. Current State Inventory -- codebase feature audit with maturity ratings
2. Competitive Gap Analysis -- 7 competitors evaluated across 80+ feature dimensions
3. UX & Workflow Evaluation -- 3 persona-driven workflow traces with accessibility scoring
4. Technical Debt & Architecture -- lizard/scc/security scans with complexity hotspot analysis
5. Feature Innovation -- 16 innovations + 4 moonshots + 8 integration opportunities, with prerequisite chains

---

## Appendix B: Directory Structure

```
client/src/
  pages/ProjectWorkspace.tsx       -> 3-panel layout, lazy views, ErrorBoundary per view
  components/views/                -> Architecture, ComponentEditor, Procurement, Validation, Output, Schematic
  components/panels/ChatPanel.tsx  -> AI chat + settings
  components/layout/Sidebar.tsx    -> Nav, component library, history
  components/circuit-editor/       -> Schematic canvas, net drawing, ERC, PCB, breadboard
  components/simulation/           -> Simulation panel, waveform viewer, probe overlay
  components/ui/                   -> 40+ shadcn/ui primitives
  lib/project-context.tsx          -> ProjectProvider (monolithic context, known debt)
  lib/contexts/                    -> 8 domain contexts (architecture, bom, chat, etc.)

server/
  routes.ts           -> /api/* endpoints, Zod validation, asyncHandler wrapper
  circuit-routes.ts   -> Circuit-specific REST endpoints
  ai.ts               -> Anthropic + Gemini streaming, system prompt builder, action parser
  ai-tools.ts         -> 78 AI tool definitions with Zod schemas
  storage.ts          -> IStorage interface, DatabaseStorage with in-memory cache
  auth.ts             -> Session-based auth, encrypted API keys
  export/             -> Modular export generators (11 files)
  export-generators.ts -> Legacy monolith (still active)

shared/
  schema.ts           -> Drizzle schema: 17 tables + Zod insert schemas
  component-types.ts  -> Component editor type system
  drc-engine.ts       -> Shared DRC engine
```

---

## Appendix C: Tool Outputs

### SCC Output (Full Codebase)

```
Language                 Files     Lines   Blanks  Comments     Code Complexity
TypeScript                 249     68563     7006      4461    57096       9667
CSS                          1       185       16         0      169          0
Total                      250     68748     7022      4461    57265       9667
Estimated Cost to Develop (organic) $1,893,995
Estimated Schedule Effort (organic) 17.53 months
Estimated People Required (organic) 9.60
Processed 2445824 bytes, 2.446 megabytes (SI)
```

### Lizard -- Server/Shared Top Complexity Warnings

```
server/component-ai.ts: anonymous CCN=56
server/export/gerber-generator.ts: resolvePad CCN=39
server/drc-gate.ts: runDrcGate CCN=39
server/svg-parser.ts: getAttr CCN=35
server/export-generators.ts: generateGerber CCN=34
```

### Lizard -- Client Components Top Complexity Warnings

```
PCBLayoutView.tsx:156: anonymous -- 389 NLOC, 135 CCN
ShapeCanvas.tsx:927: anonymous -- 209 NLOC, 107 CCN
parseLocalIntent.ts:54: parseLocalIntent -- 208 NLOC, 102 CCN
ShapeCanvas.tsx:765: anonymous -- 54 NLOC, 67 CCN
ShapeCanvas.tsx:688: anonymous -- 76 NLOC, 55 CCN
AssetGrid.tsx:116: renderAssetCard -- 267 NLOC, 51 CCN
ShapeCanvas.tsx:858: anonymous -- 61 NLOC, 49 CCN
ValidationView.tsx:351: anonymous -- 157 NLOC, 47 CCN
BreadboardView.tsx:372: anonymous -- 147 NLOC, 45 CCN
ShapeCanvas.tsx:603: anonymous -- 80 NLOC, 45 CCN
```

### SCC -- God Files (>1000 lines)

```
1757 server/circuit-routes.ts
1677 server/ai-tools.ts
1453 client/src/components/simulation/WaveformViewer.tsx
1329 server/routes.ts
1299 client/src/components/panels/chat/hooks/useActionExecutor.ts
1275 client/src/components/views/component-editor/ShapeCanvas.tsx
1247 server/export/kicad-exporter.ts
1209 server/export-generators.ts
1150 server/export/eagle-exporter.ts
1085 server/export/gerber-generator.ts
1083 server/ai.ts
1062 server/storage.ts
```

### Code Smell Counts

```
'any' type usage:        74
'as any' assertions:     19
@ts-ignore:              0
console.log/warn/error:  17
TODO/FIXME/HACK/XXX:     1
```

### Security Scan

```
eval():                  0
dangerouslySetInnerHTML: 1
innerHTML:               1
http:// URLs:            8
Hardcoded secrets:       0
```

### Test Health

```
Source files: 213
Test files:  75
Ratio:       35.2%
Skipped:     6
E2E tests:   0
```

### Dependencies

```
Production:    74
Development:   22
Total:         96
Possibly unused: 8
```

## [2026-02-28T21:03:08Z] Gap Analysis Expansion -- Batch 1

### Executive Summary Delta

- This append adds six high-confidence gaps that are not explicitly captured in the existing report/checklist with this level of implementation detail.
- The highest-risk cluster is authorization and data isolation, not just UI routing defaults.
- The most urgent mitigation is to add project ownership + authorization checks before collaboration or production-scale rollout.

### Categorized Findings (Batch 1)

| ID | Label | Type | Severity | Impact | Recommendation | Evidence |
|---|---|---|---|---|---|---|
| GA-SEC-01 | Missing project ownership and per-project authorization boundary | NEW | Critical | Any authenticated user can enumerate and access/modify projects by numeric ID once auth is enabled; no tenant boundary exists in data model or route checks | Add `projects.userId` (or org/workspace ownership), enforce ownership checks on all `/api/projects/:id*` routes, and add policy tests | `shared/schema.ts` (`projects` has no `userId`), `server/routes.ts` project CRUD routes (no ownership checks) |
| GA-SEC-02 | Destructive admin purge endpoint lacks authorization guard | NEW | Critical | `DELETE /api/admin/purge` can permanently delete soft-deleted records without role checks; this is a high blast-radius endpoint | Require admin-only authorization middleware + audit event + explicit dry-run mode | `server/routes.ts:1313` |
| GA-SEC-03 | Response-body logging can leak sensitive payloads | NEW | High | API logger captures and logs JSON response bodies (up to 500 chars), including auth/session responses and potentially sensitive AI/settings payloads | Redact sensitive keys and disable response-body logging by default in production | `server/index.ts` response capture/logger middleware, auth responses in `server/routes.ts` |
| GA-DATA-01 | Delete lifecycle is inconsistent across domains | NEW | High | Projects/nodes/edges/BOM are soft-deleted, while validation/chat/history/circuit entities are hard-deleted, creating uneven recovery/compliance behavior | Define global deletion policy matrix (soft vs hard by entity), align schemas + storage methods, and document retention guarantees | `server/storage.ts` delete methods (`db.update ... deletedAt` mixed with `db.delete`) |
| GA-REL-01 | Bulk replace operations hard-delete and recreate graph rows | NEW | Medium | `replaceNodes`/`replaceEdges` delete all rows then reinsert, causing ID churn, event-history discontinuity, and weak auditability | Move to diff/patch upsert strategy to preserve stable IDs and change provenance | `server/storage.ts:456` and `server/storage.ts:470` |
| GA-OPS-01 | Metrics implementation is non-durable and unbounded by route cardinality | NEW | Medium | In-memory route metrics reset on restart and can grow with high-cardinality paths; no long-term SLI/SLO basis | Aggregate by route template + export to durable metrics backend; add sampling/retention controls | `server/metrics.ts`, `server/index.ts` metrics endpoint |

### Progress Log

- Timestamp: 2026-02-28T21:03:08Z
- Status: Batch 1 appended to report.
- Coverage: Security, authorization, data lifecycle, reliability, ops observability.
- Next: Append batch 2 (workflow/auth transport, scalability protections, testing/quality, correction/refinement notes, phased roadmap delta).

## [2026-02-28T21:03:54Z] Gap Analysis Expansion -- Batch 2

### Categorized Findings (Batch 2)

| ID | Label | Type | Severity | Impact | Recommendation | Evidence |
|---|---|---|---|---|---|---|
| GA-WF-01 | Frontend auth transport does not send `X-Session-Id` header | EXPANDED | High | Backend expects header-based auth, but client `apiRequest()` only sends content type; protected endpoints fail in production-like flow and behavior diverges between dev/prod | Add session store + automatic header injection in all API calls; fail fast when session is missing for protected routes | `client/src/lib/queryClient.ts`, `server/index.ts` auth middleware |
| GA-WF-02 | Hardcoded `/projects/1` routing remains in shell and invalid-id fallback | EXPANDED | High | Multi-project backend exists, but entry flow still funnels users to project 1, reducing discoverability and preserving single-project UX assumptions | Replace root redirect with project picker / last-opened project strategy; invalid IDs route to project list, not hardcoded ID | `client/src/App.tsx`, `client/src/pages/ProjectWorkspace.tsx` |
| GA-SEC-04 | Development-mode auth bypass allows unauthenticated access across most API routes | NEW | High | `if (isDev) return next()` bypasses auth checks, masking authorization defects until deployment and increasing accidental local exposure risk | Gate bypass behind explicit env flag, default to strict auth even in dev, add integration tests for both modes | `server/index.ts` auth middleware |
| GA-SEC-05 | Public API docs/metrics endpoints aid reconnaissance | NEW | Medium | Route inventory and per-route metrics are exposed without auth by default path allow-list | Restrict to authenticated/admin users or internal networks; add runtime config toggle | `server/index.ts` `PUBLIC_PATHS`, `/api/docs`, `/api/metrics` |
| GA-REL-02 | Streaming AI endpoint is excluded from rate limiting and origin checks | NEW | High | `/api/chat/ai/stream` skips abuse protections, increasing DoS and cost-amplification risk under repeated long-lived streams | Add stream-specific rate limits/concurrency limits + origin checks + global budget controls | `server/index.ts` rate-limit and CSRF/origin middleware skips |
| GA-TEST-01 | Security-critical route policies are under-tested (authZ, destructive admin, abuse controls) | NEW | Medium | Current API tests cover happy-path CRUD/auth but not cross-user authorization boundaries or admin-only destructive operations | Add security regression suite for cross-user access, purge authorization, stream abuse/rate-limit behavior | `server/__tests__/api.test.ts`, route/middleware coverage gaps |
| GA-OPS-02 | Health surface lacks readiness/degraded dependency signaling | NEW | Medium | `/api/health` is binary DB connectivity only; no readiness endpoint to communicate dependency degradation states for orchestration | Add `/api/ready` and structured dependency status (db, ai providers, queue), with clear failure policy | `server/index.ts` health endpoint |

### Correction/Refinement Note

- Existing framing emphasizes `PROJECT_ID=1` as the primary multi-project blocker.
- Refinement: the deeper production blocker is missing ownership authorization boundaries (`projects` has no owner field and project routes do not enforce owner checks). Even after removing hardcoded redirects, tenant isolation remains unresolved.

### Phased Roadmap Delta (Near/Mid/Long)

| Phase | Timeframe | Focus | Included Items |
|---|---|---|---|
| Near-Term | 0-30 days | Security guardrails and auth correctness | GA-SEC-01, GA-SEC-02, GA-WF-01, GA-SEC-04, GA-REL-02 |
| Mid-Term | 31-60 days | Data lifecycle and observability hardening | GA-DATA-01, GA-REL-01, GA-OPS-01, GA-SEC-05, GA-OPS-02 |
| Long-Term | 61-120 days | Policy-driven platform quality and confidence | GA-WF-02, GA-TEST-01 plus full authZ regression suite and operational SLO adoption |

### Progress Log

- Timestamp: 2026-02-28T21:03:54Z
- Status: Batch 2 appended to report.
- Coverage: Workflow/auth, security, resilience, testing, and roadmap deltas.
- Next: Append batch 2 checklist tasks and final exhaustive closure notes.

## [2026-02-28T21:05:29Z] Gap Analysis Expansion -- Batch 3 (Exhaustive Closure)

### Categorized Findings (Batch 3)

| ID | Label | Type | Severity | Impact | Recommendation | Evidence |
|---|---|---|---|---|---|---|
| GA-QUAL-02 | Default test command omits Node integration suite | NEW | High | `npm test` runs Vitest only; `server/__tests__/api.test.ts` (Node test runner) is excluded from default test workflow, reducing regression detection on auth/API behavior | Unify on one runner or add explicit script/CI step for Node integration tests; enforce in PR checks | `package.json` scripts, `server/__tests__/api.test.ts` |
| GA-ARCH-02 | No optimistic concurrency control for most mutable resources | NEW | High | Concurrent updates can silently overwrite data because update predicates rely on IDs without version/etag preconditions (except component parts versioning) | Add ETag/version preconditions (If-Match or row version columns) across project/node/edge/BOM update endpoints | `server/storage.ts` update methods, version usage limited to `componentParts` |
| GA-OPS-03 | No operational backup/restore runbook or automation footprint | NEW | Medium | Repository shows no DB backup/restore scripts or documented RPO/RTO process, increasing recovery risk after operator or infrastructure incidents | Add automated backup workflow (`pg_dump`/managed snapshots), restore validation drill, and runbook in docs | No backup/restore artifacts in scripts/docs scan; absence across `docs` + `script` + server tree |
| GA-ARCH-03 | Long-running workload execution is request-bound with no background job control plane | NEW | Medium | Heavy exports/AI flows execute in request lifecycle; no queue/worker architecture for retries, scheduling, or controlled throughput | Introduce job queue + worker model for long-running tasks, with status polling and cancellation | `package.json` (no queue worker dependencies), route-driven synchronous processing patterns |
| GA-SEC-06 | Encryption key fallback behavior risks non-durable secure configuration in dev workflows | NEW | Medium | Missing `API_KEY_ENCRYPTION_KEY` in non-production generates random key each restart; this can hide key-management defects and invalidate stored keys unexpectedly | Require explicit key in all environments except isolated local sandbox mode; emit hard warning/fail in shared dev | `server/auth.ts` encryption key fallback logic |
| GA-WF-03 | Collaboration roadmap dependencies require identity + authorization layer first | EXPANDED | High | Existing collaboration roadmap items focus on CRDT/realtime but still assume unresolved identity/ownership/authorization controls | Reorder roadmap: identity/ownership/authorization before realtime collaboration transport work | Existing roadmap + GA-SEC-01 dependency chain |

### Prioritization Matrix (NEW + EXPANDED Appended Findings)

| Priority | Items | Rationale |
|---|---|---|
| P0 | GA-SEC-01, GA-SEC-02, GA-WF-01, GA-REL-02 | Highest blast radius: unauthorized data access, destructive admin path, auth transport correctness, stream abuse/cost risk |
| P1 | GA-SEC-03, GA-DATA-01, GA-WF-02, GA-SEC-04, GA-QUAL-02, GA-ARCH-02, GA-WF-03 | Material production reliability, workflow correctness, and maintainability blockers |
| P2 | GA-OPS-01, GA-SEC-05, GA-OPS-02, GA-OPS-03, GA-ARCH-03, GA-SEC-06 | Important hardening and operational maturity improvements |

### Exhaustiveness Closure

- Reviewed existing product-analysis docs to prevent duplicate statements before every append batch.
- Performed targeted evidence scans across auth, routing, storage lifecycle, observability, testing scripts, and operational artifacts.
- Added only net-new findings or deeper `EXPANDED` refinements with implementation-level detail.

### Progress Log

- Timestamp: 2026-02-28T21:05:29Z
- Status: Batch 3 appended to report; exhaustive closure complete.
- Total added in this session: 13 findings (10 NEW, 3 EXPANDED) plus 1 correction/refinement note and phased/prioritized roadmap deltas.
- Next: Append final checklist closure section mirroring Batch 3 and sequencing execution order.

## [2026-02-28T21:23:17Z] Gap Analysis Expansion -- Batch 4 (Auth/Data Integrity Hardening)

### Executive Summary Delta

- This batch focuses on security and data-integrity hardening gaps that remain after prior append cycles.
- Core issue: authentication exists, but adversarial-resilience controls and database-level integrity guarantees are still thin.
- Highest near-term risk: credential stuffing and session-token theft scenarios are insufficiently mitigated.

### Categorized Findings (Batch 4)

| ID | Label | Type | Priority | Severity | Impact | Recommendation | Evidence |
|---|---|---|---|---|---|---|---|
| GA-SEC-07 | Auth endpoints lack dedicated brute-force protections | NEW | P0 | High | `/api/auth/login` and `/api/auth/register` share a broad global limiter (300 requests / 15 min), which is not tuned for credential-stuffing defense | Add auth-specific strict limiter + temporary lockout/backoff + suspicious-attempt telemetry | `server/index.ts` global limiter, `server/routes.ts` auth routes |
| GA-SEC-08 | Password verification uses non-constant-time comparison | NEW | P1 | Medium | `verifyPassword` compares derived hash strings with `===`, which is weaker than constant-time comparison best practice | Switch to `crypto.timingSafeEqual` on raw buffers for hash comparison | `server/auth.ts` `verifyPassword` |
| GA-SEC-09 | Session tokens are stored in plaintext form | NEW | P1 | High | Active session IDs are persisted directly in DB; DB read exposure enables immediate session replay risk | Store only hashed session tokens server-side and compare hashes on lookup; rotate on auth-sensitive actions | `shared/schema.ts` sessions table (`id`), `server/auth.ts` session creation/validation |
| GA-DATA-04 | Project delete cascade is non-transactional | NEW | P1 | High | Soft delete updates project + dependent entities in separate operations; partial failures can produce inconsistent deletion state | Wrap project soft-delete cascade in a DB transaction with rollback safety and post-commit cache invalidation | `server/storage.ts` `deleteProject` |
| GA-DATA-05 | Domain constraints rely on app-layer Zod, not DB constraints | NEW | P1 | Medium | `chat_messages.role` and `validation_issues.severity` are stored as unconstrained text at DB layer, allowing invalid states via non-app writes/migrations | Convert to DB enum/check constraints and migrate safely; keep Zod as boundary validation | `shared/schema.ts` role/severity text columns |
| GA-SEC-10 | API key encryption key format/length is not validated | NEW | P2 | Medium | Encryption key is sliced and hex-decoded without explicit format validation, risking silent misconfiguration and runtime cryptographic failures | Enforce strict 64-hex-char validation at startup and fail fast on invalid key material | `server/auth.ts` `getEncryptionKey` |

### Correction/Refinement Note

- Prior report stated overall security posture as "GOOD" with no critical vulnerabilities.
- Refinement: security baseline is functional, but production-hardening controls for authentication abuse resistance, session secrecy, and DB-level integrity are still incomplete and should be treated as launch-blocking for multi-user exposure.

### Phased Roadmap Delta (Batch 4)

| Phase | Timeframe | Focus | Included Items |
|---|---|---|---|
| Near-Term | 0-21 days | Auth abuse resistance + token security | GA-SEC-07, GA-SEC-08, GA-SEC-09 |
| Mid-Term | 22-45 days | Data integrity guarantees | GA-DATA-04, GA-DATA-05 |
| Long-Term | 46-90 days | Crypto/config resilience hardening | GA-SEC-10 + automated config policy checks |

### Progress Log

- Timestamp: 2026-02-28T21:23:17Z
- Status: Batch 4 appended to report.
- Coverage: Auth abuse controls, password/session security, transactional integrity, DB constraints, crypto config validation.
- Next: Append mirrored execution checklist for Batch 4 findings.

## [2026-02-28T23:45:00Z] Gap Analysis Expansion -- Batch 5 (Database & Query Optimization)

### Executive Summary Delta

- This batch reveals database-layer performance and correctness gaps not previously captured: N+1 query patterns, missing composite indexes, race conditions in concurrent writes, referential integrity gaps, and in-memory cache design flaws.
- Highest risk: the N+1 query in `buildAppStateFromProject()` executes O(N) DB queries per circuit design on every AI request, creating linear query scaling that will degrade as projects grow.
- The cache subsystem uses FIFO eviction (Map insertion order) instead of LRU, and expired entries remain in memory until accessed — both are correctness issues under production load.

### Categorized Findings (Batch 5)

| ID | Label | Type | Priority | Severity | Impact | Recommendation | Evidence |
|---|---|---|---|---|---|---|---|
| GA-DB-01 | N+1 query pattern in `buildAppStateFromProject()` | NEW | P1 | High | Every AI chat request triggers `buildAppStateFromProject()` which queries nodes, edges, BOM, validation, chat, and history sequentially — O(N) round trips per request. For circuit-enabled projects, each circuit triggers additional instance/net/wire queries. Total: 6+ sequential queries per AI request minimum. | Refactor to parallel `Promise.all()` for independent queries; consider a materialized view or denormalized project-state snapshot for AI prompts | `server/routes.ts:117-132` (`buildAppStateFromProject`); each `storage.get*` call is a separate DB round trip |
| GA-DB-02 | Missing composite indexes on `(projectId, deletedAt)` columns | NEW | P1 | High | All soft-delete table queries filter by `projectId` + `isNull(deletedAt)`, but no composite index exists — every list query on `architecture_nodes`, `architecture_edges`, `bom_items` does a full table scan on these conditions | Add composite indexes `(projectId, deletedAt)` on all soft-delete tables; measure query plan improvements | `shared/schema.ts` table definitions; `server/storage.ts` all `where(and(eq(table.projectId, id), isNull(table.deletedAt)))` queries |
| GA-DB-03 | Race condition in `upsertChatSettings` concurrent requests | NEW | P1 | Medium | `upsertChatSettings` reads existing settings, then either inserts or updates — concurrent requests can cause duplicate inserts or lost updates | Use PostgreSQL `ON CONFLICT DO UPDATE` (upsert) instead of read-then-write pattern | `server/storage.ts` `upsertChatSettings` method |
| GA-DB-04 | Missing CASCADE on `circuitInstances.partId` foreign key | NEW | P2 | Medium | If a component part is deleted, circuit instances referencing that part become orphaned with dangling FK references; no CASCADE or SET NULL defined | Add `ON DELETE SET NULL` to `circuitInstances.partId` FK; audit all FK relationships for CASCADE policy | `shared/schema.ts` `circuitInstances` table definition |
| GA-DB-05 | In-memory cache uses FIFO eviction instead of LRU | NEW | P2 | Medium | Cache eviction deletes the oldest-inserted key (JavaScript Map insertion order = FIFO), not the least-recently-used. Frequently accessed hot data can be evicted while cold data remains | Replace FIFO eviction with LRU: update access timestamp on cache hits, evict by oldest access time | `server/cache.ts:26-32` eviction logic using `this.cache.keys().next().value` |
| GA-DB-06 | Expired cache entries remain in memory until accessed | NEW | P2 | Low | Cache TTL is only checked on `get()` — expired entries occupy memory indefinitely if never re-requested. Under high-cardinality access patterns, this is a memory leak | Add periodic sweep (e.g., every 60s) to proactively purge expired entries, or switch to a TTL-aware data structure | `server/cache.ts` `get()` method lazy expiration check |
| GA-DB-07 | Database constraint violations surface as HTTP 500 | NEW | P2 | Medium | PostgreSQL UNIQUE/FK constraint violations throw generic errors that bubble through `StorageError` to the global error handler as 500 Internal Server Error, instead of 409 Conflict or 400 Bad Request | Catch and classify PostgreSQL error codes (23505=unique, 23503=FK) in storage layer; map to appropriate HTTP status | `server/storage.ts` all try/catch blocks wrapping DB operations |

### Expanded Finding

| ID | Original | Expansion | Evidence |
|---|---|---|---|
| GA-ARCH-02 (EXPANDED) | "No optimistic concurrency control for most mutable resources" | Specific race conditions identified: (1) `updateBomItem` does read-then-write without transaction — concurrent price updates can silently lose one write; (2) `updateComponentPart` increments version via `version: existing.version + 1` outside transaction — two concurrent updates can produce the same version number, corrupting version history | `server/storage.ts` `updateBomItem` and `updateComponentPart` methods |

### Progress Log

- Timestamp: 2026-02-28T23:45:00Z
- Status: Batch 5 appended to report.
- Coverage: Database query patterns, indexing, race conditions, FK integrity, cache design, error classification.
- Findings: 7 NEW + 1 EXPANDED.
- Next: Append Batch 6 (Client Performance & React Patterns).

## [2026-02-28T23:46:00Z] Gap Analysis Expansion -- Batch 6 (Client Performance & React Patterns)

### Executive Summary Delta

- Systematic scan of all 55 React components reveals pervasive memoization gaps, re-render amplification patterns, and memory management issues.
- The most impactful finding: `React.memo` is applied to only 9 circuit-editor components out of 55 total — the remaining 46 components re-render on every parent state change without protection.
- Multiple high-frequency components (MessageBubble, ComponentTree nodes, HistoryList items) lack basic optimization, creating cumulative render waste that scales with project size.

### Categorized Findings (Batch 6)

| ID | Label | Type | Priority | Severity | Impact | Recommendation | Evidence |
|---|---|---|---|---|---|---|---|
| GA-PERF-01 | 53 inline style objects create new references every render | NEW | P1 | High | Inline `style={{...}}` creates a new object reference on every render, defeating React's shallow comparison for props. Found in 53 instances across UI components. Each instance forces a child re-render even when visual output is identical. | Extract to `const` outside component or use `useMemo`. Priority: components that render inside lists or frequent-update parents. | Grep across `client/src/components/` — 53 matches of `style={{` pattern |
| GA-PERF-02 | `ChatPanel.handleSend` has 22-item useCallback dependency array | NEW | P1 | Medium | The primary chat send handler depends on 22 values, causing it to be recreated on virtually every render cycle. This invalidates any child component that receives it as a prop. | Consolidate state into a ref-based approach or reducer pattern. Move stable values to refs. | `client/src/components/panels/ChatPanel.tsx` `handleSend` useCallback |
| GA-PERF-03 | `ComponentTree` grouping/sorting logic runs on every render | NEW | P2 | Medium | Tree node grouping, sorting, and hierarchy computation runs synchronously on every render without `useMemo`. For large component libraries (100+ items), this becomes a visible frame drop. | Wrap in `useMemo` keyed on the component data array reference. | `client/src/components/layout/sidebar/ComponentTree.tsx` |
| GA-PERF-04 | `MessageBubble` not wrapped in `React.memo` | NEW | P1 | High | Chat message bubbles are rendered in a list and re-render every time any chat state changes (new message, streaming update, typing indicator). Each bubble contains markdown rendering, which is expensive. | Add `React.memo` with shallow comparison. For streaming messages, use a separate `StreamingBubble` component. | `client/src/components/panels/chat/MessageBubble.tsx` |
| GA-PERF-05 | `HistoryList` re-renders all items every 60 seconds | NEW | P2 | Low | Timer-based relative timestamp updates (e.g., "2 minutes ago") trigger full list re-render every minute via `setInterval` state update. With 100+ history items, this creates periodic jank. | Use `requestAnimationFrame`-based approach or move timestamp formatting to individual memoized items. | `client/src/components/layout/sidebar/HistoryList.tsx` timer logic |
| GA-PERF-06 | 8 separate `useState` calls in `WorkspaceContent` | NEW | P2 | Medium | `WorkspaceContent` manages 8 independent state variables. Each `setState` call triggers a full re-render of the workspace and all child views, even when only one piece of state changed. | Consolidate into `useReducer` or split into focused sub-components that own their state. | `client/src/pages/ProjectWorkspace.tsx` `WorkspaceContent` component |
| GA-PERF-07 | Undo/redo stacks have no depth limit | NEW | P1 | Medium | Architecture undo/redo stores every state snapshot without a maximum depth. Projects with 500+ edits accumulate unbounded memory. For complex node graphs, each snapshot can be several KB. | Add configurable max depth (e.g., 100 operations). Trim oldest entries on push. Consider structural sharing instead of full snapshots. | `client/src/lib/contexts/architecture-context.tsx` undo/redo arrays |
| GA-PERF-08 | Missing `loading="lazy"` on images in chat messages | NEW | P2 | Low | Chat messages can contain images (attachments, AI-generated diagrams). Images render eagerly even when scrolled off-screen, consuming bandwidth and blocking the main thread during decode. | Add `loading="lazy"` to all `<img>` elements in `MessageBubble`. | `client/src/components/panels/chat/MessageBubble.tsx` image rendering |
| GA-PERF-09 | `key={index}` anti-pattern in multiple list renders | NEW | P2 | Medium | Several components use array index as React key (`key={i}` or `key={index}`). When items are reordered, inserted, or deleted, React misidentifies which DOM nodes to update, causing incorrect renders and lost component state. | Use stable unique identifiers (item.id, item.uuid) as keys. Audit all `.map()` calls in components. | Multiple components across `client/src/components/` |
| GA-PERF-10 | `copiedId` transient state causes full ChatPanel re-render | NEW | P2 | Low | The "copied to clipboard" feedback state (`copiedId`) is stored as ChatPanel-level state. Setting it triggers a full ChatPanel re-render (including all message bubbles) for purely cosmetic feedback. | Move to a ref + CSS class toggle, or isolate in a tiny `<CopyFeedback>` component. | `client/src/components/panels/ChatPanel.tsx` `copiedId` state |
| GA-PERF-11 | Virtualizer instance in ChatPanel not memoized | NEW | P2 | Medium | The chat virtualizer (for long message lists) is recreated on renders. Virtualizer instances maintain internal scroll state — recreation loses scroll position and causes layout thrashing. | Memoize virtualizer options with `useMemo`, ensure stable references for `estimateSize` and other callbacks. | `client/src/components/panels/ChatPanel.tsx` virtualizer setup |
| GA-PERF-12 | React.memo coverage: 9/55 components (16%) | NEW | P1 | High | Only 9 circuit-editor components use `React.memo`. The remaining 46 components (83%) have zero memoization — every parent re-render cascades through the entire tree. Combined with the monolithic `ProjectProvider` context, this creates quadratic render complexity. | Audit all components that (a) receive stable props, (b) render in lists, or (c) are children of frequently-updating parents. Apply `React.memo` + `useMemo`/`useCallback` where warranted. Target: 30+ components memoized. | `client/src/components/` — grep for `React.memo` shows only circuit-editor files |

### Progress Log

- Timestamp: 2026-02-28T23:46:00Z
- Status: Batch 6 appended to report.
- Coverage: React performance, memoization, re-render patterns, memory management, list virtualization.
- Findings: 12 NEW.
- Next: Append Batch 7 (Security Hardening).

## [2026-02-28T23:47:00Z] Gap Analysis Expansion -- Batch 7 (Security Hardening -- Transport & Input Validation)

### Executive Summary Delta

- Prior batches (1-4) addressed authorization, session tokens, and auth abuse resistance. This batch covers a distinct layer: HTTP transport security headers, input validation gaps in non-auth paths, and content injection vectors.
- Most critical finding: CORS configuration dynamically reflects `req.headers.origin` with `credentials: true`, enabling any origin to make authenticated cross-origin requests in development — a classic CSRF vector that persists if dev mode is accidentally deployed.
- AI-generated markdown content is rendered without protocol validation on href attributes, creating a reflected XSS vector through `javascript:` URIs.

### Categorized Findings (Batch 7)

| ID | Label | Type | Priority | Severity | Impact | Recommendation | Evidence |
|---|---|---|---|---|---|---|---|
| GA-SEC-11 | CORS dynamically reflects request origin with credentials enabled | NEW | P0 | Critical | In dev mode, `Access-Control-Allow-Origin` is set to `req.headers.origin` (whatever the browser sends) with `Allow-Credentials: true`. Any malicious site can make authenticated API requests on behalf of a logged-in user. Even in production, the origin-matching relies on `X-Forwarded-Host` which can be spoofed without proper proxy config. | Replace dynamic origin reflection with explicit allowlist of trusted origins. Never reflect arbitrary origin with credentials. | `server/index.ts:54-64` dev CORS middleware |
| GA-SEC-12 | AI-rendered markdown allows `javascript:` URI injection | NEW | P0 | High | ReactMarkdown renders AI responses which may contain `[click here](javascript:alert(1))`. While React prevents inline script execution in most contexts, `<a href="javascript:...">` is a known bypass vector that executes on click. The AI's system prompt doesn't filter link protocols. | Add `rehype-sanitize` plugin to ReactMarkdown with protocol allowlist (`http:`, `https:`, `mailto:` only). Alternatively, strip non-http protocols from href in a custom rehype plugin. | `client/src/components/panels/chat/MessageBubble.tsx` markdown rendering; `server/ai.ts` system prompt has no href filtering |
| GA-SEC-13 | ZIP bomb vulnerability on FZPZ component import | NEW | P1 | High | FZPZ import validates compressed file size (5MB limit) but does not check decompressed size. A 1MB ZIP could decompress to 1GB+ (zip bomb), causing OOM on the server. | Add uncompressed size limit (e.g., 50MB). Either check zip central directory for total uncompressed sizes before extraction, or stream-decompress with a byte counter that aborts on limit. | `server/routes.ts` FZPZ import endpoint; `jszip` extraction without size guards |
| GA-SEC-14 | Missing HSTS (Strict-Transport-Security) header | NEW | P1 | Medium | No `Strict-Transport-Security` header is set, allowing protocol downgrade attacks on first visit. Users accessing `http://` are not automatically redirected to `https://` and their initial request (including cookies/session) can be intercepted. | Enable via Helmet config: `helmet({ hsts: { maxAge: 63072000, includeSubDomains: true, preload: true } })`. Verify HTTPS is enforced at proxy/load balancer level. | `server/index.ts:34-49` Helmet configuration — no explicit HSTS config |
| GA-SEC-15 | Missing Referrer-Policy header | NEW | P2 | Low | Without `Referrer-Policy`, the browser's default behavior may leak full URL (including query parameters with session/project IDs) to third-party resources. | Add `Referrer-Policy: strict-origin-when-cross-origin` via Helmet. | `server/index.ts:34-49` Helmet configuration |
| GA-SEC-16 | CSP allows `'unsafe-inline'` for styles; disabled entirely in dev | NEW | P1 | Medium | Production CSP uses `styleSrc: ["'self'", "'unsafe-inline'"]` which weakens style injection protection. In development, CSP is fully disabled (`contentSecurityPolicy: false`), providing zero protection during local testing. | Replace `'unsafe-inline'` with nonce-based or hash-based style policy. At minimum, enable a report-only CSP in dev mode to catch violations early. | `server/index.ts:35-49` Helmet CSP config |
| GA-SEC-17 | SVG content parsed without sanitization | NEW | P1 | High | Component import paths accept SVG content (`text/xml`, `image/svg+xml` content types enabled). SVG can embed `<script>`, `<foreignObject>`, and event handlers (`onload`, `onclick`). No SVG sanitization library is used. | Add DOMPurify or similar SVG sanitizer before storing/rendering user-provided SVG content. Strip all script elements, event handlers, and `foreignObject`. | `server/index.ts:100` text body parser accepts SVG; component/FZPZ import paths |
| GA-SEC-18 | DRC endpoint uses type assertion without Zod validation | NEW | P2 | Medium | At least one DRC-related endpoint casts request body with `as` type assertion instead of Zod validation, bypassing the otherwise comprehensive validation layer. Malformed input could cause unexpected behavior in the DRC engine. | Replace `as` assertions with Zod schema validation consistent with all other endpoints. | `server/circuit-routes.ts` DRC endpoint handlers |
| GA-SEC-19 | scrypt password hashing cost factor not explicitly configured | NEW | P2 | Medium | `crypto.scrypt` uses Node.js defaults for cost/block-size/parallelization. The default cost (N=16384) may be too low for modern GPU attacks. No explicit cost tuning or future-proofing mechanism exists. | Explicitly set scrypt parameters: `N=32768` or higher, `r=8`, `p=1`. Add cost factor to a config constant for easy future adjustment. Document upgrade path for rehashing. | `server/auth.ts` `hashPassword` and `verifyPassword` |
| GA-SEC-20 | Express 5.0.1 is pre-release software in production | NEW | P2 | Medium | Express 5 is used at version 5.0.1, which is a pre-release version. Pre-release frameworks may have undiscovered security vulnerabilities, breaking changes, and limited community security review. | Monitor Express 5 release status. Have a rollback plan to Express 4.x if critical vulnerabilities emerge. Pin exact version and review changelogs on every update. | `package.json` express dependency |

### Progress Log

- Timestamp: 2026-02-28T23:47:00Z
- Status: Batch 7 appended to report.
- Coverage: CORS, XSS, ZIP bombs, HTTP security headers, CSP, SVG sanitization, input validation, password hashing, framework stability.
- Findings: 10 NEW.
- Next: Append Batch 8 (Error Handling & Resilience).

## [2026-02-28T23:48:00Z] Gap Analysis Expansion -- Batch 8 (Error Handling & Resilience)

### Executive Summary Delta

- No `process.on('uncaughtException')` or `process.on('unhandledRejection')` handlers exist — any unhandled async rejection crashes the entire server, disconnecting all clients with no cleanup.
- The SSE streaming client does not check `response.ok` before reading the stream body, and silently catches JSON parse errors with `catch {}` — corrupted or error responses appear as hangs to the user.
- No circuit breaker pattern exists for any external API call (Anthropic, Gemini, ngspice) — repeated failures hammer the provider with no backoff or fallback.
- No client-side error tracking service (Sentry, LogRocket, etc.) means production errors are invisible unless users manually report them.

### Categorized Findings (Batch 8)

| ID | Label | Type | Priority | Severity | Impact | Recommendation | Evidence |
|---|---|---|---|---|---|---|---|
| GA-ERR-01 | No `process.on('uncaughtException')` handler | NEW | P0 | Critical | Any unhandled synchronous exception (e.g., `JSON.parse` on malformed input outside try/catch) crashes the Node.js process immediately. All active connections are dropped. Graceful shutdown only handles SIGTERM/SIGINT. | Add `process.on('uncaughtException')` that logs the error and initiates graceful shutdown. Do NOT swallow — terminate after logging, as process state is corrupt. | `server/index.ts:290-291` — only SIGTERM/SIGINT handlers; no uncaughtException |
| GA-ERR-02 | No `process.on('unhandledRejection')` handler | NEW | P0 | Critical | Unhandled Promise rejections (from any `async` code path that lacks `.catch()` or try/catch) will crash the process in Node.js 15+. The server has no handler to log, alert, or gracefully terminate. | Add `process.on('unhandledRejection')` that logs the error with full stack trace and initiates shutdown. In production, this should also trigger an external alert. | `server/index.ts` — no unhandledRejection handler |
| GA-ERR-03 | SSE stream client does not check `response.ok` before reading | NEW | P0 | High | `ChatPanel.handleSend` calls `fetch()` then immediately reads `response.body?.getReader()` without checking HTTP status. If the server returns 4xx/5xx, the error response is treated as SSE data and silently parsed, producing garbled or empty chat output. | Add `if (!response.ok) throw new Error(...)` check before `getReader()`. Parse error JSON from the response body and display as error message. | `client/src/components/panels/ChatPanel.tsx:226-250` |
| GA-ERR-04 | Silent `catch {}` on SSE JSON parse hides corrupted data | NEW | P1 | High | In the SSE stream reader loop, `JSON.parse(line.slice(6))` is wrapped in a bare `catch {}` — malformed SSE events are silently discarded. If the stream is corrupted (partial write, encoding issue), the user sees an incomplete response with no error indication. | Replace bare `catch {}` with error event propagation: log the malformed line, increment an error counter, and show a "partial response" warning to the user if errors exceed a threshold. | `client/src/components/panels/ChatPanel.tsx:302` |
| GA-ERR-05 | No explicit client-side fetch timeout | NEW | P1 | Medium | The `fetch()` call to `/api/chat/ai/stream` has no explicit timeout. While the server has a 120s timeout, if the server stops sending data without closing the connection (TCP half-open), the client will wait indefinitely. | Wrap fetch in `Promise.race()` with a configurable client-side timeout (e.g., 150s — slightly longer than server timeout). On timeout, abort the controller and show a timeout error. | `client/src/components/panels/ChatPanel.tsx:226` |
| GA-ERR-06 | No circuit breaker for AI provider API calls | NEW | P1 | High | If Anthropic or Gemini API is down, every user request still attempts the failing provider with no backoff. This wastes user wait time, amplifies provider billing, and provides no degraded-mode fallback. | Implement circuit breaker: after N consecutive failures (e.g., 3), mark provider as "open" for a cooldown period. During cooldown, immediately fail or route to fallback provider. Reset on successful call. | `server/ai.ts` `streamAIMessage` and related functions — no failure counting or circuit breaking |
| GA-ERR-07 | No automatic AI provider fallback | NEW | P1 | Medium | Dual-model support exists (Claude + Gemini) and users can select their provider, but there's no automatic fallback. If the selected provider fails, the user gets an error — the other provider is not tried. | Add configurable auto-fallback: on provider error (non-4xx), retry with alternate provider. Notify user which provider responded. | `server/ai.ts` `routeToModel()` selects tier but doesn't retry on failure |
| GA-ERR-08 | `StorageError` loses PostgreSQL error classification | NEW | P2 | Medium | All storage methods catch errors and wrap them in `StorageError(methodName, tableName, error)`. The original PostgreSQL error code (e.g., `23505` for unique violation, `23503` for FK violation) is embedded in the cause but never extracted — the global error handler treats all storage errors as 500. | Parse `error.code` in the storage catch block. Map known codes to HTTP statuses: `23505→409`, `23503→400`, `ETIMEDOUT→503`. Expose via `StorageError.httpStatus`. | `server/storage.ts:165+` all try/catch blocks |
| GA-ERR-09 | No timeout on SSE backpressure `drain` event | NEW | P2 | Medium | The `writeWithBackpressure` function waits for the `drain` event with no timeout. If the client becomes unresponsive but the TCP connection stays open, the server-side Promise hangs indefinitely, holding resources. | Add a timeout (e.g., 30s) to the drain wait. On timeout, treat the connection as dead and clean up. | `server/routes.ts:1253-1259` `writeWithBackpressure` function |
| GA-ERR-10 | No per-mutation `onError` callbacks in React Query | NEW | P2 | Low | All mutations (create/update/delete) rely on a single global `onError` handler that shows a generic toast. No mutation-specific error handling exists — a failed BOM update shows the same message as a failed project delete. | Add per-mutation `onError` callbacks for high-value operations (delete, bulk update) with contextual error messages and rollback actions where appropriate. | `client/src/lib/queryClient.ts:90-122` global handler; all context mutations lack specific onError |
| GA-ERR-11 | No client-side error tracking service | NEW | P1 | High | No Sentry, LogRocket, Bugsnag, or equivalent is integrated. Production client errors are completely invisible — they only exist in users' browser consoles. ErrorBoundary catches render errors but has no reporting mechanism. | Integrate Sentry (free tier: 5K errors/month) with source map upload. Capture: render errors (via ErrorBoundary), unhandled rejections, and SSE stream errors. Include project ID and user session context. | No `Sentry`, `LogRocket`, `Bugsnag`, `datadogRum`, or `errorReporting` references in codebase |

### Progress Log

- Timestamp: 2026-02-28T23:48:00Z
- Status: Batch 8 appended to report.
- Coverage: Process crash handlers, SSE client robustness, circuit breakers, AI fallback, error classification, client error tracking.
- Findings: 11 NEW.
- Next: Append Batch 9 (API Contracts & SSE Streaming).

## [2026-02-28T23:49:00Z] Gap Analysis Expansion -- Batch 9 (API Contracts & SSE Streaming)

### Executive Summary Delta

- API response shape consistency is approximately 7.5/10 — individual endpoints are well-implemented, but cross-endpoint patterns diverge: some DELETEs return `204`, others return `{ success: true }`. Some lists return raw arrays, others wrap in objects.
- No API versioning strategy exists — all routes are `/api/*` with no `/api/v1/` prefix, no deprecation headers, and no migration path for breaking changes.
- Circuit-related endpoints (instances, nets, wires) have no pagination — potentially returning 1000+ items in a single response.
- SSE streaming is robust (backpressure, abort signals, structured errors) but lacks reconnection logic, heartbeat events, and concurrent-stream protection.

### Categorized Findings (Batch 9)

| ID | Label | Type | Priority | Severity | Impact | Recommendation | Evidence |
|---|---|---|---|---|---|---|---|
| GA-API-01 | Response envelope inconsistency across endpoints | NEW | P1 | High | DELETE endpoints in `routes.ts` return `204` (empty body), while DELETEs in `circuit-routes.ts` return `200` with `{ success: true }`. List endpoints return raw arrays. Some operations return `{ message: "...", wiresCreated: N }`. Client code checking `response.success` will fail unpredictably. | Standardize: all DELETEs return `204`. All list GETs return `{ data: [...], total: N }` envelope. All mutations return the created/updated resource. Document the contract. | `server/routes.ts` (204 on delete) vs `server/circuit-routes.ts:61,139,211` (`{ success: true }`) vs `:617,673` (`{ message, wiresCreated }`) |
| GA-API-02 | No pagination on circuit instance/net/wire endpoints | NEW | P1 | High | `/api/circuits/:id/instances`, `/api/circuits/:id/nets`, `/api/circuits/:id/wires` return all rows without limit/offset. Circuit designs with 500+ components will produce multi-megabyte responses, causing client-side memory pressure and slow rendering. | Add the same `paginationSchema` (limit/offset/sort) already used on main route endpoints. Default limit 50, max 500. | `server/circuit-routes.ts:69-72` (instances), `:146-149` (nets), `:552-555` (wires) — no pagination params |
| GA-API-03 | No API versioning strategy | NEW | P1 | High | All routes are `/api/*` with no version prefix. Deprecated endpoints (`/api/bom/:id`, `/api/validation/:id`) still exist with no deprecation header. Breaking changes (field renames, response shape changes) will immediately break all clients. | Introduce `/api/v1/` prefix for all routes. Add `Deprecation` header on deprecated endpoints. Add `Sunset` header with removal date. Plan version negotiation for future `/api/v2/`. | All route definitions in `server/routes.ts` and `server/circuit-routes.ts` |
| GA-API-04 | No generated API types — loose client/server contract | NEW | P1 | Medium | Client TypeScript types are manually written and don't match server response shapes. No `zod-to-ts`, OpenAPI generation, or shared type validation exists. Refactoring server responses can silently break client code with no TypeScript protection across the API boundary. | Generate client API types from Zod schemas (e.g., `zod-to-ts` or `@ts-rest/core`). Or generate OpenAPI spec from routes and use `openapi-typescript` for client types. Enforce in CI. | `client/src/lib/types.ts` (manually written) vs `shared/schema.ts` (Zod schemas server-side) |
| GA-API-05 | No SSE reconnection logic | NEW | P1 | Medium | If the network drops during AI streaming, the fetch fails and the user sees a generic error. No automatic retry, exponential backoff, or partial-response recovery exists. The user must manually re-send their entire message. | Add retry logic with exponential backoff (1s, 2s, 4s, max 3 retries). On reconnect, include a `lastEventId` header if the server supports event IDs. Show "Reconnecting..." UI state. | `client/src/components/panels/ChatPanel.tsx:219-248` — single fetch, no retry |
| GA-API-06 | No SSE heartbeat events | NEW | P2 | Medium | The SSE stream sends no keep-alive or heartbeat events during idle periods (e.g., while the AI processes tool calls). Proxies (Nginx, CloudFlare) and firewalls may close connections that appear idle after 30-60 seconds, even though the server is actively processing. | Emit `:heartbeat\n\n` (SSE comment) every 15-30 seconds while processing. This resets proxy idle timers without affecting the client's event parser. | `server/routes.ts:1262-1292` and `server/ai.ts` — no heartbeat/keepalive events |
| GA-API-07 | Client allows concurrent AI streams (state corruption) | NEW | P1 | High | `ChatPanel.handleSend` does not check `isGenerating` before starting a new stream. If the user clicks "Send" while a stream is active, a second request fires. The `abortRef` is overwritten, orphaning the first stream's AbortController. Both responses write to the same state, causing message interleaving. | Add `if (isGenerating) return` guard at the top of `handleSend`. Alternatively, disable the send button while streaming (some EDA tools show "Stop Generating" instead). | `client/src/components/panels/ChatPanel.tsx:197-221` — no concurrency guard |
| GA-API-08 | Stream timeout is hardcoded to 120 seconds | NEW | P2 | Medium | The server-side stream timeout is hardcoded to `120000ms`. Complex AI interactions involving multiple tool calls (MAX_TOOL_TURNS=10) can legitimately take longer. No configuration mechanism exists, and the timeout doesn't reset on activity. | Make timeout configurable via env variable. Reset the timer on each SSE event emission (activity-based timeout, not absolute). | `server/routes.ts:1240-1246` — `setTimeout(() => {...}, 120000)` |

### Progress Log

- Timestamp: 2026-02-28T23:49:00Z
- Status: Batch 9 appended to report.
- Coverage: API response consistency, pagination, versioning, type safety, SSE reconnection, heartbeats, concurrency, timeouts.
- Findings: 8 NEW.
- Next: Append Batch 10 (Build, Bundle & Observability).

## [2026-02-28T23:50:00Z] Gap Analysis Expansion -- Batch 10 (Build, Bundle & Observability)

### Executive Summary Delta

- Production build analysis reveals a 387KB main bundle (119KB gzip) on the critical path — every page load blocks on this before any view renders. Combined with 3 large vendor chunks (xyflow 173KB, radix 156KB, markdown 153KB), the total JavaScript payload exceeds 1MB.
- No production source maps are generated — stack traces from production errors are undebuggable.
- The `X-Request-Id` correlation header is set server-side but never propagated to the client, making it impossible to correlate client-side errors with server logs.
- Correction: existing items TD-26 and IN-19 claim framer-motion adds "37KB gzipped" — actual measurement shows framer-motion tree-shakes to **37 BYTES** (not KB). The library effectively compiles away to nothing.

### Categorized Findings (Batch 10)

| ID | Label | Type | Priority | Severity | Impact | Recommendation | Evidence |
|---|---|---|---|---|---|---|---|
| GA-BUILD-01 | Main bundle is 387KB (119KB gzip) on critical path | NEW | P1 | Medium | The entry point bundle (`index-*.js`) is 387KB raw / 119KB gzip. Every page load blocks on downloading + parsing this before any component renders. On 3G connections (~700KB/s), this alone adds ~550ms to first paint. | Analyze with `npx vite-bundle-visualizer`. Split heavy imports (markdown, radix, form components) into lazy-loaded chunks. Target: <200KB main bundle. | `dist/public/assets/index-vlDEOyUU.js` — 387KB / 119KB gzip |
| GA-BUILD-02 | No production source maps | NEW | P2 | Medium | Zero `.map` files in `dist/`. Stack traces from production errors show minified variable names (`e.Vn`, `t.Xe`), making crash debugging impossible without reproducing locally. Combined with no client error tracking (GA-ERR-11), production errors are a black hole. | Enable `build.sourcemap: 'hidden'` in Vite config. Upload maps to error tracking service (Sentry). Keep maps out of public-facing URLs. | `dist/public/assets/` — 0 `.map` files; `vite.config.ts` — no sourcemap config |
| GA-BUILD-03 | Server bundle is 2.0MB (single file) | NEW | P2 | Low | `dist/index.cjs` is a 2.0MB monolithic server bundle. While server-side bundle size matters less than client, this slows cold starts (Lambda, container scaling) and makes debugging server crashes harder with minified traces. | Consider keeping server code unminified in production (`esbuild` `--minify=false`) since it doesn't affect download time. Or split into route-based entry points for faster cold starts. | `dist/index.cjs` — 2.0MB |
| GA-OBS-01 | `X-Request-Id` not propagated to client responses | NEW | P2 | Medium | Server generates `X-Request-Id` per request and includes it in response headers, but: (1) the client never reads or displays it, (2) error messages shown to users don't include the request ID, (3) no mechanism exists to correlate client-reported errors with server logs. | Expose `X-Request-Id` in client error messages and error tracking context. Add to React Query's global error handler. Include in Sentry breadcrumbs (if integrated per GA-ERR-11). | `server/index.ts:66-77` sets X-Request-Id; client never reads it |
| GA-OBS-02 | Vendor chunk analysis reveals optimization opportunities | NEW | P2 | Low | Three vendor chunks dominate: xyflow-vendor (173KB/58KB gzip), radix-vendor (156KB/48KB gzip), markdown-vendor (153KB/47KB gzip). Radix imports may include unused components due to barrel exports. Markdown vendor could be deferred since it's only needed in ChatPanel. | Audit radix imports for unused components (tree-shake). Lazy-load markdown rendering (only needed when ChatPanel is visible). Consider lighter alternatives for simple markdown (e.g., `marked` at 30KB vs `react-markdown` ecosystem). | `dist/public/assets/` vendor chunk analysis |

### Correction

| ID | Original Claim | Corrected Value | Impact |
|---|---|---|---|
| TD-26 / IN-19 | "framer-motion adds -37KB gzipped" | framer-motion tree-shakes to **37 BYTES** (0.037KB). The `motion-vendor-*.js` chunk is literally 37 bytes. | TD-26 says "commit fully or remove (-37KB gzipped)" — the removal savings are effectively zero. The decision should be purely about whether micro-interactions are valuable, not bundle size. IN-19 should be re-prioritized or reframed. |

### Cumulative Statistics (Batches 5-10)

| Batch | Category | NEW | EXPANDED | CORRECTED |
|---|---|---|---|---|
| 5 | Database & Query Optimization | 7 | 1 | 0 |
| 6 | Client Performance & React Patterns | 12 | 0 | 0 |
| 7 | Security Hardening | 10 | 0 | 0 |
| 8 | Error Handling & Resilience | 11 | 0 | 0 |
| 9 | API Contracts & SSE Streaming | 8 | 0 | 0 |
| 10 | Build, Bundle & Observability | 5 | 0 | 1 |
| **Total** | | **53** | **1** | **1** |

### Priority Distribution (Batches 5-10)

| Priority | Count | Key Items |
|---|---|---|
| P0 | 5 | GA-SEC-11, GA-SEC-12, GA-ERR-01, GA-ERR-02, GA-ERR-03 |
| P1 | 28 | GA-DB-01, GA-DB-02, GA-DB-03, GA-PERF-01, GA-PERF-02, GA-PERF-04, GA-PERF-07, GA-PERF-12, GA-SEC-13, GA-SEC-14, GA-SEC-16, GA-SEC-17, GA-ERR-04, GA-ERR-05, GA-ERR-06, GA-ERR-07, GA-ERR-11, GA-API-01, GA-API-02, GA-API-03, GA-API-04, GA-API-05, GA-API-07, GA-BUILD-01, plus expanded GA-ARCH-02 |
| P2 | 22 | GA-DB-04 through GA-DB-07, GA-PERF-03, GA-PERF-05, GA-PERF-06, GA-PERF-08 through GA-PERF-11, GA-SEC-15, GA-SEC-18 through GA-SEC-20, GA-ERR-08 through GA-ERR-10, GA-API-06, GA-API-08, GA-BUILD-02, GA-BUILD-03, GA-OBS-01, GA-OBS-02 |

### Phased Execution Roadmap (Batches 5-10)

| Phase | Timeframe | Focus | Items |
|---|---|---|---|
| Immediate (0-7 days) | Process crash protection + CORS + XSS | GA-ERR-01, GA-ERR-02, GA-SEC-11, GA-SEC-12, GA-ERR-03 |
| Near-Term (1-3 weeks) | DB performance + API contracts + stream safety | GA-DB-01, GA-DB-02, GA-API-01, GA-API-02, GA-API-07, GA-ERR-04 |
| Mid-Term (3-6 weeks) | React performance + resilience + security headers | GA-PERF-12, GA-PERF-04, GA-PERF-01, GA-ERR-06, GA-ERR-07, GA-SEC-13, GA-SEC-14, GA-SEC-17 |
| Long-Term (6-12 weeks) | API versioning + type safety + build optimization + observability | GA-API-03, GA-API-04, GA-BUILD-01, GA-BUILD-02, GA-ERR-11, GA-OBS-01 |

### Progress Log

- Timestamp: 2026-02-28T23:50:00Z
- Status: Batch 10 appended to report; all 6 report batches complete.
- Total findings this session: 53 NEW + 1 EXPANDED + 1 CORRECTION across batches 5-10.
- Grand total all sessions: 19 (batches 1-4) + 55 (batches 5-10) = **74 gap findings** appended to report.
- Next: Append corresponding checklist items for all batch 5-10 findings.
