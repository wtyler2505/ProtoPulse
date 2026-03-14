---
name: Graceful shutdown drains resources in dependency order with a 30-second forced exit backstop
description: server/shutdown.ts orchestrates shutdown in strict order — job queue drain (10s grace) -> collaboration WebSocket close -> metrics flush -> HTTP server close -> database pool end — with a 30s setTimeout backstop that calls process.exit(1) if anything hangs, using unref() so the timer doesn't itself prevent clean exit
type: insight
---

# Graceful Shutdown Drains Resources in Dependency Order with a 30-Second Forced Exit Backstop

`server/shutdown.ts` implements a multi-phase shutdown orchestrator that demonstrates several reliability patterns:

**Drain order matters:**
1. Log active connections (diagnostics)
2. Drain job queue — cancel pending, wait up to 10s for running jobs
3. Close collaboration WebSocket server (stops real-time editing)
4. Stop metrics collection and flush buffered metrics
5. Close HTTP server (stops accepting new connections, waits for in-flight requests)
6. Close database connection pool (last, because jobs/requests may need DB access during drain)

**Forced exit backstop:** A `setTimeout(30_000)` calls `process.exit(1)` if the graceful sequence hangs. The timer uses `.unref()` so it doesn't prevent clean exit if everything finishes faster. This prevents the dreaded "server stops responding but never actually exits" zombie state.

**Late-binding collaboration server:** The collaboration WebSocket server is registered via `registerCollaborationServer()` called from `index.ts` after the server starts. This avoids a circular dependency — `shutdown.ts` doesn't import `collaboration.ts` at module load time.

**Why the ordering is non-obvious:**
- Job queue drains before HTTP server closes because running jobs may be producing SSE events — closing HTTP first would drop those streams
- Metrics flush happens before HTTP close because metrics may record shutdown-related events
- Database pool closes last because every other shutdown step may need to read/write data (e.g., updating job status to "cancelled")
