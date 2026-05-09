---
name: pp-nlm-operator
description: >
  Expert operator skill for ProtoPulse's consolidated NotebookLM system. Use for
  substantial NotebookLM work in this project: source population, source-pack
  consolidation, Studio artifacts, archive durability, hooks, chat configs,
  health checks, and CLI/MCP troubleshooting. The live topology is two active
  hubs, not the old 9 Tier-1 plus feature/component notebook spread.
allowed-tools: Bash(nlm:*), Bash(jq:*), Bash(timeout:*), Bash(bats:*), Read, Write, Edit
---

# PP-NLM Notesbook Operator

ProtoPulse NotebookLM is now a consolidated two-hub system. The old many-notebook taxonomy survives only as compatibility aliases and retired source notebooks.

## Skill Stack

1. `nlm-skill` - CLI/MCP mechanics, command catalog, edge cases, performance.
2. `pp-knowledge` - query routing: which hub to ask.
3. `pp-nlm-operator` - operations: writes, packs, health, Studio, hooks, and manifests.

## Live Hubs

| Canonical alias | Notebook | ID | Tags |
|---|---|---|---|
| `pp-core` | ProtoPulse :: Core Knowledge Hub | `7565a078-8051-43ea-8512-c54c3b4d363e` | `pp:active`, `pp:consolidated`, `pp:core` |
| `pp-hardware` | ProtoPulse :: Hardware & Bench Lab | `bb95833a-926e-47b1-8f45-d23427fbc58d` | `pp:active`, `pp:consolidated`, `pp:hardware`, `pp:breadboard`, `pp:bench` |

Compatibility aliases:

- Core: `pp-codebase`, `pp-arscontexta`, `pp-memories`, `pp-backlog`, `pp-journal`, `pp-research`, `pp-feat-mna-solver`, `pp-feat-ai-integration`, `pp-feat-design-system`, `pp-feat-tauri-migration`, `pp-feat-arduino-ide`, `pp-feat-pcb-layout`, `pp-feat-collab-yjs`, `pp-feat-firmware-runtime`.
- Hardware: `pp-breadboard`, `pp-bench`, `pp-feat-parts-catalog`, `pp-cmp-*`.

Resolve aliases live before writes:

```bash
nlm alias get pp-core
nlm alias get pp-hardware
```

Canonical manifest: `~/.claude/state/pp-nlm/notebook-manifest.json`.

## Critical Hard Rules

1. Never claim a Studio artifact generated without `studio_status: completed` verification.
2. Never bulk-generate chat config prose. Bulk apply is allowed only after a dry-run preflight proves prompts are non-empty, hand-crafted files under the cap, and not pointing at retired notebooks.
3. Never skip the bidirectional bridge. Studio outputs flow through `inbox/` -> `/extract` -> `knowledge/`, then republish to the right hub.
4. Never let Studio artifacts live only in NotebookLM cloud. Archive to `docs/nlm-archive/`.
5. Never auto-confirm destructive ops. `confirm=True` needs an explicit Tyler approval gate.
6. Always verify auth with bounded commands before substantive writes. Prefer `timeout 30s nlm doctor`; use `timeout` around `nlm login --check`.
7. Always manifest-track source writes with resolved target ID, content hash, status, attempts, and last error.
8. Treat write timeouts as unknown state. Reconcile by listing sources before retrying.
9. Use one writer lock for NotebookLM mutations. Reads can be parallel; writes must serialize.
10. Always use `--tags` with `nlm tag add` and `nlm tag remove`.

## Operator Surfaces

### Scripts

- `scripts/pp-nlm/health.sh` - bounded health, live aliases, manifests, recent failures.
- `scripts/pp-nlm/lib/write-helpers.sh` - lock-protected source writes and manifest reconciliation.
- `scripts/pp-nlm/lib/source-helpers.sh` - compatibility layer used by population scripts.
- `scripts/pp-nlm/build-consolidation-packs.sh` - source-pack builder for retired notebooks.
- `scripts/pp-nlm/apply-chat-configs.sh` - dry-run gated chat config apply.
- `scripts/pp-nlm/studio-output-to-inbox.sh` - Studio archive -> inbox bridge.
- `scripts/pp-nlm/sync-knowledge-to-nlm.sh` - knowledge -> NotebookLM return leg.

### Commands

| Command | Purpose | Canonical target |
|---|---|---|
| `/pp-capture` | Capture preference/rule/gotcha | `pp-core` |
| `/pp-query` | Cross-query active hubs | `pp:active` |
| `/pp-research` | Deep research import | `pp-core` |
| `/pp-recap` | Session recap | `pp-core` |
| `/pp-iter` | Iteration/backlog decision | `pp-core` |
| `/pp-innovate` | Innovation sketch | `pp-core` |
| `/pp-bench` | Physical bench note | `pp-hardware` |
| `/pp-podcast` | Audio + archive | caller-selected hub |
| `/pp-mindmap` | Mind map + archive | caller-selected hub |
| `/pp-report` | Report + archive | caller-selected hub |
| `/pp-sync` | Stale Drive check | read-only unless confirmed |
| `/pp-status` | Health dashboard | read-only |
| `/pp-promote` | Promote memory note | local memory |
| `/pp-archive` | Force-download artifact | archive |

### Hooks

- `pp-nlm-session-start.sh` - inject recent NLM context with caching.
- `pp-nlm-commit-to-journal.sh` - buffer commits into journal flow.
- `pp-nlm-stop-draft-recap.sh` - draft recap to local state; Stop hooks cannot prompt.
- `pp-nlm-studio-archive.sh` - archive Studio artifacts.
- `pp-nlm-weekly-cron.sh` - weekly audio/report.

## Routing For Writes

Use canonical hub aliases for new sources:

- `pp-core`: codebase, methodology, memory, backlog, journal, research, non-hardware feature notes.
- `pp-hardware`: hardware, breadboard, bench, parts catalog, component notes.

Old aliases may be used by slash commands for user ergonomics, but helpers must record the resolved target ID and canonical alias.

## Source-Pack Consolidation

Do not default to 260 one-to-one source copies. Consolidation's unit of work is a source pack:

1. Export each retired notebook source with original metadata.
2. Build a pack with source delimiters, original notebook ID, original source ID, title, timestamp, and content hash.
3. Add the pack to `pp-core` or `pp-hardware` via lock-protected file add.
4. Query the hub to verify retrieval quality before retiring source tags further.

Pack title pattern:

```text
ProtoPulse Consolidated Source Pack :: <Retired Notebook Name>
```

## Health Ritual

Run:

```bash
bash scripts/pp-nlm/health.sh
```

Look for:

- Auth probe result.
- Live alias map.
- Retired tags still exposed.
- Manifest entries with `status` of `unknown`, `timeout_unresolved`, or `failed`.
- Recent NLM errors.

## Recovery From Failed Adds

1. Check `~/.claude/logs/pp-nlm-errors.log`.
2. Check the manifest status for the title/hash.
3. If status is timeout/unknown, reconcile by source list before retrying.
4. Retry only through `scripts/pp-nlm/lib/write-helpers.sh` or a script that sources it.

Manual one-off pattern:

```bash
source scripts/pp-nlm/lib/write-helpers.sh
pp_nlm_source_add_file pp-core /path/to/source.txt "Title v1 - 2026-05-09" text
```

## Retired Tags

- `pp:feature` and `pp:component` are retired-source tags after consolidation. They are not default query scopes.
- Old notebooks should be tagged `pp:retired-source`.
- Do not create new per-component notebooks. Per-component drill-in belongs in `pp-hardware` with the part number in the query.

## Verification After Substantial Operations

1. `bash scripts/pp-nlm/health.sh`
2. Inspect `~/.claude/state/pp-nlm/source-manifest.json` for failed/unknown statuses.
3. Query the target hub with a source-specific question.
4. For Studio artifacts, verify archive manifest and local file existence.

## Out Of Scope

- BrainGrid integration of any kind.
- Public notebook sharing.
- Deleting old notebooks without explicit Tyler confirmation.
