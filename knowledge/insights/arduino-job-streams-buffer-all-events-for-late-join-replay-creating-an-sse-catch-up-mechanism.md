---
name: Arduino job streams buffer all events for late-join replay creating an SSE catch-up mechanism
description: JobStream in arduino-service.ts buffers every event in memory so that clients connecting to /jobs/:id/stream after a job has started receive the full history before switching to live events — this is a custom SSE late-join protocol not found in the other SSE endpoints (chat, agent)
type: insight
category: architecture
source: extraction
created: 2026-03-14
status: active
evidence:
  - server/arduino-service.ts:24-49 — JobStream class with buffer array, push() both buffers and emits, getBuffer() for late joiners
  - server/routes/arduino.ts:343-344 — for (const buffered of jobStream.getBuffer()) sendEvent(buffered)
  - server/routes/arduino.ts:374-377 — race condition guard: if stream finished between getBuffer() and .on(), cleanup immediately
  - server/routes/arduino.ts:298-313 — terminal job state: replay stored log lines from DB, not buffer
---

# Arduino Job Streams Buffer All Events for Late-Join Replay, Creating an SSE Catch-Up Mechanism

The `JobStream` class in `server/arduino-service.ts` implements a custom event replay mechanism for SSE streaming that is architecturally distinct from every other SSE endpoint in the codebase (chat streaming, agent loop, collaboration).

**How it works:**
1. `JobStream` extends `EventEmitter` and maintains a private `buffer: JobStreamEvent[]`
2. Every `push(event)` both appends to the buffer AND emits via EventEmitter
3. When a client connects to `/api/projects/:id/arduino/jobs/:jobId/stream`, the route first sends all `jobStream.getBuffer()` events, then subscribes to live events via `.on('event', onEvent)`
4. A race condition guard checks `jobStream.finished` after subscribing — if the stream finished between `getBuffer()` and `.on()`, the connection is cleaned up immediately

**Two-tier state recovery:** The system has two different mechanisms for catching up depending on timing:
- **Stream still active** (in-memory): Buffer replay from `JobStream.getBuffer()` — includes all stdout/stderr lines from the spawned arduino-cli process
- **Job already finished** (database): Replay from `job.log` column (the full concatenated log stored in DB) — used when the JobStream has been garbage-collected

**Why other SSE endpoints don't do this:** The chat and agent SSE streams in `server/routes/chat.ts` and `server/routes/agent.ts` don't need late-join replay because:
- Chat messages are persisted to DB and loaded on page mount via React Query
- Agent steps are ephemeral (you either watch the whole loop or see the final "complete" event)

Arduino compilation/upload jobs are the only long-running background processes where a user might navigate away and return mid-job, making buffer replay essential.

---

Related:
- [[the-arduino-workbench-schema-is-the-only-domain-that-bridges-database-records-to-the-host-filesystem-via-rootPath]] — the workspace filesystem bridge is what makes job output large enough to need buffered streaming
- [[job-queue-uses-per-type-watchdog-timeouts]] — job queue and arduino jobs both handle long-running async work but with different streaming architectures
