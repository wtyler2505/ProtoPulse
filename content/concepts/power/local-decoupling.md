---
slug: local-decoupling
title: Local decoupling
ercCodes: []
---

## What it is

A decoupling capacitor is a tiny local energy tank parked next to a chip's power pins. Digital chips drink current in sharp gulps on every clock edge; the capacitor serves those gulps from millimeters away, so the rail at the pin stays steady instead of bouncing with every transition.

## Why it bites

The board "works," but strangely: an ADC reads noisy, the MCU crashes only while the display updates, logic misbehaves once you raise the clock. The supply measures fine at the regulator — but between the regulator and the chip lies trace inductance, and V = L·(di/dt) means a nanosecond current gulp through even a few nanohenries of wiring makes the rail at the chip's own pin dip and ring. Without a local capacitor, every output transition pollutes the chip's supply and the supply of everyone sharing the trace. The failure is invisible to a multimeter, which reads the average and reports that everything is fine; you need bandwidth, right at the pin, to see it.

## The numbers

The reflex is 100nF ceramic per power pin, placed as close as routing allows. That value is decades of convention, not magic — what actually matters is low inductance, which is why placement and short, fat connections beat a bigger capacitor parked far away. The gulps being smoothed are real: modern CMOS edge currents run on the order of tens to hundreds of milliamps for nanoseconds, part- and clock-dependent — vendor app notes carry the curves. And decoupling is layered, not singular: 100nF per pin handles the fast edges, while bulk capacitance per board section handles the slower heave. One does not substitute for the other.

## See it

Track 3's rail-bounce demo is this article made executable: run the co-sim with an MCU toggling pins fast and no capacitors, and watch the rail at the chip bounce hundreds of millivolts. Add 100nF at the pin plus bulk nearby, re-run, and watch it die down. It is the single most convincing demo in the curriculum.

## Go deeper

Related: [bulk-capacitance](bulk-capacitance), [esr-and-why-it-matters](esr-and-why-it-matters), [capacitor-types](capacitor-types), [ground-three-meanings](ground-three-meanings). Curriculum: Track 3 "Power", step 2 — rail bounce without caps, then with. Canonical reference: your chip datasheet's recommended bypass network and the vendor's decoupling app note.
