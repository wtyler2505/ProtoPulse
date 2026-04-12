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

**The SoftwareSerial trap:** On Uno/Nano (1 hardware UART shared with USB), adding any wireless UART module forces SoftwareSerial. SoftwareSerial's practical baud limit is approximately 57600 (reliable only at 9600-19200 for continuous data), it can't receive while transmitting, and it blocks interrupts during bit-banging. The Uno's single UART is also the upload/debug channel -- you literally cannot open Serial Monitor while D0/D1 have a peripheral attached, making development painful. For GPS (which streams NMEA at 9600 baud continuously) plus Bluetooth (which needs responsive bidirectional communication), SoftwareSerial is a hidden failure mode.

**MCU selection rule:** Count UART devices in the BOM. If count >= 2 (not including USB debug), the project needs a Mega or ESP32 (3 hardware UARTs). This is a hard constraint, not a preference.

**Raspberry Pi exception:** The RPi 3B+ has only 1 UART on GPIO14/15, and it's the mini UART by default (inferior baud accuracy, no flow control). The PL011 (full-quality UART) is locked by the Bluetooth subsystem. Reclaiming PL011 requires `dtoverlay=disable-bt` which kills Bluetooth. Despite being the most powerful board in the inventory, the RPi is the worst for serial-heavy projects -- worse than even the Uno. For RPi projects with multiple serial peripherals, use USB-to-serial adapters or offload serial I/O to a companion MCU.

---

Relevant Notes:
- [[mega-2560-four-hardware-uarts]] -- Mega's UART count directly enables multi-wireless projects
- [[esp32-adc2-unavailable-when-wifi-active]] -- ESP32's WiFi trades ADC2, but retains all 3 UARTs

Topics:
- [[communication]]
- [[microcontrollers]]
- [[eda-fundamentals]]
