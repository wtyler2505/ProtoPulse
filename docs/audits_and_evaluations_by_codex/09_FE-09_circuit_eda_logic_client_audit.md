# FE-09 Audit: Circuit/EDA Logic (Client)

Date: 2026-03-06  
Auditor: Codex  
Section: FE-09 (from master map)  
Method: Code + test-surface inspection only (no vitest runtime per user direction).

## Scope Reviewed
- Circuit editor domain logic:
  - `client/src/lib/circuit-editor/breadboard-model.ts`
  - `client/src/lib/circuit-editor/erc-engine.ts`
  - `client/src/lib/circuit-editor/wire-router.ts`
  - `client/src/lib/circuit-editor/view-sync.ts`
  - `client/src/lib/circuit-editor/svg-export.ts`
- PCB domain logic:
  - `client/src/lib/pcb/maze-router.ts`
  - `client/src/lib/pcb/trace-router.ts`
  - `client/src/lib/pcb/pcb-drc-checker.ts`
  - `client/src/lib/pcb/net-pad-mapper.ts`
  - `client/src/lib/pcb/net-class-rules.ts`
  - `client/src/lib/pcb/footprint-library.ts`
  - `client/src/lib/pcb/via-model.ts`
- Additional FE-09 core modules:
  - `client/src/lib/drc-scripting.ts`
  - `client/src/lib/copper-pour.ts`
- Integration surfaces checked for contract compatibility:
  - `client/src/components/views/pcb-layout/TraceRenderer.tsx`
  - `client/src/components/views/pcb-layout/ComponentPlacer.ts`
  - `client/src/components/views/pcb-layout/PCBBoardRenderer.tsx`
  - `shared/schema.ts`
- Test surface reviewed:
  - `client/src/lib/circuit-editor/__tests__/breadboard-model.test.ts`
  - `client/src/lib/circuit-editor/__tests__/erc-engine.test.ts`
  - `client/src/lib/circuit-editor/__tests__/wire-router.test.ts`
  - `client/src/lib/__tests__/maze-router.test.ts`
  - `client/src/lib/__tests__/maze-router-rip-up.test.ts`
  - `client/src/lib/__tests__/trace-router.test.ts`
  - `client/src/lib/__tests__/pcb-drc-checker.test.ts`
  - `client/src/lib/__tests__/net-pad-mapper.test.ts`
  - `client/src/lib/__tests__/drc-scripting.test.ts`
  - `client/src/lib/__tests__/copper-pour.test.ts`
  - `client/src/lib/__tests__/net-class-rules.test.ts`
  - `client/src/lib/__tests__/footprint-library.test.ts`
  - `client/src/lib/__tests__/via-model.test.ts`

## Severity Key
- `P0`: security/data-loss now
- `P1`: high user-impact break risk
- `P2`: medium reliability/UX/performance risk
- `P3`: low risk, cleanup/quality

## Findings

### 1) `P0` `drc-scripting` sandbox can be escaped
Evidence:
- `client/src/lib/drc-scripting.ts:102`
- `client/src/lib/drc-scripting.ts:117`
- `client/src/lib/drc-scripting.ts:244`
- `client/src/lib/drc-scripting.ts:256`

Local reproduction:
- Command: `npx -y tsx -e "... ({}).constructor.constructor('return globalThis')() ..."`
- Output: `{"passed":false,"violations":["escape"]}`

What is happening:
- Sandbox relies on shadowing globals in `new Function(...)` parameters.
- Constructor chain escape still gets ambient global object.

Why this matters:
- User-provided script code can execute outside intended constraints.
- This is a direct code execution/sandbox integrity failure.

Fix recommendation:
- Stop using raw `new Function` as sandbox boundary.
- Run scripts in a dedicated Worker/iframe realm with message-only API and hard capability whitelist.
- Add explicit deny tests for constructor-chain escape payloads.

---

### 2) `P0` `drc-scripting` timeout is not enforceable against non-throwing infinite loops
Evidence:
- `client/src/lib/drc-scripting.ts:249`
- `client/src/lib/drc-scripting.ts:257`
- `client/src/lib/drc-scripting.ts:260`

Local reproduction:
- Command: `timeout 3s npx -y tsx -e "... while(true) {} ..."; echo EXIT:$?`
- Output: `EXIT:124`

What is happening:
- Timeout check is only evaluated in `catch` after script returns/throws.
- Busy loops never yield, so engine cannot enforce `MAX_EXECUTION_MS`.

Why this matters:
- UI freeze or hung thread risk from a single script.
- Validation pipeline can be effectively DoS’d by script content.

Fix recommendation:
- Execute scripts in Worker and terminate worker after deadline.
- Add watchdog/preemption test with intentional infinite loop payload.

---

### 3) `P1` `view-sync` can generate duplicate breadboard wires when `partsMap` is absent
Evidence:
- `client/src/lib/circuit-editor/view-sync.ts:212`
- `client/src/lib/circuit-editor/view-sync.ts:218`
- `client/src/lib/circuit-editor/view-sync.ts:262`
- `client/src/lib/circuit-editor/view-sync.ts:302`
- `client/src/lib/circuit-editor/view-sync.ts:332`

Local reproduction:
- Command path uses `syncSchematicToBreadboard(...)` with already matching wire but no `partsMap`.
- Output: `{"toCreate":1,"toDelete":0,"conflicts":0}`

What is happening:
- Without part metadata, endpoint resolution emits empty `pinId`.
- Existing wire signature set ignores empty pin IDs, so matches are missed.

Why this matters:
- Sync can repeatedly create duplicates for already-wired connections.

Fix recommendation:
- Add fallback signature mode for no-`partsMap` operation (instance-instance coarse signature).
- Or require `partsMap` for create/delete authority and degrade to conflict-only mode if missing.

---

### 4) `P1` `view-sync` masks stale same-net wires as “accounted”
Evidence:
- `client/src/lib/circuit-editor/view-sync.ts:326`
- `client/src/lib/circuit-editor/view-sync.ts:334`
- `client/src/lib/circuit-editor/view-sync.ts:369`
- `client/src/lib/circuit-editor/view-sync.ts:381`

Local reproduction:
- Scenario with one valid wire and one stale wire on same net.
- Output: `{"toCreate":0,"toDelete":0,"conflicts":0}`

What is happening:
- After segment checks, code marks **all** wires for a net as accounted.
- Unmatched stale wires on that net bypass stale/conflict reporting.

Why this matters:
- Drift can silently persist between schematic truth and breadboard reality.

Fix recommendation:
- Only account exact matched wire IDs.
- Keep unmatched same-net wires eligible for conflict reporting in step 2.

---

### 5) `P1` `maze-router` layer contracts are inconsistent and lossy
Evidence:
- `client/src/lib/pcb/maze-router.ts:33`
- `client/src/lib/pcb/maze-router.ts:36`
- `client/src/lib/pcb/maze-router.ts:87`
- `client/src/lib/pcb/maze-router.ts:776`
- `client/src/lib/pcb/maze-router.ts:797`
- `client/src/lib/pcb/maze-router.ts:809`
- `client/src/components/views/pcb-layout/PCBBoardRenderer.tsx:241`
- `client/src/components/views/pcb-layout/PCBBoardRenderer.tsx:245`

Local reproductions:
- `B.Cu` request route output: `{"layer":"front","vias":0}`
- Cross-layer request output: `{"layer":"back","vias":1,"points":4}`

What is happening:
- `layerNameToIndex` only recognizes `'back'`, so `'B.Cu'` normalizes incorrectly.
- `RoutedNet` stores one `layer` string even when route includes vias/layer changes.
- Progressive blocking uses that single layer for all segments.

Why this matters:
- Layer interpretation drift can misroute or mis-render traces.
- Multi-layer path occupancy/clearance accounting is not faithfully represented.

Fix recommendation:
- Introduce canonical layer normalizer supporting `front/back` and `F.Cu/B.Cu`.
- Represent routed wires as per-segment layer geometry (not one net-level layer).

Inference note:
- Segment-layer loss impact on blocking is inferred from data model + blockPath behavior.

---

### 6) `P1` `copper-pour` obstacle processing is layer-blind and can inflate filled area above boundary area
Evidence:
- `client/src/lib/copper-pour.ts:52`
- `client/src/lib/copper-pour.ts:61`
- `client/src/lib/copper-pour.ts:69`
- `client/src/lib/copper-pour.ts:686`
- `client/src/lib/copper-pour.ts:742`
- `client/src/lib/copper-pour.ts:758`
- `client/src/lib/copper-pour.ts:269`

Local reproductions:
- Baseline fill (no obstacle): `{"area":10000,"polyCount":1}`
- With one trace obstacle: `{"areaF":10800,"areaB":10800}`

What is happening:
- Obstacles have no `layer` field, so they are applied to all zone layers.
- Subtractive clipping path can return geometry whose computed area exceeds original zone area.

Why this matters:
- Physically invalid copper results are possible.
- Same obstacle affecting both F.Cu and B.Cu without explicit layer intent is unsafe.

Fix recommendation:
- Add explicit obstacle layer metadata and filter by `zone.layer`.
- Replace/guard `clipPolygons` with robust polygon boolean operations and area sanity checks (`filledArea <= boundaryArea` for subtractive operations).

---

### 7) `P2` `trace-router` can emit one-point wires that renderers ignore
Evidence:
- `client/src/lib/pcb/trace-router.ts:356`
- `client/src/lib/pcb/trace-router.ts:357`
- `client/src/components/views/pcb-layout/TraceRenderer.tsx:45`
- `client/src/components/views/pcb-layout/TraceRenderer.tsx:46`

Local reproduction:
- Command path `startTrace(...); finishTrace();`
- Output: `{"wireCount":1,"points":1}`

What is happening:
- Final segment is committed when `vertices.length >= 1`.
- UI trace renderer returns `null` for `< 2` points.

Why this matters:
- Router can report a “created” wire that never appears.
- Hidden invalid wire data can leak into downstream logic.

Fix recommendation:
- Require at least 2 distinct points before committing a wire segment.
- Treat no-movement finish as explicit no-op result.

---

### 8) `P2` Net-to-pad mapping is too narrow: numeric-only pins, no PCB side mirroring
Evidence:
- `client/src/lib/pcb/net-pad-mapper.ts:244`
- `client/src/lib/pcb/net-pad-mapper.ts:247`
- `client/src/lib/pcb/net-pad-mapper.ts:261`
- `client/src/lib/pcb/net-pad-mapper.ts:264`
- `client/src/components/views/pcb-layout/ComponentPlacer.ts:62`
- `shared/schema.ts:321`

What is happening:
- Pin resolution depends on `parseInt(pinName, 10)` numeric pad match.
- Absolute pad position rotation/translation does not incorporate `pcbSide` mirror behavior.

Why this matters:
- Non-numeric pin naming conventions cannot map.
- Back-side component geometry can be positioned incorrectly in ratsnest/mapping logic.

Fix recommendation:
- Support connector ID/name aliases and explicit pin map tables.
- Mirror pad coordinates for `pcbSide === 'back'` before rotation/translation.

---

### 9) `P2` `copper-pour` getters leak mutable internal state (shallow clone only)
Evidence:
- `client/src/lib/copper-pour.ts:531`
- `client/src/lib/copper-pour.ts:533`
- `client/src/lib/copper-pour.ts:537`
- `client/src/lib/copper-pour.ts:540`

Local reproduction:
- Mutate `engine.getZone(id)!.boundary[0].x = 999;`
- Re-read output: `{"mutated":true,"first":{"x":999,"y":0}}`

What is happening:
- `getZone/getAllZones/getZonesByLayer/getZonesByNet` return shallow copies.
- Nested `boundary` arrays and points remain shared references.

Why this matters:
- External callers can mutate engine internals without `updateZone`.
- Fill cache/state correctness can drift silently.

Fix recommendation:
- Deep clone nested structures on read APIs (or freeze returned objects).

---

### 10) `P3` `clipPolygons` hole encoding is fragile for downstream geometry consumers
Evidence:
- `client/src/lib/copper-pour.ts:298`
- `client/src/lib/copper-pour.ts:315`
- `client/src/lib/copper-pour.ts:320`
- `client/src/lib/copper-pour.ts:326`

Local observation:
- Contained clip case returns stitched outer+inner path with bridge/repeated points (single polygon with 11 vertices).

What is happening:
- Hole handling is represented as bridged polyline instead of explicit polygon-with-hole model.

Why this matters:
- Downstream perimeter/min-width heuristics and exporters may misinterpret geometry.

Fix recommendation:
- Represent fill as explicit shell + holes (or use library output that preserves that structure).

## Test Coverage Assessment (this section)

What exists:
- FE-09 has substantial direct unit coverage across circuit and PCB logic modules.
- `maze-router`, `trace-router`, `pcb-drc-checker`, `net-pad-mapper`, `drc-scripting`, and `copper-pour` all have dedicated suites.

Key gaps:
- No dedicated tests found for `view-sync.ts` (`syncSchematicToBreadboard`, `syncBreadboardToSchematic`, `detectConflicts`).
- `drc-scripting` tests do not include constructor-chain escape payloads or non-yielding timeout/preemption tests.
- `maze-router` tests do not validate `B.Cu/F.Cu` input normalization and do not assert per-segment layer fidelity across via routes.
- `net-pad-mapper` tests do not cover `pcbSide: 'back'` mirroring behavior.
- `copper-pour` tests do not enforce subtractive area invariant (`filled area must not exceed boundary area`) under trace obstacle clipping.
- No test found for `copper-pour` getter immutability of nested `boundary` data.

Execution notes:
- Per user direction, this pass is inspection-only and does not run vitest.

## Improvements / Enhancements / Additions (beyond bug fixes)

### A) Introduce a canonical EDA layer vocabulary
- One shared layer normalizer across routing, rendering, and fill (`front/back` + `F.Cu/B.Cu` aliases).

### B) Move user-scripted DRC to isolated execution
- Worker-bound execution with hard timeout + deterministic message API.

### C) Harden geometry core with invariants
- Post-operation invariants for polygon validity, area bounds, and non-self-intersection checks where required.

### D) Promote sync logic to explicit “trust mode”
- `strict` mode (requires full parts metadata) vs `best-effort` mode (no destructive writes).

### E) Add side-aware footprint mapping pipeline
- Resolve pin aliases + package pin maps + `pcbSide` mirroring in one shared utility.

## Decision Questions Before FE-10
1. Should custom DRC scripts remain unrestricted JavaScript, or do we move to a constrained DSL/runtime immediately?
2. Do we standardize internal layer names as `front/back` with adapter boundaries, or switch all internals to `F.Cu/B.Cu`?
3. For cross-view sync, should missing `partsMap` block auto-create/delete and downgrade to conflict-only mode?

## Suggested Fix Order (practical)
1. Sandbox escape + timeout preemption in `drc-scripting` (`P0`).
2. `view-sync` duplicate/stale-accounting correctness (`P1`).
3. `copper-pour` layer attribution + area invariant guardrails (`P1`).
4. `maze-router` layer normalization + multi-layer route representation (`P1`).
5. `trace-router` one-point wire guard (`P2`).
6. `net-pad-mapper` side-aware and non-numeric pin mapping (`P2`).
7. `copper-pour` deep-copy immutability fixes (`P2`).
8. Clip/hole geometry model cleanup (`P3`).

## Bottom Line
FE-09 has strong algorithmic ambition and broad test presence, but several correctness contracts are still brittle at security, sync, and geometry boundaries. The immediate blockers are script execution safety (`P0`) and deterministic cross-view/domain correctness (`P1`). Fixing those first will make subsequent simulation and manufacturing-facing logic much more trustworthy.
