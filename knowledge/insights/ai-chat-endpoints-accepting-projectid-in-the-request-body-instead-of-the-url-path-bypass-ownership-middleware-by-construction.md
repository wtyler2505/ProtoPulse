---
summary: Routes that accept projectId as a body parameter cannot use URL-based ownership middleware — the architectural anti-pattern must be fixed by restructuring routes, not adding more middleware
areas: ["[[index]]"]
created: 2026-03-13
---

ProtoPulse's ownership middleware (`requireProjectOwnership`) works by extracting the project ID from the URL path (e.g., `/api/projects/:id/...`). Routes that accept `projectId` in the request body instead — AI chat, batch analysis, and agent endpoints — structurally bypass this middleware because the project ID isn't in `req.params`. This is why these endpoints keep being flagged in security audits despite multiple fix waves. Adding body-parsing middleware is a band-aid; the real fix is restructuring these routes to use URL parameters: `/api/projects/:id/chat`, `/api/projects/:id/batch-analysis`, `/api/projects/:id/agent`. The anti-pattern reveals a deeper principle: authorization must be derivable from the URL structure, not from user-supplied body data.

## Topics

- [[index]]
