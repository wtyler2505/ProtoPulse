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

Added wire-gauge reference table to target insight `knowledge/power-budget-hierarchy-ensures-continuous-is-below-peak-is-below-fuse-is-below-wire-ampacity.md`. Table covers 7 circuit classes (battery-to-bus, bus-to-MC, phase wires, buck feed, buck output, signal wires, ground return) with minimum and recommended gauges. Notes ground-return gauge equals battery-positive because it carries same total current. Wiki-linked to `[[star-ground-at-distribution-board...]]` and forward-reference to `[[motor-power-wiring-below-14awg...]]` (claim-019 target, pending create). Ralph lead 2026-04-14.

## Connect

**Discovery Trace:**
- Topic map [[power-systems]] — note listed at line 18 near top under "Top-level power strategy" with phrase "four-number ordering constraint"
- Target note inline links verified: 7 wikilinks including individual-circuit-fusing, main-fuse-placement, motor-power-wiring (claim-019), slow-blow-fuse-sizing, star-ground (enrich-011).
- Sibling candidates: [[per-branch-motor-fusing...]] (claim-003) already cites this note. Bidirectional link present.

**Connections verified:** 7 inline prose links + 2 topics. Articulation test PASS. Note sits at the "top-level strategy" layer of power-systems MOC — among the most-cited organizing principles.

**MOC updates:** [[power-systems]] entry verified — appears at line 18 in a privileged "Top-level power strategy" position. No change needed.

**Agent note:** The power-budget hierarchy is an ORDERING constraint (not a sizing formula). It says: whatever your numbers are, they must satisfy continuous < peak < fuse < ampacity. That architectural character makes it a frequent upstream citation for sizing notes. Keep it lean — do not let it accumulate component-specific content; defer that to the notes it grounds.

## Revisit
## Verify
