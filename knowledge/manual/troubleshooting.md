---
summary: Common issues and resolution patterns
type: manual
generated_from: "arscontexta-1.0.0"
---

# Troubleshooting

## Orphan Insights

**Symptom:** Insights with no incoming wiki links — disconnected from the graph.
**Cause:** Created without running /connect, or topic maps not updated.
**Fix:** Run `/arscontexta:reflect` or `bash knowledge/ops/queries/orphan-insights.sh` to find them, then add connections.

## Dangling Links

**Symptom:** Wiki links pointing to non-existent insights.
**Cause:** Insight renamed or deleted without updating references.
**Fix:** Search for `[[broken-name]]` across insights and fix or remove.

## Stale Content

**Symptom:** Insights not updated in 30+ days with sparse connections.
**Cause:** Code changed but related insights weren't revisited.
**Fix:** Run `/arscontexta:reweave` on stale insights. Mark outdated ones with `confidence: outdated`.

## Captures Overflow

**Symptom:** 20+ items accumulating in `captures/`.
**Cause:** Capturing faster than processing.
**Fix:** Process captures through the pipeline. Run `/arscontexta:reduce` on pending captures.

## Pipeline Stalls

**Symptom:** Tasks stuck in the queue.
**Cause:** Pipeline chaining set to manual and tasks not picked up.
**Fix:** Check `ops/queue/queue.json`. Run `/arscontexta:next` for recommendations.

## Common Mistakes

| Mistake | Correction |
|---------|-----------|
| Writing directly to insights/ | Route through captures/ first |
| Title as label ("storage layer") | Title as claim ("storage uses LRU eviction with prefix invalidation") |
| Missing Areas footer | Every insight needs at least one topic map link |
| Summary restates title | Summary adds information beyond the title |
| Not updating confidence on code changes | Run /revisit when related code changes |
