---
description: "The 1088AS 8x8 LED matrix has scrambled pin-to-row/column mapping (Row 1=Pin 9, Row 2=Pin 14, Row 3=Pin 8, etc.) and flipping the package inverts the entire mapping -- always verify orientation with a single-LED test"
type: knowledge-note
source: "docs/parts/1088as-8x8-red-led-dot-matrix-common-cathode-3mm.md"
topics:
  - "[[displays]]"
  - "[[breadboard-intelligence]]"
confidence: high
verified: false
---

# 1088AS pin numbering is non-sequential across rows and columns making orientation verification mandatory

The 1088AS 8x8 LED matrix has a scrambled physical-to-logical pin mapping where pin numbers have no relationship to row/column order:

- Row 1 = Pin 9, Row 2 = Pin 14, Row 3 = Pin 8, Row 4 = Pin 12
- Row 5 = Pin 1, Row 6 = Pin 7, Row 7 = Pin 2, Row 8 = Pin 5
- Columns are similarly scrambled: Col 1 = Pin 13, Col 2 = Pin 3, etc.

**Why this matters:**
- You cannot assume "pin 1 = row 1" or "sequential pins = sequential rows." This assumption works for most ICs and is a natural beginner expectation.
- If the physical package is inserted upside down, the entire row/column mapping inverts. The part number text orientation is the only visual cue.
- The correct workflow is: insert the part, test a single LED (one row HIGH, one column LOW) to confirm physical orientation matches your code's pin mapping, THEN write the full display code.

This parallels the [[accelstepper-pin-order-for-28byj-48-is-not-sequential-and-miswiring-produces-vibration-instead-of-rotation]] gotcha -- another case where physical pin order contradicts logical channel order and produces confusing failures.

---

Topics:
- [[displays]]
- [[breadboard-intelligence]]
