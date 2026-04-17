---
description: "Cross-cutting microcontroller issues, bootloaders, and clones"
type: moc
topics:
  - "[[microcontrollers]]"
---

# mcu-cross-platform

Cross-cutting logic voltage gotchas, bootloader mismatches, clone boards, and USB-serial bridges.

## Notes
### Cross-platform / cross-cutting
- [[most-maker-displays-accept-3v3-5v-but-character-lcds-and-7-segments-are-5v-only-gotchas]] — 5V display gotchas for 3.3V MCU users (ESP32, Pi Pico)
- [[ch340-usb-serial-driver-support-varies-by-os-and-most-modern-systems-include-it-natively]] — CH340 driver platform compatibility matrix
- [[arduino-ide-board-selection-targets-the-mcu-not-the-usb-serial-chip-so-clones-use-same-menu-entry]] — IDE targets MCU, not USB bridge; clones use same board menu
- [[arduino-clone-bootloader-mismatch-causes-upload-failure-that-looks-like-hardware-fault]] — pre-Optiboot bootloader on clones causes avrdude sync error
- [[clone-arduino-voltage-regulators-can-overheat-silently-because-there-is-no-thermal-feedback]] — clone regulators may lack thermal shutdown; silent overheating risk
- [[cloud-dependent-iot-boards-outlive-their-cloud-service-making-reflash-literacy-essential]] — Blynk/Particle/SmartThings boards brick when cloud dies; reflash literacy is the recovery path
