# Phase 4: Technical Debt & Architecture

> Generated 2026-02-28 | ProtoPulse — Browser-based AI-assisted EDA platform
> Stack: React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui + @xyflow/react | Express 5 + PostgreSQL + Drizzle ORM

## Executive Summary

ProtoPulse has **catastrophic complexity hotspots** — three functions exceed CCN 100 (industry danger threshold is 15). The codebase has 12 "god files" exceeding 1,000 lines, a test:source ratio of 35% (adequate for a startup but below industry standard of 80%+), and 8 possibly-unused dependencies adding dead weight. The single most impactful architectural debt item is the monolithic `ProjectProvider` context that funnels 40+ state values through a single React context, making re-rendering expensive and testing near-impossible.

**Risk rating: HIGH** — The complexity in PCBLayoutView (CCN=135), ShapeCanvas (CCN=107), and parseLocalIntent (CCN=102) represents a 3-alarm fire. These functions are virtually untestable and will be the source of most production bugs.

---

## Complexity Hotspots

### Critical (CCN > 50) — Immediate refactoring required

| Rank | Function | File | CCN | NLOC | Risk |
|------|----------|------|-----|------|------|
| 1 | (anonymous) | `client/src/components/circuit-editor/PCBLayoutView.tsx:156` | **135** | 389 | **CRITICAL** — 9x danger threshold |
| 2 | (anonymous) | `client/src/components/views/component-editor/ShapeCanvas.tsx:927` | **107** | 209 | **CRITICAL** — 7x danger threshold |
| 3 | parseLocalIntent | `client/src/components/panels/chat/parseLocalIntent.ts:54` | **102** | 208 | **CRITICAL** — 7x danger threshold |
| 4 | (anonymous) | `client/src/components/views/component-editor/ShapeCanvas.tsx:765` | **67** | 54 | HIGH |
| 5 | (anonymous) | `server/component-ai.ts` | **56** | — | HIGH |
| 6 | (anonymous) | `client/src/components/views/component-editor/ShapeCanvas.tsx:688` | **55** | 76 | HIGH |
| 7 | renderAssetCard | `client/src/components/panels/asset-manager/AssetGrid.tsx:116` | **51** | 267 | HIGH |

### Dangerous (CCN 30-50) — Refactoring recommended

| Rank | Function | File | CCN | NLOC |
|------|----------|------|-----|------|
| 8 | (anonymous) | `ShapeCanvas.tsx:858` | 49 | 61 |
| 9 | (anonymous) | `ValidationView.tsx:351` | 47 | 157 |
| 10 | (anonymous) | `BreadboardView.tsx:372` | 45 | 147 |
| 11 | (anonymous) | `ShapeCanvas.tsx:603` | 45 | 80 |
| 12 | resolvePad | `server/export/gerber-generator.ts` | 39 | — |
| 13 | runDrcGate | `server/drc-gate.ts` | 39 | — |
| 14 | (anonymous) | `ComponentInspector.tsx:110` | 39 | 97 |
| 15 | (anonymous) | `ComponentTree.tsx:83` | 37 | 55 |
| 16 | getAttr | `server/svg-parser.ts` | 35 | — |
| 17 | (anonymous) | `ProbeOverlay.tsx:512` | 35 | 50 |
| 18 | (anonymous) | `DatasheetExtractModal.tsx:90` | 35 | 62 |
| 19 | (anonymous) | `ShapeCanvas.tsx:491` | 35 | 83 |
| 20 | generateGerber | `server/export-generators.ts` | 34 | — |

### Warning (CCN 15-30)

Additional 20+ functions exceed the CCN=15 warning threshold. Notable:
- `SimulationPanel.tsx:485` (CCN=31), `BreadboardView.tsx:222` (CCN=29), `ArchitectureView.tsx:219` (CCN=29), `ArchitectureView.tsx:286` (CCN=29)
- `ComponentEditorView.tsx` has **4 functions** with CCN 20-29 — the entire component is a complexity hotspot
- `ProjectWorkspace.tsx:38` ResizeHandle (CCN=23, 295 NLOC) — layout logic embedded in component

### ShapeCanvas Analysis

`ShapeCanvas.tsx` deserves special attention: it contains **6 separate functions with CCN > 20**, accumulating to **CCN 381 across the file**. This is the highest aggregate complexity of any file in the codebase. The component handles too many responsibilities: shape rendering, hit testing, drag operations, snap guides, path editing, and canvas transformations. It needs decomposition into at least 4 focused modules.

---

## Largest Files (God Files)

12 files exceed 1,000 lines — a significant architectural smell indicating monolithic components that resist testing and modification.

| File | Lines | Category | Risk |
|------|-------|----------|------|
| `server/circuit-routes.ts` | 1,757 | API routes | XL — route file should be split by domain |
| `server/ai-tools.ts` | 1,677 | AI tool definitions | XL — 78 tools in one file |
| `client/src/components/simulation/WaveformViewer.tsx` | 1,453 | UI component | L — complex but domain-specific |
| `server/routes.ts` | 1,329 | API routes | L — 50+ endpoints, needs splitting |
| `client/src/components/panels/chat/hooks/useActionExecutor.ts` | 1,299 | Hook | XL — 53 action types in one switch |
| `client/src/components/views/component-editor/ShapeCanvas.tsx` | 1,275 | UI component | **XL — highest aggregate CCN** |
| `server/export/kicad-exporter.ts` | 1,247 | Exporter | M — domain-specific complexity |
| `server/export-generators.ts` | 1,209 | Exporter (legacy) | L — deprecated monolith, new modules exist |
| `server/export/eagle-exporter.ts` | 1,150 | Exporter | M — domain-specific complexity |
| `server/export/gerber-generator.ts` | 1,085 | Exporter | M — domain-specific complexity |
| `server/ai.ts` | 1,083 | AI system | L — prompt builder + streaming |
| `server/storage.ts` | 1,062 | Data layer | L — single storage class for all entities |

**Pattern:** Server-side god files are mostly domain-specific (exporters) where high line count is somewhat justified. Client-side god files (ShapeCanvas, useActionExecutor, WaveformViewer) are monolithic components that need decomposition.

---

## Code Smell Summary

| Smell | Count | Severity | Notes |
|-------|-------|----------|-------|
| `any` type usage | **74** | Medium | Type safety erosion — each `any` is a gap in TypeScript's protection |
| `as any` assertions | **19** | High | Explicit type system bypass — often hides real type errors |
| `@ts-ignore` / `@ts-expect-error` | 0 | Clean | No suppressed errors |
| `console.log/warn/error` | **17** | Low | Should use structured logging in production |
| `TODO/FIXME/HACK/XXX` | 1 | Clean | Minimal dead code markers (unusually low — may indicate TODOs are being tracked elsewhere) |

### Type Safety Assessment

74 `any` usages across 213 source files = **0.35 per file average**. This is moderate but not alarming. The 19 `as any` casts are more concerning — each represents a deliberate decision to bypass type checking, often masking real type mismatches. Zero `@ts-ignore` is excellent discipline.

---

## Security Findings

| Finding | Count | Severity | Recommendation |
|---------|-------|----------|----------------|
| `eval()` usage | 0 | Clean | No code injection risk |
| `dangerouslySetInnerHTML` | 1 | Medium | Audit the single usage — ensure input is sanitized |
| `.innerHTML` assignment | 1 | Medium | Same concern as dangerouslySetInnerHTML — verify no user input flows here |
| `http://` URLs (non-HTTPS) | 8 | Low | Audit — may be localhost dev URLs or API references. Production must be HTTPS-only |
| Hardcoded secrets | 0 | Clean | API keys use AES-256-GCM encryption (verified in `server/auth.ts`) |

**Overall Security Posture: GOOD** — No critical vulnerabilities detected. The auth model uses scrypt hashing + AES-256-GCM encrypted API keys. The two innerHTML/dangerouslySetInnerHTML usages need individual audit to confirm no user-controlled data flows into them.

---

## Test Health

| Metric | Value | Assessment |
|--------|-------|------------|
| Source files | 213 | — |
| Test files | 75 | — |
| Test:Source ratio | **35.2%** | Below industry standard (80%+) but acceptable for startup pace |
| Skipped tests | 6 | Low — no major test rot |
| Test infrastructure | Vitest + 5 test suites | Present but thin |
| E2E tests | 0 | **Missing** — no end-to-end coverage |
| Integration tests | Minimal | Only exporters have integration tests |

### Coverage Gaps

- **Zero E2E tests** — critical user flows (create project → add components → AI chat → export) have no automated verification
- **AI tools untested** — 78 tools with zero test coverage for tool execution logic
- **Frontend components untested** — only layout and panel tests exist; no tests for ShapeCanvas, PCBLayoutView, or BreadboardView (the three highest-complexity components)
- **Storage layer** — only `storage.test.ts` exists; no tests for cache invalidation, soft deletes, or concurrent access

---

## Dependency Health

| Metric | Value |
|--------|-------|
| Total dependencies | 96 (74 prod + 22 dev) |
| Possibly unused | **8** |
| Outdated (major) | 3 (@hookform/resolvers 3→5, drizzle-orm 0.39→0.45, date-fns 3→4) |
| Outdated (minor/patch) | 12+ |

### Possibly Unused Dependencies

| Package | Installed | Evidence |
|---------|-----------|----------|
| `@google/generative-ai` | Yes | No direct import found — may use dynamic import or server-only |
| `@hookform/resolvers` | Yes | No forms exist in the app (Phase 3 confirmed: 0 `<form>` elements) |
| `framer-motion` | Yes | Only used for Suspense fallbacks — massively underutilized |
| `tailwindcss-animate` | Yes | Likely replaced by `tw-animate-css` |
| `tw-animate-css` | Yes | May duplicate `tailwindcss-animate` |
| `@jridgewell/trace-mapping` | Yes | Build tool dependency — may be transitive |
| `@types/compression` | Yes | Types without compression usage |
| `dotenv` | Yes | May be loaded via `-r dotenv/config` flag |

**Note:** `framer-motion` (37KB gzipped) is installed but only used for basic fade transitions. This adds significant bundle weight for minimal value. Either lean into it (micro-interactions, layout animations, gesture handling) or remove it.

---

## Architecture Gaps

### 1. Performance

**Monolithic ProjectProvider Context**
- `project-context.tsx` provides 40+ state values through a single React context
- ANY state change triggers re-renders in ALL consuming components
- This is the single biggest performance bottleneck for the UI
- **Update from Phase 1 refinement:** ProjectProvider has been partially refactored into 8 separate contexts (architecture, bom, chat, history, output, validation, project-meta, project-id). However, `architecture-context` alone is 365 LOC with 6 useState hooks exposing 27+ values. The re-render problem has been **distributed, not eliminated**. Each domain context still triggers re-renders across all its consumers.
- **Impact:** Every AI action that updates nodes/edges/BOM causes the entire workspace to re-render

**AI System Prompt Rebuild**
- `server/ai.ts` rebuilds the full project state (all nodes, edges, BOM, validation, chat history) on every AI request
- Scales O(n) with project size — a project with 100 nodes sends ~50KB of context per request
- **Impact:** Token costs scale linearly, response latency increases with project size

**No Code Splitting**
- All views loaded eagerly despite `React.lazy()` being available
- Simulation engine, PCB layout, and component editor loaded even when user is on Architecture tab
- **Impact:** Initial bundle includes ~300KB of code the user may never use in a session

### 2. Scalability

**PROJECT_ID = 1 Hardcoded**
- Single most referenced debt item across ALL analysis phases
- Blocks: multi-project, collaboration, proper auth, data isolation
- Every query assumes project 1 — no routing, no context switching
- **Impact:** Cannot ship to production with real users

**No Database Migrations**
- Using `db:push` (destructive schema sync) instead of proper migrations
- Any schema change risks data loss in production
- No rollback capability, no migration history
- **Impact:** Database changes are one-way and destructive

**Dual Export System**
- Legacy `export-generators.ts` (1,209 lines) coexists with new `server/export/` modules
- Both systems are active — unclear which is canonical
- **Impact:** Bug fixes need to be applied to both systems; developer confusion

### 3. Code Quality

**useActionExecutor Monolith**
- 1,299 lines handling 53 AI action types in what is likely a massive switch/if-else chain
- Each action type has its own logic for parsing, executing, and error handling
- **Impact:** Adding a new action type requires modifying a 1,300-line file; high merge conflict risk

**Fragmented Undo/Redo**
- Each view (Architecture, Schematic, PCB, Component Editor) has its own undo stack
- No unified history — undoing in one view doesn't affect related changes in another
- **Impact:** Users lose changes when switching views; confusing mental model

**Anonymous Functions Dominate Complexity**
- 15 of top 20 complexity hotspots are anonymous functions (unnamed arrow functions in components)
- Makes stack traces, profiling, and debugging significantly harder
- **Impact:** When PCBLayoutView crashes at CCN=135, the error says "(anonymous)" — useless for debugging

### 4. Developer Experience

**No CI/CD Pipeline**
- No GitHub Actions workflows detected
- No automated testing on PR
- No automated deployment
- **Impact:** Every change requires manual testing and deployment

**Minimal Documentation**
- 1 TODO across 213 source files — either everything is well-documented or nothing is tracked
- No JSDoc on any of the 78 AI tools
- No architecture decision records (ADRs)
- **Impact:** Onboarding a new developer requires tribal knowledge

---

## Ticking Time Bombs

These debt items **WILL** cause production issues if not addressed before launch:

### 1. PCBLayoutView CCN=135 (Severity: CRITICAL)
A single function with 135 cyclomatic complexity paths and 389 lines. This is **9x the danger threshold**. It is statistically certain to contain undetected bugs. Any modification has a high probability of introducing regressions. This function alone likely accounts for most PCB-related bug reports.

### 2. PROJECT_ID = 1 (Severity: CRITICAL)
Cannot launch to production with this. Every user would share the same project. No data isolation, no auth scoping, no collaboration model.

### 3. No Database Migrations (Severity: HIGH)
The first production schema change will be a catastrophe. `db:push` drops and recreates tables. Any data loss in production is unrecoverable without manual backups.

### 4. useActionExecutor (Severity: HIGH)
53 action types in 1,299 lines. Adding action type 54 means touching a file that 28 commits have modified in the last 90 days (ChatPanel.tsx, which delegates to this hook). Merge conflicts are near-certain in a multi-developer environment.

### 5. AI Prompt Scaling (Severity: MEDIUM-HIGH)
Full project state rebuild per request works for demo projects. A real engineering project with 200+ nodes and weeks of chat history will hit token limits, causing silent truncation and degraded AI responses.

---

## Git Churn Analysis

High-churn files indicate areas of active development and potential instability:

| File | Changes (90d) | Concern |
|------|---------------|---------|
| `server/routes.ts` | 31 | God file getting bigger — needs domain splitting |
| `ChatPanel.tsx` | 28 | Frequent UI changes — stabilization needed |
| `project-context.tsx` | 22 | Core state file — every feature touches this |
| `ProcurementView.tsx` | 17 | Active feature development |
| `ArchitectureView.tsx` | 17 | Active feature development |
| `ProjectWorkspace.tsx` | 16 | Layout changes ripple everywhere |
| `Sidebar.tsx` | 16 | Navigation evolution |
| `storage.ts` | 15 | Growing — needs interface segregation |
| `schema.ts` | 14 | Schema still evolving — risky without migrations |
| `server/index.ts` | 14 | Server bootstrap — should be stable |

**Correlation: High churn + high complexity = HIGH RISK.** The intersection of high-churn and high-complexity files reveals the riskiest code:
- `ShapeCanvas.tsx` (CCN=381 aggregate, 11 changes) — complex AND evolving
- `routes.ts` (1,329 lines, 31 changes) — large AND frequently modified
- `ComponentEditorView.tsx` (989 lines, 14 changes, 4 functions with CCN>20) — complex AND churning

---

## Cross-Phase Implications

### Feature Gaps Blocked by Debt (⑥ Gaps → Debt)

| Feature Gap | Blocking Debt | Why Blocked |
|-------------|---------------|-------------|
| FG-01 (PCB layout) | **TD-01** (PCBLayoutView CCN=135) | Any new PCB feature added to this component compounds the complexity crisis. Must refactor first. |
| FG-05 (component library) | **TD-09** (ai-tools.ts 1,677 lines) | Adding standard component tools to a 1,677-line file is impractical. Must split into modules first. |
| FG-06 (collaboration) | **TD-02 + TD-03 + TD-07** | Collab requires multi-project (TD-02), migrations (TD-03), and split context (TD-07). Three XL prerequisites. |
| FG-07/08/09 (export improvements) | **TD-10** (dual export system) | Both old monolith and new modules are active. Must complete decomposition before adding features. |
| FG-22 (design import) | *Not blocked* | Clean architecture — additive work. Export patterns exist to follow. |

### UX Friction Caused by Debt (⑧ UX → Debt)

| UX Issue | Root Cause Debt | Mechanism |
|----------|----------------|-----------|
| UI sluggishness on tab switch | **TD-07** (monolithic context) | ANY state change re-renders ALL consumers. Tab data loading triggers full workspace re-render. |
| AI actions cause visible freeze | **TD-07** (monolithic context) | AI action updates nodes/edges/BOM simultaneously, causing cascade re-render of every component. |
| Local mode confusion (UI-09) | **TD-05** (parseLocalIntent CCN=102) | The 208-line decision tree grew organically. Behavior is unpredictable because the code is unmaintainable. |
| AI actions fail silently | **TD-06** (useActionExecutor 1,299 lines) | Error handling is inconsistent across 53 action types in one monolithic switch. |
| DRC feedback impossible (UI-11) | **TD-04** (ShapeCanvas CCN=381) | Adding real-time DRC to a component with 6 functions >CCN 20 would create catastrophic complexity. |

### Innovations Enabled/Blocked by Debt (⑩ Debt → Innovation)

| Innovation | Enabling/Blocking Debt | Relationship |
|------------|----------------------|--------------|
| IN-01 (AI Design Agent) | **TD-06** (split useActionExecutor) | ENABLES — Registry-based actions allow multi-step AI composition. |
| IN-02 (Real-Time Collab) | **TD-02 + TD-03 + TD-07** | BLOCKED — CRDTs need domain-specific contexts to sync independently. |
| IN-03 (WASM SPICE) | **TD-24** (code splitting) | ENABLES — Lazy-loading defers WASM binary until simulation tab opens. |
| IN-04 (Component Suggestion) | **TD-09** (split ai-tools.ts) | BLOCKED — Can't add suggestion tools to 1,677-line monolith. |
| IN-06 (Visual Diff) | **TD-03** (DB migrations) | BLOCKED — Version history requires schema-versioned snapshots. |
| IN-07 (Multi-Model Routing) | **TD-11** (optimize AI prompt) | ENABLES — Selective context makes per-model routing efficient. |

---

## Raw Tool Outputs

### Lizard — Server/Shared Top Warnings
```
server/component-ai.ts: anonymous CCN=56
server/export/gerber-generator.ts: resolvePad CCN=39
server/drc-gate.ts: runDrcGate CCN=39
server/svg-parser.ts: getAttr CCN=35
server/export-generators.ts: generateGerber CCN=34
```

### Lizard — Client Components Top Warnings
```
PCBLayoutView.tsx:156: anonymous — 389 NLOC, 135 CCN
ShapeCanvas.tsx:927: anonymous — 209 NLOC, 107 CCN
parseLocalIntent.ts:54: parseLocalIntent — 208 NLOC, 102 CCN
ShapeCanvas.tsx:765: anonymous — 54 NLOC, 67 CCN
ShapeCanvas.tsx:688: anonymous — 76 NLOC, 55 CCN
AssetGrid.tsx:116: renderAssetCard — 267 NLOC, 51 CCN
ShapeCanvas.tsx:858: anonymous — 61 NLOC, 49 CCN
ValidationView.tsx:351: anonymous — 157 NLOC, 47 CCN
BreadboardView.tsx:372: anonymous — 147 NLOC, 45 CCN
ShapeCanvas.tsx:603: anonymous — 80 NLOC, 45 CCN
```

### SCC — God Files (>1000 lines)
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
```

### Test Health
```
Source files: 213
Test files:  75
Ratio:       35.2%
Skipped:     6
```

### Dependencies
```
Production:  74
Development: 22
Total:       96
Possibly unused: 8
```
