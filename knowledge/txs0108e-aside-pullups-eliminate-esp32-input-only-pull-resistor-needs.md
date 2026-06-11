---
title: TXS0108E A-side internal pull-ups eliminate the need for external pull resistors on ESP32 input-only pins receiving level-shifted Hall signals
tags:
  - hardware
  - esp32
  - level-shifter
  - gpio
  - txs0108e
---

# TXS0108E A-side internal pull-ups eliminate the need for external pull resistors on ESP32 input-only pins receiving level-shifted Hall signals

The TXS0108E bidirectional level shifter provides internal A-side pull-up resistors. When using this active level shifter to interface signals (such as Hall sensor outputs) to an ESP32, the A-side pull-ups remove the need for external pull-up resistors on the ESP32's input-only pins (GPIO34-39). 

Even though [[esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors]] normally require external pull resistors to establish a defined idle state, this requirement is satisfied by the TXS0108E's architecture. The active level shifter's one-shot drive combined with its weak pull-up effectively acts as a driven signal source for the ESP32 whenever the B-side is driven. This non-obvious interaction allows GPIO34-39 to be used cleanly without additional components when receiving level-shifted signals.

## References
- [[wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter]]
