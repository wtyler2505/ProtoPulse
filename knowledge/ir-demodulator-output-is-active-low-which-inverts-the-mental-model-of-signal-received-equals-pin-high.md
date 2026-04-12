---
description: "TSOP-type IR receivers idle HIGH and pulse LOW when receiving data — the opposite of what beginners expect, causing debugging confusion when interrupt edges are configured wrong"
type: claim
source: "docs/parts/generic-ir-receiver-module-38khz-demodulator.md"
confidence: proven
topics:
  - "[[communication]]"
  - "[[sensors]]"
  - "[[breadboard-intelligence]]"
related_components:
  - "ky-022-ir-receiver"
  - "osepp-irr-01"
  - "ir-01-receiver"
---

# IR demodulator output is active-LOW which inverts the mental model of signal received equals pin HIGH

The TSOP1738-type IR receivers used on all common breakout boards (KY-022, IR-01, OSEPP IRR-01) output an active-LOW signal: the pin idles HIGH (pulled up internally) and pulses LOW when it detects modulated 38kHz IR. This is the opposite of the intuitive expectation that "receiving a signal = pin goes HIGH."

This creates a specific debugging trap: if a beginner configures an interrupt on RISING edge expecting to catch "IR received" events, they'll actually catch the end of each burst (when the pin returns HIGH after the LOW pulse). The correct configuration is FALLING edge (or the IRremote library handles this internally).

**Why active-LOW?** The TSOP IC uses an open-collector/drain output stage that sinks current when active. This is standard for demodulator ICs because it allows multiple receivers to share a bus (wired-OR logic) and because the idle-HIGH state provides a clear "no signal" baseline that's distinguishable from a broken connection (which would float).

**ProtoPulse implications:**
- The bench coach should flag this when an IR receiver is connected to a pin configured for RISING edge interrupts
- DRC could warn: "IR receiver output is active-LOW — ensure interrupt/polling logic accounts for inverted signal"
- The schematic symbol should annotate the output as "active-LOW" or show the inversion bubble

---

Relevant Notes:
- [[bldc-stop-active-low-brake-active-high]] — same inverted-logic trap pattern in motor control domain
- [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]] — exactly the kind of wiring mistake AI should catch

Topics:
- [[communication]]
- [[sensors]]
- [[breadboard-intelligence]]
