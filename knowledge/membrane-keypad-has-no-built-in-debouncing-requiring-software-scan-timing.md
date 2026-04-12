---
description: "Membrane keypads have no hardware debounce circuitry — the Arduino Keypad library by Mark Stanley handles debounce internally by requiring stable reads across multiple scan cycles before registering a key press, with configurable hold and idle times"
type: knowledge
topics:
  - "[[input-devices]]"
source: "[[membrane-switch-keypad-module-tactile-button-array]]"
---

# Membrane keypad has no built-in debouncing requiring software scan timing

The membrane keypad's contacts are thin conductive traces on flexible film. When pressed, the contact makes and breaks several times in the first 5-20ms (bounce). Without debouncing:

- A single key press registers as multiple rapid presses
- Scan routines detect "press-release-press-release..." in rapid succession
- Character entry duplicates: pressing '5' enters '555' or '5555'

**The standard solution: Arduino Keypad library** (by Mark Stanley and Alexander Brevig)

The library's debounce strategy:
1. Scans the full matrix at a configurable interval (default 10ms)
2. Key must read consistently pressed across multiple scans to register
3. Reports key events: PRESSED, HOLD, RELEASED, IDLE
4. Handles multi-key detection within the same scan

```cpp
keypad.setDebounceTime(50);  // ms — increase for noisy contacts
keypad.setHoldTime(1000);    // ms before HOLD event fires
```

**Why membrane keypads bounce more than mechanical switches:**
- Membrane contacts are flat, flexible surfaces — they flex and partially disconnect during press
- Mechanical switches (Cherry MX, tactile buttons) have positive-action mechanisms that reduce bounce
- Ball tilt switches bounce even more (20-50ms) due to ball oscillation

Without the library, manual debounce requires tracking per-key timestamps — far more complex for a 16-key matrix than a single button.

---

Topics:
- [[input-devices]]

Related:
- [[matrix-keypad-scanning-drives-one-row-low-at-a-time-and-reads-columns-with-pull-ups-to-detect-key-position]]
- [[ball-tilt-switches-need-20-50ms-debounce-because-the-mechanism-is-ball-oscillation-not-contact-bounce]]
- [[membrane-keypad-is-a-passive-switch-matrix-with-no-active-logic-so-it-operates-at-any-mcu-voltage-without-level-shifting]]
