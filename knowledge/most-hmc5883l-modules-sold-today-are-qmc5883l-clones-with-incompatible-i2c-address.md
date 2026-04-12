---
description: "Most 'HMC5883L' compass modules available from Chinese sellers are actually QMC5883L clones with a different I2C address (0x0D vs 0x1E) and incompatible register map -- using HMC5883L libraries will silently fail"
type: knowledge-note
source: "docs/parts/sensors.md"
topics:
  - "[[sensors]]"
  - "[[communication]]"
confidence: high
verified: false
---

# most HMC5883L modules sold today are QMC5883L clones with incompatible I2C address

The genuine Honeywell HMC5883L 3-axis magnetometer uses I2C address **0x1E** (fixed). However, most modules marketed as "HMC5883L" on AliExpress, Amazon, and other hobby electronics sellers are actually **QMC5883L** chips made by QST Corporation. The QMC5883L uses I2C address **0x0D** and has an incompatible register map.

**Practical impact:**
- If you load an HMC5883L Arduino library (e.g., `Adafruit_HMC5883_Unified`), it will fail to detect the sensor at 0x1E because the chip is actually at 0x0D
- Running an I2C scanner (`Wire.beginTransmission()` sweep) will show the device at 0x0D, which is the first clue you have a clone
- QMC5883L-specific libraries exist (e.g., `QMC5883LCompass`) and must be used instead
- The register layout differs -- raw register reads from HMC5883L code will return garbage on QMC5883L

**How to identify:**
- I2C scan: 0x0D = QMC5883L clone, 0x1E = genuine HMC5883L
- Physical: QMC5883L chips often have "DA 5883" or "QC 5883" markings (vs "L883" on genuine)
- If the BNO055 is already on the bus, its onboard magnetometer makes a separate HMC5883L/QMC5883L redundant

---

Topics:
- [[sensors]]
- [[communication]]
