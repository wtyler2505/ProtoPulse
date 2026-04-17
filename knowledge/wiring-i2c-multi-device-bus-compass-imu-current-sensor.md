---
description: "Multi-device I2C bus wiring sharing SDA/SCL between a magnetometer/compass, BNO055 IMU (with built-in magnetometer), and a current sensor: ~1m cable length limit at 400pF bus capacitance budget, per-shifter 5pF contribution, pull-up sizing, and address-collision avoidance."
type: moc
topics:
  - "[[wiring-integration]]"
  - "[[power-systems]]"
  - "[[index]]"
---

# I2C multi-device bus (compass + IMU + current sensor)

Multi-device I2C bus wiring sharing SDA/SCL between a magnetometer/compass, BNO055 IMU (with built-in magnetometer), and a current sensor: ~1m cable length limit at 400pF bus capacitance budget, per-shifter 5pF contribution, pull-up sizing, and address-collision avoidance.

## Knowledge Notes

- [[bno055-adr-pin-configures-the-i2c-address-between-0x28-and-0x29-enabling-two-fusion-imus-on-a-single-bus]]
- [[bno055-built-in-magnetometer-eliminates-the-need-for-a-dedicated-compass-module-on-the-same-i2c-bus]]
- [[bss138-level-shifter-channels-add-approximately-5pf-each-to-the-i2c-bus-capacitance-budget]]
- [[i2c-bus-capacitance-budget-of-400pf-caps-practical-total-wire-length-at-roughly-one-meter-in-fast-mode]]
- [[i2c-scanner-sketch-is-the-mandatory-first-debug-step-after-wiring-a-multi-device-bus]]
- [[ina219-a0-a1-address-pins-expose-16-configurable-addresses-enabling-multi-rail-current-monitoring-on-one-i2c-bus]]

## Open Questions
(populated by /extract)

---

Topics:
- [[wiring-integration]]
- [[power-systems]]
- [[index]]
