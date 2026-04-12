---
description: "KY-022, IR-01, and OSEPP IRR-01 are the same TSOP1738-equivalent IC on different breakout boards — BOM consolidation should treat them as one line item, not three"
type: claim
source: "docs/parts/generic-ir-receiver-module-38khz-demodulator.md"
confidence: proven
topics:
  - "[[communication]]"
  - "[[breadboard-intelligence]]"
related_components:
  - "ky-022-ir-receiver"
  - "osepp-irr-01"
  - "ir-01-receiver"
  - "tsop1738"
---

# Kit IR receiver modules from different manufacturers are functionally identical TSOP 38kHz demodulators

The inventory contains 5 IR receiver modules across 3 product labels: KY-022 (x2), IR-01 (x2), and OSEPP IRR-01 (x1). Despite different silk screening, branding, and packaging, they are all the same circuit: a TSOP1738-equivalent IC on a 3-pin breakout board (GND, VCC, Signal). The IC, pinout, carrier frequency (38kHz), voltage range (2.7-5.5V), and output behavior (active-LOW demodulated) are identical.

**Why this matters:**

1. **BOM consolidation:** ProtoPulse should recognize these as interchangeable parts and consolidate them into a single BOM line item with quantity 5, not three separate entries with quantities 2/2/1. The "smart BOM" should match by function (38kHz IR demodulator, 3-pin, TSOP-equivalent) rather than by exact product label.

2. **Bench coach guidance:** Any tutorial, wiring diagram, or AI guidance written for one variant applies to all. The coach should say "connect your IR receiver" without needing to ask which brand.

3. **Procurement pattern:** Chinese breakout boards with different silk prints are frequently identical circuits with identical ICs. This is a recurring pattern across the inventory (CH340 USB-serial boards, motor driver boards, relay modules) — the IC matters, the board branding doesn't.

**Detection heuristic for ProtoPulse:** When two BOM items share the same interface (GPIO), same voltage range, same primary IC family, and same function, prompt the user: "These appear to be the same component under different product names. Consolidate?"

---

Relevant Notes:
- [[all-procurement-data-is-ai-fabricated]] — procurement/part equivalence is a domain where AI must reason carefully
- [[ch340-usb-serial-driver-support-varies-by-os-and-most-modern-systems-include-it-natively]] — same pattern: different board labels, same underlying IC

Topics:
- [[communication]]
- [[breadboard-intelligence]]
