---
summary: Each wave ships 5-7 features vertically but systematically defers horizontal integration, requiring periodic integration-only waves
areas: ["[[index]]"]
related insights:
  - "[[the-gap-between-feature-exists-and-feature-is-wired-is-the-dominant-source-of-broken-workflows]] — the user-visible consequence of deferred integration"
  - "[[localstorage-backed-features-are-invisible-technical-debt-because-they-look-shipped-but-break-on-any-multi-device-or-collaboration-scenario]] — the most insidious form of integration debt: features that look done but aren't durable"
  - "[[definition-of-done-must-include-cross-tool-link-verification]] — the process fix that prevents future integration debt"
  - "[[security-vulnerabilities-recur-because-new-routes-are-added-without-systematic-ownership-audit]] — security is another cross-cutting concern deferred by vertical slices"
  - "[[cross-tool-integration-is-the-hardest-category-because-it-requires-shared-source-of-truth-decisions]] — integration forces deferred data ownership questions to the surface"
created: 2026-03-13
---

ProtoPulse's wave model ships features as complete vertical slices — from schema to storage to route to hook to UI. This enables rapid delivery (79 waves, 197 done items) but creates integration debt because cross-domain wiring is deferred.

Three forms of integration debt have been identified: (1) **Unwired libraries** — Wave 37 wired 24 unintegrated library modules into the UI across 5 new ViewModes and 8 panels (6400 lines of pure wiring, zero new logic). (2) **Discovery debt** — Wave 56 verified 20 P1 items "already done" because no one knew the feature existed. (3) **localStorage-only persistence** — 6+ features (Kanban, design variables, DRC scripts, shortcuts, community collections, PCB ordering history) are wired to UI and discoverable but store state exclusively in localStorage, silently breaking on multi-device, collaboration, and backup/restore scenarios. This third form is the most insidious because it passes visual inspection.

The pattern suggests integration waves should be scheduled proactively and should audit all three debt categories, not just missing UI wiring.

## Topics

- [[index]]
