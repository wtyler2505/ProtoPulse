# Slash Command Audit — 2026-06-12

Companion to `docs/audits/2026-06-11-skill-audit.md`. Scope: every slash command relevant to ProtoPulse — 23 project core commands (`.claude/commands/`), 14 Codex-lane `/pp-*` commands, 49 global commands (`~/.claude/commands/`), `team/`, and `.gemini/commands/claude/assistant.toml`. Five parallel auditors verified every referenced path, tool, skill, and spec against the repo/environment as of today (post skill-audit landing).

## Executive Summary — Systemic Defects

1. **The hook-* family teaches a wrong hooks spec.** `hook-create`, `hook-patterns`, `hook-debug`, `hook-wizard` all teach `CLAUDE_TOOL_NAME`/`CLAUDE_TOOL_INPUT` env vars (hooks receive stdin JSON), string-array hook config (must be `[{type:"command",command}]` objects), and a nonexistent `PermissionRequest` event. Anyone following them installs broken hooks.
2. **Dead MCP/tool references.** FileScopeMCP cited in 6+ files but not a connected server; `mcp__perplexity__*` in 3; stale clear-thought tool name `sequentialthinking` (now `clear_thought`) in 3; renamed Context7 tool `get-library-docs` (now `query-docs`) in 2.
3. **Stock claudekit commands never localized.** The project `spec/*` + `git/*` sets assume STM (not installed — ~70% dead weight in spec/decompose+execute), generic commit conventions (no Co-Authored-By, no awareness of auto-commit/auto-push hooks), and predate the packages/ engine and plan-template rules.
4. **`/code-review` three-way shadowing.** Project command shadows global command shadows the built-in `/code-review` (incl. ultra cloud review). Resolution: delete global, rename project → `/multi-review`.
5. **Alias rot in pp-*.** 8 of 14 pp-commands write to retired notebook names (pp-journal, pp-codebase, pp-backlog…) without noting they're compatibility aliases to `pp-core`/`pp-hardware`; 3 default args to aliases.
6. **One-shot/foreign commands lingering.** agents-md/* (migration already done; re-running clobbers curated AGENTS.md), perf-check (built for Multi-Controller-App), windsurf-next (2025 environment snapshot), sp-* plugin aliases, test-simple scaffolding.
7. **Missing-skill invocations.** memory.md (`memory-mastery`), ghostty.md (`ghostty-mastery`), screenshot-catalog (`ui-screenshot-cataloger`), skill-test (`testing-skills-with-subagents`), skill-create/edit/share/troubleshoot (dead `skill-creator` tree) — they "work" only because Claude improvises.
8. **/initref Step 7.5 assumes it can write settings.json.** The permission classifier denies persistent hook registration (verified twice 2026-06-12); the command should present the merge snippet for user approval and report `HOOK: pending user approval`.

Clean axes: zero references to the 12 skills retired on 2026-06-11; zero BrainGrid; zero stale `claude-3-*` model names; pp-* hard-rule compliance (studio_status gating, archiving, login checks) is good.

## Verdict Index

### Project core (.claude/commands/) — 23 files
| Command | Verdict | Finding |
|---|---|---|
| agents-md/cli | RETIRE | Dumps --help into CLAUDE.md; conflicts with concise-AGENTS.md rule |
| agents-md/init | RETIRE | One-shot already done; re-run risks clobbering curated AGENTS.md |
| agents-md/migration | RETIRE | Migration complete; destructive mv/ln pure risk |
| checkpoint/create | KEEP | Clever stash-create/store pattern; harmless overlap with rewind |
| checkpoint/list | KEEP | Pairs with create/restore |
| checkpoint/restore | KEEP | Safe (backup stash, apply-not-pop) |
| config/bash-timeout | FIX | Suggest 60-min default per house rule (no env actually set) |
| dev/cleanup | FIX-NOW | Escaped `\!` kills the context command — runs blind |
| gh/repo-init | RETIRE | Creates repos inside ProtoPulse cwd; belongs user-level if anywhere |
| git/checkout | RETIRE | Branch-prefix wrapper; workflow is worktrees+main |
| git/commit | FIX | Localize: Co-Authored-By footer, auto-commit-hook awareness |
| git/ignore-init | RETIRE | One-shot done; generic patterns |
| git/push | RETIRE | Duplicates/fights auto-push-protopulse.sh design |
| git/status | RETIRE | Thin `git status` narration |
| spec/create | FIX-NOW | Dead tool `mcp__context7__get-library-docs` → `query-docs`; strip install-offer; MVP language |
| spec/decompose | FIX | ~70% STM dead weight (not installed); cite plan template |
| spec/execute | FIX | STM dead weight; defer parallel impl to /agent-teams rule |
| spec/validate | KEEP | Self-contained; advisory YAGNI tone acceptable |
| code-review | MERGE | Rename → `/multi-review`; unshadow built-in /code-review |
| create-command | MERGE | Into slash-commands-mastery skill coverage; thin pointer ok |
| create-subagent | KEEP | Solid claudekit domain-expert methodology |
| research | MERGE/FIX | 3 research entry points; stale GPT-4/Claude-3/2024 examples |
| validate-and-fix | FIX | Hardcode `npm run check`/`npm test`/eslint; cite fix-all rule |

### pp-* (Codex lane — recommendations only) — 14 files
KEEP: pp-archive, pp-query, pp-status (pp-status is the model). FIX-NOW: **pp-research** (passes alias to `--notebook-id`; claims sources land in pp-research — false, pp-core), **pp-sync** (iterates dead "Tier-1 alias" taxonomy; verify `nlm source stale` exists). FIX (alias hygiene + defaults): pp-bench, pp-capture, pp-innovate, pp-iter, pp-mindmap, pp-podcast, pp-promote, pp-recap, pp-report.

**Codex handoff:** (1) add one Notes line per command flagging alias→hub resolution (`nlm alias get` before write); (2) change default args pp-codebase/pp-journal → pp-core (mindmap, podcast, report); (3) fix pp-research's `--notebook-id` alias bug + false landing claim; (4) pp-sync → iterate the two hubs; (5) copy pp-podcast's `nlm alias get` validation into mindmap/report; explicit archive-hook call in pp-report; add AskUserQuestion to allowed-tools where used (iter, recap, research, sync); (6) scrub plan-era jargon ("Phase 7/10/11", "per plan §5", "spans tiers"). Extends 2026-06-11 skill-audit §pp-knowledge/pp-nlm-operator.

### Global analysis family (~/.claude/commands/) — 15 files
| Command | Verdict | Finding |
|---|---|---|
| audit-code | FIX→absorb | FileScopeMCP dead; madge/depcheck missing; invalid ast-grep TODO pattern; auto-fix violates read-only audit |
| audit-report | MERGE | Pure templates → fold into deep-audit |
| audit-security | FIX | snyk missing; Phase 3 duplicates deep-audit |
| audit-ui | FIX | Calls chrome-devtools tools under claude-in-chrome names |
| deep-audit | FIX | Keep as sole orchestrator; FileScopeMCP dead; add 6-agent-cap + run_in_background guidance |
| health-check | KEEP | Clean; correct handoff to /reconcile |
| project-health-check | FIX | FileScopeMCP in allowed-tools; rename → /project-metrics (name collision) |
| perf-check | RETIRE | Foreign project (Multi-Controller-App); skill path missing |
| drift-check | KEEP | Correct detect half of detect→fix pair |
| reconcile | KEEP | Exemplary dry-run-by-default safety |
| product-analysis | FIX | Trim unavailable servers from allowed-tools |
| project_reflection | FIX | `sequentialthinking`→`clear_thought`; FileScopeMCP; underscore name |
| directory-deep-dive | FIX | Same two stale refs; otherwise valuable |
| decision-tree-explorer | RETIRE | Prose pep-talk; promises Monte Carlo it can't run |
| screenshot-catalog | FIX-NOW | Loads deleted `ui-screenshot-cataloger` skill; body self-contained — strip the load |

End-state: deep-audit (orchestrator, absorbs audit-code+audit-report) / audit-ui / audit-security / health-check / drift-check / reconcile / product-analysis / project_reflection / directory-deep-dive / screenshot-catalog.

### Global meta-tooling — 19 files
| Command | Verdict | Finding |
|---|---|---|
| cmd-auditor | FIX | `sequentialthinking`→`clear_thought`; legacy Task in allowed-tools |
| cmd-create | KEEP | Add "skills ARE slash commands" note |
| cmd-list | KEEP | Should also list skill-based commands |
| cmd-patterns | KEEP | Thin launcher, paths valid |
| cmd-validate | FIX | Omits `model` frontmatter; arbitrary 100-char rule; skills=commands unaware |
| cmd-wizard | MERGE | → `/cmd-create --wizard` |
| hook-create | FIX-NOW | Teaches wrong spec (env vars, string-array config, PermissionRequest) |
| hook-debug | FIX-NOW | Asserts wrong config format; env-var test harness invalid (stdin JSON) |
| hook-patterns | FIX-NOW | Every embedded pattern broken (same spec errors) |
| hook-status | FIX | Stop CAN block; drop PermissionRequest; add Pre/PostCompact |
| hook-wizard | MERGE | → `/hook-create --wizard` after spec rebuild |
| skill-create | RETIRE | Dead skill-creator tree; superseded by skill-creator-v2 + claude-skills |
| skill-edit | RETIRE | Same dead refs; claude-skills covers it |
| skill-garden | FIX | INDEX.md coverage check targets phantom file |
| skill-share | RETIRE | ~/.claude/skills is not a git repo — premise broken |
| skill-sync | RETIRE | Same broken premise; name-collides with project scripts/sync-skills.sh |
| skill-test | FIX | Repoint dead `testing-skills-with-subagents` → skill-creator-v2 eval mode |
| skill-troubleshoot | FIX | 18/19 referenced troubleshooting files don't exist; flowchart sound |
| interactive-builder | KEEP | Unique whole-assistant generator; fix dead skill mention |

### Global workflow/misc + Gemini — 17 files
| Command | Verdict | Finding |
|---|---|---|
| sp-brainstorm / sp-execute-plan / sp-write-plan | RETIRE ×3 | Aliases of superpowers plugin surfaces that auto-load |
| sp-superinit | RETIRE | Deprecation tombstone since 2026-05-25 |
| sp-rnd | FIX | Wrong skill path; dead perplexity; `get-library-docs`→`query-docs`; misleading prefix |
| initref | FIX | Add Step 7.5 permission-denial path: present merge snippet, report `HOOK: pending user approval` |
| code-review (global) | RETIRE | Generic checklist; FileScopeMCP; doubly shadowed |
| memory | FIX | Invokes nonexistent `memory-mastery`; rewrite on direct Memory-MCP calls + note native auto-memory |
| focus | KEEP | Dead perplexity in allowed-tools (harmless) |
| fu / fistbump | KEEP ×2 | Harmless one-liners |
| ghostty | FIX | Nonexistent `ghostty-mastery`; hardcoded GPU model |
| windsurf-next | RETIRE | Entire 2025 environment snapshot stale; Windsurf not in workflow |
| test-simple | RETIRE | "Hello! This is a test command." |
| team/architecture-review | FIX | Never spawns a team; rewrite to drive agent-teams skill |
| .gemini/commands/claude/assistant.toml | KEEP | Valid TOML; paths exist; no retired-protocol refs |

## Execution Roadmap

- **Wave 1 — Broken today (FIX-NOW + deletions).** Fix dev/cleanup `\!`, spec/create Context7 tool name, screenshot-catalog skill-load strip, hook-create/debug/patterns spec rebuild. Delete the 20 RETIREs (project: agents-md×3, gh/repo-init, git/{checkout,ignore-init,push,status}; global: perf-check, decision-tree-explorer, skill-{create,edit,share,sync}, sp-{brainstorm,execute-plan,write-plan,superinit}, code-review(global), windsurf-next, test-simple).
- **Wave 2 — Correctness fixes.** Dead-MCP sweep (FileScopeMCP, perplexity, sequentialthinking, get-library-docs); localize git/commit + validate-and-fix + config/bash-timeout; STM dead-weight cut in spec/decompose+execute; audit-ui tool-surface fix; hook-status event table; initref Step 7.5; memory/ghostty/skill-test/skill-troubleshoot/skill-garden repoints; team/architecture-review rewrite.
- **Wave 3 — Merges/renames.** code-review→multi-review (project); audit-code+audit-report→deep-audit; cmd-wizard→cmd-create; hook-wizard→hook-create; project-health-check→project-metrics; research/create-command thinning.
- **Wave 4 — Codex lane.** Hand pp-* recommendations above to Codex (do not execute from Claude).

Executed: Waves 1–3 same day (see git log); Wave 4 documented for Codex.
