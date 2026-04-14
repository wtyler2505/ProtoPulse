---
type: enrichment
target_note: "[[bldc-direction-reversal-under-load-creates-destructive-current-spikes-through-mosfets]]"
source_task: wiring-zs-x11h-to-arduino-mega-for-single-motor-control
addition: "Concrete Arduino setDirection() wrapper, ramp-up/ramp-down loop pattern, and the troubleshooting-table reframing (motor runs backwards -> swap two phase wires OR invert logic) that gives a hardware alternative to the runtime direction change entirely"
source_lines: "139-141, 162-190, 208"
---

# Enrichment 029: [[bldc-direction-reversal-under-load-creates-destructive-current-spikes-through-mosfets]]

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]] (lines 139-141, 162-190, 208)

## Reduce Notes

Enrichment for [[bldc-direction-reversal-under-load-creates-destructive-current-spikes-through-mosfets]]. Source adds a complete Arduino ramp-pattern illustrating the safe reversal sequence plus a setDirection() wrapper, and a troubleshooting entry that reframes "motor runs backwards" as a phase-wire-swap problem instead of forcing runtime direction reversal.

Rationale: The existing note already mentions "swap any two motor phase wires" as the mechanical alternative. The source enriches this with a complete for-loop ramp pattern (0->200 in steps of 5, 50ms delay) that the existing note only describes abstractly as "ramp from 0 toward target speed over 500ms-2s". The enrichment promotes the abstract ramp guidance to a concrete working code pattern that shows the delay-per-step calibration. Also adds the troubleshooting framing: "Motor runs backwards -> Swap motor phase wires OR invert direction logic" explicitly lists the two options side-by-side.

---

## Enrich
(to be filled by enrich phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
