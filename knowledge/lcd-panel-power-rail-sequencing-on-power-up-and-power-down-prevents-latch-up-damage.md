---
description: "Power-on and power-off order for TFT-LCD rails (AVDD, VGH, VGL, VCOM) is critical -- wrong sequencing triggers latch-up, a parasitic thyristor condition that can permanently destroy the panel with no visible warning beforehand"
type: knowledge-note
source: "docs/parts/max17113-tft-lcd-pmic-generates-all-supply-rails-for-lcd-panels.md"
topics:
  - "[[power-systems]]"
  - "[[displays]]"
confidence: high
verified: false
---

# LCD panel power rail sequencing on power-up and power-down prevents latch-up damage

TFT-LCD panels contain CMOS gate driver circuits that are susceptible to latch-up -- a parasitic thyristor structure that, once triggered, creates a low-impedance path between supply rails, drawing destructive current. Latch-up is triggered when internal junctions are forward-biased by incorrect voltage relationships between rails.

**The sequencing constraint:** The panel datasheet specifies both power-on and power-off rail ordering. A typical sequence is:

- **Power-on:** AVDD first, then VGH/VGL, then VCOM, then backlight
- **Power-off:** Reverse order -- backlight off, VCOM discharged, VGH/VGL off, AVDD off

The exact timing (delays between rails) and order varies per panel. The datasheet timing diagrams are not optional -- they are the specification for preventing latch-up.

**Why this matters for makers:** Dedicated LCD PMICs like the MAX17113 handle sequencing internally via their soft-start logic. But if you are building a power supply from discrete regulators, or hot-plugging a panel, or debugging with lab supplies brought up one at a time, you can easily violate the sequencing constraint. The panel may work fine 9 times and latch-up on the 10th power cycle, making the failure intermittent and confusing.

**Power-down sequencing is equally critical** and often overlooked. If AVDD drops before VGL, the gate driver can latch up during shutdown, damaging the panel even though the system was turning off.

---

Relevant Notes:
- [[tft-lcd-panels-require-four-distinct-voltage-rails-serving-different-panel-subsystems]] -- The four rails that must be sequenced
- [[multi-rail-pmics-still-require-external-inductors-capacitors-and-diodes-per-rail-and-are-not-standalone-solutions]] -- PMICs handle sequencing but add BOM complexity

Topics:
- [[power-systems]]
- [[displays]]
