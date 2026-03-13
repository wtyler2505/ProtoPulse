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
