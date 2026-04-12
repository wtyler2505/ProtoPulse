---
description: "Matrix keypad scanning sets row pins as OUTPUT (driven LOW one at a time) and column pins as INPUT_PULLUP — when a key is pressed, the active row's LOW propagates to the pressed column, allowing key position detection from the row/column intersection"
type: knowledge
topics:
  - "[[input-devices]]"
source: "[[membrane-switch-keypad-module-tactile-button-array]]"
---

# Matrix keypad scanning drives one row LOW at a time and reads columns with pull-ups to detect key position

The scanning algorithm for an NxM matrix keypad:

1. Set all row pins as OUTPUT (initially HIGH or tri-state)
2. Set all column pins as INPUT_PULLUP (pulled HIGH internally)
3. For each row:
   - Drive that row LOW
   - Read all column pins
   - If a column reads LOW → key at (row, col) is pressed
   - Set row back to HIGH (or tri-state)
4. Repeat for all rows

**Why it works:** The switch at intersection (R, C) connects the row wire to the column wire when pressed. If row R is driven LOW and key (R, C) is pressed, the LOW propagates to column C, overriding its pull-up.

**Timing:** A full scan of a 4x4 matrix takes ~4 row transitions + column reads. At typical MCU speeds this takes microseconds, so scan rate is limited only by debounce timing (5-20ms between scans to avoid bounce).

This is architecturally the inverse of LED matrix multiplexing: LED matrices drive rows with current and sink columns, while keypads drive rows with logic levels and read columns. Same matrix topology, opposite signal flow.

**Key ghosting:** If 3 or more keys form a rectangle in the matrix, the fourth corner key appears pressed even when it isn't. This is inherent to passive matrices without diodes. Anti-ghosting requires either: (a) diodes on each key, (b) limiting detection to 2 simultaneous keys, or (c) smart debounce algorithms.

---

Topics:
- [[input-devices]]

Related:
- [[4x4-matrix-keypad-consumes-8-gpio-pins-making-io-expander-mandatory-on-pin-constrained-mcus]]
- [[membrane-keypad-has-no-built-in-debouncing-requiring-software-scan-timing]]
- [[direct-driving-an-8x8-led-matrix-consumes-16-io-pins-and-locks-the-cpu-to-display-refresh]]
