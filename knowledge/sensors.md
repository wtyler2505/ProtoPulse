---
description: "Sensor knowledge -- measurement principles, calibration, interface protocols, wiring gotchas, and selection criteria for distance, motion, environmental, and specialty sensors"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# sensors

Measurement principles, calibration requirements, protocol details, and wiring gotchas for sensors in the inventory. Covers ultrasonic, PIR, IMU, compass, GPS, current, temperature, humidity, light, sound, RFID, and specialty sensors.

## Knowledge Notes
- [[most-hmc5883l-modules-sold-today-are-qmc5883l-clones-with-incompatible-i2c-address]] — clone detection, library selection, I2C address mismatch
- [[mpu6050-and-ds3231-share-i2c-address-0x68-requiring-ad0-pin-configuration]] — I2C address conflict resolution for common sensor pairs
- [[ir-demodulator-output-is-active-low-which-inverts-the-mental-model-of-signal-received-equals-pin-high]] — active-LOW output inverts beginner expectations
- [[fluorescent-lighting-interferes-with-38khz-ir-receivers-because-the-discharge-frequency-overlaps-the-demodulation-band]] — fluorescent lights cause false IR triggers via 38kHz harmonic overlap
- [[ds3231-tcxo-accuracy-is-orders-of-magnitude-better-than-ds1307-crystal-drift-making-ds1307-obsolete-for-most-projects]] — DS3231 TCXO holds +/-2 ppm vs DS1307 minutes-per-month drift; unconditional replacement recommendation
- [[zs042-charging-circuit-will-damage-non-rechargeable-cr2032-batteries-unless-resistor-r5-is-removed]] — safety hazard: ZS-042 trickle-charges CR2032 unless R5 is removed
- [[ds3231-built-in-temperature-sensor-is-free-but-only-accurate-to-3-degrees-making-it-unsuitable-for-precision-environmental-sensing]] — readable temp sensor on DS3231 looks free but +/-3C accuracy misleads precision use cases
- [[ds3231-alarm-and-square-wave-outputs-enable-hardware-triggered-mcu-wake-from-sleep-without-polling]] — SQW/INT pin enables deep-sleep wake patterns for battery-powered projects
- [[rtclib-lostpower-pattern-sets-the-clock-to-compile-time-on-first-boot-preventing-uninitialized-timestamp-output]] — canonical init pattern prevents January 1, 2000 timestamps on fresh modules

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]
