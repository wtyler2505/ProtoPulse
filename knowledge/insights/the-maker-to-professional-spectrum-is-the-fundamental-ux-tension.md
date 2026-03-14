---
summary: Simplifying for beginners risks hiding capabilities from experts — ProtoPulse must serve both someone learning electronics and someone generating Gerbers
category: architectural-decision
areas: ["[[index]]"]
related insights:
  - "[[the-perception-gap-between-simulation-capability-and-usability-is-the-biggest-competitive-threat]] — the perception gap is worst for beginners who cannot tell the difference"
  - "[[manufacturing-trust-requires-real-data-because-fake-confidence-is-worse-than-no-confidence]] — beginners are especially harmed by fake data because they cannot distinguish real from mock"
  - "[[architecture-expansion-using-placeholder-first-pin-mapping-produces-semantically-wrong-schematics-that-erode-trust-in-ai-generated-designs]] — wrong pin mapping is actively harmful to learners who trust the output"
  - "[[browser-based-eda-hits-a-platform-boundary-at-firmware-execution]] — zero-install accessibility serves beginners; hardware access serves pros"
created: 2026-03-13
---

ProtoPulse's target spans from "someone still learning what a capacitor does" to "someone generating production Gerbers." Every UX decision sits on this spectrum. A simulation start button that auto-detects circuit type serves beginners but frustrates experts who want specific parameter control. The TinkerCAD parity analysis revealed this as the fundamental tension: accessibility and power are in genuine conflict, not just cosmetic tradeoffs.

- [[every-component-must-define-geometry-three-times-because-the-triple-view-architecture-couples-identity-to-representation]] — beginners expect one placement = visible everywhere; pros expect separate symbol/footprint editors; triple-view embodies this tension
- [[progressive-disclosure-hides-downstream-views-until-architecture-nodes-exist-preventing-empty-state-errors]] — progressive disclosure directly addresses the onboarding side: hide complexity until the user is ready
- [[drc-explanations-embed-pedagogical-content-directly-in-the-engine-making-the-validation-system-a-teaching-tool-not-just-a-checker]] — pedagogical DRC serves the maker end: beginners learn from violations instead of being confused
- [[errorboundary-suppresses-resizeobserver-loop-errors-because-they-are-benign-browser-noise-that-would-crash-every-canvas-view]] — beginners interpret crash screens as "broken tool"; pros recognize benign browser noise — this filter exists for the maker end

## Topics

- [[index]]
