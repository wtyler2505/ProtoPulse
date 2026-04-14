---
type: enrichment
target_note: "[[power-budget-hierarchy-ensures-continuous-is-below-peak-is-below-fuse-is-below-wire-ampacity]]"
source_task: wiring-36v-battery-power-distribution-4-tier-system
addition: "Complete wire gauge reference table mapping circuit type to voltage/current/minimum-gauge/recommended-gauge across 7 rows (battery-to-bus, bus-to-MC, MC-to-motor, battery-to-LM2596, LM2596-to-ESP32, signal wires, GND bus) — provides the ampacity row of the hierarchy with concrete numbers"
source_lines: "354-363"
---

# Enrichment 016: Power budget hierarchy note — add wire gauge reference table

Source: [[wiring-36v-battery-power-distribution-4-tier-system]] (lines 354-363)

## Reduce Notes

Enrichment for [[power-budget-hierarchy-ensures-continuous-is-below-peak-is-below-fuse-is-below-wire-ampacity]]. Source provides a full wire gauge lookup table spanning the entire rover power tree. The hierarchy note establishes that wire ampacity must exceed fuse rating but does not tabulate concrete gauge-to-current mappings across the system.

Rationale: The ampacity constraint in the hierarchy becomes actionable when you can look up a specific circuit (e.g., "MC to motor phases") and see that it needs 14 AWG minimum for 15A at 36V. Without the lookup, the hierarchy is abstract.

---

## Enrich
## Connect
## Revisit
## Verify
