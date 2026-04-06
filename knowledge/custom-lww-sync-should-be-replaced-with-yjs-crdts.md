---
description: "Real-time collaboration uses a custom Last-Write-Wins mechanism — destructive merges on nested schematic data are inevitable without proper CRDTs"
type: debt-note
source: "conductor/comprehensive-audit.md §7, §26"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["server/collaboration.ts", "client/src/lib/pwa-manager.ts", "client/src/lib/offline-sync.ts"]
---

# Custom Last-Write-Wins sync will cause destructive merges and should be replaced with Yjs CRDTs

The collaboration engine (`server/collaboration.ts`) and offline sync (`offline-sync.ts`) both use custom manual LWW mechanisms. For complex nested objects like schematic graphs, LWW is an anti-pattern — two users editing the same text label or moving the same component will silently overwrite each other's work.

Additionally, the `OfflineSyncManager` holds conflict state in memory (`this.conflicts`). A page refresh during conflict resolution wipes the entire conflict state, leaving unresolved or stuck data in IndexedDB.

The 2026 standard is Yjs (or Automerge), which handles deterministic CRDT merging across IndexedDB and WebRTC natively, integrates with React 19's `useOptimistic`, and prevents data loss.

---

Relevant Notes:
- [[ai-is-the-moat-lean-into-it]] -- collaboration is a competitive feature gap
- [[websocket-sessions-are-never-revalidated-after-initial-handshake]] -- the same CollaborationServer has both sync integrity and auth boundary issues
- [[cross-tool-coherence-is-harder-than-building-features]] -- LWW breaks cross-view coherence when two users edit related data in different views

Topics:
- [[architecture-decisions]]
