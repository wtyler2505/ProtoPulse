---
description: "The BMS discharge port feeds the entire downstream power tree -- motor bus, buck converters, and MCU -- so an overcurrent or undervoltage trip cuts power to the ESP32 before firmware can log the event, which is intentional safety behavior but removes the possibility of a graceful shutdown"
type: claim
created: 2026-04-14
source: "docs/parts/wiring-36v-battery-power-distribution-4-tier-system.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "hoverboard-10s-battery-pack"
  - "esp32"
---

# BMS discharge port is the sole power output so a BMS trip kills the MCU along with the motors

A 10S lithium-ion pack's BMS has exactly one output path: the discharge port. Everything downstream -- the motor controllers, the 12V buck converter, the 5V buck converter feeding the ESP32 -- hangs off that single port. When the BMS trips for any of its protection triggers (overcurrent, undervoltage, short circuit, over-temperature), it disconnects the entire pack from the load. All power cuts simultaneously.

This is intentional safety behavior, not a design flaw. The BMS cannot selectively disconnect "just the motors while keeping the MCU alive" because it has no knowledge of which downstream consumer caused the fault. A stalled motor drawing 50A and a dead short both look like overcurrent to the BMS. The conservative action is to kill everything.

The consequence: any protection event becomes a hard power-off from the MCU's perspective. There is no time to finish writing a log entry, close a file, flush a sensor buffer, or send a "goodbye" MQTT message. The ESP32 just dies mid-instruction, same as if the battery physically disconnected. Code that assumes a graceful shutdown path is running on borrowed time.

The design implication: anything that must survive a BMS trip must be non-volatile. Mission-critical state belongs in flash, not RAM. Sensor calibrations, position estimates, mission checkpoints -- if it can't be reconstructed from stored state plus a fresh boot, it will be lost. This is the same reasoning as [[persistent-state-must-tolerate-power-loss-at-any-instruction]] but enforced by battery hardware rather than software choice.

A second-order consequence: the MCU cannot detect "clean BMS trip" vs "battery disconnected" vs "loose main fuse." All three look identical from the firmware side: power was there, now it isn't. Diagnostic distinctions require a separate backup supply (coin cell RTC, supercap) to keep a minimal microcontroller alive long enough to log the event. Most rover designs don't bother -- but the limitation is worth knowing before debugging mysterious unexplained resets.

---

Source: [[wiring-36v-battery-power-distribution-4-tier-system]]

Relevant Notes:
- [[salvaged-bms-has-unknown-thresholds-and-must-be-verified-before-trusting-with-project-safety]] -- compounds the problem: unknown trip points mean unpredictable kill events
- [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]] -- firmware limiting prevents BMS trips that would kill the firmware itself
- [[parallel-power-rails-from-battery-are-more-reliable-than-cascaded-regulators]] -- parallel topology does not help here because the common point is upstream of any regulator

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
