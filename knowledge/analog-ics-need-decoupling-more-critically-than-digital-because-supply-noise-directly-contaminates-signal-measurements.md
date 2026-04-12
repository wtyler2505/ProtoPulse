---
description: "Digital ICs tolerate supply noise up to their noise margin (hundreds of mV), but analog ICs like ADCs and DACs directly couple supply noise into their signal path -- a 50mV supply ripple that is invisible to digital logic adds 50mV of error to every analog measurement"
type: knowledge-note
source: "docs/parts/100nf-ceramic-capacitor-104-50v-decoupling-bypass.md"
topics:
  - "[[passives]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# Analog ICs need decoupling more critically than digital because supply noise directly contaminates signal measurements

The decoupling requirement escalates from "important" to "critical" when the IC performs analog functions:

| IC Type | Supply Noise Tolerance | Impact of 50mV Ripple |
|---------|----------------------|----------------------|
| Digital logic (74HC series) | ~400mV noise margin | No impact -- well within margin |
| MCU digital I/O | ~200-400mV noise margin | No impact on digital functions |
| MCU ADC (10-bit, 3.3V ref) | 3.2mV per LSB | ~15 LSB of jitter -- significant |
| External ADC (12-bit, 3.3V ref) | 0.8mV per LSB | ~62 LSB of jitter -- catastrophic |
| Op-amp | PSRR-dependent | Directly adds to output (attenuated by PSRR) |
| DAC | Same as ADC | Output noise floor = supply noise floor |

**The mechanism:** Analog ICs derive their voltage reference from the supply rail (either directly or through an internal reference that still has finite PSRR -- power supply rejection ratio). Any noise on the supply appears as noise on the reference, which adds directly to every measurement or output.

**Practical requirements for analog ICs:**
1. 100nF ceramic on every supply pin (same as digital) -- handles high-frequency transients
2. Additional 10uF electrolytic or tantalum close to the analog supply pin -- handles low-frequency ripple
3. Separate analog and digital ground returns back to the supply -- prevents digital switching current from creating voltage drops in the analog ground path
4. Consider an RC or LC filter between the digital and analog supply pins if they share a source

**DRC implication:** When an ADC, DAC, or op-amp appears in a design, the DRC should check for both 100nF high-frequency decoupling AND low-frequency bulk decoupling on the analog supply pins. Missing either one degrades measurement quality.

---

Relevant Notes:
- [[every-digital-ic-requires-a-100nf-ceramic-decoupling-capacitor-between-vcc-and-gnd-to-absorb-switching-transients]] -- The baseline requirement that analog elevates
- [[missing-decoupling-capacitors-produce-three-distinct-failure-modes]] -- Failure mode #2 (ADC noise) is the analog-specific consequence

Topics:
- [[passives]]
- [[eda-fundamentals]]
