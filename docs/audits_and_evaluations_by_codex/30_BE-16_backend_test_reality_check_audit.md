# BE-16 Audit: Backend Test Reality Check

Date: 2026-03-06  
Auditor: Codex  
Section: BE-16 (from master map)  
Method: Code + test-surface inspection only (no runtime test suite execution).

## Scope Reviewed
- Test runner/config surface:
  - `vitest.config.ts`
  - `package.json`
- Backend test suite inventory:
  - `server/__tests__/*.test.ts`
- Route registration surfaces:
  - `server/routes.ts`
  - `server/circuit-routes/index.ts`
- Representative high-risk test files for realism:
  - `server/__tests__/api.test.ts`
  - `server/__tests__/auth-regression.test.ts`
  - `server/__tests__/stream-abuse.test.ts`
  - `server/__tests__/embed-routes.test.ts`
  - `server/__tests__/storage-integration.test.ts`
  - `server/__tests__/storage-transactions.test.ts`
  - `server/__tests__/db-constraints.test.ts`
  - `server/__tests__/export-snapshot.test.ts`
  - `server/__tests__/agent-route.test.ts`
  - `server/__tests__/ordering.test.ts`
  - `server/__tests__/rag-routes.test.ts`
  - `server/__tests__/autoroute.test.ts`

## BE-16 Surface Snapshot (Current)
- Backend test files (`server/__tests__/*.test.ts`): `45`
- Backend test cases (`it/test`): `1447`
- `describe(...)` blocks: `314`
- Test files that start an in-process HTTP server (`app.listen(...)`): `4`
  - `agent-route.test.ts`
  - `autoroute.test.ts`
  - `ordering.test.ts`
  - `rag-routes.test.ts`
- Test files using HTTP `fetch(...)`: `5` (includes `api.test.ts`)
- Main route modules directly imported by tests: `8 / 29` (`27.6%`)
- Circuit route modules directly imported by tests: `1 / 13` (`7.7%`)
- AI tool modules directly imported by tests: `6 / 12`
- Export modules directly imported by tests: `13 / 19`
- Test files mocking `../db`: `12`
- Snapshot assertions (`toMatchSnapshot`): `22`
- Placeholder assertions (`expect(true).toBe(true)`): `4`
- `describe.skipIf(...)` blocks in `api.test.ts`: `10`

## Severity Key
- `P1`: high-impact reliability/confidence gap likely to hide regressions
- `P2`: medium-risk coverage realism/hardening gap
- `P3`: low-risk quality/readability/maintenance gap

## Findings

### 1) `P1` Route-level contract coverage is thin compared to registered backend route surface
Evidence:
- Main route surface registers many modules:
  - `server/routes.ts:3`
  - `server/routes.ts:29`
  - `server/routes.ts:39`
  - `server/routes.ts:75`
- Circuit route surface registers multiple modules:
  - `server/circuit-routes/index.ts:3`
  - `server/circuit-routes/index.ts:13`
  - `server/circuit-routes/index.ts:15`
  - `server/circuit-routes/index.ts:27`
- Direct route-module imports in tests are limited to a small subset:
  - `server/__tests__/admin-purge.test.ts:39`
  - `server/__tests__/agent-route.test.ts:4`
  - `server/__tests__/embed-routes.test.ts:51`
  - `server/__tests__/ordering.test.ts:4`
  - `server/__tests__/rag-routes.test.ts:4`
  - `server/__tests__/stream-abuse.test.ts:68`
  - `server/__tests__/autoroute.test.ts:6`

What is happening:
- A lot of route modules exist, but only a small portion are directly exercised by route-focused tests.

Why this matters:
- Regressions in untested route families can ship without obvious failing tests.

Fix recommendation:
- Add a route-contract test matrix covering every registered route module with at least:
  - auth required/forbidden path
  - happy path
  - invalid input path

---

### 2) `P1` The only broad API integration suite can silently skip almost everything
Evidence:
- Suite explicitly depends on an externally running server:
  - `server/__tests__/api.test.ts:4`
  - `server/__tests__/api.test.ts:7`
- Entire blocks are gated behind `describe.skipIf(!serverAvailable)`:
  - `server/__tests__/api.test.ts:84`
  - `server/__tests__/api.test.ts:130`
  - `server/__tests__/api.test.ts:143`
  - `server/__tests__/api.test.ts:288`

What is happening:
- If no server is already running at `localhost:5000`, broad API checks are skipped.

Why this matters:
- CI and local runs can appear green while the broad HTTP contract is not actually exercised.

Fix recommendation:
- Refactor `api.test.ts` to boot an in-process server in `beforeAll` (ephemeral port), no skip gates.
- Keep one optional “external server smoke” file if desired, but do not use it as primary API validation.

---

### 3) `P1` Several security-critical tests validate reconstructed logic, not live implementation wiring
Evidence:
- `auth-regression.test.ts` reconstructs route/middleware logic and constants:
  - `server/__tests__/auth-regression.test.ts:89`
  - `server/__tests__/auth-regression.test.ts:541`
  - `server/__tests__/auth-regression.test.ts:641`
- Placeholder assertions appear in the same file:
  - `server/__tests__/auth-regression.test.ts:322`
  - `server/__tests__/auth-regression.test.ts:347`
  - `server/__tests__/auth-regression.test.ts:358`
- `stream-abuse.test.ts` notes middleware reconstruction strategy:
  - `server/__tests__/stream-abuse.test.ts:128`
  - `server/__tests__/stream-abuse.test.ts:291`
  - `server/__tests__/stream-abuse.test.ts:489`
- `embed-routes.test.ts` unit-tests in-memory store/constants and reconstructed validation schema:
  - `server/__tests__/embed-routes.test.ts:169`
  - `server/__tests__/embed-routes.test.ts:185`
  - `server/__tests__/embed-routes.test.ts:249`

What is happening:
- A non-trivial part of security test coverage checks “copied logic in tests” instead of hitting real route/middleware execution paths.

Why this matters:
- If source implementation changes but reconstructed test logic does not, tests can still pass while behavior has drifted.

Fix recommendation:
- Promote these checks to live request-path tests:
  - mount real middleware on an Express app
  - send requests through full middleware chain
  - assert response status/headers/body and side effects

---

### 4) `P2` Storage “integration” tests are mostly deep mocks, not database-backed integration
Evidence:
- Explicit comment says mocked DB pattern:
  - `server/__tests__/storage-integration.test.ts:6`
- DB/cache are mocked in major storage suites:
  - `server/__tests__/storage-integration.test.ts:54`
  - `server/__tests__/storage-transactions.test.ts:58`
  - `server/__tests__/storage.test.ts:49`
- “DB constraints” test validates SQL text/snapshots, not live DB behavior:
  - `server/__tests__/db-constraints.test.ts:5`
  - `server/__tests__/db-constraints.test.ts:21`
  - `server/__tests__/db-constraints.test.ts:83`

What is happening:
- Storage behavior is validated primarily through chain mocks and SQL-file assertions.

Why this matters:
- Query semantics, migration application behavior, transaction isolation, and DB-specific edge cases can be missed.

Fix recommendation:
- Add a real PostgreSQL integration layer (test container/local ephemeral DB):
  - run migrations
  - execute real storage calls
  - assert constraints/transactions under actual DB semantics

---

### 5) `P2` High-risk backend modules still have no direct test import surface
Evidence:
- Zero direct test imports found for:
  - `server/index.ts`
  - `server/env.ts`
  - `server/simulation.ts`
  - `server/spice-import.ts`
  - `server/circuit-ai.ts`
  - `server/component-ai.ts`
  - `server/export-generators.ts`
- Route family blind spots remain significant:
  - Main routes directly imported in tests: `8/29`
  - Circuit routes directly imported in tests: `1/13`
- Important export/AI submodules also lack direct tests:
  - Export uncovered list includes `fzz-handler`, `design-report`, `fmea-generator`, `pdf-generator`, `pdf-report-generator`, `firmware-scaffold-generator`
  - AI tools uncovered list includes `circuit`, `component`, `export`, `project`, `vision`

What is happening:
- Strong coverage exists in some subsystems, but key operational/security modules still have little or no direct test pressure.

Why this matters:
- Areas already identified as risk-heavy in prior BE audits remain easier to break silently.

Fix recommendation:
- Prioritize direct tests for:
  - `server/index.ts` middleware/auth/origin chain
  - `server/spice-import.ts` malformed/hostile file parsing
  - `server/export/fzz-handler.ts` decompression hardening
  - `server/circuit-ai.ts` + `server/component-ai.ts` failure/fallback/error paths

---

### 6) `P2` Coverage configuration lacks an enforcement gate and excludes a critical runtime file
Evidence:
- Coverage config excludes server boot file:
  - `vitest.config.ts:53`
  - `vitest.config.ts:55`
- No threshold enforcement keys are present in Vitest config (`threshold`, `lines`, `branches`, etc.).

What is happening:
- Coverage reports are generated, but no configured minimum gate is visible, and `server/index.ts` is out-of-scope for coverage accounting.

Why this matters:
- Coverage can drift down without failing CI, and the highest-risk middleware chain is not measured.

Fix recommendation:
- Add hard minimum thresholds for server coverage.
- Bring `server/index.ts` under coverage with selective ignore directives only where justified.

---

### 7) `P3` Snapshot-heavy exporter tests can mask semantic regressions if snapshots are updated too easily
Evidence:
- Snapshot suite is extensive:
  - `server/__tests__/export-snapshot.test.ts:391`
  - `server/__tests__/export-snapshot.test.ts:462`
  - `server/__tests__/export-snapshot.test.ts:504`
  - `server/__tests__/export-snapshot.test.ts:546`
- Snapshot assertions count in backend tests: `22`

What is happening:
- Many exporter assertions rely on full-output snapshots.

Why this matters:
- Snapshot updates can accidentally approve behavior changes without enforcing domain invariants.

Fix recommendation:
- Pair snapshots with explicit semantic assertions (net counts, layer rules, required headers/records, deterministic ordering).

## What Is Already Good
- Test suite volume is substantial (`45` files, `1447` cases).
- Strong unit coverage exists in several complex subsystems:
  - `server/__tests__/job-queue.test.ts`
  - `server/__tests__/collaboration.test.ts`
  - `server/__tests__/circuit-breaker.test.ts`
  - Export generator-specific tests across Gerber/KiCad/Eagle/SPICE/STEP/ODB/IPC.
- A few route tests do run through live HTTP request flow with in-process servers:
  - `server/__tests__/agent-route.test.ts`
  - `server/__tests__/ordering.test.ts`
  - `server/__tests__/rag-routes.test.ts`
  - `server/__tests__/autoroute.test.ts`

## Test Coverage Assessment (BE-16-specific)
- Strengths:
  - Good depth in isolated domain logic and export generation.
  - Good stress-style lifecycle testing in queue/collaboration/breaker modules.
- Gaps:
  - Full-route contract coverage is still sparse relative to registered route surface.
  - Boot/middleware/auth chain tests are underrepresented in true end-to-end execution.
  - DB-backed integration realism remains low for storage and migration validation.
  - Some high-risk modules still lack direct test coverage.

## Improvements / Enhancements
- Build a generated `route contract suite` from `server/routes.ts` + `server/circuit-routes/index.ts` registration lists.
- Replace reconstructed security tests with live middleware-path tests (request/response level).
- Add PostgreSQL-backed integration tests (migrations + storage behaviors + transaction correctness).
- Add explicit coverage thresholds and include `server/index.ts` in coverage measurement.
- Add dedicated hardening tests for:
  - FZZ import decompression limits
  - project ownership enforcement across all project-scoped route families
  - forwarded-host/origin validation behavior under production config

## Decision Questions
- Do we want to treat reconstructed-logic tests as temporary scaffolding and phase them out this cycle?
- Should route-contract coverage be a release gate for backend changes touching `server/routes*`?
- Do we want a mandatory real-Postgres CI lane for storage/migration tests before BE remediation closes?

## Suggested Fix Order
1. Convert `api.test.ts` into self-hosted in-process integration tests (remove external-server skip dependency).
2. Add route-contract smoke coverage for all registered route modules (main + circuit).
3. Replace reconstructed security tests with live middleware/route execution checks.
4. Add real-DB integration coverage for storage + migration behavior.
5. Add coverage thresholds and bring boot middleware chain (`server/index.ts`) into measured coverage.
