# BE-09 Audit: Export Pipeline

Date: 2026-03-06  
Auditor: Codex  
Section: BE-09 (from master map)  
Method: Code + test-surface inspection only (no runtime test suite execution).

## Scope Reviewed
- Export route layer:
  - `server/circuit-routes/exports.ts`
  - `server/routes/export-step.ts`
  - `server/routes/project-io.ts`
  - `server/routes/components.ts`
  - `server/circuit-routes/imports.ts`
  - `server/circuit-routes/utils.ts`
  - `server/routes/utils.ts`
  - `server/index.ts`
- Export generation layer:
  - `server/export/*.ts` (all 19 modules, including KiCad, Eagle, Gerber, Drill, ODB++, IPC-2581, PDF/FMEA, firmware scaffold, STEP, FZZ)
  - Deep reads:
    - `server/export/kicad-exporter.ts`
    - `server/export/eagle-exporter.ts`
    - `server/export/drc-gate.ts`
    - `server/export/fzz-handler.ts`
    - `server/component-export.ts`
    - `server/export/step-generator.ts`
- Storage contract shape used by exports:
  - `server/storage/circuit.ts`
- Test surface reviewed:
  - `server/__tests__/kicad-exporter.test.ts`
  - `server/__tests__/eagle-exporter.test.ts`
  - `server/__tests__/odb-export.test.ts`
  - `server/__tests__/ipc2581-export.test.ts`
  - `server/__tests__/pick-place-generator.test.ts`
  - `server/__tests__/export-snapshot.test.ts`
  - `server/__tests__/drc-gate.test.ts`
  - `server/__tests__/gerber-integration.test.ts`
  - plus export-related test inventory in `server/__tests__/`

## Export Surface Snapshot (Current)
- Export modules in `server/export/`: `19`
- Exported functions in `server/export/*.ts`: `59`
- Route endpoints:
  - `/api/projects/:projectId/export/*` in `server/circuit-routes/exports.ts`: `13`
  - `/api/projects/:id/export/step` in `server/routes/export-step.ts`: `1`
- Export-specific test files in `server/__tests__/`: `14` matched by export-related naming patterns

## Severity Key
- `P0`: can silently produce incorrect manufacturing/design output
- `P1`: high-impact reliability/safety gap
- `P2`: medium-risk correctness/performance/hardening gap
- `P3`: low-risk consistency cleanup

## Findings

### 1) `P1` Multi-circuit projects export the first circuit, not an explicit target
Evidence:
- Multiple endpoints call `getCircuitDesigns(projectId)` and then use `circuits[0]`:
  - `server/circuit-routes/exports.ts:53`
  - `server/circuit-routes/exports.ts:100`
  - `server/circuit-routes/exports.ts:198`
  - `server/circuit-routes/exports.ts:241`
  - `server/circuit-routes/exports.ts:301`
  - `server/circuit-routes/exports.ts:512`
  - `server/circuit-routes/exports.ts:575`
  - `server/circuit-routes/exports.ts:658`
- STEP export does the same with `designs[0]`:
  - `server/routes/export-step.ts:16-17`
- Storage returns circuit designs ordered ascending by id:
  - `server/storage/circuit.ts:20-24`

What is happening:
- Export selection is implicit (“oldest circuit”) rather than explicit (“selected circuit”).

Why this matters:
- In multi-circuit projects, users can export the wrong design even when data is valid.

Fix recommendation:
- Require `circuitId` (or selected design id) in export requests.
- If omitted, fail with a clear `400` instead of choosing `circuits[0]`.
- Add route tests for multi-circuit projects where `circuits[0]` is intentionally not the active design.

---

### 2) `P0` KiCad/Eagle wire-to-net mapping can silently assign wrong nets
Evidence:
- Route input passed to KiCad/Eagle omits net database IDs and includes only net names/types/segments:
  - KiCad route net mapping: `server/circuit-routes/exports.ts:260-264`
  - Eagle route net mapping: `server/circuit-routes/exports.ts:320-324`
- Wires still carry `wire.netId`:
  - KiCad route wires: `server/circuit-routes/exports.ts:265-267`
  - Eagle route wires: `server/circuit-routes/exports.ts:326-327`
- KiCad exporter explicitly uses array index proxy:
  - index-proxy comment: `server/export/kicad-exporter.ts:709-716`
  - PCB mapping by index: `server/export/kicad-exporter.ts:1016-1021`
  - fallback to net 0 when lookup misses: `server/export/kicad-exporter.ts:1031`
- Eagle exporter also maps net by array position:
  - schematic grouping by index: `server/export/eagle-exporter.ts:863-869`
  - board signal grouping by index: `server/export/eagle-exporter.ts:1077-1081`
- Test fixtures mostly use index-friendly `netId: 0`:
  - `server/__tests__/kicad-exporter.test.ts:96`
  - `server/__tests__/kicad-exporter.test.ts:200`
  - `server/__tests__/eagle-exporter.test.ts:89`
  - `server/__tests__/eagle-exporter.test.ts:96`
  - `server/__tests__/export-snapshot.test.ts:208`
  - `server/__tests__/export-snapshot.test.ts:265`

What is happening:
- Wire net references are treated as “array position,” not stable net identity.

Why this matters:
- Exports can produce wrong/unconnected net assignments without throwing an error.
- This is a hardware-output correctness risk, not just formatting debt.

Fix recommendation:
- Include `id` in KiCad/Eagle route net payloads.
- Update exporter input types to carry real net IDs and map by `id` (not index).
- Hard-fail export when a wire references an unknown net id.
- Add regression tests with non-sequential net IDs (for example `101`, `205`) and shuffled net array order.

---

### 3) `P1` DRC safety gate is only enforced on Gerber route
Evidence:
- DRC gate contract states pre-export checks for manufacturing outputs:
  - `server/export/drc-gate.ts:4-6`
- Route-level gate call is present on Gerber export:
  - import/use: `server/circuit-routes/exports.ts:104-106`
  - failure blocking behavior: `server/circuit-routes/exports.ts:131-138`
- Other manufacturing exports do not call `runDrcGate`:
  - pick-place route starts at `server/circuit-routes/exports.ts:186`
  - ODB++ route starts at `server/circuit-routes/exports.ts:555`
  - IPC-2581 route starts at `server/circuit-routes/exports.ts:638`
  - STEP export route starts at `server/routes/export-step.ts:8`

What is happening:
- Only one manufacturing path enforces DRC blocking.

Why this matters:
- Unsafe designs can still be exported through other manufacturing paths.

Fix recommendation:
- Introduce one shared preflight for all manufacturing exports.
- Make behavior explicit: `strict` (block on DRC errors) vs `warn` (attach warnings only).
- Add route tests proving DRC failure blocks each strict manufacturing endpoint.

---

### 4) `P1` FZZ import lacks archive bomb safeguards present in FZPZ import
Evidence:
- FZZ import immediately loads ZIP and iterates entries without cap checks:
  - `server/export/fzz-handler.ts:524-525`
  - loops over FZP files: `server/export/fzz-handler.ts:532-543`
  - loads SVG/metadata/sketch files repeatedly: `server/export/fzz-handler.ts:546-654`
- FZZ route accepts upload and calls `importFzz` directly:
  - `server/circuit-routes/imports.ts:7`
  - `server/circuit-routes/imports.ts:20-22`
- FZPZ import has explicit file-count and uncompressed-size guards:
  - limits: `server/component-export.ts:425-426`
  - file count guard: `server/component-export.ts:436-439`
  - uncompressed size guards: `server/component-export.ts:441-450`, `server/component-export.ts:514-520`

What is happening:
- One ZIP import path is hardened; another ZIP import path is not.

Why this matters:
- FZZ import can be stressed with oversized/malicious archives.

Fix recommendation:
- Mirror FZPZ guardrails in `importFzz`:
  - max entry count
  - max total uncompressed bytes
  - optional per-file max size
- Add tests for oversized archive rejection and normal archive acceptance.

---

### 5) `P2` Route payload limits rely on `Content-Length` header and can drift from real parser limits
Evidence:
- `payloadLimit` checks only `req.headers['content-length']`:
  - `server/routes/utils.ts:27-34`
- Global parsers enforce different actual caps:
  - JSON 1MB: `server/index.ts:144`
  - URL-encoded 1MB: `server/index.ts:146`
  - raw binary 5MB: `server/index.ts:148`
  - text 2MB: `server/index.ts:149`
- Routes declare per-endpoint limits that can exceed parser caps:
  - FZZ import declares 10MB: `server/circuit-routes/imports.ts:7`
  - KiCad import declares 10MB: `server/circuit-routes/imports.ts:117`

What is happening:
- Endpoint-level “max size” and actual body parser max are not always aligned.
- Missing/misleading `Content-Length` reduces effectiveness of route-level checks.

Why this matters:
- Limits are harder to reason about, and failure mode depends on transport details.

Fix recommendation:
- Make one canonical size policy per content type.
- Enforce byte limits while reading body (not header-only).
- Align route-declared limits with parser limits or raise parser limits intentionally where needed.

---

### 6) `P2` `Content-Disposition` filename sanitization is inconsistent
Evidence:
- Unsanitized names in export route headers:
  - FZZ: `server/circuit-routes/exports.ts:550`
  - ODB++: `server/circuit-routes/exports.ts:633`
  - IPC-2581: `server/circuit-routes/exports.ts:716`
- Project names are free text in schema:
  - `shared/schema.ts:8`
- Other paths already sanitize names before header usage:
  - project JSON export: `server/routes/project-io.ts:337-340`
  - component FZPZ export: `server/routes/components.ts:129-133`
  - STEP generator filename sanitization: `server/export/step-generator.ts:848-851`

What is happening:
- Some endpoints sanitize header filenames; others do not.

Why this matters:
- Inconsistent behavior can cause broken downloads and brittle header handling for edge-case names.

Fix recommendation:
- Add one shared helper for safe `Content-Disposition` filenames.
- Use it on every export endpoint.
- Add tests with project names containing quotes, slashes, and Unicode.

---

### 7) `P2` Project export has avoidable N+1 wire fetch pattern per net
Evidence:
- Inside each circuit, wires are fetched inside `nets.map(...)`:
  - `server/routes/project-io.ts:206-210`

What is happening:
- `getCircuitWires(circuit.id)` is called once per net, then filtered in memory.

Why this matters:
- Work scales with net count and can become expensive on larger designs.

Fix recommendation:
- Fetch all wires once per circuit, then group by `netId` in memory.
- Keep per-circuit `Promise.all` but remove per-net DB calls.

---

### 8) `P2` Route-level export/import test coverage is thin compared to generator tests
Evidence:
- `registerCircuitExportRoutes` appears only in route registration files, not tests:
  - `server/circuit-routes/index.ts:10`
  - `server/circuit-routes/index.ts:24`
  - `server/circuit-routes/exports.ts:16`
- No direct `fzz-handler` test references found under `server/__tests__`.
- `component-export` is only mocked in utility/abuse tests:
  - `server/__tests__/routes-utils.test.ts:37-39`
  - `server/__tests__/stream-abuse.test.ts:49-51`
- Exporter unit tests exist (good), but endpoint behavior remains mostly unverified.

What is happening:
- Core generator logic is tested, but route orchestration and hardening behavior are under-tested.

Why this matters:
- Regressions in request validation, circuit selection, or header behavior can ship unnoticed.

Fix recommendation:
- Add route integration tests for:
  - `/export/kicad`, `/export/eagle`, `/export/gerber`, `/export/pick-place`, `/export/fzz`, `/export/odb-plus-plus`, `/export/ipc2581`, `/export/step`
  - DRC gate pass/fail behavior
  - multi-circuit explicit selection
  - filename sanitization behavior
  - FZZ import archive-limit rejection

## What Is Already Good
- Export functionality is modularized by format (clear separation in `server/export/`).
- There is strong generator unit coverage for core formats (KiCad, Eagle, ODB++, IPC-2581, Gerber, drill, pick-place, netlist, DRC gate).
- Route schemas provide baseline input validation for dimensions/formats:
  - `server/circuit-routes/utils.ts:36-52`
- DRC gate module is implemented and reusable; it just needs consistent route wiring.
- Several routes already use filename sanitization patterns, proving there is an established pattern to reuse.

## Test Coverage Assessment (BE-09)
- Good:
  - Core file generators are exercised with multiple fixtures and snapshot checks.
  - DRC gate has dedicated test coverage.
- Gaps:
  - Route-level export orchestration is not deeply covered.
  - No direct FZZ handler hardening tests.
  - Missing regression tests for non-index net IDs and shuffled net arrays.

## Improvements and Enhancements (Open-Minded)
1. Add `ExportPreflight` service:
   - centralizes design selection, DRC policy, and filename sanitization.
2. Add `circuitId` as first-class export contract:
   - remove implicit “first design” behavior.
3. Add export diagnostics block in response:
   - include selected `circuitId`, net/wire counts, and DRC summary.
4. Add strict import safety profile for ZIP-based formats:
   - shared archive guard utility for FZZ/FZPZ and future ZIP imports.
5. Add route integration test matrix:
   - one smoke test per export endpoint + focused negative tests for hardening paths.
6. Add net mapping invariant checks:
   - block export when wire references unknown net IDs.

## Decision Questions Before BE-10
1. Should `circuitId` become required on all circuit-level export endpoints?
2. Should DRC blocking be mandatory for all manufacturing outputs or configurable per endpoint?
3. Do we want “strict fail” behavior on unknown wire/net mapping, or warning + best effort?
4. Should FZZ and FZPZ share one ZIP safety utility with identical limits?
5. Do we want a single export response contract (consistent metadata + files) across all formats?

## Suggested Fix Order
1. Fix `P0`: move KiCad/Eagle net mapping from index-based to ID-based and add regression tests.
2. Fix `P1`: enforce explicit circuit selection and DRC preflight for manufacturing exports.
3. Fix `P1`: harden FZZ import with archive limits.
4. Fix `P2`: unify filename sanitization and payload-size policy.
5. Fix `P2`: remove project export N+1 wire-fetch pattern.
6. Expand route integration coverage for export/import orchestration.

## Bottom Line
The export subsystem is broad and capable, but there are a few high-impact correctness and hardening gaps at the route/orchestration layer. The biggest immediate risk is silent net mis-assignment in KiCad/Eagle exports due to index-based mapping. Locking down net identity, explicit circuit targeting, DRC consistency, and archive safety will make this pipeline much safer for real hardware output.
