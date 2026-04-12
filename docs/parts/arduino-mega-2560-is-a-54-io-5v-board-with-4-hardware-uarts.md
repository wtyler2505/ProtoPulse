---
description: "The big Arduino — 54 digital I/O (15 PWM), 16 analog inputs, 4 hardware UARTs, 256KB flash. Use when you need lots of pins or multiple serial devices"
topics: ["[[microcontrollers]]"]
status: verified
quantity: 1
voltage: [5]
interfaces: [GPIO, I2C, SPI, UART, USB, Analog, PWM]
logic_level: "5V"
logic_notes: "5V GPIO. Many 3.3V outputs are readable as HIGH, but Mega outputs drive 5V and need protection or level shifting when talking to 3.3V-only devices."
manufacturer: "Arduino"
mcu: "ATmega2560"
clock_mhz: 16
flash_kb: 256
sram_kb: 8
eeprom_kb: 4
part_number: "A000067"
dimensions_mm: "101.52 x 53.3 x 15"
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
compatible_with: ["[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[dccduino-nano-is-an-arduino-nano-clone-with-ch340-usb]]", "[[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]]", "[[l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes]]", "[[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]]", "[[max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins]]", "[[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]]", "[[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]]", "[[hc-sr04-ultrasonic-sensor-measures-2cm-to-400cm-at-5v]]", "[[hc-sr501-pir-motion-sensor-detects-up-to-7m-at-5v]]", "[[dht11-temperature-humidity-sensor-single-wire-0-50c]]", "[[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]]", "[[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]]", "[[ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery]]", "[[sainsmart-mega-sensor-shield-v2-3-pin-breakout]]", "[[2p8-inch-tft-lcd-touch-shield-ili9341-320x240-spi]]", "[[4-digit-7-segment-display-hs420561k-common-cathode]]", "[[5161as-single-digit-7-segment-led-display-red-common-cathode]]", "[[1088as-8x8-red-led-dot-matrix-common-cathode-3mm]]", "[[analog-joystick-module-xy-axes-plus-pushbutton]]", "[[membrane-switch-keypad-module-tactile-button-array]]", "[[ky-040-rotary-encoder-module-incremental-with-pushbutton]]", "[[toneluck-6-way-self-locking-push-button-switch-18-pin]]", "[[elegoo-breadboard-power-module-mb-v2-3v3-5v-selectable]]", "[[hw-221-8-channel-bidirectional-level-shifter-bss138-based]]"]
used_in: []
warnings: ["SPI pins are on D50-D53, NOT D10-D13 like on Uno/Nano — code needs updating when porting", "20mA per pin, 200mA total from all I/O combined", "USB-B connector"]
datasheet_url: "https://docs.arduino.cc/resources/datasheets/A000067-datasheet.pdf"
---

# Arduino Mega 2560 is a 54-I/O 5V board with 4 hardware UARTs

The Mega is what you reach for when the Uno runs out of pins or you need multiple serial devices talking simultaneously. Same 5V ATmega ecosystem, same IDE, same libraries (mostly) — just more of everything. 54 digital I/O, 16 analog inputs, 4 hardware UARTs, and 256KB of flash. The trade-off is size: at 101mm long, it won't fit on a mini breadboard.

The killer feature is the 4 hardware UARTs. On an Uno/Nano you get one serial port, and it's shared with the USB connection — so you can't debug over Serial Monitor while talking to a GPS module. The Mega gives you Serial, Serial1, Serial2, and Serial3, all independent. Connect your GPS, your Bluetooth module, your MIDI interface, and still have Serial0 free for debugging.

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
| USB | USB-B |
| Dimensions | 101.52 x 53.3mm |
| Weight | 37g |

## Pinout

```
                              +--------[USB-B]--------+
                          D22 |                        | D23
                          D24 |                        | D25
                          D26 |                        | D27
                          D28 |                        | D29
                          D30 |                        | D31
                          D32 |                        | D33
                          D34 |                        | D35
                          D36 |                        | D37
                          D38 |                        | D39
                          D40 |                        | D41
                          D42 |                        | D43
                          D44 | (PWM)                  | D45 (PWM)
                          D46 | (PWM)                  | D47
                          D48 |                        | D49
                    SPI→ D50  | (MISO)                 | D51 (MOSI) ←SPI
                    SPI→ D52  | (SCK)                  | D53 (SS)   ←SPI
                              |                        |
                          GND |                        | GND
                              +------------------------+
        (bottom edge, left to right)

  POWER:  RESET  3.3V  5V  GND  GND  Vin

  ANALOG: A0  A1  A2  A3  A4  A5  A6  A7  A8  A9  A10  A11  A12  A13  A14  A15

  DIGITAL (PWM ~):
  D0(RX0)  D1(TX0)  D2~  D3~  D4~  D5~  D6~  D7~  D8~  D9~  D10~  D11~  D12~  D13~
  D14(TX3)  D15(RX3)  D16(TX2)  D17(RX2)  D18(TX1/INT5)  D19(RX1/INT4)
  D20(SDA/INT3)  D21(SCL/INT2)
```

## 4 Hardware UARTs

This is the Mega's headline feature. Each UART is fully independent with its own TX/RX buffer.

| UART | Arduino Object | TX Pin | RX Pin | Notes |
|------|---------------|--------|--------|-------|
| UART0 | `Serial` | D1 (TX0) | D0 (RX0) | Shared with USB — used for Serial Monitor and sketch upload |
| UART1 | `Serial1` | D18 (TX1) | D19 (RX1) | Also has INT5/INT4 — can't use interrupts AND serial on these pins |
| UART2 | `Serial2` | D16 (TX2) | D17 (RX2) | Clean — no pin conflicts |
| UART3 | `Serial3` | D14 (TX3) | D15 (RX3) | Clean — no pin conflicts |

**Typical allocation:**
- Serial (UART0) — debugging via Serial Monitor
- Serial1 — GPS module (NMEA output)
- Serial2 — Bluetooth module (HC-05/06)
- Serial3 — spare or MIDI

All UARTs support the standard baud rates (9600, 19200, 38400, 57600, 115200, etc.). Initialize each with `SerialN.begin(baudRate)`.

## SPI Pin Difference from Uno/Nano — READ THIS

The single most common porting bug when moving code from Uno to Mega:

| Function | Uno/Nano Pin | Mega Pin |
|----------|-------------|----------|
| MOSI | D11 | **D51** |
| MISO | D12 | **D50** |
| SCK | D13 | **D52** |
| SS | D10 | **D53** |

If you're using the Arduino `SPI.h` library, it handles this automatically — the library uses the correct hardware SPI pins for whatever board you're compiling for. But if your code has hardcoded pin numbers (e.g., `digitalWrite(11, data)` for bit-banged SPI), you need to change them.

The ICSP header on the Mega also carries SPI — and it's in the same position as on the Uno. So shields that use the ICSP header for SPI (like Ethernet shields) work without modification.

**D10-D13 on the Mega are just regular digital pins** — they have no SPI function. Code that assumes D10 is SS will fail silently.

## I2C Bus

| Function | Pin |
|----------|-----|
| SDA | D20 |
| SCL | D21 |

Same `Wire.h` library as Uno. Note that D20 and D21 are also external interrupt pins (INT3 and INT2) — if you need I2C AND all 6 interrupts, you'll have a conflict on these two.

I2C pull-up resistors: the Mega has internal pull-ups enabled by the Wire library (~20-50k ohm). For long bus runs or multiple devices, add external 4.7k pull-ups to 5V.

## Wiring Notes

- **Power via barrel jack or Vin**: 7-12V recommended. The onboard regulator drops to 5V. Above 12V it gets hot. Below 7V the 5V rail sags.
- **3.3V output**: from onboard regulator, 50mA max. Enough for an I2C sensor, not enough for an ESP module.
- **Vin pin**: passes through a protection diode from barrel jack. Can also be used as power input (7-12V) if you're not using the barrel jack.
- **IOREF pin**: outputs the board's logic voltage (5V). Used by shields to auto-detect logic level.
- **Shield compatibility**: Most Uno shields plug in physically but check the SPI pin issue above. Shields that use the ICSP header for SPI work correctly. Shields that use D10-D13 for SPI will NOT work without rewiring.

## Power and Thermal Specifications

| Parameter | Value |
|-----------|-------|
| Operating Temperature | -40C to +85C (industrial grade ATmega2560) |
| Power Consumption (typical) | 50-75mA (no peripherals attached) |
| Power Consumption (USB connected) | 70-72mA |
| Power Consumption (all I/O active) | ~200mA maximum |
| Voltage Regulator Overhead | 6-10mA quiescent |
| 5V Regulator IC | LD1117S50CTR or NCP1117ST50T3G |
| 5V Regulator Max Output | 800mA (LD1117) / 1500mA (NCP1117) |
| 5V Regulator Dropout | ~1.1V |
| 3.3V Regulator IC | LP2985-33DBVR |
| 3.3V Regulator Max Output | 150mA (limited to 50mA on Arduino header) |
| 3.3V Regulator Dropout | ~300mV at 50mA |
| Thermal Protection | Yes (on both regulators) |

The 5V regulator is the main bottleneck for power. Below 7V input, the 5V rail sags. Above 12V input, the regulator dissipates significant heat as (Vin - 5V) x Iload watts. At 12V input drawing 500mA, that's 3.5W of heat — enough to make the regulator uncomfortably hot. Stay in the 7-9V sweet spot for input voltage.

## Warnings

- **SPI pins moved** — D50-D53, not D10-D13. This breaks hardcoded SPI code from Uno/Nano.
- **20mA per pin, 200mA total** — same as other AVR Arduinos. Don't drive LEDs or motors directly from I/O pins.
- **USB-B connector** — the big square one. Need a USB-B cable, not micro-USB.
- **Size** — 101mm long, won't fit on standard breadboards. Use jumper wires or a screw terminal shield.
- **I2C shares interrupt pins** — D20(SDA) is also INT3, D21(SCL) is also INT2. Can't use both functions simultaneously.

## OmniTrek Pin Allocation

Project-specific pin assignments for the 4WD hoverboard rover build.

### Motor Control (PWM Outputs)

| Motor | Controller | PWM Pin | Enable Pin | Direction Pin |
|-------|------------|---------|------------|---------------|
| Front-Left | RioRand #1 | D2 | D22 | D24 |
| Front-Right | RioRand #2 | D3 | D23 | D25 |
| Rear-Left | RioRand #3 | D4 | D26 | D28 |
| Rear-Right | RioRand #4 | D5 | D27 | D29 |

### I2C Sensor Bus (D20/D21)

| Device | Address | Purpose |
|--------|---------|---------|
| BNO055 IMU | 0x28 | Primary 9-axis orientation |
| MPU6050 | 0x68 | Backup 6-axis IMU |

### UART Allocation

| Port | Device | Baud |
|------|--------|------|
| Serial (D0/D1) | USB debugging | 115200 |
| Serial1 (D18/D19) | ESP32 DevKit v1 | 115200 |
| Serial2 (D16/D17) | Reserved (GPS) | — |
| Serial3 (D14/D15) | Reserved | — |

### Digital I/O

| Pin | Function |
|-----|----------|
| D30 | E-Stop input (active LOW, internal pull-up) |
| D31 | Status LED (green) |
| D32 | Fault LED (red) |

### Analog Inputs

| Pin | Function | Divider |
|-----|----------|---------|
| A0 | Battery voltage (36V) | 7.2:1 |
| A1-A4 | Motor current sensors (ACS712-30A) | — |
| A5 | Temperature (LM35) | — |

## Power Budget

| Condition | Current Draw |
|-----------|-------------|
| Typical (no peripherals) | 50-75mA |
| USB connected (idle) | 70-72mA |
| All I/O active (max) | ~200mA |
| Voltage regulator overhead | 6-10mA quiescent |

The 5V regulator (LD1117 or NCP1117) maxes out at 800-1500mA depending on the variant. At 12V input drawing 500mA from 5V, that's 3.5W of heat dissipation on the regulator. Keep input voltage in the 7-9V sweet spot.

---

Related Parts:
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] -- smaller sibling, same ecosystem
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] -- same ecosystem, smaller form factor, fewer I/O
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] -- Mega clone, identical functionality
- [[dccduino-nano-is-an-arduino-nano-clone-with-ch340-usb]] -- Nano clone, same ecosystem
- [[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]] -- Uno clone, same ecosystem
- [[hc-sr04-ultrasonic-sensor-measures-2cm-to-400cm-at-5v]] -- 5V ultrasonic distance sensor
- [[hc-sr501-pir-motion-sensor-detects-up-to-7m-at-5v]] -- 5V PIR motion sensor
- [[dht11-temperature-humidity-sensor-single-wire-0-50c]] -- temp/humidity, 5V compatible
- [[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]] -- 6-axis IMU via I2C on D20/D21
- [[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]] -- 9-axis IMU via I2C on D20/D21
- [[ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery]] -- RTC via I2C on D20/D21
- [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]] -- motor driver, connects via digital pins + PWM
- [[l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes]] -- lighter-duty H-bridge IC
- [[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]] -- motor shield
- [[sainsmart-mega-sensor-shield-v2-3-pin-breakout]] -- Mega sensor shield
- [[max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins]] -- SPI LED driver, uses D50-D53 on Mega (not D10-D13!)
- [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]] -- I2C display on D20(SDA)/D21(SCL)
- [[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]] -- I2C or parallel LCD, both work
- [[2p8-inch-tft-lcd-touch-shield-ili9341-320x240-spi]] -- TFT touch shield
- [[4-digit-7-segment-display-hs420561k-common-cathode]] -- 7-segment display
- [[5161as-single-digit-7-segment-led-display-red-common-cathode]] -- single-digit 7-segment
- [[1088as-8x8-red-led-dot-matrix-common-cathode-3mm]] -- LED matrix, drives via MAX7219
- [[analog-joystick-module-xy-axes-plus-pushbutton]] -- analog joystick
- [[membrane-switch-keypad-module-tactile-button-array]] -- keypad matrix
- [[ky-040-rotary-encoder-module-incremental-with-pushbutton]] -- rotary encoder
- [[toneluck-6-way-self-locking-push-button-switch-18-pin]] -- pushbutton switch
- [[elegoo-breadboard-power-module-mb-v2-3v3-5v-selectable]] -- breadboard power module
- [[hw-221-8-channel-bidirectional-level-shifter-bss138-based]] -- level shifter for 3.3V devices
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] -- 3.3V board, needs level shifter to interface
- [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] -- BLDC motor controller, 5V control logic compatible

Categories:
- [[microcontrollers]]
