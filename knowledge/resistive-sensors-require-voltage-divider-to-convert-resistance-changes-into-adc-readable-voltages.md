---
description: "The foundational analog circuit pattern for ALL variable-resistance sensors (LDRs, thermistors, FSRs, flex sensors, soil moisture) — the sensor changes resistance; the divider converts that to a voltage swing the MCU ADC can digitize"
type: claim
source: "docs/parts/photoresistor-ldr-light-dependent-resistor-analog-light-sensor.md"
confidence: proven
topics:
  - "[[eda-fundamentals]]"
  - "[[sensors]]"
  - "[[breadboard-intelligence]]"
related_components:
  - "photoresistor-ldr"
---

# Resistive sensors require voltage divider to convert resistance changes into ADC-readable voltages

This is the most universal analog wiring pattern a beginner needs to learn. Variable-resistance sensors (LDR, NTC thermistor, FSR, flex sensor, soil moisture probe) change their resistance in response to a physical stimulus — but an MCU's ADC reads VOLTAGE, not resistance. The voltage divider bridges this gap.

**The circuit:**
```
VCC (3.3V or 5V)
    |
[R_fixed] (known resistor, typically 10k)
    |
    +──── ADC_PIN (voltage measured here)
    |
[R_sensor] (variable resistance sensor)
    |
   GND
```

**The math:**
V_adc = VCC × R_sensor / (R_fixed + R_sensor)

When R_sensor changes (due to light, temperature, pressure, flex), V_adc changes proportionally, producing a voltage the ADC can digitize.

**Choosing R_fixed:**
- Set R_fixed equal to the MIDPOINT of the sensor's useful resistance range
- This maximizes voltage swing across the range of interest
- Example: LDR ranges 1k (bright) to 100k (dark) → R_fixed = 10k gives good sensitivity in the "dim" region
- Example: NTC thermistor is 10k at 25°C → R_fixed = 10k for best sensitivity around room temperature

**Why beginners get stuck:**
1. They connect the sensor directly to an ADC pin → pin floats, reads noise
2. They connect sensor between VCC and ADC → reads VCC always (no divider)
3. They use wrong R_fixed value → ADC reads near 0 or near VCC with no range in between

**Sensor orientation matters:**
- Sensor on TOP (between VCC and ADC): V_adc increases as R_sensor increases
- Sensor on BOTTOM (between ADC and GND): V_adc decreases as R_sensor increases

Choose whichever makes the software logic intuitive (e.g., "higher reading = more light" or "higher reading = hotter").

**ProtoPulse DRC opportunity:** When a resistive sensor appears in a schematic without a voltage divider partner resistor, flag as an error: "Resistive sensor needs a voltage divider to produce ADC-readable voltage."

---

Relevant Notes:
- [[cds-photoresistors-have-logarithmic-response-making-them-qualitative-not-quantitative-light-sensors]] -- Primary example sensor using this pattern
- [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]] -- ADC limitations that affect the reading regardless of divider quality

Topics:
- [[eda-fundamentals]]
- [[sensors]]
- [[breadboard-intelligence]]
