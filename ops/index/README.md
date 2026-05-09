# `ops/index/` — Cross-system reference indexes

This directory holds JSON indexes that map between the project's various knowledge surfaces (vault, plans, code, NotebookLM corpus). All files here are operational state — generated/maintained by skills and scripts, not hand-edited.

## Files

### `plan-vault-backlinks.json`
Bidirectional plan ↔ vault ↔ code backlink index. Maintained by the `vault-index` skill.

Schema:
```json
{
  "plans": {
    "<plan-path>": {
      "vault_slugs": ["<slug>", ...],
      "code_paths": ["<file>", ...]
    }
  },
  "vault_slugs": {
    "<slug>": {
      "referenced_by_plans": ["<plan-path>", ...],
      "referenced_by_code": ["<file>", ...]
    }
  }
}
```

### `nlm-index.json` (Phase 10 bidirectional bridge state)
Tracks the round-trip mapping for the bidirectional NotebookLM bridge:
- Studio artifacts that have been extracted into vault knowledge notes (loop prevention).
- Vault knowledge notes that have been republished as versioned NotebookLM sources.
- Last-sync timestamp for the `sync-knowledge-to-nlm.sh` watcher.

Schema:
```json
{
  "last_sync": "<ISO-8601 timestamp>",
  "<artifact-uuid>": {
    "knowledge_path": "knowledge/<slug>.md",
    "republished_source_id": "<source-uuid>",
    "republished_alias": "<pp-alias>",
    "last_updated": "<ISO-8601 timestamp>"
  }
}
```

#### How entries land
1. **Forward leg (Studio → vault):** `scripts/pp-nlm/studio-output-to-inbox.sh <archive-path>`
   - Writes `inbox/<DATE>-nlm-<artifact-id>-<slug>.md` with frontmatter `provenance.source: nlm-studio` + `provenance.artifact_id: <uuid>`.
   - Checks `nlm-index.json[<artifact-id>]`; if present, skips (loop guard).
2. **Extract leg:** `/extract` skill processes the inbox file, mines atomic claims into `knowledge/`. Each new knowledge note inherits the `artifact_id` field in its frontmatter.
3. **Return leg:** `scripts/pp-nlm/sync-knowledge-to-nlm.sh` (cron-driven or manual)
   - Routes new knowledge notes by frontmatter to the appropriate Tier-1 notebook.
   - Publishes as `<slug> v<N> — <DATE>` versioned source.
   - For knowledge notes WITH `artifact_id` in frontmatter, updates `nlm-index.json[<artifact-id>]` with `republished_source_id` + `republished_alias`.

#### Loop prevention
The `studio-output-to-inbox.sh` script checks `nlm-index.json` BEFORE writing the inbox file. If the artifact_id already has a `knowledge_path` mapping, the inbox write is skipped — preventing the cycle "extract a Studio output → republish as source → next sync re-archives → re-extract → ...".

#### Cleanup
Stale entries (knowledge_path no longer exists) can be detected by:
```bash
jq -r 'to_entries[] | select(.value.knowledge_path != null) | .value.knowledge_path' \
  ops/index/nlm-index.json | xargs -I{} test -f {} || echo "stale: {}"
```

## Maintenance

These indexes are part of `ops/` (operational state) per the Three Spaces methodology — they don't carry knowledge claims, only point at them. Never write claims here.

- `plan-vault-backlinks.json` regenerates via `/vault-index`.
- `nlm-index.json` updates incrementally as the bidirectional bridge runs.
- Both files are committed to git (track operational state evolution over time).
