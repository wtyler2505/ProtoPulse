---
description: "SchematicCanvas uses JSON.stringify over full node/edge arrays per render cycle — O(N) serialization that guarantees editor freezes at enterprise scale"
type: debt-note
source: "conductor/comprehensive-audit.md §2"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["client/src/components/circuit-editor/SchematicCanvas.tsx"]
---

# ReactFlow sync uses JSON.stringify per render which is O(N) and breaks at 10k nodes

`SchematicCanvas.tsx` relies on `JSON.stringify` over entire node and edge arrays (`flowNodeSyncSignature`, `flowEdgeSyncSignature`) to trigger ReactFlow state updates. This is an O(N) operation per render cycle that signals deep struggles with referential equality.

ReactFlow completely breaks down at the 10,000 node threshold due to DOM overhead even with virtualization. The 2026 industry approach is a hybrid WebGPU/DOM architecture: WebGPU instanced drawing with SDFs for the zoomed-out overview, hydrating ReactFlow DOM components only when the user zooms into a cluster of 50-100 nodes.

---

Relevant Notes:
- [[tinkercad-perception-gap-is-about-seeing-not-computing]] -- canvas performance is the perception gap
- [[simulation-engine-blocks-main-thread-with-no-webworker-or-wasm]] -- both block the main thread: stringify per render, MNA per simulation
- [[vite-manual-chunks-defeats-dynamic-import-and-tree-shaking]] -- combined: bloated initial load + O(N) per render = compounding perf degradation
- [[monolithic-context-causes-quadratic-render-complexity]] -- the stringify runs inside the monolithic re-render cascade

Topics:
- [[architecture-decisions]]
