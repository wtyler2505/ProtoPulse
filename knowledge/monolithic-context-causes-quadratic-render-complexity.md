---
description: "ProjectProvider with 40+ state values plus 83% unmemoized components creates cascading re-renders"
type: debt-note
source: "docs/product-analysis-report.md"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["client/src/lib/project-context.tsx"]
---

# The monolithic ProjectProvider combined with unmemoized components creates quadratic render complexity

Impact Chain 3 from the cross-phase analysis: ProjectProvider has 40+ state values in one React context. Any state change triggers all consumers to re-render. Combined with the finding that only 9 out of 55 components (16%) use React.memo, every parent re-render cascades through the entire component tree unchecked. The result is visible UI jank on AI actions and sluggish tab switching — users perceive the app as slow even when the server responds quickly.

The report found 53 inline style objects creating new references every render, a 22-item useCallback dependency array on the chat send handler, and undo/redo stacks with no depth limit accumulating unbounded memory. The partially refactored 8-context split distributed the problem without eliminating it — architecture-context alone has 27+ values with 6 useState hooks. True resolution requires splitting contexts to domain boundaries where consumers only subscribe to the state they read.

---

Relevant Notes:
- [[god-files-create-feature-paralysis-through-complexity]] -- the same pattern at the file layer: monoliths cascade into paralysis
- [[ai-prompt-scaling-is-linear-and-will-hit-token-limits]] -- server-side equivalent: one monolith (system prompt) causes linear cost scaling
- [[cocomo-estimates-protopulse-at-1-9m-and-17-months]] -- 9,667 aggregate CCN quantifies why 40+ state values in one context is unsustainable

Topics:
- [[architecture-decisions]]
