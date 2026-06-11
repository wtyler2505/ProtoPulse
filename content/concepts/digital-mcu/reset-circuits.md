---
slug: reset-circuits
title: Reset circuits
ercCodes: []
---

## What it is

The reset circuit holds a microcontroller in a known, dead state until its supply is trustworthy, and gives you a deliberate way to restart it. The minimal version is a pull-up on the active-low reset pin; the honest version adds a supervisor that watches the rail and decides when "trustworthy" actually arrives.

## Why it bites

A floating or marginal reset pin produces the most demoralizing symptom in electronics: a board that starts *sometimes*. Works after you touch the reset trace, needs an unplug-replug ritual cold, runs fine once running. Slow-rising supplies sharpen it — big bulk capacitance or a soft-start regulator can ramp the rail gently enough that the chip's internal power-on reset never fires cleanly, leaving the core running from a state nobody initialized (whether your part tolerates a slow ramp is a datasheet question). Noise bites too: a long reset trace routed near a motor wire turns commutation hash into random restarts. And reset pins moonlight — on many MCUs the same pin is the programming interface, and auto-reset tricks (the serial port's DTR line through a capacitor) mean your reset network and your programmer have opinions about each other.

## The numbers

Convention, stated as convention: a 10k pull-up to the supply on an active-low reset, a button to ground across it, and often ~100nF from the pin to ground for noise immunity and a gentle release — but check your programmer's auto-reset expectations before adding capacitance, since that RC is sometimes load-bearing for flashing. Supervisor ICs assert reset whenever the rail is below their threshold and keep holding it for a fixed delay after recovery — typically tens to hundreds of milliseconds, threshold and delay both chosen from the supervisor datasheet's table against your chip's minimum operating voltage.

## See it

In the sim, ramp a supply slowly into an MCU model with only its internal POR and watch the boot coin-flip; add a supervisor model with a threshold and release delay and the start becomes boring — every time, after the rail is provably good.

## Go deeper

Related: [brownout-and-por](brownout-and-por), [brown-out-detectors](brown-out-detectors), [pull-up-pull-down](pull-up-pull-down), [rc-time-constants](rc-time-constants). Curriculum: Track 7 "Capstone" — the S3 minimal application circuit includes getting reset right. Canonical reference: your MCU datasheet's reset section and a supervisor IC datasheet's threshold/delay tables.
