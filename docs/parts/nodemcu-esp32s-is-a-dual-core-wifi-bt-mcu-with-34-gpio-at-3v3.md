---
description: "The ESP8266's big brother — dual-core 240MHz, WiFi + Bluetooth + BLE, 34 GPIO, 18 ADC channels (12-bit), hall sensor, touch pins, and hardware PWM. The go-to for any IoT project that needs real processing power"
topics: ["[[microcontrollers]]", "[[communication]]"]
status: verified
quantity: 1
voltage: [3.3]
interfaces: [GPIO, I2C, SPI, UART, WiFi, Bluetooth, Analog, PWM, DAC, Touch, CAN]
logic_level: "3.3V"
logic_notes: "All GPIO are 3.3V-only. The board can be powered from 5V USB/VIN because it has a regulator, but none of the signal pins are 5V tolerant."
manufacturer: "NodeMCU (ESP32 by Espressif)"
mcu: "ESP32-WROOM-32 (Xtensa LX6 dual-core)"
clock_mhz: 240
flash_kb: 4096
sram_kb: 520
pinout: |
  GPIO0   — boot mode (LOW=download, HIGH=run), has pull-up
  GPIO1   — TX0 (UART0 TX, debug output at boot)
  GPIO2   — onboard LED on many boards, must be LOW or floating at boot
  GPIO3   — RX0 (UART0 RX)
  GPIO4   — safe general purpose, ADC2_CH0, Touch0
  GPIO5   — safe general purpose, VSPI SS
  GPIO12  — HSPI MISO, ADC2_CH5, must be LOW at boot (sets flash voltage)
  GPIO13  — HSPI MOSI, ADC2_CH4, Touch4
  GPIO14  — HSPI SCK, ADC2_CH6, Touch6
  GPIO15  — HSPI SS, ADC2_CH3, must be HIGH at boot (suppresses boot log)
  GPIO16  — UART2 RX, safe general purpose
  GPIO17  — UART2 TX, safe general purpose
  GPIO18  — VSPI SCK, safe general purpose
  GPIO19  — VSPI MISO, safe general purpose
  GPIO21  — I2C SDA (default Wire), safe general purpose
  GPIO22  — I2C SCL (default Wire), safe general purpose
  GPIO23  — VSPI MOSI, safe general purpose
  GPIO25  — DAC1, ADC2_CH8
  GPIO26  — DAC2, ADC2_CH9
  GPIO27  — ADC2_CH7, Touch7
  GPIO32  — ADC1_CH4, Touch9, safe for analog when WiFi active
  GPIO33  — ADC1_CH5, Touch8, safe for analog when WiFi active
  GPIO34  — ADC1_CH6, input only (no pull-up/pull-down)
  GPIO35  — ADC1_CH7, input only (no pull-up/pull-down)
  GPIO36  — SVP, ADC1_CH0, input only
  GPIO39  — SVN, ADC1_CH3, input only
  VIN     — 5V input (to onboard 3.3V regulator)
  3V3     — 3.3V output (or direct power input)
  GND     — Ground (multiple pins)
  EN      — Chip enable (active HIGH, has pull-up)
level_shifter_needed: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]"]
compatible_with: ["[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]", "[[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]]"]
used_in: []
warnings: ["3.3V logic — 5V on ANY pin will damage it permanently", "GPIO34, 35, 36, 39 are INPUT ONLY — no output, no pull-up/pull-down", "ADC2 channels (GPIO0,2,4,12-15,25-27) CANNOT be used while WiFi is active — use ADC1 (GPIO32-39) instead", "GPIO12 must be LOW at boot or flash voltage gets set wrong and board won't boot", "GPIO6-11 are connected to internal SPI flash — do NOT use them"]
datasheet_url: "https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32_datasheet_en.pdf"
---

# NodeMCU ESP32S is a dual-core WiFi+BT MCU with 34 GPIO at 3.3V

The ESP32 is the natural upgrade from the [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]. Where the ESP8266 gives you WiFi and 11 GPIO, the ESP32 gives you WiFi + Bluetooth + BLE, dual-core 240MHz processing, 34 GPIO, 18 ADC channels (12-bit vs the ESP8266's single 10-bit), 2 DAC outputs, 10 touch-sensing pins, hardware PWM on any pin, and a CAN bus controller. It's not even close.

The ESP32-WROOM-32 module on this NodeMCU dev board includes 4MB flash, 520KB SRAM, and all the antenna matching circuitry. The dev board adds a USB-serial chip, voltage regulator, and breadboard-friendly headers. Powered via micro-USB or the Vin pin.

## Specifications

| Spec | Value |
|------|-------|
| MCU | ESP32-WROOM-32 (Xtensa LX6, dual-core 32-bit) |
| Clock | 240MHz (configurable: 80/160/240) |
| Flash | 4MB (SPI flash) |
| SRAM | 520KB |
| WiFi | 802.11 b/g/n (2.4GHz) |
| Bluetooth | v4.2 BR/EDR + BLE |
| Operating Voltage | 3.3V |
| Input Voltage | 5V via USB or Vin (onboard 3.3V regulator) |
| GPIO | 34 (25 usable — GPIO6-11 reserved for flash) |
| ADC | 18 channels (12-bit), two ADC peripherals |
| DAC | 2 channels (8-bit, GPIO25/GPIO26) |
| Touch Sensors | 10 capacitive touch pins |
| PWM | Up to 16 channels (hardware LEDC, any GPIO) |
| I2C | 2 buses (software-configurable to any pins) |
| SPI | 2 usable (HSPI + VSPI; SPI is used by flash) |
| UART | 3 (UART0 on GPIO1/3, UART2 on GPIO16/17, UART1 configurable) |
| CAN | 1 (TWAI, needs transceiver IC) |
| USB | Micro-USB (CP2102 or CH340) |
| Deep Sleep Current | ~10uA |
| Dimensions | ~51 x 28mm (varies by vendor) |

## ADC Warning — WiFi Kills ADC2

This is the single biggest ESP32 gotcha. The ESP32 has two ADC peripherals:

| ADC | Channels | GPIOs | Usable with WiFi? |
|-----|----------|-------|-------------------|
| ADC1 | 8 channels | GPIO32-39 | **YES** |
| ADC2 | 10 channels | GPIO0,2,4,12-15,25-27 | **NO** — WiFi uses ADC2 hardware |

If your project uses WiFi (and it probably does — that's why you picked an ESP32), you can ONLY read analog values from ADC1 channels (GPIO32-39). GPIO34-39 are input-only, which is fine for analog reads.

## Boot Pin Restrictions — CRITICAL

Several GPIOs affect boot behavior. If peripherals hold these pins in the wrong state during reset, the ESP32 won't boot.

| GPIO | Boot Requirement | Notes |
|------|-----------------|-------|
| GPIO0 | HIGH = normal, LOW = download mode | Has internal pull-up. Don't hold LOW externally at boot. |
| GPIO2 | LOW or floating at boot | Connected to onboard LED on many boards. |
| GPIO5 | HIGH at boot (default) | Controls timing of SDIO slave. Usually not a problem. |
| GPIO12 | **LOW at boot** | Sets flash voltage to 3.3V. If HIGH at boot, sets flash to 1.8V and board fails. |
| GPIO15 | HIGH at boot | If LOW, suppresses boot messages on UART0. |

**Safe general-purpose pins** (no boot restrictions, no flash conflicts): GPIO4, 5, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33.

## I2C Bus

Default Wire library uses GPIO21 (SDA) and GPIO22 (SCL), but I2C is software-implemented on the ESP32 — you can remap it to any GPIO pair.

```cpp
Wire.begin(SDA_PIN, SCL_PIN);  // any two GPIOs
```

External 4.7k pull-ups to 3.3V recommended. The [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]] connects directly at 3.3V — no level shifting needed.

## SPI Buses

| Bus | MOSI | MISO | SCK | SS | Notes |
|-----|------|------|-----|----|-------|
| SPI | GPIO7 | GPIO8 | GPIO6 | GPIO11 | **Reserved for internal flash — DO NOT USE** |
| HSPI | GPIO13 | GPIO12 | GPIO14 | GPIO15 | Available, but GPIO12/15 have boot restrictions |
| VSPI | GPIO23 | GPIO19 | GPIO18 | GPIO5 | **Best choice** — no boot conflicts |

## Wiring Notes

- **Power**: 5V via micro-USB or Vin pin. The onboard AMS1117 regulator drops to 3.3V. Max ~800mA from the regulator — enough for WiFi + BLE + a few sensors.
- **3.3V logic only**: connecting to 5V Arduino boards ([[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]], [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]) requires level shifting on all signal lines.
- **GPIO6-11**: connected to the SPI flash chip. Using these pins will crash the ESP32. Pretend they don't exist.
- **GPIO34-39**: input only. No internal pull-up or pull-down resistors. If you need a pull-up on these pins, add an external resistor.
- **DAC**: GPIO25 and GPIO26 have 8-bit DAC output (0-3.3V). Useful for generating analog waveforms, audio, or reference voltages.
- **Touch pins**: 10 capacitive touch inputs. Useful for button-less interfaces. Sensitivity is configurable.

## Board Variant: DOIT DevKit v1

The unit in inventory is the **DOIT DevKit v1** variant, which is a **30-pin** board (not the 38-pin WROOM variant). Key differences between variants:

| Feature | 30-Pin (DOIT DevKit v1) | 38-Pin (WROOM DevKit) |
|---------|------------------------|----------------------|
| Total pins | 30 (15 per side) | 38 (19 per side) |
| USB-Serial chip | **CP2102** (Silicon Labs) | Often CH340 |
| GPIO exposed | 25 usable | 25 usable + extra GND/power |
| Breadboard fit | Fits standard breadboard (both rows accessible) | Too wide for standard breadboard (covers both rails) |

The CP2102 USB chip requires the Silicon Labs driver on some systems. If the board isn't recognized over USB, install the CP2102 driver from https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers

## ADC Attenuation Settings

The ESP32's 12-bit ADC has configurable attenuation that changes the input voltage range. Set this before reading analog values or your readings will clip.

| Attenuation | Input Range | Best For | Arduino Constant |
|-------------|-------------|----------|-----------------|
| 0 dB | 0 - 1.1V | High-precision low-voltage sensors | ADC_0db |
| 2.5 dB | 0 - 1.5V | Small signal measurement | ADC_2_5db |
| 6 dB | 0 - 2.2V | Mid-range sensors | ADC_6db |
| 11 dB (default) | 0 - 3.3V | General purpose (full range) | ADC_11db |

```cpp
// Set attenuation per pin
analogSetPinAttenuation(GPIO_PIN, ADC_11db);  // Full 0-3.3V range
analogSetPinAttenuation(GPIO_PIN, ADC_0db);   // High precision 0-1.1V
```

**Note:** Even at 11dB attenuation, the ADC is nonlinear above ~2.5V. For precision, use `esp_adc_cal_characterize()` or an external ADS1115.

## Arduino IDE Setup

- Board Manager URL: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
- Board: "NodeMCU-32S" or "ESP32 Dev Module"
- Upload speed: 921600
- Flash frequency: 80MHz
- Partition scheme: choose based on OTA needs

## Warnings

- **3.3V logic is non-negotiable** — 5V on any pin kills the chip instantly
- **ADC2 disabled during WiFi** — plan your analog pins on GPIO32-39 (ADC1) from the start
- **GPIO12 LOW at boot** — don't connect anything that pulls this HIGH during power-on
- **GPIO6-11 off limits** — internal SPI flash, touching these bricks your sketch
- **Input-only pins (34-39)** — no output capability, no internal pull resistors
- **WiFi draws 240mA peaks** — USB power supplies under 500mA may brown out during transmission
- **Micro-USB connector** — less robust than USB-B, be gentle

---

Related Parts:
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] -- predecessor, fewer pins, WiFi only (no BT)
- [[sparkfun-blynk-board-esp8266-wifi-iot-preconfigured]] -- ESP8266-based IoT board, simpler but more limited
- [[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]] -- 3.3V MCU, no WiFi but more predictable analog
- [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]] -- I2C display, works directly at 3.3V
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] -- 5V board, needs level shifter
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] -- 5V board, needs level shifter
- [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] -- BLDC controller, needs level shifter for 5V control signals

Categories:
- [[microcontrollers]]
- [[communication]]
