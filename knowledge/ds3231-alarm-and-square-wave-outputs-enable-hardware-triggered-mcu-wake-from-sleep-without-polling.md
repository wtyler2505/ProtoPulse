---
description: "DS3231 has 2 programmable alarms and a configurable SQW pin (1Hz-8kHz) -- connecting SQW to an MCU interrupt enables timed wake-from-deep-sleep at microamp currents without a polling loop"
type: claim
source: "docs/parts/ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery.md"
confidence: proven
topics:
  - "[[sensors]]"
  - "[[eda-fundamentals]]"
related_components:
  - "ds3231-rtc-module-zs042"
---

# DS3231 alarm and square wave outputs enable hardware-triggered MCU wake from sleep without polling

The DS3231 has two independently programmable alarm registers and a configurable square wave output (SQW pin) that can produce 1Hz, 1.024kHz, 4.096kHz, or 8.192kHz signals, or pulse on alarm match. When the SQW/INT pin is connected to an MCU's hardware interrupt pin, the MCU can enter deep sleep (power-down mode) and wake only when the RTC signals an event.

**Why this matters for battery-powered projects:** An ATmega328P in power-down mode draws ~0.1uA. If the MCU polls a clock register every second to check "is it time yet?", it must stay awake consuming ~15mA. With the DS3231's alarm interrupt, the MCU sleeps indefinitely and wakes only when needed -- the difference between weeks and hours of battery life.

**The two alarm types:**
- **Alarm 1:** Configurable to match on seconds, minutes, hours, day/date. Useful for "wake me at 6:00 AM every day" or "wake me every 30 seconds."
- **Alarm 2:** Same but without seconds granularity. Useful for minute-resolution scheduling.

**The square wave alternative:** The 1Hz SQW output provides a reliable external clock tick without consuming an MCU timer. This is useful for projects that need periodic wake-ups (every second) without dedicating a hardware timer to timekeeping.

**Implementation pattern:**
1. Configure DS3231 alarm via I2C
2. Connect SQW/INT to MCU interrupt pin (D2 or D3 on Uno/Nano, any GPIO on ESP32)
3. `attachInterrupt(digitalPinToInterrupt(2), wakeISR, FALLING);`
4. `set_sleep_mode(SLEEP_MODE_PWR_DOWN); sleep_enable(); sleep_cpu();`
5. ISR fires on alarm, MCU wakes, does work, sleeps again

**ProtoPulse implication:** The power budget calculator should recognize DS3231 + sleep mode as a power optimization pattern. When a project includes a DS3231 and battery power, the AI could suggest the alarm-wake pattern as an alternative to continuous-run designs.

---

Relevant Notes:
- [[ds3231-tcxo-accuracy-is-orders-of-magnitude-better-than-ds1307-crystal-drift-making-ds1307-obsolete-for-most-projects]] -- the alarm feature compounds the DS3231's advantage over DS1307 (which also has SQW but no alarms)
- [[mpu6050-and-ds3231-share-i2c-address-0x68-requiring-ad0-pin-configuration]] -- if both are on the bus, the alarm wake-up still works since only one device needs to be active at a time

Topics:
- [[sensors]]
- [[eda-fundamentals]]
