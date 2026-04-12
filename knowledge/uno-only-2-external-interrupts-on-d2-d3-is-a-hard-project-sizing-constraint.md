---
description: "INT0 on D2 and INT1 on D3 are the only external interrupt pins -- projects needing encoder feedback, wake-on-motion, and button interrupts simultaneously outgrow the Uno"
type: claim
source: "docs/parts/arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# Uno has only 2 external interrupts on D2 and D3 which is a hard project-sizing constraint

The ATmega328P provides exactly 2 external interrupt pins: INT0 (D2) and INT1 (D3). These are the only pins that can trigger an ISR (Interrupt Service Routine) on rising edge, falling edge, or level change without polling. Pin-change interrupts (PCINT) exist on other pins but share interrupt vectors, making them harder to use and more limited.

Two interrupts sounds adequate until you start a real project. A rotary encoder needs both interrupts for quadrature decoding. An accelerometer interrupt (tap/free-fall detection) needs one. A button debounce interrupt needs one. An ultrasonic echo pin works best with a timing interrupt. Any two of these requirements together exhaust the Uno's interrupt capacity.

The Mega offers 6 external interrupts (INT0-INT5 on D2, D3, D18, D19, D20, D21). The ESP32 can trigger interrupts on any GPIO pin. The Uno's 2-interrupt limit is often the second bottleneck beginners hit (after the single UART), and like the UART constraint, it's a hard sizing limit that determines whether the project needs a board upgrade.

**ProtoPulse DRC rule:** Count interrupt-requiring devices in the BOM (encoders, IMU interrupt pins, button interrupts). If count > 2 on an Uno, flag it as exceeding the board's interrupt capacity.

---

Relevant Notes:
- [[uno-single-uart-shared-with-usb-forces-choose-one-between-debugging-and-peripherals]] -- UART and interrupts are the two hard constraints that drive Uno-to-Mega upgrades
- [[mega-2560-four-hardware-uarts]] -- Mega also has 6 interrupts, solving both bottlenecks

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
