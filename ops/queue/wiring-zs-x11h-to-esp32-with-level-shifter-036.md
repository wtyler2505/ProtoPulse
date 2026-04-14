---
claim: "ESP32-S3 input-only pins are the correct allocation for 5V feedback signals through voltage dividers because they cannot be accidentally driven as outputs preserving bidirectional GPIOs for control signals"
classification: closed
source_task: wiring-zs-x11h-to-esp32-with-level-shifter
semantic_neighbor: "esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors"
---

# Claim 036: ESP32-S3 input-only pins are the correct allocation for 5V feedback signals through voltage dividers because they cannot be accidentally driven as outputs preserving bidirectional GPIOs for control signals

Source: [[wiring-zs-x11h-to-esp32-with-level-shifter]] (lines 241-252)

## Reduce Notes

Extracted from wiring-zs-x11h-to-esp32-with-level-shifter. This is a CLOSED claim.

Rationale: The existing input-only pins note (gpio34-39) articulates the *limitation* — can't drive outputs, no internal pulls. This is the dual claim articulating the *design strategy*: those same input-only pins are a PERFECT fit for sensor feedback through voltage dividers because you never want to drive them anyway, and the limitation becomes a safety feature (can't accidentally dump 3.3V back into a 5V sensor output). This pin-allocation heuristic turns a constraint into a design tool and deserves articulation as a separate claim — the existing note explains what input-only means; this explains what it's GOOD for.

Semantic neighbor: esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors (RELATED but DISTINCT — that note articulates the constraint; this articulates the design strategy that leverages the constraint).

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
