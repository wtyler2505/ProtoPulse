---
description: "Each WS2812B draws up to 50mA at full white brightness -- an 8-LED ring needs 400mA, a 16-LED ring needs 800mA. Ring size directly determines whether Arduino 5V pin, breadboard PSU, or dedicated supply is required"
type: knowledge-note
source: "docs/parts/ws2812b-neopixel-ring-status-led-array-for-system-feedback.md"
topics:
  - "[[displays]]"
  - "[[power-systems]]"
confidence: high
verified: false
---

# NeoPixel per-LED current at full white makes ring size a power supply design decision

The WS2812B draws up to 50mA per LED at full white (all three RGB channels at 255). A single color channel at full brightness draws ~20mA. This makes ring size a power architecture decision, not just a visual one:

| Ring Size | Max Current (all white) | Typical (mixed colors) | Power at 5V |
|-----------|------------------------|----------------------|-------------|
| 8 LEDs | 400mA | 160mA | 2W |
| 12 LEDs | 600mA | 240mA | 3W |
| 16 LEDs | 800mA | 320mA | 4W |
| 24 LEDs | 1200mA | 480mA | 6W |

**Power supply thresholds in the inventory:**
- Arduino Uno/Nano 5V pin: ~500mA max (shared with the board). An 8-LED ring at full white is borderline.
- Breadboard power module: ~700mA total ([[breadboard-power-module-700ma-total-budget-excludes-servos-and-motors-requiring-separate-power]]). A 12-LED ring at full white is borderline.
- ESP32 AMS1117 regulator: 800mA total ([[esp32-ams1117-regulator-limits-total-board-current-to-800ma]]). A 16-LED ring at full white matches the regulator limit exactly -- no headroom for anything else.

**Practical implications:**
- For status indication (not full white), typical current is 30-40% of max. Budget for worst case.
- Software brightness limiting (`ring.setBrightness(50)`) reduces current proportionally but eliminates full-white capability.
- For rings with >8 LEDs, a dedicated 5V supply is the correct approach. Share the ground with the MCU but do NOT run LED power through the MCU's regulator.

---

Topics:
- [[displays]]
- [[power-systems]]
