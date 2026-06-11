# Cross-Phase Analysis Notes

> Lead orchestrator analysis — Round 2 (all 5 phases complete, pre-refinement)
> Updated: 2026-02-28

## Cross-Reference Connections Identified

### ① State → Gaps: Feature Completeness
- Phase 1 rates PCB layout as **Partial/Stub** (auto-route is stub, trace routing is AI-only, board dims hardcoded). Phase 2 rates PCB as **Missing** vs competitors. Combined: PCB is the single biggest capability gap.
- Phase 1 finds 78 AI tools but BOM pricing/stock/lead-times are all **AI-simulated** (no real supplier APIs). Phase 2 confirms FG-23 (real supplier APIs) as P2 gap. **Priority recalibration: FG-23 should be P1** given Phase 1 evidence that the entire procurement feature set relies on simulated data.
- Phase 1 finds export system has 12 generators but no import for any format except FZPZ. Phase 2 confirms FG-22 (import support) as P2. Phase 3 documents this as "Critical dead-end" for professional engineers. **Priority recalibration: FG-22 should be P1.**
- Phase 1 notes simulation engine lacks frequency-domain, Monte Carlo, and SPICE model import. Phase 2 rates simulation as **Partial**. EN-28/29/30 + FG-13/20/21 form a coherent simulation improvement bundle.

### ② State → UX: Orphaned Features
- Phase 1 inventories 78 AI tools but Phase 3 finds manufacturing exports (Gerber, KiCad, Eagle, etc.) are ONLY accessible via chat commands — no dedicated UI buttons. These are features that exist but are practically orphaned from non-AI-savvy users.
- Phase 1 finds `copy_architecture_json` and `copy_architecture_summary` AI tools exist but Phase 3 notes no native Ctrl+C/V support for nodes. The clipboard is AI-mediated only.
- Phase 1 finds FZPZ import exists server-side but Phase 3 documents professional engineer workflow: "No KiCad import, no EAGLE import, no netlist import **from UI**. Server has FZPZ import but no UI affordance for it." Server capability with no UI = orphaned feature.
- Phase 1 finds `start_tutorial` registered as AI action but Phase 3 notes "No interactive tutorial or guided tour." The tool exists but is unimplemented. Phase 5 proposes IN-10 to fill this gap.

### ③ State → Debt: Architecture vs Reality
- Phase 1 documents the `ProjectProvider` as a monolithic context with 40+ state values. Phase 4 quantifies the impact: ANY state change triggers re-renders in ALL consuming components. TD-07 proposes splitting into domain-specific contexts.
- Phase 1 inventories 78 AI tools in a single file. Phase 4 measures `ai-tools.ts` at 1,677 lines — the second-largest file in the codebase. TD-09 proposes splitting into tool category modules.
- Phase 1 notes dual export system (old monolith + new modules). Phase 4 confirms both are active with `export-generators.ts` at 1,209 lines. TD-10 proposes completing the decomposition.
- Phase 1 documents the AI system prompt rebuild pattern. Phase 4 quantifies it as O(n) scaling — a project with 100 nodes sends ~50KB context per request. TD-11 proposes sending only relevant context.
- Phase 1 finds 115 REST endpoints across `routes.ts` (1,329 lines) and `circuit-routes.ts` (1,757 lines). Phase 4 flags these as the #1 and #4 largest server files. TD-08 and TD-16 propose domain splitting.

### ④ State → Innovation: Untapped Infrastructure
- Phase 5 identified 8 "Integration Opportunities" from already-installed but unused dependencies:
  - `cmdk` (command palette) — installed, zero usage found. IN-12/INT-01 proposes using it.
  - `framer-motion` — installed, only used for Suspense fallbacks. Phase 4 confirms it adds ~37KB gzipped for minimal value. TD-26 says: use it or lose it.
  - `@tanstack/react-virtual` — NOT installed but @tanstack/react-query is, suggesting familiarity
  - Anthropic extended thinking — SDK supports it, not used. INT-06 proposes using it.
  - Anthropic batch API — available, not used. INT-07 proposes using it.
  - `@hookform/resolvers` — Phase 4 finds it possibly unused AND Phase 3 confirms 0 `<form>` elements. **Remove it.**

### ⑤ Gaps → UX: Competitive UX Patterns
- **FG-02 (multi-project) ↔ UI-02 ↔ TD-02**: ALL THREE phases independently flag PROJECT_ID=1 as critical. Phase 3 documents the exact onboarding friction, Phase 4 quantifies it as blocking production launch.
- **FG-06 (collaboration) ↔ UI-03**: Phase 2 notes Altium 365 + Flux.ai have real-time collab. Phase 3 traces "Share design" workflow as a "Critical dead-end" for hobbyist persona.
- **FG-05 (component library) ↔ UI-05**: Phase 2 rates ProtoPulse "Weak" on component library. Phase 3 documents professional engineer hitting a dead-end: "No standard symbol library (74xx, passives, connectors)."
- EasyEDA's one-click JLCPCB ordering (FG-10) is a UX pattern that directly resolves the Phase 3 "Export" workflow friction where Output tab is "a console log, not an export UI."

### ⑥ Gaps → Debt: Feasibility Assessment
- **FG-01 (PCB layout) is BLOCKED by TD-01**: PCBLayoutView has CCN=135 — any new PCB features added to this component will compound the complexity crisis. **Must refactor before adding features.** This makes TD-01 a higher priority than FG-01 itself.
- **FG-05 (component library) needs TD-09 first**: The component library would add more AI tools to the already-1,677-line ai-tools.ts. Must split into modules before scaling the tool count.
- **FG-06 (collaboration) needs TD-02 + TD-03 first**: Real-time collaboration requires multi-project support (TD-02) and proper migrations (TD-03) before Yjs CRDTs can be added. These are prerequisites, not nice-to-haves.
- **FG-07/08/09 (export improvements) partially blocked by TD-10**: Dual export system means improvements need to touch both old monolith AND new modules. Complete the decomposition first.
- **FG-22 (design import) is architecturally clean**: The existing export infrastructure provides patterns to follow. Import is additive work, not blocked by debt.

### ⑦ Gaps → Innovation: Beyond Parity
- **FG-01 (PCB layout) vs IN-01 (AI design agent)**: Rather than copying KiCad's manual PCB workflow, ProtoPulse should leverage IN-01 to offer AI-assisted PCB routing — leapfrog rather than copy.
- **FG-06 (collaboration) → IN-02**: Phase 5 proposes Yjs CRDTs for real-time collaboration, which solves FG-06 while adding features no competitor has (AI-aware collaborative editing).
- **FG-10 (PCB ordering) → IN-05**: Phase 5 expands FG-10 from basic ordering to DFM pre-check + instant pricing + order tracking.

### ⑧ UX → Debt: Performance-Caused Friction
- **ShapeCanvas CCN=381 ↔ UI-11 (DRC visualization)**: Phase 3 wants real-time DRC feedback during PCB trace routing. Phase 4 shows ShapeCanvas has 6 functions with CCN>20. Adding DRC visualization to this component without refactoring will create catastrophic complexity. **TD-04 must precede UI-11.**
- **ProjectProvider monolith ↔ general UI sluggishness**: Phase 3 notes UI friction across multiple views. Phase 4 identifies the root cause: ANY state change in the monolithic ProjectProvider triggers re-renders in ALL consuming components. This is why switching tabs feels slow and why AI actions cause visible UI jank. **TD-07 is the single most impactful performance fix.**
- **parseLocalIntent CCN=102 ↔ UI-09 (Local vs API mode)**: Phase 3 flags confusion about "Local Mode" vs "API Mode" capabilities. Phase 4 reveals the local intent parser is a 208-line, 102-CCN monster. Adding clarity to this feature requires refactoring the parser first. **TD-05 enables UI-09.**
- **useActionExecutor 1,299 lines ↔ AI action reliability**: Phase 3 notes AI actions sometimes fail silently. Phase 4 finds the action executor is a massive monolith where error handling per action type is inconsistent. **TD-06 enables better error handling per action type.**

### ⑨ UX → Innovation: Workflow Automation
- Phase 3 traces 5-step BOM workflow (manual add → AI-only). Phase 5 proposes IN-04 (intelligent component suggestion) that would automate this.
- Phase 3 flags "8 tabs visible at once overwhelms beginners." Phase 5 proposes IN-10 (interactive tutorials) and UI-18 (progressive disclosure) to solve this.
- Phase 3 identifies zero `<form>` elements. IN-12 (command palette via cmdk) offers keyboard-first alternative that bypasses form issues.

### ⑩ Debt → Innovation: Architecture Enables/Blocks
- **TD-07 (split ProjectProvider) ENABLES IN-02 (real-time collab)**: Yjs CRDTs need to sync specific data types (nodes, edges, BOM) independently. A monolithic context makes this impossible. TD-07 creates the domain-specific contexts that CRDTs can wrap.
- **TD-06 (split useActionExecutor) ENABLES IN-01 (AI design agent)**: The AI design agent will need to execute multiple actions in sequence (create components → wire them → validate → layout). A registry-based action system makes this composable. The current monolith doesn't support action composition.
- **TD-11 (optimize AI prompt) ENABLES IN-07 (multi-model routing)**: Sending only relevant context per request makes model routing viable — different models get different context windows. Full project state per request wastes tokens regardless of model.
- **TD-03 (DB migrations) BLOCKS IN-06 (visual diff/version history)**: Version history requires storing schema-versioned snapshots. Without migrations, there's no guarantee schema compatibility between versions. TD-03 is a prerequisite.
- **TD-24 (code splitting) ENABLES IN-03 (WASM SPICE)**: The ngspice WASM binary is large. Without code splitting, it would be loaded for every user on every page load. Code splitting defers it until the simulation tab is opened.
- **TD-09 (split ai-tools) ENABLES IN-04 (intelligent component suggestion)**: The suggestion engine needs its own tool category. Adding it to a 1,677-line file is impractical.

## Recurring Themes (3+ phases agree)

| Theme | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|-------|---------|---------|---------|---------|---------|
| PROJECT_ID=1 must die | Hardcoded in project-context.tsx | FG-02 (P0) | UI-02 (P0) | TD-02 (P0) | IN-02 prerequisite |
| Collaboration is table-stakes | No WebSocket infra | FG-06 (P1) | UI-03 (P0) | Needs TD-02+TD-03 first | IN-02 (P0) |
| Component library too thin | 78 tools but no standard library | FG-05 (P0) | UI-05 (P0) | ai-tools.ts must split first | IN-04 supplements |
| Export UX is scattered | 12 generators, dual system | FG-10, FG-07-09 | UI-06 (P1), UI-12 (P1) | TD-10 (complete decomposition) | IN-05 (P1) |
| AI is the moat — lean in | 78 tools, "Strong" across all | "Strong" across all AI features | Local vs API mode unclear (UI-09) | Prompt scales O(n) | IN-01 (P0), IN-07 (P1) |
| Onboarding doesn't exist | No welcome flow | Implied by missing imports | UI-01 (P0), UI-28 (P3) | No CI/CD = no staging for testing | IN-10 (P2) |
| PCB is the weakest domain | Partial/Stub maturity | FG-01/03/04/11/14/15 (P0-P2) | UI-11 (P1) | **CCN=135 in PCBLayoutView** | IN-01 can leapfrog |
| No real supplier data | All BOM data AI-simulated | FG-23 (P2) | Procurement tab shows simulated data | — | IN-05/08 address this |
| Testing coverage thin | — | Not addressed | Not addressed | **35% test:source ratio, 0 E2E** | Not addressed |
| AI prompt scales poorly | Rebuilds full state O(n) | Not addressed | Not addressed | TD-11 (P1) | EN-17 (P1), EN-19 (P1) |
| God files resist change | ai-tools.ts 1677, routes.ts 1329 | — | — | **12 files >1000 lines** | — |
| ShapeCanvas is a complexity bomb | — | — | DRC visualization needed there | **CCN=381 aggregate, 6 warnings** | — |

## Impact Chains

### Chain 1: PCB Complexity → Feature Paralysis → Competitive Gap
```
PCBLayoutView CCN=135 (TD-01)
  → Developers cannot safely modify PCB code
  → PCB auto-router stays as stub (FG-01 blocked)
  → Manual trace routing stays AI-only (EN-09 blocked)
  → Users can't do basic PCB design
  → ProtoPulse rated "Missing" for PCB vs every competitor
  → Professional engineers reject the tool
```

### Chain 2: PROJECT_ID=1 → Single-User → No Business Model
```
PROJECT_ID=1 hardcoded (TD-02)
  → No multi-project support (FG-02 blocked)
  → No user isolation (security risk)
  → No collaboration possible (FG-06 blocked, IN-02 blocked)
  → Cannot onboard multiple users
  → No viable business model (can't charge per-user or per-project)
```

### Chain 3: Monolithic Context → Re-render Storm → UI Jank
```
ProjectProvider has 40+ state values (TD-07)
  → Any state change triggers all consumers to re-render
  → AI actions cause visible UI freeze during state update
  → Tab switching feels sluggish
  → Users perceive the app as slow
  → User retention drops
```

### Chain 4: No Migrations → Schema Fragility → Feature Velocity
```
db:push instead of migrations (TD-03)
  → Schema changes are destructive and one-way
  → Developers fear changing the schema
  → New features requiring schema changes get delayed
  → Version history (IN-06) is impossible without schema versioning
  → Cannot safely deploy to production with real user data
```

### Chain 5: AI Prompt O(n) → Token Cost Explosion → Model Routing Impossible
```
Full project state in every AI request (TD-11)
  → Token cost scales linearly with project size
  → Large projects hit token limits, causing silent truncation
  → AI responses degrade for active users (the most valuable ones)
  → Multi-model routing (IN-07) wastes tokens on every model
  → Cannot use cheaper models for simple tasks (context too large)
```

## Risk Heatmap

| Module | Complexity | Change Freq (90d) | User Exposure | Risk |
|--------|-----------|-------------------|---------------|------|
| PCBLayoutView | **EXTREME (135)** | Low (0) | All personas | **CRITICAL** — untouchable |
| ShapeCanvas | **EXTREME (381 agg)** | High (11) | Comp editor users | **CRITICAL** — complex AND churning |
| routes.ts | High (1,329 lines) | **Very High (31)** | All personas | **HIGH** — large AND most-changed |
| ChatPanel.tsx | Medium | **Very High (28)** | All personas | **HIGH** — most-changed UI file |
| project-context.tsx | High (40+ values) | **High (22)** | All personas | **HIGH** — monolith, frequently changed |
| parseLocalIntent | **EXTREME (102)** | Low | AI users | HIGH — complexity bomb |
| useActionExecutor | High (1,299 lines) | Medium | AI users | HIGH — monolith |
| storage.ts | Medium (1,062 lines) | Medium (15) | All (data layer) | MEDIUM |
| schema.ts | Low | Medium (14) | All (data model) | **MEDIUM-HIGH** — no migrations |
| ai-tools.ts | High (1,677 lines) | Low | AI users | MEDIUM — large but stable |

## Priority Recalibration (Cross-Phase Evidence)

### Promotions (↑ priority)
| Item | Original | New | Reason |
|------|----------|-----|--------|
| FG-22 (design import) | P2 | **P1** | Phase 3: "Critical dead-end" for professional engineers |
| FG-23 (real supplier APIs) | P2 | **P1** | Phase 1: ALL procurement data is simulated — no real value |
| TD-01 (PCBLayoutView refactor) | — | **P0** | CCN=135 blocks ALL PCB feature work (Chain 1) |
| TD-04 (ShapeCanvas decomp) | — | **P0** | CCN=381 aggregate, 6 functions >CCN 20, highest complexity in codebase |
| EN-01 (E2E tests) | P1 | **P0 candidate** | 0 E2E tests, 35% test ratio, zero coverage for highest-complexity components |

### Demotions (↓ priority)
| Item | Original | New | Reason |
|------|----------|-----|--------|
| IN-02 (real-time collab) | P0 | **P1** | Blocked by TD-02, TD-03, TD-07 — three XL prerequisites |
| IN-13 (offline PWA) | P2 | **P3** | Requires XL effort, no user demand signal, architectural prerequisites |
| UI-32 (offline mode) | P3 | **P3 (confirm)** | Same as IN-13 — XL effort, no demand |

### Bundle Opportunities (implement together)
| Bundle | Items | Why Together |
|--------|-------|-------------|
| **PCB Unblock** | TD-01 → FG-01 + EN-09 + UI-11 | Refactor PCBLayoutView, then add features to the clean code |
| **Multi-Project** | TD-02 + FG-02 + UI-02 + UI-08 | Remove hardcoded ID, add project routing, add project UI, add auth UI |
| **Export Cleanup** | TD-10 → UI-06 + FG-07/08/09 | Complete export decomposition, then add export UI panel |
| **AI Optimization** | TD-11 + EN-17 + EN-19 → IN-07 | Optimize prompt, add context management, then enable model routing |
| **Action System** | TD-06 → TD-09 → IN-01 | Split action executor, split tool registry, then build AI design agent |
| **Schema Safety** | TD-03 → IN-06 | Add migrations, then build version history on stable schema layer |
| **Component Library** | TD-09 → FG-05 + UI-05 + IN-04 | Split tool file, add standard library, then add intelligent suggestions |

## Recommended Execution Roadmap

### Sprint 1 (Weeks 1-2): Foundation — Unblock Everything Else
| Item | What | Why First |
|------|------|-----------|
| TD-02 | Remove PROJECT_ID=1 | Blocks multi-project, collab, auth, production deployment |
| TD-03 | Database migrations | Blocks safe schema changes, version history |
| TD-12 | CI/CD pipeline | Every subsequent sprint needs automated testing |
| TD-15 | Name anonymous functions | 10-minute effort, immediately improves debugging for all other work |

### Sprint 2 (Weeks 3-4): Complexity Bombs — Refactor Before Features
| Item | What | Why Now |
|------|------|---------|
| TD-01 | PCBLayoutView decomposition | Unblocks FG-01, EN-07, EN-09, UI-11 |
| TD-04 | ShapeCanvas decomposition | Unblocks component editor features, DRC visualization |
| TD-05 | parseLocalIntent refactor | Unblocks UI-09 (local mode clarity) |
| TD-07 | Split ProjectProvider | Fixes UI sluggishness, enables IN-02 (CRDTs) |

### Sprint 3 (Weeks 5-6): AI System — Core Competitive Advantage
| Item | What | Why Now |
|------|------|---------|
| TD-06 | Split useActionExecutor | Unblocks IN-01 (AI design agent), improves action reliability |
| TD-09 | Split ai-tools.ts | Unblocks IN-04 (component suggestions), allows tool scaling |
| TD-11 | Optimize AI prompt | Fixes token cost scaling, enables IN-07 (multi-model routing) |
| EN-13 | Real supplier APIs | Makes procurement tab useful (currently all data is fabricated) |

### Sprint 4 (Weeks 7-8): Export & Import — Professional Workflow
| Item | What | Why Now |
|------|------|---------|
| TD-10 | Complete export decomposition | Clean foundation for import/export features |
| FG-22/EN-10 | Design import (KiCad/Eagle) | Critical for professional adoption |
| UI-06 | Export panel UI | Surface 12 existing export formats in a proper UI |
| UI-01 | Onboarding flow | First-time user experience |

### Sprint 5 (Weeks 9-10): Innovation Quick Wins
| Item | What | Why Now |
|------|------|---------|
| IN-12/INT-01 | Command palette (cmdk) | Already installed, zero dependencies. 1-2 days. |
| INT-06 | Extended thinking | 1-2 lines in ai.ts. Immediate AI quality improvement. |
| INT-08 | @dnd-kit component drag-drop | Already installed. Natural interaction pattern. |
| IN-14 | DRC rule templates | Data-only, no architecture changes. |
| IN-15 | BOM cross-highlighting | Event-driven, no new deps. |

### Sprint 6+ (Weeks 11+): Major Features
| Item | What | Prerequisites |
|------|------|---------------|
| IN-01 | AI design agent | TD-06 (action system) |
| IN-02 | Real-time collaboration | TD-02, TD-03, TD-07 (all done by Sprint 2) |
| IN-03 | WASM SPICE simulator | TD-24 (code splitting) |
| FG-05 | Standard component library | TD-09 (tool module split) |
| IN-07 | Multi-model AI routing | TD-11 (prompt optimization) |

## Duplicate Detection (for synthesis deduplication)

These items appear in multiple phase checklists with different IDs. Synthesis should keep the most detailed version:

| Phase 1 ID | Phase 4 ID | Topic | Keep |
|-----------|-----------|-------|------|
| EN-01 | TD-02 | PROJECT_ID=1 removal | TD-02 (has cross-refs) |
| EN-06 | TD-10 | Export monolith decomposition | EN-06 (has import details) |
| EN-17 | TD-11 | AI prompt optimization | Either (both detailed) |
| EN-20 | TD-09 | ai-tools.ts split | EN-20 (has split proposal) |
| EN-30 | TD-04 | ShapeCanvas decomposition | TD-04 (has module list) |
| EN-36 | TD-03 | Database migrations | TD-03 (P0 vs P1) |
| EN-22 | EN-02 (P4) | Storage integration tests | Merge |
| EN-23 | EN-01 (P4) | E2E tests | Merge |
| EN-24 | EN-03 (P4) | AI tool tests | Merge |
| EN-03 | TD-25 | Unified undo/redo | EN-03 (Phase 1 context) |
| EN-05 | TD-33 | Deprecated endpoints | Merge |

## Phase-Specific Unique Insights

### Phase 1 (not surfaced by other phases)
- **78 AI tools** is far more than the "53 action types" documented in CLAUDE.md — the inventory revealed 25 additional tools from circuit-routes additions
- **Dual export system**: old monolith `export-generators.ts` (1209 LOC) coexists with new `server/export/` modules
- **Fragmented undo/redo**: each view has its own undo stack, no unified history

### Phase 4 (not surfaced by other phases)
- **PCBLayoutView CCN=135** — 9x the danger threshold. The single most alarming finding in the entire analysis.
- **ShapeCanvas aggregate CCN=381** — 6 separate high-complexity functions in one file. Not just one bad function — the entire file is a complexity bomb.
- **parseLocalIntent CCN=102** — The local AI intent parser is a 208-line decision tree. This suggests the local mode feature grew organically without architectural planning.
- **8 possibly-unused dependencies** including `@hookform/resolvers` (hook form with zero forms!) and dual animation packages (`tailwindcss-animate` + `tw-animate-css`)
- **12 god files >1000 lines** — a structural indicator that the codebase has outgrown its initial architecture
- **0 E2E tests** — the highest-complexity components (PCBLayoutView, ShapeCanvas, BreadboardView) have zero test coverage
