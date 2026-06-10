# Changelog

All notable changes to ProtoPulse are documented in this file.

## 2026-06-10 — v0.5 second slice: the co-sim bus (the crown jewel, one way)

### Added
- `@protopulse/cosim`: firmware GPIO edges become PWL sources behind a
  series-Rout behavioral boundary, injected via sim's additive
  extraCards hook. The thesis test runs real avr8js blink firmware into
  a real ngspice RC low-pass: 0.94Vpp settled ripple measured vs ~0.9Vpp
  predicted. 31 tests.
- App: Co-sim panel — pin→net bindings, window/step controls, the Vol II
  D.3 slowdown-factor honesty readout, digital traces stacked above the
  analog response in one plot. Shared emu session with a documented
  suspend/reset borrow protocol. 36 new tests (app at 284).

### Known gaps (ROADMAP.md)
- Feedback direction (digital inputs + ADC hard sync), WebSerial
  flashing, RP2040/ESP32 cores.

## 2026-06-10 — v0.5 first slice: The Bridge — firmware in the loop

### Added
- `@protopulse/emu`: ATmega328P emulation on avr8js — McuCore contract,
  cycle-stamped GPIO events, UART queues, Intel-HEX parser, and a
  documented mini-assembler so tests assemble their own firmware (the
  blink test asserts real edges on B5 at ~1206-cycle spacing). 47 tests.
- App: Firmware panel — HEX load, frame-budgeted run/pause, serial
  monitor with input, stacked square-wave pin traces. 33 new tests.

### Known gaps (ROADMAP.md)
- Co-sim bus, WebSerial flashing, ADC + remaining peripherals,
  RP2040/ESP32 cores.

## 2026-06-10 — v0.4 second slice: fab outputs + board rendering truth

### Added
- `@protopulse/export`: Gerber X2 copper layers (integer-nm FSLAX46, no
  float arithmetic in emission), Excellon drill, pick-and-place CSV;
  routed-led golden fixture freezes all fab artifacts byte-exact.
- Renderer: GL triangle pipeline — filled pads, real stroked trace
  widths with round caps/joins, vias as annuli with background drills;
  PCB scene delta sync (identity-preserving); side-flip (F key +
  Inspector) with mirrored bottom rendering.

### Known gaps (ROADMAP.md)
- Push-and-shove routing, zones/pours, panelization.

## 2026-06-10 — v0.4 first slice: The Board

### Added
- Graph: PCB ops are live — place/move/unplace_footprint, route_trace,
  place_via, remove_trace/via as id-keyed entities with GC, inverse,
  diff, and merge support; 100% core coverage gate held.
- Parts: footprint model with generic IPC-class seeds (0805, SOT-23,
  DIP-8), explicitly unverified-until-per-MPN.
- `@protopulse/drc`: width/clearance/annular/drill/unrouted checks
  against the shipped JLC deck. 34 tests.
- App: PCB mode — unplaced tray, footprint placement with rotation,
  octilinear trace tool with cross-net refusal, vias, dashed ratsnest,
  layer toggle, DRC panel with deck rev. 63 new app/renderer tests.

### Known gaps (ROADMAP.md)
- Push-and-shove, stroked widths/filled pads, Gerber export, in-browser
  visual QA of PCB mode.

## 2026-06-10 — v0.3 first slice: Design Review + the Professor

### Added
- `@protopulse/review`: the Vol II G.4 Design Review — embedded ERC,
  decoupling-per-IC (executable 100nF fix), power-tree rollup,
  unverified-parts-in-load-bearing-roles, unwired ICs, DNP-killed rails;
  stored/diffable ReviewReport with opened/closed deltas. 40 tests;
  golden Probe fixture reviews with zero errors.
- The Professor — depth-adjustable crew member with lookup_concept /
  explain_finding grounded in the concepts wiki; ReviewPanel's
  per-finding "Ask the Professor" handoff seeds it with the finding.
- The three teaching depths (do-it/show-me/teach-me): persisted dial,
  apply-fix narration through the status bar, teach-me auto-opens the
  mapped concept article.

## 2026-06-10 — v0.2 second slice: Monte Carlo, stepping, noise, the 555 lives

### Added
- `@protopulse/sim`: seeded Monte Carlo (R 5% / C 20% / L 10% defaults,
  deterministic mulberry32, value-override netlists), parameter stepping,
  .noise analysis (engine verified; input source must carry an AC value),
  and the NE555 behavioral macromodel — hysteretic discharge switch +
  regenerative latch; the golden traffic-light fixture oscillates at
  0.719-0.720s measured vs 0.721s theory. 69 sim tests.
- App: math channels (safe parser — v(a)-v(b), db/abs/mag, complex-aware),
  branch overlay with dashed traces and dual fidelity bars, Monte Carlo
  spaghetti + step trace families, noise UI. 129 app tests.

### Known gaps (ROADMAP.md)
- Sim worker + streaming; plot FFT; AC-source emitter for graph-driven
  noise.

## 2026-06-10 — v0.2 first slice: The Lab is live

### Added
- `@protopulse/sim`: deterministic graph→SPICE netlist generation with the
  model-tier honesty system (spice/behavioral/stub + fidelity manifest),
  op/tran/dc/ac analyses, ngspice-WASM engine wrapper (eecircuit-engine,
  MIT). 48 tests including real-WASM integration against the golden
  led-resistor fixture.
- App: "Sim" panel (analysis picker, fidelity bar with tier chips, trace
  list) and a dependency-free canvas plot workspace (engineering-notation
  axes, crosshair readout, dB/log-x for AC).
- The Analyst — second crew member ("skeptical of everything until it's
  plotted"): run_simulation/measure/read_design tools, shared runAgentLoop
  extracted from the Draftsman, first live Anthropic-wired panel
  (localStorage key with plain-text warning).
- Verified in-browser: golden LED circuit simulated end-to-end (1008-point
  transient; v(led_a)≈2.2 V, loop ≈20 mA — physically correct).

### Known gaps (tracked in ROADMAP.md)
- Noise/Monte-Carlo/param-step analyses, sim worker + streaming, NE555
  model (stub), plot math channels/FFT/branch overlays.

## 2026-06-10 — Milestone 1: the engine redesign lands

The first milestone of the ground-up redesign ("the vision", three volumes) landed on branch `claude/protopulse-vision-geapzy`: a greenfield npm-workspaces monorepo at `packages/` (`@protopulse/*`), living alongside the legacy app (`client/ server/ shared/` — untouched, still the shipping product; it migrates onto the engine in later milestones).

### Added
- `@protopulse/graph` — the core: one canonical design graph; every mutation a typed op; the design IS its op-log (JSON Lines), graph as materialized view. Integer-nm coordinates, UUIDv7 entities, deterministic materialization by (lamport, actorId), inverse-op undo, O(1) branches, visual diff (GraphDelta), three-way merge with conflicts as data. On-disk `.ppx` directory or `.ppx.json` bundle (spec: `packages/graph/README.md`). 100% branch coverage gate in CI.
- `@protopulse/parts` — minimal part model (ERC electrical pin types, 1.27mm-grid symbols, provenance tiers); 17 seed parts, NE555 + BAT54S pin maps datasheet-verified.
- `@protopulse/erc` — 10×10 pin-conflict matrix + net rules (floating inputs, unpowered supplies, single-port nets, open-collector pull-up with an executable fix, current budgets); every finding code maps to a concepts-wiki article.
- `@protopulse/export` — deterministic KiCad legacy-E netlist + CSV BOM; byte-exact golden-file tests in `tools/golden/`.
- `@protopulse/cli` — `protopulse check` / `export`: headless ERC in CI ("CI for circuits"), exit codes 0/1/2.
- `@protopulse/renderer` — WebGL2 retained scene graph, flatbush picking, canvas-glyph-atlas text, nm→px camera with LOD.
- `@protopulse/app` — the new schematic editor (port 5174): place/wire (Manhattan routing), undo/redo, branch switcher with green/amber diff overlay, ERC panel with apply-fix + concept links, KiCad/BOM/bundle export, Draftsman panel.
- `@protopulse/ai` — provider-agnostic agent runtime: zod tool registry with scope slices, destructive-confirm gating, explain() narration, budgeted context assembly; the Draftsman agent (exactly 8 tools); Anthropic adapter (browser-direct, user key); every applied op carries `meta {agent, rationale}` for op-log blame.
- `@protopulse/content` + `content/` — JLCPCB 2-layer DRC rule deck, 14 concept articles, curriculum Track 1 "First Light" steps 01–05 (machine-checkable `erc: clean` goals).
- Root commands `npm run check:packages` / `npm run test:packages`; packages CI workflow (`.github/workflows/packages-ci.yml`); ESLint coverage of `packages/` (zero errors). 346 package tests.

### Known gaps (M1)
- KiCad pcbnew import of the golden netlists awaits one manual verification (`tools/golden/README.md`).
- Merge conflicts surface as data; no interactive resolver UI yet.
- MSDF text and GPU picking deferred; ESP32-S3 part deferred.

## [Unreleased]

### Added (Wave 140)
- Snapshot restore cascade engine — `analyzeSnapshotDomains`, `generateRestorePlan`, cross-domain warnings, 46 tests (BL-0568)
- PCB geometry bridge — `extractTraceGeometries`, `traceGeometryToPdnInput`/`SiInput` converters, 34 tests (BL-0561)
- GPU Monte Carlo engine — async init with 3-attempt retry, GPU/CPU dispatch, dispose lifecycle, 28 tests (BL-0550)
- ISR safety scanner — 8 ISR rules, `findIsrBodies`, `scanForIsrViolations`, 58 tests (BL-0413)
- Dependency resolver — `extractIncludes`, 57 known library headers, `resolveDependencies` with conflict detection, 42 tests (BL-0404)

### Added (Wave 139)
- BOM tolerance bridge — `parseTolerance`, `bomItemsToToleranceSpecs`, tolerance column added to `bom_items`, 26 tests (BL-0574)
- PCB thermal bridge — `PACKAGE_THERMAL_DB` 15 packages, `extractThermalComponents`, 30 tests (BL-0562)
- BOM back-annotation — `BackAnnotationManager` singleton, `findMatchingInstances`, `generateBomBackAnnotationPatch`, 38 tests (BL-0563)
- PCB back-annotation — `syncRefDesChange`, `syncPropertyChange`, 29 tests (BL-0559)
- Design reuse schematic snippets — `SnippetCircuitInstance`/`SnippetCircuitNet`, `prepareForPlacement` circuit ID remapping, 3 built-in snippets with circuit data, 60 tests (BL-0583)

### Fixed (Wave 139)
- Chat message ordering — `chat-context.tsx` now sorts messages ascending by ID

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
