---
description: "The MAX7219 RSET resistor (pin 18 to V+) sets the peak segment current for ALL 64 LEDs simultaneously -- 9.53k=40mA (max), 20k=20mA (standard), 40k=10mA (dim). Too low = overcurrent = dead LEDs with no recovery"
type: knowledge-note
source: "docs/parts/max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins.md"
topics:
  - "[[displays]]"
  - "[[breadboard-intelligence]]"
confidence: high
verified: false
---

# RSET resistor sets all MAX7219 segment current globally and wrong value destroys LEDs

The RSET resistor on pin 18 of the MAX7219 is the single component that determines how much current flows through every LED segment. It connects between pin 18 (ISET) and V+. The relationship is inverse: lower resistance = more current = brighter but more dangerous.

**RSET reference table:**

| RSET Value | Peak Segment Current | Use Case |
|-----------|---------------------|----------|
| 9.53k ohm | ~40mA | Maximum brightness (datasheet limit) |
| 20k ohm | ~20mA | Standard brightness for most LEDs |
| 40k ohm | ~10mA | Low brightness (small LEDs, status indicators) |

**Why this is dangerous:**
- There is no software override. The RSET resistor is a hardware-only current limit.
- Using too low a value (e.g., 4.7k) pushes segment current above the LED's absolute maximum rating. The LEDs degrade or fail permanently.
- The 9.53k value from the datasheet gives exactly 40mA, which is already the absolute maximum for most standard LEDs. Using the datasheet's "maximum brightness" example as a default is itself a risk.
- For typical projects, 20k (20mA) is the safe starting point. Only go to 9.53k if the specific LEDs are rated for 40mA peak.

**Interaction with duty cycle:**
At 1/8 duty cycle (8 digits or 8x8 matrix), the average current per LED is RSET_current / 8. So 40mA peak at 1/8 duty = ~5mA average per LED.

---

Topics:
- [[displays]]
- [[breadboard-intelligence]]
