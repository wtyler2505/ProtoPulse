---
description: "A rotary encoder's A and B channels produce two square waves 90 degrees out of phase — if A leads B the knob turns clockwise, if B leads A it turns counterclockwise, and counting transitions gives displacement magnitude"
type: knowledge
topics:
  - "[[input-devices]]"
source: "[[ky-040-rotary-encoder-module-incremental-with-pushbutton]]"
---

# Quadrature encoding detects rotation direction from phase lead-lag between two square wave channels

The KY-040 (and all incremental rotary encoders) outputs two digital signals:
- **Channel A (CLK)**: Square wave pulsing on each detent transition
- **Channel B (DT)**: Square wave at same frequency, offset 90 degrees (one quarter-cycle)

**Direction detection:**
- Clockwise rotation: A transitions before B (A leads B)
- Counterclockwise rotation: B transitions before A (B leads A)

**The decoding algorithm** (on A's falling edge):
```
If B is HIGH when A falls → clockwise (increment position)
If B is LOW when A falls  → counterclockwise (decrement position)
```

This is called "quadrature" because the two signals divide each cycle into 4 distinct states (00, 01, 11, 10 in Gray code). A full state machine can extract 4x resolution by counting all transitions on both channels, though for the KY-040's 20 detents this is rarely needed.

**Why two channels instead of one:** A single channel can count pulses (distance) but cannot determine direction. The 90-degree phase offset encodes direction information in the temporal relationship between channels.

This same principle is used in:
- Motor shaft encoders (thousands of PPR)
- CNC machine position feedback
- Mouse scroll wheels
- Audio equipment volume knobs

---

Topics:
- [[input-devices]]

Related:
- [[incremental-encoder-has-no-position-memory-across-power-cycles-making-it-a-relative-only-input-device]]
- [[mechanical-encoder-contact-bounce-requires-interrupt-driven-debounce-not-polling]]
- [[rotary-encoder-with-pushbutton-provides-scroll-plus-select-in-one-component]]
