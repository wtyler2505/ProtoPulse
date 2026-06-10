---
slug: duty-cycle
title: Duty cycle
ercCodes: []
---

## What it is

Duty cycle is the fraction of each period a repeating signal spends "on," expressed as a percentage. It's the knob behind PWM dimming, motor speed control, and why your 555 blinker is on longer than it's off.

## Why it bites

You PWM an LED at 10% duty to dim it and everything's fine — then you reuse the trick on a MOSFET driving a motor and the transistor dies at a duty cycle the math said was safe. The average power was fine; the *switching* losses during each transition weren't in your average. The other classic: building the textbook two-resistor 555 astable and fighting for hours to get a 30% duty cycle out of it — the topology physically can't go below 50%, and no resistor value will change that. Averages hide peaks: a 5V PWM at 50% duty reads "2.5V" on a slow meter while still slamming the load with full 5V edges.

## The numbers

Average value = peak × duty: 5V at 20% duty averages 1V. For the classic two-resistor 555 astable, high time uses R1+R2 and low time uses R2 alone, so duty = (R1+R2)/(R1+2·R2) — always above 50%, approaching it as R2 dominates (a diode across R2 breaks the limit; that's the standard fix). LED dimming looks linear to a meter but not to an eye: human brightness perception is roughly logarithmic, so 25% duty looks far brighter than a quarter as bright. PWM frequencies above about 200Hz–1kHz avoid visible flicker for direct viewing — but hedge upward (multi-kilohertz) for anything filmed by a camera.

## See it

Run a 555 astable with R1 = 1k, R2 = 10k and read the duty on the sim's waveform: about 52%. Swap to R1 = 10k, R2 = 1k and watch it stretch toward 92%. Try to reach 30% with any two values — you can't, and now you know why.

## Go deeper

Related: [rms-vs-peak](rms-vs-peak), [power-and-heat](power-and-heat), [si-prefixes-4k7](si-prefixes-4k7). Curriculum: Track 1 "First Light", step 5 (first-light-05). Canonical reference: the TI NE555 datasheet, astable-mode section.
