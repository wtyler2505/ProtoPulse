---
slug: level-shifting
title: Level shifting
ercCodes: []
---

## What it is

Level shifting is the translation layer between logic families running at different supply voltages — most commonly a 3.3V MCU talking to a 5V peripheral, or vice versa. One wire, two definitions of "high," and a circuit in between that makes both ends see a legal voltage.

## Why it bites

It bites in both directions, differently. Going up, a 3.3V output into a true 5V CMOS input may never reach the input's high threshold — the part reads your "high" as undefined, and you get a peripheral that works on one board and not the next, because undefined means temperature- and part-lot-dependent. Going down, a 5V output into a 3.3V-only input forces current through the input's internal clamp diode — the chip may keep working while quietly degrading, or latch up outright. The cruelest version: it works on the bench, because clamp diodes tolerate abuse for a while. See [5v-tolerance-myths](5v-tolerance-myths) before declaring any pin safe.

## The numbers

Textbook thresholds: classic CMOS inputs want V_IH around 0.7×VDD — at 5V that's 3.5V, which a 3.3V output cannot reach, period. TTL-compatible inputs want only about 2.0V, which 3.3V clears easily — so check which threshold *your* input actually specifies in its datasheet before adding hardware. Down-shifting one-way signals: a resistor divider works, but its output impedance and the input capacitance form an RC that rounds off fast edges — fine for a button, marginal for a fast clock. Bidirectional open-drain buses like I2C use the classic single-MOSFET shifter (one small N-FET per line, gate on the low rail, pull-ups on both sides) — the arrangement documented in NXP's app note AN10441. Dedicated level-shifter ICs handle fast or many-channel cases; auto-direction ones have weak drive and hate bus capacitance, so read their fine print.

## See it

Drive a 5V CMOS input model from a 3.3V push-pull output in the sim and probe the receiver's interpretation: the input sits in the undefined band and the output chatters. Insert a MOSFET shifter, re-run, and watch both sides swing rail to rail.

## Go deeper

Related: [5v-tolerance-myths](5v-tolerance-myths), [voltage-divider-output-impedance](voltage-divider-output-impedance), [rc-time-constants](rc-time-constants), [i2c-electrical-model](i2c-electrical-model), [mosfet-gate-basics](mosfet-gate-basics). Curriculum: Track 4 "Talking Chips" — mixed-voltage buses appear the moment you wire a real sensor. Canonical reference: NXP AN10441, plus the V_IH/V_IL table of every part you connect.
