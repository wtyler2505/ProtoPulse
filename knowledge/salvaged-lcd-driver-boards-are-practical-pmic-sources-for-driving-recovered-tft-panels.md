---
description: "Rather than sourcing individual TQFN-40 PMICs requiring reflow soldering and custom PCBs, salvaging an intact LCD driver board preserves the PMIC plus all external passives plus correct PCB layout already working together -- inverts the normal BOM approach for makers"
type: knowledge-note
source: "docs/parts/max17113-tft-lcd-pmic-generates-all-supply-rails-for-lcd-panels.md"
topics:
  - "[[power-systems]]"
  - "[[displays]]"
confidence: medium
verified: false
---

# Salvaged LCD driver boards are practical PMIC sources for driving recovered TFT panels

When working with salvaged TFT panels, the conventional approach (source a PMIC, design a PCB, populate external passives) faces several barriers:

1. **Package**: LCD PMICs like the MAX17113 come in TQFN-40 (0.4mm pitch) -- impossible to hand-solder, requires reflow
2. **External BOM**: 15-25 external components per PMIC, each sized per the datasheet
3. **PCB layout**: Switching converter layout is sensitive to trace routing and ground planes
4. **Sequencing verification**: Must validate power-on/power-off rail ordering against panel spec

**The salvage shortcut:** If the LCD panel was removed from a working device (laptop, monitor, tablet), its driver board likely contains the PMIC + all external passives + correct PCB layout + verified sequencing, already working together. Keeping the driver board intact and interfacing with it at the input (single supply) and control (SPI/I2C) level eliminates all four barriers above.

**What to look for on a salvaged driver board:**
- PMIC IC (look for Maxim, TI, Richtek, or Realtek markings in QFN packages near inductors)
- Input power connector (usually a single 3.3V or 5V input from the main board)
- Flat flex connector to the panel (carries AVDD, VGH, VGL, VCOM + data signals)
- Backlight driver (often integrated on the same board)

**Limitation:** The salvaged board is matched to its original panel. Using it with a different panel may require VCOM recalibration and verification that VGH/VGL voltages are within the new panel's specification.

---

Relevant Notes:
- [[multi-rail-pmics-still-require-external-inductors-capacitors-and-diodes-per-rail-and-are-not-standalone-solutions]] -- The complexity that salvaging avoids
- [[vcom-voltage-is-panel-specific-and-requires-the-lcd-panels-own-datasheet-to-calibrate]] -- VCOM recalibration may be needed when reusing with different panel

Topics:
- [[power-systems]]
- [[displays]]
