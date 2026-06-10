---
slug: zener-clamping
title: Zener clamping
ercCodes: []
---

## What it is

A Zener diode is built to break down on purpose: push it backwards past its rated voltage and it conducts, holding the voltage near that value instead of dying. That makes it a clamp — a ceiling for voltages that aren't supposed to exceed a limit — and, in a pinch, a crude voltage reference.

## Why it bites

The classic misuse is treating a Zener like a regulator: Zener straight across the output, no series resistor, and the first time the input rises the diode tries to absorb infinite current and burns. A Zener clamp only works as half of a pair — the series resistor takes the voltage difference; the Zener just refuses to let its node rise. The subtler bite is the soft knee: low-voltage Zeners don't snap cleanly at their rating. At small currents they conduct noticeably *below* the printed voltage, and the "5.1V" clamp on your 5V line may be quietly leaking all the time, loading the signal it was guarding. Third bite: the printed voltage is specified at one test current — at a different operating current you get a different voltage, and at near-zero current you get vagueness.

## The numbers

Zener dissipation is P = Vz × Iz, and the series resistor's job is to keep Iz survivable across the whole input range: worst case Iz = (Vin(max) − Vz) / R. Run that number against the diode's power rating before trusting the clamp. The datasheet quotes Vz at a stated test current — sizing your resistor so the working current lands near that test current gets you the printed voltage; far below it, expect less and softer. Hedged but honest: the soft-knee effect is most pronounced for low-voltage Zeners (below roughly 6V, where a different physical mechanism dominates); higher-voltage parts snap more crisply.

## See it

In the sim, sweep an input from 0 to 12V through 1kΩ into a 5.1V Zener and watch the output track the input, bend, and flatten near 5V. Then remove the resistor and re-run: the dissipation readout on the diode explains the smoke.

## Go deeper

Related: [diode-drop-and-flyback](diode-drop-and-flyback), [voltage-divider-output-impedance](voltage-divider-output-impedance), [power-and-heat](power-and-heat). Curriculum: not yet bound to a track step — Track 7's input-protection stage is where clamps earn their keep. Canonical reference: a Zener datasheet's Vz-vs-Iz characteristic curves.
