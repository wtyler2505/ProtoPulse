---
summary: How I process, connect, and maintain codebase knowledge
type: moc
---

# methodology

## Principles

- **Prose-as-title**: every insight is a proposition — "proxy-based chainBuilder mocks intercept .then causing await to hang"
- **Wiki links**: connections as graph edges between insights
- **Topic maps**: attention management hubs for navigating knowledge areas
- **Capture fast, process slow**: grab observations during work, extract proper insights later

## My Process

### Extract
Take raw session observations, code changes, or bug investigations and pull out the atomic insights. Each insight captures one thing — a decision, a pattern, a gotcha, a convention. Title it as a claim, not a label.

### Connect
Find relationships between insights. A bug pattern might relate to an architectural decision. A testing pattern might connect to a dependency gotcha. Wiki links make these connections navigable.

### Verify
Check that each insight has proper metadata (summary, category, areas, affected files), that wiki links resolve, and that the title passes the composability test: "This insight argues that [title]."

### Revisit
When code changes, review related insights. Update or mark as outdated. The codebase moves fast — 60+ waves of development mean old insights need regular attention.

---

Areas:
- [[identity]]
