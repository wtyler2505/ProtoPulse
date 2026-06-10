---
slug: rc-time-constants
title: RC time constants
ercCodes: []
---

## What it is

Charge a capacitor through a resistor and the voltage doesn't step — it glides along an exponential curve whose speed is set by one number, τ = R × C. That single product governs debounce circuits, power-on delays, filters, and every 555 timer you'll ever build.

## Why it bites

You add an "RC debounce" to a button by copying values from a forum post, and it either does nothing (τ far shorter than the bounce) or makes the button feel dead (τ so long that taps get swallowed). The same miss shows up in reset circuits: a reset RC that's too quick releases the chip before the rail is stable, and the symptom is a board that boots on the bench supply but not on the battery. The deeper misunderstanding bites when you wait for "fully charged": the exponential never quite arrives, so thresholds matter — a chip whose input flips at 70% of the rail sees a very different delay than one that flips at 30%, from the *same* RC.

## The numbers

τ = R × C exactly: 10kΩ × 100nF = 1ms. In one τ the voltage covers 63.2% of the remaining distance to its target; after 3τ it's at about 95%, after 5τ about 99.3% — "5τ ≈ done" is the standard engineering call. Discharge mirrors charge: down to 36.8% in one τ. The classic 555 monostable fires for t = 1.1 × R × C — that 1.1 is just the exponential evaluated at the chip's 2/3-rail threshold, the same math in a trench coat. Limit on all of it: the formulas assume the source and load don't fight the RC — a meaningful load across the capacitor changes both the curve and where it ends ([voltage-divider-output-impedance](voltage-divider-output-impedance) is that story).

## See it

Charge 100nF through 10k in the sim and put the scope cursor at 1ms: 63% of the rail, right on schedule. Then drive the same RC with a square wave at three frequencies and watch it act as a delay, a ramp generator, and a near-flat average — one τ, three behaviors.

## Go deeper

Related: [impedance-vs-resistance](impedance-vs-resistance), [duty-cycle](duty-cycle), [capacitor-types](capacitor-types). Curriculum: Track 2 "Signals & Switches", steps 1–2 — the 555 math and the hardware debounce. Canonical reference: Horowitz & Hill, *The Art of Electronics*, §1.4 (RC circuits).
