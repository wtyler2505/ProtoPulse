# BE-01 Audit: Server Boot + Middleware Chain

Date: 2026-03-06  
Auditor: Codex  
Section: BE-01 (from master map)  
Method: Code + test-surface inspection only (no runtime test suite execution).

## Scope Reviewed
- Boot and middleware chain:
  - `server/index.ts`
  - `server/vite.ts`
  - `server/static.ts`
  - `server/env.ts`
  - `server/db.ts`
  - `server/audit-log.ts`
  - `server/metrics.ts`
  - `server/routes.ts`
  - `server/routes/chat.ts`
- Test surface related to BE-01 behavior:
  - `server/__tests__/auth-regression.test.ts`
  - `server/__tests__/api.test.ts`
  - `server/__tests__/audit-log.test.ts`
  - `server/__tests__/metrics.test.ts`
- Checklist alignment:
  - `docs/backend-audit-checklist.md`
  - `docs/product-analysis-checklist.md`

## Middleware Chain Snapshot (Current)
1. `validateEnv()` at startup import time.
2. CSP nonce generator.
3. `helmet(...)`.
4. `compression()`.
5. Dev-only CORS middleware.
6. Request ID assignment (`req.id`).
7. `X-Request-Id` response header set.
8. Global `/api` rate limiter.
9. Global `/api` version header.
10. Body parsers (`json`, `urlencoded`, `raw`, `text`).
11. Global same-origin guard (non-GET/HEAD/OPTIONS, stream skipped).
12. Request timeout guard (stream skipped).
13. Global `/api` auth gate + session validation.
14. `auditLogMiddleware`.
15. Request/response logging + `recordRequest(...)`.
16. Async bootstrap (DB check, route registration, health/ready/docs/metrics, static/vite catch-all, listen, process signal/error handlers).

## Severity Key
- `P0`: immediate security/data-loss risk
- `P1`: high-impact reliability/security/API behavior risk
- `P2`: medium reliability/ops/test-confidence risk
- `P3`: lower-risk debt/cleanup

## Findings

### 1) `P1` Global rate-limit stream skip check is wrong under `/api` mount
Evidence:
- `server/index.ts:129`
- `server/index.ts:134`
- `server/index.ts:136`
- `server/__tests__/auth-regression.test.ts:528`
- `server/__tests__/auth-regression.test.ts:531`
- Local repro command output (executed during audit): `req.path=/chat/ai/stream` under `app.use('/api', ...)`, and second stream request returned `429`.

What is happening:
- Global limiter skip compares `req.path === '/api/chat/ai/stream'`.
- Under mounted middleware (`app.use('/api', ...)`), Express provides `req.path` as `/chat/ai/stream`, so skip never triggers.

Why this matters:
- Long-lived stream endpoint is unintentionally counted by global limiter.
- This can throttle valid AI usage and conflicts with stream-specific controls in `routes/chat.ts`.

Fix recommendation:
- Use `req.originalUrl` or `req.baseUrl + req.path` for skip logic.
- Add real middleware integration test (not reconstructed constant comparison).

---

### 2) `P2` Public-path bypass check has mount-path mismatch for seed routes
Evidence:
- `server/index.ts:191`
- `server/index.ts:192`
- `server/index.ts:193`
- `server/__tests__/auth-regression.test.ts:757`
- `server/__tests__/auth-regression.test.ts:759`

What is happening:
- Middleware is mounted at `/api`, but bypass condition checks `req.path === '/api/seed'` and `'/api/admin/seed-library'`.
- In mounted middleware, these should be `/seed` and `/admin/seed-library`.

Why this matters:
- Seed routes may behave differently than intended (unexpected auth requirement in dev workflows).
- Current regression test reconstructs path logic and can miss this exact runtime mismatch.

Fix recommendation:
- Change checks to mounted-path values or normalize with helper.
- Add integration assertion for `POST /api/seed` and `POST /api/admin/seed-library`.

---

### 3) `P1` Unknown `/api/*` requests can fall through to SPA HTML catch-all (200)
Evidence:
- `server/vite.ts:34`
- `server/vite.ts:52`
- `server/static.ts:24`
- `server/static.ts:26`
- `server/index.ts:383`

What is happening:
- Dev and prod both register a broad catch-all route for HTML app shell.
- There is no explicit API 404 JSON handler before catch-all.

Why this matters:
- Invalid API endpoints can return HTML with `200` instead of JSON `404`.
- Breaks API contracts and makes debugging client/server errors harder.

Fix recommendation:
- Add `/api` not-found handler before static/vite catch-all.
- Ensure unknown API routes return JSON `{ message: 'Not found' }` with `404`.

---

### 4) `P1` Fatal process handlers are registered too late in bootstrap lifecycle
Evidence:
- `server/index.ts:280`
- `server/index.ts:282`
- `server/index.ts:284`
- `server/index.ts:427`
- `server/index.ts:430`
- `server/index.ts:435`

What is happening:
- `checkConnection()` and `registerRoutes()` run before `uncaughtException`/`unhandledRejection` handlers are attached.

Why this matters:
- Early boot failures may bypass the intended graceful shutdown/logging path.
- Startup failure behavior becomes inconsistent and harder to operate.

Fix recommendation:
- Register process handlers before async bootstrap work starts.
- Wrap bootstrap in a top-level `try/catch` with explicit fatal logging + exit code.

---

### 5) `P1` Fatal error paths exit with status `0` (success)
Evidence:
- `server/index.ts:409`
- `server/index.ts:419`
- `server/index.ts:430`
- `server/index.ts:435`

What is happening:
- `gracefulShutdown()` always calls `process.exit(0)`, including `uncaughtException` and `unhandledRejection` paths.

Why this matters:
- Crash exits can be misread as clean shutdowns by supervisors/CI/ops tooling.
- Alerts/restart policies become less reliable.

Fix recommendation:
- Accept an `exitCode` parameter.
- Use non-zero exit for fatal exception/rejection paths.

---

### 6) `P1` Audit logging is ordered after auth gate, so many denied requests are not audited
Evidence:
- `server/index.ts:191`
- `server/index.ts:202`
- `server/index.ts:210`
- `server/index.ts:218`

What is happening:
- Auth middleware can terminate request with `401` and return without `next()`.
- `auditLogMiddleware` is registered after auth, so those requests never reach audit logging.

Why this matters:
- Missing audit trail for unauthorized/expired-session attempts.
- Security forensics and abuse analysis lose key visibility.

Fix recommendation:
- Move audit logging before auth (with null user fallback), or add a lightweight pre-auth audit layer.

---

### 7) `P2` Metrics lifecycle is incomplete in runtime boot path
Evidence:
- `server/metrics.ts:351`
- `server/metrics.ts:371`
- `server/metrics.ts:400`
- `rg -n "startMetricsCollection|stopMetricsCollection|flushMetrics" server/index.ts server/metrics.ts` (only `metrics.ts` matches)

What is happening:
- `startMetricsCollection()` / `stopMetricsCollection()` are implemented but never called by server bootstrap.

Why this matters:
- Event-loop/process metrics and persistence lifecycle are not fully active in runtime.
- `/api/metrics` still returns route counts, but the richer metrics design is under-utilized.

Fix recommendation:
- Start metrics collection during boot.
- Stop + flush metrics during graceful shutdown.

---

### 8) `P2` CSP behavior drift: dev CSP is disabled while docs claim unified coverage
Evidence:
- `server/index.ts:51`
- `docs/backend-audit-checklist.md:61`
- `docs/backend-audit-checklist.md:62`
- `docs/product-analysis-checklist.md:463`

What is happening:
- Current code disables CSP in dev (`contentSecurityPolicy: false`).
- Project checklists state this was fixed with unified/reporting behavior.

Why this matters:
- Security regression risk during local testing.
- Documentation and implementation are out of sync.

Fix recommendation:
- Either re-enable report-only CSP in dev (recommended) or update docs to current truth.

---

### 9) `P2` BE-01 test coverage gives false confidence on real middleware behavior
Evidence:
- `server/__tests__/auth-regression.test.ts:528`
- `server/__tests__/auth-regression.test.ts:531`
- `server/__tests__/auth-regression.test.ts:756`
- `server/__tests__/auth-regression.test.ts:759`
- `server/__tests__/api.test.ts:84`

What is happening:
- Critical middleware checks are often tested as reconstructed constants/functions, not against the real Express pipeline.
- `api.test.ts` suites are all `skipIf(!serverAvailable)`, so they can silently not run in many environments.

Why this matters:
- Runtime path-prefix bugs can slip through (already observed in this pass).

Fix recommendation:
- Extract app construction into testable factory and run supertest-style middleware chain tests in CI.
- Keep external integration tests, but do not rely on them as the only signal.

## What Is Already Good
- Fail-fast env validation exists (`server/env.ts`) with clear errors.
- Security headers (`HSTS`, `referrerPolicy`) and same-origin checks are present.
- Request IDs are generated and attached (`X-Request-Id`).
- Stream endpoint has dedicated abuse controls in `server/routes/chat.ts` (origin/rate/concurrency/size/timeouts).
- Health and readiness surfaces exist (`/api/health`, `/api/ready`).

## Test Coverage Assessment (This Section)
What exists:
- Strong unit-level tests for `metrics.ts` and `audit-log.ts`.
- Security regression file covers many policy areas conceptually.

Important gaps:
- No direct execution tests for full boot chain in `server/index.ts` (middleware order, mount-path semantics, API catch-all behavior, startup failure behavior).
- Many tests reconstruct logic rather than invoking actual middleware.
- Runtime integration suite can be entirely skipped when server is unavailable.

Execution note:
- Per user direction, this pass is inspection-only (no test runtime execution).

## Improvements / Enhancements
- Split boot into `createApp()` + `startServer()` for deterministic middleware-order tests.
- Centralize public-path policy in one tested helper used by runtime middleware (avoid duplicated string logic).
- Add explicit `/api` 404 JSON middleware before SPA catch-all.
- Add startup self-check logs summarizing middleware guard states (auth bypass, debug endpoint exposure, CSP mode).
- Add one CI test that verifies stream route is excluded from global limiter in real Express mount context.

## Decision Questions Before BE-02
1. Should `seed` routes be intentionally public in dev, or require authenticated/admin sessions?
2. Should `/api/docs` and `/api/metrics` stay publicly callable when debug exposure is enabled, or require auth/admin?
3. Do we want dev CSP as report-only (stronger) or fully disabled (fewer local friction points)?

## Suggested Fix Order
1. Fix mount-path bugs in global limiter skip and seed-route public checks.
2. Add `/api` JSON 404 handler before static/vite catch-all.
3. Register fatal process handlers earlier and return non-zero exit on fatal shutdown.
4. Move/adjust audit logging to capture denied auth attempts.
5. Activate metrics lifecycle (`startMetricsCollection` + shutdown flush).
6. Align docs with actual CSP mode (or restore report-only dev CSP).

## Bottom Line
BE-01 shows a mostly solid middleware stack, but there are important real-world chain bugs (mount-path mismatches, API catch-all behavior, handler timing, and audit visibility) that can impact reliability and trust. Fixing these in one focused hardening pass will materially improve backend stability before deeper section audits.
