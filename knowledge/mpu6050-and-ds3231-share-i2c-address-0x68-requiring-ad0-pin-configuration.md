---
description: "MPU6050 IMU and DS3231 RTC both default to I2C address 0x68 -- the DS3231 address is fixed, so the MPU6050 must be shifted to 0x69 by pulling its AD0 pin HIGH when both are on the same bus"
type: knowledge-note
source: "docs/parts/sensors.md"
topics:
  - "[[sensors]]"
  - "[[communication]]"
confidence: high
verified: false
---

# MPU6050 and DS3231 share I2C address 0x68 requiring AD0 pin configuration

The MPU6050 6-axis IMU defaults to I2C address **0x68** (AD0 pin LOW or floating). The DS3231 real-time clock is **fixed** at 0x68 with no address configuration option. When both devices share an I2C bus, they will collide and neither will respond correctly.

**Resolution:** Pull the MPU6050's AD0 pin HIGH (connect to VCC through a 4.7k resistor or directly to 3.3V) to shift it to **0x69**. Then update the MPU6050 library initialization:
- Arduino: `mpu.begin(0x69)` or `Wire.beginTransmission(0x69)`
- The DS3231 remains at 0x68 with no changes needed

**Additional notes from the I2C address map:**
- The DS3231 ZS-042 breakout also has an onboard AT24C32 EEPROM at 0x57 (adjustable via A0/A1/A2 solder pads) -- this generally doesn't conflict with anything
- The BNO055 IMU defaults to 0x28 (or 0x29 with ADR HIGH) and has no conflicts with either device
- The INA219 current sensors use 0x40-0x4F range, also conflict-free
- When building a sensor-heavy I2C bus (rover, robot), map ALL addresses in a single table before wiring to catch conflicts early

**Why this matters for ProtoPulse:** The BOM and schematic tools should flag I2C address conflicts during DRC. If a project has both an MPU6050 (at default) and a DS3231, the system should warn the user and suggest the AD0 pin fix.

---

Topics:
- [[sensors]]
- [[communication]]
