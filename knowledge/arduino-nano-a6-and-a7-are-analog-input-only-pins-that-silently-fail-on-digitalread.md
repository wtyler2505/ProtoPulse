---
description: "The Nano's A6 and A7 connect only to the ADC multiplexer -- digitalRead/digitalWrite compiles without error but returns garbage or does nothing"
type: claim
source: "docs/parts/arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components:
  - "arduino-nano-v3"
  - "dccduino-nano"
---

# Arduino Nano A6 and A7 are analog-input-only pins that silently fail on digitalRead

The Arduino Nano has 8 analog pins (A0-A7) versus the Uno's 6 (A0-A5). The two extra pins -- A6 and A7 -- are wired differently inside the ATmega328P: they connect only to the ADC multiplexer, not to the digital pin register (PORTx/DDRx/PINx). This is a hardware limitation of the chip package, not a software choice.

The dangerous part is that `digitalRead(A6)` and `digitalWrite(A6)` compile without error. The Arduino core maps A6/A7 to pin numbers (20/21), and the compiler has no type-level distinction between "analog-capable pin" and "digital-capable pin." The result:

- `digitalRead(A6)` returns unpredictable values (not a clean HIGH/LOW from whatever is connected)
- `digitalWrite(A6, HIGH)` does nothing -- no output driver exists on that pin
- `pinMode(A6, INPUT_PULLUP)` compiles but the internal pull-up is not connected

This is a silent failure mode. Code ported from an Uno sketch that uses A0-A5 as digital pins works fine on the Nano. But a beginner who sees two "extra" analog pins and tries to use them as digital I/O gets mysterious behavior with no error message.

**ProtoPulse DRC implication:** When a circuit schematic shows A6 or A7 connected to a digital signal source (button, digital sensor) or digital output load (LED, relay), the ERC engine should flag it. This is the same class of silent-failure pin restriction as the ESP8266's GPIO9/GPIO10 flash pins or GPIO16's missing PWM capability -- the pin exists but doesn't support the intended function, and the toolchain won't tell you.

---

Relevant Notes:
- [[esp8266-has-only-5-truly-safe-gpio-out-of-11-total-pins]] -- same pattern: pins that exist but don't support expected operations
- [[esp8266-gpio9-and-gpio10-are-flash-connected-and-crash-if-used-as-gpio]] -- GPIO9/10 are even worse: they crash, not just fail silently
- [[uno-i2c-on-a4-a5-consumes-one-third-of-analog-inputs]] -- A4/A5 dual-use tradeoff on the same MCU

Topics:
- [[microcontrollers]]
- [[eda-fundamentals]]
