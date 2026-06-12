# Enrichment-Triggered Actions — Execution Detail

When processing a {vocabulary.note} that came through the enrichment pipeline, check the task file for `post_enrich_action` signals. These were surfaced by /enrich and need execution during revisit.

## title-sharpen

The enrich phase determined the {vocabulary.note}'s title is too vague after content integration.

1. Read `post_enrich_detail` for the recommended new title
2. Evaluate: is the suggested title actually better? (sharper claim, more specific, still composable as prose)
3. If yes, rename manually and update all wiki links:
   ```bash
   git mv "knowledge/old title.md" "knowledge/new title.md"
   rg -lF '[[old title]]' knowledge/ | xargs -r sed -i 's/\[\[old title\]\]/[[new title]]/g'
   ```
4. Update the {vocabulary.note}'s description to match the new title
5. Log the rename in the task file Revisit section

## split-recommended

The enrich phase determined the {vocabulary.note} now covers multiple distinct claims.

1. Read `post_enrich_detail` for the split recommendation
2. Evaluate: does splitting genuinely improve the vault? (each piece must stand alone)
3. If yes:
   - Create new {vocabulary.note} files for each split claim
   - Move relevant content from original to splits
   - Update original to either link to splits or retain one claim
   - Create queue entries for the new {vocabulary.note_plural} starting at the connect phase
4. Log the split in the task file Revisit section

## merge-candidate

The enrich phase determined this {vocabulary.note} substantially overlaps with another.

**Do NOT auto-merge or auto-delete.** This requires human judgment.

1. Log the merge recommendation in the task file Revisit section
2. Note which {vocabulary.note_plural} overlap and why
3. The final report surfaces this for human review
