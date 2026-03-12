# BE-03 Audit: Main REST Route Surface

Date: 2026-03-06  
Auditor: Codex  
Section: BE-03 (from master map)  
Method: Code + test-surface inspection only (no runtime test suite execution).

## Scope Reviewed
- Route registration surface:
  - `server/routes.ts`
  - `server/routes/*` (main REST routes; circuit routes are BE-04)
- Cross-check files needed for authorization and behavior context:
  - `server/index.ts`
  - `server/routes/auth-middleware.ts`
  - `server/storage/interfaces.ts`
  - `server/storage/projects.ts`
  - `server/storage/bom.ts`
  - `server/storage/misc.ts`
  - `server/job-queue.ts`
- Test surface reviewed for BE-03 coverage:
  - `server/__tests__/project-ownership.test.ts`
  - `server/__tests__/ordering.test.ts`
  - `server/__tests__/rag-routes.test.ts`
  - `server/__tests__/routes-utils.test.ts`
  - `server/__tests__/api.test.ts`

## Route Surface Snapshot (Current)
- Total route handlers defined under `server/routes/*.ts`: `129`.
- `registerRoutes(app)` mounts many domain routers, but not all route modules present in `server/routes/`.
- Global `/api` middleware validates session and sets `req.userId`, but per-project ownership enforcement is not consistently applied at route level.

## Severity Key
- `P0`: immediate security/data-loss risk
- `P1`: high-impact reliability/security/API behavior risk
- `P2`: medium reliability/contract/test-confidence risk
- `P3`: lower-risk debt/cleanup

## Findings

### 1) `P0` Per-project authorization is not enforced across most `/api/projects/:id*` routes
Evidence:
- Ownership middleware exists:
  - `server/routes/auth-middleware.ts:22`
- Middleware usage is only in project PATCH/DELETE:
  - `server/routes/projects.ts:66`
  - `server/routes/projects.ts:100`
- Global search confirms no usage outside `projects.ts`:
  - `rg -n "requireProjectOwnership" server/routes/*.ts` (only `projects.ts`)
- Example project-scoped routes with no ownership middleware:
  - `server/routes/architecture.ts:18`
  - `server/routes/chat.ts:319`
  - `server/routes/project-io.ts:163`
  - `server/routes/agent.ts:119`
- Project list route returns all projects (not owner-filtered):
  - `server/routes/projects.ts:22`
  - `server/storage/projects.ts:18`

What is happening:
- Most project-scoped routes trust `projectId` path params and session presence, but do not enforce ownership checks.

Why this matters:
- Any authenticated user can potentially read or mutate another user’s project data by ID.
- This conflicts with the project’s own CAPX-SEC-01 acceptance statement that `/api/projects/:id*` is ownership-protected.

Fix recommendation:
- Apply project-authorization middleware (or equivalent centralized guard) to all project-scoped routes, not only `PATCH/DELETE /api/projects/:id`.
- Switch project listing/read behavior to owner-aware queries (with explicit policy for legacy `ownerId = null` records).

---

### 2) `P0` Multiple project-scoped child-resource routes ignore project scoping (IDOR class)
Evidence:
- Comments routes validate `:id` but update/delete by `commentId` only:
  - `server/routes/comments.ts:80`
  - `server/routes/comments.ts:87`
  - `server/routes/comments.ts:99`
  - `server/routes/comments.ts:103`
  - `server/routes/comments.ts:130`
  - `server/routes/comments.ts:132`
- Design snapshot routes fetch/delete by `snapshotId` only:
  - `server/routes/design-history.ts:29`
  - `server/routes/design-history.ts:31`
  - `server/routes/design-history.ts:71`
  - `server/routes/design-history.ts:73`
  - `server/routes/design-history.ts:88`
- BOM snapshot routes fetch/delete by snapshot ID only:
  - `server/routes/bom-snapshots.ts:47`
  - `server/routes/bom-snapshots.ts:49`
  - `server/routes/bom-snapshots.ts:68`
- Lifecycle route fetch/delete by entry ID only:
  - `server/routes/component-lifecycle.ts:36`
  - `server/routes/component-lifecycle.ts:38`
  - `server/routes/component-lifecycle.ts:62`
- Preferences route delete by `prefId` only:
  - `server/routes/design-preferences.ts:54`
  - `server/routes/design-preferences.ts:56`
- Storage methods are ID-only (no project constraint) for these entities:
  - `server/storage/misc.ts:115`
  - `server/storage/misc.ts:203`
  - `server/storage/misc.ts:238`
  - `server/storage/misc.ts:261`
  - `server/storage/misc.ts:282`
  - `server/storage/misc.ts:340`
  - `server/storage/misc.ts:352`
  - `server/storage/misc.ts:369`
  - `server/storage/misc.ts:386`
  - `server/storage/bom.ts:179`
  - `server/storage/bom.ts:189`

What is happening:
- Several routes parse a project ID but do not actually constrain child-resource operations to that project in storage queries.

Why this matters:
- An attacker can operate on resources from other projects by supplying a known child ID.
- Even if route-level ownership checks are later added, this bug pattern can still bypass project scoping unless data-layer predicates also include `projectId`.

Fix recommendation:
- Add project-scoped storage methods (e.g., `getComment(id, projectId)` / `deleteDesignSnapshot(id, projectId)`).
- Update affected routes to enforce both project ownership and child-resource-to-project relationship.

---

### 3) `P1` `/api/projects/import` creates ownerless projects by bypassing ownership-aware create path
Evidence:
- Import route inserts directly into `projects` without `ownerId`:
  - `server/routes/project-io.ts:363`
  - `server/routes/project-io.ts:366`
  - `server/routes/project-io.ts:367`
- `projects.ownerId` is nullable:
  - `shared/schema.ts:10`
- Ownership logic treats `ownerId = null` as open access:
  - `server/storage/projects.ts:59`
  - `server/storage/projects.ts:60`

What is happening:
- Import flow bypasses `storage.createProject(...)` ownership assignment logic and inserts a project with no owner.

Why this matters:
- Imported projects become globally accessible under current backward-compat policy, even when import was initiated by an authenticated user.

Fix recommendation:
- Route should assign `ownerId` from authenticated user (`req.userId`) on import.
- Prefer going through storage-layer creation contract to keep ownership semantics centralized.

---

### 4) `P1` Route registration drift: some route modules define endpoints but are never mounted
Evidence:
- `routes.ts` registration list excludes:
  - `registerOrderingRoutes(...)`
  - `registerExportStepRoutes(...)`
  - `server/routes.ts:37` through `server/routes.ts:70`
- Unmounted modules define active endpoints:
  - `server/routes/ordering.ts:34`
  - `server/routes/export-step.ts:6`
- Ordering tests register the route directly in isolated app setup:
  - `server/__tests__/ordering.test.ts:4`
  - `server/__tests__/ordering.test.ts:72`

What is happening:
- Real route files exist and are tested in isolation, but runtime `registerRoutes` never mounts them.

Why this matters:
- Production behavior can return 404 for endpoints that appear implemented/tested.
- Increases drift between local confidence and actual runtime surface.

Fix recommendation:
- Either register these modules in `server/routes.ts` or retire/archive them clearly.
- Add a “route manifest parity” test to ensure every intended module is mounted by `registerRoutes`.

---

### 5) `P1` Batch submit validation can return `500` for client input errors
Evidence:
- Batch submit uses `parse` (throws ZodError):
  - `server/routes/batch.ts:52`
- Global error handler maps unknown errors to `500`:
  - `server/index.ts:370`
  - `server/index.ts:380`

What is happening:
- Malformed batch payload can trigger a thrown `ZodError` without explicit `400` mapping.

Why this matters:
- Client-side validation failures can surface as server failures (`500`), harming API reliability and observability quality.

Fix recommendation:
- Replace `submitSchema.parse(...)` with `safeParse(...)` and explicit `400` response.
- Or catch `ZodError` and convert to `HttpError(400)`.

---

### 6) `P1` Jobs/Batch/RAG route families are not tenant-scoped (cross-user data/control risk)
Evidence:
- Job routes expose list/get/cancel/remove by global job IDs:
  - `server/routes/jobs.ts:53`
  - `server/routes/jobs.ts:87`
  - `server/routes/jobs.ts:106`
  - `server/routes/jobs.ts:125`
- Job records contain no `userId`:
  - `server/job-queue.ts:28`
  - `server/job-queue.ts:81`
  - `server/job-queue.ts:115`
- RAG routes use one in-memory `Map` for all documents:
  - `server/routes/rag.ts:18`
  - `server/routes/rag.ts:61`
  - `server/routes/rag.ts:76`
- Batch status/results/cancel endpoints authorize by external API key + batchId, not app user ownership:
  - `server/routes/batch.ts:72`
  - `server/routes/batch.ts:89`
  - `server/routes/batch.ts:123`
  - `server/batch-analysis.ts:372`

What is happening:
- These route families operate on shared in-memory state with no per-user ownership boundary in records.

Why this matters:
- Authenticated users can potentially inspect/cancel other users’ jobs or interact with shared RAG/batch state.

Fix recommendation:
- Add tenant fields (`userId`, and where needed `projectId`) to in-memory records.
- Enforce ownership checks on list/read/cancel/delete operations.
- Consider admin-only boundaries where user scoping is not feasible.

---

### 7) `P2` Response contract consistency is weak across adjacent endpoints
Evidence:
- Same domain, mixed list shapes:
  - `server/routes/bom.ts:21` (`{ data, total }`)
  - `server/routes/bom.ts:30` (raw array)
  - `server/routes/validation.ts:15` (`{ data, total }`)
  - `server/routes/validation.ts:61` (raw array)
- Error key drift:
  - Many routes use `{ message: ... }`
  - Admin/backup routes commonly use `{ error: ... }` (e.g., `server/routes/backup.ts:39`, `server/routes/backup.ts:76`)

What is happening:
- API responses are not consistently shaped across modules and operation types.

Why this matters:
- Client integration and generated types become brittle.
- Increases adapter glue and bug risk.

Fix recommendation:
- Adopt one explicit API response contract (success + error envelopes).
- Enforce it with shared helpers and route-level tests.

---

### 8) `P2` Invalid pagination query values are silently replaced with defaults
Evidence:
- Pattern found across multiple list routes:
  - `server/routes/projects.ts:20`
  - `server/routes/architecture.ts:21`
  - `server/routes/bom.ts:18`
  - `server/routes/validation.ts:12`
  - `server/routes/history.ts:11`
  - `server/routes/chat.ts:322`
  - `rg -n "opts.success ? opts.data :" server/routes/*.ts`

What is happening:
- Failed query validation does not return `400`; it quietly falls back to default pagination.

Why this matters:
- Client bugs and malformed requests are hidden.
- Makes contract debugging harder and can mask abusive query patterns.

Fix recommendation:
- Return `400` on invalid pagination queries with clear validation message.
- Keep defaults only for omitted (not invalid) query fields.

---

### 9) `P2` BE-03 test surface misses critical runtime route/security realities
Evidence:
- No test matches found for key route families:
  - `rg -n "ai-actions/by-message|projects/:id/comments|projects/:id/snapshots|bom-snapshots|projects/import|registerExportStepRoutes|registerRoutes\\(app\\)" server/__tests__/*.ts` returned no matches.
- `ordering.test.ts` validates route logic by direct registration, not runtime `registerRoutes`:
  - `server/__tests__/ordering.test.ts:72`
- API integration suite can be fully skipped:
  - `server/__tests__/api.test.ts:84`

What is happening:
- Test coverage exists for utilities and select modules, but important route wiring and ownership behavior are under-tested at runtime registration level.

Why this matters:
- Security and routing regressions can pass CI undetected.

Fix recommendation:
- Add supertest-level integration tests against app built through `registerRoutes`.
- Add route registration parity tests.
- Add explicit authorization tests for every `/api/projects/:id*` domain route family.

## What Is Already Good
- Strong shared route utilities (`asyncHandler`, `HttpError`, `payloadLimit`, `parseIdParam`) are in place.
- Many routes use Zod request validation and clear status codes.
- ETag/version conflict flow is present for core mutable resources (`projects`, `nodes`, `edges`, `bom`).
- Stream/chat and agent endpoints include dedicated abuse controls (rate limits, payload limits, SSE safeguards).

## Test Coverage Assessment (This Section)
What exists:
- Good isolated tests for specific modules (`ordering`, `rag`, ownership middleware behavior, route utils).
- Large `api.test.ts` integration file exists for baseline project/BOM/validation flows.

Important gaps:
- Many BE-03 routes are not tested through the real `registerRoutes` boot path.
- No direct tests found for several high-risk route families in this pass (comments/snapshots/bom-snapshots/project import/AI actions by message).
- Runtime route mounting parity is not tested.

Execution note:
- Per user direction, this pass is inspection-only (no test runtime execution).

## Improvements / Enhancements
- Build one reusable `requireProjectAccess` layer and apply by route group (`/api/projects/:id/*`).
- Move child-resource lookups to project-scoped methods by default (`id + projectId` required).
- Introduce a route manifest test to prevent “implemented but unmounted” regressions.
- Add API contract helper for consistent `{ data, total }` / error envelope behavior.
- Add tenant scoping model for in-memory route families (jobs/batch/rag) or reclassify to admin-only.

## Decision Questions Before BE-04
1. Should legacy `ownerId = null` projects remain open access, or should we migrate them to explicit owners now?
2. For jobs/batch/rag, do we want strict per-user isolation, per-project isolation, or admin-only access?
3. Do we want to ship `ordering` and `export-step` routes now (mount + secure), or intentionally retire them?

## Suggested Fix Order
1. Close IDOR class issues: add project+resource scoping in comments/snapshots/lifecycle/preferences/bom-snapshots.
2. Enforce project ownership on all `/api/projects/:id*` route families.
3. Fix `/api/projects/import` ownership assignment (no more ownerless imports).
4. Fix route registration drift (`ordering`, `export-step`) and add route-manifest parity test.
5. Fix `batch.submit` validation path to return deterministic `400` on bad input.
6. Add tenant boundaries for jobs/batch/rag state.
7. Standardize response envelopes and strict pagination validation.

## Bottom Line
BE-03 shows strong route volume and decent baseline structure, but there are major authorization and route-surface integrity gaps. The highest-risk issue is a real IDOR pattern across multiple project-scoped child-resource routes, followed by incomplete ownership enforcement and ownerless import behavior. Fixing those first will materially improve backend safety before deeper BE-04 circuit-route auditing.
