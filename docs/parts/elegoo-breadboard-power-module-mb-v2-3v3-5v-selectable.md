---
description: "Breadboard power supply — plugs into MB-102 breadboard, selectable 3.3V or 5V per rail, powered from USB or 6.5-12V barrel jack"
topics: ["[[power]]"]
status: needs-test
quantity: 2
voltage: [3.3, 5]
interfaces: [Barrel, USB]
logic_level: "N/A"
manufacturer: "Elegoo"
part_number: "MB-102 Power"
pinout: |
  Input:  USB micro-B OR 6.5-12V barrel jack (center positive)
  Output: Two power rails on breadboard
  Jumpers: Select 3.3V or 5V independently per rail
  On/Off: Slide switch
compatible_with: ["[[solderless-breadboard-full-size-mb-102-830-point]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]"]
used_in: []
warnings: ["Check jumper position before powering — wrong voltage can damage 3.3V components", "Max output current ~700mA total — not enough for servos or motors, use separate power for those", "Some clones have poor voltage regulation — verify output with multimeter before connecting sensitive components"]
datasheet_url: "https://randomnerdtutorials.com/breadboard-power-supply-module/"
---

# Elegoo Breadboard Power Module MB V2 — 3.3V/5V Selectable

Plugs directly into a standard MB-102 breadboard and powers both rails. Each rail has an independent jumper to select 3.3V or 5V — so you can run a 3.3V ESP32 circuit on one side and a 5V Arduino circuit on the other from the same power module. Input from USB or a barrel jack (6.5-12V).

## Specifications

| Spec | Value |
|------|-------|
| Input Voltage | 6.5-12V (barrel) or 5V (USB) |
| Output Voltage | 3.3V or 5V per rail (jumper selectable) |
| Max Output Current | ~700mA total |
| Regulator | AMS1117-3.3 and AMS1117-5.0 |
| Connector | Plugs into MB-102 breadboard power rails |
| Switch | On/off slide switch |
| LED | Power indicator |

---

Related Parts:
- [[solderless-breadboard-full-size-mb-102-830-point]] — the breadboard this module plugs into
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — can share breadboard for 5V prototyping
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — can share breadboard for 5V prototyping
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — set jumper to 3.3V rail for ESP32 prototyping
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — can share breadboard for 5V prototyping

Categories:
- [[power]]
