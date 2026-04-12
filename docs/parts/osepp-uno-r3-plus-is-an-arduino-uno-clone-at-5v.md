---
description: "OSEPP's Uno R3 Plus clone — ATmega328P with standard Uno pinout and shield compatibility. Functionally identical to the Arduino Uno R3, drop-in replacement for any Uno project"
topics: ["[[microcontrollers]]"]
status: needs-test
quantity: 1
voltage: [5]
interfaces: [GPIO, I2C, SPI, UART, USB, Analog, PWM]
logic_level: "5V"
manufacturer: "OSEPP"
mcu: "ATmega328P"
clock_mhz: 16
flash_kb: 32
sram_kb: 2
eeprom_kb: 1
part_number: "OSEPP-UNO-03"
pinout: |
  Digital: D0(RX), D1(TX), D2, D3(PWM), D4, D5(PWM), D6(PWM),
           D7, D8, D9(PWM), D10(PWM/SS), D11(PWM/MOSI), D12(MISO), D13(SCK/LED)
  Analog:  A0, A1, A2, A3, A4(SDA), A5(SCL) — 6 channels, 10-bit ADC
  Power:   Vin, GND, GND, 5V, 3.3V, RESET, IOREF
  I2C:     A4(SDA), A5(SCL)
  SPI:     D11(MOSI), D12(MISO), D13(SCK), D10(SS)
  UART:    D0(RX), D1(TX)
  PWM:     D3, D5, D6, D9, D10, D11
  Interrupts: D2(INT0), D3(INT1)
pwm_pins: [3, 5, 6, 9, 10, 11]
interrupt_pins: [2, 3]
max_current_per_pin: "20mA"
total_current_limit: "200mA from all I/O"
alternative_to: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]"]
compatible_with: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[dccduino-nano-is-an-arduino-nano-clone-with-ch340-usb]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]]", "[[l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes]]", "[[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]]", "[[max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins]]", "[[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]]", "[[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]]", "[[hc-sr04-ultrasonic-sensor-measures-2cm-to-400cm-at-5v]]", "[[hc-sr501-pir-motion-sensor-detects-up-to-7m-at-5v]]", "[[dht11-temperature-humidity-sensor-single-wire-0-50c]]", "[[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]]", "[[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]]", "[[ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery]]", "[[osepp-sensor-shield-3-pin-breakout-for-arduino-uno]]", "[[osepp-motor-servo-shield-v1-drives-2-dc-motors-plus-servos]]", "[[dk-electronics-hw-130-motor-shield-uses-l293d-at-600ma]]", "[[velleman-pka042-ethernet-shield-w5100-for-arduino]]", "[[arduino-mega-proto-shield-v3-solder-pad-board]]", "[[2p8-inch-tft-lcd-touch-shield-ili9341-320x240-spi]]", "[[4-digit-7-segment-display-hs420561k-common-cathode]]", "[[5161as-single-digit-7-segment-led-display-red-common-cathode]]", "[[1088as-8x8-red-led-dot-matrix-common-cathode-3mm]]", "[[analog-joystick-module-xy-axes-plus-pushbutton]]", "[[membrane-switch-keypad-module-tactile-button-array]]", "[[ky-040-rotary-encoder-module-incremental-with-pushbutton]]", "[[toneluck-6-way-self-locking-push-button-switch-18-pin]]", "[[elegoo-breadboard-power-module-mb-v2-3v3-5v-selectable]]", "[[hw-221-8-channel-bidirectional-level-shifter-bss138-based]]"]
used_in: []
warnings: ["Check which USB-serial chip is onboard — may need CH340/FTDI driver", "20mA per pin, 200mA total — same limits as all ATmega328P boards"]
datasheet_url: ""
---

# OSEPP Uno R3 Plus is an Arduino Uno clone at 5V

The OSEPP Uno R3 Plus (OSEPP-UNO-03 Rev3.0) is a third-party clone of the [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]. Same ATmega328P MCU, same pinout, same shield header layout. OSEPP is a known maker education brand — their boards are generally reliable and Arduino IDE compatible out of the box.

Use this exactly like an Uno. Same code, same shields, same wiring. In the Arduino IDE, select "Arduino Uno" as the board — the IDE programs the ATmega328P the same way regardless of who manufactured the PCB.

## Specifications

| Spec | Value |
|------|-------|
| MCU | ATmega328P (8-bit AVR RISC) |
| Clock | 16MHz |
| Flash | 32KB (0.5KB bootloader) |
| SRAM | 2KB |
| EEPROM | 1KB |
| Operating Voltage | 5V |
| Input Voltage | 7-12V (barrel jack or Vin) |
| Digital I/O | 14 pins (6 PWM) |
| Analog Inputs | 6 pins (A0-A5, 10-bit ADC) |
| I/O Current | 20mA per pin |
| Total I/O Current | 200mA combined |
| Hardware UARTs | 1 (shared with USB) |
| External Interrupts | 2 (INT0 on D2, INT1 on D3) |
| USB | USB-B |

## Wiring Notes

Identical to the official [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]. All pin assignments, power specs, and shield compatibility are the same.

- **I2C** on A4(SDA) and A5(SCL)
- **SPI** on D10(SS), D11(MOSI), D12(MISO), D13(SCK)
- **UART** on D0(RX) and D1(TX), shared with USB
- **Power** via barrel jack (7-12V) or USB (5V)
- **3.3V output** from onboard regulator, ~50mA max

OSEPP also makes shields designed for the Uno form factor — the [[shields]] category has any OSEPP shields in inventory.

## Warnings

- **Clone board** — verify the USB-serial chip and install drivers if needed
- **Same limitations as any Uno** — 1 UART (shared with USB), 2 interrupts, 14 digital I/O
- **20mA per pin** — don't source/sink more than this from any single I/O pin

---

Related Parts:
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] -- official version, identical functionality and compatible_with list
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] -- same MCU in breadboard form factor
- [[dccduino-nano-is-an-arduino-nano-clone-with-ch340-usb]] -- another ATmega328P clone, Nano form factor
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] -- upgrade path when you need more I/O
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] -- Mega clone, same ecosystem
- [[hc-sr04-ultrasonic-sensor-measures-2cm-to-400cm-at-5v]] -- 5V ultrasonic distance sensor
- [[hc-sr501-pir-motion-sensor-detects-up-to-7m-at-5v]] -- 5V PIR motion sensor
- [[dht11-temperature-humidity-sensor-single-wire-0-50c]] -- temp/humidity, 5V compatible
- [[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]] -- 6-axis IMU via I2C on A4/A5
- [[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]] -- 9-axis IMU via I2C on A4/A5
- [[ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery]] -- RTC via I2C on A4/A5
- [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]] -- motor driver
- [[l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes]] -- lighter-duty H-bridge IC
- [[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]] -- motor shield, plugs into Uno headers
- [[osepp-sensor-shield-3-pin-breakout-for-arduino-uno]] -- sensor breakout shield
- [[osepp-motor-servo-shield-v1-drives-2-dc-motors-plus-servos]] -- motor/servo shield
- [[dk-electronics-hw-130-motor-shield-uses-l293d-at-600ma]] -- L293D motor shield
- [[velleman-pka042-ethernet-shield-w5100-for-arduino]] -- Ethernet shield
- [[2p8-inch-tft-lcd-touch-shield-ili9341-320x240-spi]] -- TFT touch shield
- [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]] -- OLED via I2C on A4/A5
- [[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]] -- 16x2 LCD, native 5V
- [[max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins]] -- SPI LED driver
- [[analog-joystick-module-xy-axes-plus-pushbutton]] -- analog joystick
- [[membrane-switch-keypad-module-tactile-button-array]] -- keypad matrix
- [[ky-040-rotary-encoder-module-incremental-with-pushbutton]] -- rotary encoder
- [[hw-221-8-channel-bidirectional-level-shifter-bss138-based]] -- level shifter for 3.3V devices
- [[elegoo-breadboard-power-module-mb-v2-3v3-5v-selectable]] -- breadboard power module

Categories:
- [[microcontrollers]]
