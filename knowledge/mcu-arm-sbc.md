---
description: "ARM-based MCUs (RP2040, SAMD) and Single-Board Computers (Raspberry Pi)"
type: moc
topics:
  - "[[microcontrollers]]"
---

# mcu-arm-sbc

RP2040 / Pi Pico capabilities, SAMD ARM migration issues, and Raspberry Pi SBC GPIO constraints.

## Notes
### ARM Arduino (SAMD, etc.)
- [[samd51-and-other-arm-arduino-boards-break-atmega-library-compatibility-silently]] — AVR-only libraries compile but misbehave on ARM cores
- [[native-usb-on-arm-mcus-eliminates-serial-bridge-enabling-direct-hid-and-midi-device-emulation]] — ARM MCUs with USB peripheral skip CH340/FTDI bridge entirely

### RP2040 / Raspberry Pi Pico
- [[rp2040-pio-state-machines-implement-custom-protocols-at-hardware-speed]] — PIO implements custom protocols in hardware, unique to RP2040
- [[pico-12ma-per-pin-50ma-total-is-strictest-gpio-budget-among-maker-mcus]] — strictest current limits among common MCUs
- [[rp2040-peripheral-pin-mapping-eliminates-most-conflicts-because-all-peripherals-remap]] — all peripherals remappable, not just I2C
- [[pico-has-only-3-adc-channels-requiring-external-adc-for-analog-heavy-projects]] — fewest ADC channels among common MCUs
- [[pico-uf2-drag-and-drop-bootloader-eliminates-external-programmers]] — drag-and-drop firmware upload, unbrickable
- [[circuitpython-filesystem-can-consume-half-of-pico-2mb-flash]] — environment choice affects flash budget
- [[pico-lacks-wifi-bluetooth-requiring-pico-w-or-external-wireless]] — no wireless on base Pico; Pico W or ESP bridge
- [[pico-vsys-accepts-1v8-to-5v5-enabling-direct-battery-operation]] — wide input voltage with Schottky backfeed protection
- [[pico-3v3-en-pin-disables-regulator-for-external-sleep-control]] — hardware sleep via regulator disable

### Raspberry Pi (SBC)
- [[an-sbc-runs-linux-and-replaces-a-microcontroller-when-you-need-os-filesystem-networking-or-multitasking]] — SBC vs MCU selection boundary
- [[raspberry-pi-gpio-is-3v3-unprotected-with-no-clamping-diodes-and-5v-kills-the-soc-permanently]] — 5V on any GPIO pin permanently destroys the SoC
- [[raspberry-pi-has-zero-built-in-adc-requiring-external-mcp3008-or-ads1115-for-any-analog-input]] — no analog input at all, external ADC required
- [[linux-kernel-preemption-makes-gpio-timing-unpredictable-requiring-companion-mcu-for-real-time]] — Linux scheduling prevents real-time GPIO, need companion MCU
- [[raspberry-pi-mini-uart-is-default-on-gpio14-15-and-getting-pl011-requires-disabling-bluetooth]] — mini UART default, PL011 locked by Bluetooth
- [[underpowering-a-raspberry-pi-causes-crashes-and-sd-card-corruption]] — 5V/2.5A required, undervoltage corrupts SD card
- [[gigabit-ethernet-on-raspberry-pi-is-throttled-to-300mbps-because-it-shares-the-usb-2-bus]] — spec vs reality: USB 2.0 bottleneck limits to ~300Mbps
- [[sd-card-wear-from-heavy-writes-requires-ssd-via-usb-for-write-heavy-workloads]] — microSD write endurance limits, SSD for heavy workloads
- [[raspberry-pi-has-networking-wifi-bluetooth-built-in-but-only-one-low-quality-uart]] — TENSION: networking solved but UART bottleneck created
