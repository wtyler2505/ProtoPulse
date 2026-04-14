---
type: enrichment
target_note: "[[dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets]]"
source_task: wiring-zs-x11h-to-arduino-mega-for-single-motor-control
addition: "CT HIGH/LOW state-behavior table clarifying the polarity mapping plus the explicit rule that the brake is regenerative rather than mechanical -- complements the thermal-fail-mode reasoning already in the note"
source_lines: "68-70, 227-232"
---

# Enrichment 028: [[dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets]]

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]] (lines 68-70, 227-232)

## Reduce Notes

Enrichment for [[dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets]]. Source adds a CT state table (HIGH=float/normal, LOW=active braking via low-side MOSFETs) and the clarifying framing that the brake is an ELECTRICAL brake shorting the motor windings, not a mechanical lock.

Rationale: The existing note argues the thermal failure mode (brake held after stop overheats MOSFETs). It does not explicitly name the brake as electrical/regenerative vs mechanical, and does not give the at-a-glance CT state table. Beginners sometimes assume "brake" means a mechanical device that locks the motor; the clarification that it is a phase-short creates the mental model that makes the thermal argument land. Adding the state table and the electrical-vs-mechanical frame enriches the note without duplicating the reasoning.

---

## Enrich
(to be filled by enrich phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
