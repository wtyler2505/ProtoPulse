---
summary: Recurring bugs, root causes, and fix patterns in ProtoPulse
type: moc
---

# Bug Patterns

Bugs that recur or have non-obvious root causes — understanding these prevents repeat mistakes.

## Insights

- [[soft-deletes-create-a-persistent-querying-tax-where-forgetting-isNull-causes-data-ghosts]] — forgetting isNull(deletedAt) creates ghost data
- [[circuits-zero-defaulting-in-export-and-ordering-is-a-latent-multi-project-regression-because-it-silently-picks-the-wrong-circuit]] — circuits[0] default will break multi-circuit designs
- [[typescript-exhaustive-switch-on-discriminated-unions-fails-at-default-because-shared-base-properties-are-inaccessible-after-narrowing-to-never]] — exhaustive switch hides base properties in default case
- [[architecture-expansion-using-placeholder-first-pin-mapping-produces-semantically-wrong-schematics-that-erode-trust-in-ai-generated-designs]] — placeholder pins produce wrong schematics
- [[a-ci-gate-for-route-ownership-middleware-would-break-the-idor-recurrence-cycle]] — IDOR recurrence caused by missing ownership middleware on new routes
- [[ai-action-executor-uses-mutable-accumulators-to-prevent-stale-closure-bugs-in-multi-action-batches]] — stale closures silently drop mutations in multi-action batches; accumulator pattern (copy → mutate → commit once) is the fix
- [[errorboundary-suppresses-resizeobserver-loop-errors-because-they-are-benign-browser-noise-that-would-crash-every-canvas-view]] — ResizeObserver loop errors are NOT bugs but look like crashes; the ErrorBoundary filter prevents false positives
- [[deprecated-useproject-facade-enables-incremental-migration-from-monolithic-to-decomposed-contexts]] — using useProject() instead of domain hooks causes unnecessary re-renders across all domain state changes — a performance bug pattern
- [[architecture-context-has-two-parallel-undo-systems-that-do-not-interact]] — dual undo systems drift when architecture operations are pushed to the global stack — both stacks exist but only one responds to Ctrl+Z
- [[useSyncedFlowState-implements-bidirectional-sync-with-interaction-gating-to-prevent-context-overwrite-of-user-drags]] — if any ReactFlow handler forgets to flip the interaction flag, the next server state push silently overwrites the user's changes
