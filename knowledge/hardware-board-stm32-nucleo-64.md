---
description: "Exact physical and electrical specifications for STM32 Nucleo-64 (F401RE)."
type: domain-knowledge
category: hardware-components
status: verified
tags: [board, hardware, stmicroelectronics]
---

# STM32 Nucleo-64 (F401RE) Specifications

This note is the canonical Ars Contexta source of truth for the STM32 Nucleo-64 (F401RE), used to enforce physical constraints and validate AI-generated wiring logic.

## Identity & Verification
- **Manufacturer:** STMicroelectronics
- **MPN:** NUCLEO-F401RE
- **Aliases:** Nucleo-64, Nucleo F401RE, NUCLEO-F401RE, STM32F401
- **Family:** board-module
- **Description:** STM32F401RET6 Cortex-M4 at 84MHz with Arduino-compatible headers and ST Morpho connectors. On-board ST-LINK/V2-1 debugger. 512KB flash, 96KB SRAM.
- **Breadboard Fit:** `not_breadboard_friendly`
- **Breadboard Notes:** At 70mm wide, the Nucleo-64 is too wide for a breadboard. Use jumper wires from the female Arduino or Morpho headers to a breadboard.

## Exact Physical Dimensions
- **Width:** 70 mm
- **Height:** 82.5 mm
- **Thickness:** 15 mm
- **Pin Pitch:** 2.54 mm

## Visual Characteristics
- **PCB Color (Hex):** `#f8fafc`
- **Silkscreen Color (Hex):** `#cbd5e1`

## Electrical Constraints
- **Operating Voltage:** 3.3V
- **Input Voltage Range:** 7V - 12V
- **Max Current Per Pin:** 25 mA
- **Max Total Current:** 120 mA

## Headers & Pinout
### power Header (left side, 8 pins)
- **NC** (nc, 0V): 
- **IOREF** (power, 3.3V): 
- **RESET** (control, 3.3V): 
- **3.3V** (power, 3.3V): Max 100mA from on-board regulator
- **5V** (power, 5V): Available when powered via USB (500mA max)
- **GND** (ground, 0V): 
- **GND** (ground, 0V): 
- **VIN** (power, 7V): Input voltage 7-12V

### analog Header (left side, 6 pins)
- **A0** (analog, 3.3V): 
- **A1** (analog, 3.3V): 
- **A2** (analog, 3.3V): 
- **A3** (analog, 3.3V): 
- **A4** (analog, 3.3V): 
- **A5** (analog, 3.3V): 

### digital-low Header (right side, 8 pins)
- **D0** (communication, 3.3V): Connected to ST-LINK virtual COM port
- **D1** (communication, 3.3V): Connected to ST-LINK virtual COM port
- **D2** (digital, 3.3V): 
- **D3** (digital, 3.3V): 
- **D4** (digital, 3.3V): 
- **D5** (digital, 3.3V): 
- **D6** (digital, 3.3V): 
- **D7** (digital, 3.3V): 

### digital-high Header (right side, 10 pins)
- **D8** (digital, 3.3V): 
- **D9** (digital, 3.3V): 
- **D10** (digital, 3.3V): 
- **D11** (digital, 3.3V): 
- **D12** (digital, 3.3V): 
- **D13** (digital, 3.3V): Connected to on-board LED (LD2)
- **GND** (ground, 0V): 
- **AREF** (control, 3.3V): 
- **SDA** (communication, 3.3V): 
- **SCL** (communication, 3.3V): 

## Critical Safety & Verification Notes
- **WARNING:** 3.3V logic ONLY — do NOT apply 5V to GPIO pins (not 5V tolerant on all pins)
- **WARNING:** D0/D1 connected to ST-LINK virtual COM — may conflict with external serial devices
- **WARNING:** D13 connected to on-board LED LD2
- **WARNING:** Some Arduino shields may not be compatible due to 3.3V logic
- Arduino-compatible headers only — Morpho connector pins not included in this definition
- Full Morpho connector adds 76 GPIO pins (38 per side)
- 12-bit ADC (vs 10-bit on AVR Arduino boards)
- On-board ST-LINK debugger supports SWD and virtual COM port
- [undefined](https://www.st.com/en/evaluation-tools/nucleo-f401re.html) (Confidence: high)
- [undefined](https://www.st.com/resource/en/user_manual/um1724-stm32-nucleo64-boards-mb1136-stmicroelectronics.pdf) (Confidence: high)

---
Related: [[hardware-components]], [[architecture-decisions]]
