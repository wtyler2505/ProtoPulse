---
description: "Entry point to the ProtoPulse knowledge vault -- 528 atomic notes across 11 hardware topic maps covering microcontrollers, actuators, sensors, displays, power, communication, shields, passives, input devices, and system wiring"
type: moc
topics: []
---

# index

Welcome to the ProtoPulse knowledge vault. 528 atomic notes across 11 hardware-domain topic maps, built via the `/extract` pipeline from parts, datasheets, and bench experience.

## Hardware Topic Maps

- [[hardware-components]] -- master topic map for all physical hardware components and boards
- [[eda-fundamentals]] -- core EDA concepts, MCU pin constraints, protocol basics, simulation, and PCB design rules
- [[microcontrollers]] -- ATmega328P, ESP32, ESP8266, RP2040, SAMD51, STM32 pin maps, boot gotchas, and peripheral constraints
- [[actuators]] -- DC, stepper, servo, BLDC, AC motors; H-bridges; brake/coast logic; mechanical advantage
- [[sensors]] -- IR, Hall, reed, tilt, light, temperature, RTC, compass/IMU, RFID, PDM microphone
- [[displays]] -- TFT/OLED/LCD protocols, 7-segment multiplexing, LED matrix, NeoPixel, touchscreen
- [[power-systems]] -- regulators, batteries, BMS, buck/boost, protection, mains-class capacitors
- [[passives]] -- R, C, L, BJT, MOSFET, shift registers, crystals, diodes
- [[communication]] -- UART, I2C, SPI, WiFi, Bluetooth, RS-485, PoE
- [[shields]] -- Arduino shield ecosystem, motor/sensor/LCD shields, pin conflicts
- [[input-devices]] -- joysticks, keypads, rotary encoders, switches, IR remotes
- [[wiring-integration]] -- common ground, level shifting, flyback protection, decoupling placement, EMI suppression

## Meta / Operational

- [[identity]] -- who the agent is and how it approaches work
- [[methodology]] -- how the agent processes and connects knowledge
- [[goals]] -- current active threads
- [[architecture-decisions]] -- platform architecture, migration plans, ADRs
- [[breadboard-intelligence]] -- bench-coach reasoning, multi-component wiring

## Pipeline

Raw material routes through `inbox/` → `/extract` → `knowledge/` → linked from topic maps here. Never write to `knowledge/` directly; always route through the pipeline.
