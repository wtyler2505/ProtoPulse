---
description: "Timed wake-up from deep sleep needs GPIO16 physically wired to the RST pin -- when the RTC timer fires, GPIO16 pulses LOW to reset the chip, restarting from setup()"
type: claim
source: "docs/parts/esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components:
  - "esp8266-nodemcu-amica"
---

# ESP8266 deep sleep requires a physical wire from GPIO16 to RST

The ESP8266's deep sleep mode reduces chip current to approximately 20uA by powering down the CPU, WiFi radio, and all peripherals — only the RTC (Real-Time Clock) controller remains active. However, the wake-up mechanism is purely hardware: when the RTC timer expires, it pulses GPIO16 LOW. This LOW pulse must physically reach the RST pin to trigger a chip reset, which restarts execution from the beginning of `setup()`.

Without the GPIO16→RST wire, the RTC timer fires but nothing happens — the chip stays asleep forever. There is no software path from the RTC to the reset controller.

**Consequences of the GPIO16→RST connection:**
- GPIO16 (D0) is permanently consumed by the deep sleep function — you cannot use it for any other purpose
- Wake-up is a full reset, not a resume — all RAM state is lost, `setup()` runs from scratch
- If you need to preserve state across sleep cycles, store it in RTC memory (512 bytes survives reset) or external EEPROM/flash

**Contrast with ESP32:** The ESP32 can wake from deep sleep via internal timer, external GPIO trigger, touch pin, or ULP coprocessor — without requiring any external wiring. The ESP32's RTC controller is connected to the reset logic internally. This makes the ESP8266's external wire requirement a significant physical constraint that the ESP32 eliminates.

**Board-level caveat:** With GPIO16 tied to RST, you cannot reprogram the ESP8266 without disconnecting that wire first (or adding a resistor to allow the USB-serial chip's DTR pin to still pull RST LOW for auto-upload). Common solution: use a 470-ohm resistor between GPIO16 and RST instead of a direct wire — weak enough that the auto-reset circuit still works, strong enough to trigger wake-up.

---

Relevant Notes:
- [[esp32-deep-sleep-draws-only-10-microamps-enabling-battery-iot]] — ESP32 achieves similar deep sleep current without requiring external wiring for wake-up
- [[esp8266-gpio16-is-architecturally-unique-and-cannot-do-pwm-or-i2c]] — GPIO16's RTC connection explains both its limitations and its deep sleep role
- [[nodemcu-board-draws-8-20ma-in-deep-sleep-defeating-chip-level-20ua-spec]] — the board overhead that makes true battery operation harder

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
