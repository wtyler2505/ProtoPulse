---
description: "Display and LED knowledge -- TFT/OLED/LCD protocols, 7-segment multiplexing, LED matrix driving, NeoPixel timing, and display controller selection"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# displays

Display protocols, driver ICs, multiplexing strategies, and visual feedback design for the inventory. Covers TFT SPI, I2C OLED, parallel character LCD, 7-segment, LED matrices, NeoPixels, and touchscreens.

## Knowledge Notes
- [[display-type-determines-interface-protocol-and-driver-ic-which-together-set-library-and-pin-count]] — display selection is a dependency chain, not a feature comparison
- [[most-maker-displays-accept-3v3-5v-but-character-lcds-and-7-segments-are-5v-only-gotchas]] — HD44780 and raw 7-segments are 5V-only, a trap for ESP32/Pi Pico users
- [[max7219-is-the-universal-led-display-driver-for-both-matrices-and-7-segments]] — one IC, two display types, cascading support

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]
