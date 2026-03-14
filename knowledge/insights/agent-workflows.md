---
summary: Claude Code agent teams, parallel execution, session management, and tooling gotchas
type: moc
---

# Agent Workflows

Patterns and pitfalls for using Claude Code's agent team system for parallel development work.

## Insights

### Hook System (defense-in-depth quality gates)
- [[hook-architecture-uses-layered-gates-where-pretooluse-prevents-damage-posttooluse-catches-regressions-and-stop-enforces-quality-before-handoff]] — three-layer defense-in-depth: PreToolUse/PostToolUse/Stop
- [[tsc-watch-in-tmux-provides-near-instant-type-feedback-by-decoupling-the-compiler-lifecycle-from-individual-tool-invocations]] — persistent tsc --watch avoids cold start penalty, feeds PostToolUse
- [[sessionstart-dependency-verification-creates-a-self-healing-bootstrap-that-surfaces-missing-tools-before-they-cause-cryptic-hook-failures]] — preflight check verifies hook dependencies (claudekit, tmux, jq)
- [[ci-pipeline-gates-build-behind-typecheck-but-runs-lint-and-tests-independently-optimizing-for-fast-failure-on-the-cheapest-check]] — CI mirrors the Stop layer's typecheck gate in the deployment pipeline

### Agent Capability Profiles
- [[agent-specifications-use-yaml-frontmatter-to-control-model-selection-tool-access-and-hook-suppression-creating-a-capability-profile-per-agent]] — YAML frontmatter creates constrained capability profiles per agent

### Knowledge System (Ars Contexta)
- [[arscontexta-vault-marker-file-acts-as-a-feature-flag-that-conditionally-activates-knowledge-system-hooks-without-code-changes]] — vault marker as per-repository feature flag for knowledge hooks
- [[arscontexta-skills-implement-a-knowledge-processing-pipeline-where-each-phase-runs-in-isolated-context-with-structured-handoff-blocks-for-state-transfer]] — RALPH HANDOFF protocol for cross-context state transfer

### Agent Team Gotchas
- [[agent-team-teammates-die-on-context-compaction-so-parallel-work-requires-liveness-checks-after-session-continuation]] — teammates die on context compaction
- [[concurrent-tsc-runs-during-agent-teams-cause-oom-so-node-max-old-space-size-must-be-increased-when-four-or-more-teammates-compile-simultaneously]] — 4+ concurrent tsc runs cause OOM
- [[auto-loaded-claude-md-files-in-subdirectories-consume-context-window-causing-premature-session-compaction]] — subdirectory CLAUDE.md files are a permanent context tax
