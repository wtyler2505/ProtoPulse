---
slug: inductor-saturation
title: Inductor saturation
ercCodes: []
---

## What it is

An inductor stores energy in the magnetic field of its core, and the core has a ceiling: past a certain current the material can't magnetize any further, the inductance collapses, and the part stops behaving like an inductor. That ceiling is the saturation current, and it's a cliff, not a slope.

## Why it bites

Your buck-converter module runs warm and whines, and the output ripple is worse than the calculator promised — because at peak current the inductor is saturating, its inductance is collapsing, and the current ramp that should be a gentle slope turns into a near-vertical spike. The switch and diode eat those spikes; sometimes they die of it. The trap is in the shopping: inductor datasheets carry *two* current ratings that look interchangeable. The thermal rating (Irms) says how much continuous current heats the part acceptably; the saturation rating (Isat) says where the inductance falls off. A part can be thermally fine and magnetically useless at the same current — and the converter "works" on the bench while quietly hammering its switch.

## The numbers

Below saturation, V = L·(di/dt) holds and current ramps linearly under constant voltage — that straight ramp is the signature of a healthy inductor. At saturation, L falls, so di/dt rises for the same voltage: the current curve visibly bends upward. Vendors typically define Isat as the current where inductance has dropped by some stated percentage — often in the 20–30% range, but the definition varies by manufacturer, so two "3A" inductors can saturate very differently; read the footnote and, better, the L-vs-current curve. The working rule, limit stated: size Isat above your *peak* current (including ripple), not your average — and remember saturation gets worse as the core heats.

## See it

Drive an ideal inductor in the sim with a fixed voltage and watch the textbook straight current ramp. Then model saturation by dropping the inductance to a tenth above a threshold current and re-run: the ramp kinks sharply upward at the threshold — that kink is the waveform a real saturating buck shows on a current probe.

## Go deeper

Related: [ferrite-beads-are-not-inductors](ferrite-beads-are-not-inductors), [impedance-vs-resistance](impedance-vs-resistance), [power-and-heat](power-and-heat). Curriculum: Track 3 "Power", step 4 — the buck-converter ripple work. Canonical reference: a power-inductor datasheet's L-vs-current curve and its Isat definition footnote.
