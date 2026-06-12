# Dual Discovery, Index Freshness, and qmd Fallback (Shared Reference)

> Shared by `/connect` and `/revisit`. Extracted 2026-06-11 from the connect skill during the progressive-disclosure restructure (docs/audits/2026-06-11-skill-audit.md Top-10 item 10). Vocabulary placeholders (`{vocabulary.*}`) resolve per the invoking skill's runtime configuration. The qmd three-tier fallback and lock-dir serialization here are the canonical copies — do not fork them back into individual skills.

## Phase 0: Verify Index Freshness

Before using semantic search, verify the index is current. This is self-healing: if {vocabulary.note_plural} were created outside the pipeline (manual edits, other skills), connect catches the drift before searching.

1. Try `mcp__qmd__qmd_status` to get the indexed document count for the target collection
2. **If MCP unavailable** (tool fails or returns error): fall back to bash:
   ```bash
   LOCKDIR="ops/queue/.locks/qmd.lock"
   while ! mkdir "$LOCKDIR" 2>/dev/null; do sleep 2; done
   qmd_count=$(qmd status 2>/dev/null | grep -A2 'protopulse-vault' | grep 'documents' | grep -oE '[0-9]+' | head -1)
   rm -rf "$LOCKDIR"
   ```
3. Count actual files:
   ```bash
   file_count=$(ls -1 {vocabulary.knowledge}/*.md 2>/dev/null | wc -l | tr -d ' ')
   ```
4. If the counts differ, sync the index:
   ```bash
   qmd update && qmd embed
   ```

Run this check before proceeding. If stale, sync and continue. If current, proceed immediately.

## Phase 2: Discovery (Find Candidates)

Use dual discovery: {vocabulary.topic_map} exploration AND semantic search in parallel. These are complementary, not sequential.

**Capture discovery trace as you go.** Note which {vocabulary.topic_map_plural} you read, which queries you ran (with scores), which searches you tried. This becomes the Discovery Trace section in output — proving methodology was followed, not reconstructed after the fact.

**Primary discovery (run in parallel):**

**Path 1: {vocabulary.topic_map} Exploration** — curated navigation

If you know the topic (check the {vocabulary.note}'s Topics footer), start with the {vocabulary.topic_map}:

- Read the relevant {vocabulary.topic_map}(s)
- Follow curated links in Core Ideas — these are human/agent-curated connections
- Note what is already connected to similar concepts
- Check Tensions and Gaps for context
- What do agent notes reveal about navigation?

{vocabulary.topic_map_plural} tell you what thinking exists and how it is organized. Someone already decided what matters for this topic.

**Path 2: Semantic Search** — find what {vocabulary.topic_map_plural} might miss

**Three-tier fallback for semantic search:**

**Tier 1 — MCP tools (preferred):** Use `mcp__qmd__qmd_deep_search` (hybrid search with expansion + reranking):
- query: "[{vocabulary.note}'s core concepts and mechanisms]"
- limit: 15

**Tier 2 — bash qmd with lock serialization:** If MCP tools fail or are unavailable:
```bash
LOCKDIR="ops/queue/.locks/qmd.lock"
while ! mkdir "$LOCKDIR" 2>/dev/null; do sleep 2; done
qmd query "[note's core concepts]" --collection protopulse-vault --limit 15 2>/dev/null
rm -rf "$LOCKDIR"
```

The lock prevents multiple parallel workers from loading large models simultaneously.

**Tier 3 — grep only:** If both MCP and bash fail, log "qmd unavailable, grep-only discovery" and rely on {vocabulary.topic_map} + keyword search only. This degrades quality but does not block work.

Evaluate results by relevance — read any result where title or snippet suggests genuine connection. Semantic search finds {vocabulary.note_plural} that share MEANING even when vocabulary differs. A {vocabulary.note} about "iteration cycles" might connect to "learning from friction" despite sharing no words.

**Why both paths:**

{vocabulary.topic_map} = what is already curated as relevant
semantic search = neighbors that have not been curated yet

Using only search misses curated structure. Using only {vocabulary.topic_map} misses semantic neighbors outside the topic. Both together catch what either alone would miss.

**Secondary discovery (after primary):**

**Step 3: Keyword Search**

For specific terms and exact matches:
```bash
grep -r "term" {vocabulary.knowledge}/ --include="*.md"
```

Use grep when:
- You know the exact words that should appear
- Searching for specific terminology or phrases
- Finding all uses of a named concept
- The vocabulary is stable and predictable

**Choosing between semantic and keyword:**

| Situation | Better Tool | Why |
|-----------|-------------|-----|
| Exploring unfamiliar territory | semantic | vocabulary might not match meaning |
| Finding synonyms or related framings | semantic | same concept, different words |
| Known terminology | keyword | exact match, no ambiguity |
| Verifying coverage | keyword | ensures nothing missed |
| Cross-domain connections | semantic | concepts bridge domains, words do not |
| Specific phrase lookup | keyword | faster, more precise |

**Step 4: Description Scan**

Use ripgrep to scan {vocabulary.note} descriptions for edge cases:
- Does this extend the source {vocabulary.note}?
- Does this contradict or create tension?
- Does this provide evidence or examples?

Flag candidates with a reason (not just "related").

**Step 5: Link Following**

From promising candidates, follow their existing links:
- What do THEY connect to?
- Are there clusters of related {vocabulary.note_plural}?
- Do chains emerge that your source {vocabulary.note} should join?

This is graph traversal. You are exploring the neighborhood.
