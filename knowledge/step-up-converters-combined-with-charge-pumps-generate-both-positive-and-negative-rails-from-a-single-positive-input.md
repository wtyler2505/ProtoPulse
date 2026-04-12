---
description: "Boost converters produce positive rails above input voltage (AVDD, VGH), while charge pump inversion produces negative rails (VGL) -- this boost + charge pump topology is the standard approach for generating the full voltage range TFT-LCD panels need from a single positive input"
type: knowledge-note
source: "docs/parts/max17113-tft-lcd-pmic-generates-all-supply-rails-for-lcd-panels.md"
topics:
  - "[[power-systems]]"
confidence: high
verified: false
---

# Step-up converters combined with charge pumps generate both positive and negative rails from a single positive input

The MAX17113 exemplifies a common topology pattern for generating multiple rails from a single positive input (typically 3.3V or 5V from the MCU's supply):

| Topology | Output | How It Works |
|----------|--------|-------------|
| Boost (step-up) converter | AVDD (+9V to +15V) | Inductor charges, switch opens, flyback voltage adds to input |
| Boost converter | VGH (+15V to +30V) | Same principle, higher duty cycle or cascaded stage |
| Charge pump inverter | VGL (-5V to -12V) | Flying capacitor alternately charges to positive rail then inverts |
| Buffered output | VCOM (panel-specific) | Op-amp or regulator derived from AVDD, SPI-adjustable |

**The generalizable pattern:** Whenever you need both positive-above-input and negative-below-ground rails from a single positive supply, the combination of boost converter (for positive) and charge pump inversion (for negative) is the standard approach. This pattern appears in:
- LCD panel power supplies (the primary use case)
- Op-amp dual-rail supplies from single supply
- Audio amplifier bipolar supplies
- Any circuit requiring symmetrical positive/negative rails

**Why charge pump for negative instead of a buck-boost?** Charge pumps are simpler (no inductor), have lower EMI (no switching inductor), and the negative rail current requirements for LCD gate drivers are typically low (milliamps). A buck-boost would be oversized and noisy for this application.

**Trade-off:** Charge pumps have poor regulation under varying load (output impedance is higher than inductor-based converters). This is acceptable for LCD gate drivers because VGL load is relatively constant during normal operation.

---

Relevant Notes:
- [[tft-lcd-panels-require-four-distinct-voltage-rails-serving-different-panel-subsystems]] -- The four rails this topology serves
- [[multi-rail-pmics-still-require-external-inductors-capacitors-and-diodes-per-rail-and-are-not-standalone-solutions]] -- External components needed for each converter stage

Topics:
- [[power-systems]]
