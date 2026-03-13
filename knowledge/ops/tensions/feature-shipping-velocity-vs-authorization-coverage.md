---
summary: Each wave adds routes that may lack ownership middleware — shipping fast means security audits are always playing catch-up
type: tension
created: 2026-03-13
status: dissolved
dissolved_reason: Dissolved by [[a CI gate for route ownership middleware would break the IDOR recurrence cycle]] — automated CI enforcement eliminates the velocity-vs-coverage tradeoff
---

ProtoPulse ships features in waves of 5-7 vertical slices, each potentially adding new Express routes. Security audits (Codex audit, Waves A/52-53/80) consistently find IDOR gaps in recently-added routes because ownership middleware isn't part of the default route template. Slowing down to audit every route pre-merge would extend wave delivery time. A CI gate that flags route registrations without ownership middleware could resolve this tension, but the gate itself must be maintained and kept current with evolving route patterns. The fundamental tension: velocity creates security gaps, but security gates create velocity friction.
