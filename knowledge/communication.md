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
- [[raspberry-pi-mini-uart-is-default-on-gpio14-15-and-getting-pl011-requires-disabling-bluetooth]] — RPi mini UART default, PL011 locked by Bluetooth
- [[gigabit-ethernet-on-raspberry-pi-is-throttled-to-300mbps-because-it-shares-the-usb-2-bus]] — RPi Gigabit Ethernet throttled by USB 2.0 bus
- [[raspberry-pi-has-networking-wifi-bluetooth-built-in-but-only-one-low-quality-uart]] — TENSION: RPi solves networking but creates UART bottleneck
- [[ir-demodulator-output-is-active-low-which-inverts-the-mental-model-of-signal-received-equals-pin-high]] — active-LOW output inverts beginner expectations; configure FALLING edge interrupts
- [[kit-ir-receiver-modules-from-different-manufacturers-are-functionally-identical-tsop-38khz-demodulators]] — KY-022, IR-01, OSEPP IRR-01 are all the same TSOP1738 IC; consolidate in BOM
- [[fluorescent-lighting-interferes-with-38khz-ir-receivers-because-the-discharge-frequency-overlaps-the-demodulation-band]] — environmental gotcha: fluorescent lights cause false IR triggers
- [[nec-ir-button-codes-are-manufacturer-specific-making-code-first-debugging-impossible-without-reading-your-own-remote]] — must discover YOUR remote's codes first; no universal NEC code table exists
- [[dead-coin-cell-is-the-invisible-first-failure-mode-on-kit-ir-remotes]] — check battery before debugging code/wiring

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]
