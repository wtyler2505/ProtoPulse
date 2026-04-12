---
description: "Default 12mA per pin (configurable to 16mA max) with 50mA total GPIO current -- significantly stricter than Uno's 20mA/200mA or ESP32's 40mA/1.2A"
type: claim
source: "docs/parts/raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# Pico 12mA per pin and 50mA total GPIO current is the strictest budget among common maker MCUs

The RP2040's GPIO pads default to 12mA drive strength (configurable up to 16mA in software) with a total current budget of 50mA across all active I/O pins. This creates a graduated scale among popular maker MCUs:

| Board | Per-Pin Max | Total GPIO Current | Notes |
|-------|------------|-------------------|-------|
| Pi Pico (RP2040) | 12mA (16mA max) | 50mA | Strictest budget |
| Arduino Uno (ATmega328P) | 20mA (40mA abs max) | 200mA | Middle ground |
| ESP32 | 40mA | ~1.2A | Most generous |

At 12mA, a standard red LED (20mA forward current) is technically over-limit without a current-limiting resistor calculated for 10-12mA. Projects that casually wire LEDs with 220-ohm resistors (targeting ~15mA from 5V boards) need recalculation for the Pico's 3.3V supply and lower current budget.

The 50mA total is the real constraint. With 26 GPIO pins and 50mA total, you average under 2mA per pin if all are active. Any project with more than 3-4 LEDs needs an external LED driver (MAX7219, 74HC595 shift register) or careful current planning.

**Concrete LED examples at 3.3V with Pico:**

| LED Color | Vf (typ) | Resistor for 10mA | Actual Current | % of 12mA Pin Limit |
|-----------|----------|-------------------|----------------|---------------------|
| Red | 2.0V | 130 ohm | 10.0 mA | 83% |
| Yellow | 2.0V | 130 ohm | 10.0 mA | 83% |
| Green | 2.2V | 110 ohm | 10.0 mA | 83% |
| Blue | 3.2V | 10 ohm | 10.0 mA | 83% (but marginal Vf headroom) |
| White | 3.2V | 10 ohm | 10.0 mA | 83% (but marginal Vf headroom) |
| RGB (all) | varies | per channel | 30 mA total | 60% of 50mA GPIO budget |

Red/yellow LEDs at 3.3V with resistors sized for 10mA are already at 83% of the per-pin limit. An RGB LED at full white (3 channels x 10mA) consumes 60% of the Pico's entire 50mA GPIO budget on a single component. Blue/white LEDs are essentially unusable at 3.3V without external circuitry due to Vf headroom collapse (see [[blue-and-white-leds-are-marginal-at-3v3-because-forward-voltage-nearly-equals-supply-voltage]]).

---

Relevant Notes:
- [[uno-20ma-per-pin-200ma-total-means-no-direct-led-or-motor-drive]] -- Uno's 200mA total is 4x more generous than Pico's 50mA
- [[mega-2560-too-wide-for-any-breadboard]] -- Mega mentions same 200mA constraint with 54 pins
- [[esp32-ams1117-regulator-limits-total-board-current-to-800ma]] -- ESP32 has far more current headroom

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
