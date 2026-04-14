# Ars Contexta Waves Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining Ars Contexta knowledge extraction campaign AND integrate the vault into ProtoPulse runtime AI layer so vault content actively grounds AI-assisted EDA work.

**Architecture:** Phased execution with strict state-safety boundaries. High-leverage extraction only (Wave F wiring guides + Wave H selective novel parts), followed by runtime integration layer (vault search backend + AI prompt injection), followed by parallel MOC polish via `/agent-teams` with non-overlapping file ownership, followed by verification.

---

## SCOPE REVISION 2026-04-14

**Original plan scope (below Phase 9) is SUPERSEDED by this revision.** Tyler directive: trim low-value extraction, add runtime integration so the vault actually gets consumed.

### Revised phase list

| Phase | Original | Revised | Status |
|---|---|---|---|
| 1 | Wave E7 (shields) | **SKIPPED** — E6 covered shield fundamentals; remaining E7 files (ili9341 touch shield, proto shield, ethernet shield, sensor shields) score low for agentic context value | SKIP |
| 2 | Wave E8 (breadboards) | **SKIPPED** — 95% dedup expected against existing breadboard-intelligence MOC | SKIP |
| 3 | Wave E9 (industrial/salvage) | **SKIPPED** — out of scope for ProtoPulse's maker-tier focus | SKIP |
| 4 | Wave F (wiring guides) | **EXECUTE IN FULL** — highest-leverage integrative content | DO |
| 5 | Wave G (unidentified) | **SKIPPED** — mystery parts have nothing verifiable to extract | SKIP |
| 6 | Wave H selective | **TRIMMED to 8 sets** — only truly novel: AC X2 cap, Arduino Leonardo, Cytron MD25HV, Von Weise AC gearmotor, TDY 50, Cybex treadmill, AXIS Q1755, OSEPP BTH-B1 | DO TRIMMED |
| 6a (NEW) | — | **Vault Consumption Layer** — server-side `vault-search.ts` + `/api/vault/search` + AI prompt injection + client hook | DO |
| 7 | MOC polish (6 teammates) | **TRIMMED to 3 teammates** — MCU+communication, actuators+power+shields, sensors+displays+passives+input+wiring+index+tensions | DO TRIMMED |
| 8 | Verification (4 teammates) | **KEPT** — orphan, dangling link, density, campaign closeout | DO |
| 9 | Closeout | **KEPT + expanded** — includes integration verification (AI grounded response test) | DO |

### Evidence grounding the scope cut

Verified 2026-04-14 via grep across `client/`, `server/`, `shared/`:
- Zero ProtoPulse code reads from `/home/wtyler/Projects/ProtoPulse/knowledge/` or `docs/parts/`
- `client/src/lib/electronics-knowledge.ts` is a separate hardcoded TypeScript article database, disjoint from Ars Contexta vault
- ProtoPulse AI layer (`server/ai.ts`) has sophisticated routing + tool registry but no vault awareness

Therefore: adding more low-value notes produces diminishing returns. Building the consumption layer converts existing 465+ notes from dormant inventory into active AI grounding.

### Phase 6a STATUS 2026-04-14: IMPLEMENTED

Vault consumption layer shipped and tested:
- `server/lib/vault-search.ts` — Fuse.js-backed index, 470+ notes, 17 tests pass
- `server/lib/vault-context.ts` — lazy singleton + per-message grounding, 8 tests pass
- `server/ai.ts` — `processAIMessage` and `streamAIMessage` now inject vault context into every AI request (appended to cached system prompt; empty-string fallback on vault failure keeps AI working if vault breaks)
- `server/ai-tools/knowledge-vault.ts` — `search_knowledge_vault` tool exposed to AI agent for deep queries, 6 tests pass, sources wired for BL-0160 Source Panel with `type='knowledge_base'`
- Full TypeScript check (`npm run check`): exit 0, clean

Every future AI request gets automatic top-K vault grounding derived from the user message. The AI agent can also explicitly call `search_knowledge_vault` for deeper lookups.

---

**Tech Stack:** Ars Contexta knowledge vault methodology (`/arscontexta:extract`, `/arscontexta:connect`, `/arscontexta:health`, `/arscontexta:revisit`), ProtoPulse Obsidian-style MOC (Map of Content) system, `/agent-teams` skill for parallel non-conflicting work, semantic dedup via `mcp__qmd__vector_search`.

---

## Critical Design Decisions

### Why extraction cannot use `/agent-teams` parallelization

`/arscontexta:extract` modifies four shared-state files per invocation:
- `ops/queue/queue.json` — enrichment task queue (global write)
- `ops/sessions/*.json` — session log (global write)
- `knowledge/*.md` atomic notes (semantic dedup: concurrent teammates see stale vault snapshot and both create duplicates)
- MOC files in `knowledge/` (link insertions race)

Two concurrent teammates running `/extract` on different files WILL produce duplicate atomic notes when their claims overlap (e.g., both extract an "I2C pull-up" claim). Dedup happens at write-time against a vector index that is not transactional.

**Mitigation:** Phases 1-6 dispatch fresh subagents **one at a time**, each with a self-contained prompt — this is NOT `/agent-teams`, this is sequential `Agent` dispatch with fresh context per wave.

### Where `/agent-teams` IS safe (Phase 7 & 8)

After all extraction is complete, vault mutations reduce to:
- MOC polish (one teammate = one-or-two specific MOC files, never overlapping)
- Tension resolution (each tension file owned by exactly one teammate)
- Orphan audit / dangling-link checks (read-only, partitioned by subdirectory)
- Health report generation (single writer, rest are read-only)

File ownership can be strictly partitioned, so `/agent-teams` is safe and parallelism is valuable.

### Wave H is selective, not full-file

`docs/parts/docs_and_data.md` (7,385 lines, 80+ "Document Sets") has ~80% overlap with already-extracted individual part files. Full-file extraction would flood the enrichment queue with noise. Phase 6 extracts ONLY the ~15 Document Sets covering parts NOT represented in individual files.

---

## File Structure

**Extraction outputs (Phases 1-6):**
- `knowledge/*.md` — new atomic notes (350-550 expected across remaining phases)
- `knowledge/{shields,passives,input-devices,actuators,power-systems,communication,wiring-integration,unidentified-parts,displays}.md` — MOC updates (link insertions only)
- `ops/queue/queue.json` — enrichment tasks (drain periodically, cap < 40)
- `ops/tensions/*.md` — any new contradictions surfaced during extraction
- `ops/sessions/*.json` — session logs (automatic)

**Post-extraction outputs (Phases 7-9):**
- `knowledge/*.md` MOC polish (frontmatter, description refresh, orphan pickup)
- `knowledge/index.md` — top-level hub updates
- `ops/health/` — health report snapshots
- `docs/superpowers/plans/2026-04-14-arscontexta-waves-completion-closeout.md` — closeout doc

---

## Task Definitions

> **Task granularity note:** Extraction tasks are longer than typical TDD "write a test" steps because each wave processes multiple source files via a stateful skill. Each wave is dispatched as one subagent invocation and reports back with per-file metrics. Checkboxes still track discrete actions.

---

### Phase 1: Wave E7 — Shields & Breakouts (sequential subagent)

**Files:**
- Modify: `knowledge/shields.md` (MOC link insertions)
- Create: up to ~15 atomic notes in `knowledge/*.md`
- Read-only: `docs/parts/{2p8-inch-tft-lcd-touch-shield-ili9341-320x240-spi,arduino-mega-proto-shield-v3,velleman-pka042-ethernet-shield-w5100-for-arduino,sainsmart-mega-sensor-shield-v2-3-pin-breakout,osepp-sensor-shield-3-pin-breakout-for-arduino-uno}.md`

- [ ] **Step 1: Pre-flight — verify queue depth < 35**

Run:
```bash
python3 -c "import json; q=json.load(open('ops/queue/queue.json'))['tasks']; p=[t for t in q if t.get('status')=='pending']; print(f'Pending: {len(p)}')"
```
Expected: `Pending: <35`. If ≥35, run `/arscontexta:connect` to drain before proceeding.

- [ ] **Step 2: Verify Wave E6 completed and did not leave orphan notes**

Run:
```bash
ls -la knowledge/shields.md && grep -c '\[\[' knowledge/shields.md
```
Expected: file modified today, link count has grown since pre-E6 baseline (25 lines).

- [ ] **Step 3: Dispatch Wave E7 subagent**

Use `Agent` tool, `subagent_type: general-purpose`, foreground (not background — prior async stalls). Prompt includes:
- Working directory: `/home/wtyler/Projects/ProtoPulse`
- Exact 5 file paths above
- Instruction: invoke `Skill` with `skill="arscontexta:extract"` and `args=<filepath>` for EACH file sequentially
- MOC target: `knowledge/shields.md` primarily; `knowledge/passives.md` for protoboard/connector physical claims; `knowledge/communication.md` for ethernet W5100 networking claims
- Gotchas: `ili9341` touch-shield may already have display claims from Wave E1 — expect enrichment. `W5100` ethernet is novel. `osepp-sensor-shield` is a passthrough breakout (claims may duplicate generic shield header facts from Wave A).
- Reporting: under 300 words, per-file (notes created / enrichments / skipped), final queue depth, any new tensions filed to `ops/tensions/`.

- [ ] **Step 4: Review Wave E7 report**

Verify:
- Per-file metrics sum to ≤ 15 new notes
- No files failed with "parse error" or "vector index unavailable"
- Queue depth at end < 40
- Any tension files reference real contradictions (not stylistic differences)

- [ ] **Step 5: Spot-check one new note**

Pick one atomic note from the report and `Read` it. Verify:
- Title works as prose in a link sentence
- `description:` frontmatter adds information beyond title
- Note is linked from at least one MOC (check with `grep -l "<note-slug>" knowledge/*.md`)
- No dangling `[[...]]` links to non-existent notes

- [ ] **Step 6: Drain queue if >= 35**

If queue depth reports ≥ 35, run `/arscontexta:connect` as fresh subagent. Otherwise proceed.

- [ ] **Step 7: Update MASTER_BACKLOG and commit checkpoint**

The auto-commit hook handles atomic commits per-file. Verify via:
```bash
git log --oneline -20 | head
```
Expected: recent "Auto: knowledge/..." entries. No manual commit needed unless auto-commit was bypassed.

---

### Phase 2: Wave E8 — Breadboards, Power Modules, Connectors (sequential subagent)

**Files:**
- Modify: `knowledge/passives.md`, `knowledge/power-systems.md` (MOC link insertions)
- Create: up to ~15 atomic notes in `knowledge/*.md`
- Read-only source files (5):
  - `docs/parts/solderless-breadboard-full-size-mb-102-830-point.md`
  - `docs/parts/solderless-breadboard-mini-400-point-interlockable.md`
  - `docs/parts/osepp-solderable-breadboard-large-perfboard.md`
  - `docs/parts/osepp-solderable-breadboard-mini-perfboard.md`
  - `docs/parts/elegoo-breadboard-power-module-mb-v2-3v3-5v-selectable.md`

- [ ] **Step 1: Pre-flight queue check** (same as Phase 1 Step 1)

- [ ] **Step 2: Dispatch Wave E8 subagent**

Same pattern as Phase 1 Step 3. Key additions to prompt:
- Dedup warning: breadboard rail-topology claims likely already exist from Wave A (`knowledge/index.md` or breadboard-intelligence MOC) — expect heavy enrichment
- MB-102 and 400-point share 95% claims — second file should produce mostly enrichment
- Perfboards are a separate sub-category from solderless — preserve the distinction
- `elegoo-mb-v2` power module is a voltage selector, not pure passive — route to `power-systems.md` MOC

- [ ] **Step 3: Review + spot-check** (same as Phase 1 Steps 4-5)

- [ ] **Step 4: Drain queue if needed**

---

### Phase 3: Wave E9 — Industrial, Salvage, Connectors, Misc (sequential subagent)

**Files:**
- Modify: `knowledge/power-systems.md`, `knowledge/passives.md`, potentially `knowledge/actuators.md` (MOC link insertions)
- Create: up to ~15 atomic notes
- Read-only source files (7, split into two sub-dispatches if subagent reports slowdown):
  - `docs/parts/d-436-raychem-solder-sleeve-butt-splice-heat-shrink.md`
  - `docs/parts/johnson-cinch-banana-plug-green-15a-0304-001.md`
  - `docs/parts/amphenol-11260-60-position-floating-receptacle-smd-connector.md`
  - `docs/parts/allen-bradley-1794-tb3s-flex-io-terminal-base-16-channel.md`
  - `docs/parts/emergency-stop-nc-button-with-dc-contactor-for-36v.md`
  - `docs/parts/salvaged-hoverboard-metal-frame-for-rover-chassis.md`
  - `docs/parts/dust-bin-assembly-rev-3-290-0018-salvage-mechanical-part.md`

- [ ] **Step 1: Pre-flight queue check**

- [ ] **Step 2: Dispatch Wave E9 subagent**

Special instructions in prompt:
- Heterogeneous batch — allow 0-3 notes per file (some are low-density mechanical parts)
- Allen-Bradley 1794-TB3S is industrial PLC terminal — likely novel to vault, expect 2-4 new notes
- Emergency-stop NC + DC contactor — preserve "normally closed" polarity and 36V arc-rating claim
- Salvage parts (hoverboard frame, dust bin) — if source file is < 50 lines with empty technical frontmatter, extracting 0 notes is valid and correct

- [ ] **Step 3: Review + spot-check + queue drain**

---

### Phase 4: Wave F — Wiring Guides (sequential subagent, highest-density phase)

**Files:**
- Modify: `knowledge/wiring-integration.md` (MOC — will grow significantly)
- Create: up to ~100 atomic notes (highest density wave — wiring guides are integrative and produce many cross-cutting claims)
- Read-only source files (7):
  - `docs/parts/wiring-36v-battery-power-distribution-4-tier-system.md`
  - `docs/parts/wiring-dual-zs-x11h-for-hoverboard-robot.md`
  - `docs/parts/wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter.md`
  - `docs/parts/wiring-i2c-multi-device-bus-compass-imu-current-sensor.md`
  - `docs/parts/wiring-nodemcu-esp32-to-4x-zs-x11h-for-4wd-rover.md`
  - `docs/parts/wiring-zs-x11h-to-arduino-mega-for-single-motor-control.md`
  - `docs/parts/wiring-zs-x11h-to-esp32-with-level-shifter.md`

- [ ] **Step 1: Pre-flight — force queue drain before Wave F**

Wave F's high density will overwhelm queue without pre-drain.
```bash
python3 -c "import json; q=json.load(open('ops/queue/queue.json'))['tasks']; p=[t for t in q if t.get('status')=='pending']; print(f'Pending: {len(p)}')"
```
If ≥ 15, run `/arscontexta:connect` before dispatch. Target queue start: ≤ 10.

- [ ] **Step 2: Dispatch Wave F subagent in TWO sub-batches**

Sub-batch F1: 4 files (36V distribution + 3 single-motor wiring guides)
Sub-batch F2: 3 files (multi-motor 4WD + hall sensor + I2C multi-device)

Why split: shared semantic space means dedup against within-wave peer notes is fastest if peers are already extracted. Sub-batching gives the first batch time to settle before the second runs against enriched vault.

Between sub-batches: run queue drain check and spot-check one F1 note for quality.

Prompt additions for each sub-batch:
- **MOC target is `knowledge/wiring-integration.md` PRIMARILY** — most notes belong here
- Cross-link heavily to component MOCs (actuators, power-systems, communication)
- ZS-X11H claims appear in 4 wiring guides — expect massive dedup into enrichments after the first guide
- TXS0108E level-shifter claims already exist from Wave E6 — should produce enrichment only, no new atomic notes about the chip itself
- Watch for tension: dual-ZS-X11H brake polarity may re-surface the BLDC brake tension from Wave D1

- [ ] **Step 3: Review F1 report, spot-check 2 notes, drain queue if ≥ 30**

- [ ] **Step 4: Dispatch F2 sub-batch**

- [ ] **Step 5: Review F2 report, spot-check 2 notes, drain queue**

- [ ] **Step 6: Verify `knowledge/wiring-integration.md` MOC health**

Run:
```bash
wc -l knowledge/wiring-integration.md && grep -c '\[\[' knowledge/wiring-integration.md
```
Expected: file has grown substantially (was a thin stub after Wave 0); link count ≥ 30. If link count < 15, MOC is under-populated — re-dispatch a focused enrichment subagent to scan new wiring notes and add missing MOC links.

---

### Phase 5: Wave G — Unidentified Parts (sequential subagent, lowest-density phase)

**Files:**
- Modify: `knowledge/unidentified-parts.md` (MOC, if it exists; create if not)
- Create: up to ~15 atomic notes (most files produce 0-1)
- Read-only source files (15):
  - `docs/parts/{18007pa,19123,1a48-central-semiconductor,3405,34-660-376301,lf-0174-1770-2902}-unknown-component.md`
  - `docs/parts/unidentified-{8x8-matrix-board-lw-45-24p,audio-sensor-1803-ccc,board-bj3450f01ap6,board-bj3450m020p5,board-sunblast-v9,module-lw-9601-rev-1p1,part-jh-1326r,rgb-led-module-lex-rgb-01,sensor-kar00044e}.md`
  - (De-duplicate `unidentified-component-lf-0174-1770-2902.md` vs `lf-0174-1770-2902-unknown-component.md` — pick one, skip the other)

- [ ] **Step 1: Verify `knowledge/unidentified-parts.md` MOC exists**

Run:
```bash
test -f knowledge/unidentified-parts.md && echo "exists" || echo "MISSING"
```
If missing, create a minimal stub with frontmatter and `[[index]]` parent link, then proceed.

- [ ] **Step 2: De-duplicate source file list**

Check if `unidentified-component-lf-0174-1770-2902.md` and `lf-0174-1770-2902-unknown-component.md` differ:
```bash
diff docs/parts/unidentified-component-lf-0174-1770-2902.md docs/parts/lf-0174-1770-2902-unknown-component.md
```
If identical: skip one. If different: extract both (they document different views of the same part).

- [ ] **Step 3: Dispatch Wave G subagent**

Prompt additions:
- **Zero-extraction from a file is VALID and CORRECT.** Empty-frontmatter mystery-part files with only "unknown" placeholder content should not be force-extracted. Report them as "skipped (no extractable claims)."
- For files with partial identification (e.g., "likely BJT based on package + 3 pins"), extract ONLY claims the file explicitly makes — do not infer from part number patterns
- All notes route to `knowledge/unidentified-parts.md` MOC
- Prefix any atomic notes with the unidentified marker style (slug already contains "unidentified-" prefix from part file)

- [ ] **Step 4: Review report — zero notes is an acceptable outcome for any given file**

- [ ] **Step 5: Verify `unidentified-parts.md` MOC has some content**

If all 15 files produced zero notes, the MOC will be empty of note links but should still exist with frontmatter and a note explaining: "This category intentionally contains few atomic notes — mystery parts contribute little to verifiable domain knowledge."

---

### Phase 6: Wave H — Selective Extraction of `docs_and_data.md` (sequential subagent)

**Files:**
- Modify: various MOCs depending on document set category
- Create: up to ~80 atomic notes (only from the ~15 novel Document Sets)
- Read-only source: `docs/parts/docs_and_data.md` (7,385 lines — **DO NOT extract whole file**)

**Target Document Sets (NOVEL only — confirmed not in individual part files):**
1. Document Set 1 — AC Line EMI Suppression Capacitor (Class X2, 275V AC, self-healing MKP)
2. Document Set 3 — AXIS Q1755 Network Camera System Interface
3. Document Set 6 — Arduino Leonardo (ATmega32u4 native USB HID — architecturally distinct from Uno)
4. Document Set 7 — Cytron MD25HV DC Motor Driver
5. Document Set 11 — Von Weise AC Gearmotor
6. Document Set 12 — Digital Addressable LED Strip Connector
7. Document Set 20 — Male-to-Male Dupont Jumper Wire
8. Document Set 22 — USB Cable
9. Document Set 23 — DC Brushless Cooling Fan (4-Pin PWM)
10. Document Set 24 — Robot Vacuum Cleaner Control Board
11. Document Set 25 — USB Type-A Connector with Custom Wiring
12. Document Set 26 — Geared DC Motor (Yellow Chassis)
13. Document Set 28 — Wi-Fi Camera Module PCB
14. Document Set 29 — TDY 50 AC Synchronous Motor
15. Document Set 32 — Universal Motor Armature and Speed Control Circuit
16. Document Set 33 — Mini Wi-Fi Surveillance Camera
17. Document Set 39 — Cybex Treadmill Control Panel and Power Assembly
18. Document Set 40 — Raspberry Pi 4 Model B with Camera CSI Cable (new variant — Pi 3B+ done)
19. Document Set 41 — OSEPP BTH-B1 Bluetooth Shield

**SKIP these Document Sets (already extracted from individual part files):**
- Sets 2, 4, 5, 8, 9, 10, 13, 14, 15, 16, 17, 18, 19, 21, 27, 30, 31, 34, and any others matching existing part files

- [ ] **Step 1: Verify overlap map with current vault state**

Run:
```bash
ls knowledge/ | grep -iE "(arduino-leonardo|cytron|md25hv|von-weise|treadmill|axis.*camera|bth-b1|tdy)" | head
```
Expected: none of these exist yet. If any DO exist, remove that Document Set from the target list — it was already extracted from somewhere else.

- [ ] **Step 2: Extract per-Document-Set line ranges**

For each target Document Set, identify line range:
```bash
grep -n "^### \*\*Document Set" docs/parts/docs_and_data.md | head -50
```
Build a list: "Set 1: lines 1-33", "Set 3: lines 69-104", etc.

- [ ] **Step 3: Dispatch Wave H subagent in THREE sub-batches**

Sub-batch H1: Sets 1, 6, 12, 20, 22, 25 (connectors, cables, safety capacitors, Leonardo MCU)
Sub-batch H2: Sets 7, 11, 23, 26, 29, 32, 40 (motors & motor drivers, Pi 4B)
Sub-batch H3: Sets 3, 24, 28, 33, 41, 39 (cameras, surveillance, treadmill, Bluetooth)

Between sub-batches: queue drain check.

Critical prompt instruction: subagent must use a custom extraction approach for `docs_and_data.md` because the file is not a standard part-page format:
- Subagent reads ONLY the specified line range per Document Set
- Treats each Document Set as a virtual source file
- Runs `/arscontexta:extract` style analysis but synthesizes a temporary virtual source path like `docs/parts/docs_and_data.md#set-N` for attribution
- If the extract skill cannot accept a subrange, subagent writes a temp file `ops/temp/set-N.md` with just that Document Set, runs `/extract` on that, then deletes the temp file after extraction succeeds

- [ ] **Step 4: Review each sub-batch report, spot-check novel-part notes**

For H1/H2/H3: pick one note from a NOVEL part (e.g., Arduino Leonardo native USB HID claim) and verify:
- Claim is specific to this part (not a generic MCU claim)
- Properly distinguishes from similar parts (Leonardo vs Uno HID difference)
- Linked from appropriate MOC

- [ ] **Step 5: Verify zero bleed-over into already-documented parts**

For each sub-batch, check that no new duplicate atomic notes were created for already-extracted parts:
```bash
find knowledge -name "*.md" -newer docs/parts/docs_and_data.md -type f | xargs grep -l "arduino-uno\|esp8266\|tb6612" 2>/dev/null | head
```
Expected: zero matches where `docs_and_data.md` line range was NOT for that part.

---

### Phase 7: Parallel MOC Polish via `/agent-teams` (6 teammates)

**Pre-condition:** All extraction phases (1-6) complete. Queue fully drained.

**Agent-teams architecture:** 6 teammates, strict file ownership, 5-6 tasks each, delegate mode enabled, leads do NOT implement.

**File ownership (NON-NEGOTIABLE — violation = plan failure):**

| Teammate | Owns (exclusive write) | Read-only access |
|---|---|---|
| T1: microcontrollers-steward | `knowledge/microcontrollers.md`, `knowledge/communication.md` | all other knowledge/ |
| T2: power-actuators-steward | `knowledge/actuators.md`, `knowledge/power-systems.md` | all other knowledge/ |
| T3: sensors-displays-steward | `knowledge/sensors.md`, `knowledge/displays.md` | all other knowledge/ |
| T4: passives-input-steward | `knowledge/passives.md`, `knowledge/input-devices.md` | all other knowledge/ |
| T5: shields-wiring-steward | `knowledge/shields.md`, `knowledge/wiring-integration.md` | all other knowledge/ |
| T6: index-tensions-steward | `knowledge/index.md`, `knowledge/eda-fundamentals.md`, `knowledge/unidentified-parts.md`, `ops/tensions/*.md` | all other knowledge/ |

- [ ] **Step 1: Create the team**

Run: `/team arscontexta-moc-polish` (or equivalent `TeamCreate` tool call)

- [ ] **Step 2: Dispatch teammates with identical task template but scoped ownership**

Each teammate receives 5-6 tasks:
1. Audit MOC frontmatter — ensure `description` is specific and actionable
2. Identify orphan atomic notes in your owned domain (notes not linked from any MOC)
3. Add missing MOC links for identified orphans
4. Verify child-MOC / parent-MOC reciprocity (each child topic maps to parent `eda-fundamentals` or `index`)
5. Scan your owned MOC for dangling `[[...]]` links to non-existent notes; either fix the link or remove it
6. Reorganize MOC sections if the flat link list exceeds 40 entries (introduce subheadings)

- [ ] **Step 3: Per-teammate deliverable**

Each teammate reports:
- Number of orphans adopted
- Number of dangling links fixed
- Frontmatter changes made
- Any tensions requiring cross-teammate coordination (flag to T6)

- [ ] **Step 4: Collision check**

After all 6 teammates complete:
```bash
git log --since="30 minutes ago" --name-only | sort -u | uniq -d
```
Expected: empty. If any file appears twice, a teammate violated ownership — audit diff for conflicts before committing.

- [ ] **Step 5: Clean shutdown**

Shut down all teammates before team cleanup. Delete team via `TeamDelete`.

---

### Phase 8: Parallel Verification via `/agent-teams` (4 teammates, read-mostly)

**Pre-condition:** Phase 7 complete.

**Agent-teams architecture:** 4 teammates, read-heavy with narrow write scope. Lead dispatches and consolidates, does not implement.

**File ownership:**

| Teammate | Owns (write) | Purpose |
|---|---|---|
| V1: orphan-hunter | `ops/health/orphan-report-<date>.md` | Find all atomic notes with zero MOC links |
| V2: dangling-link-hunter | `ops/health/dangling-links-<date>.md` | Find all `[[...]]` links pointing to non-existent notes |
| V3: density-analyst | `ops/health/density-report-<date>.md` | Compute connection density per MOC (links-out / links-in ratio) |
| V4: health-summarizer | `ops/health/extraction-campaign-closeout-<date>.md` | Consolidate V1-V3 into a single health snapshot |

- [ ] **Step 1: Create team `arscontexta-verify`**

- [ ] **Step 2: Dispatch V1, V2, V3 in parallel (V4 depends on them)**

V1 prompt: scan `knowledge/*.md` for atomic notes; for each, grep across all MOCs; report notes with zero MOC mentions.

V2 prompt: scan all `[[...]]` link targets; verify each target exists as `<target>.md`; report misses.

V3 prompt: for each MOC, count outgoing links; for each atomic note, count inbound links from MOCs; compute ratios; flag MOCs with < 2.0 density.

- [ ] **Step 3: Dispatch V4 after V1-V3 complete**

V4 consolidates into single campaign closeout doc with sections:
- Extraction totals (notes created across all 8 waves — A through H)
- Current vault health (orphan count, dangling link count, density summary)
- Unresolved tensions (list from `ops/tensions/`)
- Recommendations for next campaign

- [ ] **Step 4: Review V4 closeout doc with Tyler**

Final human-in-loop checkpoint before team cleanup. If Tyler requests changes, re-dispatch V4 only.

- [ ] **Step 5: Clean shutdown + team cleanup**

---

### Phase 9: Plan Closeout and Memory Capture

**Files:**
- Create: `docs/superpowers/plans/2026-04-14-arscontexta-waves-completion-closeout.md`
- Modify: `docs/MASTER_BACKLOG.md` (mark extraction campaign BL items done)
- Modify: `/home/wtyler/.claude/projects/-home-wtyler-Projects-ProtoPulse/memory/MEMORY.md` (reference new campaign-complete memory entry)
- Create: `/home/wtyler/.claude/projects/-home-wtyler-Projects-ProtoPulse/memory/project_arscontexta_campaign_complete.md`

- [ ] **Step 1: Write closeout doc**

Include: total notes, total enrichments processed, total tensions resolved/open, total sessions used, campaign start/end dates, lessons learned for future campaigns (e.g., "sub-batch wiring guides to let dedup settle between related files").

- [ ] **Step 2: Update MASTER_BACKLOG**

Mark the parts-knowledge-extraction BL items as done with pointer to closeout doc. Update Quick Stats block at top.

- [ ] **Step 3: Write memory entry**

`project_arscontexta_campaign_complete.md`:
```markdown
---
name: Ars Contexta Parts Extraction Campaign Complete
description: Campaign extracted 138 part files into vault, ended 2026-04-14
type: project
---

Campaign ran 2026-04-10 to 2026-04-14, extracting 138 parts files into ~700 atomic notes across 11 hardware MOCs.

**Why:** ProtoPulse needs domain-accurate EDA claims for AI-assisted circuit design — training-data MCU claims are unreliable.

**How to apply:** When working on ProtoPulse EDA features, search `knowledge/` via `mcp__qmd__qmd_vector_search` before implementing — Tyler's part-specific claims are authoritative for THIS inventory, not general MCU lore.
```

- [ ] **Step 4: Add pointer to `MEMORY.md`**

Append to `MEMORY.md` under "Project State Pointers":
```
- [Ars Contexta campaign complete](project_arscontexta_campaign_complete.md) — 138 files → ~700 notes, closeout doc in docs/superpowers/plans/
```

- [ ] **Step 5: Final commit**

Auto-commit hook handles this; verify with `git log --oneline -5`.

- [ ] **Step 6: Mark original plan complete**

Edit `docs/superpowers/plans/2026-04-12-parts-knowledge-extraction.md` header to indicate status: `**Status:** Complete 2026-04-14`.

---

## Anti-Patterns to Avoid

- **Do NOT parallelize extraction via `/agent-teams` in Phases 1-6.** Shared queue state and non-transactional dedup will corrupt the vault. Sequential only.
- **Do NOT extract `docs_and_data.md` as a whole file.** Selective targeting only — ~15 Document Sets out of 80+.
- **Do NOT skip queue drain between waves.** Queue overflow at `queue_max_depth` is a silent failure mode that drops enrichment tasks.
- **Do NOT let a teammate in Phase 7/8 write outside its owned files.** File ownership is non-negotiable. If a teammate needs to modify an out-of-scope file, stop the teammate and escalate.
- **Do NOT force-extract notes from truly unidentifiable parts** (Wave G). Zero-note outputs from mystery-part files are correct.
- **Do NOT mark a wave complete without queue-depth verification.** Always confirm queue drained after each phase.

---

## Execution Handoff

**Plan complete. Two execution options:**

**1. Subagent-Driven (recommended for Phases 1-6)** — Fresh subagent per wave, review between waves, fast iteration. Extraction is sequential anyway, so this is the natural fit.

**2. Agent-Teams (required for Phases 7-8)** — Parallel teammates with strict file ownership. Not optional for these phases; the parallelization is the point.

**Hybrid execution is correct here:** Phases 1-6 use `Agent` subagents one-at-a-time; Phases 7-9 use `/agent-teams` with explicit ownership partition.

---

## Review Gate

Before starting Phase 1: confirm Wave E6 has completed and reported. If E6 is still running, this plan WAITS at the Phase 1 pre-flight check until E6 finishes.
