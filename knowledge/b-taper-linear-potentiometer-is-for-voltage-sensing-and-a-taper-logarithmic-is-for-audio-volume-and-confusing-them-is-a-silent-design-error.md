---
description: "B-taper pots produce linear resistance change with rotation (correct for voltage dividers and ADC input) while A-taper pots produce logarithmic change (correct for perceived audio volume) -- using the wrong taper creates non-obvious behavior that looks like a code bug, not a hardware choice"
type: knowledge-note
source: "docs/parts/potentiometer-10k-rotary-b10k-linear-taper.md"
topics:
  - "[[passives]]"
  - "[[input-devices]]"
confidence: high
verified: false
---

# B-taper linear potentiometer is for voltage sensing and A-taper logarithmic is for audio volume and confusing them is a silent design error

Potentiometers come in two taper types that are physically identical and often sold under the same "10K pot" description:

| Taper Code | Resistance Curve | Primary Use |
|-----------|-----------------|-------------|
| B (linear) | Resistance changes proportionally with rotation | Voltage dividers, ADC input, LCD contrast, sensor simulation |
| A (logarithmic) | Resistance changes slowly at first, then rapidly | Audio volume control (matches human ear perception) |

**Why this matters:**

1. **A-taper in a voltage divider:** The ADC reading will jump slowly through the first 80% of rotation, then race through the remaining range in the last 20%. The user perceives the knob as "barely doing anything" then "jumping to maximum." This looks like a software scaling bug but is entirely a hardware taper mismatch.

2. **B-taper for audio volume:** The perceived volume will increase rapidly at low positions (first 20% of rotation covers most of the audible range) and barely change at high positions. The user complains "it's too loud or off, there's no in-between." This is because human hearing is logarithmic -- a linear pot produces a logarithmic perception mismatch.

**The naming trap:** The taper letter codes are NOT intuitive:
- "B" for linear (not "A" for "ascending linearly")
- "A" for audio/logarithmic (not "L" for "log")
- Some Asian manufacturers reverse the convention (B = log, A = linear)
- Always verify from the datasheet or test with a multimeter: measure resistance at the midpoint. Linear = ~50% of total resistance; log = ~10-20% of total resistance.

**ProtoPulse bench coach guidance:** When a potentiometer appears in a schematic, the coach should verify the taper matches the application. Default recommendation: B-taper (linear) for all non-audio applications. Flag if an A-taper pot connects to an ADC input.

---

Source: [[potentiometer-10k-rotary-b10k-linear-taper]]

Relevant Notes:
- [[hd44780-contrast-potentiometer-has-a-narrow-sweet-spot-and-wrong-adjustment-produces-blank-or-solid-rectangle-symptoms]] -- uses a pot as a voltage divider; taper type affects how sensitive the adjustment is
- [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]] -- ADC nonlinearity compounds with wrong pot taper to create doubly confusing behavior

Topics:
- [[passives]]
- [[input-devices]]
