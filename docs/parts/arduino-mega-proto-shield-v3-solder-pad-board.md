---
description: "Prototyping shield in Mega form factor — solder pads for building custom circuits that stack directly on the Mega without breadboards"
topics: ["[[shields]]"]
status: needs-test
quantity: 1
voltage: [5]
interfaces: [Solderable]
logic_level: "5V"
manufacturer: "Arduino"
part_number: "A000xxx"
pinout: |
  Passes through all Mega header pins
  Solder pad grid in center area
  Reset button
  Footprint for SMD or through-hole prototyping
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]"]
used_in: []
warnings: ["Mega form factor only — will not fit Uno", "Once soldered, changes are difficult — plan your layout before soldering", "No connection between pads by default — you must wire them yourself"]
datasheet_url: ""
---

# Arduino Mega Proto Shield V3 — Solder Pad Board

A blank prototyping shield that plugs into an Arduino Mega. The solder pad grid lets you build permanent custom circuits — solder down ICs, resistors, connectors, and wire them to Mega I/O pins directly. Use this when your project graduates from breadboard to something permanent but you don't want to design a custom PCB.

## Specifications

| Spec | Value |
|------|-------|
| Form Factor | Arduino Mega shield |
| Pad Grid | Through-hole, 0.1" spacing |
| Features | Reset button, LED footprint |
| Passthrough | All Mega headers accessible underneath |

---

Related Parts:
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — the board this shield stacks on
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — Mega clone, same pin layout and shield compatibility
- [[sainsmart-mega-sensor-shield-v2-3-pin-breakout]] — alternative: pre-made 3-pin breakouts vs. custom solder

Categories:
- [[shields]]
