---
summary: Demo pricing data with real-looking UI actively undermines user trust — honest DEMO badges first, real integrations later
areas: ["[[index]]"]
related insights:
  - "[[architecture-expansion-using-placeholder-first-pin-mapping-produces-semantically-wrong-schematics-that-erode-trust-in-ai-generated-designs]] — another instance of authoritative-looking output that is actually wrong"
  - "[[the-perception-gap-between-simulation-capability-and-usability-is-the-biggest-competitive-threat]] — trust and perception are tightly coupled: visible fake data erodes perception of real capabilities"
  - "[[the-maker-to-professional-spectrum-is-the-fundamental-ux-tension]] — beginners are especially harmed by fake data because they cannot distinguish real from mock"
created: 2026-03-13
---

ProtoPulse's supplier pricing features initially shipped with hardcoded mock data displayed in professional-looking UI. This created false confidence — users couldn't distinguish real from fake quotes. The fix was DEMO badges (BL-0485) making the mock nature explicit.

Two additional instances of the same trust erosion pattern emerged: (1) supplier-api.ts serves mock pricing data through professional UI without DEMO badges in some views, meaning the badge fix was incomplete. (2) Architecture-to-schematic expansion uses each component's first pin as a placeholder connection, producing schematics that are logically connected but electrically wrong — the right components exist but pin connections are meaningless. For a tool targeting makers learning electronics, this is actively harmful: it produces authoritative-looking output that trains users to distrust AI-generated designs.

The insight generalizes: demo data that looks real is worse than no data at all, because it trains users to distrust the tool's output even after real integrations ship. Every mock, placeholder, and approximation must be visually distinguishable from real data.

## Topics

- [[index]]
