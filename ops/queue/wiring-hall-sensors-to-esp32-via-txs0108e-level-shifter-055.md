---
type: enrichment
target_note: "[[bldc-controller-and-mcu-must-share-common-ground-or-control-signals-float]]"
source_task: wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter
addition: "Add the three-node ground rule for multi-voltage rover builds (ESP32 GND + RioRand GND + TXS0108E GND all joined at single point) and the ground-loop failure mode between 36V and 3.3V systems"
source_lines: "77"
---

# Enrichment 055: [[bldc-controller-and-mcu-must-share-common-ground-or-control-signals-float]]

Source: [[wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter]] (line 77)

## Reduce Notes

Enrichment for [[bldc-controller-and-mcu-must-share-common-ground-or-control-signals-float]]. The existing note establishes the two-node ground rule (MCU + controller). Source extends it to the three-node case where a level shifter is involved and to the failure mode specific to multi-voltage rover topologies.

Specific additions:
- Three-node rule: ESP32 GND + RioRand GND + TXS0108E GND must all be joined at a single common point
- Ground-loop failure mode: between 36V and 3.3V systems specifically, cross-rail ground potential differences produce noise and false readings
- Star-ground implication: this is why the distribution board becomes the canonical single common point, not daisy-chained GND

Rationale: The existing note is two-node. Real builds with level shifters are N-node. Star-ground is already captured in [[star-ground-at-distribution-board-prevents-ground-loops-in-multi-circuit-systems]] but that note is about power distribution, not about signal paths through level shifters. This enrichment stitches the two contexts together.

---

## Enrich
(to be filled by enrich phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
