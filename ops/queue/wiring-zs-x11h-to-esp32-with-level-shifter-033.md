---
claim: "Voltage divider impedance must be lowered for digital pulse signals because high source impedance interacts with input capacitance to degrade edge rates"
classification: closed
source_task: wiring-zs-x11h-to-esp32-with-level-shifter
semantic_neighbor: "resistive-sensors-require-voltage-divider-to-convert-resistance-changes-into-adc-readable-voltages"
---

# Claim 033: Voltage divider impedance must be lowered for digital pulse signals because high source impedance interacts with input capacitance to degrade edge rates

Source: [[wiring-zs-x11h-to-esp32-with-level-shifter]] (lines 101-106)

## Reduce Notes

Extracted from wiring-zs-x11h-to-esp32-with-level-shifter. This is a CLOSED claim.

Rationale: The existing resistive-sensors voltage-divider note covers divider sizing for analog sensing (pick R_fixed near sensor midpoint for maximum swing). It does NOT cover the distinct concern for digital pulse readback: a 10K+20K divider has ~6.7K Thevenin output impedance which forms an RC low-pass with input capacitance (~10pF pin + ~20pF wire) giving ~67ns time constant that rounds off pulse edges. A 1K+2K divider has ~667Ω Thevenin and ~7ns time constant — clean edges. This is a claim about choosing divider values by signal type (analog = match sensor resistance, digital pulse = minimize impedance), and it bridges the voltage-divider family of notes with the level-shifter speed concerns already articulated in the BSS138 note.

Semantic neighbor: resistive-sensors-require-voltage-divider (DISTINCT — that note covers sensor impedance matching for analog voltage; this covers pulse-edge fidelity for digital readback, which selects divider values on a different axis).

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
