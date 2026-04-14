---
claim: "TXS0108E A-side internal pull-ups eliminate the need for external pull resistors on ESP32 input-only pins receiving level-shifted Hall signals"
classification: closed
source_task: wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter
semantic_neighbor: "[[esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors]]"
---

# Claim 050: TXS0108E A-side pull-ups remove the ESP32 input-only pin pull-resistor requirement for Hall signals

Source: [[wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter]] (lines 65-67)

## Reduce Notes

Extracted from wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter. This is a CLOSED claim.

Rationale: The source notes that GPIO34-39 work here despite having no internal pull-ups because "the TXS0108E provides the pull-ups via its A-side resistors." This is a non-obvious interaction between TXS0108E architecture and ESP32 limitations: the active level shifter's one-shot drive plus weak pull-up makes the A-side pin into a driven signal whenever the B-side is driven, so the ESP32's lack of internal pulls doesn't matter for this specific path. Beginners who know both facts separately ("GPIO34 has no pull-up", "TXS0108E has A-side pull-ups") still miss that they combine cleanly. Worth standing as its own claim.

Semantic neighbor: [[esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors]] says GPIO34-39 need external pulls for defined idle state. This claim is DISTINCT: it explains the one legitimate exception — when the upstream driver is an active level shifter that already provides the pull-up, external pulls become redundant.

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
