---
summary: SessionStart launches tsc --watch in a detached tmux session that persists across tool calls, giving PostToolUse hooks instant type errors without re-invoking the compiler
category: architecture
areas:
  - agent-workflows
  - conventions
---

# tsc --watch in tmux provides near-instant type feedback by decoupling the compiler lifecycle from individual tool invocations

The hook system uses a two-part pattern for TypeScript checking that avoids the ~33-44 second tsc cold-start penalty on every edit:

**SessionStart hook (`start-tsc-watch.sh`):** Launches `tsc --noEmit --watch --pretty false` in a detached tmux session named `tsc-watch`. Output is tee'd to `.claude/.tsc-errors.log`. The hook is idempotent — it checks `tmux has-session -t tsc-watch` first and skips if already running.

**PostToolUse hook (`read-tsc-errors.sh`):** After every file edit, reads the last 20 lines of `.tsc-errors.log`, filters out noise ("Starting compilation", "Found 0 errors", "File change detected"), and surfaces any remaining errors to the agent.

**Why this matters:** The watch compiler maintains an in-memory program graph and only re-checks changed files, providing sub-second feedback. Without this pattern, the PostToolUse `typecheck-changed` hook (claudekit) would need to invoke a cold tsc on every edit — at 33-44 seconds per invocation on this codebase, that would make the agent unusable. The claudekit `typecheck-changed` hook still runs as a fallback, but the watch output arrives faster.

**The tmux dependency is load-bearing.** The `check-hook-deps.sh` SessionStart hook explicitly verifies tmux is installed, warning that "tsc-watch hook and TUI skills will not work" without it. The claudekit config (`.claudekit/config.json`) extends the timeout for typecheck hooks to 120 seconds (up from 30s default) as a safety net for when the watch session isn't available.

This is an instance of the broader pattern where long-running background processes (managed via tmux) complement per-invocation hooks to provide responsive feedback loops.

Areas: [[agent-workflows]], [[conventions]]
