---
summary: IDOR gaps recurred 3 times (Codex audit, Waves 52-53, Wave 80) because no CI gate checks new Express routes for ownership middleware
areas: ["[[index]]"]
created: 2026-03-13
---

ProtoPulse's IDOR vulnerabilities keep recurring not because fixes are wrong but because new routes are added without systematic verification. The Codex audit found 25 P0 items, Wave A fixed 100+ routes, and yet Waves 52-53 and 80 found more gaps in chat endpoints, circuit routes, and batch analysis. A pre-submit gate that flags new Express route registrations without ownership middleware would break the cycle.

## Topics

- [[index]]
