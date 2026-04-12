---
description: "Budget Arduino Nano clone — same ATmega328P and pinout as the official Nano, CH340 USB-serial chip instead of FTDI. Identical functionality for a fraction of the price"
topics: ["[[microcontrollers]]"]
status: verified
quantity: 1
voltage: [5]
interfaces: [GPIO, I2C, SPI, UART, USB, Analog, PWM]
logic_level: "5V"
logic_notes: "Same 5V GPIO behavior as an Arduino Nano. 3.3V signals often read as HIGH, but DCCduino outputs still drive 5V and need protection when connected to 3.3V-only inputs."
manufacturer: "DCCduino"
mcu: "ATmega328P"
clock_mhz: 16
flash_kb: 32
sram_kb: 2
eeprom_kb: 1
part_number: "DCCduino Nano"
dimensions_mm: "45 x 18"
weight_g: 7
pinout: |
  Digital: D0(RX), D1(TX), D2, D3(PWM), D4, D5(PWM), D6(PWM),
           D7, D8, D9(PWM), D10(PWM/SS), D11(PWM/MOSI), D12(MISO), D13(SCK/LED)
  Analog:  A0, A1, A2, A3, A4(SDA), A5(SCL), A6, A7 (A6-A7 analog input only)
  Power:   Vin, GND, GND, 5V, 3.3V, RESET
  I2C:     A4(SDA), A5(SCL)
  SPI:     D11(MOSI), D12(MISO), D13(SCK), D10(SS)
  UART:    D0(RX), D1(TX)
  PWM:     D3, D5, D6, D9, D10, D11
  Interrupts: D2(INT0), D3(INT1)
pwm_pins: [3, 5, 6, 9, 10, 11]
interrupt_pins: [2, 3]
max_current_per_pin: "20mA"
total_current_limit: "200mA from all I/O"
alternative_to: ["[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]"]
compatible_with: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]]", "[[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]]", "[[l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes]]", "[[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]]", "[[max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins]]", "[[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]]", "[[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]]", "[[hc-sr04-ultrasonic-sensor-measures-2cm-to-400cm-at-5v]]", "[[hc-sr501-pir-motion-sensor-detects-up-to-7m-at-5v]]", "[[dht11-temperature-humidity-sensor-single-wire-0-50c]]", "[[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]]", "[[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]]", "[[ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery]]", "[[4-digit-7-segment-display-hs420561k-common-cathode]]", "[[5161as-single-digit-7-segment-led-display-red-common-cathode]]", "[[1088as-8x8-red-led-dot-matrix-common-cathode-3mm]]", "[[analog-joystick-module-xy-axes-plus-pushbutton]]", "[[membrane-switch-keypad-module-tactile-button-array]]", "[[ky-040-rotary-encoder-module-incremental-with-pushbutton]]", "[[toneluck-6-way-self-locking-push-button-switch-18-pin]]", "[[elegoo-breadboard-power-module-mb-v2-3v3-5v-selectable]]", "[[hw-221-8-channel-bidirectional-level-shifter-bss138-based]]"]
used_in: []
warnings: ["CH340 USB-serial chip — install CH340 driver if board isn't recognized", "A6 and A7 are analog INPUT ONLY — cannot be used as digital pins", "Mini-USB connector — mechanically fragile, avoid repeated plugging/unplugging", "20mA per pin, 200mA total — same limits as official Nano"]
datasheet_url: "https://docs.arduino.cc/hardware/nano"
---

# DCCduino Nano is an Arduino Nano clone with CH340 USB

The DCCduino Nano is a third-party clone of the [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]. Same ATmega328P MCU, same pinout, same breadboard-friendly form factor. The only difference is the USB-serial chip: CH340 instead of FTDI. Costs a fraction of the original.

Code-compatible with both the official Nano and the [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — same ATmega328P means same registers, same peripherals, same Arduino libraries. In the Arduino IDE, select "Arduino Nano" as the board. If upload fails, try changing **Processor** to "ATmega328P (Old Bootloader)" — some clones ship with the older Optiboot variant.

## Specifications

| Spec | Value |
|------|-------|
| MCU | ATmega328P (8-bit AVR RISC) |
| Clock | 16MHz |
| Flash | 32KB (2KB bootloader) |
| SRAM | 2KB |
| EEPROM | 1KB |
| Operating Voltage | 5V |
| Input Voltage | 7-12V (Vin pin) |
| Digital I/O | 14 pins (6 PWM) |
| Analog Inputs | 8 pins (A0-A7, 10-bit ADC) |
| I/O Current | 20mA per pin |
| USB | Mini-USB (CH340 USB-serial) |
| Dimensions | ~45 x 18mm |
| Form Factor | Breadboard-friendly DIP |

## Pinout

```
        +-----[USB]-----+
    D13 |●              | D12
   3.3V |               | D11 (PWM)
   AREF |               | D10 (PWM/SS)
    A0  |               | D9  (PWM)
    A1  |               | D8
    A2  |               | D7
    A3  |               | D6  (PWM)
    A4  | (SDA)         | D5  (PWM)
    A5  | (SCL)         | D4
    A6  | (analog only) | D3  (PWM/INT1)
    A7  | (analog only) | D2  (INT0)
    5V  |               | GND
   RST  |               | RST
   GND  |               | D0  (RX)
   Vin  |               | D1  (TX)
        +---------------+
```

## CH340 Driver Notes

The CH340 works natively on most modern operating systems:
- **Linux** — kernel module `ch341` is built-in since kernel 2.6
- **macOS Big Sur+** — generally works, may need manual driver on older versions
- **Windows 10/11** — usually auto-installs via Windows Update

If the board appears as an unknown device, download the CH340 driver from WCH or from common Arduino clone driver pages.

## Differences from Official Arduino Nano

| Feature | Official Nano | DCCduino Nano |
|---------|--------------|---------------|
| USB-Serial | FTDI FT232RL | CH340 |
| USB Connector | Mini-USB | Mini-USB |
| Bootloader | Optiboot (new) | May be old or new — try both in IDE |
| MCU | ATmega328P | ATmega328P (identical) |
| Pinout | Standard | Standard (identical) |
| Price | ~$20+ | ~$3-5 |

## Wiring Notes

All wiring is identical to the [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]:

- **I2C** on A4(SDA) / A5(SCL) — shares with analog pins
- **SPI** on D10-D13
- **Code is portable** to/from Uno — same MCU, same pin mapping (except A6/A7 which the Uno doesn't have)
- **Power via Vin** accepts 7-12V
- **3.3V output** from onboard regulator, ~50mA max

## Warnings

- **CH340 driver** — install before first use if the board isn't recognized
- **Old bootloader** — if upload fails with "not in sync" error, change IDE setting to "ATmega328P (Old Bootloader)"
- **A6/A7 analog input only** — cannot use as digital pins
- **Mini-USB connector** — the weakest physical point. Use a dedicated cable and don't stress the connector.
- **No voltage regulation feedback** — some clones have marginal voltage regulators that get hot under load

---

Related Parts:
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] -- official version, identical functionality
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] -- same MCU, larger form factor, USB-B
- [[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]] -- another ATmega328P clone, Uno form factor
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] -- upgrade when you need more I/O
- [[hc-sr04-ultrasonic-sensor-measures-2cm-to-400cm-at-5v]] -- 5V ultrasonic distance sensor
- [[hc-sr501-pir-motion-sensor-detects-up-to-7m-at-5v]] -- 5V PIR motion sensor
- [[dht11-temperature-humidity-sensor-single-wire-0-50c]] -- temp/humidity, 5V compatible
- [[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]] -- 6-axis IMU via I2C on A4/A5
- [[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]] -- 9-axis IMU via I2C on A4/A5
- [[ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery]] -- RTC via I2C on A4/A5
- [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]] -- motor driver
- [[l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes]] -- lighter-duty H-bridge IC
- [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]] -- I2C display on A4/A5
- [[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]] -- LCD display, native 5V
- [[max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins]] -- SPI LED driver on D10-D13
- [[analog-joystick-module-xy-axes-plus-pushbutton]] -- analog joystick on A0/A1
- [[membrane-switch-keypad-module-tactile-button-array]] -- keypad matrix
- [[ky-040-rotary-encoder-module-incremental-with-pushbutton]] -- rotary encoder
- [[hw-221-8-channel-bidirectional-level-shifter-bss138-based]] -- level shifter for 3.3V devices
- [[elegoo-breadboard-power-module-mb-v2-3v3-5v-selectable]] -- breadboard power module

Categories:
- [[microcontrollers]]
