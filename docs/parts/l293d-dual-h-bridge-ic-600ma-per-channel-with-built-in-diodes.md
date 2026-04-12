---
description: "Discrete motor driver IC for breadboard prototyping — 600mA/ch with built-in clamp diodes (unlike L298N), DIP-16 package. Use when you want motor control without a shield"
topics: ["[[actuators]]", "[[passives]]"]
status: needs-test
quantity: 2
voltage: [5]
interfaces: [Digital, PWM]
logic_level: "5V"
manufacturer: "Texas Instruments"
part_number: "L293D"
package: "DIP-16"
max_current_per_channel: "600mA continuous, 1.2A peak"
motor_supply_voltage: "4.5-36V"
pinout: |
  DIP-16 (top view, notch left):
  Pin 1  → Enable 1,2 (EN12) — PWM speed control, channels 1&2
  Pin 2  → Input 1 (1A) — direction control
  Pin 3  → Output 1 (1Y) — motor A terminal 1
  Pin 4  → GND (heat sink)
  Pin 5  → GND (heat sink)
  Pin 6  → Output 2 (2Y) — motor A terminal 2
  Pin 7  → Input 2 (2A) — direction control
  Pin 8  → VCC2 (VS) — motor supply (4.5-36V)
  Pin 9  → Enable 3,4 (EN34) — PWM speed control, channels 3&4
  Pin 10 → Input 3 (3A) — direction control
  Pin 11 → Output 3 (3Y) — motor B terminal 1
  Pin 12 → GND (heat sink)
  Pin 13 → GND (heat sink)
  Pin 14 → Output 4 (4Y) — motor B terminal 2
  Pin 15 → Input 4 (4A) — direction control
  Pin 16 → VCC1 (VSS) — logic supply (5V)
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]"]
used_in: []
warnings: ["600mA continuous per channel — check your motor's stall current", "4 GND pins (4,5,12,13) also serve as heatsink — solder ALL of them, leave none floating", "Voltage drop ~1.4V per direction (2.8V total) — a 6V motor gets ~3.2V"]
datasheet_url: "https://www.ti.com/lit/ds/symlink/l293d.pdf"
---

# L293D dual H-bridge IC 600mA per channel with built-in diodes

The L293D is the breadboard-friendly motor driver. DIP-16 package, built-in flyback clamp diodes, and straightforward pin-per-function layout. Pop it in a breadboard, wire up your Arduino, and you've got bidirectional control of 2 DC motors without any external components (unlike the L298N which needs external diodes).

The "D" suffix is critical — the L293 (without D) has NO built-in diodes and requires external protection. The L293D has them integrated, which is why it's the standard for hobby projects.

The trade-off vs the [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]]: less current (600mA vs 2A) but simpler wiring (no external diodes needed). The trade-off vs the [[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]]: less current and lower efficiency, but it's a bare IC you can put anywhere on a breadboard.

## Specifications

| Spec | Value |
|------|-------|
| Type | Dual H-bridge motor driver |
| Package | DIP-16 |
| Motor Supply (VCC2/VS) | 4.5-36V |
| Logic Supply (VCC1/VSS) | 5V |
| Output Current (continuous) | 600mA per channel |
| Output Current (peak) | 1.2A per channel |
| Voltage Drop | ~1.4V per switch (~2.8V total path) |
| Built-in Diodes | YES (clamp diodes on all outputs) |
| Input Logic HIGH | 2.3V min |
| Input Logic LOW | 1.5V max |
| Operating Temp | 0 to 70C |

## Pinout Diagram

```
           +----[notch]----+
  EN12  1  |               | 16  VCC1 (5V logic)
  1A    2  |               | 15  4A
  1Y    3  |               | 14  4Y
  GND   4  |    L293D      | 13  GND
  GND   5  |               | 12  GND
  2Y    6  |               | 11  3Y
  2A    7  |               | 10  3A
  VCC2  8  |               | 9   EN34
           +---------------+
```

## Motor Control Truth Table

| EN | IN (A) | Motor Output |
|----|--------|-------------|
| H  | H      | Output HIGH (VCC2 - Vdrop) |
| H  | L      | Output LOW (GND + Vdrop) |
| L  | X      | High impedance (disconnected) |

For bidirectional control of one motor:
| EN12 | 1A | 2A | Motor |
|------|----|----|-------|
| H | H | L | Forward |
| H | L | H | Reverse |
| H | H | H | Brake |
| H | L | L | Coast |
| L | X | X | Off |

## Wiring Notes

- **VCC1 (pin 16)**: Connect to Arduino 5V. This powers the logic.
- **VCC2 (pin 8)**: Connect to motor supply (battery). This powers the motors. Can be same as VCC1 for 5V motors.
- **All 4 GND pins (4, 5, 12, 13)**: Connect ALL to ground. These pins also dissipate heat through the PCB — leaving any unconnected reduces thermal capacity.
- **Enable pins (EN12, EN34)**: Connect to Arduino PWM pins for speed control, or tie to 5V for full speed.
- **Input pins (1A, 2A, 3A, 4A)**: Connect to Arduino digital pins for direction control.
- **100nF ceramic cap** between VCC1 and GND, and between VCC2 and GND — close to the IC.

## Thermal Management — Ground Pins as Heat Sinks

The 4 ground pins (4, 5, 12, 13) are not just electrical connections — they are the primary thermal dissipation path for the IC. The L293D's die is bonded to the ground lead frame, and these pins conduct heat out of the package.

**On a breadboard:** Connect all 4 GND pins. Even on a breadboard, connecting all 4 reduces junction temperature.

**On a PCB:** Solder all 4 GND pins to a large ground copper pour. The more copper area connected to these pins, the more heat the IC can dissipate. TI's datasheet recommends a minimum of 6 square inches of copper connected to the ground pins for the full 600mA rating. Without adequate copper, derate the current.

**Thermal limits:** The L293D is rated 0-70C ambient. At 600mA per channel with a 12V motor supply, the IC dissipates approximately 600mA x 2.8V (total drop) = 1.68W per channel, 3.36W for both. Without a good thermal path through the ground pins, junction temperature rises fast.

## L293D vs L298N — When to Use Which

| Need | Use |
|------|-----|
| Breadboard prototyping | L293D — DIP package, simple |
| Motors under 600mA | L293D — simpler, built-in diodes |
| Motors 600mA to 2A | L298N — higher current |
| No external diodes | L293D — they're built in |
| Higher efficiency | Neither — use TB6612FNG |
| PCB space is tight | L293D — smaller DIP-16 vs Multiwatt15 |

---

Related Parts:
- [[dk-electronics-hw-130-motor-shield-uses-l293d-at-600ma]] — shield that uses this IC
- [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]] — higher current, no built-in diodes
- [[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]] — MOSFET-based, more efficient
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible controller

Categories:
- [[actuators]]
- [[passives]]
