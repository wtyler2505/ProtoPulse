---
type: enrichment
target_note: "[[bldc-controller-and-mcu-must-share-common-ground-or-control-signals-float]]"
source_task: wiring-zs-x11h-to-arduino-mega-for-single-motor-control
addition: "Concrete Arduino-Mega-to-ZS-X11H pin mapping table (D9/EL, D8/Z-F, D7/CT, D6/STOP, D2/SC, GND/GND) with wire colors and functions -- makes the abstract common-ground principle land as a wire-by-wire recipe"
source_lines: "17-24, 27-40"
---

# Enrichment 026: [[bldc-controller-and-mcu-must-share-common-ground-or-control-signals-float]]

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]] (lines 17-24, 27-40)

## Reduce Notes

Enrichment for [[bldc-controller-and-mcu-must-share-common-ground-or-control-signals-float]]. Source adds the full concrete pin-by-pin wiring table plus the ASCII-art connection diagram, making the common-ground rule concrete at the wire level.

Rationale: The existing note argues WHY the common ground is needed (ground offset corrupts TTL thresholds at 16A). It mentions the signals by name (EL, Z/F, STOP, CT) but does not show a full-system pin mapping. The source provides that mapping as a 6-row table with pin, signal, wire color, and function, plus a diagram. This enrichment turns the principle into a buildable recipe without duplicating the electrical reasoning.

---

## Enrich
(to be filled by enrich phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
