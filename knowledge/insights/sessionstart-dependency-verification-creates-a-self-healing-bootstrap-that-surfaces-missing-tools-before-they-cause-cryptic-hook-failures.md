---
summary: The check-hook-deps.sh SessionStart hook verifies claudekit-hooks, node (18+), tmux, and jq are available at session start — surfacing actionable install commands rather than letting hooks fail silently later
category: architecture
areas:
  - agent-workflows
  - conventions
---

# SessionStart dependency verification creates a self-healing bootstrap that surfaces missing tools before they cause cryptic hook failures

The `check-hook-deps.sh` hook runs at SessionStart and checks four critical dependencies:

1. **claudekit-hooks** — Required by 7 PostToolUse hooks and 5 Stop hooks. Without it, lint-changed, typecheck-changed, test-changed, check-comment-replacement, check-unused-parameters, codebase-map-update, and codebase-map all silently no-op.
2. **node (18+)** — Checks version via regex extraction, warns if below 18.
3. **tmux** — Required by tsc-watch and TUI skills. Without it, the persistent tsc --watch session cannot start.
4. **jq** — Required by hooks that parse JSON tool input (protected-files.sh, file-freshness.sh use `jq -r '.file_path // empty'`).

**Why this pattern matters:** The hook system is layered — claudekit hooks depend on the claudekit-hooks CLI, which depends on Node.js. The tsc-watch hook depends on tmux. File-guarding hooks depend on jq. If any dependency is missing, the failure mode is silent: hooks exit 0 (success) when they cannot find their tools, which means the quality gates simply disappear without warning.

The bootstrap hook converts these silent failures into visible warnings at session start, with actionable install commands (e.g., `npm install -g claudekit`, `sudo apt install tmux`). It always exits 0 (never blocks session start) but reports a warning count so the agent knows the quality infrastructure is degraded.

**The dependency chain is deeper than it appears:**
- claudekit-hooks → node → npm (install chain)
- tsc-watch → tmux (runtime container)
- protected-files.sh → jq (JSON parsing)
- context-budget.sh → bc (arithmetic) — not checked but used for size calculations

This is the "preflight checklist" pattern applied to AI agent tooling: verify the runway before takeoff.

Areas: [[agent-workflows]], [[conventions]]
