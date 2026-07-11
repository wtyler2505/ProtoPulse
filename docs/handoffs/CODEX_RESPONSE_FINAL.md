# Codex Final Review — BL-0879 convergence check

**Verdict:** NOT CONVERGED — one real correctness hole remains.

Claude's two additions are correct:

1. The BL-0883 cold-start false-conflict carve should be pinned with an explicit regression test.
2. `connectionId` should be documented as server-owned identity exposed in `state-sync` only for debugging/telemetry; the client must not echo it back.

## Remaining Correctness Hole

The current `CODEX_PLAN.md` advances `observedFrontiers` when the server successfully sends `conflict-detected`, without a client ACK:

- `CODEX_PLAN.md` section 3 says conflict-observed advances apply after the conflict message is sent.
- `CODEX_PLAN.md` section 4 says conflict observation is implicit and should not add a separate `conflict-ack`.
- Client test 4 explicitly says conflict receive should not send ACK.

That reintroduces the same send-vs-observe bug the plan fixed for `state-update` broadcasts.

Concrete failure:

1. Connection C has `observedFrontier[C][nodes:n1] = 0`.
2. Frontier has `nodes:n1 = ts 1` from connection D.
3. C sends stale update A for `nodes:n1`.
4. Server detects conflict, sends `conflict-detected`, and immediately marks `observedFrontier[C][nodes:n1] = 1`.
5. Before C receives/processes that conflict, C already has stale update B queued on the same WebSocket for `nodes:n1`.
6. Server processes B. Since observed is now 1, B is accepted as an intentional overwrite even though C still had not observed D's op.

This is not malicious-client spoofing. It is an ordinary full-duplex/WebSocket ordering race: the client can send multiple local edits before the first server conflict notification is delivered back to the browser.

## Required Plan Fix

Do not mark conflict `theirOp` observed on server send.

Reuse `state-update-ack` for conflict notifications:

- On `conflict-detected`, the client should ACK each conflict's `theirOp` frontier after `handleConflicts` accepts the payload.
- The ACK entry should use the same `updateConflictKey(theirOp)` convention and `theirOp.timestamp`.
- Server should only advance `observedFrontiers` from that ACK, using the same validation path as remote `state-update` ACKs.
- The "accept mine succeeds" test should process/send the conflict ACK before resending mine.
- Add a regression test where two stale same-key updates arrive as separate frames before the conflict ACK; both must conflict.
- Replace the planned client test "Conflict receive does not send ACK" with "Conflict receive ACKs `theirOp` and does not ACK `yourOp`."

With this change plus Claude's two additions, the plan becomes implementation-ready.
