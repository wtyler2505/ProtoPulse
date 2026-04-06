---
description: "buildSystemPrompt does array.find() for source and target of every edge — 100 nodes × 200 edges = 40k iterations before the AI request even sends"
type: debt-note
source: "conductor/comprehensive-audit.md §27"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["server/ai.ts"]
---

# buildSystemPrompt performs O(N*M) array scans to resolve edge endpoints blocking the main thread

In `server/ai.ts`, the `buildSystemPrompt` function performs linear array scans (`appState.nodes.find()`) for the source and target of every single edge. For a medium-sized schematic with 100 nodes and 200 edges, this results in 40,000 array iterations purely to build a text string. This blocks the main thread before the AI request is even sent.

Refactoring to an O(1) Map lookup (build a node-id → node Map once, then lookup per edge) eliminates this bottleneck entirely.

---

Relevant Notes:
- [[ai-prompt-scaling-is-linear-and-will-hit-token-limits]] -- prompt construction latency compounds with token scaling

Topics:
- [[architecture-decisions]]
