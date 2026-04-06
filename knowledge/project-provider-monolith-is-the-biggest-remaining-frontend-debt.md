---
description: "ProjectProvider's 40+ values trigger re-renders across all consumers on any state change"
type: debt-note
source: "docs/MASTER_BACKLOG.md"
confidence: proven
topics: ["[[architecture-decisions]]", "[[maker-ux]]"]
related_components: ["client/src/lib/project-context.tsx"]
---

# ProjectProvider monolith is the biggest remaining frontend debt because it couples unrelated domains

`ProjectProvider` in `project-context.tsx` holds 40+ state values covering architecture, BOM, validation, chat, history, circuit design, simulation, and UI preferences. Any React Query mutation that invalidates one domain causes every component consuming the context to re-render, even components that only care about unrelated state.

This was acceptable when ProtoPulse had one project (PROJECT_ID=1 was hardcoded until Wave 39) and a handful of views. With 26 ViewModes and 501 implemented features, the re-render cascade has measurable impact. Wave 58 added optimistic updates to reduce network round-trips, but the fundamental problem is structural: the context API does not support selective subscription.

The fix is splitting ProjectProvider into domain-specific providers (ArchitectureProvider, BomProvider, CircuitProvider, etc.), each managing their own React Query cache slice. This was identified early as TD-01 in the backlog. The reason it persists is that decomposition requires updating every component that imports `useProject()`, touching dozens of files simultaneously. It is the kind of change that is low-risk but high-coordination -- exactly the work that gets deprioritized when there are features to ship.

---

Relevant Notes:
- [[monolithic-context-causes-quadratic-render-complexity]] -- quantified impact
- [[god-files-create-feature-paralysis-through-complexity]] -- same pattern, server side

Topics:
- [[architecture-decisions]]
- [[maker-ux]]
