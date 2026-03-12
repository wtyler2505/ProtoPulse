# BE-13 Audit: Cache + Metrics + Performance Controls

Date: 2026-03-06  
Auditor: Codex  
Section: BE-13 (from master map)  
Method: Code + test-surface inspection only (no runtime test suite execution).

## Scope Reviewed
- Core cache/metrics modules:
  - `server/cache.ts`
  - `server/lib/lru-cache.ts`
  - `server/metrics.ts`
- Runtime wiring and middleware/perf controls:
  - `server/index.ts`
  - `server/routes/chat.ts`
  - `server/routes/agent.ts`
  - `server/routes/embed.ts` (adjacent in-memory TTL/rate control)
- Cache key/invalidation usage:
  - `server/storage/projects.ts`
  - `server/storage/architecture.ts`
  - `server/storage/bom.ts`
  - `server/storage/components.ts`
  - `server/storage/ordering.ts`
- Test surface reviewed:
  - `server/__tests__/lru-cache.test.ts`
  - `server/__tests__/metrics.test.ts`
  - `server/__tests__/stream-abuse.test.ts`
  - `server/__tests__/api.test.ts`
  - `server/__tests__/auth-regression.test.ts`

## BE-13 Surface Snapshot (Current)
- Dynamic API route templates with path params discovered: `101`
- Metrics normalization rules in `server/metrics.ts`: `36`
- Non-test runtime callsites for `startMetricsCollection(...)`: `0`
- Cache invalidation callsites across storage modules: `25`
- Tests in `server/__tests__/lru-cache.test.ts`: `23`
- Tests in `server/__tests__/metrics.test.ts`: `26`
- Tests in `server/__tests__/stream-abuse.test.ts`: `41`

## Severity Key
- `P1`: high-impact correctness/reliability/performance-control gap
- `P2`: medium-risk hardening/operability/perf quality gap
- `P3`: low-risk readiness/docs/test-surface gap

## Findings

### 1) `P1` Metrics lifecycle is implemented but not wired into runtime
Evidence:
- Metrics lifecycle API exists:
  - `server/metrics.ts:351`
  - `server/metrics.ts:371`
- Server boot imports only `recordRequest` + `getMetrics`:
  - `server/index.ts:12`
- No non-test runtime invocation of `startMetricsCollection(...)` (definition-only callsite scan).
- Graceful shutdown closes HTTP + DB only (no metrics stop/flush call):
  - `server/index.ts:409`
  - `server/index.ts:411`
  - `server/index.ts:419`

What is happening:
- Request counters are recorded, but process/event-loop sampling and periodic persistence never start in production boot flow.

Why this matters:
- `/api/metrics` is partially populated (route counters) while process telemetry remains non-operational, and no disk persistence lifecycle is active.

Fix recommendation:
- Start metrics collection during boot after route registration.
- Stop/flush metrics during graceful shutdown before `pool.end()`.

---

### 2) `P1` Route-metrics cardinality is effectively unbounded due partial normalization coverage
Evidence:
- Metrics state is an unbounded `Map` keyed by normalized method/path:
  - `server/metrics.ts:154`
  - `server/metrics.ts:185`
- Every `/api` response records metrics:
  - `server/index.ts:261`
  - `server/index.ts:273`
- Normalization is rule-list driven and incomplete relative to current route surface:
  - `server/metrics.ts:86`
  - `server/metrics.ts:140`
- Many dynamic routes are outside explicit normalization rules, e.g.:
  - `server/routes/comments.ts:77`
  - `server/routes/comments.ts:97`
  - `server/routes/design-history.ts:27`
  - `server/routes/design-history.ts:69`
  - `server/routes/jobs.ts:80`
  - `server/routes/jobs.ts:99`
  - `server/routes/chat.ts:634`

What is happening:
- Numerous ID-bearing paths are only partially normalized (or not normalized), so per-entity paths can create distinct metrics keys indefinitely.

Why this matters:
- Memory growth, bigger metrics payloads, and heavier persistence I/O risk under normal use or path-fuzz traffic.

Fix recommendation:
- Add fallback segment normalization (e.g., unknown numeric/token segments) after explicit route rules.
- Consider recording against Express route templates (or centrally maintained route-key map) instead of raw `req.path`.
- Add hard caps on stored route keys + eviction policy.

---

### 3) `P1` Prefix invalidation can cross-project evict cache keys (`startsWith` collisions)
Evidence:
- Invalidation logic is plain prefix match:
  - `server/cache.ts:69`
  - `server/cache.ts:72`
- Project cache keys use compact prefixes:
  - `server/storage/projects.ts:32`
  - `server/storage/architecture.ts:20`
  - `server/storage/bom.ts:23`
- Invalidations use patterns like `project:${id}`, `nodes:${id}`, `bom:${id}`:
  - `server/storage/projects.ts:93`
  - `server/storage/projects.ts:113`
  - `server/storage/projects.ts:114`
  - `server/storage/projects.ts:116`

What is happening:
- `invalidate('project:1')` also matches `project:10...` and `project:100...` patterns due raw `startsWith`.

Why this matters:
- Cross-project cache churn increases DB load and makes cache behavior noisy/unpredictable under multi-project workloads.

Fix recommendation:
- Use boundary-aware invalidation (`key === pattern || key.startsWith(pattern + ':')`).
- Standardize cache key schema so “entity root” invalidation is exact and deliberate.

---

### 4) `P1` Metrics flush interval can trigger unhandled rejection shutdown when write fails
Evidence:
- Periodic flush launches async write without local catch:
  - `server/metrics.ts:365`
  - `server/metrics.ts:366`
- `flushMetrics` writes to filesystem and can reject:
  - `server/metrics.ts:344`
- Global unhandled rejection handler triggers process shutdown:
  - `server/index.ts:435`
  - `server/index.ts:439`

What is happening:
- If metrics flushing is enabled and `writeFile` fails (permissions/disk/transient FS issue), the rejected Promise can bubble to global unhandled rejection handling.

Why this matters:
- Telemetry persistence failure can escalate into full server shutdown.

Fix recommendation:
- Wrap periodic flush with explicit `.catch(...)` and structured logging.
- Keep telemetry flush failures non-fatal.

---

### 5) `P2` `startMetricsCollection()` is not idempotent and can leak intervals/monitors on repeated starts
Evidence:
- Start always allocates new monitor + timers:
  - `server/metrics.ts:356`
  - `server/metrics.ts:361`
  - `server/metrics.ts:365`
- No guard preventing second start while already running.
- `stopMetricsCollection()` clears only currently referenced timers:
  - `server/metrics.ts:372`
  - `server/metrics.ts:376`
  - `server/metrics.ts:380`

What is happening:
- Repeated start calls can stack timers and orphan earlier handles.

Why this matters:
- Duplicate sampling/flush work and timer leaks become likely in hot-reload or accidental multi-init scenarios.

Fix recommendation:
- Add `if (flushTimer || processTimer || eventLoopHistogram) return;` guard or explicit restart semantics.

---

### 6) `P2` Global compression is applied before SSE routes (stream latency/buffering risk)
Evidence:
- Compression middleware is global:
  - `server/index.ts:90`
- SSE endpoints set `text/event-stream`:
  - `server/routes/chat.ts:433`
  - `server/routes/chat.ts:484`
  - `server/routes/agent.ts:120`
  - `server/routes/agent.ts:152`

What is happening:
- SSE responses are routed through global compression unless explicitly filtered.

Why this matters:
- Stream token/heartbeat delivery can be delayed by buffering/compression behavior, hurting realtime UX and timeout stability.

Fix recommendation:
- Exclude SSE routes/content type from compression filter.
- Keep compression for standard JSON endpoints.

---

### 7) `P2` In-memory per-IP rate buckets are vulnerable to cardinality growth under proxy/IP spoof edge cases
Evidence:
- Trust proxy is forced globally:
  - `server/index.ts:35`
- Stream rate limiting is IP-keyed map:
  - `server/routes/chat.ts:27`
  - `server/routes/chat.ts:70`
- Agent rate limiting is IP-keyed map:
  - `server/routes/agent.ts:23`
  - `server/routes/agent.ts:38`

What is happening:
- Rate-control memory and fairness depend on trusted/stable `req.ip`; if forwarding headers are not fully controlled in deployment, attackers can inflate key space and dilute per-IP limits.

Why this matters:
- Perf-control effectiveness drops and memory pressure risk rises under abusive traffic patterns.

Fix recommendation:
- Validate proxy assumptions per environment (do not hardcode trust blindly).
- Add max-bucket caps and eviction safeguards for limiter maps.

---

### 8) `P2` Primary `SimpleCache` sweep timer is not `unref()`’d and not tied into shutdown lifecycle
Evidence:
- Cache sweep interval is created without `unref()`:
  - `server/cache.ts:21`
- Global cache instance auto-starts sweep at module load:
  - `server/cache.ts:88`
  - `server/cache.ts:89`
- Graceful shutdown does not call cache cleanup:
  - `server/index.ts:409`
  - `server/index.ts:419`

What is happening:
- Cache timer lifecycle is detached from server lifecycle management.

Why this matters:
- Operational cleanliness suffers (open-handle behavior in non-server contexts/tests, no deterministic cache teardown path).

Fix recommendation:
- `unref()` sweep timer and invoke cache teardown during shutdown.

---

### 9) `P3` `/api/ready` reports cache dependency as always-up, without real health signal
Evidence:
- Cache status in readiness response is hardcoded:
  - `server/index.ts:328`
  - `server/index.ts:329`

What is happening:
- Readiness cannot reflect cache subsystem degradation or misconfiguration.

Why this matters:
- Operational dashboards get a false green signal for cache health.

Fix recommendation:
- Expose cache health/stats (size, sweep active, recent errors) and report concrete status.

---

### 10) `P3` Test surface has meaningful quantity, but several key BE-13 behaviors are not directly validated
Evidence:
- Strong unit suites exist:
  - `server/__tests__/lru-cache.test.ts` (`23` tests)
  - `server/__tests__/metrics.test.ts` (`26` tests)
- Stream abuse suite largely validates internal sets/maps and derived logic via `_streamInternals`:
  - `server/__tests__/stream-abuse.test.ts:68`
  - `server/__tests__/stream-abuse.test.ts:124`
  - `server/__tests__/stream-abuse.test.ts:138`
- `/api/metrics` tests focus on basic happy-path response:
  - `server/__tests__/api.test.ts:250`
- No tests found covering `EXPOSE_DEBUG_ENDPOINTS` gating behavior (`search count: 0`).

What is happening:
- Important runtime wiring and policy behaviors (boot lifecycle, production debug-endpoint gating, broad normalization coverage) are under-tested.

Why this matters:
- Regressions in performance controls are likely to ship unnoticed.

Fix recommendation:
- Add integration tests for:
  - metrics lifecycle boot/shutdown behavior
  - prod 404 behavior for `/api/metrics` and `/api/docs` when debug endpoints are disabled
  - normalization coverage for newer dynamic route families
  - stream middleware chain behavior via actual Express route execution (not only internal state maps)

## What Is Already Good
- Cache primitives are simple, readable, and heavily unit-tested.
- Stream routes include layered control gates (origin, payload limit, body size, rate limit, concurrency, timeout, heartbeat, backpressure):
  - `server/routes/chat.ts:434`
  - `server/routes/chat.ts:435`
  - `server/routes/chat.ts:436`
  - `server/routes/chat.ts:437`
  - `server/routes/chat.ts:438`
  - `server/routes/chat.ts:502`
  - `server/routes/chat.ts:551`
- Metrics module has useful foundations: path normalization, percentile snapshots, process memory/event-loop sampling, and disk persistence plumbing:
  - `server/metrics.ts:140`
  - `server/metrics.ts:240`
  - `server/metrics.ts:269`
  - `server/metrics.ts:323`

## Test Coverage Assessment (BE-13)
- Strong:
  - `server/__tests__/lru-cache.test.ts`
  - `server/__tests__/metrics.test.ts`
- Medium:
  - `server/__tests__/stream-abuse.test.ts` has breadth, but much is state-based rather than full route middleware execution.
- Gaps:
  - No runtime boot/shutdown tests for metrics lifecycle integration.
  - No production debug-endpoint gating tests (`EXPOSE_DEBUG_ENDPOINTS` path behavior).
  - No boundary test for prefix invalidation collisions (e.g., `project:1` vs `project:10`).
  - Normalization tests do not cover many newer dynamic route families.

## Improvements and Enhancements
- Add cache stats (`hits`, `misses`, `evictions`, `sweepRuns`, `sweepDeletes`) and include them in readiness/metrics output.
- Add route-key cardinality cap in metrics, with overflow bucket (e.g., `OTHER /api/*`) after threshold.
- Centralize perf control policy (compression filter, timeouts, rate limits, SSE exceptions) in a dedicated module with integration tests.
- Add deployment-aware proxy/IP strategy and document required reverse-proxy header behavior.

## Decision Questions Before BE-14
1. Should `/api/metrics` stay public in non-production, or require auth/admin key consistently across all envs?
2. Do we want strict exact-match invalidation semantics now, or a broader cache-key redesign first?
3. Is metrics persistence to local disk a requirement for production, or should this move to external telemetry only?
4. Should SSE be explicitly excluded from compression across all stream endpoints immediately?
5. Do we want a hard cap for in-memory limiter buckets (stream + agent) in this phase?

## Suggested Fix Order
1. Wire metrics lifecycle at boot/shutdown and add safe flush error handling (`P1`).
2. Fix metrics route-key cardinality risk (normalization fallback + cap) (`P1`).
3. Fix cache invalidation boundary semantics to prevent prefix collisions (`P1`).
4. Exclude SSE from compression and validate stream latency behavior (`P2`).
5. Harden IP-based limiter assumptions and bucket caps (`P2`).
6. Expand integration tests for runtime perf controls and debug endpoint gating (`P3`).

## Bottom Line
BE-13 has solid building blocks, but runtime wiring and guardrails are incomplete. The biggest risks are metrics lifecycle non-activation, unbounded route-key growth, and cache invalidation prefix collisions that can erode performance predictability at scale.
