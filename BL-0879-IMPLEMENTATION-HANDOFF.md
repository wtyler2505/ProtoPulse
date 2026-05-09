# BL-0879 Implementation Handoff — fresh-session pickup brief

**Status:** 8-round Claude↔Codex adversarial review CONVERGED (2026-05-09). Architectural plan implementation-ready. This doc is the entry point for any fresh-session agent (Claude or Codex) implementing the diff.

## Read order (must read all 3 before touching code)

1. **`CODEX_PLAN_v2.md`** — primary plan, 754 lines, sections 1–9. The architectural spec.
2. **`CLAUDE_RESPONSE_3.md`** — adds: BL-0883 cold-start regression test pin, `connectionId` server-only doc comment.
3. **`CLAUDE_RESPONSE_5.md`** — adds: `markObserved` no-op on disconnect-race, `flushMicrotasks` primitive (setImmediate-backed), same-frame duplicate test 5b.

## Implementation order (CODEX_PLAN_v2.md §9)

Strict sequential — each step's tests run green before the next:

1. **Schema** — extend message types: `state-update-ack` payload (existing), `conflict-detected` payload, `state-sync` payload (with `connectionId` server-only).
2. **Server room** — add `keyFrontiers: Map<projectId, Map<entityKey, FrontierEntry>>` and `observedFrontiers: Map<projectId, Map<connectionId, Map<entityKey, number>>>`.
3. **ACK handler** — single code path for state-update ACKs AND conflict theirOp ACKs. Validate `ackedTs ≤ frontier.ts` clamp; advance via `Math.max(current, ackedTs)`. **`markObserved` no-ops if per-connection map missing** (race with disconnect cleanup — addition from CLAUDE_RESPONSE_5.md §1).
4. **Frontier advance points** — server advances `observedFrontiers[projectId][connectionId][entityKey]` ONLY on receipt of valid ACK. Server does NOT advance on `state-update` broadcast send. Server does NOT advance on `conflict-detected` send.
5. **Client ACK normal** — on receipt of remote `state-update`, after `applyRemoteUpdate`, send `state-update-ack` with each acked entity's `(entityKey, timestamp)`.
6. **Client ACK conflict** — on receipt of `conflict-detected`, after `handleConflicts`, send `state-update-ack` reusing `updateConflictKey(theirOp)` + `theirOp.timestamp`. Do NOT ACK `yourOp`.
7. **Tests** — 12 server integration tests + 5 client tests + Test 5b same-frame duplicate (CLAUDE_RESPONSE_5.md §3).
8. **Typecheck + lint** — clean before commit.

## Test plan summary (CODEX_PLAN_v2.md §6 + additions)

**Server (12):**
1. State update broadcasts to other connections, sender does not echo back
2. Stale update from same-account different-connection conflicts
3. Stale update from same connection conflicts (no self-spoofing)
4. Conflict notification + accept-mine succeeds **only after conflict ACK**
5. Two stale same-key updates in **separate frames** before conflict ACK both conflict (use `flushMicrotasks` from CLAUDE_RESPONSE_5.md §2)
6. **5b. Two stale same-key updates in a single batch** both conflict (CLAUDE_RESPONSE_5.md §3)
7. Cold-start state-sync false-conflict regression test (CLAUDE_RESPONSE_3.md)
8. ACK validation rejects `ackedTs > frontier.ts`
9. ACK validation accepts `ackedTs ≤ frontier.ts`
10. `markObserved` no-ops when per-connection map deleted by disconnect (CLAUDE_RESPONSE_5.md §1)
11. Frontier eviction does not corrupt observed advance
12. Multi-tab same-account: per-connection observed frontier independent

**Client (5):**
1. Normal remote update triggers `state-update-ack` with correct (entityKey, timestamp)
2. Conflict receive ACKs `theirOp` and does NOT ACK `yourOp`
3. Local-only update does not emit ACK
4. Empty `conflicts[]` array does not emit ACK
5. ACK batches multiple entities in one message

## Helper to add to `server/__tests__/collaboration-crdt-integration.test.ts`

```ts
async function flushMicrotasks(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}
```

## LOC estimate

775–1305 changed lines (production 380–620, tests 395–685). Run in background if dispatched via agent.

## Bidirectional implementation pattern (per `feedback_codex_bidirectional_iteration.md`)

Whichever agent lands the diff (Claude or Codex), the OTHER agent reviews:

1. Implementer commits per-step, runs tests green per-step.
2. After step 8 (typecheck), implementer writes `<AGENT>_DIFF_REVIEW_REQUEST.md` summarizing scope + flagging anything they're unsure about.
3. Reviewer attacks the diff with adversarial framing — "find the bug", "trace the race", "what edge case did this miss".
4. Iterate until both sign off, then close BL-0879.

**Do not skip the review round.** The 8-round architectural review caught holes in Rounds 6 + 8 that both agents had previously thought converged. The diff is no different.

## Carve-outs (do not address in BL-0879)

- **BL-0881** — NumberInput `1e-21` → `0` precision fix
- **BL-0882** — Insert/delete frontier extension (separate spec needed)
- **BL-0883** — state-sync document snapshot + replay + ACK (cold-start gap)
- **BL-0884** — Per-connection outbound ACK ledger (spoofing-proof CRDT, deferred until threat model changes)

## Hard rules to honor during implementation

- **Errors are errors.** Any TS/test/lint error caught during implementation is fixed, not dismissed.
- **No shortcuts.** Tyler has zero tolerance for "we'll fix it later".
- **Real research per phase.** Before each step above, WebSearch + Context7 verify any library/API behavior — Vitest 4 patterns, Yjs lifecycle, ws server hooks. Cite source URLs in commit messages.
- **Cap concurrent agents at 6.** If dispatching parallel sub-agents for tests + impl, count them.

## Why this file exists

The 8-round adversarial review surfaced 18+ architectural holes and carved 4 sub-BLs organically. Pre-this-file, fresh-session pickup required reading 3 specs in correct order + understanding their relationship. This brief collapses that to a 1-file entry point so no future agent re-derives the iteration.
