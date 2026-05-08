# `docs/nlm-archive/` — NotebookLM Studio durable archive

Every Studio artifact (audio, video, report, slides, mindmap, infographic, quiz, flashcards, data-table) is auto-downloaded here when its NotebookLM `studio_status` flips to `completed`. The `auto-commit-vault.sh` hook then commits the file via the existing vault-commit pipeline.

## Why this exists
Google can vanish Studio artifacts (account flips, tier changes, deprecation). Local copies are non-negotiable durability.

## Layout
```
docs/nlm-archive/
├── manifest.json              # artifact-id → {type, alias, title, path, archived}
├── pp-codebase/
│   ├── 2026-05-08-architecture-audio-<aid>.mp3
│   ├── 2026-05-08-study-guide-<aid>.md
│   └── ...
├── pp-journal/
└── ...
```

## Manifest schema
```json
{
  "<artifact-uuid>": {
    "type": "audio|video|report|slide_deck|mind_map|infographic|quiz|flashcards|data_table",
    "alias": "pp-<notebook-alias>",
    "title": "<sanitized-title>",
    "path": "/abs/path/to/file.<ext>",
    "archived": "<ISO-8601 datetime>"
  }
}
```

## How files land
1. Slash command (`/pp-podcast`, `/pp-mindmap`, `/pp-report`) creates the artifact in NotebookLM and polls `nlm studio status` until `completed`.
2. The slash command then invokes `.claude/hooks/pp-nlm-studio-archive.sh <alias> <artifact-id>`.
3. The archive script `nlm download`s the artifact in the right format and updates `manifest.json`.
4. Cron sweep at `*/30 * * * *` picks up any artifacts the slash-command path missed.

## Idempotency
The archive script skips any artifact-id already present in `manifest.json`. Re-running the sweep is safe and free.

## Manual archive
- `/pp-archive <alias> <artifact-id>` — force-download a specific artifact.
- `/pp-archive` (no args) — run the sweep manually.

## Out of scope
- Restoring artifacts to NotebookLM from local copies (download-only).
- Diffing local files against remote artifacts (artifacts are immutable post-creation).
