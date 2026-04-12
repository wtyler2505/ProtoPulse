---
description: "Pre-configured ESP8266 IoT board from SparkFun — ships with Blynk firmware for quick phone-to-hardware projects. Limited GPIO exposure, best for WiFi-connected sensor/actuator nodes that talk to a phone app"
topics: ["[[microcontrollers]]", "[[communication]]"]
status: needs-test
quantity: 2
voltage: [3.3]
interfaces: [GPIO, I2C, SPI, UART, WiFi, USB]
logic_level: "3.3V"
manufacturer: "SparkFun"
mcu: "ESP8266 (ESP-12S module)"
clock_mhz: 80
flash_kb: 4096
sram_kb: 80
part_number: "DEV-13794"
pinout: |
  GPIO0  — user button (active LOW), boot mode
  GPIO2  — onboard LED
  GPIO4  — I2C SDA
  GPIO5  — I2C SCL
  GPIO12 — available (active-low LED on some revisions)
  GPIO13 — available
  GPIO14 — available
  GPIO15 — boot mode (must be LOW at boot)
  GPIO16 — wake from deep sleep
  ADC    — analog input (0-1V)
  3V3    — 3.3V output
  GND    — ground
  VBAT   — battery input (3.3-6V, onboard LiPo charger)
  5V     — USB 5V
compatible_with: ["[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]]", "[[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]]", "[[ina219-high-side-current-sensor-26v-i2c-for-power-monitoring]]", "[[dht11-temperature-humidity-sensor-single-wire-0-50c]]"]
level_shifter_needed: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]"]
used_in: []
warnings: ["3.3V logic — 5V on ANY pin will damage the ESP8266", "Limited GPIO breakout compared to NodeMCU boards — check which pins are exposed on your revision", "Blynk legacy cloud service has been discontinued — board still works with custom firmware", "Same ESP8266 boot pin restrictions as NodeMCU (GPIO0, GPIO2, GPIO15)"]
datasheet_url: "https://www.sparkfun.com/products/13794"
---

# SparkFun Blynk Board ESP8266 WiFi IoT Preconfigured

The SparkFun Blynk Board is an ESP8266-based development board that shipped with Blynk firmware pre-loaded. The original pitch was "IoT in 5 minutes" — plug it in, connect it to the Blynk phone app, and start controlling GPIO pins from your phone. The Blynk legacy cloud service has since been discontinued, but the board itself is a perfectly good ESP8266 dev board that can be reflashed with any ESP8266 firmware.

Hardware-wise, it's an ESP-12S module on a SparkFun breakout with a few nice additions: onboard LiPo battery charger, a WS2812 RGB LED, a user button, and I2C QWIIC/STEMMA QT connector header pads. The GPIO breakout is more limited than a full NodeMCU board — if you need all 11 ESP8266 GPIOs, use the [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] instead.

## Specifications

| Spec | Value |
|------|-------|
| MCU | ESP8266 (ESP-12S module, Tensilica L106 32-bit) |
| Clock | 80MHz (overclockable to 160MHz) |
| Flash | 4MB |
| SRAM | 80KB |
| WiFi | 802.11 b/g/n (2.4GHz) |
| Operating Voltage | 3.3V |
| Input Voltage | 5V via USB, or 3.3-6V via VBAT (LiPo charger onboard) |
| GPIO | ~8 usable (limited breakout) |
| ADC | 1 channel (0-1V, 10-bit) |
| I2C | GPIO4 (SDA) / GPIO5 (SCL) |
| USB | Micro-USB |
| Battery | JST connector for LiPo, onboard MCP73831 charger |
| Extras | WS2812 RGB LED, user button (GPIO0), onboard LED (GPIO2) |

## Onboard Extras

- **WS2812 RGB LED** — connected to GPIO4 or a dedicated pin (check revision). Addressable, full RGB color.
- **User button** — connected to GPIO0. Also serves as the boot mode button (hold during reset to enter flash mode).
- **LiPo charger** — MCP73831 single-cell charger, charges from USB. Plug in a 3.7V LiPo and the board charges it while running.
- **Onboard LED** — GPIO2, active LOW, same as other ESP8266 boards.

## Reflashing with Custom Firmware

The Blynk firmware is no longer useful since the legacy cloud shut down. Reflash with:

1. **Arduino IDE** — install the ESP8266 board package, select "SparkFun Blynk Board" or "Generic ESP8266 Module"
2. **ESPHome** — YAML-based firmware for Home Assistant integration
3. **MicroPython** — flash the ESP8266 MicroPython firmware via esptool
4. **Tasmota** — for smart home device firmware

To enter flash mode: hold the GPIO0 button while pressing reset, or hold it while plugging in USB.

## Wiring Notes

- **I2C** on GPIO4 (SDA) / GPIO5 (SCL) — same default as NodeMCU boards. Compatible with 3.3V I2C devices.
- **Power via USB or LiPo** — the onboard charger makes this great for battery-powered projects. VBAT accepts 3.3-6V.
- **GPIO breakout is limited** — not all ESP8266 pins are brought out to headers. Check the board's silkscreen for available pins.
- **3.3V only** — same voltage restrictions as any ESP8266 board.

## Warnings

- **Blynk legacy is dead** — the original firmware is useful only for its WiFi provisioning setup. Reflash for any real project.
- **3.3V logic** — no 5V tolerance on any pin
- **Limited GPIO** — fewer broken-out pins than a NodeMCU board. If you need lots of I/O, use the full [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] or step up to the [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]
- **ESP8266 boot pin restrictions** — GPIO0 (HIGH for normal boot), GPIO2 (HIGH at boot), GPIO15 (LOW at boot) — same rules as all ESP8266 boards

---

Related Parts:
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] -- same ESP8266 MCU, more GPIO breakout, no battery charger
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] -- upgrade path, WiFi+BT, more GPIO
- [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]] -- I2C display, works at 3.3V
- [[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]] -- 9-axis IMU via I2C, native 3.3V
- [[ina219-high-side-current-sensor-26v-i2c-for-power-monitoring]] -- current/power sensor via I2C
- [[dht11-temperature-humidity-sensor-single-wire-0-50c]] -- temp/humidity sensor, single-wire protocol

Categories:
- [[microcontrollers]]
- [[communication]]
