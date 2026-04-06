---
description: Of 26 configured hooks, only auto-commit-vault.sh runs asynchronously -- all others block the agent
type: claim
source: ".claude/settings.json"
confidence: proven
topics: ["[[dev-infrastructure]]"]
related_components: [".claude/settings.json", ".claude/hooks/auto-commit-vault.sh"]
---

# auto-commit-vault is the only async hook

The settings.json hook configuration marks exactly one hook as `"async": true` -- auto-commit-vault.sh, which commits knowledge vault changes after Write operations. The remaining 25 hooks all run as blocking operations, meaning Claude must wait for each to complete before proceeding.

This is mostly intentional: quality gates (typecheck, lint, test) must block to enforce standards. But informational hooks like context-budget.sh and read-tsc-errors.sh could safely run async since they only produce warnings and never block (exit 0 always). Making them async would reduce the perceived latency of the PostToolUse pipeline without sacrificing quality enforcement.

The auto-commit-vault hook uses `--no-verify` on git commit to avoid triggering git hooks that would further slow the async operation. It only fires on Write operations to vault directories (knowledge/, inbox/, self/, ops/, templates/, manual/).

---

Relevant Notes:
- [[nine-posttooluse-groups-fire-on-every-write]] -- the blocking pipeline these could join
- [[twenty-six-hooks-create-a-dense-quality-pipeline]] -- the full blocking/async split

Topics:
- [[dev-infrastructure]]
