---
description: "Communication module knowledge -- Bluetooth UART pairing, IR protocol encoding, Ethernet/WiFi networking, and wireless module selection"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# communication

Wireless and wired communication protocols, module pairing, range/reliability trade-offs, and connectivity module selection for the inventory. Covers Bluetooth HC-05/HC-06, IR NEC protocol, W5100 Ethernet, and WiFi MCUs.

## Knowledge Notes
- [[most-hmc5883l-modules-sold-today-are-qmc5883l-clones-with-incompatible-i2c-address]] — I2C address mismatch on clone magnetometer modules
- [[mpu6050-and-ds3231-share-i2c-address-0x68-requiring-ad0-pin-configuration]] — I2C bus conflict resolution
- [[wireless-modules-are-overwhelmingly-3v3-making-level-shifting-the-default]] — 8/11 communication modules use 3.3V logic; level shifting is the default wiring concern for 5V MCU projects
- [[uart-dominates-wireless-modules-consuming-dedicated-serial-ports]] — Bluetooth + GPS + debug each consume a dedicated UART; multi-wireless projects need Mega or ESP32

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]
