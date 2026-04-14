---
claim: "Wire runs between level shifter and MCU must stay under 10cm in motor-controller environments because longer runs pick up PWM switching noise and produce phantom Hall transitions"
classification: closed
source_task: wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter
semantic_neighbor: null
---

# Claim 046: Short wire runs under 10cm are required between level shifter and MCU near motor controllers

Source: [[wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter]] (line 79)

## Reduce Notes

Extracted from wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter. This is a CLOSED claim.

Rationale: The source gives a concrete design rule — wire length < 10cm between TXS0108E and ESP32 — because motor switching noise couples into longer runs and causes false Hall transitions. This is not articulated anywhere in the vault. It's the kind of empirical rule that beginners violate constantly (running neat ribbon cables across the chassis) and then blame on software bugs. Needs to stand as its own claim because it applies to ALL 3.3V logic near BLDC motor controllers, not just TXS0108E + ESP32 specifically.

Semantic neighbor: No direct match. Related to [[analog-ics-need-decoupling-more-critically-than-digital-because-supply-noise-directly-contaminates-signal-measurements]] conceptually (noise-coupling family) but distinct mechanism — trace/wire inductance pickup vs supply contamination.

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
