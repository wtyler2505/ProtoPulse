# NotebookLM Infrastructure Rethink

Date: 2026-05-09
Scope: ProtoPulse PP-NLM CLI/MCP usage, logs, skills, hooks, manifests, and consolidation workflow
Status: proposal pack, not implemented

## Why This Pass Happened

Tyler called a stop on the "too many ProtoPulse notebooks" shape and asked for a hard rethink of the NotebookLM infrastructure after real CLI/MCP use. This report captures the evidence from that pause so the next work is based on what actually broke.

The top-level finding is simple: the architecture has moved toward two hub notebooks, but the local automation still mostly assumes 9 Tier-1 notebooks plus feature/component side notebooks. That mismatch is now the main source of risk.

## Current Live Shape

Live MCP tag state shows two active consolidated notebooks:

- `ProtoPulse :: Core Knowledge Hub` (`7565a078-8051-43ea-8512-c54c3b4d363e`) tagged `pp:active`, `pp:consolidated`, `pp:core`.
- `ProtoPulse :: Hardware & Bench Lab` (`bb95833a-926e-47b1-8f45-d23427fbc58d`) tagged `pp:active`, `pp:consolidated`, `pp:hardware`, `pp:breadboard`, `pp:bench`, `pp:component`.

Live alias probes showed the old aliases now resolve to the two hubs:

- Core hub: `pp-core`, `pp-codebase`, `pp-arscontexta`, `pp-memories`, `pp-backlog`, `pp-journal`, `pp-research`, most feature aliases.
- Hardware hub: `pp-hardware`, `pp-breadboard`, `pp-bench`, `pp-feat-parts-catalog`, `pp-cmp-*`.

But `~/.claude/state/pp-nlm/notebook-manifest.json` still maps aliases like `pp-codebase`, `pp-backlog`, and `pp-memories` to their old notebook IDs. The source manifest is also still keyed by old aliases and has no `pp-core` entry. That means the live NLM routing layer and the local idempotency layer no longer describe the same system.

## Evidence Snapshot

Relevant local artifacts inspected:

- `.claude/skills/pp-nlm-operator/SKILL.md`
- `.claude/skills/pp-knowledge/SKILL.md`
- `scripts/pp-nlm/lib/source-helpers.sh`
- `scripts/pp-nlm/phase2-runner.sh`
- `scripts/pp-nlm/full-population-runner.sh`
- `scripts/pp-nlm/sync-knowledge-to-nlm.sh`
- `data/pp-nlm/chat-configs/*.txt`
- `~/.claude/logs/pp-nlm-*.log`
- `~/.claude/state/pp-nlm/source-manifest.json`
- `~/.claude/state/pp-nlm/notebook-manifest.json`

Log counts:

- `pp-nlm-errors.log`: 169 failure rows.
- Failure distribution: 167 `pp-hardware`, 1 `pp-backlog`, 1 `pp-memories`.
- `pp-nlm-full-population.log`: 167 `Error: Could not add text source` rows.
- `pp-nlm-apply-configs.log`: 8 `--prompt is required when goal is 'custom'` rows from an earlier missing/empty config pass.
- `pp-nlm-phase2-runner.log`: duplicate-looking log rows caused by teeing into the same log that also receives process stdout.

Tool health:

- `nlm --version` reported `0.6.6` and "latest".
- `uv tool list` showed `notebooklm-mcp-cli v0.6.6`.
- `nlm doctor` passed and confirmed account `wtyler2505@gmail.com`.
- In this pass, one direct `nlm login --check` process hung until killed, while `nlm doctor` succeeded.

## Rethink Findings

### 1. Topology Drift

The operator skill still opens with "9 Tier-1 notebooks" and "9 Tier-2 feature deep-dives" even though the live aliases are collapsed into Core and Hardware. The router skill still tells agents to query per-domain aliases as though they are separate notebooks.

Impact: an agent can do the technically "right" thing according to the skill and still operate against stale mental models, stale manifests, or retired tags.

### 2. Manifest Drift

The live alias layer has changed, but `notebook-manifest.json` still points to old notebooks. `source-manifest.json` records successful adds under old aliases, while recent MCP adds to Core were not recorded there.

Impact: idempotency is now title-only and alias-keyed against a topology that no longer exists. Re-runs can skip the wrong thing, retry something that already landed, or lose the relationship between original source ID, copied source ID, and content hash.

### 3. Large Text Through CLI Arguments Is Broken

Both `source-helpers.sh` and `sync-knowledge-to-nlm.sh` read full files into shell variables and call:

```bash
nlm source add "$alias" --text "$content" --title "$title" --wait
```

The backlog source failed with `Argument list too long` at `source-helpers.sh:76` while trying to pass a 34,688-word snapshot as a command argument.

Impact: the exact source type most likely to matter in consolidated hubs is the one most likely to break the current helper.

### 4. `--wait` Turns Adds Into Long Blocking Failure Points

Hardware population hit 167 `Could not add text source` failures while using `--wait`. During consolidation, a file add through MCP timed out after 120 seconds but later proved to have landed and could be renamed. A small Backlog pack add succeeded only after roughly 83 seconds and still returned `ready: false`.

Impact: "operation timed out" and "source did not land" are not equivalent. The current helper treats them as equivalent and has no post-timeout reconciliation step.

### 5. Logging Has No Single Owner

The Phase 2 runner uses `tee -a "$LOG"` internally. If launched with stdout redirected to the same file, each log line is written twice. This looked like duplicate execution during live triage.

Impact: operators waste time distinguishing real duplicate processes from duplicated observability. It also makes failure counts noisier.

### 6. Old Tags Still Expose Retired Notebooks

MCP `tag list` showed old feature notebooks still tagged `pp:feature` and old component notebooks still tagged `pp:component`, even though aliases now point to hubs and `pp:component` is marked retired in the operator skill.

Impact: `nlm cross query --tags "pp:active,pp:feature"` can still pull old feature notebooks, which contradicts Tyler's consolidation goal.

### 7. Auth Check Needs a Timeout

`nlm doctor` passed quickly enough to be useful. A direct `nlm login --check` hung during this pass and had to be killed.

Impact: any hook or runner that begins with an unbounded auth check can silently block the whole workflow.

### 8. Chat Config Automation Has A Craft/Batch Boundary Problem

The current chat config files exist and are non-empty, but the apply log shows an earlier bulk pass attempted custom config calls with empty prompt values. The operator hard rule says not to bulk-script craft work, yet `apply-chat-configs.sh` bulk-applies everything in `data/pp-nlm/chat-configs`.

Impact: there is a valid bulk operation here, but only after a preflight proves each prompt is hand-crafted, non-empty, below cap, and still targets a live notebook.

## Meta-Patterns

### Single Writer, Many Readers

This pattern appears in database migrations, message queues, cache invalidation, and NLM source writes. Reads can be parallel and cached. Writes must be serialized, lock-protected, and reconciled.

For PP-NLM: one writer lock for source/tag/chat-config mutations; parallel reads only for source exports and audits.

### Idempotency Needs Stable Identity, Not Friendly Names

This pattern appears in deployment systems, sync engines, data importers, and distributed job queues. Titles are presentation fields, not identity fields.

For PP-NLM: every source add should track target notebook ID, source title, original source ID if copied, local path, content hash, added source ID, attempt count, status, and last error.

### A Timeout Is An Unknown State

This pattern appears in HTTP clients, payment processors, CI jobs, and remote file uploads. A timeout after a write request is not proof of failure.

For PP-NLM: every timeout should enter `unknown` state and run reconciliation before retry.

### Consolidation Changes The Unit Of Work

This pattern appears in monorepo migrations, data warehouse compaction, document archives, and knowledge bases. Once the goal changes from "mirror every leaf" to "make a useful hub," one-to-one copy stops being the right primitive.

For PP-NLM: source packs by retired notebook or subject beat 260 one-to-one source copies. The project wants fewer places to think, not perfect notebook archaeology.

## R&D Hypotheses

### H1: File-backed source adds are safer than text-argument adds

Validation criteria:

- A generated `.txt` pack can be added through `nlm source add --file`.
- The landed source title can be reconciled after a timeout.
- No `Argument list too long` failure is possible because the content is not passed as argv.

Falsification criteria:

- NotebookLM rejects text/markdown files via `--file`, or file adds consistently land malformed content.

### H2: Pack migration is the right consolidation primitive

Validation criteria:

- A pack preserves original notebook, source ID, title, and content delimiter metadata.
- Core and Hardware remain under Tyler's source limit with room for future sources.
- Query quality is good enough against a pack source for backlog/research/journal material.

Falsification criteria:

- NotebookLM retrieval cannot cite or retrieve individual sections inside a pack well enough for operational use.

### H3: Timeout-plus-reconcile can make NLM writes safe enough

Validation criteria:

- A helper can classify add results as `added`, `already_present`, `unknown_reconciled`, `failed`, or `timeout_unresolved`.
- Retrying a timed-out add does not duplicate landed sources.

Falsification criteria:

- Source list APIs are too slow/unreliable to reconcile within a bounded period.

## Proposal Pack

### Proposal 1: Canonicalize The Two-Hub Topology

Change files:

- `.claude/skills/pp-nlm-operator/SKILL.md`
- `.claude/skills/pp-knowledge/SKILL.md`
- `docs/notebooklm.md`
- `~/.claude/state/pp-nlm/notebook-manifest.json`

Change:

- Replace the old 9 Tier-1 / 9 Tier-2 routing language with Core Hub and Hardware Hub routing.
- Treat old aliases as compatibility aliases, not separate notebooks.
- Update notebook manifest to the live alias IDs.
- Mark old feature/component notebooks as retired unless Tyler wants to keep one or two deep-dive notebooks alive.

Risk:

- If Claude is relying on old feature notebooks during current development, tag cleanup could surprise it. Mitigation: update docs first, then tags.

Reversible:

- Yes. Aliases and docs can be restored.

### Proposal 2: Replace One-To-One Migration With Source Packs

Change files:

- Add `scripts/pp-nlm/build-consolidation-packs.sh` or equivalent.
- Add `data/pp-nlm/consolidation/manifest.json`.
- Stop using the 260-source one-to-one copy plan as the default.

Change:

- Build one pack per retired notebook or subject group.
- Include source delimiters with original notebook alias, original notebook ID, original source ID, original title, copied-at timestamp, and content hash.
- Add packs to Core/Hardware with clear titles like `ProtoPulse Consolidated Source Pack :: Backlog`.

Risk:

- Retrieval inside a pack may be less granular than separate sources. Mitigation: test queries against the pack before deleting or hiding old source notebooks.

Reversible:

- Yes. Old notebooks remain until Tyler approves final retirement.

### Proposal 3: Create A Safe NLM Write Helper

Change files:

- Add `scripts/pp-nlm/lib/write-helpers.sh`
- Update `source-helpers.sh`
- Update `sync-knowledge-to-nlm.sh`

Change:

- Use `flock` for all write operations.
- Use temp files or `--file` for large text instead of `--text "$content"`.
- Use `--wait-timeout` explicitly or avoid `--wait` for bulk adds.
- Record `unknown` on timeout, then reconcile by source title/hash before retrying.
- Record richer manifest rows: target ID, target alias, title, original source ID, source kind, content hash, remote source ID, status, attempts, last error.

Risk:

- Requires careful testing against one disposable/safe source before broad use.

Reversible:

- Yes. Helper can coexist with current scripts until proven.

### Proposal 4: Add Bounded Health Commands

Change files:

- Add `scripts/pp-nlm/health.sh`
- Update `/pp-status` if that command exists in the active Claude command set.

Change:

- Use `timeout 30s nlm doctor` as the primary install/auth probe.
- Use `timeout` around `nlm login --check`.
- Show live alias map, tag map, local manifests, and unresolved `unknown` source writes.

Risk:

- Health output may report false warnings while Google APIs are slow. Mitigation: warn, do not block, unless writes are requested.

Reversible:

- Yes.

### Proposal 5: Make Logging Single-Owner

Change files:

- `scripts/pp-nlm/phase2-runner.sh`
- `scripts/pp-nlm/full-population-runner.sh`
- population launch docs

Change:

- Either internal scripts own logging with `exec > >(tee -a "$LOG") 2>&1`, or launchers redirect stdout, but not both into the same file.
- Add a lock file per long-running population/migration job.

Risk:

- Minor shell portability concerns.

Reversible:

- Yes.

### Proposal 6: Gate Chat Config Bulk Apply

Change files:

- `scripts/pp-nlm/apply-chat-configs.sh`
- `data/pp-nlm/chat-configs/README.md`

Change:

- Add a dry-run preflight.
- Fail on empty prompt, missing file, over-cap prompt, retired alias, or prompt that references dropped notebooks like `pp-cmp-*`.
- Apply only to current live hub aliases by default.

Risk:

- Old deep-dive prompt configs may be skipped until explicitly kept.

Reversible:

- Yes.

## Recommended Sequence

1. Update docs and skills to declare the two-hub topology.
2. Add the bounded health command and manifest reconciliation report.
3. Build one small pack and add it with the safe helper.
4. Validate retrieval quality from that pack.
5. Migrate the remaining old notebooks as packs.
6. Clean old `pp:feature` and `pp:component` tags only after pack retrieval is acceptable.

## Approval Gate

Per the `rethink` workflow, none of the proposals above should be implemented silently. Recommended approval set:

- Approve Proposals 1, 3, 4, 5, and 6 immediately.
- Approve Proposal 2 after one pack retrieval test.

## Sources

- Google NotebookLM Help, "Create a notebook in NotebookLM": notebooks are independent and cannot be accessed across multiple notebooks at the same time. https://support.google.com/notebooklm/answer/16206563
- Google NotebookLM Help, "Add or discover new sources for your notebook": supported source types include text, Markdown, PDF, URLs, YouTube, and each source can contain up to 500,000 words or 200 MB for uploaded files. https://support.google.com/notebooklm/answer/16215270
- Local CLI help: `nlm source add --help` shows `--file`, `--text`, `--wait`, and `--wait-timeout`.
- Local evidence: `~/.claude/logs/pp-nlm-errors.log`, `~/.claude/logs/pp-nlm-full-population.log`, `~/.claude/logs/pp-nlm-phase2-runner.log`, `~/.claude/state/pp-nlm/*.json`.
