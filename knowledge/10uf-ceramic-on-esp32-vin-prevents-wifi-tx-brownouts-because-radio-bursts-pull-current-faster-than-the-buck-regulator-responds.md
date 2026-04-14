---
description: "ESP32 WiFi TX bursts draw 300mA pulses at kilohertz rates that exceed the LM2596's control loop bandwidth -- a 10uF ceramic bypass cap on Vin acts as local energy storage bridging the regulator response gap and prevents brownout-induced resets"
type: claim
created: 2026-04-14
source: "docs/parts/wiring-36v-battery-power-distribution-4-tier-system.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "esp32"
  - "lm2596"
---

# 10uF ceramic on ESP32 Vin prevents WiFi TX brownouts because radio bursts pull current faster than the buck regulator responds

The ESP32's WiFi and Bluetooth radios are pulse-mode loads. In steady state, an ESP32 running firmware might draw 80mA. But during a WiFi transmit burst -- sending a packet, completing a handshake -- the current can spike to 300-500mA for durations in the microsecond range. These bursts repeat at the packet rate, which for active WiFi traffic means thousands of transients per second.

The LM2596 switching buck converter has a control loop bandwidth measured in kilohertz, not megahertz. When a 300mA pulse demands energy faster than the feedback loop can command the switch to compensate, the output voltage sags. If it sags below ~2.7V at the ESP32 Vin pin, the 3.3V onboard LDO loses headroom and the core voltage drops, triggering a brownout reset. Symptoms: mystery reboots correlated with WiFi activity, connections dropping under load, firmware that works fine tethered but dies when running WiFi.

A 10uF ceramic capacitor at the Vin pin fixes this. The cap stores local charge that the radio can draw from during a burst, with the LM2596 refilling it during the quiet intervals between bursts. Ceramic is essential here -- electrolytic caps have too much ESR (equivalent series resistance) at the high frequencies of WiFi bursts to deliver fast current. An X5R or X7R 10uF at the Vin pin, with leads as short as possible, is the standard fix.

This is an extension of the same principle as [[every-digital-ic-requires-a-100nf-ceramic-decoupling-capacitor-between-vcc-and-gnd-to-absorb-switching-transients]] but at a different frequency band. The 100nF ceramic handles MHz-range logic transients; the 10uF ceramic handles the kHz-range radio bursts. Both are needed on an ESP32 -- the 100nF sits near the core, the 10uF sits at the Vin input to the onboard LDO.

The physical placement matters. A 10uF cap with 5cm of trace between it and the Vin pin is nearly useless for transient response -- the trace inductance limits how fast charge can flow. Keep the cap within 1cm of the pin, with fat ground return, or the cap is just a decorative component on the schematic.

---

Source: [[wiring-36v-battery-power-distribution-4-tier-system]]

Relevant Notes:
- [[every-digital-ic-requires-a-100nf-ceramic-decoupling-capacitor-between-vcc-and-gnd-to-absorb-switching-transients]] -- same principle at a different frequency band
- [[switching-buck-converters-waste-watts-not-volts-making-them-essential-for-large-voltage-differentials]] -- the regulator that cannot keep up with radio bursts
- [[inductive-motor-loads-require-bypass-capacitor-to-absorb-voltage-spikes-above-supply-rail]] -- parallel concept: local caps for load transients

Topics:
- [[microcontrollers]]
- [[power-systems]]
- [[eda-fundamentals]]
