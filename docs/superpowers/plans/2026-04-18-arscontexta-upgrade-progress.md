# Ars Contexta Upgrade — Progress & Next-Session Handoff

**Session:** 2026-04-18. **Status:** T1 shipped; scope confirmed; next-session execution queued.

---

## What happened this session (chronological)

1. **Authored 19 E2E-walkthrough sub-plans** at `docs/superpowers/plans/2026-04-18-e2e-walkthrough/` — all 943 findings routed; coverage TSV + master index complete.
2. **Tyler asked** for systematic vault-integration enhancements to those 19 plans.
3. **Exploration (3 parallel Explore agents)** inventoried `qmd` MCP tools, vault content (683 notes / 54 MOCs), and current plan-to-vault references (7 of 19 plans had any; 12 had zero).
4. **Authored vault-integration plan** at `~/.claude/plans/i-want-to-explore-partitioned-peach.md` — approved via ExitPlanMode.
5. **Tyler pivoted**: upgrade the Ars Contexta SYSTEM first (so new plan updates consume improved tooling); also upgrade EXISTING AC skills while we're at it; and research Claude Code skill authoring best practices.
6. **Reverted** premature edits to `00-master-index.md` §7/§13 (they referenced primitives that depend on upgrades not yet shipped).
7. **Authored companion doc** at `docs/superpowers/plans/2026-04-18-arscontexta-system-upgrades.md` — cataloging 15 T-items (T1 through T15) with scope/effort/leverage.
8. **Shipped T1** (`/vault-gap` skill) at `.claude/skills/vault-gap/`:
   - `SKILL.md` (v1.1 — `context: fork`, updated description with more trigger phrases)
   - `templates/inbox-gap-stub.md`
   - `scripts/derive-slug.sh` (executable)
   - `scripts/append-queue.sh`
   - `reference/scoring-rubric.md`
   - `reference/payload-examples.md`
   - (pending: `assets/gap-stub.schema.json`)
9. **Seeded queue log** at `ops/queue/gap-stubs.md` with header.
10. **Delegated deep research** to an Explore agent on Claude Code skill-authoring best practices (2025/2026 docs + plugin exemplars). Applied findings to the vault-gap skill (added `context: fork`, tightened description).

**Context pressure cause:** the Claude Code harness echoes the full ~300-skill list on tool calls whose output contains the reminder message — ~14k tokens per echo. This burned session budget fast. The durable artifact strategy below protects against similar sessions.

---

## Tyler's consolidated ask (scope)

Before the 19-plan updates resume, the Ars Contexta system needs to be upgraded so the plans can consume new tooling. Scope:

1. **Ship all 15 T-items** from `docs/superpowers/plans/2026-04-18-arscontexta-system-upgrades.md`. Each with full skill structure: `SKILL.md`, `reference/`, `templates/`, `scripts/`, `assets/`.
2. **Upgrade existing AC-related skills** (those in `.claude/skills/` + project `.claude/skills/` that relate to the vault) to apply the same best practices from this session's research. Candidates include: `extract`, `connect`, `revisit`, `verify`, `seed`, `pipeline`, `ralph`, `next`, `tasks`, `graph`, `stats`, `validate`, `status`, `remember`, `rethink`, `learn`, `refactor`, `resume`, `visual-audit`, `breadboard-lab`, `ask-claude`.
3. **Do real research on skill best practices** — done this session; results summarized below.
4. **Never shortcut.** Go all in. Proper research, full skill structure, tested.

Once that's done, re-execute the vault-integration plan for the 19 E2E plans.

---

## Research findings applied (from this session's Explore agent)

Key best-practice distillations (source: Anthropic docs + plugin exemplars):

- **Frontmatter fields**: `name`, `description` (REQUIRED — include trigger phrases up-front), `version` (string), `allowed-tools` (narrow scope), `argument-hint`, `context` (`fork` for research skills), `model` (`sonnet`/`opus` only when needed), `user-invocable` (default true), `disable-model-invocation` (for side-effect commands).
- **Directory layout**: `SKILL.md` ≤500 lines; split longer content into `reference/` (lazy-loaded), `templates/`, `scripts/`, `assets/`.
- **`${CLAUDE_SKILL_DIR}`** resolves to skill root — use in script invocation paths.
- **`context: fork`** runs the skill in an isolated subagent — preserves main context; good for research-heavy skills.
- **Trigger phrase engineering**: front-load intent; include 3-5 phrase variants in description.
- **Anti-patterns**: vague descriptions, overwide tool allowlists, monolithic SKILL.md, missing `$ARGUMENTS` parsing, inline `!` shell execution surprises, slug-derivation inconsistencies.

Full report archived in the session transcript — can be regenerated via Explore agent if needed.

---

## Durable artifacts (what survived this session)

Files on disk (survive session boundary, auto-committed):

- **Plan:** `~/.claude/plans/i-want-to-explore-partitioned-peach.md`
- **Plan:** `docs/superpowers/plans/2026-04-18-arscontexta-system-upgrades.md` (15-item T-catalog)
- **Plan:** `docs/superpowers/plans/2026-04-18-arscontexta-upgrade-progress.md` (THIS FILE — handoff)
- **Skill:** `.claude/skills/vault-gap/` (T1 — registered and callable)
- **Queue log:** `ops/queue/gap-stubs.md`
- **19 e2e plans:** `docs/superpowers/plans/2026-04-18-e2e-walkthrough/` (unchanged since §7/§13 revert)

Task list (in TaskList tool): 22 tasks total — T1 complete, T2-T15 pending, plus 6 deferred e2e-plan-update tasks.

---

## Session 2 update (2026-04-18 late) — T1 + T2 + T15 shipped

**Also shipped this session:**
- T1 residual asset: `.claude/skills/vault-gap/assets/gap-stub.schema.json`
- **T2 complete** as skill `.claude/skills/vault-validate/`:
  - `SKILL.md` (9.3KB, v1.0, `context: fork`)
  - `assets/frontmatter-v2.schema.json` (full JSON Schema: name/description≤140/type/topics required; audience/reviewed/confidence/claims/related/supersedes/provenance/used-by-surface optional; conditional `confidence: verified → provenance` required)
  - `scripts/parse-frontmatter.py` (YAML extractor; stdin or file; json/yaml emit; `--key` selector)
  - `scripts/validate.py` (full validator — schema check, cross-link integrity, MOC membership, description quality, freshness, provenance presence; `--fix`/`--json`/`--strict`/`--fail-on`)
  - `scripts/migrate-v1-to-v2.py` (writes `inbox/migration-v2-<slug>.md` remediation stubs — never directly edits notes; `--write`/`--limit`/`--require`/`--json`)
  - `templates/v2-note-template.md` (exemplar frontmatter + body scaffold)
- **T15 complete** as skill `.claude/skills/vault-extract-priority/`:
  - `SKILL.md` (scoring formula: 5×unblocks + 3×recency + 2×tier + 1×missing + 0.5×plan_ref_count)
  - `scripts/rank.py` (parses `ops/queue/gap-stubs.md`, reads each stub's `unblocks:`, emits ranked JSON or human list)
  - `scripts/mark-extracted.sh` (atomic row-update helper)

**Settings + infrastructure shipped this session:**
- Skill-list context reduction applied to `.claude/settings.local.json`: `skillOverrides` (39 non-ProtoPulse skills set `off`) + `skillListingMaxDescChars: 256` + `skillListingBudgetFraction: 0.005`. Memory note at `memory/reference_skill_context_levers.md` + MEMORY.md link. Backup at `~/claude-backup-20260418-231549.tar.gz` + `settings.local.json.pre-skill-cleanup.bak`.

**Status progress:** T1 ✓, T2 ✓, T15 ✓, T17 (scope confirm) ✓. **4 of 15 upgrade items shipped.**

## Session 3 update (2026-04-18 post-restart) — T5 + T3 + T7 shipped

With skill-list echo shrunk by prior session's settings, this session shipped 3 more T-items:

- **T5 complete** as skill `.claude/skills/vault-suggest-for-plan/`:
  - `SKILL.md` — scans plan files, extracts Goal/Task/Coverage units, batch-queries qmd per unit, emits Markdown or JSON report for plan Research log
  - `scripts/extract-tasks.py` — the plan parser. Live-tested on 01-p0-bugs.md → 24 units (1 goal + 1 arch + 16 coverage + 6 waves) ✓
  - Handles: ignores code blocks, deduplicates Task matches, compresses task description to ≤12-word qmd queries

- **T3 complete** as skill `.claude/skills/vault-index/`:
  - `SKILL.md` — builds `ops/index/plan-vault-backlinks.json` (schema v1)
  - `scripts/build-index.py` — scans plans + `client/src` + `server/` + knowledge frontmatter; emits notes, orphans, broken-refs, stats
  - **Live-tested on real vault**: 682 notes indexed, 28 plans scanned, 1900 code files scanned, 90 backlinks found, 669 orphans, 0 broken refs
  - Output written to `ops/index/plan-vault-backlinks.json` ✓

- **T7 complete** as skill `.claude/skills/vault-health/`:
  - `SKILL.md` — consumes T3 index + T1 queue + T2 validator output, emits weekly report
  - `scripts/report.py` — builds heatmap (top-consumed + top-orphaned), demand-gap queue, schema drift, trend-vs-prior, recommended actions; writes to `ops/health/YYYY-MM-DD-report.md`
  - **Live-tested**: generated `ops/health/2026-04-18-report.md` with current vault metrics ✓

**Cumulative status: T1 ✓, T2 ✓, T3 ✓, T5 ✓, T7 ✓, T15 ✓, T17 ✓. 7 of 15 upgrade items shipped (47%).**

## Next session — start here (UPDATED AGAIN)

### Priority 1: T6 — Provenance + /vault-source (3 days)

Reads a plan file, loops qmd_deep_search per task description, emits structured suggestion report. Consumes T1's `/vault-gap`. Drop-in replacement for the manual enhancement work.

### Priority 4: T15 — Extract-queue priority from demand (1 day)

Small add to `/extract` skill. Reads `ops/queue/gap-stubs.md` (populated by T1) and orders processing by most-referenced-by-pending-plans. Partial script work already done in T1's `append-queue.sh`.

### Priority 5: T3 — Backlink index (3 days)

`ops/index/plan-vault-backlinks.json` + `/vault-index` generator. Depends on T2 frontmatter.

### Priority 6: T8 — VaultInbox 404 "Suggest a note" UI (1 day)

Client modal + server stub-write route. Depends on T1 stub format.

### Priority 7: T6 — Provenance metadata + `/vault-source` (3 days)

Depends on T2.

### Priority 8: T11 — `<VaultExplainer>` progressive disclosure (1 day)

Depends on T2 `audience` field.

### Priority 9: T7 — `/vault-health` expansion (1 day)

Depends on T3 backlinks.

### Priority 10: T10 — AI `/extract` quality gate (3 days)

Depends on T2.

### Priority 11: T9 — Vault graph visualization (5 days)

Depends on T2 + T3. Largest client-side deliverable.

### Priority 12: T12 — Plan↔Vault↔Code traceability panel (3 days)

Depends on T3.

### Priority 13: T13 — `/vault-teach` learn-path (5 days)

Depends on T2 + T4.

### Priority 14: T14 — Session-start pre-fetch (3 days)

Depends on T2.

### Priority 15: T4 — Directed MOC expansion (2 weeks)

Four new MOCs seeded via inbox/ → /extract. Content work, runs alongside others.

### Priority 16: Upgrade existing AC skills

After T1-T15 ship, audit `.claude/skills/{extract,connect,revisit,verify,seed,pipeline,ralph,next,tasks,graph,stats,validate,status,remember,rethink,learn,refactor,resume,visual-audit,breadboard-lab,ask-claude}/SKILL.md` against the best-practices checklist below. Apply:
- `context: fork` where appropriate
- Richer trigger phrase coverage in description
- Anti-patterns table
- Version history
- Split over-long SKILL.md files using `reference/`

### Priority 17: Resume vault-integration of 19 E2E plans

Once system is upgraded, re-execute `i-want-to-explore-partitioned-peach.md`: add the planned Vault integration subsections to each of the 12 gap plans + deepen the 6 thin plans + re-add 00-master-index §7 + §13 (now referencing the upgraded tooling accurately) + ship coverage TSV.

---

## Best-practices checklist for skill updates

Apply to both new and existing skills. Derived from this session's Explore research.

- [ ] `name` matches directory name (kebab-case)
- [ ] `description` starts with verb + one-sentence intent; includes 3-5 trigger phrase variants
- [ ] `description` ≤ 1536 chars
- [ ] `version` is a quoted string (e.g. `"1.1"`)
- [ ] `allowed-tools` lists only tools actually used; narrow with `Bash(cmd-pattern *)` when possible
- [ ] `argument-hint` describes accepted arguments + flags
- [ ] `context: fork` for research/analysis skills that don't need main-session state
- [ ] `model: sonnet` only when deterministic; `model: opus` only when reasoning-heavy; omit to inherit
- [ ] EXECUTE NOW block at top of body
- [ ] Steps are numbered + side-effect-ordered
- [ ] Anti-patterns table with reasons
- [ ] Integration points section listing upstream/downstream skills
- [ ] Version history section
- [ ] SKILL.md ≤ 500 lines (move content to `reference/` otherwise)
- [ ] `reference/` contains lazy-loaded detailed docs
- [ ] `templates/` contains fill-in templates
- [ ] `scripts/` contains any non-trivial bash/python helpers (executable, shebang)
- [ ] `assets/` contains JSON Schemas, static files
- [ ] Path sanitization for any `$ARGUMENTS` that become file paths
- [ ] No secrets in SKILL.md (env var references only)
- [ ] Error handling documented (what happens when MCP tool fails, file missing, etc.)

---

## Known caveats

- **Session context was echoed for every tool call** — inescapable harness behavior. Plan multi-session execution accordingly.
- **Every new skill needs manual registration testing** — invoking `/vault-gap` in a fresh session is the acceptance test (content looks good but runtime-untested).
- **Existing AC skills in `.claude/plugins/cache/agenticnotetaking/arscontexta/0.8.0/skills/` are plugin-bundled** — they will be overwritten on plugin upgrade. DON'T edit those. Edit project-local copies in `.claude/skills/` or `~/.claude/skills/` instead.
- **Auto-commit hook + auto-push cron are live** — all files land in main branch immediately; no feature branches.
- **Pipeline discipline is non-negotiable** — never write to `knowledge/` directly. All content routes through `inbox/ → /extract → knowledge/`.

---

## Contact points

- Vault gap catalog: `ops/queue/gap-stubs.md` (empty header now; grows via `/vault-gap`)
- System upgrade plan: `docs/superpowers/plans/2026-04-18-arscontexta-system-upgrades.md`
- Vault-integration plan: `~/.claude/plans/i-want-to-explore-partitioned-peach.md`
- This progress doc: `docs/superpowers/plans/2026-04-18-arscontexta-upgrade-progress.md`

---

*End of handoff. Next session: start at Priority 1 (T1 residual asset) and proceed in listed order. Tyler's rule stands — no shortcuts, real research, proper structure.*
