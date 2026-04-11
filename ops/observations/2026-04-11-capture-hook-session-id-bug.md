---
observed_date: 2026-04-11
category: system-drift
severity: high
resolved: false
resolution: ""
---

# Session-capture hook writes timestamp IDs instead of transcript UUIDs breaking mining correlation and three stub-format variants exist from successive hook rewrites

## Context

Detected during Phase 1 of the session-mining-pipeline-rebuild plan, executed immediately after the /architect knowledge-vault-health-restoration plan completed. The prior plan's R6a updated `ops/queue/queue.json` `maint-001` target to "231 session files" based on the raw stub count. This plan's Phase 1 investigated the actual correlation between stubs and the real Claude Code transcripts at `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/*.jsonl` and discovered the stub-transcript linkage is broken at multiple layers.

## Signal

### Finding 1 — Capture hook never reads stdin
`.claude/hooks/session-capture.sh:20` uses:

```bash
SESSION_ID="${CLAUDE_CONVERSATION_ID:-$(date +%Y%m%d-%H%M%S)}"
```

`$CLAUDE_CONVERSATION_ID` is empty in the Stop-hook environment, so every stub falls through to a timestamp-based ID. The hook never reads stdin at all. Per claudekit's source (`/home/wtyler/.nvm/versions/node/v20.19.5/lib/node_modules/claudekit/cli/hooks/base.ts:13-25`), Claude Code delivers the canonical session identifier via a JSON payload on stdin:

```typescript
export interface ClaudePayload {
  tool_name?: string;
  tool_input?: { file_path?: string; [key: string]: unknown };
  stop_hook_active?: boolean;
  transcript_path?: string;
  hook_event_name?: string;
  session_id?: string;
  cwd?: string;
  [key: string]: unknown;
}
```

The runner reads stdin via `readStdin()` (see `cli/hooks/runner.ts:52`) and passes the parsed `ClaudePayload` to each hook. `session_id` contains the transcript UUID; `transcript_path` contains the absolute path to the `.jsonl` transcript file. The ProtoPulse session-capture hook never taps this, so the canonical identifier is lost at every session boundary.

### Finding 2 — Three stub format variants coexist
Inspection of `ops/sessions/*.json` revealed three distinct schemas from successive hook versions:

1. **Old UUID format** (10 stubs, filenames `20260313-*` through `20260401-*`):
   ```json
   {"id": "<uuid>", "started": "YYYYMMDD-HHMMSS", "status": "active", "mined": true}
   ```
   These stubs HAVE the transcript UUID in `.id`. The fix was working in some earlier hook version, got reverted or replaced.

2. **Current timestamp format** (198 stubs, the vast majority):
   ```json
   {"session_id": "YYYYMMDD-HHMMSS", "timestamp": "...", "knowledge_touched": N, ...}
   ```
   Written by the current `session-capture.sh` — no UUID anywhere.

3. **Compact-checkpoint format** (25 stubs, filenames `compact-*`):
   ```json
   {"type": "pre-compact-checkpoint", "timestamp": "...", "vault_notes": N, "active_goals": "...", "recent_notes": "..."}
   ```
   Written by a different mechanism entirely — context-compaction checkpoints, not session-end captures. These are not mineable session records; they're pre-compaction snapshots of vault state.

### Finding 3 — Ten real transcripts, zero correlate
`~/.claude/projects/-home-wtyler-Projects-ProtoPulse/*.jsonl` contains exactly 10 transcripts (first message timestamps 2026-04-10T07:20 through 2026-04-11T18:40). Claude Code retention cleanup keeps only recent sessions. None of the 10 transcripts have matching `.id` UUIDs in any stub — the old-format UUID stubs point to sessions from March (20260313-20260401), and those transcripts were deleted by retention before any mining run could reach them. The 198 current-format stubs have no UUIDs at all, so they cannot be correlated without fuzzy timestamp matching (which is unreliable at stub granularity).

### Finding 4 — Mining status partially polluted
Of 233 stubs (minus `current.json`), 163 have `mined: null` and 71 have `mined: true`. Spot-checking the 71 "mined" stubs shows most are `compact-*` checkpoints (not real captures) or hand-cleanups with `mined_note: "Malformed JSON fixed and marked mined — content captured via direct extraction"`. No evidence that any actual friction extraction produced notes in `ops/observations/` from these — the `ops/observations/` directory was empty until Phase 1 of the prior plan wrote its first observation note, and that one is about the pipeline itself, not mined content.

### Finding 5 — `/remember --mine-sessions` is format-incompatible
The `/remember` skill spec (`/home/wtyler/.claude/plugins/cache/agenticnotetaking/arscontexta/0.8.0/platforms/shared/skill-blocks/remember.md:275`) scans:

```bash
UNMINED=$(grep -rL '^mined: true' {config.ops_dir}/sessions/*.md 2>/dev/null)
```

The skill expects markdown files with YAML frontmatter whose body contains the transcript. ProtoPulse writes `.json` touch-counter stubs with zero transcript body. Even after fixing the UUID linkage, `/remember --mine-sessions` will still find nothing in ProtoPulse because the format is incompatible at the skill level. Any mining will require a ProtoPulse-local runner that reads `.jsonl` transcripts directly.

## Potential Response

Immediate (this plan, Phases 2-5):

- **Phase 2 — Fix capture hook.** Patch `.claude/hooks/session-capture.sh` to read the stdin JSON payload (`session_id`, `transcript_path`) per claudekit's documented contract, fall back to env vars (which appear to be empty in practice), fall back to timestamp only as a safety net. Add `transcript_path` to the stub schema. Future stubs will correlate 1:1 with their transcripts.

- **Phase 3 — Build ProtoPulse-local mining runner.** `ops/queries/mine-session.sh` reads a `.jsonl` transcript and emits a friction-candidate report per the `/remember` taxonomy (user corrections, repeated redirections, workflow breakdowns, agent confusion, undocumented decisions, escalation patterns). Complements rather than replaces `/remember`.

- **Phase 4 — Reconcile and mine.** Mark the 163 `mined: null` stubs as `transcript-unavailable` (terminal status). Mine the 10 extant transcripts directly (skip the currently-running one and any trivial `/exit`-only sessions). Write observation + methodology notes from discovered friction patterns.

- **Phase 5 — Close the loop.** Update `maint-001` to reflect reality. Append Evolution Log entry. Write new health snapshot.

Deferred:

- **Upstream-patching `/remember`** to accept `.json` stubs with out-of-band transcript paths. The skill lives in the arscontexta plugin cache and would be overwritten on plugin update. File as an upstream issue if friction persists after the ProtoPulse-local runner lands.

- **Increasing Claude Code transcript retention.** That's an upstream config, not in scope. The retention window is tight enough that any significant delay between session end and mining means the transcript is gone. Routine mining (e.g., weekly cron) would prevent loss going forward.

- **Auditing the 71 pre-existing `mined: true` stubs** to verify their content was actually extracted. Most are `compact-*` checkpoints that aren't real captures. The 10 old-UUID stubs from March point to expired transcripts and cannot be audited retroactively. Not worth the effort.

Promotion target: this observation can be closed (`resolved: true`) once Phase 2 lands and is verified by observing a new stub written after the fix that contains a valid UUID `session_id` and populated `transcript_path`. The methodology notes that come out of Phase 4's mining batch may or may not accumulate enough pattern evidence to promote to architectural rules — that's a separate judgment call per note.

---

Topics:
- [[methodology]]
