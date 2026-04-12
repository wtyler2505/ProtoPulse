---
description: "The quintessential Arduino — beginner-friendly, massive ecosystem, rock-solid 5V platform. Same ATmega328P as the Nano but with a full-size USB-B connector that won't break off in your hand"
topics: ["[[microcontrollers]]"]
status: verified
quantity: 3
voltage: [5]
interfaces: [GPIO, I2C, SPI, UART, USB, Analog, PWM]
logic_level: "5V"
logic_notes: "5V GPIO. Most 3.3V outputs read as HIGH on the Uno, but Uno outputs drive 5V and are not safe to wire directly into 3.3V-only pins."
manufacturer: "Arduino"
mcu: "ATmega328P"
clock_mhz: 16
flash_kb: 32
sram_kb: 2
eeprom_kb: 1
part_number: "A000066"
dimensions_mm: "68.6 x 53.4"
weight_g: 25
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
  ICSP:    6-pin header
pwm_pins: [3, 5, 6, 9, 10, 11]
interrupt_pins: [2, 3]
max_current_per_pin: "20mA"
total_current_limit: "200mA from all I/O"
compatible_with: ["[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[dccduino-nano-is-an-arduino-nano-clone-with-ch340-usb]]", "[[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]]", "[[l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes]]", "[[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]]", "[[max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins]]", "[[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]]", "[[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]]", "[[hc-sr04-ultrasonic-sensor-measures-2cm-to-400cm-at-5v]]", "[[hc-sr501-pir-motion-sensor-detects-up-to-7m-at-5v]]", "[[dht11-temperature-humidity-sensor-single-wire-0-50c]]", "[[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]]", "[[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]]", "[[ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery]]", "[[osepp-sensor-shield-3-pin-breakout-for-arduino-uno]]", "[[osepp-motor-servo-shield-v1-drives-2-dc-motors-plus-servos]]", "[[dk-electronics-hw-130-motor-shield-uses-l293d-at-600ma]]", "[[velleman-pka042-ethernet-shield-w5100-for-arduino]]", "[[arduino-mega-proto-shield-v3-solder-pad-board]]", "[[2p8-inch-tft-lcd-touch-shield-ili9341-320x240-spi]]", "[[4-digit-7-segment-display-hs420561k-common-cathode]]", "[[5161as-single-digit-7-segment-led-display-red-common-cathode]]", "[[1088as-8x8-red-led-dot-matrix-common-cathode-3mm]]", "[[analog-joystick-module-xy-axes-plus-pushbutton]]", "[[membrane-switch-keypad-module-tactile-button-array]]", "[[ky-040-rotary-encoder-module-incremental-with-pushbutton]]", "[[toneluck-6-way-self-locking-push-button-switch-18-pin]]", "[[elegoo-breadboard-power-module-mb-v2-3v3-5v-selectable]]", "[[hw-221-8-channel-bidirectional-level-shifter-bss138-based]]"]
alternative_to: ["[[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]]"]
used_in: []
warnings: ["Only 1 hardware UART, shared with USB — can't Serial Monitor and talk to a peripheral simultaneously", "20mA per pin, 200mA total from all I/O combined", "SPI shares pins with D10-D13 — can't use those as general I/O while SPI is active", "USB-B connector — need the big square cable"]
datasheet_url: "https://docs.arduino.cc/resources/datasheets/A000066-datasheet.pdf"
---

# Arduino Uno R3 is a 14-I/O 5V board with ATmega328P and USB-B

The board that launched a million hobbyist projects. The Uno R3 is the reference Arduino — when a tutorial says "connect to pin 13," they mean this board. 14 digital I/O (6 PWM), 6 analog inputs, one hardware UART, I2C on A4/A5, SPI on D10-D13, and a USB-B connector that survives being yanked out of a USB port a thousand times.

Same ATmega328P as the [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] — code is directly portable between them. The Uno's advantages over the Nano are physical robustness (USB-B vs fragile mini-USB), shield compatibility (standard Arduino header spacing), and a barrel jack for external power. The Nano wins on size and breadboard-friendliness.

When you outgrow the Uno's 14 digital pins or need more than one UART, step up to the [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]].

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
| Total I/O Current | 200mA combined from all pins |
| Hardware UARTs | 1 (shared with USB) |
| External Interrupts | 2 (INT0 on D2, INT1 on D3) |
| USB | USB-B (ATmega16U2 as USB-serial) |
| Dimensions | 68.6 x 53.4mm |
| Weight | 25g |

## Pinout

```
        +-----[USB-B]----[PWR]---+
   D13  |● (SCK/LED)             | D12 (MISO)
   3.3V |                        | D11 (PWM/MOSI)
   AREF |                        | D10 (PWM/SS)
    A0  |                        | D9  (PWM)
    A1  |                        | D8
    A2  |                        | D7
    A3  |                        | D6  (PWM)
    A4  | (SDA)                  | D5  (PWM)
    A5  | (SCL)                  | D4
        |                        | D3  (PWM/INT1)
   RST  |                        | D2  (INT0)
   GND  |                        | GND
   Vin  |                        | D1  (TX)
   5V   |                        | D0  (RX)
        +------------------------+

  POWER HEADER: RESET  3.3V  5V  GND  GND  Vin
  ICSP HEADER:  MISO  SCK  RESET  |  VCC  MOSI  GND
```

## I2C Bus

| Function | Pin |
|----------|-----|
| SDA | A4 |
| SCL | A5 |

Uses the `Wire.h` library. I2C pins share with analog inputs A4 and A5 — if you're using I2C, you lose two analog channels. The board has internal pull-ups enabled by Wire (~20-50k ohm). For long bus runs or 3+ devices, add external 4.7k pull-ups to 5V.

## SPI Bus

| Function | Pin |
|----------|-----|
| MOSI | D11 |
| MISO | D12 |
| SCK | D13 |
| SS | D10 |

Same pins as on the Nano. **These are NOT the same pins as on the Mega** — if you're porting code from Mega to Uno, the SPI pins are D50-D53 on the Mega vs D10-D13 on the Uno. The `SPI.h` library handles this automatically; hardcoded pin numbers won't.

## Wiring Notes

- **Power via barrel jack or Vin**: 7-12V recommended. The onboard regulator drops to 5V. Above 12V the regulator overheats. Below 7V the 5V rail sags.
- **3.3V output**: from onboard regulator, 50mA max. Enough for an I2C sensor, not enough for an ESP module.
- **USB power**: 5V from USB, limited by your computer's USB port (typically 500mA). A diode protects against backfeeding USB when barrel jack is connected.
- **IOREF pin**: outputs the board's logic voltage (5V). Used by shields to auto-detect logic level.
- **Shield compatibility**: the Uno defines the standard Arduino shield header layout. Most shields are designed for this board first. The [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] extends these headers but the Uno-position pins are in the same place.
- **Interfacing with 3.3V boards**: the [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] and [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] are 3.3V logic — use a level shifter or voltage divider when connecting to this 5V board.

## Warnings

- **Single UART shared with USB** — you cannot debug over Serial Monitor while a peripheral is connected to D0/D1. Use SoftwareSerial for a second serial device (but it's limited to ~57600 baud).
- **20mA per pin, 200mA total** — don't drive LEDs or motors directly from I/O pins.
- **SPI takes D10-D13** — even if you're not using SPI, D10 must stay as OUTPUT for hardware SPI to work if any SPI device is on the bus.
- **I2C takes A4/A5** — lose 2 of your 6 analog inputs when using I2C.
- **Only 2 external interrupts** — D2 (INT0) and D3 (INT1). If you need more, consider the Mega with 6.

---

Related Parts:
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] -- same MCU, breadboard form factor, mini-USB
- [[dccduino-nano-is-an-arduino-nano-clone-with-ch340-usb]] -- Nano clone with CH340, same MCU
- [[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]] -- Uno clone, same pinout and shields
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] -- bigger sibling, 54 I/O, 4 UARTs
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] -- Mega clone, same ecosystem
- [[hc-sr04-ultrasonic-sensor-measures-2cm-to-400cm-at-5v]] -- 5V ultrasonic distance sensor, direct connect
- [[hc-sr501-pir-motion-sensor-detects-up-to-7m-at-5v]] -- 5V PIR motion sensor, digital output
- [[dht11-temperature-humidity-sensor-single-wire-0-50c]] -- single-wire temp/humidity, 5V compatible
- [[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]] -- 6-axis IMU via I2C on A4/A5, has 5V-tolerant breakout
- [[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]] -- 9-axis IMU via I2C on A4/A5
- [[ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery]] -- I2C real-time clock on A4/A5
- [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]] -- motor driver, digital + PWM control
- [[l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes]] -- lighter-duty H-bridge IC
- [[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]] -- motor shield, plugs directly into Uno headers
- [[osepp-sensor-shield-3-pin-breakout-for-arduino-uno]] -- sensor breakout shield for Uno
- [[osepp-motor-servo-shield-v1-drives-2-dc-motors-plus-servos]] -- motor/servo shield for Uno
- [[dk-electronics-hw-130-motor-shield-uses-l293d-at-600ma]] -- L293D motor shield for Uno
- [[velleman-pka042-ethernet-shield-w5100-for-arduino]] -- W5100 Ethernet shield, stacks on Uno
- [[arduino-mega-proto-shield-v3-solder-pad-board]] -- prototyping shield
- [[2p8-inch-tft-lcd-touch-shield-ili9341-320x240-spi]] -- TFT touch shield, plugs into Uno headers
- [[max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins]] -- SPI LED driver on D10-D13
- [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]] -- OLED via I2C on A4/A5
- [[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]] -- 16x2 LCD, native 5V
- [[4-digit-7-segment-display-hs420561k-common-cathode]] -- 7-segment display, digital pins
- [[5161as-single-digit-7-segment-led-display-red-common-cathode]] -- single-digit 7-segment
- [[1088as-8x8-red-led-dot-matrix-common-cathode-3mm]] -- LED matrix, drives via MAX7219
- [[analog-joystick-module-xy-axes-plus-pushbutton]] -- analog joystick on A0/A1 + digital button
- [[membrane-switch-keypad-module-tactile-button-array]] -- keypad matrix, digital pins
- [[ky-040-rotary-encoder-module-incremental-with-pushbutton]] -- rotary encoder on interrupt pins
- [[toneluck-6-way-self-locking-push-button-switch-18-pin]] -- pushbutton switch
- [[elegoo-breadboard-power-module-mb-v2-3v3-5v-selectable]] -- breadboard power module
- [[hw-221-8-channel-bidirectional-level-shifter-bss138-based]] -- level shifter for connecting 3.3V devices
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] -- WiFi board, needs level shifter

Categories:
- [[microcontrollers]]
