# Skill-Tree Sync (`scripts/sync-skills.sh`)

The repo carries two skill trees that drift: `.claude/skills/` (Claude Code) and `.agents/skills/`
(cross-agent). The 2026-06-11 skill audit (Cluster 4, "Mirror drift map") found 15 of 27 shared
dirs drifted under manual upkeep. This script makes drift visible and fixes the fixable class.

## Class model

| Class | Skills | Canonical side | Sync policy |
|---|---|---|---|
| IDENTICAL | `claude-*` meta family (8) | either (must be byte-identical) | `--fix` syncs newer → older; symlinked `.claude` entries are identical by construction |
| ARSCONTEXTA | connect, extract, graph, learn, next, pipeline, ralph, refactor, remember, rethink, revisit, seed, validate, verify, plus renames `stats→ars-stats`, `tasks→ars-tasks` | `.claude` | report-only — `.agents` copies are domain-vocabulary transforms driven by `ops/derivation-manifest.md`; regenerate by hand when flagged STALE |
| BREADBOARD | breadboard-lab | `.claude` (full) | report-only — `.agents` is a hand-maintained condensed variant with Codex extras; never auto-overwrite |
| EXEMPT | claude-code-maestro, scribe-mastery, universal-skill-builder | `.agents` only | no mirror expected |

## Lint pass (both trees)

Flags: skill dirs with no `SKILL.md`, literal `[Domain]` placeholders in frontmatter,
frontmatter `name:` ≠ dir name (the documented rename map is allowed), and dangling symlinks.

## Running

```bash
scripts/sync-skills.sh --check   # default; exit 1 if any problem found
scripts/sync-skills.sh --fix     # syncs IDENTICAL-class drift only; everything else stays report-only
```

## Cadence

Run `--check` after any edit under `.claude/skills/**` or `.agents/skills/**`, and weekly
(e.g. a cron entry alongside the auto-push job, or a PostToolUse hook on skill paths).
Treat a STALE arscontexta finding as a task: re-apply the vocabulary transform by hand —
it is craft work, not a bulk script job.
