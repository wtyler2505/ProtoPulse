---
description: "ESP8266 I2S is RX-only on fixed pins (GPIO15=BCK, GPIO13=DIN, GPIO2=WS) — GPIO2 must be HIGH at boot, and the I2S WS idle state can conflict with this requirement, creating a timing-sensitive boot interaction"
type: claim
source: "docs/parts/adafruit-pdm-microphone-sph0645lm4h-digital-audio-3v3.md"
confidence: proven
topics:
  - "[[communication]]"
  - "[[sensors]]"
related_components:
  - "adafruit-pdm-microphone-sph0645lm4h"
  - "esp8266-nodemcu-amica"
---

# ESP8266 I2S is receive-only with fixed pins and a boot-pin conflict on GPIO2

The ESP8266 has a hardware I2S peripheral, but with significant limitations compared to ESP32:

**Fixed pin assignments (non-remappable):**
- GPIO15 (D8) → I2S BCK (bit clock)
- GPIO13 (D7) → I2S DIN (data in)
- GPIO2 (D4) → I2S WS (word select / LRCLK)

**Constraints:**
1. **RX-only** — The ESP8266 I2S peripheral supports input (mic data) but not output (DAC/speaker). For audio playback, you need ESP32 or a separate I2S DAC chip.
2. **Fixed pins** — Unlike ESP32 where I2S can be mapped to nearly any GPIO, these three pins are hardwired in silicon. GPIO15 and GPIO2 are also boot-strapping pins.
3. **Boot conflict** — GPIO2 (WS) must be HIGH at boot for normal flash-boot mode. If the I2S WS line idles LOW (which depends on the driver state before I2S initialization), the ESP8266 may fail to boot when power-cycled with the mic connected.

**Workaround for boot conflict:**
- Add a 10k pull-up on GPIO2 to ensure it stays HIGH during boot
- Initialize I2S in `setup()` after boot completes
- Accept that the mic connection may need to be disconnected during firmware flashing

**The practical takeaway:** ESP8266 CAN read a PDM/I2S microphone for basic audio capture (voice commands, noise level), but the pin constraints and boot interaction make it fragile. ESP32 is the dramatically better choice for any audio project.

---

Relevant Notes:
- [[esp8266-boot-pins-gpio0-gpio2-and-gpio15-must-be-in-specific-states-at-power-on]] -- The root constraint this note extends
- [[esp8266-has-only-5-truly-safe-gpio-out-of-11-total-pins]] -- Further pin scarcity context
- [[i2s-hardware-peripheral-is-a-hard-requirement-for-pdm-microphones-partitioning-mcus-into-compatible-and-incompatible]] -- MCU compatibility matrix

Topics:
- [[communication]]
- [[sensors]]
