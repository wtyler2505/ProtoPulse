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

## Next session — start here

### Priority 1: Complete T1 residual (1 tool call)

Write `.claude/skills/vault-gap/assets/gap-stub.schema.json` — JSON Schema for inbox-gap-stub.md frontmatter. Template + scoring rubric reference it, so the asset closes the loop for `/vault-validate` (T2) to consume later.

### Priority 2: T2 — Frontmatter schema + validator + migration (3 days)

This unblocks T3, T5, T6, T11, T13, T14, T15. Plan in system-upgrades doc. Scope:
- Define upgraded frontmatter schema (audience, claims, provenance stub, related, supersedes, reviewed, used-by-surface, description ≤140).
- Write `/vault-validate` skill that fails CI when a note is missing required fields.
- Write migration script across 683 notes (auto-fill where possible, flag rest).
- Ship as `.claude/skills/vault-validate/` with full directory structure.

### Priority 3: T5 — /vault-suggest-for-plan (2 days)

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
