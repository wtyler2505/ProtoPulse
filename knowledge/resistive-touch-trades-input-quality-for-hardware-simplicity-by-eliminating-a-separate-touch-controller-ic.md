---
description: "Resistive touchscreens need no dedicated controller IC — the MCU reads analog voltages directly — but capacitive touch requires an IC like FT6236 or XPT2046, adding I2C/SPI bus usage, library dependency, and BOM cost"
type: claim
source: "docs/parts/2p8-inch-tft-lcd-touch-shield-ili9341-320x240-spi.md"
confidence: high
verified: false
topics:
  - "[[displays]]"
---

# resistive touch trades input quality for hardware simplicity by eliminating a separate touch controller IC

Resistive touchscreens are fundamentally analog devices — two resistive films separated by a gap, pressed together by the user's finger or stylus. The MCU reads the touch position by driving voltage across one axis and reading the analog value on the perpendicular axis. No dedicated touch controller IC is needed; the MCU's ADC and GPIO pins handle everything directly.

Capacitive touchscreens, by contrast, require a dedicated controller IC (FT6236, GT911, XPT2046 in some configurations) that processes the complex capacitance matrix and reports touch coordinates to the host MCU over I2C or SPI. This adds:
- **BOM cost**: the controller IC itself plus supporting passives
- **Bus usage**: an I2C or SPI address/CS line consumed
- **Library dependency**: a driver library for the specific controller IC
- **Complexity**: initialization sequences, interrupt handling, gesture detection

However, capacitive touch provides significantly better input quality: multi-touch support, no calibration needed per unit, works through gloves (on some controllers), no physical film wear, and better responsiveness. The Raspberry Pi official touchscreen uses capacitive 10-point multitouch that works out of the box — no calibration, no analog pins consumed.

The tradeoff is architectural: resistive touch minimizes the hardware dependency chain (no IC, no bus, no driver) at the cost of input quality and user experience. For projects where touch is secondary (a menu interface, occasional button presses), resistive is adequate. For projects where touch is primary (drawing, gestures, frequent interaction), capacitive is worth the added complexity.

---

Source: [[2p8-inch-tft-lcd-touch-shield-ili9341-320x240-spi]]

Relevant Notes:
- [[resistive-touchscreen-requires-per-unit-calibration-because-coordinate-mapping-varies-between-individual-panels]] — a direct consequence of having no dedicated controller
- [[display-type-determines-interface-protocol-and-driver-ic-which-together-set-library-and-pin-count]] — touch type adds another branch to the dependency chain

Topics:
- [[displays]]
