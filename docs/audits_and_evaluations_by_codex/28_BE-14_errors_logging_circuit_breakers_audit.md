# BE-14 Audit: Errors + Logging + Circuit Breakers

Date: 2026-03-06  
Auditor: Codex  
Section: BE-14 (from master map)  
Method: Code + test-surface inspection only (no runtime test suite execution).

## Scope Reviewed
- Core error/logging/breaker modules:
  - `server/logger.ts`
  - `server/circuit-breaker.ts`
  - `server/storage/errors.ts`
  - `server/routes/utils.ts`
  - `server/circuit-routes/utils.ts`
- Runtime error handling + shutdown behavior:
  - `server/index.ts`
  - `server/env.ts`
  - `server/db.ts`
  - `server/audit-log.ts`
- AI route/breaker integration surfaces:
  - `server/ai.ts`
  - `server/routes/chat.ts`
  - `server/routes/agent.ts`
  - `server/circuit-ai/analyze.ts`
  - `server/circuit-ai/generate.ts`
  - `server/circuit-ai/review.ts`
- Test surface reviewed:
  - `server/__tests__/circuit-breaker.test.ts`
  - `server/__tests__/audit-log.test.ts`
  - `server/__tests__/routes-utils.test.ts`
  - `server/__tests__/agent-route.test.ts`
  - `server/__tests__/ai.test.ts` (error categorization/retryability slice)

## BE-14 Surface Snapshot (Current)
- Non-test runtime logger callsites in `server/`: `60`
- `StorageError` throw sites in `server/storage/*`: `105`
- `VersionConflictError` throw sites in `server/storage/*`: `6`
- Runtime breaker execution callsites (`anthropicBreaker`/`geminiBreaker`): `9`
- Runtime `getStatus()` consumer callsites (excluding definition/tests): `0`
- Circuit breaker singleton instances: `2` (provider-level only)
- Tests in `server/__tests__/circuit-breaker.test.ts`: `26`
- Tests in `server/__tests__/audit-log.test.ts`: `39`
- Tests in `server/__tests__/routes-utils.test.ts`: `12`
- Tests in `server/__tests__/agent-route.test.ts`: `27`

## Severity Key
- `P1`: high-impact correctness/reliability/operational-control gap
- `P2`: medium-risk resilience/observability/hardening gap
- `P3`: low-risk readiness/docs/test-surface gap

## Findings

### 1) `P1` Storage error HTTP mapping exists but is effectively bypassed by global error middleware
Evidence:
- `StorageError` computes HTTP status and PG code:
  - `server/storage/errors.ts:19`
  - `server/storage/errors.ts:30`
- Storage layer throws `StorageError` broadly (example):
  - `server/storage/projects.ts:26`
  - `server/storage/projects.ts:39`
  - `server/storage/bom.ts:34`
  - `server/storage/bom.ts:54`
- Global error middleware only checks `err.status` / `err.statusCode`:
  - `server/index.ts:370`
  - `server/index.ts:380`

What is happening:
- `StorageError.httpStatus` is not consumed by the global middleware, so many storage failures collapse to `500` regardless of mapped DB cause.

Why this matters:
- DB timeout/constraint/connectivity signals are downgraded into generic internal errors, reducing operational precision and client retry behavior quality.

Fix recommendation:
- Introduce an app-level error normalizer in global middleware:
  - `StorageError` -> use `httpStatus`, include safe `code` payload.
  - `HttpError` -> preserve explicit status/message.
- Keep server internals hidden for 5xx, but preserve correct status classes (409/408/503 etc).

---

### 2) `P1` `/api/chat/ai` returns HTTP 200 even when provider calls fail
Evidence:
- `processAIMessage` catches errors and returns `{ message, actions: [] }` instead of throwing:
  - `server/ai.ts:1032`
  - `server/ai.ts:1037`
- Route returns that payload directly with `res.json(result)`:
  - `server/routes/chat.ts:412`
  - `server/routes/chat.ts:428`

What is happening:
- Provider failures (auth, timeout, provider outage, breaker-open) are encoded as a normal success-shaped payload on a 200 response.

Why this matters:
- Clients cannot distinguish success vs provider failure via status codes, and monitoring/error budgets undercount failures.

Fix recommendation:
- Choose and enforce one contract:
  - Preferred: throw typed provider errors and return HTTP error status with structured code.
  - Alternate: keep 200 contract but add explicit `ok: false`, stable `errorCode`, and telemetry fields.

---

### 3) `P1` Circuit breaker blast radius is provider-global while API keys are user-specific
Evidence:
- Two singleton provider breakers:
  - `server/circuit-breaker.ts:160`
  - `server/circuit-breaker.ts:161`
- Chat flow can use per-user/per-request API keys:
  - `server/routes/chat.ts:395`
  - `server/routes/chat.ts:400`
  - `server/routes/chat.ts:463`
  - `server/routes/chat.ts:468`
- AI clients are keyed per API key, but breaker is not:
  - `server/ai.ts:549`
  - `server/ai.ts:556`

What is happening:
- Failures from one credential path can trip the shared provider breaker and throttle unrelated users on the same provider.

Why this matters:
- Cross-tenant reliability coupling: one bad key or noisy tenant can degrade service for everyone using that provider path.

Fix recommendation:
- Scope breakers by `(provider + key fingerprint)` or `(provider + tenant)`.
- Keep a small bounded LRU of breakers with idle eviction.

---

### 4) `P1` Breaker failure accounting treats all failures equally (including 4xx credential/model errors)
Evidence:
- Every thrown error increments failure count:
  - `server/circuit-breaker.ts:92`
  - `server/circuit-breaker.ts:93`
- Breaker trip logic has no error-class filter:
  - `server/circuit-breaker.ts:127`
  - `server/circuit-breaker.ts:143`
- AI layer already distinguishes retryability for fallback decisions:
  - `server/ai.ts:510`
  - `server/ai.ts:519`

What is happening:
- Client-caused errors (invalid key/model/input) contribute to breaker trip thresholds like true provider outages.

Why this matters:
- False-open events become much more likely and can appear as systemic provider instability.

Fix recommendation:
- Add `shouldCountFailure(error)` gate in breaker path.
- Count only provider/server/network classes (5xx, timeout, transport failures), not request/credential misuse.

---

### 5) `P1` Design-agent endpoint bypasses circuit breaker protections entirely
Evidence:
- Route imports AI client helpers, not breaker:
  - `server/routes/agent.ts:5`
- Direct provider call without breaker wrapper:
  - `server/routes/agent.ts:191`

What is happening:
- `/api/projects/:id/agent` can keep hammering provider path during outages because breaker guardrail is not applied here.

Why this matters:
- High-cost route is missing the same failure isolation used elsewhere in AI stack.

Fix recommendation:
- Route all provider calls through shared breaker-aware AI execution path, or wrap this endpoint with its own breaker policy.

---

### 6) `P2` HALF_OPEN semantics allow concurrent probes despite comment claiming single probe
Evidence:
- Contract comment says HALF_OPEN allows exactly one probe:
  - `server/circuit-breaker.ts:57`
- Implementation only blocks when state is `OPEN`; no in-flight probe gate in `HALF_OPEN`:
  - `server/circuit-breaker.ts:61`
  - `server/circuit-breaker.ts:75`

What is happening:
- Concurrent requests arriving during HALF_OPEN can run multiple probes.

Why this matters:
- Recovery probing can become noisy and inconsistent (thundering-herd style), reducing breaker stability.

Fix recommendation:
- Track `halfOpenProbeInFlight` and reject/queue additional probes until the single probe resolves.

---

### 7) `P2` Circuit breaker retry semantics are not propagated to HTTP clients
Evidence:
- `CircuitBreakerOpenError` includes retry window:
  - `server/circuit-breaker.ts:27`
  - `server/circuit-breaker.ts:35`
- Circuit-AI endpoints collapse non-auth/non-rate errors to 500 without `Retry-After`:
  - `server/circuit-ai/analyze.ts:160`
  - `server/circuit-ai/analyze.ts:162`
  - `server/circuit-ai/generate.ts:183`
  - `server/circuit-ai/review.ts:159`

What is happening:
- Retry-after intelligence exists in the error type but is not surfaced in route-level responses.

Why this matters:
- Clients cannot make policy-driven backoff decisions for breaker-open events.

Fix recommendation:
- Map `CircuitBreakerOpenError` to `503` (or `429`, policy choice) and set `Retry-After`.

---

### 8) `P2` Logging/breaker env parsing is brittle (invalid env values can silently degrade controls)
Evidence:
- Logger accepts unchecked `LOG_LEVEL` cast:
  - `server/logger.ts:5`
  - `server/logger.ts:8`
- Breaker thresholds/cooldown are `parseInt` without finite validation:
  - `server/circuit-breaker.ts:157`
  - `server/circuit-breaker.ts:158`
- Env validation currently checks `DATABASE_URL`, `PORT`, `NODE_ENV` only:
  - `server/env.ts:3`
  - `server/env.ts:20`

What is happening:
- Invalid `LOG_LEVEL` can suppress logs unexpectedly; invalid breaker envs can produce unstable/no-op breaker behavior.

Why this matters:
- Operational visibility and failure isolation become config-fragile.

Fix recommendation:
- Validate and normalize `LOG_LEVEL` and `CB_*` env vars during boot.
- Fail fast or fallback with explicit warning + safe defaults.

---

### 9) `P2` Global server error logs lack request context and error identity fields
Evidence:
- Error middleware logs generic message with only stack/status:
  - `server/index.ts:371`
- Middleware receives request object but currently ignores it in error log payload:
  - `server/index.ts:365`

What is happening:
- Core incident logs miss request path/method/requestId/error name/message fields.

Why this matters:
- Post-incident debugging is slower and correlation across logs is weaker.

Fix recommendation:
- Include `{ requestId, method, path, errorName, errorMessage, status }` in global error logs.
- Keep stack attached for server logs only.

---

### 10) `P3` Test surface is strong for unit behavior but thin for cross-module error contracts
Evidence:
- Strong unit coverage:
  - `server/__tests__/circuit-breaker.test.ts` (26 tests)
  - `server/__tests__/audit-log.test.ts` (39 tests)
- Gap areas:
  - No dedicated tests for `server/logger.ts` runtime behavior.
  - No integration tests verifying `StorageError.httpStatus` propagation through global middleware.
  - No tests for HALF_OPEN concurrent-probe exclusion semantics.
  - No tests ensuring `/api/chat/ai` contract explicitly distinguishes provider failure from success.

Why this matters:
- Important behavior at module boundaries can regress without detection.

Fix recommendation:
- Add targeted integration tests for global middleware status mapping and AI route error contracts.

## What Is Already Good
- Circuit breaker implementation is present and well documented, with broad unit coverage for core state transitions.
- Audit logging middleware captures normalized paths, status classes, request IDs, and response-size metadata.
- AI error categorization and secret redaction helpers are implemented and reused across multiple flows.
- Process-level `uncaughtException`/`unhandledRejection` hooks exist to avoid silent-failure operation.

## Test Coverage Assessment (BE-14-specific)
- Good depth:
  - Circuit breaker state machine unit behavior.
  - Audit logging field completeness and severity-level routing.
  - Route utility behavior (`HttpError`, `parseIdParam`, payload guard).
- Gaps:
  - Global error middleware behavior under `StorageError` and provider failures.
  - Breaker integration consistency across all AI endpoints (especially `agent` route).
  - Misconfiguration behavior (`LOG_LEVEL`, `CB_*`) and boot-time validation tests.

## Improvements / Enhancements
- Introduce a typed `AppError` base (`status`, `code`, `retryable`, `expose`) and normalize everything through one path.
- Build a breaker registry keyed by provider + tenant/key fingerprint with bounded lifecycle.
- Expose breaker health in readiness/diagnostics (`state`, `failures`, `nextRetryAt`) via guarded debug endpoint.
- Add structured logger context helper to auto-attach `requestId`/route metadata.
- Standardize client-facing AI error envelope (`ok`, `code`, `message`, `retryAfterMs?`, `provider`).

## Decision Questions
- Should `/api/chat/ai` continue the current HTTP-200-on-provider-failure behavior, or move to explicit HTTP error statuses?
- Should breaker scope remain provider-global, or be isolated per key/tenant?
- For breaker-open responses, do we want `503` (service unavailable) or `429` (retry-later) semantics?
- On invalid `LOG_LEVEL`/`CB_*`, should boot fail-fast or auto-default with warnings?

## Suggested Fix Order
1. Fix global error mapping to honor `StorageError.httpStatus` and normalize server error contracts.
2. Resolve breaker blast-radius issues: per-tenant/key scoping + failure-class filtering.
3. Apply breaker protections to `/api/projects/:id/agent`.
4. Expose retry semantics (`Retry-After`) for breaker-open responses.
5. Harden env validation for `LOG_LEVEL` + `CB_*`.
6. Add boundary integration tests for middleware + AI route error contracts.

## Bottom Line
BE-14 has solid foundational pieces, but error semantics and breaker scoping currently create real operational risk. The biggest issue is not missing components; it is cross-module contract drift (status mapping, route responses, and breaker scope) that can turn localized failures into system-wide noise or outages.
