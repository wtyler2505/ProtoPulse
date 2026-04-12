---
description: "GPIO14/15 run a mini UART by default (lower baud accuracy, no flow control); the PL011 full UART is claimed by Bluetooth and requires dtoverlay=disable-bt to reclaim"
type: claim
source: "docs/parts/raspberry-pi-3b-plus-is-a-quad-core-sbc-with-wifi-bt-ethernet.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[communication]]"
related_components:
  - "raspberry-pi-3b-plus"
---

# Raspberry Pi mini UART is default on GPIO14/15 and getting PL011 requires disabling Bluetooth

The Raspberry Pi 3B+ has two UART peripherals, but only one GPIO UART pin pair (GPIO14 TX, GPIO15 RX):

1. **PL011 (UART0)** -- full-featured UART with dedicated baud rate generator, hardware flow control (CTS/RTS), FIFO buffers, and accurate timing at all standard baud rates
2. **Mini UART (UART1)** -- simplified UART tied to the core VPU clock. Baud rate accuracy depends on core clock frequency, which varies with CPU throttling. No hardware flow control. Smaller FIFO (8 bytes vs PL011's 16 bytes).

By default, the PL011 is assigned to the Bluetooth subsystem (the BCM43455 WiFi/BT chip), and the mini UART is mapped to GPIO14/15. This means out-of-the-box serial communication on the GPIO header uses the inferior UART.

The mini UART's clock dependency is the critical problem: when the CPU throttles (thermal throttling, `force_turbo=0`, idle frequency scaling), the baud rate drifts. At 115200 baud, clock drift can cause framing errors and garbled data. This is invisible in casual testing but shows up under CPU load or thermal stress -- exactly when you are debugging something else.

To get the PL011 on GPIO14/15, add to `/boot/config.txt`:
```
dtoverlay=disable-bt
```
This disables the Bluetooth module's claim on PL011 and remaps it to the GPIO header. Bluetooth becomes unavailable. There is no way to have both the PL011 on GPIO14/15 AND Bluetooth active simultaneously without additional hardware (a USB Bluetooth adapter to replace the disabled onboard one).

**ProtoPulse implication:** When a design includes both an RPi UART connection (to a GPS, Arduino, or other serial device) and Bluetooth, the DRC engine should warn about the UART quality tradeoff. The wiring notes or coach should explain the `disable-bt` option and its consequences.

---

Relevant Notes:
- [[uart-dominates-wireless-modules-consuming-dedicated-serial-ports]] -- UART as a scarce resource across all platforms
- [[uno-single-uart-shared-with-usb-forces-choose-one-between-debugging-and-peripherals]] -- same class of problem: UART contention between system function and user peripheral

Topics:
- [[microcontrollers]]
- [[communication]]
