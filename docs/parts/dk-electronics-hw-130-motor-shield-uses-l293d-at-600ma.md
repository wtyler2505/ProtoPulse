---
description: "Budget 4-motor shield using L293D — 600mA per channel is enough for small DC motors and the 28BYJ-48 stepper, but don't push it with anything beefier"
topics: ["[[actuators]]", "[[shields]]"]
status: needs-test
quantity: 4
voltage: [5]
interfaces: [PWM, Digital]
logic_level: "5V"
manufacturer: "DK Electronics"
part_number: "HW-130"
driver_ic: "L293D"
max_current_per_channel: "600mA continuous, 1.2A peak"
motor_supply_voltage: "4.5-25V"
pinout: |
  Arduino shield format (stacks on Uno/Mega):
  4 motor channels (M1-M4) via L293D:
    M1/M2 → L293D chip 1
    M3/M4 → L293D chip 2
  PWM speed control via Arduino PWM pins
  Direction control via shift register (74HC595)
  Servo headers (optional, directly from Arduino PWM pins)
  External motor power terminal
compatible_with: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]]"]
used_in: []
warnings: ["600mA per channel is the hard limit — most DC motors stall above this", "Some clones use counterfeit L293D chips with even lower current ratings", "Uses many Arduino pins — check which pins are consumed before stacking other shields"]
datasheet_url: ""
---

# DK Electronics HW-130 Motor Shield uses L293D at 600mA

The cheapest motor shield in the inventory and you have 4 of them. Uses L293D dual H-bridge ICs to drive up to 4 DC motors (or 2 steppers) simultaneously. The L293D has built-in flyback diodes, so no external diodes needed — that's its one advantage over the L298N.

The catch is the 600mA per channel current limit. That's enough for small hobby motors and the [[28byj-48-5v-unipolar-stepper-motor-with-uln2003-driver]], but most DC motors stall above 600mA. If your motor stalls against a load, it'll try to draw stall current and the L293D will overheat or shut down.

For anything drawing more than 600mA, use the [[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]] (1.2A) or [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]] (2A).

## Specifications

| Spec | Value |
|------|-------|
| Driver IC | L293D (x2) |
| Motor Channels | 4 DC motors or 2 steppers |
| Motor Supply | 4.5-25V (external) |
| Logic Supply | 5V (from Arduino) |
| Output Current | 600mA per channel continuous |
| Peak Current | 1.2A per channel |
| Flyback Diodes | Built-in (L293D includes them) |
| Direction Control | 74HC595 shift register |
| Form Factor | Arduino shield (stackable) |

## Pin Usage

The HW-130 uses a 74HC595 shift register to control motor direction, which saves Arduino pins compared to direct-drive shields. Speed control still requires PWM pins.

| Function | Arduino Pin | Notes |
|----------|-------------|-------|
| Shift Register Data | D8 | 74HC595 SER |
| Shift Register Clock | D4 | 74HC595 SRCLK |
| Shift Register Latch | D12 | 74HC595 RCLK |
| M1 Speed (PWM) | D11 | Timer2 |
| M2 Speed (PWM) | D3 | Timer2 |
| M3 Speed (PWM) | D6 | Timer0 |
| M4 Speed (PWM) | D5 | Timer0 |

**Pin conflict warning**: This shield uses D3, D4, D5, D6, D8, D11, D12 — that's 7 pins consumed. On an Uno, that leaves very few pins for sensors. On a Mega, less of an issue.

## Wiring Notes

- **External power**: Connect motor supply (7-12V typical) to the external power terminal. There's usually a jumper to separate motor power from Arduino power.
- **Adafruit Motor Shield library**: The HW-130 is a clone of the Adafruit Motor Shield V1 and uses the same `AFMotor` library.
- **Stacking**: With 4 of these, you could theoretically stack them, but pin conflicts make that impractical without modification. Each shield uses the same pins.

## Warnings

- 600mA is genuinely low — test your motors' stall current before committing to this shield.
- Clone quality varies. Some boards use counterfeit L293D chips with lower actual current capacity.
- The shift register adds a small delay to direction changes — not noticeable for most applications but matters for high-frequency switching.

---

Related Parts:
- [[l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes]] — the bare IC this shield uses
- [[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]] — better driver, higher current, more efficient
- [[osepp-motor-servo-shield-v1-drives-2-dc-motors-plus-servos]] — L298N-based alternative with servo headers
- [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]] — higher current standalone module
- [[f130s-small-dc-motor-3-5v-130-can-size]] — small DC motor well within 600mA limit of this shield
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — primary host board (Uno shield form factor)
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible controller, more pins available
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — Mega clone, same compatibility
- [[osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v]] — Uno clone, shield fits directly

Categories:
- [[actuators]]
- [[shields]]
