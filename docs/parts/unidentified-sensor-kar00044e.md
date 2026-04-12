---
description: "Unknown sensor with 3 red + 1 black wire marked 'KAR00044E' — wire colors suggest power (red) and ground (black) with possible signal wires. Needs identification"
topics: ["[[unidentified-parts]]"]
status: unidentified
quantity: 1
voltage: []
interfaces: []
logic_level: ""
manufacturer: "Unknown"
part_number: "KAR00044E"
markings: "KAR00044E"
form_factor: "Sensor with 4-wire cable"
wire_colors: "3x red, 1x black"
physical_notes: "4-wire cable (3 red + 1 black) suggests a sensor with power, ground, and 1-2 signal outputs. The 'KAR' prefix is uncommon — could be an internal part number or small manufacturer."
compatible_with: []
used_in: []
warnings: ["Unidentified — do not apply power until wire functions are determined", "Multiple red wires — do NOT assume all red = VCC, some may be signal lines"]
datasheet_url: ""
---

# Unidentified Sensor KAR00044E

An unknown sensor with a 4-wire cable: 3 red wires and 1 black wire. The marking "KAR00044E" doesn't match common component databases.

## Wire Analysis

The unusual 3 red + 1 black wiring could indicate:
- **VCC, GND, Signal1, Signal2** — the red wires are NOT all power
- **Thermistor/RTD** — some temperature sensors use 4-wire measurement (Kelvin connection)
- **Load cell** — 4-wire Wheatstone bridge (excitation+, excitation-, signal+, signal-)
- **Rotary encoder** — VCC, GND, A, B channels (but typically different colors)
- **Water flow sensor** — VCC, GND, pulse output (but that's only 3 wires)

## Identification Steps

1. Examine the sensor body — is it sealed, what shape, any markings on the housing?
2. Measure resistance between all wire pairs (6 combinations) with multimeter
3. Check for diode drops (semiconductor sensor) or pure resistance (thermistor/RTD)
4. If resistance pairs suggest a bridge circuit, it's likely a strain gauge or load cell
5. Try searching "KAR00044E" on component databases, AliExpress, eBay

---

Categories:
- [[unidentified-parts]]
