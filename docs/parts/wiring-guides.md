---
description: Index of all wiring guides — connection recipes between specific components
type: moc
---

# wiring-guides

How to connect component A to component B. Each guide includes pin mappings, level shifting requirements, pull-up resistors, power supply notes, and a minimal code example.

## Guides

| Guide | Parts Involved | Voltage Tiers | Status |
|-------|---------------|--------------|--------|
| [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]] | Arduino Mega + ZS-X11H + BLDC Motor | 5V, 36V | verified |
| [[wiring-dual-zs-x11h-for-hoverboard-robot]] | Arduino Mega + 2x ZS-X11H + 2x BLDC Motor | 5V, 36V | verified |
| [[wiring-zs-x11h-to-esp32-with-level-shifter]] | ESP32 + ZS-X11H + Level Shifter | 3.3V, 5V, 36V | needs-test |
| [[wiring-nodemcu-esp32-to-4x-zs-x11h-for-4wd-rover]] | ESP32 + 4x ZS-X11H + 74HC14 Buffer | 3.3V, 5V, 36V | needs-test |
| [[wiring-36v-battery-power-distribution-4-tier-system]] | 36V Battery + LM2596 regulators | 3.3V, 5V, 12V, 36V | needs-test |
| [[wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter]] | ESP32 + TXS0108E + RioRand ZS-X11H | 3.3V, 5V | needs-test |
| [[wiring-i2c-multi-device-bus-compass-imu-current-sensor]] | BNO055 + INA219 + Compass + MCU | 3.3V, 5V | needs-test |

## Common Patterns

- Level shifting (3.3V ↔ 5V) — see [[txs0108e-8-channel-bidirectional-level-shifter-auto-direction]] and [[hw-221-8-channel-bidirectional-level-shifter-bss138-based]]
- I2C bus wiring — see [[wiring-i2c-multi-device-bus-compass-imu-current-sensor]] for address management and pull-up sizing
- Motor drive patterns — see motor control wiring guides above

---

Categories:
- [[index]]
