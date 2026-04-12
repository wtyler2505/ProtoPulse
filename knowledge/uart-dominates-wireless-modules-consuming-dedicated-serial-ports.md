---
description: "Bluetooth, GPS, and debug serial all require dedicated UART lines that cannot be shared -- a rover with GPS + Bluetooth + debug needs 3 UARTs minimum, making the Mega's 4 hardware UARTs a hard requirement"
type: insight
source: "docs/parts/communication.md"
confidence: proven
topics:
  - "[[communication]]"
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components:
  - "osepp-bluetooth-bth-01"
  - "osepp-bluetooth-btm-01"
  - "neo-6m-gps-module"
  - "arduino-mega-2560"
---

# UART dominates wireless communication modules consuming dedicated serial ports

Bluetooth (HC-05, HC-06), GPS (NEO-6M), and debug serial all require dedicated UART lines. Unlike SPI (which can share a bus with multiple chip-select pins) or I2C (multi-device on one bus with addressing), UART is inherently point-to-point. Each UART device occupies one TX/RX pair exclusively.

A rover project with GPS navigation + Bluetooth telemetry + serial debug console needs 3 UARTs minimum. This is exactly why the Arduino Mega's 4 hardware UARTs (Serial, Serial1, Serial2, Serial3) matter -- it's the only common Arduino-form-factor board that can handle this without SoftwareSerial.

**The SoftwareSerial trap:** On Uno/Nano (1 hardware UART shared with USB), adding any wireless UART module forces SoftwareSerial. SoftwareSerial is unreliable above 9600 baud, can't receive while transmitting, and blocks interrupts during bit-banging. For GPS (which streams NMEA at 9600 baud continuously) plus Bluetooth (which needs responsive bidirectional communication), SoftwareSerial is a hidden failure mode.

**MCU selection rule:** Count UART devices in the BOM. If count >= 2 (not including USB debug), the project needs a Mega or ESP32 (3 hardware UARTs). This is a hard constraint, not a preference.

---

Relevant Notes:
- [[mega-2560-four-hardware-uarts]] -- Mega's UART count directly enables multi-wireless projects
- [[esp32-adc2-unavailable-when-wifi-active]] -- ESP32's WiFi trades ADC2, but retains all 3 UARTs

Topics:
- [[communication]]
- [[microcontrollers]]
- [[eda-fundamentals]]
