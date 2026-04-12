---
description: "Logic-level N-channel MOSFET — fully on at 5V gate, usable at 3.3V gate, 60V/30A rating in TO-220 package. The go-to switch for motors, LEDs, and relay coils"
topics: ["[[passives]]", "[[power]]"]
status: needs-test
quantity: 10
voltage: [3.3, 5]
interfaces: [MOSFET]
logic_level: "Logic-level (Vgs_th ~1-2.5V)"
manufacturer: "WEIMEET"
part_number: "P30N06LE"
package: "TO-220"
pinout: |
  Pin 1 → Gate (control input from MCU)
  Pin 2 → Drain (load connection)
  Pin 3 → Source (GND)
  Tab   → Drain (heatsink connection)
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[songle-srd-05vdc-relay-5v-coil-spdt-10a-250vac]]"]
used_in: []
warnings: ["Gate is static-sensitive — handle with ESD precautions", "Add 10K pull-down resistor from Gate to Source to prevent floating gate on startup", "At 3.3V gate, Rds_on is higher than at 5V — fine for small loads but check power dissipation for high-current applications", "Tab is connected to Drain — insulate from heatsink if heatsink is grounded"]
datasheet_url: ""
---

# P30N06LE N-Channel Logic-Level MOSFET — 60V 30A

The workhorse switching MOSFET for Arduino/ESP projects. "Logic-level" means the gate threshold voltage is low enough (~1-2.5V) that a 3.3V or 5V GPIO pin can turn it fully on — no gate driver circuit needed. Use it to switch motors, LED strips, solenoids, relay coils, or any DC load up to 60V/30A.

## Specifications

| Spec | Value |
|------|-------|
| Type | N-Channel Enhancement MOSFET |
| Vds (max) | 60V |
| Id (max) | 30A |
| Vgs_th | 1-2.5V (logic-level) |
| Rds_on (Vgs=5V) | ~35 mohm |
| Rds_on (Vgs=10V) | ~22 mohm |
| Package | TO-220 |
| Power Dissipation | 100W (with heatsink) |

## Typical Wiring (Low-side switch)

```
Load+ → V+ supply
Load- → MOSFET Drain (pin 2)
MOSFET Source (pin 3) → GND
MOSFET Gate (pin 1) → Arduino digital pin
10K resistor Gate → Source (pull-down)
```

For inductive loads (motors, solenoids, relay coils), add a flyback diode across the load (cathode to V+).

## PWM Dimming/Speed Control

Connect Gate to a PWM-capable pin. `analogWrite(pin, 0-255)` gives you variable power control — LED dimming, motor speed control, heater regulation.

---

Related Parts:
- [[songle-srd-05vdc-relay-5v-coil-spdt-10a-250vac]] — relay coil is a perfect load for this MOSFET
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — 15 PWM pins for variable control

Categories:
- [[passives]]
- [[power]]
