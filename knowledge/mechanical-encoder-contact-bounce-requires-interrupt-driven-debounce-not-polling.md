---
description: "The KY-040 mechanical encoder generates contact bounce during each detent transition (2-5ms of spurious pulses) — polling misses transitions or double-counts, making interrupt-driven libraries (Paul Stoffregen's Encoder) mandatory for reliable counting"
type: knowledge
topics:
  - "[[input-devices]]"
source: "[[ky-040-rotary-encoder-module-incremental-with-pushbutton]]"
---

# Mechanical encoder contact bounce requires interrupt-driven debounce not polling

Mechanical rotary encoders use physical wiper contacts on a patterned disc. Each detent transition involves:
1. Wiper lifts off one contact pad
2. Wiper briefly floats (no contact) — generates noise
3. Wiper makes contact with next pad — bounces 2-5ms

During bounce, the A/B signals oscillate rapidly. Without proper handling:
- **Polling too slowly**: Misses entire transitions → lost counts, position drift
- **Polling too fast**: Sees bounce as multiple transitions → double/triple counting
- **Naive interrupt**: Fires on every bounce edge → ISR overhead, incorrect count

**The solution: interrupt-driven state machine decoding**

The Paul Stoffregen `Encoder` library:
- Attaches interrupts to both A and B pins
- Uses a lookup table to decode Gray code state transitions
- Only valid state transitions (00→01→11→10 or reverse) increment/decrement
- Invalid transitions (bounce noise) are ignored by the state machine
- Works reliably at any rotation speed up to the interrupt response limit

```cpp
#include <Encoder.h>
Encoder enc(2, 3);  // Both on interrupt-capable pins = best performance
long pos = enc.read();  // Always current, ISR maintains count
```

**Pin selection matters:**
- Both pins on interrupt-capable GPIO: Best performance (ISR on every transition)
- One pin on interrupt, one on regular GPIO: Good (ISR reads other pin)
- Both on regular GPIO: Works but requires frequent polling, may miss fast rotation

On Arduino Uno: only D2 and D3 support external interrupts (INT0, INT1). ESP32: all GPIO pins support interrupts. This is a hard platform constraint for encoder usage.

---

Topics:
- [[input-devices]]

Related:
- [[quadrature-encoding-detects-rotation-direction-from-phase-lead-lag-between-two-square-wave-channels]]
- [[ball-tilt-switches-need-20-50ms-debounce-because-the-mechanism-is-ball-oscillation-not-contact-bounce]]
- [[membrane-keypad-has-no-built-in-debouncing-requiring-software-scan-timing]]
