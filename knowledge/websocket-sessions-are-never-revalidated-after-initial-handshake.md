---
description: "CollaborationServer validates session only during HTTP Upgrade — revoked users retain full read/write access until the socket drops"
type: debt-note
source: "conductor/comprehensive-audit.md §18"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["server/collaboration.ts"]
---

# WebSocket sessions are never revalidated after the initial handshake so revoked users keep full access

The `CollaborationServer` authenticates users strictly during the initial HTTP Upgrade handshake (`validateWsSession`). There is no continuous polling or re-validation of the session token. If a user's access is revoked or they are kicked from a project, their existing WebSocket connection remains fully active — they can continue reading and mutating project state indefinitely until the socket drops.

---

Relevant Notes:
- [[cors-origin-reflection-was-a-critical-csrf-vector]] -- auth boundary gaps compound

Topics:
- [[architecture-decisions]]
