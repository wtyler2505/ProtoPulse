---
description: "Hall Temp is a fourth level-shifted channel available on many BLDC controllers that provides motor thermal monitoring through the same 5V-to-3.3V path as the Hall position signals."
type: claim
source: "wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter"
confidence: open
topics:
  - "[[actuators]]"
  - "[[shields]]"
related_components:
  - "txs0108e-level-shifter"
  - "esp32"
---

# Hall Temp output is a fourth level-shifted channel available on many BLDC controllers that provides motor thermal monitoring through the same 5V-to-3.3V path as the Hall position signals

When wiring a BLDC motor controller's Hall sensor outputs to a 3.3V microcontroller (like an ESP32), the standard assumption is to budget three channels for the A, B, and C position signals. However, many controllers also expose a fourth signal on the Hall header: Hall Temp (or simply Temp).

This signal is often routed through the same 5V-to-3.3V level-shifting path (e.g., using a TXS0108E) as the position signals. The controller uses the thermistor embedded in the motor to provide a signal indicating motor temperature. When passed through a level shifter, this allows the MCU to monitor motor thermal states without requiring a completely separate wiring path.

Because this feature is not universal, it requires verification per controller part to understand the signal format (analog vs digital, scaling). If it is a digital over-temp trip signal, it can be read directly via a standard digital GPIO on the 3.3V MCU. If it is an analog voltage representing temperature, routing it through a digital-only level shifter like the TXS0108E will corrupt the analog reading, meaning it must be bypassed or routed through an analog-compatible voltage divider instead.

This highlights a common design oversight: leaving a fourth level-shifter channel unused while adding a completely separate thermal protection circuit, when the controller might already provide the signal right next to the Hall lines.

---

Source: [[wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter]]

Relevant Notes:
- [[bldc-controller-hall-sensor-outputs-are-push-pull-digital-making-txs-class-shifters-the-correct-bridge-to-3v3-mcus]] - Details why TXS shifters are used for the other Hall signals on this header.
- [[wiring-zs-x11h-to-esp32-with-level-shifter]] - Example of BLDC controller wiring which may involve these signals.

Topics:
- [[actuators]]
- [[shields]]