---
slug: boot-strap-pins
title: Boot and strap pins
ercCodes: []
---

## What it is

Strap pins are pins a chip reads at the moment of reset to decide how to be — boot source, flash voltage, interface mode, device address. For one brief window they are configuration inputs; afterward, most of them become ordinary GPIO, which is exactly what makes them a trap.

## Why it bites

You hang an innocent LED, a pull-down, or a peripheral module on a free GPIO, and the board stops booting — or worse, boots *differently*. At reset, your added load fought the strap's required level and won, and the chip woke up in download mode, or with the wrong flash voltage, or off the wrong boot source. The symptom catalog is distinctive: a board that runs only while the programmer is attached; firmware that flashes fine but won't start standalone; a device that boots nine times out of ten, losing the coin-flip whenever the strap floated into the wrong state. Popular WiFi-class MCU modules are notorious here — several of their exposed GPIOs double as straps — and some straps configure things like flash voltage where the wrong answer doesn't just misboot, it misbehaves persistently. The pin worked perfectly as a GPIO; it was the first microsecond that betrayed you.

## The numbers

Hedged by design, because every chip's strapping table is its own law: straps are sampled during a brief window at or just after reset release, required levels and internal default pulls are listed per pin in the datasheet's strapping section, and external strap resistors are conventionally in the 10k neighborhood. The portable design rules: before assigning any pin, read the strapping table; keep heavy loads, LEDs, and other devices' outputs off strap pins; and if a strap must be shared, ensure whatever shares it is high-impedance or correct-level at reset.

## See it

In the co-sim, take an MCU model with a boot strap, attach a pull-down where the strapping table demands high, and hit reset: the boot mode changes and the firmware never starts. Lift the pull, reset again, and it boots — same schematic, one strap, two machines.

## Go deeper

Related: [pull-up-pull-down](pull-up-pull-down), [floating-inputs](floating-inputs), [reading-a-datasheet](reading-a-datasheet), [reset-circuits](reset-circuits). Curriculum: Track 7 "Capstone" — the S3 minimal application circuit is strap-pin discipline made real. Canonical reference: your MCU datasheet's strapping-pin table.
