---
claim: "BSS138 level shifter channels add approximately 5pF each to the I2C bus capacitance budget which constrains level-shifted I2C topologies to fewer devices or shorter wires"
classification: closed
source_task: wiring-i2c-multi-device-bus-compass-imu-current-sensor
semantic_neighbor: "[[bss138-switching-speed-caps-at-400khz-making-it-unsuitable-for-fast-spi-and-high-speed-push-pull-signals]]"
---

# Claim 059: BSS138 level shifter channels add approximately 5pF each to the I2C bus capacitance budget

Source: [[wiring-i2c-multi-device-bus-compass-imu-current-sensor]] (lines 128, 131)

## Reduce Notes

Extracted from wiring-i2c-multi-device-bus-compass-imu-current-sensor. This is a CLOSED claim.

Rationale: The source's capacitance budget table gives concrete per-channel capacitance for a BSS138 level shifter (~5pF per channel, so 10pF for SDA+SCL). This is a numerical datasheet fact that feeds directly into DRC-style bus capacitance calculations. Not in any existing note — the BSS138 notes cover switching speed, body diode mechanism, and RC ceiling, but the explicit per-channel capacitance contribution to bus budgeting is absent. This claim enables tooling to flag "your level-shifted I2C bus with 6 devices and 80cm wiring exceeds 400pF" as a wiring error.

Semantic neighbor: [[bss138-switching-speed-caps-at-400khz-making-it-unsuitable-for-fast-spi-and-high-speed-push-pull-signals]] addresses the RC-time-constant limit from the pull-up × drain capacitance. This claim is DISTINCT: it addresses the contribution of BSS138 channels to the TOTAL bus capacitance that competes with all other devices on the bus, not the per-channel rise-time calculation.

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
