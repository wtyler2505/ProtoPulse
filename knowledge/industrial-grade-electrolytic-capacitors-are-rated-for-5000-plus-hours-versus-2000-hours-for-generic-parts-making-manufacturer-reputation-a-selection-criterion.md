---
description: "CDE, Rubycon, Nichicon electrolytics start at 5000+ hour rated life versus 2000 hours for generic/no-name parts -- the temperature derating rule (every 10C halves lifespan) amplifies this baseline gap exponentially"
type: knowledge-note
source: "docs/parts/381383-cde-aluminum-electrolytic-capacitor-axial-high-voltage.md"
topics:
  - "[[passives]]"
  - "[[power-systems]]"
confidence: high
verified: false
---

# Industrial-grade electrolytic capacitors are rated for 5000 plus hours versus 2000 hours for generic parts making manufacturer reputation a selection criterion

Aluminum electrolytic capacitor lifespan is specified in hours at rated temperature. This number varies dramatically by manufacturer and product line:

| Tier | Examples | Rated Life | Typical Applications |
|------|----------|-----------|---------------------|
| Industrial | CDE 381LX, Rubycon MXR, Nichicon PW | 5000-10000 hrs | UPS, industrial PSU, professional audio |
| Standard | Panasonic ECA, Rubycon ZLH | 2000-5000 hrs | Consumer electronics, hobby boards |
| Generic | No-name kits, unmarked | 1000-2000 hrs | Disposable, non-critical |

**Why the baseline matters exponentially:** The Arrhenius rule (every 10C above rated temperature halves lifespan) applies as a multiplier on the rated life. A 5000-hour cap at 85C running at 65C gets `5000 x 2^2 = 20,000 hours` (~2.3 years continuous). A 2000-hour generic cap in the same conditions gets `2000 x 2^2 = 8,000 hours` (~11 months). The quality gap is a 2.5x baseline that compounds through temperature derating.

**How to assess quality tier from a part:**
1. **Named manufacturer with datasheet** -- look up the specific series. CDE, Rubycon, Nichicon, Panasonic, United Chemi-Con are the reputable names.
2. **Kit/no-name parts** -- assume 2000 hours at rated temperature. Design with generous temperature margins.
3. **Surplus/unknown provenance** -- assume worst case. Consider reforming before use (see dormant electrolytic reforming).

**ProtoPulse implication:** When the bench coach recommends an electrolytic capacitor, flagging the manufacturer quality tier helps beginners understand why a $0.50 Rubycon outlasts a $0.05 generic even at identical specs. BOM cost recommendations should note that premium caps pay for themselves in reliability for any design expected to run continuously.

---

Source: [[381383-cde-aluminum-electrolytic-capacitor-axial-high-voltage]]

Relevant Notes:
- [[every-10c-above-rated-temperature-halves-aluminum-electrolytic-capacitor-lifespan]] -- the derating rule that amplifies baseline quality differences
- [[dormant-aluminum-electrolytics-require-reforming-before-full-voltage-application]] -- especially relevant for surplus/unknown-provenance caps

Topics:
- [[passives]]
- [[power-systems]]
