---
description: "Pulling 3V3_EN LOW disables the onboard 3.3V regulator completely -- enables ultra-low-power designs with external wake circuitry but requires hardware modification unlike ESP32's software deep sleep"
type: claim
source: "docs/parts/raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# Pico 3V3_EN pin disables the onboard regulator for ultra-low-power sleep modes

The Pico's 3V3_EN pin controls the onboard voltage regulator's enable input. Pulling it LOW disables the 3.3V supply entirely, cutting power to the RP2040 and all connected peripherals. This is the Pico's mechanism for ultra-low-power sleep -- but unlike the ESP32's software-triggered deep sleep (10uA, wake on timer or GPIO), the Pico requires external hardware to:

1. Pull 3V3_EN LOW (putting the board to sleep)
2. Release 3V3_EN HIGH (waking the board back up)
3. Trigger the wake event (timer IC, PIR sensor, button, RTC alarm)

Common implementations use an external RTC (DS3231) or a 555 timer to pulse 3V3_EN on a schedule. A simple button can also wake the board by releasing the pull-down on 3V3_EN.

When the regulator is disabled, current draw drops to the regulator's quiescent leakage (sub-microamp). This is lower than any MCU's internal sleep mode because the MCU itself is completely unpowered. The trade-off is that all RAM contents are lost -- on wake, the Pico boots fresh from flash, like a power-on reset.

**Comparison of sleep approaches:**
| Platform | Sleep Current | Wake Sources | State Preserved |
|----------|-------------|-------------|-----------------|
| ESP32 deep sleep | ~10uA | Timer, GPIO, touch, ULP | RTC memory only |
| Pico (dormant) | ~1.3mA | GPIO, RTC | Full RAM |
| Pico (3V3_EN off) | <1uA | External circuit only | Nothing (cold boot) |

---

Relevant Notes:
- [[esp32-deep-sleep-draws-only-10-microamps-enabling-battery-iot]] -- ESP32 achieves 10uA in software; Pico needs hardware for comparable sleep
- [[nodemcu-board-draws-8-20ma-in-deep-sleep-defeating-chip-level-20ua-spec]] -- dev board quiescent defeats chip sleep; Pico's 3V3_EN truly cuts everything
- [[pico-vsys-accepts-1v8-to-5v5-enabling-direct-battery-operation]] -- battery operation + sleep control = viable IoT sensor node

Topics:
- [[microcontrollers]]
- [[power-systems]]
- [[eda-fundamentals]]
