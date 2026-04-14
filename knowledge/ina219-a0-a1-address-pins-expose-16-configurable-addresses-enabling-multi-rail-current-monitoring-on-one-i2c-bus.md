---
description: INA219 current sensor A0/A1 address pins each take 4 states (GND/VCC/SDA/SCL) yielding 16 addresses 0x40-0x4F so one I2C bus can monitor 16 power rails simultaneously
type: atomic
created: 2026-04-14
source: "[[wiring-i2c-multi-device-bus-compass-imu-current-sensor]]"
confidence: verified
topics:
  - "[[sensors]]"
  - "[[power-systems]]"
  - "[[communication]]"
  - "[[wiring-integration]]"
related_components:
  - INA219
---

# INA219 A0/A1 address pins expose 16 configurable addresses enabling multi-rail current monitoring on one I2C bus

The INA219 high-side current/voltage sense IC has two address-configuration pins, A0 and A1, that each accept four distinct states — GND, VCC, SDA, or SCL. The resulting 4×4 = 16 address combinations span 0x40 through 0x4F on the I2C bus.

The architectural consequence: **a single I2C bus can host up to 16 INA219 instances for per-rail power monitoring**. A typical rover power architecture might use:

- 0x40 — main battery bus (30-42V, 10S Li-ion)
- 0x41 — 5V logic rail
- 0x42 — 3.3V MCU rail
- 0x43 — motor-1 branch
- 0x44 — motor-2 branch
- ...and so on

Why this matters: traditional current monitoring either uses per-rail shunts read by a multi-channel ADC (burns ADC pins) or requires separate I2C buses (burns bus hardware). The INA219 pattern collapses all monitoring onto one bus and exposes each rail as an independent I2C address.

Bus loading caveat: 16 devices at ~10-15pF each = 160-240pF before counting wire + pull-up RC. At 400kHz fast mode the 400pF ceiling starts biting — see [[i2c-bus-capacitance-budget-of-400pf-caps-practical-total-wire-length-at-roughly-one-meter-in-fast-mode]]. For >8 INA219 instances, consider standard-mode (100kHz) or splitting across two buses.

Distinct from [[pcf8574-i2c-backpack-defaults-to-address-0x27-but-pcf8574a-variant-defaults-to-0x3f-and-solder-jumpers-allow-8-addresses-per-chip]] — same address-jumper pattern, different chip family. PCF8574 has 3 pins × 2 states = 8 addresses for I/O expansion; INA219 has 2 pins × 4 states = 16 addresses for current sensing density.

---

Source: [[wiring-i2c-multi-device-bus-compass-imu-current-sensor]] (lines 20-21)

Relevant Notes:
- [[pcf8574-i2c-backpack-defaults-to-address-0x27-but-pcf8574a-variant-defaults-to-0x3f-and-solder-jumpers-allow-8-addresses-per-chip]]
- [[i2c-bus-capacitance-budget-of-400pf-caps-practical-total-wire-length-at-roughly-one-meter-in-fast-mode]]
- [[per-branch-motor-fusing-enables-graceful-degradation-because-a-single-motor-fault-blows-its-own-fuse-not-the-main]]

Topics: [[sensors]] [[power-systems]] [[communication]] [[wiring-integration]]
