---
summary: ProjectWorkspace queues all 27 lazy-loaded view chunks into a requestIdleCallback chain ordered by traffic priority, so first navigation never blocks on network fetch
category: optimization
areas: ["[[architecture]]"]
wave: "extraction"
---

# Tiered idle-time prefetch prevents first-click navigation jank across 27 lazy-loaded views

ProjectWorkspace (line 64-122) uses `React.lazy()` for all 27 views + panels, which means clicking a tab for the first time triggers a dynamic import. On slow connections or cold caches, this creates 500ms-3377ms of jank (noted in the code comment).

The solution is a module-level `prefetchQueue` array that orders all lazy imports into 3 priority tiers:
- **Tier 1**: Architecture, Dashboard, ChatPanel, Sidebar — most-visited, prefetched immediately
- **Tier 2**: Schematic, Breadboard, PCB, Procurement, Validation, Output, Simulation — common workflow
- **Tier 3**: Component Editor, Design History, Calculators, and 12 other secondary views

The `startPrefetch()` function (called once via `useEffect` on mount) chains these imports through `requestIdleCallback` — each chunk is fetched during browser idle periods, and the next fetch is scheduled only after the current one completes. This ensures:
1. The initial render is never blocked by prefetch network activity
2. Chunks are cached in the browser's module registry before the user clicks
3. The `setTimeout(next, 50)` fallback handles Safari/older browsers without requestIdleCallback

The `prefetchStarted` guard (module-level boolean, not React state) prevents re-entrancy if WorkspaceContent remounts. The `.catch(() => {})` on each loader swallows chunk load failures silently — prefetch failure is non-fatal since the real lazy import will retry on click.

This pattern is specific to apps with many views behind a single layout (like an IDE or EDA tool). A typical web app with 3-5 routes doesn't need it.

---

Related:
- [[wave-based-development-enables-rapid-shipping-but-creates-integration-debt]] — rapid view addition (27 views from 51 waves) makes this optimization necessary
- [[progressive-disclosure-hides-downstream-views-until-architecture-nodes-exist-preventing-empty-state-errors]] — prefetch tiers align with disclosure tiers: Tier 1 = always-visible views, Tier 2 = require-content views; the two systems reinforce each other
- [[deprecated-useproject-facade-enables-incremental-migration-from-monolithic-to-decomposed-contexts]] — prefetched views load the facade hook; migrating to domain hooks would narrow each view's render dependency, potentially improving prefetch value by reducing post-load re-renders
- [[errorboundary-suppresses-resizeobserver-loop-errors-because-they-are-benign-browser-noise-that-would-crash-every-canvas-view]] — prefetch failure is swallowed silently (.catch(() => {})) while render failure is caught by ErrorBoundary; two different error strategies for the same lazy-loaded views

Areas:
- [[architecture]]
