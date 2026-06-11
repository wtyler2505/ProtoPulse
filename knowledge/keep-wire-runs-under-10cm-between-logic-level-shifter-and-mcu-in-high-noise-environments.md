---
title: "Keep wire runs under 10cm between logic level shifter and MCU in high-noise environments"
description: "Wire runs between a level shifter (like TXS0108E) and an MCU must stay under 10cm in motor-controller environments because longer runs pick up PWM switching noise and produce phantom Hall transitions."
tags: [hardware, wiring, noise, motor-control, hall-sensor]
---

# Keep wire runs under 10cm between logic level shifter and MCU in high-noise environments

When wiring 3.3V microcontrollers (like ESP32) to logic level shifters near BLDC motor controllers, the wire length between the shifter and the MCU must be kept under 10cm. 

Longer wire runs act as antennas. In motor-controller environments, high-frequency PWM switching noise from the motor phases easily couples into these long wires. Because logic level shifters (especially bi-directional ones like the TXS0108E) are highly sensitive and often rely on weak internal pull-ups, this induced noise causes false logic level changes.

For Hall sensors, these phantom transitions appear as rapid, erroneous position changes to the MCU, causing the commutation logic to fail or the motor to stutter, which is often misdiagnosed as a software bug.

**Related patterns:**
- [[analog-ics-need-decoupling-more-critically-than-digital-because-supply-noise-directly-contaminates-signal-measurements]] — noise coupling conceptually, though distinct mechanisms (trace inductance vs supply contamination).
- [[bldc-controller-hall-sensor-outputs-are-push-pull-digital-making-txs-class-shifters-the-correct-bridge-to-3v3-mcus]] — context on using TXS0108E with Hall sensors.