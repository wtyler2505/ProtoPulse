---
description: "The go-to H-bridge for medium-power motor projects — 2A continuous per channel, 46V max, TTL inputs. Gets hot at higher currents, needs heatsink and flyback diodes"
topics: ["[[actuators]]", "[[shields]]"]
status: verified
quantity: 2
voltage: [5, 7, 12, 24, 36, 46]
interfaces: [Digital, PWM]
logic_level: "mixed"
logic_notes: "Uses a 5V logic supply, but the IN/EN pins are TTL-threshold inputs so 3.3V MCU outputs usually work. It does not present MCU-safe logic outputs."
manufacturer: "STMicroelectronics"
part_number: "L298N"
pinout: |
  Multiwatt15 package:
  Pin 1  → Current Sensing A (connect sense resistor to GND)
  Pin 2  → Output 1 (motor A terminal 1)
  Pin 3  → Output 2 (motor A terminal 2)
  Pin 4  → VS (motor supply, up to 46V)
  Pin 5  → Input 1 (TTL, bridge A direction)
  Pin 6  → Enable A (TTL, PWM for speed control)
  Pin 7  → Input 2 (TTL, bridge A direction)
  Pin 8  → GND
  Pin 9  → VSS (logic supply, 4.5-7V)
  Pin 10 → Input 3 (TTL, bridge B direction)
  Pin 11 → Enable B (TTL, PWM for speed control)
  Pin 12 → Input 4 (TTL, bridge B direction)
  Pin 13 → Output 3 (motor B terminal 1)
  Pin 14 → Output 4 (motor B terminal 2)
  Pin 15 → Current Sensing B (connect sense resistor to GND)
max_current_per_channel: "2A DC, 2.5A repetitive, 3A peak"
total_current_limit: "4A total"
compatible_with: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[28byj-48-5v-unipolar-stepper-motor-with-uln2003-driver]]"]
used_in: []
warnings: ["Needs external flyback diodes (fast recovery, trr < 200ns) on all motor outputs", "High saturation voltage drop: 1.8-4.9V total — at 12V motor supply you lose up to 5V to the driver", "25W max dissipation — NEEDS heatsink at currents above 0.5A", "Separate logic supply (VSS) required: 4.5-7V with 100nF cap to GND", "Motor supply (VS) needs 100nF cap to GND"]
datasheet_url: "Datasheets/l298n.pdf"
---

# L298N dual H-bridge motor driver drives 2 DC motors or 1 stepper up to 46V 2A

## Specifications

| Spec | Value |
|------|-------|
| Motor Supply (VS) | Up to 46V |
| Logic Supply (VSS) | 4.5-7V (typically 5V) |
| Output Current (DC) | 2A per channel |
| Output Current (peak) | 3A non-repetitive |
| Total Power Dissipation | 25W (at Tcase = 75C) |
| Saturation Voltage | 1.8V (1A) to 4.9V (2A) total drop |
| Input Logic HIGH | 2.3V min |
| Input Logic LOW | 1.5V max |
| Operating Temp | -25 to 130C |
| Package | Multiwatt15 / PowerSO-20 |

## Pinout

```
  Multiwatt15 (front view, pins down)

  SENSE_A [1]              [15] SENSE_B
  OUT1    [2]              [14] OUT4
  OUT2    [3]              [13] OUT3
  VS      [4]  (heatsink)  [12] IN4
  IN1     [5]              [11] EN_B
  EN_A    [6]              [10] IN3
  IN2     [7]              [9]  VSS
  GND     [8]

  Tab connected to pin 8 (GND)
```

## Motor Control Truth Table

| EN | IN1 | IN2 | Motor Action |
|----|-----|-----|-------------|
| H  | H   | L   | Forward |
| H  | L   | H   | Reverse |
| H  | H   | H   | Brake (fast stop) |
| H  | L   | L   | Coast (free run) |
| L  | X   | X   | Disabled |

## Wiring Notes

- **Motor supply (VS, pin 4)**: Connect to your motor battery/supply (7-46V). Add 100nF ceramic cap directly at the pin to GND.
- **Logic supply (VSS, pin 9)**: Connect to Arduino 5V. Add 100nF ceramic cap to GND.
- **Enable pins (EN_A, EN_B)**: Connect to PWM-capable Arduino pins for speed control. Or jumper to 5V for always-on.
- **Input pins (IN1-IN4)**: Connect to any Arduino digital pins for direction control.
- **Sense resistors**: Connect 0.5 ohm resistor from SENSE_A/B to GND for current monitoring. Or jumper directly to GND if not monitoring current.
- **Flyback diodes**: MANDATORY on all 4 output pins. Use fast-recovery diodes (1N4148 or similar, trr < 200ns). Schottky diodes work too.

## Warnings

- The voltage DROP across this chip is significant — at 2A you lose up to 4.9V. A 12V motor effectively gets ~7V. For high-efficiency applications, consider MOSFET-based drivers (like TB6612).
- Gets VERY hot at higher currents. The tab IS the heatsink mount — bolt it to aluminum.
- Unlike the L293D, the L298N does NOT have built-in flyback diodes. You MUST add them externally.
- Two separate power supplies needed: VS (motor) and VSS (logic). Common ground required.

---

Related Parts:
- [[28byj-48-5v-unipolar-stepper-motor-with-uln2003-driver]] -- can drive this stepper (overkill, ULN2003 is simpler for 28BYJ-48)
- [[max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins]] -- unrelated but both use SPI-like interfaces

**NOT for BLDC motors.** The L298N is an H-bridge driver designed for brushed DC motors and stepper motors ONLY. It cannot drive brushless DC (BLDC) motors — those require electronic commutation with Hall sensor feedback. For hoverboard BLDC hub motors, use the [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] instead, which handles 3-phase commutation, Hall sensor input, and runs on 6-60V at up to 16A.

Categories:
- [[actuators]]
- [[shields]]
