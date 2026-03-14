---
summary: ArchitectureProvider maintains its own useState-based undo/redo stacks independent of the global UndoRedoStack (Command pattern), creating two non-interacting undo systems that could confuse users
category: gotcha
areas: ["[[index]]"]
related insights:
  - "[[projectprovider-is-known-tech-debt-because-monolithic-context-forces-full-tree-rerenders-on-any-state-change]] — the architecture context was decomposed from ProjectProvider but carried its own undo system"
  - "[[context-decomposition-uses-a-bridge-component-to-solve-cross-provider-dependency-ordering]] — decomposition created the opportunity for duplicate systems"
type: insight
source: extraction
created: 2026-03-14
status: active
evidence:
  - projectprovider-is-known-tech-debt-because-monolithic-context-forces-full-tree-rerenders-on-any-state-change.md
  - context-decomposition-uses-a-bridge-component-to-solve-cross-provider-dependency-ordering.md
---

ProtoPulse has two independent undo/redo systems that coexist without coordination:

1. **Global UndoRedoStack** (`client/src/lib/undo-redo.ts` + `undo-redo-context.tsx`): A Command-pattern engine where each `UndoableCommand` has `execute()` and `undo()` methods. Exposed via `UndoRedoProvider` and `useUndoRedo()`. Uses `useSyncExternalStore` for React integration. Handles Ctrl+Z/Ctrl+Shift+Z keyboard shortcuts with editable-element detection.

2. **Architecture-local undo stacks** (`client/src/lib/contexts/architecture-context.tsx`): Simple `useState<Array<{ nodes: Node[]; edges: Edge[] }>>` arrays for undo and redo. Operations snapshot the full node+edge arrays before mutations and restore them on undo.

The two systems differ fundamentally:
- The global system is **action-based**: each entry knows how to reverse itself independently (Command pattern).
- The architecture system is **snapshot-based**: each entry stores the complete state at a point in time. Undoing replaces the entire state with the previous snapshot.

The non-obvious consequence is that when a user presses Ctrl+Z, only the global UndoRedoProvider's keyboard handler fires (it has the `window` keydown listener). The architecture undo stacks are only accessible through the architecture context's `undo()` method, which must be called explicitly by UI buttons. If architecture operations are pushed to the global stack via `UndoableCommand` wrappers, they'll work through Ctrl+Z — but the architecture context's local stacks won't know about it and will drift.

Both stacks are capped at 50 entries (`DEFAULT_MAX_SIZE` in undo-redo.ts, `MAX_UNDO_STACK_DEPTH` in architecture-context.tsx), suggesting the cap was copied during decomposition. Consolidating into a single system is implicit tech debt.

## Topics

- [[index]]
