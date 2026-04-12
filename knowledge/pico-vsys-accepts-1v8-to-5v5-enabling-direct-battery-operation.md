---
description: "VSYS pin accepts 1.8V-5.5V with a Schottky diode preventing USB backfeed -- enables direct LiPo (3.7V), 3xAA (4.5V), or USB power without switching"
type: claim
source: "docs/parts/raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# Pico VSYS pin accepts 1.8V to 5.5V enabling direct battery operation with Schottky backfeed protection

The Pico's VSYS pin is the system power input, feeding the onboard RT6150 buck-boost regulator that produces the 3.3V rail. VSYS accepts any voltage from 1.8V to 5.5V, which covers common battery configurations:
- **Single LiPo cell**: 3.0V (depleted) to 4.2V (full)
- **3x AA/AAA**: 3.6V (depleted) to 4.5V (fresh)
- **4x AA/AAA**: 4.8V to 6.0V (exceeds max -- use 3 cells)
- **USB 5V**: Standard via the onboard Schottky diode

A Schottky diode between VBUS (USB 5V) and VSYS prevents current from flowing backward into USB when an external battery is connected. This means you can have both a battery on VSYS and a USB cable plugged in simultaneously -- USB power takes priority (higher voltage) and the battery serves as backup. No external power-path management IC is needed.

The RT6150 regulator is a buck-boost design (not just a linear dropout), so it efficiently converts both voltages above and below 3.3V. This is why 1.8V minimum works -- the regulator boosts it up. Efficiency at typical loads (50-150mA) is around 85-90%.

---

Relevant Notes:
- [[mega-5v-regulator-thermal-math-constrains-input-voltage-to-7-9v]] -- Mega uses a linear regulator with heat problems; Pico's buck-boost is efficient
- [[esp32-ams1117-regulator-limits-total-board-current-to-800ma]] -- ESP32's linear regulator wastes power as heat; Pico doesn't
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] -- Pico's wide input range simplifies the power tier problem

Topics:
- [[microcontrollers]]
- [[power-systems]]
- [[eda-fundamentals]]
