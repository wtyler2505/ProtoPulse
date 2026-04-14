---
type: enrichment
target_note: "[[sc-speed-pulse-output-enables-closed-loop-rpm-measurement-via-interrupt-counting]]"
source_task: wiring-zs-x11h-to-arduino-mega-for-single-motor-control
addition: "Complete Arduino interrupt handler, pulseCount volatile pattern, and RPM getter function -- plus a note about the simpler 15-pulses-per-revolution model the source uses versus the more rigorous 90-pulses-per-revolution derivation the existing note gives"
source_lines: "79-81, 93-99, 117, 143-159"
---

# Enrichment 027: [[sc-speed-pulse-output-enables-closed-loop-rpm-measurement-via-interrupt-counting]]

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]] (lines 79-81, 93-99, 117, 143-159)

## Reduce Notes

Enrichment for [[sc-speed-pulse-output-enables-closed-loop-rpm-measurement-via-interrupt-counting]]. Source adds a complete Arduino implementation (volatile pulseCount, ISR, attachInterrupt call, getRPM function with noInterrupts/interrupts guard) and surfaces a unit-count discrepancy worth resolving.

Rationale: The existing note derives 90 pulses per mechanical revolution (6 Hall states x 15 pole pairs). The source's reference code uses 15 as the divisor (`count * 60000.0 / (15.0 * elapsed)`), implying 15 pulses per revolution. This is either (a) a source error to flag, or (b) a different interpretation where SC outputs one pulse per electrical revolution rather than per Hall state change. The enrichment should add the code pattern AND note this discrepancy so future verification can resolve which count is correct for the ZS-X11H specifically. The existing note also lacks the critical noInterrupts/interrupts atomic-read pattern.

---

## Enrich
(to be filled by enrich phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
