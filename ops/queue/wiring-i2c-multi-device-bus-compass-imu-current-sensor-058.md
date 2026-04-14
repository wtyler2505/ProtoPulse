---
claim: "I2C bus capacitance budget of 400pF caps practical total wire length at roughly one meter in 400kHz fast mode"
classification: closed
source_task: wiring-i2c-multi-device-bus-compass-imu-current-sensor
semantic_neighbor: "[[oled-i2c-modules-include-onboard-pull-ups-and-external-pull-ups-should-only-be-added-for-bus-lengths-exceeding-30cm]]"
---

# Claim 058: I2C bus capacitance budget of 400pF caps practical wire length at roughly one meter in fast mode

Source: [[wiring-i2c-multi-device-bus-compass-imu-current-sensor]] (lines 122-138)

## Reduce Notes

Extracted from wiring-i2c-multi-device-bus-compass-imu-current-sensor. This is a CLOSED claim.

Rationale: The source performs a full capacitance budget (devices ~10-15pF each, wire ~1-2pF per cm, level shifter ~5pF per channel) and concludes total wire length under 1 meter is safe at 400kHz fast mode. This is a design-guideline claim grounded in the I2C standard's 400pF cap. Distinct from the OLED note which addresses pull-up parallel resistance; this note addresses the capacitance side of the same bus-health equation. Future DRC rules should flag I2C buses where device-count × ~15pF + wire_length_cm × ~1.5pF + shifter_channels × 5pF approaches 400pF. The 1m rule is a heuristic derived from that budget for typical hobbyist configurations.

Semantic neighbor: [[oled-i2c-modules-include-onboard-pull-ups-and-external-pull-ups-should-only-be-added-for-bus-lengths-exceeding-30cm]] mentions the 30cm bus-length threshold but for a different reason (adding pull-ups to compensate for attenuation). This claim is DISTINCT: it addresses the upper bound where the bus fails regardless of pull-up sizing because accumulated capacitance violates rise-time spec. The 30cm threshold and the 1m ceiling are two different points on the same axis.

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
