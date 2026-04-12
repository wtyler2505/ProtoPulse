---
description: "8-channel BSS138-based bidirectional level shifter module — works reliably with I2C, SPI, and UART. Slower than TXS0108E but plays nice with open-drain I2C pull-ups. The go-to shifter for mixed-voltage I2C buses"
topics: ["[[shields]]", "[[passives]]"]
status: verified
quantity: 2
voltage: [1.8, 3.3, 5]
interfaces: [I2C, SPI, UART, Digital]
logic_level: "mixed"
logic_notes: "Bridge-style shifter. LV side follows the low-voltage domain, HV side follows the high-voltage domain. Best for open-drain buses like I2C."
manufacturer: "Generic (module designation HW-221)"
part_number: "HW-221"
pinout: |
  HW-221 module (8-channel):
  LV   → Low-voltage reference (1.8-3.3V)
  HV   → High-voltage reference (3.3-5V)
  GND  → Common ground (both sides)
  LV1-LV8 → Low-voltage side channels
  HV1-HV8 → High-voltage side channels

  Each channel uses one BSS138 N-MOSFET + two 10K pull-up resistors
  (one to LV, one to HV)
compatible_with: ["[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]]", "[[ina219-high-side-current-sensor-26v-i2c-for-power-monitoring]]", "[[hmc5883l-qmc5883l-3-axis-compass-magnetometer-i2c]]"]
alternative_to: ["[[txs0108e-8-channel-bidirectional-level-shifter-auto-direction]] (TXS0108E — faster for push-pull signals but FAILS with I2C open-drain)"]
used_in: []
warnings: ["Maximum reliable speed is ~400kHz — fine for I2C standard/fast mode, too slow for SPI at high clock rates", "Uses 10K pull-up resistors onboard — for I2C buses with many devices, the combined pull-up may be too strong (reduce bus capacitance tolerance). Check total pull-up resistance", "All channels share common ground — LV GND and HV GND must be connected", "Not suitable for high-speed signals (>1MHz) — use TXS0108E for fast push-pull signals", "Do NOT connect high-voltage reference (HV) to anything above 5.5V — the BSS138 MOSFETs are rated for 50V Vds but the pull-ups reference HV voltage"]
datasheet_url: "https://cdn-shop.adafruit.com/datasheets/an97055.pdf"
---

# HW-221 8-Channel Bidirectional Level Shifter — BSS138-Based

The HW-221 is the reliable workhorse level shifter for I2C buses. Each channel uses a BSS138 N-channel MOSFET with pull-up resistors on both sides. When the low side pulls down, the MOSFET conducts and pulls the high side down. When the high side pulls down, the body diode pulls the low side down. Bidirectional, no configuration needed.

This is the **correct level shifter for I2C**. Unlike the [[txs0108e-8-channel-bidirectional-level-shifter-auto-direction]] which fights with I2C's open-drain topology, the BSS138 circuit is designed for open-drain protocols. The pull-up resistors on both sides are exactly what I2C needs.

You have 2 of these — enough to shift an entire I2C bus (2 channels for SDA/SCL) with 6 spare channels for other signals, or to run two separate shifted buses.

## Specifications

| Spec | Value |
|------|-------|
| Channels | 8 bidirectional |
| MOSFET | BSS138 N-channel (one per channel) |
| Low-Voltage Range | 1.8-3.3V |
| High-Voltage Range | 3.3-5V |
| Pull-Up Resistors | 10K on each side (onboard) |
| Max Speed | ~400kHz (I2C fast mode) |
| Direction | Automatic (pull-up/MOSFET based) |
| Package | PCB module with pin headers |
| Quiescent Current | ~0 (passive FET circuit) |

## How It Works (Per Channel)

```
HV side (5V)                    LV side (3.3V)
    |                               |
   [10K]                          [10K]
    |                               |
    +---- HV pin ----[BSS138]---- LV pin ----+
                      Gate → LV reference
                      Source → LV pin
                      Drain → HV pin

LV drives LOW → MOSFET gate-source > threshold → MOSFET ON → HV pulled LOW
HV drives LOW → Body diode conducts → LV pulled LOW
Neither drives → Both pulled HIGH by their respective pull-ups
```

## Wiring for I2C Level Shifting (3.3V ESP32 to 5V I2C devices)

| HW-221 Pin | 3.3V Side (ESP32) | 5V Side (I2C devices) |
|------------|-------------------|----------------------|
| LV | 3.3V | — |
| HV | — | 5V |
| GND | GND | GND |
| LV1 | GPIO21 (SDA) | — |
| HV1 | — | SDA bus (sensors) |
| LV2 | GPIO22 (SCL) | — |
| HV2 | — | SCL bus (sensors) |

## I2C Bus with Multiple Shifted Devices

```
ESP32 (3.3V)          HW-221              5V I2C Devices
                   LV     HV
GPIO21 (SDA) ──→ LV1 ─── HV1 ──┬── BNO055 SDA (0x28)
                                ├── INA219 SDA (0x40)
                                └── Compass SDA (0x1E/0x0D)

GPIO22 (SCL) ──→ LV2 ─── HV2 ──┬── BNO055 SCL
                                ├── INA219 SCL
                                └── Compass SCL

3.3V ──→ LV
5V   ──→ HV
GND  ──→ GND (both sides)
```

## TXS0108E vs BSS138 (HW-221) — When to Use Which

| Scenario | Use This |
|----------|----------|
| I2C bus shifting | **HW-221** (BSS138) |
| Hall sensor signals (push-pull, fast) | **TXS0108E** |
| UART shifting | Either (BSS138 at standard baud rates) |
| SPI shifting (>1MHz) | **TXS0108E** |
| SPI shifting (<1MHz) | Either |
| Mixed: I2C + push-pull on same board | Use BOTH — one for I2C, one for push-pull |

---

Related Parts:
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — 3.3V MCU; LV side connects to ESP32 I2C (GPIO21 SDA, GPIO22 SCL)
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — 5V MCU; HV side connects to Mega I2C when bridging to 3.3V sensors
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — 5V MCU; HV side for bridging to 3.3V peripherals
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — Mega clone, same 5V I2C bus
- [[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]] — 3.3V MCU; LV side for bridging to 5V I2C devices
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — 3.3V MCU; LV side for bridging to 5V devices
- [[bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c]] — 5V I2C sensor; connect on HV side when using 3.3V MCU
- [[ina219-high-side-current-sensor-26v-i2c-for-power-monitoring]] — I2C sensor; connect on appropriate voltage side
- [[hmc5883l-qmc5883l-3-axis-compass-magnetometer-i2c]] — I2C sensor; connect on appropriate voltage side
- [[txs0108e-8-channel-bidirectional-level-shifter-auto-direction]] — alternative shifter; faster for push-pull signals (SPI, Hall sensors) but FAILS with I2C

Categories:
- [[shields]]
- [[passives]]
