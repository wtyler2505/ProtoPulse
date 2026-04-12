---
description: "PDM/I2S microphones like the SPH0645LM4H require a hardware I2S peripheral — you cannot bit-bang I2S at audio sample rates on an 8-bit AVR. This creates a binary MCU compatibility gate: either you have hardware I2S or you cannot use this sensor class at all"
type: claim
source: "docs/parts/adafruit-pdm-microphone-sph0645lm4h-digital-audio-3v3.md"
confidence: proven
topics:
  - "[[communication]]"
  - "[[sensors]]"
related_components:
  - "adafruit-pdm-microphone-sph0645lm4h"
  - "esp32-devkit-v1"
  - "rp2040"
---

# I2S hardware peripheral is a hard requirement for PDM microphones partitioning MCUs into compatible and incompatible

I2S (Inter-IC Sound) is a synchronous serial protocol running at bit-clock rates of 1.024–3.072 MHz for standard audio sample rates (16–48 kHz). Unlike I2C or SPI where you can sometimes bit-bang at reduced speeds, I2S has zero tolerance for clock jitter — a missed bit shifts every subsequent sample, corrupting the audio stream permanently.

**MCU compatibility matrix for I2S microphones:**

| MCU | I2S Support | Notes |
|-----|-------------|-------|
| ESP32 | Full (2 I2S peripherals) | Best Arduino-ecosystem choice for audio |
| ESP8266 | Limited (RX-only, fixed pins) | Works for mic input only |
| RP2040 (Pi Pico) | Via PIO state machines | Deterministic, flexible pin mapping |
| STM32 (most) | Full hardware I2S | Common in pro audio |
| Arduino Uno/Nano/Mega (ATmega) | NONE | Cannot use PDM/I2S mics at all |
| Teensy 3.x/4.x | Full | Designed for audio applications |

**Why this matters for ProtoPulse:**

This is NOT a "recommended MCU" situation — it's a hard gate. If an ATmega-based Arduino appears in the BOM alongside an I2S microphone, the DRC should raise an ERROR (not warning). There is no workaround, no library, no clever hack that makes it work. The user must either change their MCU or choose an analog microphone module instead.

**Contrast with other protocols:**
- I2C: Can be bit-banged at 100kHz on anything with GPIO
- SPI: Can be bit-banged at reduced speeds
- UART: Can be bit-banged with careful timing
- I2S: CANNOT be reliably bit-banged at audio rates on 8-bit MCUs

---

Relevant Notes:
- [[rp2040-pio-state-machines-implement-custom-protocols-at-hardware-speed]] -- PIO provides I2S without dedicated hardware
- [[esp32-i2c-is-software-implemented-and-remappable-to-any-gpio-pair]] -- Contrast: I2C is flexible, I2S is rigid

Topics:
- [[communication]]
- [[sensors]]
