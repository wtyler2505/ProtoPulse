---
description: BNO055 ADR pin floats to 0x28 default and ties HIGH for 0x29 so one I2C bus can host two BNO055 fusion IMUs for dual-axis orientation sensing such as base plus end-effector on a robotic arm
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
---

# BNO055 ADR pin configures the I2C address between 0x28 and 0x29 enabling two fusion IMUs on a single bus

The BNO055 9-DOF fusion IMU has an ADR (address-select) pin. Floating or tied LOW gives the default 0x28; tying HIGH to VCC gives 0x29. This 1-bit address selection allows **two BNO055 sensors to coexist on a single I2C bus**.

Design patterns that benefit:

- **Robotic arm base + end-effector orientation** — one BNO055 at 0x28 on the base reports body frame, another at 0x29 on the end-effector reports tool frame. Kinematic diff gives joint angles without encoders.
- **Vehicle body + trailer** — jackknife detection, towing stability
- **Redundant voting** — two IMUs, if they disagree beyond tolerance, flag fault
- **Stereo IMU for vibration cancellation** — two IMUs in different locations let firmware subtract common-mode chassis noise

The ADR pattern is a sister mechanism to MPU6050's AD0 pin ([[mpu6050-and-ds3231-share-i2c-address-0x68-requiring-ad0-pin-configuration]]), though the MPU6050 note addresses a collision with DS3231 RTC rather than enabling dual IMUs. The same hardware primitive (address-select pin) serves two different design intents.

Distinct from [[bno055-built-in-magnetometer-eliminates-the-need-for-a-dedicated-compass-module-on-the-same-i2c-bus]] — that claim is about BNO-vs-external-compass redundancy. This claim is about BNO-vs-BNO coexistence at different addresses for distinct measurement purposes.

Bus-budget note: two BNO055 at ~12pF each = 24pF. Combined with other bus devices + wire + any level shifter, must stay under 400pF total — see [[i2c-bus-capacitance-budget-of-400pf-caps-practical-total-wire-length-at-roughly-one-meter-in-fast-mode]].

---

Source: [[wiring-i2c-multi-device-bus-compass-imu-current-sensor]] (line 19)

Relevant Notes:
- [[mpu6050-and-ds3231-share-i2c-address-0x68-requiring-ad0-pin-configuration]]
- [[bno055-built-in-magnetometer-eliminates-the-need-for-a-dedicated-compass-module-on-the-same-i2c-bus]]
- [[i2c-bus-capacitance-budget-of-400pf-caps-practical-total-wire-length-at-roughly-one-meter-in-fast-mode]]
- [[i2c-scanner-sketch-is-the-mandatory-first-debug-step-after-wiring-a-multi-device-bus]]

Topics: [[sensors]] [[communication]] [[wiring-integration]]
