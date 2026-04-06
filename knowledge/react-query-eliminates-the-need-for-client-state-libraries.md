---
description: "React Query replaced Redux/Zustand because ProtoPulse's state is almost entirely server-derived"
type: decision
source: "docs/MASTER_BACKLOG.md"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["client/src/lib/project-context.tsx"]
---

# React Query eliminates the need for client state libraries because ProtoPulse state is server-derived

ProtoPulse has 36 database tables and 125 AI tools that mutate server state. Every meaningful piece of data -- architecture nodes, BOM items, circuit instances, validation issues, chat messages -- lives in PostgreSQL. Client-side state is limited to UI concerns: which panel is open, which tab is selected, zoom level. This profile makes Redux, Zustand, and MobX unnecessary overhead.

React Query's cache invalidation via mutation callbacks was the deciding factor. When the AI adds a BOM item, `invalidateQueries(['bom'])` ensures every component showing BOM data re-fetches. Optimistic updates (Wave 58) make the UI feel instant. The alternative -- maintaining a Redux store that mirrors server state and manually keeping them in sync -- is the kind of boilerplate that kills velocity on a solo project.

The cost is the monolithic `ProjectProvider` context (40+ values), which is known tech debt. But this is a React architecture problem, not a state management library problem. Splitting the context into domain-specific providers would fix the re-render cascade without introducing Redux.

---

Relevant Notes:
- [[monolithic-context-causes-quadratic-render-complexity]] -- the real cost of wrapping React Query in one monolithic context
- [[express-5-chosen-because-spa-tools-dont-need-ssr]] -- the server owns truth; React Query just fetches it
- [[project-provider-monolith-is-the-biggest-remaining-frontend-debt]] -- ProjectProvider wraps React Query into one context instead of per-domain providers

Topics:
- [[architecture-decisions]]
