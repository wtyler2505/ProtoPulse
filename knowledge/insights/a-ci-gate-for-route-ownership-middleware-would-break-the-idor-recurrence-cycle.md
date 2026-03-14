---
summary: IDOR vulnerabilities recur across audit cycles because new routes lack ownership middleware — a CI gate scanning for requireProjectOwnership or requireCircuitOwnership in route registrations would shift prevention from reactive audits to proactive enforcement
category: architectural-decision
areas:
  - "[[architecture]]"
  - "[[bug-patterns]]"
  - "[[conventions]]"
  - "[[security]]"
confidence: proven
wave: "80"
affected_files:
  - server/routes/
  - server/circuit-routes/
  - server/routes/auth-middleware.ts
---

# a CI gate for route ownership middleware would break the IDOR recurrence cycle

IDOR (Insecure Direct Object Reference) vulnerabilities have recurred across 4 distinct audit cycles in ProtoPulse: the Codex audit, Wave A ownership guards, Waves 52-53 security hardening, and Wave 80 gap audit. Each time, the root cause is the same — new Express routes are added without `requireProjectOwnership` middleware in the chain, and the gap isn't caught until the next security sweep. This is the specific enforcement failure that [[security-vulnerabilities-recur-because-new-routes-are-added-without-systematic-ownership-audit]] documents across multiple audit cycles.

The pattern is structural, not personnel: the default route registration template doesn't enforce ownership, so every new route is a potential IDOR by omission. Manual audits will always play catch-up because the creation rate (5-7 routes per wave) outpaces the audit frequency — a direct consequence of [[wave-based-development-enables-rapid-shipping-but-creates-integration-debt|wave-based development prioritizing vertical slices over cross-cutting concerns]].

A pre-submit CI gate — either an ESLint rule or a shell script scanning for `app.get`, `app.post`, `app.put`, `app.patch`, `app.delete` registrations — that verifies either `requireProjectOwnership` or `requireCircuitOwnership` appears in the middleware chain would convert this from a recurring audit finding into a build failure. The codebase uses two ownership middleware variants: `requireProjectOwnership` for `/api/projects/:projectId/...` routes and `requireCircuitOwnership` for `/api/circuits/:circuitId/...` routes (the latter resolves circuit→project→owner). The gate must check for either. Exceptions would need a maintained whitelist for genuinely public routes (login, register, health check). This automates for security what [[definition-of-done-must-include-cross-tool-link-verification]] does for integration: shifting verification left so gaps are caught at creation time, not in retrospective audits.

This is the automation version of "make the right thing easy and the wrong thing hard." The gate itself must be maintained as route patterns evolve, but the maintenance cost is far lower than recurring security audits. Where [[gap-audits-that-compare-code-surfaces-against-backlog-produce-higher-signal-findings-than-code-only-audits|gap audits catch drift retroactively]], this gate prevents one category of drift proactively.

**Limitation:** The gate only covers HTTP route middleware. [[in-memory-server-state-is-an-authorization-bypass-because-it-shares-a-single-namespace-across-all-users-and-projects|In-memory state sharing]] and [[collaboration-without-explicit-membership-is-a-silent-data-exposure-because-default-editor-assignment-bypasses-invite-controls|WebSocket collaboration bypasses (where default editor assignment skips invite controls)]] operate outside the route registration pattern and would need separate enforcement mechanisms — the collaboration gap specifically requires a `project_members` table as [[phased-collaboration-delivery-must-sequence-session-hardening-before-membership-before-branching-because-each-layer-depends-on-the-one-below|Layer 2 in the collaboration delivery sequence]]. Similarly, the [[localstorage-features-follow-an-identical-five-step-migration-to-server-scoped-storage|localStorage-to-server migration playbook]] requires ownership middleware in step 3 — the CI gate would automatically enforce compliance with that playbook for any new server routes.

---

Related:
- [[five-architecture-decisions-block-over-30-downstream-features-each]] — auth infrastructure is one of the blocking decisions
- [[ai-chat-endpoints-accepting-projectid-in-the-request-body-instead-of-the-url-path-bypass-ownership-middleware-by-construction]] — body-param routes are the class of IDOR this gate cannot catch
- [[security-vulnerabilities-recur-because-new-routes-are-added-without-systematic-ownership-audit]] — documents the recurrence pattern this gate would break
- [[idor-vulnerabilities-cluster-in-routes-that-use-global-resource-ids-instead-of-project-scoped-url-paths]] — the specific vulnerability class the gate would enforce against
- [[wave-based-development-enables-rapid-shipping-but-creates-integration-debt]] — the development model that creates the conditions for recurring IDOR gaps
- [[definition-of-done-must-include-cross-tool-link-verification]] — the manual process analog: both shift verification left
- [[gap-audits-that-compare-code-surfaces-against-backlog-produce-higher-signal-findings-than-code-only-audits]] — gap audits catch drift retroactively; this gate prevents one category proactively
- [[in-memory-server-state-is-an-authorization-bypass-because-it-shares-a-single-namespace-across-all-users-and-projects]] — a bypass channel outside the gate's scope
- [[localstorage-features-follow-an-identical-five-step-migration-to-server-scoped-storage]] — step 3 of the playbook requires ownership middleware, making the gate a compliance enforcer
- [[collaboration-without-explicit-membership-is-a-silent-data-exposure-because-default-editor-assignment-bypasses-invite-controls]] — a bypass channel outside the gate's scope: WebSocket rooms ignore HTTP ownership middleware
- [[phased-collaboration-delivery-must-sequence-session-hardening-before-membership-before-branching-because-each-layer-depends-on-the-one-below]] — the collaboration delivery sequence that would close the WebSocket bypass gap this gate cannot cover

Areas:
- [[architecture]]
- [[bug-patterns]]
- [[conventions]]
- [[security]]
