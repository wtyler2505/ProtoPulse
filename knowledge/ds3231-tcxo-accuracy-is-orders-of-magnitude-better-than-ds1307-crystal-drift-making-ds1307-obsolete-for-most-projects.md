---
description: "DS3231's temperature-compensated crystal holds +/-2 ppm (~1 min/year) vs DS1307's uncompensated crystal that drifts minutes per month -- for any project running longer than a few days, DS1307 is a false economy"
type: claim
source: "docs/parts/ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery.md"
confidence: proven
topics:
  - "[[sensors]]"
  - "[[eda-fundamentals]]"
related_components:
  - "ds3231-rtc-module-zs042"
---

# DS3231 TCXO accuracy is orders of magnitude better than DS1307 crystal drift making DS1307 obsolete for most projects

The DS3231 uses a temperature-compensated crystal oscillator (TCXO) that continuously measures the die temperature and adjusts the oscillator capacitance to maintain +/-2 ppm accuracy across 0-40C. In practice this means about +/-1 minute of drift per year. The DS1307, which most tutorials still reference, uses an external uncompensated 32.768 kHz crystal that drifts with temperature. Real-world DS1307 drift is typically several minutes per month -- potentially 30+ minutes per year depending on ambient temperature swings.

**Cost comparison:** The DS3231 ZS-042 breakout costs $1-3 on AliExpress/Amazon. The DS1307 breakout costs $0.50-2. The price difference is trivial compared to the frustration of a clock that loses minutes. For any project that displays time, logs data with timestamps, or schedules events, the DS3231 is the unconditional recommendation.

**When DS1307 is still acceptable:** Only if the project runs for hours (not days), doesn't care about cumulative drift, and needs the absolute lowest BOM cost. In practice, this almost never applies.

**Selection criterion for beginners:** If a tutorial or kit uses a DS1307, replace it with a DS3231 module. The pinout is identical (VCC, GND, SDA, SCL), the RTClib library supports both with a one-line change (`RTC_DS3231` vs `RTC_DS1307`), and the accuracy improvement is free.

---

Relevant Notes:
- [[zs042-charging-circuit-will-damage-non-rechargeable-cr2032-batteries-unless-resistor-r5-is-removed]] -- the gotcha for the DS3231's most popular breakout board
- [[mpu6050-and-ds3231-share-i2c-address-0x68-requiring-ad0-pin-configuration]] -- I2C address conflict with common IMU

Topics:
- [[sensors]]
- [[eda-fundamentals]]
