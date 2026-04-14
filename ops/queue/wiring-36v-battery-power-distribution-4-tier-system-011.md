---
type: enrichment
target_note: "[[star-ground-at-distribution-board-prevents-ground-loops-in-multi-circuit-systems]]"
source_task: wiring-36v-battery-power-distribution-4-tier-system
addition: "Explicit never-daisy-chain anti-pattern with voltage-drop example (MC1 drawing 15A shifts MC2 ground reference through shared wire), and the ASCII diagram showing star topology bus bar with all grounds meeting at one point"
source_lines: "365-378"
---

# Enrichment 011: Star ground note — add daisy-chain anti-pattern

Source: [[wiring-36v-battery-power-distribution-4-tier-system]] (lines 365-378)

## Reduce Notes

Enrichment for [[star-ground-at-distribution-board-prevents-ground-loops-in-multi-circuit-systems]]. Source adds an explicit contrasting anti-pattern (daisy-chained grounds) with concrete voltage-drop arithmetic that illustrates why star topology wins. The existing note covers the principle but does not show the failure mode in contrast.

Rationale: The anti-pattern example makes the abstract "ground loop" concept concrete: when MC1 pulls 15A through shared wire, that current creates a voltage drop across the wire segment between MC1 and MC2, which shifts MC2's ground reference. This is the mechanism behind "erratic behavior" that the existing note mentions but does not demonstrate.

---

## Enrich

Enrichment already present in target insight `knowledge/star-ground-at-distribution-board-prevents-ground-loops-in-multi-circuit-systems.md`. The existing body (lines 17-24) already shows:
- The daisy-chain anti-pattern with ASCII diagram
- Voltage-drop math (16A through 14AWG creates 0.27V ground shift per 2-foot segment)
- Four-motor case extending to >1V ground shift
- Star-topology ASCII diagram showing all grounds meeting at bus bar

The 36V source doc lines 365-378 cover the same material. The insight was authored with the anti-pattern already included, so no additional content is needed. Phase reconciled by ralph lead 2026-04-14.

## Connect
## Revisit
## Verify
