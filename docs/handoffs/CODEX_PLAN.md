# BL-0879 Option C-plus-ACK Implementation Plan

**Author:** Codex
**Date:** 2026-05-09
**Scope:** Plan only. Do not treat this file as an implementation.
**Target bug:** `server/__tests__/collaboration-crdt-integration.test.ts` case "emits conflict-detected to the LWW-losing client only".

## Summary Decision

Implement **Option C-plus-ACK**:

1. Keep the server as the authority for Lamport timestamps.
2. Add a server-owned per-key frontier containing the latest accepted update op for each key.
3. Track what each **WebSocket connection**, not each user, has actually observed/applied.
4. Advance observed state only from client ACKs, from the sender's own accepted operations, and from conflict notifications that explicitly show `theirOp`.
5. Stop using the `recentOps` sliding window for **update** conflicts. Keep it for the existing insert/delete structural merge path and carve insert/delete frontier hardening to a follow-up.

The central rule:

```ts
// Incoming update from connection C for key K conflicts when:
frontier[K].ts > observedFrontier[C][K]
  && frontier[K].connectionId !== C
```

That rule distinguishes "the server sent a broadcast" from "this connection has observed the broadcast", which was the primary hole in the prior Option C draft.

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

For BL-0879, ACK only update frontiers. Inserts/deletes remain on `recentOps`; do not pretend this ACK closes insert/delete conflict eviction.

### Operation identity

Do **not** change `CRDTOperation.clientId` from `number` to `string`. It is already used as user id in tests and wire payloads. Connection identity is server-side and belongs in `ClientEntry` plus frontier metadata.

Add or keep a server-local helper for update conflict keys:

```ts
function updateConflictKey(op: CRDTOperation): string | null {
  if (op.op !== 'update' || !op.key) { return null; }
  return `${op.path.join('.')}:${op.key}`;
}
```

Use this helper consistently for:

- `keyFrontiers`
- `observedFrontiers`
- ACK payload generation/processing

Do not mix it with `operationEntityKey()` unless the helper is deliberately changed everywhere. `operationEntityKey()` currently uses only the last path segment, while update conflict detection currently uses `path.join('.')`; mixing the two would create nested-path drift.

### State sync payload

For BL-0879, extend `state-sync` only with the server-issued connection id:

```ts
payload: { users, version, locks: activeLocks, connectionId }
```

Do **not** add `keyFrontier` to `state-sync` as an observed checkpoint in this BL. A frontier without an authoritative document snapshot or op replay is a causality lie. Full state-sync truth is carved to BL-0883 in section 5.

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
- `handleMessage`, `handleDisconnect`, `handleStateUpdate`, `mergeAndBroadcastOps`, `broadcastToRoom`, and targeted send helpers must route by connection id.
- `broadcastToRoom(projectId, message, excludeConnectionId)` excludes only the sending socket. Same-account second tabs must still receive the update.
- `getRoomUsers(projectId)` should return presence grouped by `userId` so the UI does not show duplicate people for duplicate tabs. Use first or latest entry per user id; keep color stable per user where possible.
- `setUserRole(projectId, userId, role)` must update **all** entries for that user id.
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
- Broadcast `leave` by user id only when no other connection for that user remains in the room, otherwise presence lies.

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
const conflictObservedAdvances: Array<{ entityKey: string; ts: number }> = [];

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
      conflictObservedAdvances.push({ entityKey, ts: frontier.ts });
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

The `conflictObservedAdvances` array matters. Do not mark a conflict frontier observed during the loop before all ops in the incoming batch are classified. Otherwise a batch with two stale updates to the same key could make the first op conflict and the second op pass because the first conflict advanced observed state mid-batch. Apply conflict-observed advances only after the conflict message is sent or queued to the losing connection.

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
2. If the connection is open and the message is sent, then apply `conflictObservedAdvances`.
3. This lets the later "accept mine" resend pass without re-conflicting, because the conflict dialog has shown `theirOp` to the loser.

The conflict message's `theirOp` must come from `frontier.op`, not from `recentOps`.

## 4. ACK Semantics

### Client behavior

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

`sendStateUpdateAck` filters to server-tagged update ops:

```ts
private sendStateUpdateAck(operations: CRDTOperation[]): void {
  const updates = operations.flatMap((op) => {
    if (op.op !== 'update' || typeof op.timestamp !== 'number') { return []; }
    const entityKey = `${op.path.join('.')}:${op.key}`;
    return [{ entityKey, timestamp: op.timestamp }];
  });
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

This ACK means "the collaboration client dispatched the update to all registered synchronous listeners." The current codebase has no production `state-update` listener, so this is the only implementable client-side boundary in BL-0879. If later code needs strict "React committed the remote document state" semantics, BL-0883 should add an explicit apply callback or document-store integration.

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

ACK validation:

1. Payload must have `updates` array.
2. Each entry must have a non-empty string `entityKey` and finite positive number `timestamp`.
3. Look up the current `frontier = keyFrontiers[projectId]?.get(entityKey)`.
4. Ignore ACKs with no current frontier.
5. Ignore ACKs with `timestamp > frontier.ts`.
6. Otherwise call `markObserved(projectId, connectionId, entityKey, timestamp)`.

Do not require the ACK timestamp to equal the current frontier timestamp. If a newer update has already advanced the frontier, an ACK for an older timestamp should still advance observed state to that older timestamp, not all the way to the newer unseen one.

### Sender self-observation

When an incoming op is accepted, mark the origin connection observed for that op's key and timestamp. The sender does not receive an echo, but it obviously knows the local op it just sent.

### Conflict observation

A `conflict-detected` message implicitly observes `theirOp` for the conflicted key. Apply that observed advance server-side after sending the conflict message. Do not add a separate `conflict-ack` message in BL-0879.

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

4. **Conflict notification plus accept mine succeeds**
   - Keep the current "converges both clients when loser re-applies their op" test.
   - Strengthen it: after first conflict, capture conflict count; resend "mine"; assert no second conflict is emitted to `ws1`.
   - Assert `ws2` receives the accepted "mine" update.

5. **Same user, two connections do not share observed frontier**
   - Connect `ws1a` and `ws1b` with the same `userId` but different sessions.
   - `ws1a` sends update `nodes:n1`.
   - Assert `ws1b` receives the broadcast because exclusion is by connection id, not user id.
   - Do not ACK from `ws1b`.
   - `ws1b` sends update `nodes:n1`.
   - Expect `ws1b` receives `conflict-detected`, even though `frontier.userId === incoming.userId`.

6. **ACK is per connection, not per user**
   - Same setup as above.
   - `ws1a` sends update.
   - `ws1b` receives but does not ACK.
   - If `ws1a` self-observed its own op, that must not advance `ws1b`.
   - `ws1b` update conflicts.

7. **Stale update still conflicts after `recentOps` eviction**
   - `ws2` sends update `nodes:n1`.
   - Do not ACK from `ws1`.
   - Send at least `MERGE_WINDOW_SIZE + 1` accepted operations to unrelated keys so `recentOps` evicts the first op.
   - `ws1` sends update `nodes:n1`.
   - Expect `conflict-detected` using `keyFrontiers`, proving the conflict payload no longer depends on the 200-op window.

8. **Batch timestamps use each tagged op**
   - Send a batch with two update ops for different keys.
   - Assert the broadcasted ops have distinct increasing timestamps.
   - ACK only the first key from the recipient.
   - Recipient overwrites first key: accepted.
   - Recipient overwrites second key: conflicts.

9. **Viewer can ACK but cannot mutate**
   - Set a connection to viewer.
   - Send `state-update-ack`: no error.
   - Send `state-update`: still rejected by existing viewer enforcement.

10. **Room cleanup removes per-connection observed state**
    - Connect two clients, create frontiers, disconnect one.
    - Assert remaining client still functions.
    - Disconnect last client.
    - If public test hooks are added for counts, assert `keyFrontiers` and `observedFrontiers` for that project are cleared.

### Client tests to add/update

1. **Client sends `state-update-ack` after remote update**
   - Simulate incoming `state-update` with server-tagged update op.
   - Expect existing `state-update` listener fires.
   - Expect a sent `state-update-ack` with `updates: [{ entityKey: 'nodes:n1', timestamp }]`.

2. **Client does not ACK untagged or non-update ops**
   - Simulate insert-only update or update missing numeric timestamp.
   - Expect no ACK message.

3. **Resolve mine still strips server metadata**
   - Keep current test, but expect a later ACK may exist in `ws.sent`.
   - Find the last `state-update` message rather than assuming only one message shape.

4. **Conflict receive does not send ACK**
   - Simulate `conflict-detected`.
   - Expect no `state-update-ack`; server handles conflict observation implicitly.

## 7. Implementation Effort Revision

Claude's earlier "80 LOC" estimate is too low because per-connection routing and ACK semantics touch the room model, test helpers, and role enforcement.

Estimated changed lines, not net-new lines:

| File | Estimate | Notes |
| ---- | -------- | ----- |
| `shared/collaboration.ts` | 25-45 | Add `state-update-ack`, ACK payload interfaces, possibly comments. |
| `server/collaboration.ts` | 260-380 | Per-connection room refactor, new frontier maps/helpers, ACK handler, update conflict rewrite, targeted send helpers, cleanup, role/leave/presence adjustments. |
| `client/src/lib/collaboration-client.ts` | 55-90 | Remote update handler, ACK sender, conflict tests compatibility, maybe helper for ACK entries. |
| `client/src/components/collaboration/ConflictResolutionDialog.tsx` | 0-10 | No functional change expected. Only update comments if they still claim accept-mine wins purely by newer Lamport. |
| `server/__tests__/collaboration-crdt-integration.test.ts` | 180-280 | ACK helper, same-user multi-connection cases, frontier eviction case, batch timestamp case, strengthened existing BL-0524 tests. |
| `server/__tests__/collaboration.test.ts` | 30-80 | Update assumptions around room map/presence and same-user broadcast exclusion if tests inspect it. |
| `server/__tests__/collaboration-auth.test.ts` | 20-60 | Reconnection/state-sync expectations may need `connectionId`; viewer ACK case can live here or integration test. |
| `client/src/lib/__tests__/collaboration-client.test.ts` | 35-70 | ACK emission tests and conflict-resolution test updates. |

Total realistic range: **605-1,015 changed lines** including tests. The production code likely lands around **340-525 changed lines**.

Implementation order:

1. Add schema type.
2. Refactor server room map to connection ids while keeping existing tests green.
3. Add `state-update-ack` handler and observed-frontier helpers.
4. Add `keyFrontiers` and update-only conflict detection.
5. Update client ACK behavior.
6. Add/strengthen tests.
7. Run targeted tests and `npm run check`.

## 8. Anything Claude Missed / Self-Critique

1. **The client cannot truly prove React/document application today.**
   `CollaborationClient.emit()` invokes synchronous listeners, but no production listener currently applies remote document operations. ACK-after-emit is the narrow implementable boundary. Strict post-render/post-store ACK requires a future document application callback or state store integration.

2. **ACK spoofing is not fully prevented.**
   The server will trust ACKs on the authenticated socket after basic validation. A stricter design would keep a per-connection outbound ledger and accept ACKs only for operations actually sent to that connection. That is more state and probably not worth BL-0879 unless Claude flags it as a security requirement.

3. **Presence and connection identity can drift.**
   The room needs per-connection state, while UI presence likely wants per-user state. The implementation must deliberately dedupe `getRoomUsers()` and only broadcast `leave` when the last connection for a user exits.

4. **Cursor state is per user today.**
   Same-user two-tab cursor behavior may overwrite itself because `CollabUser.cursor` is user-level. That is outside BL-0879 but should not be made worse by the room refactor.

5. **Insert/delete conflicts remain window-bound.**
   This plan intentionally leaves insert/delete on `recentOps`. Create BL-0882 for per-key insert/delete frontiers and tombstones if that matters.

6. **Cold-start/reconnect false conflicts remain by design.**
   This is the BL-0883 carve-out. Do not hide it in release notes or mark the whole collaboration causality problem solved.

7. **Batch conflict observation must be deferred.**
   If the implementation advances observed state immediately when the first conflict is found, later ops in the same stale batch can slip through. Tests should cover this if time allows.

8. **Existing public test helpers may need careful updates.**
   `getRoom(projectId)` currently exposes `Map<number, ClientEntry>`. Changing it to `Map<string, ClientEntry>` can ripple through tests. Prefer assertions via public behavior where possible.

9. **`stateVersions`, `lamportClocks`, and `recentOps` lifecycle is already inconsistent.**
   Current code deletes `stateVersions` when a room empties but leaves Lamport/recent state until shutdown. BL-0879 should clean the new maps and may clean the old maps too, but avoid over-claiming that this solves durable document reload.

10. **The plan still relies on in-memory collaboration state.**
    If ProtoPulse later runs multiple server instances, `keyFrontiers` and `observedFrontiers` need a shared room coordinator. That is not in scope for this local BL.
