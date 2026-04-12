---
description: "DS3231 has a readable temperature sensor for TCXO compensation (+/-3C, 0.25C resolution) -- useful for coarse ambient checks but misleading if treated as a proper environmental sensor"
type: claim
source: "docs/parts/ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery.md"
confidence: proven
topics:
  - "[[sensors]]"
related_components:
  - "ds3231-rtc-module-zs042"
---

# DS3231 built-in temperature sensor is free but only accurate to 3 degrees making it unsuitable for precision environmental sensing

The DS3231 contains an internal temperature sensor that exists to drive the TCXO crystal compensation algorithm. This sensor is readable via I2C (`rtc.getTemperature()` in RTClib) and returns degrees Celsius with 0.25C resolution. At first glance, this looks like a free thermometer on every DS3231 project.

The catch: accuracy is +/-3C. For "is it warm in here?" the reading is useful. For environmental monitoring, greenhouse control, fermentation tracking, or any application where 1C matters, the DS3231 temperature is unreliable. The resolution (0.25C) creates a false sense of precision -- the sensor can distinguish between 22.25C and 22.50C, but both readings might be off by 3C from the actual ambient temperature.

**The trap for beginners:** A beginner sees `rtc.getTemperature()` returning plausible-looking numbers and assumes they have a working thermometer. They don't realize the values could be 3C off until they compare against a calibrated sensor. By then, logged data is already compromised.

**When the built-in sensor IS useful:**
- Rough trending (is the room getting warmer over the day?)
- Sanity checks (is the enclosure obviously overheating?)
- Any use case where +/-3C is within acceptable tolerance

**When you need a proper temperature sensor instead:** DHT22 (+/-0.5C), DS18B20 (+/-0.5C), BME280 (+/-1C), or any dedicated environmental sensor. These cost $1-3 and deliver dramatically better accuracy.

---

Relevant Notes:
- [[ds3231-tcxo-accuracy-is-orders-of-magnitude-better-than-ds1307-crystal-drift-making-ds1307-obsolete-for-most-projects]] -- the TCXO is why the temp sensor exists; the clock accuracy is great even though the temp readout isn't
- [[zs042-charging-circuit-will-damage-non-rechargeable-cr2032-batteries-unless-resistor-r5-is-removed]] -- same module, different gotcha

Topics:
- [[sensors]]
