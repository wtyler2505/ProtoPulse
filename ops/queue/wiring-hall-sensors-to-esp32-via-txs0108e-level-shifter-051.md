---
type: enrichment
target_note: "[[txs0108e-oe-pin-is-active-high-and-floating-by-default-silently-disabling-all-outputs]]"
source_task: wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter
addition: "Add Hall-sensor wiring as a worked example — OE tied to VCCA (3.3V from ESP32) with explicit pin-19 callout in a BLDC Hall readback topology"
source_lines: "39, 40"
---

# Enrichment 051: [[txs0108e-oe-pin-is-active-high-and-floating-by-default-silently-disabling-all-outputs]]

Source: [[wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter]] (lines 39-40)

## Reduce Notes

Enrichment for [[txs0108e-oe-pin-is-active-high-and-floating-by-default-silently-disabling-all-outputs]]. Source adds a concrete worked example: OE (pin 19) tied directly to VCCA (pin 11) which is powered from the ESP32 3.3V rail, in the context of a BLDC Hall-sensor readback. The existing note is abstract — this enrichment grounds it in the exact scenario where beginners wire everything but forget OE.

Rationale: The existing note already explains WHY OE must be tied to VCCA. The enrichment adds the concrete Hall-sensor use case and pin-number callouts (pin 19, pin 11) that make the note directly usable during wiring. This is specifically the case the note was written for but doesn't illustrate.

---

## Enrich
(to be filled by enrich phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
