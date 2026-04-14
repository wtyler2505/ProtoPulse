---
description: "RS-485/422 uses differential signaling over a twisted pair to reject common-mode noise and drive reliably over hundreds of meters, which is why it's the standard for industrial control buses (PTZ camera control, Modbus, DMX) where single-ended UART or SPI would be useless"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[communication]]"
---

# RS-485 differential signaling survives long cable runs and electrical noise where single-ended serial would fail

RS-485 (and its sibling RS-422) transmits data as the difference between two wires of a twisted pair rather than as a voltage against a common ground. This is the key architectural distinction from RS-232, UART, SPI, or I2C — all of which are single-ended.

What differential signaling buys you:
- **Common-mode noise rejection** — noise picked up on the cable appears equally on both wires and cancels at the differential receiver
- **Long cable runs** — RS-485 reliably goes ~1200m (4000ft) at lower data rates; single-ended serial struggles past ~15m
- **Multi-drop buses** — RS-485 supports up to 32 (or 128 with modern drivers) transceivers on one bus
- **Ground-potential tolerance** — differential receivers tolerate substantial ground-voltage differences between endpoints, which is normal in industrial buildings

RS-422 is the point-to-point / multi-drop-receiver variant; RS-485 is the true multi-drop with driver tri-state control. Electrically and pin-wise they're compatible and many devices support both modes.

Termination matters. At cable lengths approaching a wavelength of the signal, you need 120Ω termination resistors at both ends to prevent reflections. Long, unterminated RS-485 buses appear to work until a baud rate change or cable length change starts corrupting data.

Classic applications:
- **PTZ camera control** (Pelco-D, Pelco-P over RS-485)
- **Modbus RTU** — industrial control
- **DMX512** — stage lighting
- **RS-485 IO expanders**, HVAC, solar inverter buses

---

Source: [[docs_and_data]]

Relevant Notes:
- [[differential-twisted-pair-rejects-common-mode-noise-that-single-ended-wiring-picks-up]] — the underlying electrical principle
- [[poe-802-3af-delivers-power-and-data-over-one-ethernet-cable-eliminating-a-separate-power-run-at-the-cost-of-a-poe-capable-switch]] — alternative long-run network topology

Topics:
- [[communication]]
