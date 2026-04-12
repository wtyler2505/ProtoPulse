---
description: "Combo motor+servo shield — L298N-based 2A/ch DC motor driver with dedicated servo pin headers, good for small robot builds that need both DC motors and servos on one board"
topics: ["[[actuators]]", "[[shields]]"]
status: needs-test
quantity: 1
voltage: [5]
interfaces: [PWM, Digital, Servo]
logic_level: "5V"
manufacturer: "OSEPP"
part_number: "OSEPP-MOTSRV-01"
driver_ic: "L298N"
max_current_per_channel: "2A continuous"
motor_supply_voltage: "5-46V"
pinout: |
  Arduino shield format (stacks on Uno/Mega):
  Motor A:
    IN1 → Direction control A
    IN2 → Direction control A
    ENA → PWM speed control A
  Motor B:
    IN3 → Direction control B
    IN4 → Direction control B
    ENB → PWM speed control B
  Servo headers:
    Servo 1 → Signal + 5V + GND
    Servo 2 → Signal + 5V + GND
  VM → External motor supply (5-46V)
  GND → Common ground
compatible_with: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]]"]
used_in: []
warnings: ["L298N has high voltage drop (1.8-4.9V) — inefficient at low motor voltages", "Needs external flyback diodes on motor outputs (L298N has no built-in protection)", "Servo headers share 5V from Arduino — don't power heavy servos from it, use external 5V"]
datasheet_url: ""
---

# OSEPP Motor & Servo Shield V1 drives 2 DC motors plus servos

An all-in-one shield for small robot builds. The L298N H-bridge handles two DC motors at up to 2A per channel, and the servo pin headers give you plug-and-play connections for standard hobby servos. Stacks on Arduino Uno or Mega.

The convenience is the selling point — one board, motors and servos, no breadboard wiring. The downside is the L298N driver: it's inefficient (high voltage drop, gets hot), needs external flyback diodes, and the servo headers share the Arduino's 5V rail which can brown out under load.

For motor driving alone, the [[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]] is a better choice. This shield is for when you specifically need servo headers on the same board.

## Specifications

| Spec | Value |
|------|-------|
| Driver IC | L298N |
| Motor Channels | 2 (dual H-bridge) |
| Motor Supply | 5-46V (external) |
| Logic Supply | 5V (from Arduino) |
| Output Current | 2A per channel continuous |
| Peak Current | 3A non-repetitive |
| Voltage Drop | 1.8V (1A) to 4.9V (2A) |
| Servo Headers | 2 (3-pin: Signal, VCC, GND) |
| Form Factor | Arduino shield (stackable) |

## Wiring Notes

- **Motor supply**: Connect external power (7-12V typical for hobby motors) to the VM terminal. Do NOT run motors off the Arduino 5V.
- **Servo power**: The servo headers typically route 5V from the Arduino's onboard regulator. This is fine for micro servos (SG90 type) but will brown out the Arduino if you connect standard servos that draw 500mA+. For full-size servos, cut the VCC trace and wire in external 5V/6V.
- **Flyback diodes**: The L298N does NOT have built-in clamp diodes. Add fast-recovery diodes (1N4148 or Schottky) across each motor terminal, or motor back-EMF will damage the driver.
- **Heat**: At currents above 1A, the L298N gets hot. The shield may or may not have a heatsink — check yours and add one if it doesn't.

## Warnings

- Voltage drop across the L298N is significant — a 6V motor supply delivers only ~4V to the motor at 1A. Plan your supply voltage accordingly.
- Servo headers share Arduino 5V — overloading this will reset your Arduino or damage the regulator.
- Check which Arduino pins the shield uses before stacking — motor direction and PWM pins vary by shield revision and may conflict with other shields.

---

Related Parts:
- [[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]] — more efficient motor driver, no servo headers
- [[dk-electronics-hw-130-motor-shield-uses-l293d-at-600ma]] — cheaper/lower current alternative
- [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]] — same driver IC as standalone module
- [[l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes]] — lower current IC with built-in diodes
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — primary host board (Uno shield form factor)
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible controller
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — Mega clone, same compatibility
- [[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]] — Uno clone, shield fits directly

Categories:
- [[actuators]]
- [[shields]]
