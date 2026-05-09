# Codex review of BL-0879 decision doc

## Verdict on Option (A)
disagree

Client-supplied causal baselines are a legitimate long-term direction, but Claude's proposed Option (A) is not safe enough to implement as written. It under-specifies sync/reconnect semantics, uses a scalar project-wide baseline where the decision text cites vector-clock systems, and proposes a legacy fallback that silently preserves the current bug.

## Pushback / corrections
- Claude correctly diagnosed the immediate server bug: `mergeAndBroadcastOps` assigns a fresh server Lamport before conflict checks, so the second same-key update almost always beats the first under the existing `lwwWins` check.
- The decision doc is muddy about semantics. The failing test calls user 1 the "LWW-losing" client, but under the current server-assigned LWW policy the later arrival is the winner. The desired policy is really "a stale/concurrent same-key edit loses to an already accepted remote edit and gets surfaced as a conflict." That is not the same thing as plain LWW.
- The Yjs/Automerge analogy is too hand-wavy. Those systems do not boil down to "send one project-wide `maxSeenLamport` scalar on every op"; they use richer actor/state-vector causality. A scalar max can be made to work only if the stream is complete, ordered, and correctly initialized.
- Option (A) does not handle initial sync. Current `state-sync` only sends users, version, and locks, not a document snapshot, max Lamport, or per-key causal frontier. A newly connected or reconnected client therefore cannot compute a correct `baseTimestamp` from `state-sync` alone.
- Option (A) can create false negatives if `maxSeenLamport` is project-wide. Seeing an unrelated update at Lamport 100 would let a client send `baseTimestamp=100` for `nodes.n1`, even if it never actually saw the `nodes.n1` update at Lamport 90.
- Option (B) is not genuinely worse for this codebase's current tests. A server-side delivery checkpoint requires less schema churn and fewer client touchpoints than Option (A), and fake timers do not make it intractable. The real caveat is production semantics: "server attempted to send" is not the same as "client applied."
- `Number.MAX_SAFE_INTEGER` as the missing-`baseTimestamp` fallback is dangerous. It means every unmigrated path says "I have seen everything," which is exactly how the current bug survives under a new field. If the field is required, fail loud; if legacy clients must work, use a server-side checkpoint fallback.
- "Accept mine naturally works" is not true in the current client. `handleConflicts` only stores conflicts, and `resolveConflict('mine')` re-sends `yourOp` after stripping only `timestamp` and `clientId`. With Option (A), it must advance from `theirOp.timestamp`/`detectedAt` and must strip or overwrite stale `baseTimestamp`.

## Option (C) candidate
Use a server-owned causal checkpoint first: track the latest accepted Lamport per project/key, plus the latest delivered/synced Lamport per connection for that key.

On incoming update: conflict when `currentKeyLamport[opKey] > deliveredKeyLamport[connection][opKey]` and the current key owner is a different client/session. On broadcast, update recipients' delivered checkpoint for the touched key. On `state-sync`, initialize the checkpoint only if the sync actually contains the authoritative state frontier; otherwise fix `state-sync` first.

This keeps the wire schema stable for BL-0879, avoids project-wide scalar false negatives, and can be upgraded later with explicit client ACKs or a message-level `lastAppliedLamport` if "processed by client" matters more than "sent by server."

## Implementation gotchas Claude missed
- `state-sync` must carry a causal frontier, or Option (A) is broken on fresh join/reconnect before the first `state-update`.
- The server does not echo accepted `state-update` messages back to the sender, so clients cannot learn their own server-assigned Lamports purely from broadcasts.
- `resolveConflict('mine')` must not reuse the losing op's stale `baseTimestamp`. The current destructure would leave it behind if `baseTimestamp` is added to `CRDTOperation`.
- `sendStateUpdate` must add baselines to cloned ops, not mutate caller-owned operation objects.
- Server must validate `baseTimestamp` as finite/non-negative and must ignore client-supplied `timestamp`/`clientId` for authority.
- `detectConflict` should not blindly return `null` after the first same-key recent op if that op is same-client or otherwise non-conflicting while an earlier different-client op after the baseline still matters.
- The recent-op window remains a correctness boundary. If the conflicting key update falls out of `MERGE_WINDOW_SIZE`, both Option (A) and current structural merge logic stop seeing it unless a separate per-key frontier exists.

## Recommended next move
Do not implement Option (A) exactly from the decision doc. Either implement the server-side per-key checkpoint Option (C) as the narrow BL-0879 fix, or revise Option (A) first with: required/validated `baseTimestamp`, no `MAX_SAFE_INTEGER` fallback, `state-sync` frontier support, explicit conflict/accept-mine baseline advancement, and reconnect/sync-gap tests.

Live verification I ran: the current targeted BL-0879 integration test still fails at the expected missing `conflict-detected` assertion, while the existing collaboration-client conflict/state tests pass and therefore do not yet cover the new causal-baseline behavior.

## BL-0880 self-audit
For visible UI changes: no new visible text labels were added where the design previously had none. The fixes were `aria-label`s on icon-only buttons/select triggers, ARIA validity on `VaultInfoIcon`, hidden file-input accessible names, or `htmlFor`/`id` associations for already visible labels.

Per view:
- `ComponentEditorView`: no visible UI change; hidden file inputs got accessible names.
- `CalculatorsView`: no visible UI change; reset icon buttons got `aria-label`s and shared `NumberInput`/`VaultInfoIcon` behavior changed only accessibility attributes.
- `DesignPatternsView`, `KanbanView`, `KnowledgeView`, `CommunityView`, `AuditTrailView`: no visible UI change; `aria-label`s landed on `SelectTrigger`.
- `BoardViewer3DView`: no new visible labels; existing Width/Height/Thickness labels were associated with inputs, plus the reset-view icon button got an `aria-label`.
- `PcbOrderingView`: no new visible label; the existing Silkscreen Color label was associated with the select trigger.
- `GenerativeDesignView`: no new visible labels; existing range/number labels were associated with inputs.

`CalculatorsView` / `NumberInput` caveat: `1e-9` normalizes to `0.000000001`, preserving the numeric meaning, and the current `NumberInput` suite passes. But the original BL-0880 patch did not add a regression test for exponential notation, and the helper is not universally safe: `1e-21` formats to `0` with the current `maximumFractionDigits: 20`. That should get a focused follow-up test/fix if ultra-small values are in scope.

Regression verification: I reran the targeted axe test for all 10 fixed views and it passed: 10 passed / 17 skipped. I also reran available functional suites for `AuditTrailView`, `DesignPatternsView`, `GenerativeDesignView`, `BoardViewer3DView`, plus `NumberInput`: 55 view tests passed and 11 `NumberInput` tests passed. I did not find dedicated functional render suites for `CalculatorsView`, `CommunityView`, `KanbanView`, `KnowledgeView`, `PcbOrderingView`, or full `ComponentEditorView`, so BL-0880 should not be claimed as fully behavior-regression-tested beyond axe/render coverage.

`Select` audit: the `aria-label` fixes were applied to `SelectTrigger`, not the non-interactive `Select` root. The shared `SelectTrigger` spreads props directly onto Radix `SelectPrimitive.Trigger`, so these labels land on the interactive button. `PcbOrderingView` uses `htmlFor`/`id` on the visible label and trigger rather than an `aria-label`, and the targeted axe rerun accepts it.
