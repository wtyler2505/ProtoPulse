---
summary: useSyncedFlowState prevents context→local overwrites during user interaction via mutable ref flags, solving the classic ReactFlow race between server state sync and local drag operations
category: implementation-detail
areas: ["[[index]]"]
related insights:
  - "[[singleton-subscribe-became-the-universal-client-state-primitive-because-useSyncExternalStore-makes-any-class-a-hook]] — singleton+subscribe avoids this problem entirely; useSyncedFlowState only exists because ReactFlow nodes/edges must live in React state"
  - "[[projectprovider-is-known-tech-debt-because-monolithic-context-forces-full-tree-rerenders-on-any-state-change]] — the context state that useSyncedFlowState syncs against is the problematic monolithic provider"
type: insight
source: extraction
created: 2026-03-14
status: active
evidence:
  - singleton-subscribe-became-the-universal-client-state-primitive-because-useSyncExternalStore-makes-any-class-a-hook.md
  - projectprovider-is-known-tech-debt-because-monolithic-context-forces-full-tree-rerenders-on-any-state-change.md
---

ReactFlow requires local `useState` arrays for nodes and edges (it mutates them directly during drag, pan, and connect operations), but the authoritative state lives in React Query cache via context. `useSyncedFlowState` in `client/src/hooks/useSyncedFlowState.ts` solves this with a mutable ref gating pattern:

1. **Two `useRef<boolean>` flags** (`nodeInteracted`, `edgeInteracted`) track whether the user has actively manipulated the canvas.
2. **Context→Local sync** (server data arrives): if the interaction flag is false, the local state updates to match. If the flag is true, the update is skipped — the user's in-progress drag takes priority.
3. **Local→Context sync** (user finished dragging): debounced at 1.5 seconds after the last local change, gated by the interaction flag. A `beforeunload` handler flushes pending saves to prevent data loss on tab close.
4. **Mount-skip pattern**: `useRef(true)` flags (`nodesMountSkip`, `edgesMountSkip`) prevent the local→context save from firing on the initial render, which would needlessly persist the initial data load.

The non-obvious aspect is that the interaction flag is consumed on every context→local sync: the effect sets it back to `false` after checking, creating a one-shot gate. The consuming component (ArchitectureView, SchematicCanvas) must re-set it to `true` in every `onNodeDragStop`, `onConnect`, etc. handler. If any handler forgets to flip the flag, the next server state push will silently overwrite the user's changes.

This pattern exists specifically because ReactFlow's internal state model is incompatible with external stores — you cannot use `useSyncExternalStore` for ReactFlow nodes. Every other state domain in ProtoPulse uses singleton+subscribe precisely to avoid this complexity.

## Topics

- [[index]]
