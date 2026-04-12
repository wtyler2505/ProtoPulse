---
description: Development boards and microcontroller units — Arduino, ESP, Raspberry Pi, and clones
type: moc
---

# microcontrollers

Development boards and MCU modules. The brains of every project.

## Parts

### Arduino / AVR Family (5V)

| Part | Voltage | MCU | Interfaces | Status | Qty |
|------|---------|-----|------------|--------|-----|
| [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] | 5V | ATmega328P | I2C, SPI, UART, USB | verified | 3 |
| [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] | 5V | ATmega2560 | I2C, SPI, UART x4, USB | verified | 1 |
| [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] | 5V | ATmega328P | I2C, SPI, UART, USB | needs-test | 1 |
| [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] | 5V | ATmega2560 | I2C, SPI, UART x4, USB | needs-test | 1 |
| [[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]] | 5V | ATmega328P | I2C, SPI, UART, USB | needs-test | 1 |
| [[dccduino-nano-is-an-arduino-nano-clone-with-ch340-usb]] | 5V | ATmega328P | I2C, SPI, UART, USB | needs-test | 1 |

### ESP Family (3.3V, WiFi)

| Part | Voltage | MCU | Interfaces | Status | Qty |
|------|---------|-----|------------|--------|-----|
| [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] | 3.3V | ESP32-WROOM-32 | I2C, SPI, UART, WiFi, BT, DAC | needs-test | 1 |
| [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] | 3.3V | ESP8266 | I2C, SPI, UART, WiFi | needs-test | 1 |
| [[sparkfun-blynk-board-esp8266-wifi-iot-preconfigured]] | 3.3V | ESP8266 | I2C, SPI, UART, WiFi | needs-test | 2 |

### Raspberry Pi Family (3.3V)

| Part | Voltage | MCU/SoC | Interfaces | Status | Qty |
|------|---------|---------|------------|--------|-----|
| [[raspberry-pi-3b-plus-is-a-quad-core-sbc-with-wifi-bt-ethernet]] | 3.3V | BCM2837B0 | I2C, SPI, UART, USB, HDMI, WiFi, BT, Ethernet | needs-test | 1 |
| [[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]] | 3.3V | RP2040 | I2C, SPI, UART, USB, PIO | verified | 5 |

### Adafruit SAMD51 Family (3.3V)

| Part | Voltage | MCU | Interfaces | Status | Qty |
|------|---------|-----|------------|--------|-----|
| [[adafruit-pygamer-samd51-handheld-gaming-board-with-tft]] | 3.3V | ATSAMD51J19 | I2C, SPI, UART, USB, STEMMA | needs-test | 1 |
| [[adafruit-monster-m4sk-dual-tft-display-board-for-animated-eyes]] | 3.3V | ATSAMD51G19 | I2C, SPI, UART, USB, STEMMA | needs-test | 1 |

## Quick Reference

| Board Family | Logic Level | USB Type | Key Feature |
|-------------|-------------|----------|-------------|
| Arduino Uno | 5V | USB-B | Beginner-friendly, huge ecosystem |
| Arduino Mega | 5V | USB-B | 54 I/O, 4 UARTs |
| Arduino Nano | 5V | Mini-USB | Breadboard-friendly, compact |
| ESP8266 | 3.3V | Micro-USB | WiFi built-in |
| ESP32 | 3.3V | Micro-USB | WiFi + BLE, dual-core |
| Raspberry Pi (SBC) | 3.3V | Micro-USB | Full Linux OS |
| Raspberry Pi Pico | 3.3V | Micro-USB | PIO state machines, $4 |
| SAMD51 (Adafruit) | 3.3V | Micro-USB | ARM Cortex-M4F, native USB |

## Voltage Warnings

- ESP8266/ESP32 are 3.3V logic — connecting directly to 5V Arduino pins will damage them
- Use level shifters or voltage dividers for mixed-voltage projects

---

Categories:
- [[index]]
