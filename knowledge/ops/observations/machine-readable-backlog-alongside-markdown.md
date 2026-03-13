---
summary: Generate MASTER_BACKLOG.md from a structured JSON/YAML source so stats, complexity coverage, and planning views cannot drift from the canonical data
type: implementation-idea
created: 2026-03-13
---

The current MASTER_BACKLOG.md is manually maintained markdown — Quick Stats, item statuses, and complexity ratings are all hand-edited. This creates drift when agents update items without updating summaries. A structured source file (JSON or YAML) containing all 508 items with their metadata (priority, status, complexity, wave, BL-ID) would enable: (1) generating the markdown with computed stats, (2) querying the backlog programmatically, (3) generating planning views (by-priority, by-wave, by-complexity) automatically, (4) validating consistency at CI time.
