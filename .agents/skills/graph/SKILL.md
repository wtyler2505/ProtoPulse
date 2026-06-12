---
name: graph
description: Interactive knowledge graph analysis. Routes natural language questions to graph scripts, interprets results in domain vocabulary, and suggests concrete actions. Triggers on "/graph", "/graph health", "/graph triangles", "find synthesis opportunities", "graph analysis".
version: "1.0"
generated_from: "arscontexta-v1.6"
user-invocable: true
context: fork
model: sonnet
allowed-tools: Read, Grep, Glob, Bash
argument-hint: "[operation] [target] — operations: health, triangles, bridges, clusters, hubs, siblings, forward, backward, query"
---

## Runtime Configuration (Step 0 — before any processing)

Read these files to configure domain-specific behavior:

1. **`ops/derivation-manifest.md`** — vocabulary mapping, platform hints
   - Use `vocabulary.knowledge` for the knowledge folder name
   - Use `vocabulary.note` / `vocabulary.note_plural` for note type references
   - Use `vocabulary.topic_map` / `vocabulary.topic_map_plural` for topic map references
   - Use `vocabulary.cmd_connect` for connection-finding command name
   - Use `vocabulary.cmd_revisit` for backward-pass command name

2. **`ops/config.yaml`** — for graph thresholds (topic map size limits, orphan thresholds)

If no derivation file exists, use universal terms (knowledge, topic maps, etc.).

---

## EXECUTE NOW

**Target: $ARGUMENTS**

Parse the operation from arguments:
- If arguments match a known operation: route to that operation
- If arguments are a natural language question: map to the closest operation (see Interactive Mode)
- If no arguments: enter interactive mode

**START NOW.** Route to the appropriate operation.

---

## Philosophy

**The graph IS the knowledge. This skill makes it visible.**

Individual {vocabulary.note_plural} are valuable, but their connections create compound value. /graph reveals the structural properties of those connections — where the graph is dense, where it is sparse, where it is fragile, and where synthesis opportunities hide.

Every operation produces two things: **findings** (what the analysis reveals) and **actions** (what to do about it). Never dump raw data. Always interpret results with {vocabulary.note} descriptions and domain context. Always suggest specific next steps.

---

## Operations

Nine operations. `/graph health` is the fast path and is fully specified below. The other eight follow the same collect → interpret → present pattern; their detailed steps, bash implementations, and output templates live in **references/operations.md** — read the relevant section there before executing.

| Operation | Purpose | Helper script (use if present) |
|-----------|---------|-------------------------------|
| `health` | Density, orphans, dangling links, coverage | `link-density.sh`, `orphan-notes.sh`, `dangling-links.sh` |
| `triangles` | Open triadic closures = synthesis opportunities | `find-triangles.sh` |
| `bridges` | Structurally critical {vocabulary.note_plural} whose removal disconnects regions | `find-bridges.sh` |
| `clusters` | Connected components and topic boundaries | `find-clusters.sh` |
| `hubs` | Authorities (most-linked-to), hubs (most-linking-from), synthesizers (both) | `influence-flow.sh` |
| `siblings [[topic]]` | Unconnected {vocabulary.note_plural} sharing a {vocabulary.topic_map} | `topic-siblings.sh` |
| `forward [[note]] [depth]` | N-hop forward traversal (default depth 2) | `n-hop-forward.sh` |
| `backward [[note]] [depth]` | N-hop backward traversal (default depth 2) | `recursive-backlinks.sh` |
| `query [field] [value]` | Schema-level YAML query (topics, type, methodology, status, created, source) | — (ripgrep) |

All helper scripts live in `ops/scripts/graph/`. Deep guidance: references/operations.md

### /graph health (fast path)

Full graph health report: density, orphans, dangling links, coverage.

**Step 1: Collect raw metrics**

```bash
# Count total notes (excluding topic maps)
NOTES_DIR="{vocabulary.knowledge}"
TOTAL=$(ls -1 "$NOTES_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
MOC_COUNT=$(grep -rl '^type: moc' "$NOTES_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
NOTE_COUNT=$((TOTAL - MOC_COUNT))

# Count all wiki links
LINK_COUNT=$(grep -ohP '\[\[[^\]]+\]\]' "$NOTES_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')

# Calculate link density
# Density = actual_links / possible_links
# possible_links = N * (N - 1) for directed graph
echo "Density: $LINK_COUNT / ($NOTE_COUNT * ($NOTE_COUNT - 1))"

# Find orphan notes (zero incoming links)
for f in "$NOTES_DIR"/*.md; do
  NAME=$(basename "$f" .md)
  INCOMING=$(grep -rl "\[\[$NAME\]\]" "$NOTES_DIR"/ 2>/dev/null | grep -v "$f" | wc -l | tr -d ' ')
  [[ "$INCOMING" -eq 0 ]] && echo "ORPHAN: $NAME"
done

# Find dangling links (links to non-existent files)
grep -ohP '\[\[([^\]]+)\]\]' "$NOTES_DIR"/*.md 2>/dev/null | sort -u | while read -r link; do
  NAME=$(echo "$link" | sed 's/\[\[//;s/\]\]//')
  [[ ! -f "$NOTES_DIR/$NAME.md" ]] && echo "DANGLING: $NAME"
done

# Topic map coverage: % of notes appearing in at least one topic map's Core Ideas
COVERED=0
for f in "$NOTES_DIR"/*.md; do
  NAME=$(basename "$f" .md)
  # Skip topic maps themselves
  grep -q '^type: moc' "$f" 2>/dev/null && continue
  # Check if any topic map links to this note
  if grep -rl '^type: moc' "$NOTES_DIR"/*.md 2>/dev/null | xargs grep -l "\[\[$NAME\]\]" >/dev/null 2>&1; then
    COVERED=$((COVERED + 1))
  fi
done
echo "Coverage: $COVERED / $NOTE_COUNT"
```

If graph helper scripts exist in `ops/scripts/graph/`, use them instead of inline analysis:
- `ops/scripts/graph/link-density.sh` for density metrics
- `ops/scripts/graph/orphan-notes.sh` for orphan detection
- `ops/scripts/graph/dangling-links.sh` for dangling link detection

**Step 2: Interpret and present**

```
--=={ graph health }==--

  {vocabulary.note_plural}: [N] (plus [M] {vocabulary.topic_map_plural})
  Connections: [N] (avg [X] per {vocabulary.note})
  Graph density: [0.XX]
  {vocabulary.topic_map} coverage: [N]% of {vocabulary.note_plural} appear in at least one {vocabulary.topic_map}

  Orphans ([N]):
    - [[orphan name]] — [description from YAML]
    → Suggestion: Run /{vocabulary.cmd_connect} to find connections

  Dangling Links ([N]):
    - [[missing name]] — referenced from [[source note]]
    → Suggestion: Create the {vocabulary.note} or remove the link

  {vocabulary.topic_map} Sizes:
    - [[moc name]]: [N] {vocabulary.note_plural} [OK | WARN: approaching split threshold | WARN: consider merging]

  Overall: [HEALTHY | NEEDS ATTENTION | FRAGMENTED]
```

**Density benchmarks:**

| Density | Interpretation |
|---------|---------------|
| < 0.02 | Sparse — {vocabulary.note_plural} exist but connections are thin |
| 0.02-0.06 | Healthy — growing network with meaningful connections |
| 0.06-0.15 | Dense — well-connected, watch for over-linking |
| > 0.15 | Very dense — verify connections are genuine, not noise |

---

## Interactive Mode

If no arguments provided:

1. Ask: "What would you like to know about your knowledge graph?"
2. Map natural language to operation:

| User Says | Maps To | Why |
|-----------|---------|-----|
| "Where should I look for connections?" | triangles | Finding synthesis opportunities |
| "What are my most important notes?" | hubs | Authority/hub ranking |
| "Are there isolated areas?" | clusters | Connected component detection |
| "How healthy is my graph?" | health | Full health report |
| "What bridges my topics?" | bridges | Bridge note identification |
| "What connects to [[X]]?" | backward [[X]] | Backward traversal |
| "Where does [[X]] lead?" | forward [[X]] | Forward traversal |
| "Show me notes about [topic]" | query topics [[topic]] | Schema query |
| "What needs connecting in [topic]?" | siblings [[topic]] | Unconnected sibling pairs |

3. Run the mapped operation (detailed steps: references/operations.md)
4. After presenting results, offer follow-up: "Want to explore any of these further?"

---

## Output Rules

- **Never dump raw data.** Always interpret results with {vocabulary.note} descriptions and context.
- **Always suggest actions.** "Run /{vocabulary.cmd_connect} on these pairs" or "Consider adding a bridge {vocabulary.note} about X."
- **Use domain vocabulary** for all labels and descriptions — {vocabulary.note}, {vocabulary.topic_map}, etc.
- **For large result sets,** summarize top findings (max 10) and offer to show more: "[N] more results. Show all? (yes/no)"
- **Include density benchmarks** for context — "your density of 0.04 is in the healthy range."
- **Distinguish structural from semantic.** Graph analysis reveals structural properties. Semantic judgment about WHETHER connections should exist requires /{vocabulary.cmd_connect}.

---

## Edge Cases

### Small Vault (<10 notes)

Report metrics but contextualize: "With [N] {vocabulary.note_plural}, graph analysis provides limited insight. Graph operations become more valuable as the knowledge graph grows. Current metrics are baseline measurements."

All operations still run — they just produce less data.

### No Graph Scripts Available

If `ops/scripts/graph/` does not exist or individual scripts are missing, implement the analysis inline using grep, file reads, and bash loops as shown in references/operations.md (and the health steps above). The inline implementations are complete — scripts are optimization, not requirements.

### No ops/derivation-manifest.md

Use universal vocabulary (knowledge, topic maps, etc.). All operations work identically.

### Empty Knowledge Directory

Report: "No {vocabulary.note_plural} found in {vocabulary.knowledge}/. Start by capturing content to build your knowledge graph."

### Note Not Found (for forward/backward/siblings)

If the specified {vocabulary.note} or {vocabulary.topic_map} does not exist:
1. Search for partial matches: `ls "$NOTES_DIR"/*{query}*.md 2>/dev/null`
2. If matches found: "Did you mean: [[match1]], [[match2]]?"
3. If no matches: "{vocabulary.note} '[[name]]' not found. Check the name and try again."
