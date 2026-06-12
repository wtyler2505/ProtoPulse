---
name: remember
description: Capture friction as methodology notes. Three modes — explicit description, contextual (review recent corrections), session mining (scan transcripts for patterns). Triggers on "/remember", "/remember [description]".
version: "1.0"
generated_from: "arscontexta-v1.6"
user-invocable: true
context: fork
model: sonnet
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

## Runtime Configuration (Step 0 — before any processing)

Read these files to configure domain-specific behavior:

1. **`ops/derivation-manifest.md`** — vocabulary mapping, domain context
   - Use `vocabulary.notes` for the notes folder name
   - Use `vocabulary.note` for the note type name in output
   - Use `vocabulary.rethink` for rethink command name in threshold alerts
   - Use `vocabulary.topic_map` for MOC references

2. **`ops/config.yaml`** — thresholds
   - `self_evolution.observation_threshold` (default: 10) — for threshold alerts
   - `self_evolution.tension_threshold` (default: 5) — for threshold alerts

3. **`ops/methodology/`** — read existing methodology notes before creating new ones (prevents duplicates)

If these files don't exist (pre-init invocation or standalone use), use universal defaults.

## EXECUTE NOW

**Target: $ARGUMENTS**

Parse immediately:
- If target contains a quoted description or unquoted text: **explicit mode** — user describes friction directly
- If target is empty: **contextual mode** — review recent conversation for corrections
- If target contains `--mine-sessions` or `--mine`: **session mining mode** — read `references/session-mining.md` and follow it

**START NOW.** Reference below defines the modes.

### Reference Files (progressive disclosure — read on demand)

| File | Read when |
|------|-----------|
| `references/session-mining.md` | Target contains `--mine-sessions` / `--mine` — full 7-step mining workflow (find unmined sessions, mine six pattern types, classify, deduplicate, create notes, mark `mined: true`, report) |
| `references/note-design-and-edge-cases.md` | Before creating ANY methodology note (title pattern, body quality, category selection) and when hitting edge cases (missing ops/methodology/, duplicate friction, contradicting methodology, no sessions, very long sessions, implicit corrections, empty context) |
| `../shared-references/methodology-loop.md` | For the full methodology learning loop + Rule Zero (the spec model this skill writes into) |

---

## Explicit Mode

User provides a description: `/remember "don't process personal notes like research"` or `/remember always check for duplicates before creating`

### Step 1: Parse the Friction

Analyze the user's description to extract:
- **What the agent did wrong** (or what the user wants to prevent)
- **What the user wants instead** (the correct behavior)
- **The scope** — when does this apply? Always? Only for specific content types? Only in certain phases?
- **The category** — which area of agent behavior does this affect?

| Category | Applies When |
|----------|-------------|
| processing | How to extract, reduce, or handle content |
| capture | How to record, file, or organize incoming material |
| connection | How to find, evaluate, or add links between notes |
| maintenance | How to handle health checks, reweaving, cleanup |
| voice | How to write, what tone or style to use |
| behavior | General agent conduct, interaction patterns |
| quality | Standards for notes, descriptions, titles |

### Step 2: Check for Existing Methodology Notes

Before creating a new note, read all files in `ops/methodology/`:

```bash
ls -1 ops/methodology/*.md 2>/dev/null
```

For each existing note, check if it covers the same behavioral area. Specifically:
- Does an existing note address the same friction?
- Would the new learning extend an existing note rather than warrant a new one?

| Check Result | Action |
|-------------|--------|
| No existing notes in this area | Create new methodology note |
| Existing note covers different aspect of same area | Create new note, link to existing |
| Existing note covers same friction | Extend existing note with new evidence instead of creating duplicate |
| Existing note contradicts new friction | Create both a new methodology note AND an observation about the contradiction |

### Step 3: Create Methodology Note

Write to `ops/methodology/`:

**Rule Zero:** This methodology note becomes part of the system's canonical specification. ops/methodology/ is not a log of what happened — it is the authoritative declaration of how the system should behave. Write this note as a directive: what the agent SHOULD do, not what went wrong. Future sessions, /rethink drift checks, and meta-skills will consult this note as ground truth for system behavior. (Full Rule Zero + loop: `../shared-references/methodology-loop.md`.)

**Before writing:** read `references/note-design-and-edge-cases.md` — title pattern (describe the DO, not the problem), body quality rules, category selection.

**Filename:** Convert the prose title to kebab-case. Example: "don't process personal notes like research" becomes `dont-process-personal-notes-like-research.md`.

```markdown
---
description: [what this methodology note teaches — specific enough to be actionable]
type: methodology
category: [processing | capture | connection | maintenance | voice | behavior | quality]
source: explicit
created: YYYY-MM-DD
status: active
---

# [prose-as-title describing the learned behavior]

## What to Do

[Clear, specific guidance. Not "be careful" but "when encountering X, do Y instead of Z."]

## What to Avoid

[The specific anti-pattern this note prevents. What was the agent doing wrong?]

## Why This Matters

[What goes wrong without this guidance. Connect to the user's actual friction — what broke, what was confusing, what wasted time.]

## Scope

[When does this apply? Always? Only for certain content types? Only during specific phases? Be explicit about boundaries.]

---

Related: [[methodology]]
```

**Writing quality for methodology notes:**
- Be specific enough that a fresh agent session could follow this guidance without additional context
- Use concrete examples where possible — "when processing therapy notes" not "when processing certain types of content"
- State both the DO and the DON'T — methodology notes that only say what to do miss the anti-pattern that triggered them
- Keep scope explicit — unbounded methodology notes get applied where they should not be

### Step 4: Update Methodology MOC

Edit `ops/methodology.md` (create if missing — template in `references/note-design-and-edge-cases.md` §No ops/methodology/ Directory):

1. Find the section for the note's category
2. Add the note with a context phrase: `- [[note title]] — [what this teaches]`
3. If no section exists for this category, create one

```markdown
## [Category]

- [[existing note]] — what it teaches
- [[new note]] — what this teaches
```

### Step 5: Check Pattern Threshold

Count methodology notes in the same category:

```bash
grep -rl "^category: [CATEGORY]" ops/methodology/ 2>/dev/null | wc -l | tr -d ' '
```

If 3+ notes exist in the same category, this is a signal for /rethink:

```
This is friction capture #[N] in the "[category]" area.
3+ captures in the same area suggest a systemic pattern.
Consider running /rethink to review [category] methodology patterns
and potentially elevate them to context file changes.
```

### Step 6: Output

```
--=={ remember }==--

  Captured: [brief description of the learning]
  Filed to: ops/methodology/[filename].md
  Updated: ops/methodology.md MOC
  Category: [category]

  [If pattern threshold reached:]
  This is friction capture #[N] in the "[category]" area.
  Consider running /rethink to review [category] methodology patterns.
```

---

## Contextual Mode

No argument provided: `/remember`

The agent reviews the current conversation to find corrections the user made that should become methodology notes.

### Step 1: Review Recent Context

Scan the current conversation for correction signals. Look for:

| Signal Type | Detection Patterns | Example |
|------------|-------------------|---------|
| Direct correction | "no", "that's wrong", "not like that", "incorrect" | "No, don't split that into separate notes" |
| Redirection | "actually", "instead", "let's do X not Y", "stop" | "Actually, keep the original phrasing" |
| Preference statement | "I prefer", "always do X", "never do Y", "from now on" | "Always check for duplicates first" |
| Frustration signal | "again?", "I already said", "why did you", "that's the third time" | "Why did you create a duplicate again?" |
| Quality correction | "too vague", "not specific enough", "that's not what I meant" | "That description is too vague — add the mechanism" |

### Step 2: Identify the Most Recent Correction

From the detected corrections, identify the most recent one. Present it to the user for confirmation:

```
--=={ remember — contextual }==--

  Detected correction:
    "[quoted user text]"

  Interpreted as:
    [What the agent should learn from this — specific behavioral change]

  Category: [category]

  Capture this as a methodology note? (yes / no / modify)
```

**Wait for user confirmation.** Do not create notes from inferred corrections without approval — the agent might misinterpret what the user meant.

### Step 3: Handle Response

| Response | Action |
|----------|--------|
| "yes" | Create methodology note (same process as explicit mode, `source: contextual`) |
| "no" | Do not create. Optionally ask what the user actually meant. |
| "modify" or different description | Use the modified description instead |
| User provides additional context | Incorporate into the methodology note |

### Step 4: If Multiple Corrections Detected

If the conversation contains more than one correction:

```
  Detected [N] corrections in this conversation:

  1. "[quoted text]" → [interpretation]
  2. "[quoted text]" → [interpretation]
  3. "[quoted text]" → [interpretation]

  Capture all as methodology notes? (all / select numbers / none)
```

### Step 5: If No Corrections Found

```
--=={ remember — contextual }==--

  No recent corrections detected in this conversation.

  Options:
  - /remember "description" — capture specific friction with explicit text
  - /remember --mine-sessions — scan session transcripts for uncaptured patterns
```

---

## Session Mining Mode

Flag provided: `/remember --mine-sessions` or `/remember --mine`

This mode scans stored session transcripts for friction patterns the user addressed during work but did not explicitly `/remember`.

**Full workflow (MANDATORY read):** `references/session-mining.md` — find unmined sessions (`grep -rL '^mined: true' ops/sessions/*.md`), mine each for six pattern types (corrections, repeated redirections, workflow breakdowns, agent confusion, undocumented decisions, escalation), classify findings (methodology note vs observation), deduplicate against existing notes, create notes (`source: session-mining` + `session_source`), mark sessions `mined: true`, then report.

---

## The Methodology Learning Loop

/remember is the capture layer of the methodology learning loop: work happens → corrections get captured as methodology notes → agents read them at session start → behavior improves → 3+ notes in a category trigger /rethink elevation to context-file changes. **Rule Zero:** ops/methodology/ is the system's canonical specification — write directives, not incident reports; /remember writes the spec, /rethink enforces it.

**Full loop diagram, layer responsibilities, health signals, and Rule Zero details:** `../shared-references/methodology-loop.md`.

---

## Methodology Note Design and Edge Cases

Title pattern (describe the DO, not the problem), body quality rules, category selection, and all edge-case handling (missing ops/methodology/ → create dir + MOC, duplicate friction → extend with evidence, contradiction → supersede + observation, no sessions to mine, very long sessions → 500-line chunks, implicit corrections → lower confidence + confirm, empty conversation context): `references/note-design-and-edge-cases.md` — read before creating any note and whenever an edge case applies.
