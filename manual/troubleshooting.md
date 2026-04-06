---
type: manual
generated_from: "arscontexta-1.0.0"
---

# Troubleshooting

When things go sideways in the ProtoPulse knowledge vault.

## Schema Validation Failures

**Symptom**: `VALIDATION WARNING: missing required field` after writing a note.

**Cause**: The validate-note hook checks that knowledge notes have required frontmatter fields (description, type, topics).

**Fix**: Open the note and add the missing fields. Use the knowledge-note template as reference. Every note needs at minimum:
```yaml
description: "One sentence of context"
type: claim  # or decision, concept, insight, pattern, debt-note, need
topics: [["relevant-topic-map"]]
```

**Prevention**: Start from the template. If you're creating notes manually, copy `templates/knowledge-note.md` first.

## Orphaned Notes

**Symptom**: `/arscontexta:health` reports orphans. Notes exist with zero incoming links.

**Cause**: Notes were created but never connected to topic maps or other notes.

**Fix**: Run `/connect` to surface relationships. For each orphan, ask:
1. Does this note belong in a topic map? Add it.
2. Does it relate to any existing notes? Add `Relevant Notes` links.
3. Is it actually valuable? If not, consider archiving it.

**Prevention**: Always add at least one topic map link and one relevant note link when creating a note.

## Hook Errors

### "No vault marker found"
Hooks silently exit. Check that `.arscontexta` exists at the project root.

### validate-note not firing
The hook only triggers on `Write` tool calls to files matching `knowledge/*.md` or `inbox/*.md`. Direct file system writes (via shell) bypass it.

### auto-commit failing
Check `git status` -- if there are merge conflicts or the working tree is in a bad state, auto-commit will silently fail. The hook uses `--no-verify` to skip pre-commit hooks and avoid recursive triggers.

### session-orient showing wrong counts
The hook counts files with `find`. If notes are in unexpected subdirectories or use non-.md extensions, they won't be counted. Check that all notes follow the flat structure in `knowledge/`.

## Broken Wiki Links

**Symptom**: `[[note-name]]` links point to files that don't exist.

**Cause**: Notes were renamed, moved, or deleted without updating incoming links.

**Fix**: Run `/graph "broken links"` to find all broken references. For each one:
1. Was the target renamed? Update the link to the new name.
2. Was the target deleted? Remove the link or create the missing note if it should exist.
3. Was it a typo? Fix the link text.

**Prevention**: When renaming a note, search for all `[[old-name]]` references and update them.

## Inbox Overflow

**Symptom**: session-orient warns about captures overflow (>20 items in inbox).

**Cause**: Raw sources are being captured faster than they're being extracted.

**Fix**:
1. Triage: scan inbox items and prioritize by relevance to current work.
2. Batch process: `/ralph 5` to process the most valuable items.
3. Defer: move low-priority captures to `archive/` with a note that they weren't fully processed.

**Prevention**: Process captures regularly. The daily rhythm (see [[workflows]]) prevents accumulation.

## Stale Notes

**Symptom**: Health check flags notes with `confidence: experimental` that haven't been updated in >30 days.

**Cause**: Experimental claims were captured but never verified through implementation or testing.

**Fix**: For each stale note:
1. Has it been proven by implementation? Update to `confidence: proven`.
2. Has it been disproven? Mark `confidence: outdated` and add `superseded_by`.
3. Is it still uncertain? Add a note about what would resolve it and set a reminder.

## Git Conflicts in Vault Files

**Symptom**: Auto-commit fails, git status shows conflicts in knowledge/ files.

**Cause**: Multiple sessions or manual edits created conflicting changes to the same note.

**Fix**:
1. `git status` to see conflicted files.
2. Resolve conflicts manually -- knowledge notes should have clear "correct" versions since each captures a specific claim.
3. `git add` the resolved files and commit.

**Prevention**: The vault uses atomic notes (one idea per file), which minimizes conflicts. If you're seeing frequent conflicts, check whether two processes are editing the same files.

---

Topics:
- [[manual]]
