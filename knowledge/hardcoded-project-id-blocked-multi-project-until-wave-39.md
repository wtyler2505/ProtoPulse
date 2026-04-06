---
description: "PROJECT_ID=1 was hardcoded in project-context.tsx, blocking all multi-project work until Wave 39 fixed it"
type: debt-note
source: "docs/MASTER_BACKLOG.md (BL-0039, TD-02)"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["client/src/lib/project-context.tsx", "client/src/pages/ProjectWorkspace.tsx"]
---

# Hardcoded PROJECT_ID blocked multi-project support until Wave 39 introduced routing and picker

`PROJECT_ID = 1` was hardcoded in `project-context.tsx` from the earliest versions of ProtoPulse. Every API call, every React Query cache key, and every storage operation assumed a single project. This was the kind of shortcut that is invisible early (you only have one project during initial development) and becomes load-bearing debt later (every feature that touches project state inherits the assumption).

Wave 39 resolved it by introducing ProjectPickerPage.tsx (476 lines), wouter routing at `/projects/:projectId`, and ProjectIdContext. The fix verified that zero hardcoded PROJECT_IDs remained in the codebase. This unblocked the collaboration features (Wave 41), the auth system (Wave 59), and the multi-project workspace.

The lesson is about implicit assumptions in state management. The hardcoded ID was never a deliberate architectural decision -- it was an initial convenience that became structural. The backlog tracked it as TD-02, but it persisted for 38 waves because fixing it required touching every component that consumed project state. The fix was eventually straightforward but coordination-heavy.

---

Relevant Notes:
- [[project-provider-monolith-is-the-biggest-remaining-frontend-debt]] -- the context that hosted the hardcoded ID
- [[monolithic-context-causes-quadratic-render-complexity]] -- related structural debt

Topics:
- [[architecture-decisions]]
