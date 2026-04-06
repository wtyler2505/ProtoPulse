---
description: "GPIO 6-11 are wired to the ESP32's internal SPI flash chip and touching any of them crashes the module"
type: claim
source: "shared/verified-boards/nodemcu-esp32s.ts"
confidence: proven
topics: ["[[eda-fundamentals]]", "[[breadboard-intelligence]]"]
related_components: ["shared/verified-boards/nodemcu-esp32s.ts"]
---

# ESP32 has 6 GPIO pins connected to internal flash that must never be used

GPIO 6 (CLK), 7 (SD0), 8 (SD1), 9 (SD2), 10 (SD3), and 11 (CMD) on the ESP32 are hardwired to the internal SPI flash memory chip inside the ESP-WROOM-32 module. These pins carry the clock, data, and command signals that the processor uses to fetch its own firmware. Driving any of them externally — or even connecting a high-impedance load that shifts their voltage — corrupts the flash bus and crashes the module instantly.

Despite being exposed on the 38-pin dev board header (they sit at positions L16-L18 and R17-R19), these pins are not general-purpose I/O. They are labeled SD2, SD3, CMD, SD1, SD0, and CLK on the silkscreen, which gives a misleading impression of being SD card pins. In the verified board definition, all six are marked `restricted: true` with explicit crash warnings.

The bench coach should flag any wire connected to GPIO 6-11 as a hard error, not a warning. There is no valid user scenario for these pins on a standard ESP-WROOM-32 board. Modules with external PSRAM (ESP32-WROVER) use some of these pins for PSRAM, making them even less available.

---

Relevant Notes:
- [[esp32-gpio12-must-be-low-at-boot-or-module-crashes]] -- dangerous at boot but usable after; these pins are never usable
- [[esp32-adc2-unavailable-when-wifi-active]] -- conditional restriction vs. absolute restriction: a spectrum of pin usability
- [[esp32-38pin-barely-fits-breadboard-with-one-free-column]] -- 6 unusable pins on a board that barely fits compounds the deceptive complexity
- [[tinkercad-perception-gap-is-about-seeing-not-computing]] -- the bench coach should visually flag these pins as red/unusable, not just list warnings
- [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]] -- flash GPIOs must be flagged as hard errors by the AI before a beginner connects anything to them

Topics:
- [[eda-fundamentals]]
- [[breadboard-intelligence]]
