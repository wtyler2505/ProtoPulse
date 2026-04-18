---
description: "Exact physical and electrical specifications for SparkFun Thing Plus ESP32 WROOM."
type: domain-knowledge
category: hardware-components
status: verified
tags: [board, hardware, sparkfun]
topics:
  - "[[hardware-components-mcu]]"
  - "[[hardware-components]]"
  - "[[eda-esp-constraints]]"
---

# SparkFun Thing Plus ESP32 WROOM Specifications

This note is the canonical Ars Contexta source of truth for the SparkFun Thing Plus ESP32 WROOM, used to enforce physical constraints and validate AI-generated wiring logic.

## Identity & Verification
- **Manufacturer:** SparkFun
- **MPN:** WRL-20168
- **Aliases:** Thing Plus, SparkFun ESP32, Thing Plus ESP32, ESP32 Thing Plus
- **Family:** board-module
- **Description:** ESP32-D0WDQ6 dual-core at 240MHz with Feather-compatible form factor, Qwiic I2C connector, WiFi + BLE, LiPo charging. 21 GPIO, 2 DAC, 16 ADC, touch sensing.
- **Breadboard Fit:** `native`
- **Breadboard Notes:** Feather/Thing Plus form factor (23mm wide) fits across the center channel of a standard breadboard. 16 pins left, 12 pins right at 0.1" pitch.

## Exact Physical Dimensions
- **Width:** 23 mm
- **Height:** 58 mm
- **Thickness:** 8 mm
- **Pin Pitch:** 2.54 mm

## Visual Characteristics
- **PCB Color (Hex):** `#dc2626`
- **Silkscreen Color (Hex):** `#b91c1c`

## Electrical Constraints
- **Operating Voltage:** 3.3V
- **Input Voltage Range:** 3.4V - 6V
- **Max Current Per Pin:** 12 mA
- **Max Total Current:** 50 mA

## Headers & Pinout
### left Header (left side, 16 pins)
- **RST** (control, 3.3V): 
- **3V3** (power, 3.3V): 
- **A0** (analog, 3.3V): 
- **A1** (analog, 3.3V): 
- **A2** (analog, 3.3V): 
- **A3** (analog, 3.3V): 
- **A4** (analog, 3.3V): 
- **A5** (analog, 3.3V): 
- **SCK** (communication, 3.3V): 
- **MOSI** (communication, 3.3V): 
- **MISO** (communication, 3.3V): 
- **RX** (communication, 3.3V): 
- **TX** (communication, 3.3V): 
- **SDA** (communication, 3.3V): 
- **SCL** (communication, 3.3V): 
- **GND** (ground, 0V): 

### right Header (right side, 12 pins)
- **BAT** (power, 4.2V): LiPo battery voltage
- **EN** (control, 3.3V): Pull LOW to disable regulator
- **USB** (power, 5V): USB 5V only when USB connected
- **13** (digital, 3.3V): Connected to on-board LED
- **12** (digital, 3.3V): Strapping pin — affects boot mode
- **27** (digital, 3.3V): 
- **33** (digital, 3.3V): 
- **15** (digital, 3.3V): Strapping pin — outputs PWM at boot
- **32** (digital, 3.3V): 
- **14** (digital, 3.3V): 
- **SS** (digital, 3.3V): Strapping pin — must be HIGH at boot for SPI flash
- **GND** (ground, 0V): 

## Critical Safety & Verification Notes
- **WARNING:** 3.3V logic ONLY — do NOT apply 5V to GPIO pins
- **WARNING:** GPIO36/39/34 are input-only — cannot be used as outputs
- **WARNING:** ADC2 pins cannot read analog when WiFi is active
- **WARNING:** GPIO12 strapping pin — pulling HIGH at boot can brick the board
- **WARNING:** LiPo connector polarity must match (check before connecting)
- Feather-compatible pin layout — works with Feather Wings
- Qwiic connector shares I2C bus with SDA/SCL header pins
- GPIO36/39/34 are input-only (no internal pull-up/down)
- ADC2 channels unavailable when WiFi is active
- ESP32 strapping pins affect boot mode — see bootPins
- [undefined](https://docs.sparkfun.com/SparkFun_Thing_Plus_ESP32_WROOM_C/hardware_overview/) (Confidence: high)
- [undefined](https://learn.sparkfun.com/tutorials/esp32-thing-plus-hookup-guide/all) (Confidence: high)

---
Related: [[hardware-components]], [[architecture-decisions]]
