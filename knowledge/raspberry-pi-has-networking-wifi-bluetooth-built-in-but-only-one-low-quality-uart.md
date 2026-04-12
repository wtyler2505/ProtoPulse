---
description: "The RPi 3B+ solves networking but creates a UART bottleneck -- 1 UART (mini quality by default) vs Mega's 4 hardware UARTs for serial-heavy projects"
type: tension
source: "docs/parts/raspberry-pi-3b-plus-is-a-quad-core-sbc-with-wifi-bt-ethernet.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[communication]]"
related_components:
  - "raspberry-pi-3b-plus"
  - "arduino-mega-2560"
---

# Raspberry Pi has networking, WiFi, and Bluetooth built-in but only one low-quality UART

The RPi 3B+ is the obvious choice when a project needs WiFi, Bluetooth, Ethernet, and a filesystem. It has all of these built-in. But it exposes only 1 UART on the GPIO header, and that UART is the mini UART by default (inferior baud rate accuracy, no flow control).

This creates a fundamental tension for projects like the OmniTrek rover:

| Need | UART Cost |
|------|-----------|
| GPS module (NMEA output) | 1 UART |
| Arduino companion (motor control) | 1 UART |
| Debug/serial monitor | 1 UART |
| Bluetooth serial (if PL011 reclaimed) | conflicts with UART |

A rover with GPS + Arduino companion + debug serial needs 3 UARTs. The Arduino Mega has 4 hardware UARTs -- exactly the board that solves serial-heavy projects. But the Mega has no WiFi, no Bluetooth, no Ethernet, no filesystem. The board that solves networking creates a UART bottleneck for the peripherals that need serial.

**Resolution patterns:**
1. **USB-to-serial adapters** -- each FTDI/CH340/CP2102 adapter adds a `/dev/ttyUSBn` port. Cheap, reliable, but consumes USB ports and adds wiring complexity.
2. **Companion MCU** -- offload all serial peripherals to a Pico/Mega connected via a single USB/UART link. The MCU multiplexes its multiple UARTs and speaks a simple protocol to the RPi.
3. **I2C/SPI alternatives** -- some devices (GPS, IMU, ADC) offer I2C or SPI as an alternative to UART, bypassing the UART constraint entirely.
4. **Software serial on GPIO** -- technically possible via `pigpio` or kernel overlays, but unreliable due to Linux timing jitter (see [[linux-kernel-preemption-makes-gpio-timing-unpredictable-requiring-companion-mcu-for-real-time]]).

The companion MCU pattern resolves this tension most cleanly: the RPi handles networking and computation while the MCU handles all real-time I/O including multiple UART peripherals.

---

Relevant Notes:
- [[uart-dominates-wireless-modules-consuming-dedicated-serial-ports]] -- UART scarcity as a project-sizing constraint across all platforms
- [[raspberry-pi-mini-uart-is-default-on-gpio14-15-and-getting-pl011-requires-disabling-bluetooth]] -- the mini UART quality problem compounds the scarcity
- [[linux-kernel-preemption-makes-gpio-timing-unpredictable-requiring-companion-mcu-for-real-time]] -- why software UART on RPi is unreliable

Topics:
- [[microcontrollers]]
- [[communication]]
