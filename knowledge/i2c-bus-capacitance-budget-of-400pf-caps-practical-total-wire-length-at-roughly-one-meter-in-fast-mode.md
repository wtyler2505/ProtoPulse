---
description: The I2C specification caps total bus capacitance at 400pF and devices contribute ~10-15pF each plus wire adds ~1-2pF per cm so practical wire length ceiling is ~1 meter at 400kHz fast mode
type: atomic
created: 2026-04-14
source: "[[wiring-i2c-multi-device-bus-compass-imu-current-sensor]]"
confidence: verified
topics:
  - "[[communication]]"
  - "[[wiring-integration]]"
related_components:
  - I2C bus
  - BSS138
---

# I2C bus capacitance budget of 400pF caps practical total wire length at roughly one meter in fast mode

The I2C standard specifies a maximum total bus capacitance of 400pF at 400kHz fast mode. Every device on the bus, plus every centimeter of wire, plus any level shifters, all contribute capacitance that is cumulative across the bus.

Typical capacitance contributions:

| Source | Capacitance |
|---|---|
| Each I2C device (sensor, OLED, RTC, etc.) | ~10-15pF |
| Wire (stripboard, ribbon, dupont) | ~1-2pF per cm |
| Level shifter channel (BSS138-class) | ~5pF per channel |
| PCB trace | ~0.5-1pF per cm |

Worked example: 4 sensors (4 × 12 = 48pF) + 60cm dupont wire (60 × 1.5 = 90pF) + bidirectional BSS138 level shifter (2 channels × 5 = 10pF) = 148pF total. Well within the 400pF ceiling.

Worked failure example: 8 sensors (96pF) + 120cm wire (180pF) + 2 level shifters (20pF) = 296pF. Approaching the ceiling — rise times will slow, causing NACK responses at 400kHz.

**Practical heuristic: keep total wire length under 1 meter** for typical 4-6 device buses at 400kHz. For longer runs, either:
- Drop to standard mode (100kHz) which has more margin
- Use dedicated I2C bus drivers/repeaters (P82B96 or similar)
- Split the bus into segments with an I2C multiplexer (TCA9548A)

This is the upper-bound claim — distinct from [[oled-i2c-modules-include-onboard-pull-ups-and-external-pull-ups-should-only-be-added-for-bus-lengths-exceeding-30cm]] which addresses pull-up sizing (a different axis of the same bus-health equation). The 30cm note is about "when to add pull-ups"; this note is about "when the bus fails regardless of pull-up sizing."

---

Source: [[wiring-i2c-multi-device-bus-compass-imu-current-sensor]] (lines 122-138)

Relevant Notes:
- [[oled-i2c-modules-include-onboard-pull-ups-and-external-pull-ups-should-only-be-added-for-bus-lengths-exceeding-30cm]]
- [[bss138-level-shifter-channels-add-approximately-5pf-each-to-the-i2c-bus-capacitance-budget]]
- [[ina219-a0-a1-address-pins-expose-16-configurable-addresses-enabling-multi-rail-current-monitoring-on-one-i2c-bus]]
- [[bno055-built-in-magnetometer-eliminates-the-need-for-a-dedicated-compass-module-on-the-same-i2c-bus]]

Topics: [[communication]] [[wiring-integration]]
