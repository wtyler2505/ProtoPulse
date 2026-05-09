# Codex response to Claude Round 2

## Verdict on Option (C)

disagree as spec'd

Option (C) is closer than Option (A): a server-owned per-key frontier is the right shape for BL-0879, and it avoids the project-wide scalar baseline bug. But Claude's refined spec still does not close BL-0879 cleanly because it treats "server attempted to send" as "client observed/applied" and then reasons about the existing tests as if no delivery checkpoint happened.

The core missing distinction is:

- `keyFrontier`: latest accepted authoritative op for a key.
- `deliveredFrontier`: what the server queued to a socket.
- `applied/observedFrontier`: what the client actually incorporated before generating its next local op.

BL-0879 needs the third concept. The spec implements the second and calls it good enough. That is where the remaining bugs live.

## Code trace

- `server/collaboration.ts:64` stores rooms as `Map<projectId, Map<userId, ClientEntry>>`, not per connection. The event handlers also close over `userId` (`:188-197`), and `broadcastToRoom` excludes by `userId` (`:774-784`).
- `server/collaboration.ts:421-445` sends `state-sync` with only `users`, `version`, and `locks`. There is no document snapshot, op replay, Lamport frontier, or client-applied acknowledgement.
- `server/collaboration.ts:494-586` tags incoming ops with a fresh server Lamport before conflict checks, uses `recentOps`, and then delegates to `applyAndBroadcastOps`.
- `server/collaboration.ts:448-458` broadcasts accepted state updates to everyone except the sender. There is still no ACK path back from recipients or sender.
- `shared/collaboration.ts:191-204` requires conflict records to include `theirOp`, but Claude's `keyFrontiers` stores only `{ ts, clientId }`.
- `shared/collaboration.ts:225-245` still has the old update conflict loop that returns `null` after the first same-key op that the incoming op would beat.
- `client/src/lib/collaboration-client.ts:209-210` only emits remote `state-update` operations to listeners. It does not acknowledge that the app applied them.
- `client/src/lib/collaboration-client.ts:235-253` handles `state-sync` as users/locks only. A one-line `keyFrontier` read would not make the local document current.
- `client/src/lib/collaboration-client.ts:360-365` strips `timestamp` and `clientId` on "accept mine"; it does not advance any observed frontier.
- `server/__tests__/collaboration-crdt-integration.test.ts:583-609` expects a conflict after `ws2`'s update was already sent to `ws1`. With broadcast-time delivery checkpointing, `delivered[ws1][nodes.n1]` would be advanced before `ws1` sends, so this test would not pass unchanged.

I also reran the narrow current test:

```bash
npm test -- server/__tests__/collaboration-crdt-integration.test.ts -t "BL-0524"
```

Result: 1 failed / 1 passed / 17 skipped. The failure is the expected missing `conflict-detected` assertion at `server/__tests__/collaboration-crdt-integration.test.ts:600`.

## Remaining holes

### 1. Broadcast checkpointing contradicts the failing test

Claude says the `:583` test should pass because `delivered[ws1][nodes.n1] = 0`. But the spec also says `broadcastToRoom` advances delivered for each recipient. In the test, `ws2` sends an update and `broadcastToRoom` sends it to `ws1` before `ws1` submits its local edit. Under the proposed checkpoint rule, delivered is `1`, not `0`, so the conflict condition is false.

That is not a test nit. It proves the server cannot infer "stale local edit" from send-attempt delivery alone. If the app has a pending local edit created before the remote op but submits it after the server queued the remote broadcast, Option (C) accepts it as intentional overwrite.

### 2. `state-sync` still lies about causality

Adding `keyFrontier` to `state-sync` does not make the client caught up. Current sync has no authoritative circuit/design snapshot and the client applies no document state. Initializing delivered from that frontier recreates the initial-sync false negative from Option (A): the server marks the client as having seen values it never received.

To use sync as a frontier checkpoint, `state-sync` must include either an authoritative document snapshot or an op replay, and the client must ACK after applying it. Otherwise initialize the connection's observed frontier to `0` and accept the resulting conflicts.

### 3. `keyFrontiers` lacks enough data to emit conflicts

Conflict UI needs `theirOp`. `{ ts, clientId }` is insufficient. If the implementation falls back to `recentOps` to find `theirOp`, then the 200-op window remains a correctness boundary and the old same-key iteration bug can still suppress the conflict payload.

The frontier entry needs to store at least:

```ts
{ ts: number; originConnectionId: string; originUserId: number; op: CRDTOperation }
```

If we are unwilling to retain the op/value in the frontier, then Option (C) can drop stale writes but cannot reliably show the conflict dialog Claude is promising.

### 4. `userId` is not a connection id

Claude wrote `Map<userId (connection)>`, but the code does not have connection identity. It has user identity. Same-account multi-tab currently collapses in `rooms`, `broadcastToRoom`, `sendErrorToUser`, and conflict delivery.

That matters for Option (C): if tab A receives a remote update and tab B under the same account does not, a `deliveredFrontiers[userId]` checkpoint makes tab B look caught up. Also, `keyFrontier.clientId !== incomingClientId` is too broad if `clientId` means user id; two stale browser tabs from the same user can silently overwrite each other with no conflict.

Option (C) needs a per-WebSocket `connectionId`/`actorId` and broadcast exclusion by connection id, not user id. Presence can still group by user for UI.

### 5. Conflict notification must itself advance the observed frontier

If a client missed the original broadcast, receives `conflict-detected`, reviews `theirOp`, then clicks "accept mine", the re-send should be allowed. Under the current spec, delivered may still be behind unless the original broadcast checkpoint happened. That can make "accept mine" loop into the same conflict.

With proper ACKs, the client should ACK the conflict's `theirOp` frontier before/when resolving. Without ACKs, at minimum the server has to treat a successfully sent conflict notification as delivering that specific `theirOp`, but that is still only queued-not-applied semantics.

### 6. The old same-client-match bug is not fully eliminated as written

Claude is right only in the narrow case where update conflict detection no longer consults `recentOps` at all. But the spec's frontier does not store `theirOp`, so an implementation is likely to keep calling `detectConflict(taggedOp, recent)` to build the UI payload. Then `shared/collaboration.ts:225-245` can still return `null` after the first same-key same-client/non-conflicting recent op while an earlier different-client op is the actual stale baseline problem.

Even if `recentOps` is removed from update conflicts, the same-client guard still has a residual bug because `clientId` is currently `userId`, not a connection/actor id.

### 7. Insert/delete conflicts are still window-bound

Claude says `MERGE_WINDOW_SIZE` is addressed by per-key frontier, but the spec only describes incoming updates. Current insert/delete structural merge still depends on `recentOps`. Worse, the sketched `opKey = path.join('.') + ':' + taggedOp.key` does not work for inserts because inserts do not have `key`; they carry ids inside `value`.

If BL-0879 is only update conflicts, carve insert/delete window hardening to a follow-up. Do not claim the per-key frontier solved all CRDT conflict eviction.

### 8. Broadcast mutation details are underspecified

`broadcastToRoom` is generic. It handles join/leave/cursor/selection/lock/role/chat/state messages. Frontier mutation there must be guarded to `state-update`, must iterate `payload.operations`, must use each operation's own `timestamp`, and must not checkpoint closed sockets or excluded senders. A single outer `clock` value is wrong for multi-op batches.

## Answers to Claude's action item #2

### Do I agree (C) as spec'd closes BL-0879 cleanly?

No. It is salvageable, but not clean as written. Server-owned per-key frontiers are the right base, but "delivered on broadcast attempt" is not strong enough to decide stale vs intentional edits. It also contradicts the current failing test's expected behavior.

The minimum clean version is Option C-plus-ACK:

- Add per-connection ids.
- Store per-key authoritative frontier with the last accepted op.
- Track per-connection observed/applied frontier, not send-attempt frontier.
- Advance observed frontier only after `state-update`/`state-sync`/`conflict-detected` is applied or explicitly acknowledged by the client.
- Use the frontier's stored op to build `Conflict.theirOp`, not the recent window.

### Any residual gotchas still missed?

Yes: the send-vs-apply contradiction, state-sync without state, missing `theirOp`, userId/connection conflation, conflict notification ACK semantics, insert/delete still depending on `MERGE_WINDOW_SIZE`, batch timestamp handling, and the risk of accidentally retaining `detectConflict(recent)` for update UI payloads.

### Should `keyFrontiers` use TTL, LRU, or something else? Or carve to BL-0881?

Do not use TTL or LRU for correctness frontiers in BL-0879. Evicting an active key reopens the exact stale-write bug after enough time or churn. For the BL-0879 implementation, keep the frontier for each key that exists in the authoritative in-memory collaboration state and clear it only with the project/session lifecycle.

If memory growth is a real concern, carve pruning to BL-0881 and design it against entity lifecycle, not wall-clock age:

- active entity keys keep frontiers;
- deleted entities keep bounded tombstones if delete/update conflicts matter;
- abandoned project rooms clear frontiers only if the authoritative document state is also gone or reloadable from storage.

### Does BL-0880 `NumberInput` `1e-21` warrant a separate BL or follow-up commit?

Separate BL / explicitly scoped BL-0880 follow-up, not part of BL-0879. It needs a focused test for values smaller than the current `maximumFractionDigits: 20` precision and a product decision: preserve exponential input, reject below-precision values, or use a decimal/string formatter. It should not ride along with the collaboration CRDT fix.

## Recommended revision before implementation

Implementing Claude's current spec will either fail the existing conflict test or water down the semantics until stale edits are accepted. I would revise the plan before touching code:

1. Add `connectionId` to `ClientEntry`; route message handling, broadcast exclusion, delivered/observed tracking, and conflict/error sends by connection id.
2. Replace update conflict detection with direct frontier lookup where the frontier stores `theirOp`.
3. Add a client ACK message, or explicitly accept that this feature is based on queued delivery and rewrite the BL-0879 test/spec accordingly. I do not recommend the latter.
4. Extend `state-sync` only if it carries/apply-acks actual authoritative state or replay. A frontier-only sync must not mark the connection observed.
5. Add tests for: broadcast sent but not ACKed still conflicts; ACKed remote update allows intentional overwrite; conflict notification plus "accept mine" succeeds; same user two connections do not share observed frontier; stale conflict still detects after `recentOps` exceeds 200.

Option (C) is the right neighborhood. It is not yet the right address.
