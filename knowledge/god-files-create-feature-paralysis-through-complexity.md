---
description: "12 files over 1000 LOC, with CCN up to 381 aggregate, blocked entire feature domains"
type: debt-note
source: "docs/product-analysis-report.md"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["server/routes.ts", "server/ai-tools.ts", "server/storage.ts"]
---

# God files create feature paralysis by making complexity the bottleneck not developer talent

The product analysis identified 12 files exceeding 1000 lines, with ShapeCanvas.tsx accumulating CCN 381 across 6 functions and PCBLayoutView.tsx hitting CCN 135 in a single anonymous function. The cross-phase analysis proved these were not just code smells — they were direct blockers. PCBLayoutView's complexity blocked all PCB feature development. The action executor monolith (1,299 lines, 53 action types) made merge conflicts near-certain.

Most of these god files have since been decomposed (routes.ts, ai-tools.ts, circuit-routes.ts, storage.ts, ShapeCanvas.tsx, PCBLayoutView.tsx, ProcurementView.tsx). The lesson for future development: a file crossing 500 lines should trigger a decomposition conversation, not a TODO comment. The cost of decomposing early is linear; the cost of decomposing late includes all the features that were blocked while the file was untouchable.

---

Relevant Notes:
- [[pcb-layout-was-the-weakest-domain-across-all-five-phases]] -- the most damaging impact: PCBLayoutView CCN=135 blocked the entire domain
- [[dual-export-system-is-a-maintenance-trap]] -- another structural debt pattern spawned by monolithic files
- [[monolithic-context-causes-quadratic-render-complexity]] -- the same pattern at the React state layer: one monolith cascading into paralysis
- [[cocomo-estimates-protopulse-at-1-9m-and-17-months]] -- 9,667 CCN quantifies the aggregate complexity these god files created

Topics:
- [[architecture-decisions]]
