---
description: "Simple IR LED transmitter module — outputs 38kHz modulated IR for remote control projects, 3-pin (G/V/S) connector, 3.3V or 5V"
topics: ["[[communication]]"]
status: needs-test
quantity: 2
voltage: [3.3, 5]
interfaces: [GPIO]
logic_level: "3.3V/5V"
manufacturer: "OSEPP"
part_number: "OSEPP-IRF-01"
pinout: |
  G → GND
  V → VCC (3.3-5V)
  S → Signal (digital pin — PWM for 38kHz carrier)
compatible_with: ["[[generic-ir-receiver-module-38khz-demodulator]]", "[[ir-remote-control-handheld-38khz-nec-protocol]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]"]
used_in: []
warnings: ["IR LED has limited range (~1-2m) — for longer range, add a driver transistor and higher-current IR LED", "Must generate 38kHz carrier in software or use IRremote library's send functions"]
datasheet_url: ""
---

# OSEPP IR Transmitter IRF-01 — 38kHz LED Module

A simple IR LED on a breakout board with 3-pin connector. Used to transmit infrared signals — pair it with an IR receiver module to build a wireless link, or use it to clone TV remote signals. The IRremote library handles the 38kHz carrier modulation and protocol encoding (NEC, Sony, RC5, etc.).

## Specifications

| Spec | Value |
|------|-------|
| Wavelength | 940nm (typical IR LED) |
| Carrier Frequency | 38kHz (generated in software) |
| Operating Voltage | 3.3-5V |
| Connector | 3-pin (G/V/S) |
| Range | ~1-2m (depends on LED current and ambient light) |

## Wiring

| IRF-01 | Arduino |
|--------|---------|
| S | PWM pin (e.g. D3) |
| V | 5V |
| G | GND |

**Library:** `IRremote` — use `IrSender.sendNEC()` or similar protocol functions.

---

Related Parts:
- [[generic-ir-receiver-module-38khz-demodulator]] — the receiving end of the link
- [[ir-remote-control-handheld-38khz-nec-protocol]] — can clone this remote's signals

Categories:
- [[communication]]
