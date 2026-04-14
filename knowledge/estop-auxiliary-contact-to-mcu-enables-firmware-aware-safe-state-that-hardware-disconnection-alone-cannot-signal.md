---
description: "An e-stop with an auxiliary NC signal contact feeds a GPIO interrupt so firmware can distinguish a deliberate e-stop event from a power glitch, letting it enter a safe state, save logs, and require a deliberate restart sequence instead of auto-resuming when power returns"
type: claim
created: 2026-04-14
source: "docs/parts/wiring-36v-battery-power-distribution-4-tier-system.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components:
  - "esp32"
  - "schneider-xb5as"
---

# E-STOP auxiliary contact to MCU enables firmware-aware safe state that hardware disconnection alone cannot signal

A pure-hardware e-stop is correct and essential -- [[twist-to-release-estop-prevents-accidental-restart-after-emergency-shutdown]] -- but it leaves the firmware completely unaware of the event. When power cuts and eventually returns, the MCU boots fresh with no memory of why it lost power. It cannot distinguish between a deliberate e-stop, a main fuse blowing, a loose terminal, or a BMS trip. All four look like a cold boot.

Adding an auxiliary NC contact on the e-stop switch fixes this. The aux contact is independent of the main power contacts -- it carries a signal, not power -- and it connects through a pull-up/pull-down to an ESP32 GPIO configured as an interrupt input. When the e-stop is pressed, the aux contact opens, the GPIO transitions, and the firmware gets milliseconds of notification before the main contactor opens and power starts dropping.

In that brief window, interrupt-service code can: (1) set a "safe shutdown requested" flag in non-volatile storage, (2) command motor controllers to brake rather than coast, (3) save position estimates and mission state, (4) send a last-gasp MQTT or WebSocket notification, (5) write a log entry explaining why this session ended. On the next boot, firmware reads the flag and requires a deliberate operator action (button press, app confirmation) before resuming operations, rather than auto-starting and potentially re-triggering whatever caused the e-stop.

The signal circuit is trivial: 10K pull-up to 3.3V, NC aux contact to GND, GPIO reads high normally and goes low on e-stop press. A 10K pull-down to GND on the MCU side prevents floating when the e-stop's aux contact is open (pressed state) and the switch is physically disconnected. The signal current is microamps -- no arc risk, no contactor needed.

This is the software-hardware safety layering principle in action. The hardware e-stop guarantees power cuts regardless of firmware state. The firmware signal path guarantees the cut is observable and logged. Neither replaces the other. A pure-software e-stop fails when firmware hangs (the hardware must handle it). A pure-hardware e-stop fails to provide diagnostics (the firmware must observe it). Both together form a complete safety system.

---

Source: [[wiring-36v-battery-power-distribution-4-tier-system]]

Relevant Notes:
- [[twist-to-release-estop-prevents-accidental-restart-after-emergency-shutdown]] -- the mechanical latch that this signal reports on
- [[two-stage-estop-separates-control-circuit-from-power-circuit-for-safe-high-current-interruption]] -- the aux contact is a third independent circuit alongside control and power
- [[bms-discharge-port-is-the-sole-power-output-so-a-bms-trip-kills-the-mcu-along-with-the-motors]] -- explains why aux-signaled shutdown is the only way to get diagnostic logging

Topics:
- [[power-systems]]
- [[microcontrollers]]
- [[eda-fundamentals]]
