---
slug: floating-inputs
title: Floating inputs
ercCodes:
  - ERC-FLOATING-INPUT
---

## What it is

A floating input is a pin that's supposed to read a logic level but isn't connected to anything that defines one. It doesn't read "off" — it reads whatever stray charge and nearby fields happen to couple into it, which is to say: noise.

## Why it bites

Your button-triggered circuit fires by itself when your hand gets near the board. The input pin was floating, your body is a fine antenna, and the high-impedance CMOS gate happily amplified the ambient hum into phantom presses. Floating inputs produce the worst genre of bug — intermittent, position-dependent, demo-day-only — because the "value" depends on humidity, layout, and where you're standing. On some CMOS parts a floating input can even bias the input stage midway between levels, where both transistors of the input pair conduct and the chip quietly runs hot. This is why ProtoPulse's ERC treats an unconnected input as an error, not a warning.

## The numbers

CMOS input leakage is typically on the order of nanoamps to a microamp, so even a 1MΩ resistor is "strong" enough to pin the level — practical pull values run 10k to 100k as a sane default (10k is the reflex; go higher for battery budgets, lower for noisy environments). The hedge: those values assume ordinary logic inputs; pins with internal pulls, analog functions, or defined strap options follow their datasheet, not the reflex. Unused inputs on logic ICs should be tied high or low per the datasheet — unused *outputs* can float freely.

## See it

Drop a 555 into the design and deliberately leave RESET unconnected, then run ERC: the floating-input finding anchors to the exact pin. Tie RESET to VCC through a wire and re-run — clean. In Track 4's sim you'll watch a floating comparator input chatter while a tied one sits still.

## Go deeper

Related: [pull-up-pull-down](pull-up-pull-down), [push-pull-vs-open-collector](push-pull-vs-open-collector), [ground-three-meanings](ground-three-meanings). Curriculum: Track 1 "First Light", step 4 (first-light-04). Canonical reference: TI application report SCBA004 ("Implications of Slow or Floating CMOS Inputs").
