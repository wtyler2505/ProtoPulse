---
summary: The WebSocket collaboration system assigns non-owners editor role by default with no invite/membership table, letting any authenticated user edit any project they connect to
areas: ["[[index]]"]
created: 2026-03-13
---

ProtoPulse's WebSocket collaboration system has an access control design gap at the collaboration layer. When a non-owner connects to a project room, they are assigned `editor` role by default. There is no persistent invite or membership table that would gate access. Any authenticated user who knows (or guesses) a project room ID can connect and receive full editing privileges. This is distinct from IDOR vulnerabilities — the HTTP API may correctly check project ownership, but the WebSocket collaboration layer bypasses those checks entirely. The fix requires a `project_members` table with explicit invite/accept workflow, where the collaboration server checks membership before granting any role.

## Topics

- [[index]]
