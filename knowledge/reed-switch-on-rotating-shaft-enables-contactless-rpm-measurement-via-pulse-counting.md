---
description: "Mount a magnet on a rotating shaft with a stationary reed switch nearby — each revolution generates one pulse, frequency = RPM/60. Zero-power contactless speed sensing with no wear, no code beyond interrupt counting"
type: claim
source: "docs/parts/hamlin-59030-reed-switch-magnetic-sensor-dry-contact.md"
confidence: proven
topics:
  - "[[sensors]]"
  - "[[input-devices]]"
related_components:
  - "hamlin-59030-reed-switch"
---

# Reed switch on rotating shaft enables contactless RPM measurement via pulse counting

A classic electromechanical sensing pattern: attach a small magnet to anything that rotates, place a reed switch in the magnetic path, count pulses.

**Setup:**
```
[Rotating shaft/wheel/gear]
       |
   [Magnet glued to surface]
       |
  ~~~~ magnetic field path ~~~~
       |
[Stationary reed switch] → MCU interrupt pin
```

**The math:**
- 1 magnet per revolution: frequency (Hz) = RPM / 60
- N magnets per revolution: frequency (Hz) = (RPM × N) / 60
- Period between pulses: T(ms) = 60000 / RPM (for 1 magnet)

**Code pattern (interrupt-based):**
```cpp
volatile unsigned long lastPulse = 0;
volatile unsigned long pulseInterval = 0;

void IRAM_ATTR rpmISR() {
  unsigned long now = micros();
  pulseInterval = now - lastPulse;
  lastPulse = now;
}

void setup() {
  attachInterrupt(digitalPinToInterrupt(RPM_PIN), rpmISR, FALLING);
}

float getRPM() {
  if (pulseInterval == 0) return 0;
  return 60000000.0 / pulseInterval; // micros to RPM
}
```

**Why reed switch beats alternatives for many applications:**

| Method | Pros | Cons |
|--------|------|------|
| Reed switch | Zero power idle, no calibration, works through enclosures | Limited to binary (1 pulse/rev), requires physical magnet |
| Hall effect sensor | Better for high-RPM (faster response), analog output option | Requires continuous power, more wiring |
| Optical encoder | High resolution (hundreds of pulses/rev) | Requires power, alignment, clean environment |
| Back-EMF sensing | No physical sensor needed | Only works on motors, complex signal processing |

**Applications in maker/rover projects:**
- Wheel speed sensing (odometry) — exactly the OmniTrek rover use case
- Fan tachometer feedback
- CNC spindle speed measurement
- Anemometer (wind speed via cup rotation)
- Flow meter (turbine rotation counting)

**Practical limits:**
- Reed switch 0.5ms response → theoretical max ~1.5kHz → 90,000 RPM with 1 magnet
- In practice, magnet proximity timing limits before reed switch does
- Multiple magnets increase resolution but require even spacing

---

Relevant Notes:
- [[uno-only-2-external-interrupts-on-d2-d3-is-a-hard-project-sizing-constraint]] -- RPM counting requires an interrupt pin
- [[reed-switch-sub-millisecond-response-enables-high-frequency-contactless-event-counting]] -- The timing spec that makes this viable

Topics:
- [[sensors]]
- [[input-devices]]
