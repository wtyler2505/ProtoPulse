---
description: "CircuitPython's runtime + filesystem + library bundles routinely consume 1MB+ of the 2MB flash, constraining larger projects to MicroPython or C"
type: claim
source: "docs/parts/raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# CircuitPython filesystem plus libraries can consume half of the Pico 2MB flash constraining environment choice

The Raspberry Pi Pico has 2MB of external QSPI flash. CircuitPython (Adafruit's fork of MicroPython) uses this flash for a FAT filesystem that stores Python source files and library bundles. The CircuitPython runtime itself takes approximately 700KB, and a typical library bundle (adafruit_bus_device, displayio, neopixel, etc.) adds another 200-600KB. A project with 5-10 libraries can easily consume over 1MB -- half the available flash.

This creates a practical environment selection decision:
- **CircuitPython**: Best library ecosystem, drag-and-drop development, but flash-hungry. Suitable for simpler projects or boards with more flash.
- **MicroPython**: Smaller runtime (~300KB), compiled bytecode is more space-efficient. Better for complex projects that need more flash headroom.
- **C/C++ SDK**: Produces compact binaries (typically 50-200KB for most projects). Maximum performance and flash efficiency.
- **Arduino (arduino-pico)**: Similar to C/C++ in binary size. Familiar API for Arduino users.

For projects that outgrow CircuitPython's flash constraints, the Pico W (same RP2040 but with wireless) also has only 2MB flash, which is even tighter because the WiFi firmware consumes additional space. Boards with larger flash (RP2040-based boards with 8-16MB) exist but are less common.

**On boards with less flash, the constraint is even more severe.** The Adafruit PyGamer (SAMD51) has only 512KB flash total. CircuitPython is listed as a first-class programming option for this board, but with the runtime alone consuming ~300KB on SAMD51, only ~200KB remains for user code and libraries. Complex CircuitPython projects (multiple sensor libraries + display drivers + game logic) may simply not fit. This makes environment selection (CircuitPython vs Arduino C++) not a preference but a hard constraint on flash-limited SAMD boards.

---

Relevant Notes:
- [[esp8266-wifi-consumes-50kb-ram-leaving-only-30kb-for-user-code]] -- similar resource constraint: runtime overhead limiting user code
- [[rp2040-pio-state-machines-implement-custom-protocols-at-hardware-speed]] -- PIO programs are tiny (32 instructions) and don't contribute to flash pressure

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
