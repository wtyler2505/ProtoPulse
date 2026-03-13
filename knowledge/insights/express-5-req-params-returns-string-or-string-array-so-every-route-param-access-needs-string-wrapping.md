---
summary: Express 5 types req.params.id as string | string[], requiring String() wrapping on every route parameter access to satisfy TypeScript strict mode
areas: ["[[index]]"]
related insights:
  - "[[ai-chat-endpoints-accepting-projectid-in-the-request-body-instead-of-the-url-path-bypass-ownership-middleware-by-construction]] — another Express routing gotcha where parameter handling creates subtle bugs"
  - "[[idor-vulnerabilities-cluster-in-routes-that-use-global-resource-ids-instead-of-project-scoped-url-paths]] — the security implication: if String() wrapping is forgotten, type errors may mask route behavior"
created: 2026-03-13
---

Express 5's type definitions changed `req.params` from `Record<string, string>` to `Record<string, string | string[]>`. This means every `req.params.id` access in a route handler now returns `string | string[]`, which fails TypeScript strict checks when passed to functions expecting `string`. The fix is wrapping with `String(req.params.id)` — a one-line change per param, but across 100+ routes it's a substantial migration. ProtoPulse hit this during the Express 4→5 upgrade and resolved it globally.

## Topics

- [[index]]
