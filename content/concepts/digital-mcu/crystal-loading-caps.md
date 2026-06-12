---
slug: crystal-loading-caps
title: Crystal loading caps
ercCodes: []
---

## What it is

A quartz crystal only oscillates at its stamped frequency when it sees the load capacitance, CL, that it was specified against. The two small capacitors flanking the crystal — together with the stray capacitance of pins and traces — form that load. Wrong load means wrong frequency, slow starts, or no oscillation at all.

## Why it bites

The failures are oblique, which is what makes them expensive. UART gibberish at a "correct" baud rate: the clock is a fraction of a percent off and the bit-sampling error budget is gone. An RTC that drifts minutes per month: tiny load error, integrated over thirty days. The nastiest tier is marginality: an oscillator that starts on the warm bench but not in the cold car, or starts only nine boots out of ten — copy-pasted capacitor values from a different crystal's reference design are the usual confession. And the observer effect is real here: touching the crystal pin with a standard scope probe adds several picofarads of load, so the act of measuring a marginal oscillator changes — sometimes *fixes* — the thing you're measuring.

## The numbers

The textbook relationship: the two flanking caps appear in series to the crystal, so each cap ≈ 2 × (CL − Cstray). CL comes from *your* crystal's datasheet — commonly somewhere in the 8–20pF range, but always part-specific — and board stray is typically a few picofarads. The arithmetic usually lands the caps in the tens-of-picofarads neighborhood, but compute it; don't inherit it. Load error pulls frequency by only tens of ppm, yet 20ppm is on the order of a minute per month on an RTC, and UART tolerates only a small total clock error across both ends before framing fails. Drive level and amplifier gain margins are deeper waters — the MCU vendor's oscillator app note is the map.

## See it

In the sim, run a crystal oscillator model at its specified CL, then halve the loading caps and watch the frequency counter step away from the stamp — small in hertz, fatal in ppm. Feed both clocks into a UART co-sim at 115200 baud and watch framing errors arrive with the drift.

## Go deeper

Related: [reading-a-datasheet](reading-a-datasheet), [capacitor-types](capacitor-types), [tolerance-stacking](tolerance-stacking). Curriculum: Track 4 "Talking Chips", step 1 — the baud-mismatch puzzle is often this article in disguise. Canonical reference: your crystal datasheet's CL specification and the MCU vendor's oscillator design app note.
