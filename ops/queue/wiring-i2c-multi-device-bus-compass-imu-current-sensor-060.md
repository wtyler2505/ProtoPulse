---
claim: "Running an I2C scanner sketch is the mandatory first debug step after wiring a multi-device bus because it catches address conflicts wiring errors and missing pull-ups before driver libraries mask the root cause"
classification: closed
source_task: wiring-i2c-multi-device-bus-compass-imu-current-sensor
semantic_neighbor: null
---

# Claim 060: I2C scanner sketch is the mandatory first debug step after wiring a multi-device bus

Source: [[wiring-i2c-multi-device-bus-compass-imu-current-sensor]] (lines 140-171)

## Reduce Notes

Extracted from wiring-i2c-multi-device-bus-compass-imu-current-sensor. This is a CLOSED claim.

Rationale: The source prescribes "Always run this first to verify all devices are detected" before library-level driver testing. This is methodology: probe the bus at the lowest level before climbing the stack. The I2C scanner isolates wiring/address/pull-up problems from library/timing/configuration problems. When a BNO055 init fails, the question "did the scanner see 0x28?" separates the hardware half of the stack from the software half. Not captured in any existing note — the vault has I2C topology notes but no note articulating the scanner-first debug methodology. This is a first-class methodology claim for embedded debugging.

Semantic neighbor: No close existing note. Related to [[i2c-devices-on-esp8266-boot-pins-can-prevent-boot-silently]] and other I2C gotcha notes but covers a different axis — those are specific failure modes, this is the universal debugging protocol that detects them.

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
