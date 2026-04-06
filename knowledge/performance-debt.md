---
description: Performance bottlenecks found in the comprehensive audit — main-thread blocking, DB indexing gaps, memory leaks, and bundle bloat
type: moc
topics:
  - "[[gaps-and-opportunities]]"
  - "[[architecture-decisions]]"
---

# performance-debt

Performance bottlenecks identified in the April 2026 comprehensive audit. The universal pattern is synchronous computation on the main thread that should be offloaded to workers, Wasm, or native code.

## The Pattern: Everything Blocks the Main Thread

```
User action
  → simulation engine: O(N³) Gaussian elimination, sync
  → canvas render: O(N) JSON.stringify per cycle
  → AI prompt build: O(N*M) array scans
  → arduino-cli: execSync blocks entire event loop
  → ERC engine: JS graph traversal, no worker
  → All compound into user-visible freezes
```

## Notes

- [[simulation-engine-blocks-main-thread-with-no-webworker-or-wasm]] -- MNA/NR solver freezes React UI during heavy analysis
- [[reactflow-json-stringify-sync-is-on-per-render-and-breaks-at-10k-nodes]] -- O(N) serialization per render cycle
- [[build-system-prompt-has-on-m-edge-resolution-bottleneck]] -- 40k array iterations for medium schematics
- [[vite-manual-chunks-defeats-dynamic-import-and-tree-shaking]] -- bloated initial JS payload
- [[jsonb-columns-lack-gin-indexes-forcing-sequential-scans]] -- no GIN indexes on JSONB columns
- [[execsync-in-arduino-service-blocks-entire-express-event-loop]] -- sync shell calls freeze API for all users

## Related Debt

- [[monolithic-context-causes-quadratic-render-complexity]] -- re-render cascade compounds canvas blocking
- [[ai-prompt-scaling-is-linear-and-will-hit-token-limits]] -- prompt size compounds prompt construction latency

---

Topics:
- [[gaps-and-opportunities]]
- [[architecture-decisions]]
