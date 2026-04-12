---
description: "Best motor shield in the inventory — TB6612FNG MOSFET driver is more efficient and cooler-running than L293D/L298N shields, with 1.2A continuous per channel"
topics: ["[[actuators]]", "[[shields]]"]
status: verified
quantity: 1
voltage: [5]
interfaces: [PWM, Digital]
logic_level: "5V"
logic_notes: "Shield is meant to stack on 5V Arduinos, but the TB6612FNG logic core itself is a lower-voltage MOSFET driver. Treat this inventory board as a 5V shield unless rewired off-board."
manufacturer: "OSEPP"
part_number: "OSEPP-TBSHD-01"
driver_ic: "TB6612FNG (Toshiba)"
max_current_per_channel: "1.2A continuous, 3A peak"
motor_supply_voltage: "4.5-13.5V"
pinout: |
  Arduino shield format (stacks on Uno/Mega):
  AIN1 → Direction control motor A
  AIN2 → Direction control motor A
  BIN1 → Direction control motor B
  BIN2 → Direction control motor B
  PWMA → Speed control motor A (PWM)
  PWMB → Speed control motor B (PWM)
  STBY → Standby (pull HIGH to enable)
  VM   → Motor supply (4.5-13.5V external)
  GND  → Common ground
compatible_with: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]]"]
used_in: []
warnings: ["Motor supply (VM) is separate from logic — connect external 4.5-13.5V for motors", "STBY pin must be pulled HIGH to enable outputs — some shields have a jumper for this"]
datasheet_url: "https://toshiba.semicon-storage.com/info/TB6612FNG_datasheet_en_20141001.pdf"
---

# OSEPP TB6612 Motor Shield drives 2 DC motors at 1.2A per channel

The TB6612FNG is the modern replacement for the L293D and L298N in hobby motor driving. Instead of bipolar transistor H-bridges that waste power as heat, it uses MOSFETs — lower voltage drop (~0.5V vs 1.8-4.9V for L298N), less heat, and better efficiency at the same current ratings. This OSEPP shield puts the TB6612FNG on an Arduino-stackable PCB with screw terminals for motor connections.

At 1.2A continuous per channel (3A peak), it handles most small DC motors and some medium ones. For anything drawing more than 1.2A sustained, you'll need the [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]] — but for everything else, this is the better choice.

## Specifications

| Spec | Value |
|------|-------|
| Driver IC | TB6612FNG (Toshiba) |
| Channels | 2 (dual H-bridge) |
| Motor Supply (VM) | 4.5-13.5V |
| Logic Supply | 5V (from Arduino) |
| Output Current (continuous) | 1.2A per channel |
| Output Current (peak) | 3.2A per channel |
| Voltage Drop | ~0.5V (MOSFET, much lower than L298N) |
| Standby Current | <1uA |
| PWM Frequency | Up to 100kHz |
| Form Factor | Arduino shield (stackable headers) |

## Motor Control Truth Table

| STBY | IN1 | IN2 | PWM | Motor Action |
|------|-----|-----|-----|-------------|
| H | H | L | PWM | Forward (speed = PWM duty) |
| H | L | H | PWM | Reverse (speed = PWM duty) |
| H | H | H | - | Brake (short brake) |
| H | L | L | - | Coast (free run) |
| L | X | X | X | Standby (all outputs off) |

## Why TB6612 over L293D/L298N

| Feature | TB6612FNG | L293D | L298N |
|---------|-----------|-------|-------|
| Current/channel | 1.2A (3A peak) | 600mA (1.2A peak) | 2A (3A peak) |
| Voltage drop | ~0.5V | ~1.4V | ~1.8-4.9V |
| Needs heatsink? | No | No | YES above 0.5A |
| Built-in flyback diodes? | Yes (internal) | Yes | NO — must add externally |
| Efficiency | High (MOSFET) | Low (bipolar) | Low (bipolar) |
| PWM frequency | Up to 100kHz | ~5kHz max | ~25kHz max |

## Wiring Notes

- **Motor supply (VM)**: Connect external 4.5-13.5V power. This is separate from the Arduino 5V rail. Do NOT try to power motors from the Arduino.
- **Ground**: Common ground between motor supply and Arduino is mandatory.
- **STBY pin**: Must be HIGH to enable motor outputs. Check if your shield has a jumper or if you need to tie this to 5V or control it from a GPIO.
- The shield stacks directly on Arduino Uno/Mega headers — no soldering required for basic 2-motor setups.
- Uses fewer Arduino pins than the L298N module since direction and PWM are cleanly separated.

## Warnings

- Motor supply max is 13.5V — do NOT feed it 24V or higher like you can with the L298N.
- 1.2A continuous is the HARD limit per channel. If your motors stall and draw more, the IC has thermal shutdown protection, but repeated thermal cycling shortens its life.
- This is a brushed DC motor driver. It does NOT work with BLDC/brushless motors — use the [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] for those.

---

Related Parts:
- [[dk-electronics-hw-130-motor-shield-uses-l293d-at-600ma]] — lower current alternative, L293D-based
- [[osepp-motor-servo-shield-v1-drives-2-dc-motors-plus-servos]] — L298N-based alternative with servo headers
- [[l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes]] — the IC this shield outperforms
- [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]] — higher current but less efficient
- [[f130s-small-dc-motor-3-5v-130-can-size]] — small DC motor well within 1.2A limit of this shield
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — primary host board (Uno shield form factor)
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible controller
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — Mega clone, same compatibility
- [[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]] — Uno clone, shield fits directly

Categories:
- [[actuators]]
- [[shields]]
