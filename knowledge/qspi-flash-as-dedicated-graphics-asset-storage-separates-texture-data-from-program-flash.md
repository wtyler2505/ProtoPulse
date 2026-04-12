---
description: "Using external QSPI flash (8MB on the M4SK) exclusively for graphical assets (eye textures, bitmaps, animations) while keeping program logic in MCU internal flash is a deliberate architecture that prevents asset bloat from crowding out code space"
type: claim
source: "docs/parts/adafruit-monster-m4sk-dual-tft-display-board-for-animated-eyes.md"
confidence: high
verified: false
topics:
  - "[[displays]]"
  - "[[microcontrollers]]"
---

# QSPI flash as dedicated graphics asset storage separates texture data from program flash

The Monster M4SK has 512KB of internal MCU flash for program code and 8MB of external QSPI flash dedicated to eye animation assets — iris patterns, sclera maps, eyelid shapes, and custom eye configurations. This is a 16:1 ratio of asset storage to code storage, reflecting a fundamental architectural decision: graphical assets and program logic have different storage needs and should not compete for the same resource.

**Why separation matters:**
- **Program flash** is precious on MCUs. The SAMD51's 512KB is generous by MCU standards but would fill quickly if bitmap assets were stored alongside code. A single 240x240 16-bit bitmap is 115KB — four eye textures would consume the entire program flash.
- **QSPI flash** is cheap external storage accessed via a high-speed (quad) SPI interface. It has slower random-access latency than internal flash but high sequential read bandwidth, which is ideal for streaming bitmap data to a display.
- **Asset updates** can happen independently of firmware updates. On the M4SK, custom eye textures are loaded onto the QSPI flash via the USB drive interface (CIRCUITPY), while firmware updates use the UF2 bootloader targeting MCU flash. A user can change the eye appearance without touching the code.

**The generalized pattern:** Any embedded project with significant graphical assets (splash screens, fonts, icons, animations) benefits from this separation. Rather than embedding bitmap arrays in program flash (the common Arduino approach via PROGMEM), dedicating external flash to assets keeps program flash available for code growth and simplifies asset management.

**Contrast with the single-flash approach:** Many maker projects (ESP32, Pico) store both code and assets in the same flash chip. This works when assets are small, but creates a zero-sum competition between code size and asset richness. The M4SK's dual-flash architecture eliminates this competition entirely.

---

Source: [[adafruit-monster-m4sk-dual-tft-display-board-for-animated-eyes]]

Relevant Notes:
- [[circuitpython-filesystem-can-consume-half-of-pico-2mb-flash]] — the single-flash problem: filesystem competes with code for the same chip
- [[display-type-determines-interface-protocol-and-driver-ic-which-together-set-library-and-pin-count]] — display driving is what creates the asset storage demand

Topics:
- [[displays]]
- [[microcontrollers]]
