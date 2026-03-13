---
summary: Claude Code agent teams, parallel execution, session management, and tooling gotchas
type: moc
---

# Agent Workflows

Patterns and pitfalls for using Claude Code's agent team system for parallel development work.

## Insights

- [[agent-team-teammates-die-on-context-compaction-so-parallel-work-requires-liveness-checks-after-session-continuation]] — teammates die on context compaction
- [[concurrent-tsc-runs-during-agent-teams-cause-oom-so-node-max-old-space-size-must-be-increased-when-four-or-more-teammates-compile-simultaneously]] — 4+ concurrent tsc runs cause OOM
- [[auto-loaded-claude-md-files-in-subdirectories-consume-context-window-causing-premature-session-compaction]] — subdirectory CLAUDE.md files are a permanent context tax
