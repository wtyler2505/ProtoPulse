---
description: "Microcontroller knowledge -- specs, GPIO gotchas, peripheral mapping, clone differences, and selection criteria for Arduino, ESP32, RPi, and others"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# microcontrollers

Specs, gotchas, and selection criteria for microcontrollers and single-board computers in the inventory. Covers pin mapping, voltage levels, peripheral availability, clone compatibility, and platform-specific traps.

## Knowledge Notes
- [[most-maker-displays-accept-3v3-5v-but-character-lcds-and-7-segments-are-5v-only-gotchas]] — 5V display gotchas for 3.3V MCU users (ESP32, Pi Pico)
- [[mega-spi-pins-move-from-d10-d13-to-d50-d53-breaking-hardcoded-uno-code-silently]] — #1 Uno-to-Mega porting gotcha, silent SPI failure
- [[mega-5v-regulator-thermal-math-constrains-input-voltage-to-7-9v]] — linear regulator heat limits practical Vin to 7-9V
- [[mega-3v3-output-limited-to-50ma-cannot-power-wifi-or-bluetooth-modules]] — 3.3V pin too weak for ESP/BT modules

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]
