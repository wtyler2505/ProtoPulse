# Changelog

All notable changes to ProtoPulse are documented in this file.

## [Unreleased]

### Added (Waves 25-26)
- Design review commenting system — `CommentsPanel`, `design_comments` table, comments route (FG-12)
- Multi-model AI routing with design-phase awareness (IN-08)
- Interactive design tutorials — `TutorialMenu`, `TutorialOverlay`, tutorial context (IN-13)
- Backup/restore automation — backup route, scripts, runbook (CAPX-OPS-03)
- AC small-signal frequency analysis engine — MNA solver, 480 lines, 41 tests (FG-13)
- Project ownership model — `ownerId`, auth middleware, 20 tests (CAPX-SEC-01)
- Unified undo/redo stack — command pattern, React context, keyboard shortcuts, 36 tests (TD-25)
- ShapeCanvas decomposed from 1,275→755 lines into 6 extracted modules (TD-04)
- Theme picker panel with theme context
- SPICE import functionality
- Design history view and lifecycle dashboard
- Architecture snapshot diff engine (`shared/arch-diff.ts`)
- `design_snapshots` and `design_comments` tables (schema now 27 tables)

### Added (Waves 1-24)
- Architecture Decision Records (ADRs) in `docs/adr/`
- DRC manufacturer templates (JLCPCB, PCBWay, OSHPark) with pre-configured rules
- 5 new DRC rule types: annular-ring, thermal-relief, trace-to-edge, via-in-pad, solder-mask
- Session refresh/rotation mechanism for improved auth security
- Storage integration tests (67 tests covering cache, soft deletes, pagination, bulk ops)
- Auth session tests (18 tests covering token rotation)
- Shared test project in Vitest config (136 tests now running that were previously skipped)
- WCAG AA contrast ratio audit — all critical color pairs pass 4.5:1 minimum
- Collaboration roadmap re-sequenced behind identity/authorization foundation
- AI tool: `generate_test_plan` — fetches full project state for AI to write hardware test plans (FG-26)
- AI tool: `compare_components` — fetches BOM/architecture data for AI component comparison tables (FG-27)
- Dedicated ExportPanel component with 3 categories, 10 formats, per-format download state (UI-06)
- @dnd-kit drag-and-drop from component library to architecture canvas (IN-10)
- `component_lifecycle` table for tracking component lifecycle status, alternate parts, and data sources (FG-32)
- CRUD routes for component lifecycle at `/api/projects/:id/lifecycle` (FG-32)
- Netlist comparison engine in `shared/netlist-diff.ts` — diff two circuit netlists by component and net (FG-33)
- Netlist diff endpoint `POST /api/circuits/:circuitId/netlist-diff` with baseline comparison (FG-33)
- BOM Comparison tab in ProcurementView — Tabs layout with BOM Management + BOM Comparison/BomDiffPanel (UI-34)
- Net class management UI (`NetClassPanel.tsx`) — create/edit net classes with trace width, clearance, via diameter, color-coded badges (UI-14)
- JSDoc documentation across all 11 AI tool modules in `server/ai-tools/` (TD-29)
- AI tool: `suggest_components` — analyzes architecture/BOM/circuits for missing components across 9 categories (IN-05)
- AI tool: `design_review` — comprehensive design review across 7 categories with severity-rated findings (IN-18)
- X-Request-Id header on all HTTP responses with client-side error propagation (CAPX-OBS-04)
- Database transactions for `updateBomItem` and `updateComponentPart` preventing race conditions (CAPX-ARCH-02-EXP)
- Auth regression test suite — 92 tests covering 6 security implementations (CAPX-TEST-01)
- Storage transaction tests — 15 tests covering atomic BOM/component updates (CAPX-ARCH-02-EXP)

### Changed
- React.memo coverage increased to 29+ components across 24 files (from 9 initial)
- Export generators decomposed from 1,211-line monolith into 15 individual modules + types under `server/export/`
- `circuit-routes.ts` (1,804 lines) decomposed into 13 domain files under `server/circuit-routes/` (TD-16)
- `parseLocalIntent` (CCN=102) refactored to IntentHandler registry pattern with 11 handler modules (TD-05/EN-19)
- Test suite expanded from ~350 tests (Wave 1) to 1,553 tests across 54 files
- AI tool count increased from 53 to 82
- Database schema expanded from 11 to 27 tables
- Domain routers expanded from 18 to 21; circuit routers from 11 to 13
- ProcurementView refactored from single-panel to tabbed layout (BOM Management + BOM Comparison)

### Fixed
- DRCRuleType union extended to include all implemented rule types
- Various TypeScript strict mode compliance fixes across test files

## [0.1.0] - 2026-02-15

### Added
- Initial release: architecture block diagrams, BOM management, circuit schematic editor
- AI chat with 82 AI tools (Anthropic Claude + Google Gemini)
- Design validation (DRC/ERC)
- Multi-format export: KiCad, Eagle, SPICE, Gerber, drill, pick-and-place
- Dark theme with Neon Cyan accent
