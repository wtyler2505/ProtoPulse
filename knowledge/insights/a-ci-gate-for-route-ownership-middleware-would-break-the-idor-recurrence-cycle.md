---
summary: IDOR vulnerabilities recur across audit cycles because new routes lack ownership middleware — a CI gate scanning for requireProjectOwnership in route registrations would shift prevention from reactive audits to proactive enforcement
category: architectural-decision
areas:
  - "[[architecture]]"
  - "[[bug-patterns]]"
  - "[[conventions]]"
confidence: proven
wave: "80"
affected_files:
  - server/routes/
  - server/circuit-routes/
  - server/middleware.ts
---

# a CI gate for route ownership middleware would break the IDOR recurrence cycle

IDOR (Insecure Direct Object Reference) vulnerabilities have recurred across 4 distinct audit cycles in ProtoPulse: the Codex audit, Wave A ownership guards, Waves 52-53 security hardening, and Wave 80 gap audit. Each time, the root cause is the same — new Express routes are added without `requireProjectOwnership` middleware in the chain, and the gap isn't caught until the next security sweep.

The pattern is structural, not personnel: the default route registration template doesn't enforce ownership, so every new route is a potential IDOR by omission. Manual audits will always play catch-up because the creation rate (5-7 routes per wave) outpaces the audit frequency.

A pre-submit CI gate — either an ESLint rule or a shell script scanning for `router.get`, `router.post`, `router.put`, `router.patch`, `router.delete` registrations — that verifies `requireProjectOwnership` appears in the middleware chain would convert this from a recurring audit finding into a build failure. Exceptions would need a maintained whitelist for genuinely public routes (login, register, health check, seed).

This is the automation version of "make the right thing easy and the wrong thing hard." The gate itself must be maintained as route patterns evolve, but the maintenance cost is far lower than recurring security audits.

---

Related:
- [[feature-shipping-velocity-vs-authorization-coverage]] — this insight dissolves that tension
- [[five-architecture-decisions-block-over-30-downstream-features-each]] — auth infrastructure is one of the blocking decisions
- [[ai-chat-endpoints-accepting-projectid-in-the-request-body-instead-of-the-url-path-bypass-ownership-middleware-by-construction]] — another IDOR pattern

Areas:
- [[architecture]]
- [[bug-patterns]]
- [[conventions]]
