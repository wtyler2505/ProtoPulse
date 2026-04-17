---
description: "Core concepts and constraints for schematic capture, symbol generation, and electrical rules checking (ERC)."
type: moc
topics:
  - "[[eda-fundamentals]]"
---

# eda-schematic-capture

Rules, standards, and notes pertaining to schematic capture and netlist generation in ProtoPulse.

## Knowledge Notes
- [[fritzing-parts-use-svg-layers-with-xml-connector-defs]] -- FZPZ format: SVG per view + FZP XML manifest
- [[wokwi-chips-use-counterclockwise-pin-ordering]] -- JSON array index = physical pin via CCW convention
- [[kicad-exporter-deterministic-uuid-guarantees-collisions-in-large-projects]] -- fake UUID function in export pipeline
- [[erc-pin-classification-uses-fragile-regex-that-fails-on-nonstandard-names]] -- hardcoded regex instead of parts DB lookup

## Protocols
- I2C — pull-up sizing, address conflicts, clock stretching
- SPI — CPOL/CPHA modes, daisy-chaining
- UART — baud rate, framing, flow control
- USB — differential pair requirements, ESD protection

## Component Knowledge
- For a full list of physical parts and specifications, see [[hardware-components]]
- Passive components (R, C, L) — values, tolerances, packages
- Active components (BJT, MOSFET, op-amp) — Ebers-Moll, Level-1 MOSFET models
- ICs and microcontrollers — [[hardware-component-atmega328p|ATmega328P]], [[hardware-component-esp32-wroom-32|ESP32]], STM32 specifics
- ESD sensitivity — handling classes, flagging rules
