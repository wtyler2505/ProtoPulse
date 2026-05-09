# BL-0879 — CRDT `conflict-detected` emission fix decision

**Date:** 2026-05-09
**Author:** Claude Code (session before fresh-session implementation)
**Status:** Decision document — implementation deferred to fresh session
**Test that exercises the bug:** `server/__tests__/collaboration-crdt-integration.test.ts:583` ("emits conflict-detected to the LWW-losing client only")

## The bug, in one sentence

The server bumps a per-project monotonic Lamport clock for *every* incoming op (`server/collaboration.ts:505`), so the second arrival on the same key always has a strictly higher Lamport than the first. `lwwWins(prev, prevClient, incoming, incomingClient)` therefore always returns `true` for the incoming op, which makes both the conflict-detection check (`detectConflict` returning `null` at `shared/collaboration.ts:244`) and the LWW drop check (`newerExists = false` at `server/collaboration.ts:537-538`) silently miss every cross-client same-key race.

Net effect:
- `conflicts[]` is never populated for an `update` op.
- `if (conflicts.length > 0)` (`server/collaboration.ts:561`) never enters.
- No `conflict-detected` WS message ever fires for `update` ops.
- The "loser" of the race has its op accepted into authoritative state instead of being dropped — silently overwriting the prior winner.

The test simulates the textbook scenario:
1. `ws2` sends update for `nodes.n1` → server tags Lamport=1, recent window holds it.
2. `ws1` sends update for the same `nodes.n1` → server tags Lamport=2, `lwwWins(1, 2, 2, 1)` returns `true`, `detectConflict` returns `null`, no drop, no conflict-detected.

The test expects `ws1` to lose (because it raced and arrived second) and receive `conflict-detected`. Under the current code, `ws1` instead "wins" by virtue of arriving second.

## Why monotonic server-side Lamport can't fix this on its own

A server-monotonic Lamport orders **events** globally — it cannot detect **concurrency**. To detect a concurrent edit you need to know what state each client *was looking at* when it composed its op. That requires either:
- A **client-supplied baseline** (what Lamport did the client think this entity had when it edited?), or
- A **delivery checkpoint** (what's the highest Lamport the server has broadcast TO this client?).

Without one of those, every newly arriving op trivially "post-dates" everything in the recent window because the server itself just generated the timestamp.

## Two viable fix paths

### Option (A) — Client-supplied baseline Lamport per op (Yjs / Automerge convention)

Add a field to `CRDTOperation` for the client's known Lamport at edit time. The client increments and tracks its per-replica Lamport from broadcasts it has received. The server compares incoming `op.baseTimestamp` against the most recent server-assigned timestamp for that entity key.

**Schema change** (in `shared/collaboration.ts`):

```ts
export type CRDTOperation =
  | { op: 'insert'; path: string[]; value: unknown; baseTimestamp?: number; timestamp?: number; clientId?: number }
  | { op: 'delete'; path: string[]; key: string; baseTimestamp?: number; timestamp?: number; clientId?: number }
  | { op: 'update'; path: string[]; key: string; value: unknown; baseTimestamp?: number; timestamp?: number; clientId?: number };
```

Client side (`client/src/lib/collaboration-client.ts`):
- Track `maxSeenLamport` per project (incremented from every received `state-update` broadcast).
- When composing an op, set `baseTimestamp = maxSeenLamport` before sending.

Server side (`server/collaboration.ts:494`):
- `detectConflict(taggedOp, recent)` becomes `detectConflict(taggedOp, recent, op.baseTimestamp ?? 0)`.
- In `shared/collaboration.ts:234`, replace `!lwwWins(r.serverTs, r.clientId, incomingTs, incomingClient)` with `r.serverTs > baseTimestamp && r.clientId !== incomingClient` (the prior op happened after the client's known state and from a different client → conflict).
- LWW drop check (line 532-549) similarly uses `baseTimestamp` as the comparator.

**Pros:**
- Models concurrency correctly (the standard CRDT primitive).
- The "accept mine" re-send naturally works: once the client has seen the prior op via broadcast, its `maxSeenLamport` advances, so the next op's `baseTimestamp` exceeds the prior server timestamp → wins LWW cleanly.
- Composes with vector clocks if we ever need finer-grained per-replica tracking.

**Cons:**
- Schema change ripples through `CRDTOperation` typing, the WS message validators, the existing 23 CRDT tests, `CollaborationClient` send paths, conflict-resolution dialog send paths.
- Existing clients without `baseTimestamp` need a defensible default (treat absent as 0 → always conflict if anything is in recent? or as "no baseline, accept" → preserves current bug?).

### Option (B) — Server-tracked per-client delivery checkpoint

Server keeps `lastBroadcastedLamport` per `(projectId, userId)`. Every broadcast to a client updates it. When a client sends an op, compare the **earliest unsent-to-this-client recent op** for the same key against the incoming op:

- If `recent.serverTs > lastBroadcastedLamport[clientId]` AND `recent.clientId !== incomingClient` → that op was generated *after* this client's last sync → concurrent → conflict.

**Pros:**
- No schema change. Pure server-side logic.
- Existing client unchanged.
- Naturally handles "accept mine" — after the broadcast of the original op completes, `lastBroadcastedLamport[ws1]` advances past `ws2`'s op, so the re-send no longer trips the conflict check.

**Cons:**
- Subject to broadcast-timing races: if `ws1`'s second send beats the broadcast of `ws2`'s first op back to `ws1`, the conflict re-fires. In production this is fine (network jitter), in deterministic tests with fake timers this needs careful sequencing.
- Server must wait for broadcast acknowledgement OR commit the timestamp at send-attempt time. The latter is fine — the broadcast either arrives or the connection drops.
- Requires bookkeeping for disconnect/reconnect (reset `lastBroadcastedLamport[clientId]` to the entire recent window's max so the reconnecting client sees everything as "synced").

## Recommendation: Option (A)

Yjs and Automerge both use baseline-tracking (Yjs has full vector clocks; Automerge has actor IDs + sequence numbers). It's the well-trodden path and composes cleanly if we later need richer concurrency primitives (e.g., for `pp-feat-collab-yjs` BL items). The schema change is bounded:

- 3 changes in `shared/collaboration.ts` (type + `detectConflict` + `lwwWins` callers).
- 2 changes in `server/collaboration.ts` (the `mergeAndBroadcastOps` LWW check + plumbing `baseTimestamp` into `detectConflict`).
- 1 change in `client/src/lib/collaboration-client.ts` (track `maxSeenLamport`, set on outgoing ops).
- The "missing baseTimestamp" fallback should be: treat absent as `Number.MAX_SAFE_INTEGER` so legacy clients always "win" (they're saying "I don't know what's recent, take my word for it"). This preserves current behavior for un-upgraded clients during rollout.

## Implementation checklist (for the fresh session)

- [ ] Add `baseTimestamp?: number` to `CRDTOperation` triple union in `shared/collaboration.ts`.
- [ ] Update `detectConflict` to take `baseTimestamp` (default `Number.MAX_SAFE_INTEGER`) and use it instead of `lwwWins`.
- [ ] Update `mergeAndBroadcastOps` LWW drop logic (`server/collaboration.ts:532-549`) to use `baseTimestamp`.
- [ ] In `client/src/lib/collaboration-client.ts`, track `maxSeenLamport` per `projectId`, set `op.baseTimestamp` when sending.
- [ ] Add a 7-line test specifically for the client-side `maxSeenLamport` advancement.
- [ ] Re-run `server/__tests__/collaboration-crdt-integration.test.ts` — expect both BL-0524 tests to pass.
- [ ] Re-run all 23 existing CRDT tests — no regressions.
- [ ] Update BL-0879 in `docs/MASTER_BACKLOG.md` from OPEN to DONE with verification counts.

## Source references

- Lamport, "Time, Clocks, and the Ordering of Events" — establishes that monotonic clocks order events but cannot detect concurrency on their own.
- Yjs documentation on state vectors (https://docs.yjs.dev/api/document-updates) — baseline tracking is how their LWW resolves concurrent edits.
- Automerge docs on actor IDs and sequence numbers (https://automerge.org/automerge/automerge/) — same pattern, different naming.
- BL-0486 (Wave 67) — original CRDT impl that introduced server-monotonic Lamport without baseline tracking.
- BL-0524 (Wave 152) — added the conflict-detected wire + dialog UI but didn't fix the underlying detection algorithm; the existing tests covered `delete-rejected` and `insert-superseded` paths (which use structural-merge, not LWW), so the LWW-update path was never exercised end-to-end in CI until BL-0866 split surfaced this.

## Why this is being deferred

This session's context is at 14.3MB / hard ceiling with frequent tsserver OOMs. The fix touches 3 files with a schema-level change and warrants a clean session for verification (re-run all 23 CRDT tests + the integration test + collaboration-client tests). Doing it now risks an incomplete edit that lands without verification.

The decision (Option A) is durable on disk; the implementation is ~80 lines across 3 files; ~30 minutes of focused work in a fresh session.
