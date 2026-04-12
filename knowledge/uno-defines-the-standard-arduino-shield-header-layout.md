---
description: "The Uno R3 IS the reference form factor for the Arduino shield ecosystem -- shield manufacturers design for this header layout first, and the Mega extends it while keeping Uno-position pins identical"
type: claim
source: "docs/parts/arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[shields]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# Uno defines the standard Arduino shield header layout that all shields target first

The Arduino Uno R3 is the reference board for the shield ecosystem. Its header layout -- digital D0-D13, analog A0-A5, power header (Vin, GND, 5V, 3.3V, RESET, IOREF), and ICSP -- is the standard that shield manufacturers target first. When you see "Arduino shield" in a product listing, it means "fits the Uno header spacing."

The Mega maintains compatibility by placing its first 14 digital pins and 6 analog pins in the exact same positions as the Uno's headers, including the deliberate 160mil gap between D7 and D8. The Mega then extends the headers with additional pins (D22-D53, A8-A15) on two double-row connectors. This backward compatibility is why most Uno shields physically fit the Mega -- though pin function differences (especially SPI on D50-D53 vs D10-D13) can break functionality.

The IOREF pin (introduced in R3) lets shields auto-detect the board's logic voltage (5V for Uno/Mega, 3.3V for Due). This is the Arduino project's mechanism for forward compatibility with different voltage platforms.

**ProtoPulse implication:** When the BOM contains a shield and an MCU board, the DRC should first verify physical header compatibility (Uno layout vs non-standard), then check functional compatibility (pin assignments, SPI routing, voltage levels).

---

Relevant Notes:
- [[mega-2560-pin-7-8-gap-for-shield-compatibility]] -- the 160mil gap exists specifically to preserve Uno shield fit
- [[shield-pin-conflicts-are-invisible-until-stacking-fails]] -- physical fit does not guarantee electrical compatibility
- [[mega-spi-pins-move-from-d10-d13-to-d50-d53-breaking-hardcoded-uno-code-silently]] -- Mega maintains physical fit but breaks SPI pin assumptions

Topics:
- [[microcontrollers]]
- [[shields]]
- [[eda-fundamentals]]
