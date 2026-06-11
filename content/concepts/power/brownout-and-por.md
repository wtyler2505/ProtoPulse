---
slug: brownout-and-por
title: Brownout and power-on reset
ercCodes: []
---

## What it is

A brownout is a supply that sags partway down and comes back — not a power loss, a power *stumble*. Power-on reset (POR) is the circuitry that holds a chip safely dead until its supply is high enough to trust. The dangerous territory is the gap between those two: voltage too low for correct logic, too high to trigger a clean reset.

## Why it bites

A motor stalls and drags the rail to 2.7V for five milliseconds. That's below the MCU's reliable operating range at your clock speed, but it may never cross the POR threshold — so instead of restarting, the processor *limps*: program counters wander, RAM bits flip, a GPIO latches on and stays on, a flash write in progress corrupts a page. The user-visible signature is the worst kind: the device works fine until the battery gets low or the big load kicks, then ends up in a weird state that only a full power cycle clears. POR has its own subtlety on the way *up*: classic POR circuits expect the supply to rise reasonably fast, and a slow-ramping rail — big bulk capacitance, soft-start, a dying battery being connected — can leave the chip started but never properly reset; whether yours tolerates that is a datasheet question.

## The numbers

Mostly hedged, because they're chip-specific by design: an MCU's minimum operating voltage typically scales with clock frequency (the datasheet's speed-grade table is the law), and flash or EEPROM writes usually carry their own, higher minimum. Brownout events from motor stalls and battery sag live on the milliseconds scale — long enough to corrupt, short enough to dodge the POR. The design rule that survives all parts: identify the voltage where *your* chip at *your* clock stops being trustworthy, and arrange for a deliberate reset below it — that's the brown-out detector's job.

## See it

In the co-sim, run firmware that counts in a loop, then dip the rail to just above the POR threshold for a few milliseconds. The counter doesn't reset — it *derails*. Enable the BOD model and re-run: a clean restart instead of a haunted one.

## Go deeper

Related: [brown-out-detectors](brown-out-detectors), [battery-sag-under-load](battery-sag-under-load), [reset-circuits](reset-circuits), [bulk-capacitance](bulk-capacitance). Curriculum: Track 3 "Power" — the failure that the whole power track exists to prevent. Canonical reference: your MCU datasheet's POR/BOD electrical characteristics and supply-rise-time requirements.
