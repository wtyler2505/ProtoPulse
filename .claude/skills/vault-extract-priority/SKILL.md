---
name: vault-extract-priority
description: Prioritize the inbox-extraction queue by downstream plan demand. Reads ops/queue/gap-stubs.md (populated by /vault-gap) and each stub's `unblocks:` frontmatter, then emits an ordered list of inbox/ paths so /extract processes most-demanded gaps first. Enables plan execution to stall less on vault gaps. Triggers on "/vault-extract-priority", "prioritize extract queue", "which inbox stub is most urgent", "sort extraction by demand".
version: "1.0"
user-invocable: true
context: fork
allowed-tools: Read, Grep, Glob, Bash
argument-hint: "[--json] [--limit N] [--queue path/to/gap-stubs.md]"
---

## EXECUTE NOW

**Mode: $ARGUMENTS**

Parse flags:
- `--json` — emit JSON. Otherwise human-readable ranked list.
- `--limit N` — cap output to top-N.
- `--queue <path>` — override queue file (default `ops/queue/gap-stubs.md`).

**Execute these steps:**

1. **Read queue** — parse `ops/queue/gap-stubs.md` markdown table. Extract `(timestamp, topic, slug, origin plan, task, coverage, status)` per row. Skip rows with `status: extracted` or `status: archived`.
2. **Read each inbox stub** — for every slug with a `pending` or `in_progress` status, open `inbox/YYYY-MM-DD-<slug>.md`. Parse its frontmatter. Collect `unblocks:` list (may be empty) + `origin:` block.
3. **Score each stub** — see §Scoring below.
4. **Sort descending** — highest score first.
5. **Emit** — ordered list with score, slug, plan references, reasoning.

`/extract` reads this output (by running this skill with `--json`) and processes top-N first.

**START NOW.** Reference explains scoring formula, queue format contract, integration with `/extract`.

---

## Scoring formula

```
score(stub) =
    5 * len(unblocks[])                    # more plans unblocked = higher
  + 3 * recency_bonus                       # newer gaps score higher
  + 2 * (1 if origin plan is in tier A/B)   # P0/a11y > polish
  + 1 * (1 if coverage == "missing")        # missing > thin
  + 0.5 * origin_plan_referenced_count      # hot plans first
```

`recency_bonus = max(0, 30 - days_since_captured) / 30` (0..1 over 30d).
`origin_plan_referenced_count` = how many other stubs cite the same plan.

**Tier detection:** plan files matching `01-p0-*.md`, `02-p1-*.md`, `03-a11y-*.md` = Tier A/B. Others = 0.

## Queue format contract

`ops/queue/gap-stubs.md` must be the markdown table format shipped by the vault-gap skill:

```
| timestamp | topic | slug | origin plan | task | coverage | status |
|-----------|-------|------|-------------|------|----------|--------|
| 2026-04-18T22:15:00Z | "…" | slug-here | docs/…/03-a11y.md | 10.1 | missing | pending |
```

Rows are append-only. Status transitions: `pending → in_progress → extracted → archived`.

If the queue is missing or empty, this skill returns an empty ranked list (exit 0) — not an error.

## Integration with `/extract`

When `/extract` runs in "process-queue" mode, it should:
1. Invoke this skill via `/vault-extract-priority --json --limit 10`.
2. Receive a ranked list of inbox stubs.
3. Process them in order.
4. After each successful extraction, update `ops/queue/gap-stubs.md` to mark the row `status: extracted → <knowledge-slug>.md`.

If `/extract` already has its own `ops/queue/queue.json` mechanism, the priority output can be merged: vault-gap stubs go on top, legacy items follow.

## How to mark a stub "extracted"

Use `scripts/mark-extracted.sh <slug> <knowledge-slug>` to atomically update the queue row.

## Anti-patterns

| Anti-Pattern | Why It Fails | Instead |
|--------------|--------------|---------|
| Score solely on recency | Old gaps with many unblockers still matter | Weight `unblocks` 5× |
| Use this to override user explicit priority | Tyler said "do X first" — respect that | Always allow manual override via `--pin <slug>` (future) |
| Read stubs without querying qmd | Queue may stale if vault grew since gap was flagged | `/extract` should re-run `/vault-gap` on a candidate before processing |

## Version history

- **1.0 (2026-04-18)** — initial ship. Consumes T1 queue format. Emits ranked list for `/extract`.
