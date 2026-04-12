---
description: "WiFi-enabled MCU for IoT projects — ESP8266 with 802.11 b/g/n, 11 GPIO (all PWM), 4MB flash, 80/160MHz. 3.3V logic — do NOT connect to 5V signals directly"
topics: ["[[microcontrollers]]", "[[communication]]"]
status: verified
quantity: 1
voltage: [3.3]
interfaces: [GPIO, I2C, SPI, UART, WiFi, Analog, PWM]
logic_level: "3.3V"
logic_notes: "All GPIO are 3.3V-only. The board is usually powered from 5V USB into an onboard regulator, but signal pins must never see 5V directly."
manufacturer: "Amica (ESP8266 by Espressif)"
mcu: "ESP8266 (ESP-12E module)"
clock_mhz: 80
flash_kb: 4096
sram_kb: 80
pinout: |
  D0(GPIO16)  — wake from deep sleep, no PWM/I2C
  D1(GPIO5)   — SCL (I2C clock)
  D2(GPIO4)   — SDA (I2C data)
  D3(GPIO0)   — FLASH button, boot mode select (pull HIGH for normal boot)
  D4(GPIO2)   — onboard LED (active LOW), boot mode (must be HIGH at boot)
  D5(GPIO14)  — SCK (SPI clock)
  D6(GPIO12)  — MISO (SPI)
  D7(GPIO13)  — MOSI (SPI)
  D8(GPIO15)  — CS (SPI), boot mode (must be LOW at boot)
  A0          — analog input (0-1V range, 10-bit ADC)
  TX(GPIO1)   — UART TX
  RX(GPIO3)   — UART RX
level_shifter_needed: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]"]
compatible_with: ["[[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]]"]
used_in: []
warnings: ["3.3V logic — 5V on ANY pin will damage it permanently", "D3(GPIO0), D4(GPIO2), D8(GPIO15) have boot mode functions — wrong state at startup = boot failure", "Only 1 analog input (A0), 0-1V range only (not 0-3.3V like ESP32)", "Cannot use WiFi and ADC2 simultaneously (ESP32 issue, not ESP8266, but worth noting the single ADC)"]
datasheet_url: "https://www.espressif.com/sites/default/files/documentation/0a-esp8266ex_datasheet_en.pdf"
---

# ESP8266 NodeMCU Amica is a WiFi MCU with 11 I/O at 3.3V

The cheapest way to get a microcontroller on WiFi. The ESP8266 packs an 802.11 b/g/n radio, a 32-bit processor running at 80 or 160MHz, and 4MB of flash into a board that costs under $5. The NodeMCU Amica variant adds a USB-serial chip, voltage regulator, and breadboard-friendly pin headers so you can program it directly from the Arduino IDE.

The catch: only 11 usable GPIO pins, only 1 analog input (with a 0-1V range, not 0-3.3V), and 3 of those GPIO pins have boot mode restrictions that make them tricky to use. If you need more I/O or dual-core performance, step up to the ESP32. If you just need WiFi on a sensor node or a simple IoT device, the ESP8266 is the right tool.

## Specifications

| Spec | Value |
|------|-------|
| MCU | ESP8266 (Tensilica L106, 32-bit RISC) |
| Clock | 80MHz (overclockable to 160MHz) |
| Flash | 4MB (ESP-12E module) |
| SRAM | 80KB (instruction) + 32KB (instruction cache) |
| WiFi | 802.11 b/g/n (2.4GHz only) |
| Operating Voltage | 3.3V |
| Input Voltage | 5V via USB (onboard 3.3V regulator) |
| GPIO | 11 usable (D0-D8, TX, RX) |
| PWM | All GPIO pins (software PWM, 10-bit, ~1kHz) |
| ADC | 1 channel (A0), 10-bit, 0-1V input range |
| I2C | Software (any pins, default D1/D2) |
| SPI | Hardware (D5-D8) |
| UART | 1 full (TX/RX) + 1 TX-only (GPIO2/D4) |
| USB | Micro-USB (CP2102 or CH340 serial chip) |
| Deep Sleep Current | ~20uA |
| Dimensions | ~58 x 31mm |

## Pinout

```
        +-----[USB]-----+
   A0   |●              | Reserved
   RSV  |               | Reserved
   RSV  |               | Reserved
   D5   | (GPIO14/SCK)  | D0  (GPIO16/WAKE)
   D6   | (GPIO12/MISO) | D1  (GPIO5/SCL)
   D7   | (GPIO13/MOSI) | D2  (GPIO4/SDA)
   D8   | (GPIO15/CS)   | D3  (GPIO0/FLASH)
   RX   | (GPIO3)       | D4  (GPIO2/LED)
   TX   | (GPIO1)       | GND
   GND  |               | 3.3V
   3.3V |               | ---
        +---------------+
```

## Boot Pin Restrictions — CRITICAL

Three GPIO pins pull double duty as boot mode selectors. The ESP8266 reads their state at power-on to decide how to boot. If you have a peripheral holding one of these pins in the wrong state during reset, the board won't boot.

| Pin | GPIO | Boot Requirement | Safe Use |
|-----|------|-----------------|----------|
| D3 | GPIO0 | **HIGH** = normal boot, **LOW** = flash/upload mode | Output only after boot. The FLASH button on the board pulls this LOW for programming. Don't connect anything that holds it LOW at startup. |
| D4 | GPIO2 | **HIGH** at boot (has internal pull-up) | Safe for output after boot. The onboard LED is on this pin (active LOW). Avoid I2C devices that pull SDA low during boot if using this as I2C. |
| D8 | GPIO15 | **LOW** at boot (has external pull-down on most boards) | Safe for output after boot. SPI CS uses this pin. Don't connect anything that pulls it HIGH at startup. |

**Practical rules:**
- Don't connect I2C devices to D3/D4/D8 — their startup behavior can hold boot pins in wrong states
- Use D1(GPIO5) and D2(GPIO4) for I2C — GPIO5 has no boot restrictions, and GPIO4's requirement (HIGH) is usually satisfied by I2C pull-ups
- SPI is fine on D5-D8 since D8(CS) is pulled LOW by default, which is what boot needs
- D0(GPIO16) has no boot restriction but cannot do PWM or I2C — it's on a different internal peripheral

## GPIO Quick Reference

| D-label | GPIO | PWM | I2C | SPI | Boot | Notes |
|---------|------|-----|-----|-----|------|-------|
| D0 | 16 | NO | NO | - | - | Wake from deep sleep only |
| D1 | 5 | Yes | SCL | - | - | Best general-purpose pin |
| D2 | 4 | Yes | SDA | - | - | Best general-purpose pin |
| D3 | 0 | Yes | - | - | HIGH | FLASH button, tricky |
| D4 | 2 | Yes | - | - | HIGH | Onboard LED (active LOW) |
| D5 | 14 | Yes | - | SCK | - | SPI clock |
| D6 | 12 | Yes | - | MISO | - | SPI data in |
| D7 | 13 | Yes | - | MOSI | - | SPI data out |
| D8 | 15 | Yes | - | CS | LOW | Pull-down on board |
| TX | 1 | Yes | - | - | - | Serial TX, debug output at boot |
| RX | 3 | Yes | - | - | - | Serial RX |
| A0 | ADC | - | - | - | - | 0-1V analog input only |

## Breadboard Compatibility

The NodeMCU Amica has a **23mm row spacing** between the two pin headers. This is specifically designed to fit a standard breadboard (which has 2.54mm pitch rails spaced ~23mm apart). Unlike the wider NodeMCU LoLin/V3 variant (~25mm spacing), the Amica leaves both outer breadboard rails accessible for jumper wires. The wider V3 variant covers one rail entirely.

## Safe GPIO Summary

Of the 11 GPIO pins, only **5 are truly safe** for general-purpose use with no boot restrictions or special functions:

| Pin | GPIO | Why It's Safe |
|-----|------|---------------|
| **D1** | GPIO5 | No boot function, I2C SCL default |
| **D2** | GPIO4 | No boot function, I2C SDA default |
| **D5** | GPIO14 | No boot function, SPI SCK |
| **D6** | GPIO12 | No boot function, SPI MISO |
| **D7** | GPIO13 | No boot function, SPI MOSI |

The remaining pins all have caveats:
- **D0** (GPIO16) — No PWM, no I2C, deep sleep wake only
- **D3** (GPIO0) — Boot mode pin, FLASH button
- **D4** (GPIO2) — Boot mode pin, onboard LED
- **D8** (GPIO15) — Boot mode pin, must be LOW at boot
- **TX** (GPIO1) — Serial output, debug spew at boot
- **RX** (GPIO3) — Serial input

**Rule of thumb:** Wire your critical peripherals to D1, D2, D5, D6, D7. Use the other pins only if you understand their boot behavior and can tolerate it.

## Wiring Notes

**Connecting to 5V Arduino boards:**
The ESP8266 is 3.3V logic. Connecting ANY pin to a 5V signal will damage it. When interfacing with an [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] or [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]], you need level shifting:

- **Bidirectional level shifter** (e.g., BSS138-based 4-channel) — best for I2C and bidirectional signals
- **Voltage divider** (10k + 20k) — cheapest option for unidirectional 5V→3.3V signals
- **Direct connection 3.3V→5V** — most 5V boards read 3.3V as HIGH, so ESP→Arduino direction often works without shifting (but verify with your specific board)

**I2C wiring:**
- Use D1(GPIO5) for SCL and D2(GPIO4) for SDA
- External 4.7k pull-ups to 3.3V recommended (internal pull-ups are weak)
- The [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]] works directly at 3.3V — no level shifting needed

**Analog input (A0):**
- Input range is 0-1V, NOT 0-3.3V
- To read a 3.3V signal, use a voltage divider (220k + 100k gives ~1V from 3.3V)
- 10-bit resolution = ~1mV per step

**Power:**
- The board has an onboard 3.3V regulator fed from USB 5V
- You can power via USB (easiest) or feed 5V into the Vin pin
- Do NOT feed 5V into the 3.3V pin — that bypasses the regulator and damages the ESP
- WiFi transmit draws ~170mA peaks — make sure your power supply can handle it
- In deep sleep: ~20uA — great for battery-powered sensor nodes

**Arduino IDE setup:**
- Board Manager URL: `http://arduino.esp8266.com/stable/package_esp8266com_index.json`
- Board: "NodeMCU 1.0 (ESP-12E Module)"
- Upload speed: 115200 or 921600
- Flash size: 4MB (FS:2MB OTA:~1019KB) for OTA updates

## WiFi Radio Specifications

| Parameter | Value |
|-----------|-------|
| Standard | IEEE 802.11 b/g/n (2.4GHz only) |
| Antenna | PCB trace antenna, ~2 dBi gain |
| TX Power (802.11b) | +19.5 dBm |
| TX Power (802.11n) | +16 dBm |
| RX Sensitivity (11 Mbps) | -91 dBm |
| RX Sensitivity (54 Mbps) | -75 dBm |
| RX Sensitivity (MCS7) | -72 dBm |
| Security | WEP, WPA/WPA2 PSK, WPA2 Enterprise |
| Modes | Station, Access Point, Station+AP, WiFi Direct |
| Max Station Connections (AP mode) | 4-8 simultaneous |

## Current Consumption by Mode

| Mode | Current Draw | Notes |
|------|-------------|-------|
| WiFi TX (802.11b) | 170 mA | Peak during transmit bursts |
| WiFi TX (802.11n) | 140 mA | Peak during transmit bursts |
| WiFi RX | 50-70 mA | Varies with signal strength |
| Normal operation (WiFi connected, idle) | 70-80 mA | Typical application average |
| CPU active, no WiFi | 80 mA | Processing only |
| WiFi connected, idle | 15-20 mA | Maintaining connection |
| Modem sleep (WiFi off, CPU on) | 15-20 mA | CPU remains active |
| Light sleep | 0.4-0.9 mA | CPU suspended, fast wake (~3ms) |
| Deep sleep (chip alone) | 20 uA | Everything off except RTC |
| Deep sleep (NodeMCU board) | 8-20 mA | Board components (regulator, USB chip) add overhead |

## Deep Sleep Wiring

To use deep sleep with timed wake-up, GPIO16 (D0) must be connected to RST:

```
    GPIO16 (D0) ──→ RST pin

    When the RTC timer expires, GPIO16 pulses LOW,
    which resets the chip and restarts from setup().
```

**Important:** With GPIO16 connected to RST, you cannot use D0 for other purposes. The deep sleep current of 20uA is for the ESP8266 chip alone — the NodeMCU board's voltage regulator and USB-serial chip draw 8-20mA even when the ESP is sleeping. For true ultra-low-power battery operation, bypass the onboard regulator and power the ESP-12E module directly at 3.3V.

## Flash-Connected Pins — DO NOT USE

GPIO9 (D9/SD2) and GPIO10 (D10/SD3) are connected to the SPI flash chip on the ESP-12E module. **Attempting to use these pins will crash the ESP8266 or corrupt the flash.** They are not broken out on most NodeMCU boards, but if your board exposes them, leave them disconnected.

## Warnings

- **3.3V logic is non-negotiable** — 5V on any pin = dead chip
- **Boot pins (D3/D4/D8)** — peripherals holding these in wrong states at boot = board won't start
- **Only 1 analog input** — if you need more, use an external ADC (ADS1115) over I2C
- **A0 range is 0-1V** — common mistake is assuming 0-3.3V like the ESP32
- **WiFi uses significant RAM** — only ~30KB free for your program when WiFi is active
- **GPIO16 (D0) is special** — no PWM, no I2C, only useful for deep sleep wake or simple digital I/O
- **Software PWM** — not hardware like ESP32. Frequency is ~1kHz, may flicker LEDs at low brightness. Not suitable for servo control without a library that compensates.
- **GPIO9/GPIO10 are flash pins** — connected to the SPI flash chip, do NOT use them as GPIO or you'll crash the chip

---

Related Parts:
- [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]] -- I2C display, works directly at 3.3V
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] -- 5V board, needs level shifter to interface
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] -- 5V board, needs level shifter to interface

Categories:
- [[microcontrollers]]
- [[communication]]
