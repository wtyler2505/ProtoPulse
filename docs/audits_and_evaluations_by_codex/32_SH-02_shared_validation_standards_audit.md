# SH-02 Audit: Shared Validation + Standards

Date: 2026-03-06  
Auditor: Codex  
Section: SH-02 (from master map)  
Method: Code + test-surface inspection only (no runtime test execution).

## Scope Reviewed
- Shared validation/standards modules:
  - `shared/drc-templates.ts`
  - `shared/standard-library.ts`
  - `shared/design-variables.ts`
- Shared/server test surface:
  - `shared/__tests__/design-variables.test.ts`
  - `server/__tests__/standard-library.test.ts`
- Primary runtime consumers and integration paths:
  - `server/routes/seed.ts`
  - `server/index.ts`
  - `server/storage/components.ts`
  - `server/routes/components.ts`
  - `client/src/components/views/component-editor/ComponentLibraryBrowser.tsx`
  - `client/src/components/views/ComponentEditorView.tsx`
  - `client/src/lib/component-editor/ComponentEditorProvider.tsx`
  - `shared/component-types.ts`

## SH-02 Surface Snapshot (Current)
- SH-02 core files: `3`
- SH-02 core LOC: `1651`
  - `shared/drc-templates.ts`: `141`
  - `shared/standard-library.ts`: `486`
  - `shared/design-variables.ts`: `1024`
- Direct tests in scope:
  - `shared/__tests__/design-variables.test.ts`: `107` test cases (`674` LOC)
  - `server/__tests__/standard-library.test.ts`: `39` test cases (`261` LOC)
- Direct tests for `shared/drc-templates.ts`: `0`
- Runtime import footprint:
  - `shared/drc-templates.ts`: no runtime consumers found in `client/` or `server/`
  - `shared/design-variables.ts`: no runtime consumers found in `client/` or `server/`
  - `shared/standard-library.ts`: used in seed/bootstrap path

## Severity Key
- `P1`: High-impact correctness/reliability risk likely to produce broken or misleading user outcomes
- `P2`: Medium-risk consistency/maintainability gap likely to create drift or regressions
- `P3`: Low-risk quality/documentation mismatch

## Findings

### 1) `P1` Manufacturer DRC templates are not connected to any active validation path
Evidence:
- Templates exist and expose lookup API:
  - `shared/drc-templates.ts:23`
  - `shared/drc-templates.ts:114`
  - `shared/drc-templates.ts:123`
  - `shared/drc-templates.ts:133`
- Component DRC route uses default/shared rules directly, not manufacturer templates:
  - `server/routes/components.ts:329`
  - `shared/drc-engine.ts:103`
- Manufacturing export path uses separate gate logic:
  - `server/circuit-routes/exports.ts:104`
  - `server/circuit-routes/exports.ts:106`

What is happening:
- SH-02 template standards were implemented but are currently orphaned from runtime DRC entry points.

Why this matters:
- Users cannot actually select/apply JLCPCB/PCBWay/OSHPark templates during normal validation/export flows.
- “Standards compliance” expectations are not met by the current execution path.

Fix recommendation:
- Add explicit template selection + application flow (API + UI + persistence).
- Ensure component DRC and manufacturing gate consume a shared standard contract or documented mapping.

---

### 2) `P1` Standard library view payload shape is incompatible with editor `PartViews` contract on fork path
Evidence:
- Standard library entries define schematic-only view shape:
  - `shared/standard-library.ts:61`
  - `shared/standard-library.ts:69`
- Editor contract requires all three views:
  - `shared/component-types.ts:105`
  - `shared/component-types.ts:109`
- Fork route blindly casts library JSON into full `PartViews`:
  - `server/routes/components.ts:270`
  - `server/routes/components.ts:275`
- Editor load path blindly casts/loads forked part views:
  - `client/src/components/views/ComponentEditorView.tsx:249`
  - `client/src/components/views/ComponentEditorView.tsx:573`
- Editor reducer assumes `state.present.views[view].shapes` exists for each canvas view:
  - `client/src/lib/component-editor/ComponentEditorProvider.tsx:106`
  - `client/src/lib/component-editor/ComponentEditorProvider.tsx:107`
  - `client/src/lib/component-editor/ComponentEditorProvider.tsx:162`

What is happening:
- Seeded/forked standard parts can carry partial `views` objects into code paths that require full `breadboard/schematic/pcb`.

Why this matters:
- Switching to missing views or editing those shapes can throw runtime errors and destabilize the component editor workflow.

Fix recommendation:
- Normalize library/forked parts to full `PartViews` server-side (fill missing views with `{ shapes: [] }`).
- Enforce shape at write boundary with a shared Zod schema for component-library `views`.

---

### 3) `P1` Category taxonomy drift breaks component library filtering for seeded standards
Evidence:
- Canonical standard categories:
  - `shared/standard-library.ts:471`
  - `shared/standard-library.ts:484`
- Library browser filter options are a different taxonomy:
  - `client/src/components/views/component-editor/ComponentLibraryBrowser.tsx:9`
- API query does exact category equality:
  - `client/src/components/views/component-editor/ComponentLibraryBrowser.tsx:44`
  - `server/storage/components.ts:101`

What is happening:
- UI sends categories like `IC`/`Passive` while seeded data uses `Logic ICs`/`Passives`/etc.

Why this matters:
- Category filters can return empty lists for standard library data even when matching components exist.

Fix recommendation:
- Use one shared category source of truth (`STANDARD_LIBRARY_CATEGORIES`) end-to-end.
- Add alias mapping only if legacy categories must remain supported.

---

### 4) `P1` “Upsert” seed behavior is not an upsert; race conditions can duplicate entries and spec updates are never applied
Evidence:
- Seed function comment claims upsert:
  - `server/routes/seed.ts:222`
- Actual implementation is check-then-insert:
  - `server/routes/seed.ts:229`
  - `server/routes/seed.ts:234`
  - `server/routes/seed.ts:235`
- No unique constraint on `(title, isPublic)`:
  - `shared/schema.ts:239`
  - `shared/schema.ts:257`
  - `shared/schema.ts:258`
- Seed entry points:
  - `server/index.ts:292`
  - `server/index.ts:294`
  - `server/routes/seed.ts:256`
  - `server/routes/seed.ts:262`

What is happening:
- Multiple runners can pass existence checks concurrently and insert duplicates.
- Changed standard definitions are not merged into existing rows, so standards can drift permanently once seeded.

Why this matters:
- Duplicated public library entries and stale seeded content reduce trust in standards data.

Fix recommendation:
- Add DB uniqueness (`title + isPublic`) and convert seed to true `onConflictDoUpdate` upsert.
- Track `standardLibraryVersion` to detect and apply controlled standard data migrations.

---

### 5) `P2` DRC template unit contract is underspecified for safe runtime use
Evidence:
- Templates are explicitly mm-based and require external mm→px conversion:
  - `shared/drc-templates.ts:13`
  - `shared/drc-templates.ts:16`
- Core component DRC defaults/messages are px-based:
  - `shared/drc-engine.ts:103`
  - `shared/drc-engine.ts:105`
  - `shared/drc-engine.ts:165`

What is happening:
- A manual conversion expectation exists in comments, but there is no enforced conversion API/type boundary.

Why this matters:
- If templates are wired in without explicit conversion, thresholds become wrong by orders of magnitude.

Fix recommendation:
- Introduce typed unit wrappers or conversion utilities (`mmToPxRules`, board scale config).
- Add tests that prove converted template thresholds match expected px rule behavior.

---

### 6) `P2` `getManufacturerTemplate` leaks mutable internal template objects
Evidence:
- Direct return of internal object reference:
  - `shared/drc-templates.ts:114`
  - `shared/drc-templates.ts:116`
- Other getters use defensive copy:
  - `shared/drc-templates.ts:124`
  - `shared/drc-templates.ts:126`
  - `shared/drc-templates.ts:137`
  - `shared/drc-templates.ts:139`

What is happening:
- Callers of `getManufacturerTemplate` can mutate global template state for the rest of process lifetime.

Why this matters:
- Shared mutable singleton data can produce cross-request cross-user configuration bleed.

Fix recommendation:
- Return defensive copies from all template getters, including `getManufacturerTemplate`.
- Freeze internal template objects in module scope.

---

### 7) `P2` Design variable engine is feature-rich but currently disconnected from product flows
Evidence:
- Core engine/API exists:
  - `shared/design-variables.ts:591`
  - `shared/design-variables.ts:617`
  - `shared/design-variables.ts:664`
- Product checklist marks variable feature complete:
  - `docs/product-analysis-checklist.md:604`
- No runtime consumers found in `client/` or `server/` import graph (inspection search found only tests and module definitions).

What is happening:
- The engine is implemented and tested in isolation, but not wired into BOM/component/simulation flows.

Why this matters:
- Product/roadmap status implies available capability that users do not currently experience.

Fix recommendation:
- Define minimum integration slice (e.g., design-preferences + BOM expressions) and ship it behind a feature flag.
- Add at least one user-visible execution path before keeping “done” status.

---

### 8) `P2` Design-variable edge contracts have correctness gaps (reserved names + cycle handling in `resolveAll`)
Evidence:
- Resolver prioritizes built-in constants over provided variable map:
  - `shared/design-variables.ts:602`
  - `shared/design-variables.ts:605`
- Store allows arbitrary variable names:
  - `shared/design-variables.ts:690`
- `resolveAll` relies on topological sort and evaluate-context map:
  - `shared/design-variables.ts:718`
  - `shared/design-variables.ts:953`
  - `shared/design-variables.ts:1015`
  - `shared/design-variables.ts:1019`
- `resolveAll` tests cover normal + invalid empty expression, but not cycle classification:
  - `shared/__tests__/design-variables.test.ts:477`
  - `shared/__tests__/design-variables.test.ts:495`

What is happening:
- Variables named `pi`/`e` cannot override built-ins in expressions.
- In cyclic graphs, `resolveAll` can surface unresolved-variable errors rather than explicit circular-dependency errors.

Why this matters:
- Error semantics become surprising and harder to debug for users of the API.

Fix recommendation:
- Reserve/bounce built-in names at `addVariable`, or document/implement variable precedence intentionally.
- Run cycle detection before `resolveAll` evaluation or map cycle members to `CircularDependencyError`.

---

### 9) `P3` Standard library metadata comments are stale vs actual dataset size
Evidence:
- Header/comment says 120+:
  - `shared/standard-library.ts:2`
  - `shared/standard-library.ts:447`
- Test expects exactly 100:
  - `server/__tests__/standard-library.test.ts:259`

What is happening:
- Commentary and effective data contract diverged.

Why this matters:
- Misleading internal docs reduce trust and make audits harder.

Fix recommendation:
- Auto-generate count comment from source arrays or remove fixed-number comments.

## Test Gaps (SH-02)
- No direct tests for `shared/drc-templates.ts` API behavior (copy semantics, case-insensitive lookup, immutability).
- No integration tests for `/api/component-library/:id/fork` with partial `views` payloads.
- No tests that exercise category filter semantics between UI categories and seeded standard categories.
- No tests for seed idempotency/concurrency safety (`title + isPublic` uniqueness behavior).
- No tests proving `resolveAll` cycle error classification behavior.

## Recommended Fix Order
1. Blocker-level contract fixes:
   - Normalize/validate library `views` on fork/create paths.
   - Unify category taxonomy across shared data, UI filters, and storage query.
2. Data integrity fixes:
   - Add DB uniqueness for standard library keys and convert seed to true upsert.
3. Standards activation:
   - Wire manufacturer templates into at least one runtime DRC path with unit-safe conversion.
4. API quality hardening:
   - Defensive copy/freeze for `getManufacturerTemplate`.
   - Tighten design-variable reserved-name and cycle error behavior.

## Decision Questions
- Should manufacturer template selection be user-facing immediately, or applied as project-level defaults first?
- Do we want strict canonical categories only, or canonical + alias compatibility?
- Should CAPX-FFI-17 remain marked done before any user-visible integration exists?

