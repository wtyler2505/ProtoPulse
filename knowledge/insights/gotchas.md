---
summary: Non-obvious behaviors, traps, and things that will bite you in ProtoPulse
type: moc
---

# Gotchas

The things you wish someone had told you before you hit them. Read these before working in unfamiliar areas.

## Insights

- [[soft-deletes-create-a-persistent-querying-tax-where-forgetting-isNull-causes-data-ghosts]] — always filter isNull(deletedAt)
- [[auto-loaded-claude-md-files-in-subdirectories-consume-context-window-causing-premature-session-compaction]] — subdirectory CLAUDE.md is a context tax
- [[concurrent-tsc-runs-during-agent-teams-cause-oom-so-node-max-old-space-size-must-be-increased-when-four-or-more-teammates-compile-simultaneously]] — 4+ tsc runs cause OOM
- [[agent-team-teammates-die-on-context-compaction-so-parallel-work-requires-liveness-checks-after-session-continuation]] — teammates die on compaction
- [[express-5-req-params-returns-string-or-string-array-so-every-route-param-access-needs-string-wrapping]] — Express 5 params typing trap
- [[circuits-zero-defaulting-in-export-and-ordering-is-a-latent-multi-project-regression-because-it-silently-picks-the-wrong-circuit]] — circuits[0] silent default
- [[localstorage-backed-features-are-invisible-technical-debt-because-they-look-shipped-but-break-on-any-multi-device-or-collaboration-scenario]] — localStorage features look done but aren't
- [[errorboundary-suppresses-resizeobserver-loop-errors-because-they-are-benign-browser-noise-that-would-crash-every-canvas-view]] — ResizeObserver loop errors are benign browser noise; the ErrorBoundary swallows them to prevent false crash screens on canvas views
- [[ai-action-executor-uses-mutable-accumulators-to-prevent-stale-closure-bugs-in-multi-action-batches]] — stale closures silently drop AI actions in multi-action batches; the accumulator pattern (copy → mutate → commit once) is the fix
- [[drc-explanations-embed-pedagogical-content-directly-in-the-engine-making-the-validation-system-a-teaching-tool-not-just-a-checker]] — missing DRC explanations are a silent gap (Record<string, string> not Record<DRCRuleType, string>); new rules without explanations break the pedagogical contract
- [[query-keys-are-url-strings-used-as-both-cache-identifiers-and-fetch-targets-eliminating-key-endpoint-drift]] — URL-as-key eliminates key-endpoint drift, but the tradeoff is that query keys are less semantic (can't easily query "all node-related queries")
- [[deprecated-useproject-facade-enables-incremental-migration-from-monolithic-to-decomposed-contexts]] — useProject() still works but subscribes to ALL domain state changes; using it unknowingly causes unnecessary re-renders
