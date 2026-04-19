---
name: vault-index
description: Build + maintain the bidirectional plan↔vault↔code backlink index at ops/index/plan-vault-backlinks.json. Greps every plan under docs/superpowers/plans/ and every client/src file for vault slug references, reconciles against knowledge/, commits the JSON index. Lets downstream tools answer "who consumes this note?" and "is a note orphaned?". Triggers on "/vault-index", "/vault-index rebuild", "rebuild vault backlinks", "who references knowledge/X".
version: "1.0"
user-invocable: true
context: fork
allowed-tools: Read, Grep, Glob, Bash
argument-hint: "[--rebuild] [--json] [--query <slug>] [--orphans] [--stale-days N]"
---

## EXECUTE NOW

**Mode: $ARGUMENTS**

Parse flags:
- `--rebuild` — full rebuild (default). Walks all plans + client/src + knowledge/.
- `--json` — emit result JSON. Otherwise human summary.
- `--query <slug>` — show backlinks for a specific note slug.
- `--orphans` — list notes under knowledge/ with zero backlinks.
- `--stale-days N` — flag backlinks where last verified > N days ago (default 90).

**Execute these steps:**

1. **Resolve repo root** — default to git root, else CWD.
2. **Invoke scripts/build-index.py** — see §Index shape below.
3. **Write index** — atomic write to `ops/index/plan-vault-backlinks.json`.
4. **Emit view** — respect `--query` / `--orphans` / default summary.

**Pipeline discipline** — this skill only READS the vault, plans, and code. It writes to `ops/index/` only. No changes to `knowledge/`, `inbox/`, or source files.

**START NOW.** Reference below explains index shape, scan rules, staleness semantics.

---

## Index shape — `ops/index/plan-vault-backlinks.json`

```json
{
  "version": 1,
  "generated_at": "2026-04-18T23:45:00Z",
  "repo_root": "/home/wtyler/Projects/ProtoPulse",
  "notes": {
    "esp32-gpio12-must-be-low-at-boot-or-module-crashes": {
      "file": "knowledge/esp32-gpio12-must-be-low-at-boot-or-module-crashes.md",
      "referenced_by_plans": [
        {
          "plan": "docs/superpowers/plans/2026-04-18-e2e-walkthrough/06-schematic.md",
          "line": 142,
          "excerpt": "Wave 5 Task 5.9 — pin alternate-function dialog …"
        }
      ],
      "consumed_by_code": [
        {
          "file": "client/src/components/schematic/PinHoverCard.tsx",
          "line": 38,
          "context": "<VaultHoverCard slug=\"esp32-gpio12-...\">"
        }
      ],
      "outgoing_related": ["esp32-strapping-pins-summary"],
      "incoming_related": ["avoid-strapping-pins-for-sensor-inputs"],
      "last_indexed": "2026-04-18T23:45:00Z"
    }
  },
  "orphans": ["some-never-cited-note"],
  "broken_references": [
    {
      "from": "knowledge/foo.md",
      "field": "related",
      "to_slug": "nonexistent-note",
      "severity": "error"
    }
  ],
  "stats": {
    "notes_indexed": 683,
    "plans_scanned": 24,
    "code_files_scanned": 1512,
    "total_backlinks": 1847,
    "orphan_count": 42
  }
}
```

## Scan rules

**Plan scan** — grep under `docs/superpowers/plans/` for `knowledge/<slug>.md` OR `slug="<slug>"` OR wiki-links `[[slug]]` OR inline backticks containing slugs. Record `(plan, line, 200-char-excerpt)`.

**Code scan** — grep under `client/src/`, `server/` for `<VaultHoverCard slug="..."`, `<VaultExplainer slug="..."`, `useVaultNote("...")`, `useVaultSearch(...)`, `buildVaultContext(...)`. Record `(file, line, 100-char-context)`.

**Vault internal scan** — for each knowledge/*.md, parse frontmatter `related:`, `supersedes:`, `superseded-by:` fields. Build forward + reverse adjacency lists.

**Exclusions:**
- `knowledge/archive/**` (archived notes)
- `node_modules`, `dist`, `build`, `coverage`, `.git`
- Binary files

## Orphan detection

A note is orphaned when `referenced_by_plans` AND `consumed_by_code` AND `incoming_related` are all empty. Orphans are candidates for:
- Promotion (add to a MOC to make discoverable)
- Consumption (find a surface that should reference it)
- Archival (if genuinely stale)

`/vault-health` (T7) consumes orphan counts for the weekly report.

## Broken references

When a note's frontmatter says `related: [foo]` but `knowledge/foo.md` doesn't exist:
- Severity `error`
- Candidate for auto-fix via `/vault-validate --fix` (removing the bad entry is safe; T2's validator handles this)

## Staleness

A backlink is stale when the referencing plan or code file hasn't been touched in N days (git mtime) AND the note itself has been edited since. Suggests the reference may be out of date.

## Integration points

- **T2 `/vault-validate`** — consumes `broken_references[]` for CI reporting.
- **T7 `/vault-health`** — consumes `stats`, `orphans`, and stale counts.
- **T12 traceability panel** — reads `notes[<slug>]` directly for UI display.
- **T15 `/vault-extract-priority`** — uses `referenced_by_plans` count for demand ranking.
- **Pre-commit hook** — recommended: run `/vault-index --rebuild --json > /dev/null && git add ops/index/plan-vault-backlinks.json` when touching knowledge/ or plans.

## Anti-patterns

| Anti-Pattern | Why It Fails | Instead |
|--------------|--------------|---------|
| Run index on every file save | Slow; floods git history | Run on explicit `/vault-index` invocation or pre-commit |
| Trust index without rebuilding after vault moves | Stale entries break downstream tools | Rebuild on any `knowledge/` rename |
| Delete orphans without review | Might be valuable notes waiting for consumption | Flag; let human decide |
| Index binary files | Wasted work | Exclude via extension filter |

## Version history

- **1.0 (2026-04-18)** — initial ship. ProtoPulse paths. Depends on T2 frontmatter for `related/supersedes`.
