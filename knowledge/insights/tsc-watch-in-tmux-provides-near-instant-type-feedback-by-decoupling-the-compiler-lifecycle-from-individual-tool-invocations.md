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

**The tmux dependency is load-bearing.** The [[sessionstart-dependency-verification-creates-a-self-healing-bootstrap-that-surfaces-missing-tools-before-they-cause-cryptic-hook-failures|`check-hook-deps.sh` SessionStart hook]] explicitly verifies tmux is installed, warning that "tsc-watch hook and TUI skills will not work" without it. The claudekit config (`.claudekit/config.json`) extends the timeout for typecheck hooks to 120 seconds (up from 30s default) as a safety net for when the watch session isn't available.

This is an instance of the broader pattern where long-running background processes (managed via tmux) complement per-invocation hooks to provide responsive feedback loops. The watch output is consumed by the [[hook-architecture-uses-layered-gates-where-pretooluse-prevents-damage-posttooluse-catches-regressions-and-stop-enforces-quality-before-handoff|PostToolUse `read-tsc-errors.sh` hook]], making this a cross-layer collaboration within the hook system.

When multiple [[agent-specifications-use-yaml-frontmatter-to-control-model-selection-tool-access-and-hook-suppression-creating-a-capability-profile-per-agent|agent teammates]] run simultaneously, their PostToolUse hooks all trigger tsc re-checks. A single shared watch session avoids the [[concurrent-tsc-runs-during-agent-teams-cause-oom-so-node-max-old-space-size-must-be-increased-when-four-or-more-teammates-compile-simultaneously|OOM issue from 4+ cold tsc invocations]] — the watch session amortizes the cost. The [[ci-pipeline-gates-build-behind-typecheck-but-runs-lint-and-tests-independently-optimizing-for-fast-failure-on-the-cheapest-check|CI pipeline]] runs a cold tsc (no watch) because CI jobs are ephemeral — the watch optimization only applies to long-lived dev sessions.

---

Related:
- [[hook-architecture-uses-layered-gates-where-pretooluse-prevents-damage-posttooluse-catches-regressions-and-stop-enforces-quality-before-handoff]] — the three-layer hook system whose PostToolUse layer reads this watch output
- [[sessionstart-dependency-verification-creates-a-self-healing-bootstrap-that-surfaces-missing-tools-before-they-cause-cryptic-hook-failures]] — verifies tmux exists at session start; without tmux, this watch pattern cannot function
- [[concurrent-tsc-runs-during-agent-teams-cause-oom-so-node-max-old-space-size-must-be-increased-when-four-or-more-teammates-compile-simultaneously]] — the shared watch session mitigates OOM from parallel cold starts
- [[ci-pipeline-gates-build-behind-typecheck-but-runs-lint-and-tests-independently-optimizing-for-fast-failure-on-the-cheapest-check]] — CI uses cold tsc; this watch pattern is the dev session optimization
- [[agent-specifications-use-yaml-frontmatter-to-control-model-selection-tool-access-and-hook-suppression-creating-a-capability-profile-per-agent]] — read-only agents disable typecheck hooks, bypassing watch consumption

Areas: [[agent-workflows]], [[conventions]]
