---
description: "AVDD powers source drivers, VGH/VGL drive gate-high/gate-low for TFT gate drivers, VCOM sets the common electrode -- each rail serves a different physical subsystem and all four must be present for the panel to function"
type: knowledge-note
source: "docs/parts/max17113-tft-lcd-pmic-generates-all-supply-rails-for-lcd-panels.md"
topics:
  - "[[power-systems]]"
  - "[[displays]]"
confidence: high
verified: false
---

# TFT-LCD panels require four distinct voltage rails serving different panel subsystems

A TFT-LCD panel is not a single-supply device. It requires four separate voltage rails, each serving a different physical subsystem:

| Rail | Typical Range | Function |
|------|--------------|----------|
| AVDD | +9V to +15V | Powers the source (column) drivers that set pixel voltage |
| VGH | +15V to +30V | Gate-high voltage for TFT gate drivers (turns pixel TFTs on) |
| VGL | -5V to -12V | Gate-low voltage for TFT gate drivers (turns pixel TFTs off) |
| VCOM | Panel-specific | Common electrode voltage (AC-coupled reference for all pixels) |

The key insight is that VGH and VGL are the swing voltages for the gate driver -- the gate must swing between a positive voltage (VGH) above the source voltage to fully turn on the TFT, and a negative voltage (VGL) below ground to fully turn it off. Partial gate voltages produce incomplete switching, which appears as ghosting, pixel leakage, or washed-out contrast.

AVDD is the source driver supply and is typically the first rail to come up. VCOM is an AC-coupled DC bias that must be calibrated per panel model (see [[vcom-voltage-is-panel-specific-and-requires-the-lcd-panels-own-datasheet-to-calibrate]]).

**ProtoPulse implication:** When a TFT panel appears in a project, the DRC should verify that all four rails are present in the power architecture, not just a single supply.

---

Relevant Notes:
- [[vcom-voltage-is-panel-specific-and-requires-the-lcd-panels-own-datasheet-to-calibrate]] -- VCOM is the one rail that cannot be guessed
- [[lcd-panel-power-rail-sequencing-on-power-up-and-power-down-prevents-latch-up-damage]] -- Sequencing these rails incorrectly causes permanent damage
- [[step-up-converters-combined-with-charge-pumps-generate-both-positive-and-negative-rails-from-a-single-positive-input]] -- How a single-input PMIC produces all four rails

Topics:
- [[power-systems]]
- [[displays]]
