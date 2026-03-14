---
summary: useActionExecutor copies state arrays into local mutables before the action loop, then commits once, preventing earlier mutations from being silently dropped by stale closures
category: bug-pattern
areas: ["[[architecture]]", "[[ai-system]]", "[[bug-patterns]]"]
wave: "extraction"
---

# AI action executor uses mutable accumulators to prevent stale-closure bugs in multi-action batches

The AI chat system can return multiple actions in a single response (e.g., add 3 nodes, connect 2 edges, add a BOM item). The naive approach would call `setNodes()` inside a loop — but React Query's optimistic update + invalidation means the `nodes` array captured by the hook closure becomes stale after the first mutation. The second action would overwrite the first action's changes.

The fix is in `client/src/components/panels/chat/hooks/useActionExecutor.ts` (lines 46-54): the executor copies `nodes`, `edges`, `bom`, and `issues` into local mutable `ActionState` accumulators *before* entering the action loop. Every action handler reads from and writes to these accumulators. After all actions run, a single `setNodes(state.currentNodes)` call commits the accumulated result.

Key details:
- `nodesDirty` / `edgesDirty` flags skip unnecessary commits when no handler touched that state
- `pushUndoState()` is called once at the top, not per action — the entire batch is a single undoable operation
- The handler lookup is `ACTION_HANDLERS[action.type]` — a static registry in `./action-handlers/`, not a switch statement

This is a subtle bug class that affects any React code where:
1. Multiple state mutations happen in sequence
2. Each mutation depends on the result of the previous one
3. State is read from a closure (hook dependency) rather than a ref

The accumulator pattern is the standard fix: copy → mutate locally → commit once.

---

Related:
- [[singleton-subscribe-became-the-universal-client-state-primitive-because-useSyncExternalStore-makes-any-class-a-hook]] — the alternative state pattern that doesn't have this problem
- [[the-gap-between-feature-exists-and-feature-is-wired-is-the-dominant-source-of-broken-workflows]] — action handlers are where AI features get "wired"

Areas:
- [[architecture]]
- [[ai-system]]
- [[bug-patterns]]
