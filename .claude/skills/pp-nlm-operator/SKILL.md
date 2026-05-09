---
name: pp-nlm-operator
description: >
  Expert operator skill for ProtoPulse's PP-NLM Notesbook system. Use when running
  ANY substantial NotebookLM operation in this project — populating notebooks,
  generating Studio artifacts, running the bidirectional bridge, debugging the
  archive infrastructure, troubleshooting hooks, applying chat configs, or
  composing slash commands with direct nlm calls. This skill knows the 9 Tier-1
  taxonomy, the 14 /pp-* slash commands, the 5 hooks, the 3 custom YAML pipelines,
  the docs/nlm-archive/ durability layer, and the inbox/ → /extract → knowledge/
  → republish bidirectional bridge. Defers to global nlm-skill for tool mechanics
  and pp-knowledge for query-routing decisions; layers the OPERATOR knowledge
  (which tool/hook/command for which job) on top.
allowed-tools: Bash(nlm:*), Bash(jq:*), Bash(bats:*), Read, Write, Edit
---

# PP-NLM Notesbook Operator

You are the expert operator for ProtoPulse's NotebookLM system. Three skills you stack on:

1. **`nlm-skill` (global)** — CLI/MCP tool mechanics, command catalog, troubleshooting, workflows, MCP tool surface, advanced recipes, edge cases, performance.
2. **`pp-knowledge` (project)** — routing layer: which notebook holds which kind of question.
3. **`pp-nlm-operator` (this skill)** — execution layer: which slash command / hook / pipeline / direct call handles which job in this project's ecosystem.

When ALL three skills load together, you are flawless. Without operator-level knowledge, you'll burn quota, miss the bidirectional bridge, write to the wrong notebook, or claim Studio artifacts done that aren't.

---

## What you have to work with (the surface area)

### 9 Tier-1 notebooks (durable, always-active, tagged `pp:active`)
| Alias | ID env var | Use for |
|---|---|---|
| `pp-codebase` | — | Architecture, services, hooks, contexts, plans |
| `pp-breadboard` | — | BreadboardView, parts, DRC, exact-part flows |
| `pp-hardware` | — | Component theory, vault claims (744-note mirror) |
| `pp-arscontexta` | — | Methodology, MOC discipline, pipeline rules |
| `pp-memories` | — | Tyler's preferences, rules, anti-patterns |
| `pp-research` | — | Active investigations, deep-research imports |
| `pp-backlog` | — | BL-XXXX iteration history, Wave decisions |
| `pp-journal` | — | Daily/weekly recaps, commit summaries |
| `pp-bench` | — | Physical bench observations, measurements |

Resolve any alias to UUID: `nlm alias get <alias>`. Manifest at `~/.claude/state/pp-nlm/notebook-manifest.json`.

### Tier-2 (feature deep-dives, tagged `pp:feature`)
Created on demand. Naming: `pp-feat-<slug>`. Initial 10 listed in plan §5b. Hard cap 50.

### Tier-3 (component refs, tagged `pp:component`)
Per-IC datasheet bundles. Naming: `pp-cmp-<slug>`. Open-ended. 50-100+ expected over time. **Excluded from default `pp:active` cross-query.**

### 14 `/pp-*` slash commands (`.claude/commands/pp-*.md`)
| Command | What it does | Quota |
|---|---|---|
| `/pp-capture <text>` | Note → pp-memories | 0 |
| `/pp-query <question>` | Cross-query active corpus | 1 chat |
| `/pp-research <topic>` | Deep-research → pp-research with confirm-import | 1 deep-research + sources |
| `/pp-recap [apply\|discard\|edit]` | Session recap → pp-journal | 0 |
| `/pp-iter <decision>` | 4-field iteration note → pp-backlog | 0 |
| `/pp-innovate <idea>` | Free-form innovation → pp-research | 0 |
| `/pp-bench <observation>` | Bench note → pp-bench (with optional fields prompt) | 0 |
| `/pp-podcast [alias]` | Audio + auto-archive | 1 audio |
| `/pp-mindmap [alias] [topic]` | Mind map + auto-archive | 1 mindmap |
| `/pp-report [alias] [format]` | Report + auto-archive | 1 report |
| `/pp-sync` | Stale Drive check + sync (with confirm) | 0 |
| `/pp-status` | Health dashboard | 0 |
| `/pp-promote <note-id>` | Promote pp-memories note → MEMORY.md | 0 |
| `/pp-archive [alias] [aid]` | Force-download Studio artifact | 0 |

### 5 hooks (`.claude/hooks/pp-nlm-*.sh`)
| Hook | Event | Trigger | Behavior |
|---|---|---|---|
| `pp-nlm-session-start.sh` | SessionStart | every session | Inject recent pp-memories + pp-backlog + pp-journal context (cache 4h) |
| `pp-nlm-commit-to-journal.sh` | PostToolUse / Bash | git commit | Buffer commit + sync to pp-journal note |
| `pp-nlm-stop-draft-recap.sh` | Stop | substantial session (≥5 tool uses or ≥1 commit) | Write draft recap to `~/.claude/state/pp-nlm/pending-recap.md` |
| `pp-nlm-studio-archive.sh` | invoked manually + cron | post-Studio-create + every 30 min | Download artifacts to `docs/nlm-archive/` |
| `pp-nlm-weekly-cron.sh` | Sunday 09:00 cron | weekly | Audio brief + Briefing Doc |

### 3 custom YAML pipelines (`~/.notebooklm-mcp-cli/pipelines/pp-*.yaml`)
- `pp-feature-research` — research → import → Briefing Doc + Audio brief into pp-research
- `pp-codebase-refresh` — sync stale Drive + "What changed" briefing
- `pp-onboarding` — Study Guide + Mind map + Audio brief + Slides for future-Tyler

### Cron schedule (4 entries)
```
0 9 * * 0   pp-nlm-weekly-cron.sh         # weekly audio + report
0 9 1 * *   nlm mindmap create pp-backlog # monthly backlog map
0 8 * * *   nlm login --check             # daily auth check
*/30 * * * * pp-nlm-studio-archive.sh     # archive sweep
```

### Studio archive (`docs/nlm-archive/`)
- `manifest.json`: `{<artifact-id>: {type, alias, title, path, archived}}`
- Per-alias subdirs: `pp-codebase/`, `pp-journal/`, etc.
- Files: `<YYYY-MM-DD>-<sanitized-title>-<aid>.<ext>`
- Idempotent: `pp-nlm-studio-archive.sh` skips already-archived.

### Bidirectional bridge (Phase 10)
- `scripts/pp-nlm/studio-output-to-inbox.sh <archive-path>`: Writes `inbox/<DATE>-nlm-<aid>-<slug>.md` with `provenance.source: nlm-studio`.
- `/extract` skill recognizes the provenance, mines atomic claims into `knowledge/`.
- `scripts/pp-nlm/sync-knowledge-to-nlm.ts`: Watches knowledge/, republishes new notes as versioned sources on the appropriate Tier-1.
- `ops/index/nlm-index.json`: `{<artifact-id>: {knowledge_path}}` prevents extract loops.

---

## Operator decision tree (which surface to use for which job)

### Tyler asks a question
1. **Domain spans tiers / unsure** → `/pp-query <question>`
2. **Specific Tier-1** → defer to `pp-knowledge` skill for routing → `nlm notebook query <alias> "..."`
3. **Specific feature deep-dive** → `nlm notebook query pp-feat-<slug> "..."`
4. **Specific component** → `nlm notebook query pp-cmp-<slug> "..."`
5. **Cross-tier including Tier-2/3** → `nlm cross query --tags "pp:active,pp:feature" "..."` (note explicit tag list, not just `pp:active`)

### Tyler wants to capture something
1. **A preference / rule / gotcha** → `/pp-capture`
2. **A BL-XXXX iteration decision** → `/pp-iter`
3. **An innovation idea / what-if** → `/pp-innovate`
4. **A bench measurement** → `/pp-bench` (prompts for part / vendor / batch / equipment)
5. **A session recap (now)** → `/pp-recap`
6. **A session recap (deferred draft from prior session)** → `/pp-recap apply` / `discard` / `edit`

### Tyler wants synthesis output
1. **Audio brief** → `/pp-podcast [alias]` (default `pp-journal`)
2. **Mind map** → `/pp-mindmap [alias] [topic]` (default `pp-codebase`)
3. **Report** → `/pp-report [alias] [format]` (default `pp-codebase` Briefing Doc)
4. **Multi-artifact (audio + report + flashcards)** → `nlm pipeline run <alias> multi-format`
5. **Custom orchestration (research + Briefing + audio chained)** → `nlm pipeline run pp-research pp-feature-research --topic "..."`
6. **Slide deck for onboarding** → `nlm pipeline run <alias> pp-onboarding`

### Tyler wants to research
1. **Quick (~30s, ~10 sources)** → direct `nlm research start "..." --notebook-id pp-research --mode fast` then import after review
2. **Deep (~5min, ~40-80 sources)** → `/pp-research <topic>` (handles polling + import confirm)
3. **Topic with planned downstream synthesis** → `nlm pipeline run pp-research pp-feature-research --topic "..."`

### Tyler wants to know system health
1. `/pp-status` — health dashboard (auth, sources, archive, quota, cache)
2. `nlm doctor` — installation + connectivity diagnostic
3. `nlm tag list` — taxonomy state
4. `tail ~/.claude/logs/pp-nlm-*.log` — recent operations

### Bridge operations (after Studio create completes)
1. **Single artifact**: `bash scripts/pp-nlm/studio-output-to-inbox.sh <path>` then `/extract`.
2. **Sweep mode**: rely on `*/30` cron + `/pp-archive` for archival; manual `/extract inbox/` for extraction.
3. **Verify republish**: check `ops/index/nlm-index.json` for the artifact-id mapping; check `pp-hardware` source list for the new versioned source.

### Maintenance / setup
1. **New Tier-2 notebook**: manual `nlm notebook create "ProtoPulse :: Feature — <Name>"` + `nlm alias set pp-feat-<slug> <id>` + `nlm tag add <id> --tags "pp:feature,pp:feat-<slug>"`. Apply hand-crafted chat config.
2. **New Tier-3 component**: same shape with `pp:component,pp:cmp-<slug>` tags. Excluded from default cross-query.
3. **Apply chat config to new notebook**: hand-craft `data/pp-nlm/chat-configs/<alias>.txt` (DEEP, notebook-specific — see `feedback_no_bulk_scripts_for_craft_work`), then `PROMPT="$(cat ...)" && nlm chat configure <alias> --goal custom --prompt "$PROMPT"`.
4. **Refresh stale source**: `nlm source_get_content <old-vN-id>` → edit → `nlm source add <alias> --text "$NEW" --title "<slug> v<N+1> — <DATE>" --wait` → 30-day grace → delete old.

---

## Critical hard rules (NON-NEGOTIABLE)

1. **NEVER claim a Studio artifact "generated" without `studio_status: completed` verification.**
2. **NEVER bulk-script chat configs.** Each notebook gets a hand-crafted, deeply tailored prompt.
3. **NEVER skip the bidirectional bridge.** Studio outputs flow through `inbox/ → /extract → knowledge/`, not directly into vault.
4. **NEVER let Studio artifacts live only in NotebookLM cloud.** Every artifact gets archived to `docs/nlm-archive/` (auto via hook + cron).
5. **NEVER auto-confirm destructive ops.** Every `confirm=True` op gets an AskUserQuestion in the calling slash command.
6. **NEVER paraphrase citations.** Quote what `nlm` returns verbatim.
7. **NEVER reference BrainGrid in pp-* skills/commands/hooks.** Per-plan exclusion. (Memories notebook can mention BrainGrid as historical context.)
8. **ALWAYS verify auth before substantive work.** `nlm login --check`; bail with clear error if false.
9. **ALWAYS manifest-track populates.** Idempotency requires it.
10. **ALWAYS use `--tags` flag with `nlm tag add`.** Positional doesn't work (verified Phase 1, 2026-05-08).

---

## Operator gotchas specific to ProtoPulse setup

### Hook firing
- `pp-nlm-session-start.sh` fires every session start. Cache TTL 4h; invalidated by `~/.claude/state/pp-nlm/cache-invalidate` touch.
- `pp-nlm-commit-to-journal.sh` matches all `Bash` calls but filters via `git log -1` + 5s dedup.
- `pp-nlm-stop-draft-recap.sh` writes draft only if ≥5 tool uses OR ≥1 commit AND no existing draft. Stop hooks **cannot prompt** — buffer pattern.
- Settings.json edits to add hooks must be done via `jq` merge (preserve existing entries). Backup first.

### `auto-commit-vault.sh` interactions
- Studio archive files land in `docs/nlm-archive/` → triggers Write hook → auto-commits.
- `manifest.json` updates also commit.
- Result: every artifact archive produces a commit. Auto-push fires on session-end.

### Tag schema enforcement
- `pp:active` reserved for Tier-1 only.
- `pp:feature` reserved for Tier-2.
- `pp:component` reserved for Tier-3.
- `pp:legacy` for relevant-but-archived prior notebooks (not part of pp-* taxonomy).
- `pp:archive` for stale archived notebooks.

### Default cross-query scope
- `nlm cross query --tags pp:active` returns Tier-1 only.
- For Tier-2 inclusion: `--tags "pp:active,pp:feature"`.
- For everything: `--tags "pp:active,pp:feature,pp:component"` (or use `--all`).

### Source-manifest path
- `~/.claude/state/pp-nlm/source-manifest.json`. Populated by populate scripts. Idempotency-critical.
- `notebook-manifest.json` (sibling) tracks notebook IDs.

### Studio archive path
- Files: `/home/wtyler/Projects/ProtoPulse/docs/nlm-archive/<alias>/<DATE>-<title>-<aid>.<ext>`
- Manifest: `/home/wtyler/Projects/ProtoPulse/docs/nlm-archive/manifest.json`
- Auto-tracked in git (NOT gitignored).

---

## Common operator tasks (with the exact commands)

### Daily inspection
```
/pp-status              # full dashboard
nlm tag list            # taxonomy state
tail -20 ~/.claude/logs/pp-nlm-archive.log   # recent archives
tail -5 ~/.claude/logs/pp-nlm-errors.log     # any failures
```

### Heavy populate run
```
# Background launch with logging
nohup bash scripts/pp-nlm/populate-hardware.sh \
  > ~/.claude/logs/pp-nlm-hardware.log 2>&1 &
echo "PID: $!"

# Monitor (single notification on exit, no context burn)
Monitor: until ! kill -0 <PID> 2>/dev/null; do sleep 30; done; echo "exited"

# After completion, verify
jq -r '.["pp-hardware"] | length' ~/.claude/state/pp-nlm/source-manifest.json
nlm source list pp-hardware --quiet | wc -l
# Both should match (or remote ≤ local if source skips happened)
```

### Adding a new Tier-2 feature notebook
```
ID=$(nlm notebook create "ProtoPulse :: Feature — Yjs Collaboration" 2>&1 | grep -oE '[0-9a-f-]{36}' | head -1)
nlm alias set pp-feat-collab-yjs "$ID"
nlm tag add "$ID" --tags "pp:feature,pp:feat-collab-yjs"
# Hand-craft chat config:
$EDITOR data/pp-nlm/chat-configs/pp-feat-collab-yjs.txt
# Apply:
PROMPT="$(cat data/pp-nlm/chat-configs/pp-feat-collab-yjs.txt)"
nlm chat configure pp-feat-collab-yjs --goal custom --prompt "$PROMPT"
# Populate sources via scripts/pp-nlm/populate-pp-feat-collab-yjs.sh (also hand-crafted per file selection).
```

### Generating + archiving an audio brief
```
# /pp-podcast pp-codebase
# (slash command does the polling + archive trigger)
# OR manually:
ARTIFACT=$(nlm audio create pp-codebase --format deep_dive --length default --confirm 2>&1 | grep -oE '[0-9a-f-]{36}' | head -1)
# Poll
while [ "$(nlm studio status pp-codebase --json | jq -r --arg id "$ARTIFACT" '.artifacts[] | select(.id == $id) | .status')" != "completed" ]; do
  sleep 30
done
# Archive
bash .claude/hooks/pp-nlm-studio-archive.sh pp-codebase "$ARTIFACT"
# Verify
jq --arg id "$ARTIFACT" '.[$id]' docs/nlm-archive/manifest.json
```

### Bridge round-trip verification
```
# 1. Pick a recent archive entry
ART=$(jq -r 'to_entries[0]' docs/nlm-archive/manifest.json)
ART_ID=$(echo "$ART" | jq -r '.key')
PATH=$(echo "$ART" | jq -r '.value.path')

# 2. Drop into inbox
bash scripts/pp-nlm/studio-output-to-inbox.sh "$PATH"
ls inbox/*nlm-$ART_ID*

# 3. Extract (manual via /extract slash command)
# /extract inbox/<the file>

# 4. Verify knowledge note exists with provenance
grep -l "provenance.source: nlm-studio" knowledge/*.md | head -1
grep -l "$ART_ID" knowledge/*.md

# 5. Verify nlm-index.json mapping
jq --arg id "$ART_ID" '.[$id]' ops/index/nlm-index.json
```

### Recovering from failed populate
```
# Failure logged to errors.log
cat ~/.claude/logs/pp-nlm-errors.log

# Re-run populate (manifest skips already-done)
bash scripts/pp-nlm/populate-<alias>.sh

# If specific source persists in failure, manually add:
nlm source add <alias> --text "$(cat /path/to/file.md)" --title "<slug> v1 — $(date -u +%Y-%m-%d)" --wait
```

---

## Verification rituals

After ANY substantial operation:
1. `/pp-status` — overall health.
2. Cross-check manifest vs remote: `for nb in pp-codebase pp-hardware pp-journal; do echo "$nb: local=$(jq -r --arg a "$nb" '.[$a] // [] | length' ~/.claude/state/pp-nlm/source-manifest.json) remote=$(nlm source list "$nb" --quiet | wc -l)"; done`
3. Studio archive consistency: `jq -r 'to_entries[] | select(.value.path != "") | .value.path' docs/nlm-archive/manifest.json | xargs -I{} test -f {} || echo "missing files exist"`
4. Hooks firing: `tail ~/.claude/logs/pp-nlm-*.log | head -20`

If any drift: investigate before next operation. Don't compound on inconsistency.

---

## When to defer to other skills

- **Tool mechanics, command flags, parameter shapes** → `nlm-skill` (global). I don't duplicate that surface here.
- **"Which notebook holds X" routing** → `pp-knowledge` (project). I don't duplicate the routing tables.
- **Writing skills/commands/hooks for this project** → `claude-extensibility` + `slash-commands-mastery` + `hooks-mastery` + `claude-skills` (global). I assume those are stacked.
- **Vault pipeline mechanics (extract/connect/revisit)** → `extract`, `pipeline`, `connect`, `revisit` (project). The bidirectional bridge composes these.
- **Plan template structure** → `superpowers:writing-plans` + `feedback_real_research_always` rules.

---

## Out of scope for this skill

- BrainGrid integration of any kind (per ProtoPulse plan).
- Public sharing / multi-user collaboration on notebooks.
- Cross-project NotebookLM operations (other Tyler projects have their own operator skills).
- The `nlm` CLI's own development / contribution (use the upstream repo for that).

---

## Source URLs

- [notebooklm-mcp-cli MCP_GUIDE.md](https://github.com/jacob-bd/notebooklm-mcp-cli/blob/main/docs/MCP_GUIDE.md) — authoritative tool surface.
- [notebooklm-mcp-cli releases](https://github.com/jacob-bd/notebooklm-mcp-cli/releases) — track changelog for feature deltas.
- ProtoPulse plan: `/home/wtyler/.claude/plans/claude-update-nlm-skill-i-want-velvet-tide.md`.
- `pp-knowledge` skill: `.claude/skills/pp-knowledge/SKILL.md`.
- nlm-skill (global) v0.6.6: `~/.claude/skills/nlm-skill/SKILL.md`.
