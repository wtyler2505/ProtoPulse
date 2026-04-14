---
description: "BLDC motor controllers like the RioRand ZS-X11H buffer the raw Hall-sensor lines through active digital logic and output push-pull 5V signals — not open-drain — which means bridging those outputs to a 3.3V MCU requires a TXS-class active shifter rather than the BSS138-class pull-up shifter typically used for I2C, and the topology of the downstream signal (not the upstream sensor) drives the choice"
type: claim
source: "docs/parts/txs0108e-8-channel-bidirectional-level-shifter-auto-direction.md"
confidence: proven
topics:
  - "[[shields]]"
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
related_components:
  - "txs0108e-level-shifter"
  - "riorand-zs-x11h"
  - "hoverboard-bldc-motor"
---

# BLDC controller Hall sensor outputs are push-pull digital making TXS-class shifters the correct bridge to 3.3V MCUs

The beginner mental model for Hall-sensor wiring is "Hall sensors are open-collector, so I need pull-ups and a slow shifter is fine." This is correct for raw Hall chips wired directly ([[hall-sensor-open-collector-outputs-need-pull-up-resistors-and-produce-gray-code-not-binary-position]]). It is wrong once a BLDC motor controller sits between the raw sensor and the MCU, because the controller does not pass the Hall signals through transparently — it buffers them through active logic and outputs push-pull digital.

**What actually leaves a controller like the RioRand ZS-X11H:** the controller's Hall inputs (Hall-A, Hall-B, Hall-C, plus sometimes a temp channel) feed into an on-board MCU or logic block that uses the sensor state for commutation. The signals exposed on the controller's external Hall connector are regenerated as clean push-pull outputs — the controller drives them HIGH through an active transistor and LOW through another. There is no pull-up resistor involved on the exposed side. The signal looks like a push-pull digital output because that is what it is.

**Consequence for level shifter selection:** since [[signal-topology-not-voltage-alone-determines-level-shifter-selection]], a push-pull 5V output going to a 3.3V MCU input selects for an active auto-direction shifter (TXS0108E) or a unidirectional buffer (74HCT245), NOT a BSS138-based shifter. The Hall signals also arrive at kart-motor commutation rates (hundreds of Hz to low kHz per pole pair, multiplied by pole-pair count), which is within BSS138's 400kHz envelope — but the topology mismatch is the deciding issue, not the speed. [[bss138-switching-speed-caps-at-400khz-making-it-unsuitable-for-fast-spi-and-high-speed-push-pull-signals]] explains why BSS138 degrades push-pull rising edges even within its speed envelope.

**Why unidirectional isn't enough here:** a 74HCT245 buffer would work electrically (push-pull, timing-safe), but the Hall lines on the ZS-X11H can also be driven by the MCU in some test modes, or used for closed-loop position sensing where the MCU asserts a pulse back to the controller. Keeping the path bidirectional preserves those capabilities. The TXS0108E is the natural fit because it handles push-pull auto-direction at Hall-signal speeds with zero configuration.

**The ESP32-specific wrinkle:** ESP32 input-only pins (GPIO 34/35/36/39) can accept 5V directly per datasheet tolerance, but driving them with 5V push-pull violates the absolute-max input spec and risks latch-up over time. The TXS0108E translates the 5V Hall outputs down to 3.3V cleanly, keeping the ESP32 inside its input-voltage envelope while preserving the bidirectional path for closed-loop operation.

**The generalization:** any time a "sensor" signal passes through an active intermediate (motor controller, sensor hub, bus extender), the topology of the downstream signal is what matters for shifter selection — not the topology of the raw sensor upstream. The controller regenerates the signal, and the regenerated form is what needs to be bridged. Applying the raw-sensor topology rule to a buffered signal produces a wrong choice that still electrically works but degrades signal integrity in ways that only surface at commutation speed.

---

Source: [[txs0108e-8-channel-bidirectional-level-shifter-auto-direction]]

Relevant Notes:
- [[hall-sensor-open-collector-outputs-need-pull-up-resistors-and-produce-gray-code-not-binary-position]] — the raw-sensor case that does not apply once a controller buffers the signal
- [[signal-topology-not-voltage-alone-determines-level-shifter-selection]] — the selection framework this note extends to buffered-signal paths
- [[active-level-shifters-use-one-shot-edge-accelerators-to-drive-rising-edges-breaking-the-bss138-rc-ceiling]] — the mechanism that makes TXS-class correct for push-pull
- [[open-drain-protocols-require-pull-up-based-level-shifters-because-auto-direction-sensors-cannot-distinguish-driver-from-pull-up]] — the inverse case (raw I2C) where the opposite choice is correct
- [[hall-sensor-wiring-order-matters-for-bldc]] — related Hall wiring concern for BLDC
- [[78l05-regulator-failure-kills-hall-power-making-motor-appear-dead-when-only-the-regulator-failed]] — related Hall-power failure class

Topics:
- [[shields]]
- [[actuators]]
- [[eda-fundamentals]]
