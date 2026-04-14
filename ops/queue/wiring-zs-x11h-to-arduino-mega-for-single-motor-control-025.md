---
type: enrichment
target_note: "[[zs-x11h-el-speed-input-is-active-low-and-flips-polarity-between-pwm-and-analog-modes]]"
source_task: wiring-zs-x11h-to-arduino-mega-for-single-motor-control
addition: "Concrete analogWrite -> duty -> motor speed mapping table with all three reference points (0, 127, 255) and the explicit `255 - desiredSpeed` inversion formula as an Arduino-ready code pattern"
source_lines: "52-58, 122-126"
---

# Enrichment 025: [[zs-x11h-el-speed-input-is-active-low-and-flips-polarity-between-pwm-and-analog-modes]]

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]] (lines 52-58, 122-126)

## Reduce Notes

Enrichment for [[zs-x11h-el-speed-input-is-active-low-and-flips-polarity-between-pwm-and-analog-modes]]. Source adds a concrete analogWrite-to-duty-to-motor-speed mapping table anchored at three values (0, 127, 255) and the ready-to-use `setMotorSpeed()` wrapper using `255 - speed` inversion.

Rationale: The existing note argues WHY the polarity inverts but presents the inversion formula inline without the grounding table. The source provides a 3-row table (0=full, 127=50%, 255=stopped) that makes the relationship visually unambiguous, plus a named wrapper function. Adding this table enriches the note with visual scaffolding for beginners who struggle with the inversion, without duplicating the why-it-works argument.

---

## Enrich
(to be filled by enrich phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
