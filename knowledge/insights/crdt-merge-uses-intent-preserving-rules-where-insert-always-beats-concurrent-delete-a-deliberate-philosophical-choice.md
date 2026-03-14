---
summary: The CRDT structuralMerge in collaboration.ts deliberately makes insert win over concurrent delete (creation intent > destruction intent), which is non-obvious and could surprise developers expecting pure LWW
type: pattern
---

# CRDT merge uses intent-preserving rules where insert always beats concurrent delete

In `shared/collaboration.ts`, the `structuralMerge()` function implements a non-standard CRDT conflict resolution strategy:

1. **Delete vs concurrent Insert for same key:** Delete is **rejected**. The rationale (documented in code): "creation intent should not be silently discarded."
2. **Concurrent Inserts for same key:** Higher `(timestamp, clientId)` wins (standard LWW).
3. **Updates:** Pure LWW via `lwwWins()` — higher timestamp wins, ties broken by higher clientId.

This is a deliberate deviation from pure last-write-wins. In a pure LWW system, if User A creates node X at t=10 and User B deletes node X at t=11, the delete would win. In ProtoPulse's system, the insert always wins regardless of timestamp.

**Why this matters for an EDA tool:** In circuit design, accidentally deleting a component (node) that someone else just placed is far more destructive than having an "extra" component appear. A user who sees an unexpected component can investigate and remove it. A user whose component silently disappeared has no indication that work was lost. The merge rule encodes domain knowledge: in hardware design, false presence is recoverable but false absence is data loss.

**The `lwwWins` tie-break** uses `clientId > existingClient` as the deterministic tiebreaker. This means clients with higher IDs (typically later joiners) win ties. This is arbitrary but consistent — the key property is that both clients reach the same conclusion independently.

**Implications:** Any developer adding new CRDT-synced entity types must understand that deletes are "weak" operations in this system. If they expect a delete to reliably remove something a peer is concurrently recreating, they'll see surprising behavior. The `MergeVerdict` type (`'accept' | 'reject' | 'superseded'`) is the signal — `'reject'` means the operation was intentionally blocked, not that it failed.
