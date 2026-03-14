---
summary: The hook system implements three distinct enforcement layers — PreToolUse blocks dangerous actions before they happen, PostToolUse catches regressions immediately after each edit, and Stop gates quality before the agent can hand off
category: architecture
areas:
  - agent-workflows
  - conventions
---

# Hook architecture uses layered gates where PreToolUse prevents damage, PostToolUse catches regressions, and Stop enforces quality before handoff

The `.claude/settings.json` hook configuration implements a three-layer defense-in-depth pattern for AI agent code quality, each layer serving a distinct purpose:

**Layer 1 — PreToolUse (damage prevention):** Runs BEFORE the tool executes. Three hooks gate file operations:
- `file-guard` (claudekit) — general file protection
- `protected-files.sh` — blocks edits to package-lock.json, .env*, replit.* (exit code 2 = hard block)
- `file-freshness.sh` — warns if file was modified <2 seconds ago (concurrent edit detection)

These hooks can PREVENT the tool from executing entirely (exit 2), making them the only hard-block layer. The freshness check is notable — it detects concurrent editing by teammates or external processes using file mtime comparison, acting as a lightweight optimistic concurrency control.

**Layer 2 — PostToolUse (regression catching):** Runs AFTER every Write/Edit/MultiEdit. Nine hooks fire on every file mutation:
- `lint-changed` — ESLint on changed files
- `typecheck-changed` — tsc on changed files
- `check-any-changed` — general checks
- `test-changed` — runs tests for changed files
- `check-comment-replacement` — detects code replaced with comments
- `check-unused-parameters` — catches dead parameter introductions
- `codebase-map-update` — keeps structural map fresh
- `context-budget.sh` — monitors transcript size (warns at 500KB, critical at 1MB)
- `read-tsc-errors.sh` — reads tsc --watch output from tmux session

The `context-budget.sh` hook is particularly interesting — it runs on EVERY tool use (matcher: `*`) and monitors the JSONL transcript file size as a proxy for context window consumption. This provides early warning before the agent hits context limits and loses state.

**Layer 3 — Stop (handoff quality gate):** Runs when the agent attempts to stop responding. Six hooks enforce final quality:
- `blocking-typecheck.sh` — full `npm run check` with hard block on failure
- `lint-project` — full project lint
- `test-project` — full test suite
- `check-todos` — ensures no abandoned tasks
- `self-review` — agent reviews its own work
- `create-checkpoint` — snapshots state
- `session-capture.sh` — saves session metadata to knowledge vault

The Stop layer is the only point where typecheck is BLOCKING (exit 2 prevents stop). This means the agent can continue working with warnings during PostToolUse, but cannot declare itself done while TypeScript errors exist.

**The design insight:** Each layer has a different cost/benefit tradeoff. PreToolUse hooks are cheap (no tool execution wasted) but can only check intent. PostToolUse hooks are per-edit (frequent but scoped). Stop hooks are expensive (full project scan) but run once. This mirrors how human code review works: quick checks on every save, thorough checks before merge.

Areas: [[agent-workflows]], [[conventions]]
