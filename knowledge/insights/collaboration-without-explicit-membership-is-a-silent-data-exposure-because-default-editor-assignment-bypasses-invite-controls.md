---
summary: The WebSocket collaboration system assigns non-owners editor role by default with no invite/membership table, letting any authenticated user edit any project they connect to
category: bug-pattern
areas: ["[[index]]"]
related insights:
  - "[[idor-vulnerabilities-cluster-in-routes-that-use-global-resource-ids-instead-of-project-scoped-url-paths]] — the HTTP-layer authorization pattern this WebSocket gap bypasses"
  - "[[in-memory-server-state-is-an-authorization-bypass-because-it-shares-a-single-namespace-across-all-users-and-projects]] — another non-database authorization bypass through shared runtime state"
  - "[[phased-collaboration-delivery-must-sequence-session-hardening-before-membership-before-branching-because-each-layer-depends-on-the-one-below]] — the membership table this gap requires is Layer 2 in the collaboration delivery sequence"
  - "[[a-ci-gate-for-route-ownership-middleware-would-break-the-idor-recurrence-cycle]] — explicitly identifies this WebSocket gap as a bypass channel outside the CI gate's scope"
created: 2026-03-13
---

ProtoPulse's WebSocket collaboration system has an access control design gap at the collaboration layer. When a non-owner connects to a project room, they are assigned `editor` role by default. There is no persistent invite or membership table that would gate access. Any authenticated user who knows (or guesses) a project room ID can connect and receive full editing privileges. This is distinct from IDOR vulnerabilities — the HTTP API may correctly check project ownership, but the WebSocket collaboration layer bypasses those checks entirely. The fix requires a `project_members` table with explicit invite/accept workflow, where the collaboration server checks membership before granting any role.

## Topics

- [[index]]
