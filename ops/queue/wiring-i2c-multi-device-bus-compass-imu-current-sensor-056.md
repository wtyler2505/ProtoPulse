---
claim: "BNO055 built-in magnetometer eliminates the need for a dedicated compass module on the same I2C bus"
classification: closed
source_task: wiring-i2c-multi-device-bus-compass-imu-current-sensor
semantic_neighbor: "[[most-hmc5883l-modules-sold-today-are-qmc5883l-clones-with-incompatible-i2c-address]]"
---

# Claim 056: BNO055 built-in magnetometer eliminates the need for a dedicated compass module on the same I2C bus

Source: [[wiring-i2c-multi-device-bus-compass-imu-current-sensor]] (lines 22-25)

## Reduce Notes

Extracted from wiring-i2c-multi-device-bus-compass-imu-current-sensor. This is a CLOSED claim.

Rationale: The source's I2C address map explicitly calls out that the HMC5883L/QMC5883L compass module is "only if NOT using BNO055 (which has its own magnetometer)." This is a parts-selection claim with direct DRC implications — if a BOM contains both a BNO055 and a standalone magnetometer on the same I2C bus, the standalone magnetometer is redundant hardware and wasted bus capacitance. The claim is not captured in existing notes; the QMC-clone note covers address mismatch but doesn't articulate the redundancy-with-BNO055 decision.

Semantic neighbor: [[most-hmc5883l-modules-sold-today-are-qmc5883l-clones-with-incompatible-i2c-address]] addresses the DIFFERENT failure mode where someone buys a compass expecting HMC and gets QMC. This claim is DISTINCT: it addresses the architectural decision of whether a compass module is needed at all given a BNO055 in the same design.

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
