---
name: DRC gate is a pure function pipeline stage that blocks manufacturing export without touching the database
description: server/export/drc-gate.ts implements a pre-export validation gate as a pure function — no Express routes, no storage access, no side effects — that runs 6 ordered DRC rules and returns a pass/fail verdict, acting as a pipeline stage between data gathering and Gerber/drill/pick-and-place generation
type: insight
category: architecture
source: extraction
created: 2026-03-14
status: active
evidence:
  - server/export/drc-gate.ts:1-11 — header explicitly states "no Express routes, no database access, no side effects"
  - server/export/drc-gate.ts:234-241 — DRC_RULES array orders 6 rule functions for sequential execution
  - server/export/drc-gate.ts:265-284 — runDrcGate() is pure: input→output, no mutations, no IO
  - server/export/drc-gate.ts:270 — pre-filters wires to PCB view only (w.view === 'pcb')
---

# DRC Gate Is a Pure Function Pipeline Stage That Blocks Manufacturing Export Without Touching the Database

The DRC gate (`server/export/drc-gate.ts`) is architecturally unique among the export modules because it is a **blocking validation stage** in the export pipeline, not a format converter. While all other modules in `server/export/` transform data into output files (Gerber, drill, KiCad, etc.), the DRC gate transforms data into a pass/fail verdict.

**Pipeline position:** Callers must run `runDrcGate(input)` and check `result.passed` before invoking Gerber/drill/pick-and-place generators. This is enforced by the calling code, not by the module itself — the DRC gate has no knowledge of what happens next.

**Pure function design:** The module explicitly avoids any runtime dependencies:
- No Express `Request`/`Response` types
- No `IStorage` or database imports
- No `logger` or side effects
- Input is a plain data structure (`DrcGateInput`), output is a plain result (`DrcGateResult`)

This makes it testable in isolation and usable from any context (AI tools, export routes, client-side preview).

**Rule architecture:** Six rules execute sequentially via a shared mutable `DrcContext` — each rule pushes violations to `ctx.violations[]`. The rules are ordered from cheapest to most expensive:
1. `checkComponentPlacement` — O(n) instances
2. `checkUnroutedNets` — O(n) nets + wires
3. `checkMinTraceWidth` — O(n) wires
4. `checkTraceOutOfBounds` — O(n*m) wire points
5. `checkBoardOutline` — O(1)
6. `checkTraceClearance` — O(n²) wire pairs

**Flood prevention:** The clearance check (`checkWirePairClearance`) emits at most one violation per wire pair and uses early return to avoid O(n²*m²) point comparisons. The trace-out-of-bounds check uses `break` after the first violation per wire.

**Counter-intuitive detail:** The DRC gate filters wires by `w.view === 'pcb'` at the top, meaning schematic/breadboard wires (which exist in the same `CircuitWireRow` table) are silently excluded. This is correct — schematic wire coordinates are in arbitrary pixel space, not in mm — but it means the same `runDrcGate()` function could appear to pass on a project with no PCB-view wires at all (no violations because no wires to check), which is only caught by `checkUnroutedNets`.

---

Related:
- [[circuits-zero-defaulting-in-export-and-ordering-is-a-latent-multi-project-regression-because-it-silently-picks-the-wrong-circuit]] — export modules default missing PCB coordinates to 0, which the DRC gate would catch as out-of-bounds
- [[export-modules-use-a-shared-data-adapter-layer-decoupled-from-drizzle-row-types]] — the DRC gate uses its own DrcGateInput adapter, paralleling the export module pattern but independent of it
- [[drc-engine-exports-two-completely-separate-rule-systems-from-one-file-creating-a-hidden-api-surface-split]] — the DRC gate is a third DRC system (export-specific rules) alongside the component and PCB engines in shared/drc-engine.ts
