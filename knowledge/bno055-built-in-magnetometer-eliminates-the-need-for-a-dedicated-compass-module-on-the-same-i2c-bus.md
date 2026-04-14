---
description: BNO055 integrates its own magnetometer so pairing it with a standalone HMC/QMC compass on the same I2C bus is redundant hardware and wasted bus capacitance
type: atomic
created: 2026-04-14
source: "[[wiring-i2c-multi-device-bus-compass-imu-current-sensor]]"
confidence: verified
topics:
  - "[[sensors]]"
  - "[[communication]]"
  - "[[wiring-integration]]"
related_components:
  - BNO055
  - HMC5883L
  - QMC5883L
---

# BNO055 built-in magnetometer eliminates the need for a dedicated compass module on the same I2C bus

The BNO055 9-DOF sensor fusion IC integrates an accelerometer, gyroscope, AND magnetometer on one package, running Bosch's proprietary sensor-fusion firmware internally. When a design already includes a BNO055, adding a standalone HMC5883L or QMC5883L compass on the same I2C bus is redundant — the BNO055 already provides heading via its fused orientation output.

The practical consequences:

- **Bus capacitance burden**: Every extra device adds ~10-15pF to the shared bus. At 400kHz fast mode against the 400pF I2C cap, every unnecessary device narrows the wire-length budget. See [[i2c-bus-capacitance-budget-of-400pf-caps-practical-total-wire-length-at-roughly-one-meter-in-fast-mode]].
- **Address-space waste**: 0x1E/0x0D (HMC/QMC default) is held even though no code reads from it.
- **Calibration overhead**: BNO055 auto-calibrates internally; a separate magnetometer needs manual calibration routines that duplicate work.

This is an architectural claim, not a failure mode. The design review rule: if the BOM lists a BNO055, a standalone compass module on the same bus should be flagged for removal unless there's a specific dual-axis reason (e.g., base-mounted + end-effector-mounted heading on a robotic arm, where [[bno055-adr-pin-configures-the-i2c-address-between-0x28-and-0x29-enabling-two-fusion-imus-on-a-single-bus]] handles the address collision by adding a second BNO055 instead).

Distinct from [[most-hmc5883l-modules-sold-today-are-qmc5883l-clones-with-incompatible-i2c-address]], which addresses the DIFFERENT failure where someone orders HMC and gets QMC.

---

Source: [[wiring-i2c-multi-device-bus-compass-imu-current-sensor]] (lines 22-25)

Relevant Notes:
- [[most-hmc5883l-modules-sold-today-are-qmc5883l-clones-with-incompatible-i2c-address]]
- [[bno055-adr-pin-configures-the-i2c-address-between-0x28-and-0x29-enabling-two-fusion-imus-on-a-single-bus]]
- [[i2c-bus-capacitance-budget-of-400pf-caps-practical-total-wire-length-at-roughly-one-meter-in-fast-mode]]

Topics: [[sensors]] [[communication]] [[wiring-integration]]
