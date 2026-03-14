---
name: Circuit breaker pattern isolates AI provider failures preventing cascading outages across Anthropic and Gemini
description: Per-provider CircuitBreaker instances (anthropicBreaker, geminiBreaker) in server/circuit-breaker.ts implement the standard CLOSED->OPEN->HALF_OPEN state machine — tripping after N consecutive failures, rejecting requests for a cooldown period, then probing with a single request to test recovery
type: insight
---

# Circuit Breaker Pattern Isolates AI Provider Failures, Preventing Cascading Outages Across Anthropic and Gemini

`server/circuit-breaker.ts` implements the circuit breaker reliability pattern with per-provider singleton instances:

```
CLOSED (normal) --[N failures]--> OPEN (reject all) --[cooldown]--> HALF_OPEN (probe one) --[success]--> CLOSED
                                                                                           --[failure]--> OPEN
```

**Configuration:**
- `failureThreshold`: 3 consecutive failures (configurable via `CB_FAILURE_THRESHOLD` env var)
- `cooldownMs`: 30 seconds (configurable via `CB_COOLDOWN_MS` env var)
- Two independent instances: `anthropicBreaker` and `geminiBreaker`

**Key implementation details:**
- Success in CLOSED state resets the failure counter (not just in HALF_OPEN), preventing slow-burn failure accumulation
- `CircuitBreakerOpenError` carries `retryAfterMs` so the client can display a meaningful countdown
- The breaker wraps the actual API call via `execute<T>(fn: () => Promise<T>)` — all Anthropic calls go through `anthropicBreaker.execute()` and all Gemini calls through `geminiBreaker.execute()`
- `getStatus()` method exposes diagnostics for the `/api/admin/health` endpoint

**Integration with fallback routing:** When the primary provider's breaker is OPEN, `isRetryableError()` returns `true` for `CircuitBreakerOpenError`, triggering the fallback provider path. This means if Anthropic is down, requests automatically route to Gemini (and vice versa) — but only if the user has configured API keys for both providers.

**Why the 4xx exclusion matters:** `isRetryableError()` explicitly excludes 4xx status codes from retry. This prevents the fallback from masking client errors — if a user's API key is invalid (401) or they hit rate limits (429), retrying with the other provider would either fail the same way or burn the user's alternate quota.

**Related:**

- [[ai-model-routing-uses-a-phase-complexity-matrix-not-message-length-to-select-the-cheapest-sufficient-model]] — the routing matrix selects the provider/tier, but a tripped breaker overrides that selection by forcing fallback to the alternate provider
- [[ai-request-deduplication-uses-an-in-flight-promise-map-keyed-by-provider-project-and-message-prefix]] — dedup and circuit breaking are layered resilience: dedup prevents duplicate calls to a healthy provider, the breaker prevents all calls to a failing one
- [[job-queue-uses-per-type-watchdog-timeouts-and-exponential-backoff-because-ai-analysis-and-export-generation-have-different-runtime-profiles]] — the job queue's exponential backoff (4x factor for rate limits) complements the breaker's cooldown period; the breaker prevents calls entirely while open, backoff spaces out retries during recovery
- [[graceful-shutdown-drains-resources-in-dependency-order-with-a-30-second-forced-exit-backstop]] — breaker status is exposed via `/api/admin/health`; during graceful shutdown, an OPEN breaker means in-flight AI jobs will fail fast rather than hang
