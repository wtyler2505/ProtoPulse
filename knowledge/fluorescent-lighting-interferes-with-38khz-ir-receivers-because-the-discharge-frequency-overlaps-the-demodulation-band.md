---
description: "Fluorescent lights produce IR emissions with harmonic content that can hit the 38kHz demodulation window, causing false triggers or reduced range — a deployment environment gotcha"
type: claim
source: "docs/parts/generic-ir-receiver-module-38khz-demodulator.md"
confidence: proven
topics:
  - "[[sensors]]"
  - "[[breadboard-intelligence]]"
related_components:
  - "ky-022-ir-receiver"
  - "osepp-irr-01"
  - "ir-01-receiver"
---

# Fluorescent lighting interferes with 38kHz IR receivers because the discharge frequency overlaps the demodulation band

TSOP-type 38kHz IR receivers can produce false triggers or experience reduced range when operated near fluorescent lighting. Fluorescent tubes discharge at frequencies whose harmonics overlap the 38kHz demodulation window of the receiver IC. Strong ambient IR from direct sunlight also saturates the photodiode, reducing sensitivity.

This is the classic "it works on my bench but not in the room" debugging mystery. The bench is often lit by LED desk lamps (no IR interference), but the workshop/classroom has overhead fluorescent tubes. Moving the project to a different room "fixes" the bug without the maker understanding why.

**Mitigation strategies:**

1. **Physical shielding:** Mount the receiver inside a short tube or shroud to limit the acceptance angle and block ambient light from above
2. **Software debouncing:** Require two consecutive valid NEC frames before accepting a command (false triggers rarely produce valid protocol frames)
3. **Proximity:** Reduce the distance between transmitter and receiver — the signal-to-noise ratio improves with shorter range
4. **LED lighting:** If the project will deploy in a space with fluorescent lights, note this as an environmental constraint in the design requirements

**ProtoPulse implications:**
- The bench coach should proactively warn when an IR receiver appears in a project: "Note: fluorescent lighting can cause interference. If you see random triggers, check your room lighting."
- Environmental constraints could be a field in the design validation: "This design uses IR communication — verify deployment environment has no fluorescent light sources in the receiver's field of view."

---

Relevant Notes:
- [[photoresistor-response-time-of-20-30ms-makes-them-unsuitable-for-fast-optical-signals]] — both are optical sensor environmental constraints

Topics:
- [[sensors]]
- [[breadboard-intelligence]]
