---
description: "A passive switch (tilt, reed, button) on an interrupt-capable pin costs exactly zero power in the idle state — the entire wake path from trigger to detection is free until the event occurs, making passive switches superior to active sensors for deep-sleep wake triggers"
type: claim
source: "docs/parts/sw-520d-tilt-switch-ball-type-orientation-detector.md"
confidence: proven
topics:
  - "[[sensors]]"
  - "[[input-devices]]"
related_components:
  - "sw-520d-tilt-switch"
  - "hamlin-59030-reed-switch"
---

# Passive mechanical switches draw zero quiescent current making them ideal battery wake triggers

In a battery-powered deep-sleep design, the sleep current budget matters — but so does the wake trigger circuit's idle draw. Active sensors (PIR, ultrasonic, IMU) consume milliamps continuously while "watching" for a wake event. A passive mechanical switch consumes literally nothing until the physical event occurs.

**Power analysis for wake-trigger options:**

| Wake Trigger | Idle Current | Detection |
|---|---|---|
| SW-520D tilt switch (open state) | 0 uA | Orientation change |
| Hamlin reed switch (open state) | 0 uA | Magnet proximity |
| Pushbutton (open state) | 0 uA | User press |
| PIR sensor (HC-SR501) | ~50 uA (quiescent) | Motion |
| MPU6050 low-power mode | ~10 uA (wake-on-motion) | Any acceleration |
| Ultrasonic (HC-SR04) | ~2 mA (always pinging) | Distance change |

**Circuit pattern for passive wake:**
```
MCU_GPIO (INPUT_PULLUP, EXT_WAKE) ─── Switch ─── GND
```

When the switch is open: internal pull-up holds pin HIGH, no current flows.
When the switch closes: pin goes LOW, triggers wake interrupt, current is only Vcc/R_pullup (~33uA for 100k pull-up) for the duration of the event.

**ESP32 integration:**
```cpp
esp_sleep_enable_ext0_wakeup(GPIO_NUM_33, LOW); // Wake when switch closes
esp_deep_sleep_start(); // 10uA total system current
// On wake: full boot, check switch state, act or go back to sleep
```

**Design implication:** For IoT devices that sleep 99%+ of the time, the wake trigger is the dominant power consideration AFTER the MCU's own sleep current. Using a passive switch means the trigger adds zero to the 10uA ESP32 deep-sleep baseline — the system truly draws only the MCU's own leakage until something physically moves.

---

Relevant Notes:
- [[esp32-deep-sleep-draws-only-10-microamps-enabling-battery-iot]] -- The MCU sleep context this complements
- [[binary-tilt-detection-trades-precision-for-simplicity-and-zero-quiescent-power]] -- Why passive binary sensors are the right choice for many applications
- [[membrane-keypad-is-a-passive-switch-matrix-with-no-active-logic-so-it-operates-at-any-mcu-voltage-without-level-shifting]] -- extends the passive-switch zero-current principle from a single switch to a full row/column matrix

Topics:
- [[sensors]]
- [[input-devices]]
