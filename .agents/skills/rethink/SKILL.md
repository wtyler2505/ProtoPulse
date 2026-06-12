---
name: rethink
description: Challenge system assumptions against accumulated evidence. Triages observations and tensions, detects patterns, generates proposals. The scientific method applied to knowledge systems. Triggers on "/rethink", "review observations", "challenge assumptions", "what have I learned".
user-invocable: true
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, AskUserQuestion
context: fork
---

## Runtime Configuration (Step 0 — before any processing)

Read these files to configure domain-specific behavior:

1. **`ops/derivation-manifest.md`** — vocabulary mapping, domain context
   - Use `vocabulary.knowledge` for the knowledge folder name
   - Use `vocabulary.note` for the note type name in output
   - Use `vocabulary.rethink` for the command name in output
   - Use `vocabulary.topic_map` for topic map references
   - Use `vocabulary.cmd_connect` for connection-finding references

2. **`ops/config.yaml`** — thresholds, processing preferences
   - `self_evolution.observation_threshold`: number of pending observations before suggesting rethink (default: 10)
   - `self_evolution.tension_threshold`: number of pending tensions before suggesting rethink (default: 5)

3. **`ops/methodology/`** — existing methodology notes (read all to understand current system self-knowledge)

If these files don't exist (pre-init invocation or standalone use), use universal defaults.

The command name itself transforms per domain. The derivation manifest maps the universal name to domain-native language. If no manifest exists, use "rethink" as the command name.

## EXECUTE NOW

**Target: $ARGUMENTS**

Parse immediately:
- If target is empty: run full six-phase rethink (Phase 0 drift check + five evidence phases) on all pending observations and tensions
- If target is "triage": run Phase 1 only (triage and methodology updates, no pattern detection)
- If target is "patterns": skip triage, run Phases 3-5 only (analyze existing evidence for patterns)
- If target is "drift": run Phase 0 only (drift check without triage or pattern detection)
- If target is a specific observation or tension filename: triage that single item interactively

**START NOW.** Reference below defines the six-phase workflow.

### Reference Files (progressive disclosure — read on demand)

| File | Read when |
|------|-----------|
| `references/drift-and-methodology.md` | Running Phase 0 (drift check steps 0a-0d + drift observation template) or Phase 2 (methodology note template, extend-vs-create rules, duplicate check, topic map update) |
| `references/patterns-and-proposals.md` | Running Phase 3 (evidence sources, pattern types, detection methods, quality check, Pattern Report format) or Phase 4 (Proposal Structure, quality gates, scope rules, /next integration) |
| `references/edge-cases.md` | Missing evidence dirs, nothing pending, drift suggesting /reseed, <5 items, single-item triage, conflicting proposals, 20+ item backlogs |
| `../shared-references/methodology-loop.md` | The full methodology learning loop + Rule Zero that rethink enforces |

---

## Philosophy

**The system is not sacred. Evidence beats intuition.**

Every rule in the context file, every workflow in a skill, every assumption baked into the architecture was a hypothesis at some point. Hypotheses need testing against reality. Observation notes in `ops/observations/` capture friction from actual use. Tension notes in `ops/tensions/` capture unresolved conflicts. Rethink first triages these individually (some become insights, some become methodology updates, some get archived), then compares remaining evidence against what the system assumes and proposes changes when patterns emerge.

This is the scientific method applied to knowledge systems: hypothesize, implement, observe, revise.

Without this loop, generated systems ossify — they accumulate friction that never gets addressed, contradictions that never get resolved, and methodology learnings that never get elevated to system-level changes. /rethink is the immune system that prevents calcification.

---

## Phase 0: Drift Check

Rule Zero: ops/methodology/ is the canonical specification of how this system operates. Before triaging observations, check whether the system has drifted from what the methodology says it should do.

**Execute steps 0a-0d per `references/drift-and-methodology.md` (MANDATORY read):**
- **0a.** Load methodology state — read all of ops/methodology/, extract categories/dates/status and behavioral assertions
- **0b.** Load system configuration — ops/config.yaml, context file (CLAUDE.md), ops/derivation-manifest.md
- **0c.** Compare across three drift types — staleness (config newer than methodology), coverage gap (active features without methodology notes), assertion mismatch (methodology vs context/config/other notes)
- **0d.** Create a drift observation in `ops/observations/` for each finding (template in the reference, `category: drift`)

### 0e. Report and Proceed

Output drift status summary:

```
Drift Check:
  Staleness: [N findings — config changed, methodology not updated]
  Coverage gaps: [N features without methodology notes]
  Assertion mismatches: [N contradictions between methodology and system]
  Total drift observations created: [N]
```

If drift observations were created, they join the pool of pending observations for Phase 1 triage. Proceed to Phase 1.

---

## Phase 1: Triage

### 1a. Gather Pending Evidence

```bash
OBS_PENDING=$(grep -rl '^status: pending' ops/observations/ 2>/dev/null)
OBS_COUNT=$(echo "$OBS_PENDING" | grep -c . 2>/dev/null || echo 0)
TENSION_PENDING=$(grep -rl '^status: pending\|^status: open' ops/tensions/ 2>/dev/null)
TENSION_COUNT=$(echo "$TENSION_PENDING" | grep -c . 2>/dev/null || echo 0)
```

Read each pending item fully. These are small atomic notes — load all of them. Understanding the full content is required for accurate triage. If zero pending items, report clean state and exit early.

Also read `ops/methodology/` to understand existing methodology notes — this prevents creating duplicates and informs whether new observations should extend existing methodology rather than create new notes.

### 1b. Classify Each Item

Assign exactly one disposition per observation or tension:

| Disposition | Meaning | When to Apply | Action |
|-------------|---------|---------------|--------|
| PROMOTE | Reusable insight worth keeping as a permanent insight | General principle across sessions. Would work as a claim note. Crystallized insight, not operational guidance. | Create insight in {vocabulary.knowledge}/, set observation `status: promoted`, add `promoted_to: [[title]]` |
| IMPLEMENT | Operational guidance that should change the system | "System should do X differently." Points to a concrete improvement in context file, template, or skill. | Update the specific file, set `status: implemented`, add `implemented_in: [filepath]` |
| METHODOLOGY | Friction pattern that should inform agent behavior | Behavioral learning. Not a domain insight (PROMOTE) or a system change (IMPLEMENT) — a methodology learning about HOW to operate. | Create or update methodology note in `ops/methodology/`, set `status: implemented`, add `implemented_in: ops/methodology/[file]` |
| ARCHIVE | Session-specific, no longer relevant | One-session-specific with no lasting value. Already addressed by later work. Superseded by newer evidence. | Set `status: archived` |
| KEEP PENDING | Not enough evidence yet | Might matter but need more data. Part of a pattern that has not fully emerged. Single data point that could go either way. | No change — leave `status: pending` |

**Triage heuristics for observations:**

- Observation describes a general principle that works across sessions → PROMOTE
- Observation says "the system should do X differently" with a specific file/section → IMPLEMENT
- Observation describes agent behavior that should change (how to process, when to check, what to avoid) → METHODOLOGY
- Observation was about one specific session with no lasting value → ARCHIVE
- Observation might matter but only appeared once → KEEP PENDING

**Triage heuristics for tensions:**

- Tension was resolved by subsequent changes → ARCHIVE (set `status: dissolved`, add `dissolved_reason`)
- Tension reveals a genuine conflict between two insights → PROMOTE (create a tension insight or resolution insight)
- Tension points to a system workflow that needs redesigning → IMPLEMENT
- Tension is about agent methodology → METHODOLOGY
- Tension is real but resolution is unclear → KEEP PENDING

### 1c. Present Triage Table

Present the full triage to the user before executing any changes:

```
--=={ rethink — Triage }==--

  Evidence: [N] observations, [M] tensions

  PROMOTE ([count])
    [filename] — [title] → proposed insight title
    [filename] — [title] → proposed insight title

  IMPLEMENT ([count])
    [filename] — [title] → change [specific file/section]
    [filename] — [title] → change [specific file/section]

  METHODOLOGY ([count])
    [filename] — [title] → create/update ops/methodology/[name].md
    [filename] — [title] → extends existing ops/methodology/[name].md

  ARCHIVE ([count])
    [filename] — [title] — [reason for archiving]

  KEEP PENDING ([count])
    [filename] — [title] — [why more evidence needed]
```

Use AskUserQuestion: "Review the triage above. Approve all, or list items to reclassify (e.g., 'keep obs-003 pending, promote obs-007 instead')."

**Wait for user confirmation before proceeding to 1d.** Do not execute triage without approval.

### 1d. Execute Triage

After user confirmation, apply all dispositions in order:

**For PROMOTE items:**
1. Create insight with prose-as-title in {vocabulary.knowledge}/
2. Follow standard note schema: YAML frontmatter (description, type, created), body developing the insight, Topics footer linking to relevant {vocabulary.topic_map}(s)
3. The observation content becomes the seed for the note body — but develop it fully, do not just copy the observation
4. Update the observation: set `status: promoted`, add `promoted_to: [[note title]]`

**For IMPLEMENT items:**
1. Make the specific change to the identified file/section
2. Show the change to the user (before/after) and get confirmation if the change is non-trivial
3. Update the observation/tension: set `status: implemented`, add `implemented_in: [filepath]`

**For METHODOLOGY items:** (see Phase 2 below)

**For ARCHIVE items:**
1. Update observation status: `status: archived`
2. For tensions being dissolved: `status: dissolved`, add `dissolved_reason: [why]`

**For KEEP PENDING items:**
1. No changes — leave in place

**Update topic maps:** After triage execution, update `ops/observations.md` and `ops/tensions.md` to reflect status changes. Move entries between Pending/Promoted/Archived/Resolved/Dissolved sections as appropriate.

---

## Phase 2: Methodology Folder Updates

For items triaged as METHODOLOGY, create or update notes in `ops/methodology/`. **Follow `references/drift-and-methodology.md` §Methodology Folder Updates (MANDATORY read):** new-note template (`source: rethink`, `evidence` array of observation filenames), extend-don't-duplicate rule (read all of ops/methodology/ first; >80% overlap → extend the existing note + update its evidence array + set the observation `status: implemented` with `implemented_in`), then update the `ops/methodology.md` topic map (new notes in category sections, refreshed context phrases).

---

## Phase 3: Pattern Detection

Analyze remaining pending evidence (post-triage) plus promoted/implemented history for systemic patterns. This is where individual data points become actionable signals. **Follow `references/patterns-and-proposals.md` §Pattern Detection (MANDATORY read):** four evidence sources, five pattern types with thresholds (recurring themes, contradiction clusters, friction accumulation, drift signals, methodology convergence), six detection methods, and the four-part pattern quality check (evidence count, time span, specificity, impact).

**Do not fabricate patterns from insufficient evidence.** A single observation is a data point, not a pattern. Two observations are a coincidence. Three observations are a pattern worth investigating. Only report patterns passing all four quality checks, using the Pattern Report format from the reference. If no patterns are detected, report this clearly — an empty result after triage is a sign the system is healthy, not that rethink failed.

---

## Phase 4: Proposal Generation

For each detected pattern, generate one specific, actionable proposal using the Proposal Structure in `references/patterns-and-proposals.md` §Proposal Generation (MANDATORY read). Every proposal MUST pass the five quality gates — specific file references, evidence backing (≥2 observations/tensions, no intuition-only proposals), risk awareness, proportionality, reversibility assessment — and respect the evidence-strength → maximum-scope table (2 obs → methodology note; 3+ → skill/template; 5+ obs + tensions → context file section; pervasive → /architect consultation). Apply the /next integration check: if 10+ pending observations or 5+ pending tensions remain unconsumed, emit the threshold signal.

---

## Phase 5: Present for Approval

**NEVER auto-implement proposals.** Changes to system assumptions require human judgment. This is the invariant that makes rethink safe — it can analyze aggressively because it cannot act unilaterally.

### Summary Output

```
--=={ rethink — Complete }==--

  Triaged: [N] observations, [M] tensions

    Promoted to insights:  [count]
    Methodology updates:         [count]
    Implemented:                 [count]
    Archived:                    [count]
    Kept pending:                [count]

  Patterns detected: [count]

    1. [Pattern type]: [brief description]
       Evidence: [count] items
       Proposal: [one-line summary]

    2. [Pattern type]: [brief description]
       Evidence: [count] items
       Proposal: [one-line summary]

  Awaiting approval for [count] proposals.
```

### User Approval Interaction

Use AskUserQuestion: "Which proposals should I implement? (all / none / list numbers, e.g. '1, 3'). You can also ask me to modify a proposal before deciding."

**Handle each response:**

| Response | Action |
|----------|--------|
| "all" | Implement all proposals |
| "none" | Skip all. Optionally ask why to capture reasoning as a new observation. |
| "1, 3" | Implement listed proposals only |
| "modify 2" | Ask what should change, revise proposal, re-present for approval |
| Question about a proposal | Answer, then re-ask for approval |

### On Approval: Implementation

For each approved proposal:

1. **Draft the actual changes** — write the literal new content, not descriptions of what to change
2. **Show before/after** for non-trivial changes
3. **Apply the changes** to the target files
4. **Log to ops/changelog.md** (create if missing):

```markdown
## YYYY-MM-DD: [change title]

**Source:** /rethink — [pattern type]
**Evidence:** [observation/tension filenames]
**Change:** [what was modified, which files]
**Risk:** [risk assessment from proposal]
```

5. **Update feeding observations/tensions:** Add `resolved_by: [changelog reference]` to each observation/tension that contributed to the approved proposal.

### On Rejection

- Do not re-propose the same change without new evidence
- Optionally ask why the proposal was rejected — capture the reasoning as a new observation if the user's rationale reveals something about the system's design philosophy
- Mark the proposal as "considered and deferred" — do not keep re-surfacing it

---

## Post-Rethink Actions

### Promoted Notes Need Connections

If any observations were promoted to insights:

```
  [count] insights were promoted from observations.
  Run /connect on promoted notes to find connections.
  Promoted: [list of note titles]
```

### Pipeline Queue Integration

If promoted items should enter the processing pipeline (queue-based systems):
- Add each promoted insight to the queue with `current_phase: "connect"` (the note already exists, so skip create)
- Report queue additions

### Session Log

After rethink completes, capture the session itself. Create or append to `ops/rethink-log.md`:

```markdown
## YYYY-MM-DD HH:MM

**Evidence reviewed:** [N] observations, [M] tensions
**Triage:** [count] promoted, [count] methodology, [count] implemented, [count] archived, [count] pending
**Patterns:** [count] detected
**Proposals:** [count] generated, [count] approved, [count] rejected, [count] deferred
**Changes applied:** [list of files modified]
```

This creates an evolution history. When /architect or /reseed runs, it can review the rethink log to understand how the system has evolved and what patterns have driven changes.

---

## Edge Cases

When any of these applies, read `references/edge-cases.md` and follow it: missing `ops/observations/` / `ops/tensions/` (report structural gap, do not run without evidence sources), nothing pending (clean-state report), 3+ drift signals (recommend /architect//reseed over patching), <5 total items (triage normally, note pattern detection needs more data), single-item triage (skip pattern detection), conflicting proposals (flag conflict, never implement both), 20+ item backlog (triage in batches of 10).

---

## Critical Constraints

**Never:**
- Auto-implement system changes — proposals require human approval, always
- Dismiss evidence because it is inconvenient
- Preserve assumptions out of tradition — evidence beats habit
- Add complexity to handle edge cases when simplification would work better
- Create insights directly from observations without going through standard pipeline (PROMOTE adds to queue)
- Re-propose rejected changes without new evidence

**Always:**
- Trace proposals to specific evidence with file references
- Acknowledge uncertainty — "I think" vs "it is" based on evidence strength
- Propose tests for new approaches — how will you know if the change worked?
- Respect that the human makes final decisions on system changes
- Log changes to ops/changelog.md for evolution tracking
- Update topic maps after triage changes status of observations/tensions

## The Meta-Layer

Rethink is the system's immune system. It detects when assumptions have become infections — beliefs that made sense once but now cause harm. Healthy systems challenge themselves. Unhealthy systems calcify around untested assumptions. The full methodology learning loop that closes here (work → friction → /remember → accumulation → /rethink → human-approved evolution): `../shared-references/methodology-loop.md`.

Run rethink. Let evidence win.
