# SH-01 Audit: Shared Domain Engines

Date: 2026-03-06  
Auditor: Codex  
Section: SH-01 (from master map)  
Method: Code + test-surface inspection only (no runtime test execution).

## Scope Reviewed
- Shared engine/type modules:
  - `shared/drc-engine.ts`
  - `shared/component-types.ts`
  - `shared/circuit-types.ts`
  - `shared/bom-diff.ts`
  - `shared/arch-diff.ts`
  - `shared/netlist-diff.ts`
- Shared test surface:
  - `shared/__tests__/drc-engine.test.ts`
  - `shared/__tests__/pcb-drc.test.ts`
  - `shared/__tests__/schema.test.ts`
  - `shared/__tests__/design-variables.test.ts`
- Route consumers:
  - `server/routes/components.ts`
  - `server/routes/bom-snapshots.ts`
  - `server/routes/design-history.ts`
  - `server/circuit-routes/netlist.ts`
  - `server/circuit-routes/exports.ts`
  - `server/export/drc-gate.ts`
- Representative client consumers:
  - `client/src/components/views/ValidationView.tsx`
  - `client/src/components/views/ComponentEditorView.tsx`
  - `client/src/components/circuit-editor/SchematicCanvas.tsx`
  - `client/src/lib/pcb/net-class-rules.ts`
  - `client/src/components/views/BomDiffPanel.tsx`
  - `client/src/components/views/DesignHistoryView.tsx`

## SH-01 Surface Snapshot (Current)
- Shared SH-01 core files: `6`
- SH-01 core LOC: `2627`
  - `shared/drc-engine.ts`: `1427`
  - `shared/component-types.ts`: `212`
  - `shared/circuit-types.ts`: `271`
  - `shared/bom-diff.ts`: `167`
  - `shared/arch-diff.ts`: `270`
  - `shared/netlist-diff.ts`: `280`
- Shared tests in `shared/__tests__`: `4` files total
- Deep DRC tests:
  - `shared/__tests__/drc-engine.test.ts`: `61` test cases
  - `shared/__tests__/pcb-drc.test.ts`: `63` test cases
- Direct tests for diff engines (`arch-diff` / `bom-diff` / `netlist-diff`): `0`
- Non-test call sites:
  - `computeArchDiff`: route usage in `server/routes/design-history.ts`
  - `computeBomDiff`: route usage in `server/routes/bom-snapshots.ts`
  - `computeNetlistDiff`: route usage in `server/circuit-routes/netlist.ts`
  - `runPcbDrc`: no production call site found outside `shared/drc-engine.ts` declaration

## Severity Key
- `P1`: High-impact correctness/reliability risk that can produce wrong user-visible outcomes
- `P2`: Medium-risk domain consistency or maintainability gap likely to cause drift/regressions
- `P3`: Low-risk quality/type-safety issue

## Findings

### 1) `P1` Diff engines can report false “no change” because tracked field coverage is incomplete
Evidence:
- Architecture diff tracks only selected fields:
  - `shared/arch-diff.ts:105`
  - `shared/arch-diff.ts:119`
- But architecture schema contains additional mutable fields not tracked by diff:
  - `shared/schema.ts:36` (`data`)
  - `shared/schema.ts:64` (`animated`)
  - `shared/schema.ts:65` (`style`)
- BOM diff tracks a subset of BOM fields:
  - `shared/bom-diff.ts:75`
- BOM schema includes additional mutable fields not tracked in diff:
  - `shared/schema.ts:97`
  - `shared/schema.ts:98`
  - `shared/schema.ts:99`
  - `shared/schema.ts:100`
  - `shared/schema.ts:101`
  - `shared/schema.ts:102`
  - `shared/schema.ts:103`
- Netlist diff snapshot model excludes voltage/bus width level data:
  - `shared/netlist-diff.ts:20`
  - `server/circuit-routes/netlist.ts:246`
  - `server/circuit-routes/netlist.ts:275`

What is happening:
- The diff modules compare only selected fields, so real edits in omitted fields can be silently ignored.

Why this matters:
- Users can be told “no differences found” when meaningful design/BOM/netlist data actually changed.

Fix recommendation:
- Expand tracked fields to full contract coverage or explicitly version and document a “minimal diff mode.”
- Add strict tests that prove diffs catch updates in `data/style/animated` (architecture), extended BOM fields, and net-level electrical metadata.

---

### 2) `P1` Duplicate identity keys are silently overwritten in all three diff engines
Evidence:
- BOM map overwrite behavior:
  - `shared/bom-diff.ts:96`
  - `shared/bom-diff.ts:101`
- Architecture map overwrite behavior:
  - `shared/arch-diff.ts:196`
  - `shared/arch-diff.ts:201`
- Netlist map overwrite behavior:
  - `shared/netlist-diff.ts:141`
  - `shared/netlist-diff.ts:146`
  - `shared/netlist-diff.ts:196`
  - `shared/netlist-diff.ts:201`
- Snapshot payloads are consumed from JSONB with unchecked casts in route layer:
  - `server/routes/design-history.ts:98`
  - `server/routes/design-history.ts:99`
  - `server/routes/bom-snapshots.ts:77`

What is happening:
- `Map.set()` replaces prior entries for duplicate keys, so duplicate IDs/part numbers/refdes are collapsed without warning.

Why this matters:
- Data corruption or malformed snapshots can produce incomplete diffs instead of an explicit error.

Fix recommendation:
- Add preflight validation for uniqueness (nodeId, edgeId, partNumber, net name, refdes) and reject invalid snapshots with 400/422 errors.
- Return explicit “duplicate key found” diagnostics so users know data quality is compromised.

---

### 3) `P1` Diff engines are production-used but have zero direct tests
Evidence:
- Diff engines are used by live route handlers:
  - `server/routes/design-history.ts:101`
  - `server/routes/bom-snapshots.ts:79`
  - `server/circuit-routes/netlist.ts:229`
- Shared test inventory contains DRC-heavy tests but no diff-engine test files:
  - `shared/__tests__/drc-engine.test.ts`
  - `shared/__tests__/pcb-drc.test.ts`
  - `shared/__tests__/schema.test.ts`
  - `shared/__tests__/design-variables.test.ts`
- No direct test imports found for `arch-diff`, `bom-diff`, or `netlist-diff` across test files.

What is happening:
- Critical comparison logic is serving user-facing features without direct unit or route-level contract tests.

Why this matters:
- Regressions in diff behavior can ship silently, especially where logic is intentionally selective/heuristic.

Fix recommendation:
- Add dedicated test suites:
  - `shared/__tests__/arch-diff.test.ts`
  - `shared/__tests__/bom-diff.test.ts`
  - `shared/__tests__/netlist-diff.test.ts`
- Add route-level tests for:
  - `/api/projects/:id/snapshots/:snapshotId/diff`
  - `/api/projects/:id/bom-diff`
  - `/api/circuits/:circuitId/netlist-diff`

---

### 4) `P1` “Domain truth” is split across three DRC engines with different unit systems
Evidence:
- Shared component DRC uses pixel-oriented messaging/threshold semantics:
  - `shared/drc-engine.ts:165`
  - `shared/drc-engine.ts:195`
- Shared PCB DRC is mil-based:
  - `shared/drc-engine.ts:799`
  - `shared/drc-engine.ts:820`
- Export DRC gate is a separate implementation and mm-based:
  - `server/export/drc-gate.ts:56`
  - `server/export/drc-gate.ts:57`
  - `server/export/drc-gate.ts:176`
  - `server/export/drc-gate.ts:179`
- Manufacturing export gate uses `runDrcGate`, not `runPcbDrc`:
  - `server/circuit-routes/exports.ts:104`
  - `server/circuit-routes/exports.ts:106`

What is happening:
- DRC outcomes depend on which engine/path is used (editor checks vs PCB checks vs export gate), with different rules and unit assumptions.

Why this matters:
- A design can look acceptable in one path and fail in another due to engine and unit drift, reducing user trust and manufacturability confidence.

Fix recommendation:
- Define one canonical PCB DRC rule contract and conversion layer (`px`/`mm`/`mil`) with explicit units.
- Either unify export gate to `runPcbDrc` inputs or formalize the export gate as a documented, intentionally different “manufacturing gate” with mapping tests.

---

### 5) `P2` API contract drift: component DRC endpoint accepts only 6 rule types while engine supports 11
Evidence:
- Route schema allows only:
  - `server/routes/components.ts:290`
  - `server/routes/components.ts:296`
- Shared defaults include 11 rules:
  - `shared/drc-engine.ts:103`
  - `shared/drc-engine.ts:116`
- Engine switch supports all 11:
  - `shared/drc-engine.ts:740`
  - `shared/drc-engine.ts:773`

What is happening:
- Newer DRC rules exist in shared engine/defaults, but cannot be sent through this API as custom rule payloads.

Why this matters:
- Contract drift makes API behavior inconsistent with shared engine capability and blocks rule customization for newer checks.

Fix recommendation:
- Align route schema with `DRCRuleType` union from shared types.
- Add request-validation tests for every supported rule type.

---

### 6) `P2` Thermal-relief and via-in-pad checks are heavily heuristic and can misclassify
Evidence:
- Thermal-relief uses arbitrary copper-pour threshold and generic nearby-path counting:
  - `shared/drc-engine.ts:436`
  - `shared/drc-engine.ts:479`
  - `shared/drc-engine.ts:489`
- Via-in-pad identifies vias by “small copper circle” heuristic:
  - `shared/drc-engine.ts:578`
  - `shared/drc-engine.ts:586`

What is happening:
- Rules infer electrical intent from geometric shortcuts, not explicit net-aware connectivity.

Why this matters:
- False positives/negatives can appear in complex layouts and reduce confidence in DRC results.

Fix recommendation:
- Add net-aware and layer-aware criteria for spoke/via detection.
- Include adversarial tests for “looks similar but is not actually via/spoke” scenarios.

---

### 7) `P2` Shared circuit domain constants are not actually used as shared truth
Evidence:
- Shared reference-designator map exists:
  - `shared/circuit-types.ts:148`
- No usage found for `REFERENCE_DESIGNATOR_PREFIXES` in runtime code.
- Client maintains separate local mapping:
  - `client/src/components/circuit-editor/SchematicCanvas.tsx:162`
- `createDefaultSchematicState` appears exported but not consumed:
  - `shared/circuit-types.ts:257`

What is happening:
- Shared domain definitions exist, but consumers duplicate logic locally.

Why this matters:
- Prefix behavior and editor defaults can drift between modules over time.

Fix recommendation:
- Consume `REFERENCE_DESIGNATOR_PREFIXES` directly in client reference-designator generation.
- Remove dead shared exports or wire them into active state creation paths.

---

### 8) `P3` Arch diff helper relies on repeated unsafe casting patterns
Evidence:
- Repeated `as unknown as D` in diff helper:
  - `shared/arch-diff.ts:219`
  - `shared/arch-diff.ts:241`
  - `shared/arch-diff.ts:253`

What is happening:
- Generic helper bypasses strong typing when building diff entries.

Why this matters:
- Type drift can slip through compile-time checks and fail only at runtime/consumer rendering.

Fix recommendation:
- Replace generic cast-heavy builder with explicit node/edge builders or discriminated factory helpers.

## What Is Already Good
- Shared DRC testing depth is substantial (`61 + 63` test cases across geometry + PCB checks).
- `runDRC` is genuinely shared between client and server call paths:
  - `client/src/components/views/ComponentEditorView.tsx:323`
  - `client/src/components/views/ValidationView.tsx:263`
  - `server/routes/components.ts:330`
- Diff results are sorted deterministically in all diff engines:
  - `shared/bom-diff.ts:141`
  - `shared/arch-diff.ts:259`
  - `shared/netlist-diff.ts:240`

## Test Coverage Assessment (SH-01-specific)
- Strong:
  - `shared/drc-engine.ts` geometry + rule behavior coverage is deep.
  - `runPcbDrc` helper checks have direct tests even if runtime integration is missing.
- Weak:
  - No direct tests for `computeArchDiff`, `computeBomDiff`, `computeNetlistDiff`.
  - No route contract tests focused on the three diff endpoints using these engines.
  - No explicit tests for duplicate-key/corrupt snapshot payload handling.

## Recommended Fix Order
1. Add direct tests for all three diff engines and route-level diff endpoint contracts.
2. Define and enforce snapshot validation (key uniqueness + schema shape) before diff computation.
3. Expand diff field coverage to include all contract-critical fields or explicitly document reduced mode.
4. Resolve DRC engine split by defining canonical rule contract + unit conversion strategy.
5. Align `/component-parts/:id/drc` rule schema with shared `DRCRuleType`.
6. Replace local ref-des mapping with shared constant and remove dead shared exports.

## Decision Questions
1. Should architecture/BOM/netlist diffs be “full fidelity” (all mutable fields) or intentionally “semantic subset”?
2. Do we want one canonical PCB DRC engine for editor + export, or a documented two-tier model (`editor-advisory` vs `manufacturing-gate`)?
3. Should snapshot corruption/duplicate identity data hard-fail requests, or be tolerated with warnings?

