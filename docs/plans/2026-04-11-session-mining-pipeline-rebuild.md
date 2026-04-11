# Session Mining Pipeline Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a working session-mining feedback loop end-to-end: fix the `ops/sessions/` capture hook's broken session-ID bug, build a format adapter so `/remember --mine-sessions` can actually read ProtoPulse session data, mine the ~8 extant transcripts for observation + methodology notes, reconcile the 221 orphan stubs to a terminal status, and document the pipeline so future sessions get mined without manual intervention.

**Architecture:** 5 strictly-sequential phases, single-agent execution (no `/agent-teams` — the phases have hard file dependencies). Each phase produces a single atomic commit for clean rollback. Phase 1 is pure diagnostic (no writes). Phase 2 fixes the capture hook. Phase 3 builds the adapter / mining runner. Phase 4 runs the initial mining batch and reconciles orphan stubs. Phase 5 updates queue.json + derivation log + health report.

**Tech stack:** Bash (session capture hook, adapter script, env-var diagnostics). JSON (session stubs, queue state, Claude Code JSONL transcripts). Markdown with frontmatter (observations, methodology notes, templates). `jq` for JSONL parsing. `grep` / `find` for filesystem sweeps. No ProtoPulse source code changes — this is pure infrastructure + knowledge vault work.

---

## Discovery Context (what triggered this plan)

During execution of `docs/plans/2026-04-11-knowledge-vault-health-restoration.md` (Phase 1, Task 1.3 R6a), the `ops/queue/queue.json` `maint-001` task was updated from `target: 3 sessions` to `target: 231 sessions` based on the observed count of `ops/sessions/*.json` stubs. The task notes included a mining strategy: "prove the pipeline on ~20 random sessions first, (2) extract friction patterns to ops/observations/, (3) promote to ops/methodology/ only if the pattern repeats."

After that plan completed, investigation of the actual data revealed four findings that invalidate the "mine 231 sessions" framing:

### Finding 1: Only ~10 real transcripts exist, not 231
The `ops/sessions/*.json` files are timestamp-named touch-counter stubs (e.g., `20260411-114001.json`) containing only `knowledge_touched`, `inbox_touched`, `ops_touched`, `self_touched`, `timestamp`, and `mined: false` — no transcript content. The actual Claude Code session transcripts live in `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/*.jsonl` (UUID-named), and only ~10 exist at any given time due to Claude Code retention cleanup. The other ~221 stubs have no corresponding mineable transcript — the transcript was deleted before the stub was ever processed.

### Finding 2: Stub session_id does not correlate to transcript UUID
`ops/sessions/20260411-114001.json` has `"session_id": "20260411-114001"`, a timestamp-based ID. The corresponding transcript would be at `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/<uuid>.jsonl`, where `<uuid>` is a random UUID like `8223b092-6733-4001-a29d-2c581100d6f7`. There is no direct mapping between the two.

### Finding 3: `session-capture.sh` falls back to timestamp because `$CLAUDE_CONVERSATION_ID` is empty in Stop-hook environment
Reading `.claude/hooks/session-capture.sh:20` shows:
```bash
SESSION_ID="${CLAUDE_CONVERSATION_ID:-$(date +%Y%m%d-%H%M%S)}"
```
The hook intends to use `CLAUDE_CONVERSATION_ID` (which would be the transcript UUID) but falls back to a timestamp because that variable is unset or empty when the Stop hook fires. The root cause — wrong variable name, missing export, or Claude Code not passing conversation identity to Stop hooks — is unknown without empirical testing.

### Finding 4: `/remember --mine-sessions` cannot read `.json` stubs
Reading `/home/wtyler/.claude/plugins/cache/agenticnotetaking/arscontexta/0.8.0/platforms/shared/skill-blocks/remember.md:273-278` shows:
```bash
# Find session files without mined: true marker
UNMINED=$(grep -rL '^mined: true' {config.ops_dir}/sessions/*.md 2>/dev/null)
```
The skill's mining mode expects `ops/sessions/*.md` files with markdown frontmatter containing `mined: true/false`. ProtoPulse writes `.json`. Even if we fix the JSON stubs, `/remember` will not find them without a format translation. Additionally, the skill assumes the session files contain the transcript body — they don't in ProtoPulse.

**Consequence:** the maint-001 task as currently described is unexecutable. This plan fixes the underlying infrastructure so mining can actually happen, then runs the first mining batch against the real data.

---

## Scope Boundary (Explicit)

**This plan DOES:**
1. Diagnose why the Stop-hook `$CLAUDE_CONVERSATION_ID` is empty — empirically, not by guessing.
2. Fix `session-capture.sh` to produce stubs that link to their real transcripts (via either the correct env var OR a timestamp→UUID bridge).
3. Build a ProtoPulse-specific mining runner (`ops/queries/mine-session.sh` or similar) that reads a JSONL transcript and extracts friction signals using the taxonomy from the `/remember` skill spec.
4. Run the first mining batch against the ~8 extant transcripts (skipping the currently-running session and any trivial `/exit`-only sessions).
5. Reconcile the 221 orphan stubs (those with no matching transcript) to a terminal status like `"mined": "transcript-unavailable"` so they stop counting against future `/architect` health scans.
6. Write observation and methodology notes for any friction patterns discovered during the mining batch.
7. Update `ops/queue/queue.json` `maint-001` to reflect actual state after the batch.
8. Append an Evolution Log entry in `ops/derivation.md`.
9. Update `ops/health/` with a new snapshot reflecting the post-mining state.

**This plan does NOT:**
1. Replace or patch the `/remember` skill itself (the skill is in a plugin cache; modifications would be overwritten on plugin update). Instead, this plan builds a ProtoPulse-local mining runner that complements the skill.
2. Re-process the 221 orphan stubs with reconstructed transcripts. Those transcripts are gone (retention cleanup). Reconciliation means marking them as unrecoverable, not salvaging them.
3. Mine the currently-running session transcript (`8223b092-6733-4001-a29d-2c581100d6f7.jsonl`) — it's still being written to. That transcript will be mined in a future `/remember` run after the current session ends.
4. Fix the `/remember` skill's `.md` vs `.json` mismatch at the plugin level (upstream issue — file separately if needed).
5. Change the retention policy of `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/`. That's a Claude Code setting and out of scope.
6. Touch any ProtoPulse source code (`client/`, `server/`, `shared/`, `docs/` except the evolution log and this plan).

---

## File Structure

### Files Modified
| Path | Phase | Change |
|------|-------|--------|
| `.claude/hooks/session-capture.sh` | 2 | Fix session-ID source (use correct env var OR add transcript-UUID bridge). Add `transcript_path` field to stub JSON. |
| `ops/queue/queue.json` | 5 | Update `maint-001` to reflect post-batch reality (target count, completion timestamp, status). Possibly add new maintenance tasks surfaced during mining. |
| `ops/derivation.md` | 5 | Append 2026-04-11 Evolution Log entry documenting the pipeline repair. |

### Files Created
| Path | Phase | Purpose |
|------|-------|---------|
| `ops/observations/2026-04-11-capture-hook-session-id-bug.md` | 1 | Diagnostic observation note documenting the `$CLAUDE_CONVERSATION_ID` fall-through discovery. |
| `ops/queries/mine-session.sh` | 3 | ProtoPulse-local mining runner. Takes a transcript path, extracts friction signals, writes observation/methodology notes. |
| `ops/queries/reconcile-orphan-stubs.sh` | 4 | Bulk-update script that marks orphan stubs (no matching transcript) with a terminal status. |
| `ops/observations/2026-04-11-<friction-name>.md` | 4 | Zero or more observation notes produced by the initial mining batch. Count depends on what the transcripts contain. |
| `ops/methodology/<methodology-name>.md` | 4 | Zero or more methodology notes produced by the initial mining batch. Count depends on which friction patterns are clearly actionable. |
| `ops/health/2026-04-12-post-mining-health.md` | 5 | New health snapshot capturing post-mining vault state. (Dated 2026-04-12 assuming the work runs into the next day; use 2026-04-11 if same-day.) |

### Files NOT Touched
- Any file under `client/`, `server/`, `shared/`, or `docs/` except this plan and `docs/` evolution log.
- The `/remember` skill source at `~/.claude/plugins/cache/agenticnotetaking/arscontexta/0.8.0/` — upstream plugin, would be overwritten on update.
- Existing `ops/methodology/` notes from prior `/remember` runs (the 5 that were cross-referenced from `knowledge/methodology.md` before Phase 1 of the previous plan removed them).
- `ops/sessions/current.json` — the live session stub. Do not modify while a session is running.

---

## Team Execution Checklist

This plan is **sequential single-agent execution**. `/agent-teams` is not appropriate because Phase 2 depends on Phase 1's empirical findings, Phase 3 depends on Phase 2's fixed capture format, Phase 4 depends on Phase 3's mining runner, and Phase 5 depends on Phase 4's batch results. Attempting to parallelize would produce stale-assumption defects.

- [ ] **Phase 1** — Diagnose (~20 min): empirically determine Claude Code Stop-hook env vars; map stubs to transcripts; catalog mineable vs orphaned stubs; write diagnostic observation note; commit.
- [ ] **Phase 2** — Fix capture hook (~25 min): patch `session-capture.sh` to link stubs to transcripts reliably; add `transcript_path` field; verify via synthetic test; commit.
- [ ] **Phase 3** — Build mining runner (~30 min): write `ops/queries/mine-session.sh` that reads a JSONL transcript and extracts friction patterns; test on one small real transcript; commit.
- [ ] **Phase 4** — Initial mining batch + orphan reconciliation (~45-90 min, depends on transcript volume): mine each extant transcript; write observation/methodology notes; bulk-reconcile 221 orphan stubs; commit.
- [ ] **Phase 5** — Documentation + queue update (~10 min): update `queue.json`, append Evolution Log, write new health snapshot, commit.

**Total estimate:** ~2-3 hours across 5 commits. Phase 4 dominates — transcript depth is the variable.

**Research references:**
- `/home/wtyler/.claude/plugins/cache/agenticnotetaking/arscontexta/0.8.0/platforms/shared/skill-blocks/remember.md` — the `/remember` skill spec, especially the "Session Mining Mode" section (lines 263-372). This plan's Phase 3 mining runner replicates the skill's pattern taxonomy for ProtoPulse's format.
- `/home/wtyler/Projects/ProtoPulse/templates/observation.md` — observation note schema. Required fields: `observed_date`, `category`. Optional: `severity`, `resolved`, `resolution`. Category enum: friction, surprise, recurring-pattern, system-drift, vocabulary-mismatch, missing-connection.
- `/home/wtyler/Projects/ProtoPulse/ops/observations/2026-04-11-session-mining-pipeline-silently-broken.md` — the one existing observation note (created in the prior plan's Phase 1). Use as structural reference.
- `/home/wtyler/Projects/ProtoPulse/ops/methodology/` — six existing methodology notes written via prior `/remember` runs. Read for structural reference before writing new methodology notes in Phase 4.
- `/home/wtyler/Projects/ProtoPulse/.claude/hooks/session-capture.sh` — the hook being fixed in Phase 2.
- Claude Code documentation on hook environment variables (to be looked up empirically in Phase 1, not cited from memory — the agent should not guess which env var is correct).

**Operational note:** the auto-commit plugin hook at `~/.claude/plugins/cache/agenticnotetaking/arscontexta/0.8.0/hooks/scripts/auto-commit.sh` fires on every Write tool invocation and does `git add -A`. Each phase commit in this plan should use `git reset --soft <prev-phase-commit>` + manual `git commit` to collapse any interim auto-commits into a single clean phase commit (the pattern established in the prior plan's execution).

---

## Phase 1 — Diagnose

**Prerequisite:** Working tree clean on `main`, sitting on top of commit `9f3b6544` (the prior plan's Phase 4 commit). If uncommitted changes exist, stop and investigate before proceeding.

**Why this phase first:** every downstream fix depends on empirical knowledge about (a) what env vars Claude Code actually exports to Stop hooks, (b) whether the 10 extant transcripts are correlatable to specific stubs, and (c) how many stubs are definitively orphaned. Guessing any of these would produce infrastructure that works for the wrong version of reality.

---

### Task 1.1: Verify prerequisite state

**Files:** none (read-only scan)

- [ ] **Step 1: Verify working tree clean and on the expected commit**

```bash
cd /home/wtyler/Projects/ProtoPulse && \
  git rev-parse --abbrev-ref HEAD && \
  git status --short && \
  git log --oneline -1
```

Expected output:
```
main
(empty or only unrelated auto-commits from a background hook)
9f3b6544 vault: /architect phase 4 — evolution log + final validation
```

If `HEAD` is not `9f3b6544`, investigate. This plan assumes it's building on top of the prior plan's completion point.

- [ ] **Step 2: Snapshot the current session-related state**

```bash
echo "=== stubs ===" && \
  ls -1 ops/sessions/*.json 2>/dev/null | wc -l && \
  echo "=== transcripts ===" && \
  ls -1 ~/.claude/projects/-home-wtyler-Projects-ProtoPulse/*.jsonl 2>/dev/null | wc -l && \
  echo "=== observations ===" && \
  find ops/observations -name '*.md' 2>/dev/null | wc -l && \
  echo "=== methodology notes ===" && \
  find ops/methodology -name '*.md' 2>/dev/null | wc -l
```

Expected: stubs ≥ 231 (might be a few more due to new session captures during Phase 0 of the prior plan and this one), transcripts around 10 (variable — Claude Code retention), observations = 1, methodology = 6.

Record the exact numbers — they become inputs to Task 1.3.

---

### Task 1.2: Empirically determine Claude Code Stop-hook env vars

**Files:**
- Create: `/tmp/protopulse-hook-probe.sh` (throwaway probe script)

**Context:** The current `session-capture.sh` uses `${CLAUDE_CONVERSATION_ID:-...}` and falls through to timestamp, suggesting that variable is unset. Before fixing the hook, the executor must determine what variables Claude Code DOES export to Stop hooks. Do not guess variable names — empirically test.

- [ ] **Step 1: Write a probe script that dumps the entire hook environment**

Use the Write tool to create `/tmp/protopulse-hook-probe.sh` with this exact content:

```bash
#!/usr/bin/env bash
# Throwaway Stop-hook probe — dumps environment variables to a log file
# so the executor can see what Claude Code actually exports.

set -u
LOG="/tmp/protopulse-hook-probe.log"

{
  echo "=== Probe fired at $(date -Iseconds) ==="
  echo "--- Full environment ---"
  env | sort
  echo "--- CLAUDE_* variables ---"
  env | grep -iE '^CLAUDE' || echo "(none)"
  echo "--- Stdin ---"
  if [ -t 0 ]; then
    echo "(stdin is a terminal)"
  else
    cat || echo "(stdin empty or unreadable)"
  fi
  echo "=== End probe ==="
  echo ""
} >> "$LOG" 2>&1

echo "{}"
exit 0
```

Then:

```bash
chmod +x /tmp/protopulse-hook-probe.sh
```

- [ ] **Step 2: Read current settings.json to find the Stop-hook array**

```bash
grep -n '"Stop"' .claude/settings.json | head -5
```

Record the line number of the `Stop` hook array. This tells you where to temporarily register the probe.

- [ ] **Step 3: Temporarily register the probe as an additional Stop hook**

Use the Edit tool to add the probe to `.claude/settings.json`'s Stop hook array. The exact edit depends on the current structure — read the surrounding context first. The probe registration should look like:

```json
{
  "matcher": "*",
  "hooks": [
    {
      "type": "command",
      "command": "/tmp/protopulse-hook-probe.sh",
      "timeout": 5
    }
  ]
}
```

Add this as an additional entry alongside existing Stop hooks — do NOT replace them.

- [ ] **Step 4: Trigger the Stop hook**

Ask the human partner to type `/exit` in a fresh throwaway Claude Code session OR run `claude -p "exit" --hooks-only` if that flag exists. Alternatively, the executor can synthesize a Stop-hook invocation by running:

```bash
env - CLAUDE_CONVERSATION_ID="test-uuid-probe" /tmp/protopulse-hook-probe.sh
```

This is a pure-synthetic run that at minimum confirms the log-writing works; the real Claude Code firing will be needed to see what ACTUAL variables are exported.

- [ ] **Step 5: Read the probe log and identify the conversation-identifier variable**

```bash
cat /tmp/protopulse-hook-probe.log
```

Look for: any variable containing a UUID pattern (`[0-9a-f]{8}-[0-9a-f]{4}`), any variable named `CLAUDE_SESSION_ID`, `CLAUDE_CONVERSATION_ID`, `CLAUDE_TRANSCRIPT_PATH`, `session_id`, etc. The JSONL files have `"sessionId":"<uuid>"` — look for a matching UUID in the env.

Record the correct variable name. If no environment variable contains the session UUID, the stdin JSON payload from the Stop hook may contain it instead — check the `--- Stdin ---` section of the log.

If neither env nor stdin contains a usable session identifier, that is itself a finding — skip to Task 1.2 Step 6.

- [ ] **Step 6: Unregister the probe from settings.json**

Revert the Edit from Step 3. The settings.json should go back to its exact prior state. Use the Edit tool with the same old_string/new_string pair but flipped.

- [ ] **Step 7: Commit the probe findings to memory (not to git — the probe script is /tmp only)**

Write the correct variable name and any stdin-payload details to a scratch note you'll reference in Phase 2. Do NOT create a permanent file for this yet — it goes into the observation note in Task 1.4.

---

### Task 1.3: Map stubs to transcripts

**Files:**
- Create: `/tmp/protopulse-stub-transcript-map.txt` (throwaway mapping table)

**Context:** For each of the 10 extant transcripts, determine which stub (if any) it corresponds to. The mapping is heuristic — the transcript JSONL contains its own `sessionId` (UUID), but the stub has a timestamp-based ID. The only bridge is the transcript's first-message timestamp vs. the stub's timestamp, assuming they were written close together.

- [ ] **Step 1: Enumerate the extant transcripts with their first-message timestamps**

```bash
for t in ~/.claude/projects/-home-wtyler-Projects-ProtoPulse/*.jsonl; do
  first_ts=$(head -10 "$t" | jq -r 'select(.timestamp) | .timestamp' 2>/dev/null | head -1)
  uuid=$(basename "$t" .jsonl)
  size=$(stat -c '%s' "$t")
  echo "$first_ts  $uuid  $size"
done | sort
```

Expected: ~10 lines, each showing `ISO-timestamp  UUID  byte-count`. Save this list for the mapping step.

- [ ] **Step 2: Enumerate all stubs with their timestamps**

```bash
for s in ops/sessions/*.json; do
  [ "$(basename "$s")" = "current.json" ] && continue
  stub_ts=$(jq -r '.timestamp // empty' "$s" 2>/dev/null)
  stub_id=$(jq -r '.session_id // empty' "$s" 2>/dev/null)
  echo "$stub_ts  $stub_id  $s"
done | sort > /tmp/protopulse-stubs-sorted.txt
wc -l /tmp/protopulse-stubs-sorted.txt
```

Expected: 231+ lines. `current.json` is intentionally skipped because it's the live session.

- [ ] **Step 3: For each transcript, find the closest stub by timestamp (best-effort heuristic)**

This is a manual bash-level join. Create `/tmp/protopulse-stub-transcript-map.txt` with one line per transcript showing the best-match stub path:

```bash
for t in ~/.claude/projects/-home-wtyler-Projects-ProtoPulse/*.jsonl; do
  first_ts=$(head -10 "$t" | jq -r 'select(.timestamp) | .timestamp' 2>/dev/null | head -1)
  uuid=$(basename "$t" .jsonl)
  # Convert ISO timestamp to epoch for arithmetic
  first_epoch=$(date -d "$first_ts" +%s 2>/dev/null || echo 0)
  # Find stub with closest timestamp (scan, compute abs diff, keep minimum)
  best_stub=""
  best_diff=999999999
  while IFS= read -r line; do
    stub_ts=$(echo "$line" | awk '{print $1}')
    stub_path=$(echo "$line" | awk '{print $3}')
    stub_epoch=$(date -d "$stub_ts" +%s 2>/dev/null || echo 0)
    diff=$(( first_epoch > stub_epoch ? first_epoch - stub_epoch : stub_epoch - first_epoch ))
    if [ "$diff" -lt "$best_diff" ]; then
      best_diff=$diff
      best_stub=$stub_path
    fi
  done < /tmp/protopulse-stubs-sorted.txt
  echo "$uuid  $first_ts  $best_stub  diff=${best_diff}s"
done > /tmp/protopulse-stub-transcript-map.txt
cat /tmp/protopulse-stub-transcript-map.txt
```

Expected: ~10 mapping lines. Any mapping with `diff < 60` (within a minute) is a strong match. Mappings with `diff > 3600` (over an hour) are almost certainly coincidental — the stub was for a different session and the transcript has no stub.

- [ ] **Step 4: Classify each mapping as CORRELATABLE or ORPHAN**

Visually inspect the map file. For each transcript, decide:
- `CORRELATABLE`: `diff < 60s` → this stub is the correct one for this transcript
- `UNCERTAIN`: `60s ≤ diff < 600s` → probably matched, flag for manual review
- `NO-STUB`: `diff ≥ 600s` → transcript has no stub (stub was never written, or transcript predates this vault)

Write the classified list into `/tmp/protopulse-mapping-classified.txt` with one line per transcript:

```
CORRELATABLE  <uuid>  <stub-path>
UNCERTAIN     <uuid>  <stub-path>
NO-STUB       <uuid>  -
```

- [ ] **Step 5: Identify orphan stubs (stubs with no matching transcript)**

```bash
# Extract the stub paths that DID get matched to a transcript
matched_stubs=$(awk '{print $3}' /tmp/protopulse-stub-transcript-map.txt | grep -v '^-$' | sort -u)
# All stubs minus the matched set = orphans
for s in ops/sessions/*.json; do
  [ "$(basename "$s")" = "current.json" ] && continue
  if ! echo "$matched_stubs" | grep -qF "$s"; then
    echo "$s"
  fi
done > /tmp/protopulse-orphan-stubs.txt
wc -l /tmp/protopulse-orphan-stubs.txt
```

Expected: around 220 lines (total stubs minus the ~10 matched). Any stub not in the matched set is orphan — its transcript has been deleted by Claude Code retention cleanup.

---

### Task 1.4: Write diagnostic observation note

**Files:**
- Create: `ops/observations/2026-04-11-capture-hook-session-id-bug.md`

**Context:** Document the three findings from Tasks 1.2 + 1.3 as a permanent observation note. This is the second-ever observation in `ops/observations/` — it follows the template from `templates/observation.md` and the structure of the existing `2026-04-11-session-mining-pipeline-silently-broken.md`.

- [ ] **Step 1: Read the template and the existing observation for structure**

```bash
head -50 templates/observation.md && \
  echo "---" && \
  head -30 ops/observations/2026-04-11-session-mining-pipeline-silently-broken.md
```

Confirm: frontmatter has `observed_date`, `category`, `severity`, `resolved`, `resolution`. Body has `## Context`, `## Signal`, `## Potential Response`. Topics footer references `[[methodology]]`.

- [ ] **Step 2: Write the observation note**

Use the Write tool to create `/home/wtyler/Projects/ProtoPulse/ops/observations/2026-04-11-capture-hook-session-id-bug.md` with this structure (fill in the concrete findings from Tasks 1.2 + 1.3):

```markdown
---
observed_date: 2026-04-11
category: system-drift
severity: high
resolved: false
resolution: ""
---

# Session-capture hook writes timestamp IDs instead of transcript UUIDs breaking mining correlation

## Context

Detected during the follow-up plan to the 2026-04-11 /architect pass. The original plan updated `ops/queue/queue.json` maint-001 target to "231 session files" without verifying the correlation between `ops/sessions/*.json` stubs and the real Claude Code transcripts at `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/*.jsonl`. When the mining plan was drafted, a stub-to-transcript mapping exercise revealed that:

1. Only [N] transcripts exist (Claude Code retains recent sessions only — dates [START_DATE] to [END_DATE]).
2. Of [STUB_COUNT] stubs, only [CORRELATABLE_COUNT] can be linked to a transcript by timestamp proximity.
3. [ORPHAN_COUNT] stubs have no matching transcript — those sessions are unmineable because the transcript was deleted by retention cleanup before any mining run.

Where [N], [STUB_COUNT], [CORRELATABLE_COUNT], [ORPHAN_COUNT] are the concrete numbers from Tasks 1.1 + 1.3.

## Signal

The session capture hook (`.claude/hooks/session-capture.sh:20`) intends to use the canonical session identifier:

```bash
SESSION_ID="${CLAUDE_CONVERSATION_ID:-$(date +%Y%m%d-%H%M%S)}"
```

but `$CLAUDE_CONVERSATION_ID` is empty in the Stop-hook environment, so every stub falls through to `date +%Y%m%d-%H%M%S`. The resulting `session_id` is a timestamp, not the transcript UUID. This has three consequences:

1. **Correlation broken at capture time.** The stub and the transcript share nothing but approximate timestamps. Retroactively mapping them is a fuzzy timestamp-proximity heuristic, not a deterministic link.
2. **No mining contract.** The `/remember --mine-sessions` skill expects `ops/sessions/*.md` files with frontmatter whose body contains the transcript. ProtoPulse writes JSON touch-counter stubs with zero transcript body. Even if the skill were pointed at the stubs, it would have nothing to mine.
3. **Inflated count.** The queue's "231 unmined sessions" number was the stub count, not the mineable-transcript count. It overstates the actual work by ~22x.

The correct variable name (or alternative identifier mechanism) was determined empirically in Task 1.2 to be: `[CORRECT_VAR_NAME]`. [OR: No environment variable contains a usable session identifier — the Stop hook must derive the transcript path from stdin JSON payload / a different mechanism. Fill in the Task 1.2 finding here.]

## Potential Response

Immediate (this plan):
- **R1 — Fix the capture hook** (Phase 2): patch `session-capture.sh` to use the correct variable (or alternative) so future stubs link to their transcripts deterministically.
- **R2 — Build a ProtoPulse-local mining runner** (Phase 3): `ops/queries/mine-session.sh` reads a JSONL transcript directly, not a stub, and writes observation/methodology notes. This complements rather than replaces `/remember`.
- **R3 — Reconcile orphan stubs** (Phase 4): mark the ~[ORPHAN_COUNT] stubs with no matching transcript as `"mined": "transcript-unavailable"` so future health scans stop counting them.
- **R4 — Run the first mining batch** (Phase 4): mine the [N] extant correlatable transcripts and write notes.

Deferred:
- Upstream-patching the `/remember` skill to accept `.json` stubs with out-of-band transcript paths. That lives in the arscontexta plugin cache and would be overwritten on plugin update. File as an upstream issue if friction persists.
- Increasing Claude Code transcript retention — out of scope, that's an upstream config.

Promotion target: if the capture-hook fix works and future mining runs succeed without intervention, this observation can be closed (`resolved: true`, `resolution: "Fixed in commit [HASH] of plan 2026-04-11-session-mining-pipeline-rebuild.md"`). No methodology promotion expected — this is a one-time infrastructure repair, not a recurring behavioral pattern.

---

Topics:
- [[methodology]]
```

- [ ] **Step 3: Verify the observation note is well-formed**

```bash
head -10 ops/observations/2026-04-11-capture-hook-session-id-bug.md && \
  echo "---" && \
  find ops/observations -name '*.md' | wc -l
```

Expected: frontmatter starting with `---`, then `observed_date: 2026-04-11`, and a total observation count of 2.

---

### Task 1.5: Commit Phase 1

**Files:** none (commit only)

- [ ] **Step 1: Check git status**

```bash
git status --short
```

Expected files (ignore unrelated auto-committed files like `ops/sessions/<new>.json`):
```
?? ops/observations/2026-04-11-capture-hook-session-id-bug.md
```

If auto-commit has already run on the observation file (possible since Write tool triggers it), the file may already be committed. If so, do a soft reset:

```bash
git reset --soft 9f3b6544  # the prior plan's Phase 4 commit
git restore --staged .claude/.tsc-errors.log ops/sessions/ 2>/dev/null || true
git status --short
```

After the reset, only the observation note should be staged.

- [ ] **Step 2: Commit**

```bash
git add ops/observations/2026-04-11-capture-hook-session-id-bug.md && \
git commit -m "$(cat <<'EOF'
vault: session-mining phase 1 — diagnose capture-hook session ID bug

Diagnostic findings from empirical testing:
- Only [N] real transcripts exist in ~/.claude/projects/-home-wtyler-Projects-ProtoPulse/
  (Claude Code retention cleanup keeps recent sessions only)
- [CORRELATABLE_COUNT] stubs correlate to transcripts via timestamp proximity
- [ORPHAN_COUNT] stubs have no matching transcript (unmineable)
- session-capture.sh falls through to timestamp because $CLAUDE_CONVERSATION_ID
  is empty in Stop-hook environment; correct variable is [CORRECT_VAR_NAME]
- /remember --mine-sessions expects ops/sessions/*.md with frontmatter, not
  ProtoPulse's .json stubs — format mismatch at the skill level

Created: ops/observations/2026-04-11-capture-hook-session-id-bug.md

Phase 2 will fix the capture hook; Phase 3 will build a ProtoPulse-local
mining runner; Phase 4 will reconcile orphan stubs and run the first batch;
Phase 5 will update queue.json + evolution log + health snapshot.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

Fill in `[N]`, `[CORRELATABLE_COUNT]`, `[ORPHAN_COUNT]`, `[CORRECT_VAR_NAME]` from Task 1.2 + 1.3 findings before committing.

**Phase 1 exit criteria:**
- [ ] `/tmp/protopulse-hook-probe.log` exists and has been read; correct Stop-hook identifier mechanism is known.
- [ ] `/tmp/protopulse-stub-transcript-map.txt` exists with one line per transcript.
- [ ] `/tmp/protopulse-orphan-stubs.txt` exists with the orphan stub paths.
- [ ] `ops/observations/2026-04-11-capture-hook-session-id-bug.md` exists with concrete findings (not template placeholders).
- [ ] Phase 1 commit made; working tree has only unrelated noise.
- [ ] `.claude/settings.json` is in its exact pre-probe state (probe unregistered).

---

## Phase 2 — Fix capture hook

**Prerequisite:** Phase 1 complete and committed. The correct Stop-hook session identifier mechanism is known from Task 1.2.

**Why this phase:** the capture hook is the upstream source of correlation breakage. Fixing it AFTER the mining run would mean the initial batch uses the broken format, which taints the reconciliation logic. Fixing it BEFORE mining means the mining runner in Phase 3 can rely on the new stub format for future sessions and a bridging layer only for existing stubs.

---

### Task 2.1: Write failing test / reproduction

**Files:** none (verification script)

**Context:** before patching the hook, verify the current failure mode by running the unpatched hook against a synthetic environment and observing that the stub uses a timestamp, not a UUID. This is the "write the failing test" step.

- [ ] **Step 1: Reproduce the broken behavior**

```bash
# Simulate firing the hook with no CLAUDE_CONVERSATION_ID set
cd /tmp && mkdir -p protopulse-hook-test && cd protopulse-hook-test && \
  touch .arscontexta && \
  echo 'git: true
session_capture: true' > .arscontexta && \
  git init -q && \
  git commit --allow-empty -q -m init && \
  mkdir -p ops/sessions && \
  env -u CLAUDE_CONVERSATION_ID bash /home/wtyler/Projects/ProtoPulse/.claude/hooks/session-capture.sh && \
  ls -1 ops/sessions/ && \
  cat ops/sessions/*.json
```

Expected: the stub's `session_id` field matches `^[0-9]{8}-[0-9]{6}$` (timestamp format), NOT a UUID. If it matches `^[0-9a-f-]{36}$`, the bug is gone and Phase 2 is unnecessary — skip to Phase 3.

- [ ] **Step 2: Reproduce with the correct var set (confirming the fix will work)**

```bash
cd /tmp/protopulse-hook-test && \
  rm -f ops/sessions/*.json && \
  env CLAUDE_CONVERSATION_ID=test-uuid-1234-5678 bash /home/wtyler/Projects/ProtoPulse/.claude/hooks/session-capture.sh && \
  cat ops/sessions/*.json | jq -r '.session_id'
```

Expected: `test-uuid-1234-5678` (proves the hook WOULD use the env var if it were set). This confirms the fix is variable-naming, not hook-logic.

If the Task 1.2 finding says the correct variable is NOT `CLAUDE_CONVERSATION_ID`, rerun Step 2 with the real variable name (e.g., `CLAUDE_SESSION_ID` or whatever was found). If the Task 1.2 finding says the identifier comes from stdin JSON, the fix in Task 2.2 will be structurally different — use stdin parsing instead of env lookup.

- [ ] **Step 3: Clean up the test directory**

```bash
rm -rf /tmp/protopulse-hook-test
```

---

### Task 2.2: Patch session-capture.sh

**Files:**
- Modify: `.claude/hooks/session-capture.sh` (line 20 and possibly surrounding)

**Context:** apply the fix based on Task 1.2's finding. Two possible shapes:

**Shape A (wrong variable name):** change `CLAUDE_CONVERSATION_ID` to the correct env var name.

**Shape B (stdin-based):** parse the hook's stdin JSON payload to extract the session identifier, fall back to env, then fall back to timestamp.

The executor chooses the shape based on Task 1.2's result. Below is the template for Shape B (more general — subsumes Shape A if the env var works, uses stdin if it doesn't).

- [ ] **Step 1: Read the current hook in full**

```bash
cat .claude/hooks/session-capture.sh
```

Record the exact current content of line 20 and surrounding context. This becomes the `old_string` for the Edit.

- [ ] **Step 2: Patch the session ID resolution**

Use the Edit tool with this pattern (adjust to Task 1.2 finding):

**old_string:** (exact match from the current file)
```bash
# Derive session ID
SESSION_ID="${CLAUDE_CONVERSATION_ID:-$(date +%Y%m%d-%H%M%S)}"
SESSION_FILE="$SESSIONS_DIR/${SESSION_ID}.json"
```

**new_string** (Shape B template — adapt if Shape A is sufficient):
```bash
# Derive session ID: prefer the canonical conversation UUID from the hook
# payload, then fall back to any exported Claude env var, then fall back
# to a timestamp. The timestamp fallback is vestigial — it exists only
# to keep the hook non-fatal in unfamiliar environments.
HOOK_PAYLOAD="$(cat 2>/dev/null || true)"
CLAUDE_ID_FROM_PAYLOAD="$(echo "$HOOK_PAYLOAD" | jq -r '.session_id // .sessionId // .conversation_id // empty' 2>/dev/null || true)"
SESSION_ID="${CLAUDE_ID_FROM_PAYLOAD:-${CLAUDE_CONVERSATION_ID:-${CLAUDE_SESSION_ID:-$(date +%Y%m%d-%H%M%S)}}}"
TRANSCRIPT_PATH="$(echo "$HOOK_PAYLOAD" | jq -r '.transcript_path // empty' 2>/dev/null || true)"
SESSION_FILE="$SESSIONS_DIR/${SESSION_ID}.json"
```

If Task 1.2 found that stdin contains a usable JSON payload (common for Claude Code hooks), Shape B works directly. If Task 1.2 found a simple env var fix, simplify by keeping only the env-var branches and dropping the stdin parsing.

- [ ] **Step 3: Include `transcript_path` in the stub body**

Use the Edit tool again to update the JSON-emitting heredoc block. The new stub should look like:

**old_string:**
```bash
cat > "$SESSION_FILE" << ENDJSON
{
  "session_id": "$SESSION_ID",
  "timestamp": "$(date -Iseconds)",
  "knowledge_touched": $knowledge_modified,
  "inbox_touched": $inbox_modified,
  "ops_touched": $ops_modified,
  "self_touched": $self_modified,
  "mined": false
}
ENDJSON
```

**new_string:**
```bash
cat > "$SESSION_FILE" << ENDJSON
{
  "session_id": "$SESSION_ID",
  "timestamp": "$(date -Iseconds)",
  "transcript_path": "${TRANSCRIPT_PATH:-}",
  "knowledge_touched": $knowledge_modified,
  "inbox_touched": $inbox_modified,
  "ops_touched": $ops_modified,
  "self_touched": $self_modified,
  "mined": false
}
ENDJSON
```

The empty-string default (`${TRANSCRIPT_PATH:-}`) keeps the field present for schema uniformity even when the path isn't known.

---

### Task 2.3: Verify the fix empirically

**Files:** none (verification)

- [ ] **Step 1: Dry-run the fixed hook with the correct identifier**

```bash
cd /tmp && mkdir -p protopulse-hook-test-fix && cd protopulse-hook-test-fix && \
  echo 'git: true
session_capture: true' > .arscontexta && \
  git init -q && \
  git commit --allow-empty -q -m init && \
  mkdir -p ops/sessions && \
  printf '{"session_id":"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee","transcript_path":"/tmp/fake.jsonl"}' | \
    bash /home/wtyler/Projects/ProtoPulse/.claude/hooks/session-capture.sh && \
  cat ops/sessions/*.json
```

Expected output includes:
```
  "session_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "transcript_path": "/tmp/fake.jsonl",
```

If the session_id is `aaaaaaaa-...`, the fix worked. If it's still a timestamp, the Edit didn't land correctly — re-read and re-edit.

- [ ] **Step 2: Dry-run with missing identifier (fallback path)**

```bash
cd /tmp/protopulse-hook-test-fix && rm -f ops/sessions/*.json && \
  printf '{}' | env -u CLAUDE_CONVERSATION_ID -u CLAUDE_SESSION_ID \
    bash /home/wtyler/Projects/ProtoPulse/.claude/hooks/session-capture.sh && \
  cat ops/sessions/*.json
```

Expected: `session_id` is a timestamp format (`YYYYMMDD-HHMMSS`) — the fallback path works as a safety net, `transcript_path` is empty.

- [ ] **Step 3: Clean up**

```bash
rm -rf /tmp/protopulse-hook-test-fix
```

- [ ] **Step 4: Confirm the real hook file is intact**

```bash
wc -l .claude/hooks/session-capture.sh && \
  head -3 .claude/hooks/session-capture.sh
```

Expected: still starts with `#!/usr/bin/env bash` and the script-purpose comment. Line count should be similar to original ± ~10 lines for the patches.

---

### Task 2.4: Commit Phase 2

**Files:** none (commit)

- [ ] **Step 1: Check git status**

```bash
git status --short
```

Expected:
```
 M .claude/hooks/session-capture.sh
```

If additional files are staged (auto-commits), soft-reset to the Phase 1 commit and restage only `session-capture.sh`:

```bash
PHASE_1_HASH=$(git log --oneline | grep 'session-mining phase 1' | head -1 | awk '{print $1}')
git reset --soft "$PHASE_1_HASH"
git restore --staged .claude/.tsc-errors.log ops/sessions/ 2>/dev/null || true
git add .claude/hooks/session-capture.sh
git status --short
```

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
vault: session-mining phase 2 — fix capture hook session ID bug

Root cause: .claude/hooks/session-capture.sh:20 used
${CLAUDE_CONVERSATION_ID:-$(date +%Y%m%d-%H%M%S)}, but that env var is
empty in Stop-hook environment (confirmed empirically in Phase 1). Every
stub since vault creation fell through to a timestamp-based ID, breaking
correlation with the UUID-named JSONL transcripts.

Fix:
- Parse hook's stdin JSON payload for session_id / sessionId /
  conversation_id (Claude Code's hook payload shape)
- Fall back to env vars (CLAUDE_CONVERSATION_ID, CLAUDE_SESSION_ID) if
  stdin is empty
- Fall back to timestamp only as a safety net
- Add transcript_path field to stub schema so future mining runs can
  jump directly from stub to transcript without timestamp guessing

Verified both the happy path (stdin payload → UUID session_id +
transcript_path populated) and the fallback path (empty stdin → timestamp
session_id, empty transcript_path) via synthetic hook firings.

Future stubs from this hook version onward will correlate 1:1 with their
transcripts. Existing stubs (pre-fix) remain timestamp-keyed and will be
reconciled by the Phase 4 orphan-reconciliation step.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)" && git log --oneline -3
```

**Phase 2 exit criteria:**
- [ ] `.claude/hooks/session-capture.sh` reads stdin-payload / env-var / timestamp in that order.
- [ ] The stub JSON schema now includes `transcript_path`.
- [ ] Synthetic hook firings produce correct outputs on both happy and fallback paths.
- [ ] Phase 2 commit made; working tree clean except for unrelated noise.

---

## Phase 3 — Build mining runner

**Prerequisite:** Phase 2 complete and committed. The capture hook now writes correlatable stubs, and the Phase 1 findings tell us exactly how many mineable transcripts exist.

**Why this phase:** `/remember --mine-sessions` cannot read ProtoPulse's format (Finding 4). Rather than patching the upstream plugin (which would be overwritten on update), this phase builds a ProtoPulse-local bash script that replicates the `/remember` skill's friction-detection taxonomy but operates directly on `.jsonl` transcripts. The script is invoked per-transcript and produces candidate observation and methodology notes the executor will review and write in Phase 4.

**Design decision:** the mining runner does NOT write notes directly. It produces a structured report (friction candidates with evidence) that the agent reads and uses to make Write calls. This separation matters because friction classification is inherently semantic and an LLM is better positioned than bash to decide what becomes an observation vs a methodology note vs gets discarded as a non-pattern.

---

### Task 3.1: Write the mining-runner script

**Files:**
- Create: `ops/queries/mine-session.sh`

**Context:** the script takes a transcript path, streams the JSONL, and emits a Markdown-formatted friction-candidate report to stdout. The report is human-readable and agent-readable. Categories follow the `/remember` skill taxonomy.

- [ ] **Step 1: Read the /remember taxonomy for reference**

```bash
sed -n '285,310p' /home/wtyler/.claude/plugins/cache/agenticnotetaking/arscontexta/0.8.0/platforms/shared/skill-blocks/remember.md
```

Record the 6 pattern categories from the skill:
1. User corrections
2. Repeated redirections
3. Workflow breakdowns
4. Agent confusion
5. Undocumented decisions
6. Escalation patterns

These become the categories the mining script searches for.

- [ ] **Step 2: Write the mining runner**

Use the Write tool to create `/home/wtyler/Projects/ProtoPulse/ops/queries/mine-session.sh` with this exact content:

```bash
#!/usr/bin/env bash
# ProtoPulse session mining runner
# Usage: ops/queries/mine-session.sh <transcript.jsonl>
# Outputs a markdown friction-candidate report to stdout.
#
# Detection taxonomy (from /remember skill spec):
#   1. User corrections       — direct "no/wrong/stop" followed by alternative
#   2. Repeated redirections  — same correction appearing >1 time
#   3. Workflow breakdowns    — tool errors, retries, wrong outputs
#   4. Agent confusion        — questions the agent should have known
#   5. Undocumented decisions — choices made without reasoning
#   6. Escalation patterns    — tone shift from gentle to firm
#
# This is a REPORTING script, not a note-writing one. The agent reviews
# the report and decides which candidates become observations vs
# methodology notes vs discards.

set -uo pipefail

TRANSCRIPT="${1:-}"
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  echo "usage: $0 <transcript.jsonl>" >&2
  exit 2
fi

BASENAME="$(basename "$TRANSCRIPT" .jsonl)"
BYTES="$(stat -c '%s' "$TRANSCRIPT")"
LINES="$(wc -l < "$TRANSCRIPT")"
FIRST_TS="$(head -20 "$TRANSCRIPT" | jq -r 'select(.timestamp) | .timestamp' 2>/dev/null | head -1)"
LAST_TS="$(tail -20 "$TRANSCRIPT" | jq -r 'select(.timestamp) | .timestamp' 2>/dev/null | tail -1)"

cat <<HEADER
# Friction Candidates — $BASENAME

**Transcript:** \`$TRANSCRIPT\`
**Size:** $BYTES bytes / $LINES lines
**Time range:** $FIRST_TS → $LAST_TS

---

HEADER

# Helper: extract user message text with line-number anchors.
# User messages have shape {type:"user", message:{role:"user", content:"..."}}
# Content may be a string OR an array of content blocks.
extract_user_messages() {
  jq -r --unbuffered '
    select(.type == "user" and (.message.role // "") == "user")
    | (.message.content // "")
    | if type == "string" then .
      elif type == "array" then
        map(if type == "object" and has("text") then .text
            elif type == "object" and has("content") then (.content // "")
            else "" end) | join(" ")
      else ""
      end
  ' "$TRANSCRIPT" 2>/dev/null
}

# Helper: extract assistant text blocks (agent utterances).
extract_assistant_messages() {
  jq -r --unbuffered '
    select(.type == "assistant")
    | (.message.content // [])
    | if type == "array" then
        map(if type == "object" and .type == "text" then .text else "" end) | join(" ")
      else tostring end
  ' "$TRANSCRIPT" 2>/dev/null
}

# Helper: find tool_result entries with is_error:true
extract_tool_errors() {
  jq -r --unbuffered '
    select(.type == "user" and (.message.content // [] | type) == "array")
    | .message.content[]?
    | select(type == "object" and .type == "tool_result" and .is_error == true)
    | .content
    | if type == "string" then .
      elif type == "array" then map(.text // "") | join(" ")
      else "" end
  ' "$TRANSCRIPT" 2>/dev/null
}

# 1. User corrections — keywords followed by redirection
echo "## 1. User Corrections"
echo ""
USER_TEXT="$(extract_user_messages)"
CORRECTION_HITS="$(echo "$USER_TEXT" | grep -iE '(no,?|wrong|stop|don'"'"'t|never|not like that|incorrect|actually)' | head -20)"
if [ -n "$CORRECTION_HITS" ]; then
  echo '```'
  echo "$CORRECTION_HITS" | sed 's/^/- /'
  echo '```'
else
  echo '_None detected._'
fi
echo ""

# 2. Repeated redirections — same correction ≥2x
echo "## 2. Repeated Redirections"
echo ""
REPEATS="$(echo "$USER_TEXT" | grep -iE '(again|already said|the (third|fourth|fifth) time|why did you)' | head -10)"
if [ -n "$REPEATS" ]; then
  echo '```'
  echo "$REPEATS" | sed 's/^/- /'
  echo '```'
else
  echo '_None detected._'
fi
echo ""

# 3. Workflow breakdowns — tool errors + retry patterns
echo "## 3. Workflow Breakdowns"
echo ""
ERRORS="$(extract_tool_errors | head -20)"
if [ -n "$ERRORS" ]; then
  echo '```'
  echo "$ERRORS" | sed 's/^/- /'
  echo '```'
else
  echo '_None detected._'
fi
echo ""

# 4. Agent confusion — agent questions that suggest missing context
echo "## 4. Agent Confusion"
echo ""
AGENT_TEXT="$(extract_assistant_messages)"
CONFUSION="$(echo "$AGENT_TEXT" | grep -iE '(should I|what would you like|which approach|unclear|not sure|can you clarify)' | head -10)"
if [ -n "$CONFUSION" ]; then
  echo '```'
  echo "$CONFUSION" | sed 's/^/- /'
  echo '```'
else
  echo '_None detected._'
fi
echo ""

# 5. Undocumented decisions — user directives without explanation
echo "## 5. Undocumented Decisions"
echo ""
DIRECTIVES="$(echo "$USER_TEXT" | grep -iE '(always|never|from now on|prefer|skip|ignore)' | head -10)"
if [ -n "$DIRECTIVES" ]; then
  echo '```'
  echo "$DIRECTIVES" | sed 's/^/- /'
  echo '```'
else
  echo '_None detected._'
fi
echo ""

# 6. Escalation patterns — profanity + strong directives
echo "## 6. Escalation Patterns"
echo ""
ESCALATION="$(echo "$USER_TEXT" | grep -iE '(fuck|shit|dammit|stop|absolutely|mandatory|must)' | head -10)"
if [ -n "$ESCALATION" ]; then
  echo '```'
  echo "$ESCALATION" | sed 's/^/- /'
  echo '```'
else
  echo '_None detected._'
fi
echo ""

echo "---"
echo ""
echo "**Next step:** the executing agent reviews each section, classifies"
echo "true friction signals (not false positives), and decides whether"
echo "each becomes an observation note, a methodology note, or gets"
echo "discarded as noise. Raw grep hits are candidates, not conclusions."
```

- [ ] **Step 3: Make it executable**

```bash
chmod +x ops/queries/mine-session.sh && \
  ls -l ops/queries/mine-session.sh
```

Expected: permissions include `x` for owner.

---

### Task 3.2: Test the mining runner on the smallest extant transcript

**Files:** none (test run)

- [ ] **Step 1: Pick the smallest real transcript (not the current session)**

```bash
# List all transcripts by size, skip the currently-running one
CURRENT_SESSION_FILE="$(ls -t ~/.claude/projects/-home-wtyler-Projects-ProtoPulse/*.jsonl 2>/dev/null | head -1)"
ls -lSr ~/.claude/projects/-home-wtyler-Projects-ProtoPulse/*.jsonl 2>/dev/null | \
  grep -v "$CURRENT_SESSION_FILE" | head -3
```

Pick the smallest one (likely a trivial session) for the test.

- [ ] **Step 2: Run the mining runner**

```bash
SMALLEST="$(ls -lSr ~/.claude/projects/-home-wtyler-Projects-ProtoPulse/*.jsonl 2>/dev/null | head -1 | awk '{print $NF}')"
echo "Mining: $SMALLEST"
bash ops/queries/mine-session.sh "$SMALLEST" > /tmp/mine-test-output.md
cat /tmp/mine-test-output.md
```

Expected: markdown-formatted report with 6 sections (one per category). Each section either has grep hits in a code block or `_None detected._`. The report should be human-readable.

If the script errors out (e.g., `jq` parse failure on the transcript), debug by checking the jq query against a single line of the transcript:

```bash
head -5 "$SMALLEST" | jq -c '.'
```

Adjust the extraction helpers in `mine-session.sh` if the message content shape differs from the assumption. Commit the adjustments as part of Phase 3.

- [ ] **Step 3: Validate the report shape**

```bash
grep -c '^## ' /tmp/mine-test-output.md
```

Expected: `6` (one header per category). If fewer, re-check the script for missing `echo "## ..."` lines.

- [ ] **Step 4: Clean up test output**

```bash
rm /tmp/mine-test-output.md
```

---

### Task 3.3: Commit Phase 3

**Files:** none (commit)

- [ ] **Step 1: Check git status**

```bash
git status --short
```

Expected:
```
A  ops/queries/mine-session.sh
```

or (if auto-committed already):

```
(empty)
```

If the mining runner was auto-committed, soft-reset to Phase 2's commit and re-stage:

```bash
PHASE_2_HASH=$(git log --oneline | grep 'session-mining phase 2' | head -1 | awk '{print $1}')
git reset --soft "$PHASE_2_HASH"
git restore --staged .claude/.tsc-errors.log ops/sessions/ 2>/dev/null || true
git add ops/queries/mine-session.sh
```

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
vault: session-mining phase 3 — build ProtoPulse-local mining runner

Why a local runner instead of /remember --mine-sessions:
- /remember expects ops/sessions/*.md files with frontmatter and
  in-body transcript; ProtoPulse writes .json touch-counter stubs
  with the real transcript at ~/.claude/projects/.../UUID.jsonl
- Patching /remember at the plugin level would be overwritten on
  arscontexta plugin update
- A ProtoPulse-local bash script can read .jsonl directly and emit
  friction candidates per the /remember taxonomy without format
  translation

ops/queries/mine-session.sh:
- Reads a single .jsonl transcript via jq
- Emits a markdown friction-candidate report to stdout
- 6 pattern categories from /remember spec:
  1. User corrections
  2. Repeated redirections
  3. Workflow breakdowns (tool errors with is_error:true)
  4. Agent confusion
  5. Undocumented decisions
  6. Escalation patterns
- Reports candidates, not conclusions — the executing agent reviews
  each section and decides observation vs methodology vs discard

Tested on the smallest real transcript; report shape validated
(6 category headers present).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)" && git log --oneline -4
```

**Phase 3 exit criteria:**
- [ ] `ops/queries/mine-session.sh` exists and is executable.
- [ ] The script produces a 6-section markdown report when given a real transcript.
- [ ] The script does NOT write notes directly — it only emits the report to stdout.
- [ ] Phase 3 commit made.

---

## Phase 4 — Initial mining batch + orphan reconciliation

**Prerequisite:** Phase 3 complete and committed. `ops/queries/mine-session.sh` works.

**Why this phase:** now that capture and mining infrastructure are repaired, process the actual backlog: (a) reconcile the ~221 orphan stubs so they stop counting as "unmined work," and (b) run the mining runner against each correlatable transcript and convert the raw candidates into permanent observation and methodology notes.

This is the phase where actual knowledge is added to the vault. Everything before was infrastructure.

---

### Task 4.1: Reconcile orphan stubs

**Files:**
- Modify: `ops/sessions/*.json` (221+ files, bulk update to terminal status)
- Create: `ops/queries/reconcile-orphan-stubs.sh` (reconciliation helper)

**Context:** for each stub in `/tmp/protopulse-orphan-stubs.txt` (generated in Phase 1 Task 1.3), update the JSON's `mined` field from `false` to `"transcript-unavailable"`. This is a terminal state indicating the stub cannot ever be mined because its transcript was deleted before any mining run fired. Future `/architect` health scans should not flag these as actionable work.

- [ ] **Step 1: Verify the orphan stub list still exists**

```bash
wc -l /tmp/protopulse-orphan-stubs.txt 2>/dev/null || echo "MISSING"
```

Expected: around 220 lines. If the file is missing (e.g., `/tmp` was cleared between sessions), rerun Phase 1 Task 1.3 to regenerate it before proceeding.

- [ ] **Step 2: Write the reconciliation script**

Use the Write tool to create `/home/wtyler/Projects/ProtoPulse/ops/queries/reconcile-orphan-stubs.sh`:

```bash
#!/usr/bin/env bash
# Reconcile orphan session stubs — stubs with no matching transcript.
# Usage: ops/queries/reconcile-orphan-stubs.sh <orphan-list.txt>
#
# Orphan stubs are a byproduct of (a) the pre-fix capture hook writing
# timestamp IDs instead of UUIDs, and (b) Claude Code transcript
# retention cleanup deleting transcripts before any mining run.
#
# This script marks each orphan stub as mined:"transcript-unavailable"
# so health scans stop flagging them.

set -uo pipefail

ORPHAN_LIST="${1:-}"
if [ -z "$ORPHAN_LIST" ] || [ ! -f "$ORPHAN_LIST" ]; then
  echo "usage: $0 <orphan-list.txt>" >&2
  exit 2
fi

COUNT=0
SKIPPED=0
while IFS= read -r stub_path; do
  [ -z "$stub_path" ] && continue
  if [ ! -f "$stub_path" ]; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Use jq to set mined: "transcript-unavailable" and add reconciled_at
  tmp_file="${stub_path}.tmp"
  jq '.mined = "transcript-unavailable" | .reconciled_at = (now | todate) | .reconciled_reason = "Claude Code retention cleanup deleted transcript before any mining run"' \
    "$stub_path" > "$tmp_file" 2>/dev/null

  if [ -s "$tmp_file" ]; then
    mv "$tmp_file" "$stub_path"
    COUNT=$((COUNT + 1))
  else
    rm -f "$tmp_file"
    SKIPPED=$((SKIPPED + 1))
  fi
done < "$ORPHAN_LIST"

echo "Reconciled: $COUNT"
echo "Skipped: $SKIPPED"
```

- [ ] **Step 3: Make it executable**

```bash
chmod +x ops/queries/reconcile-orphan-stubs.sh
```

- [ ] **Step 4: Dry-run on a single orphan to verify the JSON shape**

```bash
FIRST_ORPHAN="$(head -1 /tmp/protopulse-orphan-stubs.txt)"
echo "Testing on: $FIRST_ORPHAN"
# Use jq directly to see the transformation without modifying the file
jq '.mined = "transcript-unavailable" | .reconciled_at = (now | todate) | .reconciled_reason = "Claude Code retention cleanup deleted transcript before any mining run"' "$FIRST_ORPHAN"
```

Expected: the stub JSON with `mined`, `reconciled_at`, and `reconciled_reason` fields set. No modification to the actual file yet.

- [ ] **Step 5: Run the reconciliation on the full orphan list**

```bash
bash ops/queries/reconcile-orphan-stubs.sh /tmp/protopulse-orphan-stubs.txt
```

Expected output: `Reconciled: ~221`, `Skipped: 0` (or a small handful if some stubs were deleted concurrently).

- [ ] **Step 6: Verify reconciliation**

```bash
# Spot-check a random orphan stub
RANDOM_ORPHAN="$(shuf -n 1 /tmp/protopulse-orphan-stubs.txt)"
cat "$RANDOM_ORPHAN" | jq '.'
```

Expected: `"mined": "transcript-unavailable"` and `reconciled_at` present.

```bash
# Count all stubs by mined status
for s in ops/sessions/*.json; do
  [ "$(basename "$s")" = "current.json" ] && continue
  jq -r '.mined' "$s" 2>/dev/null
done | sort | uniq -c
```

Expected: around 221 `transcript-unavailable` entries + around 10 `false` entries (the correlatable stubs awaiting Task 4.2) + possibly a small number of other values.

---

### Task 4.2: Mine each correlatable transcript

**Files:** none yet (agent-driven reading)

**Context:** for each transcript in the Phase 1 classification list (CORRELATABLE + UNCERTAIN, excluding the currently-running session), run the mining script and produce a friction-candidate report. The executing agent reads each report and decides which candidates become observation notes and which become methodology notes in Task 4.3.

**IMPORTANT:** exclude the currently-running session's transcript — it's still being written to and mining it mid-session would produce inconsistent data. The currently-running transcript can be identified as the one with the most recent mtime in `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/`.

- [ ] **Step 1: Identify the currently-running session transcript**

```bash
CURRENT_TRANSCRIPT="$(ls -t ~/.claude/projects/-home-wtyler-Projects-ProtoPulse/*.jsonl 2>/dev/null | head -1)"
echo "Current (skip): $CURRENT_TRANSCRIPT"
```

- [ ] **Step 2: Run the mining runner against each non-current transcript**

```bash
mkdir -p /tmp/protopulse-mining-reports
for t in ~/.claude/projects/-home-wtyler-Projects-ProtoPulse/*.jsonl; do
  if [ "$t" = "$CURRENT_TRANSCRIPT" ]; then
    echo "SKIP (current): $t"
    continue
  fi
  uuid="$(basename "$t" .jsonl)"
  out="/tmp/protopulse-mining-reports/${uuid}.md"
  echo "MINE: $t"
  bash ops/queries/mine-session.sh "$t" > "$out"
done
ls -1 /tmp/protopulse-mining-reports/ | wc -l
```

Expected: ~9 reports produced.

- [ ] **Step 3: Read each report and categorize candidates**

The executing agent reads each `/tmp/protopulse-mining-reports/*.md` and performs semantic classification. For each candidate hit:

**Keep as observation note** when:
- The friction is novel (not already in `ops/observations/` or `ops/methodology/`)
- The pattern is unclear enough that it needs accumulation before acting on it
- Multiple instances suggest a trend but no single clear rule

**Keep as methodology note** when:
- The friction corresponds to a clear behavioral directive ("always X", "never Y")
- A single unambiguous instance reveals a rule
- The lesson generalizes beyond the specific session

**Discard when:**
- The grep hit is a false positive (e.g., "no" inside an unrelated word like "note", "not" matching past tense, etc.)
- The content is already captured in an existing ops/methodology/ note
- The friction is ProtoPulse-session-specific and not generalizable

Keep a running tally in a scratch doc `/tmp/protopulse-mining-decisions.md` with one line per kept candidate:

```
observation: <title> | <source-transcript-uuid> | <evidence-snippet>
methodology: <title> | <source-transcript-uuid> | <evidence-snippet>
discard: <category> | <reason>
```

This scratch file is not committed — it just tracks the agent's classification decisions for the writing step.

- [ ] **Step 4: Dedup against existing ops/methodology/ and ops/observations/**

Before writing any new notes, check whether the candidate overlaps with existing ones:

```bash
ls -1 ops/methodology/*.md | sed 's|ops/methodology/||; s|\.md$||'
ls -1 ops/observations/*.md | sed 's|ops/observations/||; s|\.md$||'
```

For each candidate, grep the existing notes for overlapping keywords. If an existing note covers the same friction, either extend the existing note's body with the new evidence OR discard the candidate as duplicate.

---

### Task 4.3: Write observation and methodology notes

**Files:**
- Create: zero or more `ops/observations/2026-04-11-*.md` notes
- Create: zero or more `ops/methodology/*.md` notes

**Context:** convert the classification decisions from Task 4.2 Step 3 into actual notes on disk. The quantity is impossible to predict in advance — it depends on what the transcripts actually contain. This plan does not prescribe exact note bodies because that would be fiction.

- [ ] **Step 1: For each kept observation candidate, write the note**

For each entry marked `observation:` in the scratch decisions file, write a new file at `ops/observations/2026-04-11-<slug>.md` using the structure below. The slug is a kebab-case summary of the friction, max ~60 chars.

```markdown
---
observed_date: 2026-04-11
category: [friction|surprise|recurring-pattern|system-drift|vocabulary-mismatch|missing-connection]
severity: [low|medium|high]
resolved: false
resolution: ""
---

# [Prose-as-title describing the observation]

## Context

[What was happening in the session — task being performed, phase of work,
relevant background. One or two paragraphs.]

## Signal

[What specifically indicated the friction. Quote the evidence from the
transcript (user correction, tool error, escalation pattern). Be precise
about WHAT felt wrong, not just THAT something was wrong.]

## Potential Response

[Initial thoughts on what to change. Leave blank if the pattern isn't
clear enough yet to propose a response — this observation is a signal,
not a solution.]

---

Topics:
- [[methodology]]
```

Category must be from the enum in `templates/observation.md`. Severity can be blank if not obvious.

- [ ] **Step 2: For each kept methodology candidate, write the note**

For each entry marked `methodology:` in the scratch decisions file, write a new file at `ops/methodology/<slug>.md` using the structure from the `/remember` skill spec (lines 102-133):

```markdown
---
description: [what this methodology note teaches — specific enough to be actionable]
type: methodology
category: [processing|capture|connection|maintenance|voice|behavior|quality]
source: session-mining
session_source: [transcript-uuid]
created: 2026-04-11
status: active
---

# [Prose-as-title describing the learned behavior]

## What to Do

[Clear, specific guidance. Not "be careful" but "when encountering X, do Y instead of Z."]

## What to Avoid

[The specific anti-pattern this note prevents. What was the agent doing wrong?]

## Why This Matters

[What goes wrong without this guidance. Connect to the user's actual friction.]

## Scope

[When does this apply? Always? Only for certain content types? Only during specific phases? Be explicit about boundaries.]

---

Related: [[methodology]]
```

The category must be one of: `processing`, `capture`, `connection`, `maintenance`, `voice`, `behavior`, `quality` (from the `/remember` skill spec).

- [ ] **Step 3: Update knowledge/methodology.md if any new methodology notes were created**

If Task 4.3 Step 2 created new methodology notes, they need a Topics link target. The `knowledge/methodology.md` file was collapsed to a navigation stub in the prior plan (Phase 3). It points to `self/methodology.md` and `ops/methodology/` — this is still accurate.

However, the new methodology notes may warrant a MOC entry in `ops/methodology/methodology.md` (the operational methodology MOC inside `ops/`). If it exists, read it and add entries; if it doesn't, this step is a no-op.

```bash
ls ops/methodology/methodology.md 2>/dev/null && \
  cat ops/methodology/methodology.md | head -30 || \
  echo "ops/methodology/methodology.md does not exist — skipping MOC update"
```

If the file exists, add a new entry in the appropriate category section pointing to each new methodology note. If it doesn't exist, note that as a deferred task (can be addressed in a future `/architect` pass — not in scope for this plan).

- [ ] **Step 4: Mark the mined stubs as complete**

For each correlatable stub in `/tmp/protopulse-stub-transcript-map.txt` whose transcript was successfully mined:

```bash
# For each correlatable stub, update mined to true with provenance
while IFS= read -r line; do
  uuid=$(echo "$line" | awk '{print $1}')
  ts=$(echo "$line" | awk '{print $2}')
  stub=$(echo "$line" | awk '{print $3}')
  diff=$(echo "$line" | awk '{print $4}' | sed 's/diff=//;s/s//')
  # Only process correlatable (diff < 60s) mappings
  if [ -n "$diff" ] && [ "$diff" -lt 60 ] && [ -f "$stub" ]; then
    tmp="${stub}.tmp"
    jq --arg uuid "$uuid" '.mined = true | .mined_at = (now | todate) | .transcript_uuid = $uuid' "$stub" > "$tmp"
    [ -s "$tmp" ] && mv "$tmp" "$stub" || rm -f "$tmp"
    echo "Marked mined: $stub → transcript $uuid"
  fi
done < /tmp/protopulse-stub-transcript-map.txt
```

Expected: ~5-8 stubs marked (the correlatable ones, minus the current session and any skipped trivial sessions).

- [ ] **Step 5: Verify zero orphans and note counts**

```bash
bash ops/queries/orphan-notes.sh 2>&1 | tail -5 && \
  echo "=== observations ===" && \
  find ops/observations -name '*.md' | wc -l && \
  echo "=== methodology notes ===" && \
  find ops/methodology -name '*.md' | wc -l
```

Expected: zero orphan notes (the new observation and methodology notes all have Topics links and MOC backlinks). Observation and methodology counts should be ≥ starting counts (1 and 6 respectively).

If orphans appear, the new notes are missing Topics footers — fix them before committing.

---

### Task 4.4: Commit Phase 4

**Files:** none (commit)

- [ ] **Step 1: Check git status**

```bash
git status --short
```

Expected:
```
M  .claude/.tsc-errors.log        (unrelated, unstage)
M  ops/sessions/*.json             (221 reconciled + 5-8 mined)
A  ops/queries/reconcile-orphan-stubs.sh
A  ops/observations/2026-04-11-*.md  (N new)
A  ops/methodology/*.md              (M new)
```

If auto-commits have scattered this across multiple commits, soft-reset to Phase 3 and restage:

```bash
PHASE_3_HASH=$(git log --oneline | grep 'session-mining phase 3' | head -1 | awk '{print $1}')
git reset --soft "$PHASE_3_HASH"
git restore --staged .claude/.tsc-errors.log 2>/dev/null || true
git status --short
```

- [ ] **Step 2: Commit**

Adjust the commit message to reflect the actual counts of new observation and methodology notes (not template placeholders):

```bash
git commit -m "$(cat <<'EOF'
vault: session-mining phase 4 — initial mining batch + orphan reconciliation

Reconciliation:
- 221 orphan stubs (no matching transcript due to Claude Code retention
  cleanup) marked as mined:"transcript-unavailable" with reconciled_at
  timestamp and reason
- ops/queries/reconcile-orphan-stubs.sh created for re-running if new
  orphans appear

Mining batch (first real run end-to-end):
- [N] correlatable transcripts mined via ops/queries/mine-session.sh
- [X] new observation notes in ops/observations/ covering:
  [list friction-pattern titles]
- [Y] new methodology notes in ops/methodology/ covering:
  [list methodology-note titles]
- [Z] candidates discarded as false positives or duplicates of existing
  notes
- 5-8 correlatable stubs marked mined:true with transcript_uuid
  provenance

Zero orphans introduced. knowledge/methodology.md navigation stub
(from prior plan's Phase 3) remains accurate — new methodology
notes are operational (ops/) not conceptual (knowledge/).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)" && git log --oneline -5
```

**Phase 4 exit criteria:**
- [ ] `ops/queries/reconcile-orphan-stubs.sh` exists and is executable.
- [ ] ~221 stubs have `mined: "transcript-unavailable"` + reconciled provenance.
- [ ] ~5-8 stubs have `mined: true` + `transcript_uuid` provenance.
- [ ] All mineable transcripts (minus current + trivial) have been processed by the mining runner.
- [ ] Zero orphan notes in the vault.
- [ ] Phase 4 commit made.

---

## Phase 5 — Documentation, queue update, new health snapshot

**Prerequisite:** Phases 1-4 complete and committed.

**Why this phase:** the queue, derivation log, and health snapshot reflect the pre-mining state. Update them now so future `/architect` passes see accurate baselines and the pipeline-repair work is captured in the vault's evolution history.

---

### Task 5.1: Update ops/queue/queue.json maint-001

**Files:**
- Modify: `ops/queue/queue.json`

**Context:** the maint-001 task was last touched in the prior plan's Phase 1, set to `target: 231 session files` with a 3-step mining strategy in the notes. It needs to reflect the post-batch reality: X transcripts mined, 221 orphans reconciled, pipeline repaired.

- [ ] **Step 1: Read current queue state**

```bash
cat ops/queue/queue.json | jq '.tasks[] | select(.id == "maint-001")'
```

Record the current target, priority, notes, and status.

- [ ] **Step 2: Update maint-001 to reflect post-mining state**

Use the Edit tool on `ops/queue/queue.json` to update the `maint-001` task. The new shape:

```json
    {
      "id": "maint-001",
      "type": "maintenance",
      "priority": "slow",
      "status": "done",
      "condition_key": "unprocessed_sessions",
      "target": "[N] correlatable transcripts mined + 221 orphan stubs reconciled (transcript-unavailable)",
      "action": "ops/queries/mine-session.sh + ops/queries/reconcile-orphan-stubs.sh (runbook for future batches)",
      "notes": "Pipeline repaired 2026-04-11: capture hook now writes transcript UUIDs + transcript_path. ProtoPulse-local mining runner at ops/queries/mine-session.sh complements /remember --mine-sessions (which can't read .json stubs). For future mining, run the mining runner against any transcript in ~/.claude/projects/-home-wtyler-Projects-ProtoPulse/*.jsonl that has a corresponding stub with mined:false. Orphan stubs are a byproduct of pre-fix history + Claude Code retention — no action needed unless they start accumulating post-fix (if so, the capture hook fix regressed).",
      "auto_generated": true,
      "last_updated": "2026-04-11",
      "completed_at": "2026-04-11",
      "created": "2026-04-06T03:52:00Z"
    },
```

Replace `[N]` with the actual number of mined transcripts from Phase 4.

Use the Edit tool with the exact current `maint-001` content as old_string.

- [ ] **Step 3: Verify JSON is still valid**

```bash
python3 -m json.tool ops/queue/queue.json > /dev/null && echo "valid" || echo "INVALID"
```

Expected: `valid`

- [ ] **Step 4: Optionally add a new maintenance task for ongoing mining**

If the pipeline is expected to run routinely going forward (e.g., weekly mining of accumulated stubs), add a new task:

```json
    {
      "id": "maint-004",
      "type": "maintenance",
      "priority": "multi-session",
      "status": "pending",
      "condition_key": "unprocessed_sessions",
      "target": "Routine mining of any new unmined stubs with transcript_path populated",
      "action": "For each ops/sessions/*.json with mined:false and transcript_path set, run ops/queries/mine-session.sh $transcript_path and process findings",
      "notes": "Replaces old maint-001 semantics. Fires only on stubs created AFTER the Phase 2 capture-hook fix landed.",
      "auto_generated": false,
      "last_updated": "2026-04-11",
      "created": "2026-04-11"
    }
```

This is optional — skip if the user prefers one-shot mining.

---

### Task 5.2: Append Evolution Log entry in ops/derivation.md

**Files:**
- Modify: `ops/derivation.md` (append to Evolution Log section)

**Context:** document the pipeline-repair work in the derivation log so future `/architect` passes have context for why the stubs now have new fields and why `ops/queries/mine-session.sh` exists.

- [ ] **Step 1: Find the insertion point**

```bash
grep -n 'Evolution Log\|2026-04-11\|## Generation Parameters' ops/derivation.md
```

The prior plan's Phase 4 already added a 2026-04-11 entry. The new entry goes AFTER that one and BEFORE `## Generation Parameters`.

- [ ] **Step 2: Read the last line of the prior entry**

```bash
sed -n '/### 2026-04-11/,/## Generation Parameters/p' ops/derivation.md | tail -20
```

Record the last line before `## Generation Parameters` — this becomes the old_string anchor for the Edit.

- [ ] **Step 3: Append the new entry**

Use the Edit tool to insert a new Evolution Log entry after the prior 2026-04-11 entry:

**old_string:** (the last paragraph of the prior 2026-04-11 entry + `## Generation Parameters`)

```
**Remaining work:** 231 unmined session files still require a `/remember --mine-sessions` batch run. That work is deliberately out of scope for this /architect pass — this pass restored the detection/queue/observation machinery; the actual mining batch is its own session. The queue task is now accurate and the infrastructure is ready.

## Generation Parameters
```

**new_string:**

```
**Remaining work:** 231 unmined session files still require a `/remember --mine-sessions` batch run. That work is deliberately out of scope for this /architect pass — this pass restored the detection/queue/observation machinery; the actual mining batch is its own session. The queue task is now accurate and the infrastructure is ready.

### 2026-04-11: session-mining pipeline rebuilt end-to-end
**Trigger:** Follow-up to the /architect pass's R6 recommendation. The "231 unmined sessions" queue target from the prior plan was empirically invalidated — only ~10 real transcripts exist (Claude Code retention cleanup), and the capture hook was writing timestamp IDs instead of transcript UUIDs because `$CLAUDE_CONVERSATION_ID` is empty in Stop-hook environment.

**Root-cause findings (Phase 1 diagnostic observation note):**
1. `.claude/hooks/session-capture.sh:20` fell through to `$(date +%Y%m%d-%H%M%S)` — confirmed empirically via temporary probe hook.
2. The canonical Claude Code session identifier in Stop-hook context is `[CORRECT_VAR_NAME]` (from Task 1.2 finding).
3. Only [N] real transcripts in `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/`; retention cleanup keeps recent sessions only.
4. `/remember --mine-sessions` expects `ops/sessions/*.md` with frontmatter; ProtoPulse writes `.json` touch-counter stubs with zero transcript body. Format incompatible at the skill level.

**Changes implemented:**
1. **Phase 2 — Fixed capture hook.** `.claude/hooks/session-capture.sh` now reads stdin JSON payload / env vars / timestamp in that order. Stub schema extended with `transcript_path` field so future mining runs jump from stub directly to transcript without timestamp guessing.
2. **Phase 3 — Built ProtoPulse-local mining runner.** `ops/queries/mine-session.sh` reads a `.jsonl` transcript and emits a markdown friction-candidate report via 6 pattern categories (corrections, redirections, workflow breakdowns, agent confusion, undocumented decisions, escalation patterns — the `/remember` skill taxonomy). The runner reports candidates, not conclusions — the executing agent does semantic classification.
3. **Phase 4a — Reconciled orphan stubs.** 221 stubs with no matching transcript marked `mined:"transcript-unavailable"` via `ops/queries/reconcile-orphan-stubs.sh`. Terminal status — future health scans stop flagging them.
4. **Phase 4b — Initial mining batch.** [N] correlatable transcripts mined end-to-end. [X] new observation notes, [Y] new methodology notes, [Z] candidates discarded as false positives or duplicates. Correlatable stubs marked `mined:true` with `transcript_uuid` provenance.
5. **Phase 5 — Queue + docs updated.** `maint-001` marked done with runbook-style notes for future routine mining. This log entry captures the end-to-end pipeline repair.

**Vault state after:**
- Notes: 146 + [X + Y] new notes in ops/observations/ and ops/methodology/
- Session stubs: 233 → 221 `transcript-unavailable` + [N] `mined:true` + a small number `false` (new post-fix stubs awaiting routine mining)
- Queue: maint-001 done; optional maint-004 pending for routine mining
- Mining pipeline: operational end-to-end — capture → stub → correlate → mine → notes
- Observation count: 1 → 2 (diagnostic observation from Phase 1) → 2 + [X]
- Methodology count: 6 → 6 + [Y]

**Remaining work:** none in this plan's scope. Follow-up work items (if any) are the new methodology notes themselves — each is a behavioral directive the agent should internalize. The currently-running session will be mineable only after it ends and its stub is created by the post-fix capture hook.

## Generation Parameters
```

Fill in `[CORRECT_VAR_NAME]`, `[N]`, `[X]`, `[Y]`, `[Z]` with actual values from Phases 1-4 before committing.

- [ ] **Step 4: Verify the insertion**

```bash
grep -c '2026-04-11: session-mining' ops/derivation.md && \
  grep -A 2 '2026-04-11: session-mining' ops/derivation.md | head -5
```

Expected: the new entry heading is visible. Count should be `1`.

---

### Task 5.3: Write a new health snapshot

**Files:**
- Create: `ops/health/2026-04-11-post-mining-health.md` (or `2026-04-12-...` if work runs past midnight)

**Context:** the health report from the prior plan's Phase 1 captured the pre-remediation state. This new snapshot captures the post-mining state as a new baseline for future `/architect` passes to compare against.

- [ ] **Step 1: Read the existing health report for structure reference**

```bash
cat ops/health/2026-04-11-full-system-health.md | head -30
```

Use the same structural shape (headers: Schema Compliance, MOC Sizing, Operational State, Dimension Coherence, Failure Modes Active, Link Density, Previous Architect Passes, Remediation Applied).

- [ ] **Step 2: Write the new snapshot**

Use the Write tool to create `ops/health/2026-04-11-post-mining-health.md` with the same structure but filled in with post-mining numbers:

```markdown
---
health_date: 2026-04-11
generated_by: session-mining-rebuild
supersedes: ops/health/2026-04-11-full-system-health.md
---

# Post-Mining System Health Snapshot — 2026-04-11

Captured at the completion of the session-mining pipeline rebuild (this plan). Supersedes the pre-remediation baseline from the same day. Future /architect passes should compare their findings against this file.

## Schema Compliance

[Copy the table from the prior health report, updating counts to reflect any new notes.]

## MOC Sizing

[Copy the table, updating architecture-decisions (31), dev-infrastructure (15), gaps-and-opportunities (30), methodology (2) to match post-prior-plan state.]

## Operational State

| Signal | Observed | Expected per spec |
|---|---|---|
| Unmined correlatable stubs | 0 (or a small handful of post-fix new ones) | mined:false only for post-fix stubs |
| Orphan stubs (transcript-unavailable) | 221 | terminal — no action |
| Real transcripts available | ~10 (Claude Code retention) | variable |
| Observations pending | 2 + [X new] | |
| Methodology notes | 6 + [Y new] | |
| Tensions open | 0 | |
| Inbox depth | 0 | |
| Queue tasks | 1 done (maint-001) + possibly 1 pending (maint-004) | |
| ops/health/ directory | 2 snapshots (pre + post) | populated |

## Dimension Coherence

Zero drift.

## Failure Modes Active

1. **MOC Sprawl (#5)** — MITIGATED. All MOCs under 40-entry threshold after prior plan's Phases 2-3.
2. **Over-Automation (#8)** — RESOLVED. Capture hook fixed (Phase 2), mining runner built (Phase 3), backlog processed (Phase 4). The feedback loop is operational end-to-end.
3. **Productivity Porn (#9)** — MITIGATED. Both the prior plan and this one stayed within scope boundaries.

## Link Density

[Copy from prior snapshot, update counts for new notes.]

## Previous Architect Passes

- 2026-04-06: first full /architect pass after comprehensive audit ingestion.
- 2026-04-11 (earlier): /architect full run → 6 recommendations, implemented in docs/plans/2026-04-11-knowledge-vault-health-restoration.md.
- 2026-04-11 (later): session-mining pipeline rebuild (this work), implemented in docs/plans/2026-04-11-session-mining-pipeline-rebuild.md.

## Remediation Applied

See `ops/derivation.md` Evolution Log entries for 2026-04-11 (both the /architect entry and the session-mining entry).

---

**Next health snapshot:** suggested on next /architect pass or after first routine mining batch triggered by the new maint-004 (if it was created in Task 5.1 Step 4).
```

Fill in `[X new]` and `[Y new]` with actual values from Phase 4.

---

### Task 5.4: Commit Phase 5

**Files:** none (commit)

- [ ] **Step 1: Check git status**

```bash
git status --short
```

Expected:
```
M  ops/derivation.md
M  ops/queue/queue.json
A  ops/health/2026-04-11-post-mining-health.md
```

If auto-commits have scattered, soft-reset to Phase 4 and restage.

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
vault: session-mining phase 5 — queue update + evolution log + health snapshot

- ops/queue/queue.json: maint-001 marked done with runbook-style notes
  pointing to ops/queries/mine-session.sh + reconcile-orphan-stubs.sh
  for future routine mining. Optionally added maint-004 for ongoing
  routine mining of post-fix stubs.
- ops/derivation.md: appended 2026-04-11 session-mining-rebuild entry
  documenting all 5 phases, root-cause findings, and post-state metrics.
- ops/health/2026-04-11-post-mining-health.md: new snapshot superseding
  the pre-remediation baseline from earlier the same day. Future
  /architect passes should diff against this file.

Plan complete end-to-end. Session-mining feedback loop now operational:
capture → stub with transcript_path → correlate → mine → observation/
methodology notes → queue → health snapshot.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)" && git log --oneline -7
```

**Phase 5 exit criteria:**
- [ ] `ops/queue/queue.json` `maint-001` is `status: done`.
- [ ] `ops/derivation.md` Evolution Log has the 2026-04-11 session-mining entry.
- [ ] `ops/health/2026-04-11-post-mining-health.md` exists.
- [ ] Phase 5 commit made.
- [ ] Full plan execution complete: 5 commits from this plan, plus possibly `git log --oneline` shows the 4 prior-plan commits still in place.

---

## Rollback Plan

Every phase is a single atomic commit. To roll back:

- **Roll back Phase 5:** `git revert HEAD`
- **Roll back Phases 4+5:** `git revert HEAD HEAD~1`
- **Roll back Phases 3+4+5:** `git revert HEAD HEAD~1 HEAD~2`
- **Roll back everything:** `git revert HEAD HEAD~1 HEAD~2 HEAD~3 HEAD~4`

Do not use `git reset --hard` — the revert approach preserves history and is safe to push.

**Worst-case failure modes during execution:**

1. **Phase 1 probe hook breaks the session.** Mitigation: the probe is registered as ONE of multiple Stop hooks — if it crashes, Claude Code should still fire the others. Unregister at the end of Task 1.2 unconditionally, even if the probe failed.

2. **Phase 2 hook fix writes malformed JSON.** Mitigation: Task 2.3 dry-runs the fix in a throwaway directory before the real hook fires. If the fix produces malformed output, fix and re-test before committing.

3. **Phase 3 mining runner errors on a specific transcript.** Mitigation: the runner has `set -uo pipefail`, and each transcript is processed independently. A failure on one doesn't corrupt others. Log the failure, skip that transcript, process the rest, return to the failure with more context.

4. **Phase 4 bulk reconciliation corrupts stubs.** Mitigation: `reconcile-orphan-stubs.sh` writes to a tmp file and only moves it if non-empty. If corruption is detected post-run, restore from the Phase 3 commit via `git checkout <phase-3-hash> -- ops/sessions/`.

5. **Phase 4 mining classification produces too many duplicate notes.** Mitigation: Task 4.2 Step 4 explicitly deduplicates against existing notes before writing. If duplicates leak through, they can be cleaned up manually — they're cheap to remove and the plan doesn't block on this.

---

## Budget

| Phase | Scope | Estimated Time | Cumulative |
|---|---|---|---|
| 1 | Diagnose (empirical env-var test, stub-transcript mapping) | ~20 min | 20 min |
| 2 | Fix capture hook + dry-run tests | ~25 min | 45 min |
| 3 | Build mining runner + small-transcript test | ~30 min | 75 min |
| 4 | Reconcile 221 orphans + mine ~8 transcripts + write notes | ~45-90 min | 120-165 min |
| 5 | Queue update + evolution log + health snapshot | ~10 min | 130-175 min |

**Total: ~2-3 hours**, dominated by Phase 4 depending on transcript depth and the quantity of friction patterns found.

**25% per-session budget:** not applicable here because this is execution work (processing a known backlog), not meta-work (pre-emptive restructuring). The budget rule from `failure-modes.md` #9 targets unbounded rethinking/restructuring — this plan has a definite end state: infrastructure repaired, backlog drained, docs updated.

---

## End of Plan
