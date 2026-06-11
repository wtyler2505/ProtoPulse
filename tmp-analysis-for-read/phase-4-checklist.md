# Phase 4 Checklist -- Tech Debt (TD-) & Enhancements (EN-)

> Priority: P0 (critical) -> P3 (nice-to-have)
> Effort: S (hours) / M (days) / L (weeks) / XL (months)

## P0 -- Critical (Blocks Production Launch)

- [ ] TD-01: Decompose PCBLayoutView anonymous function (CCN=135, 389 NLOC) into focused modules: layout engine, component placement, routing visualization, interaction handlers | Effort: L | Priority: P0
- [ ] TD-02: Remove PROJECT_ID=1 hardcoding in project-context.tsx; implement multi-project routing, context switching, and data isolation | Effort: L | Priority: P0
- [ ] TD-03: Implement database migration system (replace db:push with Drizzle Kit migrations: generate, run, rollback) | Effort: M | Priority: P0
- [ ] TD-04: Decompose ShapeCanvas.tsx (CCN=381 aggregate, 1275 lines, 6 functions >CCN 20) into: ShapeRenderer, HitTester, DragManager, SnapGuideEngine, PathEditor, CanvasTransforms | Effort: L | Priority: P0

## P1 -- High (Significant Technical Risk)

- [ ] TD-05: Decompose parseLocalIntent (CCN=102, 208 NLOC) using strategy pattern — one handler per intent type instead of monolithic if/switch chain | Effort: M | Priority: P1
- [ ] TD-06: Split useActionExecutor.ts (1299 lines, 53 action types) into action-type modules with a registry pattern | Effort: L | Priority: P1
- [ ] TD-07: Split ProjectProvider monolithic context (40+ state values) into domain-specific contexts: NodesContext, BOMContext, ChatContext, ValidationContext | Effort: L | Priority: P1
- [ ] TD-08: Split server/routes.ts (1329 lines, 50+ endpoints) into domain routers: project-routes, bom-routes, validation-routes, export-routes, auth-routes | Effort: M | Priority: P1
- [ ] TD-09: Split server/ai-tools.ts (1677 lines, 78 tools) into tool category modules with a tool registry | Effort: M | Priority: P1
- [ ] TD-10: Complete export-generators.ts (1209 lines) monolith decomposition — migrate remaining generators to server/export/ modules, then delete the monolith | Effort: M | Priority: P1
- [ ] TD-11: Optimize AI system prompt to send only relevant context (changed nodes, active view data) instead of full project state per request | Effort: M | Priority: P1
- [ ] TD-12: Add CI/CD pipeline — GitHub Actions for: lint, typecheck, test, build on every PR | Effort: M | Priority: P1
- [ ] TD-13: Reduce `any` type usage (74 occurrences) — target <10 across codebase with proper type definitions | Effort: M | Priority: P1
- [ ] TD-14: Eliminate `as any` casts (19 occurrences) — replace with proper generics, type guards, or interface extensions | Effort: S | Priority: P1
- [ ] TD-15: Name all anonymous functions in high-complexity components for debuggable stack traces | Effort: S | Priority: P1

## P2 -- Medium (Impacts Developer Velocity)

- [ ] TD-16: Split circuit-routes.ts (1757 lines) into focused route files by EDA domain | Effort: M | Priority: P2
- [ ] TD-17: Decompose component-ai.ts (CCN=56) — extract prompt building, response parsing, and tool dispatch into separate modules | Effort: M | Priority: P2
- [ ] TD-18: Decompose gerber-generator.ts resolvePad (CCN=39) — extract pad shape resolution into a lookup table | Effort: S | Priority: P2
- [ ] TD-19: Decompose drc-gate.ts runDrcGate (CCN=39) — extract rule evaluation into individual rule functions | Effort: S | Priority: P2
- [ ] TD-20: Audit and remove possibly-unused dependencies: @hookform/resolvers, tailwindcss-animate, tw-animate-css, @types/compression | Effort: S | Priority: P2
- [ ] TD-21: Audit dangerouslySetInnerHTML usage (1 occurrence) — verify no user-controlled data flows into it | Effort: S | Priority: P2
- [ ] TD-22: Audit innerHTML assignment (1 occurrence) — same security concern as TD-21 | Effort: S | Priority: P2
- [ ] TD-23: Replace console.log/warn/error (17 occurrences) with structured logging via Winston (already available server-side) | Effort: S | Priority: P2
- [ ] TD-24: Add code splitting with React.lazy() — defer loading Simulation, PCB, Component Editor views until accessed | Effort: M | Priority: P2
- [ ] TD-25: Build unified undo/redo stack across all views (currently fragmented per-view with no cross-view coordination) | Effort: L | Priority: P2
- [ ] TD-26: Either leverage framer-motion fully (micro-interactions, gestures) or remove it to save ~37KB gzipped bundle size | Effort: S | Priority: P2
- [ ] TD-27: Update major outdated dependencies: @hookform/resolvers 3→5, drizzle-orm 0.39→0.45, date-fns 3→4 | Effort: M | Priority: P2

## P3 -- Nice-to-Have (Polish)

- [ ] TD-28: Reduce overall file count >500 lines — target maximum 800 lines per file via decomposition | Effort: L | Priority: P3
- [ ] TD-29: Add JSDoc documentation to all 78 AI tools for discoverability and maintenance | Effort: M | Priority: P3
- [ ] TD-30: Create Architecture Decision Records (ADRs) for key choices: dual AI providers, Express over Next.js, monolithic context | Effort: S | Priority: P3
- [ ] TD-31: Audit http:// URLs (8 occurrences) — ensure all production URLs use HTTPS | Effort: S | Priority: P3
- [ ] TD-32: Resolve skipped tests (6 occurrences) — either fix or remove | Effort: S | Priority: P3
- [ ] TD-33: Remove deprecated endpoints `/api/bom/:id` and `/api/validation/:id` and update all callers | Effort: S | Priority: P3

## Test Coverage Enhancement (EN-)

- [ ] EN-01: Add E2E tests for critical user flows: create project → add components → AI chat → export | Effort: L | Priority: P1
- [ ] EN-02: Add integration tests for storage layer: cache invalidation, soft deletes, concurrent access | Effort: M | Priority: P1
- [ ] EN-03: Add test coverage for AI tool execution (78 tools, currently 0 tested for execution logic) | Effort: L | Priority: P1
- [ ] EN-04: Add component tests for high-complexity UI: PCBLayoutView, ShapeCanvas, BreadboardView | Effort: L | Priority: P1
- [ ] EN-05: Add snapshot tests for export generators (KiCad, Eagle, Gerber, SPICE) to prevent regression | Effort: M | Priority: P2

## Priority Summary

| Priority | Count | Category |
|----------|-------|----------|
| P0 | 4 | TD-01, TD-02, TD-03, TD-04 |
| P1 | 15 | TD-05 through TD-15, EN-01 through EN-04 |
| P2 | 13 | TD-16 through TD-27, EN-05 |
| P3 | 6 | TD-28 through TD-33 |
| **Total** | **38** | |
