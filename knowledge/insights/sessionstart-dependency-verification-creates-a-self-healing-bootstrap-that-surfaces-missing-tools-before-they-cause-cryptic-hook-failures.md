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

**Why this pattern matters:** The [[hook-architecture-uses-layered-gates-where-pretooluse-prevents-damage-posttooluse-catches-regressions-and-stop-enforces-quality-before-handoff|hook system is layered]] — claudekit hooks depend on the claudekit-hooks CLI, which depends on Node.js. The [[tsc-watch-in-tmux-provides-near-instant-type-feedback-by-decoupling-the-compiler-lifecycle-from-individual-tool-invocations|tsc-watch hook]] depends on tmux. File-guarding hooks depend on jq. If any dependency is missing, the failure mode is silent: hooks exit 0 (success) when they cannot find their tools, which means the quality gates simply disappear without warning.

The bootstrap hook converts these silent failures into visible warnings at session start, with actionable install commands (e.g., `npm install -g claudekit`, `sudo apt install tmux`). It always exits 0 (never blocks session start) but reports a warning count so the agent knows the quality infrastructure is degraded.

**The dependency chain is deeper than it appears:**
- claudekit-hooks → node → npm (install chain)
- tsc-watch → tmux (runtime container)
- protected-files.sh → jq (JSON parsing)
- context-budget.sh → bc (arithmetic) — not checked but used for size calculations

This is the "preflight checklist" pattern applied to AI agent tooling: verify the runway before takeoff. It mirrors the [[ci-pipeline-gates-build-behind-typecheck-but-runs-lint-and-tests-independently-optimizing-for-fast-failure-on-the-cheapest-check|CI pipeline's]] `npm ci` step — both verify infrastructure before running quality checks. The [[arscontexta-vault-marker-file-acts-as-a-feature-flag-that-conditionally-activates-knowledge-system-hooks-without-code-changes|vault marker check]] (`session-orient.sh`) runs as a sibling SessionStart hook and depends on jq being present (verified here).

The dependency check is especially critical for [[agent-specifications-use-yaml-frontmatter-to-control-model-selection-tool-access-and-hook-suppression-creating-a-capability-profile-per-agent|agent teammates]] — if tmux is missing and tsc-watch cannot start, all teammates fall back to cold tsc invocations, increasing the [[concurrent-tsc-runs-during-agent-teams-cause-oom-so-node-max-old-space-size-must-be-increased-when-four-or-more-teammates-compile-simultaneously|OOM risk from concurrent tsc runs]].

---

Related:
- [[hook-architecture-uses-layered-gates-where-pretooluse-prevents-damage-posttooluse-catches-regressions-and-stop-enforces-quality-before-handoff]] — the three-layer system whose dependencies this hook verifies
- [[tsc-watch-in-tmux-provides-near-instant-type-feedback-by-decoupling-the-compiler-lifecycle-from-individual-tool-invocations]] — depends on tmux, verified here
- [[arscontexta-vault-marker-file-acts-as-a-feature-flag-that-conditionally-activates-knowledge-system-hooks-without-code-changes]] — vault hooks need jq (verified here) for marker parsing
- [[arscontexta-skills-implement-a-knowledge-processing-pipeline-where-each-phase-runs-in-isolated-context-with-structured-handoff-blocks-for-state-transfer]] — skill pipeline depends on node and jq verified here
- [[agent-specifications-use-yaml-frontmatter-to-control-model-selection-tool-access-and-hook-suppression-creating-a-capability-profile-per-agent]] — agents inherit the verified environment; missing deps degrade all teammates
- [[concurrent-tsc-runs-during-agent-teams-cause-oom-so-node-max-old-space-size-must-be-increased-when-four-or-more-teammates-compile-simultaneously]] — if tmux missing, cold tsc fallback increases OOM risk
- [[ci-pipeline-gates-build-behind-typecheck-but-runs-lint-and-tests-independently-optimizing-for-fast-failure-on-the-cheapest-check]] — CI's `npm ci` is the deployment-pipeline analog of this preflight check

Areas: [[agent-workflows]], [[conventions]]
