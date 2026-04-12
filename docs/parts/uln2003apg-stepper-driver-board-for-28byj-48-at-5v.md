---
description: "Dedicated driver board for the 28BYJ-48 stepper — 7 Darlington transistor pairs sink up to 500mA each, status LEDs show active coils. The only driver you need for this motor"
topics: ["[[actuators]]"]
status: needs-test
quantity: 1
voltage: [5]
interfaces: [Digital]
logic_level: "5V (inputs accept 3.3V)"
manufacturer: "Generic"
part_number: "ULN2003APG"
package: "DIP-16 (on breakout board)"
max_current_per_channel: "500mA per Darlington pair"
total_channels: 7
pinout: |
  Breakout board connections:
  IN1 → Arduino digital GPIO (coil 1 - Blue wire)
  IN2 → Arduino digital GPIO (coil 2 - Pink wire)
  IN3 → Arduino digital GPIO (coil 3 - Yellow wire)
  IN4 → Arduino digital GPIO (coil 4 - Orange wire)
  VCC → External 5V supply (motor power)
  GND → Common ground
  Motor connector → 5-pin JST to 28BYJ-48
compatible_with: ["[[28byj-48-5v-unipolar-stepper-motor-with-uln2003-driver]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]"]
used_in: []
warnings: ["Power the motor from external 5V, not Arduino 5V pin — motor draws ~240mA", "ULN2003 is a SINK driver only — it pulls outputs LOW, it does NOT source current", "Only 4 of the 7 channels are used for the 28BYJ-48"]
datasheet_url: "https://www.ti.com/lit/ds/symlink/uln2003a.pdf"
---

# ULN2003APG stepper driver board for 28BYJ-48 at 5V

This is the dedicated driver for the [[28byj-48-5v-unipolar-stepper-motor-with-uln2003-driver]]. The ULN2003A IC contains 7 Darlington transistor pairs, each capable of sinking up to 500mA. For the 28BYJ-48, you only use 4 of the 7 channels — one per coil. The breakout board adds a 5-pin JST motor connector, 4 status LEDs, and header pins for easy breadboard/Arduino connection.

The ULN2003 is a current SINK, not a source. It connects the motor coils to ground when activated. The motor's center tap connects to VCC (5V), and the ULN2003 completes the circuit to ground through each coil sequentially.

## Specifications

| Spec | Value |
|------|-------|
| IC | ULN2003APG (Texas Instruments) |
| Darlington Pairs | 7 (4 used for 28BYJ-48) |
| Max Current | 500mA per channel |
| Max Voltage | 50V (collector-emitter) |
| Input Voltage | 5V (TTL compatible, works with 3.3V too) |
| Built-in Diodes | Yes (suppression diodes on all outputs) |
| Status LEDs | 4 (one per active channel) |
| Motor Connector | 5-pin JST (keyed for 28BYJ-48) |
| Board Size | ~30 x 35mm |

## Step Sequence (Half-Step Mode)

The 28BYJ-48 is driven by energizing coils in sequence. Half-step mode gives 4096 steps per revolution with smoother motion.

| Step | IN1 | IN2 | IN3 | IN4 |
|------|-----|-----|-----|-----|
| 1 | H | L | L | L |
| 2 | H | H | L | L |
| 3 | L | H | L | L |
| 4 | L | H | H | L |
| 5 | L | L | H | L |
| 6 | L | L | H | H |
| 7 | L | L | L | H |
| 8 | H | L | L | H |

## Wiring Notes

- **Motor connector**: The JST connector is keyed — the 28BYJ-48 only plugs in one way. No wiring mistakes possible.
- **Power**: Connect VCC to an external 5V supply (not Arduino 5V pin). The motor draws ~240mA, which is fine for a dedicated supply but risky from the Arduino's regulator.
- **Ground**: Share ground between external supply, Arduino, and ULN2003 board.
- **Logic inputs**: IN1-IN4 connect to any 4 digital GPIO pins on the Arduino. The inputs are TTL-compatible and also work with 3.3V logic (ESP8266, ESP32).
- **Status LEDs**: The 4 LEDs show which coils are active in real time — useful for debugging step sequences.

## Why Not Use a L298N or TB6612 for the 28BYJ-48?

You technically can drive the 28BYJ-48 with an L298N or TB6612, but it's overkill and more complex. The ULN2003 is purpose-built for unipolar steppers:
- Simpler wiring (4 pins + power vs 6+ pins)
- Cheaper
- Perfect current match for the 28BYJ-48's ~240mA draw
- Built-in suppression diodes

The L298N/TB6612 are H-bridge drivers designed for bipolar steppers and DC motors. The 28BYJ-48 is a unipolar stepper that just needs sequential coil grounding — exactly what the ULN2003 does.

---

Related Parts:
- [[28byj-48-5v-unipolar-stepper-motor-with-uln2003-driver]] — the motor this driver is built for
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible controller
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] — compatible controller

Categories:
- [[actuators]]
