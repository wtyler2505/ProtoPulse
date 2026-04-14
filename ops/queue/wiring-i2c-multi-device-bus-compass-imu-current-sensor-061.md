---
claim: "BNO055 ADR pin floats to 0x28 default and ties HIGH for 0x29 enabling two fusion IMUs on a single I2C bus"
classification: closed
source_task: wiring-i2c-multi-device-bus-compass-imu-current-sensor
semantic_neighbor: "[[mpu6050-and-ds3231-share-i2c-address-0x68-requiring-ad0-pin-configuration]]"
---

# Claim 061: BNO055 ADR pin configures the I2C address between 0x28 and 0x29 enabling two fusion IMUs on a single bus

Source: [[wiring-i2c-multi-device-bus-compass-imu-current-sensor]] (line 19)

## Reduce Notes

Extracted from wiring-i2c-multi-device-bus-compass-imu-current-sensor. This is a CLOSED claim.

Rationale: The source's address map calls out "0x28 or 0x29 via ADR pin" for the BNO055. This is a specific chip fact that enables a non-obvious design pattern — redundant fusion IMUs on one bus for voting, cross-checking, or dual-axis sensing (e.g., base orientation + end-effector orientation on a robotic arm). The ADR pin is a sister mechanism to MPU6050's AD0 pin. Distinct from the BNO-vs-compass redundancy claim because this is about BNO-vs-BNO at different addresses.

Semantic neighbor: [[mpu6050-and-ds3231-share-i2c-address-0x68-requiring-ad0-pin-configuration]] covers the pattern "chip has an address-select pin that resolves conflicts" for a different chip family. This claim is DISTINCT: different chip (BNO055 vs MPU6050), different pin name (ADR vs AD0), and different design intent (enabling two fusion IMUs on one bus, not resolving a collision with an RTC).

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
