---
slug: comparators-and-hysteresis
title: Comparators and hysteresis
ercCodes: []
---

## What it is

A comparator answers one question — is the input above the threshold? — with a hard digital edge. Hysteresis gives it two thresholds instead of one: a higher trip point going up, a lower one coming down, so a decision once made takes real signal movement to reverse.

## Why it bites

A single threshold meets a slow, noisy signal and chatters. As the signal crawls through the trip point, every millivolt of noise crosses the threshold again and again — the output fires a burst of edges instead of one. The symptoms downstream are vivid: a relay buzzes at the switching point, an interrupt counter logs forty events for one physical event, a "low battery" LED flickers for an hour as the cell drifts past the threshold. This is the same disease as a slow edge on a digital input — the on-chip brown-out supervisor in [brown-out-detectors](brown-out-detectors) ships with hysteresis built in for exactly this reason, and mechanical contacts get [debouncing](debouncing) for the same crime. Two more bites: many comparators (the classic LM393 family) have open-collector outputs that read permanently low until you add a pull-up — see [pull-up-pull-down](pull-up-pull-down) — and an op-amp pressed into comparator duty is slow to recover from saturation and was never specified for the job.

## The numbers

Hysteresis comes from positive feedback: a resistor from output to the + input shifts the threshold by a fraction of the output swing, roughly the divider ratio it forms — work it as two cases, output high and output low. Size the band wider than your worst-case noise with margin; tens of millivolts is a common starting point for hobby-scale signals, hedged because your noise floor is the real spec. Too wide and you've added dead zone — a thermostat with a 5°C band technically never chatters and practically never regulates.

## See it

The slow-rise-11 puzzle is this article in miniature: a lazily rising node crawls past a single threshold and the downstream logic fires a flurry of edges. Run it, count the edges, then add the feedback resistor and watch one clean transition survive.

## Go deeper

Related: [brown-out-detectors](brown-out-detectors), [debouncing](debouncing), [pull-up-pull-down](pull-up-pull-down), [floating-inputs](floating-inputs), [op-amp-golden-rules](op-amp-golden-rules). Curriculum: Track 7 "Build the Probe" — threshold detection in the front end. Canonical reference: the LM393 datasheet plus any application note on adding comparator hysteresis.
