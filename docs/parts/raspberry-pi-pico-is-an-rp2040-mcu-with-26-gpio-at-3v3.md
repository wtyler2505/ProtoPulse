---
description: "Raspberry Pi's microcontroller play — dual-core ARM Cortex-M0+ at 133MHz, 264KB SRAM, 2MB flash, PIO state machines for custom peripherals. The $4 board that punches way above its price"
topics: ["[[microcontrollers]]"]
status: verified
quantity: 5
voltage: [3.3]
interfaces: [GPIO, I2C, SPI, UART, USB, Analog, PWM, PIO]
logic_level: "3.3V"
logic_notes: "GPIO are 3.3V-only even though VSYS can accept up to 5.5V power input. Treat every signal pin as non-5V-tolerant."
manufacturer: "Raspberry Pi Foundation"
mcu: "RP2040 (ARM Cortex-M0+ dual-core)"
clock_mhz: 133
flash_kb: 2048
sram_kb: 264
part_number: "RPI-PICO"
dimensions_mm: "51 x 21"
weight_g: 3
pinout: |
  GP0  — UART0 TX, I2C0 SDA, SPI0 RX, PWM0A
  GP1  — UART0 RX, I2C0 SCL, SPI0 CS, PWM0B
  GP2  — I2C1 SDA, SPI0 SCK, PWM1A
  GP3  — I2C1 SCL, SPI0 TX, PWM1B
  GP4  — UART1 TX, I2C0 SDA, SPI0 RX, PWM2A
  GP5  — UART1 RX, I2C0 SCL, SPI0 CS, PWM2B
  GP6  — I2C1 SDA, SPI0 SCK, PWM3A
  GP7  — I2C1 SCL, SPI0 TX, PWM3B
  GP8  — UART1 TX, I2C0 SDA, SPI1 RX, PWM4A
  GP9  — UART1 RX, I2C0 SCL, SPI1 CS, PWM4B
  GP10 — I2C1 SDA, SPI1 SCK, PWM5A
  GP11 — I2C1 SCL, SPI1 TX, PWM5B
  GP12 — UART0 TX, I2C0 SDA, SPI1 RX, PWM6A
  GP13 — UART0 RX, I2C0 SCL, SPI1 CS, PWM6B
  GP14 — I2C1 SDA, SPI1 SCK, PWM7A
  GP15 — I2C1 SCL, SPI1 TX, PWM7B
  GP16 — UART0 TX, I2C0 SDA, SPI0 RX, PWM0A
  GP17 — UART0 RX, I2C0 SCL, SPI0 CS, PWM0B
  GP18 — I2C1 SDA, SPI0 SCK, PWM1A
  GP19 — I2C1 SCL, SPI0 TX, PWM1B
  GP20 — UART1 TX, I2C0 SDA, SPI0 RX, PWM2A
  GP21 — UART1 RX, I2C0 SCL, SPI0 CS, PWM2B
  GP22 — I2C1 SDA, SPI0 SCK, PWM3A
  GP26 — ADC0 (analog input)
  GP27 — ADC1 (analog input)
  GP28 — ADC2 (analog input)
  ADC_VREF  — ADC reference voltage
  3V3_EN    — regulator enable (pull LOW to disable)
  VBUS      — USB 5V (when connected to USB)
  VSYS      — system input voltage (1.8V - 5.5V)
  3V3(OUT)  — regulated 3.3V output
  GND       — ground (multiple pins)
  RUN       — reset (pull LOW to reset, HIGH to run)
pwm_pins: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22]
adc_pins: [26, 27, 28]
max_current_per_pin: "12mA (default), up to 16mA configurable"
total_current_limit: "50mA from all I/O"
compatible_with: ["[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[raspberry-pi-3b-plus-is-a-quad-core-sbc-with-wifi-bt-ethernet]]", "[[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]]", "[[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]]", "[[hmc5883l-qmc5883l-3-axis-compass-magnetometer-i2c]]", "[[neo-6m-gps-module-uart-3v3-for-position-tracking]]", "[[ina219-high-side-current-sensor-26v-i2c-for-power-monitoring]]", "[[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]]", "[[dht11-temperature-humidity-sensor-single-wire-0-50c]]", "[[membrane-switch-keypad-module-tactile-button-array]]", "[[ky-040-rotary-encoder-module-incremental-with-pushbutton]]", "[[toneluck-6-way-self-locking-push-button-switch-18-pin]]"]
level_shifter_needed: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]"]
used_in: ["sensor-hub"]
warnings: ["3.3V logic — NOT 5V tolerant on any pin", "Only 3 ADC inputs (GP26-28) with 12-bit resolution", "No WiFi or Bluetooth — use the Pico W variant if you need wireless", "12mA default per pin is lower than Arduino's 20mA — check LED current", "USB is device-only in most firmware — not a USB host without extra work"]
datasheet_url: "https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf"
---

# Raspberry Pi Pico is an RP2040 MCU with 26 GPIO at 3.3V

The Pico is Raspberry Pi's entry into the microcontroller world. Instead of running Linux like the [[raspberry-pi-3b-plus-is-a-quad-core-sbc-with-wifi-bt-ethernet]], it runs bare-metal or MicroPython/CircuitPython directly on the RP2040 chip. Dual-core ARM Cortex-M0+ at 133MHz, 264KB SRAM, 2MB flash, and 26 GPIO pins — all for $4.

The killer feature is PIO (Programmable I/O) — two programmable state machines that can implement custom protocols at hardware speed. Need WS2812B NeoPixel timing? PIO. DPI video output? PIO. Custom serial protocol? PIO. This is something no Arduino or ESP can do without bitbanging.

Every GPIO pin supports PWM, and the pin multiplexing is extremely flexible — I2C, SPI, and UART can be remapped to almost any pin combination.

## Specifications

| Spec | Value |
|------|-------|
| MCU | RP2040 (ARM Cortex-M0+, dual-core, 32-bit) |
| Clock | 133MHz (overclockable to ~250MHz) |
| Flash | 2MB (external QSPI) |
| SRAM | 264KB (in 6 banks) |
| Operating Voltage | 3.3V |
| Input Voltage | 1.8V - 5.5V via VSYS pin, or 5V via USB |
| GPIO | 26 multi-function (GP0-GP22, GP26-GP28) |
| ADC | 3 external channels (GP26-28, 12-bit, 500ksps) + 1 internal temp sensor |
| PWM | 16 channels (8 slices x 2 outputs), available on all GPIO |
| I2C | 2 controllers (I2C0, I2C1), mappable to multiple pin sets |
| SPI | 2 controllers (SPI0, SPI1), mappable to multiple pin sets |
| UART | 2 (UART0, UART1), mappable to multiple pin sets |
| PIO | 2 PIO blocks, 4 state machines each |
| USB | 1.1 device + host (micro-USB on board) |
| Dimensions | 51 x 21mm |
| Weight | 3g |

## Pinout

```
        +-----[USB]-----+
   GP0  |●  1       40  | VBUS (5V from USB)
   GP1  |   2       39  | VSYS (1.8-5.5V input)
   GND  |   3       38  | GND
   GP2  |   4       37  | 3V3_EN
   GP3  |   5       36  | 3V3(OUT)
   GP4  |   6       35  | ADC_VREF
   GP5  |   7       34  | GP28 (ADC2)
   GND  |   8       33  | GND
   GP6  |   9       32  | GP27 (ADC1)
   GP7  |  10       31  | GP26 (ADC0)
   GP8  |  11       30  | RUN (reset)
   GP9  |  12       29  | GP22
   GND  |  13       28  | GND
  GP10  |  14       27  | GP21
  GP11  |  15       26  | GP20
  GP12  |  16       25  | GP19
  GP13  |  17       24  | GP18
   GND  |  18       23  | GND
  GP14  |  19       22  | GP17
  GP15  |  20       21  | GP16
        +---------------+
```

## PIO — The Pico's Secret Weapon

PIO (Programmable I/O) gives you 8 state machines (4 per PIO block) that run tiny programs independently of the CPU. Each state machine has:
- A 32-instruction program memory (shared per PIO block)
- Input and output shift registers
- Configurable clock divider (down to 1 system clock cycle)
- IRQ flags for synchronization with the CPU

PIO can implement protocols that would require precise timing impossible in software:
- **WS2812B (NeoPixel)** — sub-microsecond timing
- **VGA/DVI video output** — pixel-perfect timing
- **Rotary encoder** — hardware debouncing
- **Custom serial** — any baud rate, any protocol

## Flexible Pin Mapping

Unlike Arduino boards with fixed pin assignments, the RP2040 lets you map peripherals to multiple GPIO options:

| Peripheral | Option A | Option B | Option C | Option D |
|-----------|----------|----------|----------|----------|
| I2C0 SDA | GP0 | GP4 | GP8 | GP12, GP16, GP20 |
| I2C0 SCL | GP1 | GP5 | GP9 | GP13, GP17, GP21 |
| UART0 TX | GP0 | GP12 | GP16 | — |
| UART0 RX | GP1 | GP13 | GP17 | — |
| SPI0 SCK | GP2 | GP6 | GP18 | — |

This flexibility means you rarely have pin conflicts. If one peripheral needs a pin, remap the other one.

## Wiring Notes

- **Power via USB**: 5V from micro-USB, onboard regulator drops to 3.3V. ~300mA available for the board + peripherals.
- **Power via VSYS**: accepts 1.8V-5.5V, good for battery operation. A Schottky diode prevents backfeeding USB.
- **3V3_EN**: pull LOW to disable the 3.3V regulator. Useful for ultra-low-power sleep.
- **RUN pin**: pull LOW to reset the board. Can be connected to a button for manual reset.
- **ADC**: 3 channels on GP26-28, 12-bit resolution (0-4095), 0-3.3V input range. Internal temperature sensor on ADC channel 4.
- **UF2 boot**: hold BOOTSEL button while plugging in USB to enter UF2 bootloader. Board appears as a USB drive — drag and drop firmware.

## Programming Environments

- **MicroPython** — easiest, REPL over USB serial, Thonny IDE
- **CircuitPython** — Adafruit's fork, great library ecosystem
- **C/C++ SDK** — maximum performance, official Raspberry Pi SDK
- **Arduino IDE** — community board package (arduino-pico by Earle Philhower)

## Warnings

- **3.3V logic only** — NOT 5V tolerant. Level shift when connecting to Arduino Uno/Mega/Nano.
- **No WiFi/Bluetooth** — this is the basic Pico. For wireless, get the Pico W ($6).
- **Only 3 analog inputs** — if you need more, use an external MCP3008 or ADS1115 over SPI/I2C.
- **12mA per pin default** — lower than Arduino's 20mA. Configure to 16mA max if needed, but don't exceed it.
- **50mA total GPIO current** — significantly lower than Arduino. Plan your current budget.
- **2MB flash** — CircuitPython's filesystem plus libraries can eat half of this. MicroPython and C are more space-efficient.

---

Related Parts:
- [[raspberry-pi-3b-plus-is-a-quad-core-sbc-with-wifi-bt-ethernet]] -- full Linux SBC, pairs well for real-time + OS
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] -- more GPIO + WiFi, but no PIO
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] -- WiFi MCU, fewer pins
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] -- similar size, 5V, bigger ecosystem but less capable MCU
- [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]] -- I2C display, works directly at 3.3V
- [[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]] -- 9-axis IMU, native 3.3V I2C
- [[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]] -- 6-axis IMU, native 3.3V I2C
- [[hmc5883l-qmc5883l-3-axis-compass-magnetometer-i2c]] -- compass module, 3.3V I2C
- [[neo-6m-gps-module-uart-3v3-for-position-tracking]] -- GPS via UART, native 3.3V
- [[ina219-high-side-current-sensor-26v-i2c-for-power-monitoring]] -- current/power sensor, 3.3V I2C
- [[dht11-temperature-humidity-sensor-single-wire-0-50c]] -- temp/humidity, works at 3.3V
- [[membrane-switch-keypad-module-tactile-button-array]] -- digital keypad input
- [[ky-040-rotary-encoder-module-incremental-with-pushbutton]] -- rotary encoder, digital input
- [[toneluck-6-way-self-locking-push-button-switch-18-pin]] -- pushbutton switch
- [[adafruit-pygamer-samd51-handheld-gaming-board-with-tft]] -- another ARM MCU board with different focus

Categories:
- [[microcontrollers]]
