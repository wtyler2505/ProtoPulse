---
description: "CdS photoresistors have 20-30ms response time — this eliminates them from optical communication, pulse counting, and any application requiring detection faster than ~30Hz. Phototransistors or photodiodes are the correct alternative for speed"
type: claim
source: "docs/parts/photoresistor-ldr-light-dependent-resistor-analog-light-sensor.md"
confidence: proven
topics:
  - "[[sensors]]"
related_components:
  - "photoresistor-ldr"
---

# Photoresistor response time of 20-30ms makes them unsuitable for fast optical signals

CdS photoresistors respond to light changes in 20-30ms (rise time, with fall time often longer — up to 200ms from bright to dark). This speed limit eliminates entire categories of applications:

**Cannot do (requires >30Hz optical response):**
- Optical communication (IR data links, fiber optic receivers) — need microsecond response
- Light curtain safety barriers — need sub-millisecond break detection
- Barcode reading — scanning at any useful speed
- Laser tachometer / reflective RPM — pulses too fast at >1800 RPM
- PWM light measurement — can't resolve individual PWM cycles
- Flicker detection — 100/120Hz mains flicker is invisible to an LDR

**Can do (slow light changes):**
- Sunrise/sunset detection — changes over minutes
- Room light on/off — changes over hundreds of milliseconds
- Cloud/shadow passing — changes over seconds
- Ambient light adaptation — gradual transitions

**Speed comparison of light sensors:**

| Sensor Type | Response Time | Max Frequency |
|---|---|---|
| CdS photoresistor (LDR) | 20-30ms rise, 50-200ms fall | ~5-30 Hz |
| Silicon phototransistor | 5-50μs | ~10-100 kHz |
| PIN photodiode | 1-10ns | ~100 MHz |
| Avalanche photodiode | <1ns | ~1 GHz |

**The asymmetric response is particularly problematic:** LDRs respond faster to increasing light (20-30ms) than decreasing light (50-200ms). This means even "slow" applications like clap-shadow detection get an asymmetric timing signature that can confuse simple threshold logic.

**For the bench coach:** If a user describes any application involving "counting light pulses," "detecting blinking," or "optical communication," redirect from LDR to phototransistor immediately. The LDR physically cannot respond fast enough regardless of code optimization.

---

Relevant Notes:
- [[cds-photoresistors-have-logarithmic-response-making-them-qualitative-not-quantitative-light-sensors]] -- Another fundamental limitation of the same component
- [[reed-switch-sub-millisecond-response-enables-high-frequency-contactless-event-counting]] -- Contrast: mechanical reed switches are faster than optical LDRs

Topics:
- [[sensors]]
