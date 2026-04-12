---
description: "Unlike AVDD/VGH/VGL which have typical values across panel families, VCOM varies per panel model and must be set from the specific LCD panel's documentation -- no universal default exists, and wrong VCOM produces washed-out or flickering display"
type: knowledge-note
source: "docs/parts/max17113-tft-lcd-pmic-generates-all-supply-rails-for-lcd-panels.md"
topics:
  - "[[power-systems]]"
  - "[[displays]]"
confidence: high
verified: false
---

# VCOM voltage is panel-specific and requires the LCD panel's own datasheet to calibrate

VCOM (common electrode voltage) is the DC bias applied to the transparent common electrode that faces all pixels in a TFT-LCD panel. Its value determines the midpoint of the AC waveform that drives each pixel, and it must be calibrated to the specific panel's liquid crystal characteristics.

**Why VCOM is different from the other rails:**
- AVDD, VGH, VGL have typical ranges that apply broadly across panel families (e.g., AVDD is usually 9-15V)
- VCOM is specified to millivolt precision per panel model (e.g., one panel might need -1.23V while another from the same manufacturer needs -0.87V)

**What wrong VCOM looks like:**
- VCOM too high: image appears washed out, low contrast, possible DC stress on liquid crystal (shortens panel life)
- VCOM too low: image appears too dark, possible flicker visible at certain gray levels
- VCOM way off: visible flicker across the entire panel, especially noticeable on uniform gray areas

**Calibration approach:** PMICs like the MAX17113 provide SPI-adjustable VCOM output. The calibration procedure is: display a uniform gray screen, adjust VCOM until flicker disappears, then lock the value in firmware or EEPROM. Some panel datasheets give the target value directly; others only specify a range that requires visual calibration.

**Maker gotcha:** If you salvage a TFT panel without its datasheet, VCOM must be determined empirically. Without calibration, the panel may appear to "not work" when in fact only VCOM is wrong.

---

Relevant Notes:
- [[tft-lcd-panels-require-four-distinct-voltage-rails-serving-different-panel-subsystems]] -- VCOM is one of the four required rails
- [[lcd-panel-power-rail-sequencing-on-power-up-and-power-down-prevents-latch-up-damage]] -- VCOM must also participate in correct sequencing

Topics:
- [[power-systems]]
- [[displays]]
