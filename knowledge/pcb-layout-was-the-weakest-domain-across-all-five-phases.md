---
description: "PCB design rated 'Missing' or 'Critical' in every analysis phase — the single biggest competitive gap"
type: insight
source: "docs/product-analysis-report.md"
confidence: proven
topics: ["[[competitive-landscape]]", "[[eda-fundamentals]]"]
---

# PCB layout was the weakest domain across all five analysis phases

The recurring themes table shows "PCB is the weakest domain" appears in all five phases. The competitive gap analysis rated ProtoPulse as "Missing" for PCB compared to every competitor. The PCBLayoutView component had CCN=135 (9x the danger threshold), which meant developers could not safely modify it, which meant no features could be added, which meant the gap widened.

This created an impact chain documented in the cross-phase analysis: complexity blocks modification, blocked modification blocks the autorouter, blocked autorouter blocks manual routing, blocked routing means users cannot do basic PCB design, and that means professional engineers reject the tool entirely. The PCB domain has since been substantially rebuilt through Waves 42-49, but the strategic lesson remains: a single unmaintainable file can cascade into an entire domain becoming uncompetitive.

---

Relevant Notes:
- [[god-files-create-feature-paralysis-through-complexity]] -- the root cause: PCBLayoutView CCN=135 blocked all PCB feature development
- [[flux-ai-is-the-primary-competitive-threat]] -- Flux.ai leads on PCB maturity, exploiting this gap
- [[ai-is-the-moat-lean-into-it]] -- PCB weakness drove the strategic decision to leapfrog with AI rather than chase parity
- [[no-other-eda-tool-starts-from-architecture-diagrams]] -- architecture-first compensates by offering value competitors lack entirely

Topics:
- [[competitive-landscape]]
- [[eda-fundamentals]]
