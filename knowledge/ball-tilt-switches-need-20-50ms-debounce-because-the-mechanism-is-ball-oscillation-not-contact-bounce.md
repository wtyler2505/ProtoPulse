---
description: "SW-520D debounce requires 20-50ms (vs 5-10ms for reed switches) because a rolling metal ball oscillates past contacts under gravity — the settling time depends on tilt angle and angular velocity, not just spring damping"
type: claim
source: "docs/parts/sw-520d-tilt-switch-ball-type-orientation-detector.md"
confidence: proven
topics:
  - "[[input-devices]]"
  - "[[sensors]]"
related_components:
  - "sw-520d-tilt-switch"
---

# Ball tilt switches need 20-50ms debounce because the mechanism is ball oscillation not contact bounce

Different switch mechanisms have different bounce physics, requiring different debounce strategies:

**Ball tilt switch (SW-520D):**
- Mechanism: Metal ball rolls past contacts under gravity
- Bounce cause: Ball oscillates back and forth, making/breaking contact multiple times
- Settling depends on: tilt angle (restoring force), angular velocity (kinetic energy), ball mass, can friction
- Typical debounce: 20-50ms
- Characteristic: Longer bouncing near the switching threshold angle (ball barely tips back and forth)

**Reed switch (Hamlin 59030):**
- Mechanism: Ferromagnetic contacts attract/repel in magnetic field
- Bounce cause: Thin reeds vibrate at their natural frequency after initial contact
- Settling depends on: Reed stiffness, damping, magnetic field strength
- Typical debounce: 5-10ms
- Characteristic: Fast initial contact, brief ring-down

**Pushbutton / tactile switch:**
- Mechanism: Metal dome or spring contact
- Bounce cause: Contact surfaces vibrate on impact
- Typical debounce: 5-20ms
- Characteristic: Worst at initial press, clean on release (for dome switches)

**Why this matters for code:**
A generic "10ms debounce" works for buttons and reed switches but UNDER-debounces a ball tilt switch. If you copy debounce code from a button tutorial and use it with a tilt switch, you'll get phantom triggers especially when the device is near the switching angle (continuous slow tilt through threshold = continuous ball oscillation = many false edges even after 10ms).

**Robust pattern for ball switches:**
```cpp
#define TILT_DEBOUNCE_MS 50  // Conservative for ball mechanism
unsigned long lastTiltChange = 0;
bool tiltState = HIGH;

void loop() {
  bool reading = digitalRead(TILT_PIN);
  if (reading != tiltState && (millis() - lastTiltChange > TILT_DEBOUNCE_MS)) {
    tiltState = reading;
    lastTiltChange = millis();
    // Act on stable state change
  }
}
```

---

Relevant Notes:
- [[binary-tilt-detection-trades-precision-for-simplicity-and-zero-quiescent-power]] -- Context for when you're using this sensor type

Topics:
- [[input-devices]]
- [[sensors]]
