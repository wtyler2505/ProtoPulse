# Methodology Note Design and Edge Cases (Reference for /remember)

> Read before creating any methodology note (design rules) and whenever an edge case applies (second half). The note template itself and the methodology learning loop live in SKILL.md and `../../shared-references/methodology-loop.md`.

## Methodology Note Design

### Title Pattern

Methodology note titles should describe what the agent should DO, not what went wrong:

| Bad (describes problem) | Good (describes behavior) |
|------------------------|--------------------------|
| "duplicate creation issue" | "check for semantic duplicates before creating any note" |
| "wrong tone problem" | "match the user's formality level in all output" |
| "processing too aggressive" | "differentiate personal notes from research in processing depth" |

The title is what the agent reads at session start. It should be immediately actionable as a behavioral directive.

### Body Quality

Methodology notes are operational guidance, not essays. They should be:

1. **Specific enough for a fresh agent session** — no assumed context from the session that created them
2. **Scoped explicitly** — when does this apply and when does it not?
3. **Dual-sided** — both what to do AND what to avoid
4. **Evidence-grounded** — reference the specific friction that triggered this learning

### Category Selection

Choose the most specific applicable category:

| Category | Use When |
|----------|---------|
| processing | Friction during /extract, extraction, claim creation |
| capture | Friction during inbox filing, raw material handling |
| connection | Friction during /connect, link evaluation, MOC updates |
| maintenance | Friction during /revisit, health checks, cleanup |
| voice | Friction about writing style, tone, output formatting |
| behavior | Friction about general agent conduct, interaction patterns, tool usage |
| quality | Friction about note quality, description writing, title crafting |

If a friction point spans categories (e.g., "processing voice" or "capture quality"), choose the primary category and mention the secondary in the body.

---

## Edge Cases

### No ops/methodology/ Directory

Create it and the `ops/methodology.md` MOC:

```markdown
---
description: Methodology notes capturing how this system has learned to operate
type: moc
---

# methodology

Methodology notes organized by category. Each note captures a specific behavioral learning.

## Processing

## Capture

## Connection

## Maintenance

## Voice

## Behavior

## Quality
```

### Duplicate Friction

If a methodology note with very similar content already exists:
1. Do NOT create a duplicate
2. Link to the existing note
3. Add the new instance as evidence: update the existing note's body with the new context
4. Report: "Extended existing methodology note [[title]] with additional evidence"

### Contradicting Existing Methodology

If the new friction CONTRADICTS an existing methodology note (user now wants the opposite of what was previously captured):
1. Create an observation in `ops/observations/` documenting the contradiction
2. Update the existing methodology note's status to `superseded` and add `superseded_by: [new note]`
3. Create the new methodology note with the updated guidance
4. Report the contradiction and suggest /rethink if this is part of a broader pattern

### No Sessions to Mine

Report clearly: "No unprocessed sessions found in ops/sessions/." Do not treat this as an error.

### Very Long Sessions

For sessions longer than 2000 lines:
1. Process in chunks of ~500 lines
2. Track findings across chunks to detect patterns that span the session
3. Report chunk-level progress for transparency

### Implicit vs Explicit Corrections

Some corrections are implicit — the user does it themselves rather than telling the agent to change:
- User manually edits a note the agent created (the edit reveals what was wrong)
- User chooses a different approach without explaining why
- User skips a step the agent suggested

In contextual mode, flag these as lower-confidence findings and always confirm before creating methodology notes from implicit signals.

### Empty Conversation Context

In contextual mode with no conversation history (e.g., first message of a session):

```
--=={ remember — contextual }==--

  No conversation context available to analyze.
  Use /remember "description" to capture specific friction directly.
```
