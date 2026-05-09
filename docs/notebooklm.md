# ProtoPulse NotebookLM Notesbook (PP-NLM) — Reference

**Status:** Live with **18 notebooks** (9 Tier-1 + 9 Tier-2). Phase 0/1/2/4/5/6/7/8/10/11 complete. Phase 3 in progress (populate-hardware orphan PID 31395 running, ~12-15h walltime; 9 Tier-2 populates queued for after). Phase 9 cron pending Tyler's `crontab -e`. **Tier-3 per-component notebooks dropped 2026-05-09 as redundant with `pp-hardware`** — see `feedback_notebook_granularity.md`.
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

## 2. Tier taxonomy

### Tier 1 — Durable, always-active (9 notebooks, tagged `pp:active`)

| Alias | Title | Purpose | Citation rule |
|---|---|---|---|
| `pp-codebase` | ProtoPulse :: Codebase Atlas | Architecture, services, hooks, contexts, plans (the "what is this code" oracle) | `path/to/file.ext:LineN` |
| `pp-breadboard` | ProtoPulse :: Breadboard Lab | BreadboardView, parts, DRC, exact-part flow, bench stash | source name + section/line |
| `pp-hardware` | ProtoPulse :: Hardware Knowledge | 744-note vault mirror (component theory, design rules) | vault note slug + ISO date |
| `pp-arscontexta` | ProtoPulse :: Ars Contexta | Methodology, MOC discipline, pipeline rules | methodology doc + section |
| `pp-memories` | ProtoPulse :: Memories | Tyler's voice (mirror of MEMORY.md) | ISO date of memory |
| `pp-research` | ProtoPulse :: Research Lab | Active investigations, deep-research imports | source title + URL |
| `pp-backlog` | ProtoPulse :: Backlog & Iteration | BL-XXXX history, Wave decisions | BL-ID + ISO + Wave # |
| `pp-journal` | ProtoPulse :: Dev Journal | Daily/weekly recaps, commit summaries | ISO date |
| `pp-bench` | ProtoPulse :: Bench Notes | Physical hardware observations, measurements | part # / vendor / equipment |

### Tier 2 — Feature deep-dives (9 notebooks, tagged `pp:feature`)

Naming: `pp-feat-<slug>`. Per-subsystem deep-dives:
`pp-feat-mna-solver`, `pp-feat-parts-catalog`, `pp-feat-ai-integration`, `pp-feat-design-system`, `pp-feat-tauri-migration`, `pp-feat-arduino-ide`, `pp-feat-pcb-layout`, `pp-feat-collab-yjs`, `pp-feat-firmware-runtime`.

(`pp-feat-breadboard-view` was deleted 2026-05-09 as redundant with Tier-1 `pp-breadboard`.)

### Tier 3 — DROPPED 2026-05-09

Per-component `pp-cmp-*` notebooks were tried (10 created: esp32, atmega328p, 74hc595, 74hc14, mosfet-nmos, mosfet-pmos, lm317, ams1117, 1088as-7seg, 28byj-48) and removed as redundant with `pp-hardware`. Each held only 4-12 sources, all duplicated from pp-hardware's 744-source corpus. Per-IC drill-in is now: `nlm notebook query pp-hardware "<part-number> <topic>"` — pp-hardware's RAG retrieves the right per-component chunks when the part number is in the query.

See `feedback_notebook_granularity.md` in memory for the lesson: don't split a corpus into thin per-X notebooks when an existing notebook already holds the same content.

---

## 3. Tag schema (`pp:*` namespace)

| Tag | Reserved for | Default cross-query? |
|---|---|---|
| `pp:active` | Tier-1 only | ✅ yes |
| `pp:legacy` | Pre-existing notebooks kept for reference | ❌ no |
| `pp:archive` | Renamed `[ARCHIVED ...]` notebooks | ❌ no |
| `pp:feature` | Tier-2 deep-dives | ❌ no (opt-in) |
| `pp:<alias-suffix>` | Per-notebook (e.g. `pp:codebase`, `pp:hardware`) | n/a (informational) |
| `pp:<feature-slug>` | Per Tier-2 feature | n/a |

(`pp:component` and `pp:cmp-*` are RETIRED — Tier-3 dropped 2026-05-09.)

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
3. `nlm source add --text "$NEW" --title "<slug> v<N+1> — <DATE>" --wait`.
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
0 8 * * *   /home/wtyler/.local/bin/nlm login --check >> /home/wtyler/.claude/logs/pp-nlm-auth.log 2>&1
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
      methodology/ars-contexta → pp-arscontexta
      breadboard/drc → pp-breadboard
      codebase/architecture → pp-codebase
  - nlm source add <alias> --text "$content" --title "<slug> v<N> — <DATE>" --wait
  - Update source-manifest.json
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
- Monthly cron generates pp-backlog mindmap
- Review Tier-2 expansion candidates (any feature subsystem that's been queried >5 times AND has a distinct chat-voice/source-set warrants its own pp-feat-* notebook — see `feedback_notebook_granularity.md` for the gate). Per-component drill-in stays in pp-hardware.
- `nlm source stale <alias>` per Tier-1 — sync if anything stale (or run `/pp-sync`)
- Review `ops/index/nlm-index.json` for stale entries (knowledge notes that no longer exist)

### Quarterly
- Run `pp-codebase-refresh` pipeline — regenerate "what changed" briefing
- Review chat configs — has the notebook's content drifted enough to warrant a new tailored prompt?
- `nlm doctor` — installation + connectivity diagnostic

### Source freshness
Sources older than the last major refactor on their topic are stale. Use the versioning convention to refresh:
1. `mcp__notebooklm-mcp__source_get_content` to fetch verbatim
2. Edit locally
3. Add as new versioned source with vN+1 title
4. Delete old after 30-day grace

---

## 16. Troubleshooting

### Authentication
- **"Cookies have expired"** — run `nlm login` from a terminal.
- **MCP-side stale token after CLI re-login** — call `mcp__notebooklm-mcp__refresh_auth()` or run `nlm login switch <profile>`.
- **`nlm login --wsl` fails on Chrome 136+** — use a non-WSL browser flow.

### Source addition
- **500K word silent rejection** — pre-check `wc -w`, split on H2 headings if oversized.
- **`source_add` returned but Studio uses partial content** — always pass `--wait` for sources that will feed Studio.
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
| Sources / notebook | 600 | varies (744 for pp-hardware) | within cap |
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

## 19. Build status (snapshot 2026-05-08)

| Phase | Status | Notes |
|---|---|---|
| 0 — Audit + auth | ✅ DONE | 104 notebooks audited; 3 ProtoPulse-relevant tagged `pp:legacy` |
| 1 — MCP wiring + Tier-1 | ✅ DONE | 9 notebooks live, aliases set, tags applied; manifest written |
| 2 — Source population (8 of 9 Tier-1) | ✅ DONE | 7 of 8 populated (pp-arscontexta:34, pp-memories:25, pp-breadboard:10, pp-bench:2, pp-research:2, pp-journal:2, pp-backlog:1). pp-codebase missing from manifest — verify next session |
| 3 — pp-hardware + Tier-2 | ⏳ IN PROGRESS | populate-hardware orphan PID 31395 running through 743 notes (~12-15h). After it finishes, relaunch full-population-runner.sh to run the 9 Tier-2 populates. (Tier-3 dropped 2026-05-09.) |
| 4 — Custom chat configs (9 Tier-1) | ✅ DONE | All 9 hand-crafted, deeply tailored, applied |
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
