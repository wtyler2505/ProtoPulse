---
name: Job queue uses per-type watchdog timeouts and exponential backoff because AI analysis and export generation have different runtime profiles
description: The in-process job queue in server/job-queue.ts assigns different max runtime watchdog timeouts per job type (AI analysis 5min, export generation 10min) and uses exponential backoff (base 1s, factor 4x) for retries — jobs that exceed their watchdog are automatically cancelled via AbortController
type: insight
---

# Job Queue Uses Per-Type Watchdog Timeouts and Exponential Backoff Because AI Analysis and Export Generation Have Different Runtime Profiles

`server/job-queue.ts` implements an in-process async job queue with several non-obvious design choices:

**Per-type watchdog timeouts:**
```
ai_analysis:       300,000ms (5 min)
export_generation: 600,000ms (10 min)
batch_drc:         300,000ms (5 min)
report_generation: 600,000ms (10 min)
import_processing: 300,000ms (5 min)
```
Export/report generation gets 2x the timeout because these jobs produce files (Gerber, PDF, design reports) that involve heavy computation or large I/O. AI analysis jobs are capped lower because a 5-minute AI call has almost certainly hit a provider timeout already.

**Exponential backoff retries:**
- Base delay: 1 second
- Factor: 4x (1s -> 4s -> 16s -> 64s)
- Default max retries: 3
- This aggressive backoff (4x rather than the typical 2x) is designed for AI provider rate limits, where retry-too-soon guarantees another 429.

**Cancellation via AbortController:**
- Each job gets its own `AbortController` stored in a parallel map
- The `signal` is passed to the executor function so it can check `signal.aborted` during long operations
- External cancellation (user-initiated or watchdog timeout) calls `controller.abort()`

**Tenant scoping:**
- Each job carries optional `projectId` and `userId` fields
- Jobs can be queried by tenant scope, preventing cross-tenant visibility

**TTL-based cleanup:**
- Completed/failed/cancelled jobs are auto-pruned after 1 hour (configurable)
- Cleanup runs every 5 minutes
- This prevents memory leaks from accumulated job records

**Graceful shutdown integration:**
- `shutdownGraceful(graceMs)` cancels all pending jobs and waits up to `graceMs` for running jobs to complete
- Called by `server/shutdown.ts` with a 10-second grace period

**Related:**

- [[circuit-breaker-pattern-isolates-ai-provider-failures-preventing-cascading-outages-across-anthropic-and-gemini]] — the circuit breaker's 4xx exclusion and cooldown period complement the job queue's exponential backoff: the breaker rejects fast during OPEN state, backoff spaces retries during recovery
- [[graceful-shutdown-drains-resources-in-dependency-order-with-a-30-second-forced-exit-backstop]] — job queue drain is step 2 of shutdown (before HTTP close, before DB close); the 10s grace period means long-running export jobs (10min watchdog) will be cancelled during shutdown
- [[ai-model-routing-uses-a-phase-complexity-matrix-not-message-length-to-select-the-cheapest-sufficient-model]] — the job queue's per-type timeouts encode the same domain awareness as the routing matrix: AI analysis and export generation are fundamentally different workloads
- [[circuits-zero-defaulting-in-export-and-ordering-is-a-latent-multi-project-regression-because-it-silently-picks-the-wrong-circuit]] — export_generation jobs (10min timeout) are the runtime cost of the export system; wrong circuit selection means that entire 10-minute job produces incorrect output
