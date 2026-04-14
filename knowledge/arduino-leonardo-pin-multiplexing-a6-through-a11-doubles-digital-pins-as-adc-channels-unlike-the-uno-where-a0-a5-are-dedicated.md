---
description: "The Arduino Leonardo gives you 12 analog input channels (A0-A11) but A6-A11 are multiplexed with digital pins D4/D6/D8/D9/D10/D12 — meaning you cannot use both roles simultaneously on the same pin, which breaks naive shield pinout assumptions that worked on the Uno's dedicated A0-A5"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
---

# Arduino Leonardo pin multiplexing A6-A11 doubles digital pins as ADC channels, unlike the Uno where A0-A5 are dedicated

The Arduino Leonardo exposes 12 analog input channels vs the Uno's 6, but 6 of those 12 are physically shared with digital pins:

| Analog name | Shares with | Notes |
|-------------|-------------|-------|
| A0-A5 | (dedicated) | Same as Uno — analog-only |
| A6 | D4 | Shared pin |
| A7 | D6 | Shared pin (also PWM) |
| A8 | D8 | Shared pin |
| A9 | D9 | Shared pin (also PWM) |
| A10 | D10 | Shared pin (also PWM) |
| A11 | D12 | Shared pin |

**Why this matters:**
- You cannot use D6 as a PWM output AND A7 as an analog input simultaneously — they're the same physical pin
- Shield designs that assume Uno's pinout (A0-A5 dedicated, D0-D13 separate) may conflict when used on a Leonardo if the shield drives both a digital pin and "extra" analog pin
- Sketch code that `analogRead(A7)` on a Leonardo is really `analogRead(pin 6)` — the pin mode switches the ADC mux to that pin

**The design bet Arduino made:**
The ATmega32u4 has more internal ADC channels than package pins, so Arduino routed the spare channels to existing digital pins rather than creating new pin headers. This kept the Leonardo pin-for-pin shield-compatible with Uno mechanically, even though the electrical routing differs.

**Practical rule when porting Uno sketches to Leonardo:**
- A0-A5 analog reads work identically
- A6-A11 analog reads only work if nothing else is claiming that digital pin
- Serial (D0/D1), I2C on Leonardo moves to D2/D3 (not A4/A5 like Uno) — a different gotcha from this one but often triggers together

---

Source: [[docs_and_data]]

Relevant Notes:
- [[arduino-leonardo-atmega32u4-native-usb-enables-hid-keyboard-mouse-emulation-that-arduino-uno-cannot-do-without-hacking]] — the broader architectural distinction

Topics:
- [[microcontrollers]]
