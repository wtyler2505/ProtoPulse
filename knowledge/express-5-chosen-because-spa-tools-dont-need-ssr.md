---
description: "Express 5 over Next.js was deliberate -- no SSR needed for a desktop tool app, and async error handling is native"
type: decision
source: "docs/MASTER_BACKLOG.md, docs/adr/"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["server/index.ts"]
---

# Express 5 was chosen because SPA tool apps don't need SSR and async error handling matters more

ProtoPulse is a tool -- a desktop application where every page is interactive, state-heavy, and authenticated. Server-side rendering adds complexity without benefit when the user experience is a persistent workspace, not a content page that needs SEO or fast first-paint for anonymous visitors. Express 5's native async error handling (no more `try/catch` wrappers on every route) was a bigger win for developer velocity than any SSR framework's feature set.

This decision also preserved flexibility. Express is a thin layer that doesn't dictate frontend architecture, data fetching patterns, or deployment targets. When the project pivoted from browser-based to native desktop (Tauri v2), the backend stayed unchanged. A Next.js app would have required rearchitecting the server layer.

The trade-off is real: no automatic code splitting, no streaming SSR for initial load, no built-in API routes convention. Vite handles code splitting. The monolithic Express server handles API routes. These are adequate for a tool app used by authenticated users who accept a loading screen.

---

Relevant Notes:
- [[monolithic-context-causes-quadratic-render-complexity]] -- the frontend bottleneck isn't SSR
- [[god-files-create-feature-paralysis-through-complexity]] -- Express simplicity aided decomposition

Topics:
- [[architecture-decisions]]
