# Changelog

All notable changes to ProtoPulse are documented in this file.

## 2026-06-11 — failure puzzle #1: the bus that never reads high

### Added
- **The failure-puzzle system** (Vol III §1.4): a broken design + a
  symptom + the instruments; solved when you ANNOTATE the actual
  root-cause net/component on the schematic — solved-ness is a property
  of the design's own op-log (annotate ops), not a quiz UI. PuzzleSchema
  in @protopulse/content, puzzles ship as content/puzzles/<id>/
  {puzzle.json, design.ppx.json}, Puzzles tab in the editor (symptom,
  suggested instruments, progressive hints, mark-selection-as-root-
  cause, explanation revealed on solve; wrong marks stay in history —
  debugging leaves tracks).
- **slow-rise-11** from the catalog: an open-collector bus whose 100k
  pull-up against ~10nF of bus capacitance (τ ≈ 1ms) never reaches a
  valid high between driver pulses. ERC passes — the bug is legal
  electricity with wrong values; the transient tells the story.

### Verified
- The puzzle premise is PHYSICS-TESTED in real ngspice: the broken bus
  peaks <2.5V in steady state; swapping the pull-up to 4.7k puts it
  >3.5V. Schema/anchor/ERC/checker tests alongside. Browser-verified
  end-to-end: load → hint → select R1 on canvas → mark → ✔ solved.

## 2026-06-11 — the Router: fourth crew member

### Added
- **The Router** (`runRouter` in @protopulse/ai + Router tab in the
  editor): copper is geometry, clearance is law, the ratsnest is a
  to-do list. Four tools — read_board (placements/traces/ratsnest
  digest), route_connection (walk-first; shove when walk reports no
  corridor; refusals surface as tool errors the model adapts to),
  run_drc, remove_trace. Engines are dependency-injected (RouterHooks,
  pinned like sim-types): the app wires the REAL walkaround/shove/DRC
  stack — the same machinery the human trace tool drives.
- Routes apply to a working copy inside the loop (Draftsman pattern);
  on completion they land in the session as ONE undoable batch with
  meta {agent: 'router'} — blameable and syncable like any edit.
- Ratsnest segments now carry their endpoint port refs (aPort/bPort),
  so airwires can be named ("R1:2 → R2:1") by every consumer.

### Verified
- 5 ai tests (FakeProvider end-to-end: read → walk refusal → shove →
  DRC-clean on the working copy; destructive confirm gate) + 5 app
  host tests over the REAL engines (labeled ratsnest, walk routes
  emptying the ratsnest, shove with victim ops, deck-loading refusal,
  real DRC findings). Live Anthropic runs need Tyler's key (same as
  Analyst/Professor).

## 2026-06-11 — CI circuit badges

### Added
- `protopulse check --badge <file>`: a shields-style SVG of the check
  result — green "ERC clean", amber "clean · N warnings", red
  "N errors" or "corrupt log". Deterministic by construction (flat
  per-char text metrics, no timestamps) and honest by design: the
  badge writes even when the same run fails the pipeline, so a
  hardware repo's README always shows the truth. Real artifact for the
  555 fixture committed at docs/badges/ and embedded in
  packages/README.

## 2026-06-11 — the sync relay: real-time collaboration

### Added
- **`@protopulse/relay`**: a tiny in-memory WebSocket room server. One
  room = one shared op-log; the relay unions envelopes by (actor,
  lamport) and broadcasts the news — it never interprets ops and never
  resolves conflicts, because materialize's (lamport, actorId) total
  order makes same-set ⇒ same-graph. Schema-validated frames, batch/
  message caps, rooms survive everyone leaving. `npm run -w
  @protopulse/relay dev` → ws://localhost:8787.
- **Sync tab in the editor**: connect to a relay room and edits flow
  both ways live. Joining sends your log, the snapshot brings theirs,
  every local dispatch pushes deltas; remote ops ingest without
  touching the undo stack (you can't undo someone else's edit — your
  own undos sync as inverse ops). SessionCore grew `ingest` (dedupe +
  lamport clock advance).
- Honest v1 notes shipped in the panel itself: main branch only,
  in-memory rooms, one tab per design per browser profile.

### Verified
- 6 relay tests (snapshot/union/dedupe/peers/validation/room
  persistence) + 4 app integration tests running TWO REAL session
  stores through a real in-process relay over Node's native WebSocket —
  bidirectional edits, concurrent-edit convergence, undo propagation.
- Two-browser live demo: an empty editor joined a room and received
  the full design; an edit in browser A appeared on browser B's canvas
  within a second.

## 2026-06-10 — shove + spring-back routing (E.1 steps 2–3)

### Added
- **Shove mode** on the PCB trace tool: the new trace goes where you
  drew it; different-net traces in the way are re-routed around it by
  the walkaround engine (`planShove` in @protopulse/route) — victims
  plan sequentially with cumulative obstacle insertion so the final
  configuration is mutually clear by construction. Hull-cluster merging
  makes detours around shover-touching pads possible. Honest cuts:
  pads/vias never move, victims re-route end-to-end, single-level shove
  (cascades refuse with a reason).
- **Spring-back**: deleting the shover restores its victims to their
  pre-shove paths — read straight from the op-log (shove commits are
  batches labeled 'shove'). A victim only springs back if the user
  hasn't re-routed it since AND the original path is still
  clearance-legal. Rides in the same delete batch, so undo is atomic.
- The 'manual | walk | shove' mode chips on the trace toolbar — and the
  walk mode is now actually wired to the tool (the engine landed in the
  v0.4 slice; the toggle claim preceded the wiring — debt paid).

### Verified
- 11 new engine tests + 4 tool tests + 6 spring-back tests; browser
  end-to-end: shove flashed "Shoved 1 trace(s) aside" with the victim
  visibly detouring, deleting the shover restored its straight path.

## 2026-06-10 — sim ghost overlay (voltages painted on the wires)

### Added
- **Canvas ghost**: after an op or transient run, every net on the
  schematic tints by its solved voltage — cold blue at the range floor,
  warm orange at the ceiling — with a gradient legend (instant label +
  min/max) in the Sim panel and a hide button. Honesty built in: only
  op/tran produce a ghost (AC/noise/sweeps have no single per-net
  voltage), and the ghost carries a (branch, opsVersion) stamp — edit
  anything and it vanishes instead of lying. Renderer grew a generic
  per-node `tint` overlay channel (lowest priority, under selection/
  highlight/diff).

## 2026-06-10 — blame on canvas (the op-log trilogy completes)

### Added
- **History (blame) in the Inspector**: select any component or net and
  see every op that ever touched it — who (actor), when (timestamp),
  what (op summary, batch-aware), and why (meta.rationale on AI/fix
  ops, agent chip included). Click an entry to time-travel to that
  exact moment in the History tab. Pure op-log filter (`blameFor`) —
  no new state, the envelopes always had the answers. With replay
  (watch history), merge (combine histories), and blame (interrogate
  history), the op-log thesis is now fully user-facing.

## 2026-06-10 — serverless share links (v0.6 first slice, early)

### Added
- **Copy share link** in the Export panel: the whole DesignBundle —
  op-log, branches and all — deflate-compressed (native
  CompressionStream, no deps) and base64url-encoded into the URL
  fragment. No server, no upload; the fragment never leaves the
  browser. Receiving end loads after a confirm guard (never silently
  replaces a working design; empty sessions load directly) and strips
  the hash. Browser-verified: the 67-op traffic-light-555 travels as a
  2,129-char URL and lands intact in a pristine browser.

## 2026-06-10 — interactive merge resolver (M1 straggler closed)

### Added
- **Merge in the Branches panel**: any branch merges into the current
  one. Engine half in `@protopulse/graph`: `BranchLog.mergeBaseOps`
  (nearest-common-ancestor prefix across forks, siblings, nested
  branches) and `resolveConflict` (one conflict + one ours/theirs pick →
  ops; returns null for picks M1 cannot express, so the UI disables
  them instead of lying). UI half: auto-merged changes listed, every
  conflict an explicit pick, Apply gated until all are decided; the
  merge lands as ONE undoable batch with `parents: [ours, theirs]`
  recorded in the op-log. Verified end-to-end in the browser: forked
  value conflict (47k vs 1k) surfaced, resolved theirs, landed.
- 17 new tests (engine merge-base topologies + every resolveConflict
  path; store merge workflow incl. stale-merge invalidation); graph
  coverage gate held.

## 2026-06-10 — time-lapse replay (History tab) + demo media rig

### Added
- **History tab** in the new editor: time-lapse replay of the op-log.
  The design IS its op-log, so any moment is a prefix materialization —
  scrub the slider, press play (3 speeds), or click any op to jump.
  Every graph reader (canvas, Inspector) follows the scrub position;
  the session is read-only until "Back to live" (dispatch/undo/redo
  refuse, branch switches exit replay). Status bar shows ⏪ replay k/N.
- `describeOp` — one human-readable line per op kind for the History
  list (pure, payload-only; ops are self-contained by design).
- Demo media rig: `tools/screenshots/capture-gif.ts` (co-sim story →
  `cosim-demo.gif`) and `capture-replay-gif.ts` (the 555 fixture
  building itself via the real History scrubber → `replay-demo.gif`),
  encoded pure-JS (gifenc + pngjs) with global palette + inter-frame
  diff transparency. Embedded in README and USER_GUIDE §19.

## 2026-06-10 — walkaround routing + the Lab stragglers

### Added
- `@protopulse/route`: walkaround interactive routing (Vol II E.1 first
  slice) — obstacle hulls inflated by clearance+width, flatbush broad
  phase, CW/CCW corner walks with recursion cap; 'manual | walk' toggle
  on the PCB trace tool with blocked-corridor refusal. 39 tests.
- Sim worker (ngspice off the main thread, node fallback preserved),
  plot FFT (radix-2 + Hann over resampled windows, per-trace toggle,
  log-x dB spectrum plot), AC-capable battery/rail emitters via
  fields.ac — graph-driven .ac and .noise now run end-to-end.
- Seam fixes from the parallel build: distributive worker-request types,
  traceMode initializer, and the FFT spectrum plot actually rendered
  (the computation existed; the lint gate caught the missing render).

## 2026-06-10 — v0.5 third slice: the loop closes

### Added
- `@protopulse/emu`: ADC peripheral (datasheet-accurate 25/13-clock
  conversions, completion-time host sampler — the D.3 hard sync point),
  assembler grows CPI/branch opcodes; bang-bang firmware verified
  reacting to analog input. 69 emu tests.
- `@protopulse/cosim`: runCosimClosedLoop — conservative quantum loop
  with comparator-fed digital inputs (VIH/VIL + hysteresis), ADC
  sampling against the previous solve, and loudly-counted from-zero
  re-solves. THE closed-loop test passes: firmware charges an RC node
  through its own pin, reads it back, and regulates — sustained
  oscillation around its 2.5V threshold. 65 cosim tests.
- App: closed-loop mode in the Co-sim panel (input/ADC bindings,
  quantum field, re-solve/ADC-read honesty readout). 304 app tests.

### Known gaps (ROADMAP.md)
- WebSerial flashing (hardware required), RP2040/ESP32 cores, solver
  state continuity (currently O(quanta²) re-solves, counted honestly).

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
