---
description: Running a bus-enumeration scanner before any driver library is the mandatory first step on a new multi-device I2C bus because it isolates wiring/address/pull-up faults from driver/timing/config faults
type: atomic
created: 2026-04-14
source: "[[wiring-i2c-multi-device-bus-compass-imu-current-sensor]]"
confidence: verified
topics:
  - "[[communication]]"
  - "[[wiring-integration]]"
---

# I2C scanner sketch is the mandatory first debug step after wiring a multi-device bus

A bus-enumeration scanner (a short sketch that calls `Wire.beginTransmission(addr)` for every address 0x03-0x77 and checks for ACK) is the correct first step when testing a newly-wired I2C bus, BEFORE loading any driver library.

The reason is stack layering. I2C bus failures occur at several distinct layers:

1. **Wiring layer** — SDA/SCL swapped, missing ground, wrong voltage, broken solder joint
2. **Pull-up layer** — no pull-ups, pull-ups too weak, pull-ups in parallel exceeding sink current
3. **Address layer** — collision between two devices at the same address, address-select pin in wrong state
4. **Driver/library layer** — wrong Wire port, wrong frequency, wrong register init, library bugs

A driver-library test like `bno.begin()` failing doesn't tell you which layer failed — only that *some* layer failed. The scanner isolates layers 1-3 from layer 4. If the scanner sees 0x28, wiring/pullups/address are correct and the problem is in the driver. If the scanner misses 0x28, the problem is below the driver and no library debugging will help.

The methodology:

```
1. Wire the bus
2. Upload a scanner sketch
3. Verify EVERY expected address appears
4. THEN load the driver libraries and test functionality
```

Skipping step 3 is the #1 time-waster on multi-device I2C builds — hours lost debugging driver init that was actually a missing pull-up.

The scanner-first rule generalizes: when stacking a layered protocol (I2C, SPI, CAN, UART with framing), always verify the physical/link layer before testing the application layer. Distinct from specific-failure-mode notes like [[i2c-devices-on-esp8266-boot-pins-can-prevent-boot-silently]] or [[mpu6050-and-ds3231-share-i2c-address-0x68-requiring-ad0-pin-configuration]] — those are individual traps; this is the universal debugging protocol that catches all of them at once.

---

Source: [[wiring-i2c-multi-device-bus-compass-imu-current-sensor]] (lines 140-171)

Relevant Notes:
- [[i2c-devices-on-esp8266-boot-pins-can-prevent-boot-silently]]
- [[mpu6050-and-ds3231-share-i2c-address-0x68-requiring-ad0-pin-configuration]]
- [[most-hmc5883l-modules-sold-today-are-qmc5883l-clones-with-incompatible-i2c-address]]
- [[bno055-adr-pin-configures-the-i2c-address-between-0x28-and-0x29-enabling-two-fusion-imus-on-a-single-bus]]

Topics: [[communication]] [[wiring-integration]]
