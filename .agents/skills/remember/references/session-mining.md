# Session Mining Mode (Reference for /remember --mine-sessions)

> Read when target contains `--mine-sessions` or `--mine`. This is the full mining workflow. Note creation follows the same process as explicit mode in SKILL.md, with `source: session-mining`.

This mode scans stored session transcripts for friction patterns the user addressed during work but did not explicitly `/remember`.

### Step 1: Find Unmined Sessions

```bash
# Find session files without mined: true marker
UNMINED=$(grep -rL '^mined: true' ops/sessions/*.md 2>/dev/null)
UNMINED_COUNT=$(echo "$UNMINED" | grep -c . 2>/dev/null || echo 0)
```

If no unmined sessions found:
```
--=={ remember — mine }==--

  No unprocessed sessions found in ops/sessions/.
  All sessions have been mined for friction patterns.
```

### Step 2: Mine Each Session

For each unmined session, read the full content and search for:

| Pattern | What to Look For | Significance |
|---------|-----------------|-------------|
| User corrections | "no", "that's wrong", "not like that" followed by correct approach | Direct methodology learning |
| Repeated redirections | Same type of correction appearing multiple times | Strong behavioral signal |
| Workflow breakdowns | Steps that failed, had to be retried, or produced wrong output | Process gap |
| Agent confusion | Questions the agent asked that it should have known the answer to | Missing context or methodology |
| Undocumented decisions | User made a choice without explaining reasoning — but the choice reveals a preference | Implicit methodology |
| Escalation patterns | User moving from gentle correction to firm direction | Methodology note urgency signal |

### Step 3: Classify Findings

For each detected pattern, classify into one of two output types:

| Finding Type | Output | When |
|-------------|--------|------|
| Actionable methodology learning | Methodology note in `ops/methodology/` | Clear behavioral change needed. Agent can act on this. |
| Novel observation requiring more context | Observation note in `ops/observations/` | Pattern detected but not yet clear enough for methodology guidance. Needs accumulation. |

### Step 4: Deduplicate Against Existing Notes

Before creating any notes:

1. Read all existing methodology notes in `ops/methodology/`
2. Read all existing observations in `ops/observations/`
3. For each finding:
   - If an existing methodology note covers this → skip or add as evidence to existing
   - If an existing observation covers this → skip or add as evidence to existing
   - If novel → create new note

### Step 5: Create Notes

**For methodology findings:** Follow the same creation process as explicit mode (Step 3 in Explicit Mode section of SKILL.md), with `source: session-mining` and add `session_source: [session filename]`.

**For observation findings:**

```markdown
---
description: [what was observed and what it suggests]
category: [friction | surprise | process-gap | methodology]
status: pending
observed: YYYY-MM-DD
source: session-mining
session_source: [session filename]
---

# [the observation as a sentence]

[What happened, which session, why it matters, and what pattern it might be part of.]

---

Related: [[observations]]
```

### Step 6: Mark Sessions as Mined

After processing each session, add `mined: true` to its frontmatter:

```bash
# Add mined marker to session file frontmatter
```

Use Edit tool to add `mined: true` after the existing frontmatter fields. Do not modify other frontmatter content.

### Step 7: Report

```
--=={ remember — mine }==--

  Sessions scanned: [N]

  Methodology notes created: [count]
    - [filename] — [brief description]

  Observations created: [count]
    - [filename] — [brief description]

  Duplicates skipped: [count]
    - [existing note] — already covers [pattern]

  Sessions marked as mined: [list]

  [If pattern thresholds reached:]
  Category "[category]" now has [N] methodology notes.
  Consider running /rethink to review [category] patterns.
```
