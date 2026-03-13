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

## Topics

- [[index]]
