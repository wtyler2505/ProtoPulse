# BE-11 Audit: Jobs + Background Processing

Date: 2026-03-06  
Auditor: Codex  
Section: BE-11 (from master map)  
Method: Code + test-surface inspection only (no runtime test suite execution).

## Scope Reviewed
- Core queue implementation:
  - `server/job-queue.ts`
- Queue API surface:
  - `server/routes/jobs.ts`
  - `server/routes.ts`
  - `server/index.ts`
- Adjacent background-processing context:
  - `server/routes/batch.ts`
  - `server/batch-analysis.ts`
- Test surface reviewed:
  - `server/__tests__/job-queue.test.ts`
  - reference-search across `server/__tests__/` for `/api/jobs` route coverage

## Jobs/Background Surface Snapshot (Current)
- Queue endpoints in `server/routes/jobs.ts`: `5`
- Queue unit/integration-style tests in `server/__tests__/job-queue.test.ts`: `63`
- Production `registerExecutor(...)` callsites found (outside tests): `0`
- `/api/jobs` HTTP route tests found under `server/__tests__/`: `0`

## Severity Key
- `P0`: direct cross-tenant data/control risk
- `P1`: high-impact correctness/reliability/abuse risk
- `P2`: medium-risk hardening/operability gap
- `P3`: low-risk consistency/doc gap

## Findings

### 1) `P0` Queue routes are authenticated but not tenant-scoped (cross-user read/cancel/delete risk)
Evidence:
- Job records do not carry ownership context (`userId`, `projectId`):
  - `server/job-queue.ts:28`
- List/get/cancel/remove operate on global queue state:
  - `server/routes/jobs.ts:53`
  - `server/routes/jobs.ts:87`
  - `server/routes/jobs.ts:106`
  - `server/routes/jobs.ts:125`
- Route responses return full job objects (including `payload` and `result`):
  - `server/routes/jobs.ts:68`
  - `server/routes/jobs.ts:92`
- Auth middleware sets `req.userId`, but BE-11 routes do not use it:
  - user attach: `server/index.ts:191`
  - no ownership checks in `server/routes/jobs.ts`

What is happening:
- Any authenticated user can enumerate global jobs and act on global job IDs.

Why this matters:
- Cross-user visibility/control is possible for sensitive long-running tasks, especially if payload/result includes private project/analysis data.

Fix recommendation:
- Add ownership fields to `JobRecord` and enforce checks in every jobs route.
- Scope list/get/cancel/remove by `(userId, projectId)` or explicitly gate to admin-only.
- Return safe job views (no raw payload/result by default; provide explicit privileged route for full inspection).

---

### 2) `P1` Queue is not wired to executors in production, so submitted jobs fail by design
Evidence:
- Only executor registration API exists:
  - `server/job-queue.ts:109`
- Search found no non-test `registerExecutor(...)` calls (definition-only in production files).
- Missing executor path immediately fails jobs:
  - `server/job-queue.ts:302`
  - `server/job-queue.ts:305`
- Jobs API still accepts submissions for all queue types:
  - `server/routes/jobs.ts:35`
  - `server/routes/jobs.ts:44`

What is happening:
- The queue endpoint accepts jobs, but there is no production bootstrap that registers executors for those types.

Why this matters:
- BE-11 job API appears functional but cannot execute real work, which can mislead clients and hide integration debt.

Fix recommendation:
- Add explicit executor bootstrap at server startup and fail fast if required executors are missing.
- Until fully wired, reject unsupported job types at submission with a clear 409/422 contract error.

---

### 3) `P1` No job runtime watchdog means stuck jobs can hold slots indefinitely
Evidence:
- Queue options include retries/TTL, but no per-job max runtime:
  - `server/job-queue.ts:61`
- Running jobs rely on executor promise settlement only:
  - `server/job-queue.ts:331`
- Cancellation is cooperative (AbortSignal) and depends on executor honoring it:
  - `server/job-queue.ts:323`
  - `server/job-queue.ts:196`
- TTL cleanup only removes terminal states:
  - `server/job-queue.ts:415`

What is happening:
- A hung executor that never resolves/rejects can occupy a concurrency slot forever.

Why this matters:
- Queue throughput can degrade to zero under stuck jobs, creating starvation and operational deadlocks.

Fix recommendation:
- Add `maxRuntimeMs` per job type and watchdog enforcement that marks timed-out jobs failed/cancelled.
- Track `lastProgressAt` and optionally fail jobs that exceed idle heartbeat thresholds.

---

### 4) `P1` Synchronous executor throws are not contained and can corrupt queue accounting
Evidence:
- Queue marks job `running` and increments `runningCount` before invoking executor:
  - `server/job-queue.ts:312`
  - `server/job-queue.ts:314`
- Executor invocation is not wrapped with try/catch or `Promise.resolve(...)` guard:
  - `server/job-queue.ts:331`
- Recovery logic exists only in chained `.catch(...)`:
  - `server/job-queue.ts:351`

What is happening:
- If an executor throws synchronously before returning a Promise, queue bookkeeping can be left inconsistent (e.g., slot never released).

Why this matters:
- One bad executor implementation can wedge the queue and block subsequent jobs.

Fix recommendation:
- Wrap invocation safely:
  - `Promise.resolve().then(() => executor(...))` or explicit `try/catch` around executor call.
- Add a targeted regression test for synchronous throw behavior.

---

### 5) `P1` Resource/admission controls are weak (unbounded queue growth, full payload/result retention, no idempotency)
Evidence:
- Queue state is an unbounded in-memory `Map`:
  - `server/job-queue.ts:81`
- Jobs store arbitrary `payload` and `result`:
  - `server/job-queue.ts:31`
  - `server/job-queue.ts:34`
- Submission accepts unknown payload shape:
  - `server/routes/jobs.ts:20`
- List/get endpoints return full records:
  - `server/routes/jobs.ts:68`
  - `server/routes/jobs.ts:92`
- API has general rate limiting, but no queue-specific quota/backpressure:
  - global limiter: `server/index.ts:129`

What is happening:
- Job objects can accumulate memory pressure and duplicate work with no queue-level cap, no dedupe key, and no payload/result size budgets.

Why this matters:
- A small number of clients can create high memory pressure and reduce service stability.

Fix recommendation:
- Add queue size limits, per-user/project quotas, and optional max payload/result byte budgets.
- Add idempotency keys for duplicate suppression.
- Return compact job summaries for list endpoints by default.

---

### 6) `P2` Queue durability and scale behavior are limited (single-process memory only)
Evidence:
- Queue explicitly stores state in memory:
  - `server/job-queue.ts:8`
- Singleton instance:
  - `server/job-queue.ts:438`

What is happening:
- Jobs are not durable across process restarts and cannot be coordinated across multiple app instances.

Why this matters:
- Background processing reliability degrades under restarts/deploys/horizontal scaling.

Fix recommendation:
- Move queue metadata/state to persistent storage and use a worker model (or durable queue backend) for multi-instance correctness.

---

### 7) `P2` Graceful shutdown path does not explicitly shut down the queue
Evidence:
- Queue has a dedicated shutdown method:
  - `server/job-queue.ts:258`
- Server graceful shutdown closes HTTP server + DB pool, but does not call `jobQueue.shutdown()`:
  - `server/index.ts:409`

What is happening:
- Queue cancellation/cleanup behavior is not integrated into process shutdown flow.

Why this matters:
- In-flight jobs may not be cleanly cancelled before process teardown, risking partial side effects and noisy shutdown behavior.

Fix recommendation:
- Call `jobQueue.shutdown()` during graceful shutdown before database/pool closure.
- Add a shutdown integration test for in-flight job cancellation semantics.

---

### 8) `P2` Test surface is strong for queue internals but weak at API/auth boundary
Evidence:
- Deep queue test file exists (63 tests):
  - `server/__tests__/job-queue.test.ts:15`
- "Route-level logic" tests are queue-level and explicitly non-HTTP:
  - `server/__tests__/job-queue.test.ts:1195`
- Reference search found no `/api/jobs` HTTP tests in `server/__tests__/`.

What is happening:
- Core queue behavior is heavily tested, but REST behavior (auth scope, response shaping, error mapping) is not.

Why this matters:
- API-level regressions can ship even if queue internals remain green.

Fix recommendation:
- Add HTTP integration tests for:
  - submit/list/get/cancel/remove happy paths
  - auth required cases
  - ownership/tenant isolation
  - missing-executor response contract

---

### 9) `P3` API docs do not include `/api/jobs` routes
Evidence:
- Jobs routes exist:
  - `server/routes/jobs.ts:35`
- Public API docs list does not include `/api/jobs` endpoints:
  - `server/api-docs.ts:8`

What is happening:
- Runtime API surface and docs are out of sync.

Why this matters:
- Discoverability, onboarding, and debugging quality drop when docs omit active endpoints.

Fix recommendation:
- Add full jobs route docs to `server/api-docs.ts`, including error/status semantics.

## What Is Already Good
- Queue internals are well structured for a first iteration: priority scheduling, bounded concurrency, retry backoff, cancellation, progress events, and TTL cleanup.
- Cleanup timer is unref’d so it does not pin process exit:
  - `server/job-queue.ts:403`
- The route layer has basic schema validation for query/body fields and clear status codes for key cases.

## Test Coverage Assessment (BE-11)
- Strong:
  - `server/__tests__/job-queue.test.ts` covers many queue mechanics and edge cases.
- Gaps:
  - No HTTP tests for `/api/jobs*`.
  - No API auth/tenant-isolation tests.
  - No test for synchronous executor throw containment.
  - No startup/bootstrap test proving executors are registered in production wiring.

## Improvements and Enhancements
- Add executor registry module with explicit per-type contracts and startup validation.
- Add tenant scoping to `JobRecord` + route guards.
- Add queue metrics endpoint or include queue stats in `/api/ready`/`/api/metrics` for operations visibility.
- Introduce queue admission policy (max queue size, per-user quotas, idempotency keys).
- Move toward durable queue backend if jobs are meant to survive restarts and scale horizontally.

## Decision Questions Before BE-12
1. Should jobs be scoped per user, per project, or both?
2. Is BE-11 intended as production-critical now, or still hidden/internal?
3. Do we want strict "reject submit when no executor is wired" behavior immediately?
4. Should job payload/result be returned raw at all, or only redacted summaries by default?
5. Are we committing to in-process ephemeral queue for this phase, or planning a durable worker backend soon?

## Suggested Fix Order
1. Enforce tenant scoping + safe response shaping (`P0`).
2. Wire/validate executors at startup and reject unsupported job submissions (`P1`).
3. Add runtime watchdog + synchronous throw hardening in executor invocation (`P1`).
4. Add admission/resource controls (queue caps, quotas, idempotency) (`P1`).
5. Integrate queue shutdown into server graceful shutdown path (`P2`).
6. Add HTTP route tests + docs parity updates (`P2`/`P3`).

## Bottom Line
BE-11 has a solid queue foundation and strong internal tests, but it is not production-safe yet for multi-user background processing. The biggest blockers are tenant isolation, missing production executor wiring, and lack of runtime safeguards against stuck or abusive workloads.
