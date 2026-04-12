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

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]
