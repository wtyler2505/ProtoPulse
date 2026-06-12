---
slug: rms-vs-peak
title: RMS vs peak
ercCodes: []
---

## What it is

A waveform that swings has more than one "size": the peak is the highest instantaneous value, while RMS is the steady DC level that would deliver the same heating power. Meters, ratings, and mains voltages quote RMS; breakdown and clipping care about peak.

## Why it bites

You build a small power supply off "12V AC" and size the smoothing capacitor for 12V — then it bulges, because after rectification the cap charges toward the *peak*, about 17V, not the RMS label. The mirror-image failure: you check an audio amplifier's output with a meter reading "5V" and wonder why it clips, forgetting the sine actually swings ±7V and your supply rail can't reach. Anything rated in RMS (heating, fuses, transformer ratings) and anything that breaks on instantaneous value (capacitor voltage ratings, semiconductor breakdown) must be checked in its own currency.

## The numbers

For a sine wave only: RMS = peak ÷ √2 ≈ 0.707 × peak, so peak = 1.414 × RMS. Mains at 230V RMS peaks near 325V; 120V RMS peaks near 170V. For a square wave, RMS equals peak; for other shapes the ratio (crest factor) differs — that's why cheap "average-responding" meters mis-read non-sine waveforms by 10% or more, and true-RMS meters exist. The √2 factor is exact for sines and *only* sines; applying it to a PWM or audio waveform is a guess, not a calculation.

## See it

Generate a 5V-peak sine across a resistor in the sim and read the dissipated power; replace it with a 3.54V DC source and watch the resistor heat identically. Then swap the sine for a 5V square wave and see the power jump — same peak, different RMS.

## Go deeper

Related: [duty-cycle](duty-cycle), [power-and-heat](power-and-heat), [impedance-vs-resistance](impedance-vs-resistance). Curriculum: Track 1 wrap-up reading, ahead of Track 2's signal work. Canonical reference: Horowitz & Hill, *The Art of Electronics*, §1.3 (signals), plus any true-RMS meter application note.
