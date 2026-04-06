---
description: "Express v5 natively catches async errors from route handlers — the custom asyncHandler wrapper is legacy tech debt bloating every route file"
type: debt-note
source: "conductor/comprehensive-audit.md §9"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["server/utils.ts", "server/routes/"]
---

# asyncHandler wrapper is redundant in Express v5 which natively handles async errors

The codebase heavily uses the custom `asyncHandler` wrapper (`server/utils.ts`) on all API routes to catch rejected promises. Express v5 natively supports returning Promises and automatically catches async errors. The custom wrapper is legacy tech debt that bloats the routing files and should be removed entirely.

Additionally, many older routes manually read from `req.body` without strict Zod schema enforcement at the middleware boundary. A "Fail Fast" Zod/AJV validation middleware layer before route controllers would prevent ReDoS and injection payload parsing.

---

Relevant Notes:
- [[drizzle-orm-was-chosen-for-type-safe-zod-integration]] -- Zod validation should be at the boundary, not inline
- [[express-5-chosen-because-spa-tools-dont-need-ssr]] -- Express 5 was chosen specifically for features like native async error handling
- [[genkit-tools-use-z-any-output-destroying-structured-validation]] -- both are validation boundary issues: asyncHandler is redundant, z.any() is harmful

Topics:
- [[architecture-decisions]]
