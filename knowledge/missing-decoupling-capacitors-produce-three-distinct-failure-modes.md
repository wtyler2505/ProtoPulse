---
description: "Without 100nF decoupling: (1) MCU brownout resets from VCC dips during GPIO transitions, (2) ADC noise contamination from supply ripple coupling into analog reference, (3) serial communication glitches from timing errors caused by clock instability"
type: knowledge-note
source: "docs/parts/100nf-ceramic-capacitor-104-50v-decoupling-bypass.md"
topics:
  - "[[passives]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# Missing decoupling capacitors produce three distinct failure modes

Omitting the 100nF decoupling capacitor from an IC's VCC/GND pins produces three failure modes, each with different symptoms and different difficulty of diagnosis:

**1. MCU brownout resets**
- **Mechanism:** Multiple GPIO pins transitioning simultaneously (e.g., writing to a parallel bus or driving LEDs) draw a current spike that dips VCC below the brownout detection threshold
- **Symptom:** MCU randomly resets during specific operations, especially those involving multiple outputs changing state at once
- **Diagnosis difficulty:** Medium -- the reset is reproducible but only under specific load conditions. Serial debug output disappears at the moment of the fault, making it look like a software crash

**2. ADC noise contamination**
- **Mechanism:** Supply rail noise couples into the ADC's voltage reference (AVCC or AREF), directly adding to every analog measurement
- **Symptom:** ADC readings jitter by 10-50 LSBs instead of the expected 1-3 LSBs. Analog sensors appear "noisy" even when the sensor itself is stable
- **Diagnosis difficulty:** Hard -- the noise looks like sensor noise, and averaging/filtering masks it enough that the problem seems like "just ADC resolution" rather than a missing component

**3. Serial communication glitches**
- **Mechanism:** Supply voltage instability causes the clock oscillator frequency to shift momentarily, corrupting UART bit timing or SPI/I2C clock edges
- **Symptom:** Occasional garbage characters in UART output, I2C NAK errors, SPI data corruption. Always intermittent, worse under load
- **Diagnosis difficulty:** Very hard -- communication protocols have error tolerance, so the system works 95% of the time. The 5% failure rate looks like a software bug or a loose wire

**The unifying pattern:** All three failure modes are intermittent, load-dependent, and look like problems in other parts of the system (software bugs, sensor issues, wire connections). The decoupling capacitor is rarely the first suspect, which is exactly why its absence is so dangerous.

---

Relevant Notes:
- [[every-digital-ic-requires-a-100nf-ceramic-decoupling-capacitor-between-vcc-and-gnd-to-absorb-switching-transients]] -- The rule that prevents all three failure modes
- [[analog-ics-need-decoupling-more-critically-than-digital-because-supply-noise-directly-contaminates-signal-measurements]] -- Failure mode #2 is elevated to the primary concern for analog ICs

Topics:
- [[passives]]
- [[eda-fundamentals]]
