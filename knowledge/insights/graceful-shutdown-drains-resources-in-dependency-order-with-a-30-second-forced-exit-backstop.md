---
name: Graceful shutdown drains resources in dependency order with a 30-second forced exit backstop
description: server/shutdown.ts orchestrates shutdown in strict order — job queue drain (10s grace) -> collaboration WebSocket close -> metrics flush -> HTTP server close -> database pool end — with a 30s setTimeout backstop that calls process.exit(1) if anything hangs, using unref() so the timer doesn't itself prevent clean exit
type: insight
---

# Graceful Shutdown Drains Resources in Dependency Order with a 30-Second Forced Exit Backstop

`server/shutdown.ts` implements a multi-phase shutdown orchestrator that demonstrates several reliability patterns:

**Drain order matters:**
1. Log active connections (diagnostics)
2. Drain [[job-queue-uses-per-type-watchdog-timeouts-and-exponential-backoff-because-ai-analysis-and-export-generation-have-different-runtime-profiles|job queue]] — cancel pending, wait up to 10s for running jobs
3. Close collaboration WebSocket server (stops real-time editing, flushing pending [[crdt-merge-uses-intent-preserving-rules-where-insert-always-beats-concurrent-delete-a-deliberate-philosophical-choice|CRDT operations]])
4. Stop metrics collection and flush buffered metrics
5. Close HTTP server (stops accepting new connections, waits for in-flight requests)
6. Close database connection pool (last, because jobs/requests may need DB access during drain — late connection failures are translated to 503 by [[storage-error-maps-postgresql-error-codes-to-http-status-giving-routes-structured-error-semantics-without-db-coupling|StorageError]])

**Forced exit backstop:** A `setTimeout(30_000)` calls `process.exit(1)` if the graceful sequence hangs. The timer uses `.unref()` so it doesn't prevent clean exit if everything finishes faster. This prevents the dreaded "server stops responding but never actually exits" zombie state.

**Late-binding collaboration server:** The collaboration WebSocket server is registered via `registerCollaborationServer()` called from `index.ts` after the server starts. This avoids a circular dependency — `shutdown.ts` doesn't import `collaboration.ts` at module load time.

**Why the ordering is non-obvious:**
- Job queue drains before HTTP server closes because running jobs may be producing SSE events — closing HTTP first would drop those streams
- Metrics flush happens before HTTP close because metrics may record shutdown-related events
- Database pool closes last because every other shutdown step may need to read/write data (e.g., updating job status to "cancelled")

**Related:**

- [[job-queue-uses-per-type-watchdog-timeouts-and-exponential-backoff-because-ai-analysis-and-export-generation-have-different-runtime-profiles]] — the job queue's `shutdownGraceful(10s)` is step 2 of the drain sequence; long-running export jobs (10min watchdog) will be cancelled
- [[circuit-breaker-pattern-isolates-ai-provider-failures-preventing-cascading-outages-across-anthropic-and-gemini]] — breaker status exposed via `/api/admin/health`; an OPEN breaker during shutdown means AI jobs fail fast rather than consuming grace period time
- [[crdt-merge-uses-intent-preserving-rules-where-insert-always-beats-concurrent-delete-a-deliberate-philosophical-choice]] — pending CRDT operations must be flushed when the collaboration server closes in step 3
- [[storage-error-maps-postgresql-error-codes-to-http-status-giving-routes-structured-error-semantics-without-db-coupling]] — late DB connection failures during shutdown drain (08xxx codes) are translated to 503 by StorageError
- [[the-arduino-workbench-schema-is-the-only-domain-that-bridges-database-records-to-the-host-filesystem-via-rootPath]] — arduinoJobs tracks process execution state that must be updated to "cancelled" during job queue drain
