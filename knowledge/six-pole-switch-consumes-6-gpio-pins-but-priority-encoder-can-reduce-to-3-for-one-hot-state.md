---
description: "A 6-position radio-button switch needs 6 GPIO pins (one per pole) for direct reading, but since only one pole is active at any time (one-hot encoding), a 74HC148 priority encoder can reduce this to 3 binary output pins — trading pin count for one additional IC"
type: knowledge
topics:
  - "[[input-devices]]"
source: "[[toneluck-6-way-self-locking-push-button-switch-18-pin]]"
---

# Six-pole switch consumes 6 GPIO pins but priority encoder can reduce to 3 for one-hot state

The Toneluck 6-way switch's radio-button behavior guarantees exactly one pole is active at any time. This one-hot property enables efficient encoding:

**Direct reading (6 pins):**
- Each pole connects to one GPIO pin with pull-up
- Active pole reads LOW, all others HIGH
- Simple code: `for (i=0; i<6; i++) if (!digitalRead(pin[i])) mode = i;`
- Advantage: trivial code, immediate reading
- Disadvantage: 6 pins consumed

**Priority encoder (3 pins):**
- 74HC148: 8-line to 3-line priority encoder IC
- 6 switch outputs → 6 inputs of 74HC148
- 3 binary outputs → 3 MCU GPIO pins
- Active input encoded as 3-bit binary (0-5)
- Advantage: 3 pins instead of 6 (50% reduction)
- Disadvantage: additional IC, harder to debug, inverted outputs on most 74HC148 variants

**Alternative: Resistor ladder (1 analog pin):**
- Different value resistors on each pole
- All feed a common analog input
- Read ADC to determine which pole is active
- Advantage: 1 pin
- Disadvantage: ADC noise sensitivity, threshold calibration needed

**Decision factors:**
- Pin-rich MCU (Mega, ESP32): Direct 6-pin reading — simplicity wins
- Pin-constrained (Uno with other peripherals): Priority encoder
- Extremely constrained (ESP8266): Resistor ladder to analog pin

---

Topics:
- [[input-devices]]

Related:
- [[self-locking-radio-button-switch-provides-hardware-mutual-exclusion-eliminating-software-mode-conflict-logic]]
- [[4x4-matrix-keypad-consumes-8-gpio-pins-making-io-expander-mandatory-on-pin-constrained-mcus]]
- [[esp8266-has-only-5-truly-safe-gpio-out-of-11-total-pins]]
