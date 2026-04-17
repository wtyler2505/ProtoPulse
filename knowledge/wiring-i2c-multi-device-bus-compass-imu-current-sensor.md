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

- [[bno055-adr-pin-configures-the-i2c-address-between-0x28-and-0x29-enabling-two-fusion-imus-on-a-single-bus]] — BNO055 ADR pin floats to 0x28 default and ties HIGH for 0x29 so one I2C bus can host two BNO055 fusion IMUs for dual-axis orientation sensing such as base plus end-effector on a robotic arm
- [[bno055-built-in-magnetometer-eliminates-the-need-for-a-dedicated-compass-module-on-the-same-i2c-bus]] — BNO055 integrates its own magnetometer so pairing it with a standalone HMC/QMC compass on the same I2C bus is redundant hardware and wasted bus capacitance
- [[bss138-level-shifter-channels-add-approximately-5pf-each-to-the-i2c-bus-capacitance-budget]] — BSS138-based bidirectional level shifters add roughly 5pF per channel to the I2C bus capacitance so a typical SDA+SCL shifter pair contributes ~10pF that competes with devices and wire against the 400pF bus ceiling
- [[i2c-bus-capacitance-budget-of-400pf-caps-practical-total-wire-length-at-roughly-one-meter-in-fast-mode]] — The I2C specification caps total bus capacitance at 400pF and devices contribute ~10-15pF each plus wire adds ~1-2pF per cm so practical wire length ceiling is ~1 meter at 400kHz fast mode
- [[i2c-scanner-sketch-is-the-mandatory-first-debug-step-after-wiring-a-multi-device-bus]] — Running a bus-enumeration scanner before any driver library is the mandatory first step on a new multi-device I2C bus because it isolates wiring/address/pull-up faults from driver/timing/config faults
- [[ina219-a0-a1-address-pins-expose-16-configurable-addresses-enabling-multi-rail-current-monitoring-on-one-i2c-bus]] — INA219 current sensor A0/A1 address pins each take 4 states (GND/VCC/SDA/SCL) yielding 16 addresses 0x40-0x4F so one I2C bus can monitor 16 power rails simultaneously

## Open Questions
(populated by /extract)

---

Topics:
- [[wiring-integration]] — Wiring and integration knowledge -- multi-component system wiring, common ground discipline, level shifting topology, pull-up sizing, flyback protection, decoupling placement, EMI suppression, and power distribution across mixed-voltage systems
- [[power-systems]] — Power system knowledge -- battery + BMS (10S Li-ion, lead-acid, LVD), linear + switching regulation, buck/boost topology, parallel rail distribution, fusing (ANL + slow-blow), two-stage E-stop with DC contactors, AC-mains safety capacitors (X-class line-to-line, Y-class line-to-ground), MOSFET low-side switching, and multi-voltage tier design for 36V rover systems
- [[index]] — Entry point to the ProtoPulse knowledge vault -- 528 atomic notes across 11 hardware topic maps covering microcontrollers, actuators, sensors, displays, power, communication, shields, passives, input devices, and system wiring
