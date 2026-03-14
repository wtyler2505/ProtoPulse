---
summary: The hook system implements three distinct enforcement layers — PreToolUse blocks dangerous actions before they happen, PostToolUse catches regressions immediately after each edit, and Stop gates quality before the agent can hand off
category: architecture
areas:
  - agent-workflows
  - conventions
---

# Hook architecture uses layered gates where PreToolUse prevents damage, PostToolUse catches regressions, and Stop enforces quality before handoff

The `.claude/settings.json` hook configuration implements a three-layer defense-in-depth pattern for AI agent code quality, each layer serving a distinct purpose. The [[sessionstart-dependency-verification-creates-a-self-healing-bootstrap-that-surfaces-missing-tools-before-they-cause-cryptic-hook-failures|SessionStart dependency check]] acts as a precondition layer — verifying that the tools these hooks depend on (claudekit, tmux, jq) are present before any of the three gate layers fire:

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

The `context-budget.sh` hook is particularly interesting — it runs on EVERY tool use (matcher: `*`) and monitors the JSONL transcript file size as a proxy for context window consumption. This provides early warning before the agent hits context limits and loses state. The `read-tsc-errors.sh` hook complements the [[tsc-watch-in-tmux-provides-near-instant-type-feedback-by-decoupling-the-compiler-lifecycle-from-individual-tool-invocations|persistent tsc --watch session]] by reading its output after every edit.

**Layer 3 — Stop (handoff quality gate):** Runs when the agent attempts to stop responding. Six hooks enforce final quality:
- `blocking-typecheck.sh` — full `npm run check` with hard block on failure
- `lint-project` — full project lint
- `test-project` — full test suite
- `check-todos` — ensures no abandoned tasks
- `self-review` — agent reviews its own work
- `create-checkpoint` — snapshots state
- `session-capture.sh` — saves session metadata to knowledge vault (gated by the [[arscontexta-vault-marker-file-acts-as-a-feature-flag-that-conditionally-activates-knowledge-system-hooks-without-code-changes|.arscontexta vault marker]])

The Stop layer is the only point where typecheck is BLOCKING (exit 2 prevents stop). This means the agent can continue working with warnings during PostToolUse, but cannot declare itself done while TypeScript errors exist.

**The design insight:** Each layer has a different cost/benefit tradeoff. PreToolUse hooks are cheap (no tool execution wasted) but can only check intent. PostToolUse hooks are per-edit (frequent but scoped). Stop hooks are expensive (full project scan) but run once. This mirrors how human code review works: quick checks on every save, thorough checks before merge. The Stop layer's `blocking-typecheck.sh` serves the same gatekeeper function as the [[ci-pipeline-gates-build-behind-typecheck-but-runs-lint-and-tests-independently-optimizing-for-fast-failure-on-the-cheapest-check|CI pipeline's typecheck gate]] — both prevent progression until type safety is confirmed. The [[agent-specifications-use-yaml-frontmatter-to-control-model-selection-tool-access-and-hook-suppression-creating-a-capability-profile-per-agent|agent YAML profiles]] can selectively disable expensive hooks via `disableHooks`, creating per-agent cost profiles within this layered system.

---

Related:
- [[tsc-watch-in-tmux-provides-near-instant-type-feedback-by-decoupling-the-compiler-lifecycle-from-individual-tool-invocations]] — PostToolUse's `read-tsc-errors.sh` reads from the persistent watch session this insight describes
- [[sessionstart-dependency-verification-creates-a-self-healing-bootstrap-that-surfaces-missing-tools-before-they-cause-cryptic-hook-failures]] — preflight layer that ensures hook dependencies exist before these gates fire
- [[arscontexta-vault-marker-file-acts-as-a-feature-flag-that-conditionally-activates-knowledge-system-hooks-without-code-changes]] — vault marker gates the `session-capture.sh` Stop hook
- [[agent-specifications-use-yaml-frontmatter-to-control-model-selection-tool-access-and-hook-suppression-creating-a-capability-profile-per-agent]] — `disableHooks` field selectively suppresses expensive layers for read-only agents
- [[ci-pipeline-gates-build-behind-typecheck-but-runs-lint-and-tests-independently-optimizing-for-fast-failure-on-the-cheapest-check]] — CI mirrors the Stop layer's typecheck gate in the deployment pipeline
- [[concurrent-tsc-runs-during-agent-teams-cause-oom-so-node-max-old-space-size-must-be-increased-when-four-or-more-teammates-compile-simultaneously]] — PostToolUse typecheck hooks multiplied by teammates cause OOM

Areas: [[agent-workflows]], [[conventions]]
