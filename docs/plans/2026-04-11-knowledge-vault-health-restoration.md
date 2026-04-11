# Knowledge Vault Health Restoration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 three-space boundary violations in `knowledge/methodology.md`, split 3 oversize topic maps (architecture-decisions 54→~27, dev-infrastructure 43→~16, gaps-and-opportunities 48→~31), collapse the `knowledge/methodology.md` MOC to a navigation stub, and restore the session-mining feedback loop (queue.json staleness + baseline observation note + ops/health/ directory).

**Architecture:** Pure markdown editing and JSON updates inside the Ars Contexta knowledge vault. No ProtoPulse source code changes. Four strictly-sequential phases with validation gates and a single commit per phase for clean rollback. The plan addresses both symptoms (MOC Sprawl, boundary violations) and root cause (severed feedback loop — 228 unmined sessions, zero observations, no health reports).

**Tech Stack:** Markdown (Obsidian wiki-links) + JSON (ops/queue/queue.json) + bash validation scripts in `ops/queries/` (dangling-links.sh, orphan-notes.sh, and ad-hoc grep counters).

---

## Corrections to Brainstorm Input

The brainstorm at `/home/wtyler/.claude/plans/smooth-prancing-token-agent-a092d63c2e3ce53e3.md` is detailed and correct in its diagnosis but contains three small inaccuracies this plan resolves:

1. **Dangling-link validation command.** The brainstorm repeatedly says "re-run dangling-link scan to confirm 0." Live test shows `ops/queries/dangling-links.sh` already resolves `ops/methodology/` as a valid target directory, so the 5 cross-space links are NOT currently flagged as dangling by the script. The violation is structural (three-space boundary), not script-detectable. Verification commands in this plan use a **specific grep for the 5 boundary-violating wiki-link targets** instead of the general dangling scan. The expected delta is 5→0 occurrences of those five specific links in `knowledge/methodology.md`.

2. **Unmined session count.** The brainstorm says 227. Live scan shows **228** (one new session since /architect ran). All references updated.

3. **R2 architecture-decisions target size.** The brainstorm claims "54 → ~22." Counting what actually needs to stay (narrative sections + Tensions + non-debt Knowledge Notes + 5 sub-map pointers) yields **~27 entries**. Still well below the 40 threshold; target revised to reflect reality.

---

## File Structure

### Files Modified
| Path | Phase | Change |
|------|-------|--------|
| `knowledge/methodology.md` | 1 + 3 | Phase 1 removes 5 boundary-violating wiki-links; Phase 3 collapses entire file to navigation stub |
| `ops/queue/queue.json` | 1 | Update `maint-001` target count 3→228, priority → `multi-session`, add notes field |
| `knowledge/architecture-decisions.md` | 2 | Remove 3 duplicate Knowledge-Notes entries + replace 23-entry Comprehensive Audit Findings section with 5-line sub-map pointer block |
| `knowledge/dev-infrastructure.md` | 2 | Replace 4 inline sections (Hooks/Skills/Agents/MCP, 28 entries) with 4 pointer lines |
| `knowledge/gaps-and-opportunities.md` | 3 | Delete Developer Infrastructure Gaps section (11 entries) and Skill Ecosystem Gaps entry list (7 entries — pointer already present) |
| `ops/derivation.md` | 4 | Append new Evolution Log entry dated 2026-04-11 |

### Files Created
| Path | Phase | Purpose |
|------|-------|---------|
| `knowledge/resource-leaks-debt.md` | 2 | New sub-map for resource-leak cluster (3 notes cross-listed from other sub-maps) |
| `knowledge/desktop-pivot-debt.md` | 2 | New sub-map for Tauri/desktop-pivot cluster (3 notes, 1 unique) |
| `knowledge/infrastructure-hooks.md` | 2 | Sub-map for 7 Claude Code hooks notes from dev-infrastructure |
| `knowledge/infrastructure-agents.md` | 2 | Sub-map for 6 Claude Code agents notes |
| `knowledge/infrastructure-mcp.md` | 2 | Sub-map for 7 MCP server notes |
| `ops/observations/2026-04-11-session-mining-pipeline-silently-broken.md` | 1 | First observation since vault creation — the diagnostic friction note |
| `ops/health/2026-04-11-full-system-health.md` | 1 | First health report — baseline snapshot for future /architect passes |

### Directories Created
| Path | Phase | Purpose |
|------|-------|---------|
| `ops/health/` | 1 | Health reports directory (currently missing per v1.6 spec) |

### Files NOT Touched
- Any file under `client/`, `server/`, `shared/`, `docs/` (except the evolution log)
- Any note inside `knowledge/*-debt.md` that already exists (security/performance/ai-system) — they receive new cross-links but their content doesn't change
- `knowledge/index.md` — the `[[methodology]]` link remains valid because R5 keeps the stub file

---

## Team Execution Checklist

This plan is **sequential single-agent execution**. Each phase must complete and commit before the next begins.

- [ ] **Phase 1** — R1 + R6 (~20 min): Foundation (boundary violations + feedback loop)
- [ ] **Phase 2** — R2 + R3 (~30 min): Split architecture-decisions + dev-infrastructure
- [ ] **Phase 3** — R4 + R5 (~13 min): De-duplicate gaps-and-opportunities + collapse methodology MOC
- [ ] **Phase 4** — Evolution log + final validation (~5 min)

**Agent Teams prompts:** N/A — sequential single-agent execution. File dependencies (Phase 3's R5 depends on Phase 1's R1 output; Phase 4's validation depends on Phases 1-3 completion) make parallelism unsafe for this plan.

**Research references:** `/home/wtyler/.claude/plugins/cache/agenticnotetaking/arscontexta/0.8.0/reference/` — specifically `failure-modes.md` (#3 Link Rot, #5 MOC Sprawl, #8 Over-Automation), `three-spaces.md` (boundary rules), `evolution-lifecycle.md` (Drift Detection Type 1 Staleness). Full citation index is in the brainstorm input.

---

## Phase 1 — Foundation (R1 + R6)

**Prerequisite:** Working tree clean, on `main` branch.

**Why this phase first:** R1 removes user-visible FAIL items (5 boundary violations). R6 restores the severed feedback loop so future /architect passes have real data. Everything else can wait.

---

### Task 1.1: Verify baseline state before Phase 1 edits

**Files:** None (read-only scan)

- [ ] **Step 1: Capture baseline counts**

```bash
cd /home/wtyler/Projects/ProtoPulse && \
echo "=== baseline MOC sizes ===" && \
for f in architecture-decisions dev-infrastructure gaps-and-opportunities methodology; do
  printf "%-30s %s\n" "$f" "$(grep -c '^\- \[\[' "knowledge/$f.md")"
done && \
echo "=== boundary-violating links in knowledge/methodology.md ===" && \
grep -c -E '\[\[(derivation-rationale|enforce-hard-cap-on-concurrent-agents|use-agent-teams-not-raw-parallel-subagents-for-implementation|run-standard-dev-commands-autonomously|verify-wiki-links-before-completing-knowledge-work)\]\]' knowledge/methodology.md && \
echo "=== unmined sessions ===" && \
find ops/sessions -name '*.json' | wc -l && \
echo "=== ops/health exists? ===" && \
{ [ -d ops/health ] && echo YES || echo NO; } && \
echo "=== observations count ===" && \
find ops/observations -name '*.md' 2>/dev/null | wc -l
```

Expected output (exact match):

```
=== baseline MOC sizes ===
architecture-decisions         54
dev-infrastructure             43
gaps-and-opportunities         48
methodology                    7
=== boundary-violating links in knowledge/methodology.md ===
5
=== unmined sessions ===
228
=== ops/health exists? ===
NO
=== observations count ===
0
```

If any count differs: stop and investigate. The plan assumes this exact starting state.

---

### Task 1.2: R1 — Remove boundary-violating wiki-links from `knowledge/methodology.md`

**Files:**
- Modify: `knowledge/methodology.md:35-41`

**Context:** Lines 35-41 contain a `## Notes` section with 5 wiki-links that point to files in `ops/methodology/` rather than `knowledge/`. Per the three-space architecture, `knowledge/` topic maps must only reference `knowledge/` notes. The replacement text redirects readers to `self/methodology.md` (agent methodology) and `ops/methodology/` (mined operational learnings).

- [ ] **Step 1: Confirm exact lines 35-41 match expected content**

```bash
sed -n '35,41p' knowledge/methodology.md
```

Expected output:

```
## Notes

- [[derivation-rationale]] -- why these specific dimension positions were chosen
- [[enforce-hard-cap-on-concurrent-agents]] -- never exceed 6 agents / 8 background tasks simultaneously
- [[use-agent-teams-not-raw-parallel-subagents-for-implementation]] -- /agent-teams for all parallel implementation, not raw subagents
- [[run-standard-dev-commands-autonomously]] -- run db:push, check, test without asking permission
- [[verify-wiki-links-before-completing-knowledge-work]] -- all [[links]] must resolve to real files before a task is done
```

- [ ] **Step 2: Replace those lines with prose redirecting to the real locations**

Use the Edit tool with this exact replacement:

**old_string:**

```
## Notes

- [[derivation-rationale]] -- why these specific dimension positions were chosen
- [[enforce-hard-cap-on-concurrent-agents]] -- never exceed 6 agents / 8 background tasks simultaneously
- [[use-agent-teams-not-raw-parallel-subagents-for-implementation]] -- /agent-teams for all parallel implementation, not raw subagents
- [[run-standard-dev-commands-autonomously]] -- run db:push, check, test without asking permission
- [[verify-wiki-links-before-completing-knowledge-work]] -- all [[links]] must resolve to real files before a task is done
```

**new_string:**

```
## Where Operational Methodology Lives

Agent behavior rules, processing principles, and mined operational learnings do not live in the `knowledge/` notes space. They live in two canonical locations outside this topic map:

- `self/methodology.md` — agent methodology, personality, and the processing cycle (Extract → Connect → Revisit → Verify)
- `ops/methodology/` — operational learnings mined from session transcripts via `/remember` (hard caps, autonomy rules, wiki-link quality gates)

This section intentionally holds no wiki-links to `ops/methodology/` files because cross-space wiki-links violate the three-space boundary and render as broken in the notes space.
```

- [ ] **Step 3: Verify the 5 boundary-violating links are gone**

```bash
grep -c -E '\[\[(derivation-rationale|enforce-hard-cap-on-concurrent-agents|use-agent-teams-not-raw-parallel-subagents-for-implementation|run-standard-dev-commands-autonomously|verify-wiki-links-before-completing-knowledge-work)\]\]' knowledge/methodology.md
```

Expected output: `0`

- [ ] **Step 4: Verify the replacement paragraph was inserted correctly**

```bash
grep -A 2 'Where Operational Methodology Lives' knowledge/methodology.md
```

Expected output includes: `Agent behavior rules, processing principles...`

---

### Task 1.3: R6a — Update `ops/queue/queue.json` to reflect real unmined count

**Files:**
- Modify: `ops/queue/queue.json:14-23`

**Context:** The `maint-001` task claims 3 unmined sessions; actual is 228 (76× stale). Update target, bump priority, and add a notes field documenting the mining strategy.

- [ ] **Step 1: Read current task state**

```bash
cat ops/queue/queue.json
```

Confirm `maint-001` currently has `"target": "3 session files without mined status in ops/sessions/"` and `"priority": "session"`.

- [ ] **Step 2: Update the task via Edit tool**

**old_string:**

```json
    {
      "id": "maint-001",
      "type": "maintenance",
      "priority": "session",
      "status": "pending",
      "condition_key": "unprocessed_sessions",
      "target": "3 session files without mined status in ops/sessions/",
      "action": "/remember --mine-sessions",
      "auto_generated": true,
      "created": "2026-04-06T03:52:00Z"
    },
```

**new_string:**

```json
    {
      "id": "maint-001",
      "type": "maintenance",
      "priority": "multi-session",
      "status": "pending",
      "condition_key": "unprocessed_sessions",
      "target": "228 session files without mined status in ops/sessions/",
      "action": "/remember --mine-sessions",
      "notes": "Session JSON files are touch-counter stubs only, not transcripts. Real transcripts live at ~/.claude/projects/-home-wtyler-Projects-ProtoPulse/*.jsonl. For batch mining: (1) prove the pipeline on ~20 random sessions first, (2) extract friction patterns to ops/observations/, (3) promote to ops/methodology/ only if the pattern repeats. Do not attempt all 228 in a single session.",
      "auto_generated": true,
      "last_updated": "2026-04-11",
      "created": "2026-04-06T03:52:00Z"
    },
```

- [ ] **Step 3: Verify JSON is still valid**

```bash
python3 -m json.tool ops/queue/queue.json > /dev/null && echo "JSON valid"
```

Expected output: `JSON valid`

- [ ] **Step 4: Verify target count is now 228**

```bash
grep '"target"' ops/queue/queue.json
```

Expected includes: `"target": "228 session files without mined status in ops/sessions/",`

---

### Task 1.4: R6b — Create first observation note (diagnostic friction)

**Files:**
- Create: `ops/observations/2026-04-11-session-mining-pipeline-silently-broken.md`

**Context:** `ops/observations/` is empty. This plan populates it with the diagnostic observation from the /architect pass. Follows `templates/observation.md` schema.

- [ ] **Step 1: Create the observation file**

Use the Write tool to create `/home/wtyler/Projects/ProtoPulse/ops/observations/2026-04-11-session-mining-pipeline-silently-broken.md` with this exact content:

```markdown
---
observed_date: 2026-04-11
category: system-drift
severity: high
resolved: false
resolution: ""
---

# Session mining pipeline stopped running after 2026-04-06 leaving 228 unprocessed sessions

## Context

Detected during /architect full-system analysis on 2026-04-11. The vault health scan revealed 228 session stubs in `ops/sessions/` with `"mined": false`, while `ops/queue/queue.json` still claimed the maintenance task was for "3 session files." No observation notes had been captured since the vault was initialized on 2026-04-05 (observations directory was empty). No tensions recorded. No health reports generated.

## Signal

The condition-based maintenance loop — detect → surface → act — has silently stopped working. Specifically:

1. **Capture works:** the SessionEnd hook writes a JSON stub for every session, correctly.
2. **Mining does not run:** `/remember --mine-sessions` has not fired since 2026-04-06, even though the queue had a pending task for it.
3. **Observations space is empty:** the mechanism that converts mined transcripts into `ops/observations/*.md` never runs.
4. **Queue staleness:** the maint-001 counter was 76× stale (3 vs 228).
5. **No health history:** `ops/health/` directory does not exist, so the previous /architect pass left no baseline to compare against.

All five symptoms point to the same root cause: the recursive improvement loop is severed. The system is producing telemetry (session capture) that nothing downstream reads.

This is the Over-Automation failure mode from `reference/failure-modes.md` #8: "Automation should fail loudly, not fix silently." It is also Drift Detection Type 1 Staleness from `reference/evolution-lifecycle.md`: "The system evolved but the specification did not keep pace."

## Potential Response

Immediate (this /architect pass):
- Update queue.json to reflect real unmined count
- Populate ops/observations/ with this note (first observation — mere existence restores the detection half of the loop)
- Create ops/health/ with a baseline snapshot so future /architect passes have priors to compare against

Deferred (next work item, separate session):
- Run `/remember --mine-sessions` on a sample of ~20 sessions to prove the mining pipeline still works end-to-end
- If mining works: scale to the full 228
- If mining is broken: diagnose the break (hook? skill? transcript format?)

Promotion target: if this pattern repeats after /remember is re-wired — i.e., observations accumulate but do not surface during /next or /architect — promote to `knowledge/dev-infrastructure.md` as a methodology note about "feedback loop monitoring."

---

Topics:
- [[methodology]]
```

- [ ] **Step 2: Verify the file exists and has the correct frontmatter**

```bash
head -10 ops/observations/2026-04-11-session-mining-pipeline-silently-broken.md
```

Expected output starts with `---` and contains `observed_date: 2026-04-11`.

- [ ] **Step 3: Verify observations count is now 1**

```bash
find ops/observations -name '*.md' | wc -l
```

Expected output: `1`

---

### Task 1.5: R6c — Create `ops/health/` directory and baseline snapshot

**Files:**
- Create: `ops/health/` (directory)
- Create: `ops/health/2026-04-11-full-system-health.md`

**Context:** `ops/health/` does not exist per the v1.6 spec. Create it and drop a baseline snapshot covering all Phase 3 metrics from the brainstorm. Future /architect passes will read priors from this directory.

- [ ] **Step 1: Create the directory**

```bash
mkdir -p ops/health && ls -la ops/health
```

Expected: the directory exists and is empty.

- [ ] **Step 2: Write the baseline snapshot file**

Use the Write tool to create `/home/wtyler/Projects/ProtoPulse/ops/health/2026-04-11-full-system-health.md` with this exact content:

```markdown
---
health_date: 2026-04-11
generated_by: /architect
supersedes: none
---

# Full System Health Snapshot — 2026-04-11

Baseline snapshot captured during the /architect pass on 2026-04-11 (pre-remediation). This is the first entry in `ops/health/` — future /architect passes should compare their findings against this file.

## Schema Compliance

| Check | Result | Status |
|---|---|---|
| Missing `description:` | 0 / 146 | PASS |
| Missing `type:` | 0 / 146 | PASS |
| Missing `topics:` | 4 / 146 | PASS (all 4 are MOCs; MOC template only requires `description`) |
| Orphan notes | 0 | PASS |
| Stale notes (30d + <2 links) | 0 / 146 | PASS |
| Dangling wiki-links (per ops/queries/dangling-links.sh) | 13 (all bash-snippet and prose-example false positives) | PASS (no real dangling links) |
| Three-space boundary violations | 1 cluster: knowledge/methodology.md → ops/methodology/*.md (5 links) | WARN — addressed by R1 in this /architect pass |

## MOC Sizing (threshold 40 per queue.json.moc_oversize)

| MOC | Entries | Status |
|---|---|---|
| architecture-decisions | 54 | OVER (target of /architect R2) |
| gaps-and-opportunities | 48 | OVER (target of /architect R4) |
| dev-infrastructure | 43 | OVER (target of /architect R3) |
| claude-code-skills | 40 | AT THRESHOLD (no action — defer until 45+) |
| competitive-landscape | 21 | OK |
| maker-ux | 20 | OK |
| eda-fundamentals | 16 | OK |
| index | 13 | OK |
| ai-system-debt | 13 | OK |
| breadboard-intelligence | 12 | OK |
| performance-debt | 10 | OK |
| goals | 10 | OK |
| security-debt | 8 | OK |
| methodology | 7 | UNDER 10 (target of /architect R5 — collapse to stub) |
| identity | 5 | UNDER 10 (intentional stub — keep) |

## Operational State

| Signal | Observed | Expected per spec |
|---|---|---|
| Unmined sessions | 228 | queue says 3 (76× stale — target of R6a) |
| Observations pending | 0 | empty directory — target of R6b |
| Tensions open | 0 | empty directory |
| Inbox depth | 0 | empty directory |
| Queue tasks | 1 pending + 1 done | accurate except for maint-001 target count |
| ops/health/ directory | did not exist | should exist per v1.6 — target of R6c |

## Dimension Coherence (derivation.md vs config.yaml)

Zero drift. All 8 configuration dimensions still match the 2026-04-05 derivation:

- Granularity: atomic
- Organization: flat
- Linking: explicit+implicit
- Processing: heavy
- Navigation: 3-tier
- Maintenance: condition-based
- Schema: dense
- Automation: full

## Failure Modes Active

1. **MOC Sprawl (#5)** — 4 MOCs at or over the 40-entry threshold (architecture-decisions, gaps-and-opportunities, dev-infrastructure, claude-code-skills)
2. **Over-Automation (#8)** — session capture hooks run but mining pipeline does not follow up; 228 unprocessed stubs accumulating silently
3. **Productivity Porn (#9) — MITIGATED** — the 25% meta-work budget rule constrained this /architect pass to symptom + root cause only; no pre-emptive restructuring

## Link Density

- Total notes: 146
- Total topic maps: 15
- Approximate link density: ~4 incoming links per note (qualitative — no exact count without running graph analysis)

## Previous Architect Passes

- 2026-04-06: first full /architect pass after comprehensive audit ingestion. Split gaps-and-opportunities 62→47, archived source note, deferred architecture-decisions split at 50.

## Remediation Applied During This /architect Pass

See `ops/derivation.md` Evolution Log entry dated 2026-04-11 for the full change record (written in Phase 4 of this plan). The 6 recommendations from the /architect pass are tracked in `docs/plans/2026-04-11-knowledge-vault-health-restoration.md`.

---

**Next health snapshot:** suggested on next /architect pass, or after the 228-session mining batch runs (whichever comes first).
```

- [ ] **Step 3: Verify health report exists**

```bash
[ -f ops/health/2026-04-11-full-system-health.md ] && echo "health report created" && wc -l ops/health/2026-04-11-full-system-health.md
```

Expected: `health report created` followed by a line count (≥80 lines).

---

### Task 1.6: Validate Phase 1 and commit

**Files:** None (validation + commit)

- [ ] **Step 1: Re-run the baseline scan from Task 1.1**

```bash
cd /home/wtyler/Projects/ProtoPulse && \
echo "=== baseline MOC sizes ===" && \
for f in architecture-decisions dev-infrastructure gaps-and-opportunities methodology; do
  printf "%-30s %s\n" "$f" "$(grep -c '^\- \[\[' "knowledge/$f.md")"
done && \
echo "=== boundary-violating links in knowledge/methodology.md ===" && \
grep -c -E '\[\[(derivation-rationale|enforce-hard-cap-on-concurrent-agents|use-agent-teams-not-raw-parallel-subagents-for-implementation|run-standard-dev-commands-autonomously|verify-wiki-links-before-completing-knowledge-work)\]\]' knowledge/methodology.md && \
echo "=== unmined sessions ===" && \
find ops/sessions -name '*.json' | wc -l && \
echo "=== ops/health exists? ===" && \
{ [ -d ops/health ] && echo YES || echo NO; } && \
echo "=== observations count ===" && \
find ops/observations -name '*.md' 2>/dev/null | wc -l
```

Expected deltas from baseline:
- MOC sizes: **unchanged** (architecture-decisions 54, dev-infrastructure 43, gaps-and-opportunities 48, methodology 7 — `## Notes` was deleted but `^\- \[\[` count stays at 7 because no wiki-link `- [[` lines existed there; methodology count is from the Topics footer and other sections)
- Boundary-violating links: 5 → **0**
- Unmined sessions: **228** (unchanged — actual mining not in scope)
- ops/health exists: NO → **YES**
- Observations count: 0 → **1**

Note: the brainstorm's Phase 1 exit criteria claimed "methodology entries" might change. After R1, lines 35-41 of `knowledge/methodology.md` are replaced with prose that contains zero `- [[` entries. The original 5 `- [[...]]` entries came from the `## Notes` section that is now removed. Since the `^\- \[\[` grep only matches lines starting with `- [[`, and there are no such lines remaining except possibly in the Topics footer, the count after R1 should be **lower** than 7. Document whatever the actual new count is; it becomes the baseline for R5.

- [ ] **Step 2: Check JSON validity**

```bash
python3 -m json.tool ops/queue/queue.json > /dev/null && echo "queue.json valid"
```

Expected: `queue.json valid`

- [ ] **Step 3: Verify git status shows expected files**

```bash
git status --short
```

Expected output (exact set of files — ignore autonomous ProtoPulse file changes in unrelated areas):

```
 M knowledge/methodology.md
 M ops/queue/queue.json
?? ops/health/
?? ops/observations/2026-04-11-session-mining-pipeline-silently-broken.md
```

- [ ] **Step 4: Stage and commit**

```bash
git add knowledge/methodology.md ops/queue/queue.json ops/health/ ops/observations/2026-04-11-session-mining-pipeline-silently-broken.md && \
git commit -m "$(cat <<'EOF'
vault: /architect phase 1 — fix boundary violations, restore feedback loop

- Remove 5 cross-space wiki-links from knowledge/methodology.md
  (targets live in ops/methodology/, not knowledge/)
- Replace with ## Where Operational Methodology Lives prose pointer
- Update ops/queue/queue.json maint-001: 3 → 228 sessions,
  priority session → multi-session, added mining strategy notes
- Create first ops/observations/ note: session-mining-pipeline-silently-broken
- Create ops/health/ directory + 2026-04-11 baseline snapshot

Root cause fix: restores detection half of condition-based maintenance loop.
Symptom fix: knowledge/methodology.md no longer violates three-space boundary.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Confirm commit**

```bash
git log --oneline -1
```

Expected: the commit message from Step 4, prefixed with a hash.

**Phase 1 exit criteria:**
- [ ] Zero boundary-violating wiki-links in `knowledge/methodology.md`
- [ ] `ops/observations/` contains the diagnostic friction note
- [ ] `ops/health/` directory exists with the 2026-04-11 baseline snapshot
- [ ] `ops/queue/queue.json` maint-001 target = 228, priority = multi-session, JSON valid
- [ ] Commit made, working tree clean (excluding unrelated auto-commit hook activity)

---

## Phase 2 — Split the Two Hottest MOCs (R2 + R3)

**Prerequisite:** Phase 1 complete and committed.

**Why this order:** `architecture-decisions` (54) is the largest and has structural pressure from the deferred split at 50 on the previous pass. `dev-infrastructure` (43) has the cleanest split seams (layer-based sections map directly to sub-maps).

---

### Task 2.1: R2 — Create `knowledge/resource-leaks-debt.md`

**Files:**
- Create: `knowledge/resource-leaks-debt.md`

**Context:** New sub-map for the resource-leak cluster identified in the Codex audit. The three notes are cross-listed (they also appear in security-debt and ai-system-debt) — the resource-leak framing adds navigational value for engineers debugging OOM/crash patterns. Follows the pattern of existing `knowledge/ai-system-debt.md`, `knowledge/security-debt.md`, and `knowledge/performance-debt.md`.

- [ ] **Step 1: Verify the 3 target notes exist in the vault**

```bash
for n in setinterval-never-cleared-creates-memory-ratchet-in-server-routes genkit-abort-signal-creates-zombie-streams-that-leak-api-quota scrypt-64mb-per-request-enables-oom-dos-before-rate-limiter; do
  [ -f "knowledge/$n.md" ] && echo "EXISTS: $n" || echo "MISSING: $n"
done
```

Expected: all 3 show `EXISTS: ...`

- [ ] **Step 2: Write the new sub-map**

Use the Write tool to create `/home/wtyler/Projects/ProtoPulse/knowledge/resource-leaks-debt.md` with this exact content:

```markdown
---
description: Resource-leak bugs found in the comprehensive audit — zombie streams, setInterval memory ratchet, scrypt memory bursts before rate-limiting
type: moc
topics:
  - "[[gaps-and-opportunities]]"
  - "[[architecture-decisions]]"
---

# resource-leaks-debt

Resource-leak patterns identified in the April 2026 comprehensive audit. These bugs share a signature: memory or process state accumulates faster than it releases. Left unpatched they produce gradual OOMs, hanging connections, or burst-OOM-before-ratelimit denial-of-service vectors.

## The Pattern: Accumulation Without Cleanup

```
Request / event
  → allocates scrypt buffer, sets interval, opens Gemini stream
  → handler returns / user closes tab / abort signal fires
  → cleanup path missing or incomplete
  → memory/stream/timer persists
  → N parallel requests compound linearly → OOM or API quota exhaustion
```

## Notes

- [[setinterval-never-cleared-creates-memory-ratchet-in-server-routes]] -- dangling intervals leak memory until OOM crash (cross-listed in security-debt)
- [[genkit-abort-signal-creates-zombie-streams-that-leak-api-quota]] -- unhandled abort = zombie Gemini requests (cross-listed in ai-system-debt)
- [[scrypt-64mb-per-request-enables-oom-dos-before-rate-limiter]] -- 10 concurrent logins = 640MB RSS spike before rate-limiter engages (cross-listed in security-debt)

## Related Debt

- [[security-debt]] -- scrypt burst is the DoS entry, setInterval leak feeds memory exhaustion
- [[ai-system-debt]] -- zombie Gemini streams are a resource-leak side-effect of the broader AI stream-management gap

---

Topics:
- [[gaps-and-opportunities]]
- [[architecture-decisions]]
```

- [ ] **Step 3: Verify the file is well-formed**

```bash
head -10 knowledge/resource-leaks-debt.md && echo "---" && grep -c '^\- \[\[' knowledge/resource-leaks-debt.md
```

Expected: frontmatter present + entry count ≥ 3

---

### Task 2.2: R2 — Create `knowledge/desktop-pivot-debt.md`

**Files:**
- Create: `knowledge/desktop-pivot-debt.md`

**Context:** New sub-map for the Tauri / native-desktop-pivot cluster. Groups 3 notes: the CSP/Tauri RCE chain (cross-listed in security-debt), the sidecar-requires-Node crash vector (unique to this sub-map), and the native-pivot-unblocked-programs note (currently in architecture-decisions, moved to this sub-map's `## Related` section).

- [ ] **Step 1: Verify target notes exist**

```bash
for n in tauri-csp-disabled-plus-global-tauri-equals-xss-to-rce tauri-node-sidecar-is-not-self-contained-and-crashes-without-global-node native-desktop-pivot-unblocked-three-c5-programs; do
  [ -f "knowledge/$n.md" ] && echo "EXISTS: $n" || echo "MISSING: $n"
done
```

Expected: all 3 show `EXISTS: ...`

- [ ] **Step 2: Write the new sub-map**

Use the Write tool to create `/home/wtyler/Projects/ProtoPulse/knowledge/desktop-pivot-debt.md` with this exact content:

```markdown
---
description: Desktop-pivot risks — Tauri CSP disabled, node sidecar not self-contained, and the security/distribution debts the native pivot introduced
type: moc
topics:
  - "[[gaps-and-opportunities]]"
  - "[[architecture-decisions]]"
---

# desktop-pivot-debt

Risks introduced when ProtoPulse pivoted from browser-based to native desktop via Tauri. The pivot unblocked hardware access and native toolchains but traded away the browser's sandboxing model and created new distribution constraints.

## The Pattern: Traded Sandboxing for Hardware Access

```
Browser mode
  → strict sandbox, no filesystem / serial / native exec
  → limited functionality, but limited blast radius
Tauri desktop mode
  → full filesystem, serial, native spawn_process
  → sandbox trade-off: XSS → session → window.__TAURI__ → RCE
  → distribution trade-off: sidecar requires Node.js installed on user machine
```

## Notes

- [[tauri-csp-disabled-plus-global-tauri-equals-xss-to-rce]] -- disabled CSP + `withGlobalTauri` turns any XSS into OS-level RCE (cross-listed in security-debt)
- [[tauri-node-sidecar-is-not-self-contained-and-crashes-without-global-node]] -- the desktop app depends on a system Node.js install and crashes without one
- [[native-desktop-pivot-unblocked-three-c5-programs]] -- the positive side of the pivot: three C5 programs became feasible only in native mode

## Related Debt

- [[security-debt]] -- the Tauri attack chain is documented in full there
- [[architecture-decisions]] -- the decision to pivot is recorded alongside the core-stack decisions

---

Topics:
- [[gaps-and-opportunities]]
- [[architecture-decisions]]
```

- [ ] **Step 3: Verify the file**

```bash
head -10 knowledge/desktop-pivot-debt.md && echo "---" && grep -c '^\- \[\[' knowledge/desktop-pivot-debt.md
```

Expected: frontmatter present + entry count ≥ 3

---

### Task 2.3: R2 — Reduce `knowledge/architecture-decisions.md`

**Files:**
- Modify: `knowledge/architecture-decisions.md` (lines 15-67 region)

**Context:** The current file has 54 wiki-link entries split across a Knowledge Notes section (22), Comprehensive Audit Synthesis (4), Comprehensive Audit Findings (23), Tensions (2), and scattered narrative prose (3 more via section-level wiki-links). This task:

1. **Removes 3 duplicate entries** from Knowledge Notes that already live in existing debt sub-maps:
   - `[[ai-prompt-scaling-is-linear-and-will-hit-token-limits]]` (lives in performance-debt `## Related` section)
   - `[[monolithic-context-causes-quadratic-render-complexity]]` (lives in performance-debt `## Related` section)
   - `[[cors-origin-reflection-was-a-critical-csrf-vector]]` (lives in security-debt `## Previously Fixed` section)
2. **Replaces the entire Comprehensive Audit Findings section (23 entries)** with a 5-line pointer block linking to the 5 debt sub-maps (3 existing + 2 new from Tasks 2.1, 2.2).
3. **Renames** the Comprehensive Audit Synthesis section to Comprehensive Audit Sub-Maps (keeps its 4 entries).

Expected post-edit count: 54 − 3 (duplicates) − 23 (Findings section) + 2 (new sub-map pointers) = **30 entries**. Well under the 40 threshold.

- [ ] **Step 1: Remove the 3 duplicate Knowledge Notes entries**

Use the Edit tool three times — one per line. Use `replace_all: false` (default) to target each exact line:

**Edit 1 — old_string:**

```
- [[ai-prompt-scaling-is-linear-and-will-hit-token-limits]] -- O(N) system prompt cost
```

**new_string:** (empty string)

Wait — the Edit tool rejects empty strings for `new_string`. Instead, delete the entire line including its newline by using the surrounding context:

**Edit 1 — old_string:**

```
- [[dual-export-system-is-a-maintenance-trap]] -- parallel implementations require double fixes
- [[ai-prompt-scaling-is-linear-and-will-hit-token-limits]] -- O(N) system prompt cost
- [[monolithic-context-causes-quadratic-render-complexity]] -- ProjectProvider re-render cascade
```

**Edit 1 — new_string:**

```
- [[dual-export-system-is-a-maintenance-trap]] -- parallel implementations require double fixes
```

This removes both `ai-prompt-scaling` and `monolithic-context` in a single edit (they are adjacent lines 20-21).

**Edit 2 — old_string:**

```
- [[cocomo-estimates-protopulse-at-1-9m-and-17-months]] -- codebase scale quantified
- [[cors-origin-reflection-was-a-critical-csrf-vector]] -- highest-severity security finding
- [[express-5-chosen-because-spa-tools-dont-need-ssr]] -- no SSR needed for tool apps
```

**Edit 2 — new_string:**

```
- [[cocomo-estimates-protopulse-at-1-9m-and-17-months]] -- codebase scale quantified
- [[express-5-chosen-because-spa-tools-dont-need-ssr]] -- no SSR needed for tool apps
```

This removes the `cors-origin-reflection` line cleanly.

- [ ] **Step 2: Rename the Comprehensive Audit Synthesis section and extend its entry list**

**old_string:**

```
## Comprehensive Audit Synthesis
- [[comprehensive-audit-reveals-zero-validation-at-any-layer]] -- the audit's meta-finding across all 40 sections
- [[security-debt]] -- attack chain cluster (5 notes)
- [[performance-debt]] -- main-thread blocking cluster (6 notes)
- [[ai-system-debt]] -- validation vacuum cluster (9 notes)
```

**new_string:**

```
## Comprehensive Audit Sub-Maps (April 2026)
- [[comprehensive-audit-reveals-zero-validation-at-any-layer]] -- the audit's meta-finding across all 40 sections
- [[ai-system-debt]] -- validation vacuum cluster (9 notes)
- [[security-debt]] -- attack chain cluster (5 notes)
- [[performance-debt]] -- main-thread blocking cluster (6 notes)
- [[resource-leaks-debt]] -- zombie streams, memory ratchet, scrypt burst (3 notes)
- [[desktop-pivot-debt]] -- Tauri CSP/RCE chain + sidecar dependency (3 notes)
```

- [ ] **Step 3: Remove the entire Comprehensive Audit Findings section (23 entries)**

**old_string:**

```
### Comprehensive Audit Findings (2026-04-05)
- [[genkit-abort-signal-creates-zombie-streams-that-leak-api-quota]] -- unhandled abort = zombie Gemini requests
- [[genkit-tools-use-z-any-output-destroying-structured-validation]] -- z.any() defeats structured output
- [[genkit-125-flat-tools-is-an-outdated-anti-pattern-needs-multi-agent]] -- 125 flat tools cause context collapse
- [[no-genkit-evaluation-framework-means-ai-quality-is-vibes-only]] -- zero AI eval test coverage
- [[production-mock-data-in-pricing-tool-causes-hallucinated-prices]] -- Math.random() prices in production
- [[build-system-prompt-has-on-m-edge-resolution-bottleneck]] -- O(N*M) array scans per AI request
- [[ai-toolset-has-major-blindspots-in-history-variables-lifecycle-and-zones]] -- 6 API domains invisible to AI
- [[risk-analysis-tool-references-nonexistent-schema-columns]] -- broken risk scores from missing columns
- [[reactflow-json-stringify-sync-is-on-per-render-and-breaks-at-10k-nodes]] -- O(N) stringify per render cycle
- [[simulation-engine-blocks-main-thread-with-no-webworker-or-wasm]] -- MNA/NR/Gauss all sync main thread
- [[jsonb-columns-lack-gin-indexes-forcing-sequential-scans]] -- no GIN indexes on JSONB columns
- [[tauri-csp-disabled-plus-global-tauri-equals-xss-to-rce]] -- XSS → RCE via disabled CSP + global API
- [[eval-in-circuit-code-view-plus-localstorage-session-enables-xss-hijack]] -- eval + localStorage = full hijack
- [[tauri-node-sidecar-is-not-self-contained-and-crashes-without-global-node]] -- desktop app needs Node.js installed
- [[scrypt-64mb-per-request-enables-oom-dos-before-rate-limiter]] -- 10 requests = 640MB OOM
- [[websocket-sessions-are-never-revalidated-after-initial-handshake]] -- revoked users keep access
- [[setinterval-never-cleared-creates-memory-ratchet-in-server-routes]] -- dangling intervals leak memory
- [[execsync-in-arduino-service-blocks-entire-express-event-loop]] -- sync shell calls freeze API
- [[custom-lww-sync-should-be-replaced-with-yjs-crdts]] -- LWW causes destructive merges
- [[voice-ai-is-disconnected-from-llm-using-hardcoded-command-matching]] -- voice is fake AI
- [[focus-outline-none-strips-keyboard-indicators-wcag-violation]] -- WCAG AA keyboard focus broken
- [[vite-manual-chunks-defeats-dynamic-import-and-tree-shaking]] -- bloated initial JS payload
- [[asynchandler-wrapper-is-redundant-in-express-v5]] -- legacy wrapper, Express v5 handles async natively

## Core Stack Decisions
```

**new_string:**

```
## Core Stack Decisions
```

The entire 23-entry block including its `### Comprehensive Audit Findings (2026-04-05)` heading is deleted. The 23 notes are not deleted from the vault — they already live in the sub-maps (ai-system-debt, security-debt, performance-debt, plus the 2 new ones resource-leaks-debt and desktop-pivot-debt). Any note that doesn't fit into a sub-map (e.g., `focus-outline-none-strips-keyboard-indicators-wcag-violation`, `asynchandler-wrapper-is-redundant-in-express-v5`, `custom-lww-sync-should-be-replaced-with-yjs-crdts`) remains in the vault as an individual note — just unlisted from any MOC. This is acceptable because orphan detection only flags notes with zero incoming links, and these notes are linked from knowledge-note Topics footers and other notes.

- [ ] **Step 4: Count remaining entries**

```bash
grep -c '^\- \[\[' knowledge/architecture-decisions.md
```

Expected output: `28` (54 − 3 duplicates − 23 findings + 0 section heading changes = 28). Anything ≤ 39 is acceptable. If the count is still ≥ 40, re-read and find what was missed.

---

### Task 2.4: Validate architecture-decisions reduction

**Files:** None (validation)

- [ ] **Step 1: Confirm MOC is under threshold and new sub-maps exist**

```bash
echo "=== post-R2 MOC size ===" && grep -c '^\- \[\[' knowledge/architecture-decisions.md && \
echo "=== new sub-maps exist ===" && \
[ -f knowledge/resource-leaks-debt.md ] && echo "resource-leaks-debt: YES" || echo "resource-leaks-debt: NO" && \
[ -f knowledge/desktop-pivot-debt.md ] && echo "desktop-pivot-debt: YES" || echo "desktop-pivot-debt: NO" && \
echo "=== sub-map pointer visible ===" && \
grep -c '\[\[resource-leaks-debt\]\]\|\[\[desktop-pivot-debt\]\]' knowledge/architecture-decisions.md
```

Expected:
- MOC size: ≤ 39 (target ~28)
- resource-leaks-debt: YES
- desktop-pivot-debt: YES
- Pointer count: 2

---

### Task 2.5: R3 — Create `knowledge/infrastructure-hooks.md`

**Files:**
- Create: `knowledge/infrastructure-hooks.md`

**Context:** Move the 7 entries from the `## Hooks` section of `dev-infrastructure.md` into a dedicated sub-map.

- [ ] **Step 1: Write the file**

Use the Write tool to create `/home/wtyler/Projects/ProtoPulse/knowledge/infrastructure-hooks.md` with this exact content:

```markdown
---
description: Claude Code hooks in ProtoPulse — the 26-hook pipeline across 6 events, its quality gate role, and known latency / ordering issues
type: moc
topics:
  - "[[dev-infrastructure]]"
---

# infrastructure-hooks

ProtoPulse runs 26 Claude Code hooks across 6 events (15 claudekit + 11 custom). Hooks enforce quality gates automatically — type-check, lint, commit vault, orient session start. Because they fire on every file edit and every session boundary, hook ordering and latency have outsize impact on session responsiveness.

## Notes

- [[twenty-six-hooks-create-a-dense-quality-pipeline]] -- the full pipeline and its implications
- [[nine-posttooluse-groups-fire-on-every-write]] -- latency cost of the PostToolUse pipeline
- [[session-orient-and-validate-note-have-syntax-bugs]] -- concatenated lines break bash parsing
- [[blocking-typecheck-takes-33-to-44-seconds-on-protopulse]] -- known timeout issue, fixed via claudekit config
- [[auto-commit-vault-is-the-only-async-hook]] -- 25 blocking vs 1 async creates bottleneck risk
- [[two-hook-groups-have-no-explicit-matcher]] -- SessionStart and Stop groups fall through to default
- [[claudekit-and-custom-hooks-share-the-posttooluse-pipeline]] -- ordering matters, no coordination

---

Topics:
- [[dev-infrastructure]]
```

- [ ] **Step 2: Verify**

```bash
grep -c '^\- \[\[' knowledge/infrastructure-hooks.md
```

Expected: `7`

---

### Task 2.6: R3 — Create `knowledge/infrastructure-agents.md`

**Files:**
- Create: `knowledge/infrastructure-agents.md`

- [ ] **Step 1: Write the file**

Use the Write tool to create `/home/wtyler/Projects/ProtoPulse/knowledge/infrastructure-agents.md` with this exact content:

```markdown
---
description: Claude Code agents in ProtoPulse — 37 agent definitions across 17 directories, trigger patterns, memory configuration, and stack-alignment gaps
type: moc
topics:
  - "[[dev-infrastructure]]"
---

# infrastructure-agents

ProtoPulse has 37 Claude Code agent definitions — specialists summoned by the Agent tool. They are the domain-expert layer of the infrastructure, sitting between hooks (automatic) and skills (workflow recipes). Three agents have persistent project memory (oracle, eda-domain-reviewer, code-review-expert); the rest are stateless.

## Notes

- [[thirty-seven-agents-have-no-trigger-patterns]] -- agents cannot self-activate, must be manually invoked
- [[six-agents-cover-technologies-not-in-protopulse-stack]] -- kafka, loopback, nestjs, mongodb, jest, nextjs
- [[agent-definitions-total-twenty-thousand-lines]] -- context cost if loaded, but rarely referenced
- [[three-agents-have-persistent-project-memory]] -- oracle, eda-domain-reviewer, code-review-expert
- [[oracle-agent-escalation-is-the-strongest-debugging-path]] -- memory + effort:high + GPT-5 fallback
- [[agent-teams-skill-is-the-mandated-parallel-execution-mechanism]] -- the only sanctioned parallel approach

---

Topics:
- [[dev-infrastructure]]
```

- [ ] **Step 2: Verify**

```bash
grep -c '^\- \[\[' knowledge/infrastructure-agents.md
```

Expected: `6`

---

### Task 2.7: R3 — Create `knowledge/infrastructure-mcp.md`

**Files:**
- Create: `knowledge/infrastructure-mcp.md`

- [ ] **Step 1: Write the file**

Use the Write tool to create `/home/wtyler/Projects/ProtoPulse/knowledge/infrastructure-mcp.md` with this exact content:

```markdown
---
description: MCP servers in ProtoPulse — 4 project servers + Arduino CLI globally, each extending a distinct capability dimension (secrets, data, browser, search, hardware)
type: moc
topics:
  - "[[dev-infrastructure]]"
---

# infrastructure-mcp

MCP (Model Context Protocol) servers extend Claude Code with capabilities beyond the built-in tools. ProtoPulse wires 4 project servers and inherits Arduino CLI globally. The full capability pentagon covers secrets access, database querying, browser automation, semantic search, and hardware programming.

## Notes

- [[four-mcp-servers-extend-four-distinct-capability-dimensions]] -- secrets, data, browser, search
- [[five-mcp-capability-dimensions-map-to-five-development-needs]] -- the full capability pentagon including hardware
- [[desktop-commander-is-required-for-reading-env-and-secrets]] -- Claude Code blocks .env access
- [[postgres-mcp-has-inline-credentials-in-mcp-json]] -- connection string contains password
- [[playwright-mcp-provides-browser-automation-but-chrome-devtools-mcp-provides-dom-inspection]] -- two browser tools, different purposes
- [[qmd-mcp-enables-semantic-search-across-the-knowledge-vault]] -- semantic search over markdown
- [[arduino-cli-mcp-bridges-software-development-and-hardware-programming]] -- 16 tools for firmware lifecycle

---

Topics:
- [[dev-infrastructure]]
```

- [ ] **Step 2: Verify**

```bash
grep -c '^\- \[\[' knowledge/infrastructure-mcp.md
```

Expected: `7`

---

### Task 2.8: R3 — Reduce `knowledge/dev-infrastructure.md`

**Files:**
- Modify: `knowledge/dev-infrastructure.md` (Hooks, Skills, Agents, MCP Servers sections)

**Context:** Replace 4 inline sections (28 total entries) with 4 one-line pointer references. Keep Plugins, Meta-Layer, Known Issues, Config, Audit, and the Topics footer untouched.

- [ ] **Step 1: Replace the Hooks section**

**old_string:**

```
## Hooks

Hooks fire automatically on Claude Code lifecycle events. ProtoPulse uses 26 hooks across 6 events (15 claudekit, 11 custom).

- [[twenty-six-hooks-create-a-dense-quality-pipeline]] -- the full pipeline and its implications
- [[nine-posttooluse-groups-fire-on-every-write]] -- latency cost of the PostToolUse pipeline
- [[session-orient-and-validate-note-have-syntax-bugs]] -- concatenated lines break bash parsing
- [[blocking-typecheck-takes-33-to-44-seconds-on-protopulse]] -- known timeout issue, fixed via claudekit config
- [[auto-commit-vault-is-the-only-async-hook]] -- 25 blocking vs 1 async creates bottleneck risk
- [[two-hook-groups-have-no-explicit-matcher]] -- SessionStart and Stop groups fall through to default
- [[claudekit-and-custom-hooks-share-the-posttooluse-pipeline]] -- ordering matters, no coordination
```

**new_string:**

```
## Hooks

26 Claude Code hooks across 6 events (15 claudekit + 11 custom). See [[infrastructure-hooks]] for the full pipeline, latency analysis, and known ordering issues.
```

- [ ] **Step 2: Replace the Skills section**

**old_string:**

```
## Skills

23 project skills + 142 global skills + ~50 plugin skills = 215+ total. See [[claude-code-skills]] for the dedicated topic map.

- [[vault-skills-outnumber-project-skills-seven-to-one]] -- 20 vault vs 3 project
- [[extract-is-the-largest-skill-at-1128-lines]] -- processing pipeline entry point
- [[ship-and-verify-overlap-on-commit-validation-territory]] -- potential confusion on which to use
- [[superpowers-plugin-provides-the-core-development-lifecycle]] -- brainstorm through ship
- [[knowledge-pipeline-has-ten-skills-covering-the-full-lifecycle]] -- extract through verify
- [[nineteen-mastery-skills-are-the-deepest-knowledge-layer]] -- encyclopedic domain expertise
- [[twelve-deprecated-skills-still-exist-alongside-their-replacements]] -- zombie skill inflation
- [[slash-commands-are-the-primary-user-interface-to-the-skill-system]] -- 58 command entry points
```

**new_string:**

```
## Skills

23 project skills + 142 global skills + ~50 plugin skills = 215+ total. See [[claude-code-skills]] for the dedicated topic map covering the full ecosystem.
```

- [ ] **Step 3: Replace the Agents section**

**old_string:**

```
## Agents

37 agent definitions across 17 directories, none with explicit trigger patterns. 3 have persistent memory.

- [[thirty-seven-agents-have-no-trigger-patterns]] -- agents cannot self-activate, must be manually invoked
- [[six-agents-cover-technologies-not-in-protopulse-stack]] -- kafka, loopback, nestjs, mongodb, jest, nextjs
- [[agent-definitions-total-twenty-thousand-lines]] -- context cost if loaded, but rarely referenced
- [[three-agents-have-persistent-project-memory]] -- oracle, eda-domain-reviewer, code-review-expert
- [[oracle-agent-escalation-is-the-strongest-debugging-path]] -- memory + effort:high + GPT-5 fallback
- [[agent-teams-skill-is-the-mandated-parallel-execution-mechanism]] -- the only sanctioned parallel approach
```

**new_string:**

```
## Agents

37 agent definitions across 17 directories — 3 with persistent project memory, none with self-triggering patterns. See [[infrastructure-agents]] for the full catalog and memory configuration.
```

- [ ] **Step 4: Replace the MCP Servers section**

**old_string:**

```
## MCP Servers

4 project MCP servers + Arduino CLI MCP globally. Each extends a distinct capability dimension.

- [[four-mcp-servers-extend-four-distinct-capability-dimensions]] -- secrets, data, browser, search
- [[five-mcp-capability-dimensions-map-to-five-development-needs]] -- the full capability pentagon including hardware
- [[desktop-commander-is-required-for-reading-env-and-secrets]] -- Claude Code blocks .env access
- [[postgres-mcp-has-inline-credentials-in-mcp-json]] -- connection string contains password
- [[playwright-mcp-provides-browser-automation-but-chrome-devtools-mcp-provides-dom-inspection]] -- two browser tools, different purposes
- [[qmd-mcp-enables-semantic-search-across-the-knowledge-vault]] -- semantic search over markdown
- [[arduino-cli-mcp-bridges-software-development-and-hardware-programming]] -- 16 tools for firmware lifecycle
```

**new_string:**

```
## MCP Servers

4 project MCP servers + Arduino CLI globally. See [[infrastructure-mcp]] for the full capability pentagon (secrets, data, browser, search, hardware).
```

- [ ] **Step 5: Count remaining entries**

```bash
grep -c '^\- \[\[' knowledge/dev-infrastructure.md
```

Expected: ≤ 20 (was 43). Target is around 16-18 (4 pointer lines + Plugins 4 + Meta-Layer 5 + Known Issues 3 = 16, plus any other stray wiki-link lines).

---

### Task 2.9: Validate Phase 2 and commit

**Files:** None (validation + commit)

- [ ] **Step 1: Run MOC size scan**

```bash
echo "=== post-Phase-2 MOC sizes ===" && \
for f in architecture-decisions dev-infrastructure gaps-and-opportunities methodology resource-leaks-debt desktop-pivot-debt infrastructure-hooks infrastructure-agents infrastructure-mcp; do
  printf "%-30s %s\n" "$f" "$(grep -c '^\- \[\[' "knowledge/$f.md" 2>/dev/null || echo 'missing')"
done
```

Expected:
- architecture-decisions: ≤ 39 (target ~28)
- dev-infrastructure: ≤ 20 (target ~16)
- gaps-and-opportunities: 48 (unchanged — Phase 3 target)
- methodology: ≤ 7 (unchanged or lower post-R1)
- resource-leaks-debt: 3
- desktop-pivot-debt: 3
- infrastructure-hooks: 7
- infrastructure-agents: 6
- infrastructure-mcp: 7

- [ ] **Step 2: Verify no orphans introduced**

```bash
bash ops/queries/orphan-notes.sh 2>&1 | tail -5
```

Expected: no new orphans. The sub-maps are linked from their `topics:` frontmatter, and the new sub-maps are pointed to from their parent MOCs.

- [ ] **Step 3: Check git status**

```bash
git status --short
```

Expected (new + modified files):

```
 M knowledge/architecture-decisions.md
 M knowledge/dev-infrastructure.md
?? knowledge/desktop-pivot-debt.md
?? knowledge/infrastructure-agents.md
?? knowledge/infrastructure-hooks.md
?? knowledge/infrastructure-mcp.md
?? knowledge/resource-leaks-debt.md
```

- [ ] **Step 4: Stage and commit**

```bash
git add knowledge/architecture-decisions.md knowledge/dev-infrastructure.md knowledge/desktop-pivot-debt.md knowledge/infrastructure-agents.md knowledge/infrastructure-hooks.md knowledge/infrastructure-mcp.md knowledge/resource-leaks-debt.md && \
git commit -m "$(cat <<'EOF'
vault: /architect phase 2 — split architecture-decisions and dev-infrastructure MOCs

R2 — architecture-decisions 54 → ~28:
- Created knowledge/resource-leaks-debt.md (3 notes: setInterval, genkit-abort, scrypt)
- Created knowledge/desktop-pivot-debt.md (3 notes: Tauri CSP, sidecar, pivot-unblocked)
- Removed 3 duplicate Knowledge Notes entries that already live in sub-maps
  (ai-prompt-scaling, monolithic-context, cors-origin-reflection)
- Replaced 23-entry Comprehensive Audit Findings section with 5-line
  sub-map pointer block (ai-system-debt, security-debt, performance-debt,
  resource-leaks-debt, desktop-pivot-debt)

R3 — dev-infrastructure 43 → ~16:
- Created knowledge/infrastructure-hooks.md (7 notes from Hooks section)
- Created knowledge/infrastructure-agents.md (6 notes from Agents section)
- Created knowledge/infrastructure-mcp.md (7 notes from MCP Servers section)
- Replaced 4 inline sections in dev-infrastructure.md with pointer references
  to the 4 sub-maps (hooks, agents, mcp, claude-code-skills already existed)

Both target MOCs now under the 40-entry threshold. Zero orphans introduced.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Confirm commit**

```bash
git log --oneline -2
```

Expected: two commits at the top — Phase 2 and Phase 1.

**Phase 2 exit criteria:**
- [ ] `architecture-decisions.md` ≤ 39 entries
- [ ] `dev-infrastructure.md` ≤ 20 entries
- [ ] 5 new sub-maps exist with proper frontmatter and correct entry counts (3, 3, 7, 6, 7)
- [ ] Zero orphans introduced
- [ ] Zero new dangling links (sub-map cross-links resolve)
- [ ] Commit made

---

## Phase 3 — De-duplicate gaps-and-opportunities + Collapse methodology (R4 + R5)

**Prerequisite:** Phases 1 and 2 complete and committed.

**Why last:** These are the lowest-risk edits and depend on the cleaner baseline from Phases 1+2 (R5 depends on R1 having already removed the `## Notes` section from methodology).

---

### Task 3.1: R4 — Reduce `knowledge/gaps-and-opportunities.md`

**Files:**
- Modify: `knowledge/gaps-and-opportunities.md`

**Context:** Two sections (`Developer Infrastructure Gaps` with 11 entries, `Skill Ecosystem Gaps` with 7 entries) duplicate content that lives in `[[dev-infrastructure]]` and `[[claude-code-skills]]` respectively. The Skill Ecosystem Gaps section already contains a pointer line (`See [[claude-code-skills]] for the full topic map.`) — the task is to delete the 7 redundant bullet entries that follow it. The Developer Infrastructure Gaps section has NO existing pointer, so it needs a full replacement with a new pointer.

Expected post-edit count: 48 − 11 − 7 = **30 entries**.

- [ ] **Step 1: Replace the Developer Infrastructure Gaps section**

**old_string:**

```
## Developer Infrastructure Gaps

- [[session-orient-and-validate-note-have-syntax-bugs]] -- two hook scripts have bash syntax errors from concatenated lines
- [[nine-posttooluse-groups-fire-on-every-write]] -- dense blocking pipeline adds latency to every edit
- [[auto-commit-vault-is-the-only-async-hook]] -- 25 blocking hooks vs 1 async creates bottleneck
- [[two-hook-groups-have-no-explicit-matcher]] -- fragile implicit defaults in settings.json
- [[thirty-seven-agents-have-no-trigger-patterns]] -- agents cannot self-activate, must be manually invoked
- [[six-agents-cover-technologies-not-in-protopulse-stack]] -- dead-weight agent definitions
- [[postgres-mcp-has-inline-credentials-in-mcp-json]] -- hardcoded DB password in version control
- [[combined-claude-md-exceeds-800-lines-creating-context-pressure]] -- ~8600 tokens consumed per session by instructions alone
- [[claude-md-references-a-settings-skill-that-does-not-exist]] -- stale reference after skill removal
- [[subagentsop-event-is-declared-but-has-no-hooks]] -- subagent quality gates missing
- [[vault-skills-outnumber-project-skills-seven-to-one]] -- development workflow skills underserved
```

**new_string:**

```
## Developer Infrastructure Gaps

See [[dev-infrastructure]] for the full infrastructure topic map — hook latency, agent trigger gaps, MCP credential leaks, and CLAUDE.md context pressure all live there under their respective sections. The Known Issues subsection is the specific analog to this one.
```

- [ ] **Step 2: Remove the Skill Ecosystem Gaps bullet list (keep the existing pointer)**

**old_string:**

```
## Skill Ecosystem Gaps

See [[claude-code-skills]] for the full topic map.

- [[three-separate-code-review-paths-create-routing-confusion]] -- requesting, receiving, and plugin code-review overlap
- [[four-overlapping-task-management-systems-fragment-attention]] -- /tasks, /next, /ralph, taskmaster plugins
- [[twelve-deprecated-skills-still-exist-alongside-their-replacements]] -- zombie skills inflate count and confuse routing
- [[no-skill-routes-to-performance-profiling-despite-agent-existing]] -- react-performance-expert is orphaned
- [[no-database-migration-skill-despite-drizzle-being-core]] -- schema changes rely on raw npm commands
- [[infrastructure-skills-exist-but-are-not-referenced-in-any-workflow]] -- hook-debug, cmd-create are discoverable but invisible
- [[no-deployment-pipeline-skill-beyond-basic-ship]] -- /ship is git push, not CI/CD
```

**new_string:**

```
## Skill Ecosystem Gaps

See [[claude-code-skills]] for the full topic map — the Gaps subsection catalogs routing confusion, zombie skills, deployment pipeline gaps, and performance-profiling orphans.
```

- [ ] **Step 3: Count remaining entries**

```bash
grep -c '^\- \[\[' knowledge/gaps-and-opportunities.md
```

Expected output: `30` (48 − 11 − 7 = 30). If higher, re-verify that both section replacements succeeded.

---

### Task 3.2: R5 — Collapse `knowledge/methodology.md` to a navigation stub

**Files:**
- Modify: `knowledge/methodology.md` (whole-file rewrite)

**Context:** After Phase 1's R1, `knowledge/methodology.md` has no inline wiki-link notes left (its 5 boundary-violating links were removed). Its remaining content — Processing Pipeline, Vocabulary, Claim Numbering, Queue Schema — all duplicate canonical content in `self/methodology.md` and `ops/derivation.md`. R5 reduces this file to a thin stub that keeps `knowledge/index.md` → `[[methodology]]` from breaking while eliminating the duplication.

- [ ] **Step 1: Read the current state (post-R1) to confirm expected layout**

```bash
cat knowledge/methodology.md
```

The file should contain: frontmatter, `# methodology` heading, the original intro paragraph, `## Processing Pipeline`, `## Vocabulary`, `## Claim Numbering`, `## Where Operational Methodology Lives` (added by R1), `## Graph Health Rules`, `## Queue Schema`, and the Topics footer.

- [ ] **Step 2: Rewrite the file wholesale**

Use the Write tool to overwrite `/home/wtyler/Projects/ProtoPulse/knowledge/methodology.md` with this exact content:

```markdown
---
description: Navigation hub pointing to the two canonical methodology locations — self/methodology.md (agent) and ops/methodology/ (operational)
type: moc
topics:
  - "[[index]]"
  - "[[identity]]"
---

# methodology

This topic map is a navigation stub, not a content container. Methodology for the ProtoPulse knowledge agent lives in two canonical locations outside the `knowledge/` space:

- **Agent methodology** — `self/methodology.md` documents the agent's personality, the Extract → Connect → Revisit → Verify processing cycle, and the "capture fast, process slow" philosophy.
- **Operational methodology** — `ops/methodology/` holds learnings mined from session transcripts via `/remember`: hard caps on concurrent agents, autonomy rules, wiki-link verification gates, and the derivation rationale.

This stub exists only to keep `[[index]]` → `[[methodology]]` from breaking and to document where the real content lives. Do not add wiki-link notes here — if content belongs in the agent's self-knowledge, it goes to `self/`; if it's an operational pattern mined from sessions, it goes to `ops/methodology/`.

## Graph Health Rules

These rules govern the `knowledge/` space specifically and are durable enough to live here rather than in `ops/`:

- Every file must link to at least one topic map (enforced by the validate-note hook)
- No dangling `[[links]]` — stubs are created immediately when links are referenced
- `/seed` is the entry point for processing any source
- `/status` and `/graph` track health metrics

---

Topics:
- [[index]]
- [[identity]]
```

- [ ] **Step 3: Verify the stub**

```bash
wc -l knowledge/methodology.md && echo "---" && grep -c '^\- \[\[' knowledge/methodology.md
```

Expected: line count ≤ 35, wiki-link entry count ≤ 3 (the 2 Topics footer entries plus maybe the Graph Health Rules `[[links]]` which is a prose self-reference, not a real wiki-link bullet).

- [ ] **Step 4: Confirm `knowledge/index.md` still points to methodology**

```bash
grep '\[\[methodology\]\]' knowledge/index.md
```

Expected: at least one line containing `[[methodology]]`. The stub file still satisfies the link target.

---

### Task 3.3: Validate Phase 3 and commit

**Files:** None (validation + commit)

- [ ] **Step 1: Run combined MOC size + orphan scan**

```bash
echo "=== post-Phase-3 MOC sizes ===" && \
for f in architecture-decisions dev-infrastructure gaps-and-opportunities methodology claude-code-skills; do
  printf "%-30s %s\n" "$f" "$(grep -c '^\- \[\[' "knowledge/$f.md")"
done && \
echo "=== orphan scan ===" && \
bash ops/queries/orphan-notes.sh 2>&1 | tail -3
```

Expected:
- architecture-decisions: ≤ 39 (unchanged from Phase 2)
- dev-infrastructure: ≤ 20 (unchanged from Phase 2)
- gaps-and-opportunities: 30
- methodology: ≤ 3
- claude-code-skills: 40 (unchanged — no action per brainstorm)
- Orphans: 0

- [ ] **Step 2: Check git status**

```bash
git status --short
```

Expected:

```
 M knowledge/gaps-and-opportunities.md
 M knowledge/methodology.md
```

- [ ] **Step 3: Stage and commit**

```bash
git add knowledge/gaps-and-opportunities.md knowledge/methodology.md && \
git commit -m "$(cat <<'EOF'
vault: /architect phase 3 — dedupe gaps-and-opportunities, collapse methodology stub

R4 — gaps-and-opportunities 48 → 30:
- Replaced Developer Infrastructure Gaps section (11 entries) with
  pointer to [[dev-infrastructure]]
- Deleted 7 redundant entries from Skill Ecosystem Gaps section
  (the pointer to [[claude-code-skills]] already existed)

R5 — methodology MOC reduced to navigation stub:
- Removed duplicate content (Processing Pipeline, Vocabulary, Claim Numbering,
  Queue Schema) that lives canonically in self/methodology.md and ops/derivation.md
- Retained: frontmatter, # heading, pointer paragraph, Graph Health Rules,
  Topics footer
- Stub exists only to keep knowledge/index.md → [[methodology]] from breaking

gaps-and-opportunities.md under the 40-entry threshold.
Zero orphans introduced.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

**Phase 3 exit criteria:**
- [ ] `gaps-and-opportunities.md` at 30 entries
- [ ] `knowledge/methodology.md` reduced to navigation stub (~3 entry lines, all in Topics footer)
- [ ] Zero orphans
- [ ] `knowledge/index.md` → `[[methodology]]` still resolves
- [ ] Commit made

---

## Phase 4 — Evolution Log + Final Validation

**Prerequisite:** Phases 1, 2, 3 all complete and committed.

---

### Task 4.1: Update `ops/derivation.md` Evolution Log

**Files:**
- Modify: `ops/derivation.md` (append to Evolution Log section)

**Context:** Append a new Evolution Log entry dated 2026-04-11 documenting this /architect pass. The entry goes at the end of the Evolution Log section, after the existing 2026-04-06 entry.

- [ ] **Step 1: Confirm the insertion point**

```bash
grep -n 'Evolution Log\|2026-04-06' ops/derivation.md
```

Expected: The Evolution Log header and two 2026-04-06 entries. Note the last line of the 2026-04-06 entry block (should be around line 120 with `**Vault state after:**`).

- [ ] **Step 2: Append the new entry**

Use the Edit tool to insert after the last line of the 2026-04-06 entry and before the `## Generation Parameters` section:

**old_string:**

```
**Vault state after:** 147 notes, 15 topic maps (was 12), 0 orphans, 0 dangling links.

## Generation Parameters
```

**new_string:**

```
**Vault state after:** 147 notes, 15 topic maps (was 12), 0 orphans, 0 dangling links.

### 2026-04-11: /architect analysis — 6 recommendations across 4 phases
**Trigger:** User-invoked /architect full run after 5-day gap. Health check revealed 5 three-space boundary violations, 4 MOCs at or over the 40-entry threshold, 228 unmined sessions (vs queue's claimed 3), empty observations + tensions directories, missing ops/health/ directory.

**Health findings:** 1 WARN (three-space boundary violations), 4 WARN (MOC oversize), 1 WARN (stale queue), 1 WARN (Over-Automation silent failure). 0 FAIL on schema compliance, orphans, or stale notes.

**Drift:** None — all 8 configuration dimensions still match the 2026-04-05 derivation.

**Failure modes active:** MOC Sprawl (#5, 4 MOCs), Over-Automation (#8, silent session-mining failure). Productivity Porn (#9) was the constraint — 25% meta-work budget kept this pass focused on root cause + symptom fixes rather than pre-emptive restructuring.

**Research grounding:** `reference/failure-modes.md` (#3 Link Rot, #5 MOC Sprawl, #8 Over-Automation, #9 Productivity Porn), `reference/three-spaces.md` (boundary rules), `reference/evolution-lifecycle.md` (Drift Detection Type 1 Staleness, Recursive Improvement Loop), `reference/dimension-claim-map.md` (community detection for MOC split).

**Changes implemented:**
1. **R1 — Fixed 5 three-space boundary violations** in knowledge/methodology.md. Removed cross-space wiki-links to ops/methodology/*.md and replaced with a prose paragraph redirecting to self/methodology.md and ops/methodology/.
2. **R2 — Split architecture-decisions 54 → ~28.** Created knowledge/resource-leaks-debt.md and knowledge/desktop-pivot-debt.md as new sub-maps. Removed 3 duplicate entries already in existing debt sub-maps. Replaced the 23-entry Comprehensive Audit Findings section with a 5-line sub-map pointer block.
3. **R3 — Split dev-infrastructure 43 → ~16.** Created knowledge/infrastructure-hooks.md, knowledge/infrastructure-agents.md, knowledge/infrastructure-mcp.md. Replaced 4 inline sections with pointer references. knowledge/claude-code-skills.md already existed from a prior pass.
4. **R4 — De-duplicated gaps-and-opportunities 48 → 30.** Replaced Developer Infrastructure Gaps section (11 entries) with a pointer to dev-infrastructure. Deleted 7 redundant entries from Skill Ecosystem Gaps (the pointer to claude-code-skills already existed).
5. **R5 — Collapsed knowledge/methodology.md to a navigation stub.** Methodology content now lives canonically in self/methodology.md (agent) and ops/methodology/ (operational). knowledge/methodology.md retained only for index.md → [[methodology]] link preservation plus graph-health-rules.
6. **R6 — Restored the session-mining feedback loop.** Updated ops/queue/queue.json maint-001 (target 3 → 228, priority session → multi-session, added mining strategy notes). Populated ops/observations/ with 2026-04-11-session-mining-pipeline-silently-broken.md. Created ops/health/ directory with 2026-04-11-full-system-health.md baseline snapshot.

**Vault state after:**
- Notes: 146 (unchanged — no notes created or deleted; 5 new topic maps added)
- Topic maps: 15 → 20 (+5: resource-leaks-debt, desktop-pivot-debt, infrastructure-hooks, infrastructure-agents, infrastructure-mcp)
- Orphans: 0
- Three-space boundary violations: 0 (was 1 cluster of 5 links)
- MOCs over threshold: 0 (architecture-decisions, dev-infrastructure, gaps-and-opportunities all under 40; claude-code-skills at 40 exactly — deferred)
- Observations: 0 → 1
- Health reports: 0 → 1
- Queue staleness: fixed (maint-001 now reflects 228 unmined sessions)

**Remaining work:** 228 unmined session files still require a `/remember --mine-sessions` batch run. That work is deliberately out of scope for this /architect pass — this pass restored the detection/queue/observation machinery; the actual mining batch is its own session. The queue task is now accurate and the infrastructure is ready.

## Generation Parameters
```

- [ ] **Step 3: Verify the insertion**

```bash
grep -c '2026-04-11' ops/derivation.md && echo "---" && grep -A 3 '2026-04-11: /architect' ops/derivation.md | head -5
```

Expected: The date appears in the file and the new entry heading is visible.

---

### Task 4.2: Full validation sweep

**Files:** None (validation only)

- [ ] **Step 1: Run the comprehensive health scan**

```bash
cd /home/wtyler/Projects/ProtoPulse && \
echo "=== FINAL: MOC sizes ===" && \
for f in architecture-decisions dev-infrastructure gaps-and-opportunities methodology claude-code-skills resource-leaks-debt desktop-pivot-debt infrastructure-hooks infrastructure-agents infrastructure-mcp ai-system-debt security-debt performance-debt; do
  printf "%-30s %s\n" "$f" "$(grep -c '^\- \[\[' "knowledge/$f.md" 2>/dev/null || echo missing)"
done && \
echo "=== FINAL: boundary violations ===" && \
grep -c -E '\[\[(derivation-rationale|enforce-hard-cap-on-concurrent-agents|use-agent-teams-not-raw-parallel-subagents-for-implementation|run-standard-dev-commands-autonomously|verify-wiki-links-before-completing-knowledge-work)\]\]' knowledge/methodology.md && \
echo "=== FINAL: operational state ===" && \
echo "unmined sessions: $(find ops/sessions -name '*.json' | wc -l)" && \
echo "observations: $(find ops/observations -name '*.md' | wc -l)" && \
echo "health reports: $(find ops/health -name '*.md' | wc -l)" && \
echo "=== FINAL: orphans ===" && \
bash ops/queries/orphan-notes.sh 2>&1 | tail -3 && \
echo "=== FINAL: JSON validity ===" && \
python3 -m json.tool ops/queue/queue.json > /dev/null && echo "queue.json valid"
```

Expected final state:

| Metric | Expected |
|---|---|
| architecture-decisions | ≤ 39 |
| dev-infrastructure | ≤ 20 |
| gaps-and-opportunities | 30 |
| methodology | ≤ 3 |
| claude-code-skills | 40 (unchanged) |
| resource-leaks-debt | 3 |
| desktop-pivot-debt | 3 |
| infrastructure-hooks | 7 |
| infrastructure-agents | 6 |
| infrastructure-mcp | 7 |
| ai-system-debt | 13 (unchanged) |
| security-debt | 8 (unchanged) |
| performance-debt | 10 (unchanged) |
| Boundary violations | 0 |
| Unmined sessions | 228 (unchanged — not in scope) |
| Observations | 1 |
| Health reports | 1 |
| Orphans | 0 |
| queue.json | valid |

- [ ] **Step 2: If any metric is off, STOP and investigate**

Do not proceed to commit. Read the failing metric's source file and debug.

---

### Task 4.3: Commit Phase 4

**Files:** None (commit only)

- [ ] **Step 1: Check git status**

```bash
git status --short
```

Expected:

```
 M ops/derivation.md
```

- [ ] **Step 2: Commit**

```bash
git add ops/derivation.md && \
git commit -m "$(cat <<'EOF'
vault: /architect phase 4 — evolution log + final validation

- Appended 2026-04-11 entry to ops/derivation.md Evolution Log
  documenting all 6 recommendations (R1-R6) implemented across phases 1-3
- Final validation sweep:
  - 0 three-space boundary violations (was 5)
  - 0 MOCs over threshold (was 4)
  - 5 new sub-maps with correct entry counts
  - 0 orphans
  - queue.json valid with accurate 228-session maint-001 target
  - First observation note and first health report in place

Remaining work: 228 unmined sessions — out of scope for /architect,
deferred to a dedicated /remember --mine-sessions batch session.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Confirm all 4 phase commits**

```bash
git log --oneline | head -6
```

Expected: 4 commits at the top matching the Phase 1-4 pattern, in order:

```
<hash> vault: /architect phase 4 — evolution log + final validation
<hash> vault: /architect phase 3 — dedupe gaps-and-opportunities, collapse methodology stub
<hash> vault: /architect phase 2 — split architecture-decisions and dev-infrastructure MOCs
<hash> vault: /architect phase 1 — fix boundary violations, restore feedback loop
```

**Phase 4 exit criteria:**
- [ ] `ops/derivation.md` evolution log updated
- [ ] Full validation sweep passes all expected metrics
- [ ] All 4 phase commits visible in git log
- [ ] Working tree clean (excluding unrelated auto-commit hook activity)

---

## Rollback Plan

Every phase is a single atomic commit. To roll back:

- **Roll back Phase 4:** `git revert HEAD`
- **Roll back Phases 3+4:** `git revert HEAD HEAD~1`
- **Roll back Phases 2+3+4:** `git revert HEAD HEAD~1 HEAD~2`
- **Roll back everything:** `git revert HEAD HEAD~1 HEAD~2 HEAD~3`

Do not use `git reset --hard` — the revert approach preserves history and is safe to push.

Worst-case failure mode during execution: a split produces an orphan (a note that was in a section we deleted without being moved to a sub-map). Mitigation: the validation sweep at the end of each phase explicitly checks orphan count. If an orphan appears, the fix is to add the note to the appropriate sub-map before committing the phase.

---

## Scope Boundary (Explicit)

**This plan does NOT:**

1. Mine the 228 unprocessed session stubs. That is `/remember --mine-sessions` territory, not /architect territory. R6 restores the detection/queue/observation machinery; the actual mining batch is a separate session.
2. Rewrite the session capture hook to produce richer transcripts. The JSON touch-counter format is intentional. Real transcripts already exist at `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/*.jsonl` — the mining pipeline just needs to read them. Rewriting the capture hook is out of scope.
3. Run `/reseed`. None of the reseed triggers apply — zero dimension drift, no context-file contradictions, vocabulary matches user's language, three-space boundaries are mostly intact (1 violation patched by R1).
4. Split `claude-code-skills.md`. Currently at exactly 40 (threshold), not over. Defer until 45+ per the `failure-modes.md` guidance against premature complexity.

---

## Total Budget

| Phase | Recs | Estimated Time | Cumulative |
|---|---|---|---|
| 1 | R1, R6a/b/c | ~20 min | 20 min |
| 2 | R2, R3 | ~30 min | 50 min |
| 3 | R4, R5 | ~13 min | 63 min |
| 4 | Log + validate | ~5 min | 68 min |

**~68 minutes total meta-work.** Exceeds the 25% per-session budget (15 min cap for a 60-min session). This is precisely why the plan is split into 4 phases across what may be 2-3 sessions. The 25% rule is preserved per-session, not per-plan. Phase 1 is ~20 min (slightly over 15-min cap, justified because R1 is a boundary-violation fix + R6 is the root-cause restoration and the two are tightly coupled).

---

## End of Plan
