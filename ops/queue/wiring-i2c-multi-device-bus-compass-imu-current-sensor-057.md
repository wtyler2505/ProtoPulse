---
claim: "INA219 A0/A1 address pins expose 16 configurable addresses letting one I2C bus host up to 16 current sensors for per-rail power monitoring"
classification: closed
source_task: wiring-i2c-multi-device-bus-compass-imu-current-sensor
semantic_neighbor: "[[pcf8574-i2c-backpack-defaults-to-address-0x27-but-pcf8574a-variant-defaults-to-0x3f-and-solder-jumpers-allow-8-addresses-per-chip]]"
---

# Claim 057: INA219 A0/A1 address pins expose 16 configurable addresses enabling multi-rail current monitoring on one I2C bus

Source: [[wiring-i2c-multi-device-bus-compass-imu-current-sensor]] (lines 20-21)

## Reduce Notes

Extracted from wiring-i2c-multi-device-bus-compass-imu-current-sensor. This is a CLOSED claim.

Rationale: The source's address map lists two INA219 instances at 0x40 and 0x41 (battery rail and 5V rail monitors) and notes the chip supports 0x40-0x4F via A0/A1. The 16-address capability is a specific datasheet fact that enables a whole architecture pattern — one I2C bus can monitor an entire power tree per-rail instead of needing separate buses or shunts. Not a duplicate of the PCF8574 or OLED address-jumper notes because those are about different chips with different numbers of address pins and different intents (I/O expansion, display addressing). The INA219 claim is about current sensing density on a shared bus.

Semantic neighbor: [[pcf8574-i2c-backpack-defaults-to-address-0x27-but-pcf8574a-variant-defaults-to-0x3f-and-solder-jumpers-allow-8-addresses-per-chip]] covers the same pattern (configurable I2C addresses via solder jumpers) for a different chip with 3 address pins and 8 addresses. This claim is DISTINCT: INA219 has 2 address pins that can each take 4 states (GND, VCC, SDA, SCL), producing 16 addresses rather than 8, and the design intent is current-sensor density not I/O expansion.

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
