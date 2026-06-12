# Skill Audit — Every Skill Used by ProtoPulse (2026-06-11)

> Commissioned by Tyler via `/directory-deep-dive | /claude-automation-recommender`.
> Method: five parallel read-only auditors, each deep-reading its cluster's SKILL.md + references and **verifying every claim against the live repo** (post-reset main `20cad8f6`, the engine-redesign line). 72 skills audited: 18 Ars Contexta core + 16 vault/audit + 13 claude-meta + 4 domain + 7 `.agents`-unique + 14 globals.
> This is a findings/recommendations document (read-only audit). Nothing was modified.

## Executive Summary — 8 systemic defects

1. **Schema schism (highest stakes).** Three incompatible frontmatter schemas across five validators: the live 743-note vault (wiki-link topics, `domain-knowledge`/`proven`/`high`), the registered `validate-note.sh` hook (its own enum set), and the v2 schema (`claim|pattern|reference|moc|meta`) that `extract`, `vault-validate`, `vault-quality-gate`, `vault-source`, `vault-audience`, `vault-teach` were built on. The v2 migration ran on only ~15 notes. **`verify` FAILs the exact output `extract` mandates.** Every health/coverage metric is noise until one schema wins.
2. **qmd layer broken cluster-wide.** Wrong MCP tool names (`mcp__qmd__search` → actual `mcp__qmd__qmd_search`) in allowed-tools and bodies of extract/verify/connect/revisit/seed; nonexistent `qmd vsearch` subcommand; `{vocabulary.notes_collection}` placeholder never defined (actual: `protopulse-vault`). Semantic dedup/retrieval silently degrades to grep everywhere.
3. **Dead wiring & phantom dependencies.** `/enrich`, `/archive-batch`, `/health` referenced by 6+ skills, exist nowhere. `ops/queue/queue.json` has `phase_order: null` — 100 tasks stalled since April (26 of them enrichment tasks that cannot be processed). vault-prefetch's SessionStart hook exists but was never registered; vault-health's cron never installed; vault-index stale 8 weeks; vault-inbox's server route never built; vault-extract-priority is invoked by nothing.
4. **Engine-redesign blind spot.** `packages/` (@protopulse/* monorepo) is invisible to ship/status/resume (no `check:packages`/`test:packages`), vault-index/vault-prefetch scan roots, breadboard-lab (no legacy-vs-engine jurisdiction note), and pp-knowledge routing. The repo's defining event is unknown to every audited skill.
5. **Staleness freeze.** breadboard-lab's file map describes pre-extraction code (BreadboardView 2,284→699 lines; three new directories unmapped). claude-meta cluster frozen at late-2025 (retired model IDs in copy-paste snippets, pre-agent-teams hook taxonomy, obsolete skill frontmatter spec). Hardcoded vault stats (682 notes) wrong in 5+ skills.
6. **Mirror drift, .claude ↔ .agents.** 15 of 27 shared skills drifted (mostly a mechanical vocabulary-transform class); `ars-stats`/`ars-tasks` are silently renamed mirrors; one tracked symlink is dangling (`claude-automation-recommender`); two `.agents` scaffolds are junk (`screenshot-capture-super` = empty dir, `gemini-cli-maestro` = literal `[Domain]` placeholders).
7. **Token bloat, zero progressive disclosure.** 0/18 Ars Contexta core skills have references/; 8 exceed 500 lines (extract 1208, connect 746, rethink 657, revisit 656, ralph 602, graph 567, remember 534, verify 533); claude-in-notebooklm is 1,414 lines with no split; identical 50-70-line blocks pasted across 2-6 skills.
8. **Retired-protocol contradiction.** `claude-codex-routing` is a legacy alias (successor: `~/.agents/skills/codex-gemini-routing` — team = Tyler+Codex+Gemini), but the dead v2.0.0 body still sits below the alias and global CLAUDE.md still quotes it as live. (ProtoPulse MEMORY.md was corrected during this audit.)

## Unified Top-10 Priorities (cross-cluster, ranked)

1. **Reconcile the vault schema** — one enum source (e.g. `_schema` in `ops/config.yaml`) consumed by validate-note.sh, a merged vault-validate+quality-gate engine, and core validate/verify; then run `remediate-v2-frontmatter.py` (dry-run first) through the pipeline.
2. **Repair the qmd layer centrally** — define `notes_collection: protopulse-vault` in `ops/derivation-manifest.md`; sed-fix `mcp__qmd__(search|vector_search|deep_search|status)` → `mcp__qmd__qmd_$1` and `qmd vsearch` → `qmd query` across extract/verify/connect/revisit/seed.
3. **Unblock the 100-task queue** — ralph: handle `phase_order: null` with documented defaults; create `/enrich` (the 26 task files contain its spec) or inline its prompt; fix seed's claim-number collision (scan `ops/queue/*-NNN.md` + queue.json).
4. **Rewrite breadboard-lab's architecture map** for the post-extraction layout + add a Legacy-vs-Engine jurisdiction section (this skill is the most-used domain skill; its navigation data is wrong).
5. **Fix copy-paste-breaking claude-meta bugs** — delete/repoint the dangling `claude-automation-recommender` symlink; retired model IDs in claude-cookbooks/claude-api; `workingDirectory`→`cwd` in claude-agent-sdk (verify via Context7); update the two skill-authoring skills to the current frontmatter spec (`disable-model-invocation`, `user-invocable`, `context: fork`).
6. **Build `scripts/sync-skills.sh`** (adapt global skill-sync-workflow): rsync the identical class, manifest vocabulary-transform for arscontexta skills (+ stats→ars-stats rename map), regenerate breadboard-lab's condensed `.agents` variant, lint for empty dirs / `[Domain]` placeholders / name-dir mismatches; run via hook or cron.
7. **Make dead wiring real or delete the claims** — register vault-prefetch's hook AND give its cache a consumer, or retire it; install vault-health's cron or cut the section; schedule vault-index rebuilds; wire or retire vault-extract-priority.
8. **Retire the dead weight** — ask-claude, "claude code guide" (spec-violating name, collides with built-in agent), claude-cookbooks (→ one pointer line), claude-devfleet (infra absent), screenshot-capture-super (empty), gemini-cli-maestro (finish or delete), vault-inbox (merge into vault-gap `--source user`).
9. **Engine-awareness pass** — add `packages/**`+`docs/plans/**` to vault-index/vault-prefetch scan roots; `check:packages`/`test:packages` to ship/status; packages/ to resume's recent-files scan; derive visual-audit + fix-audit-failures view lists from the `ViewMode` union (36 views, not 10).
10. **Progressive-disclosure restructure** of the 8 oversized core skills — shared `references/{extraction-doctrine,handoff-spec,dual-discovery,methodology-loop,connection-patterns}.md`; cuts 3,000+ lines of always-loaded prompt and creates single sources of truth.

---

# Cluster 1 — Global skills used by ProtoPulse (14 skills, `~/.claude/skills/`)

### agent-teams (209 lines, refs: yes)
- Purpose: orchestrate multi-instance Claude teams. Description: excellent.
- Stale: "Experimental — enable `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`" — teams are now first-class (Agent tool natively exposes `team_name`, SendMessage); Limitations section likely obsolete. Contains a "th3-syst3m" forensic example from another machine's project.
- Recs: 1) Re-verify Prerequisites/Limitations against current docs. 2) Replace the foreign example. 3) Mention the 6-agent cap. 4) Add EnterWorktree/worktree isolation for file ownership.

### claude-codex-routing (432 lines, refs: yes)
- Now a **legacy alias** for `~/.agents/skills/codex-gemini-routing` ("Claude is not part of Tyler's active dev team for the next few months") — but the full 400-line v2.0.0 protocol still sits below the 16-line alias notice in active imperative voice. `routing-flowchart.md` has no alias notice at all.
- Three-way contradiction found: skill+new AGENTS.md say retired; ProtoPulse MEMORY.md + global CLAUDE.md still inject v2.0.0 as live. (MEMORY.md corrected 2026-06-11 during this audit; global CLAUDE.md still stale.)
- Successor divergences: channel naming (`COLLAB_RESPONSE_R<N>` vs `COLLAB_RESPONSE_<AGENT>_R<N>` + `COLLAB_SYNTHESIS_R<N>`), SIGNOFF vocab, explicit cap-6 vs unnumbered, Context7 probe-and-fallback vs successor's blanket "use Context7" (ignores Codex-Context7-broken finding).
- Recs: 1) Collapse body to alias + 20-line "what changed" table; move v2.0.0 corpus to archive/. 2) Banner the flowchart. 3) Reconcile successor channel naming/cap. 4) Update global CLAUDE.md pointer.

### nlm-skill (726 lines, refs: yes — 7 files, ~3,069 lines)
- Version 0.6.6 matches installed CLI exactly; probed commands all real; consistent with AGENTS.md 2-hub topology. Best-verified large skill.
- Stale: orphaned code fence at line 124 breaks CLI Authentication rendering; `nlm label` undocumented; "ASK the user which interface" conflicts with autonomy norms.
- Recs: 1) Fix the stray fence. 2) Soften "ASK" to MCP-first/CLI-for-bulk. 3) Document `nlm label`. 4) Push per-artifact flag tables into references (~300-line core).

### using-tmux-for-interactive-commands (217 lines)
- No stale content found. Fork exists at `~/.agents/skills/` (drift risk).
- Recs: 1) Canonical copy + symlink. 2) Note background-Bash/Monitor now covers non-TUI cases. 3) Configurable pane size (80x24 hides wide TUIs).

### claude-md-mastery (163 lines)
- **Central claim is wrong**: says `@ref/file.md` is "passive notation, NOT an import" — `@path` imports in CLAUDE.md are real and auto-loaded (Tyler's global config depends on one). Feeds `/directory-deep-dive` everywhere. Names nonexistent sibling skills; stray .zip in dir.
- Recs: 1) Fix the @import claim. 2) Add AGENTS.md-symlink pattern. 3) Correct related-skill names; delete .zip. 4) Cover auto-memory vs CLAUDE.md split.

### claude-automation-recommender (global, 386 lines + 5 refs)
- Best-maintained skill audited (refreshed 2026-06-10; knows current flags, plugin-drift verification, `/initref` semantics). Project copy is a DANGLING SYMLINK (see Cluster 3).
- Recs: 1) Resolve global-vs-project copy. 2) Verify "agent teams experimental" wording. 3) Add ToolSearch/deferred-tools + `skillOverrides` levers to its recommendation tables.

### clearthought-mastery (616 lines, refs: yes)
- **Functional bug**: frontmatter `allowed-tools` lists nine per-operation tool names that no longer exist; the single live tool `mcp__clear-thought__clear_thought` is absent from its own allowed-tools. Body teaches the correct single-tool API. Also uses old `Task` tool name.
- Recs: 1) Fix allowed-tools (one line). 2) `Task` → `Agent`. 3) Verify the 37-operation count, date-stamp it.

### context7-mcp (53 lines)
- Accurate but the THIRD copy of the same instructions (global rule file + CLAUDE.md §Context7 + server's own instructions); lacks the max-3-calls discipline the global rule has.
- Recs: 1) Delete, or 2) make canonical (add call caps, have the rule point here). 3) If kept, add the Codex-Context7-broken caveat.

### codex-mastery (723 lines, refs: yes)
- "Current Stable: 0.63.0 (November 2025)" + gpt-5.1-codex-max tables ~7 months old; changelog dates internally fictional; §Related Skills bills claude-codex-routing as live (no legacy note).
- Recs: 1) Version/model refresh with changelog citations. 2) Fix changelog. 3) Annotate routing entry as legacy → codex-gemini-routing. 4) Pointer line: caps/channels live in the routing skill.

### codex-tmux-teaming (11-line shim → `~/.agents/.../SKILL.md`, 178 lines)
- Shim pattern is exactly right (what claude-codex-routing should look like). Real skill is Grok-first in examples though Grok is demoted; pins stale `--model gpt-5.1-codex-max`; uses `TEAM_DONE.md`, unregistered in any routing skill's completion-file registry; cap "N/6" agrees with 6.
- Recs: 1) Re-example to Codex/Gemini-first. 2) Register or rename `TEAM_DONE.md`. 3) Un-pin/date-stamp the model flag.

### chromedevtools-mastery (423 lines, refs: yes)
- All allowed-tools verified live. Missing the Chrome-DevTools-vs-Claude-in-Chrome disambiguation Tyler's global config treats as CRITICAL; related skill `playwright-mastery` doesn't exist.
- Recs: 1) Add the two-server disambiguation table. 2) Fix related-skill names. 3) De-dupe the snapshot-first protocol via pointer to the global rule.

### notebooklm-knowledge-builder (405 lines)
- **Verified-failing commands**: `nlm auth status` doesn't exist (→ `nlm login --check`); `nlm note add` → actual `nlm note create`; report-format list contradicts nlm-skill's. No PP-NLM jurisdiction guard (running it on ProtoPulse would violate Codex ownership).
- Recs: 1) Fix both commands. 2) Align format enum with nlm-skill. 3) Add a jurisdiction pre-flight. 4) Reference nlm-skill's edge-cases.md instead of restating.

### claude-in-notebooklm (1,414 lines, no refs split)
- Fallback-only skill with the worst token-cost-to-use-frequency ratio in the set; UI facts hands-on-verified 2025-12-27 (~6 months old on Google's fastest-drifting surface).
- Recs: 1) Split to ~150-line core + references/. 2) Stamp every limits/format table with verification date. 3) nlm-skill owns format enums; point, don't restate.

### skill-sync-workflow (186 lines)
- **Hardwired to OmniTrek** (another project): paths, ViewType enums, hook lists. Methodology (scan → update file maps/exports/gotchas → validate hook mappings) is exactly what ProtoPulse needs post-redesign, pointed at the wrong repo.
- Recs: 1) Rename `omnitrek-skill-sync` OR parameterize project root/skill dir. 2) Point it at ProtoPulse's `.claude/skills/`. 3) Fix auto-trigger paths.

**Cluster verdict table:** retire/alias-collapse: claude-codex-routing body; fix-now: clearthought-mastery allowed-tools, notebooklm-knowledge-builder commands, claude-md-mastery @import claim, nlm-skill fence; generalize: skill-sync-workflow; keep: the rest with listed updates.

---

# Cluster 2 — Ars Contexta core (18 skills, `.claude/skills/`)

Environment facts verified live: notes = `knowledge/` (743), inbox 8 pending, queue = `ops/queue/queue.json` only (schema v3, **`phase_order: null`**, 130 tasks / 100 pending, stalled since 2026-04-14/18), qmd collection `protopulse-vault`, qmd CLI has **no `vsearch`**, MCP tools are `mcp__qmd__qmd_*`, `vocabulary.notes_collection` undefined in `ops/derivation-manifest.md`, no `captures/`/`insights/`/`ops/scripts/`/`ops/templates/`, no `/archive-batch`/`/enrich`/`/health` anywhere, sessions are `.json`, dominant live schema = `type: knowledge-note` + quoted wiki-link topics (441/743), workspaces = `packages/*` + `tools/golden` with `check:packages`/`test:packages`, root package name `rest-express`, dev port 5000, zero `docs/*checklist*.md`, methodology MOC at `ops/methodology/methodology.md`.

### extract (1208 lines, twin: drifted)
- Stale: `mcp__qmd__vector_search` (3x), undefined `{vocabulary.notes_collection}`, `/health` routing row, `notes/` fallback. Broken: `qmd vsearch` (2x). v2 schema pointer valid.
- Overlaps: defines v2 schema that **contradicts validate/verify/stats**; handoff format restated in seed/pipeline/ralph. `.agents` twin LACKS the 2026-04-19 batch-mode/v2 additions.
- Recs: 1) Fix qmd refs + define `notes_collection: protopulse-vault`. 2) Split to ~250-line SKILL.md + references/{extraction-doctrine,handoff-spec}. 3) Port additions to twin or declare .claude canonical. 4) `/health` → `arscontexta:health`.

### graph (567 lines, twin: drifted)
- Stale: 8 mentions of phantom `ops/scripts/graph/*.sh`; repo-root `analyze_graph.py` never mentioned. O(N²) scans with no large-vault guard (stats has one).
- Recs: 1) Add large-vault fast path (build adjacency once). 2) Ship helpers or delete the 8 stanzas; consider wiring analyze_graph.py. 3) Move output templates to references/. 4) Make stats delegate Health to `/graph health`.

### learn (253 lines, twin: drifted)
- Stale: exa MCP tools in allowed-tools — no exa server configured (primary+fallback tiers dead); `research:` config block doesn't exist in ops/config.yaml.
- Recs: 1) Re-cascade: WebSearch primary, exa branch conditional. 2) Routing note vs deep-research//pp-research. 3) Add the config block or drop the claim.

### next (407 lines, twin: drifted)
- Stale: sessions signal greps `*.md` (sessions are `.json` — permanently 0); recommends `/health`; queue migration targets v<3 only — `phase_order: null` unhandled.
- Broken: macOS-only `stat -f` with no Linux fallback (OLDEST_INBOX always empty on this box — rethink does it right); `find -name ... -maxdepth` flag order warning.
- Recs: 1) Dual-form stat + reorder find flags. 2) Point sessions signal at `.json` or delete. 3) `/health` → arscontexta:health. 4) Add a `pipeline_stalled` → `/ralph N --batch` recommendation (100 pending tasks is THE case this skill exists for).

### pipeline (314 lines, twin: drifted)
- Stale: `captures/` (2x, actual `inbox/`), Phase 5 invokes phantom `/archive-batch` (inline fallback is the only working path), handoff reports `insights/` (actual `knowledge/`).
- Recs: 1) Promote inline archive to primary (or build archive-batch — tasks+ralph want it too). 2) Fix dirs. 3) Cut Phase 1's duplicated seed description.

### remember (534 lines, twin: drifted)
- Stale: `ops/methodology.md` (actual `ops/methodology/methodology.md`); session mining targets `*.md` (JSON only — `--mine-sessions` always empty; `mined:` frontmatter impossible on JSON).
- Recs: 1) Fix MOC path. 2) Rewrite mining for JSON + sidecar state. 3) Routing note vs `.claude/memory/feedback_*.md` convention (two competing capture paths). 4) Shared references/methodology-loop.md with rethink (~60 dup lines).

### rethink (657 lines, twin: drifted)
- Stale: `ops/observations.md`/`ops/tensions.md` MOCs don't exist; bare `/architect` `/reseed` (actual: arscontexta:*); inherits remember's wrong MOC path. Portable stat done RIGHT here.
- Recs: 1) Create-if-missing the MOCs. 2) Namespace escalation commands. 3) Phase 2 → "follow /remember's spec" (delete ~50 dup lines). 4) Move rubric tables to references/.

### revisit (656 lines, twin: drifted)
- Stale: all 4 qmd allowed-tools names wrong; undefined collection placeholder; `--sparse` consumes flags from phantom `/health`; "rename script" doesn't exist.
- Recs: 1) Fix tools + collection. 2) Shared references/dual-discovery.md with connect (~70 dup lines). 3) Resolve /enrich dependency. 4) Concrete manual rename procedure.

### seed (303 lines, twin: drifted)
- Stale: built around `captures/` (actual `inbox/`); dead YAML queue globs; `mcp__qmd__search`; greps `insights/`.
- **Broken: claim-numbering collision** — QUEUE_MAX scans only nonexistent YAML, never `ops/queue/*-NNN.md` (live files up to -062) nor queue.json → fresh /seed computes colliding `next_claim_start`, violating its own invariant.
- Recs: 1) Fix the max computation (glob NNN files + jq queue.json). 2) captures/→inbox/ throughout. 3) Fix dedup tooling. 4) Drop dual YAML/JSON templates.

### ship (106 lines, twin: none)
- Stale: repo check matches package name "protopulse" (actual `rest-express` — fails every run); hardcoded `Co-Authored-By: Claude Opus 4.6`; only legacy `npm run check`+`npx vitest run` — **`check:packages`/`test:packages` never run** (green /ship can push broken packages/*).
- **Broken: Stage 2's foreground `npx vitest run` is blocked by the project's own enforce-test-background hook** (verified).
- Recs: 1) Add packages stages + background-compliant test invocation. 2) Fix repo check (remote URL not package name). 3) Generic co-author trailer. 4) Document interaction with auto-commit/auto-push.

### stats (371 lines, twin: renamed `ars-stats`)
- Stale: TOPIC_COUNT regex only matches quoted wiki-links (v2 bare slugs invisible); dead YAML branch; `ops/stats-history.yaml` never exists so trends permanently off, creation assigned to phantom `/health`.
- Recs: 1) Format-agnostic topic counting. 2) /stats appends its own history line. 3) Delegate Health to /graph health. 4) Twin rename map.

### status (117 lines, twin: none)
- Stale: checklist globs match zero files (headline section dead); no packages/ awareness; stale tsc estimate.
- Recs: 1) Parse `docs/MASTER_BACKLOG.md` Quick Stats instead. 2) Add Engine line (`check:packages` + workspace count). 3) Merge with resume (4 of 5 sections shared). 4) Add trigger phrases.

### tasks (402 lines, twin: renamed `ars-tasks`)
- Stale: dead YAML branch; recommends phantom `/archive-batch`.
- Recs: 1) jq over grep-counting. 2) Fix archive note. 3) Surface task age (100 April tasks would be visibly stale). 4) Twin rename map.

### validate (310 lines, twin: drifted)
- Stale: batch mode targets `insights/`; `ops/templates/` never existed; type enum matches neither v2 nor live vault (WARNs on essentially everything).
- Recs: 1) Re-anchor on vault-validate's v2 JSON schema asset. 2) insights/→knowledge/. 3) Accept both topics formats during migration. 4) Demote/delete in favor of verify+vault-validate (three validators guarantee drift).

### verify (533 lines, twin: drifted)
- Stale: wrong qmd tool name; undefined collection; `insights/` batch mode; **hard-FAILs the bare-slug topics extract mandates**. Name collides with the built-in `verify` code-verification skill.
- Broken: `qmd vsearch`.
- Recs: 1) Fix retrieval tier. 2) Resolve topics-format contradiction (highest-stakes instance). 3) insights/→knowledge/. 4) Rename `vault-verify` or disambiguate description.

### connect (746 lines, twin: drifted)
- Stale: all 4 qmd allowed-tools names wrong; undefined collection (2x). CLI tier otherwise the only fully-working qmd integration once collection is fixed.
- Recs: 1) Fix tools + collection. 2) Factor shared dual-discovery block. 3) Move example galleries (~200 lines) to references/. 4) Topics-format note for MOC updates.

### resume (97 lines, twin: none)
- Stale: recent-file scan misses `packages/` entirely; checklist globs match zero files.
- Broken: ungrouped find `-o` predicates (needs `\( ... \)`).
- Recs: 1) Add packages/ + parenthesize. 2) Replace checklists with MASTER_BACKLOG Quick Stats + CODEX_HANDOFF lane check. 3) Read `.ref/project-dna.md` step 0. 4) Fold into status.

### ralph (602 lines, twin: drifted)
- Stale: dead YAML queue paths; enrich phase invokes phantom `/enrich` (26 live tasks unprocessable); `subagent_type: knowledge-worker` doesn't exist; create-phase writes `insights/`; suggests `/archive-batch`.
- **Broken: phase-progression dereferences `phase_order` which is null in the live queue — no fallback.** "Max 5 workers" predates the 6-cap.
- Recs: 1) Null-handling with documented defaults + queue header repair (this + /enrich unblocks the 100-task backlog). 2) Create /enrich or inline its prompt. 3) Fix dirs/types. 4) general-purpose subagent type + cite cap-6.

**Cluster patterns:** 15/18 are generated arscontexta-v1.6 artifacts (templating + integration rot); ship/status/resume are hand-written (engine-redesign rot). Zero references/ dirs. Bidirectional twin drift (.agents = domain-vocabulary 2026-04-18; .claude = upstream 2026-04-19 with newer extract).

---

# Cluster 3 — claude-* meta skills (13 skills, `.claude/skills/`)

### ask-claude (61 lines) — **RETIRE**
OMX-framework transplant: `omx` binary, `./scripts/ask-claude.sh`, `npm run ask:claude`, `.omx/artifacts/` — none exist here. Built-ins (oracle, claude-code-guide agents) cover it.

### claude-agent-sdk (369 + ~4,700 lines refs/templates) — **KEEP + FIX**
- **Correctness bug**: SKILL.md + refs use `workingDirectory` option (12 uses); 4 templates use `cwd`. Real SDK option is `cwd` — `workingDirectory` silently no-ops. Verify via Context7, then fix.
- 7 months stale: versions pinned Nov-2025, `claude-sonnet-4-5` everywhere (15+ occurrences), docs.claude.com URLs pre-migration, fake metrics footer ("Error Prevention: 100%").
- Recs: 1) cwd fix. 2) Refresh or delete version blocks (defer to Context7). 3) Strip fake metrics. 4) Consider demoting to error-catalog + templates.

### claude-api (530-line SKILL.md; ~16,600 lines total) — **KEEP + REWIRE**
- SKILL.md model table stale AND wrong (lists "Haiku 4.5" with the retired Haiku 3.5 ID `claude-3-5-haiku-20241022`; "Opus 4" as top model). The freshest 14k lines (`shared/`, language dirs — know Opus 4.6, Models API, managed-agents beta) are **never referenced by the entrypoint**.
- Registered twice in the session skill list (symlink + .agents scan).
- Recs: 1) Rewrite SKILL.md as a thin router into shared/ + language dirs; delete 2025 tables. 2) Move volatile facts out of description/body; keep the live-sources WebFetch pattern. 3) Deduplicate registration. 4) Absorb claude-cookbooks.

### claude-automation-recommender (project) — **BROKEN SYMLINK**
`.claude/skills/claude-automation-recommender → .agents/skills/...` is dangling — target deleted in `b5de69a3` (2026-04-12, −1,911 lines); git still tracks the dead link. Resolves only via the global copy. Rec: delete/repoint the tracked symlink.

### claude-code (744 lines) — **SHRINK DRASTICALLY or RETIRE**
Hermes-framework transplant ("Transforms Gemini..."-era external orchestration; `terminal()` syntax). Says "all 8 hook types" (current: 11+); skills section teaches flat `.claude/skills/<name>.md` no-frontmatter format (wrong spec); pre-Claude-5 models. Most platform-redundant skill audited (claude-code-guide agent + `/help` beat any snapshot). Unique value: tmux dialog choreography (~100 lines).

### "claude code guide" (68 lines, SPACE in dir name) — **RETIRE**
Spec-violating name (`name: Claude Code Guide`, dir with space), collides with the built-in claude-code-guide agent, 2024-era content, zero unique value.

### claude-cookbooks (313 + ~1,260 lines) — **RETIRE → pointer line in claude-api**
All four Quick Reference snippets use `claude-3-5-sonnet-20241022` (retired 2025-10-28) — every copy-paste errors. References are anchor-stubs into notebooks that aren't bundled.

### claude-devfleet (103 lines) — **RETIRE unless server returns**
Documents a DevFleet MCP server (localhost:18801) that isn't configured anywhere. Agent teams + worktree isolation + background agents natively cover the use case.

### claude-extensibility (333 + ~1,050 lines) — **MERGE with claude-skills**
Frontmatter table missing `disable-model-invocation`/`user-invocable`/`context: fork`/`model`/hooks-in-skills; agent model enum pre-Claude-5; built-in subagent table covers 3 of dozens; hard dependency on uninstalled `prompt-enhancer` skill; `permissionMode: ignore` isn't a real mode; output-styles section dated.

### claude-hook-writer (425 + ~2,240 lines) — **KEEP + UPDATE** (best-engineered in cluster)
Missing 4 hook events (SubagentStart, TaskCompleted, TeammateIdle, PostCompact); broken internal pointer (`hook-templates.md` → actual `code-templates.md`); PRPM publishing reference irrelevant here; competes with global hooks-mastery for every hook prompt — pick one owner.

### claude-settings-audit (312 lines) — **DE-SENTRY + MERGE under automation-recommender**
21 `Skill(sentry-skills:*)` allowlist entries + Sentry/Linear detection (no Sentry in this stack); permissions model lacks the `ask` tier and permission modes.

### claude-skills (243 + ~1,230 lines) — **MERGE with claude-extensibility**
Teaches name/description-only frontmatter (materially incomplete spec — its validator passes mis-specified skills); script invocations assume `./skills/claude-skills/...` layout (actual `.agents/skills/...` — every documented command fails as written).

### claude-update (62 lines) — **KEEP + PRUNE** (only cluster member using modern frontmatter)
Phantom routing rows (`component`, `aria`, `api`, `docs` skills don't exist — foreign template); `.claude/skills/README.md` doesn't exist; `docs/notebooklm.md` row should say "Codex-owned, do not touch".

**Cluster patterns:** model-generation freeze at late-2025; pre-agent-teams hook taxonomy; pre-current skill spec in BOTH authoring skills; transplant debris from six origin repos (Hermes/OMX/Sentry/PRPM/jezweb/zebbern); broken wiring (dangling symlink, unreachable fresh content, missing dependency, wrong paths, duplicate registration).

---

# Cluster 4 — Domain skills + .agents-unique + mirror drift

### breadboard-lab (159-line SKILL.md + 7 refs, 1,189 lines) — best-crafted domain skill; map is WRONG
- BreadboardView.tsx claimed 2,284 lines → now **699** (toolbar/canvas extracted to `breadboard-view/`, `breadboard-canvas/`). Three new directories entirely missing from the file map (incl. `breadboard-components/` with 20 per-part SVG renderers). `useBreadboardCoachPlan.ts` path wrong (the .agents helper script has the CORRECT path). LOC drift on 4 libs (audit lib 891→1,406). Recipe 7's line numbers fiction. Test matrix behind. Zero `packages/` engine awareness — no "legacy `shared/parts` ≠ `@protopulse/parts`" boundary.
- Recs: 1) Rewrite Quick Reference + architecture ref for post-extraction layout; drop hardcoded line numbers (symbol names only). 2) Add Legacy-vs-Engine jurisdiction section cross-referencing AGENTS.md. 3) Fix Recipe 7 + test matrix. 4) grep→rg/ast-grep examples; refresh vault-links snapshot.

### pp-knowledge (120 lines) — Codex-owned; nearly clean
Hub IDs/aliases match the manifest exactly. Gap: no engine-redesign routing row (packages/, graph ops, .ppx → pp-core). For Codex: add it; drop `Write` from allowed-tools (read-only router); freshness-check note.

### pp-nlm-operator (181 lines) — Codex-owned; very low rot
All 9 scripts, 5 hooks, 14 commands verified present. For Codex: mark ~15 legacy `populate-*`/`create-tier1.sh` scripts as retired; fix "Notesbook" typo; document engine-milestone capture path.

### refactor (447 lines) — vault restructuring, NOT code
`${CLAUDE_PLUGIN_ROOT}/reference/interaction-constraints.md` dead (var unset for standalone skills — the load-bearing constraint check silently no-ops); `ops/scripts/rename-note.sh` doesn't exist; macOS-only `sed -i ''` errors on Linux; bare name invites mis-invocation on code refactors.
- Recs: 1) Negative trigger ("NOT for code"). 2) Vendor interaction-constraints.md. 3) Fix sed + rename-script refs. 4) Push phase mechanics to references/.

### ars-stats / ars-tasks (.agents) — renamed mirrors of stats/tasks
`name:` frontmatter ≠ dir name; vault is 3.5x past the large-vault threshold so the fast path should be default; otherwise sound. Sync via rename map, not by hand.

### claude-code-maestro (.agents; 66-line SKILL.md + 2,393-line KNOWLEDGE_MAP + ~50k lines raw_docs + 13 scripts)
Cross-agent (Gemini) Claude Code expert. `analyze-claude-logs.sh` targets nonexistent `.claude/stats-cache.json` ("Log Autopsy" is fictional); raw_docs snapshot ends 2026-w14 with no refresh cadence; 57k vendored doc lines checked into the project repo.
- Recs: 1) Fix/delete the log script. 2) Documented refresh ritual or cron. 3) Move raw_docs global or gitignore. 4) Mark audience (Gemini/Codex) in frontmatter.

### gemini-cli-maestro (.agents; 39 lines) — **UNFINISHED SCAFFOLD**
Literal `[Domain]` placeholders in body; KNOWLEDGE_MAP points to missing file; doctor/backup scripts are echo-only. Real frontmatter description means it WILL trigger, then deliver placeholder guidance. Finish (via universal-skill-builder's own templates) or delete; preserve `data/CHANGELOG.md`.

### screenshot-capture-super (.agents; 0 lines) — **EMPTY DIR, no SKILL.md** — delete or build for real.

### scribe-mastery (.agents; 42 lines)
Grounded (`scribe/` exists). `styleguide.md` referenced but absent; `/scribe:*` commands are Gemini-extension-only — state who drives by file state.

### universal-skill-builder (.agents; 71 lines + real working scripts)
Defaults everything to `.agents/skills/` while the repo reality is the dual-tree; thin Claude-Code platform notes. Recs: 1) Encode the dual-tree sync policy (this skill CREATES future drift otherwise). 2) Refresh CC platform section. 3) Have audit-skill.sh flag empty dirs and name/dir mismatches (would have caught both broken scaffolds).

## Mirror drift map (34 .agents / 51 .claude / 27 shared)
- **Identical (12):** the whole claude-* meta family + claude-update.
- **Drifted (15):** breadboard-lab (structural fork — .claude newer content, .agents has Codex extras + the one CORRECT path) + 14 arscontexta skills (one mechanical class: .claude = upstream vocabulary 2026-04-19, .agents = domain-transformed 2026-04-18) + the stats→ars-stats / tasks→ars-tasks renames.
- **.claude-only (24):** vault-* family, pp-*, ship/status/resume/devserver, checklist trio, broken symlink.
- **.agents-only (7):** the maestros, scribe-mastery, universal-skill-builder, two broken scaffolds.
- **Sync strategy:** canonical side per CLASS — .claude canonical for content; regenerate .agents arscontexta copies via the `ops/derivation-manifest.md` vocabulary transform + rename map; regenerate breadboard-lab's condensed variant keeping Codex extras; cross-agent-only tooling exempt. Build `scripts/sync-skills.sh` (adapt global skill-sync-workflow), run on `.claude/skills/**` edits or weekly cron, with a lint pass (SKILL.md-less dirs, `[Domain]` placeholders, name/dir mismatches). Manual sync has demonstrably failed: 15 of 27 drifted.

---

# Cluster 5 — vault-* + audit/dev trio (16 skills, `.claude/skills/`)

### vault-audience (152 + 229-line script)
`<VaultExplainer>` described in future tense but SHIPPED at `client/src/components/ui/vault-explainer.tsx` with a DIFFERENT API (`tier` prop vs the skill's `userMode` contract; no "educator renders all" mode). Claimed "14 notes tiered (2.1%)" — actual: **0** notes have body tier markers. Recs: 1) Rewrite UI contract to match the shipped component. 2) Fold validation into vault-validate; keep `--fill-stubs`. 3) Live counts, not hardcoded. 4) Shared tier-protocol ref with vault-teach.

### vault-extract-priority (88 + scripts) — **RETIRE or wire for real**
Claims /extract reads its output — false; extract implements its own `--batch` ordering and never references it. Live queue rows drifted from the column contract (rank.py would mis-score). Nothing invokes it.

### vault-gap (181 + assets/scripts) — keep (absorb vault-inbox)
Best description in the set. Queue-contract vs live-row drift (mangled columns, undocumented `partial` value) — every downstream parser reads this table. Stats hardcoded (683→743). Recs: reconcile queue contract; absorb vault-inbox as `--source user`; live counts; add `docs/plans/`.

### vault-health (133 + 321-line script)
Step 1 runs **nonexistent `scripts/rebuild-index.sh`** (real: `vault-index/scripts/build-index.py`); cron never installed (last reports April); requires <1h index freshness, index 8 weeks stale; schema-drift section would report ~700 schema-mismatch noise errors. 4-way overlap with stats/graph/arscontexta:health. Recs: fix the script ref; pick ONE health surface (keep consumption/demand-gap uniqueness); install cron or delete section; gate drift section on schema reconciliation.

### vault-inbox (192 + scripts) — **MERGE into vault-gap**
60-line client+server protocol is unshipped spec (no `POST /api/vault/suggest` route, no `VaultInboxCta` component); `user-suggestions.md` has zero rows ever. Skills describe what exists; plans describe what doesn't.

### vault-index (134 + 303-line script) — keep (the substrate)
Scan roots predate the redesign: **`packages/` not scanned at all**; plans only under `docs/superpowers/plans/` (active plans now in `docs/plans/`). Index generated 2026-04-19 (claims 742 notes / 98% orphans). Pre-commit hook "recommended", never installed. Recs: add packages/** + docs/plans/**; staleness guard; register the rebuild somewhere real.

### vault-prefetch (183 + 291-line script) — **fully dead wiring: go/no-go decision needed**
Hook exists but is NOT registered in settings.json; **nothing consumes the cache** (stale since 2026-04-22); signal map references `server/services/drc/**` (doesn't exist; DRC is `packages/drc/`... verify) and has drifted from both the script AND the tree; allowed-tools overpromise qmd the script never uses. Register + add a consumer (session-orient.sh injects digest), or retire.

### vault-quality-gate (174 + 282-line script)
Wired into /extract correctly. Built on v2 — as a vault-wide audit it would bounce essentially every pre-T-series note. "claude-code CLI" → binary is `claude`. HIGH overlap with vault-validate (rules re-implemented in two Python scripts, already drifting). Recs: merge validate+gate into one engine (lint/gate modes); "do not bulk-audit until migration" warning; fix CLI name.

### vault-source (134 + 255-line script)
Sound per-note renderer; coverage math only meaningful post-migration (15 notes have provenance). Fold `--coverage` into vault-health; mark example numbers illustrative.

### vault-suggest-for-plan (167 + 196-line script)
Extraction regexes tuned to the April e2e-walkthrough plan dialect; the now-mandated `docs/plans/` template under-extracts. Recs: extend extraction rules; point at vault-gap's rubric instead of restating; fill the stub excerpt slot via `--auto-seed-gaps`.

### vault-teach (159 lines)
Tier-selection machinery runs on substrate that exists in **0 notes**; staging rubric scores on fields that are absent (reviewed: 0, provenance: 15); "500 wpm" read-time constant is ~2x reality. Recs: re-base signals on fields that exist; fix wpm; share tier-protocol ref.

### vault-validate (130 + schema/4 scripts) — **epicenter of the schema schism**
Live test on a representative note: 7 errors + 3 warnings. Actual vault types (`domain-knowledge` 113, `knowledge-note` 72, `debt-note` 34, `insight` 31…) ALL invalid under v2; confidence (`proven` 380, `high` 93) ALL invalid; wiki-link topics fail the slug pattern. The REGISTERED validate-note.sh hook enforces a THIRD enum set contradicting the skill in both directions. `remediate-v2-frontmatter.py` exists and was never run vault-wide. Recs: reconcile schema first (single enum source, e.g. `_schema` in ops/config.yaml); loud pre-migration banner; merge with quality-gate; trim allowed-tools.

### checklist-update (103 lines)
Format assumption (`- [ ] **VA-001**`) matches only visual-audit artifacts, but its mtime-based file pick will select today's table-based checklists it cannot operate on. Weak description (no triggers). Recs: format-detect + bail; trigger phrases; scope the glob.

### fix-audit-failures (115 lines)
View→file map wrong in 3 of 10 rows (BreadboardView + PCBLayoutView live in `circuit-editor/`, not `views/`; OutputView.tsx is dead code — `output` renders ExportPanel per ViewRenderer.tsx). Map covers 10 of **36** ViewModes. Recs: resolve views via ViewRenderer.tsx/lazy-imports.ts (self-healing); fix the 3 rows now; add triggers; cross-link /checklist-update.

### devserver (145 lines) — cleanest skill audited
Recs: mention `npm run tauri:dev` sibling; add `logs` action; note the `dev:client` port-5000 collision case.

### visual-audit (160 lines)
"Views to Audit (10)" vs 36 ViewModes — audit skips two-thirds of the product by construction; output artifact path doesn't match where audits actually land (`docs/audits/`); "107-step" is false precision; **missing checks for the project's own UI Container Rule** (scroll/resize/collapse). Recs: derive view list from the ViewMode union; add Container Rule check section; fix artifact convention; real when-to-invoke description.

**Cluster verdicts:** 12 vault-* → 6 (merge validate+quality-gate; inbox→gap; audience-validation→validate; source-coverage→health; retire extract-priority; prefetch = register-or-retire). T1-T15 cross-references need a legend. Hardcoded stats wrong in 5+ skills.

---

# Appendix — Already-covered & new-automation notes (per /claude-automation-recommender)

- **Already covered (no recommendation):** Context7/qmd/Memory/Chrome MCP routing (AGENTS.md), auto-commit + auto-push (hooks/cron), typecheck + test-background enforcement (hooks), NLM pipeline (Codex-owned, healthy per audit).
- **New automation actually warranted:** (1) `scripts/sync-skills.sh` + hook/cron — kills the 15-skill drift class permanently. (2) Single-source schema (`ops/config.yaml` `_schema`) consumed by hook + validators. (3) vault-index rebuild registration (pre-commit or auto-commit hook path). (4) A skill-lint pass (empty dirs, placeholders, name/dir mismatch, dangling symlinks) — runnable inside sync-skills.
- **Verification trail:** every stale-ref claim above was checked against live repo state by the auditing agents (rg/fd/ls/jq probes; live CLI probes for nlm/qmd; tool-list cross-checks for MCP names). Skills NOT audited: the `arscontexta:*` plugin namespace, superpowers plugin internals, and global skills with no ProtoPulse usage evidence.

---

# Master Verdict Index — all 72 skills

Verdicts: **KEEP** (healthy, minor updates) · **FIX** (works, has verified defects) · **FIX-NOW** (actively breaking/misleading) · **MERGE** (fold into named target) · **RETIRE** (delete) · **DECIDE** (binary go/no-go needed).

## Globals (~/.claude/skills/) — 14
| Skill | Verdict | #1 fix |
|---|---|---|
| agent-teams | FIX | re-verify experimental-flag prereq + limitations; drop foreign example |
| claude-codex-routing | FIX-NOW | collapse to alias + archive; banner the flowchart; fix global CLAUDE.md pointer |
| nlm-skill | FIX | stray code fence L124; soften "ASK the user"; document `nlm label` |
| using-tmux-for-interactive-commands | KEEP | canonicalize vs `~/.agents` fork (symlink one side) |
| claude-md-mastery | FIX-NOW | invert the wrong "@path is not an import" claim |
| claude-automation-recommender | KEEP | add ToolSearch/skillOverrides levers |
| clearthought-mastery | FIX-NOW | allowed-tools → single `mcp__clear-thought__clear_thought` |
| context7-mcp | DECIDE | delete (3rd copy of same instructions) or make canonical w/ call caps |
| codex-mastery | FIX | version/model refresh w/ changelog citations; mark routing skill legacy |
| codex-tmux-teaming | FIX | re-example Codex/Gemini-first; register `TEAM_DONE.md`; unpin model |
| chromedevtools-mastery | FIX | add DevTools-vs-Claude-in-Chrome disambiguation table |
| notebooklm-knowledge-builder | FIX-NOW | `nlm auth status`→`login --check`; `note add`→`note create`; jurisdiction guard |
| claude-in-notebooklm | FIX | split 1,414 lines → ~150 core + references/ |
| skill-sync-workflow | FIX-NOW | de-OmniTrek (parameterize) and point at ProtoPulse |

## Ars Contexta core (.claude/skills/) — 18
| Skill | Verdict | #1 fix |
|---|---|---|
| extract | FIX | qmd names + collection placeholder; split 1,208 lines |
| graph | FIX | large-vault fast path; resolve phantom helper scripts |
| learn | FIX | re-cascade tools (exa absent); routing note vs /pp-research |
| next | FIX | Linux `stat` fallback; sessions signal → .json; add pipeline_stalled rec |
| pipeline | FIX | promote inline archive (phantom /archive-batch); captures/→inbox/ |
| remember | FIX | methodology MOC path; session mining → JSON + sidecar |
| rethink | FIX | create missing MOCs; namespace arscontexta:* commands |
| revisit | FIX | qmd allowed-tools; shared dual-discovery ref |
| seed | FIX-NOW | claim-number collision (scan live NNN files + queue.json) |
| ship | FIX-NOW | Stage 2 blocked by own hook; add check:/test:packages; repo-check matches wrong name |
| stats | FIX | format-agnostic topic count; own the history file |
| status | MERGE | → one skill with resume; parse MASTER_BACKLOG; add Engine line |
| tasks | FIX | jq over grep; surface task age |
| validate | MERGE | → verify + vault-validate (anchor on v2 schema asset) |
| verify | FIX-NOW | gate FAILs extract's mandated output; qmd vsearch; name collides w/ built-in |
| connect | FIX | qmd allowed-tools + collection; move example galleries to references/ |
| resume | MERGE | → status; add packages/ scan; read .ref/project-dna.md step 0 |
| ralph | FIX-NOW | `phase_order: null` dereference; phantom /enrich blocks 26 live tasks |

## claude-* meta (.claude/skills/) — 13
| Skill | Verdict | #1 fix |
|---|---|---|
| ask-claude | RETIRE | dead OMX paths; built-ins cover it |
| claude-agent-sdk | FIX-NOW | `workingDirectory`→`cwd` (verify via Context7) |
| claude-api | FIX | rewire SKILL.md into its own fresh shared/ tree; purge 2025 tables |
| claude-automation-recommender (project) | RETIRE | delete the dangling tracked symlink |
| claude-code | RETIRE | or shrink to ~100-line tmux-orchestration recipe |
| "claude code guide" | RETIRE | spec-violating name; collides with built-in agent |
| claude-cookbooks | RETIRE | retired model IDs in every snippet; → pointer in claude-api |
| claude-devfleet | RETIRE | documents absent infrastructure |
| claude-extensibility | MERGE | + claude-skills → one current-spec authoring skill |
| claude-hook-writer | FIX | add 4 missing hook events; fix internal ref; dedupe vs hooks-mastery |
| claude-settings-audit | MERGE | de-Sentry → reference under automation-recommender |
| claude-skills | MERGE | + claude-extensibility; update validator to current spec |
| claude-update | KEEP | prune 4 phantom rows; mark notebooklm.md Codex-owned |

## Domain + .agents-unique — 11
| Skill | Verdict | #1 fix |
|---|---|---|
| breadboard-lab | FIX-NOW | rewrite architecture map (post-extraction layout); engine jurisdiction section |
| pp-knowledge (Codex) | KEEP | add engine-redesign routing row |
| pp-nlm-operator (Codex) | KEEP | mark legacy populate-* scripts retired |
| refactor | FIX | vendor interaction-constraints.md; Linux sed; "NOT for code" trigger |
| ars-stats | FIX | sync via rename map; default the large-vault path |
| ars-tasks | FIX | sync via rename map; note MASTER_BACKLOG relationship |
| claude-code-maestro | FIX | fix fictional log-autopsy script; raw_docs refresh cadence; relocate 57k vendored lines |
| gemini-cli-maestro | DECIDE | finish ([Domain] placeholders trigger + mislead) or delete; keep CHANGELOG |
| screenshot-capture-super | RETIRE | empty dir, no SKILL.md |
| scribe-mastery | KEEP | state Gemini-only /scribe:* commands; ship or drop styleguide.md |
| universal-skill-builder | FIX | encode dual-tree sync policy; lint empty dirs + name mismatches |

## vault-* + audit/dev trio (.claude/skills/) — 16
| Skill | Verdict | #1 fix |
|---|---|---|
| vault-audience | MERGE | validation → vault-validate; rewrite UI contract to shipped component |
| vault-extract-priority | DECIDE | wire into /extract for real, or retire (nothing invokes it) |
| vault-gap | KEEP | reconcile queue contract; absorb vault-inbox as --source user |
| vault-health | FIX | nonexistent rebuild-index.sh; install cron or cut section; dedupe 4-way |
| vault-inbox | MERGE | → vault-gap; move unshipped HTTP spec to a plan doc |
| vault-index | FIX | add packages/** + docs/plans/** scan roots; register rebuilds |
| vault-prefetch | DECIDE | register hook + add consumer, or retire (fully dead wiring) |
| vault-quality-gate | MERGE | + vault-validate → one engine (lint/gate modes) |
| vault-source | FIX | fold --coverage into vault-health; keep per-note renderer |
| vault-suggest-for-plan | FIX | extend extraction to docs/plans template |
| vault-teach | FIX | re-base staging signals on fields that exist; fix 500-wpm constant |
| vault-validate | FIX-NOW | schema schism epicenter — reconcile enums first, loud pre-migration banner |
| checklist-update | FIX | format-detect + bail; add trigger phrases |
| fix-audit-failures | FIX-NOW | 3 wrong view→file rows; resolve via ViewRenderer.tsx |
| devserver | KEEP | cleanest skill audited; add tauri:dev + logs action |
| visual-audit | FIX | derive 36 views from ViewMode union; add UI Container Rule checks |

**Tally:** KEEP 8 · FIX 33 · FIX-NOW 12 · MERGE 10 · RETIRE 7 · DECIDE 4 (govern by the go/no-go question named in each row, not by default).

---

# Codex-Trio Contradiction Matrix (from the globals audit)

| Claim | claude-codex-routing (legacy body) | codex-gemini-routing (successor, .agents) | codex-tmux-teaming (real, .agents) | codex-mastery |
|---|---|---|---|---|
| Is Claude on the team? | Header: NO (alias) / Body: YES — self-contradictory | No — Codex/Gemini-first | Grok-first framing (also off-protocol) | Silent; still links routing as live |
| Agent cap | Max 6, explicit | "Tyler's agent cap" — no number | "N/6" — agrees with 6 | Not mentioned |
| Single-task channels | CODEX_HANDOFF / CODEX_DONE | Same + GROK_* / GEMINI_* | GROK_HANDOFF + **TEAM_DONE** (unregistered) | N/A |
| Campaign channels | COLLAB_HANDOFF_R\<N\> / COLLAB_RESPONSE_R\<N\> | COLLAB_RESPONSE_**\<AGENT\>**_R\<N\> + COLLAB_SYNTHESIS_R\<N\> — divergent | Defers to routing | N/A |
| SIGNOFF vocab | Claude\|Codex\|both | Codex\|Grok\|Gemini\|multiple | "SIGNOFF: Codex" | N/A |
| Codex Context7 | Broken — probe-and-fallback | "Use Context7 or official docs" — ignores broken state | Silent | Silent |
| Dispatch command | `codex exec --sandbox workspace-write -C` | Same | Interactive TUI via tmux (complementary) | Same — consistent |
| Models | N/A | N/A | Pins gpt-5.1-codex-max (stale) | "0.63.0 stable, Nov 2025" (stale) |

Resolution owner: the successor skill (codex-gemini-routing) should declare canonical channel names, the numeric cap, and the Codex-Context7 probe rule; the other three point at it.

---

# Execution Roadmap — four waves

**Wave 1 — Unblock (do first; everything downstream reads these):**
1. Schema reconciliation: one enum source in `ops/config.yaml`, consumed by validate-note.sh + merged validate/gate + core validate/verify; dry-run `remediate-v2-frontmatter.py`, then run via pipeline.
2. qmd central repair: define `notes_collection: protopulse-vault`; fix `mcp__qmd__qmd_*` names + `vsearch`→`query` across extract/verify/connect/revisit/seed.
3. Queue unblock: ralph null-`phase_order` fallback + queue-header repair; create `/enrich` (spec in the 26 task files) or inline; fix seed's claim-number scan.
4. Dead-weight sweep: delete ask-claude, "claude code guide", claude-cookbooks, claude-devfleet, screenshot-capture-super, the dangling claude-automation-recommender symlink; decide gemini-cli-maestro.

**Wave 2 — Correctness (verified-wrong content):**
5. breadboard-lab map rewrite + Legacy-vs-Engine jurisdiction section.
6. claude-meta copy-paste bugs: agent-sdk `cwd`, claude-api model table + rewire into shared/, clearthought allowed-tools, claude-md-mastery @import claim, notebooklm-knowledge-builder commands.
7. Audit-trio view model: derive from ViewMode union (36 views); fix fix-audit-failures' 3 wrong rows; add UI Container Rule checks to visual-audit.
8. Engine-awareness: check:/test:packages in ship/status; packages/ in resume + vault-index + vault-prefetch scan roots; docs/plans/ in scanners.

**Wave 3 — Infrastructure (make automation real):**
9. `scripts/sync-skills.sh` (adapt skill-sync-workflow): identical-class rsync + manifest vocabulary transform + rename map + lint pass; hook or cron it.
10. Dead-wiring go/no-go: vault-prefetch (register + consumer, or retire); vault-health cron; vault-index rebuild registration; vault-extract-priority (wire or retire).
11. Merges: vault-validate+quality-gate; vault-inbox→vault-gap; claude-skills+claude-extensibility (current frontmatter spec); claude-settings-audit→automation-recommender; status+resume.

**Wave 4 — Polish (token economy + freshness):**
12. Progressive-disclosure splits: extract, connect, rethink, revisit, ralph, graph, remember, verify (+ claude-in-notebooklm, nlm-skill core) with shared references/ for the 2-6x duplicated blocks.
13. Version refreshes with citations: codex-mastery, codex-tmux-teaming, claude-agent-sdk; collapse claude-codex-routing to alias+archive and update the global CLAUDE.md routing section.
14. Description-quality pass: add WHEN/trigger phrases to ship, status, resume, checklist-update, fix-audit-failures, visual-audit; negative trigger on refactor; rename or disambiguate verify.

*Report complete. Audited 2026-06-11 against main `20cad8f6` by five parallel read-only auditors; compiled by the session that performed the same day's remote-sync reset.*
