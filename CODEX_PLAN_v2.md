# BL-0879 Option C-plus-ACK Implementation Plan v2

Changelog from v1: removed implicit-observe-on-conflict-send. A server `conflict-detected` send does not advance `observedFrontiers`; the client must ACK conflict `theirOp` with the existing `state-update-ack` message using `updateConflictKey(theirOp)` and `theirOp.timestamp`.

**Author:** Codex
**Date:** 2026-05-09
**Scope:** Plan only. Do not treat this file as an implementation.
**Target bug:** `server/__tests__/collaboration-crdt-integration.test.ts` case "emits conflict-detected to the LWW-losing client only".
**Round context:** Revises `CODEX_PLAN.md` after Claude Round 7 accepted the Round 6 send-vs-observe race.

## Summary Decision

Implement **Option C-plus-ACK**:

1. Keep the server as the authority for Lamport timestamps.
2. Add a server-owned per-key frontier containing the latest accepted update op for each key.
3. Track what each **WebSocket connection**, not each user, has actually observed/applied.
4. Advance observed state only from explicit client ACKs and from the sender's own accepted operations. A server send, including `conflict-detected`, is not observation.
5. Reuse `state-update-ack` for both normal remote `state-update` broadcasts and conflict `theirOp` ACKs. Do not add a new `conflict-ack` schema in BL-0879.
6. Stop using the `recentOps` sliding window for **update** conflicts. Keep it for existing insert/delete structural merge behavior and carve insert/delete frontier hardening to BL-0882.

The central rule:

```ts
// Incoming update from connection C for key K conflicts when:
frontier[K].ts > observedFrontier[C][K]
  && frontier[K].connectionId !== C
```

That rule distinguishes "the server sent a broadcast/conflict message" from "this connection has acknowledged the winning update." The distinction must hold for both normal `state-update` broadcasts and `conflict-detected` messages.

## 1. Schema Changes

### Shared message type

Update `shared/collaboration.ts`:

```ts
export type CollabMessageType =
  | 'join'
  | 'leave'
  | 'cursor-move'
  | 'selection-change'
  | 'state-update'
  | 'state-update-ack'
  | 'state-sync'
  | 'awareness'
  | 'lock-request'
  | 'lock-granted'
  | 'lock-released'
  | 'lock-denied'
  | 'role-change'
  | 'chat'
  | 'conflict-detected'
  | 'error';
```

Add a payload shape for ACKs. Keep it lightweight because `CollabMessage.payload` is currently generic:

```ts
export interface StateUpdateAckEntry {
  entityKey: string;
  timestamp: number;
}

export interface StateUpdateAckPayload {
  updates: StateUpdateAckEntry[];
}
```

For BL-0879, ACK only update frontiers. Inserts/deletes remain on `recentOps`; do not imply that this ACK closes insert/delete conflict eviction.

### Operation identity

Do **not** change `CRDTOperation.clientId` from `number` to `string`. It is already used as user id in tests and wire payloads. Connection identity is server-side and belongs in `ClientEntry` plus frontier metadata.

### Update conflict key helper

Define one canonical helper and use it consistently on both client and server. Prefer exporting it from `shared/collaboration.ts` to prevent ACK key drift:

```ts
export function updateConflictKey(op: CRDTOperation): string | null {
  if (op.op !== 'update' || !op.key) { return null; }
  return `${op.path.join('.')}:${op.key}`;
}
```

Use this helper for:

- `keyFrontiers`
- `observedFrontiers`
- normal `state-update` ACK payload generation
- conflict `theirOp` ACK payload generation
- server ACK validation

Do not mix it with `operationEntityKey()` unless the helper is deliberately changed everywhere. `operationEntityKey()` currently uses only the last path segment, while update conflict detection uses `path.join('.')`; mixing them would create nested-path drift.

### State sync payload

For BL-0879, extend `state-sync` only with the server-issued connection id:

```ts
payload: { users, version, locks: activeLocks, connectionId }
```

Add a client-side comment in `client/src/lib/collaboration-client.ts` documenting that `connectionId` is server-owned identity exposed for debugging/telemetry only. The client must not echo it back or use it as authority.

Do **not** add `keyFrontier` to `state-sync` as an observed checkpoint in this BL. A frontier without an authoritative document snapshot or op replay is a causality lie. Full state-sync truth is carved to BL-0883 in sections 5 and 8.

## 2. Server State

Update `server/collaboration.ts`.

### ClientEntry

```ts
interface ClientEntry {
  connectionId: string;
  ws: WebSocket;
  user: CollabUser;
  alive: boolean;
  lastCursorBroadcast: number;
  sessionId: string;
}
```

Generate `connectionId = randomUUID()` inside `onConnection`.

### Room shape

Replace:

```ts
private readonly rooms = new Map<number, Map<number, ClientEntry>>();
```

with:

```ts
private readonly rooms = new Map<number, Map<string, ClientEntry>>();
```

The inner map is `connectionId -> ClientEntry`.

Important fallout:

- `onConnection` stores `room.set(connectionId, entry)`.
- WebSocket handlers close over `connectionId`, not just `userId`.
- `handleMessage`, `handleDisconnect`, `handleStateUpdate`, `mergeAndBroadcastOps`, `broadcastToRoom`, and targeted send helpers route by connection id.
- `broadcastToRoom(projectId, message, excludeConnectionId)` excludes only the sending socket. Same-account second tabs must still receive the update.
- `getRoomUsers(projectId)` returns presence grouped by `userId` so the UI does not show duplicate people for duplicate tabs. Use first or latest entry per user id; keep color stable per user where possible.
- `setUserRole(projectId, userId, role)` updates **all** entries for that user id.
- User-targeted role/lock APIs may still accept `userId`, but request/response errors from a socket should use `sendErrorToConnection`.

### New frontier state

Add server-local types:

```ts
interface FrontierEntry {
  ts: number;
  connectionId: string;
  userId: number;
  op: CRDTOperation; // server-tagged, includes timestamp + clientId
}
```

Add maps:

```ts
private readonly keyFrontiers = new Map<number, Map<string, FrontierEntry>>();
private readonly observedFrontiers = new Map<number, Map<string, Map<string, number>>>();
```

Meaning:

- `keyFrontiers[projectId][entityKey]` is the latest accepted authoritative update for that key.
- `observedFrontiers[projectId][connectionId][entityKey]` is the highest server timestamp that connection has acknowledged or otherwise definitely learned.

Helper methods to add:

```ts
private getProjectFrontiers(projectId: number): Map<string, FrontierEntry>;
private getObservedMap(projectId: number, connectionId: string): Map<string, number>;
private markObserved(projectId: number, connectionId: string, entityKey: string, ts: number): void;
private handleStateUpdateAck(projectId: number, connectionId: string, payload: Record<string, unknown>): void;
private sendErrorToConnection(projectId: number, connectionId: string, errorMessage: string): void;
private sendToConnection(projectId: number, connectionId: string, message: CollabMessage): void;
```

`markObserved` must be monotonic:

```ts
observed.set(entityKey, Math.max(observed.get(entityKey) ?? 0, ts));
```

### Lifecycle cleanup

On disconnect:

- Remove only that connection from the room.
- Remove `observedFrontiers[projectId][connectionId]`.
- Release locks by user id only if that is current product behavior; do not change lock ownership semantics in this BL unless existing tests demand it.
- Broadcast `leave` by user id only when no other connection for that user remains in the room.

When the room becomes empty:

- Delete `rooms[projectId]`.
- Delete `stateVersions[projectId]`.
- Delete `observedFrontiers[projectId]`.
- Delete `keyFrontiers[projectId]`.
- Consider also deleting `lamportClocks[projectId]` and `recentOps[projectId]`; this is consistent with deleting state versions and avoids stale in-memory conflict state after all clients leave.

## 3. Conflict Detection

### Update path: frontier only

In `mergeAndBroadcastOps`, change the signature from:

```ts
private mergeAndBroadcastOps(projectId: number, userId: number, ops: CRDTOperation[]): void
```

to:

```ts
private mergeAndBroadcastOps(projectId: number, connectionId: string, ops: CRDTOperation[]): void
```

Look up `entry` from `connectionId`, then derive `userId = entry.user.userId`.

For each op:

1. Increment the server Lamport clock once per op.
2. Create `taggedOp = { ...op, timestamp: clock, clientId: userId }`.
3. For `op.op === 'update'`, do **not** call `detectConflict(taggedOp, recent)`.
4. Use `keyFrontiers` directly.

Implementation shape:

```ts
const frontiers = this.getProjectFrontiers(projectId);
const observed = this.getObservedMap(projectId, connectionId);

for (const op of ops) {
  clock++;
  const taggedOp: CRDTOperation = { ...op, timestamp: clock, clientId: userId };

  if (taggedOp.op === 'update') {
    const entityKey = updateConflictKey(taggedOp);
    const frontier = entityKey ? frontiers.get(entityKey) : undefined;
    const observedTs = entityKey ? (observed.get(entityKey) ?? 0) : 0;

    if (
      entityKey &&
      frontier &&
      frontier.ts > observedTs &&
      frontier.connectionId !== connectionId
    ) {
      conflicts.push({
        id: randomUUID(),
        projectId,
        kind: 'lww-update',
        path: taggedOp.path,
        key: taggedOp.key,
        yourOp: taggedOp,
        theirOp: frontier.op,
        detectedAt: clock,
      });
      continue;
    }

    survivingOps.push(taggedOp);
    recent.push({ op: taggedOp, serverTs: clock, clientId: userId });

    if (entityKey) {
      frontiers.set(entityKey, {
        ts: clock,
        connectionId,
        userId,
        op: taggedOp,
      });
      this.markObserved(projectId, connectionId, entityKey, clock);
    }
    continue;
  }

  // insert/delete continue through existing recentOps structural merge logic.
}
```

There must be no `conflictObservedAdvances` equivalent in v2. A conflict is observation-neutral until the client sends `state-update-ack`. This protects both cases:

- two stale updates in one incoming batch for the same key;
- two stale same-key updates sent as separate WebSocket frames before the first conflict ACK returns.

### Insert/delete path: keep current behavior

For `insert` and `delete`:

- Keep `detectConflict(taggedOp, recent)` and `structuralMerge(taggedOp, recent.map(r => r.op))`.
- Keep `recentOps` pruning at `MERGE_WINDOW_SIZE`.
- State clearly in comments that insert/delete conflict payloads are still window-bound until BL-0882.

### Broadcast path

Update `applyAndBroadcastOps` to:

```ts
private applyAndBroadcastOps(
  projectId: number,
  originConnectionId: string,
  originUserId: number,
  ops: CRDTOperation[],
): void
```

Broadcast with `userId: originUserId` and exclude `originConnectionId`.

Do not advance observed frontiers in `broadcastToRoom`. A sent WebSocket frame is not an applied document update.

### Conflict notification path

When `conflicts.length > 0`:

1. Send `conflict-detected` only to `connectionId`.
2. Do **not** mark `theirOp` observed on send, even when the socket is open and `send()` succeeds.
3. Wait for the client to ACK conflict `theirOp` via `state-update-ack`.

The conflict message's `theirOp` must come from `frontier.op`, not from `recentOps`.

This means "accept mine" is no longer allowed to rely on the server having sent the dialog. The client must process the conflict and ACK `theirOp` before resending `yourOp`; otherwise the resend is still stale and should conflict again.

## 4. ACK Semantics

### Client behavior: normal remote updates

Update `client/src/lib/collaboration-client.ts`.

Replace the direct state-update case:

```ts
case 'state-update':
  this.emit('state-update', message.payload.operations as CRDTOperation[]);
  break;
```

with a helper:

```ts
case 'state-update':
  this.handleRemoteStateUpdate(message.payload);
  break;
```

Helper behavior:

```ts
private handleRemoteStateUpdate(payload: Record<string, unknown>): void {
  const operations = Array.isArray(payload.operations)
    ? payload.operations as CRDTOperation[]
    : [];
  if (operations.length === 0) { return; }

  this.emit('state-update', operations);
  this.sendStateUpdateAck(operations);
}
```

`sendStateUpdateAck` filters to server-tagged update ops and uses `updateConflictKey`:

```ts
private sendStateUpdateAck(operations: CRDTOperation[]): void {
  const updates = operations.flatMap((op) => {
    const entityKey = updateConflictKey(op);
    if (!entityKey || typeof op.timestamp !== 'number') { return []; }
    return [{ entityKey, timestamp: op.timestamp }];
  });
  this.sendStateUpdateAckEntries(updates);
}
```

This ACK means "the collaboration client dispatched the update to all registered synchronous listeners." The current codebase has no production `state-update` listener, so this is the only implementable client-side boundary in BL-0879. If later code needs strict "React committed the remote document state" semantics, BL-0883 should add an explicit apply callback or document-store integration.

### Client behavior: conflict notifications

Change the `conflict-detected` case from:

```ts
case 'conflict-detected':
  this.handleConflicts(message.payload);
  break;
```

to:

```ts
case 'conflict-detected':
  this.handleConflicts(message.payload);
  this.sendConflictTheirOpAck(message.payload);
  break;
```

`handleConflicts` must still append to `pendingConflicts` and emit `conflicts-change` before ACK generation. ACK-after-emit is the same implementable boundary as remote `state-update` ACK: the collaboration client has accepted and surfaced the winning operation to local application code.

Add:

```ts
private sendConflictTheirOpAck(payload: Record<string, unknown>): void {
  const raw = payload.conflicts;
  if (!Array.isArray(raw)) { return; }

  const updates = (raw as Conflict[]).flatMap((conflict) => {
    const theirOp = conflict.theirOp;
    const entityKey = updateConflictKey(theirOp);
    if (!entityKey || typeof theirOp.timestamp !== 'number') { return []; }
    return [{ entityKey, timestamp: theirOp.timestamp }];
  });

  this.sendStateUpdateAckEntries(updates);
}
```

The conflict ACK must **only** ACK `theirOp`. It must not ACK `yourOp`; the loser's dropped op was not accepted into the authoritative frontier and must not advance any observed frontier.

Use one sender for both normal and conflict ACKs:

```ts
private sendStateUpdateAckEntries(updates: StateUpdateAckEntry[]): void {
  if (updates.length === 0) { return; }

  this.send({
    type: 'state-update-ack',
    userId: this.myUserId,
    projectId: this.projectId,
    timestamp: Date.now(),
    payload: { updates },
  });
}
```

Exact duplicate ACK entries are harmless because server observation is monotonic. Optional client coalescing is fine, but do not let coalescing collapse different timestamps for the same key unless it keeps the maximum timestamp.

### Server behavior

In `handleMessage`, add:

```ts
case 'state-update-ack':
  this.handleStateUpdateAck(projectId, connectionId, message.payload);
  break;
```

Viewer role enforcement must allow ACK:

```ts
const viewerAllowed: CollabMessage['type'][] = [
  'cursor-move',
  'selection-change',
  'awareness',
  'state-update-ack',
];
```

All ACKs use the same validation path. The server does not care whether the ACK originated from a normal `state-update` broadcast or from a conflict `theirOp`.

ACK validation:

1. Payload must have `updates` array.
2. Each entry must have a non-empty string `entityKey` and finite positive number `timestamp`.
3. Look up the current `frontier = keyFrontiers[projectId]?.get(entityKey)`.
4. Ignore ACKs with no current frontier.
5. Ignore ACKs with `timestamp > frontier.ts`; an ACK may not advance past the actual authoritative frontier.
6. Otherwise call `markObserved(projectId, connectionId, entityKey, timestamp)`.

The effective update is:

```ts
observedFrontiers[projectId][connectionId][entityKey] =
  Math.max(currentObservedTs, ackedTs);
```

Do not require the ACK timestamp to equal the current frontier timestamp. If a newer update has already advanced the frontier, an ACK for an older timestamp should still advance observed state to that older timestamp, not all the way to the newer unseen one.

### Sender self-observation

When an incoming update op is accepted, mark the origin connection observed for that op's key and timestamp. The sender does not receive an echo, but it obviously knows the local op it just sent.

### Conflict observation

A `conflict-detected` message does **not** implicitly observe `theirOp`. The only valid paths for conflict observation are:

1. client receives `conflict-detected`;
2. client runs `handleConflicts`;
3. client emits `state-update-ack` for each conflict `theirOp` using `updateConflictKey(theirOp)` and `theirOp.timestamp`;
4. server validates that ACK with the same code path as normal state-update ACKs;
5. server advances `observedFrontiers[connectionId][K] = max(current, ackedTs)`.

Do not add `conflict-ack` in BL-0879.

## 5. State-Sync Gap Handling

Choose option **(b)** for BL-0879:

> BL-0879 handles the steady-state same-room case. New or reconnected connections start with an empty observed frontier. Full cold-start/reconnect correctness requires a real document snapshot or op replay and belongs in BL-0883.

Reason:

- Current `state-sync` at `server/collaboration.ts:421-445` sends only `users`, `version`, and `locks`.
- It does not send the authoritative circuit/document state.
- It does not replay accepted operations.
- Therefore `state-sync` cannot truthfully initialize `observedFrontiers` from `keyFrontiers`.

BL-0879 implementation rules:

- On new connection, create `observedFrontiers[projectId][connectionId] = new Map()`.
- Send `state-sync` with `connectionId`, `users`, `version`, and `locks`.
- Do not mark any key frontier observed because of `state-sync`.
- If the new connection immediately edits a key whose frontier predates the connection, it may receive a false conflict. That is accepted BL-0879 behavior and should be documented in the backlog as BL-0883.

BL-0883 should specify:

- authoritative project document snapshot or op replay in `state-sync`;
- client application of that snapshot/replay;
- `state-sync-ack`;
- only then initializing observed frontiers from the snapshot/replay frontier.

## 6. Test Plan

Run focused tests first, then type-check.

```bash
npm test -- server/__tests__/collaboration-crdt-integration.test.ts
npm test -- server/__tests__/collaboration.test.ts server/__tests__/collaboration-auth.test.ts
npm test -- client/src/lib/__tests__/collaboration-client.test.ts
npm run check
```

### Server integration tests to add/update

1. **Existing failing BL-0879 case passes without ACK**
   - `ws2` sends update `nodes:n1`.
   - Assert `ws1` did receive a `state-update` broadcast.
   - Do not send ACK from `ws1`.
   - `ws1` sends update `nodes:n1`.
   - Expect one `conflict-detected` to `ws1`.
   - Expect zero `conflict-detected` to `ws2`.
   - Expect `theirOp` equals the server-tagged `ws2` op.

2. **Broadcast sent but not ACKed still conflicts**
   - This should be a separate explicit test even if it overlaps the existing one.
   - It protects the send-vs-apply distinction that killed the previous Option C.

3. **ACKed remote update allows intentional overwrite**
   - `ws2` sends update `nodes:n1`.
   - Parse the `state-update` received by `ws1`; get op timestamp.
   - `ws1` sends `state-update-ack` with `{ entityKey: 'nodes:n1', timestamp }`.
   - `ws1` sends update `nodes:n1`.
   - Expect no conflict to `ws1`.
   - Expect `ws2` receives a state update with `ws1`'s value.

4. **Conflict notification plus accept mine succeeds only after conflict ACK**
   - Keep the current "converges both clients when loser re-applies their op" test.
   - Strengthen it: after first conflict, capture conflict count and parse `theirOp`.
   - Send `state-update-ack` from `ws1` using `updateConflictKey(theirOp)` and `theirOp.timestamp`.
   - Resend "mine".
   - Assert no second conflict is emitted to `ws1`.
   - Assert `ws2` receives the accepted "mine" update.

5. **Two stale same-key updates arriving in separate frames before conflict ACK both conflict**
   - `ws2` sends update `nodes:n1`.
   - Do not ACK the broadcast from `ws1`.
   - `ws1` sends stale update A for `nodes:n1`.
   - `await flushMicrotasks()`.
   - Assert `ws1` has one `conflict-detected` payload and do not send conflict ACK.
   - `ws1` sends stale update B for `nodes:n1` in a separate frame.
   - `await flushMicrotasks()`.
   - Assert `ws1` now has two `conflict-detected` payloads for the same key.
   - Assert neither update A nor update B was broadcast to `ws2`.

6. **Same user, two connections do not share observed frontier**
   - Connect `ws1a` and `ws1b` with the same `userId` but different sessions.
   - `ws1a` sends update `nodes:n1`.
   - Assert `ws1b` receives the broadcast because exclusion is by connection id, not user id.
   - Do not ACK from `ws1b`.
   - `ws1b` sends update `nodes:n1`.
   - Expect `ws1b` receives `conflict-detected`, even though `frontier.userId === incoming.userId`.

7. **ACK is per connection, not per user**
   - Same setup as above.
   - `ws1a` sends update.
   - `ws1b` receives but does not ACK.
   - If `ws1a` self-observed its own op, that must not advance `ws1b`.
   - `ws1b` update conflicts.

8. **Stale update still conflicts after `recentOps` eviction**
   - `ws2` sends update `nodes:n1`.
   - Do not ACK from `ws1`.
   - Send at least `MERGE_WINDOW_SIZE + 1` accepted operations to unrelated keys so `recentOps` evicts the first op.
   - `ws1` sends update `nodes:n1`.
   - Expect `conflict-detected` using `keyFrontiers`, proving the conflict payload no longer depends on the 200-op window.

9. **Batch timestamps use each tagged op**
   - Send a batch with two update ops for different keys.
   - Assert the broadcasted ops have distinct increasing timestamps.
   - ACK only the first key from the recipient.
   - Recipient overwrites first key: accepted.
   - Recipient overwrites second key: conflicts.

10. **Viewer can ACK but cannot mutate**
    - Set a connection to viewer.
    - Send `state-update-ack`: no error.
    - Send `state-update`: still rejected by existing viewer enforcement.

11. **Room cleanup removes per-connection observed state**
    - Connect two clients, create frontiers, disconnect one.
    - Assert remaining client still functions.
    - Disconnect last client.
    - If public test hooks are added for counts, assert `keyFrontiers` and `observedFrontiers` for that project are cleared.

12. **BL-0883 cold-start carve remains explicit**
    - Create an accepted frontier before a new connection has observed it.
    - Connect or reconnect a client that receives only `state-sync`, not an authoritative document snapshot or replay.
    - Have that client edit the same key without an ACK.
    - Assert BL-0879 behavior: it may receive `conflict-detected`.
    - Name the test so a future BL-0883 implementation must deliberately update it when state-sync replay/snapshot ACK exists.

### Client tests to add/update

1. **Client sends `state-update-ack` after remote update**
   - Simulate incoming `state-update` with server-tagged update op.
   - Expect existing `state-update` listener fires.
   - Expect a sent `state-update-ack` with `updates: [{ entityKey: 'nodes:n1', timestamp }]`.

2. **Client does not ACK untagged or non-update ops**
   - Simulate insert-only update or update missing numeric timestamp.
   - Expect no ACK message.

3. **Resolve mine still strips server metadata**
   - Keep current test, but expect an earlier conflict ACK may exist in `ws.sent`.
   - Find the last `state-update` message rather than assuming only one message shape.
   - Assert the resent op still has no server-assigned `timestamp` or `clientId`.

4. **Conflict receive ACKs `theirOp` and does NOT ACK `yourOp`**
   - Simulate `conflict-detected` with `yourOp.timestamp = 5` and `theirOp.timestamp = 10`.
   - Expect `pendingConflicts` and `conflicts-change` behavior still occurs.
   - Expect exactly one `state-update-ack` entry for `updateConflictKey(theirOp)` and timestamp `10`.
   - Assert no ACK entry uses `yourOp.timestamp` or a key derived from `yourOp` if it differs.

5. **Conflict receive skips invalid `theirOp` ACK entries**
   - Simulate a conflict with missing or non-numeric `theirOp.timestamp`.
   - Expect the conflict still appears in `pendingConflicts`.
   - Expect no malformed ACK entry is sent.

## 7. Insert/Delete Carve-Out to BL-0882

Keep the v1 scope decision: BL-0879 fixes update LWW conflicts, not insert/delete structural conflict history.

Rules for this BL:

- Insert/delete still use `detectConflict(taggedOp, recent)` and `structuralMerge`.
- Insert/delete conflict payloads remain bounded by `recentOps` and `MERGE_WINDOW_SIZE`.
- `state-update-ack` does not attempt to acknowledge insert/delete structural operations.
- Do not add tombstones, per-entity structural frontiers, or durable insert/delete conflict replay here.

Create or update BL-0882 for:

- per-key or per-entity insert/delete frontiers;
- tombstone retention rules;
- replay-safe conflict payloads after `recentOps` eviction;
- tests proving stale insert/delete conflicts survive beyond the current sliding window.

## 8. State-Sync Replay Carve-Out to BL-0883

Keep the v1 scope decision: BL-0879 does not make reconnect/cold-start state causally complete.

Rules for this BL:

- `state-sync` may include `connectionId`, `users`, `version`, and `locks`.
- `state-sync` must not initialize `observedFrontiers` from `keyFrontiers`.
- `state-sync` must not claim the client has observed document updates it has not received as snapshot or replay.
- Cold-start false conflicts are accepted and documented BL-0879 behavior.

BL-0883 should own:

- authoritative project document snapshot or op replay;
- client application of that snapshot/replay;
- `state-sync-ack`;
- server initialization of observed frontiers only after the snapshot/replay ACK;
- regression updates for the BL-0883 cold-start carve test from section 6.

## 9. Implementation Effort Revision

Claude's earlier "80 LOC" estimate is too low because per-connection routing and ACK semantics touch the room model, test helpers, role enforcement, and both normal and conflict ACK behavior.

Estimated changed lines, not net-new lines:

| File | Estimate | Notes |
| ---- | -------- | ----- |
| `shared/collaboration.ts` | 30-60 | Add `state-update-ack`, ACK payload interfaces, export `updateConflictKey`, maybe comments. |
| `server/collaboration.ts` | 275-425 | Per-connection room refactor, frontier maps/helpers, unified ACK handler, update conflict rewrite, targeted send helpers, cleanup, role/leave/presence adjustments. |
| `client/src/lib/collaboration-client.ts` | 75-125 | Remote update ACK, conflict `theirOp` ACK, shared ACK sender, `connectionId` comment, conflict test compatibility. |
| `client/src/components/collaboration/ConflictResolutionDialog.tsx` | 0-10 | No functional change expected. Only update comments if they still claim accept-mine wins purely by newer Lamport. |
| `server/__tests__/collaboration-crdt-integration.test.ts` | 260-400 | ACK helper, conflict ACK before accept-mine, separate-frame stale updates, same-user multi-connection cases, frontier eviction, batch timestamp, BL-0883 carve. |
| `server/__tests__/collaboration.test.ts` | 40-90 | Update assumptions around room map/presence and same-user broadcast exclusion if tests inspect it. |
| `server/__tests__/collaboration-auth.test.ts` | 25-70 | Reconnection/state-sync expectations may need `connectionId`; viewer ACK case can live here or integration test. |
| `client/src/lib/__tests__/collaboration-client.test.ts` | 70-125 | ACK emission tests, conflict `theirOp` ACK test, invalid conflict ACK filter, resolveConflict sent-message lookup updates. |

Total realistic range: **775-1,305 changed lines** including tests. Production code likely lands around **380-620 changed lines**.

Implementation order:

1. Add schema type and canonical `updateConflictKey`.
2. Refactor server room map to connection ids while keeping existing presence tests green.
3. Add unified `state-update-ack` handler and observed-frontier helpers.
4. Add `keyFrontiers` and update-only conflict detection with no conflict-send observation.
5. Update client ACK behavior for normal remote updates.
6. Update client ACK behavior for conflict `theirOp`.
7. Add/strengthen tests, especially the separate-frame pre-ACK conflict regression.
8. Run targeted tests and `npm run check`.

## 10. Self-flagged Round 8 risks

No new plan-blocking correctness hole surfaced while authoring v2 beyond the Round 7 implicit-observe-on-send removal. These residual risks remain worth attacking in Round 8:

1. **ACK-after-emit is still not document-commit proof.**
   `CollaborationClient.emit()` invokes synchronous listeners, but the repo currently has no production document-apply listener. BL-0879 can only prove "client collaboration layer accepted/surfaced this op," not "React/store committed it."

2. **ACK spoofing is bounded but not ledger-proven.**
   The server ignores ACKs beyond the current frontier, but it does not verify the ACKed op was actually sent to that connection. A per-connection outbound ledger would be stricter; this plan intentionally avoids that extra state unless Round 8 treats it as required.

3. **Same-frame stale duplicate update coverage is implied, not separately required.**
   Removing all conflict-send observation should make two stale same-key ops in one batch both conflict. The required separate-frame test catches the deeper WebSocket race. A same-frame duplicate test would still be cheap belt-and-suspenders coverage if implementation time allows.

4. **Presence and connection identity can drift.**
   The room needs per-connection state, while UI presence likely wants per-user state. The implementation must deliberately dedupe `getRoomUsers()` and only broadcast `leave` when the last connection for a user exits.

5. **Cursor state is per user today.**
   Same-user two-tab cursor behavior may overwrite itself because `CollabUser.cursor` is user-level. That is outside BL-0879 but should not be made worse by the room refactor.

6. **Insert/delete conflicts remain window-bound.**
   This is the BL-0882 carve-out. Do not mark the whole collaboration conflict system solved after BL-0879.

7. **Cold-start/reconnect false conflicts remain by design.**
   This is the BL-0883 carve-out. Do not hide it in release notes or present state-sync as causally complete.

8. **Existing public test helpers may need careful updates.**
   `getRoom(projectId)` currently exposes `Map<number, ClientEntry>`. Changing it to `Map<string, ClientEntry>` can ripple through tests. Prefer assertions via public behavior where possible.

9. **`stateVersions`, `lamportClocks`, and `recentOps` lifecycle is already inconsistent.**
   Current code deletes `stateVersions` when a room empties but leaves Lamport/recent state until shutdown. BL-0879 should clean the new maps and may clean the old maps too, but avoid over-claiming that this solves durable document reload.

10. **The plan still relies on in-memory collaboration state.**
    If ProtoPulse later runs multiple server instances, `keyFrontiers` and `observedFrontiers` need a shared room coordinator. That is not in scope for this local BL.
