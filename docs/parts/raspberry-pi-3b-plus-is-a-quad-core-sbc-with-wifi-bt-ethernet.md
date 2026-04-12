---
description: "Full Linux single-board computer — quad-core 1.4GHz ARM, 1GB RAM, WiFi, Bluetooth 4.2, Gigabit Ethernet (over USB 2.0), 40-pin GPIO header. For when a microcontroller isn't enough and you need an OS"
topics: ["[[microcontrollers]]", "[[communication]]"]
status: needs-test
quantity: 1
voltage: [5, 3.3]
interfaces: [GPIO, I2C, SPI, UART, USB, HDMI, WiFi, Bluetooth, Ethernet, Analog]
logic_level: "3.3V"
manufacturer: "Raspberry Pi Foundation"
soc: "BCM2837B0 (ARM Cortex-A53 quad-core)"
clock_mhz: 1400
ram_mb: 1024
flash_kb: 0
storage: "microSD card (not included)"
pinout: |
  40-pin GPIO header (BCM numbering):
  GPIO2  (SDA1)     — I2C data
  GPIO3  (SCL1)     — I2C clock
  GPIO4  (GPCLK0)   — general purpose clock
  GPIO5              — general purpose
  GPIO6              — general purpose
  GPIO7  (CE1)      — SPI chip enable 1
  GPIO8  (CE0)      — SPI chip enable 0
  GPIO9  (MISO)     — SPI MISO
  GPIO10 (MOSI)     — SPI MOSI
  GPIO11 (SCLK)     — SPI clock
  GPIO12 (PWM0)     — hardware PWM channel 0
  GPIO13 (PWM1)     — hardware PWM channel 1
  GPIO14 (TXD)      — UART TX
  GPIO15 (RXD)      — UART RX
  GPIO16-GPIO27     — general purpose
  Power: 5V (2 pins), 3.3V (2 pins), GND (8 pins)
compatible_with: ["[[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]]", "[[raspberry-pi-7-inch-touchscreen-800x480-dsi]]", "[[dht11-temperature-humidity-sensor-single-wire-0-50c]]", "[[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]]", "[[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]]"]
level_shifter_needed: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]"]
used_in: []
warnings: ["3.3V GPIO — connecting 5V signals to ANY GPIO pin will damage the SoC permanently", "Requires 5V 2.5A power supply via micro-USB — underpowering causes crashes and SD card corruption", "No built-in ADC — need external ADC (MCP3008, ADS1115) for analog inputs", "Gigabit Ethernet is throttled to ~300Mbps because it runs through the USB 2.0 bus", "Not a microcontroller — no real-time guarantees, Linux kernel preempts your code"]
datasheet_url: "https://www.raspberrypi.com/products/raspberry-pi-3-model-b-plus/"
---

# Raspberry Pi 3B+ is a quad-core SBC with WiFi, BT, and Ethernet

The Raspberry Pi 3B+ is not a microcontroller — it's a full single-board computer running Linux. Quad-core ARM Cortex-A53 at 1.4GHz, 1GB RAM, WiFi, Bluetooth 4.2, Gigabit Ethernet (throttled by USB 2.0), 4x USB 2.0, HDMI output, and a 40-pin GPIO header for hardware interfacing. It runs Raspberry Pi OS (Debian-based), Python, Node.js, Docker, or whatever else you'd run on a Linux box.

Use this when you need networking, a filesystem, multitasking, a display, or software too complex for a microcontroller. Don't use this for hard real-time control — Linux isn't an RTOS, and your GPIO-toggling Python script will get preempted by the kernel. For real-time tasks, pair this with a [[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]] or an Arduino over USB/UART.

## Specifications

| Spec | Value |
|------|-------|
| SoC | BCM2837B0 (ARM Cortex-A53, quad-core, 64-bit) |
| Clock | 1.4GHz |
| RAM | 1GB LPDDR2 |
| Storage | microSD card slot (no eMMC) |
| WiFi | 802.11ac dual-band (2.4GHz + 5GHz) |
| Bluetooth | 4.2, BLE |
| Ethernet | Gigabit (over USB 2.0, max ~300Mbps) |
| USB | 4x USB 2.0 |
| HDMI | Full-size HDMI 1.4 |
| Audio | 3.5mm combo audio/video jack |
| GPIO | 40-pin header (26 GPIO) |
| I2C | 1 bus (GPIO2/GPIO3) |
| SPI | 2 buses (SPI0 on GPIO7-11, SPI1 on GPIO16-21) |
| UART | 1 (GPIO14/GPIO15) — mini UART by default, PL011 available |
| PWM | 2 hardware channels (GPIO12, GPIO13) |
| Power | 5V/2.5A via micro-USB |
| Dimensions | 85 x 56mm |
| Weight | 45g |

## GPIO Header

The 40-pin header is 3.3V logic. All GPIO pins are directly connected to the BCM2837B0 SoC with NO buffering or protection.

```
                    +-----+
               3V3  | 1  2| 5V
    I2C SDA  GPIO2  | 3  4| 5V
    I2C SCL  GPIO3  | 5  6| GND
             GPIO4  | 7  8| GPIO14  UART TX
               GND  | 9 10| GPIO15  UART RX
             GPIO17 |11 12| GPIO18  PCM CLK
             GPIO27 |13 14| GND
             GPIO22 |15 16| GPIO23
               3V3  |17 18| GPIO24
    SPI MOSI GPIO10 |19 20| GND
    SPI MISO GPIO9  |21 22| GPIO25
    SPI SCLK GPIO11 |23 24| GPIO8   SPI CE0
               GND  |25 26| GPIO7   SPI CE1
             GPIO0  |27 28| GPIO1   (ID EEPROM, reserved)
             GPIO5  |29 30| GND
             GPIO6  |31 32| GPIO12  PWM0
      PWM1   GPIO13 |33 34| GND
             GPIO19 |35 36| GPIO16
             GPIO26 |37 38| GPIO20
               GND  |39 40| GPIO21
                    +-----+
```

**Note:** Pin numbering uses BCM (Broadcom) numbers, not physical header position. Use `pinout` command on the Pi or `gpio readall` to see the mapping.

## No Analog Inputs

The Raspberry Pi has NO built-in ADC. Unlike Arduino boards with analog pins, the Pi's GPIO is digital-only. For analog readings you need an external ADC:

- **MCP3008** — 8-channel, 10-bit, SPI interface, cheap
- **ADS1115** — 4-channel, 16-bit, I2C interface, higher resolution
- **ADS1015** — 4-channel, 12-bit, I2C, faster but lower resolution

## Wiring Notes

- **3.3V GPIO only**: the BCM2837 has NO 5V tolerance. A 5V signal on any GPIO pin will fry the SoC. When interfacing with 5V Arduinos ([[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]], [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]), use level shifters.
- **I2C**: GPIO2 (SDA) and GPIO3 (SCL) have 1.8k pull-ups to 3.3V on the board. Works with most 3.3V I2C devices directly.
- **SPI**: CE0 (GPIO8) and CE1 (GPIO7) are the two chip selects. Use `/dev/spidev0.0` and `/dev/spidev0.1`.
- **UART**: by default, GPIO14/15 run a mini UART (lower quality). To get the PL011 (full UART), disable Bluetooth's claim on it in `/boot/config.txt` with `dtoverlay=disable-bt`.
- **Power**: 5V/2.5A via micro-USB is mandatory. The official Raspberry Pi power supply is recommended. Powering from a computer USB port (500mA) will cause voltage drops, random crashes, and potential SD card corruption.
- **No onboard storage**: needs a microSD card with the OS flashed to it. Use Raspberry Pi Imager.

## Software Environment

- **Raspberry Pi OS** (Debian-based) — recommended
- **Python + RPi.GPIO** or **gpiozero** — easiest GPIO control
- **Node.js, C, Go, Rust** — all work, community libraries available
- **Docker** — runs on the 64-bit OS variant
- **SSH** — enable in `raspi-config` for headless operation

## Warnings

- **3.3V GPIO is unprotected** — no buffer, no clamping diodes, no second chances. 5V = dead SoC.
- **Not real-time** — Linux kernel scheduling means GPIO timing is unpredictable at microsecond scales. Use a Pico or Arduino for precise timing.
- **Power supply matters** — the lightning bolt icon on screen means undervoltage. Fix it before you corrupt your SD card.
- **Ethernet is fake Gigabit** — the USB 2.0 bottleneck limits it to ~300Mbps.
- **GPIO0 and GPIO1 (pins 27/28)** are reserved for the HAT ID EEPROM. Don't use them for general purpose.
- **SD card wear** — heavy logging or databases will wear out the card. Use an SSD via USB for write-heavy workloads.

---

Related Parts:
- [[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]] -- RP2040 microcontroller, great companion for real-time tasks
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] -- WiFi MCU, lighter weight for IoT endpoints
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] -- cheaper WiFi MCU for simple sensor nodes
- [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]] -- I2C display, works directly at 3.3V
- [[raspberry-pi-7-inch-touchscreen-800x480-dsi]] -- official 7" touchscreen, connects via DSI
- [[dht11-temperature-humidity-sensor-single-wire-0-50c]] -- temp/humidity sensor, works on GPIO at 3.3V
- [[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]] -- 6-axis IMU via I2C, native 3.3V
- [[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]] -- 9-axis IMU via I2C, native 3.3V
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] -- 5V MCU, needs level shifter to connect

Categories:
- [[microcontrollers]]
- [[communication]]
