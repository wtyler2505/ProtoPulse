---
description: Arduino shields, breakout boards, and expansion modules that stack or attach to dev boards
type: moc
---

# shields

Boards that extend development board capabilities — motor shields, sensor shields, proto shields, ethernet shields.

## Parts

| Part | Compatible With | Function | Pins Used | Status | Qty |
|------|----------------|----------|-----------|--------|-----|
| [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] | Arduino Mega, hoverboard motors | BLDC motor control | 4 digital + 1 PWM + 1 interrupt | verified | 2 |
| [[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]] | Arduino Uno/Mega | DC motor drive (1.2A/ch, MOSFET) | PWM + direction pins | needs-test | 1 |
| [[osepp-motor-servo-shield-v1-drives-2-dc-motors-plus-servos]] | Arduino Uno/Mega | DC motor + servo drive (2A/ch) | PWM + direction + servo pins | needs-test | 1 |
| [[dk-electronics-hw-130-motor-shield-uses-l293d-at-600ma]] | Arduino Uno/Mega | 4-motor drive (600mA/ch) | D3,D4,D5,D6,D8,D11,D12 | needs-test | 4 |
| [[velleman-pka042-ethernet-shield-w5100-for-arduino]] | Arduino Uno/Mega | Ethernet + SD | SPI (ICSP) + D10 + D4 | needs-test | 1 |
| [[2p8-inch-tft-lcd-touch-shield-ili9341-320x240-spi]] | Arduino Uno/Mega | Color TFT + Touch | SPI + analog + D8-D10 | needs-test | 1 |
| [[osepp-sensor-shield-3-pin-breakout-for-arduino-uno]] | Arduino Uno | I/O breakout | All pins (passthrough) | needs-test | 1 |
| [[sainsmart-mega-sensor-shield-v2-3-pin-breakout]] | Arduino Mega | I/O breakout | All pins (passthrough) | needs-test | 1 |
| [[arduino-mega-proto-shield-v3-solder-pad-board]] | Arduino Mega | Prototyping | All pins (passthrough) | needs-test | 1 |
| [[txs0108e-8-channel-bidirectional-level-shifter-auto-direction]] | ESP32, 5V devices | 8-ch level shift (auto-direction) | 3 (VCCA, VCCB, GND) + 8 signal pairs | needs-test | 1 |
| [[hw-221-8-channel-bidirectional-level-shifter-bss138-based]] | ESP32, I2C devices | 8-ch level shift (BSS138, I2C-safe) | 3 (LV, HV, GND) + 8 signal pairs | needs-test | 2 |

## Pin Conflict Warnings

(Track which shields use which pins — stacking shields can cause pin conflicts)

---

Categories:
- [[index]]
