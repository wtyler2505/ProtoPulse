---
description: "LEDs in multiplexed displays can be driven at 5x their continuous current rating during brief on-pulses (e.g., 100mA peak at 1/10 duty vs 20mA continuous), which compensates for the reduced duty cycle brightness"
type: knowledge-note
source: "docs/parts/5161as-single-digit-7-segment-led-display-red-common-cathode.md"
topics:
  - "[[displays]]"
  - "[[passives]]"
confidence: high
verified: false
---

# Pulsed LED current at low duty cycle allows 5x the continuous rating making multiplexed displays brighter than DC math predicts

LED datasheets specify two current ratings: continuous (DC) and peak (pulsed at a specified duty cycle). For the 5161AS 7-segment display, these are 20mA continuous and 100mA peak at 1/10 duty cycle. This 5:1 ratio is typical across LED components.

**Why this matters for multiplexed displays:**
- A naive calculation says an 8-row multiplexed display at 12.5% duty cycle should appear 1/8 as bright as a continuously-lit LED.
- In practice, you can drive each LED at a higher peak current during its on-time, recovering much of the lost brightness.
- The MAX7219's RSET resistor exploits this directly: 10k ohm gives ~40mA peak current at 1/8 duty, producing an effective average of ~5mA per LED -- which is visually brighter than 5mA DC because human perception responds to peak luminance, not average power.

**Constraints:**
- Peak current ratings assume a specific maximum duty cycle (typically 1/10 or 1/8). Exceeding the duty cycle at peak current damages the LED.
- Thermal limits still apply: even pulsed operation generates heat in the LED die, just less than continuous operation at the same current.
- The RSET resistor on the MAX7219 is the mechanism that sets this peak current for all segments globally.

---

Topics:
- [[displays]]
- [[passives]]
