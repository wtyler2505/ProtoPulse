---
description: "The Hamlin 59030 operates in 0.5ms and releases in 0.1ms — theoretical cycle rate of ~1.5kHz, meaning a single-magnet RPM sensor can measure up to 90,000 RPM. The switch never bottlenecks in practical maker applications"
type: claim
source: "docs/parts/hamlin-59030-reed-switch-magnetic-sensor-dry-contact.md"
confidence: proven
topics:
  - "[[sensors]]"
  - "[[passives]]"
related_components:
  - "hamlin-59030-reed-switch"
---

# Reed switch sub-millisecond response enables high-frequency contactless event counting

The Hamlin 59030 timing specs:
- Operate time (open→closed): 0.5ms typical
- Release time (closed→open): 0.1ms typical
- Minimum cycle time: ~0.6ms = maximum ~1,667 Hz switching frequency

**What this means in practice:**

For RPM measurement with 1 magnet per revolution:
- 1,667 Hz = 100,000 RPM theoretical maximum
- Conservatively derate to ~1,200 Hz (72,000 RPM) for reliable operation

For context, common maker motor speeds:
- DC hobby motors: 3,000-15,000 RPM (~50-250 Hz)
- Brushless drone motors: 10,000-30,000 RPM (~167-500 Hz)
- Dremel/rotary tools: 5,000-35,000 RPM (~83-583 Hz)
- Hoverboard motors (OmniTrek rover): 200-1,000 RPM (~3-17 Hz)

**The reed switch NEVER limits RPM measurement in typical maker applications.** Even the fastest drone motor at 30,000 RPM only needs 500 Hz response — well within the 1,600 Hz capability.

**Contrast with tilt switch:**
| Switch Type | Operate Time | Effective Max Frequency |
|---|---|---|
| Hamlin 59030 reed | 0.5ms | ~1,600 Hz |
| SW-520D ball tilt | 20-50ms (with debounce) | ~15-30 Hz |

The 30x speed difference makes reed switches suitable for counting fast events (RPM, flow pulses, encoder ticks) while ball switches are only suitable for slow state changes (orientation, tip-over).

**When reed switch speed IS the bottleneck:**
- Optical flow meters with tiny turbines at high flow rates
- Multi-pole magnetic encoders at high RPM (N magnets × RPM can exceed 1.5kHz)
- High-speed industrial applications → use Hall effect sensors (sub-microsecond response)

---

Relevant Notes:
- [[ball-tilt-switches-need-20-50ms-debounce-because-the-mechanism-is-ball-oscillation-not-contact-bounce]] -- The slow counterpart this contrasts with
- [[reed-switch-on-rotating-shaft-enables-contactless-rpm-measurement-via-pulse-counting]] -- The primary application this spec enables

Topics:
- [[sensors]]
- [[passives]]
