---
description: "Budget Mega 2560 clone by Elegoo — same ATmega2560 and pinout as the official Arduino Mega, but uses CH340 USB-serial chip instead of ATmega16U2. Half the price, same functionality"
topics: ["[[microcontrollers]]"]
status: verified
quantity: 1
voltage: [5]
interfaces: [GPIO, I2C, SPI, UART, USB, Analog, PWM]
logic_level: "5V"
logic_notes: "Same 5V GPIO behavior as an Arduino Mega 2560. Inputs usually read 3.3V HIGH, but this board still drives 5V out and must not be wired directly into 3.3V-only GPIO."
manufacturer: "Elegoo"
mcu: "ATmega2560"
clock_mhz: 16
flash_kb: 256
sram_kb: 8
eeprom_kb: 4
part_number: "MEGA 2560 R3"
dimensions_mm: "101.52 x 53.3"
weight_g: 37
pinout: |
  Digital: D0-D53 (15 PWM on D2-D13, D44-D46)
  Analog:  A0-A15 (16 channels, 10-bit ADC)
  Power:   Vin, GND, 5V, 3.3V, RESET, IOREF
  Serial:  TX0/RX0(D0/D1), TX1/RX1(D18/D19), TX2/RX2(D16/D17), TX3/RX3(D14/D15)
  I2C:     SDA(D20), SCL(D21)
  SPI:     MOSI(D51), MISO(D50), SCK(D52), SS(D53)
  PWM:     D2-D13, D44-D46
  Interrupts: D2(INT0), D3(INT1), D18(INT5), D19(INT4), D20(INT3), D21(INT2)
  ICSP:    6-pin header
pwm_pins: [2,3,4,5,6,7,8,9,10,11,12,13,44,45,46]
interrupt_pins: [2,3,18,19,20,21]
max_current_per_pin: "20mA"
total_current_limit: "200mA from all I/O"
alternative_to: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]"]
compatible_with: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[dccduino-nano-is-an-arduino-nano-clone-with-ch340-usb]]", "[[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]]", "[[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]]", "[[l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes]]", "[[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]]", "[[max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins]]", "[[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]]", "[[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]]", "[[hc-sr04-ultrasonic-sensor-measures-2cm-to-400cm-at-5v]]", "[[hc-sr501-pir-motion-sensor-detects-up-to-7m-at-5v]]", "[[dht11-temperature-humidity-sensor-single-wire-0-50c]]", "[[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]]", "[[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]]", "[[ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery]]", "[[sainsmart-mega-sensor-shield-v2-3-pin-breakout]]", "[[2p8-inch-tft-lcd-touch-shield-ili9341-320x240-spi]]", "[[4-digit-7-segment-display-hs420561k-common-cathode]]", "[[5161as-single-digit-7-segment-led-display-red-common-cathode]]", "[[1088as-8x8-red-led-dot-matrix-common-cathode-3mm]]", "[[analog-joystick-module-xy-axes-plus-pushbutton]]", "[[membrane-switch-keypad-module-tactile-button-array]]", "[[ky-040-rotary-encoder-module-incremental-with-pushbutton]]", "[[toneluck-6-way-self-locking-push-button-switch-18-pin]]", "[[elegoo-breadboard-power-module-mb-v2-3v3-5v-selectable]]", "[[hw-221-8-channel-bidirectional-level-shifter-bss138-based]]"]
used_in: []
warnings: ["CH340 USB-serial chip — may need CH340 driver install on some OS versions", "SPI pins are on D50-D53, NOT D10-D13 — same as official Mega", "20mA per pin, 200mA total from all I/O combined", "Some shields may have physical fit issues with minor board layout differences"]
datasheet_url: "https://us.elegoo.com/products/elegoo-mega-2560-r3-board"
---

# Elegoo Mega 2560 R3 is an Arduino Mega clone with CH340 USB

The Elegoo Mega 2560 R3 is a budget clone of the [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]. Same ATmega2560 MCU, same pinout, same 54 digital I/O with 15 PWM, same 16 analog inputs, same 4 hardware UARTs. The only meaningful difference is the USB-serial chip: Elegoo uses the CH340 instead of Arduino's ATmega16U2. This saves cost but means you might need to install a CH340 driver if your OS doesn't ship one natively.

Functionally identical for all projects. Shields, code, libraries — everything that works on the official Mega works on this board. Pick this when you want Mega capabilities without paying the Arduino tax.

## Specifications

| Spec | Value |
|------|-------|
| MCU | ATmega2560 (8-bit AVR RISC) |
| Clock | 16MHz |
| Flash | 256KB (8KB bootloader) |
| SRAM | 8KB |
| EEPROM | 4KB |
| Operating Voltage | 5V |
| Input Voltage | 7-12V (Vin / barrel jack) |
| Digital I/O | 54 pins (15 PWM) |
| Analog Inputs | 16 pins (A0-A15, 10-bit ADC) |
| I/O Current | 20mA per pin |
| Total I/O Current | 200mA combined from all pins |
| Hardware UARTs | 4 (Serial, Serial1, Serial2, Serial3) |
| External Interrupts | 6 (INT0-INT5) |
| USB | USB-B (CH340 USB-serial) |
| Dimensions | 101.52 x 53.3mm |

## Differences from Official Arduino Mega

| Feature | Official Arduino Mega | Elegoo Mega 2560 R3 |
|---------|----------------------|---------------------|
| USB-Serial Chip | ATmega16U2 | CH340 |
| Driver Support | Native on all OS | May need CH340 driver |
| Price | ~$40+ | ~$15-20 |
| PCB Color | Blue | Blue |
| MCU | ATmega2560 (identical) | ATmega2560 (identical) |
| Pinout | Standard | Standard (identical) |

## CH340 Driver Notes

The CH340 USB-serial chip works natively on:
- **Linux**: kernel 2.6+ (built-in `ch341` module)
- **macOS**: Big Sur and later (may need manual install on older versions)
- **Windows 10/11**: usually auto-installs via Windows Update

If your OS doesn't recognize the board, download the CH340 driver from the manufacturer (WCH) or from Elegoo's product page.

In the Arduino IDE, select **Board: "Arduino Mega or Mega 2560"** — the IDE doesn't care about the USB-serial chip, only the MCU.

## Wiring Notes

All wiring is identical to the official [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]. See that record for detailed pinout diagram, UART allocation, SPI pin differences from Uno, and I2C bus notes.

- **SPI on D50-D53** — NOT D10-D13. Same gotcha as the official Mega.
- **4 UARTs** — Serial(D0/D1), Serial1(D18/D19), Serial2(D16/D17), Serial3(D14/D15)
- **I2C on D20(SDA)/D21(SCL)** — shared with INT3/INT2 interrupt pins
- **Shield compatibility** — physically identical header layout to official Mega

## Warnings

- **CH340 driver** — install before first use if your board isn't recognized
- **SPI pins moved** from Uno position — D50-D53, not D10-D13
- **20mA per pin, 200mA total** — same limits as all AVR Arduinos
- **Not official Arduino** — some rare shields or libraries that check board identity via USB VID/PID might not recognize it (extremely uncommon)

---

Related Parts:
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] -- official version, identical functionality and compatible_with list
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] -- smaller sibling, same ecosystem
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] -- compact form factor, same ecosystem
- [[dccduino-nano-is-an-arduino-nano-clone-with-ch340-usb]] -- Nano clone, same CH340 chip
- [[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]] -- Uno clone, same ecosystem
- [[hc-sr04-ultrasonic-sensor-measures-2cm-to-400cm-at-5v]] -- 5V ultrasonic distance sensor
- [[hc-sr501-pir-motion-sensor-detects-up-to-7m-at-5v]] -- 5V PIR motion sensor
- [[dht11-temperature-humidity-sensor-single-wire-0-50c]] -- temp/humidity, 5V compatible
- [[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]] -- 6-axis IMU via I2C on D20/D21
- [[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]] -- 9-axis IMU via I2C on D20/D21
- [[ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery]] -- RTC via I2C on D20/D21
- [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]] -- motor driver
- [[l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes]] -- lighter-duty H-bridge IC
- [[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]] -- motor shield
- [[sainsmart-mega-sensor-shield-v2-3-pin-breakout]] -- Mega sensor shield
- [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]] -- OLED via I2C on D20/D21
- [[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]] -- 16x2 LCD, native 5V
- [[max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins]] -- SPI LED driver on D50-D53
- [[2p8-inch-tft-lcd-touch-shield-ili9341-320x240-spi]] -- TFT touch shield
- [[analog-joystick-module-xy-axes-plus-pushbutton]] -- analog joystick
- [[membrane-switch-keypad-module-tactile-button-array]] -- keypad matrix
- [[ky-040-rotary-encoder-module-incremental-with-pushbutton]] -- rotary encoder
- [[hw-221-8-channel-bidirectional-level-shifter-bss138-based]] -- level shifter for 3.3V devices
- [[elegoo-breadboard-power-module-mb-v2-3v3-5v-selectable]] -- breadboard power module
- [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] -- BLDC controller, 5V control logic

Categories:
- [[microcontrollers]]
