---
description: "Common pitfalls and physical limitations for UART, I2C, SPI, and wireless protocols, including pull-up resistor requirements, address collisions, and interference resolution."
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# communication

Wireless and wired communication protocols, module pairing, range/reliability trade-offs, and connectivity module selection for the inventory (see [[hardware-components]] for physical specs). Covers Bluetooth HC-05/HC-06, IR NEC protocol, W5100 Ethernet, RS-485, PoE, RFID, and WiFi MCU integration gotchas.

## Knowledge Notes

### I2C bus
- [[most-hmc5883l-modules-sold-today-are-qmc5883l-clones-with-incompatible-i2c-address]] — I2C address mismatch on clone magnetometer modules
- [[mpu6050-and-ds3231-share-i2c-address-0x68-requiring-ad0-pin-configuration]] — I2C bus conflict resolution

### UART / Serial
- [[uart-dominates-wireless-modules-consuming-dedicated-serial-ports]] — Bluetooth + GPS + debug each consume a dedicated UART; multi-wireless projects need Mega or ESP32
- [[raspberry-pi-mini-uart-is-default-on-gpio14-15-and-getting-pl011-requires-disabling-bluetooth]] — RPi mini UART default, PL011 locked by Bluetooth
- [[bluetooth-shield-consumes-arduino-hardware-uart-rx-tx-pins-0-and-1-creating-a-conflict-with-usb-serial-upload-and-debug-print]] — BT shield (HC-05, OSEPP BTH-B1) locks the Uno's only UART, blocking upload and Serial Monitor
- [[ch340-usb-serial-driver-support-varies-by-os-and-most-modern-systems-include-it-natively]] — CH340 USB-serial driver platform compatibility matrix
- [[arduino-ide-board-selection-targets-the-mcu-not-the-usb-serial-chip-so-clones-use-same-menu-entry]] — IDE board menu targets the MCU, not the USB-serial bridge

### SPI bus
- [[spi-bus-sharing-on-a-single-shield-requires-per-device-chip-select-discipline-where-unused-devices-must-be-explicitly-deselected]] — multiple SPI devices on one bus need explicit CS pin management; Ethernet shield has W5100 + SD card

### IR (infrared) remote protocol
- [[ir-demodulator-output-is-active-low-which-inverts-the-mental-model-of-signal-received-equals-pin-high]] — active-LOW output inverts beginner expectations; configure FALLING edge interrupts
- [[kit-ir-receiver-modules-from-different-manufacturers-are-functionally-identical-tsop-38khz-demodulators]] — KY-022, IR-01, OSEPP IRR-01 are all the same TSOP1738 IC; consolidate in BOM
- [[fluorescent-lighting-interferes-with-38khz-ir-receivers-because-the-discharge-frequency-overlaps-the-demodulation-band]] — environmental gotcha: fluorescent lights cause false IR triggers
- [[nec-ir-button-codes-are-manufacturer-specific-making-code-first-debugging-impossible-without-reading-your-own-remote]] — must discover YOUR remote's codes first; no universal NEC code table exists
- [[dead-coin-cell-is-the-invisible-first-failure-mode-on-kit-ir-remotes]] — check battery before debugging code/wiring
- [[ir-transmitter-requires-software-generated-38khz-carrier-while-receiver-demodulates-in-hardware-creating-a-complexity-asymmetry]] — transmitting needs PWM timer pin; receiving works on any GPIO
- [[bare-ir-led-breakout-modules-have-1-2m-range-and-extending-range-requires-a-driver-transistor]] — GPIO current limits range; use PN2222A driver for 5-10m

### Bluetooth (classic SPP, HC-05/HC-06)
- [[hc-05-master-slave-capability-is-the-selection-criterion-over-hc-06-for-device-to-device-bluetooth]] — HC-05 = master/slave, HC-06 = slave only; topology determines selection
- [[hc-05-bluetooth-4-box-label-is-marketing-fiction-covering-bluetooth-2-edr-with-spp-only]] — "Bluetooth 4.0" on the box is a lie; no BLE, no iOS, no low-power
- [[hc-05-and-hc-06-at-command-interfaces-are-incompatible-despite-sharing-the-same-bluetooth-silicon]] — different baud rates, different syntax, different AT mode entry; mixing tutorials causes silent failures
- [[spp-bluetooth-modules-act-as-transparent-uart-bridges-where-application-code-is-protocol-unaware]] — once paired, Serial.print() works identically over USB or Bluetooth; zero protocol knowledge required

### Ethernet / IP networking
- [[w5100-hardware-tcp-ip-offload-means-the-mcu-never-touches-packet-framing-which-trades-socket-count-for-code-simplicity]] — hardware TCP/IP offload: zero RAM cost but 4-socket ceiling; opposite pattern to ESP software stacks
- [[gigabit-ethernet-on-raspberry-pi-is-throttled-to-300mbps-because-it-shares-the-usb-2-bus]] — RPi Gigabit Ethernet throttled by USB 2.0 bus
- [[poe-802-3af-delivers-power-and-data-over-one-ethernet-cable-eliminating-a-separate-power-run-at-the-cost-of-a-poe-capable-switch]] — PoE 802.3af trades a separate power run for a PoE-capable switch upstream

### RS-485 (long-run serial)
- [[rs-485-differential-signaling-survives-long-cable-runs-and-electrical-noise-where-single-ended-serial-would-fail]] — differential pair survives 100m+ cable runs; single-ended UART fails past a few meters

### RFID
- [[rfid-13mhz-reads-only-iso-14443a-tags-within-5cm-limiting-use-to-contact-range-applications]] — 13.56MHz RFID is contact-range only; don't expect proximity/walk-by reads
- [[mifare-classic-default-keys-are-public-knowledge-making-it-unsuitable-for-real-security]] — MIFARE Classic provides identification, not authentication; default keys are public and Crypto-1 is broken — use DESFire for access control

### Wireless module selection / integration
- [[wireless-modules-are-overwhelmingly-3v3-making-level-shifting-the-default]] — 8/11 communication modules use 3.3V logic; level shifting is the default wiring concern for 5V MCU projects
- [[raspberry-pi-has-networking-wifi-bluetooth-built-in-but-only-one-low-quality-uart]] — TENSION: RPi solves networking but creates UART bottleneck
- [[l298n-ttl-input-thresholds-allow-3v3-mcu-control-despite-5v-logic-supply]] — TTL thresholds (2.3V HIGH) allow 3.3V MCUs to control L298N without level shifting
- [[cloud-dependent-iot-boards-outlive-their-cloud-service-making-reflash-literacy-essential]] — IoT boards (Blynk, Particle, SmartThings) go dark when the cloud dies; reflashing is the recovery path

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]] — Core EDA domain hub -- MCU pin constraints, protocol fundamentals, simulation algorithms, PCB design rules, and standards; cross-links to all hardware topic maps
- [[index]] — Entry point to the ProtoPulse knowledge vault -- 528 atomic notes across 11 hardware topic maps covering microcontrollers, actuators, sensors, displays, power, communication, shields, passives, input devices, and system wiring
