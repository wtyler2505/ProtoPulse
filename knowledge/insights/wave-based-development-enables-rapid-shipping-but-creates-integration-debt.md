---
summary: Each wave ships 5-7 features vertically but systematically defers horizontal integration, requiring periodic integration-only waves
areas: ["[[index]]"]
created: 2026-03-13
---

ProtoPulse's wave model ships features as complete vertical slices — from schema to storage to route to hook to UI. This enables rapid delivery (79 waves, 197 done items) but creates integration debt because cross-domain wiring is deferred. Wave 37 was entirely remediation, wiring 24 unintegrated library modules into the UI across 5 new ViewModes and 8 panels (6400 lines of pure wiring, zero new logic). Wave 56 revealed a subtler form of integration debt: discovery debt — 20 P1 items were verified "already done" because no one knew the feature existed. The pattern suggests integration debt includes both missing wiring and missing awareness.

## Topics

- [[index]]
