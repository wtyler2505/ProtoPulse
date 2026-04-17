---
description: "Exact physical and electrical specifications for NodeMCU ESP32-S."
type: domain-knowledge
category: hardware-components
status: verified
tags: [board, hardware, espressif (module) / ai-thinker (dev board)]
---

# NodeMCU ESP32-S Specifications

This note is the canonical Ars Contexta source of truth for the NodeMCU ESP32-S, used to enforce physical constraints and validate AI-generated wiring logic.

## Identity & Verification
- **Manufacturer:** Espressif (module) / Ai-Thinker (dev board)
- **MPN:** ESP-WROOM-32
- **Aliases:** NodeMCU ESP32, ESP32 DevKit, ESP32-S, ESP32 Dev Board, ESP-WROOM-32, ESP32 38-pin, NodeMCU-32S, ESP32-DevKitC
- **Family:** board-module
- **Description:** NodeMCU ESP32-S — 38-pin development board based on Espressif ESP-WROOM-32 module. Dual-core 240 MHz Xtensa LX6, 520 KB SRAM, WiFi 802.11 b/g/n, Bluetooth 4.2/BLE, 34 GPIO (25 usable), 18 ADC channels, 2 DAC, 10 touch sensors, 4 SPI, 2 I2C, 3 UART, CAN, I2S.
- **Breadboard Fit:** `requires_jumpers`
- **Breadboard Notes:** At 22.86mm row spacing, the 38-pin NodeMCU ESP32-S barely fits on a standard 830-point breadboard — only 1 free column remains on each side. Many makers use two breadboards side-by-side or a dedicated ESP32 breakout expansion board.

## Exact Physical Dimensions
- **Width:** 25.4 mm
- **Height:** 54 mm
- **Thickness:** 1.6 mm
- **Pin Pitch:** 2.54 mm

## Visual Characteristics
- **PCB Color (Hex):** `#0f172a`
- **Silkscreen Color (Hex):** `#1e293b`

## Electrical Constraints
- **Operating Voltage:** 3.3V
- **Input Voltage Range:** 4.5V - 9V
- **Max Current Per Pin:** 40 mA
- **Max Total Current:** 1200 mA

## Headers & Pinout
### left Header (left side, 19 pins)
- **3V3** (power, 3.3V): Max 600mA from AMS1117 regulator
- **EN** (control, 3.3V): Module enable — active HIGH. Connected to reset button.
- **VP** (analog, 3.3V): Input only — no output capability, no internal pull resistors
- **VN** (analog, 3.3V): Input only — no output capability, no internal pull resistors
- **IO34** (analog, 3.3V): Input only — no output capability, no internal pull resistors
- **IO35** (analog, 3.3V): Input only — no output capability, no internal pull resistors
- **IO32** (digital, 3.3V): 
- **IO33** (digital, 3.3V): 
- **IO25** (digital, 3.3V): 
- **IO26** (digital, 3.3V): 
- **IO27** (digital, 3.3V): 
- **IO14** (digital, 3.3V): 
- **IO12** (digital, 3.3V): STRAPPING PIN — must be LOW at boot for 3.3V flash. HIGH selects 1.8V flash and will crash most modules.
- **GND** (ground, 0V): 
- **IO13** (digital, 3.3V): 
- **SD2** (nc, 3.3V): 
- **SD3** (nc, 3.3V): 
- **CMD** (nc, 3.3V): 
- **5V** (power, 5V): 5V from USB or external supply via VIN. ESP32 GPIOs are NOT 5V tolerant.

### right Header (right side, 19 pins)
- **GND** (ground, 0V): 
- **IO23** (digital, 3.3V): 
- **IO22** (communication, 3.3V): 
- **TX0** (communication, 3.3V): Connected to CP2102 USB-Serial. Outputs debug data on boot.
- **RX0** (communication, 3.3V): Connected to CP2102 USB-Serial. HIGH at boot.
- **IO21** (communication, 3.3V): 
- **GND** (ground, 0V): 
- **IO19** (digital, 3.3V): 
- **IO18** (digital, 3.3V): 
- **IO5** (digital, 3.3V): STRAPPING PIN — must be HIGH at boot. Internal pull-up present.
- **IO17** (communication, 3.3V): 
- **IO16** (communication, 3.3V): 
- **IO4** (digital, 3.3V): 
- **IO0** (digital, 3.3V): STRAPPING PIN — LOW enters download/programming mode (BOOT button). Must be HIGH or floating for normal boot.
- **IO2** (digital, 3.3V): STRAPPING PIN — must be LOW or floating during boot. Connected to on-board LED on most dev boards.
- **IO15** (digital, 3.3V): STRAPPING PIN — LOW silences boot log output. HIGH enables boot messages on UART0.
- **SD1** (nc, 3.3V): 
- **SD0** (nc, 3.3V): 
- **CLK** (nc, 3.3V): 

## Critical Safety & Verification Notes
- **WARNING:** ESP32 GPIOs are 3.3V ONLY. Connecting 5V signals directly will damage the chip.
- **WARNING:** Do not use GPIO 6-11 — they are connected to internal flash and will crash the module.
- **WARNING:** GPIO12 HIGH at boot will set flash voltage to 1.8V and brick the boot process on most modules.
- **WARNING:** ADC2 is completely disabled when WiFi is active — design around ADC1 channels.
- GPIO 6-11 are connected to internal SPI flash — NEVER use these pins.
- GPIO 34, 35, 36 (VP), 39 (VN) are INPUT ONLY — no output, no pull resistors.
- ADC2 channels (GPIO 0, 2, 4, 12-15, 25-27) are UNAVAILABLE when WiFi is active. Always prefer ADC1 (GPIO 32-39) in WiFi applications.
- 5 strapping pins (GPIO 0, 2, 5, 12, 15) affect boot behavior — see bootPins for details.
- GPIO12 is the most dangerous strapping pin: pulling HIGH at boot sets flash to 1.8V and crashes ESP-WROOM-32 modules.
- All SPI/I2C/UART pins are fully remappable via the ESP32 GPIO matrix — default assignments are conventions, not hardware constraints.
- ESP32 GPIOs are NOT 5V tolerant. Use level shifters when interfacing with 5V logic (e.g. Arduino Mega).
- 16 PWM channels available via LEDC peripheral on any GPIO except 34-39 (input-only).
- Internal hall sensor uses GPIO36/39 — avoid external signals on these pins when using hallRead().
- [undefined](https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32_datasheet_en.pdf) (Confidence: high)
- [undefined](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/gpio.html) (Confidence: high)
- [undefined](https://randomnerdtutorials.com/esp32-pinout-reference-gpios/) (Confidence: high)
- [undefined](https://www.espboards.dev/blog/esp32-strapping-pins/) (Confidence: high)

---
Related: [[hardware-components]], [[architecture-decisions]]
