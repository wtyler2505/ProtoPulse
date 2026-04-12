---
description: "Standard rotary pots have ~300 degrees of rotation with hard mechanical stops at both ends -- the first and last few degrees produce inconsistent or railed ADC values, requiring software trimming of the input range (e.g., map(raw, 10, 1013, 0, 1023))"
type: knowledge-note
source: "docs/parts/potentiometer-10k-rotary-b10k-linear-taper.md"
topics:
  - "[[input-devices]]"
confidence: high
verified: false
---

# Potentiometer 300 degree rotation range with mechanical stops means software must handle endpoint dead zones in ADC reading

A standard 3-pin rotary potentiometer provides approximately 300 degrees of useful rotation. Hard mechanical stops at both extremes prevent further rotation. At these extremes, the ADC reading exhibits dead zones:

**At full CCW (near GND):**
- The wiper cannot physically reach the very end of the resistive element
- ADC reads ~0-15 instead of exactly 0
- Multiple degrees of rotation at the stop produce the same reading (dead zone)

**At full CW (near VCC):**
- Same physical limitation at the other end
- ADC reads ~1010-1023 instead of exactly 1023
- Dead zone where turning produces no change

**The software fix:**

Instead of using the full 0-1023 ADC range, trim the endpoints:

```cpp
// Raw ADC reading
int raw = analogRead(A0);

// Trim dead zones and remap to full range
int value = constrain(raw, 10, 1013);
int mapped = map(value, 10, 1013, 0, 1023);
```

**Calibration procedure for precision:**
1. Turn pot fully CCW, read ADC value → this is your `inputMin` (typically 5-20)
2. Turn pot fully CW, read ADC value → this is your `inputMax` (typically 1005-1020)
3. Use `map(raw, inputMin, inputMax, outputMin, outputMax)` in code
4. Store calibrated values in EEPROM if pot is not removable

**Why this matters for ProtoPulse:**
- The bench coach should include endpoint calibration as a step when a potentiometer is used for analog input
- Schematic examples should show the software mapping alongside the hardware wiring
- The dead zone width varies by pot quality and manufacturer -- cheap pots may have 10-20 degree dead zones

**This compounds with ADC nonlinearity:** On ESP32, the ADC is already nonlinear above 2.5V. Combined with pot endpoint dead zones, the effective usable range may be narrower than expected. See [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]].

---

Source: [[potentiometer-10k-rotary-b10k-linear-taper]]

Relevant Notes:
- [[a-potentiometer-wired-as-voltage-divider-converts-mechanical-rotation-to-proportional-analog-voltage-for-mcu-analogread]] -- the hardware circuit that produces these ADC readings
- [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]] -- ADC nonlinearity that compounds with pot dead zones

Topics:
- [[input-devices]]
