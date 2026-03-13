---
summary: Backlog statistics and views should be generated from a structured data source (JSON/YAML) rather than manually maintained in markdown
type: methodology
category: maintenance
source: rethink
created: 2026-03-13
status: active
evidence: ["machine-readable-backlog-alongside-markdown"]
---

# backlog statistics should be generated from structured data not manually maintained

## What to Do

When maintaining the MASTER_BACKLOG.md, treat Quick Stats, item counts, and status summaries as **computed outputs** rather than manually edited fields. The canonical data should live in a structured format (JSON or YAML) that can be queried, validated, and used to generate the markdown.

## What to Avoid

- Manually editing Quick Stats counts without verifying they match the actual item statuses below
- Updating individual item statuses without also updating the summary section
- Treating the rendered markdown as the source of truth when it disagrees with the underlying data

## Why This Matters

Across 79+ waves of ProtoPulse development, MASTER_BACKLOG.md Quick Stats have repeatedly drifted from the actual item statuses below them. Agents update individual items (marking BL-XXXX as DONE) but forget to update the P0/P1/P2/P3 counts in the summary. This creates a "single source of truth that lies about its own contents" — the worst possible state for a planning document.

The root cause is structural: asking humans (or agents) to update two representations of the same data (summary + detail) will always produce inconsistencies. The fix is making the summary a computed view of the detail.

## When This Applies

- Every wave that modifies MASTER_BACKLOG.md item statuses
- Every /rethink that reclassifies items
- Any bulk update to backlog items

## Implementation Path

Until a generation pipeline exists: after every backlog update, manually recount items by status and priority to verify Quick Stats accuracy. This is the manual compensating control for the absence of automation.

---

Related: [[methodology]]
