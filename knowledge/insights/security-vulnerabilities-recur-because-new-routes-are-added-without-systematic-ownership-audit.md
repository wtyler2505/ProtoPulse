---
summary: IDOR gaps recurred 3 times (Codex audit, Waves 52-53, Wave 80) because no CI gate checks new Express routes for ownership middleware
areas: ["[[index]]"]
created: 2026-03-13
---

ProtoPulse's IDOR vulnerabilities keep recurring not because fixes are wrong but because new routes are added without systematic verification. The recurrence spans four distinct audit cycles: the Codex audit (25 P0 items), Wave A (100+ routes fixed), Waves 52-53 (timing-safe admin, SQL wildcard escaping, SVG sanitization, ZIP bomb protection), and Wave 80 (more gaps in chat endpoints, circuit routes, and batch analysis). Each wave fixes the known gaps, but the next wave of feature development adds new routes without ownership middleware. A pre-submit gate that flags new Express route registrations without ownership middleware would break the cycle.

## Topics

- [[index]]
