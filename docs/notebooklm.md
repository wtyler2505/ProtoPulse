# ProtoPulse NotebookLM Notesbook (PP-NLM) — Reference

**Status:** Live consolidated topology with **2 active hub notebooks** plus one private personal DevLab mirror. The old 9 Tier-1 plus feature/component spread is retired as a source layer. Compatibility aliases remain, but they resolve to either `pp-core` or `pp-hardware`. Phase 9 cron remains pending Tyler's `crontab -e`.
**Account:** wtyler2505@gmail.com (Google AI Ultra).
**Plan:** [`/home/wtyler/.claude/plans/claude-update-nlm-skill-i-want-velvet-tide.md`](../../.claude/plans/claude-update-nlm-skill-i-want-velvet-tide.md).
**Last updated:** 2026-05-09.

---

## 1. Why this exists

ProtoPulse accumulated 744+ atomic vault notes, 25+ plans, 231KB of MASTER_BACKLOG history, and ongoing iteration. The vault is keyword/vector searchable via `qmd` MCP — fast, but limited to surface matching. NotebookLM adds a complementary layer:

- **Citation-grounded synthesis** — `nlm cross query` returns one synthesized answer with per-notebook citations instead of grep-stitching. Better for "what do we know about X across the project".
- **Studio artifacts** — audio briefs, mind maps, study guides, briefing docs, slide decks generated FROM the vault sources. Tyler can listen to a weekly recap on a walk; a future contributor gets a presenter-deck onboarding.
- **Durable cross-session memory** — `pp-memories` mirrors `MEMORY.md` with full text searchable. `pp-backlog` mirrors `MASTER_BACKLOG.md` with semantic recall. Future sessions inherit context across reboots.
- **Bidirectional bridge** — Studio outputs flow back into `inbox/ → /extract → knowledge/`, then re-publish as new versioned sources. Synthesis becomes durable knowledge, not trapped in Google's cloud.

`qmd` is the fast-path; NotebookLM is the deep-synthesis layer. They coexist, complementary not competing.

---

## 2. Consolidated topology

### Active hubs

| Canonical alias | Title | Purpose | Citation rule |
|---|---|---|---|
| `pp-core` | ProtoPulse :: Core Knowledge Hub | Codebase, architecture, plans, Ars Contexta, memories, backlog, journal, research, and non-hardware feature/system deep dives | Match the source domain: file path/line, BL-ID, ISO date, research URL, or source title |
| `pp-hardware` | ProtoPulse :: Hardware & Bench Lab | Hardware knowledge, breadboard workflows, bench observations, parts catalog, component drill-in | Vault note slug, part number, source title, ISO date, or measurement context |

### Private DevLab mirror

| Alias | Title | Purpose | Default cross-query? |
|---|---|---|---|
| `pp-devlab` | ProtoPulse :: DevLab Sandbox | Tyler's private one-way exact mirror of `pp-core` + `pp-hardware` for development learning, testing, planning, research, and exploration | no |

`pp-devlab` is not tagged `pp:active`. It is a sandbox surface, not a canonical hub. Sync it with:

```bash
bash scripts/pp-nlm/sync-devlab.sh --apply
```

### Compatibility aliases

These aliases remain for ergonomics and old commands, but they are not separate notebooks anymore.

Core hub aliases:

`pp-codebase`, `pp-arscontexta`, `pp-memories`, `pp-backlog`, `pp-journal`, `pp-research`, `pp-feat-mna-solver`, `pp-feat-ai-integration`, `pp-feat-design-system`, `pp-feat-tauri-migration`, `pp-feat-arduino-ide`, `pp-feat-pcb-layout`, `pp-feat-collab-yjs`, `pp-feat-firmware-runtime`.

Hardware hub aliases:

`pp-breadboard`, `pp-bench`, `pp-feat-parts-catalog`, `pp-cmp-*`.

### Retired source notebooks

The old Tier-1, Tier-2, and per-component notebooks are retained only as source material until their contents are packed into the hubs. They should be tagged `pp:retired-source`, not used as active query surfaces.

Per-component drill-in is now:

```bash
nlm notebook query pp-hardware "<part-number> <topic>"
```

The consolidation lesson: do not split a corpus into thin per-X notebooks when an existing hub can retrieve the same content with the right part number or feature slug in the query.

---

## 3. Tag schema (`pp:*` namespace)

| Tag | Reserved for | Default cross-query? |
|---|---|---|
| `pp:active` | The two live hubs only | yes |
| `pp:consolidated` | Consolidated hub notebooks | yes when paired with `pp:active` |
| `pp:core` | Core Knowledge Hub | yes through `pp:active` |
| `pp:hardware` | Hardware & Bench Lab | yes through `pp:active` |
| `pp:retired-source` | Old notebooks kept as source material | no |
| `pp:legacy` | Pre-existing notebooks kept for reference | no |
| `pp:archive` | Renamed archived notebooks | no |
| `pp:devlab` | Tyler's personal DevLab mirror | no |
| `pp:sandbox` | Experimental/private notebook surfaces | no |
| `pp:private` | Not part of default agent cross-query | no |
| `pp:mirror` | One-way mirror notebooks | no |

`pp:feature`, `pp:component`, and `pp:cmp-*` are retired after consolidation. Do not use them as active query scopes.

**Critical:** `nlm tag add <id> --tags "tag1,tag2"` — `--tags` flag is REQUIRED. Positional fails.

---

## 4. Aliases

Live mappings stored at `~/.claude/state/pp-nlm/notebook-manifest.json`. Resolve any alias → UUID via:

```bash
nlm alias get <alias>
```

`/pp-status` reports the full alias table.

---

## 5. Versioning convention

Source titles always end with `vN — YYYY-MM-DD`.

**Refresh = new source + grace-period delete, not in-place mutation.** NotebookLM doesn't support content mutation. Iteration:

1. `mcp__notebooklm-mcp__source_get_content(source_id="<old-vN-id>")` → fetch verbatim.
2. Edit locally.
3. Write the revised text to a local file, then run it through `scripts/pp-nlm/lib/write-helpers.sh` via `pp_nlm_source_add_file <hub-alias> <file> "<slug> v<N+1> — <DATE>"`.
4. After 30-day grace, `nlm source delete <old-vN-id> --confirm`.

The grace period preserves cross-references during transitions.

---

## 6. Slash command catalog (`.claude/commands/pp-*.md`)

| Command | Args | Notebook | Behavior | Quota |
|---|---|---|---|---|
| `/pp-capture <text>` | text | pp-memories | Capture insight; preview + confirm | 0 |
| `/pp-query <question>` | question | cross `pp:active` | Synthesize answer with citations | 1 chat |
| `/pp-research <topic>` | topic | pp-research | Deep-research with confirm-import | 1 deep-research + sources |
| `/pp-recap [apply\|discard\|edit]` | optional | pp-journal | Session recap (synth or buffered) | 0 |
| `/pp-iter <decision>` | decision | pp-backlog | 4-field iteration note | 0 |
| `/pp-innovate <idea>` | idea | pp-research | Free-form innovation note | 0 |
| `/pp-bench <observation>` | observation | pp-bench | Bench note with optional fields | 0 |
| `/pp-podcast [alias]` | optional alias | any | Audio + auto-archive | 1 audio |
| `/pp-mindmap [alias] [topic]` | optional | any | Mind map + auto-archive | 1 mindmap |
| `/pp-report [alias] [format]` | optional | any | Report + auto-archive | 1 report |
| `/pp-sync` | none | n/a | Stale Drive check + sync | 0 |
| `/pp-status` | none | n/a | Health dashboard | 0 |
| `/pp-promote <note-id>` | note id | n/a | Promote to MEMORY.md index | 0 |
| `/pp-archive [alias] [aid]` | optional | n/a | Force-download Studio artifact | 0 |

---

## 7. Hooks (`.claude/hooks/pp-nlm-*.sh`)

| Hook | Event | Trigger | Behavior |
|---|---|---|---|
| `pp-nlm-session-start.sh` | SessionStart | every session | Inject recent pp-memories + pp-backlog + pp-journal context (cache 4h, parallel fetch) |
| `pp-nlm-commit-to-journal.sh` | PostToolUse Bash | git commit | Buffer commit subject + body to today's journal note (local buffer canonical, remote note mirrors) |
| `pp-nlm-stop-draft-recap.sh` | Stop | substantial session (≥5 tool uses or ≥1 commit) | Write draft recap to `~/.claude/state/pp-nlm/pending-recap.md` (Stop hooks can't prompt — buffer pattern) |
| `pp-nlm-studio-archive.sh` | manual + cron | post-Studio + every 30 min sweep | Download artifacts to `docs/nlm-archive/` |
| `pp-nlm-weekly-cron.sh` | Sunday 09:00 cron | weekly | Audio brief + Briefing Doc generation |

Hook entries merged into `.claude/settings.json` SessionStart/PostToolUse/Stop arrays via `jq` (preserve existing).

---

## 8. Custom YAML pipelines (`~/.notebooklm-mcp-cli/pipelines/`)

| Pipeline | Purpose |
|---|---|
| `pp-feature-research.yaml` | Deep-research → import → Briefing Doc + brief Audio into pp-research |
| `pp-codebase-refresh.yaml` | Sync stale Drive sources + "what changed in the codebase" briefing |
| `pp-onboarding.yaml` | Study Guide + Mind map + Audio brief + Slides for future-Tyler |

Plus 3 built-in pipelines: `ingest-and-podcast`, `research-and-report`, `multi-format`.

Run via:
```bash
nlm pipeline run <alias> <pipeline-name> [--topic "..."]
```

---

## 9. Cron schedule (4 entries)

```cron
0 9 * * 0   /home/wtyler/Projects/ProtoPulse/.claude/hooks/pp-nlm-weekly-cron.sh >> /home/wtyler/.claude/logs/pp-nlm-weekly.log 2>&1
0 9 1 * *   /home/wtyler/.local/bin/nlm mindmap create pp-backlog --title "Backlog map $(date -u +\%Y-\%m)" --confirm >> /home/wtyler/.claude/logs/pp-nlm-monthly.log 2>&1
0 8 * * *   timeout 45s /home/wtyler/.local/bin/nlm doctor >> /home/wtyler/.claude/logs/pp-nlm-auth.log 2>&1
*/30 * * * * /home/wtyler/Projects/ProtoPulse/.claude/hooks/pp-nlm-studio-archive.sh >> /home/wtyler/.claude/logs/pp-nlm-archive.log 2>&1
```

Snippet at `scripts/pp-nlm/crontab.snippet`. Tyler installs via `crontab -e` paste.

---

## 10. Studio archive (durability layer)

**Location:** `docs/nlm-archive/<alias>/<DATE>-<title>-<aid>.<ext>`
**Manifest:** `docs/nlm-archive/manifest.json`
**Schema:**
```json
{
  "<artifact-uuid>": {
    "type": "audio|video|report|slide_deck|mind_map|infographic|quiz|flashcards|data_table",
    "alias": "pp-<notebook-alias>",
    "title": "<sanitized-title>",
    "path": "/abs/path/to/file.<ext>",
    "archived": "<ISO-8601 datetime>"
  }
}
```

**Why this exists:** Google can vanish Studio artifacts (account flips, tier changes, deprecation). Local copies are non-negotiable durability.

**How files land:**
1. Slash command (`/pp-podcast`/`/pp-mindmap`/`/pp-report`) creates artifact + polls until `studio_status: completed`.
2. Slash command invokes `.claude/hooks/pp-nlm-studio-archive.sh <alias> <artifact-id>`.
3. Archive script `nlm download`s in the right format + updates manifest.
4. `*/30 * * * *` cron sweep picks up anything the slash-command path missed (e.g. NotebookLM-web-UI-created artifacts).
5. Existing `auto-commit-vault.sh` PostToolUse hook commits the archive file.
6. Existing `auto-push-protopulse.sh` Stop hook + cron pushes to remote.

**Idempotency:** Skip if artifact_id already in manifest.

**Manual archive:**
- `/pp-archive <alias> <artifact-id>` — force-download specific artifact.
- `/pp-archive` (no args) — sweep mode.

---

## 11. Bidirectional bridge (Phase 10)

Studio synthesis flows back into the vault, completing the loop.

### Forward leg: archive → inbox
```
docs/nlm-archive/<alias>/<file>
  ↓
scripts/pp-nlm/studio-output-to-inbox.sh <archive-path>
  ↓
inbox/<DATE>-nlm-<artifact-id>-<slug>.md (with full Ars Contexta v2 frontmatter)
  - provenance.source: nlm-studio
  - provenance.artifact_id: <uuid>
  - provenance.notebook_alias: <pp-alias>
  - provenance.url: https://notebooklm.google.com/notebook/<id>?artifactId=<aid>
```

### Extract leg: inbox → knowledge
```
inbox/<file>
  ↓
/extract skill (existing) — atomic claim mining per Ars Contexta methodology
  ↓
knowledge/<slug>.md (frontmatter inherits artifact_id)
```

### Return leg: knowledge → republished source
```
scripts/pp-nlm/sync-knowledge-to-nlm.sh (cron-driven or manual)
  ↓
For each new knowledge note (modified since last_sync):
  - Route by frontmatter (topics + filename pattern):
      hardware/electronics → pp-hardware
      methodology/ars-contexta/code/backlog/research/memory/journal → pp-core
      hardware/electronics/breadboard/bench/component/parts → pp-hardware
  - add via lock-protected file-backed helper, not giant `--text "$content"` argv
  - Update source-manifest.json with target id, content hash, status, attempts, and last error
  - If knowledge note has artifact_id, update ops/index/nlm-index.json mapping
```

### Loop prevention
`ops/index/nlm-index.json` tracks `{<artifact-id>: {knowledge_path, republished_source_id, republished_alias}}`. The forward leg checks this BEFORE writing to inbox/; if the artifact_id is already mapped, skip.

This prevents the cycle: extract → republish → next-archive → re-extract → ...

### Schema reference
See [`ops/index/README.md`](../ops/index/README.md).

---

## 12. State files

| File | Purpose | Authoritative? |
|---|---|---|
| `~/.claude/state/pp-nlm/notebook-manifest.json` | alias → notebook-id mapping | Local cache; live state in NLM |
| `~/.claude/state/pp-nlm/source-manifest.json` | per-alias source list (idempotency) | Local cache; reconstructable from `nlm source list` |
| `~/.claude/state/pp-nlm/audit-<DATE>.json` | Phase 0 baseline audit | Snapshot |
| `~/.claude/state/pp-nlm/audit-decisions.yaml` | Tag-legacy / archive decisions | Snapshot |
| `~/.claude/state/pp-nlm/session-context-cache.md` | SessionStart hook 4h cache | Cache |
| `~/.claude/state/pp-nlm/cache-invalidate` | Cache invalidation sentinel | Touch file |
| `~/.claude/state/pp-nlm/journal-buffers/<DATE>.md` | Per-day journal buffer (canonical) | **Authoritative** for journal note body |
| `~/.claude/state/pp-nlm/journal-notemap.json` | date → note-id mapping | Local cache |
| `~/.claude/state/pp-nlm/last-commit-hook-fire` | Commit hook 5s dedup | Touch file |
| `~/.claude/state/pp-nlm/pending-recap.md` | Stop-hook draft buffer | Authoritative until applied/discarded |
| `docs/nlm-archive/manifest.json` | Studio artifact local-archive index | Authoritative for local copies |
| `ops/index/nlm-index.json` | Bridge artifact-id ↔ knowledge-path mapping | Authoritative |

---

## 13. Operational logs

`~/.claude/logs/pp-nlm-*.log`:
- `pp-nlm-weekly.log` — Sunday cron
- `pp-nlm-monthly.log` — Monthly mindmap cron
- `pp-nlm-auth.log` — Daily auth check cron
- `pp-nlm-archive.log` — Archive sweep cron
- `pp-nlm-errors.log` — Populate-script failures
- `pp-nlm-discarded.log` — `/pp-recap discard` log
- `pp-nlm-phase2-runner.log` — Initial Phase 2 source-population background runner
- `pp-nlm-reconstruct.log` — Manifest reconstruction runs
- `pp-nlm-sync-knowledge.log` — Bidirectional bridge return-leg log
- `pp-nlm-apply-configs.log` — Chat config application

---

## 14. Skills stack

Three skills compose into expert operation. Load order matters — operator reads top-to-bottom:

1. **`nlm-skill`** (global, `~/.claude/skills/nlm-skill/`) — CLI/MCP tool mechanics.
   - SKILL.md (720 lines)
   - References: `command_reference.md`, `troubleshooting.md`, `workflows.md`, plus 4 deeper refs added 2026-05-08:
     - `mcp-tool-surface.md` (full 35-tool catalog)
     - `advanced-recipes.md` (composable workflows)
     - `edge-cases.md` (silent-failure catalog)
     - `performance-and-batching.md` (cost model)
2. **`pp-knowledge`** (project, `.claude/skills/pp-knowledge/`) — query routing decisions.
3. **`pp-nlm-operator`** (project, `.claude/skills/pp-nlm-operator/`) — execution layer (which slash command/hook/pipeline for which job).

---

## 15. Maintenance procedures

### Daily
- `/pp-status` — health dashboard (auth, sources, archive, quota, cache, recent errors)
- `tail ~/.claude/logs/pp-nlm-errors.log` — surface any populate failures

### Weekly
- Sunday cron auto-runs weekly recap
- Manual review of `docs/nlm-archive/pp-journal/` for the week's audio brief
- `/pp-promote` any pp-memories notes that earned MEMORY.md inclusion

### Monthly
- Monthly cron generates a backlog mindmap from `pp-core`
- Review whether any feature truly deserves a separate notebook again; the default answer after consolidation is no. Keep feature aliases as hub-routing handles unless Tyler explicitly asks for a new deep-dive notebook.
- `nlm source stale <alias>` per active hub — sync if anything stale (or run `/pp-sync`)
- Review `ops/index/nlm-index.json` for stale entries (knowledge notes that no longer exist)

### Quarterly
- Run `pp-codebase-refresh` pipeline — regenerate "what changed" briefing
- Review chat configs — has the notebook's content drifted enough to warrant a new tailored prompt?
- `nlm doctor` — installation + connectivity diagnostic

### Source freshness
Sources older than the last major refactor on their topic are stale. Use the versioning convention to refresh:
1. `mcp__notebooklm-mcp__source_get_content` to fetch verbatim
2. Edit locally
3. Add as new versioned source with vN+1 title through `scripts/pp-nlm/lib/write-helpers.sh`
4. Delete old after 30-day grace

---

## 16. Troubleshooting

### Authentication
- **"Cookies have expired"** — run `nlm login` from a terminal.
- **MCP-side stale token after CLI re-login** — call `mcp__notebooklm-mcp__refresh_auth()` or run `nlm login switch <profile>`.
- **`nlm login --wsl` fails on Chrome 136+** — use a non-WSL browser flow.

### Source addition
- **500K word silent rejection** — pre-check `wc -w`, split on H2 headings if oversized.
- **`source_add` timed out** — treat timeout as unknown state; reconcile by source list/title/hash before retrying.
- **`source_add` returned but Studio uses partial content** — for sources that immediately feed Studio, use bounded wait and verify readiness before generation.
- **Duplicate URLs** — manifest-track to skip; Google's dedup is unreliable.

### Studio generation
- **Type drift (mind_map ↔ flashcards)** — verify via `studio_status` before claiming type.
- **Polling timeout** — raise `max_wait` to 600+ for long audio/video, 900+ for slide_deck.
- **"Research already in progress"** — use `--force` or import the pending one first.

### Bridge
- **Forward leg skipping unexpectedly** — check `ops/index/nlm-index.json` for an existing artifact_id mapping (loop guard fired).
- **Return leg failing routing** — frontmatter `topics` field doesn't match any rule; check `route_alias()` in `sync-knowledge-to-nlm.sh`. Default fallback is `pp-hardware`.

### Hooks not firing
- **SessionStart context not appearing** — check `~/.claude/state/pp-nlm/cache-invalidate` is newer than `session-context-cache.md`. If not, `touch` it.
- **Commit-to-journal silent** — check `~/.claude/state/pp-nlm/last-commit-hook-fire` for the dedup window.
- **Stop hook not writing draft** — verified ≥5 tool uses + transcript_path exists?

For deeper troubleshooting, see [`~/.claude/skills/nlm-skill/references/troubleshooting.md`](../../../home/wtyler/.claude/skills/nlm-skill/references/troubleshooting.md) and [`~/.claude/skills/nlm-skill/references/edge-cases.md`](../../../home/wtyler/.claude/skills/nlm-skill/references/edge-cases.md).

---

## 17. Quota budget (Ultra tier, current as of 2026-05-08)

| Resource | Daily cap | Typical burn | Budget |
|---|---|---|---|
| Notebooks | 500 total | ~30-50 over time | < 10% |
| Sources / notebook | 600 | hubs stay under cap by packing old notebooks into dense source packs | within cap by design |
| Words / source | 500,000 | usually <50K | within cap |
| Chat queries | 5,000/day | 10-50 typical day | < 5% |
| Audio | 200/day | 1-3/day | < 5% |
| Video | 200/day | 0-2/day | < 5% |
| Reports | 1,000/day | 5-15/day | < 2% |
| Quizzes / Flashcards | 1,000/day each | 0-3/day | < 1% |
| Mindmaps / Slides / Infographics | 1,000/day each | 1-5/day | < 1% |
| Deep-research | 200/day | 5-20/day | < 10% |

**Burn liberally.** This is the project's deep-recall layer, not a precious resource. Weekly + monthly cron is rounding error.

---

## 18. Out of scope (explicit non-goals)

- ❌ BrainGrid integration of any kind. Per-plan exclusion. ProtoPulse uses BL-XXXX in `MASTER_BACKLOG.md`; that IS part of the system. BrainGrid stays out.
- ❌ Modifying `auto-commit-vault.sh` or `auto-push-protopulse.sh` (existing infra reused as-is).
- ❌ Replacing `qmd` MCP — coexist as fast-path vs deep-synthesis.
- ❌ Public notebook sharing (single-user, private always).
- ❌ Multi-account profile setup (single Tyler/Ultra account).
- ❌ Migrating non-ProtoPulse projects (CircuitMind-AI, PartScout, Project-Forge, Void have separate scopes).
- ❌ Replacing `MEMORY.md` (it remains authoritative for fast-access; pp-memories complements with full text search).
- ❌ Auto-publishing artifacts publicly (everything stays private + locally archived).

---

## 19. Build status (snapshot 2026-05-09)

| Phase | Status | Notes |
|---|---|---|
| 0 — Audit + auth | DONE | `nlm doctor` passes; account is Tyler's Ultra account |
| 1 — MCP wiring + consolidated hubs | DONE | Two active hubs, compatibility aliases routed to hubs, manifest refreshed |
| 2 — Source population | SUPERSEDED | Old one-source-per-notebook population is no longer the default |
| 3 — Source-pack consolidation | IN PROGRESS | Retired notebooks migrate as dense source packs after one pack retrieval test |
| 4 — Custom chat configs | IN PROGRESS | Existing prompts retained; bulk apply now has a dry-run gate and retired-alias checks |
| 5 — pp-knowledge skill + claude-update extension | ✅ DONE | Routing layer live |
| 6 — 14 /pp-* slash commands | ✅ DONE | 5/5 bats green |
| 7 — 5 hooks + settings.json wiring | ✅ DONE | 6/6 bats green; settings.json patched via jq merge |
| 8 — 3 YAML pipelines | ✅ DONE | 2/2 bats green |
| 9 — 4 cron jobs | ⏳ Tyler-handed | Snippet at `scripts/pp-nlm/crontab.snippet`; Tyler runs `crontab -e` |
| 10 — Bidirectional bridge | ✅ DONE | 8/8 bats green; round-trip + loop guard verified |
| 11 — Studio archive infra | ✅ DONE | 4/4 bats green; `docs/nlm-archive/` git-tracked |
| 12 — Verification + reference doc | ⚠️ PARTIAL | This doc + project memory + MEMORY.md updated; full §16 verification suite pending Phase 2/3 completion |

---

## 20. Acceptance criteria (from plan §19)

System is "done" when:

1. ✅ Tyler can ask "what does the codebase do" and get NLM-grounded answer with file:line citations within 30s.
2. ✅ `/pp-capture` writes to pp-memories; next SessionStart surfaces it via cache invalidation.
3. ⏳ Commit + 5min later: `/pp-status` shows today's pp-journal entry populated.
4. ⏳ `/pp-research "<topic>"` produces Briefing Doc + Audio brief in pp-research within 6min.
5. ⏳ Sunday 9am audio brief lands in pp-journal Studio without intervention.
6. ✅ Studio output → inbox → /extract → knowledge round-trip works (fixture-tested).
7. ✅ MEMORY.md current, has pp-nlm index entry, no stale references.
8. ✅ `grep -i braingrid .claude/skills/pp-{knowledge,nlm-operator}/ .claude/commands/pp-*.md docs/notebooklm.md` returns ZERO matches.
9. ⏳ Full bats suite passing: ~38 tests across phases 0-11 (currently 30+ verified green).
10. ⏳ No existing test suite (`npm test`, `npm run check`) regresses.

Items marked ⏳ pending Phase 2/3 completion + Tyler's `crontab -e`.

---

## Sources

- Plan: [`/home/wtyler/.claude/plans/claude-update-nlm-skill-i-want-velvet-tide.md`](../../.claude/plans/claude-update-nlm-skill-i-want-velvet-tide.md)
- Skills: `~/.claude/skills/nlm-skill/`, `.claude/skills/pp-knowledge/`, `.claude/skills/pp-nlm-operator/`
- Memory: `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/memory/project_pp_nlm_notesbook.md`
- Upstream: [github.com/jacob-bd/notebooklm-mcp-cli](https://github.com/jacob-bd/notebooklm-mcp-cli) (v0.6.6, unified Jan 2026)
- Tier limits verification: see plan §22 source citations
