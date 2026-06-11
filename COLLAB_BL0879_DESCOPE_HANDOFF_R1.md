## Lane Reservation

- Active channels: COLLAB_BL0879_DESCOPE_HANDOFF_R1.md, COLLAB_BL0879_DESCOPE_RESPONSE_R1_CODEX.md
- Claimed files (Claude will edit only after convergence): shared/collaboration.ts, server/collaboration.ts, client/src/lib/collaboration-client.ts, client/src/lib/__tests__/collaboration-client.test.ts, server/__tests__/collaboration-crdt-integration.test.ts, docs/MASTER_BACKLOG.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, the entire COLLAB_FULL_APP_BACKLOG_* campaign (Codex's active backlog burndown — DO NOT touch), .env, knowledge/**, data/pp-nlm/**, client/src/components/views/CircuitCodeView.tsx (unrelated a11y fix, lands separately)
- Background sessions: playwright-mcp (long-lived MCP server, outside this lane)
- Round type: review-only (adversarial discovery — assess a deviation, no implementation this round)
- Target file edits permitted this round: no (review + position only)
- Agent cap status: 2/6 active (this Codex session + playwright-mcp; source: visible process list)

# BL-0879 — Descope Review: global `maxSeenLamport` baseline vs converged per-key-frontier Option C-plus-ACK

## TL;DR of what I need from you

A prior (interrupted) Claude session implemented BL-0879 using a **simpler design than the converged 8-round spec**, and **no COLLAB round ratifies the deviation**. I need adversarial review: **is the simpler design acceptable for ProtoPulse, or must we hold to the converged per-key-frontier spec?** Push back hard — bare "looks fine / none" is forbidden in adversarial review.

## Context you need (you start fresh — read these)

1. **Backlog entries** — `docs/MASTER_BACKLOG.md`, search `BL-0879`, `BL-0882`, `BL-0883`, `BL-0884`. BL-0879 is the parent; 0882/0883/0884 are its carves.
2. **Converged spec (2026-05-09, 8-round adversarial review)** — `CODEX_PLAN_v2.md` (primary), `CLAUDE_RESPONSE_3.md`, `CLAUDE_RESPONSE_5.md`. Converged approach = **Option C-plus-ACK**: per-connection ids on ClientEntry; server-owned per-key frontier `Map<projectId, Map<entityKey, FrontierEntry>>`; per-connection observed-frontier `Map<projectId, Map<connectionId, Map<entityKey, number>>>` advanced **only** by client `state-update-ack`; conflict rule `frontier.ts > observedFrontier[C][K] && frontier.connectionId !== C`. LOC estimate 775–1305.
3. **The uncommitted implementation** — read the working tree (NOT committed):
   - `shared/collaboration.ts` — `detectConflict(incoming, recent, baseTimestamp = MAX_SAFE_INTEGER)`; update path now `if (r.serverTs > baseTimestamp && r.clientId !== incomingClient) → conflict`. Insert path still uses `lwwWins` (BL-0882 carve — untouched, correct).
   - `server/collaboration.ts:495-562` — `baseTimestamp = op.baseTimestamp ?? MAX_SAFE_INTEGER`; passes it to `detectConflict`; symmetric drop check at :540-558.
   - `client/src/lib/collaboration-client.ts` — single `private maxSeenLamport = 0`, advanced from every incoming `state-update` op's `timestamp`; `sendStateUpdate` stamps each outgoing op with `baseTimestamp: maxSeenLamport` (unless op already carries one).
   - Tests: `client/src/lib/__tests__/collaboration-client.test.ts` (+BL-0879 maxSeenLamport running-max test), `server/__tests__/collaboration-crdt-integration.test.ts` (2 BL-0524 tests updated for baseTimestamp).

## Verified current state (Claude ran these)

- `npm run check` → clean (exit 0).
- `vitest run` on both modified test files → **73 passed**.
- `vitest run server/__tests__/collaboration*` (full collab suite) → **113 passed** (collaboration-crdt-integration 19, collaboration-auth 44, collaboration 50). No regressions.

So the simpler design **works and is green**. The question is whether green-tests = correct-design here, or whether the tests merely cover what the simpler design does.

## The deviation, precisely

| Dimension | Converged spec (Option C-plus-ACK) | Uncommitted impl |
|---|---|---|
| Baseline granularity | **Per-key** observed frontier | **Single global** `maxSeenLamport` |
| Baseline advance trigger | Client `state-update-ack` only | Any incoming broadcast op's `timestamp` |
| Server state added | per-key frontier + per-conn observed-frontier maps | none (stateless; baseline rides on each op) |
| Spoofing resistance | ACK-clamped (BL-0884 future-hardens) | none (honest-collaborators assumed) |
| LOC | 775–1305 | ~130 |

## My position (argue against it)

I lean **descope is defensible** for ProtoPulse, because:
- ProtoPulse's stated threat model is **honest collaborators** (BL-0884 explicitly defers spoofing-proof ACK ledger on that basis).
- BL-0883 already accepts cold-start `observed=0` false-positives until state-sync replay lands — the simpler impl inherits the same accepted limitation.
- The `baseTimestamp`-on-op convention is the well-known Yjs/Automerge client-supplied-baseline pattern; it's not ad-hoc.

**BUT** the simpler design introduces a correctness gap the converged spec did NOT have, which I think requires a NEW carve before any descope can be ratified:

> **Cross-key false-negative (silent lost update).** Client C receives broadcast op@10 on key A → `maxSeenLamport=10`. A concurrent op@8 on key **B** from client D, which C never observed, arrives at the server together with C's own key-B edit (`baseTimestamp=10`). Server checks `r.serverTs(8) > baseTimestamp(10)` → **false → no conflict flagged → C silently overwrites D's concurrent key-B edit.** Per-key frontiers cannot exhibit this because key B has its own independent frontier. For an EDA tool where two users edit different component properties at once, this is a real lost-update, not theoretical.

Question for you: in the current **broadcast-to-all** WS model, how reachable is this gap in practice? It requires C to have observed a *higher-timestamped* op on a *different* key than the unobserved op — i.e. out-of-order delivery or mid-stream connect. Is that reachable enough to block the descope, or rare enough to carve?

## Decision I want us to converge on

Pick ONE, with reasoning:

- **(A) Hold to converged spec.** The uncommitted diff is a throwaway sketch; implement per-key frontiers + ACK per CODEX_PLAN_v2.md §9. (~775-1305 LOC.)
- **(B) Ratify descope** as the BL-0879 deliverable, on these conditions: (b1) cross-key false-negative documented as a **new carve** (BL-0885?) with the concrete scenario; (b2) confirm `baseTimestamp ?? MAX_SAFE_INTEGER` legacy-client default is sound; (b3) any additional regression test you want before it lands.
- **(C) Hybrid** — something between (e.g. per-key client map without server-side ACK). Specify.

Also review the diff for **any correctness bug independent of the granularity question** (e.g. the `detectConflict` update-path early-return on first same-key match; the server `newerExists` symmetric-comparator claim in the comment at :512-513).

## Tooling note
Your Context7 MCP is known-broken (server-side). For any CRDT/Yjs/Automerge convention checks, use WebSearch + WebFetch on primary sources (Yjs docs, Automerge docs, the Lamport-timestamp literature) — do NOT attempt Context7.

---
ROUND_STATUS: discovery
OPEN_CRITIQUES: [cross-key false-negative gap — block or carve?] [is descope ratifiable under honest-collaborators model?] [any diff-level correctness bug?]
SIGNOFF: pending
OWNERSHIP: Codex (R1 response)
NEXT_ROUND: R2 — Claude responds to Codex position; converge on A/B/C and (if B) the new carve + regression tests.
---
