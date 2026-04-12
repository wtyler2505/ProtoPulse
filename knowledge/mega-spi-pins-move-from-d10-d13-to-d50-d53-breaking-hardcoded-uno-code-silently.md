---
description: "SPI.h handles the hardware pin remapping, but any hardcoded pin references (bit-banged SPI, manual digitalWrite) break without error on the Mega"
type: claim
source: "docs/parts/arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# Mega SPI pins move from D10-D13 to D50-D53 breaking hardcoded Uno code silently

The ATmega2560 maps its hardware SPI peripheral to D50 (MISO), D51 (MOSI), D52 (SCK), and D53 (SS) -- completely different from the Uno/Nano's D10-D13. The Arduino `SPI.h` library handles this transparently at compile time, so any library-based SPI communication works on either board without changes. The trap is code that hardcodes pin numbers: `digitalWrite(11, data)` for bit-banged SPI, or manually controlling D10 as SS. That code compiles, uploads, and does nothing useful -- D10-D13 on the Mega are plain digital pins with no SPI function.

This is the single most common porting bug when moving Arduino code from Uno to Mega. The failure mode is particularly insidious because there's no compile error, no runtime error, and no visible symptom beyond "SPI device doesn't respond." A beginner who doesn't know that SPI pins are MCU-specific will spend hours debugging the wrong thing.

The portable solution is the ICSP header, a 6-pin connector present on both boards in the same physical position. Shields that route SPI through the ICSP header (like the Ethernet shield) work on both Uno and Mega without modification. Shields that use D10-D13 for SPI will not work on Mega without rewiring.

**ProtoPulse implication:** When a BOM contains both a Mega and any SPI device, the DRC should verify that SPI connections reference D50-D53 (not D10-D13) and flag any hardcoded pin references in associated code or schematic nets.

---

Relevant Notes:
- [[mega-2560-four-hardware-uarts]] -- another Mega-specific peripheral mapping difference from the Uno
- [[mega-2560-pin-7-8-gap-for-shield-compatibility]] -- physical layout differences compound the porting confusion
- [[shield-pin-conflicts-are-invisible-until-stacking-fails]] -- shields using ICSP for SPI avoid the pin remapping problem

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
